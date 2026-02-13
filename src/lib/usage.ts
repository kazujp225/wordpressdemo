/**
 * 使用量管理ユーティリティ
 * クレジットベースのAPI使用量管理
 */

import { prisma } from '@/lib/db';
import { getPlan, PlanType, requiresSubscription, isFreePlan, FREE_BANNER_EDIT_LIMIT } from '@/lib/plans';
import {
  checkCreditBalance,
  consumeCredit,
  getCurrentBalance,
  InsufficientCreditError,
} from '@/lib/credits';
import { AI_COSTS, estimateImageCost, estimateTextCost } from '@/lib/ai-costs';
import { getGoogleApiKeyWithInfo } from '@/lib/apiKeys';

export interface UsageStats {
  // 今月のAI生成回数
  monthlyGenerations: number;
  // 今月のアップロード数
  monthlyUploads: number;
  // 総ページ数
  totalPages: number;
  // 総バナー数
  totalBanners: number;
  // 総ストレージ使用量（MB）
  totalStorageMB: number;
}

export interface UsageLimitCheck {
  allowed: boolean;
  reason?: string;
  current?: number;
  limit?: number;
  remaining?: number | 'unlimited';
  // クレジットベースの追加フィールド
  currentBalanceUsd?: number;
  estimatedCostUsd?: number;
  remainingAfterUsd?: number;
  needPurchase?: boolean;
  needSubscription?: boolean;
  needApiKey?: boolean; // Freeプランで自分のAPIキーが必要
  usingOwnApiKey?: boolean; // 自分のAPIキーを使用中
  skipCreditConsumption?: boolean; // クレジット消費をスキップするか
  isFreeBannerEdit?: boolean; // Freeプランの無料バナー編集か（成功後にカウンターをインクリメントする）
}

/**
 * ユーザーの現在の使用量を取得
 */
export async function getUserUsage(userId: string): Promise<UsageStats> {
  // 今月の開始日を取得
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 並列でクエリを実行
  const [generationCount, uploadCount, pageCount, bannerCount] = await Promise.all([
    // 今月のAI生成回数
    prisma.generationRun.count({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
        status: 'succeeded',
      },
    }),
    // 今月のアップロード数
    prisma.mediaImage.count({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
        sourceType: 'upload',
      },
    }),
    // 総ページ数
    prisma.page.count({
      where: { userId },
    }),
    // 総バナー数
    prisma.banner.count({
      where: { userId },
    }),
  ]);

  // ストレージ使用量は概算（画像数 × 平均サイズ）
  const estimatedStorageMB = Math.round((generationCount + uploadCount) * 0.5);

  return {
    monthlyGenerations: generationCount,
    monthlyUploads: uploadCount,
    totalPages: pageCount,
    totalBanners: bannerCount,
    totalStorageMB: estimatedStorageMB,
  };
}

/**
 * ユーザーのプランを取得
 */
export async function getUserPlan(userId: string): Promise<string> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { plan: true },
  });

  return settings?.plan || 'free';
}

// 開発者アカウント（クレジット無制限）
const DEVELOPER_EMAILS: string[] = [
  // 'renrenfujiwara@gmail.com', // 本番環境では無効化
];

/**
 * AI生成が可能かチェック（クレジットベース）
 * @param estimatedCostUsd 推定コスト（USD）。指定しない場合はデフォルト値を使用
 */
