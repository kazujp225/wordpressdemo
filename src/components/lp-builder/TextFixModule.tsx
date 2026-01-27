"use client";

import React, { useState } from 'react';
import { Loader2, Sparkles, Eye, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface SelectionRect {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface TextFixModuleProps {
    imageUrl: string;
    selections: SelectionRect[];
    imageWidth: number;
    imageHeight: number;
    onTextFixed: (newImageUrl: string) => void;
    onError: (error: string) => void;
    disabled?: boolean;
}

export function TextFixModule({
    imageUrl,
    selections,
    imageWidth,
    imageHeight,
    onTextFixed,
    onError,
    disabled = false,
}: TextFixModuleProps) {
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [isFixLoading, setIsFixLoading] = useState(false);
    const [ocrResult, setOcrResult] = useState<string>('');
    const [correctedText, setCorrectedText] = useState<string>('');
    const [ocrComplete, setOcrComplete] = useState(false);

    // OCR実行
    const handleOcr = async () => {
        if (selections.length === 0) {
            onError('文字化けしている領域を選択してください');
            return;
        }

        setIsOcrLoading(true);
        setOcrComplete(false);

        try {
            // 全ての選択範囲の座標を0-1の比率に変換
            const cropAreas = selections.map(sel => ({
                x: sel.x / imageWidth,
                y: sel.y / imageHeight,
                width: sel.width / imageWidth,
                height: sel.height / imageHeight,
            }));

            console.log('[TextFixModule] Sending OCR request with', cropAreas.length, 'areas:', cropAreas);

            const response = await fetch('/api/ai/ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl,
                    cropAreas, // 複数範囲を送信
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'OCR処理に失敗しました');
            }

            if (result.success && result.text) {
                setOcrResult(result.text);
                setCorrectedText(result.text); // 初期値として設定
                setOcrComplete(true);
            } else {
                throw new Error('テキストを認識できませんでした');
            }
        } catch (err: any) {
            onError(err.message || 'OCR処理中にエラーが発生しました');
        } finally {
            setIsOcrLoading(false);
        }
    };

    // 文字修正実行
    const handleTextFix = async () => {
        if (!correctedText.trim()) {
            onError('修正後のテキストを入力してください');
            return;
        }

        if (selections.length === 0) {
            onError('修正する領域を選択してください');
            return;
        }

        setIsFixLoading(true);

        try {
            // 選択範囲を0-1の比率に変換
            const masks = selections.map(sel => ({
                x: sel.x / imageWidth,
                y: sel.y / imageHeight,
                width: sel.width / imageWidth,
                height: sel.height / imageHeight,
            }));

            const response = await fetch('/api/ai/text-fix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl,
                    masks,
                    originalText: ocrResult,
                    correctedText: correctedText.trim(),
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'テキスト修正に失敗しました');
            }

            if (result.success && result.media?.filePath) {
                onTextFixed(result.media.filePath);
                // リセット
                setOcrResult('');
                setCorrectedText('');
                setOcrComplete(false);
            } else {
                throw new Error(result.message || 'テキスト修正画像の生成に失敗しました');
            }
        } catch (err: any) {
            onError(err.message || 'テキスト修正中にエラーが発生しました');
        } finally {
            setIsFixLoading(false);
        }
    };

    // リセット
    const handleReset = () => {
        setOcrResult('');
        setCorrectedText('');
        setOcrComplete(false);
    };

    const isProcessing = isOcrLoading || isFixLoading;
    const hasSelections = selections.length > 0;

    return (
        <div className="space-y-4">
            {/* Step 1: OCR */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">1</span>
                    <span className="text-sm font-bold text-foreground">文字を読み取る</span>
                    {ocrComplete && (
                        <Check className="w-4 h-4 text-green-500" />
                    )}
                </div>

                {!hasSelections ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-700">
                            まず画像上で文字化けしている領域を選択してください
                        </p>
                    </div>
                ) : !ocrComplete ? (
                    <button
                        onClick={handleOcr}
                        disabled={isOcrLoading || !hasSelections || disabled}
                        className="w-full py-3 px-4 bg-amber-500 text-white font-bold text-sm rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isOcrLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {selections.length > 1 ? `${selections.length}箇所の文字を認識中...` : '文字を認識中...'}
                            </>
                        ) : (
                            <>
                                <Eye className="w-4 h-4" />
                                {selections.length > 1 ? `${selections.length}箇所の文字を読み取る` : '選択範囲の文字を読み取る'}
                            </>
                        )}
                    </button>
                ) : (
                    <div className="p-4 bg-white border border-amber-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-amber-700 uppercase">認識結果</span>
                            <button
                                onClick={handleReset}
                                disabled={isProcessing}
                                className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 disabled:opacity-50"
                            >
                                <RefreshCw className="w-3 h-3" />
                                リセット
                            </button>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words bg-amber-50 p-3 rounded-md border border-amber-100">
                            {ocrResult || '(テキストなし)'}
                        </p>
                    </div>
                )}
            </div>

            {/* Step 2: Edit & Fix */}
            {ocrComplete && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-6 h-6 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">2</span>
                        <span className="text-sm font-bold text-foreground">正しいテキストに修正</span>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">
                                正しいテキスト（編集可能）
                            </label>
                            <textarea
                                value={correctedText}
                                onChange={(e) => setCorrectedText(e.target.value)}
                                placeholder="正しいテキストを入力..."
                                rows={4}
                                disabled={isProcessing || disabled}
                                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none disabled:opacity-50"
                            />
                        </div>

                        <button
                            onClick={handleTextFix}
                            disabled={isFixLoading || !correctedText.trim() || disabled}
                            className="w-full py-4 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                        >
                            {isFixLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    文字を修正中...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    くっきり綺麗に修正する
                                </>
                            )}
                        </button>

                        <p className="text-xs text-muted-foreground text-center">
                            文字を新しく描画し直し、くっきりと読みやすくします
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
