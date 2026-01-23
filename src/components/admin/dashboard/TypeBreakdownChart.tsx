"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Activity } from 'lucide-react';

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
    const formattedData = data.map((d, i) => ({
        name: TYPE_LABELS[d.type] || d.type,
        value: d.count,
        cost: Number(d.cost.toFixed(4)),
        color: COLORS[i % COLORS.length]
    }));

    return (
        <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-4 sm:p-8 shadow-sm">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                種類別使用量
            </h3>
            <div className="h-56 sm:h-64">
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
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                            }}
                            formatter={(value: any, name: any, props: any) => {
                                return [
                                    <span key="value">
                                        {value}回 (${props.payload.cost.toFixed(4)})
                                    </span>,
                                    props.payload.name
                                ];
                            }}
                        />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            formatter={(value) => (
                                <span className="text-xs font-medium text-gray-600">{value}</span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
