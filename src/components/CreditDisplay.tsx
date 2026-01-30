'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import * as Progress from '@radix-ui/react-progress';
import * as Tabs from '@radix-ui/react-tabs';
import * as Tooltip from '@radix-ui/react-tooltip';
import { toast } from 'react-hot-toast';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Coins,
  Crown,
  CreditCard,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Zap,
  X,
  Check,
  ChevronRight,
  Gift,
  History,
  BarChart3,
  Loader2,
  ArrowUpRight,
  Shield,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { usdToTokens, formatTokens, PLANS, type PlanType } from '@/lib/plans';

interface CreditReport {
  credits: {
    currentBalanceUsd: number;
    monthlyUsageUsd: number;
    monthlyGrantUsd: number;
    lastRefreshedAt: string | null;
  };
  plan: {
    id: string;
    name: string;
    includedCreditUsd: number;
  };
  subscription: {
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  recentTransactions: Array<{
    id: number;
    type: string;
    amountUsd: number;
    description: string | null;
    createdAt: string;
  }>;
}

interface CreditPackage {
  id: number;
  name: string;
  priceJpy: number;
  creditUsd: number;
}

// プランカラー定義
const PLAN_STYLES: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  pro: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-200',
    gradient: 'from-purple-500 to-pink-500',
  },
  expert: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-200',
    gradient: 'from-blue-500 to-cyan-500',
  },
  enterprise: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-200',
    gradient: 'from-amber-500 to-orange-500',
  },
};

// 残高レベルの色とスタイル（クレジット数ベース）
function getBalanceStyle(tokens: number) {
  if (tokens <= 150) return { color: 'text-red-600', bg: 'bg-red-50', status: 'critical' };
  if (tokens <= 750) return { color: 'text-amber-600', bg: 'bg-amber-50', status: 'warning' };
  if (tokens <= 1500) return { color: 'text-blue-600', bg: 'bg-blue-50', status: 'normal' };
  return { color: 'text-green-600', bg: 'bg-green-50', status: 'good' };
}

// アニメーションバリアント
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const pulseVariants = {
  pulse: {
    scale: [1, 1.05, 1],
    transition: { duration: 2, repeat: Infinity },
  },
};

