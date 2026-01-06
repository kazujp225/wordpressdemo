'use client';

import { useState, useEffect } from 'react';
import { X, Smartphone, RefreshCw, Check, Sparkles, Monitor, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { GEMINI_PRICING } from '@/lib/ai-costs';

interface Section {
    id: string | number;
    role?: string;
    image?: { filePath: string };
    mobileImage?: { filePath: string };
}

interface MobileOptimizeModalProps {
    isOpen: boolean;
    onClose: () => void;
    sections: Section[];
    onOptimize: (sectionIds: string[], strategy: string) => Promise<void>;
}

const STRATEGIES = [
    { value: 'smart-crop', label: 'スマートクロップ', description: '重要な部分を自動検出して切り抜き' },
    { value: 'regenerate', label: 'AI再生成', description: 'モバイル向けに最適化された画像を生成' },
    { value: 'resize', label: 'リサイズ', description: 'シンプルにサイズ変更' },
];

export default function MobileOptimizeModal({
    isOpen,
    onClose,
    sections,
    onOptimize,
}: MobileOptimizeModalProps) {
    const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
    const [strategy, setStrategy] = useState('smart-crop');
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    useEffect(() => {
        if (isOpen) {
            // モバイル画像がないセクションを自動選択
            const withoutMobile = sections
                .filter(s => !s.mobileImage && s.image)
                .map(s => String(s.id));
            setSelectedSections(new Set(withoutMobile));
        }
    }, [isOpen, sections]);

    const toggleSection = (id: string) => {
        setSelectedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleOptimize = async () => {
        if (selectedSections.size === 0) {
            toast.error('セクションを選択してください');
            return;
        }

        setIsOptimizing(true);
        setProgress({ current: 0, total: selectedSections.size });

        try {
            await onOptimize(Array.from(selectedSections), strategy);
            toast.success(`${selectedSections.size}件のモバイル画像を生成しました`);
            onClose();
        } catch (error: any) {
            toast.error(error.message || 'モバイル最適化に失敗しました');
        } finally {
            setIsOptimizing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-blue-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shadow-lg">
                            <Smartphone className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">モバイル最適化</h2>
                            <p className="text-xs text-gray-500">スマホ向け画像を自動生成</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isOptimizing ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <RefreshCw className="h-12 w-12 text-sky-500 animate-spin mb-4" />
                            <p className="text-lg font-bold text-gray-900 mb-2">
                                最適化中... {progress.current}/{progress.total}
                            </p>
                            <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-sky-500 transition-all"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* 戦略選択 */}
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-gray-900 mb-3">最適化方法</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    {STRATEGIES.map(s => (
                                        <button
                                            key={s.value}
                                            onClick={() => setStrategy(s.value)}
                                            className={clsx(
                                                "p-3 rounded-xl border-2 text-left transition-all",
                                                strategy === s.value
                                                    ? "border-sky-500 bg-sky-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            <p className="text-sm font-medium text-gray-900">{s.label}</p>
                                            <p className="text-xs text-gray-500">{s.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* セクション選択 */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-gray-900">対象セクション</h3>
                                    <span className="text-xs text-gray-500">{selectedSections.size}件選択中</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {sections.filter(s => s.image).map((section, idx) => (
                                        <button
                                            key={section.id}
                                            onClick={() => toggleSection(String(section.id))}
                                            className={clsx(
                                                "relative rounded-lg overflow-hidden border-2 transition-all",
                                                selectedSections.has(String(section.id))
                                                    ? "border-sky-500 ring-2 ring-sky-200"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            <img
                                                src={section.image?.filePath}
                                                alt={`Section ${idx + 1}`}
                                                className="w-full h-20 object-cover"
                                            />
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 flex items-center justify-between">
                                                <span className="text-[10px] text-white truncate">
                                                    {section.role || `Section ${idx + 1}`}
                                                </span>
                                                {section.mobileImage ? (
                                                    <Smartphone className="h-3 w-3 text-green-400" />
                                                ) : (
                                                    <Monitor className="h-3 w-3 text-gray-400" />
                                                )}
                                            </div>
                                            {selectedSections.has(String(section.id)) && (
                                                <div className="absolute top-1 right-1 h-5 w-5 bg-sky-500 rounded-full flex items-center justify-center">
                                                    <Check className="h-3 w-3 text-white" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!isOptimizing && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                        {/* API課金費用の表示（AI再生成の場合のみ） */}
                        {strategy === 'regenerate' && selectedSections.size > 0 && (
                            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs font-bold text-amber-800">
                                        この作業のAPI課金費用: 約${(selectedSections.size * GEMINI_PRICING['gemini-3-pro-image-preview'].perImage).toFixed(2)}
                                    </span>
                                </div>
                                <p className="text-[10px] text-amber-600 mt-1 ml-6">
                                    {selectedSections.size}件 × $0.04（Gemini 3 Pro Image）
                                </p>
                            </div>
                        )}
                        {strategy !== 'regenerate' && selectedSections.size > 0 && (
                            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-xs text-green-700">
                                    この方法はAPIコスト無料です（ローカル処理）
                                </p>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                                キャンセル
                            </button>
                            <button
                                onClick={handleOptimize}
                                disabled={selectedSections.size === 0}
                                className="px-6 py-2 bg-gradient-to-r from-sky-500 to-blue-500 text-white text-sm font-bold rounded-lg hover:from-sky-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                <Sparkles className="h-4 w-4" />
                                モバイル版を生成
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
