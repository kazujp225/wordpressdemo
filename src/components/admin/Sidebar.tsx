"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Images, Settings, LogOut, FileText, Navigation, Crown, History, BarChart3, Menu, X, Shield, Zap, Inbox } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useUserSettings } from '@/lib/hooks/useAdminData';
import { createClient } from '@/lib/supabase/client';

// プラン定義（plans.tsと同期）
const PLAN_INFO: Record<string, { name: string; color: string }> = {
    free: { name: 'Free', color: 'text-gray-600' },
    starter: { name: 'Starter', color: 'text-blue-600' },
    pro: { name: 'Pro', color: 'text-purple-600' },
    enterprise: { name: 'Enterprise', color: 'text-amber-600' },
};

// ナビゲーションアイテムをコンポーネント外で定義（再生成防止）
const navItems = [
    { name: 'Pages', href: '/admin/pages', icon: FileText, prefetchUrl: '/api/pages' },
    { name: 'Media', href: '/admin/media', icon: Images, prefetchUrl: '/api/media' },
    { name: 'API Usage', href: '/admin/api-usage', icon: BarChart3, prefetchUrl: '/api/admin/stats?days=30' },
    { name: 'History', href: '/admin/import-history', icon: History, prefetchUrl: null },
    { name: 'Navigation', href: '/admin/navigation', icon: Navigation, prefetchUrl: '/api/config/navigation' },
    { name: 'Settings', href: '/admin/settings', icon: Settings, prefetchUrl: '/api/admin/settings' },
    { name: 'Users', href: '/admin/users', icon: Shield, prefetchUrl: null },
    { name: 'Waitingroom', href: '/admin/waitingroom', icon: Inbox, prefetchUrl: '/api/admin/waitingroom' },
] as const;

// データプリフェッチ用のキャッシュ
const prefetchCache = new Set<string>();

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [user, setUser] = useState<any>(null);
    const supabase = createClient();

    // ユーザー情報取得
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    }, []);

    // SWRでユーザー設定を取得（キャッシュ済み）
    const { data: userSettings } = useUserSettings();
    const plan = userSettings?.plan || 'normal';
    const username = user?.email?.split('@')[0] || 'User';
    const isAdmin = userSettings?.role === 'admin';

    // データプリフェッチ（ホバー時）
    const handleMouseEnter = useCallback((prefetchUrl: string | null) => {
        if (!prefetchUrl || prefetchCache.has(prefetchUrl)) return;

        // キャッシュに追加してからフェッチ
        prefetchCache.add(prefetchUrl);
        fetch(prefetchUrl).catch(() => {
            // エラー時はキャッシュから削除して再試行可能に
            prefetchCache.delete(prefetchUrl);
        });
    }, []);

    // Next.jsルートプリフェッチ
    const handleRouteMouseEnter = useCallback((href: string) => {
        router.prefetch(href);
    }, [router]);

    // ログアウト処理（メモ化）
    const handleLogout = useCallback(async () => {
        setIsLoggingOut(true);
        try {
            await supabase.auth.signOut();
            toast.success('ログアウトしました');
            router.push('/');
            router.refresh();
        } catch (error) {
            console.error('Logout error:', error);
            toast.error('ログアウトに失敗しました');
        } finally {
            setIsLoggingOut(false);
        }
    }, [router, supabase.auth]);

    // アクティブ状態の計算をメモ化
    const activeItem = useMemo(() => {
        return navItems.find(item => pathname.startsWith(item.href))?.href;
    }, [pathname]);

    // リンククリック時にモバイルメニューを閉じる
    const handleLinkClick = useCallback(() => {
        if (onClose) onClose();
    }, [onClose]);

    return (
        <>
            {/* モバイル用オーバーレイ */}
            {isOpen && onClose && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* サイドバー本体 */}
            <div className={clsx(
                "flex h-screen w-64 flex-col border-r border-border bg-background",
                "fixed lg:static z-50 transition-transform duration-300 ease-in-out",
                isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}>
                <div className="flex h-16 items-center justify-between px-6 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="h-6 w-6 bg-primary rounded-sm" />
                        <span className="text-lg font-bold tracking-tight text-foreground">LP Builder</span>
                    </div>
                    {/* モバイル用閉じるボタン */}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="lg:hidden p-2 rounded-md hover:bg-gray-100"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>

                <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto">
                    <div className="mb-4 px-3 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Menu</div>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeItem === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                prefetch={true}
                                onClick={handleLinkClick}
                                onMouseEnter={() => {
                                    handleRouteMouseEnter(item.href);
                                    handleMouseEnter(item.prefetchUrl);
                                }}
                                className={clsx(
                                    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200',
                                    isActive
                                        ? 'bg-primary/5 text-primary'
                                        : 'text-muted-foreground hover:bg-surface-100 hover:text-foreground'
                                )}
                            >
                                <Icon className={clsx(
                                    'h-4 w-4 transition-colors',
                                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                                )} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="border-t border-border p-4 space-y-3">
                    <div className="flex items-center gap-3 rounded-md border border-border bg-surface-50 p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
                            {username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="truncate text-xs font-bold text-foreground flex items-center gap-2">
                                {username}
                                {isAdmin && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded">
                                        <Shield className="h-2.5 w-2.5" />
                                        Admin
                                    </span>
                                )}
                            </div>
                            <div className={clsx(
                                "truncate text-[10px] font-medium flex items-center gap-1",
                                PLAN_INFO[plan]?.color || "text-muted-foreground"
                            )}>
                                <Crown className="h-3 w-3" />
                                {PLAN_INFO[plan]?.name || 'Free'}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
                    >
                        <LogOut className="h-4 w-4" />
                        {isLoggingOut ? 'ログアウト中...' : 'ログアウト'}
                    </button>
                </div>
            </div>
        </>
    );
}

// モバイル用ハンバーガーメニューボタン
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="lg:hidden fixed top-4 left-4 z-30 p-2 rounded-md bg-white shadow-md border border-gray-200 hover:bg-gray-50"
        >
            <Menu className="h-6 w-6" />
        </button>
    );
}
