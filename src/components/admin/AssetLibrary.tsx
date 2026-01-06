"use client";

import React, { useState, useCallback } from 'react';
import { Search, Loader2, Image, Film, Sparkles, Camera, X, Download, GripVertical } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Asset {
    id: string;
    type: 'lottie' | 'illustration' | 'icon' | 'photo';
    title: string;
    thumbnailUrl: string;
    downloadUrl: string;
    author?: string;
    source: string;
}

interface AssetLibraryProps {
    onAssetSelect: (asset: Asset, downloadedUrl: string) => void;
    onClose?: () => void;
}

const CATEGORIES = [
    { id: 'all', label: 'すべて', icon: Sparkles },
    { id: 'lottie', label: 'アニメ', icon: Film },
    { id: 'illustration', label: 'イラスト', icon: Image },
    { id: 'icon', label: 'アイコン', icon: Sparkles },
    { id: 'photo', label: '写真', icon: Camera },
] as const;

const SUGGESTED_SEARCHES = [
    'ビジネス', 'チーム', 'success', 'marketing', 'meeting',
    'growth', 'support', 'mobile', 'presentation'
];

export function AssetLibrary({ onAssetSelect, onClose }: AssetLibraryProps) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<string>('all');
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = useCallback(async (searchQuery?: string) => {
        const q = searchQuery || query;
        if (!q.trim()) return;

        setIsSearching(true);
        setHasSearched(true);

        try {
            const res = await fetch(`/api/assets/search?q=${encodeURIComponent(q)}&category=${category}`);
            const data = await res.json();

            if (data.error) {
                toast.error(data.error);
                return;
            }

            setAssets(data.assets || []);

            if (data.assets?.length === 0) {
                toast('素材が見つかりませんでした', { icon: '🔍' });
            }
        } catch (error) {
            toast.error('検索に失敗しました');
        } finally {
            setIsSearching(false);
        }
    }, [query, category]);

    const handleAssetClick = async (asset: Asset) => {
        setDownloadingId(asset.id);

        try {
            // 素材をダウンロードしてSupabaseに保存
            const res = await fetch('/api/assets/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: asset.downloadUrl,
                    type: asset.type,
                    title: asset.title
                })
            });

            const data = await res.json();

            if (data.error) {
                toast.error(data.error);
                return;
            }

            // 親コンポーネントに通知
            onAssetSelect(asset, data.url);
            toast.success('素材を追加しました！');

        } catch (error) {
            toast.error('素材の追加に失敗しました');
        } finally {
            setDownloadingId(null);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-900">素材ライブラリ</h3>
                {onClose && (
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* 検索バー */}
            <div className="p-3 border-b border-gray-100">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="素材を検索..."
                        className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
                    />
                </div>

                {/* おすすめ検索 */}
                {!hasSearched && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {SUGGESTED_SEARCHES.slice(0, 5).map(term => (
                            <button
                                key={term}
                                onClick={() => {
                                    setQuery(term);
                                    handleSearch(term);
                                }}
                                className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded-full hover:bg-violet-100 hover:text-violet-700 transition-colors"
                            >
                                {term}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* カテゴリタブ */}
            <div className="flex gap-1 p-2 border-b border-gray-100 overflow-x-auto">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => {
                            setCategory(cat.id);
                            if (query) handleSearch();
                        }}
                        className={clsx(
                            "flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg whitespace-nowrap transition-colors",
                            category === cat.id
                                ? "bg-violet-100 text-violet-700"
                                : "text-gray-500 hover:bg-gray-100"
                        )}
                    >
                        <cat.icon className="h-3 w-3" />
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* 素材グリッド */}
            <div className="flex-1 overflow-y-auto p-2">
                {isSearching ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 text-violet-500 animate-spin" />
                    </div>
                ) : assets.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                        {assets.map(asset => (
                            <div
                                key={asset.id}
                                onClick={() => handleAssetClick(asset)}
                                className={clsx(
                                    "relative group cursor-pointer rounded-lg overflow-hidden border border-gray-200 hover:border-violet-400 hover:shadow-md transition-all",
                                    downloadingId === asset.id && "opacity-50 pointer-events-none"
                                )}
                            >
                                {/* サムネイル */}
                                <div className="aspect-square bg-gray-50 flex items-center justify-center p-2">
                                    {asset.type === 'icon' ? (
                                        <img
                                            src={asset.thumbnailUrl}
                                            alt={asset.title}
                                            className="w-12 h-12 object-contain"
                                        />
                                    ) : (
                                        <img
                                            src={asset.thumbnailUrl}
                                            alt={asset.title}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/placeholder.png';
                                            }}
                                        />
                                    )}
                                </div>

                                {/* オーバーレイ */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                    {downloadingId === asset.id ? (
                                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                                    ) : (
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white px-2 py-1 rounded-full text-xs font-medium text-gray-700">
                                            <Download className="h-3 w-3" />
                                            追加
                                        </div>
                                    )}
                                </div>

                                {/* ソースバッジ */}
                                <div className="absolute top-1 right-1">
                                    <span className={clsx(
                                        "text-[8px] px-1.5 py-0.5 rounded font-medium",
                                        asset.type === 'lottie' && "bg-purple-100 text-purple-700",
                                        asset.type === 'illustration' && "bg-blue-100 text-blue-700",
                                        asset.type === 'icon' && "bg-green-100 text-green-700",
                                        asset.type === 'photo' && "bg-amber-100 text-amber-700"
                                    )}>
                                        {asset.source}
                                    </span>
                                </div>

                                {/* タイトル */}
                                <div className="p-1.5 bg-white">
                                    <p className="text-[10px] text-gray-600 truncate">{asset.title}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : hasSearched ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Search className="h-8 w-8 text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">素材が見つかりませんでした</p>
                        <p className="text-xs text-gray-400 mt-1">別のキーワードで検索してみてください</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Sparkles className="h-8 w-8 text-violet-300 mb-2" />
                        <p className="text-sm text-gray-500">素材を検索</p>
                        <p className="text-xs text-gray-400 mt-1">キーワードを入力して<br/>イラストやアイコンを探しましょう</p>
                    </div>
                )}
            </div>

            {/* フッター */}
            <div className="p-2 border-t border-gray-100 bg-gray-50">
                <p className="text-[9px] text-gray-400 text-center">
                    LottieFiles • unDraw • Iconify • Pexels
                </p>
            </div>
        </div>
    );
}
