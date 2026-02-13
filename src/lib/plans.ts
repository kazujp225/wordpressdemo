/**
 * SaaSプラン定義
 * クレジットベースのAPI使用量管理
 * 内部的には円で管理し、表示時はクレジット（1円 = 10クレジット）
 * 例: ¥5,000 = 50,000クレジット
 *
 * クレジット付与ロジック: 月額の25%を原価としてクレジット化
 * 例: ¥10,000プラン → ¥2,500分 = 25,000クレジット
 */

export type PlanType = 'free' | 'starter' | 'pro' | 'business' | 'enterprise' | 'unlimited';

/** Freeプランのバナー AI編集無料回数（生涯） */
export const FREE_BANNER_EDIT_LIMIT = 3;

export interface PlanLimits {
  // 最大ページ数
  maxPages: number;
  // 最大バナー数
  maxBanners: number;
  // 最大ストレージ（MB）
  maxStorageMB: number;
  // AI生成全般の可否
  canAIGenerate: boolean;
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
  // Freeプラン用: バナーAI編集の無料回数（0 = 無料枠なし＝クレジット制）
  freeBannerEditLimit: number;
}

export interface Plan {
  id: PlanType;
  name: string;
  description: string;
  // 月額（円）
  priceJpy: number;
  // 月額に含まれるクレジット（1円 = 10クレジット）
  includedTokens: number;
  // 後方互換性：USDでのクレジット額（内部処理用）
  includedCreditUsd: number;
  // Stripe Price ID（サブスク用）
  stripePriceId: string;
  // 表示用の価格
  priceDisplay: string;
  // 表示用のカラークラス（Tailwind）
  colorClass: string;
  // 機能制限
  limits: PlanLimits;
  // 機能一覧（表示用）
  features: string[];
  // おすすめプランかどうか
  popular?: boolean;
}

// クレジット変換レート（1円 = 10クレジット）
export const JPY_TO_TOKEN_RATE = 10;

// 円からクレジットへ変換
export function jpyToTokens(jpy: number): number {
  return Math.round(jpy * JPY_TO_TOKEN_RATE);
}

// クレジットから円へ変換
export function tokensToJpy(tokens: number): number {
  return tokens / JPY_TO_TOKEN_RATE;
}

// クレジット表示用フォーマット
export function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

export const PLANS: Record<PlanType, Plan> = {
  // 無料プラン
  free: {
    id: 'free',
    name: 'Free',
    description: '無料で試せるプラン',
    priceJpy: 0,
    includedTokens: 0,
    includedCreditUsd: 0,
    stripePriceId: '',
    priceDisplay: '¥0/月',
    colorClass: 'text-gray-600',
    limits: {
      maxPages: 3,
      maxBanners: -1, // 無制限
      maxStorageMB: 500,
      canAIGenerate: false,
      canUpscale4K: false,
      canRestyle: false,
      canExport: true,
      canGenerateVideo: false,
      canSetApiKey: false,
      prioritySupport: false,
      freeBannerEditLimit: FREE_BANNER_EDIT_LIMIT,
    },
    features: [
      '最大3ページ',
      '画像アップロード・編集',
      'エクスポート機能',
      `バナーAI編集 ${FREE_BANNER_EDIT_LIMIT}回無料`,
    ],
  },

  // Starter: ¥10,000/月 → 25% = ¥2,500分 = 25,000クレジット
  starter: {
    id: 'starter',
    name: 'Starter',
    description: '個人・小規模事業向け',
    priceJpy: 10000,
    includedTokens: 25000, // ¥2,500分
    includedCreditUsd: 16.67, // ¥2,500 / 150
    stripePriceId: process.env.STRIPE_PRICE_STARTER || 'price_starter',
    priceDisplay: '¥10,000/月',
    colorClass: 'text-blue-600',
    limits: {
      maxPages: 10,
      maxBanners: -1,
      maxStorageMB: 5000,
      canAIGenerate: true,
      canUpscale4K: false,
      canRestyle: false,
      canExport: true,
      canGenerateVideo: false,
      canSetApiKey: false,
      prioritySupport: false,
      freeBannerEditLimit: 0,
    },
    features: [
      '最大10ページ',
      '月25,000クレジット',
      '画像生成',
      'インペイント編集',
    ],
  },

  // Pro: ¥30,000/月 → 25% = ¥7,500分 = 75,000クレジット
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'スタートアップ・個人事業主向け',
    priceJpy: 30000,
    includedTokens: 75000, // ¥7,500分
    includedCreditUsd: 50.00, // ¥7,500 / 150
    stripePriceId: process.env.STRIPE_PRICE_PRO || 'price_pro',
    priceDisplay: '¥30,000/月',
    colorClass: 'text-indigo-600',
    popular: true,
    limits: {
      maxPages: 30,
      maxBanners: -1,
      maxStorageMB: 10000,
      canAIGenerate: true,
      canUpscale4K: true,
      canRestyle: true,
      canExport: true,
      canGenerateVideo: false,
      canSetApiKey: false,
      prioritySupport: false,
      freeBannerEditLimit: 0,
    },
    features: [
      '最大30ページ',
      '月75,000クレジット',
      '4Kアップスケール',
      'リスタイル機能',
    ],
  },

  // Business: ¥50,000/月 → 25% = ¥12,500分 = 125,000クレジット
  business: {
    id: 'business',
    name: 'Business',
    description: '成長企業・制作会社向け',
    priceJpy: 50000,
    includedTokens: 125000, // ¥12,500分
    includedCreditUsd: 83.33, // ¥12,500 / 150
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS || 'price_business',
    priceDisplay: '¥50,000/月',
    colorClass: 'text-purple-600',
    limits: {
      maxPages: 50,
      maxBanners: -1,
      maxStorageMB: 20000,
      canAIGenerate: true,
      canUpscale4K: true,
      canRestyle: true,
      canExport: true,
      canGenerateVideo: true,
      canSetApiKey: false,
      prioritySupport: false,
      freeBannerEditLimit: 0,
    },
    features: [
      '最大50ページ',
      '月125,000クレジット',
      '動画生成',
      '全機能利用可能',
    ],
  },

  // Enterprise: ¥100,000/月 → 25% = ¥25,000分 = 250,000クレジット
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: '代理店・大規模ビジネス向け',
    priceJpy: 100000,
    includedTokens: 250000, // ¥25,000分
    includedCreditUsd: 166.67, // ¥25,000 / 150
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise',
    priceDisplay: '¥100,000/月',
    colorClass: 'text-amber-600',
    limits: {
      maxPages: -1, // 無制限
      maxBanners: -1,
      maxStorageMB: -1,
      canAIGenerate: true,
      canUpscale4K: true,
      canRestyle: true,
      canExport: true,
      canGenerateVideo: true,
      canSetApiKey: false,
      prioritySupport: false,
      freeBannerEditLimit: 0,
    },
    features: [
      '無制限ページ',
      '月250,000クレジット',
      '動画生成',
      '全機能利用可能',
    ],
  },

  // Unlimited: ¥500,000/月 → 25% = ¥125,000分 = 1,250,000クレジット
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    description: '大量運用・エージェンシー向け',
    priceJpy: 500000,
    includedTokens: 1250000, // ¥125,000分
    includedCreditUsd: 833.33, // ¥125,000 / 150
    stripePriceId: process.env.STRIPE_PRICE_UNLIMITED || 'price_unlimited',
    priceDisplay: '¥500,000/月',
    colorClass: 'text-rose-600',
    limits: {
      maxPages: -1,
      maxBanners: -1,
      maxStorageMB: -1,
      canAIGenerate: true,
      canUpscale4K: true,
      canRestyle: true,
      canExport: true,
      canGenerateVideo: true,
      canSetApiKey: false,
      prioritySupport: false,
      freeBannerEditLimit: 0,
    },
    features: [
      '無制限ページ',
      '月1,250,000クレジット',
      '動画生成',
      '全機能利用可能',
    ],
  },
};

