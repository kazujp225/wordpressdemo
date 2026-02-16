'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Image as ImageIcon, FolderOpen, Loader2, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ThumbnailCard } from './ThumbnailCard';
import { THUMBNAIL_CATEGORIES } from '@/lib/thumbnail-presets';
import type { ThumbnailListItem, ThumbnailCategory } from '@/types/thumbnail';

interface ImportItem {
    file: File;
    status: 'pending' | 'uploading' | 'creating' | 'success' | 'error';
    progress: string;
    error?: string;
    thumbnail?: ThumbnailListItem;
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

interface ThumbnailsContainerProps {
    initialThumbnails: ThumbnailListItem[];
}

export function ThumbnailsContainer({ initialThumbnails }: ThumbnailsContainerProps) {
    const [thumbnails, setThumbnails] = useState<ThumbnailListItem[]>(initialThumbnails);
    const [categoryFilter, setCategoryFilter] = useState<ThumbnailCategory | 'all'>('all');
    const [showCategoryMenu, setShowCategoryMenu] = useState(false);
    const [importItems, setImportItems] = useState<ImportItem[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const importFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!showCategoryMenu) return;
        const handler = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('[data-category-menu]')) {
                setShowCategoryMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showCategoryMenu]);

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

        const newThumbnails: ThumbnailListItem[] = [];

        await processWithConcurrency(
            imageFiles,
            async (file, index) => {
                try {
                    updateImportItem(index, { status: 'uploading', progress: 'アップロード中...' });
                    const { width, height } = await getImageDimensions(file);

                    const formData = new FormData();
                    formData.append('file', file);
                    const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                    if (!uploadRes.ok) {
                        const err = await uploadRes.json().catch(() => ({}));
                        throw new Error(err.error || 'アップロード失敗');
                    }
                    const media = await uploadRes.json();

                    updateImportItem(index, { status: 'creating', progress: 'サムネイル作成中...' });
                    const title = file.name.replace(/\.[^.]+$/, '');
                    const thumbnailRes = await fetch('/api/thumbnails', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title,
                            category: 'custom',
                            width,
                            height,
                            imageId: media.id,
                            status: 'saved',
                        }),
                    });
                    if (!thumbnailRes.ok) {
                        const err = await thumbnailRes.json().catch(() => ({}));
                        throw new Error(err.error || 'サムネイル作成失敗');
                    }
                    const thumbnail = await thumbnailRes.json();

                    const thumbnailListItem: ThumbnailListItem = {
                        id: thumbnail.id,
                        title: thumbnail.title,
                        category: thumbnail.category,
                        width: thumbnail.width,
                        height: thumbnail.height,
                        presetName: thumbnail.presetName,
                        status: thumbnail.status,
                        updatedAt: thumbnail.updatedAt,
                        image: thumbnail.image ? { filePath: thumbnail.image.filePath } : null,
                    };
                    newThumbnails.push(thumbnailListItem);
                    updateImportItem(index, {
                        status: 'success',
                        progress: `${width} × ${height}px — 完了`,
                        thumbnail: thumbnailListItem,
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

        if (newThumbnails.length > 0) {
            setThumbnails((prev) => [...newThumbnails, ...prev]);
            toast.success(`${newThumbnails.length}件のサムネイルをインポートしました`);
        }

        setIsImporting(false);

        const hasErrors = imageFiles.length !== newThumbnails.length;
        if (!hasErrors) {
            setTimeout(() => setImportItems([]), 3000);
        }
    };

    const handleDelete = (id: number) => {
        setThumbnails((prev) => prev.filter((t) => t.id !== id));
    };

    const displayThumbnails = categoryFilter === 'all'
        ? thumbnails
        : thumbnails.filter((t) => t.category === categoryFilter);

    return (
        <>
            <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-6 sm:pb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        Thumbnails
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm font-medium">
                        サムネイル画像の作成・管理
                    </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* カテゴリフィルター */}
                    <div className="relative" data-category-menu>
                        <button
                            onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground min-h-[44px] hover:bg-surface-100 transition-colors"
                        >
                            {categoryFilter === 'all'
                                ? 'すべて'
                                : THUMBNAIL_CATEGORIES.find(c => c.id === categoryFilter)?.name || categoryFilter}
                            <ChevronDown className={clsx('h-4 w-4 text-muted-foreground transition-transform', showCategoryMenu && 'rotate-180')} />
                        </button>
                        {showCategoryMenu && (
                            <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] rounded-lg border border-border bg-background shadow-lg py-1">
                                <button
                                    onClick={() => { setCategoryFilter('all'); setShowCategoryMenu(false); }}
                                    className={clsx(
                                        'w-full text-left px-3 py-2 text-sm transition-colors',
                                        categoryFilter === 'all'
                                            ? 'bg-primary/10 text-primary font-bold'
                                            : 'text-foreground hover:bg-surface-100'
                                    )}
                                >
                                    すべて
                                </button>
                                {THUMBNAIL_CATEGORIES.filter(c => c.id !== 'custom').map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => { setCategoryFilter(c.id); setShowCategoryMenu(false); }}
                                        className={clsx(
                                            'w-full text-left px-3 py-2 text-sm transition-colors',
                                            categoryFilter === c.id
                                                ? 'bg-primary/10 text-primary font-bold'
                                                : 'text-foreground hover:bg-surface-100'
                                        )}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => importFileInputRef.current?.click()}
                        className="flex items-center gap-2 rounded-md bg-surface-100 text-foreground border border-border px-3 sm:px-4 py-2.5 text-sm font-bold transition-all min-h-[44px] hover:bg-surface-200 active:scale-[0.98]"
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

                    <Link
                        href="/admin/thumbnails/new"
                        className="flex items-center gap-2 rounded-md bg-primary px-3 sm:px-4 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] min-h-[44px]"
                    >
                        <Plus className="h-4 w-4" />
                        <span>新規作成</span>
                    </Link>
                </div>
            </div>

            {displayThumbnails.length === 0 ? (
                <div className="flex h-96 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-50/50">
                    <div className="mb-4 rounded-full bg-surface-100 p-4">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-bold text-muted-foreground text-lg">
                        {categoryFilter !== 'all' ? 'このカテゴリにサムネイルがありません' : 'サムネイルがまだありません'}
                    </p>
                    <p className="text-muted-foreground text-sm mt-1">
                        上のボタンから最初のサムネイルを作成してください
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {displayThumbnails.map((thumbnail) => (
                        <ThumbnailCard
                            key={thumbnail.id}
                            thumbnail={thumbnail}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            {/* Import Modal */}
            {importItems.length > 0 && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[70vh] flex flex-col">
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

                        <div className="flex-1 overflow-y-auto px-6 py-3 divide-y divide-border">
                            {importItems.map((item, idx) => (
                                <div key={idx} className="py-3 flex items-start gap-3">
                                    <div className="mt-0.5">
                                        {item.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                        {item.status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
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

                        <div className="px-6 pb-6 pt-4 border-t border-border">
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
