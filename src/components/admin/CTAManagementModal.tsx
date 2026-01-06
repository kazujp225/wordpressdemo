'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MousePointer, Link2, Plus, Trash2, Check, ExternalLink, Mail, Phone, ArrowDown, FileText, Move, Maximize2 } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface ClickableArea {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    actionType: 'url' | 'email' | 'phone' | 'scroll' | 'form-input';
    actionValue: string;
    label?: string;
}

interface Section {
    id: string | number;
    role?: string;
    image?: { filePath: string };
    config?: {
        clickableAreas?: ClickableArea[];
    };
}

interface CTAManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    sections: Section[];
    globalCTAConfig: {
        defaultUrl: string;
        defaultLabel: string;
    };
    onApply: (updatedSections: Section[], globalConfig: { defaultUrl: string; defaultLabel: string }) => void;
}

const ACTION_TYPES = [
    { value: 'url', label: 'URL', icon: ExternalLink, description: '外部/内部リンク' },
    { value: 'email', label: 'メール', icon: Mail, description: 'メールアドレス' },
    { value: 'phone', label: '電話', icon: Phone, description: '電話番号' },
    { value: 'scroll', label: 'スクロール', icon: ArrowDown, description: 'ページ内移動' },
    { value: 'form-input', label: 'フォーム', icon: FileText, description: 'フォーム表示' },
] as const;

