"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, Expand, ImagePlus, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    sectionId: string;
    imageUrl: string;
    onClose: () => void;
    onSuccess: (newImageUrl: string, newImageId: number) => void;
}

type Direction = 'top' | 'bottom' | 'both';

export function RestoreModal({ sectionId, imageUrl, onClose, onSuccess }: Props) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [direction, setDirection] = useState<Direction>('bottom');
    const [topAmount, setTopAmount] = useState(100);
    const [bottomAmount, setBottomAmount] = useState(100);
    const [prompt, setPrompt] = useState('');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [creativity, setCreativity] = useState<'low' | 'medium' | 'high'>('medium');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // プレビュー用
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 画像読み込み
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            setImage(img);
            setIsLoading(false);
        };
        img.onerror = () => setIsLoading(false);
        img.src = imageUrl;
    }, [imageUrl]);

    // プレビュー描画
    const drawPreview = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;

        if (!canvas || !container || !image) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const containerWidth = container.clientWidth - 32;
        const scale = containerWidth / image.width;

        const actualTop = direction === 'top' || direction === 'both' ? topAmount : 0;
        const actualBottom = direction === 'bottom' || direction === 'both' ? bottomAmount : 0;

        const totalHeight = image.height + actualTop + actualBottom;
        const canvasHeight = totalHeight * scale;

        canvas.width = containerWidth;
        canvas.height = canvasHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 上の増築部分（薄い緑）
        if (actualTop > 0) {
            ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
            ctx.fillRect(0, 0, containerWidth, actualTop * scale);

            // ラベル
            ctx.fillStyle = '#16a34a';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`+${actualTop}px 増築`, containerWidth / 2, actualTop * scale / 2 + 4);

            // 破線
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(0, actualTop * scale);
            ctx.lineTo(containerWidth, actualTop * scale);
            ctx.stroke();
        }

        // 元の画像
        ctx.drawImage(
            image,
            0, 0, image.width, image.height,
            0, actualTop * scale, containerWidth, image.height * scale
        );

        // 下の増築部分（薄い緑）
        if (actualBottom > 0) {
            const bottomY = (actualTop + image.height) * scale;
            ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
            ctx.fillRect(0, bottomY, containerWidth, actualBottom * scale);

            // ラベル
            ctx.fillStyle = '#16a34a';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`+${actualBottom}px 増築`, containerWidth / 2, bottomY + actualBottom * scale / 2 + 4);

            // 破線
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(0, bottomY);
            ctx.lineTo(containerWidth, bottomY);
            ctx.stroke();
        }

        ctx.setLineDash([]);
        ctx.textAlign = 'left';

    }, [image, direction, topAmount, bottomAmount]);

    useEffect(() => {
        if (!isLoading) drawPreview();
    }, [isLoading, drawPreview]);

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
        if (!prompt.trim()) {
            toast.error('復元の指示を入力してください');
            return;
        }

        setIsProcessing(true);

        try {
            const response = await fetch(`/api/sections/${sectionId}/restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    direction,
                    topAmount: direction === 'top' || direction === 'both' ? topAmount : 0,
                    bottomAmount: direction === 'bottom' || direction === 'both' ? bottomAmount : 0,
                    prompt,
                    referenceImageBase64: referenceImage || undefined,
                    creativity,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to restore');
            }

            const result = await response.json();
            toast.success('復元が完了しました');
            onSuccess(result.newImageUrl, result.newImageId);
            onClose();

        } catch (error: any) {
            toast.error(error.message || '復元に失敗しました');
        } finally {
            setIsProcessing(false);
        }
    };

    const actualTop = direction === 'top' || direction === 'both' ? topAmount : 0;
    const actualBottom = direction === 'bottom' || direction === 'both' ? bottomAmount : 0;
    const totalAddition = actualTop + actualBottom;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Expand className="h-5 w-5 text-green-600" />
                            セクション復元
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">カットしすぎた部分を増築して復元</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {isProcessing ? (
                    <div className="p-8 flex flex-col items-center justify-center">
                        <Loader2 className="h-10 w-10 text-green-600 animate-spin mb-4" />
                        <p className="text-sm font-medium text-gray-700">復元中...</p>
                        <p className="text-xs text-gray-500 mt-2">AIが画像を生成しています</p>
                    </div>
                ) : (
                    <>
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

                        {/* 設定 */}
                        <div className="p-5 space-y-4">
                            {/* 増築方向 */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2">増築方向</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: 'top', label: '上に増築', icon: ArrowUp },
                                        { value: 'bottom', label: '下に増築', icon: ArrowDown },
                                        { value: 'both', label: '上下両方', icon: ArrowUpDown },
                                    ].map(({ value, label, icon: Icon }) => (
                                        <button
                                            key={value}
                                            onClick={() => setDirection(value as Direction)}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                                                direction === value
                                                    ? 'border-green-500 bg-green-50 text-green-700'
                                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                            }`}
                                        >
                                            <Icon className="h-5 w-5" />
                                            <span className="text-xs font-medium">{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 増築量 */}
                            <div className="space-y-3">
                                {(direction === 'top' || direction === 'both') && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5">
                                            <ArrowUp className="inline h-3 w-3 mr-1" />
                                            上への増築量
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range"
                                                min="50"
                                                max="400"
                                                step="10"
                                                value={topAmount}
                                                onChange={(e) => setTopAmount(Number(e.target.value))}
                                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                                            />
                                            <span className="text-sm font-bold text-gray-700 w-16 text-right">
                                                {topAmount}px
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {(direction === 'bottom' || direction === 'both') && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5">
                                            <ArrowDown className="inline h-3 w-3 mr-1" />
                                            下への増築量
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range"
                                                min="50"
                                                max="400"
                                                step="10"
                                                value={bottomAmount}
                                                onChange={(e) => setBottomAmount(Number(e.target.value))}
                                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                                            />
                                            <span className="text-sm font-bold text-gray-700 w-16 text-right">
                                                {bottomAmount}px
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* 合計表示 */}
                                <div className="text-center py-2 bg-green-50 rounded-lg">
                                    <span className="text-sm text-green-700">
                                        合計増築: <strong>+{totalAddition}px</strong>
                                    </span>
                                </div>
                            </div>

                            {/* 復元の指示 */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">
                                    復元の指示 <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="例: 緑色の角丸ボックスが3つ並んでいるので、その続きを完成させて"
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    カットされた部分に何があったか、どう復元して欲しいかを伝えてください
                                </p>
                            </div>

                            {/* 生成モード */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2">生成モード</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: 'low', label: '正確重視', desc: '元画像に忠実' },
                                        { value: 'medium', label: 'バランス', desc: 'おすすめ' },
                                        { value: 'high', label: '創造的', desc: '自由度高め' },
                                    ].map(({ value, label, desc }) => (
                                        <button
                                            key={value}
                                            onClick={() => setCreativity(value as 'low' | 'medium' | 'high')}
                                            className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all ${
                                                creativity === value
                                                    ? 'border-green-500 bg-green-50 text-green-700'
                                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                            }`}
                                        >
                                            <span className="text-xs font-medium">{label}</span>
                                            <span className="text-[10px] text-gray-400">{desc}</span>
                                        </button>
                                    ))}
                                </div>
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
                        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t bg-gray-50 sticky bottom-0">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleExecute}
                                disabled={!prompt.trim() || totalAddition < 10}
                                className="px-5 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Expand className="h-4 w-4" />
                                復元実行
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
