'use client';

import { useState, useEffect } from 'react';
import { X, Type, Sparkles, Copy, Check, RefreshCw, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Section {
    id: string | number;
    role?: string;
    image?: { filePath: string };
    config?: {
        text?: string;
        dsl?: any;
    };
}

interface CopyResult {
    id: string;
    text: string;
    dsl?: {
        strategy_intent?: string;
        tone?: string;
        constraints?: string;
    };
}

interface CopyEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    sections: Section[];
    productInfo: string;
    taste: string;
    designDefinition?: any;
    onApply: (results: CopyResult[]) => void;
    onApplyAndRegenerate?: (results: CopyResult[]) => Promise<void>;
    isRegenerating?: boolean;
}

const TONE_OPTIONS = [
    { value: 'professional', label: '専門的・信頼感', description: '権威性と信頼を重視' },
    { value: 'friendly', label: '親しみやすい', description: 'フレンドリーで親近感' },
    { value: 'urgent', label: '緊急性・限定感', description: '今すぐ行動を促す' },
    { value: 'luxury', label: '高級・プレミアム', description: 'ラグジュアリー感' },
    { value: 'casual', label: 'カジュアル', description: '気軽で軽やかな印象' },
];

export default function CopyEditModal({
    isOpen,
    onClose,
    sections,
    productInfo,
    taste,
    designDefinition,
    onApply,
    onApplyAndRegenerate,
    isRegenerating = false,
}: CopyEditModalProps) {
    const [step, setStep] = useState<'config' | 'generating' | 'review'>('config');
    const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
    const [selectedTone, setSelectedTone] = useState<string>(taste || 'professional');
    const [customPrompt, setCustomPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedCopy, setGeneratedCopy] = useState<CopyResult[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // 初期化: 全セクション選択
    useEffect(() => {
        if (isOpen) {
            const allIds = new Set(sections.map(s => String(s.id)));
            setSelectedSections(allIds);
            setStep('config');
            setGeneratedCopy([]);
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

    const selectAll = () => {
        setSelectedSections(new Set(sections.map(s => String(s.id))));
    };

    const selectNone = () => {
        setSelectedSections(new Set());
    };

    const handleGenerate = async () => {
        if (selectedSections.size === 0) {
            toast.error('セクションを選択してください');
            return;
        }

        setIsGenerating(true);
        setStep('generating');

        try {
            const targetSections = sections.filter(s => selectedSections.has(String(s.id)));

            const response = await fetch('/api/ai/generate-copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productInfo: customPrompt || productInfo,
                    taste: selectedTone,
                    sections: targetSections.map(s => ({
                        id: s.id,
                        role: s.role,
                        image: s.image,
                        base64: null, // 画像URLを使用
                    })),
                    designDefinition,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'コピー生成に失敗しました');
            }

            const results: CopyResult[] = await response.json();
            setGeneratedCopy(results);
            setStep('review');
            toast.success(`${results.length}件のコピーを生成しました`);
        } catch (error: any) {
            console.error('Copy generation error:', error);
            toast.error(error.message || 'コピー生成に失敗しました');
            setStep('config');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyText = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.success('コピーしました');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleApply = () => {
        onApply(generatedCopy);
        toast.success('コピーを適用しました');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-green-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg">
                            <Type className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">AIコピー生成</h2>
                            <p className="text-xs text-gray-500">セクションごとのキャッチコピーを生成</p>
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
                    {step === 'config' && (
                        <div className="space-y-6">
                            {/* セクション選択 */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-gray-900">対象セクション</h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={selectAll}
                                            className="text-xs text-emerald-600 hover:text-emerald-700"
                                        >
                                            すべて選択
                                        </button>
                                        <span className="text-gray-300">|</span>
                                        <button
                                            onClick={selectNone}
                                            className="text-xs text-gray-500 hover:text-gray-600"
                                        >
                                            選択解除
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {sections.map((section, idx) => (
                                        <button
                                            key={section.id}
                                            onClick={() => toggleSection(String(section.id))}
                                            className={clsx(
                                                "relative rounded-lg overflow-hidden border-2 transition-all",
                                                selectedSections.has(String(section.id))
                                                    ? "border-emerald-500 ring-2 ring-emerald-200"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            {section.image?.filePath ? (
                                                <img
                                                    src={section.image.filePath}
                                                    alt={`Section ${idx + 1}`}
                                                    className="w-full h-20 object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-20 bg-gray-100 flex items-center justify-center">
                                                    <Type className="h-6 w-6 text-gray-400" />
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                                                <p className="text-[10px] text-white truncate">
                                                    {section.role || `Section ${idx + 1}`}
                                                </p>
                                            </div>
                                            {selectedSections.has(String(section.id)) && (
                                                <div className="absolute top-1 right-1 h-5 w-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                                    <Check className="h-3 w-3 text-white" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    {selectedSections.size}件選択中
                                </p>
                            </div>

                            {/* トーン選択 */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 mb-3">トーン&マナー</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {TONE_OPTIONS.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => setSelectedTone(option.value)}
                                            className={clsx(
                                                "p-3 rounded-lg border-2 text-left transition-all",
                                                selectedTone === option.value
                                                    ? "border-emerald-500 bg-emerald-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            <p className="text-sm font-medium text-gray-900">{option.label}</p>
                                            <p className="text-xs text-gray-500">{option.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* カスタムプロンプト */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 mb-3">商材・追加指示（任意）</h3>
                                <textarea
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder={productInfo || "商材やサービスの説明、特に強調したいポイントなど..."}
                                    className="w-full h-24 px-4 py-3 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                />
                            </div>
                        </div>
                    )}

                    {step === 'generating' && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <RefreshCw className="h-12 w-12 text-emerald-500 animate-spin mb-4" />
                            <p className="text-lg font-bold text-gray-900 mb-2">コピーを生成中...</p>
                            <p className="text-sm text-gray-500">AIが最適なキャッチコピーを考えています</p>
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-gray-900">生成結果</h3>
                                <button
                                    onClick={() => setStep('config')}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                                >
                                    <RefreshCw className="h-3 w-3" />
                                    再生成
                                </button>
                            </div>
                            {generatedCopy.map((result, idx) => {
                                const section = sections.find(s => String(s.id) === String(result.id));
                                return (
                                    <div
                                        key={result.id}
                                        className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-gray-500">
                                                    {section?.role || `Section ${idx + 1}`}
                                                </span>
                                                {result.dsl?.tone && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                                                        {result.dsl.tone}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleCopyText(result.text, result.id)}
                                                className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                                            >
                                                {copiedId === result.id ? (
                                                    <Check className="h-4 w-4 text-emerald-500" />
                                                ) : (
                                                    <Copy className="h-4 w-4 text-gray-500" />
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                                            {result.text}
                                        </p>
                                        {result.dsl?.strategy_intent && (
                                            <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                                                <span className="font-medium">戦略意図:</span> {result.dsl.strategy_intent}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                    {/* コスト説明（reviewステップ時のみ） */}
                    {step === 'review' && onApplyAndRegenerate && (
                        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs text-amber-700">
                                💰 <strong>再生成コスト目安:</strong> 約1〜2円/セクション × {generatedCopy.length}セクション = 約{1 * generatedCopy.length}〜{2 * generatedCopy.length}円
                            </p>
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        <button
                            onClick={onClose}
                            disabled={isRegenerating}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
                        >
                            キャンセル
                        </button>
                        {step === 'config' && (
                            <button
                                onClick={handleGenerate}
                                disabled={selectedSections.size === 0 || isGenerating}
                                className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-sm font-bold rounded-lg hover:from-emerald-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                <Wand2 className="h-4 w-4" />
                                コピーを生成
                            </button>
                        )}
                        {step === 'review' && (
                            <div className="flex gap-2">
                                {/* コピーのみ適用 */}
                                <button
                                    onClick={handleApply}
                                    disabled={isRegenerating}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 transition-all disabled:opacity-50"
                                >
                                    適用のみ
                                </button>
                                {/* 適用して再生成 */}
                                {onApplyAndRegenerate && (
                                    <button
                                        onClick={() => onApplyAndRegenerate(generatedCopy)}
                                        disabled={isRegenerating || generatedCopy.length === 0}
                                        className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-sm font-bold rounded-lg hover:from-emerald-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
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
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
