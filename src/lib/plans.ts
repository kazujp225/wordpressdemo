/**
 * SaaSプラン定義
 * クレジットベースのAPI使用量管理
 */

export type PlanType = 'free' | 'pro' | 'business' | 'enterprise';

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
  // 無料プラン（レガシー、新規登録は非推奨）
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
    priceJpy: 20000,
    includedCreditUsd: 33.33, // ¥5,000分 (25%)
    stripePriceId: process.env.STRIPE_PRICE_PRO || 'price_pro',
    priceDisplay: '¥20,000/月',
    limits: {
      maxPages: 30,
      maxStorageMB: 5000,
      canUpscale4K: false,
      canRestyle: false,
      canExport: true,
      canGenerateVideo: false,
      canSetApiKey: false, // 有料プランは自社APIを使用
      prioritySupport: false,
    },
    features: [
      '最大30ページ',
      '月間クレジット ¥5,000分',
      '画像生成',
      'インペイント編集',
      'HTMLエクスポート',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    description: '成長企業・制作会社向け',
    priceJpy: 40000,
    includedCreditUsd: 66.67, // ¥10,000分 (25%)
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS || 'price_business',
    priceDisplay: '¥40,000/月',
    limits: {
      maxPages: 100,
      maxStorageMB: 20000,
      canUpscale4K: true,
      canRestyle: true,
      canExport: true,
      canGenerateVideo: false,
      canSetApiKey: false, // 有料プランは自社APIを使用
      prioritySupport: false,
    },
    features: [
      '最大100ページ',
      '月間クレジット ¥10,000分',
      'Pro全機能',
      '4Kアップスケール',
      'リスタイル機能',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: '代理店・大規模ビジネス向け',
    priceJpy: 100000,
    includedCreditUsd: 166.67, // ¥25,000分 (25%)
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
      '無制限ページ',
      '月間クレジット ¥25,000分',
      'Business全機能',
      '動画生成',
      '優先サポート',
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
