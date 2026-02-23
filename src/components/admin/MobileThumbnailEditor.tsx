'use client';

import React, { useState, useCallback } from 'react';
import { X, Upload, ImageIcon, Loader2, Download, Check, RefreshCw, ArrowRight, Monitor } from 'lucide-react';

interface Section {
    id: string;
    order: number;
    role: string;
    image?: {
        filePath?: string;
    };
}

interface MobileThumbnailEditorProps {
    isOpen: boolean;
    onClose: () => void;
    sections: Section[];
    onSectionImageUpdate: (sectionId: string, newImageUrl: string) => void;
}

export default function MobileThumbnailEditor({
    isOpen,
    onClose,
    sections,
    onSectionImageUpdate,
}: MobileThumbnailEditorProps) {
    const [selectedSectionId, setSelectedSectionId] = useState<string>('');
    const [referenceImage, setReferenceImage] = useState<string>('');
    const [resultImage, setResultImage] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentStep, setCurrentStep] = useState<number>(0);
    const [error, setError] = useState<string>('');
    const [uploadMode, setUploadMode] = useState<'transform' | 'replace'>('transform');

    const sectionsWithImages = sections.filter(s => s.image?.filePath);
    const selectedSection = sectionsWithImages.find(s => s.id === selectedSectionId);
    const sourceImageUrl = selectedSection?.image?.filePath || '';

    const steps = [
        '元画像を分析中...',
        '参考サムネイルを分析中...',
        'サムネイルを生成中...',
    ];

    // 参考サムネイル選択
    const handleReferenceUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            setReferenceImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    }, []);

    // 画像直接アップロード（差し替えモード）
    const handleDirectUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedSectionId) return;

        setIsGenerating(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'アップロードに失敗しました');

            setResultImage(data.url);
            onSectionImageUpdate(selectedSectionId, data.url);
        } catch (err: any) {
            setError(err.message || 'アップロードに失敗しました');
        } finally {
            setIsGenerating(false);
        }
    }, [selectedSectionId, onSectionImageUpdate]);

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

    // AI変換生成
    const handleGenerate = async () => {
        if (!sourceImageUrl || !referenceImage) {
            setError('元画像と参考サムネイルの両方を選択してください');
            return;
        }

        setIsGenerating(true);
        setError('');
        setResultImage('');
        setCurrentStep(0);

        try {
            const sourceBase64 = await urlToBase64(sourceImageUrl);

            const stepInterval = setInterval(() => {
                setCurrentStep(prev => Math.min(prev + 1, 2));
            }, 3000);

            const response = await fetch('/api/ai/image-transform', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'thumbnail',
                    sourceImageBase64: sourceBase64,
                    referenceImageBase64: referenceImage,
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

    // 結果を適用
    const handleApplyResult = () => {
        if (!resultImage || !selectedSectionId) return;
        onSectionImageUpdate(selectedSectionId, resultImage);
        onClose();
    };

    // ダウンロード
    const handleDownload = () => {
        if (!resultImage) return;
        const link = document.createElement('a');
        link.href = resultImage;
        link.download = `thumbnail_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const resetState = () => {
        setSelectedSectionId('');
        setReferenceImage('');
        setResultImage('');
        setError('');
        setCurrentStep(0);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex flex-col">
            {/* ヘッダー */}
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-base font-bold text-gray-900">サムネイル編集</h2>
                    <p className="text-xs text-gray-500">画像の変更・AI変換</p>
                </div>
                <button
                    onClick={() => { resetState(); onClose(); }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* コンテンツ */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
                <div className="p-4 space-y-5">

                    {/* ステップ1: セクション選択 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            1. 変更したい画像を選択
                        </label>
                        {sectionsWithImages.length === 0 ? (
                            <div className="text-sm text-gray-500 bg-white p-4 rounded-xl text-center border border-gray-200">
                                画像があるセクションがありません
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {sectionsWithImages.map((section, index) => (
                                    <button
                                        key={section.id}
                                        onClick={() => { setSelectedSectionId(section.id); setResultImage(''); }}
                                        className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-[9/16] ${selectedSectionId === section.id
                                                ? 'border-blue-500 ring-2 ring-blue-200 shadow-lg'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <img
                                            src={section.image?.filePath}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                        {selectedSectionId === section.id && (
                                            <div className="absolute top-1.5 right-1.5 bg-blue-500 rounded-full p-0.5">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                        <div className="absolute bottom-0 inset-x-0 bg-black/50 py-1">
                                            <span className="text-[10px] text-white font-medium">
                                                {index + 1}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ステップ2: 操作方法選択 */}
                    {selectedSectionId && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                2. 操作を選択
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setUploadMode('replace')}
                                    className={`p-3 rounded-xl border-2 text-center transition-all ${uploadMode === 'replace'
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 bg-white'
                                        }`}
                                >
                                    <Upload className={`w-5 h-5 mx-auto mb-1.5 ${uploadMode === 'replace' ? 'text-blue-600' : 'text-gray-400'}`} />
                                    <span className={`text-xs font-bold ${uploadMode === 'replace' ? 'text-blue-700' : 'text-gray-600'}`}>
                                        画像を差し替え
                                    </span>
                                    <p className="text-[10px] text-gray-400 mt-0.5">直接アップロード</p>
                                </button>
                                <button
                                    onClick={() => setUploadMode('transform')}
                                    className={`p-3 rounded-xl border-2 text-center transition-all ${uploadMode === 'transform'
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 bg-white'
                                        }`}
                                >
                                    <RefreshCw className={`w-5 h-5 mx-auto mb-1.5 ${uploadMode === 'transform' ? 'text-blue-600' : 'text-gray-400'}`} />
                                    <span className={`text-xs font-bold ${uploadMode === 'transform' ? 'text-blue-700' : 'text-gray-600'}`}>
                                        AI変換
                                    </span>
                                    <p className="text-[10px] text-gray-400 mt-0.5">参考画像を元に変換</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 差し替えモード */}
                    {selectedSectionId && uploadMode === 'replace' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                3. 新しい画像をアップロード
                            </label>
                            <label className="block cursor-pointer">
                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors bg-white">
                                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-600 font-medium block">
                                        タップして画像を選択
                                    </span>
                                    <span className="text-xs text-gray-400 mt-1 block">
                                        カメラロールから選択できます
                                    </span>
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleDirectUpload}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    )}

                    {/* AI変換モード */}
                    {selectedSectionId && uploadMode === 'transform' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                3. 参考サムネイルをアップロード
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-blue-400 transition-colors bg-white">
                                {referenceImage ? (
                                    <div className="relative">
                                        <img
                                            src={referenceImage}
                                            alt="Reference"
                                            className="max-h-32 mx-auto rounded-lg object-contain"
                                        />
                                        <button
                                            onClick={() => setReferenceImage('')}
                                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="cursor-pointer block">
                                        <ImageIcon className="w-6 h-6 mx-auto text-gray-400 mb-1.5" />
                                        <span className="text-sm text-gray-500">参考にしたいサムネイルを選択</span>
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
                    )}

                    {/* 進捗表示 */}
                    {isGenerating && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                <span className="text-sm font-medium text-blue-700">
                                    {uploadMode === 'replace' ? 'アップロード中...' : steps[currentStep]}
                                </span>
                            </div>
                            {uploadMode === 'transform' && (
                                <>
                                    <div className="flex gap-1.5">
                                        {steps.map((_, index) => (
                                            <div
                                                key={index}
                                                className={`flex-1 h-1 rounded-full transition-all ${index <= currentStep ? 'bg-blue-500' : 'bg-blue-200'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-xs text-blue-600 mt-1.5">
                                        ステップ {currentStep + 1} / {steps.length}
                                    </p>
                                </>
                            )}
                        </div>
                    )}

                    {/* エラー */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    {/* 結果表示 */}
                    {resultImage && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                生成結果
                            </label>
                            <div className="border rounded-xl p-3 bg-white">
                                <img
                                    src={resultImage}
                                    alt="Result"
                                    className="w-full rounded-lg object-contain"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* フッター */}
            <div className="bg-white border-t px-4 py-3 shrink-0 space-y-2">
                {resultImage && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleDownload}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            保存
                        </button>
                        <button
                            onClick={handleApplyResult}
                            className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
                        >
                            <Check className="w-4 h-4" />
                            この画像を適用
                        </button>
                    </div>
                )}
                {!resultImage && selectedSectionId && uploadMode === 'transform' && (
                    <button
                        onClick={handleGenerate}
                        disabled={!sourceImageUrl || !referenceImage || isGenerating}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                処理中...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4" />
                                サムネイルを生成
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
