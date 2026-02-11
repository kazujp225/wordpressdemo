'use client';

import { Sparkles } from 'lucide-react';
import Link from 'next/link';

interface UpgradeBannerProps {
    feature?: string;
    className?: string;
}

export function UpgradeBanner({ feature, className = '' }: UpgradeBannerProps) {
    return (
        <div className={`p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg ${className}`}>
            <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <p className="text-sm font-bold text-blue-900">
                    {feature ? `${feature}は有料プランで利用できます` : '有料プランにアップグレード'}
                </p>
            </div>
            <Link
                href="/admin/settings"
                className="text-xs text-blue-600 hover:underline mt-1.5 block"
            >
                プランをアップグレード →
            </Link>
        </div>
    );
}
