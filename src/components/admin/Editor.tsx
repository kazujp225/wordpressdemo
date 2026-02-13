"use client";

import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableItem } from '@/components/admin/SortableItem';
import { ImageInpaintEditor } from '@/components/lp-builder/ImageInpaintEditor';
import { DualImportModal } from '@/components/admin/DualImportModal';
import { BoundaryDesignModal } from '@/components/admin/BoundaryDesignModal';
import { RestoreModal } from '@/components/admin/RestoreModal';
import { DesignUnifyModal } from '@/components/admin/DesignUnifyModal';
import { BackgroundUnifyModal } from '@/components/admin/BackgroundUnifyModal';
import { AssetLibrary } from '@/components/admin/AssetLibrary';
import CopyEditModal from '@/components/admin/CopyEditModal';
import CTAManagementModal from '@/components/admin/CTAManagementModal';
import ColorPaletteModal from '@/components/admin/ColorPaletteModal';
import MobileOptimizeModal from '@/components/admin/MobileOptimizeModal';
import VideoInsertModal from '@/components/admin/VideoInsertModal';
import TutorialModal from '@/components/admin/TutorialModal';
import LPCompareModal from '@/components/admin/LPCompareModal';
import LPComparePanel from '@/components/admin/LPComparePanel';
import SectionInsertModal from '@/components/admin/SectionInsertModal';
import SectionCropModal from '@/components/admin/SectionCropModal';
import OverlayEditorModal from '@/components/admin/OverlayEditorModal';
import ThumbnailTransformModal from '@/components/admin/ThumbnailTransformModal';
import DocumentTransformModal from '@/components/admin/DocumentTransformModal';
import ClaudeCodeGeneratorModal from '@/components/admin/ClaudeCodeGeneratorModal';
import HtmlCodeEditModal from '@/components/admin/HtmlCodeEditModal';
import PageDeployModal from '@/components/admin/PageDeployModal';
import { ImageResizeModal } from '@/components/admin/ImageResizeModal';
import { SEOLLMOOptimizer } from '@/components/lp-builder/SEOLLMOOptimizer';
import { GripVertical, Trash2, X, Upload, RefreshCw, Sun, Contrast, Droplet, Palette, Save, Eye, Plus, Download, Github, Loader2, MessageCircle, Send, Copy, Check, Pencil, Undo2, RotateCw, DollarSign, Monitor, Smartphone, Link2, Scissors, Expand, Type, MousePointer, Layers, Video, Lock, Crown, Image as ImageIcon, ChevronDown, ChevronRight, Square, PenTool, HelpCircle, FileText, Code2, Sparkles, Globe, Rocket, ArrowRight, Search, TrendingUp, Maximize2, Settings2 } from 'lucide-react';
import {
    EditorMenuSection,
    EditorMenuItem,
    EditorSectionList,
    EditorActionButton,
    EditorInfoBox,
    EditorBadge,
    EditorMenuSearch,
    EditorMenuProvider,
    EditorIconBox
} from '@/components/ui/editor-menu';
import type { ClickableArea } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { GEMINI_PRICING } from '@/lib/ai-costs';
import { usdToTokens, formatTokens } from '@/lib/plans';

// ドラッグ＆ドロップ可能なセクションラッパー
function SortableSectionWrapper({ id, children }: { id: string; children: React.ReactNode }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style as React.CSSProperties} className="relative group/section">
            {/* ドラッグハンドル */}
            <div
                {...attributes}
                {...listeners}
                className="absolute -left-10 top-4 z-50 cursor-grab active:cursor-grabbing bg-white border border-gray-200 rounded-lg p-2 opacity-0 group-hover/section:opacity-100 transition-opacity shadow-lg hover:shadow-xl hover:bg-gray-50 hidden sm:block"
                title="ドラッグして並び替え"
            >
                <GripVertical className="h-5 w-5 text-gray-400" />
            </div>
            {children}
        </div>
    );
}

interface EditorProps {
    pageId: string;
    initialSections: any[];
    initialHeaderConfig: any;
    initialSlug: string;
    initialStatus?: string;
    initialDesignDefinition?: any | null;
}

