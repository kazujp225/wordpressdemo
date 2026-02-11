'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Save, Download, Loader2, Upload, X, Undo2,
    ZoomIn, ZoomOut, Hand, Trash2, Plus, Wand2, Sparkles,
    Paintbrush, Type, Box, Image as ImageIcon, PenTool, MessageSquare,
    UserPlus, AlertTriangle, Copy, Check, RefreshCw, LayoutGrid,
    Eye,
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { BANNER_PLATFORMS, type BannerSizePreset } from '@/lib/banner-presets';
import type { Banner, BannerPlatform } from '@/types/banner';
import { usdToTokens, formatTokens } from '@/lib/plans';

// ── Types ──────────────────────────────────────────
interface BannerEditorProps {
    banner: Banner | null; // null = new banner
}

interface SelectionRect {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

type EditorMode = 'edit' | 'generate' | 'variations';
type EditType = 'color' | 'text' | 'object' | 'person' | 'background' | 'style' | 'custom';
type CanvasTool = 'select' | 'pan';

interface VariationResult {
    status: 'loading' | 'success' | 'error';
    imageUrl?: string;
    imageId?: number;
    error?: string;
    angle: string;
}

const VARIATION_ANGLES = [
    { label: '忠実', suffix: '' },
    { label: '配色違い', suffix: '配色やカラーテーマを変えたバージョン' },
    { label: 'レイアウト違い', suffix: 'レイアウトや構図を変えたバージョン' },
    { label: 'トーン違い', suffix: '写真/イラストのトーンや雰囲気を変えたバージョン' },
    { label: 'テキスト配置違い', suffix: 'テキストの配置やフォントスタイルを変えたバージョン' },
    { label: '背景違い', suffix: '背景デザインを変えたバージョン' },
];

const INPAINT_COST_USD = 0.134;

const SELECTION_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];
const SELECTION_BG_COLORS = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500'];

const editTypeConfig: Record<EditType, {
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    beforePlaceholder: string;
    afterPlaceholder: string;
    examples: string[];
}> = {
    color: {
        label: '色',
        Icon: Paintbrush,
        beforePlaceholder: '例: 青いボタン',
        afterPlaceholder: '例: 緑のボタン',
        examples: ['赤', '青', '緑', '白', '黒', 'グレー', 'ゴールド'],
    },
    text: {
        label: 'テキスト',
        Icon: Type,
        beforePlaceholder: '例: 無料体験',
        afterPlaceholder: '例: 今すぐ申込',
        examples: ['削除する', '日本語に', '英語に'],
    },
    object: {
        label: 'オブジェクト',
        Icon: Box,
        beforePlaceholder: '例: 左の人物',
        afterPlaceholder: '例: 削除して背景で埋める',
        examples: ['削除', '別の画像に', '移動'],
    },
    person: {
        label: '人物',
        Icon: UserPlus,
        beforePlaceholder: '例: なし',
        afterPlaceholder: '例: スーツの男性を追加',
        examples: ['男性を追加', '女性を追加', '削除'],
    },
    background: {
        label: '背景',
        Icon: ImageIcon,
        beforePlaceholder: '例: 白い背景',
        afterPlaceholder: '例: 青空の背景',
        examples: ['白に', '透明に', '青空', 'グラデーション'],
    },
    style: {
        label: 'スタイル',
        Icon: PenTool,
        beforePlaceholder: '例: シンプルなデザイン',
        afterPlaceholder: '例: モダンで洗練されたデザイン',
        examples: ['モダンに', 'ミニマルに', 'ポップに', 'プロフェッショナルに'],
    },
    custom: {
        label: '自由入力',
        Icon: MessageSquare,
        beforePlaceholder: '現在の状態を記述...',
        afterPlaceholder: '変更後の状態を記述...',
        examples: [],
    },
};

