/**
 * SaaSプラン定義
 * クレジットベースのAPI使用量管理
 * 内部的には円で管理し、表示時はクレジット（1円 = 10クレジット）
 * 例: ¥5,000 = 50,000クレジット
 */

export type PlanType = 'free' | 'pro' | 'business' | 'enterprise';

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
}

export interface Plan {
  id: PlanType;
  name: string;
  description: string;
  // 月額（円）
  priceJpy: number;
  // 月額に含まれるクレジット（1円 = 100クレジット）
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
  // 無料プラン（レガシー、新規登録は非推奨）
  free: {
    id: 'free',
    name: 'Free',
    description: '無料プラン（自分のAPIキーが必要）',
    priceJpy: 0,
    includedTokens: 0, // クレジットなし（自分のAPIキーを使用）
    includedCreditUsd: 0, // 後方互換性
    stripePriceId: '',
    priceDisplay: '¥0/月',
    colorClass: 'text-gray-600',
    limits: {
      maxPages: 3, // 3ページまで
      maxBanners: 3, // 3バナーまで
      maxStorageMB: 500, // 500MBまで
      canAIGenerate: false, // AI生成不可
      canUpscale4K: false, // 4Kアップスケール不可
      canRestyle: false, // リスタイル不可
      canExport: true, // エクスポートは可能
      canGenerateVideo: false, // 動画生成不可
      canSetApiKey: false, // APIキー設定不可
      prioritySupport: false,
    },
    features: [
      '最大3ページ',
      '最大3バナー',
      '画像アップロード・クロップ・リサイズ',
      'エクスポート機能',
      '※AI画像生成・インペイント等は有料プランのみ',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'スタートアップ・個人事業主向け',
    priceJpy: 20000,
    includedTokens: 50000, // ¥5,000分 = 50,000クレジット
    includedCreditUsd: 33.33, // 後方互換性: ¥5,000 / 150
    stripePriceId: process.env.STRIPE_PRICE_PRO || 'price_pro',
    priceDisplay: '¥20,000/月',
    colorClass: 'text-blue-600',
    limits: {
      maxPages: 30,
      maxBanners: 50,
      maxStorageMB: 5000,
      canAIGenerate: true,
      canUpscale4K: false,
      canRestyle: false,
      canExport: true,
      canGenerateVideo: false,
      canSetApiKey: false, // 有料プランは自社APIを使用
      prioritySupport: false,
    },
    features: [
      '最大30ページ',
      '最大50バナー',
      '月間 50,000 クレジット',
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
    includedTokens: 100000, // ¥10,000分 = 100,000クレジット
    includedCreditUsd: 66.67, // 後方互換性: ¥10,000 / 150
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS || 'price_business',
    priceDisplay: '¥40,000/月',
    colorClass: 'text-purple-600',
    limits: {
      maxPages: 100,
      maxBanners: 200,
      maxStorageMB: 20000,
      canAIGenerate: true,
      canUpscale4K: true,
      canRestyle: true,
      canExport: true,
      canGenerateVideo: false,
      canSetApiKey: false, // 有料プランは自社APIを使用
      prioritySupport: false,
    },
    features: [
      '最大100ページ',
      '最大200バナー',
      '月間 100,000 クレジット',
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
    includedTokens: 250000, // ¥25,000分 = 250,000クレジット
    includedCreditUsd: 166.67, // 後方互換性: ¥25,000 / 150
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise',
    priceDisplay: '¥100,000/月',
    colorClass: 'text-amber-600',
    limits: {
      maxPages: -1, // 無制限
      maxBanners: -1, // 無制限
      maxStorageMB: -1, // 無制限
      canAIGenerate: true,
      canUpscale4K: true,
      canRestyle: true,
      canExport: true,
      canGenerateVideo: true,
      canSetApiKey: false, // 有料プランは自社APIを使用
      prioritySupport: true,
    },
    features: [
      '無制限ページ・バナー',
      '月間 250,000 クレジット',
      'Business全機能',
      '動画生成',
      '優先サポート',
    ],
  },
};

// デフォルトプラン（サブスク未契約時）
export const DEFAULT_PLAN: PlanType = 'free';

// 追加クレジットパッケージ（プランごとの月間クレジット分のみ）
export interface TokenPackage {
  id: number;
  name: string;
  priceJpy: number;
  tokens: number; // クレジット数（1円 = 100クレジット）
  creditUsd: number; // 後方互換性: USD換算
  planId: PlanType; // 対応するプラン
}

export const TOKEN_PACKAGES: TokenPackage[] = [
  { id: 1, name: '50,000 クレジット', priceJpy: 20000, tokens: 50000, creditUsd: 33.33, planId: 'pro' },
  { id: 2, name: '50,000 クレジット', priceJpy: 20000, tokens: 50000, creditUsd: 33.33, planId: 'business' },
  { id: 3, name: '50,000 クレジット', priceJpy: 20000, tokens: 50000, creditUsd: 33.33, planId: 'enterprise' },
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
  // 有効なプランIDでない場合はサブスク必須
  if (!planId) return false; // デフォルトでfreeプランを使用
  // starterは廃止
  if (planId === 'starter') return true;
  // 有効なプランIDの場合はOK（freeも含む）
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
  // USD → 円 → クレジット
  const jpy = usd * USD_TO_JPY_RATE;
  return Math.round(jpy * JPY_TO_TOKEN_RATE);
}

// 後方互換性のためのエイリアス
export function getPlanIncludedCredit(planId: string | null | undefined): number {
  // クレジットをUSDに変換して返す（後方互換性）
  const tokens = getPlanIncludedTokens(planId);
  return tokens / USD_TO_JPY_RATE;
}

// プランIDの一覧
export const PLAN_IDS = Object.keys(PLANS) as PlanType[];
