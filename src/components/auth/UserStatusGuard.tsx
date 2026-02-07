"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface UserStatus {
    userId: string;
    isBanned: boolean;
    banReason: string | null;
    plan: string;
    hasActiveSubscription: boolean;
}

interface UserStatusGuardProps {
    children: React.ReactNode;
    requireSubscription?: boolean;
}

/**
 * BAN/planチェックを行うガードコンポーネント
 *
 * - BANされている場合: /banned へリダイレクト
 *
 * ※ サブスクチェックは削除（外部決済→アカウント作成のフローに変更）
 *
 * Edge Runtimeでservice_roleを使わないために、
 * クライアント側でAPIを呼び出してチェックする設計
 */
export function UserStatusGuard({ children, requireSubscription = true }: UserStatusGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [status, setStatus] = useState<UserStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/user/status');

                if (res.status === 401) {
                    // 未認証の場合はログインページへ
                    router.push('/');
                    return;
                }

                if (!res.ok) {
                    throw new Error('Failed to fetch user status');
                }

                const data: UserStatus = await res.json();
                setStatus(data);

                // BANチェック
                if (data.isBanned) {
                    router.push('/banned');
                    return;
                }

                // サブスクチェックは削除（外部決済→アカウント作成のフローに変更）
                // 全ユーザーがアクセス可能

                setLoading(false);
            } catch (err: any) {
                console.error('UserStatusGuard error:', err);
                setError(err.message);
                setLoading(false);
            }
        };

        checkStatus();
    }, [router, pathname, requireSubscription]);

    // ローディング中は何も表示しない（ちらつき防止）
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // エラー時はエラーメッセージ
    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-red-600">エラーが発生しました: {error}</div>
            </div>
        );
    }

    return <>{children}</>;
}
