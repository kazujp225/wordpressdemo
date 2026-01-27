"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Activity } from 'lucide-react';
import { Card, Typography, Flex, theme } from 'antd';

const { Title, Text } = Typography;
const { useToken } = theme;

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6', '#f97316', '#84cc16'];

const TYPE_LABELS: Record<string, string> = {
    'copy': 'コピー生成',
    'image': '画像生成',
    'inpaint': 'インペイント',
    'edit-image': '画像編集',
    'prompt-copilot': 'プロンプト補助',
    'review': 'コピーレビュー',
    'image-to-prompt': '画像解析',
    'generate-nav': 'ナビ生成',
    'chat-edit': 'チャット編集',
    'lp-generate': 'LP生成'
};

interface TypeData {
    type: string;
    count: number;
    cost: number;
    images: number;
}

export function TypeBreakdownChart({ data }: { data: TypeData[] }) {
    const { token } = useToken();

    const formattedData = data.map((d, i) => ({
        name: TYPE_LABELS[d.type] || d.type,
        value: d.count,
        cost: Number(d.cost.toFixed(4)),
        color: COLORS[i % COLORS.length]
    }));

    return (
        <Card>
            <Flex vertical gap="middle">
                <Flex align="center" gap="small">
                    <Activity
                        size={20}
                        color={token.colorPrimary}
                    />
                    <Title level={3} style={{ margin: 0 }}>
                        種類別使用量
                    </Title>
                </Flex>

                <Flex style={{ height: 256 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={formattedData}
                                cx="50%"
                                cy="45%"
                                innerRadius={40}
                                outerRadius={65}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {formattedData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    borderRadius: token.borderRadiusLG,
                                    border: 'none',
                                    boxShadow: token.boxShadow
                                }}
                                formatter={(value: any, name: any, props: any) => {
                                    return [
                                        <Text key="value">
                                            {value}回 (${props.payload.cost.toFixed(4)})
                                        </Text>,
                                        props.payload.name
                                    ];
                                }}
                            />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                formatter={(value) => (
                                    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                                        {value}
                                    </Text>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </Flex>
            </Flex>
        </Card>
    );
}
