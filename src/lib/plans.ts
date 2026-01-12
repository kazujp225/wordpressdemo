/**
 * SaaSプラン定義
 * クレジットベースのAPI使用量管理
 */

export type PlanType = 'free' | 'pro' | 'expert' | 'enterprise';

export interface PlanLimits {
  // 最大ページ数
  maxPages: number;
  // 最大ストレージ（MB）
  maxStorageMB: number;
  // 4Kアップスケール可能か
  canUpscale4K: boolean;
  // リスタイル機能使用可能か
  canRestyle: boolean;
  // エクスポート機能使用可能か
  canExport: boolean;
  // 動画生成可能か
  canGenerateVideo: boolean;
  // API キー設定可能か
  canSetApiKey: boolean;
  // 優先サポート
  prioritySupport: boolean;
}

export interface Plan {
  id: PlanType;
  name: string;
  description: string;
  // 月額（円）
  priceJpy: number;
  // 月額に含まれるAPIクレジット（USD）
  includedCreditUsd: number;
  // Stripe Price ID（サブスク用）
  stripePriceId: string;
  // 表示用の価格
  priceDisplay: string;
  // 機能制限
  limits: PlanLimits;
  // 機能一覧（表示用）
  features: string[];
}

// 為替レート（1USD = 150円）
export const USD_TO_JPY_RATE = 150;

export const PLANS: Record<PlanType, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    description: '無料プラン（自分のAPIキーが必要）',
    priceJpy: 0,
    includedCreditUsd: 0, // クレジットなし（自分のAPIキーを使用）
    stripePriceId: '',
    priceDisplay: '¥0/月',
    limits: {
      maxPages: 10, // 10ページまで
      maxStorageMB: 500, // 500MBまで
      canUpscale4K: false, // 4Kアップスケール不可
      canRestyle: false, // リスタイル不可
      canExport: true, // エクスポートは可能
      canGenerateVideo: false, // 動画生成不可
      canSetApiKey: true, // APIキー設定必須
      prioritySupport: false,
    },
    features: [
      'AI画像生成（自分のAPIキー使用）',
      '最大10ページ',
      'エクスポート機能',
      '※4Kアップスケール・リスタイル・動画生成は有料プランのみ',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'スタートアップ・個人事業主向け',
    priceJpy: 10000,
    includedCreditUsd: 16.67, // 2,500円分 (25%)
    stripePriceId: process.env.STRIPE_PRICE_PRO || 'price_pro',
    priceDisplay: '¥10,000/月',
    limits: {
      maxPages: 50,
      maxStorageMB: 10000,
      canUpscale4K: true,
      canRestyle: true,
      canExport: true,
      canGenerateVideo: false,
      canSetApiKey: false, // 有料プランは自社APIを使用
      prioritySupport: false,
    },
    features: [
      'AI画像生成',
      '4Kアップスケール',
      'リスタイル機能',
      'エクスポート機能',
      '月間APIクレジット $16.67分',
    ],
  },
  expert: {
    id: 'expert',
    name: 'Expert',
    description: '代理店・中規模ビジネス向け',
    priceJpy: 30000,
    includedCreditUsd: 50.0, // 7,500円分 (25%)
    stripePriceId: process.env.STRIPE_PRICE_EXPERT || 'price_expert',
    priceDisplay: '¥30,000/月',
    limits: {
      maxPages: 200,
      maxStorageMB: 50000,
      canUpscale4K: true,
      canRestyle: true,
      canExport: true,
      canGenerateVideo: true,
      canSetApiKey: false, // 有料プランは自社APIを使用
      prioritySupport: true,
    },
    features: [
      'Pro全機能',
      '動画生成',
      '優先サポート',
      '月間APIクレジット $50分',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: '大規模・エンタープライズ向け',
    priceJpy: 100000,
    includedCreditUsd: 166.67, // 25,000円分 (25%)
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise',
    priceDisplay: '¥100,000/月',
    limits: {
      maxPages: -1, // 無制限
      maxStorageMB: -1, // 無制限
      canUpscale4K: true,
      canRestyle: true,
      canExport: true,
      canGenerateVideo: true,
      canSetApiKey: false, // 有料プランは自社APIを使用
      prioritySupport: true,
    },
    features: [
      'Expert全機能',
      '無制限ページ・ストレージ',
      '専任サポート',
      'カスタム連携',
      '月間APIクレジット $166.67分',
    ],
  },
};

// デフォルトプラン（サブスク未契約時）
export const DEFAULT_PLAN: PlanType = 'free';

// 追加クレジットパッケージ
export interface CreditPackage {
  id: number;
  name: string;
  priceJpy: number;
  creditUsd: number;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 1, name: '500円分', priceJpy: 500, creditUsd: 3.33 },
  { id: 2, name: '1,000円分', priceJpy: 1000, creditUsd: 6.67 },
  { id: 3, name: '3,000円分', priceJpy: 3000, creditUsd: 20.0 },
  { id: 4, name: '5,000円分', priceJpy: 5000, creditUsd: 33.33 },
  { id: 5, name: '10,000円分', priceJpy: 10000, creditUsd: 66.67 },
];

// プラン取得ヘルパー
export function getPlan(planId: string | null | undefined): Plan {
  if (!planId || !(planId in PLANS)) {
    return PLANS[DEFAULT_PLAN];
  }
  return PLANS[planId as PlanType];
}

// 制限値が無制限かどうかをチェック
export function isUnlimited(value: number): boolean {
  return value === -1;
}

// 使用量が制限内かチェック
export function isWithinLimit(used: number, limit: number): boolean {
  if (isUnlimited(limit)) return true;
  return used < limit;
}

// 残り使用可能数を計算
export function getRemainingUsage(
  used: number,
  limit: number
): number | 'unlimited' {
  if (isUnlimited(limit)) return 'unlimited';
  return Math.max(0, limit - used);
}

// 使用率を計算（パーセント）
export function getUsagePercentage(used: number, limit: number): number {
  if (isUnlimited(limit)) return 0;
  if (limit === 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}

// Freeプランかどうかをチェック
export function isFreePlan(planId: string | null | undefined): boolean {
  return planId === 'free';
}

// プランがサブスク必須かどうか
export function requiresSubscription(planId: string | null | undefined): boolean {
  // 有効なプランIDでない場合はサブスク必須
  if (!planId) return false; // デフォルトでfreeプランを使用
  // starterは廃止
  if (planId === 'starter') return true;
  // 有効なプランIDの場合はOK（freeも含む）
  return !(planId in PLANS);
}

// プランの月間クレジット額を取得（USD）
export function getPlanIncludedCredit(planId: string | null | undefined): number {
  const plan = getPlan(planId);
  return plan.includedCreditUsd;
}

// プランIDの一覧
export const PLAN_IDS = Object.keys(PLANS) as PlanType[];
