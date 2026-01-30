'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, X, RefreshCw, Shield, Clock, Mail, Zap, Database, FileText, Crown, Ban, AlertTriangle, CreditCard, Plus, Coins } from 'lucide-react';

// プラン定義（src/lib/plans.ts と同期）
const PLANS = {
    free: { name: 'Free', color: 'bg-gray-100 text-gray-700', description: '自分のAPIキー使用', monthlyTokens: 0 },
    pro: { name: 'Pro', color: 'bg-purple-100 text-purple-700', description: '月50,000クレジット', monthlyTokens: 50000 },
    business: { name: 'Business', color: 'bg-blue-100 text-blue-700', description: '月100,000クレジット', monthlyTokens: 100000 },
    enterprise: { name: 'Enterprise', color: 'bg-amber-100 text-amber-700', description: '月250,000クレジット', monthlyTokens: 250000 },
};

// USD → クレジット変換（1 USD = 150円、1円 = 10クレジット → 1 USD = 1,500クレジット）
const USD_TO_TOKENS = 1500;
const usdToTokens = (usd: number) => Math.round(usd * USD_TO_TOKENS);
const tokensToUsd = (tokens: number) => tokens / USD_TO_TOKENS;

// クレジット表示用フォーマット
const formatTokens = (tokens: number) => tokens.toLocaleString();

interface UserUsage {
    monthlyGenerations: number;
    monthlyUploads: number;
    totalPages: number;
    totalStorageMB: number;
}

interface User {
    id: string;
    email: string;
    createdAt: string;
    lastSignInAt: string | null;
    isBanned: boolean;
    bannedAt: string | null;
    banReason: string | null;
    plan: keyof typeof PLANS;
    subscriptionStatus: string | null;
    subscriptionId: string | null;
    usage: UserUsage;
}

interface Transaction {
    id: string;
    type: string;
    amountUsd: number;
    description: string | null;
    createdAt: string;
}

