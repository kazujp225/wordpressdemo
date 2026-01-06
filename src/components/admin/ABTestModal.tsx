'use client';

import { useState } from 'react';
import { X, TestTube2, RefreshCw, Check, Sparkles, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface ABTestModalProps {
    isOpen: boolean;
    onClose: () => void;
    sections: any[];
    onGenerate: (sectionId: string, type: string, count: number) => Promise<any[]>;
}

const VARIANT_TYPES = [
    { value: 'headline', label: 'ヘッドライン', description: 'キャッチコピーのバリエーション' },
    { value: 'color', label: 'カラー', description: '配色のバリエーション' },
    { value: 'layout', label: 'レイアウト', description: 'レイアウトのバリエーション' },
];

export default function ABTestModal({ isOpen, onClose, sections, onGenerate }: ABTestModalProps) {
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [variantType, setVariantType] = useState('headline');
    const [variantCount, setVariantCount] = useState(3);
    const [isGenerating, setIsGenerating] = useState(false);
    const [variants, setVariants] = useState<any[]>([]);

    const handleGenerate = async () => {
        if (!selectedSection) {
            toast.error('セクションを選択してください');
            return;
        }

        setIsGenerating(true);
        try {
            const results = await onGenerate(selectedSection, variantType, variantCount);
            setVariants(results);
            toast.success(`${results.length}件のバリエーションを生成しました`);
        } catch (error: any) {
            toast.error(error.message || 'バリエーション生成に失敗しました');
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                            <TestTube2 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">A/Bテスト</h2>
                            <p className="text-xs text-gray-500">バリエーションを作成して比較</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isGenerating ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <RefreshCw className="h-12 w-12 text-amber-500 animate-spin mb-4" />
                            <p className="text-lg font-bold text-gray-900">バリエーションを生成中...</p>
                        </div>
                    ) : variants.length > 0 ? (
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 mb-3">生成されたバリエーション</h3>
                            <div className="space-y-3">
                                {variants.map((v, idx) => (
                                    <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <span className="text-xs font-bold text-amber-600">バリエーション {String.fromCharCode(65 + idx)}</span>
                                                <p className="text-sm text-gray-700 mt-1">{v.content || v.text || JSON.stringify(v)}</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(v.content || v.text || '');
                                                    toast.success('コピーしました');
                                                }}
                                                className="p-1 text-gray-400 hover:text-gray-600"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => setVariants([])}
                                className="mt-4 text-sm text-amber-600 hover:text-amber-700"
                            >
                                ← 設定に戻る
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* セクション選択 */}
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-gray-900 mb-3">対象セクション</h3>
                                <div className="grid grid-cols-4 gap-2">
                                    {sections.filter(s => s.image).map((section, idx) => (
                                        <button
                                            key={section.id}
                                            onClick={() => setSelectedSection(String(section.id))}
                                            className={clsx(
                                                "relative rounded-lg overflow-hidden border-2 transition-all",
                                                selectedSection === String(section.id)
                                                    ? "border-amber-500 ring-2 ring-amber-200"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            <img
                                                src={section.image?.filePath}
                                                alt={`Section ${idx + 1}`}
                                                className="w-full h-20 object-cover"
                                            />
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                                                <span className="text-[10px] text-white truncate">
                                                    {section.role || `Section ${idx + 1}`}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* バリエーションタイプ */}
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-gray-900 mb-3">バリエーションタイプ</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    {VARIANT_TYPES.map(t => (
                                        <button
                                            key={t.value}
                                            onClick={() => setVariantType(t.value)}
                                            className={clsx(
                                                "p-3 rounded-xl border-2 text-left transition-all",
                                                variantType === t.value
                                                    ? "border-amber-500 bg-amber-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            <p className="text-sm font-medium text-gray-900">{t.label}</p>
                                            <p className="text-xs text-gray-500">{t.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 生成数 */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 mb-3">生成数</h3>
                                <div className="flex gap-2">
                                    {[2, 3, 4, 5].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => setVariantCount(n)}
                                            className={clsx(
                                                "px-4 py-2 rounded-lg border-2 transition-all",
                                                variantCount === n
                                                    ? "border-amber-500 bg-amber-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            {n}パターン
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!isGenerating && variants.length === 0 && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                            キャンセル
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={!selectedSection}
                            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold rounded-lg hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            <Sparkles className="h-4 w-4" />
                            バリエーション生成
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
