'use client';

import { useState, useEffect } from 'react';
import { X, Droplet, Sparkles, RefreshCw, Check, Palette, Eye, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { GEMINI_PRICING } from '@/lib/ai-costs';

interface ColorPalette {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
}

interface Section {
    id: string | number;
    role?: string;
    image?: { filePath: string };
}

interface ColorPaletteModalProps {
    isOpen: boolean;
    onClose: () => void;
    sections: Section[];
    currentPalette?: ColorPalette | null;
    designDefinition?: any;
    onApply: (palette: ColorPalette) => void;
    onApplyAndRegenerate: (palette: ColorPalette) => Promise<void>;
    onAutoDetect: () => Promise<ColorPalette | null>;
    isRegenerating?: boolean;
}

const PRESET_PALETTES: { name: string; colors: ColorPalette }[] = [
    {
        name: 'モダンブルー',
        colors: { primary: '#2563eb', secondary: '#3b82f6', accent: '#f59e0b', background: '#f8fafc' }
    },
    {
        name: 'ナチュラルグリーン',
        colors: { primary: '#059669', secondary: '#10b981', accent: '#f97316', background: '#f0fdf4' }
    },
    {
        name: 'エレガントパープル',
        colors: { primary: '#7c3aed', secondary: '#8b5cf6', accent: '#ec4899', background: '#faf5ff' }
    },
    {
        name: 'ウォームオレンジ',
        colors: { primary: '#ea580c', secondary: '#f97316', accent: '#0ea5e9', background: '#fff7ed' }
    },
    {
        name: 'クールグレー',
        colors: { primary: '#475569', secondary: '#64748b', accent: '#3b82f6', background: '#f1f5f9' }
    },
    {
        name: 'ローズピンク',
        colors: { primary: '#e11d48', secondary: '#f43f5e', accent: '#8b5cf6', background: '#fff1f2' }
    },
    {
        name: 'オーシャンティール',
        colors: { primary: '#0d9488', secondary: '#14b8a6', accent: '#f59e0b', background: '#f0fdfa' }
    },
    {
        name: 'ミッドナイト',
        colors: { primary: '#1e293b', secondary: '#334155', accent: '#fbbf24', background: '#f8fafc' }
    },
];

export default function ColorPaletteModal({
    isOpen,
    onClose,
    sections,
    currentPalette,
    designDefinition,
    onApply,
    onApplyAndRegenerate,
    onAutoDetect,
    isRegenerating = false,
}: ColorPaletteModalProps) {
    const [palette, setPalette] = useState<ColorPalette>({
        primary: '#2563eb',
        secondary: '#3b82f6',
        accent: '#f59e0b',
        background: '#ffffff',
    });
    const [isDetecting, setIsDetecting] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (currentPalette) {
                setPalette(currentPalette);
            } else if (designDefinition?.colorPalette) {
                setPalette(designDefinition.colorPalette);
            }
            setSelectedPreset(null);
        }
    }, [isOpen, currentPalette, designDefinition]);

    const handleAutoDetect = async () => {
        setIsDetecting(true);
        try {
            const detected = await onAutoDetect();
            if (detected) {
                setPalette(detected);
                toast.success('カラーパレットを検出しました');
            } else {
                toast.error('カラーパレットの検出に失敗しました');
            }
        } catch (error) {
            toast.error('カラーパレットの検出に失敗しました');
        } finally {
            setIsDetecting(false);
        }
    };

    const handlePresetSelect = (preset: typeof PRESET_PALETTES[0]) => {
        setPalette(preset.colors);
        setSelectedPreset(preset.name);
    };

    const handleApply = () => {
        onApply(palette);
        toast.success('カラーパレットを適用しました');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-purple-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
                            <Palette className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">色変更</h2>
                            <p className="text-xs text-gray-500">LP全体の配色を管理</p>
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
                <div className="flex-1 overflow-y-auto p-6">
                    {/* 現在のパレットプレビュー */}
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-gray-900 mb-3">現在の配色</h3>
                        <div className="flex gap-2 p-4 bg-gray-50 rounded-xl">
                            {Object.entries(palette).map(([key, color]) => (
                                <div key={key} className="flex-1 text-center">
                                    <div
                                        className="w-full h-16 rounded-lg shadow-inner mb-2"
                                        style={{ backgroundColor: color }}
                                    />
                                    <p className="text-[10px] font-medium text-gray-500 capitalize">{key}</p>
                                    <p className="text-[10px] text-gray-400">{color}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 自動検出 */}
                    <div className="mb-6">
                        <button
                            onClick={handleAutoDetect}
                            disabled={isDetecting || sections.length === 0}
                            className="w-full py-3 border-2 border-dashed border-violet-300 rounded-xl text-violet-600 font-medium hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                            {isDetecting ? (
                                <>
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                    検出中...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    現在のLPから自動検出
                                </>
                            )}
                        </button>
                    </div>

                    {/* プリセットパレット */}
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-gray-900 mb-3">プリセット</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {PRESET_PALETTES.map(preset => (
                                <button
                                    key={preset.name}
                                    onClick={() => handlePresetSelect(preset)}
                                    className={clsx(
                                        "p-3 rounded-xl border-2 transition-all text-left",
                                        selectedPreset === preset.name
                                            ? "border-violet-500 bg-violet-50"
                                            : "border-gray-200 hover:border-gray-300"
                                    )}
                                >
                                    <div className="flex gap-1 mb-2">
                                        {Object.values(preset.colors).map((color, idx) => (
                                            <div
                                                key={idx}
                                                className="w-6 h-6 rounded-full shadow-sm"
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-xs font-medium text-gray-700">{preset.name}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* カスタム色設定 */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-3">カスタム設定</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {Object.entries(palette).map(([key, color]) => (
                                <div key={key}>
                                    <label className="text-xs font-medium text-gray-600 mb-1 block capitalize">
                                        {key === 'primary' && 'メインカラー'}
                                        {key === 'secondary' && 'サブカラー'}
                                        {key === 'accent' && 'アクセントカラー'}
                                        {key === 'background' && '背景色'}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) => {
                                                setPalette(prev => ({ ...prev, [key]: e.target.value }));
                                                setSelectedPreset(null);
                                            }}
                                            className="w-12 h-10 rounded-lg cursor-pointer border border-gray-200"
                                        />
                                        <input
                                            type="text"
                                            value={color}
                                            onChange={(e) => {
                                                setPalette(prev => ({ ...prev, [key]: e.target.value }));
                                                setSelectedPreset(null);
                                            }}
                                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                    {/* コスト説明 */}
                    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-amber-600" />
                            <span className="text-xs font-bold text-amber-800">
                                「適用して再生成」のAPI課金費用: 約${(sections.filter(s => s.image?.filePath).length * GEMINI_PRICING['gemini-3-pro-image-preview'].perImage).toFixed(2)}
                            </span>
                        </div>
                        <p className="text-[10px] text-amber-600 mt-1 ml-6">
                            {sections.filter(s => s.image?.filePath).length}件 × $0.04（Gemini 3 Pro Image）
                        </p>
                    </div>

                    <div className="flex justify-between items-center">
                        <button
                            onClick={onClose}
                            disabled={isRegenerating}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
                        >
                            キャンセル
                        </button>
                        <div className="flex gap-2">
                            {/* パレットのみ保存 */}
                            <button
                                onClick={handleApply}
                                disabled={isRegenerating}
                                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 transition-all disabled:opacity-50"
                            >
                                保存のみ
                            </button>
                            {/* 適用して再生成 */}
                            <button
                                onClick={() => onApplyAndRegenerate(palette)}
                                disabled={isRegenerating || sections.filter(s => s.image?.filePath).length === 0}
                                className="px-6 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-bold rounded-lg hover:from-violet-600 hover:to-purple-600 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isRegenerating ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        再生成中...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4" />
                                        適用して再生成
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
