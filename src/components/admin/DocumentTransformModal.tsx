'use client';

import React, { useState, useCallback } from 'react';
import { X, FileText, Loader2, Download, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface Section {
    id: string;
    image?: {
        filePath?: string;
    };
}

interface DocumentTransformModalProps {
    isOpen: boolean;
    onClose: () => void;
    sections: Section[]; // エディタのセクション一覧
}

export default function DocumentTransformModal({
    isOpen,
    onClose,
    sections,
}: DocumentTransformModalProps) {
    const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
    const [slideCount, setSlideCount] = useState<number>(3);
    const [resultImages, setResultImages] = useState<string[]>([]);
    const [currentSlide, setCurrentSlide] = useState<number>(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState<string>('');
    const [error, setError] = useState<string>('');

    // 画像があるセクションのみフィルタ
    const sectionsWithImages = sections.filter(s => s.image?.filePath);

    const toggleSection = (sectionId: string) => {
        setSelectedSectionIds(prev =>
            prev.includes(sectionId)
                ? prev.filter(id => id !== sectionId)
                : [...prev, sectionId]
        );
    };

    const selectAll = () => {
        setSelectedSectionIds(sectionsWithImages.map(s => s.id));
    };

    const deselectAll = () => {
        setSelectedSectionIds([]);
    };

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

    // 複数画像を1つに結合（縦に連結）
    const combineImages = async (imageUrls: string[]): Promise<string> => {
        const images = await Promise.all(
            imageUrls.map(url => {
                return new Promise<HTMLImageElement>((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => resolve(img);
                    img.src = url;
                });
            })
        );

        // 最大幅を計算
        const maxWidth = Math.max(...images.map(img => img.width));
        const totalHeight = images.reduce((sum, img) => sum + img.height, 0);

        const canvas = document.createElement('canvas');
        canvas.width = maxWidth;
        canvas.height = Math.min(totalHeight, 4000); // 最大高さを制限
        const ctx = canvas.getContext('2d')!;

        let y = 0;
        for (const img of images) {
            const scale = maxWidth / img.width;
            const height = img.height * scale;
            if (y + height > canvas.height) break;
            ctx.drawImage(img, 0, y, maxWidth, height);
            y += height;
        }

        return canvas.toDataURL('image/png');
    };

    const handleGenerate = async () => {
        if (selectedSectionIds.length === 0) {
            setError('画像を選択してください');
            return;
        }

        setIsGenerating(true);
        setError('');
        setResultImages([]);
        setProgress('画像を準備中...');

        try {
            // 選択されたセクションの画像URLを取得
            const selectedSections = sectionsWithImages.filter(s => selectedSectionIds.includes(s.id));
            const imageUrls = selectedSections.map(s => s.image!.filePath!);

            // 画像を結合
            setProgress('画像を結合中...');
            const combinedBase64 = await combineImages(imageUrls);

            setProgress(`資料を生成中... (0/${slideCount}枚)`);

            const response = await fetch('/api/ai/image-transform', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'document',
                    sourceImageBase64: combinedBase64,
                    slideCount,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || 'Failed to generate');
            }

            if (data.images && data.images.length > 0) {
                setResultImages(data.images);
                setCurrentSlide(0);
            }
        } catch (err: any) {
            setError(err.message || '生成に失敗しました');
        } finally {
            setIsGenerating(false);
            setProgress('');
        }
    };

    const handleDownloadAll = () => {
        resultImages.forEach((img, index) => {
            const link = document.createElement('a');
            link.href = img;
            link.download = `slide_${index + 1}_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    };

    const handleDownloadCurrent = () => {
        if (!resultImages[currentSlide]) return;

        const link = document.createElement('a');
        link.href = resultImages[currentSlide];
        link.download = `slide_${currentSlide + 1}_${Date.now()}.png`;
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
                        <h2 className="text-lg font-bold text-gray-900">資料にする</h2>
                        <p className="text-sm text-gray-500">画像からプレゼン資料風のスライドを生成します</p>
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
                    {/* Step 1: Select source images */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                1. 元画像を選択（複数可）
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={selectAll}
                                    className="text-xs text-blue-600 hover:underline"
                                >
                                    すべて選択
                                </button>
                                <span className="text-gray-300">|</span>
                                <button
                                    onClick={deselectAll}
                                    className="text-xs text-gray-500 hover:underline"
                                >
                                    選択解除
                                </button>
                            </div>
                        </div>
                        {sectionsWithImages.length === 0 ? (
                            <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg text-center">
                                画像があるセクションがありません
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 gap-2">
                                {sectionsWithImages.map((section) => (
                                    <button
                                        key={section.id}
                                        onClick={() => toggleSection(section.id)}
                                        className={`relative rounded-lg overflow-hidden border-2 transition-all aspect-video ${
                                            selectedSectionIds.includes(section.id)
                                                ? 'border-blue-500 ring-2 ring-blue-200'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <img
                                            src={section.image?.filePath}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                        {selectedSectionIds.includes(section.id) && (
                                            <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-0.5">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                        {selectedSectionIds.length > 0 && (
                            <p className="text-xs text-gray-500 mt-2">
                                {selectedSectionIds.length}枚選択中
                            </p>
                        )}
                    </div>

                    {/* Step 2: Slide Count */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            2. スライド枚数
                        </label>
                        <div className="flex items-center gap-2">
                            {[1, 3, 5, 7, 10].map((count) => (
                                <button
                                    key={count}
                                    onClick={() => setSlideCount(count)}
                                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                        slideCount === count
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                                    }`}
                                >
                                    {count}枚
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Progress */}
                    {progress && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-600 text-sm flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {progress}
                        </div>
                    )}

                    {/* Result Section */}
                    {resultImages.length > 0 && (
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    生成結果 ({currentSlide + 1}/{resultImages.length}枚)
                                </label>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                                        disabled={currentSlide === 0}
                                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentSlide(Math.min(resultImages.length - 1, currentSlide + 1))}
                                        disabled={currentSlide === resultImages.length - 1}
                                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="border rounded-lg p-4 bg-gray-50">
                                <img
                                    src={resultImages[currentSlide]}
                                    alt={`Slide ${currentSlide + 1}`}
                                    className="max-h-64 mx-auto rounded-lg object-contain"
                                />
                            </div>
                            {/* Thumbnail navigation */}
                            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                                {resultImages.map((img, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentSlide(index)}
                                        className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                                            currentSlide === index
                                                ? 'border-blue-500'
                                                : 'border-transparent hover:border-gray-300'
                                        }`}
                                    >
                                        <img
                                            src={img}
                                            alt={`Thumbnail ${index + 1}`}
                                            className="w-16 h-10 object-cover"
                                        />
                                    </button>
                                ))}
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
                <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                    {resultImages.length > 0 && (
                        <>
                            <button
                                onClick={handleDownloadCurrent}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                この1枚
                            </button>
                            <button
                                onClick={handleDownloadAll}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                全てダウンロード
                            </button>
                        </>
                    )}
                    <button
                        onClick={handleGenerate}
                        disabled={selectedSectionIds.length === 0 || isGenerating}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                生成中...
                            </>
                        ) : (
                            <>
                                <FileText className="w-4 h-4" />
                                資料を生成
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
