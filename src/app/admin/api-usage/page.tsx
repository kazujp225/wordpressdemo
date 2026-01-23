"use client";

import React, { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import dynamic from 'next/dynamic';
import {
    Activity,
    DollarSign,
    Image as ImageIcon,
    AlertTriangle,
    Clock,
    MessageSquare,
    RefreshCw
} from 'lucide-react';
import { StatCard } from '@/components/admin/dashboard/StatCard';

// チャートコンポーネントを遅延ロード（初期表示を高速化）
const DailyUsageChart = dynamic(
    () => import('@/components/admin/dashboard/DailyUsageChart').then(mod => mod.DailyUsageChart),
    { loading: () => <ChartSkeleton />, ssr: false }
);
const ModelBreakdownChart = dynamic(
    () => import('@/components/admin/dashboard/ModelBreakdownChart').then(mod => mod.ModelBreakdownChart),
    { loading: () => <ChartSkeleton />, ssr: false }
);
const TypeBreakdownChart = dynamic(
    () => import('@/components/admin/dashboard/TypeBreakdownChart').then(mod => mod.TypeBreakdownChart),
    { loading: () => <ChartSkeleton />, ssr: false }
);

// チャート用スケルトンコンポーネント
function ChartSkeleton() {
    return (
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm animate-pulse">
            <div className="h-6 w-32 bg-gray-200 rounded mb-6" />
            <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
    );
}

interface StatsData {
    period: {
        days: number;
        startDate: string;
        endDate: string;
    };
    summary: {
        totalCalls: number;
        totalCost: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalImages: number;
        avgDurationMs: number;
    };
    daily: Array<{ date: string; count: number; cost: number; errors: number }>;
    byModel: Array<{ model: string; count: number; cost: number; images: number }>;
    byType: Array<{ type: string; count: number; cost: number; images: number }>;
    errorRate: {
        total: number;
        failed: number;
        rate: number;
    };
}

// フェッチャー関数
const fetcher = (url: string) => fetch(url).then(res => {
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
});

export default function ApiUsageDashboard() {
    const [period, setPeriod] = useState(30);

    // SWRでデータを取得（キャッシュ済み、タブ切り替え時に即表示）
    const { data: stats, error, isLoading: loading, mutate } = useSWR<StatsData>(
        `/api/admin/stats?days=${period}`,
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000,
            keepPreviousData: true,
        }
    );

    // 再取得関数（メモ化）
    const fetchStats = useCallback(() => {
        mutate();
    }, [mutate]);

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                    <p className="text-gray-500 font-medium">読み込み中...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-10 max-w-7xl mx-auto">
                <div className="bg-red-50 rounded-3xl p-8 text-center">
                    <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-red-700 mb-2">データの読み込みエラー</h2>
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                        onClick={fetchStats}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                        再試行
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:p-10 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 sm:mb-10 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                    <h1 className="text-xl sm:text-3xl font-black tracking-tight text-gray-900">API使用状況</h1>
                    <p className="text-sm text-gray-500 mt-1">AI APIの使用状況とコスト分析</p>
                </div>

                {/* Period Selector */}
                <div className="flex gap-2 flex-wrap">
                    {[7, 30, 90].map((d) => (
                        <button
                            key={d}
                            onClick={() => setPeriod(d)}
                            className={`px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-all min-h-[40px] ${
                                period === d
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {d}日
                        </button>
                    ))}
                    <button
                        onClick={fetchStats}
                        className="flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-10">
                <StatCard
                    title="API呼び出し総数"
                    value={stats?.summary?.totalCalls?.toLocaleString() || 0}
                    icon={Activity}
                    color="blue"
                />
                <StatCard
                    title="推定コスト"
                    value={`$${(stats?.summary?.totalCost || 0).toFixed(4)}`}
                    icon={DollarSign}
                    color="green"
                    subValue={`平均: $${stats?.summary?.totalCalls ? ((stats?.summary?.totalCost || 0) / stats.summary.totalCalls).toFixed(6) : '0'}/回`}
                />
                <StatCard
                    title="生成画像数"
                    value={stats?.summary?.totalImages?.toLocaleString() || 0}
                    icon={ImageIcon}
                    color="purple"
                />
                <StatCard
                    title="エラー率"
                    value={`${(stats?.errorRate?.rate || 0).toFixed(1)}%`}
                    icon={AlertTriangle}
                    color={(stats?.errorRate?.failed || 0) > 0 ? 'red' : 'gray'}
                    subValue={`${stats?.errorRate?.failed || 0}件失敗 / ${stats?.errorRate?.total || 0}件中`}
                />
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-10">
                <StatCard
                    title="平均応答時間"
                    value={`${((stats?.summary?.avgDurationMs || 0) / 1000).toFixed(1)}秒`}
                    icon={Clock}
                    color="amber"
                />
                <StatCard
                    title="入力トークン"
                    value={(stats?.summary?.totalInputTokens || 0).toLocaleString()}
                    icon={MessageSquare}
                    color="blue"
                />
                <StatCard
                    title="出力トークン"
                    value={(stats?.summary?.totalOutputTokens || 0).toLocaleString()}
                    icon={MessageSquare}
                    color="purple"
                />
                <StatCard
                    title="合計トークン"
                    value={((stats?.summary?.totalInputTokens || 0) + (stats?.summary?.totalOutputTokens || 0)).toLocaleString()}
                    icon={MessageSquare}
                    color="green"
                />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                <DailyUsageChart data={stats?.daily || []} />
                <ModelBreakdownChart data={stats?.byModel || []} />
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <TypeBreakdownChart data={stats?.byType || []} />

                {/* Cost Breakdown Card */}
                <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-4 sm:p-8 shadow-sm">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                        <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                        モデル別コスト
                    </h3>
                    <div className="space-y-4">
                        {(stats?.byModel || []).map((model, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                                <span className="text-gray-600 text-sm font-medium truncate max-w-[200px]">
                                    {model.model.replace('gemini-', '')}
                                </span>
                                <span className="font-bold text-gray-900">
                                    ${model.cost.toFixed(4)}
                                </span>
                            </div>
                        ))}
                        {(stats?.byModel || []).length === 0 && (
                            <p className="text-gray-400 text-center py-4">データがありません</p>
                        )}
                        {(stats?.byModel || []).length > 0 && (
                            <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                                <span className="text-gray-600 font-bold">合計</span>
                                <span className="font-black text-green-600 text-xl">
                                    ${(stats?.summary?.totalCost || 0).toFixed(4)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
