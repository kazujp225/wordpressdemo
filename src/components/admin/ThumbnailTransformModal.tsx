'use client';

import React, { useState, useCallback } from 'react';
import { X, Upload, ImageIcon, Loader2, Download, ArrowRight, Check } from 'lucide-react';

interface Section {
    id: string;
    image?: {
        filePath?: string;
    };
}

interface ThumbnailTransformModalProps {
    isOpen: boolean;
    onClose: () => void;
    sections: Section[]; // エディタのセクション一覧
}

export default function ThumbnailTransformModal({
    isOpen,
    onClose,
    sections,
}: ThumbnailTransformModalProps) {
    const [selectedSectionId, setSelectedSectionId] = useState<string>('');
    const [referenceImage, setReferenceImage] = useState<string>('');
    const [resultImage, setResultImage] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentStep, setCurrentStep] = useState<number>(0);
    const [error, setError] = useState<string>('');

    // 画像があるセクションのみフィルタ
    const sectionsWithImages = sections.filter(s => s.image?.filePath);

    const selectedSection = sectionsWithImages.find(s => s.id === selectedSectionId);
    const sourceImageUrl = selectedSection?.image?.filePath || '';

    const steps = referenceImage
        ? [
            '元画像を分析中...',
            '参考サムネイルを分析中...',
            'サムネイルを生成中...',
        ]
        : [
            '元画像を分析中...',
            'サムネイルを生成中...',
        ];

    const handleReferenceUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            setReferenceImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    }, []);

    // 画像URLをBase64に変換
    const urlToBase64 = async (url: string): Promise<string> => {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleGenerate = async () => {
        if (!sourceImageUrl) {
            setError('元画像を選択してください');
            return;
        }

        setIsGenerating(true);
        setError('');
        setResultImage('');
        setCurrentStep(0);

        try {
            // 元画像をBase64に変換
            const sourceBase64 = await urlToBase64(sourceImageUrl);

            // ステップ表示を更新するためのシミュレーション
            // 実際のAPIは内部で3ステップ処理するが、フロントでは進捗を推定
            const stepInterval = setInterval(() => {
                setCurrentStep(prev => Math.min(prev + 1, 2));
            }, 3000);

            const response = await fetch('/api/ai/image-transform', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'thumbnail',
                    sourceImageBase64: sourceBase64,
                    referenceImageBase64: referenceImage || undefined, // 参考画像はオプション
                }),
            });

            clearInterval(stepInterval);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || 'Failed to generate');
            }

            if (data.images && data.images.length > 0) {
                setResultImage(data.images[0]);
            }
        } catch (err: any) {
            setError(err.message || '生成に失敗しました');
        } finally {
            setIsGenerating(false);
            setCurrentStep(0);
        }
    };

    const handleDownload = () => {
        if (!resultImage) return;

        const link = document.createElement('a');
        link.href = resultImage;
        link.download = `thumbnail_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">サムネイル用に変換</h2>
                        <p className="text-sm text-gray-500">参考サムネイルのスタイルでテキストも含めて変換します</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {/* Step 1: Select source image from sections */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            1. 元画像を選択
                        </label>
                        {sectionsWithImages.length === 0 ? (
                            <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg text-center">
                                画像があるセクションがありません
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 gap-2">
                                {sectionsWithImages.map((section) => (
                                    <button
                                        key={section.id}
                                        onClick={() => setSelectedSectionId(section.id)}
                                        className={`relative rounded-lg overflow-hidden border-2 transition-all aspect-video ${
                                            selectedSectionId === section.id
                                                ? 'border-blue-500 ring-2 ring-blue-200'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <img
                                            src={section.image?.filePath}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                        {selectedSectionId === section.id && (
                                            <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-0.5">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Step 2: Upload reference thumbnail (Optional) */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            2. 参考サムネイルをアップロード <span className="text-gray-400 font-normal">(任意)</span>
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                            {referenceImage ? (
                                <div className="relative">
                                    <img
                                        src={referenceImage}
                                        alt="Reference"
                                        className="max-h-40 mx-auto rounded-lg object-contain"
                                    />
                                    <button
                                        onClick={() => setReferenceImage('')}
                                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="cursor-pointer block">
                                    <ImageIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-500">参考にしたいサムネイルを選択</span>
                                    <p className="text-xs text-gray-400 mt-1">なくてもAIがスタイルを自動で決定します</p>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleReferenceUpload}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Processing Steps */}
                    {isGenerating && (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                <span className="text-sm font-medium text-blue-700">
                                    {steps[currentStep]}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                {steps.map((step, index) => (
                                    <div
                                        key={index}
                                        className={`flex-1 h-1.5 rounded-full transition-all ${
                                            index <= currentStep ? 'bg-blue-500' : 'bg-blue-200'
                                        }`}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-blue-600 mt-2">
                                ステップ {currentStep + 1} / {steps.length}
                            </p>
                        </div>
                    )}

                    {/* Arrow indicator */}
                    {sourceImageUrl && !isGenerating && !resultImage && (
                        <div className="flex items-center justify-center mb-6">
                            <ArrowRight className="w-8 h-8 text-blue-500" />
                        </div>
                    )}

                    {/* Result Section */}
                    {resultImage && (
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                生成結果
                            </label>
                            <div className="border rounded-lg p-4 bg-gray-50">
                                <img
                                    src={resultImage}
                                    alt="Result"
                                    className="max-h-64 mx-auto rounded-lg object-contain"
                                />
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                    <p className="text-xs text-gray-500">
                        OCR分析（2回）+ 画像生成（1回）で処理します
                    </p>
                    <div className="flex gap-3">
                        {resultImage && (
                            <button
                                onClick={handleDownload}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                ダウンロード
                            </button>
                        )}
                        <button
                            onClick={handleGenerate}
                            disabled={!sourceImageUrl || isGenerating}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    処理中...
                                </>
                            ) : (
                                <>
                                    <ImageIcon className="w-4 h-4" />
                                    サムネイルを生成
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
