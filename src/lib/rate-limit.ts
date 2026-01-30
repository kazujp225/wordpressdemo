/**
 * シンプルなインメモリレート制限
 * 本番環境ではRedisベースの実装を推奨
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// インメモリストア（サーバーレス環境では各インスタンスで独立）
const rateLimitStore = new Map<string, RateLimitEntry>();

// 定期的にストアをクリーンアップ（メモリリーク防止）
const CLEANUP_INTERVAL = 60 * 1000; // 1分ごと
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  // ウィンドウ内の最大リクエスト数
  maxRequests: number;
  // ウィンドウサイズ（ミリ秒）
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfterMs?: number;
}

// プリセット設定
export const RATE_LIMITS = {
  // AI API: 1分間に20リクエスト
  AI_API: { maxRequests: 20, windowMs: 60 * 1000 },
  // 認証API: 1分間に10リクエスト
  AUTH_API: { maxRequests: 10, windowMs: 60 * 1000 },
  // 一般API: 1分間に60リクエスト
  GENERAL_API: { maxRequests: 60, windowMs: 60 * 1000 },
  // Webhook: 1分間に100リクエスト（Stripeからの連続通知対応）
  WEBHOOK: { maxRequests: 100, windowMs: 60 * 1000 },
  // フォーム送信: 1分間に5リクエスト（スパム対策）
  FORM_SUBMIT: { maxRequests: 5, windowMs: 60 * 1000 },
} as const;

/**
 * レート制限をチェック
 * @param identifier ユーザーID、IPアドレス、またはその組み合わせ
 * @param config レート制限設定
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpiredEntries();

  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  // エントリがない、または期限切れの場合は新規作成
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  // リクエスト数を確認
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfterMs: entry.resetTime - now,
    };
  }

  // カウントをインクリメント
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * レート制限ヘッダーを生成
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
  };

  if (!result.allowed && result.retryAfterMs) {
    headers['Retry-After'] = String(Math.ceil(result.retryAfterMs / 1000));
  }

  return headers;
}

/**
 * ユーザーIDとエンドポイントからレート制限キーを生成
 */
export function createRateLimitKey(
  userId: string | null,
  endpoint: string,
  ip?: string
): string {
  // ユーザーIDがあればそれを使用、なければIPアドレス
  const identifier = userId || ip || 'anonymous';
  return `${endpoint}:${identifier}`;
}
