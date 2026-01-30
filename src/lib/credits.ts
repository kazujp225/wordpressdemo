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
