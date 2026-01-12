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
                    setCreditBalance(data.balanceUsd);
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
            <div className="max-w-6xl mx-auto px-4 py-8 pb-32">
                {/* ヘッダー */}
                <div className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">設定</h1>
                        <p className="text-gray-500 mt-1">アカウントとプランを管理します</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {user && (
                            <div className="text-right mr-4">
                                <p className="text-sm text-gray-500">ログイン中</p>
                                <p className="text-sm font-medium text-gray-900">{user.email}</p>
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-all"
                        >
                            <LogOut className="h-4 w-4" />
                            ログアウト
                        </button>
                    </div>
                </div>

                {/* プランステータスカード */}
                <div className={`mb-8 rounded-2xl p-6 ${
                    isFreePlan
                        ? 'bg-gradient-to-r from-gray-100 to-gray-50 border-2 border-gray-200'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${isFreePlan ? 'bg-white' : 'bg-white/20'}`}>
                                <Crown className={`h-8 w-8 ${isFreePlan ? 'text-gray-600' : 'text-white'}`} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className={`text-2xl font-bold ${isFreePlan ? 'text-gray-900' : 'text-white'}`}>
                                        {planInfo.name}プラン
                                    </h2>
                                    <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                                        isFreePlan ? 'bg-gray-200 text-gray-600' : 'bg-white/20 text-white'
                                    }`}>
                                        {planInfo.priceDisplay}
                                    </span>
                                </div>
                                <p className={`mt-1 ${isFreePlan ? 'text-gray-500' : 'text-white/80'}`}>
                                    {isFreePlan
                                        ? '自分のAPIキーで無料利用中'
                                        : `クレジット残高: $${creditBalance?.toFixed(4) || '0.0000'}`
                                    }
                                </p>
                            </div>
                        </div>
                        {isFreePlan && (
                            <button className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg hover:scale-105 transition-all">
                                <Rocket className="h-5 w-5" />
                                有料プランにアップグレード
                                <ArrowUpRight className="h-4 w-4" />
                            </button>
                        )}
                        {!isFreePlan && (
                            <button className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-5 py-2.5 rounded-xl font-medium transition-all">
                                <CreditCard className="h-5 w-5" />
                                クレジット購入
                            </button>
                        )}
                    </div>
                </div>

                {/* タブナビゲーション */}
                <div className="flex gap-2 mb-6 bg-gray-100 p-1.5 rounded-xl">
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
                <div className="space-y-6">
                    {/* プランタブ */}
                    {activeTab === 'plan' && (
                        <div className="space-y-6">
                            {/* 現在のプランの機能 */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">現在のプランの機能</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {planInfo.features.map((feature, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                                            <span className="text-gray-700">{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* プラン比較 */}
                            {isFreePlan && (
                                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Star className="h-6 w-6 text-amber-500" />
                                        <h3 className="text-lg font-semibold text-gray-900">有料プランの特典</h3>
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
                                </div>
                            )}

                            {/* クレジット情報（有料プランのみ） */}
                            {!isFreePlan && (
                                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">クレジット残高</h3>
                                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                                        <div>
                                            <p className="text-3xl font-bold text-purple-600">
                                                ${creditBalance?.toFixed(4) || '0.0000'}
                                            </p>
                                            <p className="text-sm text-gray-500 mt-1">利用可能なクレジット</p>
                                        </div>
                                        <button className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-purple-700 transition-all">
                                            <Zap className="h-5 w-5" />
                                            クレジット追加
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* APIキータブ（Freeプランのみ） */}
                    {activeTab === 'apikey' && canSetApiKey && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2.5 bg-purple-100 rounded-xl">
                                    <Sparkles className="h-6 w-6 text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Google AI APIキー</h3>
                                    <p className="text-sm text-gray-500">AI機能を使用するために必要です</p>
                                </div>
                            </div>

                            {/* ステータス表示 */}
                            {hasApiKey ? (
                                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
                                    <CheckCircle className="h-6 w-6 text-green-600" />
                                    <div>
                                        <p className="font-medium text-green-800">APIキー設定済み</p>
                                        <p className="text-sm text-green-600">AI機能が利用可能です</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                                    <AlertCircle className="h-6 w-6 text-amber-600" />
                                    <div>
                                        <p className="font-medium text-amber-800">APIキーが必要です</p>
                                        <p className="text-sm text-amber-600">下記の手順でAPIキーを取得してください</p>
                                    </div>
                                </div>
                            )}

                            {/* APIキー入力 */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {hasApiKey ? 'APIキーを更新' : 'APIキーを入力'}
                                </label>
                                <input
                                    type="password"
                                    value={googleApiKey}
                                    placeholder="AIzaSy..."
                                    onChange={e => setGoogleApiKey(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-mono"
                                />
                            </div>

                            {/* 取得手順 */}
                            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                                <h4 className="font-semibold text-gray-900 mb-4">APIキーの取得方法</h4>
                                <div className="space-y-3">
                                    <Step number={1}>
                                        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                                           className="text-purple-600 font-medium hover:underline inline-flex items-center gap-1">
                                            Google AI Studio <ArrowUpRight className="h-4 w-4" />
                                        </a>
                                        にアクセス
                                    </Step>
                                    <Step number={2}>Googleアカウントでログイン</Step>
                                    <Step number={3}>「Get API Key」→「Create API key」をクリック</Step>
                                    <Step number={4}>生成されたキー（AIzaSy...）をコピーして上に貼り付け</Step>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <p className="text-sm text-gray-500">
                                        <span className="font-medium text-amber-600">注意:</span> 無料枠には制限があります。安定利用には
                                        <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer"
                                           className="font-medium text-gray-700 hover:text-purple-600 ml-1">請求設定</a>
                                        を有効にしてください。
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 一般設定タブ */}
                    {activeTab === 'general' && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2.5 bg-blue-100 rounded-xl">
                                    <Globe className="h-6 w-6 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">一般設定</h3>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">サイト名</label>
                                <input
                                    type="text"
                                    value={config.siteName}
                                    onChange={e => setConfig({ ...config, siteName: e.target.value })}
                                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* GitHub連携タブ */}
                    {activeTab === 'github' && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2.5 bg-gray-100 rounded-xl">
                                    <Github className="h-6 w-6 text-gray-800" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">GitHub連携</h3>
                                    <p className="text-sm text-gray-500">GitHubリポジトリへの自動デプロイ設定</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">パーソナルアクセストークン</label>
                                    <input
                                        type="password"
                                        value={config.github?.token || ''}
                                        placeholder="ghp_..."
                                        onChange={e => setConfig({ ...config, github: { ...config.github, token: e.target.value } })}
                                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all font-mono"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">オーナー / 組織</label>
                                        <input
                                            type="text"
                                            value={config.github?.owner || ''}
                                            onChange={e => setConfig({ ...config, github: { ...config.github, owner: e.target.value } })}
                                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">リポジトリ</label>
                                        <input
                                            type="text"
                                            value={config.github?.repo || ''}
                                            onChange={e => setConfig({ ...config, github: { ...config.github, repo: e.target.value } })}
                                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 保存ボタン（フローティング） */}
                <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 p-4 z-50">
                    <div className="max-w-6xl mx-auto flex justify-between items-center">
                        <p className="text-sm text-gray-500">
                            {isSaving ? '保存中...' : saveStatus === 'success' ? '保存完了' : '変更を保存してください'}
                        </p>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition-all disabled:opacity-50"
                        >
                            {isSaving ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : saveStatus === 'success' ? (
                                <CheckCircle className="h-5 w-5" />
                            ) : (
                                <Save className="h-5 w-5" />
                            )}
                            変更を保存
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// タブボタンコンポーネント
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
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all relative ${
                active
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
        >
            {icon}
            {children}
            {badge && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full" />
            )}
        </button>
    );
}

// プランカードコンポーネント
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
        <div className={`p-5 rounded-xl border-2 transition-all ${
            highlighted
                ? 'border-purple-500 bg-purple-50 scale-105'
                : 'border-gray-200 bg-white hover:border-gray-300'
        }`}>
            {highlighted && (
                <span className="inline-block text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-full mb-3">
                    おすすめ
                </span>
            )}
            <h4 className="text-xl font-bold text-gray-900">{name}</h4>
            <p className="text-2xl font-bold text-gray-900 mt-1">{price}<span className="text-sm font-normal text-gray-500">/月</span></p>
            <ul className="mt-4 space-y-2">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {feature}
                    </li>
                ))}
            </ul>
            <button className={`w-full mt-4 py-2.5 rounded-lg font-medium transition-all ${
                highlighted
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
                選択する
            </button>
        </div>
    );
}

// ステップコンポーネント
function Step({ number, children }: { number: number; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold">
                {number}
            </span>
            <span className="text-gray-600 pt-0.5">{children}</span>
        </div>
    );
}
