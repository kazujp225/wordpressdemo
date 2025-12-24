"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, Wand2, RotateCcw, ZoomIn, ZoomOut, Move, Trash2, Plus, DollarSign, Clock, Check } from 'lucide-react';

interface ImageInpaintEditorProps {
    imageUrl: string;
    onClose: () => void;
    onSave: (newImageUrl: string) => void;
}

interface SelectionRect {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export function ImageInpaintEditor({ imageUrl, onClose, onSave }: ImageInpaintEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [selections, setSelections] = useState<SelectionRect[]>([]);
    const [currentSelection, setCurrentSelection] = useState<SelectionRect | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [tool, setTool] = useState<'select' | 'pan'>('select');
    const [costInfo, setCostInfo] = useState<{ model: string; estimatedCost: number; durationMs: number } | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    // 画像を読み込み
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            setImage(img);
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth - 40;
                const containerHeight = containerRef.current.clientHeight - 40;
                const scaleX = containerWidth / img.width;
                const scaleY = containerHeight / img.height;
                const newScale = Math.min(scaleX, scaleY, 1);
                setScale(newScale);
                setOffset({
                    x: (containerWidth - img.width * newScale) / 2,
                    y: (containerHeight - img.height * newScale) / 2
                });
            }
        };
        img.onerror = () => {
            setError('画像の読み込みに失敗しました');
        };
        img.src = imageUrl;
    }, [imageUrl]);

    // キャンバスに描画
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (containerRef.current) {
            canvas.width = containerRef.current.clientWidth;
            canvas.height = containerRef.current.clientHeight;
        }

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);
        ctx.drawImage(image, 0, 0);
        ctx.restore();

        // 全ての選択範囲を描画
        const allSelections = currentSelection
            ? [...selections, currentSelection]
            : selections;

        allSelections.forEach((sel: SelectionRect, index: number) => {
            const scaledSel = {
                x: offset.x + sel.x * scale,
                y: offset.y + sel.y * scale,
                width: sel.width * scale,
                height: sel.height * scale
            };

            const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
            const color = colors[index % colors.length];

            // Glow Effect
            ctx.save();
            ctx.shadowBlur = 10;
            ctx.shadowColor = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(scaledSel.x, scaledSel.y, scaledSel.width, scaledSel.height);
            ctx.restore();

            // Border
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.strokeRect(scaledSel.x, scaledSel.y, scaledSel.width, scaledSel.height);

            // Number Label with premium pill shape
            ctx.fillStyle = color;
            const labelWidth = 28;
            const labelHeight = 20;
            const labelX = scaledSel.x;
            const labelY = scaledSel.y - labelHeight - 4;

            // Draw rounded rect for label
            ctx.beginPath();
            ctx.roundRect(labelX, labelY, labelWidth, labelHeight, 6);
            ctx.fill();

            ctx.fillStyle = 'white';
            ctx.font = 'black 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${index + 1}`, labelX + labelWidth / 2, labelY + 14);

            // Subtle corner accents
            const accentSize = 8;
            ctx.fillStyle = 'white';
            // Top-left
            ctx.fillRect(scaledSel.x - 2, scaledSel.y - 2, accentSize, 2);
            ctx.fillRect(scaledSel.x - 2, scaledSel.y - 2, 2, accentSize);
            // Top-right
            ctx.fillRect(scaledSel.x + scaledSel.width - accentSize + 2, scaledSel.y - 2, accentSize, 2);
            ctx.fillRect(scaledSel.x + scaledSel.width, scaledSel.y - 2, 2, accentSize);
        });
    }, [image, selections, currentSelection, scale, offset]);

    const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - offset.x) / scale;
        const y = (e.clientY - rect.top - offset.y) / scale;
        return { x, y };
    }, [offset, scale]);

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (tool === 'pan') {
            setIsPanning(true);
            setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
            return;
        }

        const coords = getCanvasCoords(e);
        setIsSelecting(true);
        setStartPoint(coords);
        setCurrentSelection(null);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isPanning) {
            setOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
            return;
        }

        if (!isSelecting || !image) return;

        const coords = getCanvasCoords(e);
        const newSelection: SelectionRect = {
            id: 'temp',
            x: Math.max(0, Math.min(startPoint.x, coords.x)),
            y: Math.max(0, Math.min(startPoint.y, coords.y)),
            width: Math.min(Math.abs(coords.x - startPoint.x), image.width - Math.min(startPoint.x, coords.x)),
            height: Math.min(Math.abs(coords.y - startPoint.y), image.height - Math.min(startPoint.y, coords.y))
        };
        setCurrentSelection(newSelection);
    };

    const handleMouseUp = () => {
        if (currentSelection && currentSelection.width > 10 && currentSelection.height > 10) {
            // 選択範囲を確定して追加
            setSelections(prev => [...prev, { ...currentSelection, id: Date.now().toString() }]);
        }
        setCurrentSelection(null);
        setIsSelecting(false);
        setIsPanning(false);
    };

    const removeSelection = (id: string) => {
        setSelections(prev => prev.filter(s => s.id !== id));
    };

    const clearAllSelections = () => {
        setSelections([]);
    };

    // インペインティング実行
    const handleInpaint = async () => {
        if (selections.length === 0 || !prompt.trim()) {
            setError('範囲を選択してプロンプトを入力してください');
            return;
        }

        if (!image) {
            setError('画像が読み込まれていません');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 複数の選択範囲を0-1の比率に変換
            const masks = selections.map(sel => ({
                x: sel.x / image.width,
                y: sel.y / image.height,
                width: sel.width / image.width,
                height: sel.height / image.height
            }));

            const response = await fetch('/api/ai/inpaint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl,
                    masks, // 複数のマスク
                    mask: masks[0], // 後方互換性のため
                    prompt: prompt.trim()
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'インペインティングに失敗しました');
            }

            if (result.success && result.media?.filePath) {
                // コスト情報を保存
                if (result.costInfo) {
                    setCostInfo(result.costInfo);
                }
                setShowSuccess(true);
                // 少し待ってから閉じる（コストを表示するため）
                setTimeout(() => {
                    onSave(result.media.filePath);
                }, 2000);
            } else {
                throw new Error(result.message || '画像の生成に失敗しました');
            }
        } catch (err: any) {
            setError(err.message || 'エラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleZoomIn = () => setScale(prev => Math.min(prev * 1.2, 3));
    const handleZoomOut = () => setScale(prev => Math.max(prev / 1.2, 0.2));
    const handleReset = () => {
        if (image && containerRef.current) {
            const containerWidth = containerRef.current.clientWidth - 40;
            const containerHeight = containerRef.current.clientHeight - 40;
            const scaleX = containerWidth / image.width;
            const scaleY = containerHeight / image.height;
            const newScale = Math.min(scaleX, scaleY, 1);
            setScale(newScale);
            setOffset({
                x: (containerWidth - image.width * newScale) / 2,
                y: (containerHeight - image.height * newScale) / 2
            });
        }
        setSelections([]);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-[95vw] h-[95vh] bg-gray-900 rounded-2xl overflow-hidden flex flex-col">
                {/* 成功オーバーレイ */}
                {showSuccess && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/95 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                                <Check className="w-10 h-10 text-green-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">画像を編集しました</h3>
                            {costInfo && (
                                <div className="flex items-center justify-center gap-4 mt-4 bg-gray-800/50 rounded-2xl px-6 py-4">
                                    <div className="text-center">
                                        <p className="text-xs text-gray-400 mb-1">コスト</p>
                                        <p className="text-xl font-bold text-green-400">${costInfo.estimatedCost.toFixed(4)}</p>
                                    </div>
                                    <div className="w-px h-10 bg-gray-700" />
                                    <div className="text-center">
                                        <p className="text-xs text-gray-400 mb-1">処理時間</p>
                                        <p className="text-xl font-bold text-blue-400">{(costInfo.durationMs / 1000).toFixed(1)}s</p>
                                    </div>
                                    <div className="w-px h-10 bg-gray-700" />
                                    <div className="text-center">
                                        <p className="text-xs text-gray-400 mb-1">モデル</p>
                                        <p className="text-sm font-medium text-gray-300">{costInfo.model}</p>
                                    </div>
                                </div>
                            )}
                            <p className="text-gray-400 text-sm mt-4">画面を閉じています...</p>
                        </div>
                    </div>
                )}
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-purple-400" />
                        画像の部分編集
                        <span className="text-sm font-normal text-gray-400">（複数選択可）</span>
                    </h2>
                    <div className="flex items-center gap-3">
                        {/* コスト表示 */}
                        {costInfo && (
                            <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-2 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="flex items-center gap-1.5 text-green-400">
                                    <DollarSign className="w-4 h-4" />
                                    <span className="text-sm font-bold">${costInfo.estimatedCost.toFixed(4)}</span>
                                </div>
                                <div className="w-px h-4 bg-gray-600" />
                                <div className="flex items-center gap-1.5 text-blue-400">
                                    <Clock className="w-4 h-4" />
                                    <span className="text-sm font-medium">{(costInfo.durationMs / 1000).toFixed(1)}s</span>
                                </div>
                                <div className="w-px h-4 bg-gray-600" />
                                <span className="text-xs text-gray-400">{costInfo.model}</span>
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex">
                    {/* キャンバスエリア */}
                    <div
                        ref={containerRef}
                        className="flex-1 relative bg-[#1a1a2e]"
                    >
                        <canvas
                            ref={canvasRef}
                            className={`w-full h-full ${tool === 'select' ? 'cursor-crosshair' : 'cursor-grab'}`}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        />

                        {/* ツールバー */}
                        <div className="absolute top-4 left-4 flex gap-2">
                            <button
                                onClick={() => setTool('select')}
                                className={`p-2 rounded-lg transition-colors ${tool === 'select' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                title="選択ツール"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setTool('pan')}
                                className={`p-2 rounded-lg transition-colors ${tool === 'pan' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                title="移動ツール"
                            >
                                <Move className="w-5 h-5" />
                            </button>
                            <div className="w-px bg-gray-600 mx-1" />
                            <button
                                onClick={handleZoomIn}
                                className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                                title="拡大"
                            >
                                <ZoomIn className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleZoomOut}
                                className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                                title="縮小"
                            >
                                <ZoomOut className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleReset}
                                className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                                title="リセット"
                            >
                                <RotateCcw className="w-5 h-5" />
                            </button>
                        </div>

                        {/* スケール表示 */}
                        <div className="absolute bottom-4 left-4 text-sm text-gray-400 bg-gray-800/80 px-3 py-1 rounded-lg">
                            {Math.round(scale * 100)}%
                        </div>
                    </div>

                    {/* サイドパネル */}
                    <div className="w-80 bg-gray-800 border-l border-gray-700 p-6 flex flex-col">
                        <h3 className="text-lg font-semibold text-white mb-4">編集指示</h3>

                        {/* 選択範囲リスト */}
                        {selections.length > 0 ? (
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm text-gray-300">選択範囲: {selections.length}箇所</p>
                                    <button
                                        onClick={clearAllSelections}
                                        className="text-xs text-red-400 hover:text-red-300"
                                    >
                                        全て削除
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {selections.map((sel, index) => {
                                        const colors = ['bg-blue-600', 'bg-green-600', 'bg-amber-600', 'bg-red-600', 'bg-purple-600'];
                                        return (
                                            <div key={sel.id} className="flex items-center justify-between p-2 bg-gray-700 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-5 h-5 rounded text-white text-xs flex items-center justify-center ${colors[index % colors.length]}`}>
                                                        {index + 1}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {Math.round(sel.width)}x{Math.round(sel.height)}px
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => removeSelection(sel.id)}
                                                    className="p-1 text-gray-400 hover:text-red-400"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
                                <p className="text-sm text-blue-300">
                                    画像上でドラッグして編集したい範囲を選択してください（複数選択可）
                                </p>
                            </div>
                        )}

                        {/* プロンプト入力 */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                修正指示
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="例: 選択した部分のテキストを「新発売」に変更"
                                className="w-full h-32 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            />
                        </div>

                        {/* エラー表示 */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                                <p className="text-sm text-red-300">{error}</p>
                            </div>
                        )}

                        <div className="mt-auto space-y-3">
                            <button
                                onClick={handleInpaint}
                                disabled={isLoading || selections.length === 0 || !prompt.trim()}
                                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        生成中...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="w-5 h-5" />
                                        {selections.length}箇所をAIで編集
                                    </>
                                )}
                            </button>

                            <button
                                onClick={onClose}
                                disabled={isLoading}
                                className="w-full py-3 px-4 bg-gray-700 text-gray-300 font-semibold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                            >
                                キャンセル
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