// ── Component ──────────────────────────────────────
export function BannerEditor({ banner }: BannerEditorProps) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadFileInputRef = useRef<HTMLInputElement>(null);

    // ── Shared State ─────────────────────────────
    const [title, setTitle] = useState(banner?.title || '');
    const [platform, setPlatform] = useState<BannerPlatform>(banner?.platform || 'google-display');
    const [width, setWidth] = useState(banner?.width || 300);
    const [height, setHeight] = useState(banner?.height || 250);
    const [presetName, setPresetName] = useState(banner?.presetName || 'Medium Rectangle');
    const [isCustomSize, setIsCustomSize] = useState(banner?.platform === 'custom');
    const [prompt, setPrompt] = useState(banner?.prompt || '');
    const [productInfo, setProductInfo] = useState(banner?.productInfo || '');
    const [segment, setSegment] = useState(banner?.metadata?.segment || '');
    const [referenceImageBase64, setReferenceImageBase64] = useState<string | null>(null);
    const [referencePreview, setReferencePreview] = useState<string | null>(banner?.referenceImageUrl || null);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(banner?.image?.filePath || null);
    const [generatedImageId, setGeneratedImageId] = useState<number | null>(banner?.imageId || null);
    const [bannerId, setBannerId] = useState<number | null>(banner?.id || null);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // ── Mode State ───────────────────────────────
    const hasExistingImage = !!(banner?.image?.filePath);
    const [editorMode, setEditorMode] = useState<EditorMode>(hasExistingImage ? 'edit' : 'generate');

    // ── Edit Mode State ──────────────────────────
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasImage, setCanvasImage] = useState<HTMLImageElement | null>(null);
    const [selections, setSelections] = useState<SelectionRect[]>([]);
    const [currentSelection, setCurrentSelection] = useState<SelectionRect | null>(null);
    const currentSelectionRef = useRef<SelectionRect | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const isSelectingRef = useRef(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [tool, setTool] = useState<CanvasTool>('select');

    const [editType, setEditType] = useState<EditType>('color');
    const [slotBefore, setSlotBefore] = useState('');
    const [slotAfter, setSlotAfter] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // ── Undo History ─────────────────────────────
    const [imageHistory, setImageHistory] = useState<string[]>([]);

    // ── Variations State ─────────────────────────
    const [variationSegments, setVariationSegments] = useState<string[]>(['', '']);
    const [variationResults, setVariationResults] = useState<VariationResult[]>([]);
    const [selectedVariationIndex, setSelectedVariationIndex] = useState<number | null>(null);
    const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
    const [variationsCompletedCount, setVariationsCompletedCount] = useState(0);
    const [variationElapsed, setVariationElapsed] = useState(0);
    const variationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const variationResultsRef = useRef<HTMLDivElement>(null);
    const [hoveredVariationIndex, setHoveredVariationIndex] = useState<number | null>(null);

    // ── Derived Variation Count ──────────────────
    const activeSegments = variationSegments.filter(s => s.trim());
    const variationCount = activeSegments.length;

    // ── Credit Balance ───────────────────────────
    const [creditBalance, setCreditBalance] = useState<number | null>(null);
    const [isLoadingCredit, setIsLoadingCredit] = useState(true);
    const requiredCreditUsd = editorMode === 'variations'
        ? variationCount * INPAINT_COST_USD
        : INPAINT_COST_USD;
    const hasInsufficientCredit = creditBalance !== null && creditBalance < requiredCreditUsd;

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

    // Sync refs
    useEffect(() => { currentSelectionRef.current = currentSelection; }, [currentSelection]);
    useEffect(() => { isSelectingRef.current = isSelecting; }, [isSelecting]);

    // ── Variation Elapsed Timer ──────────────────
    useEffect(() => {
        if (isGeneratingVariations) {
            setVariationElapsed(0);
            variationTimerRef.current = setInterval(() => {
                setVariationElapsed(prev => prev + 1);
            }, 1000);
        } else {
            if (variationTimerRef.current) {
                clearInterval(variationTimerRef.current);
                variationTimerRef.current = null;
            }
        }
        return () => {
            if (variationTimerRef.current) {
                clearInterval(variationTimerRef.current);
            }
        };
    }, [isGeneratingVariations]);

    // ── Auto-scroll to results when generation finishes ──
    useEffect(() => {
        if (!isGeneratingVariations && variationResults.length > 0 && variationsCompletedCount === variationResults.length) {
            setTimeout(() => {
                variationResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        }
    }, [isGeneratingVariations, variationResults.length, variationsCompletedCount]);

    // ── Load Canvas Image ────────────────────────
    useEffect(() => {
        if (!generatedImageUrl || editorMode !== 'edit') return;

        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            setCanvasImage(img);
            if (containerRef.current) {
                const cw = containerRef.current.clientWidth - 40;
                const ch = containerRef.current.clientHeight - 40;
                const sx = cw / img.width;
                const sy = ch / img.height;
                const s = Math.min(sx, sy, 1);
                setScale(s);
                setOffset({
                    x: (cw - img.width * s) / 2,
                    y: (ch - img.height * s) / 2,
                });
            }
        };
        img.onerror = () => {
            console.error('Failed to load canvas image');
        };
        img.src = generatedImageUrl;
    }, [generatedImageUrl, editorMode]);

    // ── Draw Canvas ──────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !canvasImage) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (containerRef.current) {
            canvas.width = containerRef.current.clientWidth;
            canvas.height = containerRef.current.clientHeight;
        }

        // Background
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw image
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);
        ctx.drawImage(canvasImage, 0, 0);
        ctx.restore();

        // Draw selections
        const areasToRender = currentSelection
            ? [...selections, currentSelection]
            : selections;

        areasToRender.forEach((sel, index) => {
            const sx = offset.x + sel.x * scale;
            const sy = offset.y + sel.y * scale;
            const sw = sel.width * scale;
            const sh = sel.height * scale;
            const color = SELECTION_COLORS[index % SELECTION_COLORS.length];

            // Glow
            ctx.save();
            ctx.shadowBlur = 10;
            ctx.shadowColor = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(sx, sy, sw, sh);
            ctx.restore();

            // White border
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, sw, sh);

            // Label badge
            const lw = 28;
            const lh = 20;
            const lx = sx;
            const ly = sy - lh - 4;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(lx, ly, lw, lh, 6);
            ctx.fill();

            ctx.fillStyle = 'white';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${index + 1}`, lx + lw / 2, ly + 14);

            // Corner accents
            const a = 8;
            ctx.fillStyle = 'white';
            ctx.fillRect(sx - 2, sy - 2, a, 2);
            ctx.fillRect(sx - 2, sy - 2, 2, a);
            ctx.fillRect(sx + sw - a + 2, sy - 2, a, 2);
            ctx.fillRect(sx + sw, sy - 2, 2, a);
        });
    }, [canvasImage, selections, currentSelection, scale, offset]);

    // ── Canvas Helpers ───────────────────────────
    const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - offset.x) / scale,
            y: (e.clientY - rect.top - offset.y) / scale,
        };
    }, [offset, scale]);

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (tool === 'pan') {
            setIsPanning(true);
            setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
            return;
        }

        const coords = getCanvasCoords(e);
        if (!canvasImage || coords.x < 0 || coords.y < 0 || coords.x > canvasImage.width || coords.y > canvasImage.height) {
            return;
        }

        isSelectingRef.current = true;
        currentSelectionRef.current = null;
        setIsSelecting(true);
        setStartPoint(coords);
        setCurrentSelection(null);
    };

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isPanning) {
            setOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y,
            });
            return;
        }

        if (!isSelecting || !canvasImage) return;

        const coords = getCanvasCoords(e);
        const newSel: SelectionRect = {
            id: 'temp',
            x: Math.max(0, Math.min(startPoint.x, coords.x)),
            y: Math.max(0, Math.min(startPoint.y, coords.y)),
            width: Math.min(Math.abs(coords.x - startPoint.x), canvasImage.width - Math.min(startPoint.x, coords.x)),
            height: Math.min(Math.abs(coords.y - startPoint.y), canvasImage.height - Math.min(startPoint.y, coords.y)),
        };
        currentSelectionRef.current = newSel;
        setCurrentSelection(newSel);
    };

    const handleCanvasMouseUp = () => {
        if (isPanning) {
            setIsPanning(false);
            return;
        }

        const sel = currentSelectionRef.current || currentSelection;
        if (sel && sel.width > 10 && sel.height > 10) {
            const newId = Date.now().toString();
            setSelections(prev => [...prev, { ...sel, id: newId }]);
        }

        currentSelectionRef.current = null;
        isSelectingRef.current = false;
        setCurrentSelection(null);
        setIsSelecting(false);
        setIsPanning(false);
    };

    const handleZoomIn = () => setScale(prev => Math.min(prev * 1.2, 3));
    const handleZoomOut = () => setScale(prev => Math.max(prev / 1.2, 0.2));

    const removeSelection = (id: string) => {
        setSelections(prev => prev.filter(s => s.id !== id));
    };

    const clearAllSelections = () => {
        setSelections([]);
    };

    // ── Prompt Generation ────────────────────────
    const generatePromptFromSlots = useCallback((): string => {
        if (editType === 'custom') return prompt;
        if (!slotBefore.trim() && !slotAfter.trim()) return '';
        return `【${editTypeConfig[editType].label}の変更】\n変更前: ${slotBefore.trim() || '（現在の状態）'}\n変更後: ${slotAfter.trim()}`;
    }, [editType, slotBefore, slotAfter, prompt]);

    // ── Edit Execution ───────────────────────────
    const handleEdit = useCallback(async () => {
        const editPrompt = generatePromptFromSlots();
        if (!editPrompt.trim()) {
            setEditError('変更内容を入力してください');
            return;
        }
        if (!generatedImageUrl) {
            setEditError('画像がありません');
            return;
        }

        setIsEditing(true);
        setEditError(null);

        // Push current image to undo stack
        setImageHistory(prev => [...prev, generatedImageUrl]);

        try {
            let res: Response;

            if (selections.length > 0 && canvasImage) {
                // Mask-based editing via /api/ai/inpaint
                const masks = selections.map(s => ({
                    x: s.x / canvasImage.width,
                    y: s.y / canvasImage.height,
                    width: s.width / canvasImage.width,
                    height: s.height / canvasImage.height,
                }));
                res = await fetch('/api/ai/inpaint', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageUrl: generatedImageUrl,
                        masks,
                        mask: masks[0],
                        prompt: editPrompt,
                        originalWidth: canvasImage.width,
                        originalHeight: canvasImage.height,
                    }),
                });
            } else {
                // Full image editing via /api/ai/edit-image
                res = await fetch('/api/ai/edit-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageUrl: generatedImageUrl,
                        prompt: editPrompt,
                        productInfo,
                    }),
                });
            }

            const data = await res.json();

            if (!res.ok) {
                // Revert undo stack on failure
                setImageHistory(prev => prev.slice(0, -1));

                if (data.error === 'INSUFFICIENT_CREDIT' || data.error === 'API_KEY_REQUIRED' || data.error === 'SUBSCRIPTION_REQUIRED') {
                    setEditError(data.message || 'クレジット不足です');
                } else if (data.error === 'RATE_LIMITED') {
                    setEditError(data.message || 'リクエスト制限に達しました。しばらくお待ちください。');
                } else {
                    setEditError(data.error || '編集に失敗しました');
                }
                return;
            }

            if (data.success && data.media?.filePath) {
                setGeneratedImageUrl(data.media.filePath);
                setGeneratedImageId(data.media.id);
                setSelections([]);
                toast.success('編集が完了しました');
            } else {
                setImageHistory(prev => prev.slice(0, -1));
                setEditError(data.message || '編集に失敗しました');
            }
        } catch (error: any) {
            console.error('Edit error:', error);
            setImageHistory(prev => prev.slice(0, -1));
            setEditError('編集中にエラーが発生しました');
        } finally {
            setIsEditing(false);
        }
    }, [generatePromptFromSlots, generatedImageUrl, selections, canvasImage, productInfo]);

    // ── Undo ─────────────────────────────────────
    const handleUndo = useCallback(() => {
        setImageHistory(prev => {
            if (prev.length === 0) return prev;
            const newHistory = [...prev];
            const prevUrl = newHistory.pop()!;
            setGeneratedImageUrl(prevUrl);
            setSelections([]);
            return newHistory;
        });
    }, []);

    // ── Image Upload (for edit mode without image) ──
    const handleEditImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) {
            toast.error('画像ファイルを選択してください');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (data.filePath) {
                setGeneratedImageUrl(data.filePath);
                setGeneratedImageId(data.id);
                toast.success('画像をアップロードしました');
            } else {
                toast.error(data.error || 'アップロードに失敗しました');
            }
        } catch {
            toast.error('アップロードに失敗しました');
        }
    }, []);

    // ── Generate Mode Helpers (existing) ─────────
    const platformConfig = BANNER_PLATFORMS.find((p) => p.id === platform);

    const handlePlatformChange = useCallback((newPlatform: BannerPlatform) => {
        setPlatform(newPlatform);
        const config = BANNER_PLATFORMS.find((p) => p.id === newPlatform);
        if (newPlatform === 'custom') {
            setIsCustomSize(true);
            setPresetName(null as any);
        } else if (config && config.presets.length > 0) {
            setIsCustomSize(false);
            const firstPreset = config.presets[0];
            setWidth(firstPreset.width);
            setHeight(firstPreset.height);
            setPresetName(firstPreset.name);
        }
    }, []);

    const handlePresetChange = useCallback((preset: BannerSizePreset) => {
        setWidth(preset.width);
        setHeight(preset.height);
        setPresetName(preset.name);
        setIsCustomSize(false);
    }, []);

    const handleReferenceImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('画像ファイルを選択してください');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            setReferenceImageBase64(result);
            setReferencePreview(result);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            setReferenceImageBase64(result);
            setReferencePreview(result);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    const clearReferenceImage = useCallback(() => {
        setReferenceImageBase64(null);
        setReferencePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    // ── Generate Banner ──────────────────────────
    const handleGenerate = useCallback(async () => {
        if (!prompt && !productInfo) {
            toast.error('プロンプトまたは商材情報を入力してください');
            return;
        }

        setIsGenerating(true);
        try {
            const res = await fetch('/api/ai/generate-banner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    productInfo,
                    referenceImageBase64,
                    referenceImageUrl: referencePreview && !referenceImageBase64 ? referencePreview : undefined,
                    width,
                    height,
                    platform,
                    segment,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.error === 'INSUFFICIENT_CREDIT' || data.error === 'API_KEY_REQUIRED' || data.error === 'SUBSCRIPTION_REQUIRED') {
                    toast.error(data.message || 'クレジット不足です');
                } else if (data.error === 'RATE_LIMITED') {
                    toast.error(data.message || 'リクエスト制限に達しました。しばらくお待ちください。');
                } else {
                    toast.error(data.error || 'バナー生成に失敗しました');
                }
                return;
            }

            if (data.success && data.media) {
                setGeneratedImageUrl(data.media.filePath);
                setGeneratedImageId(data.media.id);
                toast.success('バナーを生成しました');
            } else {
                toast.error(data.message || 'バナー画像を生成できませんでした');
            }
        } catch (error: any) {
            console.error('Banner generation error:', error);
            toast.error('バナー生成中にエラーが発生しました');
        } finally {
            setIsGenerating(false);
        }
    }, [prompt, productInfo, referenceImageBase64, referencePreview, width, height, platform, segment]);

    // ── Upload Reference Image ───────────────────
    const uploadReferenceImage = useCallback(async (): Promise<string | null> => {
        if (!referenceImageBase64) return referencePreview;
        try {
            const res = await fetch('/api/upload-temp-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: referenceImageBase64 }),
            });
            const data = await res.json();
            if (data.url) {
                setReferencePreview(data.url);
                setReferenceImageBase64(null);
                return data.url;
            }
        } catch (e) {
            console.warn('Failed to upload reference image:', e);
        }
        return null;
    }, [referenceImageBase64, referencePreview]);

    // ── Save Banner ──────────────────────────────
    const handleSave = useCallback(async () => {
        if (!title.trim()) {
            toast.error('タイトルを入力してください');
            return;
        }

        setIsSaving(true);
        try {
            const persistedRefUrl = await uploadReferenceImage();

            const payload = {
                title,
                platform,
                width,
                height,
                presetName: isCustomSize ? null : presetName,
                prompt,
                productInfo,
                imageId: generatedImageId,
                referenceImageUrl: persistedRefUrl,
                status: generatedImageId ? 'saved' : 'draft',
                metadata: segment ? { segment } : null,
            };

            let res: Response;
            if (bannerId) {
                res = await fetch(`/api/banners/${bannerId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } else {
                res = await fetch('/api/banners', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            }

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || '保存に失敗しました');
                return;
            }

            const savedBanner = data.banner || data;
            if (!bannerId && savedBanner.id) {
                setBannerId(savedBanner.id);
                window.history.replaceState(null, '', `/admin/banners/${savedBanner.id}`);
            }

            toast.success('保存しました');
        } catch (error) {
            console.error('Save error:', error);
            toast.error('保存中にエラーが発生しました');
        } finally {
            setIsSaving(false);
        }
    }, [title, platform, width, height, presetName, isCustomSize, prompt, productInfo, generatedImageId, bannerId, segment, uploadReferenceImage]);

    // ── Download ─────────────────────────────────
    const handleDownload = useCallback(async () => {
        if (!generatedImageUrl) return;
        try {
            const response = await fetch(generatedImageUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title || 'banner'}-${width}x${height}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            toast.error('ダウンロードに失敗しました');
        }
    }, [generatedImageUrl, title, width, height]);

    // ── Mode Change ──────────────────────────────
    const handleModeChange = useCallback((newMode: EditorMode) => {
        setEditorMode(newMode);
        if (newMode !== 'variations') {
            setSelectedVariationIndex(null);
        }
    }, []);

    // ── Generate Variations ──────────────────────
    const handleGenerateVariations = useCallback(async () => {
        if (!generatedImageUrl) {
            toast.error('元画像が必要です。先に画像を生成またはアップロードしてください');
            return;
        }
        const segments = variationSegments.filter(s => s.trim());
        if (segments.length < 2) {
            toast.error('2つ以上のセグメントを入力してください');
            return;
        }

        const initialResults: VariationResult[] = segments.map(s => ({
            status: 'loading' as const,
            angle: s.trim(),
        }));

        setVariationResults(initialResults);
        setSelectedVariationIndex(null);
        setIsGeneratingVariations(true);
        setVariationsCompletedCount(0);

        const promises = segments.map(async (seg, index) => {
            const segmentLabel = seg.trim();
            try {
                const res = await fetch('/api/ai/generate-banner', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: prompt || '',
                        productInfo,
                        referenceImageUrl: generatedImageUrl,
                        width,
                        height,
                        platform,
                        segment: segmentLabel,
                    }),
                });

                const data = await res.json();

                if (!res.ok) {
                    setVariationResults(prev => {
                        const next = [...prev];
                        next[index] = {
                            status: 'error',
                            angle: segmentLabel,
                            error: data.message || data.error || '生成に失敗しました',
                        };
                        return next;
                    });
                } else if (data.success && data.media) {
                    setVariationResults(prev => {
                        const next = [...prev];
                        next[index] = {
                            status: 'success',
                            imageUrl: data.media.filePath,
                            imageId: data.media.id,
                            angle: segmentLabel,
                        };
                        return next;
                    });
                } else {
                    setVariationResults(prev => {
                        const next = [...prev];
                        next[index] = {
                            status: 'error',
                            angle: segmentLabel,
                            error: data.message || '画像を生成できませんでした',
                        };
                        return next;
                    });
                }
            } catch {
                setVariationResults(prev => {
                    const next = [...prev];
                    next[index] = {
                        status: 'error',
                        angle: segmentLabel,
                        error: '通信エラーが発生しました',
                    };
                    return next;
                });
            } finally {
                setVariationsCompletedCount(prev => prev + 1);
            }
        });

        await Promise.allSettled(promises);
        setIsGeneratingVariations(false);
    }, [generatedImageUrl, variationSegments, prompt, productInfo, width, height, platform]);

    // ── Adopt Variation ──────────────────────────
    const handleAdoptVariation = useCallback(() => {
        if (selectedVariationIndex === null) return;
        const selected = variationResults[selectedVariationIndex];
        if (!selected || selected.status !== 'success' || !selected.imageUrl) return;

        setGeneratedImageUrl(selected.imageUrl);
        setGeneratedImageId(selected.imageId || null);
        toast.success('バリエーションを採用しました');
    }, [selectedVariationIndex, variationResults]);

    // ── Retry Single Variation ───────────────────
    const handleRetryVariation = useCallback(async (index: number) => {
        const result = variationResults[index];
        if (!result || !generatedImageUrl) return;
        const segmentLabel = result.angle;

        setVariationResults(prev => {
            const next = [...prev];
            next[index] = { status: 'loading', angle: segmentLabel };
            return next;
        });

        try {
            const res = await fetch('/api/ai/generate-banner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt || '',
                    productInfo,
                    referenceImageUrl: generatedImageUrl,
                    width,
                    height,
                    platform,
                    segment: segmentLabel,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setVariationResults(prev => {
                    const next = [...prev];
                    next[index] = {
                        status: 'error',
                        angle: segmentLabel,
                        error: data.message || data.error || '生成に失敗しました',
                    };
                    return next;
                });
            } else if (data.success && data.media) {
                setVariationResults(prev => {
                    const next = [...prev];
                    next[index] = {
                        status: 'success',
                        imageUrl: data.media.filePath,
                        imageId: data.media.id,
                        angle: segmentLabel,
                    };
                    return next;
                });
            } else {
                setVariationResults(prev => {
                    const next = [...prev];
                    next[index] = {
                        status: 'error',
                        angle: segmentLabel,
                        error: data.message || '画像を生成できませんでした',
                    };
                    return next;
                });
            }
        } catch {
            setVariationResults(prev => {
                const next = [...prev];
                next[index] = {
                    status: 'error',
                    angle: segmentLabel,
                    error: '通信エラーが発生しました',
                };
                return next;
            });
        }
    }, [variationResults, generatedImageUrl, prompt, productInfo, width, height, platform]);

    // ── Render ────────────────────────────────────
    return (
        <div className="flex h-screen flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-background">
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/banners"
                        className="rounded-md p-2 text-muted-foreground hover:bg-surface-100 hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="バナータイトルを入力..."
                        className="bg-transparent text-lg font-bold text-foreground outline-none placeholder:text-muted-foreground/50 w-60 sm:w-80"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {editorMode === 'edit' && imageHistory.length > 0 && (
                        <button
                            onClick={handleUndo}
                            className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-100 transition-colors"
                        >
                            <Undo2 className="h-4 w-4" />
                            戻す
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-100 transition-colors disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        保存
                    </button>
                    {generatedImageUrl && (
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-100 transition-colors"
                        >
                            <Download className="h-4 w-4" />
                            DL
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                {/* Left Panel */}
                <div className={clsx(
                    "flex-1 flex flex-col bg-surface-50 p-4 lg:p-6 overflow-auto min-h-[200px]",
                    editorMode === 'variations' && variationResults.length > 0
                        ? 'items-stretch justify-start'
                        : 'items-center justify-center'
                )}>
                    {editorMode === 'edit' ? (
                        // Canvas mode
                        generatedImageUrl ? (
                            <div className="w-full h-full flex flex-col">
                                <div
                                    ref={containerRef}
                                    className="relative flex-1 bg-surface-100 rounded-lg overflow-hidden"
                                >
                                    {/* Checkerboard hint */}
                                    <div
                                        className="absolute inset-0 opacity-[0.03]"
                                        style={{
                                            backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)',
                                            backgroundSize: '20px 20px',
                                            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                                        }}
                                    />
                                    <canvas
                                        ref={canvasRef}
                                        className={`w-full h-full relative z-10 ${
                                            tool === 'select' ? 'cursor-crosshair' : 'cursor-grab'
                                        }`}
                                        onMouseDown={handleCanvasMouseDown}
                                        onMouseMove={handleCanvasMouseMove}
                                        onMouseUp={handleCanvasMouseUp}
                                        onMouseLeave={handleCanvasMouseUp}
                                    />
                                </div>
                                {/* Canvas toolbar */}
                                <div className="flex items-center justify-center gap-2 mt-3">
                                    <button
                                        onClick={handleZoomIn}
                                        className="p-2 rounded-md bg-surface-100 text-muted-foreground hover:bg-surface-200 hover:text-foreground transition-colors"
                                        title="ズームイン"
                                    >
                                        <ZoomIn className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={handleZoomOut}
                                        className="p-2 rounded-md bg-surface-100 text-muted-foreground hover:bg-surface-200 hover:text-foreground transition-colors"
                                        title="ズームアウト"
                                    >
                                        <ZoomOut className="h-4 w-4" />
                                    </button>
                                    <div className="w-px h-5 bg-border mx-1" />
                                    <button
                                        onClick={() => setTool('select')}
                                        className={clsx(
                                            'p-2 rounded-md transition-colors',
                                            tool === 'select'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-surface-100 text-muted-foreground hover:bg-surface-200 hover:text-foreground'
                                        )}
                                        title="選択ツール"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setTool('pan')}
                                        className={clsx(
                                            'p-2 rounded-md transition-colors',
                                            tool === 'pan'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-surface-100 text-muted-foreground hover:bg-surface-200 hover:text-foreground'
                                        )}
                                        title="パンツール"
                                    >
                                        <Hand className="h-4 w-4" />
                                    </button>
                                    <div className="w-px h-5 bg-border mx-1" />
                                    <p className="text-xs text-muted-foreground font-mono">
                                        {canvasImage ? `${canvasImage.width} × ${canvasImage.height} px` : `${width} × ${height} px`}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            // Upload drop zone for edit mode
                            <div className="w-full max-w-md">
                                <div
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const file = e.dataTransfer.files[0];
                                        if (file && file.type.startsWith('image/')) {
                                            const input = uploadFileInputRef.current;
                                            if (input) {
                                                const dt = new DataTransfer();
                                                dt.items.add(file);
                                                input.files = dt.files;
                                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                            }
                                        }
                                    }}
                                    onDragOver={(e) => e.preventDefault()}
                                    onClick={() => uploadFileInputRef.current?.click()}
                                    className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-white py-16 cursor-pointer hover:border-primary/50 hover:bg-surface-100 transition-colors"
                                >
                                    <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
                                        <Upload className="h-8 w-8 text-muted-foreground/50" />
                                    </div>
                                    <p className="text-sm font-medium text-foreground">画像をアップロード</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        ドラッグ&ドロップまたはクリック
                                    </p>
                                </div>
                                <input
                                    ref={uploadFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleEditImageUpload}
                                    className="hidden"
                                />
                            </div>
                        )
                    ) : editorMode === 'variations' ? (
                        // Variations grid
                        variationResults.length > 0 ? (
                            <div className="w-full flex flex-col">
                                <div
                                    className={clsx(
                                        'grid',
                                        variationCount <= 4 ? 'grid-cols-2 gap-4' : 'grid-cols-3 gap-3'
                                    )}
                                >
                                    {variationResults.map((result, index) => (
                                        <div
                                            key={index}
                                            className={clsx(
                                                'group relative rounded-xl overflow-hidden transition-all duration-200',
                                                result.status === 'success' && 'cursor-pointer',
                                                selectedVariationIndex === index && result.status === 'success'
                                                    ? 'ring-[3px] ring-indigo-500 ring-offset-2 ring-offset-surface-50 shadow-lg shadow-indigo-500/20 scale-[1.02]'
                                                    : result.status === 'error'
                                                        ? 'ring-1 ring-red-200'
                                                        : result.status === 'success'
                                                            ? 'ring-1 ring-border hover:ring-indigo-300 hover:shadow-md hover:scale-[1.01]'
                                                            : 'ring-1 ring-border'
                                            )}
                                            style={{ aspectRatio: `${width} / ${height}` }}
                                            onClick={() => {
                                                if (result.status === 'success') {
                                                    setSelectedVariationIndex(index);
                                                }
                                            }}
                                        >
                                            {/* Loading skeleton */}
                                            {result.status === 'loading' && (
                                                <div className="absolute inset-0 bg-gradient-to-br from-surface-100 via-surface-50 to-surface-100 flex flex-col items-center justify-center">
                                                    {/* Shimmer sweep */}
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: 'shimmer 2s infinite' }} />
                                                    {/* Animated border glow */}
                                                    <div className="absolute inset-0 rounded-xl" style={{ animation: 'borderGlow 2s ease-in-out infinite', boxShadow: '0 0 0 1px rgba(99,102,241,0.15)' }} />
                                                    <div className="relative flex flex-col items-center">
                                                        {/* Pulsing ring behind spinner */}
                                                        <div className="absolute w-14 h-14 rounded-full bg-indigo-100/50" style={{ animation: 'pulseRing 2s ease-out infinite' }} />
                                                        <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-sm mb-2.5 relative">
                                                            <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                                                        </div>
                                                        <p className="text-[11px] font-bold text-foreground/70">生成中...</p>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5">{result.angle}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Success image — fade-in reveal */}
                                            {result.status === 'success' && result.imageUrl && (
                                                <>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={result.imageUrl}
                                                        alt={`Variation: ${result.angle}`}
                                                        className="w-full h-full object-contain bg-white"
                                                        style={{ animation: 'fadeInUp 0.4s ease-out' }}
                                                        onMouseEnter={() => setHoveredVariationIndex(index)}
                                                        onMouseLeave={() => setHoveredVariationIndex(null)}
                                                    />
                                                    {/* Hover overlay */}
                                                    <div className={clsx(
                                                        'absolute inset-0 transition-opacity duration-200 pointer-events-none',
                                                        selectedVariationIndex === index
                                                            ? 'opacity-100 bg-indigo-500/5'
                                                            : 'opacity-0 group-hover:opacity-100 bg-black/[0.03]'
                                                    )} />
                                                    {/* Selection check badge */}
                                                    {selectedVariationIndex === index && (
                                                        <div className="absolute top-2.5 right-2.5 w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30" style={{ animation: 'scaleIn 0.2s ease-out' }}>
                                                            <Check className="h-4 w-4 text-white" strokeWidth={3} />
                                                        </div>
                                                    )}
                                                    {/* Unselected hover hint — eye icon */}
                                                    {selectedVariationIndex !== index && (
                                                        <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full border-2 border-white/70 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white/30 backdrop-blur-sm flex items-center justify-center">
                                                            <Eye className="h-3.5 w-3.5 text-white drop-shadow" />
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* Error state */}
                                            {result.status === 'error' && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-red-50/80">
                                                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mb-2">
                                                        <X className="h-4 w-4 text-red-400" />
                                                    </div>
                                                    <p className="text-[11px] text-red-500 mb-3 leading-tight line-clamp-2">{result.error}</p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRetryVariation(index);
                                                        }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all shadow-sm"
                                                    >
                                                        <RefreshCw className="h-3 w-3" />
                                                        リトライ
                                                    </button>
                                                </div>
                                            )}

                                            {/* Angle label badge — glass style */}
                                            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold rounded-md tracking-wide">
                                                {result.angle}
                                            </div>

                                            {/* Index number */}
                                            <div className="absolute top-2.5 left-2.5 w-5 h-5 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                                                <span className="text-[10px] font-bold text-white">{index + 1}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Progress bar + info */}
                                <div className="mt-4 space-y-2">
                                    {/* Progress bar — always visible when results exist */}
                                    <div className="w-full bg-surface-200 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className={clsx(
                                                'h-full rounded-full transition-all duration-700 ease-out',
                                                isGeneratingVariations
                                                    ? 'bg-gradient-to-r from-indigo-500 to-violet-500'
                                                    : variationResults.every(r => r.status === 'success')
                                                        ? 'bg-emerald-500'
                                                        : 'bg-indigo-500'
                                            )}
                                            style={{ width: `${(variationsCompletedCount / variationResults.length) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground font-mono">
                                            {width} x {height} px
                                        </p>
                                        <div className="flex items-center gap-3">
                                            {/* Elapsed time */}
                                            {(isGeneratingVariations || variationElapsed > 0) && (
                                                <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                                                    {Math.floor(variationElapsed / 60)}:{String(variationElapsed % 60).padStart(2, '0')}
                                                </span>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                {variationsCompletedCount === variationResults.length ? (
                                                    <span className={clsx(
                                                        'font-bold inline-flex items-center gap-1',
                                                        variationResults.every(r => r.status === 'success')
                                                            ? 'text-emerald-600'
                                                            : 'text-foreground'
                                                    )}>
                                                        {variationResults.every(r => r.status === 'success') && (
                                                            <Check className="h-3 w-3" />
                                                        )}
                                                        {variationResults.filter(r => r.status === 'success').length}/{variationResults.length} 完了
                                                        {variationResults.some(r => r.status === 'error') && (
                                                            <span className="text-red-400 ml-1">
                                                                ({variationResults.filter(r => r.status === 'error').length} 失敗)
                                                            </span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                                                        </span>
                                                        <span className="font-medium">{variationsCompletedCount}/{variationResults.length}</span>
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Per-cell mini status — pill indicators */}
                                    {isGeneratingVariations && (
                                        <div className="flex items-center gap-1 pt-1">
                                            {variationResults.map((r, i) => (
                                                <div
                                                    key={i}
                                                    className={clsx(
                                                        'flex-1 h-1 rounded-full transition-all duration-500',
                                                        r.status === 'success' ? 'bg-emerald-400' :
                                                        r.status === 'error' ? 'bg-red-300' :
                                                        'bg-surface-300 animate-pulse'
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            // Empty state for variations
                            <div className="flex flex-col items-center justify-center p-10 text-center max-w-sm">
                                <div className="relative mb-5">
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 flex items-center justify-center">
                                        <LayoutGrid className="h-9 w-9 text-indigo-400" />
                                    </div>
                                    {/* Decorative dots */}
                                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-200 animate-pulse" />
                                    <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-violet-200 animate-pulse" style={{ animationDelay: '0.5s' }} />
                                </div>
                                <p className="text-sm font-bold text-foreground">セグメント別バリエーション</p>
                                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                    {generatedImageUrl
                                        ? <>元画像をベースに、セグメント（ターゲット層）ごとの<br />バリエーションを一括生成できます</>
                                        : <>先に画像を生成またはアップロードしてから<br />セグメント別のバリエーションを作成できます</>
                                    }
                                </p>
                                <div className="flex items-center gap-1 mt-4 text-[10px] text-muted-foreground/60">
                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                    右パネルでセグメントを設定して生成
                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                </div>
                            </div>
                        )
                    ) : (
                        // Generate mode preview (existing)
                        <>
                            <div
                                className="relative bg-white border border-border rounded-lg shadow-sm flex items-center justify-center overflow-hidden"
                                style={{
                                    width: `min(100%, ${Math.min(width, 800)}px)`,
                                    aspectRatio: `${width} / ${height}`,
                                    maxHeight: 'calc(100vh - 200px)',
                                }}
                            >
                                {generatedImageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={generatedImageUrl}
                                        alt="Generated banner"
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-muted-foreground/40 p-8 text-center">
                                        <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-3">
                                            <Upload className="h-8 w-8" />
                                        </div>
                                        <p className="text-sm font-medium">プレビューエリア</p>
                                        <p className="text-xs mt-1">右パネルからバナーを生成してください</p>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-3 font-mono">
                                {width} × {height} px
                            </p>
                        </>
                    )}
                </div>

                {/* Right Panel */}
                <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-border bg-background overflow-y-auto p-4 lg:p-5 space-y-6">
                    {/* Mode Tabs */}
                    <div className="flex items-center bg-surface-100 rounded-lg p-1 border border-border">
                        <button
                            onClick={() => handleModeChange('edit')}
                            className={clsx(
                                'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-bold transition-all',
                                editorMode === 'edit'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <Wand2 className="h-3.5 w-3.5" />
                            画像編集
                        </button>
                        <button
                            onClick={() => handleModeChange('generate')}
                            className={clsx(
                                'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-bold transition-all',
                                editorMode === 'generate'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            新規生成
                        </button>
                        <button
                            onClick={() => handleModeChange('variations')}
                            className={clsx(
                                'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-bold transition-all',
                                editorMode === 'variations'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <Copy className="h-3.5 w-3.5" />
                            複製生成
                        </button>
                    </div>

                    {editorMode === 'edit' ? (
                        // ── Edit Mode Controls ──
                        <>
                            {/* Edit Type Selector */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                    Edit Type
                                </label>
                                <div className="flex flex-wrap gap-1.5">
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
                                                className={clsx(
                                                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all',
                                                    editType === type
                                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                                        : 'bg-surface-100 text-muted-foreground hover:bg-surface-200 hover:text-foreground'
                                                )}
                                            >
                                                <Icon className="h-3 w-3" />
                                                {editTypeConfig[type].label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Before / After Inputs */}
                            {editType === 'custom' ? (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                        Prompt
                                    </label>
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="例: テキストを消す、背景を青空にする..."
                                        rows={4}
                                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 resize-none"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-3">
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
                                            className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                                        />
                                    </div>

                                    <div className="flex justify-center">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <div className="h-px w-8 bg-border" />
                                            <span className="text-lg">↓</span>
                                            <div className="h-px w-8 bg-border" />
                                        </div>
                                    </div>

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
                                            className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                                        />
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

                            {/* Selections List */}
                            {selections.length > 0 ? (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-bold text-foreground">
                                            {selections.length} 箇所の選択範囲
                                        </p>
                                        <button
                                            onClick={clearAllSelections}
                                            className="text-[10px] font-bold text-red-500 hover:text-red-600 border border-red-100 bg-red-50 px-2 py-1 rounded-sm transition-colors"
                                        >
                                            すべてクリア
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {selections.map((sel, index) => (
                                            <div
                                                key={sel.id}
                                                className="flex items-center justify-between p-3 border rounded-md transition-colors group bg-surface-50 border-border hover:border-primary/30"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${SELECTION_BG_COLORS[index % SELECTION_BG_COLORS.length]}`}>
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
                                        ))}
                                    </div>
                                </div>
                            ) : generatedImageUrl ? (
                                <div className="p-6 bg-surface-50 border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-center">
                                    <div className="w-10 h-10 bg-surface-100 rounded-full flex items-center justify-center mb-3">
                                        <Plus className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm font-bold text-foreground">範囲を選択</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        画像上をドラッグして変更したい部分を囲む
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-2">
                                        選択なしで実行すると画像全体を編集します
                                    </p>
                                </div>
                            ) : null}

                            {/* Error */}
                            {editError && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-md">
                                    <p className="text-xs text-red-600 font-bold flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                                        {editError}
                                    </p>
                                </div>
                            )}

                            {/* Credit Warning */}
                            {hasInsufficientCredit && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                                    <p className="text-xs text-amber-700 font-bold flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        クレジット不足です（残高: {formatTokens(usdToTokens(creditBalance || 0))} / 必要: {formatTokens(usdToTokens(INPAINT_COST_USD))}）
                                    </p>
                                    <a href="/admin/settings" className="text-xs text-amber-600 underline mt-1 block">
                                        クレジットを購入する →
                                    </a>
                                </div>
                            )}

                            {/* Execute Button */}
                            <button
                                onClick={handleEdit}
                                disabled={
                                    isEditing ||
                                    isLoadingCredit ||
                                    hasInsufficientCredit ||
                                    !generatedImageUrl ||
                                    !generatePromptFromSlots().trim()
                                }
                                className="w-full rounded-sm bg-gray-900 py-3 text-sm font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoadingCredit ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        残高確認中...
                                    </>
                                ) : hasInsufficientCredit ? (
                                    <>
                                        <AlertTriangle className="h-4 w-4" />
                                        クレジット不足
                                    </>
                                ) : isEditing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        編集中...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="h-4 w-4" />
                                        {selections.length > 0
                                            ? `編集を実行 (${selections.length}箇所)`
                                            : '編集を実行（全体）'}
                                    </>
                                )}
                            </button>
                        </>
                    ) : editorMode === 'variations' ? (
                        // ── Variations Mode Controls ──
                        <>
                            {/* Reference Image Preview */}
                            <div className="rounded-lg border border-border overflow-hidden">
                                <div className="px-3 py-2.5 bg-surface-50 border-b border-border">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reference Image</p>
                                </div>
                                {generatedImageUrl ? (
                                    <div className="p-3 flex items-center gap-3">
                                        <div className="w-14 h-14 rounded-lg overflow-hidden border border-border bg-white shrink-0 shadow-sm">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={generatedImageUrl} alt="Reference" className="w-full h-full object-contain" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-foreground truncate">{title || 'バナー画像'}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">{width} × {height}px</p>
                                            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">この画像をベースに生成</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 text-center">
                                        <ImageIcon className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1.5" />
                                        <p className="text-xs text-muted-foreground">元画像がありません</p>
                                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">先に画像を生成またはアップロードしてください</p>
                                    </div>
                                )}
                            </div>

                            {/* Segments Input */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
                                    Segments
                                </label>
                                <div className="space-y-2">
                                    {variationSegments.map((seg, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-muted-foreground w-4 text-right shrink-0">{idx + 1}.</span>
                                            <input
                                                type="text"
                                                value={seg}
                                                onChange={(e) => {
                                                    setVariationSegments(prev => prev.map((s, i) => i === idx ? e.target.value : s));
                                                }}
                                                disabled={isGeneratingVariations}
                                                placeholder="例: 20代女性、ビジネスマン..."
                                                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
                                            />
                                            {variationSegments.length > 2 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setVariationSegments(prev => prev.filter((_, i) => i !== idx))}
                                                    disabled={isGeneratingVariations}
                                                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-md transition-all disabled:opacity-50 shrink-0"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {variationSegments.length < 6 && (
                                        <button
                                            type="button"
                                            onClick={() => setVariationSegments(prev => [...prev, ''])}
                                            disabled={isGeneratingVariations}
                                            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-500 transition-colors disabled:opacity-50 ml-6"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            セグメントを追加
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Estimated Cost */}
                            {variationCount >= 2 && (
                                <div className="rounded-lg border border-border overflow-hidden">
                                    <div className="p-3 bg-gradient-to-r from-surface-50 to-indigo-50/30">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">推定コスト</p>
                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                {variationCount}枚 x {formatTokens(usdToTokens(INPAINT_COST_USD))}
                                            </span>
                                        </div>
                                        <p className="text-lg font-black text-foreground mt-1 tracking-tight">
                                            {formatTokens(usdToTokens(variationCount * INPAINT_COST_USD))}
                                            <span className="text-xs font-normal text-muted-foreground ml-1.5">
                                                クレジット
                                            </span>
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                            ${(variationCount * INPAINT_COST_USD).toFixed(3)} USD
                                        </p>
                                    </div>
                                    {creditBalance !== null && (
                                        <div className="px-3 py-2 bg-surface-50 border-t border-border">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] text-muted-foreground">残高</span>
                                                <span className={clsx(
                                                    'text-[10px] font-bold',
                                                    hasInsufficientCredit ? 'text-red-500' : 'text-emerald-600'
                                                )}>
                                                    {formatTokens(usdToTokens(creditBalance))}
                                                </span>
                                            </div>
                                            <div className="w-full bg-surface-200 rounded-full h-1">
                                                <div
                                                    className={clsx(
                                                        'h-full rounded-full transition-all duration-500',
                                                        hasInsufficientCredit ? 'bg-red-400' : 'bg-emerald-500'
                                                    )}
                                                    style={{ width: `${Math.min(100, ((creditBalance - requiredCreditUsd) / creditBalance) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Divider */}
                            <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-border" />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Content</span>
                                <div className="h-px flex-1 bg-border" />
                            </div>

                            {/* Product Info */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                    Product Info
                                </label>
                                <textarea
                                    value={productInfo}
                                    onChange={(e) => setProductInfo(e.target.value)}
                                    placeholder="商材・サービスの説明（任意）..."
                                    rows={3}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 resize-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>

                            {/* Modification Instructions */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                    修正指示
                                </label>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="各セグメント共通の修正指示（任意）..."
                                    rows={3}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 resize-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>

                            {/* Credit Warning */}
                            {hasInsufficientCredit && variationCount >= 2 && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-xs text-amber-700 font-bold flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        クレジット不足です
                                    </p>
                                    <p className="text-[10px] text-amber-600 mt-1">
                                        残高: {formatTokens(usdToTokens(creditBalance || 0))} / 必要: {formatTokens(usdToTokens(variationCount * INPAINT_COST_USD))}
                                    </p>
                                    <a href="/admin/settings" className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-bold underline mt-2 hover:text-amber-800 transition-colors">
                                        クレジットを購入する
                                        <ArrowLeft className="w-3 h-3 rotate-180" />
                                    </a>
                                </div>
                            )}

                            {/* Generate Variations Button */}
                            <div className="relative">
                                <button
                                    onClick={handleGenerateVariations}
                                    disabled={
                                        isGeneratingVariations ||
                                        isLoadingCredit ||
                                        (variationCount >= 2 && hasInsufficientCredit) ||
                                        !generatedImageUrl ||
                                        variationCount < 2
                                    }
                                    className={clsx(
                                        'w-full rounded-lg py-3.5 text-sm font-bold text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-sm relative overflow-hidden',
                                        isGeneratingVariations
                                            ? 'bg-indigo-600'
                                            : !generatedImageUrl || variationCount < 2 || hasInsufficientCredit
                                                ? 'bg-gray-400 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 hover:shadow-md hover:shadow-indigo-500/25 active:scale-[0.98]',
                                        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100'
                                    )}
                                >
                                    {/* Inline progress bar behind text */}
                                    {isGeneratingVariations && variationCount > 0 && (
                                        <div
                                            className="absolute inset-0 bg-indigo-500/30 transition-all duration-700 ease-out"
                                            style={{ width: `${(variationsCompletedCount / variationCount) * 100}%` }}
                                        />
                                    )}
                                    <span className="relative flex items-center gap-2">
                                        {isLoadingCredit ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                残高確認中...
                                            </>
                                        ) : !generatedImageUrl ? (
                                            <>
                                                <ImageIcon className="h-4 w-4" />
                                                元画像が必要です
                                            </>
                                        ) : variationCount < 2 ? (
                                            <>
                                                <AlertTriangle className="h-4 w-4" />
                                                2つ以上のセグメントが必要
                                            </>
                                        ) : hasInsufficientCredit ? (
                                            <>
                                                <AlertTriangle className="h-4 w-4" />
                                                クレジット不足
                                            </>
                                        ) : isGeneratingVariations ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>生成中... {variationsCompletedCount}/{variationCount}</span>
                                                <span className="text-white/60 text-xs font-mono tabular-nums">
                                                    {Math.floor(variationElapsed / 60)}:{String(variationElapsed % 60).padStart(2, '0')}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="h-4 w-4" />
                                                セグメント別生成 ({variationCount}枚)
                                            </>
                                        )}
                                    </span>
                                </button>
                            </div>

                            {/* Results summary & Adopt */}
                            {variationResults.length > 0 && (
                                <div ref={variationResultsRef} className="rounded-lg border border-border overflow-hidden" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                                    {/* Results header */}
                                    <div className="px-3.5 py-3 bg-surface-50 border-b border-border">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold text-foreground">結果</p>
                                            <div className="flex items-center gap-2">
                                                {/* Per-slot status dots */}
                                                <div className="flex items-center gap-0.5">
                                                    {variationResults.map((r, i) => (
                                                        <div
                                                            key={i}
                                                            className={clsx(
                                                                'w-2 h-2 rounded-full transition-all duration-300',
                                                                r.status === 'success' ? 'bg-emerald-400' :
                                                                r.status === 'error' ? 'bg-red-400' :
                                                                'bg-surface-300 animate-pulse'
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                                <span className={clsx(
                                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold',
                                                    variationResults.every(r => r.status === 'success')
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : isGeneratingVariations
                                                            ? 'bg-indigo-100 text-indigo-600'
                                                            : 'bg-surface-200 text-muted-foreground'
                                                )}>
                                                    {isGeneratingVariations ? (
                                                        <>
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                            生成中
                                                        </>
                                                    ) : variationResults.every(r => r.status === 'success') ? (
                                                        <>
                                                            <Check className="w-3 h-3" />
                                                            {variationResults.length}/{variationResults.length}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {variationResults.filter(r => r.status === 'success').length}/{variationResults.length} 成功
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Selection status — with thumbnail */}
                                    <div className="px-3.5 py-3">
                                        {selectedVariationIndex !== null && variationResults[selectedVariationIndex]?.status === 'success' ? (
                                            <div className="flex items-center gap-3">
                                                {/* Thumbnail preview */}
                                                <div className="w-12 h-12 rounded-lg overflow-hidden border border-indigo-200 bg-white shrink-0 shadow-sm">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={variationResults[selectedVariationIndex].imageUrl}
                                                        alt="Selected"
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                        <span className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                                                            <span className="text-[9px] font-bold text-white">{selectedVariationIndex + 1}</span>
                                                        </span>
                                                        {variationResults[selectedVariationIndex].angle}
                                                    </p>
                                                    <p className="text-[10px] text-emerald-600 font-medium mt-0.5">選択中 — 採用ボタンで確定</p>
                                                </div>
                                            </div>
                                        ) : isGeneratingVariations ? (
                                            <div className="flex items-center gap-2.5 text-muted-foreground">
                                                <div className="w-12 h-12 rounded-lg bg-surface-100 flex items-center justify-center shrink-0 animate-pulse">
                                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-foreground/70">
                                                        {variationsCompletedCount}/{variationCount} 完了
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        完了後にグリッドから選択できます
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2.5 text-muted-foreground">
                                                <div className="w-12 h-12 rounded-lg bg-surface-50 border border-dashed border-border flex items-center justify-center shrink-0">
                                                    <LayoutGrid className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium">未選択</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">左のグリッドから画像をクリック</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Adopt button */}
                                    <div className="px-3.5 pb-3.5">
                                        <button
                                            onClick={handleAdoptVariation}
                                            disabled={selectedVariationIndex === null || variationResults[selectedVariationIndex]?.status !== 'success'}
                                            className={clsx(
                                                'w-full rounded-lg py-3 text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2',
                                                selectedVariationIndex !== null && variationResults[selectedVariationIndex]?.status === 'success'
                                                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm hover:shadow-md hover:shadow-indigo-500/25 active:scale-[0.98]'
                                                    : 'bg-surface-100 text-muted-foreground/50 border border-border cursor-not-allowed'
                                            )}
                                        >
                                            <Check className="h-4 w-4" />
                                            この画像を採用
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        // ── Generate Mode Controls (existing) ──
                        <>
                            {/* Platform Selection */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                    Platform
                                </label>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {BANNER_PLATFORMS.map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => handlePlatformChange(p.id)}
                                            className={clsx(
                                                'rounded-md px-2 py-2 text-xs font-bold transition-colors',
                                                platform === p.id
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-surface-100 text-muted-foreground hover:bg-surface-200 hover:text-foreground'
                                            )}
                                        >
                                            {p.shortName}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Size Presets */}
                            {platformConfig && platformConfig.presets.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                        Size
                                    </label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {platformConfig.presets.map((preset) => (
                                            <button
                                                key={preset.name}
                                                onClick={() => handlePresetChange(preset)}
                                                className={clsx(
                                                    'rounded-md px-2 py-2 text-xs font-medium transition-colors text-left',
                                                    !isCustomSize && presetName === preset.name
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'bg-surface-100 text-muted-foreground hover:bg-surface-200 hover:text-foreground'
                                                )}
                                            >
                                                <span className="block font-bold">{preset.label}</span>
                                                <span className="block text-[10px] opacity-70">{preset.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Custom Size */}
                            {(platform === 'custom' || isCustomSize) && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                        Custom Size
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={width}
                                            onChange={(e) => setWidth(Math.max(1, Math.min(4096, parseInt(e.target.value) || 1)))}
                                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                            placeholder="Width"
                                            min={1}
                                            max={4096}
                                        />
                                        <span className="text-muted-foreground">×</span>
                                        <input
                                            type="number"
                                            value={height}
                                            onChange={(e) => setHeight(Math.max(1, Math.min(4096, parseInt(e.target.value) || 1)))}
                                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                            placeholder="Height"
                                            min={1}
                                            max={4096}
                                        />
                                    </div>
                                </div>
                            )}

                            {platform !== 'custom' && (
                                <button
                                    onClick={() => setIsCustomSize(!isCustomSize)}
                                    className="text-xs text-primary hover:underline"
                                >
                                    {isCustomSize ? 'プリセットに戻す' : 'カスタムサイズを指定'}
                                </button>
                            )}

                            {/* Segment */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                    Segment
                                </label>
                                <input
                                    type="text"
                                    value={segment}
                                    onChange={(e) => setSegment(e.target.value)}
                                    placeholder="ターゲット層やキャンペーン名..."
                                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50"
                                />
                            </div>

                            {/* Reference Image */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                    Reference Image
                                </label>
                                {referencePreview ? (
                                    <div className="relative rounded-md border border-border overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={referencePreview}
                                            alt="Reference"
                                            className="w-full h-32 object-contain bg-gray-50"
                                        />
                                        <button
                                            onClick={clearReferenceImage}
                                            className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-border bg-surface-50 py-6 cursor-pointer hover:border-primary/50 hover:bg-surface-100 transition-colors"
                                    >
                                        <Upload className="h-6 w-6 text-muted-foreground/50 mb-2" />
                                        <p className="text-xs text-muted-foreground">ドラッグ&ドロップまたはクリック</p>
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleReferenceImageUpload}
                                    className="hidden"
                                />
                            </div>

                            {/* Product Info */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                    Product Info
                                </label>
                                <textarea
                                    value={productInfo}
                                    onChange={(e) => setProductInfo(e.target.value)}
                                    placeholder="商材・サービスの説明（任意）..."
                                    rows={3}
                                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 resize-none"
                                />
                            </div>

                            {/* Prompt */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                    Prompt
                                </label>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="バナーの編集指示を入力..."
                                    rows={4}
                                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 resize-none"
                                />
                            </div>

                            {/* Generate Button */}
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || (!prompt && !productInfo)}
                                className="w-full rounded-sm bg-gray-900 py-3 text-sm font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        生成中...
                                    </>
                                ) : (
                                    'バナーを生成'
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
