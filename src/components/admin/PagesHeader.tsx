"use client";

import React, { useState } from 'react';
import { Plus, Globe, Loader2, X, Layout, Monitor, Smartphone, Copy, Palette, Download, RefreshCw, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

// スタイル定義
const STYLE_OPTIONS = [
    { id: 'sampling', label: '元のまま', icon: '📐' },
    { id: 'professional', label: 'ビジネス', icon: '💼' },
    { id: 'pops', label: 'ポップ', icon: '🎨' },
    { id: 'luxury', label: '高級', icon: '✨' },
    { id: 'minimal', label: 'シンプル', icon: '◻️' },
    { id: 'emotional', label: '情熱', icon: '🔥' },
];

// カラースキーム定義
const COLOR_SCHEMES = [
    { id: 'original', label: 'そのまま', colors: ['#gray', '#gray'] },
    { id: 'blue', label: 'ブルー', colors: ['#3B82F6', '#1E40AF'] },
    { id: 'green', label: 'グリーン', colors: ['#22C55E', '#15803D'] },
    { id: 'purple', label: 'パープル', colors: ['#A855F7', '#7C3AED'] },
    { id: 'orange', label: 'オレンジ', colors: ['#F97316', '#EA580C'] },
    { id: 'monochrome', label: 'モノクロ', colors: ['#1F2937', '#6B7280'] },
];

// レイアウト変更オプション
const LAYOUT_OPTIONS = [
    { id: 'keep', label: '維持', description: '現状のまま' },
    { id: 'modernize', label: '広め', description: '余白を増やす' },
    { id: 'compact', label: '狭め', description: '余白を減らす' },
];

interface ImportProgress {
    message: string;
    total?: number;
    current?: number;
}

export function PagesHeader() {
    const router = useRouter();
    const [isImporting, setIsImporting] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [showSelection, setShowSelection] = useState(false);
    const [mode, setMode] = useState<'select' | 'import'>('select');
    const [device, setDevice] = useState<'desktop' | 'mobile' | 'dual'>('desktop');
    const [importMode, setImportMode] = useState<'faithful' | 'light' | 'heavy'>('faithful');
    const [style, setStyle] = useState('sampling');
    const [colorScheme, setColorScheme] = useState('original');
    const [layoutOption, setLayoutOption] = useState('keep');
    const [customPrompt, setCustomPrompt] = useState('');
    const [progress, setProgress] = useState<ImportProgress | null>(null);

    const handleImport = async () => {
        if (!importUrl) return;
        setIsImporting(true);
        setProgress({ message: 'インポートを開始しています...' });

        try {
            console.log('[Import] Starting import for URL:', importUrl, 'Mode:', importMode, 'Device:', device);

            // デュアルモードの場合は別のAPIを使用
            if (device === 'dual') {
                await handleDualImport();
                return;
            }

            const res = await fetch('/api/import-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: importUrl,
                    device,
                    importMode,
                    style: importMode !== 'faithful' ? style : undefined,
                    colorScheme: importMode !== 'faithful' ? colorScheme : undefined,
                    layoutOption: importMode !== 'faithful' ? layoutOption : undefined,
                    customPrompt: importMode !== 'faithful' && customPrompt ? customPrompt : undefined,
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'インポートに失敗しました。');
            }

            // ストリーミングレスポンスを読み取る
            const reader = res.body?.getReader();
            if (!reader) throw new Error('ストリームの読み取りに失敗しました。');

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
                        console.log('[Import] Stream event:', data);

                        if (data.type === 'progress') {
                            setProgress({
                                message: data.message,
                                total: data.total,
                                current: data.current
                            });
                        } else if (data.type === 'complete') {
                            finalData = data;
                        } else if (data.type === 'error') {
                            throw new Error(data.error);
                        }
                    } catch (parseError) {
                        console.warn('[Import] Parse error:', parseError);
                    }
                }
            }

            if (!finalData) {
                throw new Error('インポート結果を取得できませんでした。');
            }

            console.log('[Import] Final data:', finalData);

            // ページ作成
            setProgress({ message: 'ページを作成中...' });

            const sectionsPayload = finalData.media.map((m: any, idx: number) => ({
                role: idx === 0 ? 'hero' : 'other',
                imageId: m.id,
                config: { layout: finalData.device }
            }));

            console.log('[Import] Creating page with sections:', sectionsPayload);

            const pageRes = await fetch('/api/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Imported: ${importUrl}`,
                    sections: sectionsPayload
                })
            });
            const pageData = await pageRes.json();

            console.log('[Import] Page created:', pageData);

            router.push(`/admin/pages/${pageData.id}`);
        } catch (error: any) {
            console.error('[Import] Error:', error);
            toast.error(error.message || 'インポートに失敗しました');
        } finally {
            setIsImporting(false);
            setProgress(null);
        }
    };

    // デュアルインポート処理（デスクトップ＋モバイル同時取り込み）
    const handleDualImport = async () => {
        try {
            setProgress({ message: 'デュアルスクリーンショットを開始...' });

            const res = await fetch('/api/screenshot/dual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: importUrl })
            });

            if (!res.ok) {
                throw new Error('デュアルスクリーンショットに失敗しました');
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('ストリームの読み取りに失敗しました。');

            const decoder = new TextDecoder();
            let dualResult: { desktop: any[]; mobile: any[] } | null = null;
            let buffer = ''; // バッファを使って不完全なデータを蓄積

            let fullResponse = ''; // デバッグ用：全レスポンスを記録
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('[DualImport] Stream ended. Full response length:', fullResponse.length);
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                fullResponse += chunk;
                buffer += chunk;

                // 完全なイベントを処理（data: で始まり \n\n で終わる）
                const events = buffer.split('\n\n');
                buffer = events.pop() || ''; // 最後の不完全な部分をバッファに残す

                for (const event of events) {
                    const lines = event.split('\n').filter(line => line.startsWith('data: '));

                    for (const line of lines) {
                        try {
                            const jsonStr = line.substring(6); // 'data: ' を削除
                            const data = JSON.parse(jsonStr);
                            console.log('[DualImport] Stream event:', data.type);

                            if (data.type === 'progress') {
                                setProgress({ message: data.message });
                            } else if (data.type === 'complete' && data.success) {
                                dualResult = {
                                    desktop: data.desktop,
                                    mobile: data.mobile,
                                };
                                console.log('[DualImport] Complete received! Desktop:', data.desktop?.length, 'Mobile:', data.mobile?.length);
                            } else if (data.type === 'error') {
                                throw new Error(data.error);
                            }
                        } catch (parseError) {
                            // Log invalid JSON for debugging
                            console.warn('[DualImport] Parse error:', parseError, 'Line length:', line.length);
                        }
                    }
                }
            }

            // 残りのバッファもチェック
            if (buffer.trim()) {
                const lines = buffer.split('\n').filter(line => line.startsWith('data: '));
                for (const line of lines) {
                    try {
                        const jsonStr = line.substring(6);
                        const data = JSON.parse(jsonStr);
                        console.log('[DualImport] Final buffer event:', data);

                        if (data.type === 'complete' && data.success) {
                            dualResult = {
                                desktop: data.desktop,
                                mobile: data.mobile,
                            };
                        }
                    } catch (parseError) {
                        console.warn('[DualImport] Final buffer parse error:', parseError);
                    }
                }
            }

            if (!dualResult) {
                throw new Error('デュアルスクリーンショット結果を取得できませんでした。');
            }

            console.log('[DualImport] Result:', dualResult);

            // ページ作成（デスクトップとモバイルをペアで保存）
            setProgress({ message: 'ページを作成中...' });

            const maxLength = Math.max(dualResult.desktop.length, dualResult.mobile.length);
            const sectionsPayload = [];

            for (let i = 0; i < maxLength; i++) {
                const desktopImg = dualResult.desktop[i];
                const mobileImg = dualResult.mobile[i];

                sectionsPayload.push({
                    role: i === 0 ? 'hero' : 'other',
                    imageId: desktopImg?.id || null,
                    mobileImageId: mobileImg?.id || null,
                    config: { layout: 'dual' }
                });
            }

            console.log('[DualImport] Creating page with sections:', sectionsPayload);

            const pageRes = await fetch('/api/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Dual Import: ${importUrl}`,
                    sections: sectionsPayload
                })
            });
            const pageData = await pageRes.json();

            console.log('[DualImport] Page created:', pageData);

            toast.success(`デスクトップ ${dualResult.desktop.length}セグメント + モバイル ${dualResult.mobile.length}セグメント を取り込みました`);
            router.push(`/admin/pages/${pageData.id}`);
        } catch (error: any) {
            console.error('[DualImport] Error:', error);
            toast.error(error.message || 'デュアルインポートに失敗しました');
            throw error;
        }
    };

    return (
        <>
            {/* Modal */}
            {showSelection && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-6 overflow-y-auto">
                    <div className="w-full max-w-2xl rounded-lg bg-background border border-border shadow-2xl animate-in fade-in zoom-in duration-300 my-auto">
                        <div className="p-8 max-h-[85vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-xl font-bold text-foreground tracking-tight"><span>新規ページ作成</span></h2>
                                <button onClick={() => setShowSelection(false)} className="text-muted-foreground hover:text-foreground transition-colors" disabled={isImporting}>
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {mode === 'select' ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <button
                                        onClick={() => router.push('/admin/pages/new')}
                                        className="group flex flex-col items-start rounded-lg border border-border p-6 text-left transition-all hover:border-primary hover:bg-surface-50"
                                    >
                                        <div className="mb-4 rounded-md bg-primary/10 p-3 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                            <Layout className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-base font-bold text-foreground mb-1"><span>あらゆる画像を編集できます</span></h3>
                                        <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                                            <span>画像をアップロードして、AIで自由に編集・加工できます。</span>
                                        </p>
                                    </button>

                                    <button
                                        onClick={() => setMode('import')}
                                        className="group flex flex-col items-start rounded-lg border border-border p-6 text-left transition-all hover:border-primary hover:bg-surface-50"
                                    >
                                        <div className="mb-4 rounded-md bg-secondary p-3 text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                            <Globe className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-base font-bold text-foreground mb-1"><span>クイックインポート</span></h3>
                                        <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                                            <span>LPを作成する場合はこちらがおすすめです。</span>
                                        </p>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                                    <div>
                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2"><span>対象URL</span></label>
                                        <div className="flex gap-2">
                                            <input
                                                type="url"
                                                placeholder="https://example.com"
                                                value={importUrl}
                                                onChange={(e) => setImportUrl(e.target.value)}
                                                disabled={isImporting}
                                                className="flex-1 rounded-md border border-input bg-background px-4 py-3 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary transition-all disabled:opacity-50"
                                            />
                                        </div>
                                    </div>

                                    {/* Device Select */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2"><span>デバイスビューポート</span></label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setDevice('desktop')}
                                                disabled={isImporting}
                                                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-bold transition-all disabled:opacity-50 ${device === 'desktop'
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                                    }`}
                                            >
                                                <Monitor className="h-4 w-4" />
                                                <span>Desktop</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDevice('mobile')}
                                                disabled={isImporting}
                                                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-bold transition-all disabled:opacity-50 ${device === 'mobile'
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                                    }`}
                                            >
                                                <Smartphone className="h-4 w-4" />
                                                <span>Mobile</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDevice('dual')}
                                                disabled={isImporting}
                                                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-bold transition-all disabled:opacity-50 ${device === 'dual'
                                                    ? 'bg-black text-white'
                                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                                    }`}
                                            >
                                                <Monitor className="h-3 w-3" />
                                                <span className="text-xs">+</span>
                                                <Smartphone className="h-3 w-3" />
                                                <span>両方</span>
                                            </button>
                                        </div>
                                        <p className="mt-2 text-[10px] text-muted-foreground">
                                            {device === 'desktop' && '1280×800px viewport'}
                                            {device === 'mobile' && '375×812px (iPhone) viewport'}
                                            {device === 'dual' && 'デスクトップとモバイル両方を同時取得（1280px + 375px）'}
                                        </p>
                                    </div>

                                    {/* デュアルモードの場合は変換モードをスキップ */}
                                    {device === 'dual' ? (
                                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                            <div className="flex items-center gap-3 text-sm text-gray-900">
                                                <div className="flex items-center gap-1">
                                                    <Monitor className="w-5 h-5 text-gray-900" />
                                                    <span className="text-gray-400">+</span>
                                                    <Smartphone className="w-4 h-4 text-gray-900" />
                                                </div>
                                                <span>デスクトップとモバイル両方のスクリーンショットを同時に取得します</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2 ml-8">
                                                取り込み後、エディタで両方のビューポートを並べて編集できます
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* 変換モード */}
                                            <div>
                                                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2"><span>変換モード</span></label>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setImportMode('faithful')}
                                                        disabled={isImporting}
                                                        className={`flex-1 flex flex-col items-center gap-1 rounded-md py-3 px-2 text-xs font-bold transition-all disabled:opacity-50 ${importMode === 'faithful'
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                                            }`}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                        <span>そのまま</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setImportMode('light')}
                                                        disabled={isImporting}
                                                        className={`flex-1 flex flex-col items-center gap-1 rounded-md py-3 px-2 text-xs font-bold transition-all disabled:opacity-50 ${importMode === 'light'
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                                            }`}
                                                    >
                                                        <Palette className="h-4 w-4" />
                                                        <span>色だけ変更</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setImportMode('heavy')}
                                                        disabled={isImporting}
                                                        className={`flex-1 flex flex-col items-center gap-1 rounded-md py-3 px-2 text-xs font-bold transition-all disabled:opacity-50 ${importMode === 'heavy'
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                                            }`}
                                                    >
                                                        <RefreshCw className="h-4 w-4" />
                                                        <span>全体を再構成</span>
                                                    </button>
                                                </div>
                                                <p className="mt-2 text-[10px] text-muted-foreground">
                                                    {importMode === 'faithful' && '変更なし。元のデザインをそのまま取り込みます。'}
                                                    {importMode === 'light' && '配置は維持して、色・フォント・装飾のみ変更します。'}
                                                    {importMode === 'heavy' && 'レイアウトも含めて新しいデザインに作り変えます。'}
                                                </p>
                                            </div>

                                            {/* Design Customization Options */}
                                            {importMode !== 'faithful' && (
                                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200 border-t border-border pt-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Settings className="h-4 w-4 text-primary" />
                                                        <span className="text-sm font-bold text-foreground">デザイン設定</span>
                                                    </div>

                                                    {/* Style Select */}
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                                                            <span>スタイル</span>
                                                        </label>
                                                        <div className="flex gap-2 flex-wrap">
                                                            {STYLE_OPTIONS.map((opt) => (
                                                                <button
                                                                    key={opt.id}
                                                                    type="button"
                                                                    onClick={() => setStyle(opt.id)}
                                                                    disabled={isImporting}
                                                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1 ${style === opt.id
                                                                        ? 'bg-primary text-primary-foreground'
                                                                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                                                        }`}
                                                                >
                                                                    <span>{opt.icon}</span>
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Color Scheme */}
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                                                            <span>カラー</span>
                                                        </label>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {COLOR_SCHEMES.map((scheme) => (
                                                                <button
                                                                    key={scheme.id}
                                                                    type="button"
                                                                    onClick={() => setColorScheme(scheme.id)}
                                                                    disabled={isImporting}
                                                                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all disabled:opacity-50 ${colorScheme === scheme.id
                                                                        ? 'bg-primary text-primary-foreground'
                                                                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                                                        }`}
                                                                >
                                                                    {scheme.id !== 'original' && (
                                                                        <div className="flex gap-0.5">
                                                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: scheme.colors[0] }} />
                                                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: scheme.colors[1] }} />
                                                                        </div>
                                                                    )}
                                                                    <span>{scheme.label}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Layout Option - heavyモードのみ表示 */}
                                                    {importMode === 'heavy' && (
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                                                                <span>レイアウト</span>
                                                            </label>
                                                            <div className="flex gap-2">
                                                                {LAYOUT_OPTIONS.map((opt) => (
                                                                    <button
                                                                        key={opt.id}
                                                                        type="button"
                                                                        onClick={() => setLayoutOption(opt.id)}
                                                                        disabled={isImporting}
                                                                        className={`flex-1 py-2 px-3 rounded-md text-xs font-bold transition-all disabled:opacity-50 ${layoutOption === opt.id
                                                                            ? 'bg-primary text-primary-foreground'
                                                                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                                                            }`}
                                                                    >
                                                                        {opt.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <p className="mt-1 text-[10px] text-muted-foreground">
                                                                {LAYOUT_OPTIONS.find(o => o.id === layoutOption)?.description}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Custom Prompt */}
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                                                            <span>追加指示（任意）</span>
                                                        </label>
                                                        <textarea
                                                            value={customPrompt}
                                                            onChange={(e) => setCustomPrompt(e.target.value)}
                                                            disabled={isImporting}
                                                            placeholder="例: ヘッダーを大きく、CTAボタンを目立たせて"
                                                            className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary transition-all disabled:opacity-50 resize-none"
                                                        />
                                                        <p className="mt-1 text-[10px] text-muted-foreground">
                                                            AIがこの指示を元にデザインを調整します
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Progress */}
                                    {isImporting && progress && (
                                        <div className="animate-in fade-in duration-300">
                                            <div className="rounded-md bg-surface-50 border border-border p-4">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                    <span className="text-sm font-bold text-foreground">{progress.message}</span>
                                                </div>
                                                {progress.total && progress.current !== undefined && (
                                                    <div className="mt-3">
                                                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                                            <span>Progress</span>
                                                            <span>{progress.current} / {progress.total}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-primary transition-all duration-500 ease-out"
                                                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setMode('select')}
                                            disabled={isImporting}
                                            className="flex-1 rounded-md border border-border py-3 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-surface-50 transition-all disabled:opacity-50"
                                        >
                                            <span>戻る</span>
                                        </button>
                                        <button
                                            onClick={handleImport}
                                            disabled={isImporting || !importUrl}
                                            className="flex-[2] flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                                        >
                                            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                            <span>{isImporting ? '処理中...' : 'インポート実行'}</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={() => { setShowSelection(true); setMode('select'); }}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all active:scale-[0.98]"
            >
                <Plus className="h-4 w-4" />
                <span>新規ページ作成</span>
            </button>

        </>
    );
}
