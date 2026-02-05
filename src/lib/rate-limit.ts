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

// ========================================
// DB基盤の同時実行制限（GenerationRun使用）
// ========================================

import { prisma } from '@/lib/db';

// 同時実行制限の設定
const MAX_CONCURRENT_GENERATIONS = 2; // 同時に処理できる生成数

// 同時実行チェック結果
export interface ConcurrentLimitResult {
  allowed: boolean;
  reason?: string;
  currentConcurrent: number;
  maxConcurrent: number;
}

/**
 * 同時実行数をチェック（DBベース）
 * processingステータスのGenerationRunの数をカウント
 */
export async function checkConcurrentLimit(userId: string): Promise<ConcurrentLimitResult> {
  // processing状態のリクエスト数をカウント
  const processingCount = await prisma.generationRun.count({
    where: {
      userId,
      status: 'processing',
    },
  });

  if (processingCount >= MAX_CONCURRENT_GENERATIONS) {
    return {
      allowed: false,
      reason: `同時実行数の上限（${MAX_CONCURRENT_GENERATIONS}件）に達しています。処理完了までお待ちください。`,
      currentConcurrent: processingCount,
      maxConcurrent: MAX_CONCURRENT_GENERATIONS,
    };
  }

  return {
    allowed: true,
    currentConcurrent: processingCount,
    maxConcurrent: MAX_CONCURRENT_GENERATIONS,
  };
}

/**
 * 全てのレート制限をチェック（インメモリ + DB同時実行）
 */
export async function checkAllRateLimits(
  userId: string,
  endpoint: string
): Promise<{
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
}> {
  // 1. インメモリレート制限チェック（1分あたりN回）
  const rateLimitKey = createRateLimitKey(userId, endpoint);
  const rateResult = checkRateLimit(rateLimitKey, RATE_LIMITS.AI_API);
  if (!rateResult.allowed) {
    return {
      allowed: false,
      reason: `リクエスト制限（1分あたり${RATE_LIMITS.AI_API.maxRequests}回）に達しています。${Math.ceil((rateResult.retryAfterMs || 0) / 1000)}秒後に再試行してください。`,
      retryAfterMs: rateResult.retryAfterMs,
    };
  }

  // 2. DB同時実行数チェック
  const concurrentResult = await checkConcurrentLimit(userId);
  if (!concurrentResult.allowed) {
    return {
      allowed: false,
      reason: concurrentResult.reason,
    };
  }

  return { allowed: true };
}

/**
 * GenerationRunをprocessing状態で作成（冪等性対応）
 * 既存のrequestIdがある場合はそのレコードを返す
 */
export async function createOrGetGenerationRun(
  userId: string,
  requestId: string,
  data: {
    type: string;
    endpoint: string;
    model: string;
    inputPrompt: string;
    imageCount?: number;
    estimatedCost?: number;
  }
): Promise<{
  run: { id: number; status: string; outputResult: string | null; errorMessage: string | null };
  isExisting: boolean;
}> {
  // 既存のrequestIdをチェック
  const existing = await prisma.generationRun.findUnique({
    where: { requestId },
    select: {
      id: true,
      status: true,
      outputResult: true,
      errorMessage: true,
    },
  });

  if (existing) {
    console.log(`[RateLimit] Existing request found: ${requestId}, status: ${existing.status}`);
    return { run: existing, isExisting: true };
  }

  // 新規作成（processing状態）
  const newRun = await prisma.generationRun.create({
    data: {
      userId,
      requestId,
      type: data.type,
      endpoint: data.endpoint,
      model: data.model,
      inputPrompt: data.inputPrompt,
      imageCount: data.imageCount,
      estimatedCost: data.estimatedCost,
      status: 'processing',
    },
    select: {
      id: true,
      status: true,
      outputResult: true,
      errorMessage: true,
    },
  });

  console.log(`[RateLimit] Created new generation run: ${requestId}, id: ${newRun.id}`);
  return { run: newRun, isExisting: false };
}

/**
 * GenerationRunのステータスを更新
 */
export async function updateGenerationRunStatus(
  requestId: string,
  status: 'succeeded' | 'failed',
  data?: {
    outputResult?: string;
    errorMessage?: string;
    durationMs?: number;
  }
): Promise<void> {
  await prisma.generationRun.update({
    where: { requestId },
    data: {
      status,
      outputResult: data?.outputResult,
      errorMessage: data?.errorMessage,
      durationMs: data?.durationMs,
    },
  });

  console.log(`[RateLimit] Updated generation run: ${requestId}, status: ${status}`);
}

/**
 * スタックしたprocessingリクエストをクリーンアップ
 * 一定時間（10分）以上processingのままのリクエストをfailedに変更
 */
export async function cleanupStaleProcessingRuns(maxAgeMs: number = 10 * 60 * 1000): Promise<number> {
  const staleThreshold = new Date(Date.now() - maxAgeMs);

  const result = await prisma.generationRun.updateMany({
    where: {
      status: 'processing',
      createdAt: { lt: staleThreshold },
    },
    data: {
      status: 'failed',
      errorMessage: 'Request timed out (cleanup)',
    },
  });

  if (result.count > 0) {
    console.log(`[RateLimit] Cleaned up ${result.count} stale processing runs`);
  }

  return result.count;
}
