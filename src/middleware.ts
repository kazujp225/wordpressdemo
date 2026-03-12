import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// インメモリレート制限（エッジランタイム互換）
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const MAX_STORE_SIZE = 10000;
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 30 * 1000; // 30秒ごと

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
  // サイズ上限を超えた場合は全クリア（安全弁）
  if (rateLimitStore.size > MAX_STORE_SIZE) {
    rateLimitStore.clear();
  }
}

function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs?: number } {
  cleanupExpiredEntries();

  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetTime - now };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

// IP取得（プロキシ信頼チェック付き）
function getClientIP(request: NextRequest): string {
  // Render.com / Vercel / Cloudflare などの信頼できるプロキシからのヘッダーのみ使用
  // x-forwarded-for は最初のIPのみ使用（クライアントが偽装できるのは先頭に追加される分）
  // 信頼できるプロキシが付与するヘッダーを優先
  const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIp) return cfConnectingIp.trim();

  const xRealIp = request.headers.get('x-real-ip'); // Nginx/Render
  if (xRealIp) return xRealIp.trim();

  // x-forwarded-for: クライアントが先頭にIPを追加できるため、
  // 信頼できるプロキシが最後に付与するIPを使用する
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim()).filter(ip => ip);
    // 最後のIPが信頼できるプロキシが付与したクライアントIP
    return ips[ips.length - 1];
  }

  return 'unknown';
}

// CSRF検証（エッジランタイム互換・強化版）
function validateCSRF(request: NextRequest): boolean {
  // GETリクエストはスキップ（副作用なし）
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return true;
  }

  const pathname = request.nextUrl.pathname;

  // Webhookはスキップ（署名検証で保護）
  if (pathname.startsWith('/api/webhooks/')) {
    return true;
  }

  // フォーム送信は公開API（レート制限で保護）
  if (pathname === '/api/form-submissions') {
    return true;
  }

  // Originヘッダーの検証
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  // 変更操作にはOriginヘッダーを必須にする
  if (!origin) {
    // Refererヘッダーをフォールバックとして使用
    const referer = request.headers.get('referer');
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.host === host) return true;
        const allowedHosts = getAllowedHosts();
        if (allowedHosts.includes(refererUrl.host)) return true;
      } catch {
        return false;
      }
    }
    // OriginもRefererもない場合は拒否（ブラウザからのリクエストには必ずどちらかがある）
    // ただしサーバー間通信を考慮してAPIキーベースの認証があれば許可
    console.warn(`[CSRF] No Origin/Referer header for ${request.method} ${pathname}`);
    return false;
  }

  try {
    const originUrl = new URL(origin);
    // 同一ホストかチェック
    if (originUrl.host === host) return true;

    // 許可リストをチェック
    const allowedHosts = getAllowedHosts();
    if (allowedHosts.includes(originUrl.host)) return true;

    console.warn(`[CSRF] Blocked request from origin: ${origin}`);
    return false;
  } catch {
    return false;
  }
}

// 許可ホスト一覧（環境変数から取得可能に）
function getAllowedHosts(): string[] {
  const envHosts = process.env.ALLOWED_ORIGINS?.split(',').map(h => h.trim()) || [];
  const defaultHosts = ['lpnavix.com', 'www.lpnavix.com'];

  // 開発環境のみlocalhostを許可
  if (process.env.NODE_ENV === 'development') {
    defaultHosts.push('localhost:3000', '127.0.0.1:3000');
  }

  return [...defaultHosts, ...envHosts];
}

// セキュリティヘッダーを追加
function addSecurityHeaders(response: NextResponse): NextResponse {
  // キャッシュ制御（API レスポンス）
  if (!response.headers.has('Cache-Control')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // APIルートのセキュリティ処理
  if (pathname.startsWith('/api/')) {
    // クライアントIP取得（偽装対策済み）
    const ip = getClientIP(request);

    // エンドポイント別のレート制限設定
    let maxRequests = 60;
    const windowMs = 60 * 1000;

    if (pathname.startsWith('/api/ai/')) {
      // AI API: 1分間に20リクエスト
      maxRequests = 20;
    } else if (pathname.startsWith('/api/auth/')) {
      // 認証API: 1分間に10リクエスト
      maxRequests = 10;
    } else if (pathname === '/api/form-submissions') {
      // フォーム送信: 1分間に5リクエスト（スパム防止）
      maxRequests = 5;
    } else if (pathname.startsWith('/api/upload')) {
      // アップロード: 1分間に15リクエスト
      maxRequests = 15;
    } else if (pathname.startsWith('/api/admin/')) {
      // 管理API: 1分間に30リクエスト
      maxRequests = 30;
    }

    const rateLimitKey = `${pathname}:${ip}`;
    const rateLimit = checkRateLimit(rateLimitKey, maxRequests, windowMs);

    if (!rateLimit.allowed) {
      return addSecurityHeaders(new NextResponse(
        JSON.stringify({ error: 'リクエスト数が上限を超えました。しばらくしてから再試行してください。' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((rateLimit.retryAfterMs || 60000) / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      ));
    }

    // CSRF検証
    if (!validateCSRF(request)) {
      return addSecurityHeaders(new NextResponse(
        JSON.stringify({ error: '不正なリクエスト元です' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      ));
    }
  }

  // 既存の認証・セッション処理
  const response = await updateSession(request);
  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)',
  ],
};
