'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Trash, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';
import type { BannerListItem } from '@/types/banner';
import { useApiMutation } from '@/hooks';
import { BANNER_PLATFORMS } from '@/lib/banner-presets';

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

interface BannerCardProps {
    banner: BannerListItem;
    onDelete: (id: number) => void;
}

export function BannerCard({ banner, onDelete }: BannerCardProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const deleteApi = useApiMutation();

    const handleDelete = async () => {
        await deleteApi.execute({
            endpoint: `/api/banners/${banner.id}`,
            method: 'DELETE',
            successMessage: 'バナーを削除しました',
            errorMessage: '削除に失敗しました',
            onSuccess: () => {
                onDelete(banner.id);
                setShowDeleteConfirm(false);
            },
        });
    };

    const platformConfig = BANNER_PLATFORMS.find((p) => p.id === banner.platform);
    const thumbnailPath = banner.image?.filePath;

    return (
        <div className="group overflow-hidden rounded-lg border border-border bg-background transition-all hover:border-primary/50">
            <div className="aspect-[16/10] overflow-hidden border-b border-border bg-surface-50 relative">
                <Link
                    href={`/admin/banners/${banner.id}`}
                    className="absolute inset-0 flex items-center justify-center bg-foreground/5 transition-colors group-hover:bg-foreground/10 z-10"
                >
                    <div className="opacity-0 transition-opacity group-hover:opacity-100 flex gap-2">
                        <span className="rounded-md bg-background px-4 py-2 text-xs font-bold text-foreground shadow-sm">
                            Edit Banner
                        </span>
                    </div>
                </Link>
                {/* プラットフォームバッジ */}
                <div className="absolute top-2 left-2 z-20">
                    <span className="rounded-sm bg-primary/90 px-2 py-1 text-[10px] font-bold text-white">
                        {platformConfig?.shortName || banner.platform}
                    </span>
                </div>
                {/* サイズバッジ */}
                <div className="absolute top-2 right-2 z-20">
                    <span className={clsx(
                        'rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-widest',
                        banner.status === 'saved'
                            ? 'bg-green-500 text-white'
                            : banner.status === 'generated'
                            ? 'bg-blue-500 text-white'
                            : 'bg-muted text-muted-foreground'
                    )}>
                        {banner.status === 'saved' ? 'Saved' : banner.status === 'generated' ? 'Generated' : 'Draft'}
                    </span>
                </div>
                {thumbnailPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={thumbnailPath}
                        alt={banner.title}
                        className="h-full w-full object-contain bg-gray-100"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                        <ImageIcon className="h-12 w-12" />
                    </div>
                )}
            </div>

            <div className="p-3 sm:p-5">
                <div className="overflow-hidden">
                    <h3 className="truncate font-bold text-foreground leading-tight text-base">
                        {banner.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {banner.width} × {banner.height}px
                        {banner.presetName && (
                            <span className="ml-2 text-muted-foreground/70">({banner.presetName})</span>
                        )}
                    </p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Updated: {formatDate(banner.updatedAt)}
                    </span>
                    {showDeleteConfirm ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleteApi.loading}
                                className="text-xs text-red-500 font-bold hover:text-red-600"
                            >
                                {deleteApi.loading ? '削除中...' : '削除する'}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="text-muted-foreground hover:text-red-500 transition-colors"
                            title="削除"
                        >
                            <Trash className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
