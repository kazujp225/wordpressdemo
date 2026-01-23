"use client";

import React, { useState, useEffect } from 'react';
import {
    Save, Globe, Github, Loader2, CheckCircle, Sparkles, LogOut,
    Crown, Zap, ArrowUpRight, CreditCard, Key, Settings2,
    ChevronRight, AlertCircle, Star, Rocket
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

// プラン情報の型
interface PlanInfo {
    id: string;
    name: string;
    priceDisplay: string;
    features: string[];
}

// プラン定義
const PLANS: Record<string, PlanInfo> = {
    free: {
        id: 'free',
        name: 'Free',
        priceDisplay: '¥0/月',
        features: ['AI画像生成（自分のAPIキー使用）', '最大10ページ', 'エクスポート機能']
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        priceDisplay: '¥10,000/月',
        features: ['AI画像生成', '4Kアップスケール', 'リスタイル機能', '月間$16.67クレジット']
    },
    expert: {
        id: 'expert',
        name: 'Expert',
        priceDisplay: '¥30,000/月',
        features: ['Pro全機能', '動画生成', '優先サポート', '月間$50クレジット']
    },
    enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        priceDisplay: '¥100,000/月',
        features: ['Expert全機能', '無制限ページ', '専任サポート', '月間$166.67クレジット']
    }
};

