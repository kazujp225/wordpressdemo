'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Crop, Check, RotateCcw, Maximize2, ChevronUp, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface SectionCropModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    sectionId: string;
    onCrop: (sectionId: string, cropData: CropData) => Promise<void>;
}

interface CropData {
    startY: number; // 開始Y位置（0-1の割合）
    endY: number;   // 終了Y位置（0-1の割合）
    action: 'crop' | 'split'; // クロップか分割か
}

export default function SectionCropModal({
    isOpen,
    onClose,
    imageUrl,
    sectionId,
    onCrop
}: SectionCropModalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [cropArea, setCropArea] = useState({ startY: 0, endY: 1 });
    const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    const [action, setAction] = useState<'crop' | 'split'>('crop');

    // 画像サイズを取得
    useEffect(() => {
        if (isOpen && imageUrl) {
            const img = new Image();
            img.onload = () => {
                setImageSize({ width: img.width, height: img.height });
                setImageLoaded(true);
                // 初期値：上部70%を選択
                setCropArea({ startY: 0, endY: 0.7 });
            };
            img.src = imageUrl;
        }
    }, [isOpen, imageUrl]);

    const handleMouseDown = (handle: 'start' | 'end') => (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(handle);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        setCropArea(prev => {
            if (isDragging === 'start') {
                return { ...prev, startY: Math.min(y, prev.endY - 0.05) };
            } else {
                return { ...prev, endY: Math.max(y, prev.startY + 0.05) };
            }
        });
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(null);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const handleCrop = async () => {
        setIsCropping(true);
        try {
            await onCrop(sectionId, {
                startY: cropArea.startY,
                endY: cropArea.endY,
                action
            });
            toast.success(action === 'crop' ? '画像をクロップしました' : 'セクションを分割しました');
            onClose();
        } catch (error: any) {
            toast.error(error.message || '処理に失敗しました');
        } finally {
            setIsCropping(false);
        }
    };

    const resetCrop = () => {
        setCropArea({ startY: 0, endY: 1 });
    };

    // クロップ領域のピクセル高さ
    const cropHeightPx = Math.round(imageSize.height * (cropArea.endY - cropArea.startY));
    const cropStartPx = Math.round(imageSize.height * cropArea.startY);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-black flex items-center justify-center shadow-lg">
                            <Crop className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">部分カット</h2>
                            <p className="text-xs text-gray-500">画像の一部を切り取り・削除</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {/* 左: 画像プレビュー */}
                    <div className="flex-1 p-6 bg-gray-900 flex items-start justify-center overflow-auto">
                        {imageLoaded ? (
                            <div
                                ref={containerRef}
                                className="relative w-full"
                                style={{ maxWidth: '800px' }}
                            >
                                {/* 元画像 */}
                                <img
                                    src={imageUrl}
                                    alt="Section"
                                    className="w-full h-auto"
                                    draggable={false}
                                />

                                {/* 上部の暗いオーバーレイ（選択外） */}
                                <div
                                    className="absolute left-0 right-0 top-0 bg-black/60 pointer-events-none"
                                    style={{ height: `${cropArea.startY * 100}%` }}
                                />

                                {/* 下部の暗いオーバーレイ（選択外） */}
                                <div
                                    className="absolute left-0 right-0 bottom-0 bg-black/60 pointer-events-none"
                                    style={{ height: `${(1 - cropArea.endY) * 100}%` }}
                                />

                                {/* 選択領域の境界線 */}
                                <div
                                    className="absolute left-0 right-0 border-2 border-dashed border-white pointer-events-none"
                                    style={{
                                        top: `${cropArea.startY * 100}%`,
                                        bottom: `${(1 - cropArea.endY) * 100}%`
                                    }}
                                />

                                {/* 上部ハンドル */}
                                <div
                                    className="absolute left-0 right-0 h-6 cursor-ns-resize flex items-center justify-center"
                                    style={{ top: `calc(${cropArea.startY * 100}% - 12px)` }}
                                    onMouseDown={handleMouseDown('start')}
                                >
                                    <div className="bg-black text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                                        <ChevronUp className="h-3 w-3" />
                                        上端
                                    </div>
                                </div>

                                {/* 下部ハンドル */}
                                <div
                                    className="absolute left-0 right-0 h-6 cursor-ns-resize flex items-center justify-center"
                                    style={{ top: `calc(${cropArea.endY * 100}% - 12px)` }}
                                    onMouseDown={handleMouseDown('end')}
                                >
                                    <div className="bg-black text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                                        <ChevronDown className="h-3 w-3" />
                                        下端
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-white">読み込み中...</div>
                        )}
                    </div>

                    {/* 右: 設定パネル */}
                    <div className="w-72 bg-gray-50 p-6 overflow-y-auto">
                        {/* アクション選択 */}
                        <div className="mb-6">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">処理方法</h3>
                            <div className="space-y-2">
                                <button
                                    onClick={() => setAction('crop')}
                                    className={clsx(
                                        "w-full p-3 rounded-xl border-2 text-left transition-all",
                                        action === 'crop'
                                            ? "border-gray-900 bg-gray-50"
                                            : "border-gray-200 hover:border-gray-300"
                                    )}
                                >
                                    <p className="text-sm font-medium text-gray-900">クロップ（切り取り）</p>
                                    <p className="text-xs text-gray-500">選択範囲だけを残す</p>
                                </button>
                                <button
                                    onClick={() => setAction('split')}
                                    className={clsx(
                                        "w-full p-3 rounded-xl border-2 text-left transition-all",
                                        action === 'split'
                                            ? "border-gray-900 bg-gray-50"
                                            : "border-gray-200 hover:border-gray-300"
                                    )}
                                >
                                    <p className="text-sm font-medium text-gray-900">分割</p>
                                    <p className="text-xs text-gray-500">選択範囲で2つに分ける</p>
                                </button>
                            </div>
                        </div>

                        {/* 選択情報 */}
                        <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200">
                            <h4 className="text-xs font-bold text-gray-500 mb-2">選択範囲</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">開始位置</span>
                                    <span className="font-mono text-gray-900">{Math.round(cropArea.startY * 100)}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">終了位置</span>
                                    <span className="font-mono text-gray-900">{Math.round(cropArea.endY * 100)}%</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t">
                                    <span className="text-gray-600">高さ</span>
                                    <span className="font-mono text-gray-900 font-bold">{cropHeightPx}px</span>
                                </div>
                            </div>
                        </div>

                        {/* リセットボタン */}
                        <button
                            onClick={resetCrop}
                            className="w-full py-2 text-sm text-gray-600 hover:text-gray-800 flex items-center justify-center gap-2"
                        >
                            <RotateCcw className="h-4 w-4" />
                            選択をリセット
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleCrop}
                        disabled={isCropping}
                        className="px-6 py-2 bg-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {isCropping ? (
                            <>処理中...</>
                        ) : (
                            <>
                                <Check className="h-4 w-4" />
                                {action === 'crop' ? 'クロップ実行' : '分割実行'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
