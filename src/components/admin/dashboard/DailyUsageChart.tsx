"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card, Typography, Flex, theme } from 'antd';

const { Title } = Typography;
const { useToken } = theme;

interface DailyData {
    date: string;
    count: number;
    cost: number;
    errors: number;
}

export function DailyUsageChart({ data }: { data: DailyData[] }) {
    const { token } = useToken();

    const formattedData = data.map(d => ({
        ...d,
        date: new Date(d.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
        cost: Number(d.cost.toFixed(4))
    }));

    return (
        <Card>
            <Flex vertical gap="middle">
                <Flex align="center" gap="small">
                    <TrendingUp
                        size={20}
                        color={token.colorPrimary}
                    />
                    <Title level={3} style={{ margin: 0 }}>
                        日別API使用量
                    </Title>
                </Flex>

                <Flex style={{ height: 256 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={formattedData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11 }}
                                stroke={token.colorTextSecondary}
                                interval="preserveStartEnd"
                            />
                            <YAxis tick={{ fontSize: 11 }} stroke={token.colorTextSecondary} />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: token.borderRadiusLG,
                                    border: 'none',
                                    boxShadow: token.boxShadow
                                }}
                                formatter={(value: any, name: any) => {
                                    if (name === 'count') return [value, 'API呼び出し'];
                                    if (name === 'cost') return [`$${value.toFixed(4)}`, 'コスト'];
                                    return [value, name];
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="count"
                                stroke={token.colorPrimary}
                                strokeWidth={3}
                                dot={{ fill: token.colorPrimary, strokeWidth: 2, r: 3 }}
                                activeDot={{ r: 5 }}
                                name="count"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </Flex>
            </Flex>
        </Card>
    );
}
