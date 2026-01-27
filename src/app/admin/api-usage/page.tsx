"use client";

import React, { useState, useCallback } from 'react';
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
import {
    Row,
    Col,
    Card,
    Button,
    Typography,
    Space,
    Flex,
    Spin,
    Alert,
    Skeleton,
    Descriptions,
    theme,
    Empty
} from 'antd';
import { StatCard } from '@/components/admin/dashboard/StatCard';

const { Title, Text } = Typography;
const { useToken } = theme;

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
    const { token } = useToken();
    return (
        <Card>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Skeleton.Input active style={{ width: 128, height: token.controlHeight }} />
                <Skeleton.Node active style={{ width: '100%', height: 256 }}>
                    <Flex style={{ width: '100%', height: 256 }} />
                </Skeleton.Node>
            </Space>
        </Card>
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
    const { token } = useToken();
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
            <Flex
                align="center"
                justify="center"
                style={{ minHeight: 384 }}
            >
                <Space direction="vertical" align="center" size="large">
                    <Spin size="large" />
                    <Text type="secondary" strong>読み込み中...</Text>
                </Space>
            </Flex>
        );
    }

    if (error) {
        return (
            <Flex
                justify="center"
                align="center"
                style={{ padding: token.paddingXL, maxWidth: 1280, margin: '0 auto' }}
            >
                <Alert
                    message="データの読み込みエラー"
                    description={error.message}
                    type="error"
                    showIcon
                    icon={<AlertTriangle size={48} />}
                    action={
                        <Button
                            type="primary"
                            danger
                            icon={<RefreshCw size={16} />}
                            onClick={fetchStats}
                        >
                            再試行
                        </Button>
                    }
                    style={{
                        borderRadius: token.borderRadiusLG,
                        padding: token.paddingLG
                    }}
                />
            </Flex>
        );
    }

    return (
        <Space
            direction="vertical"
            size="large"
            style={{
                width: '100%',
                maxWidth: 1280,
                margin: '0 auto',
                padding: token.paddingLG
            }}
        >
            {/* Header */}
            <Flex justify="space-between" align="flex-end" wrap="wrap" gap="middle">
                <Space direction="vertical" size="small">
                    <Title level={1} style={{ margin: 0 }}>
                        API使用状況
                    </Title>
                    <Text type="secondary">AI APIの使用状況とコスト分析</Text>
                </Space>

                {/* Period Selector */}
                <Space wrap>
                    {[7, 30, 90].map((d) => (
                        <Button
                            key={d}
                            type={period === d ? 'primary' : 'default'}
                            onClick={() => setPeriod(d)}
                            style={{ minHeight: 40 }}
                        >
                            {d}日
                        </Button>
                    ))}
                    <Button
                        icon={<RefreshCw size={16} />}
                        onClick={fetchStats}
                        style={{ minHeight: 40 }}
                    />
                </Space>
            </Flex>

            {/* Summary Cards */}
            <Row gutter={[16, 16]}>
                <Col xs={12} sm={12} lg={6}>
                    <StatCard
                        title="API呼び出し総数"
                        value={stats?.summary?.totalCalls?.toLocaleString() || 0}
                        icon={Activity}
                        color="blue"
                    />
                </Col>
                <Col xs={12} sm={12} lg={6}>
                    <StatCard
                        title="推定コスト"
                        value={`$${(stats?.summary?.totalCost || 0).toFixed(4)}`}
                        icon={DollarSign}
                        color="green"
                        subValue={`平均: $${stats?.summary?.totalCalls ? ((stats?.summary?.totalCost || 0) / stats.summary.totalCalls).toFixed(6) : '0'}/回`}
                    />
                </Col>
                <Col xs={12} sm={12} lg={6}>
                    <StatCard
                        title="生成画像数"
                        value={stats?.summary?.totalImages?.toLocaleString() || 0}
                        icon={ImageIcon}
                        color="purple"
                    />
                </Col>
                <Col xs={12} sm={12} lg={6}>
                    <StatCard
                        title="エラー率"
                        value={`${(stats?.errorRate?.rate || 0).toFixed(1)}%`}
                        icon={AlertTriangle}
                        color={(stats?.errorRate?.failed || 0) > 0 ? 'red' : 'gray'}
                        subValue={`${stats?.errorRate?.failed || 0}件失敗 / ${stats?.errorRate?.total || 0}件中`}
                    />
                </Col>
            </Row>

            {/* Additional Stats */}
            <Row gutter={[16, 16]}>
                <Col xs={12} sm={12} lg={6}>
                    <StatCard
                        title="平均応答時間"
                        value={`${((stats?.summary?.avgDurationMs || 0) / 1000).toFixed(1)}秒`}
                        icon={Clock}
                        color="amber"
                    />
                </Col>
                <Col xs={12} sm={12} lg={6}>
                    <StatCard
                        title="入力トークン"
                        value={(stats?.summary?.totalInputTokens || 0).toLocaleString()}
                        icon={MessageSquare}
                        color="blue"
                    />
                </Col>
                <Col xs={12} sm={12} lg={6}>
                    <StatCard
                        title="出力トークン"
                        value={(stats?.summary?.totalOutputTokens || 0).toLocaleString()}
                        icon={MessageSquare}
                        color="purple"
                    />
                </Col>
                <Col xs={12} sm={12} lg={6}>
                    <StatCard
                        title="合計トークン"
                        value={((stats?.summary?.totalInputTokens || 0) + (stats?.summary?.totalOutputTokens || 0)).toLocaleString()}
                        icon={MessageSquare}
                        color="green"
                    />
                </Col>
            </Row>

            {/* Charts Row 1 */}
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                    <DailyUsageChart data={stats?.daily || []} />
                </Col>
                <Col xs={24} lg={12}>
                    <ModelBreakdownChart data={stats?.byModel || []} />
                </Col>
            </Row>

            {/* Charts Row 2 */}
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                    <TypeBreakdownChart data={stats?.byType || []} />
                </Col>

                {/* Cost Breakdown Card */}
                <Col xs={24} lg={12}>
                    <Card>
                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                            <Flex align="center" gap="small">
                                <DollarSign
                                    size={20}
                                    color={token.colorSuccess}
                                />
                                <Title level={3} style={{ margin: 0 }}>
                                    モデル別コスト
                                </Title>
                            </Flex>

                            {(stats?.byModel || []).length === 0 ? (
                                <Empty description="データがありません" />
                            ) : (
                                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                    {(stats?.byModel || []).map((model, idx) => (
                                        <Descriptions
                                            key={idx}
                                            column={1}
                                            size="small"
                                            items={[
                                                {
                                                    label: (
                                                        <Text type="secondary" strong ellipsis>
                                                            {model.model.replace('gemini-', '')}
                                                        </Text>
                                                    ),
                                                    children: (
                                                        <Text strong>
                                                            ${model.cost.toFixed(4)}
                                                        </Text>
                                                    )
                                                }
                                            ]}
                                        />
                                    ))}

                                    {(stats?.byModel || []).length > 0 && (
                                        <Descriptions
                                            column={1}
                                            bordered
                                            size="small"
                                            items={[
                                                {
                                                    label: <Text strong>合計</Text>,
                                                    children: (
                                                        <Title
                                                            level={4}
                                                            type="success"
                                                            style={{ margin: 0 }}
                                                        >
                                                            ${(stats?.summary?.totalCost || 0).toFixed(4)}
                                                        </Title>
                                                    )
                                                }
                                            ]}
                                        />
                                    )}
                                </Space>
                            )}
                        </Space>
                    </Card>
                </Col>
            </Row>
        </Space>
    );
}
