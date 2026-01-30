"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { usdToTokens, formatTokens } from '@/lib/plans';

interface DailyData {
    date: string;
    count: number;
    cost: number;
    errors: number;
}

export function DailyUsageChart({ data }: { data: DailyData[] }) {
    const formattedData = data.map(d => ({
        ...d,
        date: new Date(d.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
        cost: Number(d.cost.toFixed(4))
    }));

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="h-5 w-5 text-gray-600" />
                <h3 className="text-base font-bold text-gray-900">日別API使用量</h3>
            </div>

            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={formattedData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            stroke="#9ca3af"
                            interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <Tooltip
                            contentStyle={{
                                borderRadius: 8,
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(value: any, name: any) => {
                                if (name === 'count') return [value, 'API呼び出し'];
                                if (name === 'cost') return [formatTokens(usdToTokens(value)), 'クレジット'];
                                return [value, name];
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="count"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                            activeDot={{ r: 5 }}
                            name="count"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