export async function checkGenerationLimit(
  userId: string,
  estimatedCostUsd?: number,
  context?: { isBannerEdit?: boolean }
): Promise<UsageLimitCheck> {
  // 開発者アカウントチェック
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { plan: true, email: true, freeBannerEditsUsed: true },
  });

  // 開発者アカウントはクレジット無制限
  if (userSettings?.email && DEVELOPER_EMAILS.includes(userSettings.email)) {
    return {
      allowed: true,
      skipCreditConsumption: true,
    };
  }

  const planId = userSettings?.plan || 'free';

  // サブスク必須チェック（starterプランなど廃止されたプラン）
  if (requiresSubscription(planId)) {
    return {
      allowed: false,
      reason:
        'サブスクリプションが必要です。プランを選択してください。',
      needSubscription: true,
    };
  }

  // APIキー情報を取得
  const apiKeyInfo = await getGoogleApiKeyWithInfo(userId);

  // Freeプランの場合
  const plan = getPlan(planId);
  if (!plan.limits.canAIGenerate) {
    // Freeプラン バナーAI編集の無料枠チェック
    const freeLimit = plan.limits.freeBannerEditLimit ?? 0;
    if (context?.isBannerEdit && freeLimit > 0) {
      const used = userSettings?.freeBannerEditsUsed ?? 0;
      if (used < freeLimit) {
        return {
          allowed: true,
          skipCreditConsumption: true,
          isFreeBannerEdit: true,
          current: used,
          limit: freeLimit,
          remaining: freeLimit - used,
        };
      }
      // 無料枠を使い切った
      return {
        allowed: false,
        reason: `無料バナーAI編集の上限（${freeLimit}回）に達しました。プランをアップグレードしてください。`,
        current: used,
        limit: freeLimit,
        remaining: 0,
        needSubscription: true,
      };
    }

    // バナー以外 or 無料枠なし → AI機能は一切不可
    return {
      allowed: false,
      reason: 'AI機能は有料プランのみご利用いただけます。プランをアップグレードしてください。',
    };
  }

  // 有料プランの場合

  // 自分のAPIキーを使用している場合はクレジット消費をスキップ
  if (apiKeyInfo.isUserOwnKey) {
    return {
      allowed: true,
      usingOwnApiKey: true,
      skipCreditConsumption: true,
    };
  }

  // 自社APIキーを使用する場合はクレジットチェック
  // 推定コストが指定されていない場合は最小コストを使用
  const costToCheck = estimatedCostUsd ?? 0.001;

  // クレジット残高チェック
  const creditCheck = await checkCreditBalance(userId, costToCheck);

  if (!creditCheck.allowed) {
    return {
      allowed: false,
      reason: creditCheck.reason,
      currentBalanceUsd: creditCheck.currentBalanceUsd,
      estimatedCostUsd: creditCheck.estimatedCostUsd,
      needPurchase: true,
    };
  }

  return {
    allowed: true,
    usingOwnApiKey: false,
    skipCreditConsumption: false,
    currentBalanceUsd: creditCheck.currentBalanceUsd,
    estimatedCostUsd: creditCheck.estimatedCostUsd,
    remainingAfterUsd: creditCheck.remainingAfterUsd,
  };
}

/**
 * 画像生成のクレジットチェック
 */
export async function checkImageGenerationLimit(
  userId: string,
  model: string = 'gemini-3-pro-image-preview',
  imageCount: number = 1,
  context?: { isBannerEdit?: boolean }
): Promise<UsageLimitCheck> {
  const estimatedCost = estimateImageCost(model, imageCount);
  return checkGenerationLimit(userId, estimatedCost, context);
}

/**
 * テキスト生成のクレジットチェック
 */
export async function checkTextGenerationLimit(
  userId: string,
  model: string = 'gemini-2.0-flash',
  estimatedInputTokens: number = 1000,
  estimatedOutputTokens: number = 1000
): Promise<UsageLimitCheck> {
  const estimatedCost = estimateTextCost(
    model,
    estimatedInputTokens,
    estimatedOutputTokens
  );
  return checkGenerationLimit(userId, estimatedCost);
}

/**
 * 動画生成のクレジットチェック
 */
export async function checkVideoGenerationLimit(
  userId: string,
  durationSeconds: number = 5
): Promise<UsageLimitCheck> {
  const costPerSecond = AI_COSTS['veo-2.0-generate-001']?.perSecond || 0.35;
  const estimatedCost = costPerSecond * durationSeconds;
  return checkGenerationLimit(userId, estimatedCost);
}

/**
 * API使用後のクレジット消費
 * InsufficientCreditErrorが発生した場合はそのままthrow（呼び出し側でハンドル）
 */
export async function recordApiUsage(
  userId: string,
  generationRunId: number,
  actualCostUsd: number,
  details: {
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    imageCount?: number;
  }
): Promise<void> {
  try {
    await consumeCredit(userId, actualCostUsd, generationRunId, details);
  } catch (error) {
    if (error instanceof InsufficientCreditError) {
      // レースコンディションでクレジット不足になった場合
      // ログに記録して再throw
      console.error(`[recordApiUsage] Race condition detected: user=${userId}, required=${actualCostUsd}, balance=${error.currentBalance}`);
      throw error;
    }
    throw error;
  }
}

// エラークラスをre-export
export { InsufficientCreditError };

/**
 * アップロードが可能かチェック
 */
export async function checkUploadLimit(
  userId: string
): Promise<UsageLimitCheck> {
  const planId = await getUserPlan(userId);

  // サブスク必須チェック
  if (requiresSubscription(planId)) {
    return {
      allowed: false,
      reason: 'サブスクリプションが必要です。',
      needSubscription: true,
    };
  }

  // アップロードはクレジット消費なし、常に許可
  return { allowed: true };
}

/**
 * ページ作成が可能かチェック
 */
