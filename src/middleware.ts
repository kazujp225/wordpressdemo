import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// インメモリレート制限（エッジランタイム互換）
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs?: number } {
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

// CSRF検証（エッジランタイム互換）
function validateCSRF(request: NextRequest): boolean {
  // GETリクエストはスキップ
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return true;
  }

  const pathname = request.nextUrl.pathname;

  // Webhookはスキップ（署名検証で保護）
  if (pathname.startsWith('/api/webhooks/')) {
    return true;
  }

  // フォーム送信は公開API
  if (pathname === '/api/form-submissions') {
    return true;
  }

  // Originヘッダーの検証
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  if (origin) {
    try {
      const originUrl = new URL(origin);
      // 同一ホストかチェック
      if (originUrl.host !== host) {
        // 許可リストをチェック
        const allowedHosts = ['lpnavix.com', 'www.lpnavix.com', 'localhost:3000', '127.0.0.1:3000'];
        if (!allowedHosts.includes(originUrl.host)) {
          console.warn(`[CSRF] Blocked request from origin: ${origin}`);
          return false;
        }
      }
    } catch {
      return false;
    }
  }

  return true;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // APIルートのレート制限
  if (pathname.startsWith('/api/')) {
    // クライアントIP取得
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // エンドポイント別のレート制限設定
    let maxRequests = 60;
    let windowMs = 60 * 1000;

    if (pathname.startsWith('/api/ai/')) {
      // AI API: 1分間に20リクエスト
      maxRequests = 20;
    } else if (pathname.startsWith('/api/auth/')) {
      // 認証API: 1分間に10リクエスト
      maxRequests = 10;
    } else if (pathname === '/api/form-submissions') {
      // フォーム送信: 1分間に5リクエスト
      maxRequests = 5;
    }

    const rateLimitKey = `${pathname}:${ip}`;
    const rateLimit = checkRateLimit(rateLimitKey, maxRequests, windowMs);

    if (!rateLimit.allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((rateLimit.retryAfterMs || 60000) / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // CSRF検証
    if (!validateCSRF(request)) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid request origin' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // 既存の認証・セッション処理
  return await updateSession(request);
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
