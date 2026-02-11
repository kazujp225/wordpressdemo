'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Image as ImageIcon, FolderOpen, Loader2, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { BannerCard } from './BannerCard';
import { BANNER_PLATFORMS } from '@/lib/banner-presets';
import type { BannerListItem, BannerPlatform } from '@/types/banner';
import { useUserSettings } from '@/lib/hooks/useAdminData';
import { getPlan } from '@/lib/plans';
import { UpgradeBanner } from './UpgradeBanner';

interface ImportItem {
    file: File;
    status: 'pending' | 'uploading' | 'creating' | 'success' | 'error';
    progress: string;
    error?: string;
    banner?: BannerListItem;
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('画像の読み込みに失敗しました'));
        };
        img.src = url;
    });
}

async function processWithConcurrency<T>(
    items: T[],
    fn: (item: T, index: number) => Promise<void>,
    limit: number
) {
    let active = 0;
    let nextIndex = 0;
    return new Promise<void>((resolve) => {
        function next() {
            while (active < limit && nextIndex < items.length) {
                const idx = nextIndex++;
                active++;
                fn(items[idx], idx).finally(() => {
                    active--;
                    if (nextIndex >= items.length && active === 0) resolve();
                    else next();
                });
            }
        }
        next();
    });
}

interface BannersContainerProps {
    initialBanners: BannerListItem[];
}

