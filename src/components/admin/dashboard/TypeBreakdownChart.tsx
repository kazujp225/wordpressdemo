"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Activity } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6', '#f97316', '#84cc16'];

const TYPE_LABELS: Record<string, string> = {
    'copy': 'コピー生成',
    'image': '画像生成',
    '画像生成': '画像生成',
    'inpaint': 'インペイント',
    'インペイント': 'インペイント',
    'edit-image': '画像編集',
    'gemini-edit-code': 'コード編集(Gemini)',
    'gemini-generate': '画像生成(Gemini)',
    'claude-edit-code': 'コード編集(Claude)',
    'claude-generate': '生成(Claude)',
    'background-unify': '背景統一',
    'design-analysis': 'デザイン解析',
    'import-arrange': 'インポート整理',
    'lp-generate-text-based': 'LP生成(テキスト)',
    'lp-generate': 'LP生成',
    'ocr': 'テキスト読取(OCR)',
    'seo-llmo-combined': 'SEO/LLMO最適化',
    'suggest-benefits': 'ベネフィット提案',
    'text-fix': 'テキスト修正',
    'prompt-copilot': 'プロンプト補助',
    'review': 'コピーレビュー',
    'image-to-prompt': '画像解析',
    'generate-nav': 'ナビ生成',
    'chat-edit': 'チャット編集',
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
        <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-6">
                <Activity className="h-5 w-5 text-gray-600" />
                <h3 className="text-base font-bold text-gray-900">種類別使用量</h3>
            </div>

            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={formattedData}
                            cx="50%"
                            cy="50%"
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
                                borderRadius: 8,
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(value: any, name: any, props: any) => {
                                return [
                                    <span key="value" className="text-sm text-gray-900">
                                        {value}回 (${props.payload.cost.toFixed(4)})
                                    </span>,
                                    props.payload.name
                                ];
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            {/* 凡例 - 2列グリッド */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-4">
                {formattedData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-1.5 min-w-0">
                        <span
                            className="shrink-0 w-2.5 h-2.5 rounded-sm"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-xs text-gray-500 truncate">{entry.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">{entry.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
