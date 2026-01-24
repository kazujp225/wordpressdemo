"use client";

import React, { useState, useEffect, Suspense } from 'react';
import {
    Save, Globe, Github, Loader2, CheckCircle, Sparkles, LogOut,
    Crown, Zap, ArrowUpRight, CreditCard, Key, Settings2,
    ChevronRight, AlertCircle, Star, Rocket, Upload, Mail, ChevronDown
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
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

export default function SettingsPageWrapper() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-50/50" />}>
            <SettingsPage />
        </Suspense>
    );
}

function SettingsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
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
    const [activeTab, setActiveTab] = useState<'plan' | 'apikey' | 'general' | 'github' | 'deploy'>('plan');
    const [renderApiKey, setRenderApiKey] = useState('');
    const [githubDeployOwner, setGithubDeployOwner] = useState('');
    const [hasRenderApiKey, setHasRenderApiKey] = useState(false);
    const [hasGithubToken, setHasGithubToken] = useState(false);
    // Resend settings
    const [resendApiKey, setResendApiKey] = useState('');
    const [notificationEmail, setNotificationEmail] = useState('');
    const [resendFromDomain, setResendFromDomain] = useState('');
    const [hasResendApiKey, setHasResendApiKey] = useState(false);
    const [showDnsGuide, setShowDnsGuide] = useState(false);

    // Handle query params (tab, OAuth callback)
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'deploy' || tab === 'plan' || tab === 'apikey' || tab === 'general' || tab === 'github') {
            setActiveTab(tab);
        }

        const githubStatus = searchParams.get('github');
        const error = searchParams.get('error');
        if (githubStatus === 'connected') {
            toast.success('GitHub連携が完了しました');
            setHasGithubToken(true);
            setActiveTab('deploy');
            // Clean URL
            router.replace('/admin/settings', { scroll: false });
        }
        if (error) {
            const errorMessages: Record<string, string> = {
                unauthorized: 'ログインが必要です',
                no_code: 'GitHub認証がキャンセルされました',
                invalid_state: '認証エラーが発生しました',
                not_configured: 'GitHub OAuth未設定です',
                token_failed: 'トークン取得に失敗しました',
                user_fetch_failed: 'GitHubユーザー情報の取得に失敗しました',
                callback_failed: 'GitHub連携に失敗しました',
            };
            toast.error(errorMessages[error] || 'エラーが発生しました');
            setActiveTab('deploy');
            router.replace('/admin/settings', { scroll: false });
        }
    }, [searchParams]);

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
                setHasRenderApiKey(data.hasRenderApiKey || false);
                setHasGithubToken(data.hasGithubToken || false);
                if (data.githubDeployOwner) setGithubDeployOwner(data.githubDeployOwner);
                setHasResendApiKey(data.hasResendApiKey || false);
                if (data.notificationEmail) setNotificationEmail(data.notificationEmail);
                if (data.resendFromDomain) setResendFromDomain(data.resendFromDomain);
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
            // Save user-level settings (API keys)
            const userSettingsPayload: any = {};
            if (googleApiKey && canSetApiKey) {
                userSettingsPayload.googleApiKey = googleApiKey;
            }
            if (renderApiKey) {
                userSettingsPayload.renderApiKey = renderApiKey;
            }
            if (resendApiKey) {
                userSettingsPayload.resendApiKey = resendApiKey;
            }
            if (notificationEmail !== undefined) {
                userSettingsPayload.notificationEmail = notificationEmail;
            }
            if (resendFromDomain !== undefined) {
                userSettingsPayload.resendFromDomain = resendFromDomain;
            }

            if (Object.keys(userSettingsPayload).length > 0) {
                const userRes = await fetch('/api/user/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userSettingsPayload)
                });
                if (userRes.ok) {
                    if (googleApiKey) { setHasApiKey(true); setGoogleApiKey(''); }
                    if (renderApiKey) { setHasRenderApiKey(true); setRenderApiKey(''); }
                    if (resendApiKey) { setHasResendApiKey(true); setResendApiKey(''); }
                }
            }

            // Save global config
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
                        active={activeTab === 'deploy'}
                        onClick={() => setActiveTab('deploy')}
                        icon={<Upload className="h-4 w-4" />}
                        badge={!hasRenderApiKey || !hasGithubToken}
                    >
                        デプロイ
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

                    {/* デプロイ設定タブ */}
                    {activeTab === 'deploy' && (
                        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-8">
                            <div className="flex items-start gap-4 mb-8">
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <Upload className="h-5 w-5 text-gray-900" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">デプロイ設定</h3>
                                    <p className="text-sm text-gray-500 mt-1">AIで生成したHTMLをRenderにデプロイするための設定</p>
                                </div>
                            </div>

                            {/* Status */}
                            {hasRenderApiKey && hasGithubToken ? (
                                <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg mb-8">
                                    <CheckCircle className="h-5 w-5 text-gray-900" />
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">デプロイ設定完了</p>
                                        <p className="text-xs text-gray-600">AI Code Generatorからデプロイが可能です</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg mb-8">
                                    <AlertCircle className="h-5 w-5 text-gray-900" />
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">設定が必要です</p>
                                        <p className="text-xs text-gray-600">下記の2つを設定してください</p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-6">
                                {/* 1. GitHub OAuth Connect */}
                                <div className="p-5 rounded-xl border border-gray-200 bg-gray-50/50">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-lg border border-gray-200">
                                                <Github className="h-5 w-5 text-gray-900" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">GitHub連携</p>
                                                <p className="text-xs text-gray-500">リポジトリ作成に使用</p>
                                            </div>
                                        </div>
                                        {hasGithubToken ? (
                                            <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                                                連携済み{githubDeployOwner ? ` (${githubDeployOwner})` : ''}
                                            </span>
                                        ) : (
                                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                                                未連携
                                            </span>
                                        )}
                                    </div>
                                    {hasGithubToken ? (
                                        <div className="flex items-center gap-3 mt-4">
                                            <a
                                                href="/api/auth/github"
                                                className="text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors underline underline-offset-2"
                                            >
                                                再連携する
                                            </a>
                                        </div>
                                    ) : (
                                        <a
                                            href="/api/auth/github"
                                            className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                                        >
                                            <Github className="h-4 w-4" />
                                            GitHubと連携する
                                        </a>
                                    )}
                                </div>

                                {/* 2. Render API Key */}
                                <div className="p-5 rounded-xl border border-gray-200 bg-gray-50/50">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-lg border border-gray-200">
                                                <Globe className="h-5 w-5 text-gray-900" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">Render APIキー</p>
                                                <p className="text-xs text-gray-500">ホスティングに使用</p>
                                            </div>
                                        </div>
                                        {hasRenderApiKey ? (
                                            <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                                                設定済み
                                            </span>
                                        ) : (
                                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                                                未設定
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-4">
                                        <input
                                            type="password"
                                            value={renderApiKey}
                                            placeholder={hasRenderApiKey ? '••••••••（変更する場合のみ入力）' : 'rnd_...'}
                                            onChange={e => setRenderApiKey(e.target.value)}
                                            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all font-mono text-gray-900 placeholder:text-gray-400"
                                        />
                                        <p className="text-xs text-gray-500 mt-2">
                                            <a href="https://dashboard.render.com/u/settings#api-keys" target="_blank" rel="noopener noreferrer"
                                                className="text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900 transition-all inline-flex items-center gap-1 font-medium">
                                                Render Dashboard → Account → API Keys <ArrowUpRight className="h-3 w-3" />
                                            </a>
                                            で「Create API Key」をクリック
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Resend Email Notification */}
                            <div className="mt-8 p-5 rounded-xl border border-gray-200 bg-gray-50/50">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg border border-gray-200">
                                            <Mail className="h-5 w-5 text-gray-900" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">メール通知（Resend）</p>
                                            <p className="text-xs text-gray-500">フォーム送信時にメール通知を受け取る</p>
                                        </div>
                                    </div>
                                    {hasResendApiKey && notificationEmail ? (
                                        <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                                            設定済み
                                        </span>
                                    ) : (
                                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                                            オプション
                                        </span>
                                    )}
                                </div>

                                <div className="mt-4 space-y-4">
                                    {/* Resend API Key */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Resend APIキー</label>
                                        <input
                                            type="password"
                                            value={resendApiKey}
                                            placeholder={hasResendApiKey ? '••••••••（変更する場合のみ入力）' : 're_...'}
                                            onChange={e => setResendApiKey(e.target.value)}
                                            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all font-mono text-gray-900 placeholder:text-gray-400"
                                        />
                                    </div>

                                    {/* Notification Email */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">通知先メールアドレス</label>
                                        <input
                                            type="email"
                                            value={notificationEmail}
                                            placeholder="you@example.com"
                                            onChange={e => setNotificationEmail(e.target.value)}
                                            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all text-gray-900 placeholder:text-gray-400"
                                        />
                                        <p className="text-xs text-gray-500 mt-1.5">フォーム送信の通知を受け取るメールアドレス</p>
                                    </div>

                                    {/* From Domain (optional) */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">送信ドメイン（オプション）</label>
                                        <input
                                            type="text"
                                            value={resendFromDomain}
                                            placeholder="example.com"
                                            onChange={e => setResendFromDomain(e.target.value)}
                                            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all text-gray-900 placeholder:text-gray-400"
                                        />
                                        <p className="text-xs text-gray-500 mt-1.5">未設定の場合はResendテスト用アドレスから送信されます</p>
                                    </div>
                                </div>

                                {/* Setup Guide */}
                                <div className="mt-6 rounded-lg p-5 border border-gray-200 border-dashed bg-white">
                                    <h4 className="text-sm font-bold text-gray-900 mb-3">メール通知の設定（5分で完了）</h4>
                                    <div className="space-y-3">
                                        <Step number={1}>
                                            <a href="https://resend.com" target="_blank" rel="noopener noreferrer"
                                                className="text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900 transition-all inline-flex items-center gap-1 font-medium">
                                                resend.com <ArrowUpRight className="h-3 w-3" />
                                            </a>
                                            で無料アカウント作成（100通/日まで無料）
                                        </Step>
                                        <Step number={2}>API Keysページで「Create API Key」をクリック</Step>
                                        <Step number={3}>生成されたキー（re_...）を上の欄に貼り付け</Step>
                                        <Step number={4}>通知を受け取るメールアドレスを入力</Step>
                                        <Step number={5}>ページ下部の「変更を保存」ボタンを押して完了</Step>
                                    </div>
                                </div>

                                {/* DNS Guide (collapsible) */}
                                <div className="mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowDnsGuide(!showDnsGuide)}
                                        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                                    >
                                        <ChevronDown className={`h-4 w-4 transition-transform ${showDnsGuide ? 'rotate-180' : ''}`} />
                                        独自ドメイン設定（オプション）
                                    </button>
                                    {showDnsGuide && (
                                        <div className="mt-3 rounded-lg p-5 border border-gray-200 border-dashed bg-white">
                                            <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                                                <span className="font-bold text-gray-900">設定しない場合:</span> Resendテスト用アドレスから送信（自分宛のみ有効）<br />
                                                <span className="font-bold text-gray-900">設定する場合:</span> 独自ドメインから送信可能（第三者にも送信可能）
                                            </p>
                                            <div className="space-y-3">
                                                <Step number={1}>
                                                    Resend Domainsページで「Add Domain」をクリック
                                                </Step>
                                                <Step number={2}>表示されるDNSレコード（MX, TXT, CNAME）をDNS設定に追加</Step>
                                                <Step number={3}>「Verify」をクリックして認証を確認</Step>
                                                <Step number={4}>認証したドメインを上の「送信ドメイン」欄に入力</Step>
                                            </div>
                                            <div className="mt-4 pt-3 border-t border-gray-200 border-dashed">
                                                <p className="text-xs text-gray-500 leading-relaxed">
                                                    <span className="font-bold text-gray-900">ヒント:</span> DNSレコードの追加方法はご利用のドメイン管理サービス（お名前.com、Cloudflare等）のヘルプを参照してください。
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Important: Render-GitHub connection */}
                            <div className="mt-8 p-5 rounded-xl border border-amber-200 bg-amber-50/50">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900 mb-2">初回セットアップ: RenderとGitHubの接続</h4>
                                        <p className="text-xs text-gray-600 leading-relaxed mb-3">
                                            RenderからGitHubリポジトリにアクセスするため、Render DashboardでGitHubアカウントを接続する必要があります（初回のみ）。
                                        </p>
                                        <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
                                            <li>
                                                <a href="https://dashboard.render.com/select-repo?type=static" target="_blank" rel="noopener noreferrer"
                                                    className="text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900 transition-all font-medium inline-flex items-center gap-1">
                                                    Render Dashboard <ArrowUpRight className="h-3 w-3 inline" />
                                                </a>
                                                にアクセス
                                            </li>
                                            <li>「Connect GitHub」をクリックしてGitHubアカウントを連携</li>
                                            <li>連携完了後、このページに戻って設定を完了</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>

                            {/* How it works */}
                            <div className="mt-6 rounded-lg p-6 border border-gray-200 border-dashed">
                                <h4 className="text-sm font-bold text-gray-900 mb-4">デプロイの流れ</h4>
                                <div className="space-y-4">
                                    <Step number={1}>上記の設定を完了（初回のみ）</Step>
                                    <Step number={2}>AI Code Generatorでコードを生成</Step>
                                    <Step number={3}>「デプロイ」ボタンを1クリック</Step>
                                    <Step number={4}>自動でGitHub→Render→公開URL取得</Step>
                                </div>
                                <div className="mt-6 pt-4 border-t border-gray-200 border-dashed">
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        <span className="font-bold text-gray-900">Note:</span> Render Static Siteは無料で利用可能。GitHubリポジトリはPublicで自動作成されます。APIキーは暗号化して保存されます。
                                    </p>
                                </div>
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
