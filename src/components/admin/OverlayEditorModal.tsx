'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Link2, MousePointer, ExternalLink, Hash, MessageCircle, RefreshCw, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { CTA_TEMPLATES, CTA_CATEGORIES, getTemplateStyle, type CTACategory } from '@/lib/cta-templates';

// future: animation variants
// future: line_primary_url from workspace settings

interface OverlayAction {
    type: 'external' | 'anchor' | 'line';
    url: string;
}

interface OverlayElement {
    id: string;
    type: 'button' | 'text' | 'icon';
    x: number; // percentage (0-100)
    y: number; // percentage (0-100)
    width: number; // percentage
    height: number; // pixels or auto
    content: string;
    template?: string; // template ID
    action?: OverlayAction;
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

const ACTION_TYPES = [
    { value: 'external' as const, label: '外部URL', icon: ExternalLink, description: '外部/内部リンク' },
    { value: 'anchor' as const, label: 'ページ内', icon: Hash, description: 'ページ内スクロール' },
    { value: 'line' as const, label: 'LINE', icon: MessageCircle, description: 'LINE誘導' },
];

// Icon components
const LineIcon = ({ className = "h-4 w-4 mr-1.5 inline-block" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
);

const TemplateIcon = ({ icon, className = "h-4 w-4 mr-1.5 inline-block" }: { icon?: string; className?: string }) => {
    if (icon === 'line') return <LineIcon className={className} />;
    if (icon === 'phone') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>;
    if (icon === 'mail') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>;
    return null;
};

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
    const [categoryFilter, setCategoryFilter] = useState<CTACategory | 'all'>('all');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        template: true,
        action: false,
        size: false,
        style: false,
        position: false,
    });

    const toggleSection = (key: string) => {
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const selectedOverlay = overlays.find(o => o.id === selectedId);

    // テンプレートからオーバーレイを追加
    const addFromTemplate = (templateId: string) => {
        const template = CTA_TEMPLATES[templateId];
        if (!template) return;

        const newOverlay: OverlayElement = {
            id: `overlay-${Date.now()}`,
            type: 'button',
            x: 50,
            y: 80,
            width: 30,
            height: 48,
            content: template.label,
            template: templateId,
            action: template.icon === 'line'
                ? { type: 'line', url: '' }
                : { type: 'external', url: '' },
            style: {
                backgroundColor: template.background,
                textColor: template.color,
                borderRadius: parseInt(template.borderRadius) || 8,
                fontSize: template.fontSize,
                fontWeight: template.fontWeight,
                padding: template.padding,
                border: template.border,
            },
        };
        setOverlays(prev => [...prev, newOverlay]);
        setSelectedId(newOverlay.id);
    };

    // カスタムボタン追加（テンプレートなし）
    const addCustom = () => {
        const newOverlay: OverlayElement = {
            id: `overlay-${Date.now()}`,
            type: 'button',
            x: 50,
            y: 80,
            width: 30,
            height: 48,
            content: 'ボタン',
            action: { type: 'external', url: '' },
            style: {
                backgroundColor: '#6366f1',
                textColor: '#ffffff',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 'bold',
                padding: '12px 24px',
            },
        };
        setOverlays(prev => [...prev, newOverlay]);
        setSelectedId(newOverlay.id);
    };

    const deleteOverlay = (id: string) => {
        setOverlays(prev => prev.filter(o => o.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    const updateOverlay = (id: string, updates: Partial<OverlayElement>) => {
        setOverlays(prev => prev.map(o =>
            o.id === id ? { ...o, ...updates } : o
        ));
    };

    const updateStyle = (id: string, styleUpdates: Partial<OverlayElement['style']>) => {
        setOverlays(prev => prev.map(o =>
            o.id === id ? { ...o, style: { ...o.style, ...styleUpdates } } : o
        ));
    };

    const updateAction = (id: string, actionUpdates: Partial<OverlayAction>) => {
        setOverlays(prev => prev.map(o => {
            if (o.id !== id) return o;
            return {
                ...o,
                action: { ...(o.action || { type: 'external', url: '' }), ...actionUpdates }
            };
        }));
    };

    // テンプレート変更
    const changeTemplate = (id: string, templateId: string) => {
        const template = CTA_TEMPLATES[templateId];
        if (!template) return;

        setOverlays(prev => prev.map(o => {
            if (o.id !== id) return o;
            return {
                ...o,
                template: templateId,
                style: {
                    backgroundColor: template.background,
                    textColor: template.color,
                    borderRadius: parseInt(template.borderRadius) || 8,
                    fontSize: template.fontSize,
                    fontWeight: template.fontWeight,
                    padding: template.padding,
                    border: template.border,
                },
                action: template.icon === 'line'
                    ? { type: 'line' as const, url: o.action?.url || '' }
                    : o.action,
            };
        }));
    };

    // ドラッグ
    const handleMouseDown = (e: React.MouseEvent, overlayId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const overlay = overlays.find(o => o.id === overlayId);
        if (!overlay || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const currentX = (overlay.x / 100) * rect.width;
        const currentY = (overlay.y / 100) * rect.height;
        setDragOffset({ x: e.clientX - rect.left - currentX, y: e.clientY - rect.top - currentY });
        setSelectedId(overlayId);
        setIsDragging(true);
    };

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

    const handleSave = () => {
        onSave(overlays);
        toast.success('CTAを保存しました');
        onClose();
    };

    // テンプレートからスタイルを取得（ユーザーのサイズ変更を上書き適用）
    const getOverlayStyle = (overlay: OverlayElement): React.CSSProperties => {
        if (overlay.template && CTA_TEMPLATES[overlay.template]) {
            const baseStyle = getTemplateStyle(overlay.template);
            return {
                ...baseStyle,
                fontSize: overlay.style.fontSize ?? baseStyle.fontSize,
                borderRadius: overlay.style.borderRadius ?? baseStyle.borderRadius,
                padding: overlay.style.padding ?? baseStyle.padding,
            };
        }
        // カスタムスタイル（テンプレートなし）
        return {
            backgroundColor: overlay.style.backgroundColor,
            color: overlay.style.textColor,
            borderRadius: overlay.style.borderRadius,
            fontSize: overlay.style.fontSize,
            fontWeight: overlay.style.fontWeight,
            padding: overlay.style.padding,
            border: overlay.style.border,
            boxShadow: overlay.style.boxShadow || '0 4px 12px rgba(0,0,0,0.15)',
            whiteSpace: 'nowrap',
        };
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-lg">
                            <MousePointer className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">CTAボタン配置</h2>
                            <p className="text-xs text-gray-500">テンプレートを選んで画像上に配置</p>
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
                            {overlays.map(overlay => {
                                const style = getOverlayStyle(overlay);
                                const template = overlay.template ? CTA_TEMPLATES[overlay.template] : null;
                                const animClass = template?.animation === 'pulse' ? 'animate-pulse' : template?.animation === 'bounce' ? 'animate-bounce' : '';

                                return (
                                    <div
                                        key={overlay.id}
                                        className={clsx(
                                            "absolute cursor-grab active:cursor-grabbing transition-shadow",
                                            selectedId === overlay.id && "ring-2 ring-white ring-offset-2 ring-offset-gray-900",
                                            animClass
                                        )}
                                        style={{
                                            left: `${overlay.x}%`,
                                            top: `${overlay.y}%`,
                                            transform: 'translate(-50%, -50%)',
                                            ...style,
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, overlay.id)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedId(overlay.id);
                                        }}
                                    >
                                        <TemplateIcon icon={template?.icon} />
                                        {overlay.content}

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
                                );
                            })}

                            <div
                                className="absolute inset-0"
                                onClick={() => setSelectedId(null)}
                                style={{ pointerEvents: overlays.length > 0 ? 'auto' : 'none', zIndex: -1 }}
                            />
                        </div>
                    </div>

                    {/* 右: 設定パネル */}
                    <div className="w-80 bg-gray-50 flex flex-col overflow-hidden">
                        {/* CTAテンプレート一覧 */}
                        <div className="p-4 border-b border-gray-200 overflow-y-auto max-h-[340px]">
                            <h3 className="text-sm font-bold text-gray-900 mb-2">CTAテンプレート</h3>
                            {/* カテゴリフィルタ */}
                            <div className="flex gap-1 mb-3 flex-wrap">
                                <button
                                    onClick={() => setCategoryFilter('all')}
                                    className={clsx(
                                        "px-2 py-0.5 text-[10px] rounded-full border transition-colors",
                                        categoryFilter === 'all'
                                            ? "bg-gray-900 text-white border-gray-900"
                                            : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                                    )}
                                >
                                    すべて
                                </button>
                                {(Object.entries(CTA_CATEGORIES) as [CTACategory, string][]).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => setCategoryFilter(key)}
                                        className={clsx(
                                            "px-2 py-0.5 text-[10px] rounded-full border transition-colors",
                                            categoryFilter === key
                                                ? "bg-gray-900 text-white border-gray-900"
                                                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(CTA_TEMPLATES)
                                    .filter(([, template]) => categoryFilter === 'all' || template.category === categoryFilter)
                                    .map(([id, template]) => {
                                    const previewStyle = getTemplateStyle(id);
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => addFromTemplate(id)}
                                            className="group relative flex flex-col items-center p-2 rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow-sm transition-all bg-white"
                                        >
                                            <div
                                                className={clsx(
                                                    "text-[10px] px-2 py-1 mb-1.5 truncate max-w-full",
                                                    template.animation === 'pulse' && "animate-pulse",
                                                    template.animation === 'bounce' && "animate-bounce"
                                                )}
                                                style={{
                                                    ...previewStyle,
                                                    fontSize: '10px',
                                                    padding: '4px 10px',
                                                }}
                                            >
                                                <TemplateIcon icon={template.icon} className="h-3 w-3 mr-0.5 inline-block" />
                                                {template.label.length > 8 ? template.label.slice(0, 8) + '…' : template.label}
                                            </div>
                                            <span className="text-[10px] text-gray-500 font-medium">{template.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={addCustom}
                                className="w-full mt-2 px-3 py-2 text-xs font-medium border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-gray-500 hover:text-gray-900 transition-colors flex items-center justify-center gap-1"
                            >
                                <Plus className="h-3 w-3" />
                                カスタムボタン
                            </button>
                        </div>

                        {/* 選択中の要素の設定 */}
                        {selectedOverlay ? (
                            <div className="flex-1 overflow-y-auto">
                                <div className="p-4 border-b border-gray-200">
                                    <h3 className="text-sm font-bold text-gray-900 mb-2">CTA編集</h3>
                                    {/* ラベル */}
                                    <label className="block text-xs font-medium text-gray-600 mb-1">ラベル</label>
                                    <input
                                        type="text"
                                        value={selectedOverlay.content}
                                        onChange={(e) => updateOverlay(selectedId!, { content: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                                    />
                                </div>

                                {/* テンプレート（アコーディオン） */}
                                {selectedOverlay.template && (
                                    <div className="border-b border-gray-200">
                                        <button
                                            onClick={() => toggleSection('template')}
                                            className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                                        >
                                            テンプレート
                                            <ChevronDown className={clsx("h-3.5 w-3.5 text-gray-400 transition-transform", openSections.template && "rotate-180")} />
                                        </button>
                                        {openSections.template && (
                                            <div className="px-4 pb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded flex-1">
                                                        {CTA_TEMPLATES[selectedOverlay.template]?.name || selectedOverlay.template}
                                                    </span>
                                                    <select
                                                        value={selectedOverlay.template}
                                                        onChange={(e) => changeTemplate(selectedId!, e.target.value)}
                                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-gray-300"
                                                    >
                                                        {(Object.entries(CTA_CATEGORIES) as [CTACategory, string][]).map(([catKey, catLabel]) => (
                                                            <optgroup key={catKey} label={catLabel}>
                                                                {Object.entries(CTA_TEMPLATES)
                                                                    .filter(([, t]) => t.category === catKey)
                                                                    .map(([id, t]) => (
                                                                        <option key={id} value={id}>{t.name}</option>
                                                                    ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* サイズ（アコーディオン）— テンプレート・カスタム両方表示 */}
                                <div className="border-b border-gray-200">
                                    <button
                                        onClick={() => toggleSection('size')}
                                        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                                    >
                                        サイズ
                                        <ChevronDown className={clsx("h-3.5 w-3.5 text-gray-400 transition-transform", openSections.size && "rotate-180")} />
                                    </button>
                                    {openSections.size && (
                                        <div className="px-4 pb-3 space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    フォントサイズ: {selectedOverlay.style.fontSize || 16}px
                                                </label>
                                                <input
                                                    type="range"
                                                    min="10"
                                                    max="48"
                                                    value={selectedOverlay.style.fontSize || 16}
                                                    onChange={(e) => updateStyle(selectedId!, { fontSize: parseInt(e.target.value) })}
                                                    className="w-full"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    角丸: {selectedOverlay.style.borderRadius || 8}px
                                                </label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="50"
                                                    value={selectedOverlay.style.borderRadius || 8}
                                                    onChange={(e) => updateStyle(selectedId!, { borderRadius: parseInt(e.target.value) })}
                                                    className="w-full"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">パディング</label>
                                                <input
                                                    type="text"
                                                    value={selectedOverlay.style.padding || '12px 24px'}
                                                    onChange={(e) => updateStyle(selectedId!, { padding: e.target.value })}
                                                    placeholder="12px 24px"
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* アクション（アコーディオン） */}
                                <div className="border-b border-gray-200">
                                    <button
                                        onClick={() => toggleSection('action')}
                                        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                                    >
                                        アクション
                                        <ChevronDown className={clsx("h-3.5 w-3.5 text-gray-400 transition-transform", openSections.action && "rotate-180")} />
                                    </button>
                                    {openSections.action && (
                                        <div className="px-4 pb-3 space-y-3">
                                            <div className="grid grid-cols-3 gap-1">
                                                {ACTION_TYPES.map(type => (
                                                    <button
                                                        key={type.value}
                                                        onClick={() => updateAction(selectedId!, { type: type.value })}
                                                        className={clsx(
                                                            "p-2 rounded-lg border text-xs transition-all flex flex-col items-center gap-0.5",
                                                            selectedOverlay.action?.type === type.value
                                                                ? "border-gray-900 bg-gray-100 text-gray-900"
                                                                : "border-gray-200 hover:border-gray-300 text-gray-500"
                                                        )}
                                                    >
                                                        <type.icon className="h-3.5 w-3.5" />
                                                        {type.label}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* URL入力 */}
                                            {selectedOverlay.action?.type === 'external' && (
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        <Link2 className="h-3 w-3 inline mr-1" />
                                                        リンクURL
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={selectedOverlay.action?.url || ''}
                                                        onChange={(e) => updateAction(selectedId!, { url: e.target.value })}
                                                        placeholder="https://example.com"
                                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                                                    />
                                                </div>
                                            )}

                                            {selectedOverlay.action?.type === 'anchor' && (
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        <Hash className="h-3 w-3 inline mr-1" />
                                                        スクロール先
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={selectedOverlay.action?.url || ''}
                                                        onChange={(e) => updateAction(selectedId!, { url: e.target.value })}
                                                        placeholder="#contact"
                                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                                                    />
                                                    <p className="mt-1 text-[10px] text-gray-400">例: #contact, #form</p>
                                                </div>
                                            )}

                                            {selectedOverlay.action?.type === 'line' && (
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        <MessageCircle className="h-3 w-3 inline mr-1" />
                                                        LINE URL
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={selectedOverlay.action?.url || ''}
                                                        onChange={(e) => updateAction(selectedId!, { url: e.target.value })}
                                                        placeholder="https://lin.ee/xxxxx"
                                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* カスタムスタイル（テンプレートなしの場合のみ、アコーディオン） */}
                                {!selectedOverlay.template && (
                                    <div className="border-b border-gray-200">
                                        <button
                                            onClick={() => toggleSection('style')}
                                            className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                                        >
                                            スタイル
                                            <ChevronDown className={clsx("h-3.5 w-3.5 text-gray-400 transition-transform", openSections.style && "rotate-180")} />
                                        </button>
                                        {openSections.style && (
                                            <div className="px-4 pb-3 space-y-3">
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
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 位置（アコーディオン） */}
                                <div className="border-b border-gray-200">
                                    <button
                                        onClick={() => toggleSection('position')}
                                        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                                    >
                                        位置
                                        <ChevronDown className={clsx("h-3.5 w-3.5 text-gray-400 transition-transform", openSections.position && "rotate-180")} />
                                    </button>
                                    {openSections.position && (
                                        <div className="px-4 pb-3">
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
                                        </div>
                                    )}
                                </div>

                                {/* 削除 */}
                                <div className="p-4">
                                    <button
                                        onClick={() => deleteOverlay(selectedId!)}
                                        className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        この要素を削除
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center p-4">
                                <p className="text-sm text-gray-400 text-center">
                                    テンプレートを選んで追加するか、<br />既存の要素をクリックして編集
                                </p>
                            </div>
                        )}

                        {/* オーバーレイ一覧 */}
                        {overlays.length > 0 && (
                            <div className="p-4 border-t border-gray-200">
                                <h4 className="text-xs font-bold text-gray-500 mb-2">配置済み ({overlays.length})</h4>
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {overlays.map(overlay => {
                                        const template = overlay.template ? CTA_TEMPLATES[overlay.template] : null;
                                        return (
                                            <div
                                                key={overlay.id}
                                                onClick={() => setSelectedId(overlay.id)}
                                                className={clsx(
                                                    "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                                                    selectedId === overlay.id
                                                        ? "bg-gray-100 text-gray-900"
                                                        : "hover:bg-gray-100 text-gray-600"
                                                )}
                                            >
                                                <div
                                                    className="w-4 h-4 rounded"
                                                    style={{
                                                        background: template?.background || overlay.style.backgroundColor,
                                                    }}
                                                />
                                                <span className="text-xs truncate flex-1">{overlay.content}</span>
                                                {template && (
                                                    <span className="text-[9px] text-gray-400">{template.name}</span>
                                                )}
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
                                        );
                                    })}
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
                        className="px-6 py-2 bg-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-all"
                    >
                        保存
                    </button>
                </div>
            </div>
        </div>
    );
}
