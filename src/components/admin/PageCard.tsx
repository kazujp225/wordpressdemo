'use client';

import Link from 'next/link';
import { useState, useRef } from 'react';
import { Copy, FileText, Star, Trash, Play, Pause } from 'lucide-react';
import clsx from 'clsx';
import type { PageListItem } from '@/types';
import { useApiMutation } from '@/hooks';

function isVideoFile(path: string | undefined): boolean {
    if (!path) return false;
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    return videoExtensions.some(ext => path.toLowerCase().endsWith(ext));
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

interface PageCardProps {
    page: PageListItem;
    onDelete: (id: number) => void;
    onToggleFavorite: (id: number, isFavorite: boolean) => void;
}

export function PageCard({ page, onDelete, onToggleFavorite }: PageCardProps) {
    const [isFavorite, setIsFavorite] = useState(page.isFavorite);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const deleteApi = useApiMutation();
    const favoriteApi = useApiMutation();

    const handleDelete = async () => {
        await deleteApi.execute({
            endpoint: `/api/pages/${page.id}`,
            method: 'DELETE',
            successMessage: 'ページを削除しました',
            errorMessage: '削除に失敗しました',
            onSuccess: () => {
                onDelete(page.id);
                setShowDeleteConfirm(false);
            },
        });
    };

    const handleToggleFavorite = async () => {
        const newFavoriteState = !isFavorite;
        await favoriteApi.execute({
            endpoint: `/api/pages/${page.id}`,
            method: 'PATCH',
            body: { isFavorite: newFavoriteState },
            showToast: false,
            onSuccess: () => {
                setIsFavorite(newFavoriteState);
                onToggleFavorite(page.id, newFavoriteState);
            },
        });
    };

    const thumbnailPath = page.sections?.[0]?.image?.filePath;
    const isVideo = isVideoFile(thumbnailPath);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const handleVideoToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    return (
        <div className="group overflow-hidden rounded-lg border border-border bg-background transition-all hover:border-primary/50">
            <div className="aspect-[16/10] overflow-hidden border-b border-border bg-surface-50 relative">
                {/* 動画以外の場合のみ全体クリックでリンク遷移 */}
                {!isVideo && (
                    <Link
                        href={`/admin/pages/${page.id}`}
                        className="absolute inset-0 flex items-center justify-center bg-foreground/5 transition-colors group-hover:bg-foreground/10 z-10"
                    >
                        <div className="opacity-0 transition-opacity group-hover:opacity-100 flex gap-2">
                            <span className="rounded-md bg-background px-4 py-2 text-xs font-bold text-foreground shadow-sm">
                                <span>Edit Page</span>
                            </span>
                        </div>
                    </Link>
                )}
                {/* 動画の場合は編集ボタンを別途表示 */}
                {isVideo && (
                    <Link
                        href={`/admin/pages/${page.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-2 right-2 z-20 rounded-md bg-background px-3 py-1.5 text-xs font-bold text-foreground shadow-sm hover:bg-primary hover:text-white transition-colors"
                    >
                        編集
                    </Link>
                )}
                <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleFavorite();
                        }}
                        disabled={favoriteApi.loading}
                        className={clsx(
                            'rounded-full p-2.5 sm:p-2 transition-all shadow-sm min-w-[40px] min-h-[40px] flex items-center justify-center',
                            isFavorite
                                ? 'bg-yellow-400 text-white hover:bg-yellow-500'
                                : 'bg-white/80 text-muted-foreground hover:bg-white hover:text-yellow-500'
                        )}
                        title={isFavorite ? 'お気に入り解除' : 'お気に入りに追加'}
                    >
                        <Star className={clsx('h-4 w-4', isFavorite && 'fill-current')} />
                    </button>
                </div>
                <div className="absolute top-4 right-4 z-20">
                    <span
                        className={clsx(
                            'rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-widest',
                            page.status === 'published'
                                ? 'bg-green-500 text-white'
                                : 'bg-muted text-muted-foreground'
                        )}
                    >
                        <span>{page.status === 'published' ? 'Published' : 'Draft'}</span>
                    </span>
                </div>
                {thumbnailPath ? (
                    isVideo ? (
                        <>
                            <video
                                ref={videoRef}
                                src={thumbnailPath}
                                className="h-full w-full object-cover object-top"
                                loop
                                muted
                                playsInline
                                onEnded={() => setIsPlaying(false)}
                            />
                            {/* 動画再生/停止ボタン */}
                            <button
                                onClick={handleVideoToggle}
                                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors z-10"
                            >
                                <div className="rounded-full bg-white/90 p-4 shadow-lg hover:bg-white transition-colors">
                                    {isPlaying ? (
                                        <Pause className="h-8 w-8 text-foreground" />
                                    ) : (
                                        <Play className="h-8 w-8 text-foreground ml-1" />
                                    )}
                                </div>
                            </button>
                        </>
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={thumbnailPath}
                            alt={page.title}
                            className="h-full w-full object-cover object-top"
                        />
                    )
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                        <FileText className="h-12 w-12" />
                    </div>
                )}
            </div>

            <div className="p-3 sm:p-5">
                <div className="flex items-start justify-between">
                    <div className="overflow-hidden pr-2">
                        <h3 className="truncate font-bold text-foreground leading-tight text-base">
                            <span>{page.title}</span>
                        </h3>
                        <p className="truncate text-xs text-muted-foreground mt-1 font-mono">
                            <span>/{page.slug}</span>
                        </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        <Link
                            href={`/p/${page.slug}`}
                            target="_blank"
                            className="rounded-md p-2 text-muted-foreground hover:bg-surface-100 hover:text-primary transition-colors"
                            title="View Published Page"
                        >
                            <Copy className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        <span>Updated: {formatDate(page.updatedAt)}</span>
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
