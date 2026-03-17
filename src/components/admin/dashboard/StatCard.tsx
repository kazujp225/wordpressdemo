"use client";

import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    color: 'blue' | 'green' | 'purple' | 'red' | 'gray' | 'amber';
    subValue?: string;
}

const colorConfig = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    green: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
    red: { bg: 'bg-red-50', text: 'text-red-600' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
};

export function StatCard({ title, value, icon: Icon, color, subValue }: StatCardProps) {
    const c = colorConfig[color];

    return (
        <div className="border border-gray-200 rounded-lg p-4 min-h-[140px] flex flex-col hover:shadow-sm transition-shadow bg-white">
            <div className={`${c.bg} rounded-lg p-2 w-fit`}>
                <Icon size={20} className={c.text} />
            </div>

            <div className="mt-3">
                <p className="text-2xl font-black leading-tight truncate">{value}</p>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-1">{title}</p>
                {subValue && (
                    <p className="text-xs text-gray-400 mt-1 truncate">{subValue}</p>
                )}
            </div>
        </div>
    );
}