export function BannersContainer({ initialBanners }: BannersContainerProps) {
    const [banners, setBanners] = useState<BannerListItem[]>(initialBanners);
    const [platformFilter, setPlatformFilter] = useState<BannerPlatform | 'all'>('all');
    const [showPlatformMenu, setShowPlatformMenu] = useState(false);
    const { data: userSettings } = useUserSettings();
    const plan = getPlan(userSettings?.plan);
    const maxBanners = plan.limits.maxBanners;
    const isAtBannerLimit = maxBanners !== -1 && banners.length >= maxBanners;
    const [importItems, setImportItems] = useState<ImportItem[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const importFileInputRef = useRef<HTMLInputElement>(null);

    // Close platform dropdown on outside click
    useEffect(() => {
        if (!showPlatformMenu) return;
        const handler = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('[data-platform-menu]')) {
                setShowPlatformMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showPlatformMenu]);

    const updateImportItem = (index: number, updates: Partial<ImportItem>) => {
        setImportItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
    };

    const handleImportFiles = async (files: FileList) => {
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            toast.error('画像ファイルが選択されていません');
            return;
        }

        const items: ImportItem[] = imageFiles.map((file) => ({
            file,
            status: 'pending' as const,
            progress: '待機中...',
        }));

        setImportItems(items);
        setIsImporting(true);

        const newBanners: BannerListItem[] = [];

        await processWithConcurrency(
            imageFiles,
            async (file, index) => {
                try {
                    // 1. Get image dimensions
                    updateImportItem(index, { status: 'uploading', progress: 'アップロード中...' });
                    const { width, height } = await getImageDimensions(file);

                    // 2. Upload to /api/upload
                    const formData = new FormData();
                    formData.append('file', file);
                    const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                    if (!uploadRes.ok) {
                        const err = await uploadRes.json().catch(() => ({}));
                        throw new Error(err.error || 'アップロード失敗');
                    }
                    const media = await uploadRes.json();

                    // 3. Create banner via /api/banners
                    updateImportItem(index, { status: 'creating', progress: 'バナー作成中...' });
                    const title = file.name.replace(/\.[^.]+$/, '');
                    const bannerRes = await fetch('/api/banners', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title,
                            platform: 'custom',
                            width,
                            height,
                            imageId: media.id,
                            status: 'saved',
                        }),
                    });
                    if (!bannerRes.ok) {
                        const err = await bannerRes.json().catch(() => ({}));
                        throw new Error(err.error || 'バナー作成失敗');
                    }
                    const banner = await bannerRes.json();

                    const bannerListItem: BannerListItem = {
                        id: banner.id,
                        title: banner.title,
                        platform: banner.platform,
                        width: banner.width,
                        height: banner.height,
                        presetName: banner.presetName,
                        status: banner.status,
                        updatedAt: banner.updatedAt,
                        image: banner.image ? { filePath: banner.image.filePath } : null,
                    };
                    newBanners.push(bannerListItem);
                    updateImportItem(index, {
                        status: 'success',
                        progress: `${width} × ${height}px — 完了`,
                        banner: bannerListItem,
                    });
                } catch (err) {
                    updateImportItem(index, {
                        status: 'error',
                        progress: err instanceof Error ? err.message : 'エラーが発生しました',
                        error: err instanceof Error ? err.message : 'エラーが発生しました',
                    });
                }
            },
            3
        );

        // Add successful banners to state
        if (newBanners.length > 0) {
            setBanners((prev) => [...newBanners, ...prev]);
            toast.success(`${newBanners.length}件のバナーをインポートしました`);
        }

        setIsImporting(false);

        // Auto-close modal after 3s if all succeeded
        const hasErrors = imageFiles.length !== newBanners.length;
        if (!hasErrors) {
            setTimeout(() => setImportItems([]), 3000);
        }
    };

    const handleDelete = (id: number) => {
        setBanners((prev) => prev.filter((b) => b.id !== id));
    };

    const displayBanners = platformFilter === 'all'
        ? banners
        : banners.filter((b) => b.platform === platformFilter);

    return (
        <>
            <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-6 sm:pb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        Banners
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm font-medium">
                        広告バナーの作成・管理
                        {maxBanners !== -1 && (
                            <span className="ml-2 text-xs">
                                ({banners.length}/{maxBanners})
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* プラットフォームフィルター */}
                    <div className="relative" data-platform-menu>
                        <button
                            onClick={() => setShowPlatformMenu(!showPlatformMenu)}
                            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground min-h-[44px] hover:bg-surface-100 transition-colors"
                        >
                            {platformFilter === 'all'
                                ? 'All Platforms'
                                : BANNER_PLATFORMS.find(p => p.id === platformFilter)?.name || platformFilter}
                            <ChevronDown className={clsx('h-4 w-4 text-muted-foreground transition-transform', showPlatformMenu && 'rotate-180')} />
                        </button>
                        {showPlatformMenu && (
                            <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] rounded-lg border border-border bg-background shadow-lg py-1">
                                <button
                                    onClick={() => { setPlatformFilter('all'); setShowPlatformMenu(false); }}
                                    className={clsx(
                                        'w-full text-left px-3 py-2 text-sm transition-colors',
                                        platformFilter === 'all'
                                            ? 'bg-primary/10 text-primary font-bold'
                                            : 'text-foreground hover:bg-surface-100'
                                    )}
                                >
                                    All Platforms
                                </button>
                                {BANNER_PLATFORMS.filter(p => p.id !== 'custom').map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => { setPlatformFilter(p.id); setShowPlatformMenu(false); }}
                                        className={clsx(
                                            'w-full text-left px-3 py-2 text-sm transition-colors',
                                            platformFilter === p.id
                                                ? 'bg-primary/10 text-primary font-bold'
                                                : 'text-foreground hover:bg-surface-100'
                                        )}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => importFileInputRef.current?.click()}
                        disabled={isAtBannerLimit}
                        className={clsx(
                            "flex items-center gap-2 rounded-md bg-surface-100 text-foreground border border-border px-3 sm:px-4 py-2.5 text-sm font-bold transition-all min-h-[44px]",
                            isAtBannerLimit
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-surface-200 active:scale-[0.98]"
                        )}
                    >
                        <FolderOpen className="h-4 w-4" />
                        <span>インポート</span>
                    </button>
                    <input
                        ref={importFileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                handleImportFiles(e.target.files);
                            }
                            e.target.value = '';
                        }}
                    />

                    {isAtBannerLimit ? (
                        <span
                            className="flex items-center gap-2 rounded-md bg-primary/50 px-3 sm:px-4 py-2.5 text-sm font-bold text-primary-foreground cursor-not-allowed min-h-[44px]"
                            title={`バナー上限（${maxBanners}件）に達しています`}
                        >
                            <Plus className="h-4 w-4" />
                            <span>新規作成</span>
                        </span>
                    ) : (
                        <Link
                            href="/admin/banners/new"
                            className="flex items-center gap-2 rounded-md bg-primary px-3 sm:px-4 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] min-h-[44px]"
                        >
                            <Plus className="h-4 w-4" />
                            <span>新規作成</span>
                        </Link>
                    )}
                </div>
            </div>

            {isAtBannerLimit && (
                <UpgradeBanner feature={`バナー上限（${maxBanners}件）`} className="mb-6" />
            )}

            {displayBanners.length === 0 ? (
                <div className="flex h-96 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-50/50">
                    <div className="mb-4 rounded-full bg-surface-100 p-4">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-bold text-muted-foreground text-lg">
                        {platformFilter !== 'all' ? 'No banners for this platform' : 'No banners yet'}
                    </p>
                    <p className="text-muted-foreground text-sm mt-1">
                        Create your first banner from the button above.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {displayBanners.map((banner) => (
                        <BannerCard
                            key={banner.id}
                            banner={banner}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            {/* Import Modal */}
            {importItems.length > 0 && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[70vh] flex flex-col">
                        {/* Header */}
                        <div className="px-6 pt-6 pb-4 border-b border-border">
                            <div className="flex items-center gap-2">
                                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                                <h2 className="text-lg font-bold text-foreground">画像インポート</h2>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                {isImporting
                                    ? `${importItems.length}件の画像を処理中...`
                                    : `${importItems.filter((i) => i.status === 'success').length}/${importItems.length}件 完了`}
                            </p>
                        </div>

                        {/* File list */}
                        <div className="flex-1 overflow-y-auto px-6 py-3 divide-y divide-border">
                            {importItems.map((item, idx) => (
                                <div key={idx} className="py-3 flex items-start gap-3">
                                    <div className="mt-0.5">
                                        {item.status === 'success' && (
                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        )}
                                        {item.status === 'error' && (
                                            <XCircle className="h-5 w-5 text-red-500" />
                                        )}
                                        {(item.status === 'pending' || item.status === 'uploading' || item.status === 'creating') && (
                                            <Loader2 className="h-5 w-5 text-primary animate-spin" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-medium truncate ${item.status === 'error' ? 'text-red-600' : 'text-foreground'}`}>
                                            {item.file.name}
                                        </p>
                                        <p className={`text-xs mt-0.5 ${item.status === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}>
                                            {item.progress}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer with progress bar and close button */}
                        <div className="px-6 pb-6 pt-4 border-t border-border">
                            {/* Progress bar */}
                            <div className="mb-4">
                                <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all duration-300"
                                        style={{
                                            width: `${(importItems.filter((i) => i.status === 'success' || i.status === 'error').length / importItems.length) * 100}%`,
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1.5 text-right">
                                    {importItems.filter((i) => i.status === 'success' || i.status === 'error').length}/{importItems.length} 完了
                                </p>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    disabled={isImporting}
                                    onClick={() => setImportItems([])}
                                    className="rounded-md bg-surface-100 px-4 py-2 text-sm font-bold text-foreground transition-all hover:bg-surface-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px]"
                                >
                                    閉じる
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
