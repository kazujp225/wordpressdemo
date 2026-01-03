"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, Wand2, RotateCcw, ZoomIn, ZoomOut, Move, Trash2, Plus, DollarSign, Clock, Check, History, Link, MousePointer, ImagePlus, Palette, Sparkles, Monitor, Smartphone, Scissors } from 'lucide-react';
import { InpaintHistoryPanel } from './InpaintHistoryPanel';
import type { ClickableArea, FormFieldConfig, ViewportType } from '@/types';

// デザイン定義の型
interface DesignDefinition {
    colorPalette: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
    };
    typography: {
        style: string;
        mood: string;
    };
    layout: {
        density: string;
        style: string;
    };
    vibe: string;
    description: string;
}

type EditorMode = 'inpaint' | 'button';

interface ImageInpaintEditorProps {
    imageUrl: string;
    onClose: () => void;
    onSave: (newImageUrl: string, newMobileImageUrl?: string) => void;
    // For clickable area mode
    clickableAreas?: ClickableArea[];
    onSaveClickableAreas?: (areas: ClickableArea[], mobileAreas?: ClickableArea[]) => void;
    initialMode?: EditorMode;
    // 追加: セクションID（ボタン保存用）
    sectionId?: string;
    // デュアルモード用（モバイル画像）
    mobileImageUrl?: string;
    mobileClickableAreas?: ClickableArea[];
}

