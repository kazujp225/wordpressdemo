"use client";

import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from '@/components/admin/SortableItem';
import { ImageInpaintEditor } from '@/components/lp-builder/ImageInpaintEditor';
import { DualImportModal } from '@/components/admin/DualImportModal';
import { BoundaryDesignModal } from '@/components/admin/BoundaryDesignModal';
import { RestoreModal } from '@/components/admin/RestoreModal';
import { GripVertical, Trash2, X, Upload, Sparkles, RefreshCw, Sun, Contrast, Droplet, Palette, Save, Eye, Plus, Download, Github, Loader2, Wand2, MessageCircle, Send, Copy, Check, Pencil, Undo2, RotateCw, DollarSign, Monitor, Smartphone, Link2, Scissors, Expand } from 'lucide-react';
import type { ClickableArea } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import toast from 'react-hot-toast';

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
    const [showCopilot, setShowCopilot] = useState(false);
    const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
        { role: 'assistant', content: 'こんにちは！LP画像生成のプロンプト作成をお手伝いします。\n\nどんな商材やサービスのLPを作りたいですか？' }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
    const [reviewingSectionId, setReviewingSectionId] = useState<string | null>(null);
    const [chattingSectionId, setChattingSectionId] = useState<string | null>(null);
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

    // デュアルスクリーンショット取り込みモーダル
    const [showDualImportModal, setShowDualImportModal] = useState(false);

    // 境界修正モーダル（複数選択対応）
    const [showBoundaryFixModal, setShowBoundaryFixModal] = useState(false);
    const [boundaryFixMode, setBoundaryFixMode] = useState(false); // 境界選択モード
    const [selectedBoundaries, setSelectedBoundaries] = useState<Set<number>>(new Set()); // 選択された境界のインデックス

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

    // セクション復元モーダル
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [restoreSectionId, setRestoreSectionId] = useState<string | null>(null);

    // セクション追加モーダル
    const [showAddSectionModal, setShowAddSectionModal] = useState(false);
    const [addSectionIndex, setAddSectionIndex] = useState<number>(0); // 挿入位置
    const [addSectionPrompt, setAddSectionPrompt] = useState('');
    const [isAddingSection, setIsAddingSection] = useState(false);

    // 4Kアップスケールモーダル
    const [show4KModal, setShow4KModal] = useState(false);
    const [is4KProcessing, setIs4KProcessing] = useState(false);
    const [upscale4KProgress, setUpscale4KProgress] = useState<{
        current: number;
        total: number;
        message: string;
        results: any[];
    } | null>(null);

    // 画像一括生成中のセクションID
    const [generatingImageSectionIds, setGeneratingImageSectionIds] = useState<Set<string>>(new Set());

    // 編集履歴（元に戻す用）
    const [editHistory, setEditHistory] = useState<Record<string, { imageId: number; image: any; timestamp: number }[]>>({});
    const [showHistoryPanel, setShowHistoryPanel] = useState<string | null>(null);

    // デスクトップレイアウトプレビューモード
    const [showDesktopPreview, setShowDesktopPreview] = useState(false);

    // Design Analysis State
    const [designImage, setDesignImage] = useState<string | null>(null);
    const [designDefinition, setDesignDefinition] = useState<any | null>(initialDesignDefinition);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // API消費量メーター
    const [apiCost, setApiCost] = useState<{ todayCost: number; monthCost: number } | null>(null);

    const analyzeCurrentDesign = async () => {
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

    // API消費量を取得
    useEffect(() => {
        const fetchApiCost = async () => {
            try {
                // 今日のコスト
                const todayRes = await fetch('/api/admin/stats?days=1');
                const todayData = await todayRes.json();

                // 今月のコスト
                const now = new Date();
                const daysThisMonth = now.getDate();
                const monthRes = await fetch(`/api/admin/stats?days=${daysThisMonth}`);
                const monthData = await monthRes.json();

                setApiCost({
                    todayCost: todayData.summary?.totalCost || 0,
                    monthCost: monthData.summary?.totalCost || 0
                });
            } catch (error) {
                console.error('Failed to fetch API cost:', error);
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
                return arrayMove(items, oldIndex, newIndex);
            });
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

    // チャットコパイロット送信
    const handleSendChat = async () => {
        if (!chatInput.trim() || isChatLoading) return;

        const userMessage = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsChatLoading(true);

        try {
            const res = await fetch('/api/ai/prompt-copilot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...chatMessages, { role: 'user', content: userMessage }]
                })
            });

            const data = await res.json();
            if (data.error) {
                setChatMessages(prev => [...prev, { role: 'assistant', content: `エラー: ${data.error}` }]);
            } else {
                setChatMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
            }
        } catch (error) {
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'エラーが発生しました。もう一度お試しください。' }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    // プロンプトをコピーしてメイン欄に挿入
    const handleUsePrompt = (prompt: string) => {
        setAiProductInfo(prev => prev ? `${prev}\n\n${prompt}` : prompt);
        setCopiedPrompt(prompt);
        setTimeout(() => setCopiedPrompt(null), 2000);
    };

    // チャットメッセージからプロンプト例を抽出
    const extractPromptExample = (text: string): string | null => {
        const match = text.match(/【プロンプト例】\s*([\s\S]*?)(?=\n\n|$)/);
        return match ? match[1].trim() : null;
    };

    const handleGenerateAI = async () => {
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

    // 画像編集モーダルを開く
    const handleOpenEditImage = (sectionId: string) => {
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
    const handleOpenInpaint = (sectionId: string, imageUrl: string, mobileImageUrl?: string) => {
        setInpaintSectionId(sectionId);
        setInpaintImageUrl(imageUrl);
        setInpaintMobileImageUrl(mobileImageUrl || null);
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

    const handleChatEdit = async (id: string, message: string) => {
        const section = sections.find(s => s.id === id);
        if (!section) return;

        setChattingSectionId(id);
        try {
            const res = await fetch('/api/ai/chat-edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    currentText: section.config?.text || '',
                    role: section.role,
                    dsl: section.config?.dsl || {}
                })
            });
            const result = await res.json();
            return result;
        } catch (error) {
            console.error('AIチャット編集に失敗しました:', error);
            throw error;
        } finally {
            setChattingSectionId(null);
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
                router.push(`/admin/pages/${data.id}`);
            } else if (res.ok) {
                router.refresh(); // Refresh server data
            } else {
                toast.error('保存中にエラーが発生しました。');
            }

        } catch (e) {
            console.error(e);
            toast.error('保存に失敗しました。');
        }
        setIsSaving(false);
    };

    // AIアシスタントパネル表示状態
    const [showAIPanel, setShowAIPanel] = useState(false);

    // 一括編集オプションの状態
    const [editOptions, setEditOptions] = useState({
        people: { enabled: false, mode: 'similar' as 'similar' | 'different' },
        text: { enabled: false, mode: 'nuance' as 'nuance' | 'copywriting' | 'rewrite' },
        pattern: { enabled: false },
        objects: { enabled: false },
        color: { enabled: false, scheme: 'blue' as string },
        layout: { enabled: false },
    });
    const [isRestyling, setIsRestyling] = useState(false);
    const [restyleProgress, setRestyleProgress] = useState({ current: 0, total: 0, message: '' });

    // デザイン定義のON/OFF・手動入力
    const [useDesignDef, setUseDesignDef] = useState(!!designDefinition);
    const [customDesignInput, setCustomDesignInput] = useState('');

    // デザイン解析が完了したらトグルをONにする
    useEffect(() => {
        if (designDefinition) {
            setUseDesignDef(true);
        }
    }, [designDefinition]);

    // セグメント個別再生成の状態
    const [showRegenerateModal, setShowRegenerateModal] = useState(false);
    const [regenerateSectionId, setRegenerateSectionId] = useState<string | null>(null);
    const [regenerateStyle, setRegenerateStyle] = useState('professional');
    const [regenerateColorScheme, setRegenerateColorScheme] = useState('original');
    const [regenerateMode, setRegenerateMode] = useState<'light' | 'heavy'>('light');
    const [regeneratePrompt, setRegeneratePrompt] = useState('');
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regeneratingSectionIds, setRegeneratingSectionIds] = useState<Set<string>>(new Set());

    // セグメント個別再生成モーダルを開く
    const handleOpenRegenerate = (sectionId: string) => {
        setRegenerateSectionId(sectionId);
        setRegeneratePrompt('');
        setShowRegenerateModal(true);
    };

    // セグメント個別再生成の実行
    const handleRegenerate = async () => {
        if (!regenerateSectionId) return;

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

        for (let i = 0; i < sectionIds.length; i++) {
            const sectionId = sectionIds[i];
            const section = sections.find(s => s.id === sectionId);

            console.log(`Processing section ${i + 1}:`, { sectionId, found: !!section, sectionData: section });

            if (!section) continue;

            const dbSectionId = typeof section.id === 'string' && section.id.startsWith('temp-')
                ? null
                : parseInt(String(section.id));

            console.log(`DB Section ID: ${dbSectionId} (from ${section.id})`);

            if (!dbSectionId || isNaN(dbSectionId)) {
                console.warn(`Section ${section.id} skipped - not saved yet`);
                continue;
            }

            setBatchRegenerateProgress({ current: i + 1, total: sectionIds.length });

            try {
                // 参照セクションの画像URLを取得
                const referenceSection = batchReferenceSection
                    ? sections.find(s => s.id === batchReferenceSection)
                    : null;
                const styleReferenceUrl = referenceSection?.image?.filePath || undefined;

                console.log(`Calling API: /api/sections/${dbSectionId}/regenerate`);
                console.log(`Style reference URL: ${styleReferenceUrl}`);

                const response = await fetch(`/api/sections/${dbSectionId}/regenerate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        style: batchReferenceSection ? 'sampling' : (batchRegenerateStyle === 'design-definition' ? 'design-definition' : batchRegenerateStyle),
                        colorScheme: batchRegenerateColorScheme !== 'original' ? batchRegenerateColorScheme : undefined,
                        customPrompt: batchRegeneratePrompt || undefined,
                        mode: batchRegenerateGenerationMode,
                        designDefinition: !batchReferenceSection && batchRegenerateStyle === 'design-definition' ? designDefinition : undefined,
                        styleReferenceUrl: styleReferenceUrl, // 参照セクションの画像URL
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    // 現在の画像を履歴に追加（元に戻す機能用）
                    if (section.imageId && section.image) {
                        setEditHistory(prev => ({
                            ...prev,
                            [sectionId]: [
                                { imageId: section.imageId, image: section.image, timestamp: Date.now() },
                                ...(prev[sectionId] || [])
                            ].slice(0, 10) // 最大10件保持
                        }));
                    }

                    setSections(prev => prev.map(s =>
                        s.id === sectionId
                            ? { ...s, imageId: data.newImageId, image: data.media }
                            : s
                    ));
                    successCount++;
                } else {
                    console.error(`Section ${sectionId} API error:`, data.error || 'Unknown error');
                    toast.error(`セクション ${i + 1}: ${data.error || '再生成失敗'}`);
                }
            } catch (error: any) {
                console.error(`Section ${sectionId} regenerate failed:`, error);
                toast.error(`セクション ${i + 1}: ${error.message || '通信エラー'}`);
            }

            // 完了したセクションをローディングから外す
            setRegeneratingSectionIds(prev => {
                const next = new Set(prev);
                next.delete(sectionId);
                return next;
            });
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
        toast.success(`${successCount}/${sectionIds.length}セクションを再生成しました`);
    };

    // セクション追加の実行
    const handleAddSection = async () => {
        if (!addSectionPrompt.trim()) {
            toast.error('生成内容を入力してください');
            return;
        }

        setIsAddingSection(true);

        try {
            // 前後のセクション画像を取得（コンテキスト用）
            const prevSection = addSectionIndex > 0 ? sections[addSectionIndex - 1] : null;
            const nextSection = addSectionIndex < sections.length ? sections[addSectionIndex] : null;

            // サイズを決定（前後のセクションから推測）
            const referenceSection = prevSection || nextSection;
            const width = referenceSection?.image?.width || 750;
            const estimatedHeight = 400; // デフォルト高さ

            const response = await fetch('/api/sections/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: addSectionPrompt,
                    width,
                    height: estimatedHeight,
                    prevImageUrl: prevSection?.image?.filePath,
                    nextImageUrl: nextSection?.image?.filePath,
                    designDefinition: designDefinition || undefined,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '生成に失敗しました');
            }

            const data = await response.json();

            // 新しいセクションを挿入
            const newSection = {
                id: `temp-${Date.now()}`,
                order: addSectionIndex,
                role: 'generated',
                imageId: data.mediaId,
                image: {
                    id: data.mediaId,
                    filePath: data.imageUrl,
                    width: data.width,
                    height: data.height,
                },
            };

            setSections(prev => {
                const updated = [...prev];
                // 挿入位置以降のorderを更新
                for (let i = addSectionIndex; i < updated.length; i++) {
                    updated[i] = { ...updated[i], order: updated[i].order + 1 };
                }
                // 新しいセクションを挿入
                updated.splice(addSectionIndex, 0, newSection);
                return updated;
            });

            toast.success('セクションを追加しました');
            setShowAddSectionModal(false);
            setAddSectionPrompt('');

        } catch (error: any) {
            toast.error(error.message || 'セクション追加に失敗しました');
        } finally {
            setIsAddingSection(false);
        }
    };

    // 4Kアップスケール実行
    const handle4KUpscale = async () => {
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
                                toast.success(`4Kアップスケール完了: ${data.processed}/${data.total}セクション`);
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
            toast.error(error.message || '4Kアップスケールに失敗しました');
        } finally {
            setIs4KProcessing(false);
            setUpscale4KProgress(null);
            setShow4KModal(false);
        }
    };

    // 一括編集の実行
    const handleRestyle = async () => {
        if (pageId === 'new') {
            toast.error('編集する前にページを保存してください。');
            return;
        }

        // 少なくとも1つのオプションが選択されているか確認
        const hasAnyOption = Object.values(editOptions).some(opt =>
            typeof opt === 'object' && 'enabled' in opt ? opt.enabled : false
        );
        if (!hasAnyOption) {
            toast.error('変更する要素を1つ以上選択してください。');
            return;
        }

        setIsRestyling(true);
        setRestyleProgress({ current: 0, total: 0, message: '開始中...' });

        try {
            // デザイン定義を決定：ON → 解析結果、OFF → 手動入力（あれば）
            let finalDesignDef = undefined;
            if (useDesignDef && designDefinition) {
                finalDesignDef = designDefinition;
            } else if (!useDesignDef && customDesignInput.trim()) {
                // 手動入力をdescriptionとして送信
                finalDesignDef = { description: customDesignInput.trim() };
            }

            const response = await fetch(`/api/pages/${pageId}/restyle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    editOptions,
                    designDefinition: finalDesignDef,
                })
            });

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

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

                            if (data.type === 'progress') {
                                setRestyleProgress({
                                    current: data.current || 0,
                                    total: data.total || 0,
                                    message: data.message || ''
                                });
                            } else if (data.type === 'complete') {
                                toast.success(`${data.updatedCount}/${data.totalCount} セクションのスタイルを変更しました`);
                                setShowAIPanel(false);
                                router.refresh();
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
            toast.error(error.message || 'スタイル変更に失敗しました');
        } finally {
            setIsRestyling(false);
            setRestyleProgress({ current: 0, total: 0, message: '' });
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* フローティングツールバー */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl px-4 py-2 border border-gray-200">
                <button
                    onClick={() => setStatus(status === 'published' ? 'draft' : 'published')}
                    className={clsx(
                        "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                        status === 'published' ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"
                    )}
                >
                    {status === 'published' ? '公開中' : '下書き'}
                </button>
                <div className="w-px h-6 bg-gray-200" />
                <button
                    onClick={() => document.getElementById('file-upload-input')?.click()}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-all"
                    title="画像追加"
                >
                    <Plus className="h-4 w-4" />
                </button>
                <div className="w-px h-6 bg-gray-200" />
                <Link href={`/p/${initialSlug || pageId}`} target="_blank" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-all" title="新しいタブでプレビュー">
                    <Eye className="h-4 w-4" />
                </Link>
                <button
                    onClick={() => setShowDesktopPreview(true)}
                    disabled={sections.filter(s => s.image?.filePath).length === 0}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    title="デスクトッププレビュー"
                >
                    <Monitor className="h-4 w-4" />
                </button>
                <button onClick={handleExport} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-all" title="ZIPダウンロード">
                    <Download className="h-4 w-4" />
                </button>
                <button
                    onClick={() => setShowAIPanel(!showAIPanel)}
                    className={clsx(
                        "p-2 rounded-lg transition-all",
                        showAIPanel ? "bg-purple-100 text-purple-600" : "text-gray-500 hover:bg-gray-100"
                    )}
                    title="AIアシスタント"
                >
                    <Sparkles className="h-4 w-4" />
                </button>
                <button
                    onClick={() => {
                        if (boundaryFixMode) {
                            setBoundaryFixMode(false);
                            setSelectedBoundaries(new Set());
                        } else {
                            setBoundaryFixMode(true);
                            setBatchRegenerateMode(false);
                            setSelectedSectionsForRegenerate(new Set());
                        }
                    }}
                    disabled={sections.filter((s, i) => i < sections.length - 1 && s.image?.filePath && sections[i + 1]?.image?.filePath).length === 0}
                    className={clsx(
                        "p-2 rounded-lg transition-all",
                        boundaryFixMode ? "bg-purple-100 text-purple-600" : "text-gray-500 hover:bg-gray-100",
                        "disabled:opacity-30 disabled:cursor-not-allowed"
                    )}
                    title="境界修正"
                >
                    <Scissors className="h-4 w-4" />
                </button>
                <button
                    onClick={() => {
                        if (batchRegenerateMode) {
                            setBatchRegenerateMode(false);
                            setSelectedSectionsForRegenerate(new Set());
                        } else {
                            setBatchRegenerateMode(true);
                            setBoundaryFixMode(false);
                            setSelectedBoundaries(new Set());
                        }
                    }}
                    disabled={sections.filter(s => s.image?.filePath).length === 0}
                    className={clsx(
                        "p-2 rounded-lg transition-all",
                        batchRegenerateMode ? "bg-orange-100 text-orange-600" : "text-gray-500 hover:bg-gray-100",
                        "disabled:opacity-30 disabled:cursor-not-allowed"
                    )}
                    title="一括再生成（複数選択）"
                >
                    <RotateCw className="h-4 w-4" />
                </button>
                <div className="w-px h-6 bg-gray-200" />
                {/* 4Kボタン */}
                <button
                    onClick={() => setShow4KModal(true)}
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg transition-all"
                    title="4Kアップスケール＆文字修復"
                >
                    <span className="text-white font-black text-sm">4K</span>
                </button>
                {/* API消費メーター */}
                {apiCost && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
                        <span className="text-emerald-600 font-bold text-sm">¥</span>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500">今日</span>
                            <span className="font-bold text-emerald-700">¥{Math.round(apiCost.todayCost * 150).toLocaleString()}</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-gray-500">今月</span>
                            <span className="font-bold text-teal-700">¥{Math.round(apiCost.monthCost * 150).toLocaleString()}</span>
                        </div>
                    </div>
                )}
                <div className="w-px h-6 bg-gray-200" />
                <button
                    onClick={() => handleSave()}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                    {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>保存</span>
                </button>
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
            <div className="flex justify-center py-20 px-4">
                <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl bg-white shadow-2xl">
                    {/* ヘッダー - 設定がある場合のみ表示 */}
                    {(headerConfig.logoText || headerConfig.ctaText || (headerConfig.navItems && headerConfig.navItems.length > 0)) && (
                        <header className="flex h-16 items-center justify-between bg-white/90 px-4 shadow-sm backdrop-blur-md">
                            <div className="text-xl font-bold text-gray-900">
                                {headerConfig.logoText}
                            </div>
                            <nav className="hidden md:flex gap-6">
                                {headerConfig.navItems?.map((item: any) => (
                                    <span key={item.id} className="text-sm font-medium text-gray-700">
                                        {item.label}
                                    </span>
                                ))}
                            </nav>
                            {headerConfig.ctaText && (
                                <span className="rounded-full bg-blue-600 px-6 py-2 text-sm font-bold text-white">
                                    {headerConfig.ctaText}
                                </span>
                            )}
                        </header>
                    )}

                    {/* セクション - クリックで編集 */}
                    {sections.length === 0 ? (
                        <div className="h-96 flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300">
                            <Upload className="h-12 w-12 text-gray-400 mb-4" />
                            <p className="text-gray-500 font-medium mb-4">セクションを追加</p>
                            <div className="flex gap-3">
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
                            {/* 先頭にセクション追加ボタン */}
                            {!boundaryFixMode && sections.length > 0 && (
                                <div className="py-2 flex justify-center">
                                    <button
                                        onClick={() => {
                                            setAddSectionIndex(0);
                                            setShowAddSectionModal(true);
                                        }}
                                        className="group/add flex items-center gap-1 px-3 py-1.5 bg-white/80 hover:bg-blue-500 text-gray-400 hover:text-white text-xs font-bold rounded-full shadow transition-all hover:scale-110 border border-gray-200 hover:border-blue-500"
                                        title="先頭にセクションを追加"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span className="hidden group-hover/add:inline">先頭に追加</span>
                                    </button>
                                </div>
                            )}
                            {sections.map((section, sectionIndex) => (
                            <React.Fragment key={section.id}>
                                <div
                                    id={`section-${section.id}`}
                                    className={clsx(
                                        "relative group cursor-pointer",
                                        batchRegenerateMode && batchReferenceSection === section.id && "ring-4 ring-blue-500",
                                        batchRegenerateMode && selectedSectionsForRegenerate.has(section.id) && batchReferenceSection !== section.id && "ring-4 ring-orange-500"
                                    )}
                                    onClick={() => {
                                        if (batchRegenerateMode && section.image?.filePath) {
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
                                        } else if (section.image?.filePath) {
                                            handleOpenInpaint(
                                                section.id,
                                                section.image.filePath,
                                                section.mobileImage?.filePath
                                            );
                                        }
                                    }}
                                >
                                    {section.image?.filePath ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={section.image.filePath}
                                                alt={section.role}
                                                className="block w-full h-auto"
                                            />
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
                                            {/* ホバーオーバーレイ（一括再生成モード以外） */}
                                            <div className={clsx(
                                                "absolute inset-0 transition-all duration-200 flex items-center justify-center",
                                                batchRegenerateMode
                                                    ? selectedSectionsForRegenerate.has(section.id) ? "bg-orange-500/20" : "bg-black/0 hover:bg-orange-500/10"
                                                    : "bg-black/0 group-hover:bg-black/30"
                                            )}>
                                                <div className={clsx(
                                                    "transition-opacity duration-200 flex flex-col items-center gap-3",
                                                    batchRegenerateMode ? "hidden" : "opacity-0 group-hover:opacity-100"
                                                )}>
                                                    <div className="flex gap-3">
                                                        <div className="h-14 w-14 rounded-full bg-white flex items-center justify-center shadow-xl">
                                                            <Pencil className="h-6 w-6 text-gray-800" />
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenRegenerate(section.id);
                                                            }}
                                                            className="h-14 w-14 rounded-full bg-purple-600 flex items-center justify-center shadow-xl hover:bg-purple-700 transition-colors"
                                                            title="このセクションを再生成"
                                                        >
                                                            <RotateCw className="h-6 w-6 text-white" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRestoreSectionId(section.id);
                                                                setShowRestoreModal(true);
                                                            }}
                                                            className="h-14 w-14 rounded-full bg-green-600 flex items-center justify-center shadow-xl hover:bg-green-700 transition-colors"
                                                            title="カットしすぎた部分を復元"
                                                        >
                                                            <Expand className="h-6 w-6 text-white" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm('このセクションを削除しますか？')) {
                                                                    setSections(prev => prev.filter(s => s.id !== section.id));
                                                                    toast.success('セクションを削除しました');
                                                                }
                                                            }}
                                                            className="h-14 w-14 rounded-full bg-red-600 flex items-center justify-center shadow-xl hover:bg-red-700 transition-colors"
                                                            title="このセクションを削除"
                                                        >
                                                            <Trash2 className="h-6 w-6 text-white" />
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <span className="text-white text-xs font-bold bg-black/60 px-3 py-1.5 rounded-full">
                                                            編集
                                                        </span>
                                                        <span className="text-white text-xs font-bold bg-purple-600/80 px-3 py-1.5 rounded-full">
                                                            再生成
                                                        </span>
                                                        <span className="text-white text-xs font-bold bg-green-600/80 px-3 py-1.5 rounded-full">
                                                            復元
                                                        </span>
                                                        <span className="text-white text-xs font-bold bg-red-600/80 px-3 py-1.5 rounded-full">
                                                            削除
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* 履歴ボタン */}
                                            {editHistory[section.id]?.length > 0 && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowHistoryPanel(section.id);
                                                    }}
                                                    className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-white/90 hover:bg-white text-gray-700 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg transition-all hover:scale-105"
                                                    title="編集履歴"
                                                >
                                                    <Undo2 className="h-3.5 w-3.5" />
                                                    <span>履歴</span>
                                                    <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">
                                                        {editHistory[section.id].length}
                                                    </span>
                                                </button>
                                            )}
                                            {/* ローディング */}
                                            {(generatingImageSectionIds.has(section.id) || editingSectionIds.has(section.id) || regeneratingSectionIds.has(section.id)) && (
                                                <div className="absolute inset-0 bg-purple-600/80 flex flex-col items-center justify-center gap-2">
                                                    <RefreshCw className="h-10 w-10 text-white animate-spin" />
                                                    {regeneratingSectionIds.has(section.id) && (
                                                        <span className="text-white text-sm font-bold">再生成中...</span>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="h-48 bg-gray-100 flex items-center justify-center">
                                            <span className="text-gray-400">画像なし</span>
                                        </div>
                                    )}
                                </div>
                                {/* 境界差し替えチェックボックス（モード時のみ表示） */}
                                {boundaryFixMode &&
                                 sectionIndex < sections.length - 1 &&
                                 section.image?.filePath &&
                                 sections[sectionIndex + 1].image?.filePath && (
                                    <div className="relative h-0 z-10">
                                        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
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
                                                className={clsx(
                                                    "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full shadow-lg transition-all hover:scale-105 border-2",
                                                    selectedBoundaries.has(sectionIndex)
                                                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-white"
                                                        : "bg-white text-gray-600 border-gray-300 hover:border-purple-400"
                                                )}
                                            >
                                                {selectedBoundaries.has(sectionIndex) ? (
                                                    <Check className="h-4 w-4" />
                                                ) : (
                                                    <Scissors className="h-4 w-4" />
                                                )}
                                                境界 {sectionIndex + 1}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {/* セクション追加ボタン（境界修正モードでない時に表示） */}
                                {!boundaryFixMode && sectionIndex < sections.length - 1 && (
                                    <div className="relative h-0 z-10">
                                        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setAddSectionIndex(sectionIndex + 1);
                                                    setShowAddSectionModal(true);
                                                }}
                                                className="group/add flex items-center gap-1 px-3 py-1.5 bg-white/80 hover:bg-blue-500 text-gray-400 hover:text-white text-xs font-bold rounded-full shadow-lg transition-all hover:scale-110 border border-gray-200 hover:border-blue-500"
                                                title="ここにセクションを追加"
                                            >
                                                <Plus className="h-4 w-4" />
                                                <span className="hidden group-hover/add:inline">追加</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                        </>
                    )}

                    {/* 最後にセクション追加ボタン */}
                    {!boundaryFixMode && sections.length > 0 && (
                        <div className="py-4 flex justify-center">
                            <button
                                onClick={() => {
                                    setAddSectionIndex(sections.length);
                                    setShowAddSectionModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-blue-500 text-gray-500 hover:text-white text-sm font-bold rounded-full shadow-lg transition-all hover:scale-105 border border-gray-200 hover:border-blue-500"
                            >
                                <Plus className="h-5 w-5" />
                                セクションを追加
                            </button>
                        </div>
                    )}

                    {/* フッター */}
                    <footer className="bg-gray-900 py-8 text-center text-white">
                        <p className="text-sm opacity-70">&copy; {new Date().getFullYear()} {headerConfig.logoText}. All rights reserved.</p>
                    </footer>
                </div>
            </div>

            {/* 境界修正モードのフローティングアクションバー */}
            {boundaryFixMode && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom duration-300">
                    <div className="flex items-center gap-3 bg-white rounded-2xl shadow-2xl border border-gray-200 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <Scissors className="h-4 w-4 text-purple-500" />
                            <span>境界修正</span>
                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                {selectedBoundaries.size}件選択中
                            </span>
                        </div>
                        <div className="h-6 w-px bg-gray-200" />
                        <button
                            onClick={() => {
                                // 全選択/全解除
                                const allBoundaryIndices = sections
                                    .map((s, i) => i)
                                    .filter(i => i < sections.length - 1 && sections[i].image?.filePath && sections[i + 1].image?.filePath);
                                if (selectedBoundaries.size === allBoundaryIndices.length) {
                                    setSelectedBoundaries(new Set());
                                } else {
                                    setSelectedBoundaries(new Set(allBoundaryIndices));
                                }
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            {selectedBoundaries.size === sections.filter((s, i) => i < sections.length - 1 && s.image?.filePath && sections[i + 1]?.image?.filePath).length
                                ? '全解除'
                                : '全選択'}
                        </button>
                        <button
                            onClick={() => {
                                setBoundaryFixMode(false);
                                setSelectedBoundaries(new Set());
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={() => {
                                if (selectedBoundaries.size > 0) {
                                    setShowBoundaryFixModal(true);
                                }
                            }}
                            disabled={selectedBoundaries.size === 0}
                            className="px-4 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                            <Scissors className="h-3.5 w-3.5" />
                            修正実行
                        </button>
                    </div>
                </div>
            )}

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
                            <RefreshCw className="h-4 w-4 text-orange-500" />
                            <span>対象</span>
                            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-bold">
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
                            onClick={() => {
                                if (selectedSectionsForRegenerate.size > 0) {
                                    console.log('Opening modal with reference section:', batchReferenceSection);
                                    setShowBatchRegenerateModal(true);
                                }
                            }}
                            disabled={selectedSectionsForRegenerate.size === 0}
                            className="px-4 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-lg hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            再生成実行
                        </button>
                    </div>
                </div>
            )}

            {/* AIアシスタントパネル（たたみ可能） - ページ丸ごと編集 */}
            <div className={clsx(
                "fixed bottom-0 left-0 right-0 bg-white shadow-2xl border-t border-gray-200 transform transition-transform duration-300 z-40",
                showAIPanel ? "translate-y-0" : "translate-y-full"
            )}>
                <div className="max-w-3xl mx-auto p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-500" />
                                ページ丸ごと編集
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">デザインの雰囲気を維持したまま、レイアウトやカラーを変更</p>
                        </div>
                        <button onClick={() => setShowAIPanel(false)} className="p-2 text-gray-400 hover:text-gray-600">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* 処理中の表示 */}
                    {isRestyling ? (
                        <div className="py-8">
                            <div className="flex flex-col items-center justify-center gap-4">
                                <RefreshCw className="h-10 w-10 text-purple-600 animate-spin" />
                                <p className="text-sm font-medium text-gray-600">{restyleProgress.message}</p>
                                {restyleProgress.total > 0 && (
                                    <div className="w-full max-w-xs">
                                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-purple-600 transition-all duration-300"
                                                style={{ width: `${(restyleProgress.current / restyleProgress.total) * 100}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-400 text-center mt-2">
                                            {restyleProgress.current} / {restyleProgress.total}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* デザイン定義セクション */}
                            <div className="p-3 rounded-xl border-2 border-gray-100 bg-gray-50">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-gray-600">デザイン定義</span>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <span className="text-xs text-gray-500">{useDesignDef ? '解析結果を使用' : '手動入力'}</span>
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={useDesignDef}
                                                onChange={(e) => setUseDesignDef(e.target.checked)}
                                                className="sr-only"
                                            />
                                            <div className={clsx(
                                                "w-10 h-5 rounded-full transition-colors",
                                                useDesignDef ? "bg-purple-600" : "bg-gray-300"
                                            )}>
                                                <div className={clsx(
                                                    "w-4 h-4 bg-white rounded-full shadow transform transition-transform mt-0.5",
                                                    useDesignDef ? "translate-x-5" : "translate-x-0.5"
                                                )} />
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                {useDesignDef ? (
                                    designDefinition ? (
                                        <div className="text-xs text-gray-600 bg-white p-2 rounded-lg border border-gray-200 max-h-24 overflow-y-auto">
                                            {designDefinition.vibe && <p><span className="font-medium">雰囲気:</span> {designDefinition.vibe}</p>}
                                            {designDefinition.description && <p className="mt-1"><span className="font-medium">特徴:</span> {designDefinition.description}</p>}
                                            {designDefinition.colorPalette && (
                                                <div className="mt-1 flex items-center gap-1">
                                                    <span className="font-medium">カラー:</span>
                                                    {designDefinition.colorPalette.primary && (
                                                        <span className="inline-block w-3 h-3 rounded-full border" style={{ backgroundColor: designDefinition.colorPalette.primary }} />
                                                    )}
                                                    {designDefinition.colorPalette.secondary && (
                                                        <span className="inline-block w-3 h-3 rounded-full border" style={{ backgroundColor: designDefinition.colorPalette.secondary }} />
                                                    )}
                                                    {designDefinition.colorPalette.accent && (
                                                        <span className="inline-block w-3 h-3 rounded-full border" style={{ backgroundColor: designDefinition.colorPalette.accent }} />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-400 italic">
                                            解析されたデザイン定義がありません。
                                            <button
                                                onClick={analyzeCurrentDesign}
                                                disabled={isAnalyzing}
                                                className="text-purple-600 hover:underline ml-1"
                                            >
                                                {isAnalyzing ? '解析中...' : '今すぐ解析'}
                                            </button>
                                        </div>
                                    )
                                ) : (
                                    <textarea
                                        value={customDesignInput}
                                        onChange={(e) => setCustomDesignInput(e.target.value)}
                                        placeholder="デザインの雰囲気を入力（例：モダンでクリーンな印象、青を基調としたプロフェッショナルなデザイン）"
                                        className="w-full text-xs p-2 border border-gray-200 rounded-lg resize-none h-16 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                )}
                            </div>

                            <p className="text-xs font-bold text-gray-500">変更する要素を選択：</p>

                            {/* 人物・写真 */}
                            <div className={clsx(
                                "p-3 rounded-xl border-2 transition-all",
                                editOptions.people.enabled ? "border-purple-300 bg-purple-50" : "border-gray-100 bg-white"
                            )}>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editOptions.people.enabled}
                                        onChange={(e) => setEditOptions(prev => ({
                                            ...prev,
                                            people: { ...prev.people, enabled: e.target.checked }
                                        }))}
                                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-sm font-bold text-gray-800">人物・写真</span>
                                </label>
                                {editOptions.people.enabled && (
                                    <div className="mt-2 ml-7 flex gap-2">
                                        {[
                                            { id: 'similar', label: '同じ雰囲気の別人物' },
                                            { id: 'different', label: '完全に異なるイメージ' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setEditOptions(prev => ({
                                                    ...prev,
                                                    people: { ...prev.people, mode: opt.id as 'similar' | 'different' }
                                                }))}
                                                className={clsx(
                                                    "px-3 py-1.5 text-xs rounded-lg transition-all",
                                                    editOptions.people.mode === opt.id
                                                        ? "bg-purple-600 text-white"
                                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* テキスト・コピー */}
                            <div className={clsx(
                                "p-3 rounded-xl border-2 transition-all",
                                editOptions.text.enabled ? "border-purple-300 bg-purple-50" : "border-gray-100 bg-white"
                            )}>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editOptions.text.enabled}
                                        onChange={(e) => setEditOptions(prev => ({
                                            ...prev,
                                            text: { ...prev.text, enabled: e.target.checked }
                                        }))}
                                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-sm font-bold text-gray-800">テキスト・コピー</span>
                                </label>
                                {editOptions.text.enabled && (
                                    <div className="mt-2 ml-7 flex flex-wrap gap-2">
                                        {[
                                            { id: 'nuance', label: 'ニュアンス程度' },
                                            { id: 'copywriting', label: 'コピーライティング改善' },
                                            { id: 'rewrite', label: '完全に書き換え' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setEditOptions(prev => ({
                                                    ...prev,
                                                    text: { ...prev.text, mode: opt.id as 'nuance' | 'copywriting' | 'rewrite' }
                                                }))}
                                                className={clsx(
                                                    "px-3 py-1.5 text-xs rounded-lg transition-all",
                                                    editOptions.text.mode === opt.id
                                                        ? "bg-purple-600 text-white"
                                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 模様・パターン・背景 */}
                            <div className={clsx(
                                "p-3 rounded-xl border-2 transition-all",
                                editOptions.pattern.enabled ? "border-purple-300 bg-purple-50" : "border-gray-100 bg-white"
                            )}>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editOptions.pattern.enabled}
                                        onChange={(e) => setEditOptions(prev => ({
                                            ...prev,
                                            pattern: { enabled: e.target.checked }
                                        }))}
                                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-sm font-bold text-gray-800">模様・パターン・背景</span>
                                </label>
                            </div>

                            {/* オブジェクト・アイコン */}
                            <div className={clsx(
                                "p-3 rounded-xl border-2 transition-all",
                                editOptions.objects.enabled ? "border-purple-300 bg-purple-50" : "border-gray-100 bg-white"
                            )}>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editOptions.objects.enabled}
                                        onChange={(e) => setEditOptions(prev => ({
                                            ...prev,
                                            objects: { enabled: e.target.checked }
                                        }))}
                                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-sm font-bold text-gray-800">オブジェクト・アイコン</span>
                                </label>
                            </div>

                            {/* カラー・配色 */}
                            <div className={clsx(
                                "p-3 rounded-xl border-2 transition-all",
                                editOptions.color.enabled ? "border-purple-300 bg-purple-50" : "border-gray-100 bg-white"
                            )}>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editOptions.color.enabled}
                                        onChange={(e) => setEditOptions(prev => ({
                                            ...prev,
                                            color: { ...prev.color, enabled: e.target.checked }
                                        }))}
                                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-sm font-bold text-gray-800">カラー・配色</span>
                                </label>
                                {editOptions.color.enabled && (
                                    <div className="mt-2 ml-7 flex flex-wrap gap-2">
                                        {[
                                            { id: 'blue', label: 'ブルー', color: 'bg-blue-500' },
                                            { id: 'green', label: 'グリーン', color: 'bg-green-500' },
                                            { id: 'purple', label: 'パープル', color: 'bg-purple-500' },
                                            { id: 'orange', label: 'オレンジ', color: 'bg-orange-500' },
                                            { id: 'monochrome', label: 'モノクロ', color: 'bg-gray-800' },
                                        ].map((c) => (
                                            <button
                                                key={c.id}
                                                onClick={() => setEditOptions(prev => ({
                                                    ...prev,
                                                    color: { ...prev.color, scheme: c.id }
                                                }))}
                                                className={clsx(
                                                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all border-2 text-xs",
                                                    editOptions.color.scheme === c.id
                                                        ? "border-purple-500 bg-purple-100"
                                                        : "border-gray-100 hover:border-gray-200 bg-white"
                                                )}
                                            >
                                                <span className={`h-3 w-3 rounded-full ${c.color}`} />
                                                <span className="font-medium text-gray-700">{c.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* レイアウト・構成 */}
                            <div className={clsx(
                                "p-3 rounded-xl border-2 transition-all",
                                editOptions.layout.enabled ? "border-purple-300 bg-purple-50" : "border-gray-100 bg-white"
                            )}>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editOptions.layout.enabled}
                                        onChange={(e) => setEditOptions(prev => ({
                                            ...prev,
                                            layout: { enabled: e.target.checked }
                                        }))}
                                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-sm font-bold text-gray-800">レイアウト・構成</span>
                                </label>
                            </div>

                            {/* 適用ボタン */}
                            <button
                                onClick={handleRestyle}
                                disabled={pageId === 'new' || sections.length === 0}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3.5 rounded-xl text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 mt-4"
                            >
                                <Sparkles className="h-4 w-4" />
                                選択した要素を一括変更
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 編集履歴パネル */}
            {showHistoryPanel && editHistory[showHistoryPanel] && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
                    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
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
                            <div className="grid grid-cols-3 gap-4">
                                {editHistory[showHistoryPanel].map((item, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleRestoreVersion(showHistoryPanel, index)}
                                        className="group relative aspect-[9/16] bg-gray-100 rounded-xl overflow-hidden border-2 border-transparent hover:border-purple-500 transition-all"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={item.image.filePath}
                                            alt={`バージョン ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                            <span className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 px-3 py-1.5 rounded-full text-xs font-bold transition-opacity">
                                                この状態に戻す
                                            </span>
                                        </div>
                                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                            <span className="bg-black/60 text-white px-2 py-1 rounded text-[10px] font-bold">
                                                v{index + 1}
                                            </span>
                                            <span className="bg-black/60 text-white px-2 py-1 rounded text-[10px]" suppressHydrationWarning>
                                                {new Date(item.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* デスクトッププレビューモーダル */}
            {showDesktopPreview && (
                <div className="fixed inset-0 z-[100] bg-gray-900">
                    {/* ヘッダー */}
                    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-gray-900 to-transparent">
                        <div className="flex items-center gap-3">
                            <Monitor className="h-5 w-5 text-white" />
                            <span className="text-white font-bold">デスクトッププレビュー</span>
                            <span className="text-gray-400 text-sm">（実際の表示サイズ）</span>
                        </div>
                        <button
                            onClick={() => setShowDesktopPreview(false)}
                            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    {/* プレビューコンテンツ */}
                    <div className="h-full overflow-y-auto pt-16 pb-8 flex justify-center">
                        <div className="w-full max-w-[1440px] bg-white shadow-2xl">
                            {sections.filter(s => s.image?.filePath).map((section, index) => (
                                <div key={section.id} className="relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={section.image?.filePath}
                                        alt={`セクション ${index + 1}`}
                                        className="w-full h-auto"
                                        style={{ display: 'block' }}
                                    />
                                    {/* セクション番号バッジ */}
                                    <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1.5 rounded-full text-sm font-bold">
                                        Section {index + 1}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* フッター情報 */}
                    <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-4 py-4 bg-gradient-to-t from-gray-900 to-transparent">
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
                                    {isGeneratingSectionImage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
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
                                <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                    <Wand2 className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900"><span>AIで画像を編集</span></h3>
                                    <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest"><span>Powered by Nano Banana</span></p>
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
                                        className="w-full min-h-[150px] rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium outline-none focus:bg-white focus:ring-4 focus:ring-purple-50 transition-all shadow-inner"
                                        placeholder="例: この電力会社のLPを、熱々の冷凍餃子の販促用に作り変えてください。ターゲットは主婦層で、シズル感を重視。色味はオレンジ系の暖色で。"
                                    />
                                </div>

                                {aiProductInfo && (
                                    <div className="rounded-xl bg-purple-50 p-3 border border-purple-100">
                                        <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">
                                            <span>プロモーション情報（自動適用）</span>
                                        </p>
                                        <p className="text-xs text-purple-700 line-clamp-2">{aiProductInfo}</p>
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
                                    className="flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-purple-600 py-3.5 text-sm font-black text-white shadow-xl shadow-purple-100 hover:bg-purple-700 disabled:opacity-50 transition-all"
                                >
                                    {isEditingImage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                    <span>{isEditingImage ? '編集中...' : '画像を編集'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Copilot サイドパネル */}
            <div className={`fixed right-0 top-0 h-full w-[400px] bg-white border-l border-gray-200 shadow-2xl transform transition-transform duration-300 z-50 flex flex-col ${showCopilot ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* ヘッダー */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                            <MessageCircle className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900">Prompt Copilot</h3>
                            <p className="text-[10px] text-gray-400">AI-powered prompt assistant</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCopilot(false)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* チャットメッセージエリア */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatMessages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-800'
                                }`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                {/* プロンプト例がある場合は「使う」ボタンを表示 */}
                                {msg.role === 'assistant' && extractPromptExample(msg.content) && (
                                    <button
                                        onClick={() => handleUsePrompt(extractPromptExample(msg.content)!)}
                                        className="mt-3 flex items-center gap-2 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors"
                                    >
                                        {copiedPrompt === extractPromptExample(msg.content) ? (
                                            <>
                                                <Check className="h-3 w-3" />
                                                <span>プロンプトに追加しました</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="h-3 w-3" />
                                                <span>このプロンプトを使う</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {isChatLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 rounded-2xl px-4 py-3">
                                <div className="flex items-center gap-2 text-gray-500">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* クイックアクション */}
                <div className="px-4 py-2 border-t border-gray-100">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {[
                            'プロンプトを作って',
                            'もっと具体的に',
                            'ターゲット層は？',
                            '色味を変えたい'
                        ].map((suggestion) => (
                            <button
                                key={suggestion}
                                onClick={() => {
                                    setChatInput(suggestion);
                                }}
                                className="flex-shrink-0 px-3 py-1.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 入力エリア */}
                <div className="p-4 border-t border-gray-100">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                            placeholder="メッセージを入力..."
                            className="flex-1 px-4 py-3 rounded-xl bg-gray-100 text-sm outline-none focus:bg-gray-50 focus:ring-2 focus:ring-violet-500 transition-all"
                        />
                        <button
                            onClick={handleSendChat}
                            disabled={!chatInput.trim() || isChatLoading}
                            className="h-12 w-12 rounded-xl bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-200"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
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
                    }}
                    onSave={handleInpaintSave}
                    sectionId={inpaintSectionId}
                    clickableAreas={sections.find(s => s.id === inpaintSectionId)?.config?.clickableAreas || []}
                    mobileClickableAreas={sections.find(s => s.id === inpaintSectionId)?.config?.mobileClickableAreas || []}
                    onSaveClickableAreas={handleSaveClickableAreas}
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

            {/* セクション復元モーダル */}
            {showRestoreModal && restoreSectionId && (
                <RestoreModal
                    sectionId={restoreSectionId}
                    imageUrl={sections.find(s => s.id === restoreSectionId)?.image?.filePath || ''}
                    onClose={() => {
                        setShowRestoreModal(false);
                        setRestoreSectionId(null);
                    }}
                    onSuccess={(newImageUrl) => {
                        // セクションの画像を更新
                        setSections(prev => prev.map(s =>
                            s.id === restoreSectionId
                                ? { ...s, image: { ...s.image, filePath: newImageUrl } }
                                : s
                        ));
                        setShowRestoreModal(false);
                        setRestoreSectionId(null);
                    }}
                />
            )}

            {/* セクション追加モーダル */}
            {showAddSectionModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
                        {/* ヘッダー */}
                        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                    <Plus className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">セクションを追加</h2>
                                    <p className="text-xs text-gray-500">
                                        {addSectionIndex === 0 ? '先頭' : addSectionIndex === sections.length ? '末尾' : `${addSectionIndex}番目`}に挿入
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowAddSectionModal(false);
                                    setAddSectionPrompt('');
                                }}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {isAddingSection ? (
                            <div className="p-8 flex flex-col items-center justify-center">
                                <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
                                <p className="text-sm font-medium text-gray-700">セクションを生成中...</p>
                                <p className="text-xs text-gray-500 mt-2">AIが画像を生成しています</p>
                            </div>
                        ) : (
                            <>
                                <div className="p-5 space-y-4">
                                    {/* デザイン定義がある場合は表示 */}
                                    {designDefinition && (
                                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                            <div className="flex items-center gap-2 text-sm text-green-700">
                                                <Palette className="h-4 w-4" />
                                                <span className="font-medium">デザイン定義を適用します</span>
                                            </div>
                                            <p className="text-xs text-green-600 mt-1">
                                                {designDefinition.vibe || '統一されたスタイル'}
                                            </p>
                                        </div>
                                    )}

                                    {/* 生成内容 */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5">
                                            生成内容 <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            value={addSectionPrompt}
                                            onChange={(e) => setAddSectionPrompt(e.target.value)}
                                            placeholder="例: 3つの特徴を並べたセクション。アイコン付きで、タイトルと説明文を含む。背景は薄いグレー。"
                                            rows={4}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">
                                            どんなセクションを追加したいか、内容やレイアウトを具体的に説明してください
                                        </p>
                                    </div>

                                    {/* クイックテンプレート */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2">
                                            クイックテンプレート
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { label: '特徴セクション', prompt: '3つの特徴をアイコン付きで横並びに配置。各特徴にはタイトルと短い説明文。' },
                                                { label: 'CTAセクション', prompt: '目立つボタン付きのコールトゥアクションセクション。キャッチコピーと補足テキスト。' },
                                                { label: '料金プラン', prompt: '3つの料金プランを横並びで表示。各プランに価格、特徴リスト、申込ボタン。' },
                                                { label: 'FAQ', prompt: 'よくある質問セクション。Q&A形式で3〜4問程度。アコーディオン風のデザイン。' },
                                            ].map((template) => (
                                                <button
                                                    key={template.label}
                                                    onClick={() => setAddSectionPrompt(template.prompt)}
                                                    className="px-3 py-2 text-xs text-left bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors"
                                                >
                                                    {template.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* フッター */}
                                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t bg-gray-50">
                                    <button
                                        onClick={() => {
                                            setShowAddSectionModal(false);
                                            setAddSectionPrompt('');
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                                    >
                                        キャンセル
                                    </button>
                                    <button
                                        onClick={handleAddSection}
                                        disabled={!addSectionPrompt.trim()}
                                        className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <Sparkles className="h-4 w-4" />
                                        生成して追加
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* 4Kアップスケールモーダル */}
            {show4KModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-sm bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
                        {is4KProcessing && upscale4KProgress ? (
                            <div className="p-8">
                                {/* シンプルな進捗表示 */}
                                <div className="text-center">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
                                        <span className="text-2xl font-black text-white">4K</span>
                                    </div>
                                    <div className="text-4xl font-black text-white mb-2">
                                        {upscale4KProgress.current}<span className="text-gray-500 text-2xl">/{upscale4KProgress.total}</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-1 mb-4">
                                        <div
                                            className="bg-white h-1 rounded-full transition-all duration-500"
                                            style={{ width: `${upscale4KProgress.total > 0 ? (upscale4KProgress.current / upscale4KProgress.total) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <p className="text-gray-400 text-sm">処理中...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6">
                                <div className="text-center mb-6">
                                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-800 mb-3">
                                        <span className="text-xl font-black text-white">4K</span>
                                    </div>
                                    <h2 className="text-white font-bold text-lg">高解像度化</h2>
                                    <p className="text-gray-500 text-xs mt-1">{sections.filter(s => s.image?.filePath).length}セクション</p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShow4KModal(false)}
                                        className="flex-1 px-4 py-3 bg-gray-800 text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                                    >
                                        キャンセル
                                    </button>
                                    <button
                                        onClick={handle4KUpscale}
                                        disabled={sections.filter(s => s.image?.filePath).length === 0}
                                        className="flex-1 px-4 py-3 bg-white text-gray-900 text-sm font-bold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                                    >
                                        実行
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
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

                            <div className="mt-8 flex gap-3">
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
                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
                        {/* ヘッダー */}
                        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-orange-50 to-red-50">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center">
                                    <RefreshCw className="h-5 w-5 text-orange-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">一括再生成</h2>
                                    <p className="text-xs text-gray-500">
                                        {selectedSectionsForRegenerate.size}件選択中
                                        {batchReferenceSection && selectedSectionsForRegenerate.has(batchReferenceSection) &&
                                            `（参照1件 + 対象${selectedSectionsForRegenerate.size - 1}件）`
                                        }
                                    </p>
                                </div>
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
                                <RefreshCw className="h-10 w-10 text-orange-600 animate-spin mb-4" />
                                <p className="text-sm font-medium text-gray-700">再生成中...</p>
                                {batchRegenerateProgress && (
                                    <div className="w-full max-w-xs mt-4">
                                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-orange-500 transition-all duration-300"
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
                            <div className="p-5 space-y-4">
                                {/* 参照セクション選択（全セクションから選ぶ） */}
                                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Palette className="h-4 w-4 text-blue-600" />
                                        <span className="font-bold text-blue-800 text-sm">参照スタイルを選択（任意）</span>
                                    </div>
                                    <p className="text-xs text-blue-600 mb-3">
                                        「お手本」にしたいセクションを選択。選択した{selectedSectionsForRegenerate.size}件がこのスタイルに合わせて再生成されます。
                                    </p>
                                    <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto">
                                        {/* 選択なしオプション */}
                                        <button
                                            onClick={() => setBatchReferenceSection(null)}
                                            className={clsx(
                                                "px-3 py-2 rounded-lg text-xs font-medium transition-all border-2 h-16 flex items-center",
                                                !batchReferenceSection
                                                    ? "border-blue-500 bg-blue-100 text-blue-700"
                                                    : "border-gray-200 bg-white text-gray-600 hover:border-blue-300"
                                            )}
                                        >
                                            なし
                                        </button>
                                        {/* 全セクションを参照候補として表示（画像があるもののみ） */}
                                        {sections.filter(s => s.image?.filePath).map((sec, idx) => {
                                            const isTarget = selectedSectionsForRegenerate.has(sec.id);
                                            return (
                                                <button
                                                    key={sec.id}
                                                    onClick={() => setBatchReferenceSection(sec.id)}
                                                    className={clsx(
                                                        "relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0",
                                                        batchReferenceSection === sec.id
                                                            ? "border-blue-500 ring-2 ring-blue-300"
                                                            : isTarget
                                                                ? "border-orange-300 hover:border-blue-300"
                                                                : "border-gray-200 hover:border-blue-300"
                                                    )}
                                                    title={`セクション ${idx + 1} を参照に設定`}
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={sec.image?.filePath}
                                                        alt={`セクション ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    {batchReferenceSection === sec.id && (
                                                        <div className="absolute inset-0 bg-blue-500/40 flex items-center justify-center">
                                                            <Check className="h-6 w-6 text-white drop-shadow-lg" />
                                                        </div>
                                                    )}
                                                    {isTarget && batchReferenceSection !== sec.id && (
                                                        <div className="absolute bottom-0 left-0 right-0 bg-orange-500 text-white text-[8px] text-center py-0.5">
                                                            対象
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {batchReferenceSection && (
                                        <>
                                            <p className="text-xs text-blue-700 mt-2 font-medium">
                                                ✓ 参照セクションのスタイルを{regenerateReferenceAlso ? selectedSectionsForRegenerate.size : selectedSectionsForRegenerate.size - (selectedSectionsForRegenerate.has(batchReferenceSection) ? 1 : 0)}件に適用します
                                            </p>
                                            {/* 参照セクションも再生成するオプション */}
                                            <label className="flex items-center gap-2 mt-3 pt-3 border-t border-blue-200 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={regenerateReferenceAlso}
                                                    onChange={(e) => setRegenerateReferenceAlso(e.target.checked)}
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-xs text-blue-800">
                                                    参照セクションも一緒に再生成する
                                                    <span className="text-blue-600 ml-1">（一貫性を高めるため）</span>
                                                </span>
                                            </label>
                                        </>
                                    )}
                                </div>

                                {/* デザイン定義を使用（参照セクションがない場合のみ表示） */}
                                {!batchReferenceSection && designDefinition && (
                                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={batchRegenerateStyle === 'design-definition'}
                                                onChange={(e) => setBatchRegenerateStyle(e.target.checked ? 'design-definition' : 'sampling')}
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
                                {batchRegenerateStyle !== 'design-definition' && (
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
                                                    onClick={() => setBatchRegenerateStyle(s.id)}
                                                    className={clsx(
                                                        "px-3 py-2 rounded-lg text-sm font-medium transition-all border-2",
                                                        batchRegenerateStyle === s.id
                                                            ? "border-orange-500 bg-orange-50 text-orange-700"
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
                                                onClick={() => setBatchRegenerateColorScheme(c.id)}
                                                className={clsx(
                                                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-all border-2",
                                                    batchRegenerateColorScheme === c.id
                                                        ? "border-orange-500 bg-orange-50"
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
                                            onClick={() => setBatchRegenerateGenerationMode('light')}
                                            className={clsx(
                                                "px-3 py-2 rounded-lg text-sm font-medium transition-all border-2",
                                                batchRegenerateGenerationMode === 'light'
                                                    ? "border-orange-500 bg-orange-50 text-orange-700"
                                                    : "border-gray-100 hover:border-gray-200 text-gray-600"
                                            )}
                                        >
                                            色だけ変更
                                        </button>
                                        <button
                                            onClick={() => setBatchRegenerateGenerationMode('heavy')}
                                            className={clsx(
                                                "px-3 py-2 rounded-lg text-sm font-medium transition-all border-2",
                                                batchRegenerateGenerationMode === 'heavy'
                                                    ? "border-orange-500 bg-orange-50 text-orange-700"
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
                                        value={batchRegeneratePrompt}
                                        onChange={(e) => setBatchRegeneratePrompt(e.target.value)}
                                        placeholder="例: 背景を明るく、ボタンを大きく"
                                        className="w-full h-20 rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                    />
                                </div>

                                {/* 実行ボタン */}
                                <div className="pt-4 flex gap-3">
                                    <button
                                        onClick={() => setShowBatchRegenerateModal(false)}
                                        className="flex-1 rounded-2xl py-3.5 text-sm font-bold text-gray-400 hover:bg-gray-50 transition-all"
                                    >
                                        キャンセル
                                    </button>
                                    <button
                                        onClick={handleBatchRegenerate}
                                        disabled={batchReferenceSection ? selectedSectionsForRegenerate.size <= 1 : selectedSectionsForRegenerate.size === 0}
                                        className="flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 py-3.5 text-sm font-black text-white shadow-xl hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                        {batchReferenceSection
                                            ? `${selectedSectionsForRegenerate.size - (selectedSectionsForRegenerate.has(batchReferenceSection) ? 1 : 0)}件を再生成`
                                            : `${selectedSectionsForRegenerate.size}件を再生成`
                                        }
                                    </button>
                                </div>
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

        </div>
    );
}
