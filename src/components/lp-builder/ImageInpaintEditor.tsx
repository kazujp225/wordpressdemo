"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, Wand2, RotateCcw, ZoomIn, ZoomOut, Move, Trash2, Plus, DollarSign, Clock, Check, History, Link, MousePointer, ImagePlus, Palette, Sparkles, Monitor, Smartphone, Scissors, Type, Paintbrush, Box, Image as ImageIcon, PenTool, MessageSquare, AlertTriangle, UserPlus, Upload, Maximize2 } from 'lucide-react';
import { InpaintHistoryPanel } from './InpaintHistoryPanel';
import { TextFixModule } from './TextFixModule';
import type { ClickableArea, FormFieldConfig, ViewportType } from '@/types';
import { usdToTokens, formatTokens } from '@/lib/plans';

// インペイントの推定コスト（USD）
const INPAINT_COST_USD = 0.134;

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

type EditorMode = 'inpaint' | 'button' | 'text-fix';

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
    // 変更前の画像ID（履歴保存用）
    previousImageId?: number;
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
    previousImageId,
    mobileImageUrl,
    mobileClickableAreas: initialMobileClickableAreas = [],
}: ImageInpaintEditorProps) {
    // デュアルモード判定
    const isDualMode = !!mobileImageUrl;
    console.log('[ImageInpaintEditor] Props received:', { imageUrl, mobileImageUrl, isDualMode });
    const [activeViewport, setActiveViewport] = useState<ViewportType>('desktop');

    // Desktop canvas refs and state
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [selections, setSelections] = useState<SelectionRect[]>([]);
    const [currentSelection, setCurrentSelection] = useState<SelectionRect | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);

    // currentSelectionの最新値を保持するref（デスクトップ用）
    const currentSelectionRef = useRef<SelectionRect | null>(null);
    useEffect(() => {
        currentSelectionRef.current = currentSelection;
    }, [currentSelection]);

    // isSelectingの最新値を保持するref（デスクトップ用）
    const isSelectingRef = useRef(false);
    useEffect(() => {
        isSelectingRef.current = isSelecting;
    }, [isSelecting]);

    // モバイル用のref（useEffectはstate定義後に移動）
    const mobileCurrentSelectionRef = useRef<SelectionRect | null>(null);
    const isMobileSelectingRef = useRef(false);

    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // スロット型プロンプト用state
    type EditType = 'color' | 'text' | 'object' | 'person' | 'background' | 'style' | 'custom';
    const [editType, setEditType] = useState<EditType>('color');
    const [slotBefore, setSlotBefore] = useState('');
    const [slotAfter, setSlotAfter] = useState('');

    // 出力画像サイズ選択用state（Gemini APIがサポートする値のみ）
    type OutputImageSize = '1K' | '2K' | '4K';
    const [outputSize, setOutputSize] = useState<OutputImageSize>('4K');

    // 編集タイプごとのプリセット
    const editTypeConfig: Record<EditType, { label: string; Icon: React.ComponentType<{ className?: string }>; beforePlaceholder: string; afterPlaceholder: string; examples: string[] }> = {
        color: {
            label: '色',
            Icon: Paintbrush,
            beforePlaceholder: '例: 青いボタン',
            afterPlaceholder: '例: 緑のボタン',
            examples: ['赤', '青', '緑', '白', '黒', 'グレー', 'ゴールド']
        },
        text: {
            label: 'テキスト',
            Icon: Type,
            beforePlaceholder: '例: 無料体験',
            afterPlaceholder: '例: 今すぐ申込',
            examples: ['削除する', '日本語に', '英語に']
        },
        object: {
            label: 'オブジェクト',
            Icon: Box,
            beforePlaceholder: '例: 左の人物',
            afterPlaceholder: '例: 削除して背景で埋める',
            examples: ['削除', '別の画像に', '移動']
        },
        person: {
            label: '人物',
            Icon: UserPlus,
            beforePlaceholder: '例: なし',
            afterPlaceholder: '例: スーツの男性を追加',
            examples: ['男性を追加', '女性を追加', '削除']
        },
        background: {
            label: '背景',
            Icon: ImageIcon,
            beforePlaceholder: '例: 白い背景',
            afterPlaceholder: '例: 青空の背景',
            examples: ['白に', '透明に', '青空', 'グラデーション']
        },
        style: {
            label: 'スタイル',
            Icon: PenTool,
            beforePlaceholder: '例: シンプルなデザイン',
            afterPlaceholder: '例: モダンで洗練されたデザイン',
            examples: ['モダンに', 'ミニマルに', 'ポップに', 'プロフェッショナルに']
        },
        custom: {
            label: '自由入力',
            Icon: MessageSquare,
            beforePlaceholder: '現在の状態を記述...',
            afterPlaceholder: '変更後の状態を記述...',
            examples: []
        }
    };

    // スロットからプロンプトを生成
    const generatePromptFromSlots = (): string => {
        if (editType === 'custom' || editType === 'person' || editType === 'object') return prompt;
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

    // クレジット残高チェック
    const [creditBalance, setCreditBalance] = useState<number | null>(null);
    const [isLoadingCredit, setIsLoadingCredit] = useState(true);
    const hasInsufficientCredit = creditBalance !== null && creditBalance < INPAINT_COST_USD;

    // クレジット残高を取得
    useEffect(() => {
        const fetchCreditBalance = async () => {
            try {
                const response = await fetch('/api/user/status');
                if (response.ok) {
                    const data = await response.json();
                    setCreditBalance(data.creditBalanceUsd || 0);
                }
            } catch (error) {
                console.error('Failed to fetch credit balance:', error);
            } finally {
                setIsLoadingCredit(false);
            }
        };
        fetchCreditBalance();
    }, []);

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

    // モバイル選択stateの変更をrefに同期
    useEffect(() => {
        mobileCurrentSelectionRef.current = mobileCurrentSelection;
    }, [mobileCurrentSelection]);
    useEffect(() => {
        isMobileSelectingRef.current = isMobileSelecting;
    }, [isMobileSelecting]);

    // モバイルビューポートに切り替えた時にスケールを再計算
    useEffect(() => {
        if (activeViewport === 'mobile' && mobileImage && mobileContainerRef.current) {
            // 少し遅延させてDOMが更新されるのを待つ
            const timer = setTimeout(() => {
                if (mobileContainerRef.current && mobileImage) {
                    const containerWidth = mobileContainerRef.current.clientWidth - 40;
                    const containerHeight = mobileContainerRef.current.clientHeight - 40;
                    if (containerWidth > 0 && containerHeight > 0) {
                        const scaleX = containerWidth / mobileImage.width;
                        const scaleY = containerHeight / mobileImage.height;
                        const newScale = Math.min(scaleX, scaleY, 1);
                        setMobileScale(newScale);
                        setMobileOffset({
                            x: (containerWidth - mobileImage.width * newScale) / 2,
                            y: (containerHeight - mobileImage.height * newScale) / 2
                        });
                        console.log('[ImageInpaintEditor] Mobile viewport activated, recalculated scale:', newScale);
                    }
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [activeViewport, mobileImage]);

    // 参考画像機能（直接base64送信 - BannerEditorと同じ方式）
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [referenceDesign, setReferenceDesign] = useState<DesignDefinition | null>(null);
    const [isAnalyzingDesign, setIsAnalyzingDesign] = useState(false);
    const referenceInputRef = useRef<HTMLInputElement>(null);

    // 高画質化
    const [isUpscaling, setIsUpscaling] = useState(false);

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
        console.log('[ImageInpaintEditor] Mobile image useEffect triggered, mobileImageUrl:', mobileImageUrl);
        if (!mobileImageUrl) {
            console.log('[ImageInpaintEditor] No mobileImageUrl, skipping mobile image load');
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            console.log('[ImageInpaintEditor] Mobile image loaded successfully:', img.width, 'x', img.height);
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
        img.onerror = (e) => {
            console.error('[ImageInpaintEditor] モバイル画像の読み込みに失敗しました:', mobileImageUrl, e);
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
        const areasToRender = (editorMode === 'inpaint' || editorMode === 'text-fix')
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
            const textFixColors = ['#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f']; // Amber colors for text-fix
            const buttonColor = '#3b82f6'; // Blue for buttons
            const isSelected = editorMode === 'button' && sel.id === selectedButtonId;
            const color = editorMode === 'inpaint'
                ? inpaintColors[index % inpaintColors.length]
                : editorMode === 'text-fix'
                ? textFixColors[index % textFixColors.length]
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
    }, [isDualMode, mobileImage, mobileSelections, mobileScale, mobileOffset, mobileCurrentSelection, activeViewport]);

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

        // refも同時に更新
        isSelectingRef.current = true;
        currentSelectionRef.current = null;
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

        if (!isSelecting || !image) {
            // console.log('[Selection] handleMouseMove skipped', { isSelecting, image: !!image });
            return;
        }

        const newSelection: SelectionRect = {
            id: 'temp',
            x: Math.max(0, Math.min(startPoint.x, coords.x)),
            y: Math.max(0, Math.min(startPoint.y, coords.y)),
            width: Math.min(Math.abs(coords.x - startPoint.x), image.width - Math.min(startPoint.x, coords.x)),
            height: Math.min(Math.abs(coords.y - startPoint.y), image.height - Math.min(startPoint.y, coords.y))
        };
        // refも同時に更新
        currentSelectionRef.current = newSelection;
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
            if (maxY - minY > 10) {
                setShowCutConfirm(true);
            } else {
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

        // refまたはstateから選択を取得
        const sel = currentSelectionRef.current || currentSelection;

        if (sel && sel.width > 10 && sel.height > 10 && (editorMode === 'inpaint' || editorMode === 'text-fix')) {
            const newId = Date.now().toString();
            console.log('[ImageInpaintEditor] Adding selection:', { ...sel, id: newId }, 'Current count:', selections.length);
            setSelections(prev => {
                const newSelections = [...prev, { ...sel, id: newId }];
                console.log('[ImageInpaintEditor] New selections count:', newSelections.length);
                return newSelections;
            });
        } else if (sel && sel.width > 10 && sel.height > 10 && editorMode === 'button') {
            const newId = Date.now().toString();
            const newButtonArea: ClickableAreaDraft = {
                ...sel,
                id: newId,
                actionType: 'url',
                actionValue: '',
                label: '',
            };
            setButtonAreas(prev => [...prev, newButtonArea]);
            setSelectedButtonId(newId);
        }

        currentSelectionRef.current = null;
        isSelectingRef.current = false;
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

        // インペイント/文字化け修正モードのみ対応（ボタンモードはデスクトップで設定）
        if (editorMode === 'inpaint' || editorMode === 'text-fix') {
            // refも同時に更新
            isMobileSelectingRef.current = true;
            mobileCurrentSelectionRef.current = null;
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

        // refも同時に更新
        mobileCurrentSelectionRef.current = newSelection;
        setMobileCurrentSelection(newSelection);
    };

    const handleMobileMouseUp = () => {
        if (isPanning) {
            setIsPanning(false);
            return;
        }

        if (!isMobileSelecting) {
            return;
        }

        // refから直接取得（stateより確実）
        const sel = mobileCurrentSelectionRef.current;
        if (sel && sel.width > 10 && sel.height > 10) {
            const newId = 'mobile-' + Date.now().toString();
            setMobileSelections(prev => [...prev, { ...sel, id: newId }]);
        }

        mobileCurrentSelectionRef.current = null;
        isMobileSelectingRef.current = false;
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

            // インペイント処理関数（元画像のサイズ情報を含む）
            const processInpaint = async (
                targetImageUrl: string,
                targetMasks: { x: number; y: number; width: number; height: number }[],
                label: string,
                originalWidth: number,
                originalHeight: number
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
                        referenceImageBase64: resizedReferenceImage,
                        outputSize: outputSize,
                        originalWidth: originalWidth,
                        originalHeight: originalHeight,
                        sectionId: sectionId ? parseInt(String(sectionId)) || undefined : undefined,
                        previousImageId: previousImageId || undefined,
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
                    processInpaint(imageUrl, desktopMasks, 'デスクトップ', image.width, image.height)
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
                    processInpaint(mobileImageUrl, mobileMasks, 'モバイル', mobileImage.width, mobileImage.height)
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
    const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setReferenceImage(base64);
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

    // 高画質化
    const handleUpscale = useCallback(async () => {
        if (!imageUrl || isUpscaling) return;
        setIsUpscaling(true);
        try {
            const response = await fetch('/api/ai/upscale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl, scale: 2, useAI: true }),
            });
            const data = await response.json();
            if (response.ok && data.success && data.media?.filePath) {
                onSave(data.media.filePath);
            } else {
                setError(data.error || '高画質化に失敗しました');
            }
        } catch (err: any) {
            setError('高画質化中にエラーが発生しました');
        } finally {
            setIsUpscaling(false);
        }
    }, [imageUrl, isUpscaling, onSave]);

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
                            <h3 className="text-xl font-bold text-foreground mb-2">完了!</h3>
                            <p className="text-muted-foreground text-sm mb-6">変更を保存中...</p>

                            {costInfo && (
                                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">消費トークン</p>
                                        <p className="text-lg font-bold text-foreground font-mono">{formatTokens(usdToTokens(costInfo.estimatedCost))}</p>
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
                            <div className={`p-2 rounded-md border ${
                                editorMode === 'inpaint' ? 'bg-primary/10 text-primary border-primary/20'
                                : editorMode === 'text-fix' ? 'bg-amber-50 text-amber-600 border-amber-200'
                                : 'bg-blue-50 text-blue-600 border-blue-200'
                            }`}>
                                {editorMode === 'inpaint' ? <Wand2 className="w-5 h-5" />
                                 : editorMode === 'text-fix' ? <Type className="w-5 h-5" />
                                 : <MousePointer className="w-5 h-5" />}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground">
                                    {editorMode === 'inpaint' ? 'AI画像編集'
                                     : editorMode === 'text-fix' ? '文字修正'
                                     : 'ボタン設定'}
                                </h2>
                                <p className="text-xs text-muted-foreground font-medium">
                                    {editorMode === 'inpaint'
                                        ? '変更したい部分を囲んで修正（複数選択OK）'
                                        : editorMode === 'text-fix'
                                        ? '文字化けした部分を囲んで修正'
                                        : '画像上にクリックできるボタン領域を設定'}
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
                            <button
                                onClick={() => setEditorMode('text-fix')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                    editorMode === 'text-fix'
                                        ? 'bg-amber-500 text-white shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-amber-50'
                                }`}
                            >
                                <Type className="w-4 h-4" />
                                文字化け修正
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
                                    <Sparkles className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-xs font-mono font-bold">{formatTokens(usdToTokens(costInfo.estimatedCost))}</span>
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
                    {/* Canvas Area - Desktop (show when not dual mode OR when desktop is active) */}
                    {(!isDualMode || activeViewport === 'desktop') && (
                        <div
                            ref={containerRef}
                            className="relative bg-surface-100 overflow-hidden flex-1"
                        >
                            {/* Viewport Label for Dual Mode */}
                            {isDualMode && (
                                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full text-xs font-bold bg-blue-500 text-white">
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
                                }`}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                            />

                        </div>
                    )}

                    {/* Canvas Area - Mobile (show only when mobile is active in dual mode) */}
                    {isDualMode && activeViewport === 'mobile' && (
                        <div
                            ref={mobileContainerRef}
                            className="relative bg-surface-100 overflow-hidden flex-1"
                        >
                            {/* Viewport Label */}
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full text-xs font-bold bg-purple-500 text-white">
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
                                className={`w-full h-full relative z-10 ${tool === 'select' ? 'cursor-crosshair' : 'cursor-grab'}`}
                                onMouseDown={handleMobileMouseDown}
                                onMouseMove={handleMobileMouseMove}
                                onMouseUp={handleMobileMouseUp}
                                onMouseLeave={handleMobileMouseUp}
                            />

                        </div>
                    )}

                    {/* Side Panel */}
                    <div className="w-80 bg-background border-l border-border flex flex-col z-20 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.05)] overflow-hidden">
                        {editorMode === 'inpaint' ? (
                            <div className="flex-1 overflow-y-auto p-6">
                                {/* Inpaint Mode Content */}
                                <div className="mb-6">
                                    <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-1">AI編集</h3>
                                    <p className="text-xs text-muted-foreground">変更したい部分を囲んでください</p>
                                </div>

                                {/* Selections List - Show based on active viewport */}
                                {(() => {
                                    const isDesktopActive = !isDualMode || activeViewport === 'desktop';
                                    const currentSelections = isDesktopActive ? selections : mobileSelections;
                                    const clearFunc = isDesktopActive ? clearAllSelections : clearAllMobileSelections;
                                    const removeFunc = isDesktopActive ? removeSelection : removeMobileSelection;
                                    const colors = isDesktopActive
                                        ? ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500']
                                        : ['bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500'];
                                    const bgStyle = isDesktopActive
                                        ? 'bg-surface-50 border-border hover:border-primary/30'
                                        : 'bg-purple-50 border-purple-200 hover:border-purple-300';

                                    if (currentSelections.length > 0) {
                                        return (
                                            <div className="mb-6">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                        {!isDesktopActive && <Smartphone className="w-3 h-3 text-purple-500" />}
                                                        {isDesktopActive && isDualMode && <Monitor className="w-3 h-3 text-blue-500" />}
                                                        {currentSelections.length} 箇所の選択範囲
                                                    </p>
                                                    <button
                                                        onClick={clearFunc}
                                                        className="text-[10px] font-bold text-red-500 hover:text-red-600 border border-red-100 bg-red-50 px-2 py-1 rounded-sm transition-colors"
                                                    >
                                                        全て削除
                                                    </button>
                                                </div>
                                                <div className="space-y-2 overflow-y-auto pr-1">
                                                    {currentSelections.map((sel, index) => (
                                                        <div key={sel.id} className={`flex items-center justify-between p-3 border rounded-md transition-colors group ${bgStyle}`}>
                                                            <div className="flex items-center gap-3">
                                                                <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${colors[index % colors.length]}`}>
                                                                    {index + 1}
                                                                </span>
                                                                <span className="text-xs font-medium text-muted-foreground">
                                                                    {Math.round(sel.width)} x {Math.round(sel.height)} px
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => removeFunc(sel.id)}
                                                                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-sm transition-all opacity-50 group-hover:opacity-100"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="mb-6 p-6 bg-surface-50 border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-center">
                                            <div className="w-10 h-10 bg-surface-100 rounded-full flex items-center justify-center mb-3">
                                                <Plus className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                            <p className="text-sm font-bold text-foreground">範囲を選択</p>
                                            <p className="text-xs text-muted-foreground mt-1">画像上をドラッグして<br />変更したい部分を囲む</p>
                                        </div>
                                    );
                                })()}

                                {/* 参照写真アップロード（人物・オブジェクト用） */}
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-foreground uppercase tracking-widest mb-3">
                                        <div className="flex items-center gap-2">
                                            <Upload className="w-3.5 h-3.5" />
                                            参照写真（任意）
                                        </div>
                                    </label>
                                    <p className="text-[10px] text-muted-foreground mb-2">
                                        差し替えたい人物・オブジェクトの写真をアップロード
                                    </p>

                                    <input
                                        ref={referenceInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleReferenceImageUpload}
                                        className="hidden"
                                    />

                                    {!referenceImage ? (
                                        <div
                                            onClick={() => referenceInputRef.current?.click()}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                const file = e.dataTransfer.files[0];
                                                if (file && file.type.startsWith('image/')) {
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => {
                                                        const result = ev.target?.result as string;
                                                        setReferenceImage(result);
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                            onDragOver={(e) => e.preventDefault()}
                                            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface-50 py-6 cursor-pointer hover:border-primary/50 hover:bg-surface-100 transition-colors"
                                        >
                                            <UserPlus className="w-6 h-6 text-muted-foreground/40 mb-2" />
                                            <p className="text-[11px] font-medium text-muted-foreground">
                                                写真をアップロード
                                            </p>
                                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                                ドラッグ&ドロップまたはクリック
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="relative group">
                                            <div className="rounded-lg overflow-hidden border border-border bg-surface-50">
                                                <img
                                                    src={referenceImage}
                                                    alt="参照画像"
                                                    className="w-full h-24 object-contain"
                                                />
                                            </div>
                                            <button
                                                onClick={clearReferenceDesign}
                                                className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Slot-based Prompt Input */}
                                <div className="mb-6 mt-auto space-y-4">
                                    {/* Edit Type Selector - Grid */}
                                    <div>
                                        <label className="block text-xs font-bold text-foreground uppercase tracking-widest mb-2">
                                            編集メニュー
                                        </label>
                                        <div className="grid grid-cols-4 gap-1">
                                            {(Object.keys(editTypeConfig) as EditType[]).map((type) => {
                                                const { Icon } = editTypeConfig[type];
                                                return (
                                                    <button
                                                        key={type}
                                                        onClick={() => {
                                                            setEditType(type);
                                                            setSlotBefore('');
                                                            setSlotAfter('');
                                                        }}
                                                        className={`flex flex-col items-center gap-1 py-2.5 px-1 text-[10px] font-medium rounded-lg border transition-all ${
                                                            editType === type
                                                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                                                : 'bg-white text-muted-foreground border-border hover:bg-surface-50 hover:border-primary/30 hover:text-foreground'
                                                        }`}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                        {editTypeConfig[type].label}
                                                    </button>
                                                );
                                            })}
                                            {/* 高画質化 */}
                                            <button
                                                onClick={handleUpscale}
                                                disabled={isUpscaling || !imageUrl}
                                                className={`flex flex-col items-center gap-1 py-2.5 px-1 text-[10px] font-medium rounded-lg border transition-all bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed`}
                                            >
                                                {isUpscaling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Maximize2 className="h-4 w-4" />}
                                                {isUpscaling ? '処理中' : '高画質化'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Before/After Inputs */}
                                    {editType === 'custom' || editType === 'person' || editType === 'object' ? (
                                        <div>
                                            <label className="block text-xs font-bold text-foreground uppercase tracking-widest mb-2">
                                                {editType === 'person' ? '人物の変更指示' : editType === 'object' ? 'オブジェクトの変更指示' : '自由プロンプト'}
                                            </label>
                                            <textarea
                                                value={prompt}
                                                onChange={(e) => setPrompt(e.target.value)}
                                                placeholder={
                                                    editType === 'person'
                                                        ? '例: この人物を添付した写真の人物に差し替えて...'
                                                        : editType === 'object'
                                                            ? '例: 左のロゴを添付した画像に差し替えて...'
                                                            : '例: テキストを消す、背景を青空にする...'
                                                }
                                                rows={4}
                                                className="w-full px-4 py-3 rounded-md border border-input bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none shadow-sm"
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

                                    {referenceImage && (
                                        <p className="text-[10px] text-primary flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" />
                                            参照写真を反映して仕上げます
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

                                {/* クレジット不足警告 */}
                                {hasInsufficientCredit && (
                                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                                        <p className="text-xs text-amber-700 font-bold flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 shrink-0" />
                                            クレジット不足です（残高: {formatTokens(usdToTokens(creditBalance || 0))} / 必要: {formatTokens(usdToTokens(INPAINT_COST_USD))}）
                                        </p>
                                        <a href="/admin/settings" className="text-xs text-amber-600 underline mt-1 block">
                                            クレジットを購入する →
                                        </a>
                                    </div>
                                )}

                                <div className="space-y-3 pt-6 border-t border-border">
                                    <button
                                        onClick={handleInpaint}
                                        disabled={isLoading || isLoadingCredit || hasInsufficientCredit || (selections.length === 0 && mobileSelections.length === 0) || !generatePromptFromSlots().trim()}
                                        className="w-full py-3 px-4 bg-primary text-primary-foreground font-bold text-sm rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        {isLoadingCredit ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                残高確認中...
                                            </>
                                        ) : hasInsufficientCredit ? (
                                            <>
                                                <AlertTriangle className="w-4 h-4" />
                                                クレジット不足
                                            </>
                                        ) : isLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                {isDualMode && selections.length > 0 && mobileSelections.length > 0
                                                    ? '両方を生成中...'
                                                    : '生成中...'}
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
                            </div>
                        ) : editorMode === 'button' ? (
                            <div className="flex-1 overflow-y-auto p-6">
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
                            </div>
                        ) : (
                            /* Text Fix Mode Content */
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-amber-100 rounded-lg">
                                            <Type className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-foreground">文字化け修正</h3>
                                            <p className="text-[10px] text-muted-foreground">OCR + AI で文字をくっきり修正</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Instructions */}
                                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                    <h4 className="text-xs font-bold text-amber-900 mb-2">使い方</h4>
                                    <ol className="text-xs text-amber-800 space-y-1.5">
                                        <li className="flex items-start gap-2">
                                            <span className="w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                                            <span>文字化けしている部分を画像上で選択</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                                            <span>「文字を読み取る」で現在の文字を認識</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                                            <span>正しいテキストに編集して修正実行</span>
                                        </li>
                                    </ol>
                                </div>

                                {/* Selections indicator */}
                                {selections.length > 0 ? (
                                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <p className="text-xs text-green-700 font-medium flex items-center gap-2">
                                            <Check className="w-4 h-4" />
                                            {selections.length} 箇所を選択中
                                        </p>
                                    </div>
                                ) : (
                                    <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                        <p className="text-xs text-gray-600">
                                            画像上で文字化けしている部分をドラッグして選択してください
                                        </p>
                                    </div>
                                )}

                                {/* TextFixModule Integration */}
                                {/* デスクトップまたはモバイルの選択範囲に応じて表示 */}
                                {activeViewport === 'desktop' && image && (
                                    <TextFixModule
                                        imageUrl={imageUrl}
                                        selections={selections}
                                        imageWidth={image.width}
                                        imageHeight={image.height}
                                        onTextFixed={(newImageUrl) => {
                                            setShowSuccess(true);
                                            setTimeout(() => {
                                                onSave(newImageUrl);
                                            }, 1500);
                                        }}
                                        onError={(err) => setError(err)}
                                        disabled={isLoading}
                                    />
                                )}
                                {activeViewport === 'mobile' && mobileImage && mobileImageUrl && (
                                    <TextFixModule
                                        imageUrl={mobileImageUrl}
                                        selections={mobileSelections}
                                        imageWidth={mobileImage.width}
                                        imageHeight={mobileImage.height}
                                        onTextFixed={(newMobileImageUrl) => {
                                            setShowSuccess(true);
                                            setTimeout(() => {
                                                onSave(imageUrl, newMobileImageUrl); // デスクトップはそのまま、モバイルを更新
                                            }, 1500);
                                        }}
                                        onError={(err) => setError(err)}
                                        disabled={isLoading}
                                    />
                                )}

                                {/* Error Message */}
                                {error && (
                                    <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-md">
                                        <p className="text-xs text-red-600 font-bold flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                                            {error}
                                        </p>
                                    </div>
                                )}

                                {/* Cancel Button */}
                                <div className="mt-6 pt-6 border-t border-border">
                                    <button
                                        onClick={onClose}
                                        disabled={isLoading}
                                        className="w-full py-3 px-4 bg-surface-100 text-muted-foreground font-bold text-sm rounded-md hover:bg-surface-200 hover:text-foreground transition-all disabled:opacity-50"
                                    >
                                        閉じる
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* History Panel */}
                    {showHistory && (
                        <div className="w-80 border-l border-border bg-background animate-in slide-in-from-right duration-200">
                            <InpaintHistoryPanel
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
