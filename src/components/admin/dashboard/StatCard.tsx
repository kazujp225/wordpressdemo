"use client";

import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    color: 'blue' | 'green' | 'purple' | 'red' | 'gray' | 'amber';
    subValue?: string;
}

const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600',
    amber: 'bg-amber-50 text-amber-600'
};

export function StatCard({ title, value, icon: Icon, color, subValue }: StatCardProps) {
    return (
        <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-3 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2 sm:mb-4">
                <div className={clsx('rounded-lg sm:rounded-xl p-2 sm:p-3', colorClasses[color])}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
            </div>
            <p className="text-lg sm:text-2xl font-black text-gray-900 mb-0.5 sm:mb-1 truncate">{value}</p>
            <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider sm:tracking-widest leading-tight">{title}</p>
            {subValue && (
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1 sm:mt-2 truncate">{subValue}</p>
            )}
        </div>
    );
}
