'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Type, Link2, Palette, Move, GripVertical, MousePointer, Square, Circle, Sparkles, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface OverlayElement {
    id: string;
    type: 'button' | 'text' | 'icon';
    x: number; // percentage (0-100)
    y: number; // percentage (0-100)
    width: number; // percentage
    height: number; // pixels or auto
    content: string;
    style: {
        backgroundColor?: string;
        textColor?: string;
        borderRadius?: number;
        fontSize?: number;
        fontWeight?: string;
        padding?: string;
        border?: string;
        boxShadow?: string;
    };
    link?: {
        url: string;
        newTab: boolean;
    };
}

interface OverlayEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    sectionId: string;
    initialOverlays?: OverlayElement[];
    onSave: (overlays: OverlayElement[]) => void;
}

const PRESET_BUTTONS = [
    { name: '今すぐ購入', bg: '#6366f1', color: '#fff' },
    { name: 'お問い合わせ', bg: '#22c55e', color: '#fff' },
    { name: '詳しく見る', bg: '#3b82f6', color: '#fff' },
    { name: '無料で始める', bg: '#f59e0b', color: '#fff' },
    { name: '資料請求', bg: '#ec4899', color: '#fff' },
    { name: '申し込む', bg: '#ef4444', color: '#fff' },
];

