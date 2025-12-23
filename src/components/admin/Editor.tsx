"use client";

import React, { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from '@/components/admin/SortableItem';
import { ImageInpaintEditor } from '@/components/lp-builder/ImageInpaintEditor';
import { GripVertical, Trash2, X, Upload, Sparkles, RefreshCw, Sun, Contrast, Droplet, Palette, Save, Eye, Plus, Download, Github, Loader2, Wand2, MessageCircle, Send, Copy, Check, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

interface EditorProps {
    pageId: string;
    initialSections: any[];
    initialHeaderConfig: any;
    initialSlug: string;
    initialStatus?: string;
}

export default function Editor({ pageId, initialSections, initialHeaderConfig, initialSlug, initialStatus = 'draft' }: EditorProps) {
    const router = useRouter();
    const [sections, setSections] = useState(initialSections);
    const [headerConfig, setHeaderConfig] = useState(() => {
        const base = {
            logoText: '私のLP',
            sticky: true,
            ctaText: 'お問い合わせ',
            ctaLink: '#contact',
            navItems: [
                { id: '1', label: 'トップ', href: '#hero' },
                { id: '2', label: '特徴', href: '#solution' },
                { id: '3', label: '料金', href: '#pricing' }
            ]
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

    // 画像一括生成中のセクションID
    const [generatingImageSectionIds, setGeneratingImageSectionIds] = useState<Set<string>>(new Set());

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
                }))
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
                alert(`AIは${data.length}件のセクションを生成しましたが、編集中のセクションIDと一致しませんでした。マッピングに失敗しています。`);
            } else {
                setSections(updatedSections);
                alert(`${matchCount}件のセクションを新しい商材内容にリブランディングしました！`);
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

            // 3. オプション: 画像の一括生成
            if (shouldGenImages) {
                // 全セクションを生成中としてマーク
                const allSectionIds = new Set(updatedSections.filter(s => s.config?.text).map(s => s.id));
                setGeneratingImageSectionIds(allSectionIds);

                for (const section of updatedSections) {
                    if (section.config?.text) {
                        try {
                            const imgRes = await fetch('/api/ai/generate-image', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    prompt: section.config.text,
                                    taste: aiTaste,
                                    brandInfo: aiProductInfo,
                                    aspectRatio: aiAspectRatio
                                })
                            });
                            const media = await imgRes.json();
                            if (media.id) {
                                setSections((prev: any[]) => prev.map(s => s.id === section.id ? { ...s, imageId: media.id, image: media } : s));
                            }
                        } catch (e) {
                            console.error(`セクション ${section.id} の画像生成に失敗しました:`, e);
                        } finally {
                            // このセクションの生成完了
                            setGeneratingImageSectionIds(prev => {
                                const next = new Set(prev);
                                next.delete(section.id);
                                return next;
                            });
                        }
                    }
                }
            }
            // 4. 自動保存
            await handleSave();
            alert('リブランディング完了！ページを保存しました。');

        } catch (error: any) {
            alert(error.message || 'AI生成に失敗しました。');
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
            alert('画像生成に失敗しました。');
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
            alert('編集する画像がありません。');
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
            alert('画像を編集しました！');

        } catch (error: any) {
            console.error('画像編集エラー:', error);
            alert(error.message || '画像編集に失敗しました。');
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
    const handleOpenInpaint = (sectionId: string, imageUrl: string) => {
        setInpaintSectionId(sectionId);
        setInpaintImageUrl(imageUrl);
        setShowInpaintModal(true);
    };

    // インペインティング結果を保存
    const handleInpaintSave = async (newImageUrl: string) => {
        if (!inpaintSectionId) return;

        const targetSectionId = inpaintSectionId;

        // 新しい画像でセクションを更新
        // APIから返された画像URLを使用してセクションを更新
        const res = await fetch('/api/media');
        const mediaList = await res.json();
        const newMedia = mediaList.find((m: any) => m.filePath === newImageUrl);

        if (newMedia) {
            setSections(prev => prev.map(s =>
                s.id === targetSectionId
                    ? { ...s, imageId: newMedia.id, image: newMedia }
                    : s
            ));
        }

        setShowInpaintModal(false);
        setInpaintSectionId(null);
        setInpaintImageUrl(null);

        // 編集したセクションまでスクロール
        setTimeout(() => {
            const element = document.getElementById(`section-${targetSectionId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
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
            alert('同期する前にページを保存してください。');
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
            alert(data.message);
        } catch (error: any) {
            alert(error.message || '同期に失敗しました。設定画面で連携情報を確認してください。');
        } finally {
            setIsSyncing(null);
        }
    };

    const handleExport = async () => {
        if (pageId === 'new') {
            alert('エクスポートする前にページを保存してください。');
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
            alert('エクスポート中にエラーが発生しました。');
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
                    status: status
                })
            });

            const data = await res.json();
            if (pageId === 'new' && data.id) {
                // リフレッシュ時のデータ紛失を防ぐため、新しく作成されたページIDにリダイレクト
                router.push(`/admin/pages/${data.id}`);
            } else if (res.ok) {
                router.refresh(); // Refresh server data
            } else {
                alert('保存中にエラーが発生しました。');
            }

        } catch (e) {
            console.error(e);
            alert('保存に失敗しました。');
        }
        setIsSaving(false);
    };

    // AIアシスタントパネル表示状態
    const [showAIPanel, setShowAIPanel] = useState(false);

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
                    {/* ヘッダー */}
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
                        <span className="rounded-full bg-blue-600 px-6 py-2 text-sm font-bold text-white">
                            {headerConfig.ctaText}
                        </span>
                    </header>

                    {/* セクション - クリックで編集 */}
                    {sections.length === 0 ? (
                        <div
                            className="h-96 flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100 transition-all"
                            onClick={() => document.getElementById('file-upload-input')?.click()}
                        >
                            <Upload className="h-12 w-12 text-gray-400 mb-4" />
                            <p className="text-gray-500 font-medium">クリックして画像をアップロード</p>
                            <p className="text-gray-400 text-sm mt-1">ドラッグ&ドロップも可能</p>
                        </div>
                    ) : (
                        sections.map((section) => (
                            <div
                                key={section.id}
                                id={`section-${section.id}`}
                                className="relative group cursor-pointer"
                                onClick={() => {
                                    if (section.image?.filePath) {
                                        handleOpenInpaint(section.id, section.image.filePath);
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
                                        {/* ホバーオーバーレイ */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center gap-2">
                                                <div className="h-14 w-14 rounded-full bg-white flex items-center justify-center shadow-xl">
                                                    <Pencil className="h-6 w-6 text-gray-800" />
                                                </div>
                                                <span className="text-white text-sm font-bold bg-black/60 px-4 py-1.5 rounded-full">
                                                    クリックで編集
                                                </span>
                                            </div>
                                        </div>
                                        {/* ローディング */}
                                        {(generatingImageSectionIds.has(section.id) || editingSectionIds.has(section.id)) && (
                                            <div className="absolute inset-0 bg-purple-600/80 flex items-center justify-center">
                                                <RefreshCw className="h-10 w-10 text-white animate-spin" />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="h-48 bg-gray-100 flex items-center justify-center">
                                        <span className="text-gray-400">画像なし</span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    {/* フッター */}
                    <footer className="bg-gray-900 py-8 text-center text-white">
                        <p className="text-sm opacity-70">&copy; {new Date().getFullYear()} {headerConfig.logoText}. All rights reserved.</p>
                    </footer>
                </div>
            </div>

            {/* AIアシスタントパネル（たたみ可能） */}
            <div className={clsx(
                "fixed bottom-0 left-0 right-0 bg-white shadow-2xl border-t border-gray-200 transform transition-transform duration-300 z-40",
                showAIPanel ? "translate-y-0" : "translate-y-full"
            )}>
                <div className="max-w-4xl mx-auto p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-purple-500" />
                            AIアシスタント
                        </h3>
                        <button onClick={() => setShowAIPanel(false)} className="p-2 text-gray-400 hover:text-gray-600">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-2 block">プロンプト</label>
                            <textarea
                                value={aiProductInfo}
                                onChange={(e) => setAiProductInfo(e.target.value)}
                                placeholder="商材情報を入力..."
                                className="w-full h-24 rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-2 block">スタイル</label>
                            <div className="grid grid-cols-3 gap-1">
                                {[
                                    { id: 'professional', label: 'Business' },
                                    { id: 'pops', label: 'Pop' },
                                    { id: 'luxury', label: 'Luxury' },
                                    { id: 'minimal', label: 'Minimal' },
                                    { id: 'emotional', label: 'Emotional' }
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setAiTaste(t.id)}
                                        className={clsx(
                                            "px-2 py-1.5 text-xs font-medium rounded-lg transition-all",
                                            aiTaste === t.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                        )}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col justify-end">
                            <button
                                onClick={handleGenerateAI}
                                disabled={isGenerating || !aiProductInfo}
                                className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg text-sm font-bold hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isGenerating ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        生成中...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4" />
                                        AIで生成
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

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
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                                msg.role === 'user'
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
            {showInpaintModal && inpaintImageUrl && (
                <ImageInpaintEditor
                    imageUrl={inpaintImageUrl}
                    onClose={() => {
                        setShowInpaintModal(false);
                        setInpaintSectionId(null);
                        setInpaintImageUrl(null);
                    }}
                    onSave={handleInpaintSave}
                />
            )}
        </div>
    );
}