export function CreditDisplay() {
  const [report, setReport] = useState<CreditReport | null>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState<number | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [creditsRes, packagesRes] = await Promise.all([
        fetch('/api/user/credits'),
        fetch('/api/billing/credits/purchase'),
      ]);

      if (!creditsRes.ok) throw new Error('Failed to fetch');

      const creditsData = await creditsRes.json();
      setReport(creditsData);

      if (packagesRes.ok) {
        const packagesData = await packagesRes.json();
        setPackages(packagesData.packages || []);
      }
    } catch {
      toast.error('クレジット情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePurchase = async (pkg: CreditPackage) => {
    try {
      setPurchaseLoading(pkg.id);
      toast.loading('決済ページを準備中...', { id: 'purchase' });

      const res = await fetch('/api/billing/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id }),
      });

      if (!res.ok) throw new Error('Failed to create checkout');

      const { url } = await res.json();
      toast.dismiss('purchase');
      window.location.href = url;
    } catch {
      toast.error('購入処理に失敗しました', { id: 'purchase' });
    } finally {
      setPurchaseLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      toast.loading('請求ポータルを開いています...', { id: 'portal' });
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const { url } = await res.json();
      toast.dismiss('portal');
      window.location.href = url;
    } catch {
      toast.error('請求ポータルへのアクセスに失敗しました', { id: 'portal' });
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border shadow-sm p-8">
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Coins className="w-10 h-10 text-amber-500" />
          </motion.div>
          <p className="text-gray-500">クレジット情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-white rounded-2xl border shadow-sm p-8">
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-600">データの取得に失敗しました</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  const { credits, plan, subscription, recentTransactions } = report;
  // USDからクレジットへ変換（1 USD = 150円 = 1500クレジット）
  const balanceTokens = usdToTokens(credits.currentBalanceUsd);
  const monthlyUsageTokens = usdToTokens(credits.monthlyUsageUsd);
  const planInfo = PLANS[plan.id as PlanType];
  const planIncludedTokens = planInfo?.includedTokens || 0;
  const balanceStyle = getBalanceStyle(balanceTokens);
  const planStyle = PLAN_STYLES[plan.id] || PLAN_STYLES.pro;
  const usagePercentage = planIncludedTokens > 0
    ? Math.min(100, (monthlyUsageTokens / planIncludedTokens) * 100)
    : 0;

  // チャート用データ
  const chartData = recentTransactions
    .filter((t) => t.type === 'api_usage')
    .slice(0, 7)
    .reverse()
    .map((t, i) => ({
      name: `${i + 1}`,
      usage: Math.abs(t.amountUsd),
    }));

  return (
    <Tooltip.Provider delayDuration={300}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-2xl border shadow-sm overflow-hidden"
      >
        {/* ヘッダー - グラデーション背景 */}
        <motion.div
          variants={itemVariants}
          className={`relative overflow-hidden bg-gradient-to-r ${planStyle.gradient} p-6 text-white`}
        >
          <div className="absolute inset-0 bg-black/10" />
          <motion.img
            src="/bell-bag.png"
            alt="Credit Bag"
            className="absolute -right-8 -bottom-12 w-48 h-48 object-contain opacity-40 rotate-12"
            initial={{ rotate: 0, scale: 0.8 }}
            animate={{ rotate: 12, scale: 1 }}
            transition={{ duration: 0.8, ease: "backOut" }}
          />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <motion.div
                  variants={pulseVariants}
                  animate="pulse"
                  className="p-2 bg-white/20 rounded-xl backdrop-blur-sm"
                >
                  <Crown className="w-6 h-6" />
                </motion.div>
                <div>
                  <h2 className="text-xl font-bold">{plan.name}プラン</h2>
                  <p className="text-sm text-white/80">
                    月間クレジット {formatTokens(planIncludedTokens)}
                  </p>
                </div>
              </div>
              {subscription && (
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={handleManageSubscription}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm backdrop-blur-sm transition-colors"
                    >
                      請求管理
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg"
                      sideOffset={5}
                    >
                      Stripeの請求ポータルを開きます
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              )}
            </div>

            {/* クレジット残高カード */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70 mb-1">クレジット残高</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">
                      {formatTokens(balanceTokens)}
                    </span>
                    <span className="text-sm text-white/60">クレジット</span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowPurchaseModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 font-medium rounded-xl hover:shadow-lg transition-shadow"
                >
                  <Sparkles className="w-4 h-4" />
                  クレジット追加
                </motion.button>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* タブナビゲーション */}
        <Tabs.Root value={selectedTab} onValueChange={setSelectedTab}>
          <motion.div variants={itemVariants} className="border-b">
            <Tabs.List className="flex">
              {[
                { id: 'overview', label: '概要', icon: BarChart3 },
                { id: 'history', label: '履歴', icon: History },
              ].map((tab) => (
                <Tabs.Trigger
                  key={tab.id}
                  value={tab.id}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${selectedTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </motion.div>

          {/* 概要タブ */}
          <Tabs.Content value="overview" className="p-6 space-y-6">
            {/* 使用状況 */}
            <motion.div variants={itemVariants}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">今月の使用状況</h3>
                <span className="text-xs text-gray-500">
                  {formatTokens(monthlyUsageTokens)} / {formatTokens(planIncludedTokens)} クレジット
                </span>
              </div>
              <Progress.Root
                value={usagePercentage}
                className="h-3 bg-gray-100 rounded-full overflow-hidden"
              >
                <Progress.Indicator
                  className={`h-full transition-all duration-500 ease-out ${usagePercentage >= 90
                      ? 'bg-gradient-to-r from-red-500 to-red-600'
                      : usagePercentage >= 70
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                    }`}
                  style={{ width: `${usagePercentage}%` }}
                />
              </Progress.Root>
              <p className="text-xs text-gray-500 mt-2">
                {usagePercentage >= 90
                  ? '残りわずかです。クレジットを追加してください。'
                  : usagePercentage >= 70
                    ? '使用量が増えています。'
                    : '順調に利用中です。'}
              </p>
            </motion.div>

            {/* ミニチャート */}
            {chartData.length > 0 && (
              <motion.div variants={itemVariants}>
                <h3 className="text-sm font-medium text-gray-700 mb-3">最近の使用傾向</h3>
                <div className="h-32 bg-gray-50 rounded-xl p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                        formatter={(value) => [`${formatTokens(usdToTokens(Number(value ?? 0)))} クレジット`, '使用量']}
                      />
                      <Area
                        type="monotone"
                        dataKey="usage"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#usageGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* 残高警告 */}
            <AnimatePresence>
              {balanceStyle.status === 'critical' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 bg-red-50 border border-red-200 rounded-xl"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-red-800">クレジット残高が非常に少なくなっています</p>
                      <p className="text-sm text-red-600 mt-1">
                        API機能を継続して利用するには、今すぐクレジットを追加してください。
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowPurchaseModal(true)}
                        className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
                      >
                        今すぐ追加
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Tabs.Content>

          {/* 履歴タブ */}
          <Tabs.Content value="history" className="p-6">
            <div className="space-y-2">
              {recentTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>取引履歴がありません</p>
                </div>
              ) : (
                recentTransactions.map((tx, index) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${tx.type === 'plan_grant'
                            ? 'bg-purple-100'
                            : tx.type === 'purchase'
                              ? 'bg-green-100'
                              : 'bg-gray-100'
                          }`}
                      >
                        {tx.type === 'plan_grant' ? (
                          <Gift className="w-4 h-4 text-purple-600" />
                        ) : tx.type === 'purchase' ? (
                          <CreditCard className="w-4 h-4 text-green-600" />
                        ) : tx.amountUsd >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          {tx.description || getTransactionLabel(tx.type)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(tx.createdAt).toLocaleString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-mono text-sm font-medium ${tx.amountUsd >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                    >
                      {tx.amountUsd >= 0 ? '+' : ''}{formatTokens(usdToTokens(Math.abs(tx.amountUsd)))}
                    </span>
                  </motion.div>
                ))
              )}
            </div>
          </Tabs.Content>
        </Tabs.Root>

        {/* 購入モーダル */}
        <Dialog.Root open={showPurchaseModal} onOpenChange={setShowPurchaseModal}>
          <Dialog.Portal>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl"
              >
                <div className="relative p-6 border-b">
                  <Dialog.Title className="text-xl font-bold text-gray-900">
                    クレジット購入
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-gray-500 mt-1">
                    追加クレジットを購入して、API機能を継続してご利用ください
                  </Dialog.Description>
                  <Dialog.Close asChild>
                    <button className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg">
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
                  {packages.map((pkg, index) => (
                    <motion.button
                      key={pkg.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePurchase(pkg)}
                      disabled={purchaseLoading !== null}
                      className={`w-full p-4 border-2 rounded-xl text-left transition-all ${purchaseLoading === pkg.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-500 hover:shadow-md'
                        } disabled:opacity-50`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg">
                            <Coins className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{pkg.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatTokens(usdToTokens(pkg.creditUsd))} クレジット
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {purchaseLoading === pkg.id ? (
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                          ) : (
                            <>
                              <p className="text-xl font-bold text-blue-600">
                                ¥{pkg.priceJpy.toLocaleString()}
                              </p>
                              <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                            </>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>

                <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Shield className="w-4 h-4" />
                    <span>Stripeによる安全な決済</span>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </motion.div>
    </Tooltip.Provider>
  );
}

// 取引タイプのラベル
function getTransactionLabel(type: string): string {
  const labels: Record<string, string> = {
    plan_grant: 'プラン付与',
    purchase: 'クレジット購入',
    api_usage: 'API使用',
    adjustment: 'サービスクレジット',
    refund: '返金',
  };
  return labels[type] || type;
}

// サブスクリプション必須画面（強化版）
export function SubscriptionRequired() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    try {
      setLoading(planId);
      toast.loading('決済ページを準備中...', { id: 'subscribe' });

      const res = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      if (!res.ok) throw new Error('Failed');

      const { url } = await res.json();
      toast.dismiss('subscribe');
      window.location.href = url;
    } catch {
      toast.error('サブスクリプションの開始に失敗しました', { id: 'subscribe' });
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    {
      id: 'pro',
      name: 'Pro',
      description: 'スタートアップ・個人事業主向け',
      price: 10000,
      credit: 16.67,
      features: ['AI画像生成', '4Kアップスケール', 'リスタイル機能', 'エクスポート'],
      gradient: 'from-purple-500 to-pink-500',
      popular: false,
    },
    {
      id: 'expert',
      name: 'Expert',
      description: '代理店・中規模ビジネス向け',
      price: 30000,
      credit: 50,
      features: ['Pro全機能', '動画生成', '優先サポート', '200ページまで'],
      gradient: 'from-blue-500 to-cyan-500',
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: '大規模・エンタープライズ向け',
      price: 100000,
      credit: 166.67,
      features: ['Expert全機能', '無制限ページ', '専任サポート', 'カスタム連携'],
      gradient: 'from-amber-500 to-orange-500',
      popular: false,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border shadow-sm overflow-hidden"
    >
      <div className="text-center p-8 bg-gradient-to-b from-gray-50 to-white">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg"
        >
          <Crown className="w-10 h-10 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-900">
          プランを選択してください
        </h2>
        <p className="text-gray-600 mt-2 max-w-md mx-auto">
          サービスを利用するには、サブスクリプションが必要です。
          <br />
          すべてのプランに月間APIクレジットが含まれています。
        </p>
      </div>

      <div className="p-6 grid md:grid-cols-3 gap-4">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            className={`relative rounded-2xl border-2 p-6 transition-all hover:shadow-lg ${plan.popular
                ? 'border-blue-500 shadow-blue-100'
                : 'border-gray-200 hover:border-gray-300'
              }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 bg-blue-500 text-white text-xs font-medium rounded-full">
                  おすすめ
                </span>
              </div>
            )}

            <div
              className={`w-12 h-12 bg-gradient-to-br ${plan.gradient} rounded-xl flex items-center justify-center mb-4`}
            >
              <Zap className="w-6 h-6 text-white" />
            </div>

            <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{plan.description}</p>

            <div className="mt-4">
              <span className="text-3xl font-bold text-gray-900">
                ¥{plan.price.toLocaleString()}
              </span>
              <span className="text-gray-500">/月</span>
            </div>

            <div className="mt-2 flex items-center gap-1 text-sm text-blue-600">
              <Coins className="w-4 h-4" />
              <span>{formatTokens(usdToTokens(plan.credit))} クレジット/月</span>
            </div>

            <ul className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSubscribe(plan.id)}
              disabled={loading !== null}
              className={`mt-6 w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${plan.popular
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50`}
            >
              {loading === plan.id ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {plan.name}を開始
                  <ArrowUpRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// コンパクトなクレジット表示（ヘッダー用）- 強化版
export function CreditBadge() {
  const [balanceUsd, setBalanceUsd] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    fetch('/api/user/credits')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setBalanceUsd(data?.credits?.currentBalanceUsd ?? null))
      .catch(() => null);
  }, []);

  if (balanceUsd === null) return null;

  const balanceTokens = usdToTokens(balanceUsd);
  const style = getBalanceStyle(balanceTokens);

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <motion.div
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            whileHover={{ scale: 1.05 }}
            className={`px-3 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-colors ${style.bg}`}
          >
            <motion.div animate={{ rotate: isHovered ? 360 : 0 }} transition={{ duration: 0.5 }}>
              <Coins className="w-4 h-4 text-amber-500" />
            </motion.div>
            <span className={`text-sm font-semibold ${style.color}`}>
              {formatTokens(balanceTokens)}
            </span>
            {style.status === 'critical' && (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <AlertCircle className="w-3 h-3 text-red-500" />
              </motion.div>
            )}
          </motion.div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg"
            sideOffset={5}
          >
            <p className="font-medium">クレジット残高</p>
            <p className="text-gray-400 mt-1">
              {style.status === 'critical'
                ? '残高が非常に少なくなっています'
                : style.status === 'warning'
                  ? '残高が少なくなっています'
                  : '残高は十分です'}
            </p>
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

// 成功時のconfetti演出
export function triggerSuccessConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#3b82f6', '#8b5cf6', '#f59e0b'],
  });
}
