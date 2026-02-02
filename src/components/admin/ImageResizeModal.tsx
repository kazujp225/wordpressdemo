"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, Wand2, Download, RotateCcw, Check, Maximize2, Minimize2, Move, Crop, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

// アスペクト比プリセット
const ASPECT_RATIO_PRESETS = [
    { label: '1:1 (正方形)', value: '1:1', width: 1, height: 1 },
    { label: '16:9 (YouTube)', value: '16:9', width: 16, height: 9 },
    { label: '9:16 (ストーリー)', value: '9:16', width: 9, height: 16 },
    { label: '4:3 (標準)', value: '4:3', width: 4, height: 3 },
    { label: '3:4 (ポートレート)', value: '3:4', width: 3, height: 4 },
    { label: '21:9 (ウルトラワイド)', value: '21:9', width: 21, height: 9 },
    { label: '2:1 (パノラマ)', value: '2:1', width: 2, height: 1 },
    { label: 'カスタム', value: 'custom', width: 0, height: 0 },
];

// SNSサイズプリセット
const SIZE_PRESETS = [
    { label: 'Instagram投稿', width: 1080, height: 1080, platform: 'instagram' },
    { label: 'Instagramストーリー', width: 1080, height: 1920, platform: 'instagram' },
    { label: 'Twitter投稿', width: 1200, height: 675, platform: 'twitter' },
    { label: 'Twitterヘッダー', width: 1500, height: 500, platform: 'twitter' },
    { label: 'Facebookカバー', width: 820, height: 312, platform: 'facebook' },
    { label: 'Facebook投稿', width: 1200, height: 630, platform: 'facebook' },
    { label: 'YouTubeサムネイル', width: 1280, height: 720, platform: 'youtube' },
    { label: 'OGP画像', width: 1200, height: 630, platform: 'ogp' },
    { label: 'Webバナー (728x90)', width: 728, height: 90, platform: 'web' },
    { label: 'Webバナー (300x250)', width: 300, height: 250, platform: 'web' },
];

type ResizeMode = 'crop' | 'resize' | 'outpaint';

interface ImageResizeModalProps {
    imageUrl: string;
    onClose: () => void;
    onSave: (newImageUrl: string, newImageId?: number) => void;
}

