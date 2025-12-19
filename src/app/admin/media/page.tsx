"use client";

import React, { useState, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Search, Sparkles, Wand2, Download, Copy, RefreshCw, Eye, Info, Check } from 'lucide-react';

export default function MediaLibrary() {
    const [media, setMedia] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
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

    const fetchMedia = async () => {
        try {
            const res = await fetch('/api/media');
            const data = await res.json();
            setMedia(data);
        } catch (error) {
            console.error('Failed to fetch media:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMedia();
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

        await fetchMedia();
        setUploading(false);
        e.target.value = '';
    };

    const handleAnalyze = async (item: any) => {
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
            alert('解析に失敗しました: ' + error.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDownload = async (item: any) => {
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
    };

    const handleGenerateAI = async () => {
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

            await fetchMedia();
            setShowAIModal(false);
            setAiPrompt('');
        } catch (error: any) {
            alert(error.message || '生成に失敗しました。');
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const filteredMedia = media.filter(item =>
        item.filePath.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-10 max-w-7xl mx-auto relative">
            {/* AI Generation Modal */}
            {showAIModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6">
                    <div className="w-full max-w-xl overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="relative h-32 bg-gradient-to-tr from-blue-600 to-indigo-600 p-8">
                            <button
                                onClick={() => setShowAIModal(false)}
                                className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
                            >
                                <X className="h-6 w-6" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-md">
                                    <Sparkles className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white">AI画像生成</h2>
                                    <p className="text-sm text-white/70 font-medium">プロンプトから高品質な画像を生成します。</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-8">
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">生成したいイメージの説明</label>
                            <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="例：抹茶の芸術、ミニマル、高級感のある写真、4k..."
                                className="w-full min-h-[120px] rounded-2xl border border-gray-100 bg-gray-50 p-5 text-sm font-medium outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all shadow-inner resize-none mb-6"
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowAIModal(false)}
                                    className="flex-1 rounded-2xl border border-gray-100 py-4 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleGenerateAI}
                                    disabled={isGenerating || !aiPrompt}
                                    className="flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                                >
                                    {isGenerating ? (
                                        <>
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            AIが描いています...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="h-4 w-4" />
                                            画像を生成する
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900">Media Library</h1>
                    <p className="text-gray-500 mt-1">アップロード・生成されたすべての画像を管理します。</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="画像を検索..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="rounded-2xl border border-gray-100 bg-white pl-12 pr-6 py-3 text-sm outline-none focus:ring-4 focus:ring-blue-50 shadow-sm transition-all w-64"
                        />
                    </div>
                    <button
                        onClick={() => setShowAIModal(true)}
                        className="flex items-center gap-2 rounded-2xl bg-gray-900 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-gray-200 hover:bg-black hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <Sparkles className="h-5 w-5 text-blue-400" />
                        AIで生成
                    </button>
                    <label className="flex cursor-pointer items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all">
                        <Upload className="h-5 w-5" />
                        {uploading ? '...' : 'アップロード'}
                        <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                </div>
            </div>

            {loading ? (
                <div className="flex h-96 items-center justify-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent shadow-md"></div>
                </div>
            ) : filteredMedia.length === 0 ? (
                <div className="flex h-[32rem] flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-gray-100 bg-white/50 shadow-sm">
                    <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
                        <ImageIcon className="h-12 w-12 text-gray-200" />
                    </div>
                    <p className="font-bold text-gray-400 text-xl tracking-tight">メディアが見つかりません</p>
                    <p className="text-gray-400 text-sm mt-2 font-medium">新しい画像をアップロードしてプロジェクトを開始しましょう。</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {filteredMedia.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => {
                                setSelectedMedia(item);
                                setAnalysisResult(null);
                            }}
                            className="group relative aspect-square overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-2 shadow-sm transition-all hover:shadow-2xl hover:shadow-gray-100 hover:-translate-y-1 cursor-pointer"
                        >
                            <div className="h-full w-full overflow-hidden rounded-[1.5rem] bg-gray-50">
                                <img
                                    src={item.filePath}
                                    alt={item.filePath}
                                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                            </div>
                            <div className="absolute inset-2 flex flex-col justify-end rounded-[1.5rem] bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                <div className="flex items-center justify-between">
                                    <div className="overflow-hidden">
                                        <span className="block truncate text-[10px] font-black uppercase tracking-widest text-white/90">{item.mime.split('/')[1]}</span>
                                        <span className="block text-[8px] font-bold text-white/50 uppercase">{new Date(item.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                                            className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center text-white backdrop-blur-md hover:bg-blue-600 transition-colors"
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                        </button>
                                        <button className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center text-white backdrop-blur-md hover:bg-red-500 transition-colors">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Detail Sidebar / Modal */}
            {selectedMedia && (
                <div className="fixed inset-y-0 right-0 z-[110] w-[32rem] bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.1)] p-8 overflow-y-auto animate-in slide-in-from-right duration-500 backdrop-blur-3xl border-l border-gray-100/50">
                    <div className="mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                                <Info className="h-5 w-5" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900">画像詳細</h3>
                        </div>
                        <button
                            onClick={() => setSelectedMedia(null)}
                            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="mb-8 overflow-hidden rounded-[2.5rem] border border-gray-100 bg-gray-50 shadow-inner">
                        <img
                            src={selectedMedia.filePath}
                            alt="Selected"
                            className="h-auto w-full object-contain"
                        />
                    </div>

                    <div className="space-y-6">
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleDownload(selectedMedia)}
                                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gray-900 px-6 py-4 text-sm font-black text-white shadow-xl shadow-gray-200 hover:bg-black transition-all"
                            >
                                <Download className="h-4 w-4" />
                                ダウンロード
                            </button>
                            <button
                                onClick={() => handleAnalyze(selectedMedia)}
                                disabled={isAnalyzing}
                                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 px-6 py-4 text-sm font-black text-white shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {isAnalyzing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                AIプロンプト化
                            </button>
                        </div>

                        {/* Analysis Result */}
                        {analysisResult && (
                            <div className="rounded-[2rem] bg-indigo-50/50 p-6 border border-indigo-100 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">生成プロンプト (Prompt)</span>
                                        <button
                                            onClick={() => copyToClipboard(analysisResult.prompt)}
                                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-white text-indigo-600 border border-indigo-100 hover:border-indigo-300'}`}
                                        >
                                            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                            {copied ? 'コピー済み' : 'コピー'}
                                        </button>
                                    </div>
                                    <div className="rounded-2xl bg-white p-4 text-xs font-mono font-medium text-gray-700 leading-relaxed shadow-sm border border-indigo-50">
                                        {analysisResult.prompt}
                                    </div>
                                </div>
                                <div>
                                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-indigo-400">画像解析・意図 (Explanation)</span>
                                    <div className="text-sm font-medium text-indigo-900 leading-relaxed">
                                        {analysisResult.explanation}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 rounded-[2rem] bg-gray-50/50 p-6 border border-gray-100">
                            <div>
                                <span className="block text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">形式</span>
                                <span className="text-sm font-black text-gray-900">{selectedMedia.mime.split('/')[1].toUpperCase()}</span>
                            </div>
                            <div>
                                <span className="block text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">作成日</span>
                                <span className="text-sm font-black text-gray-900">{new Date(selectedMedia.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
