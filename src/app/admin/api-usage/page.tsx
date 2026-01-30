"use client";

import React, { useState, useCallback } from 'react';
import useSWR from 'swr';
import dynamic from 'next/dynamic';
import {
    Activity,
    Image as ImageIcon,
    AlertTriangle,
    Clock,
    MessageSquare,
    RefreshCw,
    Sparkles,
    Loader2,
    TrendingUp
} from 'lucide-react';
import { usdToTokens, formatTokens } from '@/lib/plans';

// チャートコンポーネントを遅延ロード
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

function ChartSkeleton() {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="animate-pulse">
                <div className="h-5 w-32 bg-gray-200 rounded mb-4"></div>
                <div className="h-64 bg-gray-100 rounded"></div>
            </div>
        </div>
    );
}

interface StatsData {
    period: { days: number; startDate: string; endDate: string };
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
    errorRate: { total: number; failed: number; rate: number };
}

const fetcher = (url: string) => fetch(url).then(res => {
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
});

// 統一されたStatCardコンポーネント
function StatCard({
    title,
    value,
    icon: Icon,
    subValue
}: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    subValue?: string;
}) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
                    {subValue && (
                        <p className="mt-1 text-xs text-gray-400">{subValue}</p>
                    )}
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                    <Icon className="h-5 w-5 text-gray-600" />
                </div>
            </div>
        </div>
    );
}

export default function ApiUsageDashboard() {
    const [period, setPeriod] = useState(30);

    const { data: stats, error, isLoading: loading, mutate } = useSWR<StatsData>(
        `/api/admin/stats?days=${period}`,
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000,
            keepPreviousData: true,
        }
    );

    const fetchStats = useCallback(() => {
        mutate();
    }, [mutate]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
                    <p className="mt-3 text-sm text-gray-500 font-medium">読み込み中...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[400px] p-6">
                <div className="text-center max-w-sm">
                    <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900">データの読み込みエラー</h3>
                    <p className="mt-1 text-sm text-gray-500">{error.message}</p>
                    <button
                        onClick={fetchStats}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                        再試行
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">API使用状況</h1>
                    <p className="text-sm text-gray-500 mt-1">AI APIの使用状況とクレジット消費分析</p>
                </div>

                {/* Period Selector */}
                <div className="flex items-center gap-2">
                    {[7, 30, 90].map((d) => (
                        <button
                            key={d}
                            onClick={() => setPeriod(d)}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                period === d
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {d}日
                        </button>
                    ))}
                    <button
                        onClick={fetchStats}
                        className="p-2 bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Summary Cards - Row 1 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="API呼び出し総数"
                    value={stats?.summary?.totalCalls?.toLocaleString() || '0'}
                    icon={Activity}
                />
                <StatCard
                    title="消費クレジット"
                    value={formatTokens(usdToTokens(stats?.summary?.totalCost || 0))}
                    icon={Sparkles}
                    subValue={`平均: ${formatTokens(usdToTokens(stats?.summary?.totalCalls ? ((stats?.summary?.totalCost || 0) / stats.summary.totalCalls) : 0))}/回`}
                />
                <StatCard
                    title="生成画像数"
                    value={stats?.summary?.totalImages?.toLocaleString() || '0'}
                    icon={ImageIcon}
                />
                <StatCard
                    title="エラー率"
                    value={`${(stats?.errorRate?.rate || 0).toFixed(1)}%`}
                    icon={AlertTriangle}
                    subValue={`${stats?.errorRate?.failed || 0}件失敗 / ${stats?.errorRate?.total || 0}件中`}
                />
            </div>

            {/* Summary Cards - Row 2 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="平均応答時間"
                    value={`${((stats?.summary?.avgDurationMs || 0) / 1000).toFixed(1)}秒`}
                    icon={Clock}
                />
                <StatCard
                    title="入力クレジット"
                    value={(stats?.summary?.totalInputTokens || 0).toLocaleString()}
                    icon={MessageSquare}
                />
                <StatCard
                    title="出力クレジット"
                    value={(stats?.summary?.totalOutputTokens || 0).toLocaleString()}
                    icon={MessageSquare}
                />
                <StatCard
                    title="合計クレジット"
                    value={((stats?.summary?.totalInputTokens || 0) + (stats?.summary?.totalOutputTokens || 0)).toLocaleString()}
                    icon={MessageSquare}
                />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DailyUsageChart data={stats?.daily || []} />
                <ModelBreakdownChart data={stats?.byModel || []} />
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TypeBreakdownChart data={stats?.byType || []} />

                {/* Cost Breakdown Card */}
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="h-5 w-5 text-gray-600" />
                        <h3 className="text-base font-bold text-gray-900">モデル別クレジット消費</h3>
                    </div>

                    {(stats?.byModel || []).length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <p className="text-sm">データがありません</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {(stats?.byModel || []).map((model, idx) => (
                                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                    <span className="text-sm text-gray-600 font-medium">
                                        {model.model.replace('gemini-', '')}
                                    </span>
                                    <span className="text-sm font-bold text-gray-900">
                                        {formatTokens(usdToTokens(model.cost))}
                                    </span>
                                </div>
                            ))}

                            <div className="pt-3 mt-3 border-t border-gray-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-gray-900">合計</span>
                                    <span className="text-lg font-bold text-gray-900">
                                        {formatTokens(usdToTokens(stats?.summary?.totalCost || 0))} クレジット
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
