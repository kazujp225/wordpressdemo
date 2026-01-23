"use client";

import React, { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Upload, X, Image as ImageIcon, Search, Sparkles, Wand2, Download, Copy, RefreshCw, Eye, Info, Check, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMedia } from '@/lib/hooks/useAdminData';
import { LazyImage } from '@/components/ui/LazyImage';

// 重いコンポーネントを遅延ロード
const ImageInpaintEditor = dynamic(
    () => import('@/components/lp-builder/ImageInpaintEditor').then(mod => mod.ImageInpaintEditor),
    {
        loading: () => (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent" />
            </div>
        ),
        ssr: false
    }
);

export default function MediaLibrary() {
    // SWRでメディアを取得（キャッシュ済み、タブ切り替え時に即表示）
    const { data: media = [], isLoading: loading, mutate: refreshMedia } = useMedia();

    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // AI Generation States
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Detail States
    const [selectedMedia, setSelectedMedia] = useState<any>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<{ prompt: string; explanation: string } | null>(null);
    const [copied, setCopied] = useState(false);

    // Inpaint Editor States
    const [showInpaintEditor, setShowInpaintEditor] = useState(false);
    const [inpaintTarget, setInpaintTarget] = useState<any>(null);

    // ファイルアップロード処理（メモ化）
    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setUploading(true);
        const files = Array.from(e.target.files);

        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            try {
                await fetch('/api/upload', { method: 'POST', body: formData });
            } catch (error) {
                console.error('Upload failed:', error);
            }
        }

        await refreshMedia();
        setUploading(false);
        e.target.value = '';
    }, [refreshMedia]);

    // 画像解析（メモ化）
    const handleAnalyze = useCallback(async (item: any) => {
        setIsAnalyzing(true);
        setAnalysisResult(null);
        try {
            const res = await fetch('/api/ai/image-to-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: item.filePath })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setAnalysisResult(data);
        } catch (error: any) {
            toast.error('解析に失敗しました: ' + error.message);
        } finally {
            setIsAnalyzing(false);
        }
    }, []);

    // ダウンロード処理（メモ化）
    const handleDownload = useCallback(async (item: any) => {
        const response = await fetch(item.filePath);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.filePath.split('/').pop() || 'image.jpg';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }, []);

    // AI画像生成（メモ化）
    const handleGenerateAI = useCallback(async () => {
        if (!aiPrompt) return;
        setIsGenerating(true);
        try {
            const res = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            await refreshMedia();
            setShowAIModal(false);
            setAiPrompt('');
            toast.success('画像を生成しました');
        } catch (error: any) {
            toast.error(error.message || '生成に失敗しました');
        } finally {
            setIsGenerating(false);
        }
    }, [aiPrompt, refreshMedia]);

    // クリップボードコピー（メモ化）
    const copyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, []);

    // インペイントエディタを開く（メモ化）
    const handleOpenInpaint = useCallback((item: any) => {
        setInpaintTarget(item);
        setShowInpaintEditor(true);
        setSelectedMedia(null);
    }, []);

    // インペイント保存処理（メモ化）
    const handleInpaintSave = useCallback(async (newImageUrl: string) => {
        setShowInpaintEditor(false);
        setInpaintTarget(null);
        await refreshMedia();
    }, [refreshMedia]);

    // フィルタリング結果をメモ化（検索パフォーマンス向上）
    const filteredMedia = useMemo(() => {
        if (!searchTerm) return media;
        const term = searchTerm.toLowerCase();
        return media.filter((item: any) =>
            item.filePath.toLowerCase().includes(term)
        );
    }, [media, searchTerm]);

    return (
        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:p-8 max-w-7xl mx-auto relative min-h-screen">
            {/* AI Generation Modal */}
            {showAIModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-6">
                    <div className="w-full max-w-xl overflow-hidden rounded-t-2xl sm:rounded-lg border border-border bg-background shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="relative h-32 bg-gradient-to-tr from-primary/20 to-primary/5 p-8 border-b border-border">
                            <button
                                onClick={() => setShowAIModal(false)}
                                className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="rounded-md bg-background p-2 border border-border">
                                    <Sparkles className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">AI画像生成</h2>
                                    <p className="text-sm text-muted-foreground">プロンプトから高品質な画像を生成します。</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-8">
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">画像の説明 (プロンプト)</label>
                            <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="例: 静かな和室、抹茶、自然光、4k..."
                                className="w-full min-h-[120px] rounded-md border border-input bg-background p-4 text-sm font-medium outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm resize-none mb-6 placeholder:text-muted-foreground"
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowAIModal(false)}
                                    className="flex-1 rounded-md border border-border py-3 text-sm font-bold text-muted-foreground hover:bg-surface-50 hover:text-foreground transition-all"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleGenerateAI}
                                    disabled={isGenerating || !aiPrompt}
                                    className="flex-[2] flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
                                >
                                    {isGenerating ? (
                                        <>
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                            生成中...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="h-4 w-4" />
                                            生成する
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-6 sm:mb-10 flex flex-col gap-4 sm:gap-6">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">メディアライブラリ</h1>
                        <p className="text-sm text-muted-foreground mt-1 hidden sm:block">アップロードまたは生成されたすべてのアセットを管理します。</p>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            onClick={() => setShowAIModal(true)}
                            className="flex items-center gap-2 rounded-md bg-foreground px-3 sm:px-5 py-2.5 text-sm font-bold text-background hover:bg-foreground/90 transition-all min-h-[44px]"
                        >
                            <Sparkles className="h-4 w-4 text-primary-foreground" />
                            <span className="hidden xs:inline">AI生成</span>
                        </button>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 sm:px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all min-h-[44px]">
                            <Upload className="h-4 w-4" />
                            {uploading ? '...' : <span className="hidden xs:inline">アップロード</span>}
                            <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
                        </label>
                    </div>
                </div>

                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="画像を検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="rounded-md border border-input bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all w-full sm:w-64 placeholder:text-muted-foreground min-h-[44px]"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex h-96 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                </div>
            ) : filteredMedia.length === 0 ? (
                <div className="flex h-[32rem] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-50/50">
                    <div className="mb-6 rounded-full bg-surface-100 p-6">
                        <ImageIcon className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <p className="font-bold text-foreground text-lg tracking-tight">メディアが見つかりません</p>
                    <p className="text-muted-foreground text-sm mt-1">新しい画像をアップロードして開始してください。</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {filteredMedia.map((item: any) => (
                        <div
                            key={item.id}
                            className="group relative aspect-square overflow-hidden rounded-md border border-border bg-white cursor-pointer hover:border-primary/50 transition-all"
                            onClick={() => {
                                setSelectedMedia(item);
                                setAnalysisResult(null);
                            }}
                        >
                            {/* 遅延ロード画像コンポーネント */}
                            <LazyImage
                                src={item.filePath}
                                alt={item.filePath}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                placeholderClassName="bg-gray-100 animate-pulse"
                            />

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleOpenInpaint(item); }}
                                        className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40 transition-colors"
                                        title="編集"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                                        className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40 transition-colors"
                                        title="ダウンロード"
                                    >
                                        <Download className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Detail Sidebar */}
            {selectedMedia && (
                <div className="fixed inset-0 sm:inset-y-0 sm:left-auto sm:right-0 z-[110] w-full sm:w-[28rem] bg-background shadow-2xl p-4 sm:p-6 overflow-y-auto animate-in slide-in-from-right duration-300 sm:border-l border-border">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="rounded-md bg-surface-100 p-2 text-foreground">
                                <Info className="h-4 w-4" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground">画像の詳細</h3>
                        </div>
                        <button
                            onClick={() => setSelectedMedia(null)}
                            className="rounded-full p-2 text-muted-foreground hover:bg-surface-100 hover:text-foreground transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="mb-6 overflow-hidden rounded-md border border-border bg-surface-50">
                        <img
                            src={selectedMedia.filePath}
                            alt="Selected"
                            className="h-auto w-full object-contain"
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleOpenInpaint(selectedMedia)}
                                className="w-full flex items-center justify-center gap-2 rounded-md bg-primary/10 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/20 transition-all border border-primary/20"
                            >
                                <Pencil className="h-4 w-4" />
                                編集エディタ
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleDownload(selectedMedia)}
                                    className="flex-1 flex items-center justify-center gap-2 rounded-md bg-surface-100 px-4 py-3 text-sm font-bold text-foreground hover:bg-surface-200 transition-all border border-border"
                                >
                                    <Download className="h-4 w-4" />
                                    ダウンロード
                                </button>
                                <button
                                    onClick={() => handleAnalyze(selectedMedia)}
                                    disabled={isAnalyzing}
                                    className="flex-1 flex items-center justify-center gap-2 rounded-md bg-surface-100 px-4 py-3 text-sm font-bold text-foreground hover:bg-surface-200 transition-all border border-border disabled:opacity-50"
                                >
                                    {isAnalyzing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    解析する
                                </button>
                            </div>
                        </div>

                        {/* Analysis Result */}
                        {analysisResult && (
                            <div className="rounded-md bg-surface-50 p-4 border border-border space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">プロンプト</span>
                                        <button
                                            onClick={() => copyToClipboard(analysisResult.prompt)}
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-sm text-[10px] font-bold transition-all ${copied ? 'bg-green-500 text-white' : 'bg-background text-foreground border border-border hover:bg-surface-100'}`}
                                        >
                                            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                            {copied ? 'コピー済' : 'コピー'}
                                        </button>
                                    </div>
                                    <div className="rounded-md bg-background p-3 text-xs font-mono font-medium text-foreground leading-relaxed shadow-sm border border-input">
                                        {analysisResult.prompt}
                                    </div>
                                </div>
                                <div>
                                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">説明</span>
                                    <div className="text-xs font-medium text-foreground leading-relaxed">
                                        {analysisResult.explanation}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 rounded-md bg-surface-50 p-4 border border-border">
                            <div>
                                <span className="block text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">フォーマット</span>
                                <span className="text-sm font-bold text-foreground">{selectedMedia.mime.split('/')[1].toUpperCase()}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">作成日時</span>
                                <span className="text-sm font-bold text-foreground">{new Date(selectedMedia.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Inpaint Editor */}
            {showInpaintEditor && inpaintTarget && (
                <ImageInpaintEditor
                    imageUrl={inpaintTarget.filePath}
                    onClose={() => {
                        setShowInpaintEditor(false);
                        setInpaintTarget(null);
                    }}
                    onSave={handleInpaintSave}
                />
            )}
        </div>
    );
}
