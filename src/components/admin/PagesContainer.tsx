'use client';

import { useState } from 'react';
import { Plus, Star } from 'lucide-react';
import clsx from 'clsx';
import { PageCard } from './PageCard';
import type { PageListItem } from '@/types';
import { useUserSettings } from '@/lib/hooks/useAdminData';
import { isFreePlan as checkIsFreePlan } from '@/lib/plans';

interface PagesContainerProps {
    initialPages: PageListItem[];
    headerContent: React.ReactNode;
}

export function PagesContainer({ initialPages, headerContent }: PagesContainerProps) {
    const [pages, setPages] = useState<PageListItem[]>(initialPages);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const { data: userSettings } = useUserSettings();
    const isFreePlan = checkIsFreePlan(userSettings?.plan);
    const freeBannerEditsUsed = userSettings?.freeBannerEditsUsed ?? 0;
    const freeBannerEditLimit = userSettings?.freeBannerEditLimit ?? 0;
    const freeBannerEditsRemaining = freeBannerEditLimit - freeBannerEditsUsed;

    const handleDelete = (id: number) => {
        setPages((prev) => prev.filter((page) => page.id !== id));
    };

    const handleToggleFavorite = (id: number, isFavorite: boolean) => {
        setPages((prev) =>
            prev.map((page) => (page.id === id ? { ...page, isFavorite } : page))
        );
    };

    // Sort and filter pages
    const sortedPages = [...pages].sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) {
            return a.isFavorite ? -1 : 1;
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const displayPages = showFavoritesOnly
        ? sortedPages.filter((page) => page.isFavorite)
        : sortedPages;

    const favoriteCount = pages.filter((page) => page.isFavorite).length;

    return (
        <>
            <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-6 sm:pb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        <span>Pages</span>
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm font-medium">
                        <span>Manage your landing pages.</span>
                    </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <button
                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                        className={`flex items-center gap-2 rounded-md px-3 sm:px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.98] min-h-[44px] ${
                            showFavoritesOnly
                                ? 'bg-yellow-400 text-white shadow-sm hover:bg-yellow-500'
                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                    >
                        <Star className={`h-4 w-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                        <span>{showFavoritesOnly ? 'All' : 'Favorites'}</span>
                        {favoriteCount > 0 && !showFavoritesOnly && (
                            <span className="ml-1 rounded-full bg-yellow-400 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {favoriteCount}
                            </span>
                        )}
                    </button>
                    {headerContent}
                </div>
            </div>

            {/* Free Banner Edit Counter */}
            {isFreePlan && freeBannerEditLimit > 0 && (
                <div className={clsx(
                    'mb-6 p-4 rounded-lg border text-center',
                    freeBannerEditsRemaining > 0
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-red-50 border-red-200'
                )}>
                    {freeBannerEditsRemaining > 0 ? (
                        <p className="text-sm font-bold text-blue-900">
                            🎁 無料AI編集 残り <span className="text-xl font-extrabold">{freeBannerEditsRemaining}</span>/{freeBannerEditLimit} 回 ― バナーのAI編集を無料でお試しいただけます！
                        </p>
                    ) : (
                        <>
                            <p className="text-sm font-bold text-red-900">
                                無料AI編集（{freeBannerEditLimit}回）を使い切りました
                            </p>
                            <a href="/admin/settings" className="text-xs text-red-600 hover:underline mt-1 inline-block">
                                プランをアップグレードして引き続きAI編集 →
                            </a>
                        </>
                    )}
                </div>
            )}

            {displayPages.length === 0 ? (
                <div className="flex h-96 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-50/50">
                    <div className="mb-4 rounded-full bg-surface-100 p-4">
                        {showFavoritesOnly ? (
                            <Star className="h-8 w-8 text-muted-foreground" />
                        ) : (
                            <Plus className="h-8 w-8 text-muted-foreground" />
                        )}
                    </div>
                    <p className="font-bold text-muted-foreground text-lg">
                        <span>{showFavoritesOnly ? 'No favorite pages' : 'No pages yet'}</span>
                    </p>
                    <p className="text-muted-foreground text-sm mt-1">
                        <span>
                            {showFavoritesOnly
                                ? 'Star a page to add it to your favorites.'
                                : 'Create your first page from the button above.'}
                        </span>
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {displayPages.map((page) => (
                        <PageCard
                            key={page.id}
                            page={page}
                            onDelete={handleDelete}
                            onToggleFavorite={handleToggleFavorite}
                        />
                    ))}
                </div>
            )}
        </>
    );
}
