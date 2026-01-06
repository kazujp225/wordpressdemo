"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, Wand2, MousePointer2, Eraser, RotateCcw, Check, ChevronLeft, ChevronRight, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { GEMINI_PRICING } from '@/lib/ai-costs';

interface MaskArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Section {
    id: string;
    order: number;
    image?: {
        filePath: string;
    } | null;
}

interface Props {
    sections: Section[];
    targetSectionId: string;
    onClose: () => void;
    onSuccess: (sectionId: string, newImageUrl: string, newImageId: number) => void;
}

type Step = 'select-reference' | 'draw-mask' | 'processing';

export function DesignUnifyModal({ sections, targetSectionId, onClose, onSuccess }: Props) {
    const [step, setStep] = useState<Step>('select-reference');
    const [referenceSectionId, setReferenceSectionId] = useState<string | null>(null);
    const [masks, setMasks] = useState<MaskArea[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [additionalPrompt, setAdditionalPrompt] = useState('');

    // キャンバス関連
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const [currentRect, setCurrentRect] = useState<MaskArea | null>(null);
    const [tool, setTool] = useState<'select' | 'erase'>('select');

    const targetSection = sections.find(s => s.id === targetSectionId);
    const referenceSection = referenceSectionId ? sections.find(s => s.id === referenceSectionId) : null;

    // 参照可能なセクション（ターゲット以外）
    const availableReferences = sections.filter(s => s.id !== targetSectionId && s.image?.filePath);

    // 画像読み込み
    useEffect(() => {
        if (step === 'draw-mask' && targetSection?.image?.filePath) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => setImage(img);
            img.src = targetSection.image.filePath;
        }
    }, [step, targetSection]);

    // キャンバス描画
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !image) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const containerWidth = container.clientWidth - 32;
        const scale = containerWidth / image.width;
        const canvasHeight = image.height * scale;

        canvas.width = containerWidth;
        canvas.height = canvasHeight;

        // 画像描画
        ctx.drawImage(image, 0, 0, containerWidth, canvasHeight);

        // マスク描画
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = 2;

        for (const mask of masks) {
            const x = mask.x * containerWidth;
            const y = mask.y * canvasHeight;
            const w = mask.width * containerWidth;
            const h = mask.height * canvasHeight;
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
        }

        // 現在描画中の矩形
        if (currentRect) {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
            const x = currentRect.x * containerWidth;
            const y = currentRect.y * canvasHeight;
            const w = currentRect.width * containerWidth;
            const h = currentRect.height * canvasHeight;
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
        }
    }, [image, masks, currentRect]);

    useEffect(() => {
        drawCanvas();
    }, [drawCanvas]);

    // マウスイベント
    const getRelativePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / canvas.width,
            y: (e.clientY - rect.top) / canvas.height,
        };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = getRelativePos(e);

        if (tool === 'erase') {
            // 消しゴム: クリック位置にあるマスクを削除
            const newMasks = masks.filter(mask => {
                const inX = pos.x >= mask.x && pos.x <= mask.x + mask.width;
                const inY = pos.y >= mask.y && pos.y <= mask.y + mask.height;
                return !(inX && inY);
            });
            setMasks(newMasks);
        } else {
            // 選択: 矩形描画開始
            setIsDrawing(true);
            setStartPos(pos);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !startPos || tool !== 'select') return;

        const pos = getRelativePos(e);
        setCurrentRect({
            x: Math.min(startPos.x, pos.x),
            y: Math.min(startPos.y, pos.y),
            width: Math.abs(pos.x - startPos.x),
            height: Math.abs(pos.y - startPos.y),
        });
    };

    const handleMouseUp = () => {
        if (isDrawing && currentRect && currentRect.width > 0.01 && currentRect.height > 0.01) {
            setMasks([...masks, currentRect]);
        }
        setIsDrawing(false);
        setStartPos(null);
        setCurrentRect(null);
    };

    // 実行
    const handleExecute = async () => {
        if (!referenceSectionId || !referenceSection?.image?.filePath) {
            toast.error('参照セクションを選択してください');
            return;
        }

        if (masks.length === 0) {
            toast.error('修正領域を選択してください');
            return;
        }

        setStep('processing');
        setIsProcessing(true);

        try {
            const response = await fetch('/api/ai/design-unify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    referenceImageUrl: referenceSection.image.filePath,
                    targetImageUrl: targetSection?.image?.filePath,
                    targetSectionId: parseInt(targetSectionId, 10),
                    masks,
                    prompt: additionalPrompt || undefined,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed');
            }

            const result = await response.json();
            toast.success('デザイン統一が完了しました');
            onSuccess(targetSectionId, result.newImageUrl, result.newImageId);
            onClose();

        } catch (error: any) {
            toast.error(error.message || 'エラーが発生しました');
            setStep('draw-mask');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-5 py-4 border-b bg-white">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Wand2 className="h-5 w-5 text-purple-600" />
                            デザイン統一
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {step === 'select-reference' && 'ステップ1: 参照セクションを選択'}
                            {step === 'draw-mask' && 'ステップ2: 修正領域を選択'}
                            {step === 'processing' && '処理中...'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 overflow-y-auto">
                    {/* ステップ1: 参照セクション選択 */}
                    {step === 'select-reference' && (
                        <div className="p-5">
                            <div className="mb-4">
                                <h3 className="text-sm font-bold text-gray-700 mb-2">修正対象セクション</h3>
                                {targetSection?.image?.filePath && (
                                    <div className="border-2 border-red-300 rounded-lg overflow-hidden">
                                        <div className="max-h-48 overflow-y-auto">
                                            <img
                                                src={targetSection.image.filePath}
                                                alt="Target"
                                                className="w-full h-auto"
                                            />
                                        </div>
                                        <div className="bg-red-50 px-3 py-1.5 text-xs text-red-700 font-medium">
                                            このセクションのデザインを修正します
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mb-4">
                                <h3 className="text-sm font-bold text-gray-700 mb-2">参照セクションを選択（デザインの正解）</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {availableReferences.map((section) => (
                                        <button
                                            key={section.id}
                                            onClick={() => setReferenceSectionId(section.id)}
                                            className={`border-2 rounded-lg overflow-hidden transition-all ${
                                                referenceSectionId === section.id
                                                    ? 'border-purple-500 ring-2 ring-purple-200'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            {section.image?.filePath && (
                                                <div className="max-h-40 overflow-y-auto">
                                                    <img
                                                        src={section.image.filePath}
                                                        alt={`Section ${section.order}`}
                                                        className="w-full h-auto"
                                                    />
                                                </div>
                                            )}
                                            <div className={`px-3 py-1.5 text-xs font-medium ${
                                                referenceSectionId === section.id
                                                    ? 'bg-purple-50 text-purple-700'
                                                    : 'bg-gray-50 text-gray-600'
                                            }`}>
                                                セクション {section.order + 1}
                                                {referenceSectionId === section.id && (
                                                    <Check className="inline h-3 w-3 ml-1" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {availableReferences.length === 0 && (
                                <p className="text-sm text-gray-500 text-center py-8">
                                    参照可能なセクションがありません
                                </p>
                            )}
                        </div>
                    )}

                    {/* ステップ2: マスク描画 */}
                    {step === 'draw-mask' && (
                        <div className="p-5">
                            {/* 参照画像プレビュー */}
                            <div className="mb-4">
                                <h3 className="text-sm font-bold text-gray-700 mb-2">参照デザイン</h3>
                                {referenceSection?.image?.filePath && (
                                    <div className="max-h-32 overflow-y-auto rounded-lg border">
                                        <img
                                            src={referenceSection.image.filePath}
                                            alt="Reference"
                                            className="w-full h-auto"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* ツールバー */}
                            <div className="flex items-center gap-2 mb-3">
                                <button
                                    onClick={() => setTool('select')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        tool === 'select'
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    <MousePointer2 className="h-4 w-4" />
                                    選択
                                </button>
                                <button
                                    onClick={() => setTool('erase')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        tool === 'erase'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    <Eraser className="h-4 w-4" />
                                    消す
                                </button>
                                <button
                                    onClick={() => setMasks([])}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    リセット
                                </button>
                                <span className="ml-auto text-xs text-gray-500">
                                    {masks.length}個の領域を選択中
                                </span>
                            </div>

                            {/* キャンバス */}
                            <div ref={containerRef} className="bg-gray-100 rounded-lg p-4">
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                                    <p className="text-xs font-bold text-amber-800 mb-1">⚠️ 重要：1つずつ選択</p>
                                    <p className="text-xs text-amber-700">
                                        <strong>1回の実行で1箇所だけ</strong>選択してください。
                                        複数箇所を同時に選択すると結果が崩れます。
                                    </p>
                                </div>
                                {masks.length > 1 && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                                        <p className="text-xs font-bold text-red-800">
                                            ⛔ {masks.length}箇所選択中 - 1箇所だけにしてください
                                        </p>
                                    </div>
                                )}
                                <p className="text-xs text-gray-500 mb-2">
                                    修正したい要素をドラッグで選択（赤い領域が修正対象）
                                </p>
                                <canvas
                                    ref={canvasRef}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                    className="w-full rounded-lg cursor-crosshair shadow"
                                />
                            </div>

                            {/* 追加指示 */}
                            <div className="mt-4">
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">
                                    追加指示（オプション）
                                </label>
                                <input
                                    type="text"
                                    value={additionalPrompt}
                                    onChange={(e) => setAdditionalPrompt(e.target.value)}
                                    placeholder="例: バッジを緑色にする、アイコンのスタイルを揃える"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">
                                    具体的に指示すると精度が上がります（例：「Merit 1と同じ緑のバッジにする」）
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 処理中 */}
                    {step === 'processing' && (
                        <div className="p-12 flex flex-col items-center justify-center">
                            <Loader2 className="h-12 w-12 text-purple-600 animate-spin mb-4" />
                            <p className="text-sm font-medium text-gray-700">デザインを統一中...</p>
                            <p className="text-xs text-gray-500 mt-2">AIが参照デザインに合わせて修正しています</p>
                        </div>
                    )}
                </div>

                {/* フッター */}
                {step !== 'processing' && (
                    <div className="px-5 py-4 border-t bg-gray-50">
                        {/* API課金費用の表示（draw-maskステップ時） */}
                        {step === 'draw-mask' && masks.length === 1 && (
                            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs font-bold text-amber-800">
                                        この作業のAPI課金費用: 約${GEMINI_PRICING['gemini-3-pro-image-preview'].perImage.toFixed(2)}
                                    </span>
                                </div>
                                <p className="text-[10px] text-amber-600 mt-1 ml-6">
                                    画像1枚 × $0.04（Gemini 3 Pro Image）
                                </p>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => {
                                    if (step === 'draw-mask') {
                                        setStep('select-reference');
                                        setMasks([]);
                                    } else {
                                        onClose();
                                    }
                                }}
                                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                {step === 'draw-mask' ? '戻る' : 'キャンセル'}
                            </button>

                            {step === 'select-reference' && (
                                <button
                                    onClick={() => setStep('draw-mask')}
                                    disabled={!referenceSectionId}
                                    className="flex items-center gap-1 px-5 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    次へ
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            )}

                            {step === 'draw-mask' && (
                                <button
                                    onClick={handleExecute}
                                    disabled={masks.length === 0 || masks.length > 1}
                                    className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Wand2 className="h-4 w-4" />
                                    {masks.length > 1 ? '1箇所だけ選択してください' : 'デザイン統一を実行'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
