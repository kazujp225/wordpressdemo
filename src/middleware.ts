import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// ========================================
// セキュリティ方針:
// - 認証済みユーザーの操作は基本的にブロックしない
// - 攻撃ツール・脆弱性スキャンのみ遮断
// - レート制限は「異常な量」のみ対象（普通の操作は通す）
// - IPブロックは明確な攻撃パターンのみ
// ========================================

// --- インメモリレート制限 ---
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return; // 60秒ごと
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) rateLimitStore.delete(key);
  }
  if (rateLimitStore.size > 10000) rateLimitStore.clear();
}

function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  cleanupExpired();
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

// --- IP取得 ---
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ||
    'unknown'
  );
}

// --- 脆弱性スキャン検出（明らかな攻撃パスのみ） ---
const ATTACK_PATHS = [
  '/.env', '/.git', '/wp-admin', '/wp-login', '/phpmyadmin',
  '/xmlrpc.php', '/.htaccess', '/.htpasswd',
  '/cgi-bin/', '/../', '/etc/passwd', '/proc/self',
];

function isAttackPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return ATTACK_PATHS.some(p => lower.includes(p));
}

// --- 攻撃ツール検出（APIのみ適用） ---
const ATTACK_TOOLS = [
  'nikto', 'sqlmap', 'nmap', 'masscan', 'zgrab',
  'nuclei', 'dirbuster', 'gobuster', 'wfuzz', 'ffuf',
];

function isAttackTool(ua: string): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return ATTACK_TOOLS.some(t => lower.includes(t));
}

// --- CSRF検証（POSTリクエストのみ） ---
function validateCSRF(request: NextRequest): boolean {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return true;
  }

  const pathname = request.nextUrl.pathname;

  // Webhook・公開フォームはスキップ
  if (pathname.startsWith('/api/webhooks/') || pathname === '/api/form-submissions') {
    return true;
  }

  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  // Originがない場合は許可（同一オリジンのfetchではOriginが付かないことがある）
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    // 同一ホスト
    if (originUrl.host === host) return true;
    // 許可リスト
    const allowed = getAllowedHosts();
    return allowed.includes(originUrl.host);
  } catch {
    return false;
  }
}

function getAllowedHosts(): string[] {
  const hosts = ['lpnavix.com', 'www.lpnavix.com'];

  if (process.env.NODE_ENV === 'development') {
    hosts.push(
      'localhost:3000', 'localhost:3002', 'localhost:3003',
      '127.0.0.1:3000', '127.0.0.1:3002', '127.0.0.1:3003',
    );
  }

  // Renderホスト自動追加
  const renderHost = process.env.RENDER_EXTERNAL_HOSTNAME;
  if (renderHost) hosts.push(renderHost);

  // 環境変数からの追加ホスト
  const envHosts = process.env.ALLOWED_ORIGINS?.split(',').map(h => h.trim()).filter(Boolean);
  if (envHosts) hosts.push(...envHosts);

  return hosts;
}

// --- セキュリティヘッダー ---
function addHeaders(response: NextResponse, pathname: string): NextResponse {
  if (pathname.startsWith('/p/')) {
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  }
  return response;
}

// ========================================
// メイン処理
// ========================================
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const ip = getClientIP(request);

  // 1. 攻撃パス検出 → 404（/.env, /.git, /wp-admin 等）
  if (isAttackPath(pathname)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 2. APIルートのセキュリティ
  if (pathname.startsWith('/api/')) {
    const ua = request.headers.get('user-agent') || '';

    // 攻撃ツール → ブロック
    if (isAttackTool(ua)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // CSRF検証
    if (!validateCSRF(request)) {
      return NextResponse.json({ error: '不正なリクエスト元です' }, { status: 403 });
    }

    // レート制限（IPベース、エンドポイントグループ単位）
    let max = 200; // デフォルト: 1分200回（余裕あり）
    if (pathname.startsWith('/api/auth/'))           max = 15;
    else if (pathname === '/api/form-submissions')   max = 5;
    else if (pathname.startsWith('/api/ai/'))         max = 60;
    else if (pathname.startsWith('/api/upload'))      max = 40;

    // エンドポイント個別ではなくグループ単位でカウント
    const group = pathname.startsWith('/api/ai/') ? '/api/ai'
                : pathname.startsWith('/api/auth/') ? '/api/auth'
                : pathname.startsWith('/api/upload') ? '/api/upload'
                : pathname.startsWith('/api/admin/') ? '/api/admin'
                : '/api/other';

    if (!checkRateLimit(`${group}:${ip}`, max, 60_000)) {
      return NextResponse.json(
        { error: 'リクエスト数が上限を超えました。少し待ってから再試行してください。' },
        { status: 429, headers: { 'Retry-After': '30' } }
      );
    }

    // ボディサイズチェック
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    const maxBody = pathname.startsWith('/api/upload') ? 52_428_800 : 10_485_760;
    if (contentLength > maxBody) {
      return NextResponse.json({ error: 'リクエストが大きすぎます' }, { status: 413 });
    }
  }

  // 3. 公開ページの過剰アクセス防止
  if (pathname.startsWith('/p/')) {
    if (!checkRateLimit(`page:${ip}`, 60, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429, headers: { 'Retry-After': '30' } });
    }
  }

  // 4. セッション管理（Supabase Auth）
  const response = await updateSession(request);
  return addHeaders(response, pathname);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)',
  ],
};
