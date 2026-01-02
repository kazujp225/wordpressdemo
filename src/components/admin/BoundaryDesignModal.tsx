"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, Scissors, ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface BoundaryInfo {
    index: number;
    upperSection: { id: string; image?: { filePath: string } | null };
    lowerSection: { id: string; image?: { filePath: string } | null };
}

interface BoundaryResult {
    boundaryIndex: number;
    upperSection: { sectionId: number; newImageUrl: string };
    lowerSection: { sectionId: number; newImageUrl: string };
    boundarySection: { sectionId: number; imageUrl: string; height: number };
}

interface Props {
    boundaries: BoundaryInfo[];
    onClose: () => void;
    onSuccess: (results: BoundaryResult[]) => void;
}

export function BoundaryDesignModal({ boundaries, onClose, onSuccess }: Props) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });

    // 各境界のカット量を管理
    const [cutAmounts, setCutAmounts] = useState<{ upper: number; lower: number }[]>(
        boundaries.map(() => ({ upper: 50, lower: 50 }))
    );

    // 参考画像
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // プレビュー用
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [images, setImages] = useState<{ upper: HTMLImageElement | null; lower: HTMLImageElement | null }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const current = boundaries[currentIndex];
    const currentCut = cutAmounts[currentIndex];

    // 画像読み込み
    useEffect(() => {
        const loadImages = async () => {
            setIsLoading(true);
            const loaded: { upper: HTMLImageElement | null; lower: HTMLImageElement | null }[] = [];

            for (const b of boundaries) {
                try {
                    const [upper, lower] = await Promise.all([
                        b.upperSection.image?.filePath ? loadImage(b.upperSection.image.filePath) : null,
                        b.lowerSection.image?.filePath ? loadImage(b.lowerSection.image.filePath) : null,
                    ]);
                    loaded.push({ upper, lower });
                } catch {
                    loaded.push({ upper: null, lower: null });
                }
            }

            setImages(loaded);
            setIsLoading(false);
        };

        loadImages();
    }, [boundaries]);

    const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    };

    // プレビュー描画
    const drawPreview = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        const imgs = images[currentIndex];

        if (!canvas || !container || !imgs?.upper || !imgs?.lower) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const containerWidth = container.clientWidth - 32;
        const { upper, lower } = currentCut;

        // 表示する高さ（カット範囲の上下に少し余白）
        const margin = 80;
        const displayUpperHeight = upper + margin;
        const displayLowerHeight = lower + margin;
        const totalDisplayHeight = displayUpperHeight + displayLowerHeight;

        // スケール計算
        const sourceWidth = Math.min(imgs.upper.width, imgs.lower.width);
        const scale = containerWidth / sourceWidth;
        const canvasHeight = totalDisplayHeight * scale;

        canvas.width = containerWidth;
        canvas.height = canvasHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 上セクションの下端を描画
        const upperSourceY = imgs.upper.height - displayUpperHeight;
        ctx.drawImage(
            imgs.upper,
            0, upperSourceY, imgs.upper.width, displayUpperHeight,
            0, 0, containerWidth, displayUpperHeight * scale
        );

        // 下セクションの上端を描画
        ctx.drawImage(
            imgs.lower,
            0, 0, imgs.lower.width, displayLowerHeight,
            0, displayUpperHeight * scale, containerWidth, displayLowerHeight * scale
        );

        // カットライン（上）
        const upperCutY = margin * scale;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(0, upperCutY);
        ctx.lineTo(containerWidth, upperCutY);
        ctx.stroke();

        // カットライン（下）
        const lowerCutY = (displayUpperHeight + lower) * scale;
        ctx.beginPath();
        ctx.moveTo(0, lowerCutY);
        ctx.lineTo(containerWidth, lowerCutY);
        ctx.stroke();

        // カット領域を薄く塗る
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(0, upperCutY, containerWidth, (upper + lower) * scale);

        // ラベル
        ctx.setLineDash([]);
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#ef4444';
        ctx.fillText(`↓ ${upper}px カット`, 8, upperCutY + 16);
        ctx.fillText(`↑ ${lower}px カット`, 8, lowerCutY - 6);

        // 生成される高さ
        ctx.fillStyle = '#fff';
        ctx.fillRect(containerWidth / 2 - 50, (displayUpperHeight - 10) * scale, 100, 20);
        ctx.fillStyle = '#7c3aed';
        ctx.textAlign = 'center';
        ctx.fillText(`生成: ${upper + lower}px`, containerWidth / 2, (displayUpperHeight + 4) * scale);
        ctx.textAlign = 'left';

    }, [images, currentIndex, currentCut]);

    useEffect(() => {
        if (!isLoading) drawPreview();
    }, [isLoading, drawPreview]);

    // カット量変更
    const updateCut = (type: 'upper' | 'lower', value: number) => {
        setCutAmounts(prev => {
            const next = [...prev];
            next[currentIndex] = { ...next[currentIndex], [type]: value };
            return next;
        });
    };

    // 参考画像アップロード
    const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            setReferenceImage(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    // 実行
    const handleExecute = async () => {
        setIsProcessing(true);

        try {
            const payload = {
                boundaries: boundaries.map((b, i) => ({
                    upperSectionId: Number(b.upperSection.id),
                    lowerSectionId: Number(b.lowerSection.id),
                    upperCut: cutAmounts[i].upper,
                    lowerCut: cutAmounts[i].lower,
                })),
                referenceImageBase64: referenceImage || undefined,
            };

            const response = await fetch('/api/sections/boundary-design', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error('API error');
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No reader');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'progress') {
                            setProgress({ current: data.current, total: data.total, message: data.message });
                        } else if (data.type === 'complete') {
                            toast.success(`${data.results.length}箇所の境界を修正しました`);
                            onSuccess(data.results);
                            onClose();
                        } else if (data.type === 'error') {
                            throw new Error(data.error);
                        }
                    } catch {}
                }
            }

        } catch (error: any) {
            toast.error(error.message || '処理に失敗しました');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-5 py-4 border-b">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">境界の修正</h2>
                        <p className="text-xs text-gray-500 mt-0.5">歪んだ部分をカットして繋ぎ直す</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* 処理中 */}
                {isProcessing ? (
                    <div className="p-8 flex flex-col items-center justify-center">
                        <Loader2 className="h-10 w-10 text-purple-600 animate-spin mb-4" />
                        <p className="text-sm font-medium text-gray-700">{progress.message}</p>
                        {progress.total > 0 && (
                            <div className="w-full max-w-xs mt-4">
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-purple-600 transition-all"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 text-center mt-2">
                                    {progress.current} / {progress.total}
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* ページング */}
                        {boundaries.length > 1 && (
                            <div className="flex items-center justify-between px-5 py-2 bg-gray-50 border-b">
                                <button
                                    onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                                    disabled={currentIndex === 0}
                                    className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <span className="text-sm font-medium text-gray-600">
                                    境界 {currentIndex + 1} / {boundaries.length}
                                </span>
                                <button
                                    onClick={() => setCurrentIndex(i => Math.min(boundaries.length - 1, i + 1))}
                                    disabled={currentIndex === boundaries.length - 1}
                                    className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </div>
                        )}

                        {/* プレビュー */}
                        <div ref={containerRef} className="p-4 bg-gray-100">
                            {isLoading ? (
                                <div className="h-48 flex items-center justify-center">
                                    <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
                                </div>
                            ) : (
                                <canvas ref={canvasRef} className="w-full rounded-lg shadow" />
                            )}
                        </div>

                        {/* カット量設定 */}
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">
                                        <Scissors className="inline h-3 w-3 mr-1" />
                                        上セクションからカット
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="0"
                                            max="300"
                                            step="10"
                                            value={currentCut.upper}
                                            onChange={(e) => updateCut('upper', Number(e.target.value))}
                                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                                        />
                                        <span className="text-sm font-bold text-gray-700 w-14 text-right">
                                            {currentCut.upper}px
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">
                                        <Scissors className="inline h-3 w-3 mr-1" />
                                        下セクションからカット
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="0"
                                            max="300"
                                            step="10"
                                            value={currentCut.lower}
                                            onChange={(e) => updateCut('lower', Number(e.target.value))}
                                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                                        />
                                        <span className="text-sm font-bold text-gray-700 w-14 text-right">
                                            {currentCut.lower}px
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 生成サイズ表示 */}
                            <div className="text-center py-2 bg-purple-50 rounded-lg">
                                <span className="text-sm text-purple-700">
                                    生成される画像: <strong>{currentCut.upper + currentCut.lower}px</strong>
                                </span>
                            </div>

                            {/* 参考画像 */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">
                                    <ImagePlus className="inline h-3 w-3 mr-1" />
                                    参考画像（任意）
                                </label>
                                {referenceImage ? (
                                    <div className="relative">
                                        <img src={referenceImage} alt="Reference" className="w-full h-20 object-cover rounded-lg" />
                                        <button
                                            onClick={() => setReferenceImage(null)}
                                            className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        クリックして画像を選択
                                    </button>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleReferenceUpload}
                                    className="hidden"
                                />
                            </div>
                        </div>

                        {/* フッター */}
                        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t bg-gray-50">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleExecute}
                                disabled={boundaries.some((_, i) => cutAmounts[i].upper + cutAmounts[i].lower < 10)}
                                className="px-5 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Scissors className="h-4 w-4" />
                                {boundaries.length > 1 ? `${boundaries.length}箇所を修正` : '修正を実行'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