export default function SettingsPage() {
    const router = useRouter();
    const supabase = createClient();

    const [user, setUser] = useState<any>(null);
    const [googleApiKey, setGoogleApiKey] = useState('');
    const [hasApiKey, setHasApiKey] = useState(false);
    const [canSetApiKey, setCanSetApiKey] = useState(false);
    const [currentPlan, setCurrentPlan] = useState('free');
    const [creditBalance, setCreditBalance] = useState<number | null>(null);
    const [config, setConfig] = useState<any>({
        siteName: 'My Landing Page',
        github: { token: '', owner: '', repo: '', branch: 'main', path: 'public/lp' }
    });
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');
    const [activeTab, setActiveTab] = useState<'plan' | 'apikey' | 'general' | 'github'>('plan');

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();

        const fetchUserSettings = async () => {
            try {
                const res = await fetch('/api/user/settings');
                const data = await res.json();
                setHasApiKey(data.hasApiKey || false);
                setCanSetApiKey(data.canSetApiKey || false);
                setCurrentPlan(data.plan || 'free');
            } catch (e) {
                console.error('Failed to fetch user settings', e);
            }
        };
        fetchUserSettings();

        const fetchCreditBalance = async () => {
            try {
                const res = await fetch('/api/user/credits');
                if (res.ok) {
                    const data = await res.json();
                    setCreditBalance(data.credits?.currentBalanceUsd ?? null);
                }
            } catch (e) {
                console.error('Failed to fetch credit balance', e);
            }
        };
        fetchCreditBalance();

        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/admin/settings');
                const data = await res.json();
                if (data.siteName) setConfig(data);
            } catch (e) {
                console.error('Failed to fetch config', e);
            }
        };
        fetchConfig();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (googleApiKey && canSetApiKey) {
                await fetch('/api/user/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ googleApiKey })
                });
                setHasApiKey(true);
                setGoogleApiKey('');
            }

            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                setSaveStatus('success');
                toast.success('設定を保存しました');
                setTimeout(() => setSaveStatus('idle'), 3000);
            }
        } catch (e) {
            toast.error('設定の保存に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
        router.refresh();
    };

    const planInfo = PLANS[currentPlan] || PLANS.free;
    const isFreePlan = currentPlan === 'free';

    return (
        <div className="min-h-screen bg-gray-50/50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-12 pb-24 sm:pb-32">
                {/* ヘッダー */}
                <div className="mb-6 sm:mb-10 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">設定</h1>
                        <p className="text-gray-500 mt-1 text-sm">アカウントとプランの管理</p>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4">
                        {user && (
                            <div className="text-right min-w-0 flex-1 sm:flex-initial">
                                <p className="text-xs text-gray-400 font-medium">ログイン中</p>
                                <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors min-h-[44px] flex-shrink-0"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden xs:inline">ログアウト</span>
                        </button>
                    </div>
                </div>

                {/* プランステータスカード */}
                <div className="mb-6 sm:mb-10 rounded-xl border border-gray-200 bg-white p-4 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4 sm:gap-6">
                            <div className="p-3 sm:p-4 rounded-full bg-gray-50 border border-gray-100 flex-shrink-0">
                                <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-gray-900" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">
                                        {planInfo.name}プラン
                                    </h2>
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                        {planInfo.priceDisplay}
                                    </span>
                                </div>
                                <p className="mt-1 sm:mt-1.5 text-sm text-gray-500 font-medium">
                                    {isFreePlan
                                        ? 'APIキーを設定して利用中'
                                        : `クレジット残高: $${creditBalance?.toFixed(4) || '0.0000'}`
                                    }
                                </p>
                            </div>
                        </div>
                        {isFreePlan ? (
                            <button className="flex items-center justify-center gap-2 bg-gray-900 text-white px-5 sm:px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm min-h-[44px] w-full sm:w-auto">
                                <Rocket className="h-4 w-4" />
                                アップグレード
                            </button>
                        ) : (
                            <button className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 sm:px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors min-h-[44px] w-full sm:w-auto">
                                <CreditCard className="h-4 w-4" />
                                クレジット購入
                            </button>
                        )}
                    </div>
                </div>

                {/* タブナビゲーション */}
                <div className="flex gap-1 mb-6 sm:mb-8 border-b border-gray-100 pb-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <TabButton
                        active={activeTab === 'plan'}
                        onClick={() => setActiveTab('plan')}
                        icon={<Crown className="h-4 w-4" />}
                    >
                        プラン
                    </TabButton>
                    {canSetApiKey && (
                        <TabButton
                            active={activeTab === 'apikey'}
                            onClick={() => setActiveTab('apikey')}
                            icon={<Key className="h-4 w-4" />}
                            badge={!hasApiKey}
                        >
                            APIキー
                        </TabButton>
                    )}
                    <TabButton
                        active={activeTab === 'general'}
                        onClick={() => setActiveTab('general')}
                        icon={<Settings2 className="h-4 w-4" />}
                    >
                        一般設定
                    </TabButton>
                    <TabButton
                        active={activeTab === 'github'}
                        onClick={() => setActiveTab('github')}
                        icon={<Github className="h-4 w-4" />}
                    >
                        GitHub連携
                    </TabButton>
                </div>

                {/* タブコンテンツ */}
                <div className="space-y-8">
                    {/* プランタブ */}
                    {activeTab === 'plan' && (
                        <div className="space-y-8">
                            {/* 現在のプランの機能 */}
                            <section>
                                <h3 className="text-sm font-semibold text-gray-900 mb-4 tracking-tight">現在のプランの機能</h3>
                                <div className="rounded-xl border border-gray-200 bg-white p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {planInfo.features.map((feature, index) => (
                                            <div key={index} className="flex items-center gap-3">
                                                <CheckCircle className="h-5 w-5 text-gray-900 flex-shrink-0" />
                                                <span className="text-sm text-gray-600 font-medium">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* プラン比較 */}
                            {isFreePlan && (
                                <section>
                                    <div className="flex items-center gap-2 mb-4">
                                        <Star className="h-4 w-4 text-gray-900" />
                                        <h3 className="text-sm font-semibold text-gray-900 tracking-tight">プラン一覧</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <PlanCard
                                            name="Pro"
                                            price="¥10,000"
                                            features={['4Kアップスケール', 'リスタイル機能', '月$16.67クレジット']}
                                            highlighted={false}
                                        />
                                        <PlanCard
                                            name="Expert"
                                            price="¥30,000"
                                            features={['動画生成', '優先サポート', '月$50クレジット']}
                                            highlighted={true}
                                        />
                                        <PlanCard
                                            name="Enterprise"
                                            price="¥100,000"
                                            features={['無制限ページ', '専任サポート', '月$166.67クレジット']}
                                            highlighted={false}
                                        />
                                    </div>
                                </section>
                            )}

                            {/* クレジット情報（有料プランのみ） */}
                            {!isFreePlan && (
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 mb-4 tracking-tight">クレジット管理</h3>
                                    <div className="rounded-xl border border-gray-200 bg-white p-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-3xl font-bold text-gray-900 tracking-tight">
                                                        ${creditBalance?.toFixed(4) || '0.0000'}
                                                    </span>
                                                    <span className="text-sm text-gray-500 font-medium">USD</span>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1 align-middle flex items-center gap-1">
                                                    <Sparkles className="h-3 w-3" />
                                                    現在のクレジット残高
                                                </p>
                                            </div>
                                            <button className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                                                <Zap className="h-4 w-4" />
                                                チャージする
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            )}
                        </div>
                    )}

                    {/* APIキータブ（Freeプランのみ） */}
                    {activeTab === 'apikey' && canSetApiKey && (
                        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-8">
                            <div className="flex items-start gap-4 mb-8">
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <Sparkles className="h-5 w-5 text-gray-900" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">Google AI APIキー</h3>
                                    <p className="text-sm text-gray-500 mt-1">AI機能を使用するために必要です</p>
                                </div>
                            </div>

                            {/* ステータス表示 */}
                            {hasApiKey ? (
                                <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg mb-8">
                                    <CheckCircle className="h-5 w-5 text-gray-900" />
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">APIキー設定済み</p>
                                        <p className="text-xs text-gray-600">AI機能が利用可能です</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg mb-8">
                                    <AlertCircle className="h-5 w-5 text-gray-900" />
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">APIキーが必要です</p>
                                        <p className="text-xs text-gray-600">下記の手順でAPIキーを取得してください</p>
                                    </div>
                                </div>
                            )}

                            {/* APIキー入力 */}
                            <div className="mb-8">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {hasApiKey ? 'APIキーを更新' : 'APIキーを入力'}
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={googleApiKey}
                                        placeholder="AIzaSy..."
                                        onChange={e => setGoogleApiKey(e.target.value)}
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all font-mono text-gray-900 placeholder:text-gray-400"
                                    />
                                </div>
                            </div>

                            {/* 取得手順 */}
                            <div className="rounded-lg p-6 border border-gray-200 border-dashed">
                                <h4 className="text-sm font-bold text-gray-900 mb-4">APIキーの取得方法</h4>
                                <div className="space-y-4">
                                    <Step number={1}>
                                        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                                            className="text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900 transition-all inline-flex items-center gap-1 font-medium">
                                            Google AI Studio <ArrowUpRight className="h-3 w-3" />
                                        </a>
                                        にアクセス
                                    </Step>
                                    <Step number={2}>Googleアカウントでログイン</Step>
                                    <Step number={3}>「Get API Key」→「Create API key」をクリック</Step>
                                    <Step number={4}>生成されたキー（AIzaSy...）をコピーして貼り付け</Step>
                                </div>
                                <div className="mt-6 pt-4 border-t border-gray-200 border-dashed">
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        <span className="font-bold text-gray-900">注意:</span> 無料枠には制限があります。安定して利用するには
                                        <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer"
                                            className="font-medium text-gray-900 hover:text-gray-700 ml-1 underline decoration-gray-300 underline-offset-2">請求設定</a>
                                        を有効にすることをお勧めします。
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 一般設定タブ */}
                    {activeTab === 'general' && (
                        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-8">
                            <div className="flex items-start gap-4 mb-8">
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <Globe className="h-5 w-5 text-gray-900" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">一般設定</h3>
                                    <p className="text-sm text-gray-500 mt-1">サイトの基本情報を設定します</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">サイト名</label>
                                <input
                                    type="text"
                                    value={config.siteName}
                                    onChange={e => setConfig({ ...config, siteName: e.target.value })}
                                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all text-gray-900"
                                />
                            </div>
                        </div>
                    )}

                    {/* GitHub連携タブ */}
                    {activeTab === 'github' && (
                        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-8">
                            <div className="flex items-start gap-4 mb-8">
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <Github className="h-5 w-5 text-gray-900" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">GitHub連携</h3>
                                    <p className="text-sm text-gray-500 mt-1">リポジトリへの自動デプロイ設定</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">パーソナルアクセストークン</label>
                                    <input
                                        type="password"
                                        value={config.github?.token || ''}
                                        placeholder="ghp_..."
                                        onChange={e => setConfig({ ...config, github: { ...config.github, token: e.target.value } })}
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all font-mono text-gray-900"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Repoスコープ権限が必要です
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">オーナー / 組織</label>
                                        <input
                                            type="text"
                                            value={config.github?.owner || ''}
                                            onChange={e => setConfig({ ...config, github: { ...config.github, owner: e.target.value } })}
                                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all text-gray-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">リポジトリ</label>
                                        <input
                                            type="text"
                                            value={config.github?.repo || ''}
                                            onChange={e => setConfig({ ...config, github: { ...config.github, repo: e.target.value } })}
                                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all text-gray-900"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 保存ボタン（フローティング） */}
                <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-200 p-3 sm:p-4 z-50">
                    <div className="max-w-5xl mx-auto flex justify-between items-center gap-3">
                        <p className="text-xs sm:text-sm text-gray-500 font-medium hidden sm:block">
                            {isSaving ? '保存中...' : saveStatus === 'success' ? '保存完了' : '変更を保存してください'}
                        </p>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center justify-center gap-2 bg-gray-900 text-white px-6 sm:px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-50 shadow-sm min-h-[44px] w-full sm:w-auto"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : saveStatus === 'success' ? (
                                <CheckCircle className="h-4 w-4" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            変更を保存
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// タブボタンコンポーネント (Clean Style)
function TabButton({
    children,
    active,
    onClick,
    icon,
    badge
}: {
    children: React.ReactNode;
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    badge?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all relative whitespace-nowrap min-h-[44px] ${active
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
        >
            {icon}
            {children}
            {badge && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            )}
        </button>
    );
}

// プランカードコンポーネント (Flat Style)
function PlanCard({
    name,
    price,
    features,
    highlighted
}: {
    name: string;
    price: string;
    features: string[];
    highlighted: boolean;
}) {
    return (
        <div className={`p-6 rounded-xl border transition-all h-full flex flex-col ${highlighted
                ? 'border-gray-900 bg-gray-50 shadow-sm relative'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
            {highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-block text-[10px] uppercase tracking-wider font-bold text-white bg-gray-900 px-3 py-1 rounded-full">
                        Popular
                    </span>
                </div>
            )}
            <div className="mb-4">
                <h4 className="text-lg font-bold text-gray-900 tracking-tight">{name}</h4>
                <p className="text-2xl font-bold text-gray-900 mt-2 tracking-tight">{price}<span className="text-sm font-normal text-gray-500 ml-1">/月</span></p>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm text-gray-600">
                        <CheckCircle className="h-4 w-4 text-gray-900 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">{feature}</span>
                    </li>
                ))}
            </ul>

            <button className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${highlighted
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'
                }`}>
                選択する
            </button>
        </div>
    );
}

// ステップコンポーネント (Clean Style)
function Step({ number, children }: { number: number; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-900 rounded-full flex items-center justify-center text-xs font-bold border border-gray-200">
                {number}
            </span>
            <span className="text-gray-600 text-sm pt-0.5 font-medium leading-relaxed">{children}</span>
        </div>
    );
}
