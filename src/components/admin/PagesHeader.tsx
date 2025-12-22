"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Globe, Loader2, X, Layout, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function PagesHeader() {
    const router = useRouter();
    const [isImporting, setIsImporting] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [showSelection, setShowSelection] = useState(false);
    const [mode, setMode] = useState<'select' | 'import'>('select');

    const handleImport = async () => {
        if (!importUrl) return;
        setIsImporting(true);
        try {
            const res = await fetch('/api/import-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: importUrl })
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            // Create a new page with these media segments
            const pageRes = await fetch('/api/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Imported: ${importUrl}`,
                    sections: data.media.map((m: any, idx: number) => ({
                        role: idx === 0 ? 'hero' : 'other',
                        imageId: m.id
                    }))
                })
            });
            const pageData = await pageRes.json();
            router.push(`/admin/pages/${pageData.id}`);
        } catch (error: any) {
            alert(error.message || 'インポートに失敗しました。');
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            {/* Modal */}
            {showSelection && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6">
                    <div className="w-full max-w-2xl overflow-hidden rounded-[3rem] bg-white shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="p-10">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-black text-gray-900"><span>作成方法を選択</span></h2>
                                <button onClick={() => setShowSelection(false)} className="text-gray-400 hover:text-gray-900 transition-colors">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            {mode === 'select' ? (
                                <div className="grid gap-6 sm:grid-cols-2">
                                    <button
                                        onClick={() => router.push('/admin/pages/new')}
                                        className="group flex flex-col items-start rounded-[2rem] border-2 border-gray-100 p-8 text-left transition-all hover:border-blue-500 hover:bg-blue-50/50"
                                    >
                                        <div className="mb-6 rounded-2xl bg-blue-100 p-4 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                            <Layout className="h-8 w-8" />
                                        </div>
                                        <h3 className="text-lg font-black text-gray-900 mb-2"><span>ゼロから作成</span></h3>
                                        <p className="text-sm font-medium text-gray-500 leading-relaxed">
                                            <span>画像をアップロードしたり、AIで画像を生成してオリジナルのLPを構築します。</span>
                                        </p>
                                    </button>

                                    <button
                                        onClick={() => setMode('import')}
                                        className="group flex flex-col items-start rounded-[2rem] border-2 border-gray-100 p-8 text-left transition-all hover:border-blue-500 hover:bg-blue-50/50"
                                    >
                                        <div className="mb-6 rounded-2xl bg-indigo-100 p-4 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                            <Globe className="h-8 w-8" />
                                        </div>
                                        <h3 className="text-lg font-black text-gray-900 mb-2"><span>URLからインポート</span></h3>
                                        <p className="text-sm font-medium text-gray-500 leading-relaxed">
                                            <span>既存のウェブサイトのURLを入力し、スクリーンショットから自動でベースを作成します。</span>
                                        </p>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3"><span>インポートするURL</span></label>
                                        <div className="flex gap-2">
                                            <input
                                                type="url"
                                                placeholder="https://example.com"
                                                value={importUrl}
                                                onChange={(e) => setImportUrl(e.target.value)}
                                                className="flex-1 rounded-2xl border border-gray-100 bg-gray-50 px-6 py-4 text-sm font-medium outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all shadow-inner"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setMode('select')}
                                            className="flex-1 rounded-2xl border border-gray-100 py-4 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all"
                                        >
                                            <span>戻る</span>
                                        </button>
                                        <button
                                            onClick={handleImport}
                                            disabled={isImporting || !importUrl}
                                            className="flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-gray-900 py-4 text-sm font-black text-white shadow-xl hover:bg-black disabled:opacity-50"
                                        >
                                            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-blue-400" />}
                                            <span>インポートを開始</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div>
                <h1 className="text-3xl font-black tracking-tight text-gray-900"><span>Pages</span></h1>
                <p className="text-gray-500 mt-1"><span>ランディングページの作成と管理を行います。</span></p>
            </div>

            <button
                onClick={() => { setShowSelection(true); setMode('select'); }}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98]"
            >
                <Plus className="h-5 w-5" />
                <span>ページを新規作成</span>
            </button>
        </div>
    );
}