export function ImageResizeModal({ imageUrl, onClose, onSave }: ImageResizeModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });
    const [mode, setMode] = useState<ResizeMode>('crop');

    // クロップ用state
    const [cropRect, setCropRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragType, setDragType] = useState<'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [cropStart, setCropStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

    // アスペクト比
    const [selectedAspect, setSelectedAspect] = useState<string>('custom');
    const [lockAspectRatio, setLockAspectRatio] = useState(false);
    const [customAspect, setCustomAspect] = useState({ width: 16, height: 9 });

    // リサイズ用state
    const [targetSize, setTargetSize] = useState({ width: 0, height: 0 });
    const [maintainAspect, setMaintainAspect] = useState(true);

    // アウトペインティング用state
    const [outpaintDirection, setOutpaintDirection] = useState<'left' | 'right' | 'top' | 'bottom' | 'all'>('all');
    const [outpaintAmount, setOutpaintAmount] = useState(50); // パーセント
    const [outpaintPrompt, setOutpaintPrompt] = useState('');

    // 処理状態
    const [isProcessing, setIsProcessing] = useState(false);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // 画像読み込み
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            setImage(img);
            setOriginalSize({ width: img.width, height: img.height });
            setTargetSize({ width: img.width, height: img.height });
            setCropRect({ x: 0, y: 0, width: img.width, height: img.height });

            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth - 40;
                const containerHeight = containerRef.current.clientHeight - 40;
                const scaleX = containerWidth / img.width;
                const scaleY = containerHeight / img.height;
                const newScale = Math.min(scaleX, scaleY, 1);
                setScale(newScale);
                setOffset({
                    x: (containerWidth - img.width * newScale) / 2 + 20,
                    y: (containerHeight - img.height * newScale) / 2 + 20
                });
            }
        };
        img.src = imageUrl;
    }, [imageUrl]);

    // キャンバス描画
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (containerRef.current) {
            canvas.width = containerRef.current.clientWidth;
            canvas.height = containerRef.current.clientHeight;
        }

        // 背景
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 画像描画
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);
        ctx.drawImage(image, 0, 0);

        // クロップモード時のオーバーレイ
        if (mode === 'crop') {
            // クロップ外を暗くする
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, image.width, cropRect.y);
            ctx.fillRect(0, cropRect.y, cropRect.x, cropRect.height);
            ctx.fillRect(cropRect.x + cropRect.width, cropRect.y, image.width - cropRect.x - cropRect.width, cropRect.height);
            ctx.fillRect(0, cropRect.y + cropRect.height, image.width, image.height - cropRect.y - cropRect.height);

            // クロップ枠
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2 / scale;
            ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);

            // グリッドライン（三分割法）
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1 / scale;
            const thirdW = cropRect.width / 3;
            const thirdH = cropRect.height / 3;
            ctx.beginPath();
            ctx.moveTo(cropRect.x + thirdW, cropRect.y);
            ctx.lineTo(cropRect.x + thirdW, cropRect.y + cropRect.height);
            ctx.moveTo(cropRect.x + thirdW * 2, cropRect.y);
            ctx.lineTo(cropRect.x + thirdW * 2, cropRect.y + cropRect.height);
            ctx.moveTo(cropRect.x, cropRect.y + thirdH);
            ctx.lineTo(cropRect.x + cropRect.width, cropRect.y + thirdH);
            ctx.moveTo(cropRect.x, cropRect.y + thirdH * 2);
            ctx.lineTo(cropRect.x + cropRect.width, cropRect.y + thirdH * 2);
            ctx.stroke();

            // コーナーハンドル
            const handleSize = 10 / scale;
            ctx.fillStyle = '#3b82f6';
            [[cropRect.x, cropRect.y], [cropRect.x + cropRect.width, cropRect.y],
             [cropRect.x, cropRect.y + cropRect.height], [cropRect.x + cropRect.width, cropRect.y + cropRect.height]].forEach(([hx, hy]) => {
                ctx.fillRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
            });
        }

        // アウトペイントモードのプレビュー
        if (mode === 'outpaint') {
            const expandX = outpaintDirection === 'left' || outpaintDirection === 'right' || outpaintDirection === 'all'
                ? image.width * (outpaintAmount / 100) : 0;
            const expandY = outpaintDirection === 'top' || outpaintDirection === 'bottom' || outpaintDirection === 'all'
                ? image.height * (outpaintAmount / 100) : 0;

            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2 / scale;
            ctx.setLineDash([5 / scale, 5 / scale]);

            const newX = outpaintDirection === 'left' || outpaintDirection === 'all' ? -expandX : 0;
            const newY = outpaintDirection === 'top' || outpaintDirection === 'all' ? -expandY : 0;
            const newW = image.width + (outpaintDirection === 'all' ? expandX * 2 : expandX);
            const newH = image.height + (outpaintDirection === 'all' ? expandY * 2 : expandY);

            ctx.strokeRect(newX, newY, newW, newH);
            ctx.setLineDash([]);

            // 拡張エリアをハイライト
            ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
            if (outpaintDirection === 'left' || outpaintDirection === 'all') {
                ctx.fillRect(-expandX, outpaintDirection === 'all' ? -expandY : 0, expandX, outpaintDirection === 'all' ? image.height + expandY * 2 : image.height);
            }
            if (outpaintDirection === 'right' || outpaintDirection === 'all') {
                ctx.fillRect(image.width, outpaintDirection === 'all' ? -expandY : 0, expandX, outpaintDirection === 'all' ? image.height + expandY * 2 : image.height);
            }
            if (outpaintDirection === 'top' || outpaintDirection === 'all') {
                ctx.fillRect(0, -expandY, image.width, expandY);
            }
            if (outpaintDirection === 'bottom' || outpaintDirection === 'all') {
                ctx.fillRect(0, image.height, image.width, expandY);
            }
        }

        ctx.restore();
    }, [image, scale, offset, cropRect, mode, outpaintDirection, outpaintAmount]);

    // マウスイベント
    const handleMouseDown = (e: React.MouseEvent) => {
        if (mode !== 'crop' || !image) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - offset.x) / scale;
        const y = (e.clientY - rect.top - offset.y) / scale;

        // コーナーハンドルのチェック
        const handleSize = 15 / scale;
        const corners = [
            { type: 'resize-nw' as const, x: cropRect.x, y: cropRect.y },
            { type: 'resize-ne' as const, x: cropRect.x + cropRect.width, y: cropRect.y },
            { type: 'resize-sw' as const, x: cropRect.x, y: cropRect.y + cropRect.height },
            { type: 'resize-se' as const, x: cropRect.x + cropRect.width, y: cropRect.y + cropRect.height },
        ];

        for (const corner of corners) {
            if (Math.abs(x - corner.x) < handleSize && Math.abs(y - corner.y) < handleSize) {
                setIsDragging(true);
                setDragType(corner.type);
                setDragStart({ x: e.clientX, y: e.clientY });
                setCropStart({ ...cropRect });
                return;
            }
        }

        // クロップ領域内のクリック → 移動
        if (x >= cropRect.x && x <= cropRect.x + cropRect.width &&
            y >= cropRect.y && y <= cropRect.y + cropRect.height) {
            setIsDragging(true);
            setDragType('move');
            setDragStart({ x: e.clientX, y: e.clientY });
            setCropStart({ ...cropRect });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !dragType || !image) return;

        const dx = (e.clientX - dragStart.x) / scale;
        const dy = (e.clientY - dragStart.y) / scale;

        if (dragType === 'move') {
            let newX = Math.max(0, Math.min(image.width - cropStart.width, cropStart.x + dx));
            let newY = Math.max(0, Math.min(image.height - cropStart.height, cropStart.y + dy));
            setCropRect({ ...cropRect, x: newX, y: newY });
        } else {
            let newRect = { ...cropStart };

            if (dragType.includes('w')) {
                const newX = Math.max(0, Math.min(cropStart.x + cropStart.width - 50, cropStart.x + dx));
                newRect.width = cropStart.x + cropStart.width - newX;
                newRect.x = newX;
            }
            if (dragType.includes('e')) {
                newRect.width = Math.max(50, Math.min(image.width - cropStart.x, cropStart.width + dx));
            }
            if (dragType.includes('n')) {
                const newY = Math.max(0, Math.min(cropStart.y + cropStart.height - 50, cropStart.y + dy));
                newRect.height = cropStart.y + cropStart.height - newY;
                newRect.y = newY;
            }
            if (dragType.includes('s')) {
                newRect.height = Math.max(50, Math.min(image.height - cropStart.y, cropStart.height + dy));
            }

            // アスペクト比固定
            if (lockAspectRatio && selectedAspect !== 'custom') {
                const preset = ASPECT_RATIO_PRESETS.find(p => p.value === selectedAspect);
                if (preset && preset.width > 0 && preset.height > 0) {
                    const targetRatio = preset.width / preset.height;
                    if (dragType.includes('e') || dragType.includes('w')) {
                        newRect.height = newRect.width / targetRatio;
                    } else {
                        newRect.width = newRect.height * targetRatio;
                    }
                }
            }

            // 最小サイズ制限
            if (newRect.width >= 50 && newRect.height >= 50) {
                setCropRect(newRect);
            }
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragType(null);
    };

    // アスペクト比プリセット適用
    const applyAspectRatio = (preset: typeof ASPECT_RATIO_PRESETS[0]) => {
        if (!image || preset.value === 'custom') {
            setSelectedAspect(preset.value);
            setLockAspectRatio(false);
            return;
        }

        setSelectedAspect(preset.value);
        setLockAspectRatio(true);

        const targetRatio = preset.width / preset.height;
        const imageRatio = image.width / image.height;

        let newWidth, newHeight;
        if (targetRatio > imageRatio) {
            newWidth = image.width;
            newHeight = image.width / targetRatio;
        } else {
            newHeight = image.height;
            newWidth = image.height * targetRatio;
        }

        setCropRect({
            x: (image.width - newWidth) / 2,
            y: (image.height - newHeight) / 2,
            width: newWidth,
            height: newHeight
        });
    };

    // SNSサイズプリセット適用
    const applySizePreset = (preset: typeof SIZE_PRESETS[0]) => {
        setTargetSize({ width: preset.width, height: preset.height });

        // アスペクト比も更新
        const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
        const g = gcd(preset.width, preset.height);
        setCustomAspect({ width: preset.width / g, height: preset.height / g });
    };

    // クロップ実行
    const executeCrop = async () => {
        console.log('[Crop] ENTERED executeCrop', { image: !!image, cropRect });

        if (!image) {
            console.warn('[Crop] image is null, returning');
            return;
        }

        // 座標を整数化して範囲内に収める
        const x = Math.max(0, Math.round(cropRect.x));
        const y = Math.max(0, Math.round(cropRect.y));
        const width = Math.min(Math.round(cropRect.width), image.width - x);
        const height = Math.min(Math.round(cropRect.height), image.height - y);

        console.log('[Crop] Executing crop:', { x, y, width, height, imageWidth: image.width, imageHeight: image.height });

        // クロップ範囲が画像全体と同じ場合は警告
        if (x === 0 && y === 0 && width === image.width && height === image.height) {
            console.warn('[Crop] cropRect equals full image, showing error');
            toast.error('クロップ範囲を選択してください。アスペクト比ボタンをクリックするか、画像上でドラッグして範囲を指定してください。');
            return;
        }

        setIsProcessing(true);
        try {

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context failed');

            ctx.drawImage(image, x, y, width, height, 0, 0, width, height);

            console.log('[Crop] Canvas created, converting to blob...');

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(b => {
                    console.log('[Crop] Blob result:', b);
                    b ? resolve(b) : reject(new Error('Blob creation failed'));
                }, 'image/png');
            });

            console.log('[Crop] Blob created, size:', blob.size);

            // Supabaseにアップロード
            const formData = new FormData();
            formData.append('file', blob, 'cropped.png');

            console.log('[Crop] Uploading to server...');
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            console.log('[Crop] Upload response status:', res.status);
            const data = await res.json();
            console.log('[Crop] Upload response data:', data);

            if (data.error) throw new Error(data.error);

            const newUrl = data.filePath || data.url;
            const newId = data.id;
            console.log('[Crop] Final URL:', newUrl, 'ID:', newId);
            toast.success('クロップが完了しました');
            onSave(newUrl, newId);
            console.log('[Crop] onSave called with ID:', newId);
        } catch (error: any) {
            toast.error(error.message || 'クロップに失敗しました');
        } finally {
            setIsProcessing(false);
        }
    };

    // リサイズ実行
    const executeResize = async () => {
        if (!image) return;

        setIsProcessing(true);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = targetSize.width;
            canvas.height = targetSize.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context failed');

            // 高品質リサイズ
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(image, 0, 0, targetSize.width, targetSize.height);

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(b => b ? resolve(b) : reject(new Error('Blob creation failed')), 'image/png');
            });

            const formData = new FormData();
            formData.append('file', blob, 'resized.png');

            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            const newUrl = data.filePath || data.url;
            const newId = data.id;
            toast.success('リサイズが完了しました');
            onSave(newUrl, newId);
        } catch (error: any) {
            toast.error(error.message || 'リサイズに失敗しました');
        } finally {
            setIsProcessing(false);
        }
    };

    // アウトペインティング実行
    const executeOutpaint = async () => {
        if (!image) return;

        setIsProcessing(true);
        try {
            // 元画像をbase64に変換
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = image.width;
            tempCanvas.height = image.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) throw new Error('Canvas context failed');
            tempCtx.drawImage(image, 0, 0);
            const base64 = tempCanvas.toDataURL('image/png');

            // 拡張サイズを計算
            const expandX = outpaintDirection === 'left' || outpaintDirection === 'right' || outpaintDirection === 'all'
                ? Math.round(image.width * (outpaintAmount / 100)) : 0;
            const expandY = outpaintDirection === 'top' || outpaintDirection === 'bottom' || outpaintDirection === 'all'
                ? Math.round(image.height * (outpaintAmount / 100)) : 0;

            const newWidth = image.width + (outpaintDirection === 'all' ? expandX * 2 : expandX);
            const newHeight = image.height + (outpaintDirection === 'all' ? expandY * 2 : expandY);

            // APIコール
            const res = await fetch('/api/ai/outpaint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: base64,
                    direction: outpaintDirection,
                    expandAmount: outpaintAmount,
                    prompt: outpaintPrompt || '周囲の背景を自然に拡張してください',
                    targetWidth: newWidth,
                    targetHeight: newHeight,
                })
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success('AI拡張が完了しました');
            onSave(data.url, data.id);
        } catch (error: any) {
            toast.error(error.message || 'AI拡張に失敗しました');
        } finally {
            setIsProcessing(false);
        }
    };

    // 実行ボタン
    const handleExecute = async (e?: React.MouseEvent) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();

        console.log('[handleExecute] Button clicked! mode:', mode);
        try {
            if (mode === 'crop') {
                console.log('[handleExecute] Before executeCrop');
                await executeCrop();
                console.log('[handleExecute] After executeCrop');
            } else if (mode === 'resize') {
                console.log('[handleExecute] Before executeResize');
                await executeResize();
                console.log('[handleExecute] After executeResize');
            } else if (mode === 'outpaint') {
                console.log('[handleExecute] Before executeOutpaint');
                await executeOutpaint();
                console.log('[handleExecute] After executeOutpaint');
            }
        } catch (err) {
            console.error('[handleExecute] Error:', err);
        }
    };

    // リサイズ時のアスペクト比維持
    const handleTargetWidthChange = (newWidth: number) => {
        if (maintainAspect && image) {
            const ratio = image.height / image.width;
            setTargetSize({ width: newWidth, height: Math.round(newWidth * ratio) });
        } else {
            setTargetSize({ ...targetSize, width: newWidth });
        }
    };

    const handleTargetHeightChange = (newHeight: number) => {
        if (maintainAspect && image) {
            const ratio = image.width / image.height;
            setTargetSize({ width: Math.round(newHeight * ratio), height: newHeight });
        } else {
            setTargetSize({ ...targetSize, height: newHeight });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold text-gray-900">画像リサイズ</h2>
                        {image && (
                            <span className="text-sm text-gray-500">
                                元サイズ: {originalSize.width} × {originalSize.height}px
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* 左パネル: キャンバス */}
                    <div
                        ref={containerRef}
                        className="flex-1 relative bg-gray-100 overflow-hidden"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <canvas ref={canvasRef} className="absolute inset-0" />
                    </div>

                    {/* 右パネル: コントロール */}
                    <div className="w-80 border-l bg-white flex flex-col overflow-y-auto">
                        {/* モード切替 */}
                        <div className="p-4 border-b">
                            <div className="flex rounded-lg bg-gray-100 p-1">
                                {[
                                    { mode: 'crop' as ResizeMode, label: 'クロップ', Icon: Crop },
                                    { mode: 'resize' as ResizeMode, label: 'リサイズ', Icon: Maximize2 },
                                    { mode: 'outpaint' as ResizeMode, label: 'AI拡張', Icon: Sparkles },
                                ].map(({ mode: m, label, Icon }) => (
                                    <button
                                        key={m}
                                        onClick={() => setMode(m)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
                                            mode === m ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* モード別コントロール */}
                        <div className="flex-1 p-4 space-y-4">
                            {mode === 'crop' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">アスペクト比</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {ASPECT_RATIO_PRESETS.map(preset => (
                                                <button
                                                    key={preset.value}
                                                    onClick={() => applyAspectRatio(preset)}
                                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                        selectedAspect === preset.value
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">クロップ範囲</label>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-gray-500">幅:</span>
                                                <span className="ml-1 font-mono">{Math.round(cropRect.width)}px</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">高さ:</span>
                                                <span className="ml-1 font-mono">{Math.round(cropRect.height)}px</span>
                                            </div>
                                        </div>
                                        {image && cropRect.x === 0 && cropRect.y === 0 &&
                                         Math.round(cropRect.width) === image.width && Math.round(cropRect.height) === image.height && (
                                            <p className="text-xs text-orange-600 mt-2">
                                                アスペクト比を選択するか、画像上でドラッグして範囲を指定してください
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}

                            {mode === 'resize' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">SNSプリセット</label>
                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                            {SIZE_PRESETS.map(preset => (
                                                <button
                                                    key={preset.label}
                                                    onClick={() => applySizePreset(preset)}
                                                    className={`w-full px-3 py-2 rounded-lg text-sm text-left transition-all ${
                                                        targetSize.width === preset.width && targetSize.height === preset.height
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    {preset.label}
                                                    <span className="text-xs opacity-70 ml-2">
                                                        ({preset.width}×{preset.height})
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">カスタムサイズ</label>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm text-gray-500 w-8">幅:</label>
                                                <input
                                                    type="number"
                                                    value={targetSize.width}
                                                    onChange={(e) => handleTargetWidthChange(parseInt(e.target.value) || 0)}
                                                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                                                />
                                                <span className="text-sm text-gray-500">px</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm text-gray-500 w-8">高さ:</label>
                                                <input
                                                    type="number"
                                                    value={targetSize.height}
                                                    onChange={(e) => handleTargetHeightChange(parseInt(e.target.value) || 0)}
                                                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                                                />
                                                <span className="text-sm text-gray-500">px</span>
                                            </div>
                                            <label className="flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={maintainAspect}
                                                    onChange={(e) => setMaintainAspect(e.target.checked)}
                                                    className="rounded border-gray-300"
                                                />
                                                <span className="text-gray-600">アスペクト比を維持</span>
                                            </label>
                                        </div>
                                    </div>
                                </>
                            )}

                            {mode === 'outpaint' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">拡張方向</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { value: 'left', label: '←' },
                                                { value: 'top', label: '↑' },
                                                { value: 'right', label: '→' },
                                                { value: 'all', label: '全方向' },
                                                { value: 'bottom', label: '↓' },
                                            ].map(dir => (
                                                <button
                                                    key={dir.value}
                                                    onClick={() => setOutpaintDirection(dir.value as any)}
                                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                        outpaintDirection === dir.value
                                                            ? 'bg-green-600 text-white'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    } ${dir.value === 'all' ? 'col-span-1' : ''}`}
                                                >
                                                    {dir.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            拡張量: {outpaintAmount}%
                                        </label>
                                        <input
                                            type="range"
                                            min="10"
                                            max="100"
                                            value={outpaintAmount}
                                            onChange={(e) => setOutpaintAmount(parseInt(e.target.value))}
                                            className="w-full"
                                        />
                                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                                            <span>10%</span>
                                            <span>100%</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            生成プロンプト（任意）
                                        </label>
                                        <textarea
                                            value={outpaintPrompt}
                                            onChange={(e) => setOutpaintPrompt(e.target.value)}
                                            placeholder="拡張部分に何を生成するか指定..."
                                            className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                                            rows={3}
                                        />
                                    </div>

                                    {image && (
                                        <div className="pt-4 border-t">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">出力サイズ</label>
                                            <div className="text-sm text-gray-600">
                                                {(() => {
                                                    const expandX = outpaintDirection === 'left' || outpaintDirection === 'right' || outpaintDirection === 'all'
                                                        ? Math.round(image.width * (outpaintAmount / 100)) : 0;
                                                    const expandY = outpaintDirection === 'top' || outpaintDirection === 'bottom' || outpaintDirection === 'all'
                                                        ? Math.round(image.height * (outpaintAmount / 100)) : 0;
                                                    const newW = image.width + (outpaintDirection === 'all' ? expandX * 2 : expandX);
                                                    const newH = image.height + (outpaintDirection === 'all' ? expandY * 2 : expandY);
                                                    return `${newW} × ${newH}px`;
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* 実行ボタン */}
                        <div className="p-4 border-t bg-gray-50">
                            <button
                                type="button"
                                onClick={handleExecute}
                                disabled={isProcessing}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        処理中...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-5 w-5" />
                                        {mode === 'crop' ? 'クロップを適用' : mode === 'resize' ? 'リサイズを適用' : 'AI拡張を実行'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
