/**
 * クレジット管理ロジック
 * Gemini API使用量の追跡と制限
 */

import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';

// クレジットチェック結果
export interface CreditCheckResult {
  allowed: boolean;
  currentBalanceUsd: number;
  estimatedCostUsd: number;
  remainingAfterUsd: number;
  reason?: string;
  needPurchase?: boolean;
}

// クレジットサマリー
export interface CreditSummary {
  currentBalanceUsd: number;
  monthlyUsageUsd: number;
  monthlyGrantUsd: number;
  lastRefreshedAt: Date | null;
  recentTransactions: Array<{
    id: number;
    type: string;
    amountUsd: number;
    description: string | null;
    createdAt: Date;
  }>;
}

/**
 * ユーザーのクレジット残高を取得（なければ作成）
 * upsertを使用してレースコンディションを防ぐ
 */
export async function getOrCreateCreditBalance(userId: string) {
  // upsertを使用して、findとcreateの間のレースコンディションを防ぐ
  const balance = await prisma.creditBalance.upsert({
    where: { userId },
    update: {}, // 既存の場合は何も更新しない
    create: {
      userId,
      balanceUsd: new Decimal(0),
    },
  });

  return balance;
}

/**
 * API呼び出し前のクレジットチェック
 */
export async function checkCreditBalance(
  userId: string,
  estimatedCostUsd: number
): Promise<CreditCheckResult> {
  const balance = await getOrCreateCreditBalance(userId);
  const currentBalance = Number(balance.balanceUsd);
  const remaining = currentBalance - estimatedCostUsd;

  if (remaining < 0) {
    return {
      allowed: false,
      currentBalanceUsd: currentBalance,
      estimatedCostUsd,
      remainingAfterUsd: remaining,
      reason: `クレジット残高が不足しています`,
      needPurchase: true,
    };
  }

  return {
    allowed: true,
    currentBalanceUsd: currentBalance,
    estimatedCostUsd,
    remainingAfterUsd: remaining,
  };
}

// クレジット不足エラー
export class InsufficientCreditError extends Error {
  constructor(
    public currentBalance: number,
    public requiredAmount: number
  ) {
    super(`Insufficient credit: balance=${currentBalance}, required=${requiredAmount}`);
    this.name = 'InsufficientCreditError';
  }
}

// 重複リクエストエラー
export class DuplicateRequestError extends Error {
  constructor(public requestId: string) {
    super(`Duplicate request: ${requestId}`);
    this.name = 'DuplicateRequestError';
  }
}

/**
 * 原子的な先払いクレジット減算（最適フロー）
 * 1クエリで残高チェック＋減算を行い、レースコンディションを防ぐ
 *
 * @returns 減算成功時は残高、失敗時はnull
 */
