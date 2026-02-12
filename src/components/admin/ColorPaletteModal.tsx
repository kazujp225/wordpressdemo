'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, RefreshCw, Palette, DollarSign, Crown, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { GEMINI_PRICING } from '@/lib/ai-costs';
import { usdToTokens, formatTokens } from '@/lib/plans';

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
    canAIGenerate?: boolean;
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
    canAIGenerate = true,
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

    const imageCount = sections.filter(s => s.image?.filePath).length;
    const estimatedCost = imageCount * GEMINI_PRICING['gemini-3-pro-image-preview'].perImage;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gray-900 flex items-center justify-center">
                            <Palette className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-gray-900">配色設定</h2>
                            <p className="text-xs text-gray-500">LP全体のカラーパレットを管理</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="h-4 w-4 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* 現在の配色 */}
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">現在の配色</h3>
                        <div className="grid grid-cols-4 gap-3">
                            {Object.entries(palette).map(([key, color]) => (
                                <div key={key} className="group">
                                    <div
                                        className="aspect-[4/3] rounded-lg border border-gray-200 mb-2 cursor-pointer relative overflow-hidden"
                                        style={{ backgroundColor: color }}
                                    >
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) => {
                                                setPalette(prev => ({ ...prev, [key]: e.target.value }));
                                                setSelectedPreset(null);
                                            }}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                    </div>
                                    <p className="text-[11px] font-medium text-gray-700 text-center">
                                        {key === 'primary' && 'Primary'}
                                        {key === 'secondary' && 'Secondary'}
                                        {key === 'accent' && 'Accent'}
                                        {key === 'background' && 'Background'}
                                    </p>
                                    <p className="text-[10px] text-gray-400 text-center font-mono">{color}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 自動検出 */}
                    <button
                        onClick={() => {
                            if (!canAIGenerate) {
                                toast.error('有料プランにアップグレードしてご利用ください');
                                return;
                            }
                            handleAutoDetect();
                        }}
                        disabled={!canAIGenerate || isDetecting || sections.length === 0}
                        className={`w-full py-3 border border-gray-200 rounded-xl text-sm font-medium disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 ${!canAIGenerate ? 'opacity-50 text-gray-400' : 'text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50'}`}
                    >
                        {!canAIGenerate ? (
                            <>
                                <Lock className="h-4 w-4" />
                                現在のLPから自動検出
                                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-gray-900 text-white rounded">Pro</span>
                            </>
                        ) : isDetecting ? (
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

                    {/* プリセット */}
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">プリセット</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {PRESET_PALETTES.map(preset => (
                                <button
                                    key={preset.name}
                                    onClick={() => handlePresetSelect(preset)}
                                    className={clsx(
                                        "p-3 rounded-xl border transition-all text-left",
                                        selectedPreset === preset.name
                                            ? "border-gray-900 bg-gray-50"
                                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                    )}
                                >
                                    <div className="flex gap-1.5 mb-2">
                                        {Object.values(preset.colors).map((color, idx) => (
                                            <div
                                                key={idx}
                                                className="w-5 h-5 rounded-full border border-white shadow-sm"
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-xs font-medium text-gray-700">{preset.name}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 space-y-3">
                    {/* コスト表示 */}
                    {imageCount > 0 && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 bg-white px-3 py-2 rounded-lg border border-gray-200">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>
                                「適用して再生成」の消費トークン: 約{formatTokens(usdToTokens(estimatedCost))}
                                <span className="text-gray-400 ml-1">({imageCount}枚)</span>
                            </span>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <button
                            onClick={onClose}
                            disabled={isRegenerating}
                            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                        >
                            キャンセル
                        </button>
                        <div className="flex gap-2">
                            <button
                                onClick={handleApply}
                                disabled={isRegenerating}
                                className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-white transition-all disabled:opacity-50"
                            >
                                保存のみ
                            </button>
                            <button
                                onClick={() => {
                                    if (!canAIGenerate) {
                                        toast.error('有料プランにアップグレードしてご利用ください');
                                        return;
                                    }
                                    onApplyAndRegenerate(palette);
                                }}
                                disabled={!canAIGenerate || isRegenerating || imageCount === 0}
                                className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {!canAIGenerate ? (
                                    <>
                                        <Lock className="h-4 w-4" />
                                        アップグレード
                                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-white/20 rounded">Pro</span>
                                    </>
                                ) : isRegenerating ? (
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