export default function Editor({ pageId, initialSections, initialHeaderConfig, initialSlug, initialStatus = 'draft', initialDesignDefinition = null }: EditorProps) {
    const router = useRouter();
    const [sections, setSections] = useState(initialSections);
    const [headerConfig, setHeaderConfig] = useState(() => {
        const base = {
            logoText: '',
            sticky: true,
            ctaText: '',
            ctaLink: '#contact',
            navItems: [] as { id: string; label: string; href: string }[]
        };
        if (!initialHeaderConfig) return base;
        return { ...base, ...initialHeaderConfig, navItems: initialHeaderConfig.navItems || base.navItems };
    });
    const [isSaving, setIsSaving] = useState(false);
    const [aiProductInfo, setAiProductInfo] = useState('');
    const [aiTaste, setAiTaste] = useState('professional');
    const [aiAspectRatio, setAiAspectRatio] = useState('9:16'); // デフォルトは縦長
    const [shouldGenImages, setShouldGenImages] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // セクション固有の編集状態
    const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
    const [isGeneratingSectionImage, setIsGeneratingSectionImage] = useState(false);
    const [showSectionAIModal, setShowSectionAIModal] = useState(false);
    const [sectionAIPrompt, setSectionAIPrompt] = useState('');
    const [savingSectionId, setSavingSectionId] = useState<string | null>(null);

    // チャットコパイロット状態
    const [reviewingSectionId, setReviewingSectionId] = useState<string | null>(null);
    const [reviewResults, setReviewResults] = useState<Record<string, any>>({});

    // 画像編集用の状態
    const [showEditImageModal, setShowEditImageModal] = useState(false);
    const [editImageSectionId, setEditImageSectionId] = useState<string | null>(null);
    const [editImagePrompt, setEditImagePrompt] = useState('');
    const [isEditingImage, setIsEditingImage] = useState(false);
    const [editingSectionIds, setEditingSectionIds] = useState<Set<string>>(new Set());

    // インペインティング（部分編集）用の状態
    const [showInpaintModal, setShowInpaintModal] = useState(false);
    const [inpaintSectionId, setInpaintSectionId] = useState<string | null>(null);
    const [inpaintImageUrl, setInpaintImageUrl] = useState<string | null>(null);
    const [inpaintMobileImageUrl, setInpaintMobileImageUrl] = useState<string | null>(null);
    const [inpaintInitialMode, setInpaintInitialMode] = useState<'inpaint' | 'button' | 'text-fix'>('inpaint');

    // 画像リサイズモーダル
    const [showResizeModal, setShowResizeModal] = useState(false);
    const [resizeImageUrl, setResizeImageUrl] = useState<string | null>(null);
    const [resizeSectionId, setResizeSectionId] = useState<string | null>(null);

    // モバイル用メニューサイドバー表示
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    // デュアルスクリーンショット取り込みモーダル
    const [showDualImportModal, setShowDualImportModal] = useState(false);

    // 境界修正モーダル（複数選択対応）
    const [showBoundaryFixModal, setShowBoundaryFixModal] = useState(false);
    const [boundaryFixMode, setBoundaryFixMode] = useState(false); // 境界選択モード
    const [selectedBoundaries, setSelectedBoundaries] = useState<Set<number>>(new Set()); // 選択された境界のインデックス

    // セクション削除モード
    const [sectionDeleteMode, setSectionDeleteMode] = useState(false);

    // 右サイドバータブ
    const [sidebarTab, setSidebarTab] = useState<'tools' | 'assets'>('tools');

    // ツールアコーディオン展開状態
    const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set([]));

    // メニュー検索
    const [menuSearch, setMenuSearch] = useState('');

    // プラン情報（機能制限用） — デフォルトは制限的な値（API失敗時もAIブロック）
    const [planLimits, setPlanLimits] = useState<{
        canUpscale4K: boolean;
        canRestyle: boolean;
        canGenerateVideo: boolean;
        canAIGenerate: boolean;
        maxPages: number;
    }>({
        canUpscale4K: false,
        canRestyle: false,
        canGenerateVideo: false,
        canAIGenerate: false,
        maxPages: 3,
    });

    // プラン情報を取得
    useEffect(() => {
        fetch('/api/user/usage')
            .then(res => res.json())
            .then(data => {
                if (data.limits) {
                    setPlanLimits(data.limits);
                }
            })
            .catch(err => console.error('Failed to fetch plan limits:', err));
    }, []);

    // メニュー検索フィルタリング用のヘルパー
    const menuItems = {
        crop: { title: '画像を切り取る', keywords: ['切り取り', 'カット', 'トリミング', 'crop'] },
        resize: { title: '画像をリサイズ', keywords: ['リサイズ', 'サイズ変更', 'アスペクト比', '16:9', '1:1', 'バナー', 'SNS', 'AI拡張', 'outpaint'] },
        overlay: { title: 'ボタン・文字を重ねる', keywords: ['オーバーレイ', 'テキスト', 'ボタン'] },
        delete: { title: 'ブロックを削除', keywords: ['削除', '消す', 'remove'] },
        background: { title: '背景色をそろえる', keywords: ['背景', '色', 'カラー'] },
        colorPalette: { title: '色の組み合わせ', keywords: ['配色', 'パレット', 'テーマ'] },
        copyEdit: { title: '文字を修正', keywords: ['テキスト', 'AI', 'コピー', '編集', '文字', '修正', 'OCR'] },
        cta: { title: 'ボタンのリンク先', keywords: ['URL', 'リンク', 'ボタン', 'CTA'] },
        video: { title: '動画を埋め込む', keywords: ['YouTube', '動画', 'ビデオ', 'video'] },
        thumbnail: { title: 'サムネイル用に変換', keywords: ['サムネ', '画像', '変換'] },
        document: { title: '資料にする', keywords: ['スライド', 'PDF', '資料', 'ドキュメント'] },
        claude: { title: 'gemini-codegen', keywords: ['AI', 'コード', '生成', 'Gemini'] },
        undo: { title: '操作をやり直す', keywords: ['戻す', '履歴', 'undo'] },
        regenerate: { title: 'まとめて作り直す', keywords: ['再生成', 'AI', 'リジェネ'] },
        seo: { title: 'SEO/LLMO対策', keywords: ['SEO', 'LLMO', '検索', '最適化', 'ChatGPT', 'Claude', 'メタ'] },
        deploy: { title: 'ページを公開', keywords: ['デプロイ', '公開', 'Render', 'ホスティング'] },
    };

    const isMenuItemVisible = (itemKey: string) => {
        if (!menuSearch.trim()) return true;
        const search = menuSearch.toLowerCase();
        const item = menuItems[itemKey as keyof typeof menuItems];
        if (!item) return true;
        return item.title.toLowerCase().includes(search) ||
            item.keywords.some(k => k.toLowerCase().includes(search));
    };

    const isSectionVisible = (itemKeys: string[]) => {
        if (!menuSearch.trim()) return true;
        return itemKeys.some(key => isMenuItemVisible(key));
    };

    // アコーディオントグル関数
    const toggleTool = (toolId: string) => {
        setExpandedTools(prev => {
            const next = new Set(prev);
            if (next.has(toolId)) {
                next.delete(toolId);
            } else {
                next.add(toolId);
            }
            return next;
        });
    };
    const [selectedSectionsForDelete, setSelectedSectionsForDelete] = useState<Set<string>>(new Set());

    // 境界ドラッグ調整
    const [draggingBoundaryIndex, setDraggingBoundaryIndex] = useState<number | null>(null);
    const [boundaryDragOffset, setBoundaryDragOffset] = useState(0); // ドラッグ中のピクセルオフセット
    const [boundaryDragStartY, setBoundaryDragStartY] = useState(0); // ドラッグ開始Y座標

    // 一括再生成モード（複数選択対応）
    const [batchRegenerateMode, setBatchRegenerateMode] = useState(false);
    const [selectedSectionsForRegenerate, setSelectedSectionsForRegenerate] = useState<Set<string>>(new Set());
    const [showBatchRegenerateModal, setShowBatchRegenerateModal] = useState(false);
    const [isBatchRegenerating, setIsBatchRegenerating] = useState(false);
    const [batchRegenerateProgress, setBatchRegenerateProgress] = useState<{ current: number; total: number } | null>(null);
    const [batchRegenerateStyle, setBatchRegenerateStyle] = useState('design-definition');
    const [batchRegenerateColorScheme, setBatchRegenerateColorScheme] = useState('original');
    const [batchRegenerateGenerationMode, setBatchRegenerateGenerationMode] = useState<'light' | 'heavy'>('light');
    const [batchRegeneratePrompt, setBatchRegeneratePrompt] = useState('');
    const [batchReferenceSection, setBatchReferenceSection] = useState<string | null>(null); // 参照セクション（スタイルの元）
    const [regenerateReferenceAlso, setRegenerateReferenceAlso] = useState(false); // 参照セクションも再生成するかどうか
    const [includeMobileInBatch, setIncludeMobileInBatch] = useState(true); // モバイル画像も同時に再生成するか

    // セクション復元モーダル
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [restoreSectionId, setRestoreSectionId] = useState<string | null>(null);

    // デザイン統一モーダル
    const [showDesignUnifyModal, setShowDesignUnifyModal] = useState(false);
    const [designUnifySectionId, setDesignUnifySectionId] = useState<string | null>(null);

    // 背景色統一モーダル（複数セクション対応）
    const [backgroundUnifyMode, setBackgroundUnifyMode] = useState(false);
    const [selectedSectionsForBackgroundUnify, setSelectedSectionsForBackgroundUnify] = useState<Set<string>>(new Set());
    const [showBackgroundUnifyModal, setShowBackgroundUnifyModal] = useState(false);

    // コピー編集モーダル
    const [showCopyEditModal, setShowCopyEditModal] = useState(false);
    const [isCopyRegenerating, setIsCopyRegenerating] = useState(false);

    // CTA管理モーダル
    const [showCTAModal, setShowCTAModal] = useState(false);

    // カラーパレットモーダル
    const [showColorPaletteModal, setShowColorPaletteModal] = useState(false);
    const [isColorPaletteRegenerating, setIsColorPaletteRegenerating] = useState(false);

    // モバイル最適化モーダル
    const [showMobileOptimizeModal, setShowMobileOptimizeModal] = useState(false);



    // 動画挿入モーダル
    const [showVideoModal, setShowVideoModal] = useState(false);
    const [showTutorialModal, setShowTutorialModal] = useState(false);
    const [showLPCompareModal, setShowLPCompareModal] = useState(false);
    const [showLPComparePanel, setShowLPComparePanel] = useState(false);

    // 画像変換モーダル
    const [showThumbnailModal, setShowThumbnailModal] = useState(false);
    const [showDocumentModal, setShowDocumentModal] = useState(false);

    // AIコード生成モーダル
    const [showClaudeGeneratorModal, setShowClaudeGeneratorModal] = useState(false);

    // HTMLコード編集モーダル
    const [showHtmlEditModal, setShowHtmlEditModal] = useState(false);
    const [htmlEditSectionId, setHtmlEditSectionId] = useState<string | null>(null);

    // ページデプロイモーダル
    const [showPageDeployModal, setShowPageDeployModal] = useState(false);

    // SEO/LLMO最適化モーダル
    const [showSeoLlmoModal, setShowSeoLlmoModal] = useState(false);

    // セクション挿入モーダル
    const [showInsertModal, setShowInsertModal] = useState(false);
    const [insertIndex, setInsertIndex] = useState<number>(0);
    const [insertFromLibraryIndex, setInsertFromLibraryIndex] = useState<number | null>(null);

    // セクションクロップモーダル
    const [showCropModal, setShowCropModal] = useState(false);
    const [cropSectionId, setCropSectionId] = useState<string | null>(null);
    const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);

    // オーバーレイエディターモーダル
    const [showOverlayEditor, setShowOverlayEditor] = useState(false);
    const [overlayEditSectionId, setOverlayEditSectionId] = useState<string | null>(null);
    const [overlayEditImageUrl, setOverlayEditImageUrl] = useState<string | null>(null);

    // インラインオーバーレイ編集状態
    const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
    const [selectedOverlaySectionId, setSelectedOverlaySectionId] = useState<string | null>(null);
    const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
    const [draggingOverlayId, setDraggingOverlayId] = useState<string | null>(null);
    const [overlayDragStart, setOverlayDragStart] = useState<{ x: number; y: number; overlayX: number; overlayY: number } | null>(null);

    // HD高画質化モーダル
    const [show4KModal, setShow4KModal] = useState(false);
    const [is4KProcessing, setIs4KProcessing] = useState(false);
    const [textCorrection4K, setTextCorrection4K] = useState(true); // 文字補正ON/OFF
    const [upscaleResolution, setUpscaleResolution] = useState<'1K' | '2K' | '4K'>('2K'); // 解像度選択
    const [upscaleMode, setUpscaleMode] = useState<'all' | 'individual'>('all'); // 全体/個別
    const [selectedUpscaleSections, setSelectedUpscaleSections] = useState<number[]>([]); // 選択されたセクションID
    const [useRealESRGAN, setUseRealESRGAN] = useState(true); // Real-ESRGAN使用フラグ（常に高画質化のみ）
    const [geminiUpscalePrompt, setGeminiUpscalePrompt] = useState(''); // Gemini AI用カスタムプロンプト
    const [upscale4KProgress, setUpscale4KProgress] = useState<{
        current: number;
        total: number;
        message: string;
        results: any[];
    } | null>(null);

    // 画像一括生成中のセクションID
    const [generatingImageSectionIds, setGeneratingImageSectionIds] = useState<Set<string>>(new Set());

    // 編集履歴（元に戻す用 - クライアント側の一時履歴）
    const [editHistory, setEditHistory] = useState<Record<string, { imageId: number; image: any; timestamp: number }[]>>({});
    const [showHistoryPanel, setShowHistoryPanel] = useState<string | null>(null);

    // サーバー側の永続履歴
    const [serverHistory, setServerHistory] = useState<any[]>([]);
    const [originalImages, setOriginalImages] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false); // 復元中フラグ（重複防止）

    // デスクトップレイアウトプレビューモード
    const [showDesktopPreview, setShowDesktopPreview] = useState(false);

    // 表示モード（デスクトップ/モバイル）
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

    // Design Analysis State
    const [designImage, setDesignImage] = useState<string | null>(null);
    const [designDefinition, setDesignDefinition] = useState<any | null>(initialDesignDefinition);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // API消費量メーター
    const [apiCost, setApiCost] = useState<{ todayCost: number; monthCost: number } | null>(null);

    // 素材ドラッグ＆ドロップ状態
    const [isDraggingAsset, setIsDraggingAsset] = useState(false);
    const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
    const [isProcessingAssetDrop, setIsProcessingAssetDrop] = useState(false);

    // 自動保存機能
    const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(false);
    const [lastAutoSaveTime, setLastAutoSaveTime] = useState<Date | null>(null);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // 続きを取得（スクリーンショット追加取得）
    const [isFetchingMoreSections, setIsFetchingMoreSections] = useState(false);
    const [fetchMoreProgress, setFetchMoreProgress] = useState<string | null>(null);

    // デスクトップ追加後のモバイル確認ダイアログ
    const [showMobileConfirmDialog, setShowMobileConfirmDialog] = useState(false);
    const [pendingDesktopSections, setPendingDesktopSections] = useState<any[] | null>(null);

    // ソースURLを取得（最初のセクションの画像から）
    const sourceUrl = sections.length > 0 && sections[0]?.image?.sourceUrl
        ? sections[0].image.sourceUrl
        : null;

    // 続きを取得するハンドラー
    const handleFetchMoreSections = async (device: 'desktop' | 'mobile', skipMobileConfirm?: boolean) => {
        if (!sourceUrl) {
            toast.error('ソースURLが見つかりません');
            return;
        }

        setIsFetchingMoreSections(true);
        setFetchMoreProgress('取得を開始しています...');

        try {
            // 既存セクション数の続きから取得
            const startFrom = sections.length;
            console.log(`[FetchMore] Starting from section ${startFrom} for ${device} (existing sections: ${sections.length})`);

            const res = await fetch('/api/import-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: sourceUrl,
                    device,
                    importMode: 'faithful',
                    startFrom,
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || '取得に失敗しました');
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('ストリームの読み取りに失敗しました');

            const decoder = new TextDecoder();
            let finalData: any = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const lines = text.split('\n\n').filter(line => line.startsWith('data: '));

                for (const line of lines) {
                    try {
                        const jsonStr = line.replace('data: ', '');
                        const data = JSON.parse(jsonStr);

                        if (data.type === 'progress') {
                            setFetchMoreProgress(data.message || '処理中...');
                        } else if (data.type === 'complete') {
                            finalData = data;
                        } else if (data.type === 'error') {
                            throw new Error(data.error);
                        }
                    } catch (parseError) {
                        // JSON parse error - skip
                    }
                }
            }

            if (!finalData || !finalData.media || finalData.media.length === 0) {
                toast.error('画像が見つかりませんでした');
                return;
            }

            // デスクトップ取得の場合、モバイルへの追加を確認
            if (device === 'desktop' && !skipMobileConfirm) {
                // デスクトップのみでセクションを追加
                setSections(prev => {
                    const newSections = finalData.media.map((m: any, idx: number) => ({
                        id: `new-${Date.now()}-${idx}`,
                        role: `section-${prev.length + idx + 1}`,
                        order: prev.length + idx,
                        imageId: m.id,
                        image: m,
                        mobileImageId: null,
                        mobileImage: null,
                        config: {},
                    }));
                    return [...prev, ...newSections];
                });

                toast.success(`${finalData.media.length}セクション（デスクトップ）を追加しました`);

                // モバイル追加の確認ダイアログを表示
                setPendingDesktopSections(finalData.media);
                setShowMobileConfirmDialog(true);
            } else {
                // モバイル取得、または確認後の追加
                setSections(prev => {
                    const newSections = finalData.media.map((m: any, idx: number) => ({
                        id: `new-${Date.now()}-${idx}`,
                        role: `section-${prev.length + idx + 1}`,
                        order: prev.length + idx,
                        imageId: device === 'desktop' ? m.id : null,
                        image: device === 'desktop' ? m : null,
                        mobileImageId: device === 'mobile' ? m.id : null,
                        mobileImage: device === 'mobile' ? m : null,
                        config: {},
                    }));
                    return [...prev, ...newSections];
                });

                const deviceName = device === 'mobile' ? 'モバイル' : 'デスクトップ';
                toast.success(`${finalData.media.length}セクション（${deviceName}）を追加しました${finalData.hasMore ? '（まだ続きがあります）' : ''}`);
            }

        } catch (error: any) {
            console.error('[FetchMore] Error:', error);
            toast.error(error.message || '取得に失敗しました');
        } finally {
            setIsFetchingMoreSections(false);
            setFetchMoreProgress(null);
        }
    };

    // モバイル画像も追加する処理
    const handleAddMobileToNewSections = async () => {
        if (!sourceUrl || !pendingDesktopSections) return;

        setShowMobileConfirmDialog(false);
        setIsFetchingMoreSections(true);
        setFetchMoreProgress('モバイル画像を取得中...');

        try {
            const startFrom = sections.length - pendingDesktopSections.length;

            const res = await fetch('/api/import-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: sourceUrl,
                    device: 'mobile',
                    importMode: 'faithful',
                    startFrom,
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'モバイル画像の取得に失敗しました');
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('ストリームの読み取りに失敗しました');

            const decoder = new TextDecoder();
            let finalData: any = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const lines = text.split('\n\n').filter(line => line.startsWith('data: '));

                for (const line of lines) {
                    try {
                        const jsonStr = line.replace('data: ', '');
                        const data = JSON.parse(jsonStr);

                        if (data.type === 'progress') {
                            setFetchMoreProgress(data.message || '処理中...');
                        } else if (data.type === 'complete') {
                            finalData = data;
                        } else if (data.type === 'error') {
                            throw new Error(data.error);
                        }
                    } catch (parseError) {
                        // JSON parse error - skip
                    }
                }
            }

            if (finalData?.media && finalData.media.length > 0) {
                // 既存の新規セクションにモバイル画像を追加
                setSections(prev => {
                    const updatedSections = [...prev];
                    const newSectionStartIndex = prev.length - pendingDesktopSections.length;

                    finalData.media.forEach((m: any, idx: number) => {
                        const sectionIndex = newSectionStartIndex + idx;
                        if (updatedSections[sectionIndex]) {
                            updatedSections[sectionIndex] = {
                                ...updatedSections[sectionIndex],
                                mobileImageId: m.id,
                                mobileImage: m,
                            };
                        }
                    });

                    return updatedSections;
                });

                toast.success(`${finalData.media.length}セクションにモバイル画像を追加しました`);
            }

        } catch (error: any) {
            console.error('[FetchMore Mobile] Error:', error);
            toast.error(error.message || 'モバイル画像の取得に失敗しました');
        } finally {
            setIsFetchingMoreSections(false);
            setFetchMoreProgress(null);
            setPendingDesktopSections(null);
        }
    };

    // 素材ドロップハンドラー
    const handleAssetDrop = async (e: React.DragEvent, targetSectionId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverSectionId(null);
        setIsDraggingAsset(false);

        try {
            const assetData = e.dataTransfer.getData('application/json');
            if (!assetData) return;

            const asset = JSON.parse(assetData);
            setIsProcessingAssetDrop(true);

            // 素材をダウンロードしてSupabaseに保存
            const res = await fetch('/api/assets/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: asset.downloadUrl,
                    type: asset.type,
                    title: asset.title
                })
            });

            const data = await res.json();
            if (data.error) {
                toast.error(data.error);
                return;
            }

            // ターゲットセクションの後ろに新しいセクションとして追加
            const targetIndex = sections.findIndex(s => String(s.id) === String(targetSectionId));
            const newSection = {
                id: `temp-${Date.now()}`,
                role: 'asset',
                order: targetIndex + 1,
                imageId: null,
                image: { filePath: data.url },
                config: { assetType: asset.type, assetTitle: asset.title }
            };

            setSections(prev => {
                const updated = [...prev];
                updated.splice(targetIndex + 1, 0, newSection);
                // orderを再計算
                return updated.map((s, i) => ({ ...s, order: i }));
            });

            toast.success(`素材を「${sections[targetIndex]?.role || `セクション ${targetIndex + 1}`}」の後に追加しました`);
        } catch (error) {
            toast.error('素材の追加に失敗しました');
        } finally {
            setIsProcessingAssetDrop(false);
        }
    };

    const analyzeCurrentDesign = async () => {
        if (planLimits && !planLimits.canAIGenerate) {
            return; // Freeプランでは静かにスキップ
        }
        setIsAnalyzing(true);
        try {
            // Can limit to top 3 sections to define the "vibe"
            const uniqueSections = sections.filter(s => s.image?.filePath || s.base64).slice(0, 3);

            if (uniqueSections.length === 0) {
                toast.error('分析する画像がありません');
                setIsAnalyzing(false);
                return;
            }

            // Simple client-side stitching
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Load images
            const images = await Promise.all(uniqueSections.map(async (s) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                return new Promise<HTMLImageElement>((resolve, reject) => {
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = s.base64 || s.image?.filePath || '';
                });
            }));

            // Calculate dimensions
            const width = 800; // standard width
            let totalHeight = 0;
            images.forEach(img => {
                const scale = width / (img.width || 800);
                totalHeight += (img.height || 0) * scale;
            });

            if (totalHeight === 0) {
                toast.error('画像の読み込みに失敗しました');
                return;
            }

            canvas.width = width;
            canvas.height = totalHeight;

            // Draw
            let currentY = 0;
            images.forEach(img => {
                const scale = width / (img.width || 800);
                const h = (img.height || 0) * scale;
                ctx.drawImage(img, 0, currentY, width, h);
                currentY += h;
            });

            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            setDesignImage(base64);

            const res = await fetch('/api/ai/analyze-design', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: base64 })
            });

            if (!res.ok) throw new Error('デザイン解析に失敗しました');

            const data = await res.json();
            setDesignDefinition(data);
            toast.success('現在のデザインを解析しました！');

        } catch (e: any) {
            console.error(e);
            toast.error('デザイン解析中にエラーが発生しました: ' + e.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Auto-analyze on page load if no definition exists
    useEffect(() => {
        const hasImages = sections.some(s => s.image?.filePath || s.base64);
        if (!initialDesignDefinition && hasImages && pageId !== 'new') {
            // Delay slightly to ensure component is mounted
            const timer = setTimeout(() => {
                analyzeCurrentDesign();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, []); // Run once on mount

    // ESCキーでデスクトッププレビューを閉じる
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && showDesktopPreview) {
                setShowDesktopPreview(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showDesktopPreview]);

    // 境界ドラッグ用のref（useEffect内で最新値を参照するため）
    const boundaryDragOffsetRef = React.useRef(boundaryDragOffset);
    const draggingBoundaryIndexRef = React.useRef(draggingBoundaryIndex);
    const boundaryDragStartYRef = React.useRef(boundaryDragStartY);

    // refを最新値に更新
    React.useEffect(() => {
        boundaryDragOffsetRef.current = boundaryDragOffset;
    }, [boundaryDragOffset]);
    React.useEffect(() => {
        draggingBoundaryIndexRef.current = draggingBoundaryIndex;
    }, [draggingBoundaryIndex]);
    React.useEffect(() => {
        boundaryDragStartYRef.current = boundaryDragStartY;
    }, [boundaryDragStartY]);

    // 境界ドラッグのグローバルイベント処理
    useEffect(() => {
        if (draggingBoundaryIndex === null) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaY = e.clientY - boundaryDragStartYRef.current;
            // 最大±300pxに制限
            const clampedDelta = Math.max(-300, Math.min(300, deltaY));
            setBoundaryDragOffset(clampedDelta);
        };

        const handleMouseUp = () => {
            const currentOffset = boundaryDragOffsetRef.current;
            const boundaryIndex = draggingBoundaryIndexRef.current;

            if (boundaryIndex !== null && Math.abs(currentOffset) > 5) {
                // ドラッグ量が5px以上なら境界オフセットをセクションに保存
                setSections(prev => prev.map((s, idx) => {
                    if (idx === boundaryIndex) {
                        // 上セクション: 下端の境界オフセットを保存（最大±300pxに制限）
                        const existing = s.boundaryOffsetBottom || 0;
                        const newOffset = Math.max(-300, Math.min(300, existing + currentOffset));
                        return { ...s, boundaryOffsetBottom: newOffset };
                    }
                    if (idx === boundaryIndex + 1) {
                        // 下セクション: 上端の境界オフセットを保存（最大±300pxに制限）
                        const existing = s.boundaryOffsetTop || 0;
                        const newOffset = Math.max(-300, Math.min(300, existing - currentOffset));
                        return { ...s, boundaryOffsetTop: newOffset };
                    }
                    return s;
                }));

                toast.success('境界位置を調整しました（再生成時に反映）', { id: 'boundary-adjust' });
            }

            setDraggingBoundaryIndex(null);
            setBoundaryDragOffset(0);
            setBoundaryDragStartY(0);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingBoundaryIndex]); // 依存を最小限に

    // オーバーレイドラッグ処理
    useEffect(() => {
        if (!draggingOverlayId || !overlayDragStart || !selectedOverlaySectionId) return;

        const handleMouseMove = (e: MouseEvent) => {
            const sectionEl = document.getElementById(`section-${selectedOverlaySectionId}`);
            if (!sectionEl) return;

            const rect = sectionEl.getBoundingClientRect();
            const deltaX = ((e.clientX - overlayDragStart.x) / rect.width) * 100;
            const deltaY = ((e.clientY - overlayDragStart.y) / rect.height) * 100;

            const newX = Math.max(5, Math.min(95, overlayDragStart.overlayX + deltaX));
            const newY = Math.max(5, Math.min(95, overlayDragStart.overlayY + deltaY));

            setSections(prev => prev.map(s =>
                String(s.id) === selectedOverlaySectionId
                    ? {
                        ...s,
                        config: {
                            ...s.config,
                            overlays: s.config?.overlays?.map((o: any) =>
                                o.id === draggingOverlayId ? { ...o, x: newX, y: newY } : o
                            )
                        }
                    }
                    : s
            ));
        };

        const handleMouseUp = () => {
            setDraggingOverlayId(null);
            setOverlayDragStart(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingOverlayId, overlayDragStart, selectedOverlaySectionId]);

    // API消費量を取得
    useEffect(() => {
        const fetchApiCost = async () => {
            try {
                // 今日のコスト
                const todayRes = await fetch('/api/admin/stats?days=1');
                if (!todayRes.ok) {
                    // 認証エラーなど - 静かに失敗
                    return;
                }
                const todayData = await todayRes.json();

                // 今月のコスト
                const now = new Date();
                const daysThisMonth = now.getDate();
                const monthRes = await fetch(`/api/admin/stats?days=${daysThisMonth}`);
                if (!monthRes.ok) {
                    return;
                }
                const monthData = await monthRes.json();

                setApiCost({
                    todayCost: todayData.summary?.totalCost || 0,
                    monthCost: monthData.summary?.totalCost || 0
                });
            } catch (error) {
                // サイレントエラー - APIコストの取得失敗はユーザー体験に影響しない
            }
        };

        fetchApiCost();

        // 30秒ごとに更新
        const interval = setInterval(fetchApiCost, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleDesignImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (planLimits && !planLimits.canAIGenerate) {
            toast.error('デザイン解析は有料プランでご利用いただけます');
            return;
        }

        setIsAnalyzing(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result as string;
                setDesignImage(base64);

                try {
                    const res = await fetch('/api/ai/analyze-design', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageUrl: base64 })
                    });

                    if (!res.ok) throw new Error('デザイン解析に失敗しました');

                    const data = await res.json();
                    setDesignDefinition(data);
                    toast.success('デザイン解析完了！');
                } catch (err) {
                    console.error(err);
                    toast.error('デザイン解析に失敗しました。');
                    setDesignImage(null);
                } finally {
                    setIsAnalyzing(false);
                }
            };
        } catch (err) {
            console.error(err);
            setIsAnalyzing(false);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setSections((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over?.id);
                const newItems = arrayMove(items, oldIndex, newIndex);
                // 並び替え後に自動保存
                setTimeout(() => handleSave(newItems), 100);
                return newItems;
            });
            toast.success('セクションの順番を変更しました');
        }
    };

    const handleRoleChange = (id: string, role: string) => {
        setSections((items) =>
            items.map((item) => (item.id === id ? { ...item, role } : item))
        );
    };

    const handleConfigChange = (id: string, config: any) => {
        setSections((items) =>
            items.map((item) => (item.id === id ? { ...item, config: { ...item.config, ...config } } : item))
        );
    };

    const handleRemove = (id: string) => {
        setSections((items) => items.filter((item) => item.id !== id));
    };

    const handleGenerateAI = async () => {
        if (planLimits && !planLimits.canAIGenerate) {
            toast.error('AI機能は有料プランのみご利用いただけます');
            return;
        }
        setIsGenerating(true);
        console.log('セクションのAI生成を開始:', sections.map(s => ({ id: s.id, hasBase64: !!s.base64 })));
        try {
            const payload = {
                productInfo: aiProductInfo,
                taste: aiTaste,
                sections: sections.map(s => ({
                    id: s.id,
                    role: s.role, // 役割を渡すことでリブランディングの精度を向上
                    base64: s.base64,
                    image: s.image
                })),
                designDefinition // Pass Design Definition
            };
            const res = await fetch('/api/ai/generate-copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (!Array.isArray(data)) {
                throw new Error(data.error || 'AIが期待した形式で回答できませんでした。');
            }

            let matchCount = 0;
            const updatedSections = sections.map((section) => {
                // IDの型（数値/文字列）の違いによるマッチング失敗を防止
                const aiData = data.find((d: any) => String(d.id) === String(section.id));
                if (aiData) {
                    matchCount++;
                    return {
                        ...section,
                        config: {
                            ...section.config,
                            text: aiData.text,
                            dsl: aiData.dsl, // AI生成された設計データを保存
                            position: 'middle',
                            textColor: 'white'
                        }
                    };
                }
                return section;
            });

            if (matchCount === 0) {
                toast.error(`AIは${data.length}件のセクションを生成しましたが、マッピングに失敗しました`);
            } else {
                setSections(updatedSections);
                toast.success(`${matchCount}件のセクションをリブランディングしました`);
            }

            // 2. オプション: ナビゲーション（ヘッダー）の自動提案
            try {
                const navRes = await fetch('/api/ai/generate-nav', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sections: updatedSections })
                });
                const navData = await navRes.json();
                if (navData && !navData.error) {
                    setHeaderConfig((prev: any) => ({
                        ...prev,
                        logoText: navData.logoText || prev.logoText,
                        navItems: navData.navItems || prev.navItems,
                        ctaText: navData.ctaText || prev.ctaText
                    }));
                }
            } catch (e) {
                console.error('ナビゲーション生成に失敗しました:', e);
            }

            // 3. オプション: 画像の一括生成（並列化）
            if (shouldGenImages) {
                const sectionsToGenerate = updatedSections.filter(s => s.config?.text);

                if (sectionsToGenerate.length > 0) {
                    // 全セクションを生成中としてマーク
                    const allSectionIds = new Set(sectionsToGenerate.map(s => s.id));
                    setGeneratingImageSectionIds(allSectionIds);

                    // 並列で画像生成（各完了時に即座に状態を更新）
                    const generatePromises = sectionsToGenerate.map(async (section) => {
                        try {
                            const imgRes = await fetch('/api/ai/generate-image', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    prompt: section.config.text,
                                    taste: aiTaste,
                                    brandInfo: aiProductInfo,
                                    aspectRatio: aiAspectRatio,
                                    designDefinition
                                })
                            });
                            const media = await imgRes.json();
                            if (media.id) {
                                // 即座にセクション状態を更新
                                setSections((prev: any[]) => prev.map(s =>
                                    s.id === section.id ? { ...s, imageId: media.id, image: media } : s
                                ));
                            }
                            return { sectionId: section.id, success: true, media };
                        } catch (e) {
                            console.error(`セクション ${section.id} の画像生成に失敗しました:`, e);
                            return { sectionId: section.id, success: false, error: e };
                        } finally {
                            // 完了時に生成中リストから削除（UIがリアルタイムで更新される）
                            setGeneratingImageSectionIds(prev => {
                                const next = new Set(prev);
                                next.delete(section.id);
                                return next;
                            });
                        }
                    });

                    // 全ての生成を待機（各完了時に状態は既に更新済み）
                    const results = await Promise.all(generatePromises);
                    const succeeded = results.filter(r => r.success).length;
                    const failed = results.filter(r => !r.success).length;

                    if (failed > 0) {
                        console.warn(`画像生成: ${succeeded}件成功, ${failed}件失敗`);
                    }
                }
            }
            // 4. 自動保存
            await handleSave();
            toast.success('リブランディング完了！ページを保存しました');

        } catch (error: any) {
            toast.error(error.message || 'AI生成に失敗しました');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const files = Array.from(e.target.files);

        const newItems: any[] = [];

        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                // 1. Upload to Supabase immediately
                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                const media = await res.json();

                newItems.push({
                    id: `temp-${Date.now()}-${Math.random()}`,
                    role: 'solution',
                    imageId: media.id,
                    image: media,
                    order: sections.length + newItems.length
                });
            } catch (error) {
                console.error('アップロードに失敗しました:', error);
            }
        }

        const updatedSections = [...sections, ...newItems];
        setSections(updatedSections);
        e.target.value = '';

        // 2. Immediate auto-save to persist the "Draft"
        handleSave(updatedSections);
    };

    // デュアルスクリーンショット取り込み結果を処理
    const handleDualImport = (result: { desktop: any[]; mobile: any[] }) => {
        // デスクトップとモバイルをペアにしてセクションを作成
        const maxLength = Math.max(result.desktop.length, result.mobile.length);
        const newItems: any[] = [];

        for (let i = 0; i < maxLength; i++) {
            const desktopImg = result.desktop[i];
            const mobileImg = result.mobile[i];

            newItems.push({
                id: `dual-${Date.now()}-${i}`,
                role: i === 0 ? 'hero' : 'solution',
                imageId: desktopImg?.id || null,
                image: desktopImg || null,
                mobileImageId: mobileImg?.id || null,
                mobileImage: mobileImg || null,
                order: sections.length + i,
                config: {}
            });
        }

        const updatedSections = [...sections, ...newItems];
        setSections(updatedSections);
        setShowDualImportModal(false);

        // 自動保存
        handleSave(updatedSections);
        toast.success(`${newItems.length}個のセクションを追加しました（デスクトップ+モバイル）`);
    };

    const handleSectionImageChange = async (sectionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const media = await res.json();

            setSections(prev => prev.map(s => s.id === sectionId ? { ...s, imageId: media.id, image: media } : s));
            e.target.value = '';
        } catch (error) {
            console.error('セクション画像の更新に失敗しました:', error);
        }
    };

    const handleSectionAIImage = async (sectionId: string) => {
        if (planLimits && !planLimits.canAIGenerate) {
            return;
        }
        const section = sections.find(s => s.id === sectionId);
        if (!section) return;

        setEditingSectionId(sectionId);

        // Priority: Use User-entered text if available, else use role mapping
        let defaultPrompt = section.config?.text || '';

        if (!defaultPrompt) {
            const roleNames: any = {
                hero: 'メインビジュアル',
                problem: '悩んでいる人のイラストやイメージ',
                solution: '解決策や商品の魅力的な写真',
                pricing: '料金表やお得なイメージ',
                faq: 'よくある質問の背景',
                testimony: '満足そうな笑顔の人物写真',
                footer: 'フッター背景'
            };
            defaultPrompt = roleNames[section.role] || '';
        }

        setSectionAIPrompt(defaultPrompt);
        setShowSectionAIModal(true);
    };

    const generateSectionImage = async () => {
        if (!editingSectionId || !sectionAIPrompt) return;
        if (planLimits && !planLimits.canAIGenerate) {
            toast.error('AI機能は有料プランのみご利用いただけます');
            return;
        }
        setIsGeneratingSectionImage(true);
        try {
            const res = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: sectionAIPrompt,
                    aspectRatio: aiAspectRatio,
                    taste: aiTaste,
                    brandInfo: aiProductInfo
                })
            });
            const media = await res.json();
            setSections(prev => prev.map(s => s.id === editingSectionId ? { ...s, imageId: media.id, image: media } : s));
            setShowSectionAIModal(false);
        } catch (error) {
            toast.error('画像生成に失敗しました。');
        } finally {
            setIsGeneratingSectionImage(false);
        }
    };

    // セクション挿入ハンドラー
    const handleOpenInsertModal = (index: number) => {
        setInsertIndex(index);
        setShowInsertModal(true);
    };

    const handleInsertSection = async (file: File, index: number) => {
        // 画像をアップロード
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (!uploadRes.ok) {
            throw new Error('画像のアップロードに失敗しました');
        }

        const newMedia = await uploadRes.json();

        // 新しいセクションを作成
        const newSection = {
            id: `temp-${Date.now()}`,
            role: 'content',
            imageId: newMedia.id,
            image: newMedia,
            mobileImageId: null,
            mobileImage: null,
            order: index,
            config: {}
        };

        // セクションを挿入（指定位置に挿入し、以降のorderを更新）
        setSections(prev => {
            const newSections = [...prev];
            // 挿入位置以降のセクションのorderを1つずつ増やす
            for (let i = 0; i < newSections.length; i++) {
                if (newSections[i].order >= index) {
                    newSections[i] = { ...newSections[i], order: newSections[i].order + 1 };
                }
            }
            // 新しいセクションを追加
            newSections.push(newSection);
            // orderでソート
            return newSections.sort((a, b) => a.order - b.order);
        });

        toast.success('セクションを挿入しました');
    };

    // アセットライブラリからセクション挿入
    const handleInsertFromLibrary = (index: number) => {
        setInsertFromLibraryIndex(index);
        setSidebarTab('assets'); // アセットタブに切り替え
    };

    // 画像編集モーダルを開く
    const handleOpenEditImage = (sectionId: string) => {
        if (planLimits && !planLimits.canAIGenerate) {
            return;
        }
        const section = sections.find(s => s.id === sectionId);
        if (!section) return;

        setEditImageSectionId(sectionId);
        // デフォルトのプロンプトを設定
        const defaultPrompt = aiProductInfo || section.config?.text || '';
        setEditImagePrompt(defaultPrompt);
        setShowEditImageModal(true);
    };

    // 画像をAIで編集
    const handleEditImage = async () => {
        if (!editImageSectionId) return;
        const section = sections.find(s => s.id === editImageSectionId);
        if (!section?.image?.filePath) {
            toast.error('編集する画像がありません。');
            return;
        }

        setIsEditingImage(true);
        setEditingSectionIds(prev => new Set(prev).add(editImageSectionId));

        try {
            const res = await fetch('/api/ai/edit-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl: section.image.filePath,
                    prompt: editImagePrompt,
                    productInfo: aiProductInfo
                })
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.message || data.error || '画像編集に失敗しました');
            }

            // 編集された画像でセクションを更新
            setSections(prev => prev.map(s =>
                s.id === editImageSectionId
                    ? { ...s, imageId: data.media.id, image: data.media }
                    : s
            ));

            setShowEditImageModal(false);
            toast.success('画像を編集しました');

        } catch (error: any) {
            console.error('画像編集エラー:', error);
            toast.error(error.message || '画像編集に失敗しました');
        } finally {
            setIsEditingImage(false);
            setEditingSectionIds(prev => {
                const next = new Set(prev);
                next.delete(editImageSectionId);
                return next;
            });
        }
    };

    // インペインティング（部分編集）モーダルを開く
    const handleOpenInpaint = (sectionId: string, imageUrl: string, mobileImageUrl?: string, mode: 'inpaint' | 'button' | 'text-fix' = 'inpaint') => {
        if (planLimits && !planLimits.canAIGenerate) {
            return;
        }
        console.log('[handleOpenInpaint] Opening with:', { sectionId, imageUrl, mobileImageUrl, mode });
        setInpaintSectionId(sectionId);
        setInpaintImageUrl(imageUrl);
        setInpaintMobileImageUrl(mobileImageUrl || null);
        setInpaintInitialMode(mode);
        setShowInpaintModal(true);
    };

    // インペインティング結果を保存
    const handleInpaintSave = async (newImageUrl: string, newMobileImageUrl?: string) => {
        if (!inpaintSectionId) return;

        const targetSectionId = inpaintSectionId;
        const currentSection = sections.find(s => s.id === targetSectionId);

        // 編集前の状態を履歴に保存
        if (currentSection?.image) {
            setEditHistory(prev => ({
                ...prev,
                [targetSectionId]: [
                    ...(prev[targetSectionId] || []),
                    { imageId: currentSection.imageId, image: currentSection.image, timestamp: Date.now() }
                ]
            }));
        }

        // 新しい画像でセクションを更新
        const res = await fetch('/api/media');
        const mediaList = await res.json();
        const newMedia = mediaList.find((m: any) => m.filePath === newImageUrl);
        const newMobileMedia = newMobileImageUrl
            ? mediaList.find((m: any) => m.filePath === newMobileImageUrl)
            : null;

        if (newMedia) {
            // 履歴はインペイントAPI側で自動保存されるため、ここでは保存しない

            setSections(prev => prev.map(s =>
                s.id === targetSectionId
                    ? {
                        ...s,
                        imageId: newMedia.id,
                        image: newMedia,
                        ...(newMobileMedia ? { mobileImageId: newMobileMedia.id, mobileImage: newMobileMedia } : {})
                    }
                    : s
            ));
        }

        setShowInpaintModal(false);
        setInpaintSectionId(null);
        setInpaintImageUrl(null);
        setInpaintMobileImageUrl(null);

        // 編集したセクションまでスクロール
        setTimeout(() => {
            const element = document.getElementById(`section-${targetSectionId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    };

    // クリッカブルエリア（ボタン配置）を保存
    const handleSaveClickableAreas = async (areas: ClickableArea[], mobileAreas?: ClickableArea[]) => {
        if (!inpaintSectionId) return;

        // 更新されたセクションを作成
        const updatedSections = sections.map(s =>
            s.id === inpaintSectionId
                ? {
                    ...s,
                    config: {
                        ...s.config,
                        clickableAreas: areas,
                        ...(mobileAreas ? { mobileClickableAreas: mobileAreas } : {})
                    }
                }
                : s
        );

        setSections(updatedSections);

        setShowInpaintModal(false);
        setInpaintSectionId(null);
        setInpaintImageUrl(null);
        setInpaintMobileImageUrl(null);

        // データベースに保存
        await handleSave(updatedSections);
        const totalButtons = areas.length + (mobileAreas?.length || 0);
        toast.success(`${totalButtons}個のボタンを保存しました`);
    };

    // 特定のバージョンに戻す
    const handleRestoreVersion = (sectionId: string, historyIndex: number) => {
        const history = editHistory[sectionId];
        if (!history || historyIndex < 0 || historyIndex >= history.length) return;

        const targetState = history[historyIndex];

        // セクションを選択した状態に戻す
        setSections(prev => prev.map(s =>
            s.id === sectionId
                ? { ...s, imageId: targetState.imageId, image: targetState.image }
                : s
        ));

        // 選択したバージョン以降の履歴を削除
        setEditHistory(prev => ({
            ...prev,
            [sectionId]: history.slice(0, historyIndex)
        }));

        setShowHistoryPanel(null);
    };

    // サーバー側の履歴を取得して履歴パネルを開く
    const handleOpenHistoryPanel = async (sectionId: string) => {
        console.log('[History] Opening panel for section:', sectionId);
        setShowHistoryPanel(sectionId);
        setIsLoadingHistory(true);
        setServerHistory([]);
        setOriginalImages([]);

        // temp-で始まる一時的なセクションは履歴取得をスキップ
        if (typeof sectionId === 'string' && sectionId.startsWith('temp-')) {
            console.log('[History] Skipping API call for temporary section');
            setIsLoadingHistory(false);
            return;
        }

        try {
            const response = await fetch(`/api/sections/${sectionId}/history`);
            const data = await response.json();

            console.log('[History] API response:', { ok: response.ok, data });

            if (response.ok) {
                setServerHistory(data.history || []);
                setOriginalImages(data.originalImages || []);
                console.log('[History] Loaded:', {
                    historyCount: data.history?.length || 0,
                    originalImagesCount: data.originalImages?.length || 0
                });
            } else {
                console.error('[History] API error:', data.error);
                if (data.error === 'Section not found') {
                    toast.error('このセクションはまだ保存されていません。保存後に履歴を確認できます。');
                } else {
                    toast.error(data.error || '履歴の取得に失敗しました');
                }
            }
        } catch (error) {
            console.error('[History] Failed to fetch:', error);
            toast.error('履歴の取得に失敗しました');
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // サーバー履歴から復元
    const handleRestoreFromServer = async (sectionId: string | number, imageId: number, imageUrl: string) => {
        // 復元中の場合は無視（重複防止）
        if (isRestoring) {
            console.log('[Restore] Already restoring, ignoring duplicate call');
            return;
        }

        // temp-で始まる一時的なセクションは復元できない
        if (typeof sectionId === 'string' && sectionId.startsWith('temp-')) {
            console.log('[Restore] Cannot restore temporary section');
            toast.error('保存されていないセクションは復元できません');
            return;
        }

        setIsRestoring(true);
        try {
            // セクションIDを数値に変換（API用）
            const numericSectionId = typeof sectionId === 'string' ? parseInt(sectionId, 10) : sectionId;

            console.log('[Restore] Starting restore:', { sectionId, numericSectionId, imageId, imageUrl });

            const response = await fetch(`/api/sections/${numericSectionId}/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageId }),
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('[Restore] API error:', result);
                throw new Error(result.error || '復元に失敗しました');
            }

            console.log('[Restore] API success:', result);

            // セクションを更新（型を揃えて比較）
            const updatedSections = sections.map(s =>
                String(s.id) === String(sectionId)
                    ? {
                        ...s,
                        imageId: imageId,
                        image: {
                            id: imageId,
                            filePath: imageUrl,
                            width: s.image?.width || 0,
                            height: s.image?.height || 0,
                        }
                    }
                    : s
            );

            setSections(updatedSections);
            toast.success('復元しました');
            setShowHistoryPanel(null);

            // 少し待ってから保存（state更新を待つ）
            setTimeout(() => {
                handleSave(updatedSections);
            }, 100);

        } catch (error: any) {
            console.error('[Restore] Error:', error);
            toast.error(error.message || '復元に失敗しました');
        } finally {
            setIsRestoring(false);
        }
    };

    const handleSaveSection = async (sectionId: string) => {
        setSavingSectionId(sectionId);
        try {
            // 現時点では一貫性を保つためメインの保存ロジックを再利用。
            // 必要に応じて、後で必要なデータのみを送信するように最適化可能。
            await handleSave();
        } finally {
            setSavingSectionId(null);
        }
    };

    const handleReviewSection = async (id: string) => {
        const section = sections.find(s => s.id === id);
        if (!section) return;

        setReviewingSectionId(id);
        try {
            const res = await fetch('/api/ai/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: section.config?.text || '',
                    role: section.role,
                    dsl: section.config?.dsl || {}
                })
            });
            const result = await res.json();
            setReviewResults(prev => ({ ...prev, [id]: result }));
        } catch (error) {
            console.error('AIレビューに失敗しました:', error);
        } finally {
            setReviewingSectionId(null);
        }
    };

    const [status, setStatus] = useState(initialStatus);
    const [isSyncing, setIsSyncing] = useState<'github' | null>(null);

    const handleSync = async (type: 'github') => {
        if (pageId === 'new') {
            toast.error('同期する前にページを保存してください。');
            return;
        }
        setIsSyncing(type);
        try {
            const res = await fetch(`/api/pages/${pageId}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast.success(data.message || '同期が完了しました');
        } catch (error: any) {
            toast.error(error.message || '同期に失敗しました。設定画面で連携情報を確認してください');
        } finally {
            setIsSyncing(null);
        }
    };

    const handleExport = async () => {
        if (pageId === 'new') {
            toast.error('エクスポートする前にページを保存してください。');
            return;
        }
        try {
            const res = await fetch(`/api/pages/${pageId}/export`);
            if (!res.ok) throw new Error('エクスポートに失敗しました。');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${initialSlug || 'lp'}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e) {
            toast.error('エクスポート中にエラーが発生しました。');
        }
    };

    const [isExportingPdf, setIsExportingPdf] = useState(false);

    const handleExportPdf = async () => {
        if (pageId === 'new') {
            toast.error('PDFエクスポートする前にページを保存してください。');
            return;
        }
        setIsExportingPdf(true);
        try {
            const res = await fetch(`/api/pages/${pageId}/export-pdf`);
            if (!res.ok) throw new Error('PDFエクスポートに失敗しました。');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${initialSlug || 'lp'}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success('PDFをダウンロードしました');
        } catch (e) {
            toast.error('PDFエクスポート中にエラーが発生しました。');
        } finally {
            setIsExportingPdf(false);
        }
    };

    const handleSave = async (sectionsToSave = sections) => {
        setIsSaving(true);
        try {
            const method = pageId === 'new' ? 'POST' : 'PUT';
            const url = pageId === 'new' ? '/api/pages' : `/api/pages/${pageId}`;

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sections: sectionsToSave.map((s, i) => ({
                        ...s,
                        order: i,
                        config: s.config || {}
                    })),
                    headerConfig: headerConfig,
                    status: status,
                    designDefinition: designDefinition
                })
            });

            const data = await res.json();
            if (pageId === 'new' && data.id) {
                // リフレッシュ時のデータ紛失を防ぐため、新しく作成されたページIDにリダイレクト
                toast.success('ページを作成しました');
                router.push(`/admin/pages/${data.id}`);
            } else if (res.ok) {
                toast.success('保存しました');
                // 保存後のセクションIDを反映（再生成時に正しいIDを使えるように）
                if (data.sections && Array.isArray(data.sections)) {
                    // 古いIDから新しいIDへのマッピングを作成（orderベース）
                    const oldSections = sectionsToSave;
                    const newSections = data.sections;
                    const idMapping = new Map<string | number, number>();
                    oldSections.forEach((oldSec, idx) => {
                        if (newSections[idx]) {
                            idMapping.set(oldSec.id, newSections[idx].id);
                        }
                    });

                    // 選択状態のセクションIDを更新
                    if (selectedSectionsForRegenerate.size > 0) {
                        const newSelectedIds = new Set<string>();
                        selectedSectionsForRegenerate.forEach(oldId => {
                            const newId = idMapping.get(oldId);
                            if (newId) newSelectedIds.add(String(newId));
                        });
                        setSelectedSectionsForRegenerate(newSelectedIds);
                    }

                    // 参照セクションIDも更新
                    if (batchReferenceSection) {
                        const newRefId = idMapping.get(batchReferenceSection);
                        if (newRefId) setBatchReferenceSection(String(newRefId));
                    }

                    setSections(newSections);
                } else {
                    router.refresh(); // fallback
                }
            } else {
                toast.error('保存に失敗しました');
            }

        } catch (e) {
            console.error(e);
            toast.error('保存に失敗しました。');
        }
        setIsSaving(false);
    };

    // セグメント個別再生成の状態
    const [showRegenerateModal, setShowRegenerateModal] = useState(false);
    const [regenerateSectionId, setRegenerateSectionId] = useState<string | null>(null);
    const [regenerateStyle, setRegenerateStyle] = useState('professional');
    const [regenerateColorScheme, setRegenerateColorScheme] = useState('original');
    const [regenerateMode, setRegenerateMode] = useState<'light' | 'heavy'>('light');
    const [regeneratePrompt, setRegeneratePrompt] = useState('');
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regeneratingSectionIds, setRegeneratingSectionIds] = useState<Set<string>>(new Set());

    // 自動保存のuseEffect（デバウンス付き）
    useEffect(() => {
        if (!isAutoSaveEnabled || pageId === 'new') return;

        // 保存中や他の処理中は自動保存をスキップ
        if (isSaving || isGenerating || isRegenerating || isBatchRegenerating) return;

        const autoSaveTimer = setTimeout(async () => {
            setAutoSaveStatus('saving');
            try {
                const method = 'PUT';
                const url = `/api/pages/${pageId}`;

                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sections: sections.map((s, i) => ({
                            ...s,
                            order: i,
                            config: s.config || {}
                        })),
                        headerConfig: headerConfig,
                        status: status,
                        designDefinition: designDefinition
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    // 保存後のセクションIDを反映
                    if (data.sections && Array.isArray(data.sections)) {
                        setSections(data.sections);
                    }
                    setAutoSaveStatus('saved');
                    setLastAutoSaveTime(new Date());
                    // 3秒後にステータスをアイドルに戻す
                    setTimeout(() => setAutoSaveStatus('idle'), 3000);
                } else {
                    setAutoSaveStatus('error');
                }
            } catch (e) {
                console.error('Auto-save failed:', e);
                setAutoSaveStatus('error');
            }
        }, 2000); // 2秒のデバウンス

        return () => clearTimeout(autoSaveTimer);
    }, [sections, headerConfig, status, designDefinition, isAutoSaveEnabled, pageId, isSaving, isGenerating, isRegenerating, isBatchRegenerating]);

    // セグメント個別再生成モーダルを開く
    const handleOpenRegenerate = (sectionId: string) => {
        if (planLimits && !planLimits.canAIGenerate) {
            return;
        }
        setRegenerateSectionId(sectionId);
        setRegeneratePrompt('');
        setShowRegenerateModal(true);
    };

    // セグメント個別再生成の実行
    const handleRegenerate = async () => {
        if (!regenerateSectionId) return;
        if (planLimits && !planLimits.canAIGenerate) {
            toast.error('AI機能は有料プランのみご利用いただけます');
            return;
        }

        // sectionIdから実際のDBのIDを取得
        const section = sections.find(s => s.id === regenerateSectionId);
        if (!section) {
            toast.error('セクションが見つかりません');
            return;
        }

        // 実際のDB ID（数値）を使用
        const dbSectionId = typeof section.id === 'string' && section.id.startsWith('temp-')
            ? null
            : parseInt(section.id);

        if (!dbSectionId) {
            toast.error('保存されていないセクションは再生成できません。先にページを保存してください。');
            return;
        }

        setIsRegenerating(true);
        setRegeneratingSectionIds(prev => new Set(prev).add(regenerateSectionId));
        setShowRegenerateModal(false);

        try {
            const response = await fetch(`/api/sections/${dbSectionId}/regenerate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    style: regenerateStyle === 'design-definition' ? 'design-definition' : regenerateStyle,
                    colorScheme: regenerateColorScheme !== 'original' ? regenerateColorScheme : undefined,
                    customPrompt: regeneratePrompt || undefined,
                    mode: regenerateMode,
                    designDefinition: regenerateStyle === 'design-definition' ? designDefinition : undefined,
                    // 境界オフセット情報（ユーザーが調整した認識範囲）
                    boundaryOffsetTop: section.boundaryOffsetTop || undefined,
                    boundaryOffsetBottom: section.boundaryOffsetBottom || undefined,
                    // コピーテキスト（AIコピー生成で作成されたテキスト）
                    copyText: section.config?.text || undefined,
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '再生成に失敗しました');
            }

            // 現在の画像を履歴に追加（元に戻す機能用）
            if (section.imageId && section.image) {
                setEditHistory(prev => ({
                    ...prev,
                    [regenerateSectionId]: [
                        { imageId: section.imageId, image: section.image, timestamp: Date.now() },
                        ...(prev[regenerateSectionId] || [])
                    ].slice(0, 10) // 最大10件保持
                }));
            }

            // セクションの画像を更新
            setSections(prev => prev.map(s =>
                s.id === regenerateSectionId
                    ? { ...s, imageId: data.newImageId, image: data.media }
                    : s
            ));

            toast.success('セクションを再生成しました');
        } catch (error: any) {
            toast.error(error.message || '再生成に失敗しました');
        } finally {
            setIsRegenerating(false);
            setRegeneratingSectionIds(prev => {
                const next = new Set(prev);
                next.delete(regenerateSectionId);
                return next;
            });
        }
    };

    // 一括再生成の実行
    const handleBatchRegenerate = async () => {
        if (selectedSectionsForRegenerate.size === 0) return;
        if (planLimits && !planLimits.canAIGenerate) {
            toast.error('AI機能は有料プランのみご利用いただけます');
            return;
        }

        // regenerateReferenceAlsoがtrueなら参照セクションも含める、falseなら除外
        const sectionIds = Array.from(selectedSectionsForRegenerate).filter(id =>
            regenerateReferenceAlso || id !== batchReferenceSection
        );

        // デバッグログ
        console.log('=== Batch Regenerate Debug ===');
        console.log('Reference section:', batchReferenceSection);
        console.log('Regenerate reference also:', regenerateReferenceAlso);
        console.log('Target section IDs:', sectionIds);
        console.log('All sections:', sections.map(s => ({ id: s.id, type: typeof s.id })));

        setIsBatchRegenerating(true);
        setBatchRegenerateProgress({ current: 0, total: sectionIds.length });
        // モーダルは閉じない - 進捗を表示するため

        // 選択したセクションをローディング状態に
        setRegeneratingSectionIds(new Set(sectionIds));

        let successCount = 0;
        let completedCount = 0;

        // 参照セクションの画像URLを取得（全セクションで共通）
        const referenceSection = batchReferenceSection
            ? sections.find(s => s.id === batchReferenceSection)
            : null;
        const refFilePath = referenceSection?.image?.filePath;
        const styleReferenceUrl = refFilePath && refFilePath.startsWith('http') ? refFilePath : undefined;

        // 2並列で処理（Gemini APIレート制限対応 + サーバー負荷軽減）
        const CONCURRENCY = 2;
        console.log('=== Starting Batch Regenerate (2 parallel) ===');
        console.log(`Processing ${sectionIds.length} sections with concurrency=${CONCURRENCY}`);
        console.log(`Style reference URL: ${styleReferenceUrl}`);

        const results: { sectionId: string; success: boolean; error?: string; data?: any }[] = [];

        // 1セクションを処理する関数
        const processSection = async (sectionId: string): Promise<{ sectionId: string; success: boolean; error?: string; data?: any }> => {
            const section = sections.find(s => String(s.id) === String(sectionId));

            if (!section) {
                console.warn(`Section not found for ID: ${sectionId}`);
                return { sectionId, success: false, error: 'not found' };
            }

            const dbSectionId = typeof section.id === 'string' && section.id.startsWith('temp-')
                ? null
                : Number(section.id);

            if (!dbSectionId || isNaN(dbSectionId)) {
                console.warn(`Section ${section.id} skipped - not saved yet`);
                return { sectionId, success: false, error: 'not saved' };
            }

            try {
                console.log(`[Batch] Starting section ${dbSectionId}...`);

                const response: Response = await fetch(`/api/sections/${dbSectionId}/regenerate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        style: batchReferenceSection ? 'sampling' : (batchRegenerateStyle === 'design-definition' ? 'design-definition' : batchRegenerateStyle),
                        colorScheme: batchRegenerateColorScheme !== 'original' ? batchRegenerateColorScheme : undefined,
                        customPrompt: batchRegeneratePrompt || undefined,
                        mode: batchRegenerateGenerationMode,
                        designDefinition: !batchReferenceSection && batchRegenerateStyle === 'design-definition' ? designDefinition : undefined,
                        styleReferenceUrl: styleReferenceUrl || undefined,
                        unifyDesign: !!batchReferenceSection,
                        boundaryOffsetTop: section.boundaryOffsetTop || undefined,
                        boundaryOffsetBottom: section.boundaryOffsetBottom || undefined,
                        copyText: section.config?.text || undefined,
                    })
                });

                const data = await response.json();

                // 進捗更新
                completedCount++;
                setBatchRegenerateProgress({ current: completedCount, total: sectionIds.length });

                // ローディング状態を解除
                setRegeneratingSectionIds(prev => {
                    const next = new Set(prev);
                    next.delete(sectionId);
                    return next;
                });

                if (response.ok) {
                    console.log(`✅ [Batch] Section ${dbSectionId} completed (${completedCount}/${sectionIds.length})`);
                    successCount++;

                    // 履歴に追加
                    if (section.imageId && section.image) {
                        setEditHistory(prev => ({
                            ...prev,
                            [sectionId]: [
                                { imageId: section.imageId, image: section.image, timestamp: Date.now() },
                                ...(prev[sectionId] || [])
                            ].slice(0, 10)
                        }));
                    }

                    // NOTE: セクション画像のstate更新はバッチ完了後に一括で行う（並列競合回避）

                    // モバイル画像も再生成（オプションがONの場合）
                    if (includeMobileInBatch && section.mobileImage?.filePath) {
                        const generatedImageUrl = data.media?.filePath || data.newImageUrl;
                        try {
                            console.log(`[Batch] Starting mobile for section ${dbSectionId}...`);
                            const mobileResponse = await fetch(`/api/sections/${dbSectionId}/regenerate`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    style: batchReferenceSection ? 'sampling' : (batchRegenerateStyle === 'design-definition' ? 'design-definition' : batchRegenerateStyle),
                                    colorScheme: batchRegenerateColorScheme !== 'original' ? batchRegenerateColorScheme : undefined,
                                    customPrompt: batchRegeneratePrompt || undefined,
                                    mode: batchRegenerateGenerationMode,
                                    designDefinition: !batchReferenceSection && batchRegenerateStyle === 'design-definition' ? designDefinition : undefined,
                                    styleReferenceUrl: generatedImageUrl || styleReferenceUrl || undefined,
                                    targetImage: 'mobile',
                                    unifyDesign: true,
                                    boundaryOffsetTop: section.boundaryOffsetTop || undefined,
                                    boundaryOffsetBottom: section.boundaryOffsetBottom || undefined,
                                })
                            });
                            const mobileData = await mobileResponse.json();
                            if (mobileResponse.ok) {
                                console.log(`✅ [Batch] Mobile for section ${dbSectionId} completed`);
                                // モバイルもresultに含める
                                data.mobileImageId = mobileData.newImageId;
                                data.mobileMedia = mobileData.media;
                            }
                        } catch (mobileError) {
                            console.warn(`Mobile regenerate error for section ${sectionId}`);
                        }
                    }

                    return { sectionId, success: true, data };
                } else {
                    console.error(`❌ [Batch] Section ${dbSectionId} failed:`, data.error);
                    return { sectionId, success: false, error: data.error };
                }
            } catch (error: any) {
                completedCount++;
                setBatchRegenerateProgress({ current: completedCount, total: sectionIds.length });
                setRegeneratingSectionIds(prev => {
                    const next = new Set(prev);
                    next.delete(sectionId);
                    return next;
                });
                console.error(`❌ [Batch] Section ${sectionId} error:`, error.message);
                return { sectionId, success: false, error: error.message };
            }
        };

        // 2並列でバッチ処理
        for (let i = 0; i < sectionIds.length; i += CONCURRENCY) {
            const batch = sectionIds.slice(i, i + CONCURRENCY);
            console.log(`[Batch] Processing batch ${Math.floor(i / CONCURRENCY) + 1}: sections ${batch.join(', ')}`);
            const batchResults = await Promise.all(batch.map(processSection));
            results.push(...batchResults);
        }

        const failedCount = results.filter(r => !r.success).length;

        console.log(`=== Batch Complete: ${successCount} success, ${failedCount} failed ===`);

        if (failedCount > 0) {
            toast.error(`${failedCount}件のセクションで再生成に失敗しました`);
        }

        // 全結果をまとめて一括でセクション更新（並列処理の競合を回避）
        if (successCount > 0) {
            const successResults = results.filter(r => r.success && r.data);
            setSections(prev => {
                let updated = [...prev];
                for (const result of successResults) {
                    updated = updated.map(s => {
                        if (String(s.id) !== String(result.sectionId)) return s;
                        const patch: any = { imageId: result.data.newImageId, image: result.data.media };
                        if (result.data.mobileImageId) {
                            patch.mobileImageId = result.data.mobileImageId;
                            patch.mobileImage = result.data.mobileMedia;
                        }
                        return { ...s, ...patch };
                    });
                }
                return updated;
            });
            console.log(`[Batch] Applied ${successResults.length} section updates in one setSections call`);
        }

        setIsBatchRegenerating(false);
        setBatchRegenerateProgress(null);
        setShowBatchRegenerateModal(false); // 処理完了後にモーダルを閉じる
        setBatchRegenerateMode(false);
        setSelectedSectionsForRegenerate(new Set());
        // オプションをリセット
        setBatchRegenerateStyle('design-definition');
        setBatchRegenerateColorScheme('original');
        setBatchRegenerateGenerationMode('light');
        setBatchRegeneratePrompt('');
        setBatchReferenceSection(null); // 参照セクションもリセット
        setRegenerateReferenceAlso(false); // オプションもリセット
        const mobileNote = includeMobileInBatch ? '（モバイル含む）' : '';
        toast.success(`${successCount}/${sectionIds.length}セクションを再生成しました${mobileNote}`);
    };

    // 4Kアップスケール実行
    const handle4KUpscale = async () => {
        if (planLimits && !planLimits.canAIGenerate) {
            toast.error('AI機能は有料プランのみご利用いただけます');
            return;
        }
        if (pageId === 'new') {
            toast.error('先にページを保存してください');
            return;
        }

        setIs4KProcessing(true);
        setUpscale4KProgress({ current: 0, total: 0, message: '開始中...', results: [] });

        try {
            const response = await fetch(`/api/pages/${pageId}/upscale-4k`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    textCorrection: textCorrection4K,
                    resolution: upscaleResolution,
                    sectionIds: upscaleMode === 'individual' ? selectedUpscaleSections : null,
                    useRealESRGAN: useRealESRGAN,
                    customPrompt: geminiUpscalePrompt || null,
                }),
            });

            const reader = response.body?.getReader();
            if (!reader) throw new Error('Stream not available');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'start') {
                                setUpscale4KProgress({
                                    current: 0,
                                    total: data.total,
                                    message: data.message,
                                    results: [],
                                });
                            } else if (data.type === 'progress') {
                                setUpscale4KProgress(prev => prev ? {
                                    ...prev,
                                    current: data.current,
                                    message: data.message,
                                } : null);
                            } else if (data.type === 'section_complete') {
                                setUpscale4KProgress(prev => prev ? {
                                    ...prev,
                                    results: [...prev.results, data],
                                } : null);
                                // セクション画像を更新
                                setSections(prev => prev.map(s =>
                                    s.id.toString() === data.sectionId.toString()
                                        ? { ...s, image: { ...s.image, filePath: data.newImageUrl } }
                                        : s
                                ));
                            } else if (data.type === 'complete') {
                                toast.success(`HD高画質化完了: ${data.processed}/${data.total}セクション`);
                            } else if (data.type === 'error') {
                                throw new Error(data.error);
                            }
                        } catch (e) {
                            // パースエラーは無視
                        }
                    }
                }
            }
        } catch (error: any) {
            toast.error(error.message || 'HD高画質化に失敗しました');
        } finally {
            setIs4KProcessing(false);
            setUpscale4KProgress(null);
            setShow4KModal(false);
        }
    };

    return (
        <div className={clsx("min-h-screen bg-gray-100 transition-all", showLPComparePanel ? "lg:pr-[680px]" : "lg:pr-[360px]")}>
            {/* フローティングツールバー - デスクトップ版 */}
            <div className="hidden lg:flex fixed top-4 left-1/2 -translate-x-1/2 z-50 items-center gap-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl px-4 py-2.5 border border-gray-200" style={{ transform: 'translateX(calc(-50% - 180px))' }}>
                {/* HD高画質化（Business/Enterpriseプランのみ） */}
                {planLimits?.canUpscale4K && (
                    <>
                        <button
                            onClick={() => setShow4KModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 rounded-lg transition-all shadow-sm"
                            title="HD高画質化"
                        >
                            <span className="text-white font-black text-xs">HD</span>
                            <span className="text-violet-200 text-xs">高画質化</span>
                        </button>

                        <div className="w-px h-6 bg-gray-200" />
                    </>
                )}

                {/* API消費トークン */}
                {apiCost && (
                    <div className="flex items-center gap-3 px-2">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Today</span>
                            <span className="font-bold text-sm text-gray-800">{formatTokens(usdToTokens(apiCost.todayCost))}</span>
                        </div>
                        <div className="w-px h-4 bg-gray-200" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Month</span>
                            <span className="font-bold text-sm text-gray-600">{formatTokens(usdToTokens(apiCost.monthCost))}</span>
                        </div>
                    </div>
                )}

                <div className="w-px h-6 bg-gray-200" />

                {/* 履歴ボタン */}
                <button
                    onClick={() => {
                        if (sections.length > 0) {
                            handleOpenHistoryPanel(sections[0].id);
                        } else {
                            toast('セクションがありません');
                        }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                    title="変更履歴"
                >
                    <Undo2 className="h-4 w-4" />
                    <span className="text-xs font-medium">履歴</span>
                </button>

                <div className="w-px h-6 bg-gray-200" />

                {/* プレビューボタン */}
                <button
                    onClick={() => window.open(`/preview/page/${pageId}?mode=${viewMode}`, '_blank')}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-all shadow-sm"
                >
                    <Eye className="h-4 w-4" />
                    <span className="whitespace-nowrap">プレビュー</span>
                </button>

                {/* 保存ボタン */}
                <button
                    onClick={() => handleSave()}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 shadow-sm"
                >
                    {isSaving ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    <span className="whitespace-nowrap">{isSaving ? '保存中...' : '保存'}</span>
                </button>

                {/* 自動保存トグル */}
                <div className="flex items-center gap-2 ml-2">
                    <button
                        onClick={() => setIsAutoSaveEnabled(!isAutoSaveEnabled)}
                        className={clsx(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                            isAutoSaveEnabled ? "bg-blue-600" : "bg-gray-300"
                        )}
                    >
                        <span
                            className={clsx(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                isAutoSaveEnabled ? "translate-x-6" : "translate-x-1"
                            )}
                        />
                    </button>
                    <span className="text-xs text-gray-600 whitespace-nowrap">
                        自動保存
                        {isAutoSaveEnabled && autoSaveStatus === 'saving' && (
                            <span className="ml-1 text-blue-600">保存中...</span>
                        )}
                        {isAutoSaveEnabled && autoSaveStatus === 'saved' && (
                            <span className="ml-1 text-green-600">保存完了</span>
                        )}
                        {isAutoSaveEnabled && autoSaveStatus === 'error' && (
                            <span className="ml-1 text-red-600">エラー</span>
                        )}
                    </span>
                </div>
            </div>

            {/* モバイル用ボトムツールバー */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-gray-200 shadow-2xl px-3 py-2 safe-area-bottom">
                <div className="flex items-center justify-between gap-2">
                    {/* 保存 */}
                    <button
                        onClick={() => handleSave()}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 min-h-[44px]"
                    >
                        {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        <span>{isSaving ? '保存中' : '保存'}</span>
                    </button>

                    {/* プレビュー */}
                    <button
                        onClick={() => window.open(`/preview/page/${pageId}?mode=${viewMode}`, '_blank')}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2.5 rounded-lg text-xs font-bold transition-all min-h-[44px]"
                    >
                        <Eye className="h-4 w-4" />
                        <span>プレビュー</span>
                    </button>

                    {/* HD（Business/Enterpriseプランのみ） */}
                    {planLimits?.canUpscale4K && (
                        <button
                            onClick={() => setShow4KModal(true)}
                            className="flex items-center gap-1 bg-violet-600 text-white px-2.5 py-2.5 rounded-lg text-xs font-bold min-h-[44px]"
                        >
                            <span className="font-black text-[10px]">HD</span>
                        </button>
                    )}

                    {/* メニュー開閉 */}
                    <button
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                        className={clsx(
                            "flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all min-h-[44px]",
                            showMobileMenu
                                ? "bg-gray-900 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        )}
                    >
                        {showMobileMenu ? <X className="h-4 w-4" /> : <PenTool className="h-4 w-4" />}
                        <span>{showMobileMenu ? '閉じる' : 'メニュー'}</span>
                    </button>
                </div>
            </div>

            {/* Hidden file input */}
            <input
                id="file-upload-input"
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
            />

            {/* 完全LPプレビュー - メインビュー */}
            <div className="flex justify-center pt-4 pb-24 lg:py-20 px-2 sm:px-4">
                <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl bg-white shadow-2xl">
                    {/* ヘッダー - 設定がある場合のみ表示 */}
                    {(headerConfig.logoText || headerConfig.ctaText || (headerConfig.navItems && headerConfig.navItems.length > 0)) && (
                        <header className="flex h-14 items-center justify-between bg-white/90 px-3 shadow-sm backdrop-blur-md gap-2">
                            <div className="text-sm font-bold text-gray-900 truncate max-w-[40%]">
                                {headerConfig.logoText}
                            </div>
                            <nav className="hidden gap-6">
                                {headerConfig.navItems?.map((item: any) => (
                                    <a
                                        key={item.id}
                                        href={item.href}
                                        onClick={(e) => {
                                            if (item.href?.startsWith('#')) {
                                                e.preventDefault();
                                                const targetId = item.href.substring(1);
                                                document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
                                            }
                                        }}
                                        className="text-sm font-medium text-gray-700 hover:text-blue-600 cursor-pointer"
                                    >
                                        {item.label}
                                    </a>
                                ))}
                            </nav>
                            {headerConfig.ctaText && (
                                <a
                                    href={headerConfig.ctaLink || '#contact'}
                                    onClick={(e) => {
                                        const href = headerConfig.ctaLink || '#contact';
                                        if (href.startsWith('#')) {
                                            e.preventDefault();
                                            const targetId = href.substring(1);
                                            document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
                                        }
                                    }}
                                    className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white cursor-pointer hover:bg-blue-700 transition-colors whitespace-nowrap flex-shrink-0"
                                >
                                    {headerConfig.ctaText}
                                </a>
                            )}
                        </header>
                    )}

                    {/* セクション - クリックで編集 */}
                    {sections.length === 0 ? (
                        <div className="h-96 flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300">
                            <Upload className="h-12 w-12 text-gray-400 mb-4" />
                            <p className="text-gray-500 font-medium mb-4">セクションを追加</p>
                            <div className="flex flex-wrap justify-center gap-3">
                                <button
                                    onClick={() => document.getElementById('file-upload-input')?.click()}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2"
                                >
                                    <Upload className="w-4 h-4" />
                                    画像をアップロード
                                </button>
                                <button
                                    onClick={() => setShowDualImportModal(true)}
                                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-all flex items-center gap-2"
                                >
                                    <Monitor className="w-4 h-4" />
                                    <span className="text-gray-300">/</span>
                                    <Smartphone className="w-4 h-4" />
                                    URLから取り込み
                                </button>
                            </div>
                            <p className="text-gray-400 text-xs mt-3">URLから両ビューポート同時取り込みが可能です</p>
                        </div>
                    ) : (
                        <>
                            {/* 先頭への挿入ボタン */}
                            {!isDraggingAsset && !batchRegenerateMode && !backgroundUnifyMode && sections.length > 0 && (
                                <div className="relative h-8 group/insert-top mb-2">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 opacity-0 group-hover/insert-top:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleOpenInsertModal(0)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-full shadow-lg hover:shadow-xl transition-all"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            先頭に挿入
                                        </button>
                                    </div>
                                </div>
                            )}
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={sections.map(s => s.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {sections.map((section, sectionIndex) => (
                                        <SortableSectionWrapper key={section.id} id={section.id}>
                                            {/* ドロップゾーンインジケーター（セクション上部） */}
                                            {isDraggingAsset && sectionIndex === 0 && (
                                                <div
                                                    className={clsx(
                                                        "h-16 border-2 border-dashed rounded-lg mx-2 transition-all flex items-center justify-center",
                                                        dragOverSectionId === `before-${section.id}`
                                                            ? "border-violet-500 bg-violet-50"
                                                            : "border-gray-300 bg-gray-50"
                                                    )}
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        setDragOverSectionId(`before-${section.id}`);
                                                    }}
                                                    onDragLeave={() => setDragOverSectionId(null)}
                                                    onDrop={async (e) => {
                                                        e.preventDefault();
                                                        // 先頭に追加
                                                        const assetData = e.dataTransfer.getData('application/json');
                                                        if (!assetData) return;
                                                        const asset = JSON.parse(assetData);
                                                        setIsProcessingAssetDrop(true);
                                                        try {
                                                            const res = await fetch('/api/assets/download', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ url: asset.downloadUrl, type: asset.type, title: asset.title })
                                                            });
                                                            const data = await res.json();
                                                            if (data.url) {
                                                                const newSection = {
                                                                    id: `temp-${Date.now()}`,
                                                                    role: 'asset',
                                                                    order: 0,
                                                                    imageId: null,
                                                                    image: { filePath: data.url },
                                                                    config: { assetType: asset.type, assetTitle: asset.title }
                                                                };
                                                                setSections(prev => [newSection, ...prev].map((s, i) => ({ ...s, order: i })));
                                                                toast.success('素材を先頭に追加しました');
                                                            }
                                                        } catch (error) {
                                                            toast.error('素材の追加に失敗しました');
                                                        } finally {
                                                            setIsProcessingAssetDrop(false);
                                                            setDragOverSectionId(null);
                                                            setIsDraggingAsset(false);
                                                        }
                                                    }}
                                                >
                                                    <span className="text-xs text-gray-500">ここにドロップして先頭に追加</span>
                                                </div>
                                            )}
                                            <div
                                                id={`section-${section.id}`}
                                                data-section-container
                                                className={clsx(
                                                    "relative group cursor-pointer",
                                                    batchRegenerateMode && batchReferenceSection === section.id && "ring-4 ring-blue-500",
                                                    batchRegenerateMode && selectedSectionsForRegenerate.has(section.id) && batchReferenceSection !== section.id && "ring-4 ring-orange-500",
                                                    backgroundUnifyMode && selectedSectionsForBackgroundUnify.has(section.id) && "ring-4 ring-amber-500",
                                                    sectionDeleteMode && selectedSectionsForDelete.has(section.id) && "ring-4 ring-red-500",
                                                    isDraggingAsset && dragOverSectionId === `overlay-${section.id}` && "ring-4 ring-cyan-500 bg-cyan-500/10"
                                                )}
                                                onDragOver={(e) => {
                                                    if (isDraggingAsset && section.image?.filePath) {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setDragOverSectionId(`overlay-${section.id}`);
                                                    }
                                                }}
                                                onDragLeave={(e) => {
                                                    if (dragOverSectionId === `overlay-${section.id}`) {
                                                        setDragOverSectionId(null);
                                                    }
                                                }}
                                                onDrop={async (e) => {
                                                    if (!isDraggingAsset || !section.image?.filePath) return;
                                                    e.preventDefault();
                                                    e.stopPropagation();

                                                    try {
                                                        const assetData = e.dataTransfer.getData('application/json');
                                                        if (!assetData) return;

                                                        const asset = JSON.parse(assetData);

                                                        // ドロップ位置を計算（セクション内での相対位置）
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                                                        const y = ((e.clientY - rect.top) / rect.height) * 100;

                                                        // オーバーレイとして追加
                                                        const newOverlay = {
                                                            id: `overlay-${Date.now()}`,
                                                            type: 'button' as const,
                                                            x: Math.max(5, Math.min(95, x)),
                                                            y: Math.max(5, Math.min(95, y)),
                                                            width: 30,
                                                            height: 48,
                                                            content: asset.name || 'ボタン',
                                                            style: {
                                                                backgroundColor: '#6366f1',
                                                                textColor: '#ffffff',
                                                                borderRadius: 8,
                                                                fontSize: 16,
                                                                fontWeight: 'bold',
                                                                padding: '12px 24px',
                                                            },
                                                        };

                                                        // セクションにオーバーレイを追加
                                                        setSections(prev => prev.map(s =>
                                                            s.id === section.id
                                                                ? {
                                                                    ...s,
                                                                    config: {
                                                                        ...(s.config || {}),
                                                                        overlays: [...(s.config?.overlays || []), newOverlay]
                                                                    }
                                                                }
                                                                : s
                                                        ));

                                                        toast.success(`「${asset.name}」をオーバーレイとして追加しました`);
                                                    } catch (error) {
                                                        console.error('Overlay drop error:', error);
                                                    } finally {
                                                        setDragOverSectionId(null);
                                                        setIsDraggingAsset(false);
                                                    }
                                                }}
                                                onClick={() => {
                                                    if (sectionDeleteMode) {
                                                        // セクション削除モード: 選択/解除
                                                        setSelectedSectionsForDelete(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(section.id)) {
                                                                next.delete(section.id);
                                                            } else {
                                                                next.add(section.id);
                                                            }
                                                            return next;
                                                        });
                                                    } else if (batchRegenerateMode && section.image?.filePath) {
                                                        // 参照セクションをクリックした場合は解除
                                                        if (batchReferenceSection === section.id) {
                                                            setBatchReferenceSection(null);
                                                            return;
                                                        }
                                                        // 一括再生成モード: 選択/解除（参照セクション以外）
                                                        setSelectedSectionsForRegenerate(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(section.id)) {
                                                                next.delete(section.id);
                                                            } else {
                                                                next.add(section.id);
                                                            }
                                                            return next;
                                                        });
                                                    } else if (backgroundUnifyMode && section.image?.filePath) {
                                                        // 背景色統一モード: 選択/解除
                                                        setSelectedSectionsForBackgroundUnify(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(section.id)) {
                                                                next.delete(section.id);
                                                            } else {
                                                                next.add(section.id);
                                                            }
                                                            return next;
                                                        });
                                                    } else if (section.image?.filePath) {
                                                        handleOpenInpaint(
                                                            section.id,
                                                            section.image.filePath,
                                                            section.mobileImage?.filePath
                                                        );
                                                    }
                                                }}
                                            >
                                                {(viewMode === 'desktop' ? section.image?.filePath : section.mobileImage?.filePath || section.image?.filePath) ? (
                                                    <>
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={viewMode === 'mobile' && section.mobileImage?.filePath
                                                                ? section.mobileImage.filePath
                                                                : section.image?.filePath}
                                                            alt={section.role}
                                                            className={clsx(
                                                                "block h-auto",
                                                                viewMode === 'mobile' ? "w-full max-w-[390px] mx-auto" : "w-full"
                                                            )}
                                                        />
                                                        {/* モバイル画像がない場合の警告 */}
                                                        {viewMode === 'mobile' && !section.mobileImage?.filePath && section.image?.filePath && (
                                                            <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                                                                モバイル画像なし
                                                            </div>
                                                        )}
                                                        {/* 動画がある場合のプレビュー */}
                                                        {(() => {
                                                            const config = section.config ? (typeof section.config === 'string' ? JSON.parse(section.config) : section.config) : {};
                                                            if (!config.video) return null;

                                                            const video = config.video;
                                                            const isYouTube = video.type === 'youtube' || video.url?.includes('youtube.com');
                                                            const isPartial = video.displayMode === 'partial';

                                                            // 部分配置の場合
                                                            if (isPartial) {
                                                                const handleResize = (e: React.MouseEvent, corner: string) => {
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    const parentRect = (e.currentTarget as HTMLElement).closest('[data-section-container]')?.getBoundingClientRect();
                                                                    if (!parentRect) return;
                                                                    const startX = e.clientX;
                                                                    const startWidth = video.width || 40;

                                                                    const handleMouseMove = (moveEvent: MouseEvent) => {
                                                                        const deltaX = ((moveEvent.clientX - startX) / parentRect.width) * 100;
                                                                        let newWidth = startWidth;
                                                                        if (corner.includes('right')) {
                                                                            newWidth = startWidth + deltaX * 2;
                                                                        } else {
                                                                            newWidth = startWidth - deltaX * 2;
                                                                        }
                                                                        newWidth = Math.max(15, Math.min(80, newWidth));

                                                                        setSections(prev => prev.map(s => {
                                                                            if (s.id === section.id) {
                                                                                const currentConfig = s.config ? (typeof s.config === 'string' ? JSON.parse(s.config) : s.config) : {};
                                                                                return {
                                                                                    ...s,
                                                                                    config: JSON.stringify({
                                                                                        ...currentConfig,
                                                                                        video: { ...currentConfig.video, width: newWidth }
                                                                                    })
                                                                                };
                                                                            }
                                                                            return s;
                                                                        }));
                                                                    };

                                                                    const handleMouseUp = () => {
                                                                        document.removeEventListener('mousemove', handleMouseMove);
                                                                        document.removeEventListener('mouseup', handleMouseUp);
                                                                    };

                                                                    document.addEventListener('mousemove', handleMouseMove);
                                                                    document.addEventListener('mouseup', handleMouseUp);
                                                                };

                                                                return (
                                                                    <div
                                                                        className="absolute z-30 group"
                                                                        style={{
                                                                            left: `${video.x || 50}%`,
                                                                            top: `${video.y || 50}%`,
                                                                            width: `${video.width || 40}%`,
                                                                            transform: 'translate(-50%, -50%)',
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        {/* ドラッグ用のハンドル（枠部分） */}
                                                                        <div
                                                                            className="absolute -inset-2 cursor-move z-0"
                                                                            onMouseDown={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();
                                                                                const rect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                                                                                if (!rect) return;
                                                                                const startX = e.clientX;
                                                                                const startY = e.clientY;
                                                                                const startVideoX = video.x || 50;
                                                                                const startVideoY = video.y || 50;

                                                                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                                                                    const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100;
                                                                                    const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100;
                                                                                    const newX = Math.max(10, Math.min(90, startVideoX + deltaX));
                                                                                    const newY = Math.max(10, Math.min(90, startVideoY + deltaY));

                                                                                    setSections(prev => prev.map(s => {
                                                                                        if (s.id === section.id) {
                                                                                            const currentConfig = s.config ? (typeof s.config === 'string' ? JSON.parse(s.config) : s.config) : {};
                                                                                            return {
                                                                                                ...s,
                                                                                                config: JSON.stringify({
                                                                                                    ...currentConfig,
                                                                                                    video: { ...currentConfig.video, x: newX, y: newY }
                                                                                                })
                                                                                            };
                                                                                        }
                                                                                        return s;
                                                                                    }));
                                                                                };

                                                                                const handleMouseUp = () => {
                                                                                    document.removeEventListener('mousemove', handleMouseMove);
                                                                                    document.removeEventListener('mouseup', handleMouseUp);
                                                                                };

                                                                                document.addEventListener('mousemove', handleMouseMove);
                                                                                document.addEventListener('mouseup', handleMouseUp);
                                                                            }}
                                                                        />
                                                                        <div className="relative rounded-lg overflow-hidden shadow-2xl ring-2 ring-indigo-500/50 z-10">
                                                                            {isYouTube ? (
                                                                                <iframe
                                                                                    src={`${video.url}?autoplay=0`}
                                                                                    className="w-full aspect-video"
                                                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                                />
                                                                            ) : (
                                                                                <video
                                                                                    src={video.url}
                                                                                    controls
                                                                                    className="w-full"
                                                                                    autoPlay={video.autoplay}
                                                                                    loop={video.loop}
                                                                                    muted={video.muted}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        {/* リサイズハンドル */}
                                                                        <div
                                                                            className="resize-handle absolute -left-2 -top-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-nw-resize opacity-0 group-hover:opacity-100 z-20"
                                                                            onMouseDown={(e) => handleResize(e, 'top-left')}
                                                                        />
                                                                        <div
                                                                            className="resize-handle absolute -right-2 -top-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-ne-resize opacity-0 group-hover:opacity-100 z-20"
                                                                            onMouseDown={(e) => handleResize(e, 'top-right')}
                                                                        />
                                                                        <div
                                                                            className="resize-handle absolute -left-2 -bottom-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-sw-resize opacity-0 group-hover:opacity-100 z-20"
                                                                            onMouseDown={(e) => handleResize(e, 'bottom-left')}
                                                                        />
                                                                        <div
                                                                            className="resize-handle absolute -right-2 -bottom-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-se-resize opacity-0 group-hover:opacity-100 z-20"
                                                                            onMouseDown={(e) => handleResize(e, 'bottom-right')}
                                                                        />
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setSections(prev => prev.map(s => {
                                                                                    if (s.id === section.id) {
                                                                                        const currentConfig = s.config ? (typeof s.config === 'string' ? JSON.parse(s.config) : s.config) : {};
                                                                                        delete currentConfig.video;
                                                                                        return { ...s, config: JSON.stringify(currentConfig) };
                                                                                    }
                                                                                    return s;
                                                                                }));
                                                                                toast.success('動画を削除しました');
                                                                            }}
                                                                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg transition-colors opacity-0 group-hover:opacity-100 z-20"
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            }

                                                            // 全体表示・背景の場合
                                                            return (
                                                                <div
                                                                    className="absolute inset-0 z-30 bg-black/60 flex items-center justify-center group"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onMouseDown={(e) => e.stopPropagation()}
                                                                >
                                                                    {isYouTube ? (
                                                                        <iframe
                                                                            src={`${video.url}?autoplay=0`}
                                                                            className="w-full h-full"
                                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                            allowFullScreen
                                                                        />
                                                                    ) : (
                                                                        <video
                                                                            src={video.url}
                                                                            controls
                                                                            className="max-w-full max-h-full"
                                                                            autoPlay={video.autoplay}
                                                                            loop={video.loop}
                                                                            muted={video.muted}
                                                                        />
                                                                    )}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSections(prev => prev.map(s => {
                                                                                if (s.id === section.id) {
                                                                                    const currentConfig = s.config ? (typeof s.config === 'string' ? JSON.parse(s.config) : s.config) : {};
                                                                                    delete currentConfig.video;
                                                                                    return { ...s, config: JSON.stringify(currentConfig) };
                                                                                }
                                                                                return s;
                                                                            }));
                                                                            toast.success('動画を削除しました');
                                                                        }}
                                                                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-colors"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })()}
                                                        {/* オーバーレイ要素の表示（インタラクティブ） */}
                                                        {section.config?.overlays?.map((overlay: any) => (
                                                            <div
                                                                key={overlay.id}
                                                                className={clsx(
                                                                    "absolute cursor-move z-40 transition-all",
                                                                    selectedOverlayId === overlay.id && selectedOverlaySectionId === String(section.id) && "ring-2 ring-cyan-500 ring-offset-2"
                                                                )}
                                                                style={{
                                                                    left: `${overlay.x}%`,
                                                                    top: `${overlay.y}%`,
                                                                    transform: 'translate(-50%, -50%)',
                                                                }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedOverlayId(overlay.id);
                                                                    setSelectedOverlaySectionId(String(section.id));
                                                                }}
                                                                onDoubleClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingOverlayId(overlay.id);
                                                                }}
                                                                onMouseDown={(e) => {
                                                                    if (editingOverlayId === overlay.id) return;
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                                                                    if (!rect) return;
                                                                    setDraggingOverlayId(overlay.id);
                                                                    setSelectedOverlaySectionId(String(section.id));
                                                                    setOverlayDragStart({
                                                                        x: e.clientX,
                                                                        y: e.clientY,
                                                                        overlayX: overlay.x,
                                                                        overlayY: overlay.y
                                                                    });
                                                                }}
                                                            >
                                                                {overlay.type === 'button' && (
                                                                    editingOverlayId === overlay.id ? (
                                                                        <input
                                                                            type="text"
                                                                            autoFocus
                                                                            value={overlay.content}
                                                                            onChange={(e) => {
                                                                                setSections(prev => prev.map(s =>
                                                                                    s.id === section.id
                                                                                        ? {
                                                                                            ...s,
                                                                                            config: {
                                                                                                ...s.config,
                                                                                                overlays: s.config?.overlays?.map((o: any) =>
                                                                                                    o.id === overlay.id ? { ...o, content: e.target.value } : o
                                                                                                )
                                                                                            }
                                                                                        }
                                                                                        : s
                                                                                ));
                                                                            }}
                                                                            onBlur={() => setEditingOverlayId(null)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') setEditingOverlayId(null);
                                                                                if (e.key === 'Escape') setEditingOverlayId(null);
                                                                            }}
                                                                            className="whitespace-nowrap text-center outline-none"
                                                                            style={{
                                                                                backgroundColor: overlay.style?.backgroundColor || '#6366f1',
                                                                                color: overlay.style?.textColor || '#fff',
                                                                                borderRadius: `${overlay.style?.borderRadius || 8}px`,
                                                                                fontSize: `${overlay.style?.fontSize || 16}px`,
                                                                                fontWeight: overlay.style?.fontWeight || 'bold',
                                                                                padding: overlay.style?.padding || '12px 24px',
                                                                                boxShadow: overlay.style?.boxShadow || '0 4px 12px rgba(0,0,0,0.15)',
                                                                                minWidth: '80px',
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <div
                                                                            className="whitespace-nowrap"
                                                                            style={{
                                                                                backgroundColor: overlay.style?.backgroundColor || '#6366f1',
                                                                                color: overlay.style?.textColor || '#fff',
                                                                                borderRadius: `${overlay.style?.borderRadius || 8}px`,
                                                                                fontSize: `${overlay.style?.fontSize || 16}px`,
                                                                                fontWeight: overlay.style?.fontWeight || 'bold',
                                                                                padding: overlay.style?.padding || '12px 24px',
                                                                                boxShadow: overlay.style?.boxShadow || '0 4px 12px rgba(0,0,0,0.15)',
                                                                            }}
                                                                        >
                                                                            {overlay.content}
                                                                        </div>
                                                                    )
                                                                )}
                                                                {overlay.type === 'text' && (
                                                                    editingOverlayId === overlay.id ? (
                                                                        <input
                                                                            type="text"
                                                                            autoFocus
                                                                            value={overlay.content}
                                                                            onChange={(e) => {
                                                                                setSections(prev => prev.map(s =>
                                                                                    s.id === section.id
                                                                                        ? {
                                                                                            ...s,
                                                                                            config: {
                                                                                                ...s.config,
                                                                                                overlays: s.config?.overlays?.map((o: any) =>
                                                                                                    o.id === overlay.id ? { ...o, content: e.target.value } : o
                                                                                                )
                                                                                            }
                                                                                        }
                                                                                        : s
                                                                                ));
                                                                            }}
                                                                            onBlur={() => setEditingOverlayId(null)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') setEditingOverlayId(null);
                                                                            }}
                                                                            className="outline-none bg-transparent"
                                                                            style={{
                                                                                color: overlay.style?.textColor || '#000',
                                                                                fontSize: `${overlay.style?.fontSize || 16}px`,
                                                                                fontWeight: overlay.style?.fontWeight || 'normal',
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <div
                                                                            style={{
                                                                                color: overlay.style?.textColor || '#000',
                                                                                fontSize: `${overlay.style?.fontSize || 16}px`,
                                                                                fontWeight: overlay.style?.fontWeight || 'normal',
                                                                            }}
                                                                        >
                                                                            {overlay.content}
                                                                        </div>
                                                                    )
                                                                )}
                                                                {/* 選択時の削除ボタン */}
                                                                {selectedOverlayId === overlay.id && selectedOverlaySectionId === String(section.id) && !editingOverlayId && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSections(prev => prev.map(s =>
                                                                                s.id === section.id
                                                                                    ? {
                                                                                        ...s,
                                                                                        config: {
                                                                                            ...s.config,
                                                                                            overlays: s.config?.overlays?.filter((o: any) => o.id !== overlay.id)
                                                                                        }
                                                                                    }
                                                                                    : s
                                                                            ));
                                                                            setSelectedOverlayId(null);
                                                                            toast.success('オーバーレイを削除しました');
                                                                        }}
                                                                        className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {/* 一括再生成モード選択インジケーター */}
                                                        {batchRegenerateMode && (
                                                            <>
                                                                {/* 参照セクションバッジ */}
                                                                {batchReferenceSection === section.id && (
                                                                    <div className="absolute top-3 left-3 z-20 px-3 py-1.5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg">
                                                                        <Palette className="h-3.5 w-3.5" />
                                                                        参照スタイル
                                                                    </div>
                                                                )}
                                                                {/* 対象セクションバッジ */}
                                                                {batchReferenceSection !== section.id && (
                                                                    <div className={clsx(
                                                                        "absolute top-3 left-3 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                                                        selectedSectionsForRegenerate.has(section.id)
                                                                            ? "bg-orange-500 text-white"
                                                                            : "bg-white/90 text-gray-400 border-2 border-gray-300"
                                                                    )}>
                                                                        {selectedSectionsForRegenerate.has(section.id) ? (
                                                                            <Check className="h-5 w-5" />
                                                                        ) : (
                                                                            <span className="text-xs font-bold">{sectionIndex + 1}</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {/* 参照として設定ボタン（右上） */}
                                                                {batchReferenceSection !== section.id && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            // 参照セクションに設定し、対象リストから除外
                                                                            console.log('Setting reference section:', section.id);
                                                                            setBatchReferenceSection(section.id);
                                                                            setSelectedSectionsForRegenerate(prev => {
                                                                                const next = new Set(prev);
                                                                                next.delete(section.id);
                                                                                return next;
                                                                            });
                                                                        }}
                                                                        className="absolute top-3 right-3 z-20 px-2 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold transition-all flex items-center gap-1 shadow-lg"
                                                                        title="このセクションのスタイルを参照として使用"
                                                                    >
                                                                        <Palette className="h-3 w-3" />
                                                                        参照に設定
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        {/* 背景色統一モード選択インジケーター */}
                                                        {backgroundUnifyMode && (
                                                            <div className={clsx(
                                                                "absolute top-3 left-3 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                                                selectedSectionsForBackgroundUnify.has(section.id)
                                                                    ? "bg-amber-500 text-white"
                                                                    : "bg-white/90 text-gray-400 border-2 border-gray-300"
                                                            )}>
                                                                {selectedSectionsForBackgroundUnify.has(section.id) ? (
                                                                    <Check className="h-5 w-5" />
                                                                ) : (
                                                                    <span className="text-xs font-bold">{sectionIndex + 1}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {/* アセットドラッグ中のオーバーレイ追加インジケーター */}
                                                        {isDraggingAsset && dragOverSectionId === `overlay-${section.id}` && (
                                                            <div className="absolute inset-0 z-30 bg-cyan-500/30 flex items-center justify-center pointer-events-none">
                                                                <div className="bg-cyan-600 text-white px-6 py-3 rounded-xl shadow-xl font-bold text-lg flex items-center gap-2">
                                                                    <Layers className="h-5 w-5" />
                                                                    ここにドロップしてオーバーレイ追加
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* セクション削除モード選択インジケーター */}
                                                        {sectionDeleteMode && (
                                                            <div className={clsx(
                                                                "absolute top-3 left-3 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                                                selectedSectionsForDelete.has(section.id)
                                                                    ? "bg-red-500 text-white"
                                                                    : "bg-white/90 text-gray-400 border-2 border-gray-300"
                                                            )}>
                                                                {selectedSectionsForDelete.has(section.id) ? (
                                                                    <Check className="h-5 w-5" />
                                                                ) : (
                                                                    <span className="text-xs font-bold">{sectionIndex + 1}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {/* ホバーオーバーレイ */}
                                                        <div className={clsx(
                                                            "absolute inset-0 transition-all duration-200 flex items-center justify-center",
                                                            sectionDeleteMode
                                                                ? selectedSectionsForDelete.has(section.id) ? "bg-red-500/20" : "bg-black/0 hover:bg-red-500/10"
                                                                : batchRegenerateMode
                                                                    ? selectedSectionsForRegenerate.has(section.id) ? "bg-orange-500/20" : "bg-black/0 hover:bg-orange-500/10"
                                                                    : backgroundUnifyMode
                                                                        ? selectedSectionsForBackgroundUnify.has(section.id) ? "bg-amber-500/20" : "bg-black/0 hover:bg-amber-500/10"
                                                                        : "bg-black/0 group-hover:bg-black/30"
                                                        )}>
                                                            {/* セクション番号表示（選択モード以外） */}
                                                            {!batchRegenerateMode && !sectionDeleteMode && !backgroundUnifyMode && (
                                                                <div className="absolute top-3 left-3 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {sectionIndex + 1}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* 履歴ボタン - 常に表示 */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenHistoryPanel(section.id);
                                                            }}
                                                            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-white/90 hover:bg-white text-gray-700 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg transition-all hover:scale-105"
                                                            title="編集履歴"
                                                        >
                                                            <Undo2 className="h-3.5 w-3.5" />
                                                            <span>履歴</span>
                                                        </button>
                                                        {/* 画像ダウンロードボタン */}
                                                        {(viewMode === 'desktop' ? section.image?.filePath : section.mobileImage?.filePath || section.image?.filePath) && (
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    const imageUrl = viewMode === 'mobile' && section.mobileImage?.filePath
                                                                        ? section.mobileImage.filePath
                                                                        : section.image?.filePath;
                                                                    if (!imageUrl) return;

                                                                    try {
                                                                        const response = await fetch(imageUrl);
                                                                        const blob = await response.blob();
                                                                        const url = URL.createObjectURL(blob);
                                                                        const a = document.createElement('a');
                                                                        a.href = url;
                                                                        const extension = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
                                                                        a.download = `section-${sectionIndex + 1}-${viewMode}.${extension}`;
                                                                        document.body.appendChild(a);
                                                                        a.click();
                                                                        document.body.removeChild(a);
                                                                        URL.revokeObjectURL(url);
                                                                        toast.success('画像をダウンロードしました');
                                                                    } catch (error) {
                                                                        console.error('Download error:', error);
                                                                        toast.error('ダウンロードに失敗しました');
                                                                    }
                                                                }}
                                                                className="absolute top-3 right-[4.5rem] z-10 flex items-center gap-1.5 bg-white/90 hover:bg-white text-gray-700 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg transition-all hover:scale-105"
                                                                title="画像をダウンロード"
                                                            >
                                                                <Download className="h-3.5 w-3.5" />
                                                                <span>保存</span>
                                                            </button>
                                                        )}
                                                        {/* ローディングオーバーレイ */}
                                                        {(generatingImageSectionIds.has(section.id) || editingSectionIds.has(section.id) || regeneratingSectionIds.has(section.id)) && (
                                                            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/90 to-indigo-700/90 flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
                                                                {/* パルスリング */}
                                                                <div className="relative">
                                                                    <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                                                                    <div className="relative w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                                                                        <RefreshCw className="h-10 w-10 text-white animate-spin" />
                                                                    </div>
                                                                </div>
                                                                {/* テキスト */}
                                                                <div className="text-center">
                                                                    <p className="text-white text-lg font-bold">
                                                                        {regeneratingSectionIds.has(section.id) ? 'AI再生成中...' :
                                                                            editingSectionIds.has(section.id) ? '編集処理中...' : '生成中...'}
                                                                    </p>
                                                                    <p className="text-white/70 text-sm mt-1">
                                                                        しばらくお待ちください
                                                                    </p>
                                                                </div>
                                                                {/* コスト目安 */}
                                                                {regeneratingSectionIds.has(section.id) && (
                                                                    <div className="bg-white/10 rounded-full px-4 py-1.5">
                                                                        <span className="text-white/80 text-xs">
                                                                            💰 約1〜2円/回
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {/* プログレスバー風アニメーション */}
                                                                <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-white rounded-full animate-progress" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : section.role === 'html-embed' && section.config?.htmlContent ? (
                                                    <div className="relative group/embed">
                                                        {/* 編集ボタン：右下に小さく配置 */}
                                                        <button
                                                            onClick={() => {
                                                                setHtmlEditSectionId(String(section.id));
                                                                setShowHtmlEditModal(true);
                                                            }}
                                                            className="absolute bottom-3 right-3 z-10 opacity-0 group-hover/embed:opacity-100 transition-opacity bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 hover:bg-white"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5 text-gray-600" />
                                                            <span className="text-xs font-medium text-gray-700">編集</span>
                                                        </button>
                                                        <iframe
                                                            srcDoc={(() => {
                                                                const htmlToUse = viewMode === 'mobile' && section.config.mobileHtmlContent
                                                                    ? section.config.mobileHtmlContent
                                                                    : section.config.htmlContent;
                                                                return htmlToUse;
                                                            })()}
                                                            className="w-full border-0 overflow-auto"
                                                            style={{ minHeight: '300px', height: '600px' }}
                                                            sandbox="allow-scripts allow-forms"
                                                            scrolling="yes"
                                                            title={`HTML embed - ${section.config.templateType || 'custom'}`}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="h-48 bg-gray-100 flex items-center justify-center">
                                                        <span className="text-gray-400">画像なし</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 境界選択UI - boundaryFixModeがtrueの時に表示 */}
                                            {boundaryFixMode && sectionIndex < sections.length - 1 && (
                                                <div
                                                    className={clsx(
                                                        "relative h-12 flex items-center justify-center cursor-pointer transition-all",
                                                        selectedBoundaries.has(sectionIndex)
                                                            ? "bg-gray-900"
                                                            : "bg-gray-100 hover:bg-gray-200"
                                                    )}
                                                    onClick={() => {
                                                        setSelectedBoundaries(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(sectionIndex)) {
                                                                next.delete(sectionIndex);
                                                            } else {
                                                                next.add(sectionIndex);
                                                            }
                                                            return next;
                                                        });
                                                    }}
                                                >
                                                    <div className={clsx(
                                                        "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
                                                        selectedBoundaries.has(sectionIndex)
                                                            ? "bg-white/20 text-white"
                                                            : "bg-white shadow-sm text-gray-900"
                                                    )}>
                                                        {selectedBoundaries.has(sectionIndex) ? (
                                                            <>
                                                                <Check className="h-4 w-4" />
                                                                <span className="text-xs font-bold">境界 {sectionIndex + 1} を削除</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Scissors className="h-4 w-4" />
                                                                <span className="text-xs font-medium">境界 {sectionIndex + 1}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* ドロップゾーン（セクション後） */}
                                            {isDraggingAsset && (
                                                <div
                                                    className={clsx(
                                                        "h-16 border-2 border-dashed rounded-lg mx-2 my-1 transition-all flex items-center justify-center",
                                                        dragOverSectionId === `after-${section.id}`
                                                            ? "border-gray-900 bg-gray-50"
                                                            : "border-gray-300 bg-gray-50/50"
                                                    )}
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        setDragOverSectionId(`after-${section.id}`);
                                                    }}
                                                    onDragLeave={() => setDragOverSectionId(null)}
                                                    onDrop={(e) => handleAssetDrop(e, String(section.id))}
                                                >
                                                    <span className="text-xs text-gray-500">
                                                        {`ここにドロップ → ${section.role || `セクション${sectionIndex + 1}`}の後に追加`}
                                                    </span>
                                                </div>
                                            )}

                                            {/* セクション間の挿入ボタン（通常時のみ表示） */}
                                            {!isDraggingAsset && !batchRegenerateMode && !backgroundUnifyMode && (
                                                <div className="relative h-0 group/insert">
                                                    <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 opacity-0 group-hover/insert:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleOpenInsertModal(sectionIndex + 1)}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-full shadow-lg hover:shadow-xl transition-all"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" />
                                                            挿入
                                                        </button>
                                                    </div>
                                                    {/* ホバー検出用の透明な帯 */}
                                                    <div className="absolute left-0 right-0 -top-4 h-8 cursor-pointer" />
                                                </div>
                                            )}
                                        </SortableSectionWrapper>
                                    ))}
                                </SortableContext>
                            </DndContext>

                            {/* 画像追加ボタン（ソースURLがある場合のみ表示） */}
                            {sourceUrl && sections.length > 0 && !batchRegenerateMode && !backgroundUnifyMode && !sectionDeleteMode && (
                                <div className="py-6 border-t border-dashed border-gray-300 mt-4">
                                    <div className="text-center">
                                        <p className="text-xs text-gray-500 mb-3">
                                            現在 {sections.length} セクション
                                        </p>
                                        {isFetchingMoreSections ? (
                                            <div className="flex items-center justify-center gap-2 text-gray-600">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span className="text-sm">{fetchMoreProgress || '取得中...'}</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleFetchMoreSections('desktop')}
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-all"
                                                >
                                                    <Monitor className="h-4 w-4" />
                                                    デスクトップ画像を取得
                                                </button>
                                                <button
                                                    onClick={() => handleFetchMoreSections('mobile')}
                                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-all"
                                                >
                                                    <Smartphone className="h-4 w-4" />
                                                    モバイル画像を取得
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-[10px] text-gray-400 mt-2">
                                            ※ 既存セクションに画像を追加します
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* フッター */}
                    <footer className="bg-gray-900 py-8 text-center text-white">
                        <p className="text-sm opacity-70">&copy; {new Date().getFullYear()} {headerConfig.logoText}. All rights reserved.</p>
                    </footer>
                </div>
            </div>

            {/* 一括再生成モードのフローティングアクションバー */}
            {batchRegenerateMode && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom duration-300">
                    <div className="flex items-center gap-3 bg-white rounded-2xl shadow-2xl border border-gray-200 px-4 py-3">
                        {/* 参照セクション表示 */}
                        {batchReferenceSection && (
                            <>
                                <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                                    <Palette className="h-4 w-4" />
                                    <span>参照:</span>
                                    <div className="w-8 h-8 rounded overflow-hidden border-2 border-blue-400">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={sections.find(s => s.id === batchReferenceSection)?.image?.filePath}
                                            alt="参照"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                </div>
                                <div className="h-6 w-px bg-gray-200" />
                            </>
                        )}
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <RefreshCw className="h-4 w-4 text-gray-900" />
                            <span>対象</span>
                            <span className="bg-gray-100 text-gray-900 px-2 py-0.5 rounded-sm text-xs font-bold">
                                {selectedSectionsForRegenerate.size}件
                            </span>
                        </div>
                        <div className="h-6 w-px bg-gray-200" />
                        <button
                            onClick={() => {
                                // 全選択/全解除（画像があるセクションのみ、参照以外）
                                const allSectionIds = sections
                                    .filter(s => s.image?.filePath && s.id !== batchReferenceSection)
                                    .map(s => s.id);
                                if (selectedSectionsForRegenerate.size === allSectionIds.length) {
                                    setSelectedSectionsForRegenerate(new Set());
                                } else {
                                    setSelectedSectionsForRegenerate(new Set(allSectionIds));
                                }
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            {selectedSectionsForRegenerate.size === sections.filter(s => s.image?.filePath && s.id !== batchReferenceSection).length
                                ? '全解除'
                                : '全選択'}
                        </button>
                        <button
                            onClick={() => {
                                setBatchRegenerateMode(false);
                                setSelectedSectionsForRegenerate(new Set());
                                setBatchReferenceSection(null);
                                setRegenerateReferenceAlso(false);
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={async () => {
                                if (planLimits && !planLimits.canAIGenerate) {
                                    toast.error('有料プランにアップグレードしてご利用ください');
                                    return;
                                }
                                if (selectedSectionsForRegenerate.size > 0) {
                                    // 一括再生成前に自動保存（セクションIDを同期するため）
                                    toast.loading('保存中...', { id: 'batch-save' });
                                    await handleSave();
                                    toast.dismiss('batch-save');
                                    console.log('Opening modal with reference section:', batchReferenceSection);
                                    setShowBatchRegenerateModal(true);
                                }
                            }}
                            disabled={selectedSectionsForRegenerate.size === 0 || isSaving}
                            className="px-4 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-sm hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            再生成実行
                        </button>
                    </div>
                </div>
            )}

            {/* 背景色統一モード: フローティングアクションバー */}
            {backgroundUnifyMode && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                    <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-2xl shadow-2xl border border-gray-200">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <Palette className="h-4 w-4 text-gray-900" />
                            <span>背景色統一</span>
                            <span className="bg-gray-100 text-gray-900 px-2 py-0.5 rounded-sm text-xs font-bold">
                                {selectedSectionsForBackgroundUnify.size}件
                            </span>
                        </div>
                        <div className="h-6 w-px bg-gray-200" />
                        <button
                            onClick={() => {
                                const allSectionIds = sections
                                    .filter(s => s.image?.filePath)
                                    .map(s => s.id);
                                if (selectedSectionsForBackgroundUnify.size === allSectionIds.length) {
                                    setSelectedSectionsForBackgroundUnify(new Set());
                                } else {
                                    setSelectedSectionsForBackgroundUnify(new Set(allSectionIds));
                                }
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            {selectedSectionsForBackgroundUnify.size === sections.filter(s => s.image?.filePath).length
                                ? '全解除'
                                : '全選択'}
                        </button>
                        <button
                            onClick={() => {
                                setBackgroundUnifyMode(false);
                                setSelectedSectionsForBackgroundUnify(new Set());
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={() => {
                                if (planLimits && !planLimits.canAIGenerate) {
                                    toast.error('AI機能は有料プランのみご利用いただけます');
                                    return;
                                }
                                if (selectedSectionsForBackgroundUnify.size > 0) {
                                    setShowBackgroundUnifyModal(true);
                                }
                            }}
                            disabled={selectedSectionsForBackgroundUnify.size === 0}
                            className="px-4 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-sm hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                            <Palette className="h-3.5 w-3.5" />
                            背景色を変更
                        </button>
                    </div>
                </div>
            )}

            {/* セクション削除モード: フローティングアクションバー */}
            {sectionDeleteMode && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom duration-300" style={{ transform: 'translateX(calc(-50% - 180px))' }}>
                    <div className="flex items-center gap-3 bg-white rounded-2xl shadow-2xl border border-gray-200 px-5 py-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <Trash2 className="h-4 w-4 text-red-500" />
                            <span>セクション削除</span>
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                {selectedSectionsForDelete.size}件選択
                            </span>
                        </div>
                        <div className="h-6 w-px bg-gray-200" />
                        <button
                            onClick={() => {
                                // 全選択/全解除
                                if (selectedSectionsForDelete.size === sections.length) {
                                    setSelectedSectionsForDelete(new Set());
                                } else {
                                    setSelectedSectionsForDelete(new Set(sections.map(s => s.id)));
                                }
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            {selectedSectionsForDelete.size === sections.length ? '全解除' : '全選択'}
                        </button>
                        <button
                            onClick={() => {
                                // 画像なしセクションを選択
                                const noImageSections = sections.filter(s => !s.image?.filePath);
                                if (noImageSections.length === 0) {
                                    toast('画像なしのセクションはありません');
                                    return;
                                }
                                setSelectedSectionsForDelete(new Set(noImageSections.map(s => s.id)));
                                toast.success(`${noImageSections.length}件の画像なしセクションを選択しました`);
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                        >
                            画像なしを選択
                        </button>
                        <button
                            onClick={() => {
                                setSectionDeleteMode(false);
                                setSelectedSectionsForDelete(new Set());
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={() => {
                                if (selectedSectionsForDelete.size > 0) {
                                    if (confirm(`${selectedSectionsForDelete.size}件のセクションを削除しますか？`)) {
                                        setSections(prev => prev.filter(s => !selectedSectionsForDelete.has(s.id)));
                                        toast.success(`${selectedSectionsForDelete.size}件のセクションを削除しました`);
                                        setSectionDeleteMode(false);
                                        setSelectedSectionsForDelete(new Set());
                                    }
                                }
                            }}
                            disabled={selectedSectionsForDelete.size === 0}
                            className="px-4 py-1.5 bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-bold rounded-lg hover:from-red-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            削除実行
                        </button>
                    </div>
                </div>
            )}

            {/* 編集履歴パネル */}
            {showHistoryPanel && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
                    <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Undo2 className="h-5 w-5 text-gray-500" />
                                    編集履歴
                                </h3>
                                <button
                                    onClick={() => setShowHistoryPanel(null)}
                                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">戻したいバージョンをクリックしてください</p>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {isLoadingHistory ? (
                                <div className="flex items-center justify-center py-12">
                                    <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
                                </div>
                            ) : (
                                <>
                                    {/* クライアント側の一時履歴 */}
                                    {editHistory[showHistoryPanel]?.length > 0 && (
                                        <div className="mb-6">
                                            <h4 className="text-sm font-bold text-gray-600 mb-3">今回のセッション</h4>
                                            <div className="grid grid-cols-4 gap-3">
                                                {editHistory[showHistoryPanel].map((item, index) => (
                                                    <button
                                                        key={`local-${index}`}
                                                        onClick={() => handleRestoreVersion(showHistoryPanel, index)}
                                                        className="group relative aspect-[9/16] bg-gray-100 rounded-sm overflow-hidden border-2 border-transparent hover:border-gray-400 transition-all"
                                                    >
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={item.image.filePath}
                                                            alt={`バージョン ${index + 1}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                                            <span className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 px-2 py-1 rounded-full text-[10px] font-bold transition-opacity">
                                                                戻す
                                                            </span>
                                                        </div>
                                                        <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                                                            <span className="bg-gray-900 text-white px-1.5 py-0.5 rounded-sm text-[9px] font-bold">
                                                                一時
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* サーバー側の永続履歴（編集ログ形式） */}
                                    {serverHistory.length > 0 ? (
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-sm font-bold text-gray-600">📝 編集ログ</h4>
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                                    {serverHistory.length}件
                                                </span>
                                            </div>
                                            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                                                {serverHistory.map((item, index) => (
                                                    <div
                                                        key={`server-${item.id}`}
                                                        className="bg-gray-50 rounded-xl p-3 border border-gray-200"
                                                    >
                                                        {/* ヘッダー：編集タイプと日時 */}
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className={`px-2 py-1 rounded-sm text-xs font-bold ${item.actionType === 'design-unify' ? 'bg-gray-100 text-gray-900' :
                                                                item.actionType === 'background-unify' ? 'bg-gray-100 text-gray-900' :
                                                                    item.actionType === 'inpaint' ? 'bg-gray-100 text-gray-900' :
                                                                        item.actionType === 'regenerate' ? 'bg-gray-100 text-gray-900' :
                                                                            item.actionType === 'regenerate-heavy-mobile' ? 'bg-gray-100 text-gray-900' :
                                                                                item.actionType === 'restore-canvas' ? 'bg-gray-100 text-gray-900' :
                                                                                    item.actionType === 'boundary-design' ? 'bg-gray-100 text-gray-900' :
                                                                                        item.actionType === 'revert' ? 'bg-gray-100 text-gray-900' :
                                                                                            'bg-gray-100 text-gray-900'
                                                                }`}>
                                                                {item.actionType === 'design-unify' ? 'デザイン統一' :
                                                                    item.actionType === 'background-unify' ? '背景色統一' :
                                                                        item.actionType === 'inpaint' ? 'AI編集' :
                                                                            item.actionType === 'regenerate' ? '再生成' :
                                                                                item.actionType === 'regenerate-heavy-mobile' ? 'モバイル再生成' :
                                                                                    item.actionType === 'restore-canvas' ? 'キャンバス復元' :
                                                                                        item.actionType === 'boundary-design' ? '境界デザイン' :
                                                                                            item.actionType === 'revert' ? '↩️ 復元' :
                                                                                                item.actionType?.replace(/-/g, ' ') || '変更'}
                                                            </span>
                                                            <span className="text-xs text-gray-500" suppressHydrationWarning>
                                                                {new Date(item.createdAt).toLocaleString('ja-JP', {
                                                                    month: 'numeric',
                                                                    day: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </span>
                                                        </div>

                                                        {/* プロンプト（あれば） */}
                                                        {item.prompt && (
                                                            <div className="mb-2 p-2 bg-white rounded-lg border border-gray-100">
                                                                <p className="text-xs text-gray-600 line-clamp-2">
                                                                    💬 {item.prompt}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* 画像プレビュー（Before → After） */}
                                                        <div className="flex items-center gap-2">
                                                            {/* Before */}
                                                            <button
                                                                onClick={() => handleRestoreFromServer(
                                                                    showHistoryPanel,
                                                                    item.previousImageId,
                                                                    item.previousImage?.filePath
                                                                )}
                                                                className="flex-1 group relative aspect-[9/16] max-h-24 bg-gray-200 rounded-sm overflow-hidden border-2 border-gray-300 hover:border-gray-500 transition-all"
                                                            >
                                                                {item.previousImage?.filePath && (
                                                                    /* eslint-disable-next-line @next/next/no-img-element */
                                                                    <img
                                                                        src={item.previousImage.filePath}
                                                                        alt="変更前"
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                )}
                                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                                                    <span className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                                                        戻す
                                                                    </span>
                                                                </div>
                                                                <span className="absolute bottom-0.5 left-0.5 bg-gray-500 text-white px-1 py-0.5 rounded-sm text-[8px] font-bold">
                                                                    前
                                                                </span>
                                                            </button>

                                                            {/* Arrow */}
                                                            <span className="text-gray-400 text-lg">→</span>

                                                            {/* After */}
                                                            <button
                                                                onClick={() => handleRestoreFromServer(
                                                                    showHistoryPanel,
                                                                    item.newImageId,
                                                                    item.newImage?.filePath
                                                                )}
                                                                className="flex-1 group relative aspect-[9/16] max-h-24 bg-gray-200 rounded-sm overflow-hidden border-2 border-gray-900 hover:border-blue-500 transition-all"
                                                            >
                                                                {item.newImage?.filePath && (
                                                                    /* eslint-disable-next-line @next/next/no-img-element */
                                                                    <img
                                                                        src={item.newImage.filePath}
                                                                        alt="変更後"
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                )}
                                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                                                    <span className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                                                        戻す
                                                                    </span>
                                                                </div>
                                                                <span className="absolute bottom-0.5 left-0.5 bg-gray-600 text-white px-1 py-0.5 rounded text-[8px] font-bold">
                                                                    後
                                                                </span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* 元のインポート画像 */}
                                    {originalImages.length > 0 && (
                                        <div className="mt-6 pt-6 border-t border-gray-200">
                                            <h4 className="text-sm font-bold text-gray-600 mb-3">📁 元のインポート画像</h4>
                                            <div className="grid grid-cols-4 gap-3">
                                                {originalImages.map((img) => (
                                                    <button
                                                        key={`original-${img.id}`}
                                                        onClick={() => handleRestoreFromServer(
                                                            showHistoryPanel,
                                                            img.id,
                                                            img.filePath
                                                        )}
                                                        className="group relative aspect-[9/16] bg-gray-100 rounded-sm overflow-hidden border-2 border-transparent hover:border-gray-400 transition-all"
                                                    >
                                                        {img.filePath && (
                                                            /* eslint-disable-next-line @next/next/no-img-element */
                                                            <img
                                                                src={img.filePath}
                                                                alt={`元画像 ${img.id}`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        )}
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                                            <span className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 px-2 py-1 rounded-full text-[10px] font-bold transition-opacity">
                                                                戻す
                                                            </span>
                                                        </div>
                                                        <div className="absolute bottom-1 left-1 right-1">
                                                            <span className="bg-gray-600 text-white px-1.5 py-0.5 rounded-sm text-[9px] font-bold">
                                                                {img.sourceType === 'dual-import-desktop' ? 'インポート' :
                                                                    img.sourceType === 'restyle-edit' ? 'リスタイル' : '元画像'}
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 履歴がない場合 */}
                                    {!editHistory[showHistoryPanel]?.length && serverHistory.length === 0 && originalImages.length === 0 && (
                                        <div className="text-center py-12 text-gray-500">
                                            <Undo2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                            <p>履歴がありません</p>
                                            <p className="text-sm text-gray-400 mt-1">編集を行うと履歴が保存されます</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* フルスクリーンプレビューモーダル */}
            {showDesktopPreview && (
                <div className="fixed inset-0 z-[100] bg-gray-900">
                    {/* ヘッダー */}
                    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-gray-900 to-transparent">
                        <div className="flex items-center gap-3">
                            {viewMode === 'desktop' ? (
                                <Monitor className="h-5 w-5 text-white" />
                            ) : (
                                <Smartphone className="h-5 w-5 text-white" />
                            )}
                            <span className="text-white font-bold">
                                {viewMode === 'desktop' ? 'デスクトップ' : 'モバイル'}プレビュー
                            </span>
                            <span className="text-gray-400 text-sm">（実際の表示サイズ）</span>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* 表示切り替えトグル */}
                            <div className="flex items-center bg-white/10 rounded-lg p-0.5">
                                <button
                                    onClick={() => setViewMode('desktop')}
                                    className={clsx(
                                        "p-2 rounded-md transition-all",
                                        viewMode === 'desktop'
                                            ? "bg-white text-gray-900"
                                            : "text-white/60 hover:text-white"
                                    )}
                                >
                                    <Monitor className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('mobile')}
                                    className={clsx(
                                        "p-2 rounded-md transition-all",
                                        viewMode === 'mobile'
                                            ? "bg-white text-gray-900"
                                            : "text-white/60 hover:text-white"
                                    )}
                                >
                                    <Smartphone className="h-4 w-4" />
                                </button>
                            </div>
                            <button
                                onClick={() => setShowDesktopPreview(false)}
                                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    {/* プレビューコンテンツ */}
                    <div className="h-full overflow-y-auto pt-16 pb-8 flex justify-center">
                        <div className={clsx(
                            "bg-white shadow-2xl transition-all",
                            viewMode === 'desktop' ? "w-full max-w-[1440px]" : "w-[390px]"
                        )}>
                            {sections.filter(s => viewMode === 'desktop' ? s.image?.filePath : (s.mobileImage?.filePath || s.image?.filePath)).map((section, index) => (
                                <div key={section.id} className="relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={viewMode === 'mobile' && section.mobileImage?.filePath
                                            ? section.mobileImage.filePath
                                            : section.image?.filePath}
                                        alt={`セクション ${index + 1}`}
                                        className="w-full h-auto"
                                        style={{ display: 'block' }}
                                    />
                                    {/* セクション番号バッジ */}
                                    <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1.5 rounded-full text-sm font-bold">
                                        Section {index + 1}
                                    </div>
                                    {/* モバイル画像なし警告 */}
                                    {viewMode === 'mobile' && !section.mobileImage?.filePath && (
                                        <div className="absolute top-4 right-4 bg-yellow-500 text-white px-3 py-1.5 rounded-full text-xs font-bold">
                                            Desktop画像を表示中
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* フッター情報 */}
                    {viewMode === 'mobile' ? (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 p-1.5 bg-gray-900/90 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-white/10 animate-in slide-in-from-bottom-4">
                            <div className="flex items-center gap-2 pl-3 pr-4 border-r border-white/20">
                                <Smartphone className="h-4 w-4 text-white" />
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold leading-none">Mobile Preview</span>
                                    <span className="text-[9px] text-gray-400 leading-none mt-0.5">390px</span>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    if (planLimits && !planLimits.canAIGenerate) {
                                        toast.error('有料プランにアップグレードしてご利用ください');
                                        return;
                                    }
                                    setShowMobileOptimizeModal(true);
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all group ${planLimits?.canAIGenerate === false ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/20'}`}
                            >
                                <Sparkles className="h-4 w-4 text-yellow-400 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-bold">一括最適化</span>
                            </button>

                            <div className="w-px h-6 bg-white/20 mx-1" />

                            <button
                                onClick={() => setViewMode('desktop')}
                                className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white/70 hover:text-white"
                                title="デスクトップに戻る"
                            >
                                <Monitor className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-4 py-4 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none">
                            <span className="text-gray-400 text-sm">
                                {sections.filter(s => s.image?.filePath).length} セクション
                            </span>
                            <span className="text-gray-600">•</span>
                            <span className="text-gray-400 text-sm">
                                最大幅: 1440px
                            </span>
                            <span className="text-gray-600">•</span>
                            <span className="text-gray-400 text-sm">
                                ESC キーで閉じる
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Hidden Input for Section Image Update */}
            <input
                id="section-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => editingSectionId && handleSectionImageChange(editingSectionId, e)}
            />

            {/* Section AI Modal */}
            {showSectionAIModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6">
                    <div className="w-full max-w-lg overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in zoom-in duration-300">
                        <div className="p-8">
                            <h3 className="text-xl font-black text-gray-900 mb-2"><span>セクション画像を生成</span></h3>
                            <p className="text-sm text-gray-500 mb-6 font-medium"><span>どのような要素の画像を生成しますか？</span></p>

                            <textarea
                                value={sectionAIPrompt}
                                onChange={(e) => setSectionAIPrompt(e.target.value)}
                                className="w-full min-h-[120px] rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all shadow-inner"
                                placeholder="例: 幸せそうにコーヒーを飲む女性のポートレート"
                            />

                            <div className="mt-8 flex gap-3">
                                <button
                                    onClick={() => setShowSectionAIModal(false)}
                                    className="flex-1 rounded-2xl py-3.5 text-sm font-bold text-gray-400 hover:bg-gray-50 transition-all font-black uppercase tracking-widest"
                                >
                                    <span>キャンセル</span>
                                </button>
                                <button
                                    onClick={generateSectionImage}
                                    disabled={isGeneratingSectionImage || !sectionAIPrompt}
                                    className="flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-black text-white shadow-xl shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 transition-all"
                                >
                                    {isGeneratingSectionImage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    <span>画像を生成</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 画像編集モーダル (Nano Banana Pro) */}
            {showEditImageModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6">
                    <div className="w-full max-w-lg overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in zoom-in duration-300">
                        <div className="p-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-sm bg-gray-100 flex items-center justify-center">
                                    <PenTool className="h-5 w-5 text-gray-900" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900"><span>画像を編集</span></h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest"><span>Nano Banana エンジン</span></p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 mb-6 font-medium">
                                <span>元の画像のレイアウトを維持しながら、新しい商材/サービス用にリブランディングします。</span>
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        <span>編集指示（詳細なほど良い結果に）</span>
                                    </label>
                                    <textarea
                                        value={editImagePrompt}
                                        onChange={(e) => setEditImagePrompt(e.target.value)}
                                        className="w-full min-h-[150px] rounded-sm border border-gray-200 bg-gray-50 p-4 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-gray-200 transition-all shadow-inner text-gray-900"
                                        placeholder="例: この電力会社のLPを、熱々の冷凍餃子の販促用に作り変えてください。ターゲットは主婦層で、シズル感を重視。色味はオレンジ系の暖色で。"
                                    />
                                </div>

                                {aiProductInfo && (
                                    <div className="rounded-sm bg-gray-50 p-3 border border-gray-200">
                                        <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest mb-1">
                                            <span>プロモーション情報（自動適用）</span>
                                        </p>
                                        <p className="text-xs text-gray-600 line-clamp-2">{aiProductInfo}</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button
                                    onClick={() => setShowEditImageModal(false)}
                                    className="flex-1 rounded-2xl py-3.5 text-sm font-bold text-gray-400 hover:bg-gray-50 transition-all font-black uppercase tracking-widest"
                                >
                                    <span>キャンセル</span>
                                </button>
                                <button
                                    onClick={handleEditImage}
                                    disabled={isEditingImage || !editImagePrompt}
                                    className="flex-[2] flex items-center justify-center gap-2 rounded-sm bg-gray-900 py-3.5 text-sm font-black text-white hover:bg-gray-800 disabled:opacity-50 transition-all"
                                >
                                    {isEditingImage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PenTool className="h-4 w-4" />}
                                    <span>{isEditingImage ? '編集中...' : '画像を編集'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* モバイル用オーバーレイ */}
            {showMobileMenu && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/40 z-[45] backdrop-blur-sm"
                    onClick={() => setShowMobileMenu(false)}
                />
            )}

            {/* 右サイドバー - 編集メニュー */}
            <div className={clsx(
                "fixed right-0 top-0 h-full w-[300px] sm:w-[320px] bg-white border-l border-gray-200 z-[46] flex flex-col font-sans transition-transform duration-300",
                "lg:translate-x-0",
                showMobileMenu ? "translate-x-0" : "translate-x-full lg:translate-x-0"
            )}>
                {/* ヘッダー */}
                <div className="border-b border-gray-100 bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3 p-4 sm:p-5">
                        <div className="bg-gray-100 p-2 rounded-lg text-gray-700">
                            <PenTool className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <span className="text-base font-bold text-gray-900 block">編集メニュー</span>
                            <span className="text-xs text-gray-500">Page Actions</span>
                        </div>
                        <button
                            onClick={() => setShowMobileMenu(false)}
                            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    {/* 検索ボックス */}
                    <div className="px-4 sm:px-5 pb-3">
                        <EditorMenuSearch
                            value={menuSearch}
                            onChange={setMenuSearch}
                            placeholder="機能を検索..."
                        />
                    </div>
                </div>

                {/* メニュー */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-5 sm:space-y-6 pb-24 lg:pb-4">
                    {/* 基本操作 */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                            <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">基本操作</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {/* チュートリアル */}
                            <button
                                onClick={() => setShowTutorialModal(true)}
                                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-violet-50 text-violet-700 text-xs font-medium border border-violet-200 hover:border-violet-300 hover:bg-violet-100 transition-all min-h-[40px]"
                            >
                                <HelpCircle className="h-3.5 w-3.5" />
                                使い方
                            </button>
                            {/* 画像追加 */}
                            <button
                                onClick={() => document.getElementById('file-upload-input')?.click()}
                                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-white text-gray-600 text-xs font-medium border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all min-h-[40px]"
                            >
                                <Plus className="h-3.5 w-3.5 text-gray-400" />
                                画像追加
                            </button>
                            {/* プレビュー */}
                            <Link
                                href={`/p/${initialSlug || pageId}`}
                                target="_blank"
                                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-white text-gray-600 text-xs font-medium border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all min-h-[40px]"
                            >
                                <Eye className="h-3.5 w-3.5 text-gray-400" />
                                プレビュー
                            </Link>
                            {/* ダウンロード */}
                            <button
                                onClick={handleExport}
                                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-white text-gray-600 text-xs font-medium border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all min-h-[40px]"
                            >
                                <Download className="h-3.5 w-3.5 text-gray-400" />
                                ZIP出力
                            </button>
                            {/* PDF出力 */}
                            <button
                                onClick={handleExportPdf}
                                disabled={isExportingPdf}
                                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-white text-gray-600 text-xs font-medium border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px]"
                            >
                                {isExportingPdf ? (
                                    <Loader2 className="h-3.5 w-3.5 text-gray-400 animate-spin" />
                                ) : (
                                    <FileText className="h-3.5 w-3.5 text-gray-400" />
                                )}
                                PDF出力
                            </button>
                        </div>

                        {/* デプロイ - Premium standalone button */}
                        <button
                            onClick={() => {
                                if (planLimits && !planLimits.canAIGenerate) {
                                    toast.error('ページ公開は有料プランでご利用いただけます');
                                    return;
                                }
                                if (pageId === 'new') {
                                    toast.error('デプロイする前にページを保存してください。');
                                    return;
                                }
                                setShowPageDeployModal(true);
                            }}
                            className={`group w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all shadow-sm mt-2 ${planLimits?.canAIGenerate === false ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                        >
                            <div className="h-5 w-5 flex items-center justify-center">
                                <Rocket className="h-4 w-4 text-gray-300 group-hover:text-white transition-colors" />
                            </div>
                            <div className="text-left flex-1">
                                <span className="text-sm font-bold block leading-none">ページを公開</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-white transition-colors" />
                        </button>

                        {/* 表示切替 */}
                        <div className="flex items-center justify-center gap-1 pt-2 border-t border-gray-100">
                            <button
                                onClick={() => setViewMode('desktop')}
                                className={clsx(
                                    "p-1.5 rounded transition-all",
                                    viewMode === 'desktop'
                                        ? "text-gray-900 bg-gray-100"
                                        : "text-gray-400 hover:text-gray-600"
                                )}
                                title="PC表示"
                            >
                                <Monitor className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('mobile')}
                                className={clsx(
                                    "p-1.5 rounded transition-all",
                                    viewMode === 'mobile'
                                        ? "text-gray-900 bg-gray-100"
                                        : "text-gray-400 hover:text-gray-600"
                                )}
                                title="スマホ表示"
                            >
                                <Smartphone className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* ヘッダー設定 */}
                    <EditorMenuSection title="ヘッダー設定" color="purple">
                        <EditorMenuItem
                            icon={<Settings2 className="h-3.5 w-3.5" />}
                            title="ヘッダーを編集"
                            description="ロゴ・ナビ・CTAボタン"
                            tooltip="公開ページのヘッダーを設定できます"
                            open={expandedTools.has('header')}
                            onOpenChange={(open) => {
                                if (open) {
                                    setExpandedTools(prev => new Set([...prev, 'header']));
                                } else {
                                    setExpandedTools(prev => {
                                        const next = new Set(prev);
                                        next.delete('header');
                                        return next;
                                    });
                                }
                            }}
                        >
                            <div className="space-y-3 p-2">
                                {/* ロゴテキスト */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">ロゴテキスト</label>
                                    <input
                                        type="text"
                                        value={headerConfig.logoText || ''}
                                        onChange={(e) => setHeaderConfig((prev: typeof headerConfig) => ({ ...prev, logoText: e.target.value }))}
                                        placeholder="サイト名"
                                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                    />
                                </div>
                                {/* CTAボタン - 横並び */}
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">CTAテキスト</label>
                                        <input
                                            type="text"
                                            value={headerConfig.ctaText || ''}
                                            onChange={(e) => setHeaderConfig((prev: typeof headerConfig) => ({ ...prev, ctaText: e.target.value }))}
                                            placeholder="お問い合わせ"
                                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">リンク先</label>
                                        {(() => {
                                            const ctaVal = headerConfig.ctaLink || '';
                                            const sectionOptions = ['', ...sections.map((s: any) => `#${s.role}`), '#contact'];
                                            const isCustom = ctaVal !== '' && !sectionOptions.includes(ctaVal);
                                            return (
                                                <>
                                                    <select
                                                        value={isCustom ? '__custom__' : ctaVal}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setHeaderConfig((prev: typeof headerConfig) => ({
                                                                ...prev,
                                                                ctaLink: val === '__custom__' ? 'https://' : val
                                                            }));
                                                        }}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                                                    >
                                                        <option value="">選択...</option>
                                                        {sections.map((section: any) => (
                                                            <option key={section.id} value={`#${section.role}`}>
                                                                #{section.role}
                                                            </option>
                                                        ))}
                                                        <option value="#contact">#contact</option>
                                                        <option value="__custom__">カスタムURL</option>
                                                    </select>
                                                    {isCustom && (
                                                        <input
                                                            type="text"
                                                            value={ctaVal}
                                                            onChange={(e) => setHeaderConfig((prev: typeof headerConfig) => ({ ...prev, ctaLink: e.target.value }))}
                                                            placeholder="https://example.com"
                                                            className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                                        />
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                                {/* ナビゲーション - アコーディオン */}
                                <details className="group">
                                    <summary className="flex items-center justify-between cursor-pointer text-xs font-medium text-gray-600 py-1.5 hover:text-purple-600">
                                        <span>ナビゲーション ({headerConfig.navItems?.length || 0}件)</span>
                                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                                    </summary>
                                    <div className="pt-2 space-y-2">
                                        {headerConfig.navItems.map((item: { id: string; label: string; href: string }, index: number) => (
                                            <div key={item.id} className="flex gap-1.5 items-center">
                                                <input
                                                    type="text"
                                                    value={item.label}
                                                    onChange={(e) => {
                                                        const newLabel = e.target.value;
                                                        setHeaderConfig((prev: typeof headerConfig) => ({
                                                            ...prev,
                                                            navItems: prev.navItems.map((navItem: { id: string; label: string; href: string }, i: number) =>
                                                                i === index ? { ...navItem, label: newLabel } : navItem
                                                            )
                                                        }));
                                                    }}
                                                    placeholder="ラベル"
                                                    className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                                                />
                                                {(() => {
                                                    const navVal = item.href || '';
                                                    const navSectionOptions = ['', ...sections.map((s: any) => `#${s.role}`), '#contact'];
                                                    const navIsCustom = navVal !== '' && !navSectionOptions.includes(navVal);
                                                    return (
                                                        <div className="flex flex-col">
                                                            <select
                                                                value={navIsCustom ? '__custom__' : navVal}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    const newHref = val === '__custom__' ? 'https://' : val;
                                                                    setHeaderConfig((prev: typeof headerConfig) => ({
                                                                        ...prev,
                                                                        navItems: prev.navItems.map((navItem: { id: string; label: string; href: string }, i: number) =>
                                                                            i === index ? { ...navItem, href: newHref } : navItem
                                                                        )
                                                                    }));
                                                                }}
                                                                className="w-28 px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500/30 bg-white"
                                                            >
                                                                <option value="">リンク...</option>
                                                                {sections.map((section: any) => (
                                                                    <option key={section.id} value={`#${section.role}`}>
                                                                        #{section.role}
                                                                    </option>
                                                                ))}
                                                                <option value="#contact">#contact</option>
                                                                <option value="__custom__">カスタムURL</option>
                                                            </select>
                                                            {navIsCustom && (
                                                                <input
                                                                    type="text"
                                                                    value={navVal}
                                                                    onChange={(e) => {
                                                                        const newHref = e.target.value;
                                                                        setHeaderConfig((prev: typeof headerConfig) => ({
                                                                            ...prev,
                                                                            navItems: prev.navItems.map((navItem: { id: string; label: string; href: string }, i: number) =>
                                                                                i === index ? { ...navItem, href: newHref } : navItem
                                                                            )
                                                                        }));
                                                                    }}
                                                                    placeholder="https://example.com"
                                                                    className="w-28 mt-1 px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                                                                />
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                                <button
                                                    onClick={() => {
                                                        setHeaderConfig((prev: typeof headerConfig) => ({
                                                            ...prev,
                                                            navItems: prev.navItems.filter((_: { id: string; label: string; href: string }, i: number) => i !== index)
                                                        }));
                                                    }}
                                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => {
                                                setHeaderConfig((prev: typeof headerConfig) => ({
                                                    ...prev,
                                                    navItems: [...(prev.navItems || []), { id: `nav-${Date.now()}`, label: '', href: '' }]
                                                }));
                                            }}
                                            className="w-full py-1 text-xs text-purple-600 border border-dashed border-purple-300 rounded hover:bg-purple-50 transition-colors"
                                        >
                                            + ナビを追加
                                        </button>
                                    </div>
                                </details>
                                {/* ヘッダー固定設定 */}
                                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                    <input
                                        type="checkbox"
                                        id="header-sticky"
                                        checked={headerConfig.sticky}
                                        onChange={(e) => setHeaderConfig((prev: typeof headerConfig) => ({ ...prev, sticky: e.target.checked }))}
                                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                    />
                                    <label htmlFor="header-sticky" className="text-xs text-gray-600">
                                        スクロール時にヘッダーを固定
                                    </label>
                                </div>
                            </div>
                        </EditorMenuItem>
                    </EditorMenuSection>

                    {/* 見た目を調整する */}
                    {isSectionVisible(['crop', 'resize', 'overlay', 'delete', 'background', 'colorPalette']) && (
                        <EditorMenuSection title="見た目を調整する" color="indigo">
                            {/* 画像を切り取る */}
                            {isMenuItemVisible('crop') && (
                                <EditorMenuItem
                                    icon={<Scissors className="h-3.5 w-3.5" />}
                                    title="画像を切り取る"
                                    description="余白や不要な部分をカット"
                                    tooltip="画像の余白や不要な部分を切り取ります"
                                    open={expandedTools.has('crop')}
                                    onOpenChange={(open) => {
                                        if (open) {
                                            setExpandedTools(prev => new Set([...prev, 'crop']));
                                        } else {
                                            setExpandedTools(prev => {
                                                const next = new Set(prev);
                                                next.delete('crop');
                                                return next;
                                            });
                                        }
                                    }}
                                >
                                    <EditorSectionList
                                        sections={sections}
                                        onSelect={(section) => {
                                            if (section?.image?.filePath) {
                                                setCropSectionId(String(section.id));
                                                setCropImageUrl(section.image.filePath);
                                                setShowCropModal(true);
                                            }
                                        }}
                                    />
                                </EditorMenuItem>
                            )}

                            {/* 画像をリサイズ */}
                            {isMenuItemVisible('resize') && (
                                <EditorMenuItem
                                    icon={<Maximize2 className="h-3.5 w-3.5" />}
                                    title="画像をリサイズ"
                                    description="サイズ変更・アスペクト比変換・AI拡張"
                                    tooltip="クロップ、リサイズ、AIによる画像拡張ができます"
                                    open={expandedTools.has('resize')}
                                    onOpenChange={(open) => {
                                        if (open) {
                                            setExpandedTools(prev => new Set([...prev, 'resize']));
                                        } else {
                                            setExpandedTools(prev => {
                                                const next = new Set(prev);
                                                next.delete('resize');
                                                return next;
                                            });
                                        }
                                    }}
                                >
                                    <EditorSectionList
                                        sections={sections}
                                        onSelect={(section) => {
                                            const imageUrl = viewMode === 'mobile' && section.mobileImage?.filePath
                                                ? section.mobileImage.filePath
                                                : section.image?.filePath;
                                            if (imageUrl) {
                                                setResizeSectionId(String(section.id));
                                                setResizeImageUrl(imageUrl);
                                                setShowResizeModal(true);
                                            }
                                        }}
                                    />
                                </EditorMenuItem>
                            )}

                            {/* ボタン・文字を重ねる */}
                            {isMenuItemVisible('overlay') && (
                                <EditorMenuItem
                                    icon={<Layers className="h-3.5 w-3.5" />}
                                    title="ボタン・文字を重ねる"
                                    description="画像の上に追加できます"
                                    tooltip="テキストやボタンを画像に重ねられます"
                                    open={expandedTools.has('overlay')}
                                    onOpenChange={(open) => {
                                        if (open) {
                                            setExpandedTools(prev => new Set([...prev, 'overlay']));
                                        } else {
                                            setExpandedTools(prev => {
                                                const next = new Set(prev);
                                                next.delete('overlay');
                                                return next;
                                            });
                                        }
                                    }}
                                >
                                    <EditorSectionList
                                        sections={sections}
                                        showOverlayCount
                                        onSelect={(section) => {
                                            const imageUrl = viewMode === 'mobile' && section.mobileImage?.filePath
                                                ? section.mobileImage.filePath
                                                : section.image?.filePath;
                                            if (imageUrl) {
                                                setOverlayEditSectionId(String(section.id));
                                                setOverlayEditImageUrl(imageUrl);
                                                setShowOverlayEditor(true);
                                            }
                                        }}
                                    />
                                </EditorMenuItem>
                            )}

                            {/* ブロックを削除 */}
                            {isMenuItemVisible('delete') && (
                                <EditorMenuItem
                                    icon={<Trash2 className="h-3.5 w-3.5" />}
                                    title="ブロックを削除"
                                    description="いらない部分を外す"
                                    tooltip="不要なセクションを一括で削除できます"
                                    iconVariant="danger"
                                    open={expandedTools.has('delete')}
                                    onOpenChange={(open) => {
                                        if (open) {
                                            setExpandedTools(prev => new Set([...prev, 'delete']));
                                        } else {
                                            setExpandedTools(prev => {
                                                const next = new Set(prev);
                                                next.delete('delete');
                                                return next;
                                            });
                                        }
                                    }}
                                >
                                    <EditorActionButton
                                        onClick={() => {
                                            setSectionDeleteMode(true);
                                            setBatchRegenerateMode(false);
                                            setBackgroundUnifyMode(false);
                                            setBoundaryFixMode(false);
                                        }}
                                        disabled={sections.length === 0}
                                        icon={<Trash2 className="h-3.5 w-3.5" />}
                                        variant="danger"
                                    >
                                        削除するブロックを選ぶ
                                    </EditorActionButton>
                                    <EditorActionButton
                                        onClick={() => {
                                            const noImageSections = sections.filter(s => !s.image?.filePath);
                                            if (noImageSections.length === 0) {
                                                toast('画像なしのセクションはありません');
                                                return;
                                            }
                                            if (confirm(`${noImageSections.length}件の画像なしセクションを削除しますか？`)) {
                                                setSections(prev => prev.filter(s => s.image?.filePath));
                                                toast.success(`${noImageSections.length}件の画像なしセクションを削除しました`);
                                            }
                                        }}
                                        disabled={sections.filter(s => !s.image?.filePath).length === 0}
                                        icon={<ImageIcon className="h-3.5 w-3.5" />}
                                        variant="danger"
                                    >
                                        画像なしを一括削除
                                    </EditorActionButton>
                                </EditorMenuItem>
                            )}

                            {/* 背景色をそろえる */}
                            {isMenuItemVisible('background') && (
                                <EditorMenuItem
                                    icon={<Palette className="h-3.5 w-3.5" />}
                                    title="背景色をそろえる"
                                    description="全体の背景を同じ色に"
                                    tooltip="選択したブロックの背景色を統一します"
                                    badge={planLimits?.canAIGenerate === false ? <EditorBadge variant="dark"><Crown className="h-2.5 w-2.5" /> Pro</EditorBadge> : undefined}
                                    action={
                                        <EditorActionButton
                                            onClick={() => {
                                                if (planLimits?.canAIGenerate === false) {
                                                    toast.error('有料プランにアップグレードしてご利用ください');
                                                    return;
                                                }
                                                setBackgroundUnifyMode(true);
                                                setBatchRegenerateMode(false);
                                                setBoundaryFixMode(false);
                                            }}
                                            disabled={planLimits?.canAIGenerate === false || sections.filter(s => s.image?.filePath).length === 0}
                                        >
                                            {planLimits?.canAIGenerate === false ? 'アップグレード' : 'ブロックを選ぶ'}
                                        </EditorActionButton>
                                    }
                                />
                            )}

                            {/* 色の組み合わせ */}
                            {isMenuItemVisible('colorPalette') && (
                                <EditorMenuItem
                                    icon={<Droplet className="h-3.5 w-3.5" />}
                                    title="色の組み合わせ"
                                    description="ページ全体の色を選ぶ"
                                    tooltip="ページ全体の配色テーマを変更できます"
                                    badge={planLimits?.canAIGenerate === false ? <EditorBadge variant="dark"><Crown className="h-2.5 w-2.5" /> Pro</EditorBadge> : undefined}
                                    action={planLimits?.canAIGenerate === false ? (
                                        <EditorActionButton
                                            onClick={() => toast.error('有料プランにアップグレードしてご利用ください')}
                                            disabled
                                        >
                                            アップグレード
                                        </EditorActionButton>
                                    ) : undefined}
                                    open={planLimits?.canAIGenerate === false ? false : expandedTools.has('color-palette')}
                                    onOpenChange={planLimits?.canAIGenerate === false ? undefined : (open) => {
                                        if (open) {
                                            setExpandedTools(prev => new Set([...prev, 'color-palette']));
                                        } else {
                                            setExpandedTools(prev => {
                                                const next = new Set(prev);
                                                next.delete('color-palette');
                                                return next;
                                            });
                                        }
                                    }}
                                >
                                    {planLimits?.canAIGenerate !== false && (
                                        <EditorActionButton onClick={() => setShowColorPaletteModal(true)}>
                                            色を選ぶ
                                        </EditorActionButton>
                                    )}
                                </EditorMenuItem>
                            )}
                        </EditorMenuSection>
                    )}

                    {/* 内容を編集する */}
                    {isSectionVisible(['copyEdit', 'cta']) && (
                        <EditorMenuSection title="内容を編集する" color="emerald">
                            {/* 文字を修正 - AI画像編集と同じUIで領域選択 */}
                            {isMenuItemVisible('copyEdit') && (
                                <EditorMenuItem
                                    icon={<Type className="h-3.5 w-3.5" />}
                                    title="文字を修正"
                                    description="変更したい部分を囲んで修正"
                                    tooltip="画像上でテキスト領域を選択し、修正します（複数選択OK）"
                                    badge={planLimits?.canAIGenerate === false ? <EditorBadge variant="dark"><Crown className="h-2.5 w-2.5" /> Pro</EditorBadge> : undefined}
                                    action={planLimits?.canAIGenerate === false ? (
                                        <EditorActionButton onClick={() => toast.error('有料プランにアップグレードしてご利用ください')} disabled>
                                            アップグレード
                                        </EditorActionButton>
                                    ) : undefined}
                                    open={planLimits?.canAIGenerate === false ? false : expandedTools.has('copy-edit')}
                                    onOpenChange={planLimits?.canAIGenerate === false ? undefined : (open) => {
                                        if (open) {
                                            setExpandedTools(prev => new Set([...prev, 'copy-edit']));
                                        } else {
                                            setExpandedTools(prev => {
                                                const next = new Set(prev);
                                                next.delete('copy-edit');
                                                return next;
                                            });
                                        }
                                    }}
                                >
                                    {planLimits?.canAIGenerate !== false && (
                                        <EditorSectionList
                                            sections={sections}
                                            onSelect={(section) => {
                                                const imageUrl = viewMode === 'mobile' && section.mobileImage?.filePath
                                                    ? section.mobileImage.filePath
                                                    : section.image?.filePath;
                                                const mobileImageUrl = section.mobileImage?.filePath;
                                                if (imageUrl) {
                                                    handleOpenInpaint(String(section.id), imageUrl, mobileImageUrl, 'text-fix');
                                                }
                                            }}
                                        />
                                    )}
                                </EditorMenuItem>
                            )}

                            {/* ボタンのリンク先 */}
                            {isMenuItemVisible('cta') && (
                                <EditorMenuItem
                                    icon={<MousePointer className="h-3.5 w-3.5" />}
                                    title="ボタンのリンク先"
                                    description="押したときの移動先を変更"
                                    tooltip="CTAボタンのリンク先URLを変更できます"
                                    open={expandedTools.has('cta')}
                                    onOpenChange={(open) => {
                                        if (open) {
                                            setExpandedTools(prev => new Set([...prev, 'cta']));
                                        } else {
                                            setExpandedTools(prev => {
                                                const next = new Set(prev);
                                                next.delete('cta');
                                                return next;
                                            });
                                        }
                                    }}
                                >
                                    <EditorActionButton onClick={() => setShowCTAModal(true)}>
                                        リンク先を変更
                                    </EditorActionButton>
                                </EditorMenuItem>
                            )}
                        </EditorMenuSection>
                    )}

                    {/* もっと魅力的にする（Enterpriseプランのみ） */}
                    {planLimits?.canGenerateVideo && isSectionVisible(['video']) && (
                        <EditorMenuSection title="もっと魅力的にする" color="amber">
                            {/* 動画を埋め込む */}
                            {isMenuItemVisible('video') && (
                                <EditorMenuItem
                                    icon={<Video className="h-3.5 w-3.5" />}
                                    title="動画を埋め込む"
                                    description="YouTube等の動画を追加"
                                    badge={<EditorBadge variant="dark">Enterprise</EditorBadge>}
                                    tooltip="YouTubeやVimeoの動画を埋め込めます"
                                    open={expandedTools.has('video')}
                                    onOpenChange={(open) => {
                                        if (open) {
                                            setExpandedTools(prev => new Set([...prev, 'video']));
                                        } else {
                                            setExpandedTools(prev => {
                                                const next = new Set(prev);
                                                next.delete('video');
                                                return next;
                                            });
                                        }
                                    }}
                                >
                                    <EditorActionButton onClick={() => setShowVideoModal(true)} variant="primary">
                                        動画を追加
                                    </EditorActionButton>
                                </EditorMenuItem>
                            )}
                        </EditorMenuSection>
                    )}

                    {/* 別の用途で使う */}
                    {isSectionVisible(['thumbnail', 'document']) && (
                        <EditorMenuSection title="別の用途で使う" color="purple">
                            {/* サムネイル用に変換 */}
                            {isMenuItemVisible('thumbnail') && (
                                <EditorMenuItem
                                    icon={<ImageIcon className="h-3.5 w-3.5" />}
                                    title="サムネイル用に変換"
                                    description="参考サムネイルを元に変換"
                                    tooltip="LPをYouTubeサムネイル風に変換します"
                                    badge={planLimits?.canAIGenerate === false ? <EditorBadge variant="dark"><Crown className="h-2.5 w-2.5" /> Pro</EditorBadge> : undefined}
                                    action={
                                        <EditorActionButton
                                            onClick={() => {
                                                if (planLimits?.canAIGenerate === false) {
                                                    toast.error('有料プランにアップグレードしてご利用ください');
                                                    return;
                                                }
                                                setShowThumbnailModal(true);
                                            }}
                                            disabled={planLimits?.canAIGenerate === false}
                                        >
                                            {planLimits?.canAIGenerate === false ? 'アップグレード' : '変換を開始'}
                                        </EditorActionButton>
                                    }
                                />
                            )}

                            {/* 資料にする */}
                            {isMenuItemVisible('document') && (
                                <EditorMenuItem
                                    icon={<FileText className="h-3.5 w-3.5" />}
                                    title="資料にする"
                                    description="スライド風の資料を作成"
                                    tooltip="LPをプレゼン資料形式に変換します"
                                    badge={planLimits?.canAIGenerate === false ? <EditorBadge variant="dark"><Crown className="h-2.5 w-2.5" /> Pro</EditorBadge> : undefined}
                                    action={
                                        <EditorActionButton
                                            onClick={() => {
                                                if (planLimits?.canAIGenerate === false) {
                                                    toast.error('有料プランにアップグレードしてご利用ください');
                                                    return;
                                                }
                                                setShowDocumentModal(true);
                                            }}
                                            disabled={planLimits?.canAIGenerate === false}
                                        >
                                            {planLimits?.canAIGenerate === false ? 'アップグレード' : '資料を作成'}
                                        </EditorActionButton>
                                    }
                                />
                            )}
                        </EditorMenuSection>
                    )}

                    {/* AIコード生成 */}
                    {isSectionVisible(['claude']) && (
                        <EditorMenuSection title="AIコード生成" color="indigo">
                            {isMenuItemVisible('claude') && (
                                <EditorMenuItem
                                    icon={<Code2 className="h-3.5 w-3.5" />}
                                    title="gemini-codegen"
                                    description="html/css/js"
                                    tooltip="HTML/CSS/JSコードを自動生成します"
                                    iconVariant="dark"
                                    badge={planLimits?.canAIGenerate === false ? <EditorBadge variant="dark"><Crown className="h-2.5 w-2.5" /> Pro</EditorBadge> : <EditorBadge variant="new">NEW</EditorBadge>}
                                    action={
                                        <EditorActionButton
                                            onClick={() => {
                                                if (planLimits?.canAIGenerate === false) {
                                                    toast.error('有料プランにアップグレードしてご利用ください');
                                                    return;
                                                }
                                                setShowClaudeGeneratorModal(true);
                                            }}
                                            variant={planLimits?.canAIGenerate === false ? "default" : "primary"}
                                            disabled={planLimits?.canAIGenerate === false}
                                        >
                                            {planLimits?.canAIGenerate === false ? 'アップグレード' : 'コードを生成'}
                                        </EditorActionButton>
                                    }
                                />
                            )}
                        </EditorMenuSection>
                    )}

                    {/* 整理・やり直し */}
                    {isSectionVisible(['undo', 'regenerate']) && (
                        <EditorMenuSection title="整理・やり直し" color="rose">
                            {/* 操作をやり直す */}
                            {isMenuItemVisible('undo') && (
                                <EditorMenuItem
                                    icon={<Undo2 className="h-3.5 w-3.5" />}
                                    title="操作をやり直す"
                                    description="前の状態に戻せます"
                                    tooltip="各ブロックの履歴から以前の状態に戻せます"
                                    action={
                                        <EditorInfoBox variant="info">
                                            各ブロックの「履歴」をクリック
                                        </EditorInfoBox>
                                    }
                                />
                            )}

                            {/* まとめて作り直す */}
                            {isMenuItemVisible('regenerate') && (
                                <EditorMenuItem
                                    icon={<RefreshCw className="h-3.5 w-3.5" />}
                                    title="まとめて作り直す"
                                    description="ページ全体を再生成"
                                    tooltip="選択したブロックを一括再生成します"
                                    badge={planLimits?.canAIGenerate === false ? <EditorBadge variant="dark"><Crown className="h-2.5 w-2.5" /> Pro</EditorBadge> : undefined}
                                    action={
                                        <EditorActionButton
                                            onClick={() => {
                                                if (planLimits?.canAIGenerate === false) {
                                                    toast.error('有料プランにアップグレードしてご利用ください');
                                                    return;
                                                }
                                                setBatchRegenerateMode(true);
                                                setBoundaryFixMode(false);
                                                setBackgroundUnifyMode(false);
                                            }}
                                            disabled={planLimits?.canAIGenerate === false || sections.filter(s => s.image?.filePath).length === 0}
                                        >
                                            {planLimits?.canAIGenerate === false ? 'アップグレード' : 'ブロックを選ぶ'}
                                        </EditorActionButton>
                                    }
                                />
                            )}
                        </EditorMenuSection>
                    )}

                    {/* 公開・最適化 */}
                    {isSectionVisible(['seo', 'deploy']) && (
                        <EditorMenuSection title="公開・最適化" color="purple">
                            {/* SEO/LLMO最適化 */}
                            {isMenuItemVisible('seo') && (
                                <EditorMenuItem
                                    icon={<Search className="h-3.5 w-3.5" />}
                                    title="SEO/LLMO対策"
                                    description="検索・対話エンジン最適化"
                                    tooltip="Google検索とAI対話エンジン（ChatGPT, Claude等）向けにページを最適化します"
                                    badge={planLimits?.canAIGenerate === false ? <EditorBadge variant="dark"><Crown className="h-2.5 w-2.5" /> Pro</EditorBadge> : <EditorBadge variant="pro">PRO</EditorBadge>}
                                    action={
                                        <EditorActionButton
                                            onClick={() => {
                                                if (planLimits?.canAIGenerate === false) {
                                                    toast.error('有料プランにアップグレードしてご利用ください');
                                                    return;
                                                }
                                                setShowSeoLlmoModal(true);
                                            }}
                                            variant={planLimits?.canAIGenerate === false ? "default" : "primary"}
                                            disabled={planLimits?.canAIGenerate === false}
                                        >
                                            {planLimits?.canAIGenerate === false ? 'アップグレード' : '最適化する'}
                                        </EditorActionButton>
                                    }
                                />
                            )}

                            {/* デプロイ */}
                            {isMenuItemVisible('deploy') && (
                                <EditorMenuItem
                                    icon={<Rocket className="h-3.5 w-3.5" />}
                                    title="ページを公開"
                                    description="Render等にデプロイ"
                                    tooltip="Renderなどのホスティングサービスに公開します"
                                    badge={<EditorBadge variant="pro">PRO</EditorBadge>}
                                    action={
                                        <EditorActionButton
                                            onClick={() => {
                                                if (planLimits && !planLimits.canAIGenerate) {
                                                    toast.error('ページ公開は有料プランでご利用いただけます');
                                                    return;
                                                }
                                                if (pageId === 'new') {
                                                    toast.error('デプロイする前にページを保存してください。');
                                                    return;
                                                }
                                                setShowPageDeployModal(true);
                                            }}
                                            variant="primary"
                                            disabled={planLimits?.canAIGenerate === false}
                                        >
                                            {planLimits?.canAIGenerate === false ? 'アップグレード' : '公開する'}
                                        </EditorActionButton>
                                    }
                                />
                            )}
                        </EditorMenuSection>
                    )}
                </div>
            </div>

            {/* インペインティング（部分編集）モーダル */}
            {showInpaintModal && inpaintImageUrl && inpaintSectionId && (
                <ImageInpaintEditor
                    imageUrl={inpaintImageUrl}
                    mobileImageUrl={inpaintMobileImageUrl || undefined}
                    onClose={() => {
                        setShowInpaintModal(false);
                        setInpaintSectionId(null);
                        setInpaintImageUrl(null);
                        setInpaintMobileImageUrl(null);
                        setInpaintInitialMode('inpaint');
                    }}
                    onSave={handleInpaintSave}
                    sectionId={inpaintSectionId}
                    previousImageId={sections.find(s => s.id === inpaintSectionId)?.imageId}
                    clickableAreas={sections.find(s => s.id === inpaintSectionId)?.config?.clickableAreas || []}
                    mobileClickableAreas={sections.find(s => s.id === inpaintSectionId)?.config?.mobileClickableAreas || []}
                    onSaveClickableAreas={handleSaveClickableAreas}
                    initialMode={inpaintInitialMode}
                />
            )}

            {/* 境界修正モーダル（カット＆埋め込み） */}
            {showBoundaryFixModal && selectedBoundaries.size > 0 && (
                <BoundaryDesignModal
                    boundaries={Array.from(selectedBoundaries).sort((a, b) => a - b).map(index => ({
                        index,
                        upperSection: {
                            id: sections[index].id,
                            image: sections[index].image,
                        },
                        lowerSection: {
                            id: sections[index + 1].id,
                            image: sections[index + 1].image,
                        },
                    }))}
                    onClose={() => {
                        setShowBoundaryFixModal(false);
                        setBoundaryFixMode(false);
                        setSelectedBoundaries(new Set());
                    }}
                    onSuccess={() => {
                        setBoundaryFixMode(false);
                        setSelectedBoundaries(new Set());
                        // ページをリロードして最新状態を取得
                        toast.success('境界修正完了。ページを再読み込みします...');
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    }}
                />
            )}

            {/* モバイル画像追加確認ダイアログ */}
            {showMobileConfirmDialog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Smartphone className="h-6 w-6 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">モバイル画像も追加しますか？</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-6">
                            デスクトップ画像を{pendingDesktopSections?.length || 0}セクション追加しました。
                            同じセクションにモバイル用の画像も取得して追加しますか？
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowMobileConfirmDialog(false);
                                    setPendingDesktopSections(null);
                                }}
                                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                            >
                                デスクトップのみ
                            </button>
                            <button
                                onClick={handleAddMobileToNewSections}
                                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Smartphone className="h-4 w-4" />
                                モバイルも追加
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* セクション復元モーダル */}
            {showRestoreModal && restoreSectionId && (
                <RestoreModal
                    sectionId={restoreSectionId}
                    imageUrl={sections.find(s => s.id === restoreSectionId)?.image?.filePath || ''}
                    onClose={() => {
                        setShowRestoreModal(false);
                        setRestoreSectionId(null);
                    }}
                    onSuccess={(newImageUrl, newImageId) => {
                        // セクションの画像を更新（imageIdも更新して保存時に正しく反映されるようにする）
                        const updatedSections = sections.map(s =>
                            s.id === restoreSectionId
                                ? { ...s, imageId: newImageId, image: { ...s.image, id: newImageId, filePath: newImageUrl } }
                                : s
                        );
                        setSections(updatedSections);
                        setShowRestoreModal(false);
                        setRestoreSectionId(null);
                        // 自動保存
                        handleSave(updatedSections);
                    }}
                />
            )}

            {/* デザイン統一モーダル */}
            {showDesignUnifyModal && designUnifySectionId && (
                <DesignUnifyModal
                    sections={sections}
                    targetSectionId={designUnifySectionId}
                    onClose={() => {
                        setShowDesignUnifyModal(false);
                        setDesignUnifySectionId(null);
                    }}
                    onSuccess={(sectionId, newImageUrl, newImageId) => {
                        // 編集前の状態を履歴に保存（元に戻す機能用）
                        const currentSection = sections.find(s => s.id === sectionId);
                        if (currentSection?.imageId && currentSection?.image) {
                            setEditHistory(prev => ({
                                ...prev,
                                [sectionId]: [
                                    { imageId: currentSection.imageId, image: currentSection.image, timestamp: Date.now() },
                                    ...(prev[sectionId] || [])
                                ].slice(0, 10)
                            }));
                        }

                        const updatedSections = sections.map(s =>
                            s.id === sectionId
                                ? { ...s, imageId: newImageId, image: { ...s.image, id: newImageId, filePath: newImageUrl } }
                                : s
                        );
                        setSections(updatedSections);
                        setShowDesignUnifyModal(false);
                        setDesignUnifySectionId(null);
                        handleSave(updatedSections);
                    }}
                />
            )}

            {/* 背景色統一モーダル（複数セクション対応） */}
            {showBackgroundUnifyModal && selectedSectionsForBackgroundUnify.size > 0 && (
                <BackgroundUnifyModal
                    sections={sections}
                    selectedSectionIds={Array.from(selectedSectionsForBackgroundUnify)}
                    canAIGenerate={planLimits.canAIGenerate}
                    onClose={() => {
                        setShowBackgroundUnifyModal(false);
                    }}
                    onSuccess={(results) => {
                        // 各セクションの履歴保存と更新
                        let updatedSections = [...sections];
                        for (const result of results) {
                            const currentSection = sections.find(s => s.id === result.sectionId);
                            // デスクトップ画像の履歴保存
                            if (currentSection?.imageId && currentSection?.image) {
                                setEditHistory(prev => ({
                                    ...prev,
                                    [result.sectionId]: [
                                        { imageId: currentSection.imageId, image: currentSection.image, timestamp: Date.now() },
                                        ...(prev[result.sectionId] || [])
                                    ].slice(0, 10)
                                }));
                            }
                            // セクション更新（デスクトップ + モバイル）
                            updatedSections = updatedSections.map(s =>
                                s.id === result.sectionId
                                    ? {
                                        ...s,
                                        imageId: result.newImageId,
                                        image: { ...s.image, id: result.newImageId, filePath: result.newImageUrl },
                                        // モバイル画像も更新（結果がある場合）
                                        ...(result.mobileImageId && result.mobileImageUrl ? {
                                            mobileImageId: result.mobileImageId,
                                            mobileImage: { ...s.mobileImage, id: result.mobileImageId, filePath: result.mobileImageUrl }
                                        } : {})
                                    }
                                    : s
                            );
                        }
                        setSections(updatedSections);
                        setShowBackgroundUnifyModal(false);
                        setBackgroundUnifyMode(false);
                        setSelectedSectionsForBackgroundUnify(new Set());
                        handleSave(updatedSections);
                    }}
                />
            )}

            {/* コピー編集モーダル */}
            <CopyEditModal
                isOpen={showCopyEditModal}
                onClose={() => setShowCopyEditModal(false)}
                sections={sections}
                productInfo={aiProductInfo}
                taste={aiTaste}
                designDefinition={designDefinition}
                onApply={(results) => {
                    // 生成されたコピーを各セクションに適用
                    setSections(prev => prev.map(section => {
                        const result = results.find(r => String(r.id) === String(section.id));
                        if (result) {
                            return {
                                ...section,
                                config: {
                                    ...section.config,
                                    text: result.text,
                                    dsl: result.dsl
                                }
                            };
                        }
                        return section;
                    }));
                }}
                onApplyAndRegenerate={async (results) => {
                    // まずコピーを適用
                    const updatedSections = sections.map(section => {
                        const result = results.find(r => String(r.id) === String(section.id));
                        if (result) {
                            return {
                                ...section,
                                config: {
                                    ...section.config,
                                    text: result.text,
                                    dsl: result.dsl
                                }
                            };
                        }
                        return section;
                    });

                    setIsCopyRegenerating(true);
                    setShowCopyEditModal(false);

                    // 先にデータベースに保存してIDを確定させる
                    toast.loading('コピーを保存中...', { id: 'copy-save' });
                    let savedSections = updatedSections;
                    try {
                        const method = pageId === 'new' ? 'POST' : 'PUT';
                        const url = pageId === 'new' ? '/api/pages' : `/api/pages/${pageId}`;
                        const saveRes = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sections: updatedSections.map((s, i) => ({
                                    ...s,
                                    order: i,
                                    config: s.config || {}
                                })),
                                headerConfig,
                                status,
                                designDefinition
                            })
                        });
                        const saveData = await saveRes.json();
                        if (saveRes.ok && saveData.sections) {
                            savedSections = saveData.sections;
                            setSections(savedSections);
                            toast.dismiss('copy-save');
                            toast.success('コピーを保存しました');
                        } else {
                            throw new Error(saveData.error || '保存失敗');
                        }
                    } catch (error: any) {
                        toast.dismiss('copy-save');
                        toast.error('保存に失敗しました: ' + error.message);
                        setIsCopyRegenerating(false);
                        return;
                    }

                    // 対象セクションを特定（保存後のIDを使用、orderでマッチング）
                    const targetSections = savedSections.filter((s, idx) => {
                        const originalSection = updatedSections[idx];
                        return results.some(r => String(r.id) === String(originalSection?.id)) && s.image?.filePath;
                    });

                    if (targetSections.length === 0) {
                        toast.error('再生成対象のセクションがありません');
                        setIsCopyRegenerating(false);
                        return;
                    }

                    // 再生成中のセクションをマーク
                    const sectionIdSet = new Set(targetSections.map(s => String(s.id)));
                    setRegeneratingSectionIds(prev => new Set([...prev, ...sectionIdSet]));

                    let finalSections = [...savedSections];
                    let successCount = 0;
                    let errorCount = 0;

                    // リトライ付き再生成
                    const regenerateWithRetry = async (section: any, copyText: string, retries = 3): Promise<boolean> => {
                        const dbSectionId = typeof section.id === 'string' && section.id.startsWith('temp-')
                            ? null
                            : parseInt(String(section.id));

                        if (!dbSectionId) return false;

                        for (let attempt = 1; attempt <= retries; attempt++) {
                            try {
                                const response = await fetch(`/api/sections/${dbSectionId}/regenerate`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        style: 'design-definition',
                                        mode: 'light',
                                        designDefinition,
                                        copyText,
                                    })
                                });

                                const data = await response.json();

                                if (response.ok) {
                                    // 履歴に追加
                                    if (section.imageId && section.image) {
                                        setEditHistory(prev => ({
                                            ...prev,
                                            [section.id]: [
                                                { imageId: section.imageId, image: section.image, timestamp: Date.now() },
                                                ...(prev[section.id] || [])
                                            ].slice(0, 10)
                                        }));
                                    }

                                    // セクション更新
                                    finalSections = finalSections.map(s =>
                                        s.id === section.id
                                            ? { ...s, imageId: data.newImageId, image: data.media }
                                            : s
                                    );
                                    return true;
                                } else if (response.status === 500 && attempt < retries) {
                                    await new Promise(resolve => setTimeout(resolve, attempt * 5000));
                                    continue;
                                } else {
                                    console.error(`Section ${section.id} regenerate failed:`, data.error);
                                    return false;
                                }
                            } catch (error) {
                                if (attempt < retries) {
                                    await new Promise(resolve => setTimeout(resolve, attempt * 5000));
                                    continue;
                                }
                                console.error(`Section ${section.id} regenerate error:`, error);
                                return false;
                            }
                        }
                        return false;
                    };

                    // 順番に再生成（2秒間隔）
                    for (let i = 0; i < targetSections.length; i++) {
                        const section = targetSections[i];
                        // 保存後のsectionには既にcopyTextが適用済み
                        const copyText = section.config?.text || '';

                        if (i > 0) {
                            // API rate limit対策: 5秒待機
                            await new Promise(resolve => setTimeout(resolve, 5000));
                        }

                        const success = await regenerateWithRetry(section, copyText);
                        if (success) {
                            successCount++;
                        } else {
                            errorCount++;
                        }

                        setRegeneratingSectionIds(prev => {
                            const next = new Set(prev);
                            next.delete(String(section.id));
                            return next;
                        });
                    }

                    setSections(finalSections);
                    setIsCopyRegenerating(false);

                    if (successCount > 0) {
                        handleSave(finalSections);
                        // リロードボタン付きトースト
                        toast.custom((t) => (
                            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                                <div className="flex-1 w-0 p-4">
                                    <div className="flex items-start">
                                        <div className="flex-shrink-0 pt-0.5">
                                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                                                <Check className="h-6 w-6 text-green-600" />
                                            </div>
                                        </div>
                                        <div className="ml-3 flex-1">
                                            <p className="text-sm font-medium text-gray-900">
                                                {successCount}セクションの再生成が完了
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                画像が変わらない場合はリロードしてください
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex border-l border-gray-200">
                                    <button
                                        onClick={() => {
                                            toast.dismiss(t.id);
                                            window.location.reload();
                                        }}
                                        className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-emerald-600 hover:text-emerald-500 hover:bg-emerald-50 focus:outline-none"
                                    >
                                        リロード
                                    </button>
                                </div>
                            </div>
                        ), { duration: 10000 });
                    }
                    if (errorCount > 0) {
                        toast.error(`${errorCount}セクションの再生成に失敗しました`);
                    }
                }}
                isRegenerating={isCopyRegenerating}
            />

            {/* CTA管理モーダル */}
            <CTAManagementModal
                isOpen={showCTAModal}
                onClose={() => setShowCTAModal(false)}
                sections={sections}
                globalCTAConfig={{
                    defaultUrl: headerConfig.ctaLink || '#contact',
                    defaultLabel: headerConfig.ctaText || 'お問い合わせ',
                }}
                onApply={(updatedSections, globalConfig) => {
                    setSections(updatedSections);
                    setHeaderConfig((prev: any) => ({
                        ...prev,
                        ctaLink: globalConfig.defaultUrl,
                        ctaText: globalConfig.defaultLabel,
                    }));
                    handleSave(updatedSections);
                }}
            />

            {/* カラーパレットモーダル */}
            <ColorPaletteModal
                isOpen={showColorPaletteModal}
                onClose={() => setShowColorPaletteModal(false)}
                sections={sections}
                currentPalette={designDefinition?.colorPalette}
                designDefinition={designDefinition}
                canAIGenerate={planLimits.canAIGenerate}
                onApply={(palette) => {
                    setDesignDefinition((prev: any) => ({
                        ...prev,
                        colorPalette: palette,
                    }));
                }}
                onApplyAndRegenerate={async (palette) => {
                    // カラーパレットを保存
                    const updatedDesignDef = {
                        ...designDefinition,
                        colorPalette: palette,
                    };
                    setDesignDefinition(updatedDesignDef);

                    setIsColorPaletteRegenerating(true);
                    setShowColorPaletteModal(false);

                    // 先にデータベースに保存してセクションIDを確定させる
                    toast.loading('設定を保存中...', { id: 'color-save' });
                    let savedSections = sections;
                    try {
                        const method = pageId === 'new' ? 'POST' : 'PUT';
                        const url = pageId === 'new' ? '/api/pages' : `/api/pages/${pageId}`;
                        const saveRes = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sections: sections.map((s, i) => ({
                                    ...s,
                                    order: i,
                                    config: s.config || {}
                                })),
                                headerConfig,
                                status,
                                designDefinition: updatedDesignDef
                            })
                        });
                        const saveData = await saveRes.json();
                        if (saveRes.ok && saveData.sections) {
                            savedSections = saveData.sections;
                            setSections(savedSections);
                        }
                        toast.dismiss('color-save');
                    } catch (error) {
                        toast.dismiss('color-save');
                        toast.error('保存に失敗しました');
                        setIsColorPaletteRegenerating(false);
                        return;
                    }

                    // 画像があるセクションのみ対象（保存後のIDを使用）
                    const sectionsWithImages = savedSections.filter(s => s.image?.filePath);
                    if (sectionsWithImages.length === 0) {
                        toast.error('再生成対象のセクションがありません');
                        setIsColorPaletteRegenerating(false);
                        return;
                    }

                    // すべてのセクションIDを再生成中としてマーク
                    const sectionIdSet = new Set(sectionsWithImages.map(s => String(s.id)));
                    setRegeneratingSectionIds(prev => new Set([...prev, ...sectionIdSet]));

                    let updatedSections = [...savedSections];
                    let successCount = 0;
                    let errorCount = 0;

                    // リトライ付き再生成関数
                    const regenerateWithRetry = async (section: any, retries = 3): Promise<boolean> => {
                        const dbSectionId = typeof section.id === 'string' && section.id.startsWith('temp-')
                            ? null
                            : parseInt(String(section.id));

                        if (!dbSectionId) return false;

                        for (let attempt = 1; attempt <= retries; attempt++) {
                            try {
                                const response = await fetch(`/api/sections/${dbSectionId}/regenerate`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        style: 'design-definition',
                                        mode: 'light',
                                        designDefinition: {
                                            ...designDefinition,
                                            colorPalette: palette,
                                        },
                                        extractedColors: palette,
                                        // コピーテキストがあれば渡す
                                        copyText: section.config?.text || undefined,
                                    })
                                });

                                const data = await response.json();

                                if (response.ok) {
                                    // 履歴に追加
                                    if (section.imageId && section.image) {
                                        setEditHistory(prev => ({
                                            ...prev,
                                            [section.id]: [
                                                { imageId: section.imageId, image: section.image, timestamp: Date.now() },
                                                ...(prev[section.id] || [])
                                            ].slice(0, 10)
                                        }));
                                    }

                                    // セクション更新
                                    updatedSections = updatedSections.map(s =>
                                        s.id === section.id
                                            ? { ...s, imageId: data.newImageId, image: data.media }
                                            : s
                                    );
                                    return true;
                                } else if (response.status === 500 && attempt < retries) {
                                    // 500エラーの場合、待機してリトライ
                                    console.log(`Section ${section.id} attempt ${attempt} failed (500), retrying in ${attempt * 5}s...`);
                                    await new Promise(resolve => setTimeout(resolve, attempt * 5000));
                                    continue;
                                } else {
                                    console.error(`Section ${section.id} regenerate failed:`, data.error);
                                    return false;
                                }
                            } catch (error) {
                                if (attempt < retries) {
                                    console.log(`Section ${section.id} attempt ${attempt} error, retrying...`);
                                    await new Promise(resolve => setTimeout(resolve, attempt * 5000));
                                    continue;
                                }
                                console.error(`Section ${section.id} regenerate error:`, error);
                                return false;
                            }
                        }
                        return false;
                    };

                    // 順番に再生成（API負荷軽減のため2秒間隔）
                    for (let i = 0; i < sectionsWithImages.length; i++) {
                        const section = sectionsWithImages[i];

                        // 最初のセクション以外は5秒待機（API rate limit対策）
                        if (i > 0) {
                            await new Promise(resolve => setTimeout(resolve, 5000));
                        }

                        const success = await regenerateWithRetry(section);
                        if (success) {
                            successCount++;
                        } else {
                            errorCount++;
                        }

                        // 完了したセクションを再生成中から除外
                        setRegeneratingSectionIds(prev => {
                            const next = new Set(prev);
                            next.delete(String(section.id));
                            return next;
                        });
                    }

                    setSections(updatedSections);
                    setIsColorPaletteRegenerating(false);

                    if (successCount > 0) {
                        handleSave(updatedSections);
                        // カスタムトーストでリロードボタン表示
                        toast.custom((t) => (
                            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                                <div className="flex-1 w-0 p-4">
                                    <div className="flex items-start">
                                        <div className="flex-shrink-0 pt-0.5">
                                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                                                <Check className="h-6 w-6 text-green-600" />
                                            </div>
                                        </div>
                                        <div className="ml-3 flex-1">
                                            <p className="text-sm font-medium text-gray-900">
                                                {successCount}セクションの再生成が完了
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                画像が変わらない場合はリロードしてください
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex border-l border-gray-200">
                                    <button
                                        onClick={() => {
                                            toast.dismiss(t.id);
                                            window.location.reload();
                                        }}
                                        className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-violet-600 hover:text-violet-500 hover:bg-violet-50 focus:outline-none"
                                    >
                                        リロード
                                    </button>
                                </div>
                            </div>
                        ), { duration: 10000 });
                    }
                    if (errorCount > 0) {
                        toast.error(`${errorCount}セクションの再生成に失敗しました`);
                    }
                }}
                isRegenerating={isColorPaletteRegenerating}
                onAutoDetect={async () => {
                    // analyzeCurrentDesignを呼び出し
                    if (typeof analyzeCurrentDesign === 'function') {
                        await analyzeCurrentDesign();
                    }
                    return designDefinition?.colorPalette || null;
                }}
            />

            {/* 4Kアップスケールモーダル */}
            {show4KModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
                    {is4KProcessing && upscale4KProgress ? (
                        /* レインボーシャドウ回転アニメーション付きカード */
                        <div className="relative w-full max-w-xs">
                            {/* 回転するレインボーグロー */}
                            <div
                                className="absolute -inset-1 rounded-2xl opacity-75 blur-lg"
                                style={{
                                    background: 'conic-gradient(from var(--rotation), #ff0080, #ff8c00, #40e0d0, #7b68ee, #ff0080)',
                                    animation: 'spin4k 2s linear infinite',
                                }}
                            />
                            <style>{`
                                @property --rotation {
                                    syntax: '<angle>';
                                    initial-value: 0deg;
                                    inherits: false;
                                }
                                @keyframes spin4k {
                                    from { --rotation: 0deg; }
                                    to { --rotation: 360deg; }
                                }
                            `}</style>
                            {/* メインカード */}
                            <div className="relative bg-gray-900 rounded-2xl p-8 border border-gray-800">
                                <div className="text-center">
                                    {/* 4Kバッジ（レインボーボーダー） */}
                                    <div className="relative inline-flex mb-4">
                                        <div
                                            className="absolute -inset-0.5 rounded-full blur-sm"
                                            style={{
                                                background: 'conic-gradient(from var(--rotation), #ff0080, #ff8c00, #40e0d0, #7b68ee, #ff0080)',
                                                animation: 'spin4k 2s linear infinite',
                                            }}
                                        />
                                        <div className="relative w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center">
                                            <span className="text-2xl font-black bg-gradient-to-r from-pink-500 via-yellow-500 to-cyan-500 bg-clip-text text-transparent">HD</span>
                                        </div>
                                    </div>
                                    {/* 進捗数値 */}
                                    <div className="text-5xl font-black text-white mb-1">
                                        {upscale4KProgress.current}<span className="text-gray-600 text-3xl">/{upscale4KProgress.total}</span>
                                    </div>
                                    {/* レインボープログレスバー */}
                                    <div className="w-full bg-gray-800 rounded-full h-1.5 mb-3 overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${upscale4KProgress.total > 0 ? (upscale4KProgress.current / upscale4KProgress.total) * 100 : 0}%`,
                                                background: 'linear-gradient(90deg, #ff0080, #ff8c00, #40e0d0, #7b68ee)',
                                            }}
                                        />
                                    </div>
                                    <p className="text-gray-500 text-sm">高画質化処理中...</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full max-w-md overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in zoom-in duration-300">
                            <div className="p-8">
                                {/* ヘッダー */}
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                                        <span className="text-lg font-black text-white">HD</span>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-gray-900">画像を高画質化</h2>
                                        <p className="text-sm text-gray-500">{sections.filter(s => s.image?.filePath).length}ブロックが対象</p>
                                    </div>
                                </div>

                                {/* 解像度選択 */}
                                <div className="mb-5">
                                    <span className="text-sm font-bold text-gray-700 block mb-2">仕上がりサイズ</span>
                                    <div className="flex gap-2">
                                        {(['1K', '2K', '4K'] as const).map((res) => (
                                            <button
                                                key={res}
                                                onClick={() => setUpscaleResolution(res)}
                                                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${upscaleResolution === res
                                                    ? 'bg-gray-900 text-white border-gray-900'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                {res}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-gray-500 text-xs mt-2">
                                        {upscaleResolution === '1K' && '1024px幅 - 軽めに仕上げる'}
                                        {upscaleResolution === '2K' && '2048px幅 - おすすめ'}
                                        {upscaleResolution === '4K' && '3840px幅 - 最高画質'}
                                    </p>
                                </div>

                                {/* 全体/個別 切り替え */}
                                <div className="mb-5">
                                    <span className="text-sm font-bold text-gray-700 block mb-2">対象ブロック</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setUpscaleMode('all');
                                                setSelectedUpscaleSections([]);
                                            }}
                                            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${upscaleMode === 'all'
                                                ? 'bg-gray-900 text-white border-gray-900'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            すべて
                                        </button>
                                        <button
                                            onClick={() => setUpscaleMode('individual')}
                                            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${upscaleMode === 'individual'
                                                ? 'bg-gray-900 text-white border-gray-900'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            選んで実行
                                        </button>
                                    </div>
                                </div>

                                {/* 個別選択時のセクション一覧 */}
                                {upscaleMode === 'individual' && (
                                    <div className="mb-5 p-4 bg-gray-50 rounded-2xl max-h-48 overflow-y-auto">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-bold text-gray-700">
                                                {selectedUpscaleSections.length}件選択中
                                            </span>
                                            <button
                                                onClick={() => {
                                                    const allIds = sections.filter(s => s.image?.filePath).map(s => s.id);
                                                    if (selectedUpscaleSections.length === allIds.length) {
                                                        setSelectedUpscaleSections([]);
                                                    } else {
                                                        setSelectedUpscaleSections(allIds);
                                                    }
                                                }}
                                                className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                                            >
                                                {selectedUpscaleSections.length === sections.filter(s => s.image?.filePath).length
                                                    ? '全解除'
                                                    : '全選択'}
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {sections.filter(s => s.image?.filePath).map((section, idx) => (
                                                <label
                                                    key={section.id}
                                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedUpscaleSections.includes(section.id)
                                                        ? 'bg-violet-100 border-2 border-violet-300'
                                                        : 'bg-white border-2 border-gray-100 hover:border-gray-200'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedUpscaleSections.includes(section.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedUpscaleSections(prev => [...prev, section.id]);
                                                            } else {
                                                                setSelectedUpscaleSections(prev => prev.filter(id => id !== section.id));
                                                            }
                                                        }}
                                                        className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                                                    />
                                                    <img
                                                        src={section.image.filePath}
                                                        alt=""
                                                        className="w-10 h-10 object-cover rounded-lg"
                                                    />
                                                    <span className="text-sm font-medium text-gray-700 truncate flex-1">
                                                        {idx + 1}. {section.role || 'ブロック'}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}


                                {/* アクションボタン */}
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setShow4KModal(false)}
                                        className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-200 transition-colors"
                                    >
                                        キャンセル
                                    </button>
                                    <button
                                        onClick={handle4KUpscale}
                                        disabled={
                                            sections.filter(s => s.image?.filePath).length === 0 ||
                                            (upscaleMode === 'individual' && selectedUpscaleSections.length === 0)
                                        }
                                        className="flex-1 px-6 py-4 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {upscaleMode === 'individual' ? `${selectedUpscaleSections.length}件を高画質化` : '高画質化する'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* セグメント個別再生成モーダル */}
            {showRegenerateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6">
                    <div className="w-full max-w-xl overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
                        <div className="p-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                    <RotateCw className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900">セクションを再生成</h3>
                                    <p className="text-xs text-gray-500">このセクションのみを新しいスタイルで再生成</p>
                                </div>
                            </div>

                            <div className="mt-6 space-y-5">
                                {/* デザイン定義を使用 */}
                                {designDefinition && (
                                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={regenerateStyle === 'design-definition'}
                                                onChange={(e) => setRegenerateStyle(e.target.checked ? 'design-definition' : 'sampling')}
                                                className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                            />
                                            <div className="flex-1">
                                                <span className="font-bold text-green-800 text-sm">デザイン定義に合わせる（推奨）</span>
                                                <p className="text-xs text-green-600 mt-1">
                                                    ページ全体のデザイン定義を使用して、統一感のあるスタイルに再生成します
                                                </p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    {designDefinition.colorPalette?.primary && (
                                                        <span className="inline-block w-4 h-4 rounded-full border border-white shadow" style={{ backgroundColor: designDefinition.colorPalette.primary }} />
                                                    )}
                                                    {designDefinition.colorPalette?.secondary && (
                                                        <span className="inline-block w-4 h-4 rounded-full border border-white shadow" style={{ backgroundColor: designDefinition.colorPalette.secondary }} />
                                                    )}
                                                    {designDefinition.colorPalette?.accent && (
                                                        <span className="inline-block w-4 h-4 rounded-full border border-white shadow" style={{ backgroundColor: designDefinition.colorPalette.accent }} />
                                                    )}
                                                    {designDefinition.vibe && (
                                                        <span className="text-xs text-green-700 ml-1">{designDefinition.vibe}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                )}

                                {/* スタイル */}
                                {regenerateStyle !== 'design-definition' && (
                                    <div>
                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            スタイル
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { id: 'sampling', label: '元のまま' },
                                                { id: 'professional', label: 'ビジネス' },
                                                { id: 'pops', label: 'ポップ' },
                                                { id: 'luxury', label: '高級' },
                                                { id: 'minimal', label: 'シンプル' },
                                                { id: 'emotional', label: '情熱' },
                                            ].map((s) => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => setRegenerateStyle(s.id)}
                                                    className={clsx(
                                                        "px-3 py-2 rounded-lg text-sm font-medium transition-all border-2",
                                                        regenerateStyle === s.id
                                                            ? "border-purple-500 bg-purple-50 text-purple-700"
                                                            : "border-gray-100 hover:border-gray-200 text-gray-600"
                                                    )}
                                                >
                                                    {s.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* カラー */}
                                <div>
                                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        カラー
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { id: 'original', label: 'そのまま', color: 'bg-gray-400' },
                                            { id: 'blue', label: 'ブルー', color: 'bg-blue-500' },
                                            { id: 'green', label: 'グリーン', color: 'bg-green-500' },
                                            { id: 'purple', label: 'パープル', color: 'bg-purple-500' },
                                            { id: 'orange', label: 'オレンジ', color: 'bg-orange-500' },
                                            { id: 'monochrome', label: 'モノクロ', color: 'bg-gray-800' },
                                        ].map((c) => (
                                            <button
                                                key={c.id}
                                                onClick={() => setRegenerateColorScheme(c.id)}
                                                className={clsx(
                                                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-all border-2",
                                                    regenerateColorScheme === c.id
                                                        ? "border-purple-500 bg-purple-50"
                                                        : "border-gray-100 hover:border-gray-200"
                                                )}
                                            >
                                                <span className={`h-3 w-3 rounded-full ${c.color}`} />
                                                <span className="text-xs font-medium text-gray-700">{c.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* モード */}
                                <div>
                                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        モード
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setRegenerateMode('light')}
                                            className={clsx(
                                                "px-3 py-2 rounded-lg text-sm font-medium transition-all border-2",
                                                regenerateMode === 'light'
                                                    ? "border-purple-500 bg-purple-50 text-purple-700"
                                                    : "border-gray-100 hover:border-gray-200 text-gray-600"
                                            )}
                                        >
                                            色だけ変更
                                        </button>
                                        <button
                                            onClick={() => setRegenerateMode('heavy')}
                                            className={clsx(
                                                "px-3 py-2 rounded-lg text-sm font-medium transition-all border-2",
                                                regenerateMode === 'heavy'
                                                    ? "border-purple-500 bg-purple-50 text-purple-700"
                                                    : "border-gray-100 hover:border-gray-200 text-gray-600"
                                            )}
                                        >
                                            全体を再構成
                                        </button>
                                    </div>
                                </div>

                                {/* 追加指示 */}
                                <div>
                                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        追加指示（任意）
                                    </label>
                                    <textarea
                                        value={regeneratePrompt}
                                        onChange={(e) => setRegeneratePrompt(e.target.value)}
                                        placeholder="例: 背景を明るく、ボタンを大きく"
                                        className="w-full h-20 rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* クレジット消費目安の表示 */}
                            <div className="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-indigo-600" />
                                    <span className="text-xs font-bold text-indigo-800">
                                        消費クレジット: 約1,300クレジット
                                    </span>
                                </div>
                                <p className="text-[10px] text-indigo-600 mt-1 ml-6">
                                    画像1枚 × 1,300クレジット/枚
                                </p>
                            </div>

                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={() => setShowRegenerateModal(false)}
                                    className="flex-1 rounded-2xl py-3.5 text-sm font-bold text-gray-400 hover:bg-gray-50 transition-all"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleRegenerate}
                                    disabled={isRegenerating}
                                    className="flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-purple-600 py-3.5 text-sm font-black text-white shadow-xl hover:bg-purple-700 disabled:opacity-50 transition-all"
                                >
                                    {isRegenerating ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                            処理中...
                                        </>
                                    ) : (
                                        <>
                                            <RotateCw className="h-4 w-4" />
                                            再生成
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 一括再生成モーダル */}
            {showBatchRegenerateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        {/* ヘッダー */}
                        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">一括再生成</h2>
                                <p className="text-xs text-gray-500">{selectedSectionsForRegenerate.size}件のセクションを選択中</p>
                            </div>
                            <button
                                onClick={() => setShowBatchRegenerateModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {isBatchRegenerating ? (
                            <div className="p-8 flex flex-col items-center justify-center">
                                <RefreshCw className="h-10 w-10 text-blue-600 animate-spin mb-4" />
                                <p className="text-sm font-medium text-gray-700">再生成中...</p>
                                {batchRegenerateProgress && (
                                    <div className="w-full max-w-xs mt-4">
                                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 transition-all duration-300"
                                                style={{ width: `${(batchRegenerateProgress.current / batchRegenerateProgress.total) * 100}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-400 text-center mt-2">
                                            {batchRegenerateProgress.current} / {batchRegenerateProgress.total}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto">
                                {/* モード選択タブ */}
                                <div className="grid grid-cols-2 gap-0 border-b">
                                    <button
                                        onClick={() => {
                                            setBatchReferenceSection(null);
                                            setBatchRegenerateStyle('sampling');
                                        }}
                                        className={clsx(
                                            "py-3 text-sm font-bold transition-all border-b-2",
                                            !batchReferenceSection
                                                ? "text-blue-600 border-blue-600 bg-blue-50/50"
                                                : "text-gray-400 border-transparent hover:text-gray-600"
                                        )}
                                    >
                                        カスタム再生成
                                    </button>
                                    {/* デザイン統一（Business/Enterpriseプランのみ） */}
                                    {planLimits?.canRestyle && (
                                        <button
                                            onClick={() => {
                                                // 最初のセクションを参照として設定
                                                const firstWithImage = sections.find(s => s.image?.filePath);
                                                if (firstWithImage) setBatchReferenceSection(firstWithImage.id);
                                            }}
                                            className={clsx(
                                                "py-3 text-sm font-bold transition-all border-b-2",
                                                batchReferenceSection
                                                    ? "text-blue-600 border-blue-600 bg-blue-50/50"
                                                    : "text-gray-400 border-transparent hover:text-gray-600"
                                            )}
                                        >
                                            デザイン統一
                                        </button>
                                    )}
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* デザイン統一モード */}
                                    {batchReferenceSection ? (
                                        <>
                                            {/* 参照セクション選択 */}
                                            <div>
                                                <label className="mb-2 block text-xs font-bold text-gray-700">
                                                    お手本セクションを選択
                                                </label>
                                                <p className="text-xs text-gray-500 mb-3">
                                                    選択したセクションのデザインを他のセクションに適用します
                                                </p>
                                                <div className="flex gap-2 flex-wrap">
                                                    {sections.filter(s => s.image?.filePath).map((sec, idx) => (
                                                        <button
                                                            key={sec.id}
                                                            onClick={() => setBatchReferenceSection(sec.id)}
                                                            className={clsx(
                                                                "relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0",
                                                                batchReferenceSection === sec.id
                                                                    ? "border-blue-500 ring-2 ring-blue-200"
                                                                    : selectedSectionsForRegenerate.has(sec.id)
                                                                        ? "border-orange-300 hover:border-blue-400"
                                                                        : "border-gray-200 hover:border-blue-400"
                                                            )}
                                                        >
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={sec.image?.filePath} alt="" className="w-full h-full object-cover" />
                                                            {batchReferenceSection === sec.id && (
                                                                <div className="absolute inset-0 bg-blue-500/50 flex items-center justify-center">
                                                                    <Check className="h-5 w-5 text-white" />
                                                                </div>
                                                            )}
                                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5">
                                                                {idx + 1}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 統一オプション */}
                                            <div className="bg-blue-50 rounded-xl p-3 space-y-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={regenerateReferenceAlso}
                                                        onChange={(e) => setRegenerateReferenceAlso(e.target.checked)}
                                                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                                    />
                                                    <span className="text-xs text-gray-700">お手本も一緒に再生成</span>
                                                </label>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* カスタムモード：スタイル選択 */}
                                            <div>
                                                <label className="mb-2 block text-xs font-bold text-gray-700">スタイル</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {[
                                                        { id: 'sampling', label: '元のまま' },
                                                        { id: 'professional', label: 'ビジネス' },
                                                        { id: 'pops', label: 'ポップ' },
                                                        { id: 'luxury', label: '高級' },
                                                        { id: 'minimal', label: 'シンプル' },
                                                        { id: 'emotional', label: '情熱' },
                                                    ].map((s) => (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => setBatchRegenerateStyle(s.id)}
                                                            className={clsx(
                                                                "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                                                                batchRegenerateStyle === s.id
                                                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                                                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                                                            )}
                                                        >
                                                            {s.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* カラー選択 */}
                                            <div>
                                                <label className="mb-2 block text-xs font-bold text-gray-700">カラー</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {[
                                                        { id: 'original', label: 'そのまま', color: '#9CA3AF' },
                                                        { id: 'blue', label: 'ブルー', color: '#3B82F6' },
                                                        { id: 'green', label: 'グリーン', color: '#22C55E' },
                                                        { id: 'purple', label: 'パープル', color: '#A855F7' },
                                                        { id: 'orange', label: 'オレンジ', color: '#F97316' },
                                                        { id: 'monochrome', label: 'モノクロ', color: '#1F2937' },
                                                    ].map((c) => (
                                                        <button
                                                            key={c.id}
                                                            onClick={() => setBatchRegenerateColorScheme(c.id)}
                                                            className={clsx(
                                                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all border",
                                                                batchRegenerateColorScheme === c.id
                                                                    ? "border-blue-500 bg-blue-50"
                                                                    : "border-gray-200 hover:border-gray-300"
                                                            )}
                                                        >
                                                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                                                            <span className="text-xs text-gray-700">{c.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* 共通オプション */}
                                    <div className="pt-3 border-t space-y-3">
                                        {/* モード */}
                                        <div>
                                            <label className="mb-2 block text-xs font-bold text-gray-700">変更の度合い</label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setBatchRegenerateGenerationMode('light')}
                                                    className={clsx(
                                                        "flex-1 px-3 py-2 rounded-full text-xs font-medium transition-all border",
                                                        batchRegenerateGenerationMode === 'light'
                                                            ? "border-blue-500 bg-blue-50 text-blue-700"
                                                            : "border-gray-200 hover:border-gray-300 text-gray-600"
                                                    )}
                                                >
                                                    色・スタイルのみ
                                                </button>
                                                <button
                                                    onClick={() => setBatchRegenerateGenerationMode('heavy')}
                                                    className={clsx(
                                                        "flex-1 px-3 py-2 rounded-full text-xs font-medium transition-all border",
                                                        batchRegenerateGenerationMode === 'heavy'
                                                            ? "border-blue-500 bg-blue-50 text-blue-700"
                                                            : "border-gray-200 hover:border-gray-300 text-gray-600"
                                                    )}
                                                >
                                                    レイアウトも変更
                                                </button>
                                            </div>
                                        </div>

                                        {/* モバイル同時再生成 */}
                                        <label className="flex items-center gap-2 cursor-pointer bg-gray-50 rounded-lg p-3">
                                            <input
                                                type="checkbox"
                                                checked={includeMobileInBatch}
                                                onChange={(e) => setIncludeMobileInBatch(e.target.checked)}
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                            />
                                            <div className="flex items-center gap-1.5">
                                                <Monitor className="h-3.5 w-3.5 text-gray-500" />
                                                <span className="text-gray-400">+</span>
                                                <Smartphone className="h-3.5 w-3.5 text-gray-500" />
                                                <span className="text-xs text-gray-700">モバイル画像も同時に再生成</span>
                                            </div>
                                        </label>

                                        {/* 追加指示 */}
                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold text-gray-700">追加指示（任意）</label>
                                            <textarea
                                                value={batchRegeneratePrompt}
                                                onChange={(e) => setBatchRegeneratePrompt(e.target.value)}
                                                placeholder="例: 背景を明るく、ボタンを大きく"
                                                className="w-full h-16 rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* クレジット消費目安の表示（フッター固定） */}
                        {!isBatchRegenerating && (
                            <div className="flex-shrink-0 px-5 py-3 border-t bg-indigo-50">
                                {(() => {
                                    const baseCount = batchReferenceSection
                                        ? selectedSectionsForRegenerate.size - (selectedSectionsForRegenerate.has(batchReferenceSection) && !regenerateReferenceAlso ? 1 : 0)
                                        : selectedSectionsForRegenerate.size;
                                    const totalImages = includeMobileInBatch ? baseCount * 2 : baseCount;
                                    const tokensPerImage = 1300;
                                    const totalTokens = totalImages * tokensPerImage;
                                    return (
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-indigo-600" />
                                            <div>
                                                <span className="text-xs font-bold text-indigo-800">
                                                    消費クレジット: 約{totalTokens.toLocaleString()}クレジット
                                                </span>
                                                <p className="text-[10px] text-indigo-600">
                                                    {baseCount}件{includeMobileInBatch ? ' × 2（PC+モバイル）' : ''} × {tokensPerImage.toLocaleString()}クレジット/枚
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* 実行ボタン（フッター固定） */}
                        {!isBatchRegenerating && (
                            <div className="flex-shrink-0 px-5 py-4 border-t bg-gray-50 flex gap-3">
                                <button
                                    onClick={() => setShowBatchRegenerateModal(false)}
                                    className="flex-1 rounded-xl py-3 text-sm font-medium text-gray-500 hover:bg-gray-100 transition-all"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleBatchRegenerate}
                                    disabled={batchReferenceSection ? selectedSectionsForRegenerate.size <= 1 : selectedSectionsForRegenerate.size === 0}
                                    className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    {batchReferenceSection
                                        ? `${selectedSectionsForRegenerate.size - (selectedSectionsForRegenerate.has(batchReferenceSection) && !regenerateReferenceAlso ? 1 : 0)}件を統一`
                                        : `${selectedSectionsForRegenerate.size}件を再生成`
                                    }
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* デュアルスクリーンショット取り込みモーダル */}
            {showDualImportModal && (
                <DualImportModal
                    onClose={() => setShowDualImportModal(false)}
                    onImport={handleDualImport}
                />
            )}

            {/* モバイル最適化モーダル */}
            <MobileOptimizeModal
                isOpen={showMobileOptimizeModal}
                onClose={() => setShowMobileOptimizeModal(false)}
                sections={sections}
                onOptimize={async (sectionIds, strategy) => {
                    // モバイル画像生成ロジック
                    for (const sectionId of sectionIds) {
                        const section = sections.find(s => String(s.id) === sectionId);
                        if (!section?.image?.filePath) continue;

                        try {
                            const response = await fetch('/api/ai/generate-mobile', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    pageId,
                                    sectionId,
                                    strategy,
                                    sourceImageUrl: section.image.filePath
                                })
                            });

                            if (!response.ok) throw new Error('モバイル画像生成に失敗しました');

                            const data = await response.json();
                            setSections(prev => prev.map(s =>
                                String(s.id) === sectionId
                                    ? { ...s, mobileImage: data.mobileImage }
                                    : s
                            ));
                        } catch (error) {
                            console.error('Mobile optimization error:', error);
                        }
                    }
                }}
            />

            {/* セクション挿入モーダル */}
            <SectionInsertModal
                isOpen={showInsertModal}
                insertIndex={insertIndex}
                onClose={() => setShowInsertModal(false)}
                onInsert={handleInsertSection}
                onSelectFromLibrary={handleInsertFromLibrary}
            />

            {/* 動画挿入モーダル */}
            <VideoInsertModal
                isOpen={showVideoModal}
                onClose={() => setShowVideoModal(false)}
                sections={sections}
                onInsert={async (sectionId, videoData) => {
                    // 動画挿入ロジック
                    console.log('[Video Insert] Sending:', { pageId, sectionId, videoData });
                    const response = await fetch('/api/sections/video', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pageId,
                            sectionId,
                            videoData
                        })
                    });

                    const data = await response.json();
                    console.log('[Video Insert] Response:', data);

                    if (!response.ok) {
                        throw new Error(data.error || '動画の挿入に失敗しました');
                    }

                    // ローカルステートを更新
                    setSections(prev => prev.map(s => {
                        if (String(s.id) === sectionId) {
                            const currentConfig = s.config ? (typeof s.config === 'string' ? JSON.parse(s.config) : s.config) : {};
                            return {
                                ...s,
                                config: JSON.stringify({
                                    ...currentConfig,
                                    video: {
                                        type: videoData.type,
                                        url: videoData.url,
                                        thumbnailUrl: videoData.thumbnailUrl || null,
                                        autoplay: videoData.autoplay || false,
                                        loop: videoData.loop || false,
                                        muted: videoData.muted || true,
                                        displayMode: videoData.displayMode || 'partial',
                                        // 部分配置用
                                        x: videoData.x || 50,
                                        y: videoData.y || 50,
                                        width: videoData.width || 40,
                                    }
                                })
                            };
                        }
                        return s;
                    }));

                    return data;
                }}
                onReorderSections={(reorderedSections) => {
                    // セクションの順序を更新
                    setSections(reorderedSections.map((s, idx) => ({ ...s, order: idx })));
                    toast.success('セクションの順序を更新しました');
                }}
            />

            {/* チュートリアルモーダル */}
            <TutorialModal
                isOpen={showTutorialModal}
                onClose={() => setShowTutorialModal(false)}
            />

            {/* LP比較モーダル */}
            <LPCompareModal
                isOpen={showLPCompareModal}
                onClose={() => setShowLPCompareModal(false)}
                currentPageId={pageId ? parseInt(pageId) : 0}
                currentSections={sections.map((s, idx) => ({
                    id: typeof s.id === 'string' ? parseInt(s.id) : s.id,
                    image_url: s.image?.filePath || '',
                    display_order: idx,
                }))}
                onApplySelection={async (selectedBlocks) => {
                    // 選択されたブロックで新しいセクション構成を作成
                    toast.success(`${selectedBlocks.length}個のブロックを選択しました`);
                    // TODO: 実際にセクションを入れ替える処理
                }}
            />

            {/* LP比較パネル（サイドパネル） */}
            <LPComparePanel
                isOpen={showLPComparePanel}
                onClose={() => setShowLPComparePanel(false)}
                currentPageId={pageId ? parseInt(pageId) : 0}
                onSelectBlock={async (sectionId, imageUrl, fromLpId) => {
                    // 選択されたブロックを現在のLPに挿入
                    const newSection = {
                        id: `imported-${Date.now()}`,
                        role: 'imported',
                        order: sections.length,
                        imageId: null,
                        image: { filePath: imageUrl },
                        config: { importedFrom: fromLpId, originalSectionId: sectionId }
                    };
                    setSections(prev => [...prev, newSection]);
                    toast.success('ブロックを取り込みました');
                }}
            />

            {/* セクションクロップモーダル */}
            {showCropModal && cropImageUrl && cropSectionId && (
                <SectionCropModal
                    isOpen={showCropModal}
                    onClose={() => {
                        setShowCropModal(false);
                        setCropSectionId(null);
                        setCropImageUrl(null);
                    }}
                    imageUrl={cropImageUrl}
                    sectionId={cropSectionId}
                    onCrop={async (sectionId, cropData) => {
                        // クロップ処理（キャンバスで実行）
                        const section = sections.find(s => String(s.id) === sectionId);
                        if (!section?.image?.filePath) return;

                        // 画像を読み込んでクロップ
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                            img.src = section.image.filePath;
                        });

                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        if (!ctx) throw new Error('Canvas not supported');

                        const startY = Math.round(img.height * cropData.startY);
                        const endY = Math.round(img.height * cropData.endY);
                        const cropHeight = endY - startY;

                        canvas.width = img.width;
                        canvas.height = cropHeight;

                        ctx.drawImage(img, 0, startY, img.width, cropHeight, 0, 0, img.width, cropHeight);

                        // Base64に変換
                        const croppedBase64 = canvas.toDataURL('image/png');

                        // サーバーに保存
                        const response = await fetch('/api/sections/crop', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                pageId,
                                sectionId,
                                croppedImage: croppedBase64,
                                cropData
                            })
                        });

                        if (!response.ok) throw new Error('クロップに失敗しました');

                        const data = await response.json();

                        // セクションを更新
                        const updatedSections = sections.map(s =>
                            String(s.id) === sectionId
                                ? { ...s, image: data.image, imageId: data.image?.id }
                                : s
                        );
                        setSections(updatedSections);

                        // 変更をサーバーに保存
                        await handleSave(updatedSections);
                    }}
                />
            )}

            {/* 画像リサイズモーダル */}
            {showResizeModal && resizeImageUrl && resizeSectionId && (
                <ImageResizeModal
                    imageUrl={resizeImageUrl}
                    onClose={() => {
                        setShowResizeModal(false);
                        setResizeSectionId(null);
                        setResizeImageUrl(null);
                    }}
                    onSave={async (newImageUrl, newImageId) => {
                        console.log('[ResizeModal] onSave called with URL:', newImageUrl, 'ID:', newImageId);
                        console.log('[ResizeModal] resizeSectionId:', resizeSectionId);
                        console.log('[ResizeModal] viewMode:', viewMode);

                        // セクションの画像を更新（imageIdも更新）
                        const updatedSections = sections.map(s => {
                            if (String(s.id) !== resizeSectionId) return s;

                            console.log('[ResizeModal] Updating section:', s.id, 'with new imageId:', newImageId);

                            // viewModeに応じてデスクトップまたはモバイル画像を更新
                            if (viewMode === 'mobile' && s.mobileImage) {
                                return {
                                    ...s,
                                    mobileImageId: newImageId ?? s.mobileImageId,
                                    mobileImage: { ...s.mobileImage, id: newImageId ?? s.mobileImage.id, filePath: newImageUrl }
                                };
                            }
                            return {
                                ...s,
                                imageId: newImageId ?? s.imageId,
                                image: { ...s.image, id: newImageId ?? s.image?.id, filePath: newImageUrl }
                            };
                        });

                        console.log('[ResizeModal] Updated sections:', updatedSections.map(s => ({ id: s.id, imageUrl: s.image?.filePath })));

                        setSections(updatedSections);
                        await handleSave(updatedSections);

                        toast.success('画像を更新しました');

                        setShowResizeModal(false);
                        setResizeSectionId(null);
                        setResizeImageUrl(null);
                    }}
                />
            )}

            {/* オーバーレイエディターモーダル */}
            {showOverlayEditor && overlayEditImageUrl && overlayEditSectionId && (
                <OverlayEditorModal
                    isOpen={showOverlayEditor}
                    onClose={() => {
                        setShowOverlayEditor(false);
                        setOverlayEditSectionId(null);
                        setOverlayEditImageUrl(null);
                    }}
                    imageUrl={overlayEditImageUrl}
                    sectionId={overlayEditSectionId}
                    initialOverlays={
                        sections.find(s => String(s.id) === overlayEditSectionId)?.config?.overlays || []
                    }
                    onSave={(overlays) => {
                        // セクションのconfigにオーバーレイを保存
                        setSections(prev => prev.map(s =>
                            String(s.id) === overlayEditSectionId
                                ? {
                                    ...s,
                                    config: {
                                        ...(s.config || {}),
                                        overlays
                                    }
                                }
                                : s
                        ));
                        toast.success('オーバーレイを保存しました');
                        setShowOverlayEditor(false);
                        setOverlayEditSectionId(null);
                        setOverlayEditImageUrl(null);
                    }}
                />
            )}

            {/* サムネイル変換モーダル */}
            <ThumbnailTransformModal
                isOpen={showThumbnailModal}
                onClose={() => setShowThumbnailModal(false)}
                sections={sections}
            />

            {/* 資料化モーダル */}
            <DocumentTransformModal
                isOpen={showDocumentModal}
                onClose={() => setShowDocumentModal(false)}
                sections={sections}
            />

            {/* AIコード生成モーダル */}
            {showClaudeGeneratorModal && (
                <ClaudeCodeGeneratorModal
                    onClose={() => setShowClaudeGeneratorModal(false)}
                    sections={sections}
                    designDefinition={designDefinition}
                    layoutMode={sections[0]?.config?.layout === 'desktop' ? 'desktop' : 'responsive'}
                    onInsertHtml={async (html, insertIndex, meta) => {
                        if (!html || html.trim().length === 0) {
                            toast.error('生成されたHTMLが空です');
                            return;
                        }
                        const newSection = {
                            id: `temp-${Date.now()}`,
                            role: 'html-embed',
                            imageId: null,
                            image: null,
                            mobileImageId: null,
                            mobileImage: null,
                            order: insertIndex,
                            config: {
                                htmlContent: html,
                                mobileHtmlContent: meta.mobileHtmlContent || null,
                                templateType: meta.templateType,
                                prompt: meta.prompt,
                            }
                        };
                        const newSections = [...sections];
                        for (let i = 0; i < newSections.length; i++) {
                            if (newSections[i].order >= insertIndex) {
                                newSections[i] = { ...newSections[i], order: newSections[i].order + 1 };
                            }
                        }
                        newSections.push(newSection);
                        const sorted = newSections.sort((a, b) => a.order - b.order);
                        setSections(sorted);
                        await handleSave(sorted);
                    }}
                />
            )}

            {/* HTMLコード編集モーダル */}
            {showHtmlEditModal && htmlEditSectionId && (() => {
                const targetSection = sections.find(s => String(s.id) === htmlEditSectionId);
                if (!targetSection || targetSection.role !== 'html-embed' || !targetSection.config?.htmlContent) {
                    return null;
                }
                return (
                    <HtmlCodeEditModal
                        onClose={() => {
                            setShowHtmlEditModal(false);
                            setHtmlEditSectionId(null);
                        }}
                        currentHtml={targetSection.config.htmlContent}
                        templateType={targetSection.config.templateType}
                        originalPrompt={targetSection.config.prompt}
                        designDefinition={designDefinition}
                        layoutMode={sections[0]?.config?.layout === 'desktop' ? 'desktop' : 'responsive'}
                        pageSlug={initialSlug || pageId}
                        onSave={async (newHtml) => {
                            // セクションのHTMLコンテンツを更新
                            const updatedSections = sections.map(s =>
                                String(s.id) === htmlEditSectionId
                                    ? {
                                        ...s,
                                        config: {
                                            ...s.config,
                                            htmlContent: newHtml,
                                        }
                                    }
                                    : s
                            );
                            setSections(updatedSections);
                            // データベースに保存
                            await handleSave(updatedSections);
                        }}
                    />
                );
            })()}

            {showPageDeployModal && pageId !== 'new' && (
                <PageDeployModal
                    pageId={pageId}
                    pageTitle={initialSlug || 'my-page'}
                    onClose={() => setShowPageDeployModal(false)}
                />
            )}

            {showSeoLlmoModal && (
                <SEOLLMOOptimizer
                    isOpen={showSeoLlmoModal}
                    onClose={() => setShowSeoLlmoModal(false)}
                    pageId={pageId !== 'new' ? Number(pageId) : null}
                    currentScreenshot={sections.length > 0 ? sections[0].image?.filePath : undefined}
                />
            )}

        </div>
    );
}
