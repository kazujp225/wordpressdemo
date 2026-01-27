"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Cpu } from 'lucide-react';
import { Card, Typography, Flex, theme } from 'antd';

const { Title } = Typography;
const { useToken } = theme;

interface ModelData {
    model: string;
    count: number;
    cost: number;
    images: number;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

export function ModelBreakdownChart({ data }: { data: ModelData[] }) {
    const { token } = useToken();

    const formattedData = data.map((d, i) => ({
        name: d.model.replace('gemini-', '').replace('-preview', '').replace('-image-generation', ''),
        calls: d.count,
        cost: Number(d.cost.toFixed(4)),
        images: d.images || 0,
        color: COLORS[i % COLORS.length]
    }));

    return (
        <Card>
            <Flex vertical gap="middle">
                <Flex align="center" gap="small">
                    <Cpu
                        size={20}
                        color={token.colorPrimary}
                    />
                    <Title level={3} style={{ margin: 0 }}>
                        モデル別使用量
                    </Title>
                </Flex>

                <Flex style={{ height: 256 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={formattedData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} />
                            <XAxis type="number" tick={{ fontSize: 10 }} stroke={token.colorTextSecondary} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tick={{ fontSize: 9 }}
                                width={80}
                                stroke={token.colorTextSecondary}
                            />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: token.borderRadiusLG,
                                    border: 'none',
                                    boxShadow: token.boxShadow
                                }}
                                formatter={(value: any, name: any) => {
                                    if (name === 'calls') return [value, 'API呼び出し'];
                                    if (name === 'cost') return [`$${value.toFixed(4)}`, 'コスト'];
                                    return [value, name];
                                }}
                            />
                            <Bar dataKey="calls" radius={[0, 4, 4, 0]} name="calls">
                                {formattedData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Flex>
            </Flex>
        </Card>
    );
}