// デフォルトプラン（サブスク未契約時）
export const DEFAULT_PLAN: PlanType = 'free';

// 追加クレジットパッケージ（有料プラン向け）
export interface TokenPackage {
  id: number;
  name: string;
  priceJpy: number;
  tokens: number;
  creditUsd: number;
  planId: PlanType;
}

export const TOKEN_PACKAGES: TokenPackage[] = [
  { id: 1, name: '25,000 クレジット', priceJpy: 10000, tokens: 25000, creditUsd: 16.67, planId: 'starter' },
  { id: 2, name: '75,000 クレジット', priceJpy: 30000, tokens: 75000, creditUsd: 50.00, planId: 'pro' },
  { id: 3, name: '125,000 クレジット', priceJpy: 50000, tokens: 125000, creditUsd: 83.33, planId: 'business' },
  { id: 4, name: '250,000 クレジット', priceJpy: 100000, tokens: 250000, creditUsd: 166.67, planId: 'enterprise' },
  { id: 5, name: '1,250,000 クレジット', priceJpy: 500000, tokens: 1250000, creditUsd: 833.33, planId: 'unlimited' },
];

// 後方互換性のためのエイリアス
export type CreditPackage = TokenPackage;
export const CREDIT_PACKAGES = TOKEN_PACKAGES;

// プランIDに対応するクレジットパッケージを取得
export function getTokenPackageForPlan(planId: string | null | undefined): TokenPackage | undefined {
  if (!planId) return undefined;
  return TOKEN_PACKAGES.find(pkg => pkg.planId === planId);
}

// 後方互換性のためのエイリアス
export const getCreditPackageForPlan = getTokenPackageForPlan;

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
  if (!planId) return false;
  return !(planId in PLANS);
}

// プランの月間クレジット数を取得
export function getPlanIncludedTokens(planId: string | null | undefined): number {
  const plan = getPlan(planId);
  return plan.includedTokens;
}

// 後方互換性：USDをクレジットに変換（既存コードとの互換性維持）
// 1 USD = 150円、1円 = 10クレジット → 1 USD = 1,500クレジット
export const USD_TO_JPY_RATE = 150;
export function usdToTokens(usd: number): number {
  const jpy = usd * USD_TO_JPY_RATE;
  return Math.round(jpy * JPY_TO_TOKEN_RATE);
}

// 後方互換性のためのエイリアス
export function getPlanIncludedCredit(planId: string | null | undefined): number {
  const tokens = getPlanIncludedTokens(planId);
  return tokens / USD_TO_JPY_RATE;
}

// プランIDの一覧
export const PLAN_IDS = Object.keys(PLANS) as PlanType[];

// 有料プランのみ（UI表示用）
export const PAID_PLAN_IDS: PlanType[] = ['starter', 'pro', 'business', 'enterprise', 'unlimited'];
