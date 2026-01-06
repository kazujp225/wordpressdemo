"use client";

import React, { useState } from 'react';
import { X, Loader2, Palette, Check, Sparkles, Eye, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { GEMINI_PRICING } from '@/lib/ai-costs';

interface Section {
    id: string;
    order: number;
    image?: {
        filePath: string;
    } | null;
}

interface Props {
    sections: Section[];
    selectedSectionIds: string[];
    onClose: () => void;
    onSuccess: (results: { sectionId: string; newImageUrl: string; newImageId: number }[]) => void;
}

type Resolution = '1K' | '2K' | '4K';
type Step = 'select-reference' | 'configure';

const RESOLUTION_OPTIONS: { value: Resolution; label: string; desc: string }[] = [
    { value: '1K', label: '1K', desc: '標準' },
    { value: '2K', label: '2K', desc: '高品質' },
    { value: '4K', label: '4K', desc: '最高品質' },
];

export function BackgroundUnifyModal({ sections, selectedSectionIds, onClose, onSuccess }: Props) {
    const [step, setStep] = useState<Step>('select-reference');
    const [referenceSectionId, setReferenceSectionId] = useState<string | null>(null);
    const [targetColor, setTargetColor] = useState('#FFFFFF');
    const [resolution, setResolution] = useState<Resolution>('1K');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const [detectedColor, setDetectedColor] = useState<{
        color: string;
        colorName: string;
        confidence: string;
        description: string;
    } | null>(null);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

    const selectedSections = sections.filter(s => selectedSectionIds.includes(s.id));
    const referenceSection = referenceSectionId ? sections.find(s => s.id === referenceSectionId) : null;

    // 参照セクションから背景色を自動検出
    const handleDetectColor = async () => {
        if (!referenceSection?.image?.filePath) {
            toast.error('参照セクションを選択してください');
            return;
        }

        setIsDetecting(true);
        setDetectedColor(null);

        try {
            const response = await fetch('/api/ai/extract-background-color', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl: referenceSection.image.filePath,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '検出に失敗しました');
            }

            const result = await response.json();
            setDetectedColor({
                color: result.color,
                colorName: result.colorName,
                confidence: result.confidence,
                description: result.description,
            });
            setTargetColor(result.color);
            toast.success(`背景色を検出しました: ${result.colorName}`);

        } catch (error: any) {
            toast.error(error.message || '背景色の検出に失敗しました');
        } finally {
            setIsDetecting(false);
        }
    };

    // 実行
    const handleExecute = async () => {
        // カラーコード検証
        if (!targetColor || !/^#[0-9A-Fa-f]{6}$/.test(targetColor)) {
            toast.error('有効なカラーコードを入力してください（例: #FFFFFF）');
            return;
        }

        // 対象セクション（参照セクション以外、かつ画像があるもの）
        const targetSections = selectedSections.filter(s =>
            s.id !== referenceSectionId && s.image?.filePath
        );

        if (targetSections.length === 0) {
            toast.error('変更対象のセクションがありません（画像がないセクションは除外されます）');
            return;
        }

        setIsProcessing(true);
        setProgress({ current: 0, total: targetSections.length });

        const results: { sectionId: string; newImageUrl: string; newImageId: number }[] = [];

        for (let i = 0; i < targetSections.length; i++) {
            const section = targetSections[i];
            setProgress({ current: i + 1, total: targetSections.length });

            try {
                const response = await fetch('/api/ai/background-unify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        targetImageUrl: section.image?.filePath,
                        targetSectionId: parseInt(section.id, 10),
                        masks: [{ x: 0, y: 0, width: 1, height: 1 }],
                        targetColor,
                        resolution,
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error(`Section ${section.id} failed:`, error);
                    toast.error(`セクション${section.order + 1}の処理に失敗しました`);
                    continue;
                }

                const result = await response.json();
                results.push({
                    sectionId: section.id,
                    newImageUrl: result.newImageUrl,
                    newImageId: result.newImageId,
                });

            } catch (error: any) {
                console.error(`Section ${section.id} error:`, error);
                toast.error(`セクション${section.order + 1}でエラーが発生しました`);
            }
        }

        setIsProcessing(false);
        setProgress(null);

        if (results.length > 0) {
            toast.success(`${results.length}件の背景色を変更しました`);
            onSuccess(results);
            onClose();
        } else {
            toast.error('すべてのセクションの処理に失敗しました');
            // モーダルは閉じない（再試行可能にする）
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-5 py-4 border-b bg-white">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Palette className="h-5 w-5 text-amber-600" />
                            背景色統一
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {step === 'select-reference'
                                ? 'ステップ1: 参照セクションを選択'
                                : 'ステップ2: 背景色と解像度を設定'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 overflow-y-auto p-5">
                    {!isProcessing ? (
                        <>
                            {/* ステップ1: 参照セクション選択 */}
                            {step === 'select-reference' && (
                                <>
                                    <div className="mb-4">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            参照セクションを選択（この画像の背景色を検出します）
                                        </label>
                                        <div className="grid grid-cols-4 gap-3 max-h-60 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                                            {selectedSections.map((section) => (
                                                <button
                                                    key={section.id}
                                                    onClick={() => setReferenceSectionId(section.id)}
                                                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                                                        referenceSectionId === section.id
                                                            ? 'border-blue-500 ring-2 ring-blue-200'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    {section.image?.filePath && (
                                                        <img
                                                            src={section.image.filePath}
                                                            alt={`Section ${section.order + 1}`}
                                                            className="w-full h-24 object-cover"
                                                        />
                                                    )}
                                                    <div className={`absolute bottom-0 left-0 right-0 text-[10px] font-bold text-center py-0.5 ${
                                                        referenceSectionId === section.id
                                                            ? 'bg-blue-500 text-white'
                                                            : 'bg-gray-800/70 text-white'
                                                    }`}>
                                                        {referenceSectionId === section.id ? (
                                                            <span className="flex items-center justify-center gap-1">
                                                                <Eye className="h-3 w-3" />
                                                                参照
                                                            </span>
                                                        ) : (
                                                            `セクション ${section.order + 1}`
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            参照セクションの背景色を他のセクションに適用します。参照セクション自体は変更されません。
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* ステップ2: 設定 */}
                            {step === 'configure' && (
                                <>
                                    {/* 参照セクションプレビュー */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            参照セクション
                                        </label>
                                        <div className="flex items-start gap-4">
                                            <div className="w-32 rounded-lg overflow-hidden border-2 border-blue-400">
                                                {referenceSection?.image?.filePath && (
                                                    <img
                                                        src={referenceSection.image.filePath}
                                                        alt="Reference"
                                                        className="w-full h-20 object-cover"
                                                    />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <button
                                                    onClick={handleDetectColor}
                                                    disabled={isDetecting}
                                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-bold rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50"
                                                >
                                                    {isDetecting ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Sparkles className="h-4 w-4" />
                                                    )}
                                                    背景色を自動検出
                                                </button>
                                                {detectedColor && (
                                                    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-10 h-10 rounded-lg border-2 border-blue-300"
                                                                style={{ backgroundColor: detectedColor.color }}
                                                            />
                                                            <div>
                                                                <p className="text-sm font-bold text-blue-800">
                                                                    {detectedColor.colorName}
                                                                </p>
                                                                <p className="text-xs text-blue-600">
                                                                    {detectedColor.color} • {detectedColor.description}
                                                                </p>
                                                            </div>
                                                            <Check className="h-5 w-5 text-green-500 ml-auto" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 対象セクション一覧 */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            変更対象セクション（{selectedSections.filter(s => s.id !== referenceSectionId).length}件）
                                        </label>
                                        <div className="grid grid-cols-6 gap-2 max-h-24 overflow-y-auto p-2 bg-amber-50 rounded-lg">
                                            {selectedSections
                                                .filter(s => s.id !== referenceSectionId)
                                                .map((section) => (
                                                    <div
                                                        key={section.id}
                                                        className="relative rounded overflow-hidden border-2 border-amber-300"
                                                    >
                                                        {section.image?.filePath && (
                                                            <img
                                                                src={section.image.filePath}
                                                                alt={`Section ${section.order + 1}`}
                                                                className="w-full h-12 object-cover"
                                                            />
                                                        )}
                                                        <div className="absolute bottom-0 left-0 right-0 bg-amber-500 text-white text-[8px] font-bold text-center">
                                                            {section.order + 1}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>

                                    {/* 背景色選択 */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            背景色
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-12 h-12 rounded-lg border-2 border-gray-300 shadow-inner"
                                                style={{ backgroundColor: targetColor }}
                                            />
                                            <input
                                                type="color"
                                                value={targetColor}
                                                onChange={(e) => setTargetColor(e.target.value)}
                                                className="w-12 h-12 rounded-lg cursor-pointer border-0"
                                            />
                                            <input
                                                type="text"
                                                value={targetColor}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                                        setTargetColor(val);
                                                    }
                                                }}
                                                placeholder="#FFFFFF"
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            />
                                        </div>
                                        {/* プリセットカラー */}
                                        <div className="flex gap-2 mt-2">
                                            {['#FFFFFF', '#F5F5F5', '#E0E0E0', '#000000', '#1a1a2e', '#16213e', '#0f3460'].map((color) => (
                                                <button
                                                    key={color}
                                                    onClick={() => setTargetColor(color)}
                                                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                                        targetColor === color
                                                            ? 'border-amber-500 ring-2 ring-amber-200'
                                                            : 'border-gray-300 hover:border-gray-400'
                                                    }`}
                                                    style={{ backgroundColor: color }}
                                                    title={color}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* 解像度選択 */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            出力解像度
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {RESOLUTION_OPTIONS.map(({ value, label, desc }) => (
                                                <button
                                                    key={value}
                                                    onClick={() => setResolution(value)}
                                                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                                                        resolution === value
                                                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                                                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <span className="text-lg font-bold">{label}</span>
                                                    <span className="text-xs">{desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        /* 処理中 */
                        <div className="py-12 flex flex-col items-center justify-center">
                            <Loader2 className="h-12 w-12 text-amber-600 animate-spin mb-4" />
                            <p className="text-sm font-medium text-gray-700">背景色を変更中...</p>
                            {progress && (
                                <div className="mt-4 w-full max-w-xs">
                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                        <span>進捗</span>
                                        <span>{progress.current} / {progress.total}</span>
                                    </div>
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-amber-500 transition-all duration-300"
                                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                                {resolution}解像度で処理しています
                            </p>
                        </div>
                    )}
                </div>

                {/* フッター */}
                {!isProcessing && (
                    <div className="px-5 py-4 border-t bg-gray-50">
                        {/* API課金費用の表示（configureステップ時） */}
                        {step === 'configure' && selectedSections.filter(s => s.id !== referenceSectionId).length > 0 && (
                            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs font-bold text-amber-800">
                                        この作業のAPI課金費用: 約${(selectedSections.filter(s => s.id !== referenceSectionId).length * GEMINI_PRICING['gemini-3-pro-image-preview'].perImage).toFixed(2)}
                                    </span>
                                </div>
                                <p className="text-[10px] text-amber-600 mt-1 ml-6">
                                    {selectedSections.filter(s => s.id !== referenceSectionId).length}件 × $0.04（Gemini 3 Pro Image）
                                </p>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => {
                                    if (step === 'configure') {
                                        setStep('select-reference');
                                        setDetectedColor(null);
                                    } else {
                                        onClose();
                                    }
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                            >
                                {step === 'configure' ? '戻る' : 'キャンセル'}
                            </button>

                            {step === 'select-reference' ? (
                                <button
                                    onClick={() => setStep('configure')}
                                    disabled={!referenceSectionId}
                                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    次へ
                                </button>
                            ) : (
                                <button
                                    onClick={handleExecute}
                                    disabled={selectedSections.filter(s => s.id !== referenceSectionId).length === 0}
                                    className="flex items-center gap-2 px-5 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Palette className="h-4 w-4" />
                                    {selectedSections.filter(s => s.id !== referenceSectionId).length}件の背景色を変更
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