export async function deductCreditAtomic(
  userId: string,
  costUsd: number,
  requestId: string,
  description: string
): Promise<{ success: boolean; balanceAfter?: number; error?: string; alreadyProcessed?: boolean }> {
  try {
    // 重複リクエストチェック
    const existingRequest = await prisma.creditTransaction.findFirst({
      where: { requestId },
    });

    if (existingRequest) {
      console.log(`[Credit] Duplicate request detected: ${requestId}`);
      return { success: true, alreadyProcessed: true, balanceAfter: Number(existingRequest.balanceAfter) };
    }

    // 原子的な減算: 残高 >= コストの場合のみ更新
    // PostgreSQLの行ロックにより同時実行を防ぐ
    const result = await prisma.$executeRaw`
      UPDATE "CreditBalance"
      SET "balanceUsd" = "balanceUsd" - ${costUsd}::decimal,
          "updatedAt" = NOW()
      WHERE "userId" = ${userId}
        AND "balanceUsd" >= ${costUsd}::decimal
    `;

    if (result === 0) {
      // 更新件数0 = 残高不足
      const balance = await prisma.creditBalance.findUnique({
        where: { userId },
        select: { balanceUsd: true }
      });
      return {
        success: false,
        error: 'クレジット残高が不足しています',
        balanceAfter: Number(balance?.balanceUsd || 0)
      };
    }

    // 更新後の残高を取得
    const updatedBalance = await prisma.creditBalance.findUnique({
      where: { userId },
      select: { balanceUsd: true }
    });

    // 取引履歴を記録（requestIdで重複防止）
    await prisma.creditTransaction.create({
      data: {
        userId,
        type: 'api_usage',
        amountUsd: new Decimal(-costUsd),
        balanceAfter: updatedBalance?.balanceUsd || new Decimal(0),
        description,
        requestId,
      },
    });

    console.log(`[Credit] Deducted $${costUsd} from user ${userId}, requestId: ${requestId}`);
    return { success: true, balanceAfter: Number(updatedBalance?.balanceUsd || 0) };

  } catch (error: any) {
    // ユニーク制約違反（requestIdの重複）
    if (error.code === 'P2002') {
      console.log(`[Credit] Duplicate request (constraint): ${requestId}`);
      return { success: true, alreadyProcessed: true };
    }
    console.error(`[Credit] Deduct error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * API失敗時のクレジット返金
 */
export async function refundCredit(
  userId: string,
  costUsd: number,
  requestId: string,
  reason: string
): Promise<void> {
  try {
    // 既に返金済みかチェック
    const existingRefund = await prisma.creditTransaction.findFirst({
      where: {
        requestId: `refund_${requestId}`,
      },
    });

    if (existingRefund) {
      console.log(`[Credit] Refund already processed for requestId: ${requestId}`);
      return;
    }

    // 返金処理
    const balance = await prisma.creditBalance.update({
      where: { userId },
      data: {
        balanceUsd: { increment: costUsd },
      },
    });

    // 返金履歴を記録
    await prisma.creditTransaction.create({
      data: {
        userId,
        type: 'refund',
        amountUsd: new Decimal(costUsd),
        balanceAfter: balance.balanceUsd,
        description: `返金: ${reason}`,
        requestId: `refund_${requestId}`,
      },
    });

    console.log(`[Credit] Refunded $${costUsd} to user ${userId}, reason: ${reason}`);
  } catch (error) {
    console.error(`[Credit] Refund error:`, error);
    // 返金エラーはログに記録するが、例外は投げない（ユーザー体験を優先）
  }
}

/**
 * API使用後のクレジット消費
 * トランザクション内で残高を再確認し、レースコンディションを防ぐ
 */
export async function consumeCredit(
  userId: string,
  costUsd: number,
  generationRunId: number,
  details: {
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    imageCount?: number;
  }
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // トランザクション内で現在の残高を取得（FOR UPDATEロック相当）
    // Prismaでは直接FOR UPDATEは使えないが、$transaction内でのupdate操作は
    // PostgreSQLの行レベルロックにより排他制御される
    const currentBalance = await tx.creditBalance.findUnique({
      where: { userId },
      select: { balanceUsd: true }
    });

    if (!currentBalance) {
      throw new Error(`Credit balance not found for user: ${userId}`);
    }

    const balance = Number(currentBalance.balanceUsd);

    // トランザクション内で残高を再チェック（レースコンディション防止）
    if (balance < costUsd) {
      throw new InsufficientCreditError(balance, costUsd);
    }

    // 残高を更新
    const updatedBalance = await tx.creditBalance.update({
      where: { userId },
      data: {
        balanceUsd: { decrement: costUsd },
      },
    });

    // 取引履歴を記録
    await tx.creditTransaction.create({
      data: {
        userId,
        type: 'api_usage',
        amountUsd: new Decimal(-costUsd),
        balanceAfter: updatedBalance.balanceUsd,
        description: `API使用: ${details.model}`,
        generationRunId,
        model: details.model,
        inputTokens: details.inputTokens,
        outputTokens: details.outputTokens,
        imageCount: details.imageCount,
      },
    });
  });
}

/**
 * プランクレジット付与（月次）
 */
export async function grantPlanCredit(
  userId: string,
  creditUsd: number,
  planName: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const balance = await tx.creditBalance.upsert({
      where: { userId },
      update: {
        balanceUsd: { increment: creditUsd },
        lastRefreshedAt: new Date(),
      },
      create: {
        userId,
        balanceUsd: new Decimal(creditUsd),
        lastRefreshedAt: new Date(),
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: 'plan_grant',
        amountUsd: new Decimal(creditUsd),
        balanceAfter: balance.balanceUsd,
        description: `${planName}プラン月間クレジット付与`,
      },
    });
  });
}

/**
 * 追加クレジット購入
 */
export async function addPurchasedCredit(
  userId: string,
  creditUsd: number,
  stripePaymentId: string,
  packageName: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const balance = await tx.creditBalance.update({
      where: { userId },
      data: {
        balanceUsd: { increment: creditUsd },
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: 'purchase',
        amountUsd: new Decimal(creditUsd),
        balanceAfter: balance.balanceUsd,
        description: `クレジット購入: ${packageName}`,
        stripePaymentId,
      },
    });
  });
}

/**
 * クレジット残高の詳細取得
 */
export async function getCreditSummary(userId: string): Promise<CreditSummary> {
  const balance = await getOrCreateCreditBalance(userId);

  // 今月の開始日
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // 今月の使用量
  const monthlyUsageResult = await prisma.creditTransaction.aggregate({
    where: {
      userId,
      type: 'api_usage',
      createdAt: { gte: startOfMonth },
    },
    _sum: { amountUsd: true },
  });

  // 今月のプラン付与額
  const monthlyGrantResult = await prisma.creditTransaction.aggregate({
    where: {
      userId,
      type: 'plan_grant',
      createdAt: { gte: startOfMonth },
    },
    _sum: { amountUsd: true },
  });

  // 最近の取引履歴
  const recentTransactions = await prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      type: true,
      amountUsd: true,
      description: true,
      createdAt: true,
    },
  });

  return {
    currentBalanceUsd: Number(balance.balanceUsd),
    monthlyUsageUsd: Math.abs(Number(monthlyUsageResult._sum.amountUsd || 0)),
    monthlyGrantUsd: Number(monthlyGrantResult._sum.amountUsd || 0),
    lastRefreshedAt: balance.lastRefreshedAt,
    recentTransactions: recentTransactions.map((t) => ({
      id: t.id,
      type: t.type,
      amountUsd: Number(t.amountUsd),
      description: t.description,
      createdAt: t.createdAt,
    })),
  };
}

/**
 * 管理者用: クレジット調整（サービスクレジット付与）
 */
export async function adjustCredit(
  userId: string,
  amountUsd: number,
  description: string,
  adminId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 残高を更新（加算または減算）
    const updateData =
      amountUsd >= 0
        ? { balanceUsd: { increment: amountUsd } }
        : { balanceUsd: { decrement: Math.abs(amountUsd) } };

    const balance = await tx.creditBalance.update({
      where: { userId },
      data: updateData,
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: 'adjustment',
        amountUsd: new Decimal(amountUsd),
        balanceAfter: balance.balanceUsd,
        description: `サービスクレジット付与 (${adminId}): ${description}`,
      },
    });
  });
}

/**
 * サブスクリプション情報を取得
 */
export async function getSubscription(userId: string) {
  return prisma.subscription.findUnique({
    where: { userId },
  });
}

/**
 * サブスクリプションの更新
 */
export async function updateSubscription(
  userId: string,
  data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    plan?: string;
    status?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
  }
) {
  return prisma.subscription.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      stripeCustomerId: data.stripeCustomerId!,
      stripeSubscriptionId: data.stripeSubscriptionId,
      stripePriceId: data.stripePriceId,
      plan: data.plan || 'pro',
      status: data.status || 'active',
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
    },
  });
}

/**
 * ユーザーの現在のクレジット残高を取得（数値のみ）
 */
export async function getCurrentBalance(userId: string): Promise<number> {
  const balance = await getOrCreateCreditBalance(userId);
  return Number(balance.balanceUsd);
}

/**
 * 初回サブスク開始時のクレジット付与
 * （Webhookから呼ばれる）
 */
export async function grantInitialCredit(
  userId: string,
  planId: string,
  creditUsd: number
): Promise<void> {
  await grantPlanCredit(userId, creditUsd, planId);
}
