"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Images, Settings, LogOut, FileText, Crown, History, BarChart3, Menu, X, Shield, Zap, PlayCircle, Presentation, Sparkles, MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useUserSettings } from '@/lib/hooks/useAdminData';
import { createClient } from '@/lib/supabase/client';
import { PLANS, type PlanType } from '@/lib/plans';

// ナビゲーションアイテムをコンポーネント外で定義（再生成防止）
const navItems = [
    { name: 'ページ一覧', href: '/admin/pages', icon: FileText, prefetchUrl: '/api/pages', adminOnly: false },
    { name: 'バナー編集', href: '/admin/banners', icon: Presentation, prefetchUrl: '/api/banners', adminOnly: false },
    { name: 'メディア', href: '/admin/media', icon: Images, prefetchUrl: '/api/media', adminOnly: false },
    { name: 'API利用状況', href: '/admin/api-usage', icon: BarChart3, prefetchUrl: '/api/admin/stats?days=30', adminOnly: false },
    { name: '履歴', href: '/admin/import-history', icon: History, prefetchUrl: null, adminOnly: false },
    { name: '説明動画', href: '/admin/tutorials', icon: PlayCircle, prefetchUrl: null, adminOnly: false },
    { name: '設定', href: '/admin/settings', icon: Settings, prefetchUrl: '/api/admin/settings', adminOnly: false },
    { name: 'お問い合わせ', href: '/admin/inquiries', icon: MessageSquare, prefetchUrl: null, adminOnly: true },
    { name: 'ユーザー管理', href: '/admin/users', icon: Shield, prefetchUrl: null, adminOnly: true },
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
    const plan = userSettings?.plan || 'free';
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
                        <Image
                            src="/lp-builder-logo.png"
                            alt="Logo"
                            width={24}
                            height={24}
                            className="h-6 w-6 object-contain"
                        />
                        <span className="text-lg font-bold tracking-tight text-primary">オタスケ LP</span>
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
                    <div className="mb-4 px-3 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">メニュー</div>
                    {navItems
                        .filter((item) => !item.adminOnly || isAdmin)
                        .map((item) => {
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
                                    'group flex items-center gap-3 rounded-md px-3 py-2.5 min-h-[44px] text-sm font-medium transition-colors duration-200',
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

                {plan === 'free' && (
                    <div className="px-3 pb-4">
                        <Link
                            href="/admin/settings?tab=plan"
                            onClick={handleLinkClick}
                            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 px-3 py-2.5 text-sm font-bold text-blue-700 hover:from-blue-100 hover:to-purple-100 transition-colors"
                        >
                            <Sparkles className="h-4 w-4 text-blue-600" />
                            アップグレード
                        </Link>
                    </div>
                )}

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
                                        管理者
                                    </span>
                                )}
                            </div>
                            <div className={clsx(
                                "truncate text-[10px] font-medium flex items-center gap-1",
                                PLANS[plan as PlanType]?.colorClass || "text-muted-foreground"
                            )}>
                                <Crown className="h-3 w-3" />
                                {PLANS[plan as PlanType]?.name || 'Free'}
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
            className="lg:hidden fixed top-2 left-3 z-30 flex items-center justify-center w-11 h-11 rounded-lg bg-white shadow-md border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            aria-label="メニューを開く"
        >
            <Menu className="h-5 w-5" />
        </button>
    );
}