interface SelectionRect {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ClickableAreaDraft extends SelectionRect {
    actionType: 'url' | 'email' | 'phone' | 'scroll' | 'form-input';
    actionValue: string;
    label: string;
    formTitle?: string;
    formFields?: FormFieldConfig[];
}

export function ImageInpaintEditor({
    imageUrl,
    onClose,
    onSave,
    clickableAreas: initialClickableAreas = [],
    onSaveClickableAreas,
    initialMode = 'inpaint',
    sectionId,
    mobileImageUrl,
    mobileClickableAreas: initialMobileClickableAreas = [],
}: ImageInpaintEditorProps) {
    // デュアルモード判定
    const isDualMode = !!mobileImageUrl;
    const [activeViewport, setActiveViewport] = useState<ViewportType>('desktop');

    // Desktop canvas refs and state
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [selections, setSelections] = useState<SelectionRect[]>([]);
    const [currentSelection, setCurrentSelection] = useState<SelectionRect | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // スロット型プロンプト用state
    type EditType = 'color' | 'text' | 'object' | 'background' | 'style' | 'custom';
    const [editType, setEditType] = useState<EditType>('color');
    const [slotBefore, setSlotBefore] = useState('');
    const [slotAfter, setSlotAfter] = useState('');

    // 編集タイプごとのプリセット
    const editTypeConfig: Record<EditType, { label: string; icon: string; beforePlaceholder: string; afterPlaceholder: string; examples: string[] }> = {
        color: {
            label: '色',
            icon: '🎨',
            beforePlaceholder: '例: 青いボタン',
            afterPlaceholder: '例: 緑のボタン',
            examples: ['赤', '青', '緑', '白', '黒', 'グレー', 'ゴールド']
        },
        text: {
            label: 'テキスト',
            icon: '✏️',
            beforePlaceholder: '例: 無料体験',
            afterPlaceholder: '例: 今すぐ申込',
            examples: ['削除する', '日本語に', '英語に']
        },
        object: {
            label: 'オブジェクト',
            icon: '📦',
            beforePlaceholder: '例: 左の人物',
            afterPlaceholder: '例: 削除して背景で埋める',
            examples: ['削除', '別の画像に', '移動']
        },
        background: {
            label: '背景',
            icon: '🖼️',
            beforePlaceholder: '例: 白い背景',
            afterPlaceholder: '例: 青空の背景',
            examples: ['白に', '透明に', '青空', 'グラデーション']
        },
        style: {
            label: 'スタイル',
            icon: '✨',
            beforePlaceholder: '例: シンプルなデザイン',
            afterPlaceholder: '例: モダンで洗練されたデザイン',
            examples: ['モダンに', 'ミニマルに', 'ポップに', 'プロフェッショナルに']
        },
        custom: {
            label: '自由入力',
            icon: '💬',
            beforePlaceholder: '現在の状態を記述...',
            afterPlaceholder: '変更後の状態を記述...',
            examples: []
        }
    };

    // スロットからプロンプトを生成
    const generatePromptFromSlots = (): string => {
        if (editType === 'custom') {
            return prompt;
        }
        if (!slotBefore.trim() && !slotAfter.trim()) {
            return '';
        }
        return `【${editTypeConfig[editType].label}の変更】\n変更前: ${slotBefore.trim() || '（現在の状態）'}\n変更後: ${slotAfter.trim()}`;
    };
    const [error, setError] = useState<string | null>(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [tool, setTool] = useState<'select' | 'pan' | 'cut'>('select');
    const [costInfo, setCostInfo] = useState<{ model: string; estimatedCost: number; durationMs: number } | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // カット機能用state
    const [cutStartY, setCutStartY] = useState<number | null>(null);
    const [cutEndY, setCutEndY] = useState<number | null>(null);
    const [isCutting, setIsCutting] = useState(false);
    const [showCutConfirm, setShowCutConfirm] = useState(false);

    // Mobile canvas refs and state (for dual mode)
    const mobileCanvasRef = useRef<HTMLCanvasElement>(null);
    const mobileContainerRef = useRef<HTMLDivElement>(null);
    const [mobileImage, setMobileImage] = useState<HTMLImageElement | null>(null);
    const [mobileSelections, setMobileSelections] = useState<SelectionRect[]>([]);
    const [mobileScale, setMobileScale] = useState(1);
    const [mobileOffset, setMobileOffset] = useState({ x: 0, y: 0 });
    const [mobileCurrentSelection, setMobileCurrentSelection] = useState<SelectionRect | null>(null);
    const [isMobileSelecting, setIsMobileSelecting] = useState(false);
    const [mobileStartPoint, setMobileStartPoint] = useState({ x: 0, y: 0 });

    // 参考デザイン画像機能
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [referenceDesign, setReferenceDesign] = useState<DesignDefinition | null>(null);
    const [isAnalyzingDesign, setIsAnalyzingDesign] = useState(false);
    const referenceInputRef = useRef<HTMLInputElement>(null);

    // Editor mode state
    const [editorMode, setEditorMode] = useState<EditorMode>(initialMode);
    // 初期状態は空（画像読み込み後にピクセル座標に変換して設定）
    const [buttonAreas, setButtonAreas] = useState<ClickableAreaDraft[]>([]);
    const [selectedButtonId, setSelectedButtonId] = useState<string | null>(null);

    // Drag/Resize state for button mode
    const [dragMode, setDragMode] = useState<'none' | 'move' | 'resize'>('none');
    const [resizeHandle, setResizeHandle] = useState<'nw' | 'ne' | 'sw' | 'se' | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [dragOriginal, setDragOriginal] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

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

            // 既存のクリッカブルエリアを相対座標からピクセル座標に変換
            if (initialClickableAreas.length > 0) {
                setButtonAreas(initialClickableAreas.map(area => ({
                    id: area.id,
                    x: area.x * img.width,
                    y: area.y * img.height,
                    width: area.width * img.width,
                    height: area.height * img.height,
                    actionType: area.actionType,
                    actionValue: area.actionValue,
                    label: area.label || '',
                    formTitle: area.formTitle,
                    formFields: area.formFields,
                })));
            }
        };
        img.onerror = () => {
            setError('画像の読み込みに失敗しました');
        };
        img.src = imageUrl;
    }, [imageUrl, initialClickableAreas]);

    // モバイル画像を読み込み（デュアルモード時のみ）
    useEffect(() => {
        if (!mobileImageUrl) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            setMobileImage(img);
            if (mobileContainerRef.current) {
                const containerWidth = mobileContainerRef.current.clientWidth - 40;
                const containerHeight = mobileContainerRef.current.clientHeight - 40;
                const scaleX = containerWidth / img.width;
                const scaleY = containerHeight / img.height;
                const newScale = Math.min(scaleX, scaleY, 1);
                setMobileScale(newScale);
                setMobileOffset({
                    x: (containerWidth - img.width * newScale) / 2,
                    y: (containerHeight - img.height * newScale) / 2
                });
            }
        };
        img.onerror = () => {
            console.error('モバイル画像の読み込みに失敗しました');
        };
        img.src = mobileImageUrl;
    }, [mobileImageUrl]);

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

        // Draw neutral background instead of dark
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);
        ctx.drawImage(image, 0, 0);
        ctx.restore();

        // 描画する選択範囲を決定
        const areasToRender = editorMode === 'inpaint'
            ? (currentSelection ? [...selections, currentSelection] : selections)
            : (currentSelection ? [...buttonAreas, currentSelection as ClickableAreaDraft] : buttonAreas);

        areasToRender.forEach((sel, index: number) => {
            const scaledSel = {
                x: offset.x + sel.x * scale,
                y: offset.y + sel.y * scale,
                width: sel.width * scale,
                height: sel.height * scale
            };

            // モードに応じて色を変更
            const inpaintColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
            const buttonColor = '#3b82f6'; // Blue for buttons
            const isSelected = editorMode === 'button' && sel.id === selectedButtonId;
            const color = editorMode === 'inpaint'
                ? inpaintColors[index % inpaintColors.length]
                : (isSelected ? '#2563eb' : buttonColor);

            // Glow Effect
            ctx.save();
            ctx.shadowBlur = isSelected ? 15 : 10;
            ctx.shadowColor = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = isSelected ? 4 : 3;
            ctx.strokeRect(scaledSel.x, scaledSel.y, scaledSel.width, scaledSel.height);
            ctx.restore();

            // Semi-transparent fill for button mode
            if (editorMode === 'button') {
                ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)';
                ctx.fillRect(scaledSel.x, scaledSel.y, scaledSel.width, scaledSel.height);
            }

            // Border
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.strokeRect(scaledSel.x, scaledSel.y, scaledSel.width, scaledSel.height);

            // Label
            const labelWidth = editorMode === 'button' ? 60 : 28;
            const labelHeight = 20;
            const labelX = scaledSel.x;
            const labelY = scaledSel.y - labelHeight - 4;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(labelX, labelY, labelWidth, labelHeight, 6);
            ctx.fill();

            ctx.fillStyle = 'white';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';

            if (editorMode === 'button') {
                const draft = sel as ClickableAreaDraft;
                const labelText = draft.label || `Button ${index + 1}`;
                ctx.fillText(labelText.substring(0, 8), labelX + labelWidth / 2, labelY + 14);
            } else {
                ctx.fillText(`${index + 1}`, labelX + labelWidth / 2, labelY + 14);
            }

            // Corner accents
            const accentSize = 8;
            ctx.fillStyle = 'white';
            ctx.fillRect(scaledSel.x - 2, scaledSel.y - 2, accentSize, 2);
            ctx.fillRect(scaledSel.x - 2, scaledSel.y - 2, 2, accentSize);
            ctx.fillRect(scaledSel.x + scaledSel.width - accentSize + 2, scaledSel.y - 2, accentSize, 2);
            ctx.fillRect(scaledSel.x + scaledSel.width, scaledSel.y - 2, 2, accentSize);

            // Resize handles for selected button
            if (editorMode === 'button' && isSelected) {
                const handleSize = 10;
                const handles = [
                    { x: scaledSel.x, y: scaledSel.y }, // nw
                    { x: scaledSel.x + scaledSel.width, y: scaledSel.y }, // ne
                    { x: scaledSel.x, y: scaledSel.y + scaledSel.height }, // sw
                    { x: scaledSel.x + scaledSel.width, y: scaledSel.y + scaledSel.height }, // se
                ];

                handles.forEach(handle => {
                    ctx.fillStyle = 'white';
                    ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
                });
            }
        });

        // カット選択範囲の描画
        if ((cutStartY !== null && cutEndY !== null) || isCutting) {
            const startY = cutStartY ?? 0;
            const endY = cutEndY ?? startY;
            const minY = Math.min(startY, endY);
            const maxY = Math.max(startY, endY);

            const scaledMinY = offset.y + minY * scale;
            const scaledMaxY = offset.y + maxY * scale;
            const scaledWidth = image.width * scale;

            // カット範囲を赤く半透明で塗りつぶし
            ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
            ctx.fillRect(offset.x, scaledMinY, scaledWidth, scaledMaxY - scaledMinY);

            // 上下のボーダーライン
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            ctx.moveTo(offset.x, scaledMinY);
            ctx.lineTo(offset.x + scaledWidth, scaledMinY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(offset.x, scaledMaxY);
            ctx.lineTo(offset.x + scaledWidth, scaledMaxY);
            ctx.stroke();
            ctx.setLineDash([]);

            // カット範囲の高さ表示
            const cutHeight = Math.round(maxY - minY);
            if (cutHeight > 20) {
                const labelText = `カット: ${cutHeight}px`;
                ctx.fillStyle = '#ef4444';
                ctx.font = 'bold 12px sans-serif';
                const textWidth = ctx.measureText(labelText).width;
                const labelX = offset.x + (scaledWidth - textWidth - 16) / 2;
                const labelY = scaledMinY + (scaledMaxY - scaledMinY) / 2 - 10;

                ctx.beginPath();
                ctx.roundRect(labelX, labelY, textWidth + 16, 24, 6);
                ctx.fill();

                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.fillText(labelText, labelX + (textWidth + 16) / 2, labelY + 16);
            }
        }
    }, [image, selections, currentSelection, scale, offset, editorMode, buttonAreas, selectedButtonId, cutStartY, cutEndY, isCutting]);

    // モバイルキャンバスに描画（デュアルモード時のみ）
    useEffect(() => {
        if (!isDualMode) return;

        const canvas = mobileCanvasRef.current;
        if (!canvas || !mobileImage) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (mobileContainerRef.current) {
            canvas.width = mobileContainerRef.current.clientWidth;
            canvas.height = mobileContainerRef.current.clientHeight;
        }

        // Draw neutral background
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(mobileOffset.x, mobileOffset.y);
        ctx.scale(mobileScale, mobileScale);
        ctx.drawImage(mobileImage, 0, 0);
        ctx.restore();

        // 描画する選択範囲（モバイル用）- currentSelectionも含める
        const mobileAreasToRender = mobileCurrentSelection
            ? [...mobileSelections, mobileCurrentSelection]
            : mobileSelections;

        mobileAreasToRender.forEach((sel, index: number) => {
            const scaledSel = {
                x: mobileOffset.x + sel.x * mobileScale,
                y: mobileOffset.y + sel.y * mobileScale,
                width: sel.width * mobileScale,
                height: sel.height * mobileScale
            };

            const colors = ['#a855f7', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];
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

            // Label
            const labelWidth = 28;
            const labelHeight = 20;
            const labelX = scaledSel.x;
            const labelY = scaledSel.y - labelHeight - 4;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(labelX, labelY, labelWidth, labelHeight, 6);
            ctx.fill();

            ctx.fillStyle = 'white';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${index + 1}`, labelX + labelWidth / 2, labelY + 14);
        });
    }, [isDualMode, mobileImage, mobileSelections, mobileScale, mobileOffset, mobileCurrentSelection]);

    const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - offset.x) / scale;
        const y = (e.clientY - rect.top - offset.y) / scale;
        return { x, y };
    }, [offset, scale]);

    // モバイルキャンバス用座標変換
    const getMobileCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = mobileCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - mobileOffset.x) / mobileScale;
        const y = (e.clientY - rect.top - mobileOffset.y) / mobileScale;
        return { x, y };
    }, [mobileOffset, mobileScale]);

    // ボタン領域のヒットテスト
    const hitTestButton = useCallback((coords: { x: number; y: number }): { buttonId: string | null; handle: 'nw' | 'ne' | 'sw' | 'se' | 'move' | null } => {
        if (editorMode !== 'button') return { buttonId: null, handle: null };

        // リサイズハンドルのサイズ（ピクセル単位、最大15px）
        const handleSize = Math.min(15, 8 / scale);

        for (let i = buttonAreas.length - 1; i >= 0; i--) {
            const area = buttonAreas[i];

            // リサイズハンドルのチェック（角）
            const handles: { key: 'nw' | 'ne' | 'sw' | 'se'; x: number; y: number }[] = [
                { key: 'nw', x: area.x, y: area.y },
                { key: 'ne', x: area.x + area.width, y: area.y },
                { key: 'sw', x: area.x, y: area.y + area.height },
                { key: 'se', x: area.x + area.width, y: area.y + area.height },
            ];

            for (const handle of handles) {
                if (Math.abs(coords.x - handle.x) < handleSize && Math.abs(coords.y - handle.y) < handleSize) {
                    return { buttonId: area.id, handle: handle.key };
                }
            }

            // 領域内のチェック（移動）
            if (coords.x >= area.x && coords.x <= area.x + area.width &&
                coords.y >= area.y && coords.y <= area.y + area.height) {
                return { buttonId: area.id, handle: 'move' };
            }
        }

        return { buttonId: null, handle: null };
    }, [editorMode, buttonAreas, scale]);

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        // まず全ての状態をリセット
        setDragMode('none');
        setResizeHandle(null);
        setDragOriginal(null);

        if (tool === 'pan') {
            setIsPanning(true);
            setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
            return;
        }

        const coords = getCanvasCoords(e);

        // 画像範囲外のクリックは無視
        if (!image || coords.x < 0 || coords.y < 0 || coords.x > image.width || coords.y > image.height) {
            return;
        }

        // カットツールの場合
        if (tool === 'cut') {
            console.log('[Cut] Start at Y:', coords.y);
            setIsCutting(true);
            setCutStartY(coords.y);
            setCutEndY(coords.y);
            return;
        }

        // ボタンモードの場合、既存ボタンのヒットテスト
        if (editorMode === 'button') {
            const hit = hitTestButton(coords);
            if (hit.buttonId && hit.handle) {
                const area = buttonAreas.find(a => a.id === hit.buttonId);
                if (area) {
                    setSelectedButtonId(hit.buttonId);
                    setDragStart(coords);
                    setDragOriginal({ x: area.x, y: area.y, width: area.width, height: area.height });

                    if (hit.handle === 'move') {
                        setDragMode('move');
                    } else {
                        setDragMode('resize');
                        setResizeHandle(hit.handle);
                    }
                    return;
                }
            }
            // 既存ボタン以外をクリックした場合、選択解除
            setSelectedButtonId(null);
        }

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

        const coords = getCanvasCoords(e);

        // カットツールの場合
        if (isCutting && image) {
            setCutEndY(Math.max(0, Math.min(coords.y, image.height)));
            return;
        }

        // ボタンのドラッグ/リサイズ処理
        if (editorMode === 'button' && dragMode !== 'none' && selectedButtonId && dragOriginal && image) {
            const dx = coords.x - dragStart.x;
            const dy = coords.y - dragStart.y;

            setButtonAreas(prev => prev.map(area => {
                if (area.id !== selectedButtonId) return area;

                if (dragMode === 'move') {
                    // 移動
                    return {
                        ...area,
                        x: Math.max(0, Math.min(dragOriginal.x + dx, image.width - area.width)),
                        y: Math.max(0, Math.min(dragOriginal.y + dy, image.height - area.height)),
                    };
                } else if (dragMode === 'resize' && resizeHandle) {
                    // リサイズ
                    let newX = dragOriginal.x;
                    let newY = dragOriginal.y;
                    let newWidth = dragOriginal.width;
                    let newHeight = dragOriginal.height;

                    if (resizeHandle.includes('w')) {
                        newX = Math.max(0, dragOriginal.x + dx);
                        newWidth = Math.max(20, dragOriginal.width - dx);
                    }
                    if (resizeHandle.includes('e')) {
                        newWidth = Math.max(20, Math.min(dragOriginal.width + dx, image.width - dragOriginal.x));
                    }
                    if (resizeHandle.includes('n')) {
                        newY = Math.max(0, dragOriginal.y + dy);
                        newHeight = Math.max(20, dragOriginal.height - dy);
                    }
                    if (resizeHandle.includes('s')) {
                        newHeight = Math.max(20, Math.min(dragOriginal.height + dy, image.height - dragOriginal.y));
                    }

                    return { ...area, x: newX, y: newY, width: newWidth, height: newHeight };
                }
                return area;
            }));
            return;
        }

        if (!isSelecting || !image) return;

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
        // パンニング終了
        if (isPanning) {
            setIsPanning(false);
            return;
        }

        // カットツールの場合
        if (isCutting && cutStartY !== null && cutEndY !== null) {
            const minY = Math.min(cutStartY, cutEndY);
            const maxY = Math.max(cutStartY, cutEndY);
            console.log('[Cut] End - Range:', minY, 'to', maxY, '=', maxY - minY, 'px');
            // 最低10px以上の範囲が選択されていればカット確認を表示
            if (maxY - minY > 10) {
                console.log('[Cut] Showing confirm dialog');
                setShowCutConfirm(true);
            } else {
                console.log('[Cut] Range too small, resetting');
                // 範囲が小さすぎる場合はリセット
                setCutStartY(null);
                setCutEndY(null);
            }
            setIsCutting(false);
            return;
        }

        // ドラッグモードをリセット
        if (dragMode !== 'none') {
            setDragMode('none');
            setResizeHandle(null);
            setDragOriginal(null);
            setIsSelecting(false);
            return;
        }

        if (currentSelection && currentSelection.width > 10 && currentSelection.height > 10) {
            const newId = Date.now().toString();
            if (editorMode === 'inpaint') {
                // 選択範囲を確定して追加
                setSelections(prev => [...prev, { ...currentSelection, id: newId }]);
            } else {
                // ボタンモード: ボタンエリアを追加
                const newButtonArea: ClickableAreaDraft = {
                    ...currentSelection,
                    id: newId,
                    actionType: 'url',
                    actionValue: '',
                    label: '',
                };
                setButtonAreas(prev => [...prev, newButtonArea]);
                setSelectedButtonId(newId);
            }
        }
        setCurrentSelection(null);
        setIsSelecting(false);
        setIsPanning(false);
    };

    // カット実行関数
    const executeCut = useCallback(async () => {
        console.log('[Cut] Executing cut...', { cutStartY, cutEndY });
        if (!image || cutStartY === null || cutEndY === null) {
            console.log('[Cut] Missing data:', { image: !!image, cutStartY, cutEndY });
            return;
        }

        const minY = Math.round(Math.min(cutStartY, cutEndY));
        const maxY = Math.round(Math.max(cutStartY, cutEndY));
        const cutHeight = maxY - minY;

        console.log('[Cut] Cutting from', minY, 'to', maxY, '- height:', cutHeight);

        if (cutHeight <= 0) return;

        setIsLoading(true);
        setError(null);

        try {
            // キャンバスを使って画像をカット
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Failed to get canvas context');

            // 新しい高さを計算（カット部分を除く）
            const newHeight = image.height - cutHeight;
            canvas.width = image.width;
            canvas.height = newHeight;

            // 上部分を描画
            if (minY > 0) {
                ctx.drawImage(image, 0, 0, image.width, minY, 0, 0, image.width, minY);
            }

            // 下部分を描画（カット部分をスキップ）
            if (maxY < image.height) {
                ctx.drawImage(
                    image,
                    0, maxY, image.width, image.height - maxY,
                    0, minY, image.width, image.height - maxY
                );
            }

            // Blobに変換
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => {
                    if (b) resolve(b);
                    else reject(new Error('Failed to create blob'));
                }, 'image/png');
            });

            // Supabaseにアップロード
            const formData = new FormData();
            formData.append('file', blob, `cut-${Date.now()}.png`);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to upload cut image');
            }

            const data = await response.json();
            const url = data.filePath || data.url;

            if (!url) {
                throw new Error('No URL returned from upload');
            }

            // 成功メッセージを表示
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);

            // リセット
            setCutStartY(null);
            setCutEndY(null);
            setShowCutConfirm(false);

            // 親に通知
            onSave(url);
        } catch (err: any) {
            setError(err.message || 'カットに失敗しました');
        } finally {
            setIsLoading(false);
        }
    }, [image, cutStartY, cutEndY, onSave]);

    // カットをキャンセル
    const cancelCut = useCallback(() => {
        setCutStartY(null);
        setCutEndY(null);
        setShowCutConfirm(false);
        setIsCutting(false);
    }, []);

    // モバイルキャンバス用のマウスイベントハンドラー
    const handleMobileMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setActiveViewport('mobile');

        if (tool === 'pan') {
            setIsPanning(true);
            setPanStart({ x: e.clientX - mobileOffset.x, y: e.clientY - mobileOffset.y });
            return;
        }

        const coords = getMobileCanvasCoords(e);

        // 画像範囲外のクリックは無視
        if (!mobileImage || coords.x < 0 || coords.y < 0 || coords.x > mobileImage.width || coords.y > mobileImage.height) {
            return;
        }

        // インペイントモードのみ対応（ボタンモードはデスクトップで設定）
        if (editorMode === 'inpaint') {
            setIsMobileSelecting(true);
            setMobileStartPoint(coords);
            setMobileCurrentSelection(null);
        }
    };

    const handleMobileMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isPanning) {
            setMobileOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
            return;
        }

        if (!isMobileSelecting || !mobileImage) return;

        const coords = getMobileCanvasCoords(e);

        const newSelection: SelectionRect = {
            id: 'mobile-temp',
            x: Math.max(0, Math.min(mobileStartPoint.x, coords.x)),
            y: Math.max(0, Math.min(mobileStartPoint.y, coords.y)),
            width: Math.min(Math.abs(coords.x - mobileStartPoint.x), mobileImage.width - Math.min(mobileStartPoint.x, coords.x)),
            height: Math.min(Math.abs(coords.y - mobileStartPoint.y), mobileImage.height - Math.min(mobileStartPoint.y, coords.y))
        };

        setMobileCurrentSelection(newSelection);
    };

    const handleMobileMouseUp = () => {
        if (mobileCurrentSelection && mobileCurrentSelection.width > 10 && mobileCurrentSelection.height > 10) {
            const newId = 'mobile-' + Date.now().toString();
            setMobileSelections(prev => [...prev, { ...mobileCurrentSelection, id: newId }]);
        }
        setMobileCurrentSelection(null);
        setIsMobileSelecting(false);
        setIsPanning(false);
    };

    const removeMobileSelection = (id: string) => {
        setMobileSelections(prev => prev.filter(s => s.id !== id));
    };

    const clearAllMobileSelections = () => {
        setMobileSelections([]);
    };

    const removeSelection = (id: string) => {
        setSelections(prev => prev.filter(s => s.id !== id));
    };

    const removeButtonArea = (id: string) => {
        setButtonAreas(prev => prev.filter(b => b.id !== id));
        if (selectedButtonId === id) {
            setSelectedButtonId(null);
        }
    };

    const updateButtonArea = (id: string, updates: Partial<ClickableAreaDraft>) => {
        setButtonAreas(prev =>
            prev.map(b => (b.id === id ? { ...b, ...updates } : b))
        );
    };

    const clearAllSelections = () => {
        setSelections([]);
    };

    const clearAllButtonAreas = () => {
        setButtonAreas([]);
        setSelectedButtonId(null);
    };

    // ボタンエリアを保存
    const handleSaveClickableAreas = () => {
        console.log('[ボタン保存] 開始', {
            buttonAreas: buttonAreas.length,
            image: !!image,
            sectionId,
            windowFn: !!(window as any).__saveClickableAreas
        });

        if (!image) {
            setError('画像が読み込まれていません');
            return;
        }
        if (buttonAreas.length === 0) {
            setError('ボタンを追加してください。画像上をドラッグしてボタン領域を作成してください。');
            return;
        }

        // バリデーション（タイプ別）
        for (const area of buttonAreas) {
            if (area.actionType === 'form-input') {
                // フォームの場合：フィールドが必要
                if (!area.formFields || area.formFields.length === 0) {
                    setError('フォームには少なくとも1つのフィールドが必要です。');
                    setSelectedButtonId(area.id);
                    return;
                }
            } else {
                // その他の場合：actionValueが必要
                if (!area.actionValue.trim()) {
                    setError('URL/値が設定されていません。');
                    setSelectedButtonId(area.id);
                    return;
                }

                // URL形式のバリデーション
                if (area.actionType === 'url') {
                    if (!area.actionValue.startsWith('http://') &&
                        !area.actionValue.startsWith('https://') &&
                        !area.actionValue.startsWith('#') &&
                        !area.actionValue.startsWith('/')) {
                        setError('URLは http://, https://, #, / で始まる必要があります');
                        setSelectedButtonId(area.id);
                        return;
                    }
                }
                if (area.actionType === 'email' && !area.actionValue.includes('@')) {
                    setError('メールアドレスに@が含まれていません');
                    setSelectedButtonId(area.id);
                    return;
                }
            }
        }

        setError(null);

        // 0-1 の相対座標に変換（form-input用のフィールドも含める）
        const areas: ClickableArea[] = buttonAreas.map(area => ({
            id: area.id,
            x: area.x / image.width,
            y: area.y / image.height,
            width: area.width / image.width,
            height: area.height / image.height,
            actionType: area.actionType,
            actionValue: area.actionValue,
            label: area.label || undefined,
            formTitle: area.formTitle,
            formFields: area.formFields,
        }));

        // 保存処理: propsで渡されたコールバックを優先
        if (onSaveClickableAreas) {
            console.log('[ボタン保存] props callback を呼び出し', { areas });
            onSaveClickableAreas(areas);
            onClose();
        } else {
            setError('保存機能が利用できません。ページをリロードしてください。');
            return;
        }
    };

    // インペインティング実行
    const handleInpaint = async () => {
        // デュアルモード時は両方の選択範囲をチェック
        const hasDesktopSelections = selections.length > 0;
        const hasMobileSelections = isDualMode && mobileSelections.length > 0;

        if (!hasDesktopSelections && !hasMobileSelections) {
            setError('範囲を選択してプロンプトを入力してください');
            return;
        }

        // スロットからプロンプトを生成
        const generatedPrompt = generatePromptFromSlots();
        if (!generatedPrompt.trim()) {
            setError('変更内容を入力してください');
            return;
        }

        if (!image) {
            setError('画像が読み込まれていません');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 参考画像がある場合はリサイズしてから送信
            let resizedReferenceImage: string | undefined;
            if (referenceImage) {
                resizedReferenceImage = await resizeImageForUpload(referenceImage, 1024);
            }

            // インペイント処理関数
            const processInpaint = async (
                targetImageUrl: string,
                targetMasks: { x: number; y: number; width: number; height: number }[],
                label: string
            ): Promise<{ url: string; costInfo?: any }> => {
                const response = await fetch('/api/ai/inpaint', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageUrl: targetImageUrl,
                        masks: targetMasks,
                        mask: targetMasks[0],
                        prompt: generatedPrompt,
                        referenceDesign: referenceDesign || undefined,
                        referenceImageBase64: resizedReferenceImage
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || `${label}画像のインペインティングに失敗しました`);
                }

                if (result.success && result.media?.filePath) {
                    return { url: result.media.filePath, costInfo: result.costInfo };
                } else {
                    throw new Error(result.message || `${label}画像の生成に失敗しました`);
                }
            };

            // 並列処理用のPromise配列を構築
            const promises: Promise<{ type: 'desktop' | 'mobile'; url: string; costInfo?: any }>[] = [];

            if (hasDesktopSelections) {
                const desktopMasks = selections.map(sel => ({
                    x: sel.x / image.width,
                    y: sel.y / image.height,
                    width: sel.width / image.width,
                    height: sel.height / image.height
                }));
                promises.push(
                    processInpaint(imageUrl, desktopMasks, 'デスクトップ')
                        .then(result => ({ type: 'desktop' as const, ...result }))
                );
            }

            if (hasMobileSelections && mobileImage && mobileImageUrl) {
                const mobileMasks = mobileSelections.map(sel => ({
                    x: sel.x / mobileImage.width,
                    y: sel.y / mobileImage.height,
                    width: sel.width / mobileImage.width,
                    height: sel.height / mobileImage.height
                }));
                promises.push(
                    processInpaint(mobileImageUrl, mobileMasks, 'モバイル')
                        .then(result => ({ type: 'mobile' as const, ...result }))
                );
            }

            // 並列実行
            const results = await Promise.all(promises);

            // 結果を抽出
            let desktopResultUrl: string | undefined;
            let mobileResultUrl: string | undefined;

            for (const result of results) {
                if (result.type === 'desktop') {
                    desktopResultUrl = result.url;
                    if (result.costInfo) {
                        setCostInfo(result.costInfo);
                    }
                } else if (result.type === 'mobile') {
                    mobileResultUrl = result.url;
                }
            }

            // 結果を返す
            if (desktopResultUrl || mobileResultUrl) {
                setShowSuccess(true);
                setTimeout(() => {
                    // デスクトップ結果がなければ元のURLを使用
                    onSave(desktopResultUrl || imageUrl, mobileResultUrl);
                }, 2000);
            } else {
                throw new Error('画像の生成に失敗しました');
            }
        } catch (err: any) {
            setError(err.message || 'エラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleZoomIn = () => setScale(prev => Math.min(prev * 1.2, 3));
    const handleZoomOut = () => setScale(prev => Math.max(prev / 1.2, 0.2));

    // モバイルキャンバス用ズーム
    const handleMobileZoomIn = () => setMobileScale(prev => Math.min(prev * 1.2, 3));
    const handleMobileZoomOut = () => setMobileScale(prev => Math.max(prev / 1.2, 0.2));
    const handleMobileReset = () => {
        if (mobileImage && mobileContainerRef.current) {
            const containerWidth = mobileContainerRef.current.clientWidth - 40;
            const containerHeight = mobileContainerRef.current.clientHeight - 40;
            const scaleX = containerWidth / mobileImage.width;
            const scaleY = containerHeight / mobileImage.height;
            const newScale = Math.min(scaleX, scaleY, 1);
            setMobileScale(newScale);
            setMobileOffset({
                x: (containerWidth - mobileImage.width * newScale) / 2,
                y: (containerHeight - mobileImage.height * newScale) / 2
            });
        }
    };

    // 参考デザイン画像のアップロード処理
    const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // ファイルをBase64に変換
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            setReferenceImage(base64);

            // デザイン解析を実行
            setIsAnalyzingDesign(true);
            setError(null);

            try {
                const response = await fetch('/api/ai/analyze-design', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageUrl: base64 })
                });

                if (!response.ok) {
                    throw new Error('デザイン解析に失敗しました');
                }

                const designData = await response.json();
                setReferenceDesign(designData);
            } catch (err: any) {
                // 解析失敗でも参考画像は保持（AIに直接送信できるため）
                console.warn('デザイン解析失敗:', err.message);
                // エラーは表示しない（参考画像自体は使用可能）
            } finally {
                setIsAnalyzingDesign(false);
            }
        };
        reader.readAsDataURL(file);

        // inputをリセット（同じファイルを再度選択可能に）
        if (referenceInputRef.current) {
            referenceInputRef.current.value = '';
        }
    };

    // 参考デザインをクリア
    const clearReferenceDesign = () => {
        setReferenceImage(null);
        setReferenceDesign(null);
    };

    // 画像をリサイズする（最大サイズを制限）
    const resizeImageForUpload = (base64: string, maxSize: number = 1024): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // リサイズが必要かチェック
                if (img.width <= maxSize && img.height <= maxSize) {
                    resolve(base64);
                    return;
                }

                // アスペクト比を維持してリサイズ
                const ratio = Math.min(maxSize / img.width, maxSize / img.height);
                const newWidth = Math.round(img.width * ratio);
                const newHeight = Math.round(img.height * ratio);

                const canvas = document.createElement('canvas');
                canvas.width = newWidth;
                canvas.height = newHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, newWidth, newHeight);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                } else {
                    resolve(base64);
                }
            };
            img.onerror = () => resolve(base64);
            img.src = base64;
        });
    };

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
            <div className="relative w-full h-full max-w-[1600px] max-h-[900px] bg-background rounded-xl shadow-2xl overflow-hidden flex flex-col border border-border animate-in fade-in zoom-in duration-200">
                {/* Success Overlay */}
                {showSuccess && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="text-center p-8 bg-surface-50 rounded-xl border border-border shadow-lg">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center border border-green-200">
                                <Check className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-2">編集完了</h3>
                            <p className="text-muted-foreground text-sm mb-6">画像を保存して閉じています...</p>

                            {costInfo && (
                                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">コスト</p>
                                        <p className="text-lg font-bold text-foreground font-mono">${costInfo.estimatedCost.toFixed(4)}</p>
                                    </div>
                                    <div className="w-px h-8 bg-border" />
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">処理時間</p>
                                        <p className="text-lg font-bold text-foreground font-mono">{(costInfo.durationMs / 1000).toFixed(1)}s</p>
                                    </div>
                                    <div className="w-px h-8 bg-border" />
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">モデル</p>
                                        <p className="text-sm font-bold text-foreground">{costInfo.model}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-md border ${editorMode === 'inpaint' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                {editorMode === 'inpaint' ? <Wand2 className="w-5 h-5" /> : <MousePointer className="w-5 h-5" />}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground">
                                    {editorMode === 'inpaint' ? '画像部分編集' : 'ボタン設定'}
                                </h2>
                                <p className="text-xs text-muted-foreground font-medium">
                                    {editorMode === 'inpaint'
                                        ? '画像の一部を選択してAIで編集・修正します（複数選択可）'
                                        : '画像上にクリッカブルなボタン領域を設定します'}
                                </p>
                            </div>
                        </div>

                        {/* Mode Tabs */}
                        <div className="flex items-center bg-surface-100 rounded-lg p-1 border border-border">
                            <button
                                onClick={() => setEditorMode('inpaint')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                    editorMode === 'inpaint'
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Wand2 className="w-4 h-4" />
                                インペイント
                            </button>
                            <button
                                onClick={() => setEditorMode('button')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                    editorMode === 'button'
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <MousePointer className="w-4 h-4" />
                                ボタン設定
                            </button>
                        </div>

                        {/* Dual Mode Viewport Toggle */}
                        {isDualMode && (
                            <div className="flex items-center bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-1 border border-blue-200">
                                <button
                                    onClick={() => setActiveViewport('desktop')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                        activeViewport === 'desktop'
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <Monitor className="w-4 h-4" />
                                    Desktop
                                </button>
                                <button
                                    onClick={() => setActiveViewport('mobile')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                        activeViewport === 'mobile'
                                            ? 'bg-white text-purple-600 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <Smartphone className="w-4 h-4" />
                                    Mobile
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Cost Info */}
                        {costInfo && (
                            <div className="flex items-center gap-3 bg-surface-100 rounded-md px-4 py-2 border border-border">
                                <span className="text-xs font-bold text-muted-foreground">前回:</span>
                                <div className="flex items-center gap-1 text-foreground">
                                    <DollarSign className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-xs font-mono font-bold">${costInfo.estimatedCost.toFixed(4)}</span>
                                </div>
                                <div className="w-px h-3 bg-border" />
                                <div className="flex items-center gap-1 text-foreground">
                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-xs font-mono font-bold">{(costInfo.durationMs / 1000).toFixed(1)}s</span>
                                </div>
                            </div>
                        )}
                        {/* History Toggle Button */}
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${
                                showHistory
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-surface-100 text-muted-foreground border-border hover:text-foreground hover:bg-surface-200'
                            }`}
                        >
                            <History className="w-4 h-4" />
                            <span className="text-xs font-bold">履歴</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-surface-100"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Canvas Area - Desktop */}
                    <div
                        ref={containerRef}
                        className={`relative bg-surface-100 overflow-hidden ${
                            isDualMode
                                ? `${activeViewport === 'desktop' ? 'flex-[6]' : 'flex-[4]'} border-r-2 ${activeViewport === 'desktop' ? 'border-blue-400' : 'border-gray-200'}`
                                : 'flex-1'
                        }`}
                    >
                        {/* Viewport Label for Dual Mode */}
                        {isDualMode && (
                            <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full text-xs font-bold ${
                                activeViewport === 'desktop' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                            }`}>
                                <div className="flex items-center gap-1.5">
                                    <Monitor className="w-3 h-3" />
                                    Desktop
                                </div>
                            </div>
                        )}

                        {/* Checkerboard background for transparency hint */}
                        <div className="absolute inset-0 opacity-[0.03]"
                            style={{
                                backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)',
                                backgroundSize: '20px 20px',
                                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                            }}
                        />

                        <canvas
                            ref={canvasRef}
                            className={`w-full h-full relative z-10 ${
                                tool === 'select' ? 'cursor-crosshair' :
                                tool === 'cut' ? 'cursor-row-resize' :
                                'cursor-grab'
                            } ${
                                isDualMode && activeViewport !== 'desktop' ? 'opacity-70' : ''
                            }`}
                            onMouseDown={(e) => { if (!isDualMode || activeViewport === 'desktop') handleMouseDown(e); else setActiveViewport('desktop'); }}
                            onMouseMove={(e) => { if (!isDualMode || activeViewport === 'desktop') handleMouseMove(e); }}
                            onMouseUp={() => { if (!isDualMode || activeViewport === 'desktop') handleMouseUp(); }}
                            onMouseLeave={() => { if (!isDualMode || activeViewport === 'desktop') handleMouseUp(); }}
                        />

                        {/* Toolbar - 下部中央に水平配置して画像を邪魔しないように */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background/95 backdrop-blur-sm p-1.5 rounded-lg border border-border shadow-lg z-20">
                            <button
                                onClick={() => setTool('select')}
                                className={`p-2 rounded-md transition-all ${tool === 'select' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-surface-100 hover:text-foreground'}`}
                                title="選択ツール"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setTool('pan')}
                                className={`p-2 rounded-md transition-all ${tool === 'pan' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-surface-100 hover:text-foreground'}`}
                                title="移動ツール"
                            >
                                <Move className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => { setTool('cut'); cancelCut(); }}
                                className={`p-2 rounded-md transition-all ${tool === 'cut' ? 'bg-red-500 text-white shadow-sm' : 'text-muted-foreground hover:bg-surface-100 hover:text-foreground'}`}
                                title="カットツール（範囲を削除）"
                            >
                                <Scissors className="w-4 h-4" />
                            </button>
                            <div className="w-px h-6 bg-border mx-1" />
                            <button
                                onClick={handleZoomOut}
                                className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-surface-100 transition-all"
                                title="縮小"
                            >
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-bold text-foreground min-w-[40px] text-center">
                                {Math.round(scale * 100)}%
                            </span>
                            <button
                                onClick={handleZoomIn}
                                className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-surface-100 transition-all"
                                title="拡大"
                            >
                                <ZoomIn className="w-4 h-4" />
                            </button>
                            <div className="w-px h-6 bg-border mx-1" />
                            <button
                                onClick={handleReset}
                                className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-surface-100 transition-all"
                                title="リセット"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Canvas Area - Mobile (Dual Mode Only) */}
                    {isDualMode && (
                        <div
                            ref={mobileContainerRef}
                            className={`relative bg-surface-100 overflow-hidden ${
                                activeViewport === 'mobile' ? 'flex-[6] border-l-2 border-purple-400' : 'flex-[4] border-l-2 border-gray-200'
                            }`}
                        >
                            {/* Viewport Label */}
                            <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full text-xs font-bold ${
                                activeViewport === 'mobile' ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'
                            }`}>
                                <div className="flex items-center gap-1.5">
                                    <Smartphone className="w-3 h-3" />
                                    Mobile
                                </div>
                            </div>

                            {/* Checkerboard background */}
                            <div className="absolute inset-0 opacity-[0.03]"
                                style={{
                                    backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)',
                                    backgroundSize: '20px 20px',
                                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                                }}
                            />

                            <canvas
                                ref={mobileCanvasRef}
                                className={`w-full h-full relative z-10 ${tool === 'select' ? 'cursor-crosshair' : 'cursor-grab'} ${
                                    activeViewport !== 'mobile' ? 'opacity-70' : ''
                                }`}
                                onMouseDown={handleMobileMouseDown}
                                onMouseMove={handleMobileMouseMove}
                                onMouseUp={handleMobileMouseUp}
                                onMouseLeave={handleMobileMouseUp}
                            />

                            {/* Mobile Toolbar - 下部中央に水平配置 */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background/95 backdrop-blur-sm p-1.5 rounded-lg border border-border shadow-lg z-20">
                                <button
                                    onClick={handleMobileZoomOut}
                                    className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-surface-100 transition-all"
                                    title="縮小"
                                >
                                    <ZoomOut className="w-4 h-4" />
                                </button>
                                <span className="text-xs font-bold text-foreground min-w-[40px] text-center">
                                    {Math.round(mobileScale * 100)}%
                                </span>
                                <button
                                    onClick={handleMobileZoomIn}
                                    className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-surface-100 transition-all"
                                    title="拡大"
                                >
                                    <ZoomIn className="w-4 h-4" />
                                </button>
                                <div className="w-px h-6 bg-border mx-1" />
                                <button
                                    onClick={handleMobileReset}
                                    className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-surface-100 transition-all"
                                    title="リセット"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Side Panel */}
                    <div className="w-80 bg-background border-l border-border p-6 flex flex-col z-20 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.05)]">
                        {editorMode === 'inpaint' ? (
                            <>
                                {/* Inpaint Mode Content */}
                                <div className="mb-6">
                                    <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-1">編集設定</h3>
                                    <p className="text-xs text-muted-foreground">編集したい領域を選択してください。</p>
                                </div>

                                {/* Selections List */}
                                {selections.length > 0 ? (
                                    <div className="mb-6 flex-1 overflow-hidden flex flex-col">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-bold text-foreground">{selections.length} 箇所の選択範囲</p>
                                            <button
                                                onClick={clearAllSelections}
                                                className="text-[10px] font-bold text-red-500 hover:text-red-600 border border-red-100 bg-red-50 px-2 py-1 rounded-sm transition-colors"
                                            >
                                                全て削除
                                            </button>
                                        </div>
                                        <div className="space-y-2 overflow-y-auto pr-1">
                                            {selections.map((sel, index) => {
                                                const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500'];
                                                return (
                                                    <div key={sel.id} className="flex items-center justify-between p-3 bg-surface-50 border border-border rounded-md hover:border-primary/30 transition-colors group">
                                                        <div className="flex items-center gap-3">
                                                            <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${colors[index % colors.length]}`}>
                                                                {index + 1}
                                                            </span>
                                                            <span className="text-xs font-medium text-muted-foreground">
                                                                {Math.round(sel.width)} x {Math.round(sel.height)} px
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => removeSelection(sel.id)}
                                                            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-sm transition-all opacity-50 group-hover:opacity-100"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mb-6 p-6 bg-surface-50 border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-center">
                                        <div className="w-10 h-10 bg-surface-100 rounded-full flex items-center justify-center mb-3">
                                            <Plus className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-bold text-foreground">範囲を選択</p>
                                        <p className="text-xs text-muted-foreground mt-1">画像上をドラッグして<br />編集エリアを指定します。</p>
                                    </div>
                                )}

                                {/* Mobile Selections List (Dual Mode) */}
                                {isDualMode && mobileSelections.length > 0 && (
                                    <div className="mb-6 flex-1 overflow-hidden flex flex-col">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <Smartphone className="w-3 h-3 text-purple-500" />
                                                {mobileSelections.length} 箇所（モバイル）
                                            </p>
                                            <button
                                                onClick={clearAllMobileSelections}
                                                className="text-[10px] font-bold text-red-500 hover:text-red-600 border border-red-100 bg-red-50 px-2 py-1 rounded-sm transition-colors"
                                            >
                                                全て削除
                                            </button>
                                        </div>
                                        <div className="space-y-2 overflow-y-auto pr-1">
                                            {mobileSelections.map((sel, index) => {
                                                const colors = ['bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500'];
                                                return (
                                                    <div key={sel.id} className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-md hover:border-purple-300 transition-colors group">
                                                        <div className="flex items-center gap-3">
                                                            <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${colors[index % colors.length]}`}>
                                                                {index + 1}
                                                            </span>
                                                            <span className="text-xs font-medium text-muted-foreground">
                                                                {Math.round(sel.width)} x {Math.round(sel.height)} px
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => removeMobileSelection(sel.id)}
                                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                                            title="削除"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Reference Design Image */}
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-foreground uppercase tracking-widest mb-3">
                                        <div className="flex items-center gap-2">
                                            <Palette className="w-3.5 h-3.5" />
                                            参考デザイン（任意）
                                        </div>
                                    </label>

                                    <input
                                        ref={referenceInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleReferenceImageUpload}
                                        className="hidden"
                                    />

                                    {!referenceImage ? (
                                        <button
                                            onClick={() => referenceInputRef.current?.click()}
                                            disabled={isAnalyzingDesign}
                                            className="w-full p-4 border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center gap-2 group"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-surface-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                                                <ImagePlus className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                                            </div>
                                            <span className="text-xs text-muted-foreground group-hover:text-foreground">
                                                参考画像をアップロード
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                デザインスタイルを自動解析します
                                            </span>
                                        </button>
                                    ) : (
                                        <div className="relative">
                                            {/* 参考画像プレビュー */}
                                            <div className="relative rounded-lg overflow-hidden border border-border">
                                                <img
                                                    src={referenceImage}
                                                    alt="参考デザイン"
                                                    className="w-full h-24 object-cover"
                                                />
                                                {isAnalyzingDesign && (
                                                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                                        <div className="flex items-center gap-2 text-primary">
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            <span className="text-xs font-medium">解析中...</span>
                                                        </div>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={clearReferenceDesign}
                                                    className="absolute top-2 right-2 p-1.5 bg-background/90 rounded-full hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            {/* デザイン解析結果 */}
                                            {referenceDesign ? (
                                                <div className="mt-3 p-3 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg border border-primary/10">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                                                        <span className="text-xs font-bold text-foreground">解析済みスタイル</span>
                                                    </div>

                                                    {/* カラーパレット */}
                                                    <div className="flex items-center gap-1 mb-2">
                                                        {Object.entries(referenceDesign.colorPalette).map(([key, color]) => (
                                                            <div
                                                                key={key}
                                                                className="w-5 h-5 rounded-full border border-white shadow-sm"
                                                                style={{ backgroundColor: color }}
                                                                title={`${key}: ${color}`}
                                                            />
                                                        ))}
                                                    </div>

                                                    {/* Vibe タグ */}
                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                        {referenceDesign.vibe.split(/[,、\s]+/).filter(Boolean).slice(0, 4).map((tag, i) => (
                                                            <span
                                                                key={i}
                                                                className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-medium rounded-full"
                                                            >
                                                                {tag.trim()}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    {/* 説明 */}
                                                    <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                                                        {referenceDesign.description}
                                                    </p>
                                                </div>
                                            ) : !isAnalyzingDesign && (
                                                <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                                    <p className="text-[10px] text-amber-700">
                                                        スタイル解析はスキップされましたが、画像はAIに送信されます
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Slot-based Prompt Input */}
                                <div className="mb-6 mt-auto space-y-4">
                                    {/* Edit Type Selector */}
                                    <div>
                                        <label className="block text-xs font-bold text-foreground uppercase tracking-widest mb-2">
                                            編集タイプ
                                        </label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(Object.keys(editTypeConfig) as EditType[]).map((type) => (
                                                <button
                                                    key={type}
                                                    onClick={() => {
                                                        setEditType(type);
                                                        setSlotBefore('');
                                                        setSlotAfter('');
                                                    }}
                                                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                                                        editType === type
                                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                                            : 'bg-surface-100 text-muted-foreground hover:bg-surface-200 hover:text-foreground'
                                                    }`}
                                                >
                                                    <span className="mr-1">{editTypeConfig[type].icon}</span>
                                                    {editTypeConfig[type].label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Before/After Inputs */}
                                    {editType === 'custom' ? (
                                        <div>
                                            <label className="block text-xs font-bold text-foreground uppercase tracking-widest mb-2">
                                                自由プロンプト
                                            </label>
                                            <textarea
                                                value={prompt}
                                                onChange={(e) => setPrompt(e.target.value)}
                                                placeholder="例: テキストを消す、背景を青空にする..."
                                                className="w-full h-24 px-4 py-3 rounded-md border border-input bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none shadow-sm"
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {/* Before Input */}
                                            <div>
                                                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                                    <span className="text-red-400">Before</span>
                                                    <span className="text-muted-foreground/50">現在の状態</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={slotBefore}
                                                    onChange={(e) => setSlotBefore(e.target.value)}
                                                    placeholder={editTypeConfig[editType].beforePlaceholder}
                                                    className="w-full px-3 py-2.5 rounded-md border border-input bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm"
                                                />
                                            </div>

                                            {/* Arrow */}
                                            <div className="flex justify-center">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <div className="h-px w-8 bg-border" />
                                                    <span className="text-lg">↓</span>
                                                    <div className="h-px w-8 bg-border" />
                                                </div>
                                            </div>

                                            {/* After Input */}
                                            <div>
                                                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                                    <span className="text-green-500">After</span>
                                                    <span className="text-muted-foreground/50">変更後</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={slotAfter}
                                                    onChange={(e) => setSlotAfter(e.target.value)}
                                                    placeholder={editTypeConfig[editType].afterPlaceholder}
                                                    className="w-full px-3 py-2.5 rounded-md border border-input bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm"
                                                />
                                                {/* Quick Examples */}
                                                {editTypeConfig[editType].examples.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {editTypeConfig[editType].examples.map((example) => (
                                                            <button
                                                                key={example}
                                                                onClick={() => setSlotAfter(example)}
                                                                className="px-2 py-0.5 text-[10px] bg-surface-100 text-muted-foreground rounded hover:bg-surface-200 hover:text-foreground transition-colors"
                                                            >
                                                                {example}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {referenceDesign && (
                                        <p className="text-[10px] text-primary flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" />
                                            参考デザインのスタイルが編集に反映されます
                                        </p>
                                    )}
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-md">
                                        <p className="text-xs text-red-600 font-bold flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                                            {error}
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-3 pt-6 border-t border-border">
                                    <button
                                        onClick={handleInpaint}
                                        disabled={isLoading || isAnalyzingDesign || (selections.length === 0 && mobileSelections.length === 0) || !generatePromptFromSlots().trim()}
                                        className="w-full py-3 px-4 bg-primary text-primary-foreground font-bold text-sm rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                {isDualMode && selections.length > 0 && mobileSelections.length > 0
                                                    ? '両方を生成中...'
                                                    : '生成中...'}
                                            </>
                                        ) : isAnalyzingDesign ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                デザイン解析中...
                                            </>
                                        ) : (
                                            <>
                                                <Wand2 className="w-4 h-4" />
                                                {isDualMode ? (
                                                    `実行する (D:${selections.length} / M:${mobileSelections.length})`
                                                ) : (
                                                    `実行する (${selections.length})`
                                                )}
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={onClose}
                                        disabled={isLoading}
                                        className="w-full py-3 px-4 bg-surface-100 text-muted-foreground font-bold text-sm rounded-md hover:bg-surface-200 hover:text-foreground transition-all disabled:opacity-50"
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Button Mode Content */}
                                <div className="mb-6">
                                    <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-1">ボタン設定</h3>
                                    <p className="text-xs text-muted-foreground">クリッカブルな領域を追加してください。</p>
                                </div>

                                {/* Button Areas List */}
                                {buttonAreas.length > 0 ? (
                                    <div className="mb-6 flex-1 overflow-hidden flex flex-col">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-bold text-foreground">{buttonAreas.length} 個のボタン</p>
                                            <button
                                                onClick={clearAllButtonAreas}
                                                className="text-[10px] font-bold text-red-500 hover:text-red-600 border border-red-100 bg-red-50 px-2 py-1 rounded-sm transition-colors"
                                            >
                                                全て削除
                                            </button>
                                        </div>
                                        <div className="space-y-2 overflow-y-auto pr-1 max-h-40">
                                            {buttonAreas.map((area, index) => (
                                                <div
                                                    key={area.id}
                                                    onClick={() => setSelectedButtonId(area.id)}
                                                    className={`flex items-center justify-between p-3 rounded-md border transition-colors cursor-pointer group ${
                                                        selectedButtonId === area.id
                                                            ? 'bg-blue-50 border-blue-300'
                                                            : 'bg-surface-50 border-border hover:border-blue-200'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                                                            {index + 1}
                                                        </span>
                                                        <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                                                            {area.label || `ボタン ${index + 1}`}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeButtonArea(area.id);
                                                        }}
                                                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-sm transition-all opacity-50 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mb-6 p-6 bg-blue-50 border border-dashed border-blue-200 rounded-lg flex flex-col items-center justify-center text-center">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                                            <MousePointer className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <p className="text-sm font-bold text-foreground">ボタンを追加</p>
                                        <p className="text-xs text-muted-foreground mt-1">画像上をドラッグして<br />ボタン領域を指定します。</p>
                                    </div>
                                )}

                                {/* Selected Button Settings */}
                                {selectedButtonId && buttonAreas.find(a => a.id === selectedButtonId) && (
                                    <div className="mb-6 p-4 bg-surface-50 border border-border rounded-lg space-y-4">
                                        <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">ボタン詳細設定</h4>

                                        {/* Label */}
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">ラベル</label>
                                            <input
                                                type="text"
                                                value={buttonAreas.find(a => a.id === selectedButtonId)?.label || ''}
                                                onChange={(e) => updateButtonArea(selectedButtonId, { label: e.target.value })}
                                                placeholder="例: 今すぐ購入"
                                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>

                                        {/* Action Type */}
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">アクションタイプ</label>
                                            <select
                                                value={buttonAreas.find(a => a.id === selectedButtonId)?.actionType || 'url'}
                                                onChange={(e) => {
                                                    const newType = e.target.value as 'url' | 'email' | 'phone' | 'scroll' | 'form-input';
                                                    const updates: Partial<ClickableAreaDraft> = { actionType: newType };
                                                    // form-input選択時にデフォルトフィールドを設定
                                                    if (newType === 'form-input' && !buttonAreas.find(a => a.id === selectedButtonId)?.formFields?.length) {
                                                        updates.formTitle = 'お問い合わせ';
                                                        updates.formFields = [
                                                            { id: `field-${Date.now()}`, fieldName: 'name', fieldLabel: 'お名前', fieldType: 'text', required: true },
                                                            { id: `field-${Date.now() + 1}`, fieldName: 'email', fieldLabel: 'メールアドレス', fieldType: 'email', required: true },
                                                        ];
                                                    }
                                                    updateButtonArea(selectedButtonId, updates);
                                                }}
                                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                            >
                                                <option value="url">URL リンク</option>
                                                <option value="email">メールアドレス</option>
                                                <option value="phone">電話番号</option>
                                                <option value="scroll">セクションへスクロール</option>
                                                <option value="form-input">フォーム入力</option>
                                            </select>
                                        </div>

                                        {/* Action Value (for non-form types) */}
                                        {buttonAreas.find(a => a.id === selectedButtonId)?.actionType !== 'form-input' && (
                                            <div>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                                                    {buttonAreas.find(a => a.id === selectedButtonId)?.actionType === 'url' && 'リンク先URL'}
                                                    {buttonAreas.find(a => a.id === selectedButtonId)?.actionType === 'email' && 'メールアドレス'}
                                                    {buttonAreas.find(a => a.id === selectedButtonId)?.actionType === 'phone' && '電話番号'}
                                                    {buttonAreas.find(a => a.id === selectedButtonId)?.actionType === 'scroll' && 'セクションID'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={buttonAreas.find(a => a.id === selectedButtonId)?.actionValue || ''}
                                                    onChange={(e) => updateButtonArea(selectedButtonId, { actionValue: e.target.value })}
                                                    placeholder={
                                                        buttonAreas.find(a => a.id === selectedButtonId)?.actionType === 'url' ? 'https://example.com' :
                                                        buttonAreas.find(a => a.id === selectedButtonId)?.actionType === 'email' ? 'info@example.com' :
                                                        buttonAreas.find(a => a.id === selectedButtonId)?.actionType === 'phone' ? '03-1234-5678' :
                                                        '#section-id'
                                                    }
                                                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                        )}

                                        {/* Form Fields Configuration (for form-input type) */}
                                        {buttonAreas.find(a => a.id === selectedButtonId)?.actionType === 'form-input' && (
                                            <div className="space-y-3 pt-2 border-t border-border">
                                                <div>
                                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">フォームタイトル</label>
                                                    <input
                                                        type="text"
                                                        value={buttonAreas.find(a => a.id === selectedButtonId)?.formTitle || ''}
                                                        onChange={(e) => updateButtonArea(selectedButtonId, { formTitle: e.target.value })}
                                                        placeholder="お問い合わせ"
                                                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-muted-foreground mb-2">フォームフィールド</label>
                                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                                        {(buttonAreas.find(a => a.id === selectedButtonId)?.formFields || []).map((field, idx) => (
                                                            <div key={field.id} className="flex items-center gap-2 p-2 bg-surface-100 rounded-md">
                                                                <input
                                                                    type="text"
                                                                    value={field.fieldLabel}
                                                                    onChange={(e) => {
                                                                        const currentArea = buttonAreas.find(a => a.id === selectedButtonId);
                                                                        if (!currentArea?.formFields) return;
                                                                        const newFields = [...currentArea.formFields];
                                                                        newFields[idx] = { ...newFields[idx], fieldLabel: e.target.value };
                                                                        updateButtonArea(selectedButtonId, { formFields: newFields });
                                                                    }}
                                                                    className="flex-1 px-2 py-1 text-xs rounded border border-input bg-background"
                                                                    placeholder="ラベル"
                                                                />
                                                                <select
                                                                    value={field.fieldType}
                                                                    onChange={(e) => {
                                                                        const currentArea = buttonAreas.find(a => a.id === selectedButtonId);
                                                                        if (!currentArea?.formFields) return;
                                                                        const newFields = [...currentArea.formFields];
                                                                        newFields[idx] = { ...newFields[idx], fieldType: e.target.value as 'text' | 'email' | 'tel' | 'textarea' };
                                                                        updateButtonArea(selectedButtonId, { formFields: newFields });
                                                                    }}
                                                                    className="px-2 py-1 text-xs rounded border border-input bg-background"
                                                                >
                                                                    <option value="text">テキスト</option>
                                                                    <option value="email">メール</option>
                                                                    <option value="tel">電話</option>
                                                                    <option value="textarea">長文</option>
                                                                </select>
                                                                <label className="flex items-center gap-1 text-xs">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={field.required}
                                                                        onChange={(e) => {
                                                                            const currentArea = buttonAreas.find(a => a.id === selectedButtonId);
                                                                            if (!currentArea?.formFields) return;
                                                                            const newFields = [...currentArea.formFields];
                                                                            newFields[idx] = { ...newFields[idx], required: e.target.checked };
                                                                            updateButtonArea(selectedButtonId, { formFields: newFields });
                                                                        }}
                                                                        className="rounded"
                                                                    />
                                                                    必須
                                                                </label>
                                                                <button
                                                                    onClick={() => {
                                                                        const currentArea = buttonAreas.find(a => a.id === selectedButtonId);
                                                                        if (!currentArea?.formFields) return;
                                                                        const newFields = currentArea.formFields.filter((_, i) => i !== idx);
                                                                        updateButtonArea(selectedButtonId, { formFields: newFields });
                                                                    }}
                                                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const currentArea = buttonAreas.find(a => a.id === selectedButtonId);
                                                            const newField: FormFieldConfig = {
                                                                id: `field-${Date.now()}`,
                                                                fieldName: `field_${(currentArea?.formFields?.length || 0) + 1}`,
                                                                fieldLabel: '新しいフィールド',
                                                                fieldType: 'text',
                                                                required: false,
                                                            };
                                                            updateButtonArea(selectedButtonId, {
                                                                formFields: [...(currentArea?.formFields || []), newField]
                                                            });
                                                        }}
                                                        className="mt-2 w-full py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        フィールドを追加
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Error Message */}
                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-md">
                                        <p className="text-xs text-red-600 font-bold flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                                            {error}
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-3 pt-6 border-t border-border mt-auto">
                                    <button
                                        onClick={handleSaveClickableAreas}
                                        className="w-full py-3 px-4 bg-blue-600 text-white font-bold text-sm rounded-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        <Link className="w-4 h-4" />
                                        ボタンを保存 ({buttonAreas.length})
                                    </button>

                                    <button
                                        onClick={onClose}
                                        className="w-full py-3 px-4 bg-surface-100 text-muted-foreground font-bold text-sm rounded-md hover:bg-surface-200 hover:text-foreground transition-all"
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* History Panel */}
                    {showHistory && (
                        <div className="w-80 border-l border-border bg-background animate-in slide-in-from-right duration-200">
                            <InpaintHistoryPanel
                                originalImage={imageUrl}
                                onSelectHistory={(history) => {
                                    // 履歴から画像を選択した場合、その結果画像を使用
                                    onSave(history.resultImage);
                                }}
                                onClose={() => setShowHistory(false)}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* カット確認ダイアログ */}
            {showCutConfirm && cutStartY !== null && cutEndY !== null && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
                    <div className="bg-background rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-100 rounded-full">
                                <Scissors className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">画像をカットしますか？</h3>
                                <p className="text-sm text-muted-foreground">
                                    選択した範囲（{Math.round(Math.abs(cutEndY - cutStartY))}px）が削除されます
                                </p>
                            </div>
                        </div>

                        <div className="bg-surface-100 rounded-lg p-4 mb-6">
                            <p className="text-xs text-muted-foreground mb-2">カット範囲</p>
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-mono">Y: {Math.round(Math.min(cutStartY, cutEndY))}px</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-mono">Y: {Math.round(Math.max(cutStartY, cutEndY))}px</span>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={cancelCut}
                                disabled={isLoading}
                                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-surface-100 transition-all disabled:opacity-50"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={executeCut}
                                disabled={isLoading}
                                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        処理中...
                                    </>
                                ) : (
                                    <>
                                        <Scissors className="w-4 h-4" />
                                        カットを実行
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