export async function checkPageLimit(userId: string): Promise<UsageLimitCheck> {
  const [usage, planId] = await Promise.all([
    getUserUsage(userId),
    getUserPlan(userId),
  ]);

  // サブスク必須チェック
  if (requiresSubscription(planId)) {
    return {
      allowed: false,
      reason: 'サブスクリプションが必要です。',
      needSubscription: true,
    };
  }

  const plan = getPlan(planId);
  const limit = plan.limits.maxPages;
  const current = usage.totalPages;

  // 無制限の場合
  if (limit === -1) {
    return {
      allowed: true,
      current,
      limit,
      remaining: 'unlimited',
    };
  }

  if (current >= limit) {
    return {
      allowed: false,
      reason: `ページ上限（${limit}ページ）に達しました。プランをアップグレードしてください。`,
      current,
      limit,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    current,
    limit,
    remaining: limit - current,
  };
}

/**
 * バナー作成が可能かチェック
 */
export async function checkBannerLimit(userId: string): Promise<UsageLimitCheck> {
  const [usage, planId] = await Promise.all([
    getUserUsage(userId),
    getUserPlan(userId),
  ]);

  // サブスク必須チェック
  if (requiresSubscription(planId)) {
    return {
      allowed: false,
      reason: 'サブスクリプションが必要です。',
      needSubscription: true,
    };
  }

  const plan = getPlan(planId);
  const limit = plan.limits.maxBanners;
  const current = usage.totalBanners;

  // 無制限の場合
  if (limit === -1) {
    return {
      allowed: true,
      current,
      limit,
      remaining: 'unlimited',
    };
  }

  if (current >= limit) {
    return {
      allowed: false,
      reason: `バナー上限（${limit}件）に達しました。プランをアップグレードしてください。`,
      current,
      limit,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    current,
    limit,
    remaining: limit - current,
  };
}

/**
 * 機能が利用可能かチェック
 */
export async function checkFeatureAccess(
  userId: string,
  feature: 'upscale4K' | 'restyle' | 'export' | 'generateVideo' | 'setApiKey'
): Promise<{ allowed: boolean; reason?: string; needSubscription?: boolean }> {
  const planId = await getUserPlan(userId);

  // サブスク必須チェック
  if (requiresSubscription(planId)) {
    return {
      allowed: false,
      reason: 'サブスクリプションが必要です。',
      needSubscription: true,
    };
  }

  const plan = getPlan(planId);

  const featureMap = {
    upscale4K: { check: plan.limits.canUpscale4K, name: '4Kアップスケール' },
    restyle: { check: plan.limits.canRestyle, name: 'リスタイル' },
    export: { check: plan.limits.canExport, name: 'エクスポート' },
    generateVideo: { check: plan.limits.canGenerateVideo, name: '動画生成' },
    setApiKey: { check: plan.limits.canSetApiKey, name: 'APIキー設定' },
  };

  const featureInfo = featureMap[feature];
  if (!featureInfo.check) {
    return {
      allowed: false,
      reason: `${featureInfo.name}機能は${plan.name}プランでは利用できません。プランをアップグレードしてください。`,
    };
  }

  return { allowed: true };
}

/**
 * Freeプラン バナーAI編集カウンターをインクリメント（原子的操作）
 * 成功したAI操作の後に呼び出す
 * 二重防御: インクリメント後に上限超過をチェック
 */
export async function incrementFreeBannerEditCount(userId: string): Promise<{ newCount: number; limitReached: boolean }> {
  const updated = await prisma.userSettings.update({
    where: { userId },
    data: { freeBannerEditsUsed: { increment: 1 } },
    select: { freeBannerEditsUsed: true },
  });
  const newCount = updated.freeBannerEditsUsed;
  const limitReached = newCount >= FREE_BANNER_EDIT_LIMIT;
  console.log(`[FREE-BANNER-EDIT] userId=${userId}, count=${newCount}/${FREE_BANNER_EDIT_LIMIT}, limitReached=${limitReached}`);
  return { newCount, limitReached };
}

/**
 * 使用量の完全なレポートを取得
 */
export async function getUsageReport(userId: string) {
  const [usage, planId, currentBalance] = await Promise.all([
    getUserUsage(userId),
    getUserPlan(userId),
    getCurrentBalance(userId),
  ]);

  const plan = getPlan(planId);

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      includedCreditUsd: plan.includedCreditUsd,
    },
    usage,
    limits: plan.limits,
    credits: {
      currentBalanceUsd: currentBalance,
    },
    percentages: {
      pages:
        plan.limits.maxPages === -1
          ? 0
          : Math.round((usage.totalPages / plan.limits.maxPages) * 100),
      banners:
        plan.limits.maxBanners === -1
          ? 0
          : Math.round((usage.totalBanners / plan.limits.maxBanners) * 100),
    },
  };
}