interface CreditInfo {
    currentBalanceUsd: number;
    currentBalanceTokens: number;
    monthlyUsageTokens: number;
    recentTransactions: Transaction[];
    loading: boolean;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [creditInfoMap, setCreditInfoMap] = useState<Map<string, CreditInfo>>(new Map());
    const [tokenAmount, setTokenAmount] = useState<string>('10000');

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/admin/users');
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to fetch users');
            }
            const data = await res.json();
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);



    const handleBan = async (userId: string, action: 'ban' | 'unban') => {
        if (action === 'ban') {
            const confirmed = window.confirm('このユーザーをBANしますか？BANされたユーザーはログインできなくなります。');
            if (!confirmed) return;
        }

        try {
            setProcessing(userId);
            const res = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, action }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update ban status');
            }

            setUsers(prev => prev.map(u =>
                u.id === userId
                    ? { ...u, isBanned: action === 'ban', bannedAt: action === 'ban' ? new Date().toISOString() : null }
                    : u
            ));
        } catch (err: any) {
            alert(err.message);
        } finally {
            setProcessing(null);
        }
    };

    // クレジット情報を取得
    const fetchCreditInfo = async (userId: string) => {
        // ローディング状態を設定
        setCreditInfoMap(prev => {
            const newMap = new Map(prev);
            newMap.set(userId, {
                currentBalanceUsd: 0,
                currentBalanceTokens: 0,
                monthlyUsageTokens: 0,
                recentTransactions: [],
                loading: true
            });
            return newMap;
        });

        try {
            const res = await fetch(`/api/admin/credits?userId=${userId}`);
            if (!res.ok) {
                throw new Error('Failed to fetch credit info');
            }
            const data = await res.json();
            const balanceUsd = data.currentBalanceUsd || 0;
            const monthlyUsageUsd = data.monthlyUsageUsd || 0;
            setCreditInfoMap(prev => {
                const newMap = new Map(prev);
                newMap.set(userId, {
                    currentBalanceUsd: balanceUsd,
                    currentBalanceTokens: usdToTokens(balanceUsd),
                    monthlyUsageTokens: usdToTokens(monthlyUsageUsd),
                    recentTransactions: data.recentTransactions || [],
                    loading: false
                });
                return newMap;
            });
        } catch (err) {
            setCreditInfoMap(prev => {
                const newMap = new Map(prev);
                newMap.set(userId, {
                    currentBalanceUsd: 0,
                    currentBalanceTokens: 0,
                    monthlyUsageTokens: 0,
                    recentTransactions: [],
                    loading: false
                });
                return newMap;
            });
        }
    };

    // クレジット付与（内部でUSDに変換してAPI呼び出し）
    const handleTokenGrant = async (userId: string, tokens: number) => {
        if (tokens <= 0) {
            alert('クレジット数は0より大きい値を入力してください');
            return;
        }

        const amountUsd = tokensToUsd(tokens);

        try {
            setProcessing(userId);
            const res = await fetch('/api/admin/credits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    amount: amountUsd,
                    description: `サービスクレジット付与 ${formatTokens(tokens)}クレジット`,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to grant credits');
            }

            const data = await res.json();
            const newBalanceTokens = usdToTokens(data.newBalance);
            // 既存の情報を保持しながら残高だけ更新
            setCreditInfoMap(prev => {
                const newMap = new Map(prev);
                const existing = prev.get(userId);
                newMap.set(userId, {
                    currentBalanceUsd: data.newBalance,
                    currentBalanceTokens: newBalanceTokens,
                    monthlyUsageTokens: existing?.monthlyUsageTokens || 0,
                    recentTransactions: existing?.recentTransactions || [],
                    loading: false
                });
                return newMap;
            });
            // 履歴を最新に更新
            fetchCreditInfo(userId);

            alert(`${formatTokens(tokens)} クレジットを付与しました。新残高: ${formatTokens(newBalanceTokens)} クレジット`);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setProcessing(null);
        }
    };

    // ユーザー展開時にクレジット情報を取得
    useEffect(() => {
        if (expandedUser && !creditInfoMap.has(expandedUser)) {
            fetchCreditInfo(expandedUser);
        }
    }, [expandedUser]);

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const activeSubscriptions = users.filter(u => u.subscriptionStatus === 'active').length;
    const bannedCount = users.filter(u => u.isBanned).length;

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    <p className="font-medium">エラー</p>
                    <p className="text-sm mt-1">{error}</p>
                    <button
                        onClick={fetchUsers}
                        className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                        再試行
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                        <span className="truncate">ユーザー管理</span>
                    </h1>
                    <p className="text-sm text-gray-600 mt-1 hidden sm:block">
                        ユーザーのサブスク・プラン管理を行います
                    </p>
                </div>
                <button
                    onClick={fetchUsers}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 min-w-[44px] min-h-[44px] px-3 sm:px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">更新</span>
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-white rounded-lg border p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-gray-500">総ユーザー</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{users.length}</p>
                </div>
                <div className="bg-white rounded-lg border p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-gray-500">アクティブサブスク</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">{activeSubscriptions}</p>
                </div>
                <div className="bg-white rounded-lg border p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-gray-500">BAN</p>
                    <p className="text-xl sm:text-2xl font-bold text-red-600">{bannedCount}</p>
                </div>
                <div className="bg-white rounded-lg border p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-gray-500">有料プラン</p>
                    <p className="text-xl sm:text-2xl font-bold text-purple-600">
                        {users.filter(u => u.plan !== 'free').length}
                    </p>
                </div>
                <div className="bg-white rounded-lg border p-3 sm:p-4 col-span-2 sm:col-span-1">
                    <p className="text-xs sm:text-sm text-gray-500">今月の総生成回数</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600">
                        {users.reduce((sum, u) => sum + u.usage.monthlyGenerations, 0).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* User List */}
            <div className="bg-white rounded-lg border overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                        <p>読み込み中...</p>
                    </div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <p>ユーザーがいません</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {users.map((user) => (
                            <div key={user.id} className={user.isBanned ? 'bg-red-50' : ''}>
                                {/* Main Row - card on mobile, row on desktop */}
                                <div
                                    className="px-3 sm:px-4 py-3 sm:py-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px]"
                                    onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                                >
                                    {/* Mobile: stacked card layout */}
                                    <div className="flex items-start gap-3 sm:hidden">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                {user.isBanned ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                                                        <Ban className="w-3 h-3" />BAN
                                                    </span>
                                                ) : user.subscriptionStatus === 'active' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                                        <CreditCard className="w-3 h-3" />サブスク
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                                                        <Clock className="w-3 h-3" />未課金
                                                    </span>
                                                )}
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${PLANS[user.plan]?.color || PLANS.free.color}`}>
                                                    <Crown className="w-3 h-3" />
                                                    {PLANS[user.plan]?.name || 'Free'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-900 truncate">{user.email}</p>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                <span>{formatDate(user.createdAt)}</span>
                                                <span className="flex items-center gap-1">
                                                    <Zap className="w-3 h-3 text-amber-500" />
                                                    {user.usage.monthlyGenerations.toLocaleString()}生成/月
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0">
                                            {user.isBanned && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleBan(user.id, 'unban'); }}
                                                    disabled={processing === user.id}
                                                    className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded min-h-[36px]"
                                                >
                                                    解除
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Desktop: horizontal row */}
                                    <div className="hidden sm:flex items-center gap-4">
                                        {/* Status */}
                                        <div className="w-32 flex-shrink-0">
                                            {user.isBanned ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                                                    <Ban className="w-3 h-3" />BAN
                                                </span>
                                            ) : user.subscriptionStatus === 'active' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                                    <CreditCard className="w-3 h-3" />サブスク有効
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                                                    <Clock className="w-3 h-3" />未課金
                                                </span>
                                            )}
                                        </div>
                                        {/* Email */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                <span className="text-sm text-gray-900 truncate">{user.email}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">登録: {formatDate(user.createdAt)}</p>
                                        </div>
                                        {/* Plan Badge */}
                                        <div className="w-28 flex-shrink-0">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${PLANS[user.plan]?.color || PLANS.free.color}`}>
                                                <Crown className="w-3 h-3" />
                                                {PLANS[user.plan]?.name || 'Free'}
                                            </span>
                                        </div>
                                        {/* Usage Summary */}
                                        <div className="w-32 flex-shrink-0 text-right">
                                            <div className="flex items-center justify-end gap-1 text-sm text-gray-700">
                                                <Zap className="w-4 h-4 text-amber-500" />
                                                <span>{user.usage.monthlyGenerations.toLocaleString()}生成/月</span>
                                            </div>
                                        </div>
                                        {/* Quick Actions */}
                                        <div className="w-32 flex-shrink-0 flex justify-end gap-2">
                                            {user.isBanned && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleBan(user.id, 'unban'); }}
                                                    disabled={processing === user.id}
                                                    className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded min-h-[36px]"
                                                >
                                                    BAN解除
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedUser === user.id && (
                                    <div className="px-3 sm:px-4 py-4 bg-gray-50 border-t">
                                        {/* Subscription Status */}
                                        {user.subscriptionStatus && (
                                            <div className="mb-4 p-3 bg-white rounded-lg border">
                                                <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                                                    <CreditCard className="w-4 h-4 text-green-500" />
                                                    サブスクリプション情報
                                                </h4>
                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                    <div>
                                                        <p className="text-xs text-gray-500">ステータス</p>
                                                        <p className={`font-medium ${user.subscriptionStatus === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
                                                            {user.subscriptionStatus === 'active' ? 'アクティブ' : user.subscriptionStatus}
                                                        </p>
                                                    </div>
                                                    {user.subscriptionId && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Subscription ID</p>
                                                            <p className="font-mono text-xs text-gray-600 truncate">
                                                                {user.subscriptionId}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                            {/* Usage Details */}
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-900 mb-3">使用状況</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-white p-3 rounded-lg border">
                                                        <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                                            <Zap className="w-3 h-3" />
                                                            AI生成
                                                        </div>
                                                        <p className="text-lg font-bold text-gray-900">
                                                            {user.usage.monthlyGenerations}
                                                            <span className="text-sm font-normal text-gray-500">/月</span>
                                                        </p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-lg border">
                                                        <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                                            <FileText className="w-3 h-3" />
                                                            ページ数
                                                        </div>
                                                        <p className="text-lg font-bold text-gray-900">
                                                            {user.usage.totalPages}
                                                        </p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-lg border">
                                                        <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                                            <Database className="w-3 h-3" />
                                                            アップロード
                                                        </div>
                                                        <p className="text-lg font-bold text-gray-900">
                                                            {user.usage.monthlyUploads}
                                                            <span className="text-sm font-normal text-gray-500">/月</span>
                                                        </p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-lg border">
                                                        <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                                            <Database className="w-3 h-3" />
                                                            ストレージ
                                                        </div>
                                                        <p className="text-lg font-bold text-gray-900">
                                                            {user.usage.totalStorageMB}
                                                            <span className="text-sm font-normal text-gray-500">MB</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Current Plan Display (Read-only) */}
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-900 mb-3">現在のプラン</h4>
                                                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                                                    <div className="flex items-center gap-2">
                                                        <Crown className="w-4 h-4 text-gray-600" />
                                                        <span className="font-medium text-gray-900">
                                                            {PLANS[user.plan]?.name || 'Free'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1 ml-6">
                                                        {PLANS[user.plan]?.description || '自分のAPIキー使用'}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-2">
                                                        ※ プラン変更はユーザー自身が設定ページから行います
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Credit Management */}
                                        <div className="mt-6 pt-4 border-t">
                                            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                                                <Coins className="w-4 h-4 text-amber-500" />
                                                クレジット管理
                                            </h4>
                                            <div className="bg-white rounded-lg border p-4">
                                                {/* 現在の残高 */}
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className="text-sm text-gray-600">現在の残高</span>
                                                    <div className="flex items-center gap-2">
                                                        {creditInfoMap.get(user.id)?.loading ? (
                                                            <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                                                        ) : (
                                                            <span className="text-xl font-bold text-amber-600">
                                                                {formatTokens(creditInfoMap.get(user.id)?.currentBalanceTokens || 0)} クレジット
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => fetchCreditInfo(user.id)}
                                                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                                            title="更新"
                                                        >
                                                            <RefreshCw className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* クレジット付与 */}
                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                                                    <div className="flex-1">
                                                        <label className="text-xs text-gray-500 mb-1 block">付与数 (クレジット)</label>
                                                        <div className="relative">
                                                            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                            <input
                                                                type="number"
                                                                min="100"
                                                                step="100"
                                                                value={tokenAmount}
                                                                onChange={(e) => setTokenAmount(e.target.value)}
                                                                className="w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-h-[44px]"
                                                                placeholder="10000"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {[5000, 10000, 50000, 100000].map((amount) => (
                                                            <button
                                                                key={amount}
                                                                onClick={() => setTokenAmount(amount.toString())}
                                                                className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors min-h-[36px]"
                                                            >
                                                                {formatTokens(amount)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={() => handleTokenGrant(user.id, parseInt(tokenAmount) || 0)}
                                                        disabled={processing === user.id || !tokenAmount || parseInt(tokenAmount) <= 0}
                                                        className="px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2 transition-colors min-h-[44px]"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        付与
                                                    </button>
                                                </div>

                                                {/* 注意書き */}
                                                <p className="text-xs text-gray-400 mt-3">
                                                    ※ Freeプランのユーザーはクレジットを使用しません（自分のAPIキーを使用）
                                                </p>
                                            </div>

                                            {/* 今月の使用量 */}
                                            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-gray-600">今月の使用量</span>
                                                    <span className="font-medium text-gray-900">
                                                        {formatTokens(creditInfoMap.get(user.id)?.monthlyUsageTokens || 0)} クレジット
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 使用履歴 */}
                                            <div className="mt-4">
                                                <h5 className="text-sm font-medium text-gray-700 mb-2">最近の履歴（直近20件）</h5>
                                                {creditInfoMap.get(user.id)?.loading ? (
                                                    <div className="flex items-center justify-center py-4">
                                                        <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                                                    </div>
                                                ) : creditInfoMap.get(user.id)?.recentTransactions?.length === 0 ? (
                                                    <p className="text-sm text-gray-400 py-2">履歴がありません</p>
                                                ) : (
                                                    <div className="max-h-60 overflow-y-auto border rounded-lg divide-y divide-gray-100">
                                                        {creditInfoMap.get(user.id)?.recentTransactions?.map((tx) => (
                                                            <div key={tx.id} className="px-3 py-2 bg-white hover:bg-gray-50 text-sm">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded ${
                                                                            tx.type === 'api_usage' ? 'bg-red-100 text-red-700' :
                                                                            tx.type === 'plan_grant' ? 'bg-green-100 text-green-700' :
                                                                            tx.type === 'adjustment' ? 'bg-blue-100 text-blue-700' :
                                                                            tx.type === 'purchase' ? 'bg-purple-100 text-purple-700' :
                                                                            'bg-gray-100 text-gray-700'
                                                                        }`}>
                                                                            {tx.type === 'api_usage' ? '使用' :
                                                                             tx.type === 'plan_grant' ? 'プラン' :
                                                                             tx.type === 'adjustment' ? 'サービス' :
                                                                             tx.type === 'purchase' ? '購入' :
                                                                             tx.type}
                                                                        </span>
                                                                        <span className="text-gray-600 truncate max-w-[200px]">
                                                                            {tx.description || '-'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        <span className={`font-medium ${tx.amountUsd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                            {tx.amountUsd >= 0 ? '+' : ''}{formatTokens(usdToTokens(tx.amountUsd))}
                                                                        </span>
                                                                        <span className="text-xs text-gray-400">
                                                                            {new Date(tx.createdAt).toLocaleDateString('ja-JP', {
                                                                                month: '2-digit',
                                                                                day: '2-digit',
                                                                                hour: '2-digit',
                                                                                minute: '2-digit'
                                                                            })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* BAN Controls */}
                                        <div className="mt-4 pt-4 border-t">
                                            <h4 className="text-sm font-medium text-gray-900 mb-3">アカウント管理</h4>
                                            {user.isBanned ? (
                                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                                    <div className="flex items-start gap-3">
                                                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium text-red-800">このユーザーはBANされています</p>
                                                            <p className="text-xs text-red-600 mt-1">BAN日時: {formatDate(user.bannedAt)}</p>
                                                            {user.banReason && (
                                                                <p className="text-xs text-red-600">理由: {user.banReason}</p>
                                                            )}
                                                            <button
                                                                onClick={() => handleBan(user.id, 'unban')}
                                                                disabled={processing === user.id}
                                                                className="mt-3 px-4 py-2 text-sm bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                                                            >
                                                                BAN解除
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleBan(user.id, 'ban')}
                                                    disabled={processing === user.id}
                                                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                    このユーザーをBANする
                                                </button>
                                            )}
                                        </div>

                                        {/* Additional Info */}
                                        <div className="mt-4 pt-4 border-t text-xs text-gray-500">
                                            <p>ユーザーID: {user.id}</p>
                                            <p>最終ログイン: {formatDate(user.lastSignInAt)}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">プラン説明</h4>
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-sm">
                    {Object.entries(PLANS).map(([planId, planInfo]) => (
                        <div key={planId} className="flex items-start gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${planInfo.color}`}>
                                {planInfo.name}
                            </span>
                            <span className="text-gray-600">{planInfo.description}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
