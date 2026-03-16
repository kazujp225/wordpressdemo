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

// ========================================
// 自動ブロックリスト（不審IP）
// ========================================
const blockedIPs = new Map<string, number>(); // IP → ブロック解除時刻
const BLOCK_DURATION = 10 * 60 * 1000; // 10分間ブロック
const suspiciousHitCount = new Map<string, number>(); // IP → 不審ヒット数
const SUSPICIOUS_THRESHOLD = 5; // 5回不審行動でブロック

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
  // ブロックリストのクリーンアップ
  for (const [ip, expiry] of blockedIPs.entries()) {
    if (now > expiry) {
      blockedIPs.delete(ip);
      suspiciousHitCount.delete(ip);
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
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim()).filter(ip => ip);
    return ips[ips.length - 1];
  }

  return 'unknown';
}

// ========================================
// Bot検出（悪意のあるスクレイパー・攻撃ツール）
// ========================================
const BLOCKED_USER_AGENTS = [
  // スクレイピングツール
  'scrapy', 'httpclient', 'python-requests', 'go-http-client',
  'java/', 'libwww-perl', 'wget', 'curl/',
  // 攻撃ツール
  'nikto', 'sqlmap', 'nmap', 'masscan', 'zgrab',
  'nuclei', 'dirbuster', 'gobuster', 'wfuzz', 'ffuf',
  // 悪質ボット
  'semrushbot', 'ahrefsbot', 'dotbot', 'mj12bot',
  'blexbot', 'seekport', 'petalbot', 'bytespider',
  'megaindex', 'zoominfobot', 'dataforseo',
];

// 正当なボット（許可）
const ALLOWED_BOTS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot',
  'facebot', 'twitterbot', 'linkedinbot',
  'chatgpt-user', 'gptbot', 'claude-web', 'perplexitybot', 'applebot',
];

function checkUserAgent(request: NextRequest): { blocked: boolean; reason?: string } {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();

  // User-Agentが空の場合（ツールによるアクセス）
  if (!ua || ua.length < 5) {
    return { blocked: true, reason: 'Empty or suspicious User-Agent' };
  }

  // 許可ボットは通す
  if (ALLOWED_BOTS.some(bot => ua.includes(bot))) {
    return { blocked: false };
  }

  // ブロックリストに一致するか
  for (const blocked of BLOCKED_USER_AGENTS) {
    if (ua.includes(blocked)) {
      return { blocked: true, reason: `Blocked bot: ${blocked}` };
    }
  }

  return { blocked: false };
}

// ========================================
// パス探索（脆弱性スキャン）検出
// ========================================
const SUSPICIOUS_PATHS = [
  '/.env', '/.git', '/wp-admin', '/wp-login', '/wp-content',
  '/phpmyadmin', '/admin.php', '/xmlrpc.php', '/wp-json',
  '/.htaccess', '/.htpasswd', '/config.php', '/database.yml',
  '/server-status', '/server-info', '/.well-known/security.txt',
  '/cgi-bin/', '/shell', '/cmd', '/eval',
  '/../', '/etc/passwd', '/proc/self',
];

function isSuspiciousPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return SUSPICIOUS_PATHS.some(p => lower.includes(p));
}

// 不審行動をカウントし、閾値超えでブロック
function markSuspicious(ip: string): void {
  const count = (suspiciousHitCount.get(ip) || 0) + 1;
  suspiciousHitCount.set(ip, count);
  if (count >= SUSPICIOUS_THRESHOLD) {
    blockedIPs.set(ip, Date.now() + BLOCK_DURATION);
    console.warn(`[SECURITY] Auto-blocked IP: ${ip} (${count} suspicious hits)`);
  }
}