export default function CTAManagementModal({
    isOpen,
    onClose,
    sections,
    globalCTAConfig,
    onApply,
}: CTAManagementModalProps) {
    const [localSections, setLocalSections] = useState<Section[]>([]);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
    const [globalConfig, setGlobalConfig] = useState(globalCTAConfig);
    const [editingArea, setEditingArea] = useState<ClickableArea | null>(null);

    // ドラッグ&リサイズ用
    const [draggingArea, setDraggingArea] = useState<string | null>(null);
    const [resizingArea, setResizingArea] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState<{ x: number; y: number; areaX: number; areaY: number } | null>(null);
    const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const imageContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setLocalSections(JSON.parse(JSON.stringify(sections)));
            setGlobalConfig(globalCTAConfig);
            setSelectedSectionId(sections.length > 0 ? String(sections[0].id) : null);
        }
    }, [isOpen, sections, globalCTAConfig]);

    const selectedSection = localSections.find(s => String(s.id) === selectedSectionId);
    const clickableAreas = selectedSection?.config?.clickableAreas || [];

    const addClickableArea = () => {
        if (!selectedSectionId) return;

        const newArea: ClickableArea = {
            id: `cta-${Date.now()}`,
            x: 0.1,      // 10% from left (0-1 scale)
            y: 0.8,      // 80% from top (0-1 scale)
            width: 0.8,  // 80% width (0-1 scale)
            height: 0.1, // 10% height (0-1 scale)
            actionType: 'url',
            actionValue: globalConfig.defaultUrl || '#contact',
            label: globalConfig.defaultLabel || 'お問い合わせ',
        };

        setLocalSections(prev => prev.map(section => {
            if (String(section.id) === selectedSectionId) {
                return {
                    ...section,
                    config: {
                        ...section.config,
                        clickableAreas: [...(section.config?.clickableAreas || []), newArea]
                    }
                };
            }
            return section;
        }));

        setEditingArea(newArea);
        toast.success('CTAエリアを追加しました');
    };

    const updateClickableArea = (areaId: string, updates: Partial<ClickableArea>) => {
        setLocalSections(prev => prev.map(section => {
            if (String(section.id) === selectedSectionId) {
                return {
                    ...section,
                    config: {
                        ...section.config,
                        clickableAreas: (section.config?.clickableAreas || []).map(area =>
                            area.id === areaId ? { ...area, ...updates } : area
                        )
                    }
                };
            }
            return section;
        }));

        if (editingArea?.id === areaId) {
            setEditingArea(prev => prev ? { ...prev, ...updates } : null);
        }
    };

    const removeClickableArea = (areaId: string) => {
        setLocalSections(prev => prev.map(section => {
            if (String(section.id) === selectedSectionId) {
                return {
                    ...section,
                    config: {
                        ...section.config,
                        clickableAreas: (section.config?.clickableAreas || []).filter(area => area.id !== areaId)
                    }
                };
            }
            return section;
        }));

        if (editingArea?.id === areaId) {
            setEditingArea(null);
        }
        toast.success('CTAエリアを削除しました');
    };

    const handleApply = () => {
        onApply(localSections, globalConfig);
        toast.success('CTA設定を適用しました');
        onClose();
    };

    // ドラッグ開始
    const handleDragStart = useCallback((e: React.MouseEvent, areaId: string, area: ClickableArea) => {
        e.preventDefault();
        e.stopPropagation();
        setDraggingArea(areaId);
        setDragStart({
            x: e.clientX,
            y: e.clientY,
            areaX: area.x,
            areaY: area.y
        });
        setEditingArea(area);
    }, []);

    // リサイズ開始
    const handleResizeStart = useCallback((e: React.MouseEvent, areaId: string, area: ClickableArea) => {
        e.preventDefault();
        e.stopPropagation();
        setResizingArea(areaId);
        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            width: area.width,
            height: area.height
        });
        setEditingArea(area);
    }, []);

    // マウス移動
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!imageContainerRef.current) return;

        const rect = imageContainerRef.current.getBoundingClientRect();

        // ドラッグ中
        if (draggingArea && dragStart) {
            const deltaX = (e.clientX - dragStart.x) / rect.width;
            const deltaY = (e.clientY - dragStart.y) / rect.height;

            const area = clickableAreas.find(a => a.id === draggingArea);
            if (area) {
                const newX = Math.max(0, Math.min(1 - area.width, dragStart.areaX + deltaX));
                const newY = Math.max(0, Math.min(1 - area.height, dragStart.areaY + deltaY));
                updateClickableArea(draggingArea, { x: newX, y: newY });
            }
        }

        // リサイズ中
        if (resizingArea && resizeStart) {
            const deltaX = (e.clientX - resizeStart.x) / rect.width;
            const deltaY = (e.clientY - resizeStart.y) / rect.height;

            const area = clickableAreas.find(a => a.id === resizingArea);
            if (area) {
                const newWidth = Math.max(0.05, Math.min(1 - area.x, resizeStart.width + deltaX));
                const newHeight = Math.max(0.02, Math.min(1 - area.y, resizeStart.height + deltaY));
                updateClickableArea(resizingArea, { width: newWidth, height: newHeight });
            }
        }
    }, [draggingArea, dragStart, resizingArea, resizeStart, clickableAreas, updateClickableArea]);

    // マウスアップ
    const handleMouseUp = useCallback(() => {
        setDraggingArea(null);
        setResizingArea(null);
        setDragStart(null);
        setResizeStart(null);
    }, []);

    // グローバルマウスイベント
    useEffect(() => {
        if (draggingArea || resizingArea) {
            const handleGlobalMouseUp = () => handleMouseUp();
            window.addEventListener('mouseup', handleGlobalMouseUp);
            return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
        }
    }, [draggingArea, resizingArea, handleMouseUp]);

    const getTotalCTACount = () => {
        return localSections.reduce((total, section) => {
            return total + (section.config?.clickableAreas?.length || 0);
        }, 0);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-rose-50 to-pink-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg">
                            <MousePointer className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">CTA配置管理</h2>
                            <p className="text-xs text-gray-500">クリック領域とリンク先を設定 • {getTotalCTACount()}個のCTA</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {/* 左: セクション一覧 */}
                    <div className="w-48 border-r border-gray-100 overflow-y-auto">
                        <div className="p-3">
                            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">セクション</h3>
                            <div className="space-y-1">
                                {localSections.map((section, idx) => {
                                    const ctaCount = section.config?.clickableAreas?.length || 0;
                                    return (
                                        <button
                                            key={section.id}
                                            onClick={() => {
                                                setSelectedSectionId(String(section.id));
                                                setEditingArea(null);
                                            }}
                                            className={clsx(
                                                "w-full p-2 rounded-lg text-left transition-all",
                                                String(section.id) === selectedSectionId
                                                    ? "bg-rose-100 text-rose-700"
                                                    : "hover:bg-gray-100 text-gray-600"
                                            )}
                                        >
                                            <p className="text-xs font-medium truncate">
                                                {section.role || `Section ${idx + 1}`}
                                            </p>
                                            {ctaCount > 0 && (
                                                <span className="text-[10px] text-rose-500">
                                                    {ctaCount}個のCTA
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* 中央: プレビュー */}
                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                        {selectedSection?.image?.filePath ? (
                            <div
                                ref={imageContainerRef}
                                className="relative bg-white rounded-lg shadow overflow-hidden select-none"
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                            >
                                <img
                                    src={selectedSection.image.filePath}
                                    alt="Section preview"
                                    className="w-full pointer-events-none"
                                    draggable={false}
                                />
                                {/* CTAエリアオーバーレイ */}
                                {clickableAreas.map(area => (
                                    <div
                                        key={area.id}
                                        onClick={() => setEditingArea(area)}
                                        className={clsx(
                                            "absolute border-2 transition-colors",
                                            editingArea?.id === area.id
                                                ? "border-rose-500 bg-rose-500/30"
                                                : "border-rose-300 bg-rose-300/20 hover:bg-rose-400/30",
                                            draggingArea === area.id && "cursor-grabbing",
                                            resizingArea === area.id && "cursor-se-resize"
                                        )}
                                        style={{
                                            left: `${area.x * 100}%`,
                                            top: `${area.y * 100}%`,
                                            width: `${area.width * 100}%`,
                                            height: `${area.height * 100}%`,
                                        }}
                                    >
                                        {/* ラベル */}
                                        <div className="absolute -top-6 left-0 bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-t whitespace-nowrap pointer-events-none">
                                            {area.label || area.actionType}
                                        </div>
                                        {/* ドラッグハンドル (中央) */}
                                        <div
                                            onMouseDown={(e) => handleDragStart(e, area.id, area)}
                                            className="absolute inset-0 cursor-grab active:cursor-grabbing flex items-center justify-center"
                                        >
                                            <Move className="h-5 w-5 text-rose-600 opacity-60 pointer-events-none" />
                                        </div>
                                        {/* リサイズハンドル (右下) */}
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, area.id, area)}
                                            className="absolute -right-1 -bottom-1 w-4 h-4 bg-rose-500 rounded-sm cursor-se-resize flex items-center justify-center shadow"
                                        >
                                            <Maximize2 className="h-2.5 w-2.5 text-white pointer-events-none" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
                                <p className="text-gray-400">画像がありません</p>
                            </div>
                        )}

                        <button
                            onClick={addClickableArea}
                            className="mt-4 w-full py-2 border-2 border-dashed border-rose-300 rounded-lg text-rose-500 text-sm font-medium hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            CTAエリアを追加
                        </button>
                    </div>

                    {/* 右: 編集パネル */}
                    <div className="w-72 border-l border-gray-100 overflow-y-auto">
                        <div className="p-4">
                            {/* グローバル設定 */}
                            <div className="mb-6">
                                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">デフォルト設定</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-medium text-gray-600 mb-1 block">デフォルトURL</label>
                                        <input
                                            type="text"
                                            value={globalConfig.defaultUrl}
                                            onChange={(e) => setGlobalConfig(prev => ({ ...prev, defaultUrl: e.target.value }))}
                                            placeholder="#contact"
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-600 mb-1 block">デフォルトラベル</label>
                                        <input
                                            type="text"
                                            value={globalConfig.defaultLabel}
                                            onChange={(e) => setGlobalConfig(prev => ({ ...prev, defaultLabel: e.target.value }))}
                                            placeholder="お問い合わせ"
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 選択中のCTA編集 */}
                            {editingArea ? (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase">CTA編集</h3>
                                        <button
                                            onClick={() => removeClickableArea(editingArea.id)}
                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-medium text-gray-600 mb-1 block">ラベル</label>
                                            <input
                                                type="text"
                                                value={editingArea.label || ''}
                                                onChange={(e) => updateClickableArea(editingArea.id, { label: e.target.value })}
                                                placeholder="ボタンラベル"
                                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-medium text-gray-600 mb-1 block">アクションタイプ</label>
                                            <div className="grid grid-cols-2 gap-1">
                                                {ACTION_TYPES.map(type => (
                                                    <button
                                                        key={type.value}
                                                        onClick={() => updateClickableArea(editingArea.id, { actionType: type.value as any })}
                                                        className={clsx(
                                                            "p-2 rounded-lg border text-xs transition-all flex items-center gap-1",
                                                            editingArea.actionType === type.value
                                                                ? "border-rose-500 bg-rose-50 text-rose-700"
                                                                : "border-gray-200 hover:border-gray-300"
                                                        )}
                                                    >
                                                        <type.icon className="h-3 w-3" />
                                                        {type.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                                                {editingArea.actionType === 'url' && 'URL'}
                                                {editingArea.actionType === 'email' && 'メールアドレス'}
                                                {editingArea.actionType === 'phone' && '電話番号'}
                                                {editingArea.actionType === 'scroll' && 'スクロール先ID'}
                                                {editingArea.actionType === 'form-input' && 'フォームタイトル'}
                                            </label>
                                            <input
                                                type="text"
                                                value={editingArea.actionValue}
                                                onChange={(e) => updateClickableArea(editingArea.id, { actionValue: e.target.value })}
                                                placeholder={
                                                    editingArea.actionType === 'url' ? 'https://...'
                                                        : editingArea.actionType === 'email' ? 'example@email.com'
                                                            : editingArea.actionType === 'phone' ? '03-1234-5678'
                                                                : editingArea.actionType === 'scroll' ? '#section-id'
                                                                    : 'お問い合わせ'
                                                }
                                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs font-medium text-gray-600 mb-1 block">X位置 (%)</label>
                                                <input
                                                    type="number"
                                                    value={Math.round(editingArea.x * 100)}
                                                    onChange={(e) => updateClickableArea(editingArea.id, { x: Number(e.target.value) / 100 })}
                                                    min="0"
                                                    max="100"
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-gray-600 mb-1 block">Y位置 (%)</label>
                                                <input
                                                    type="number"
                                                    value={Math.round(editingArea.y * 100)}
                                                    onChange={(e) => updateClickableArea(editingArea.id, { y: Number(e.target.value) / 100 })}
                                                    min="0"
                                                    max="100"
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-gray-600 mb-1 block">幅 (%)</label>
                                                <input
                                                    type="number"
                                                    value={Math.round(editingArea.width * 100)}
                                                    onChange={(e) => updateClickableArea(editingArea.id, { width: Number(e.target.value) / 100 })}
                                                    min="1"
                                                    max="100"
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-gray-600 mb-1 block">高さ (%)</label>
                                                <input
                                                    type="number"
                                                    value={Math.round(editingArea.height * 100)}
                                                    onChange={(e) => updateClickableArea(editingArea.id, { height: Number(e.target.value) / 100 })}
                                                    min="1"
                                                    max="100"
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <MousePointer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-xs">CTAエリアを選択して編集</p>
                                    <div className="mt-4 text-[10px] space-y-1 text-gray-400/80">
                                        <p className="flex items-center justify-center gap-1">
                                            <Move className="h-3 w-3" /> ドラッグで移動
                                        </p>
                                        <p className="flex items-center justify-center gap-1">
                                            <Maximize2 className="h-3 w-3" /> 右下ハンドルでリサイズ
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
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
                        onClick={handleApply}
                        className="px-6 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-bold rounded-lg hover:from-rose-600 hover:to-pink-600 transition-all flex items-center gap-2"
                    >
                        <Check className="h-4 w-4" />
                        設定を適用
                    </button>
                </div>
            </div>
        </div>
    );
}