export default function OverlayEditorModal({
    isOpen,
    onClose,
    imageUrl,
    sectionId,
    initialOverlays = [],
    onSave
}: OverlayEditorModalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [overlays, setOverlays] = useState<OverlayElement[]>(initialOverlays);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // 選択中のオーバーレイ
    const selectedOverlay = overlays.find(o => o.id === selectedId);

    // オーバーレイを追加
    const addOverlay = (preset?: typeof PRESET_BUTTONS[0]) => {
        const newOverlay: OverlayElement = {
            id: `overlay-${Date.now()}`,
            type: 'button',
            x: 50,
            y: 80,
            width: 30,
            height: 48,
            content: preset?.name || 'ボタン',
            style: {
                backgroundColor: preset?.bg || '#6366f1',
                textColor: preset?.color || '#ffffff',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 'bold',
                padding: '12px 24px',
            },
        };
        setOverlays(prev => [...prev, newOverlay]);
        setSelectedId(newOverlay.id);
    };

    // オーバーレイを削除
    const deleteOverlay = (id: string) => {
        setOverlays(prev => prev.filter(o => o.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    // オーバーレイを更新
    const updateOverlay = (id: string, updates: Partial<OverlayElement>) => {
        setOverlays(prev => prev.map(o =>
            o.id === id ? { ...o, ...updates } : o
        ));
    };

    // スタイルを更新
    const updateStyle = (id: string, styleUpdates: Partial<OverlayElement['style']>) => {
        setOverlays(prev => prev.map(o =>
            o.id === id ? { ...o, style: { ...o.style, ...styleUpdates } } : o
        ));
    };

    // ドラッグ開始
    const handleMouseDown = (e: React.MouseEvent, overlayId: string) => {
        e.preventDefault();
        e.stopPropagation();

        const overlay = overlays.find(o => o.id === overlayId);
        if (!overlay || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const currentX = (overlay.x / 100) * rect.width;
        const currentY = (overlay.y / 100) * rect.height;

        setDragOffset({
            x: e.clientX - rect.left - currentX,
            y: e.clientY - rect.top - currentY
        });
        setSelectedId(overlayId);
        setIsDragging(true);
    };

    // ドラッグ中
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !selectedId || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
        const y = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;

        updateOverlay(selectedId, {
            x: Math.max(0, Math.min(100, x)),
            y: Math.max(0, Math.min(100, y))
        });
    }, [isDragging, selectedId, dragOffset]);

    // ドラッグ終了
    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // 保存
    const handleSave = () => {
        onSave(overlays);
        toast.success('オーバーレイを保存しました');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-purple-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
                            <MousePointer className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">オーバーレイエディター</h2>
                            <p className="text-xs text-gray-500">ボタンやテキストを画像の上に配置</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {/* 左: プレビュー */}
                    <div className="flex-1 p-6 bg-gray-900 flex items-center justify-center overflow-auto">
                        <div
                            ref={containerRef}
                            className="relative max-w-2xl w-full"
                            style={{ cursor: isDragging ? 'grabbing' : 'default' }}
                        >
                            <img
                                src={imageUrl}
                                alt="Section"
                                className="w-full h-auto"
                                draggable={false}
                            />

                            {/* オーバーレイ要素 */}
                            {overlays.map(overlay => (
                                <div
                                    key={overlay.id}
                                    className={clsx(
                                        "absolute cursor-grab active:cursor-grabbing transition-shadow",
                                        selectedId === overlay.id && "ring-2 ring-violet-500 ring-offset-2"
                                    )}
                                    style={{
                                        left: `${overlay.x}%`,
                                        top: `${overlay.y}%`,
                                        transform: 'translate(-50%, -50%)',
                                        backgroundColor: overlay.style.backgroundColor,
                                        color: overlay.style.textColor,
                                        borderRadius: overlay.style.borderRadius,
                                        fontSize: overlay.style.fontSize,
                                        fontWeight: overlay.style.fontWeight,
                                        padding: overlay.style.padding,
                                        border: overlay.style.border,
                                        boxShadow: overlay.style.boxShadow || '0 4px 12px rgba(0,0,0,0.15)',
                                        whiteSpace: 'nowrap',
                                    }}
                                    onMouseDown={(e) => handleMouseDown(e, overlay.id)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedId(overlay.id);
                                    }}
                                >
                                    {overlay.content}

                                    {/* 削除ボタン */}
                                    {selectedId === overlay.id && (
                                        <button
                                            className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteOverlay(overlay.id);
                                            }}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            ))}

                            {/* クリックで選択解除 */}
                            <div
                                className="absolute inset-0"
                                onClick={() => setSelectedId(null)}
                                style={{ pointerEvents: overlays.length > 0 ? 'auto' : 'none', zIndex: -1 }}
                            />
                        </div>
                    </div>

                    {/* 右: 設定パネル */}
                    <div className="w-80 bg-gray-50 flex flex-col overflow-hidden">
                        {/* プリセットボタン */}
                        <div className="p-4 border-b border-gray-200">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">ボタンを追加</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {PRESET_BUTTONS.map((preset, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => addOverlay(preset)}
                                        className="px-3 py-2 text-xs font-bold rounded-lg transition-all hover:scale-105"
                                        style={{ backgroundColor: preset.bg, color: preset.color }}
                                    >
                                        {preset.name}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => addOverlay()}
                                className="w-full mt-2 px-3 py-2 text-xs font-medium border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-violet-400 hover:text-violet-600 transition-colors flex items-center justify-center gap-1"
                            >
                                <Plus className="h-3 w-3" />
                                カスタムボタン
                            </button>
                        </div>

                        {/* 選択中の要素の設定 */}
                        {selectedOverlay ? (
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <h3 className="text-sm font-bold text-gray-900">要素を編集</h3>

                                {/* テキスト */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">テキスト</label>
                                    <input
                                        type="text"
                                        value={selectedOverlay.content}
                                        onChange={(e) => updateOverlay(selectedId!, { content: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-300 focus:border-transparent"
                                    />
                                </div>

                                {/* 背景色 */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">背景色</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={selectedOverlay.style.backgroundColor || '#6366f1'}
                                            onChange={(e) => updateStyle(selectedId!, { backgroundColor: e.target.value })}
                                            className="w-10 h-10 rounded-lg cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={selectedOverlay.style.backgroundColor || '#6366f1'}
                                            onChange={(e) => updateStyle(selectedId!, { backgroundColor: e.target.value })}
                                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono"
                                        />
                                    </div>
                                </div>

                                {/* 文字色 */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">文字色</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={selectedOverlay.style.textColor || '#ffffff'}
                                            onChange={(e) => updateStyle(selectedId!, { textColor: e.target.value })}
                                            className="w-10 h-10 rounded-lg cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={selectedOverlay.style.textColor || '#ffffff'}
                                            onChange={(e) => updateStyle(selectedId!, { textColor: e.target.value })}
                                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono"
                                        />
                                    </div>
                                </div>

                                {/* フォントサイズ */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        フォントサイズ: {selectedOverlay.style.fontSize}px
                                    </label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="32"
                                        value={selectedOverlay.style.fontSize || 16}
                                        onChange={(e) => updateStyle(selectedId!, { fontSize: parseInt(e.target.value) })}
                                        className="w-full"
                                    />
                                </div>

                                {/* 角丸 */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        角丸: {selectedOverlay.style.borderRadius}px
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="32"
                                        value={selectedOverlay.style.borderRadius || 8}
                                        onChange={(e) => updateStyle(selectedId!, { borderRadius: parseInt(e.target.value) })}
                                        className="w-full"
                                    />
                                </div>

                                {/* リンク */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        <Link2 className="h-3 w-3 inline mr-1" />
                                        リンクURL
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedOverlay.link?.url || ''}
                                        onChange={(e) => updateOverlay(selectedId!, {
                                            link: { url: e.target.value, newTab: selectedOverlay.link?.newTab || true }
                                        })}
                                        placeholder="https://..."
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-300 focus:border-transparent"
                                    />
                                    <label className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                                        <input
                                            type="checkbox"
                                            checked={selectedOverlay.link?.newTab ?? true}
                                            onChange={(e) => updateOverlay(selectedId!, {
                                                link: { url: selectedOverlay.link?.url || '', newTab: e.target.checked }
                                            })}
                                            className="rounded"
                                        />
                                        新しいタブで開く
                                    </label>
                                </div>

                                {/* 位置 */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">X位置 (%)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={Math.round(selectedOverlay.x)}
                                            onChange={(e) => updateOverlay(selectedId!, { x: parseFloat(e.target.value) })}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Y位置 (%)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={Math.round(selectedOverlay.y)}
                                            onChange={(e) => updateOverlay(selectedId!, { y: parseFloat(e.target.value) })}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                                        />
                                    </div>
                                </div>

                                {/* 削除ボタン */}
                                <button
                                    onClick={() => deleteOverlay(selectedId!)}
                                    className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    この要素を削除
                                </button>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center p-4">
                                <p className="text-sm text-gray-400 text-center">
                                    ボタンを追加するか、<br />既存の要素をクリックして編集
                                </p>
                            </div>
                        )}

                        {/* オーバーレイ一覧 */}
                        {overlays.length > 0 && (
                            <div className="p-4 border-t border-gray-200">
                                <h4 className="text-xs font-bold text-gray-500 mb-2">配置済み ({overlays.length})</h4>
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {overlays.map(overlay => (
                                        <div
                                            key={overlay.id}
                                            onClick={() => setSelectedId(overlay.id)}
                                            className={clsx(
                                                "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                                                selectedId === overlay.id
                                                    ? "bg-violet-100 text-violet-700"
                                                    : "hover:bg-gray-100 text-gray-600"
                                            )}
                                        >
                                            <div
                                                className="w-4 h-4 rounded"
                                                style={{ backgroundColor: overlay.style.backgroundColor }}
                                            />
                                            <span className="text-xs truncate flex-1">{overlay.content}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteOverlay(overlay.id);
                                                }}
                                                className="p-1 hover:bg-red-100 rounded"
                                            >
                                                <X className="h-3 w-3 text-red-500" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-bold rounded-lg hover:from-violet-600 hover:to-purple-600 transition-all"
                    >
                        保存
                    </button>
                </div>
            </div>
        </div>
    );
}