// CSRF検証（エッジランタイム互換・強化版）
function validateCSRF(request: NextRequest): boolean {
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

  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  if (!origin) {
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
    console.warn(`[CSRF] No Origin/Referer header for ${request.method} ${pathname}`);
    return false;
  }

  try {
    const originUrl = new URL(origin);
    if (originUrl.host === host) return true;
    const allowedHosts = getAllowedHosts();
    if (allowedHosts.includes(originUrl.host)) return true;
    console.warn(`[CSRF] Blocked request from origin: ${origin}`);
    return false;
  } catch {
    return false;
  }
}

// 許可ホスト一覧
function getAllowedHosts(): string[] {
  const envHosts = process.env.ALLOWED_ORIGINS?.split(',').map(h => h.trim()) || [];
  const defaultHosts = ['lpnavix.com', 'www.lpnavix.com'];

  if (process.env.NODE_ENV === 'development') {
    defaultHosts.push('localhost:3000', 'localhost:3002', '127.0.0.1:3000', '127.0.0.1:3002');
  }

  return [...defaultHosts, ...envHosts];
}

// セキュリティヘッダーを追加
function addSecurityHeaders(response: NextResponse, pathname?: string): NextResponse {
  // 公開ページにはキャッシュ設定（スクレイピング負荷軽減）
  if (pathname?.startsWith('/p/')) {
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  } else if (!response.headers.has('Cache-Control')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const ip = getClientIP(request);

  // ========================================
  // 1. IPブロックリストチェック
  // ========================================
  const blockExpiry = blockedIPs.get(ip);
  if (blockExpiry && Date.now() < blockExpiry) {
    return new NextResponse('Access Denied', { status: 403 });
  }

  // ========================================
  // 2. 脆弱性スキャン検出（全ルート）
  // ========================================
  if (isSuspiciousPath(pathname)) {
    markSuspicious(ip);
    console.warn(`[SECURITY] Suspicious path access: ${pathname} from ${ip}`);
    return new NextResponse('Not Found', { status: 404 });
  }

  // ========================================
  // 3. Bot検出（全ルート）
  // ========================================
  const botCheck = checkUserAgent(request);
  if (botCheck.blocked) {
    // 公開ページ以外のボットアクセスはブロック
    if (!pathname.startsWith('/p/')) {
      markSuspicious(ip);
      console.warn(`[SECURITY] Bot blocked: ${botCheck.reason} from ${ip}`);
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // ========================================
  // 4. 公開ページのスクレイピング防御
  // ========================================
  if (pathname.startsWith('/p/')) {
    const pageRateKey = `page:${ip}`;
    // 公開ページ: 1分間に30リクエスト（通常ユーザーは十分、スクレイパーはブロック）
    const pageRate = checkRateLimit(pageRateKey, 30, 60 * 1000);
    if (!pageRate.allowed) {
      markSuspicious(ip);
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': '60' },
      });
    }
  }

  // ========================================
  // 5. APIルートのセキュリティ処理
  // ========================================
  if (pathname.startsWith('/api/')) {
    // エンドポイント別のレート制限設定
    let maxRequests = 60;
    const windowMs = 60 * 1000;

    if (pathname.startsWith('/api/ai/')) {
      maxRequests = 20;
    } else if (pathname.startsWith('/api/auth/')) {
      maxRequests = 10;
    } else if (pathname === '/api/form-submissions') {
      maxRequests = 5;
    } else if (pathname.startsWith('/api/upload')) {
      maxRequests = 15;
    } else if (pathname.startsWith('/api/admin/')) {
      maxRequests = 30;
    }

    const rateLimitKey = `${pathname}:${ip}`;
    const rateLimit = checkRateLimit(rateLimitKey, maxRequests, windowMs);

    if (!rateLimit.allowed) {
      // レート制限に繰り返し引っかかる場合は不審行動としてカウント
      markSuspicious(ip);
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
      ), pathname);
    }

    // CSRF検証
    if (!validateCSRF(request)) {
      return addSecurityHeaders(new NextResponse(
        JSON.stringify({ error: '不正なリクエスト元です' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      ), pathname);
    }
  }

  // 既存の認証・セッション処理
  const response = await updateSession(request);
  return addSecurityHeaders(response, pathname);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)',
  ],
};
