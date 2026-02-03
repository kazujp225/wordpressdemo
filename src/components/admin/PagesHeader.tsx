"use client";

import React, { useState } from 'react';
import { Plus, Globe, Loader2, X, Layout, Monitor, Smartphone, Copy, Palette, Download, RefreshCw, Settings, PenTool, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { TextBasedLPGenerator } from '@/components/lp-builder/TextBasedLPGenerator';

// スタイル定義
const STYLE_OPTIONS = [
    { id: 'sampling', label: '元のまま' },
    { id: 'professional', label: 'ビジネス' },
    { id: 'pops', label: 'ポップ' },
    { id: 'luxury', label: '高級' },
    { id: 'minimal', label: 'シンプル' },
    { id: 'emotional', label: '情熱' },
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
    const [isTextLPModalOpen, setIsTextLPModalOpen] = useState(false);

    // デュアルインポート用の2段階state
    const [dualStep, setDualStep] = useState<'idle' | 'desktop-done' | 'complete'>('idle');
    const [desktopMedia, setDesktopMedia] = useState<any[]>([]);

    // テキストベースLP生成完了時のハンドラ
    const handleTextLPGenerated = async (sections: any[], meta?: { duration: number, estimatedCost: number }) => {
        try {
            // セクションをページとして保存
            const sectionsPayload = sections.map((s: any, idx: number) => ({
                role: s.type || (idx === 0 ? 'hero' : 'other'),
                imageId: s.imageId || null,
                config: JSON.stringify({
                    type: s.type,
                    name: s.name,
                    properties: s.properties,
                }),
            }));

            const pageRes = await fetch('/api/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `AI Generated LP - ${new Date().toLocaleDateString('ja-JP')}`,
                    sections: sectionsPayload,
                }),
            });
            const pageData = await pageRes.json();

            if (meta) {
                toast.success(`${sections.length}セクションを生成しました（${(meta.duration / 1000).toFixed(1)}秒）`);
            } else {
                toast.success(`${sections.length}セクションを生成しました`);
            }

            setIsTextLPModalOpen(false);
            setShowSelection(false);
            router.push(`/admin/pages/${pageData.id}`);
        } catch (error: any) {
            console.error('Failed to create page from generated LP:', error);
            toast.error('ページの作成に失敗しました');
        }
    };

    const handleImport = async () => {
        if (!importUrl) return;
        setIsImporting(true);
        setProgress({ message: 'インポートを開始しています...' });

        try {
            console.log('[Import] Starting import for URL:', importUrl, 'Mode:', importMode, 'Device:', device);

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

    // 単体インポート処理を行うヘルパー関数
    const importSingleDevice = async (targetDevice: 'desktop' | 'mobile'): Promise<any[]> => {
        console.log(`[DualImport-${targetDevice}] Starting fetch request...`);

        let res: Response;
        try {
            res = await fetch('/api/import-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: importUrl,
                    device: targetDevice,
                    importMode: 'faithful',
                })
            });
        } catch (fetchError: any) {
            console.error(`[DualImport-${targetDevice}] Fetch error:`, fetchError);
            throw new Error(`${targetDevice}のリクエストに失敗しました: ${fetchError.message}`);
        }

        console.log(`[DualImport-${targetDevice}] Response status: ${res.status}`);

        if (!res.ok) {
            let errorMessage = `${targetDevice}のインポートに失敗しました (${res.status})`;
            try {
                const errorData = await res.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch {
                // JSONパースに失敗した場合はデフォルトメッセージを使用
            }
            throw new Error(errorMessage);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('ストリームの読み取りに失敗しました。');

        const decoder = new TextDecoder();
        let finalData: any = null;
        let lastProgress = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log(`[DualImport-${targetDevice}] Stream ended`);
                break;
            }

            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n\n').filter(line => line.startsWith('data: '));

            for (const line of lines) {
                try {
                    const jsonStr = line.replace('data: ', '');
                    const data = JSON.parse(jsonStr);
                    console.log(`[DualImport-${targetDevice}] Stream event:`, data.type, data.message || '');

                    if (data.type === 'progress') {
                        lastProgress = data.message || '';
                        setProgress({ message: `${targetDevice === 'desktop' ? 'デスクトップ' : 'モバイル'}版: ${data.message}` });
                    } else if (data.type === 'complete') {
                        console.log(`[DualImport-${targetDevice}] Complete event received, segments:`, data.media?.length);
                        finalData = data;
                    } else if (data.type === 'error') {
                        console.error(`[DualImport-${targetDevice}] Error event:`, data.error);
                        throw new Error(data.error);
                    }
                } catch (parseError) {
                    // JSONパースエラーは無視（部分的なデータの可能性）
                }
            }
        }

        if (!finalData || !finalData.media) {
            console.error(`[DualImport-${targetDevice}] No complete event received. Last progress: ${lastProgress}`);
            throw new Error(`${targetDevice}のインポート結果を取得できませんでした。最後のステータス: ${lastProgress}`);
        }

        return finalData.media;
    };

    // デュアルインポート - ステップ1: デスクトップ取得
    const handleDualImportDesktop = async () => {
        setIsImporting(true);
        setProgress({ message: 'デスクトップ版を取得中...' });

        try {
            console.log('[DualImport] Starting desktop import...');
            const media = await importSingleDevice('desktop');
            console.log('[DualImport] Desktop complete:', media.length, 'segments');

            setDesktopMedia(media);
            setDualStep('desktop-done');
            setProgress(null);
            toast.success(`デスクトップ ${media.length}セグメント取得完了！`);
        } catch (error: any) {
            console.error('[DualImport] Desktop failed:', error);
            toast.error(`デスクトップの取得に失敗しました: ${error.message}`);
            setProgress(null);
        } finally {
            setIsImporting(false);
        }
    };

    // デュアルインポート - ステップ2: モバイル取得 & ページ作成
    const handleDualImportMobile = async () => {
        setIsImporting(true);
        setProgress({ message: 'モバイル版を取得中...' });

        try {
            console.log('[DualImport] Starting mobile import...');
            const mobileMedia = await importSingleDevice('mobile');
            console.log('[DualImport] Mobile complete:', mobileMedia.length, 'segments');

            // ページ作成（デスクトップとモバイルをペア）
            setProgress({ message: 'ページを作成中...' });

            const maxLength = Math.max(desktopMedia.length, mobileMedia.length);
            const sectionsPayload = [];

            for (let i = 0; i < maxLength; i++) {
                const desktopImg = desktopMedia[i];
                const mobileImg = mobileMedia[i];

                sectionsPayload.push({
                    role: i === 0 ? 'hero' : 'other',
                    imageId: desktopImg?.id || null,
                    mobileImageId: mobileImg?.id || null,
                    config: { layout: 'dual' }
                });
            }

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
            toast.success(`デスクトップ ${desktopMedia.length} + モバイル ${mobileMedia.length}セグメントを取り込みました`);

            // リセット
            setDualStep('idle');
            setDesktopMedia([]);
            setShowSelection(false);
            router.push(`/admin/pages/${pageData.id}`);
        } catch (error: any) {
            console.error('[DualImport] Mobile failed:', error);
            toast.error(`モバイルの取得に失敗しました: ${error.message}`);
        } finally {
            setIsImporting(false);
            setProgress(null);
        }
    };

    // デュアルインポート - デスクトップのみでページ作成（モバイルスキップ）
    const handleDualImportSkipMobile = async () => {
        setIsImporting(true);
        setProgress({ message: 'ページを作成中...' });

        try {
            const sectionsPayload = desktopMedia.map((m: any, idx: number) => ({
                role: idx === 0 ? 'hero' : 'other',
                imageId: m.id,
                config: { layout: 'desktop' }
            }));

            const pageRes = await fetch('/api/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Imported: ${importUrl}`,
                    sections: sectionsPayload
                })
            });
            const pageData = await pageRes.json();

            console.log('[DualImport] Page created (desktop only):', pageData);
            toast.success(`デスクトップ ${desktopMedia.length}セグメントを取り込みました`);

            // リセット
            setDualStep('idle');
            setDesktopMedia([]);
            setShowSelection(false);
            router.push(`/admin/pages/${pageData.id}`);
        } catch (error: any) {
            console.error('[DualImport] Page creation failed:', error);
            toast.error('ページの作成に失敗しました');
        } finally {
            setIsImporting(false);
            setProgress(null);
        }
    };

    return (
        <>
            {/* Modal */}
            {showSelection && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-6 overflow-y-auto">
                    <div className="w-full max-w-2xl rounded-t-2xl sm:rounded-lg bg-background border border-border shadow-2xl animate-in fade-in zoom-in duration-300 sm:my-auto">
                        <div className="p-4 sm:p-8 max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-xl font-bold text-foreground tracking-tight"><span>新規ページ作成</span></h2>
                                <button onClick={() => setShowSelection(false)} className="text-muted-foreground hover:text-foreground transition-colors" disabled={isImporting}>
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {mode === 'select' ? (
                                <div className="space-y-4">
                                    {/* メインの選択肢 */}
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
                                                <span>画像をアップロードして、自由に編集・加工できます。</span>
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

                                    {/* テキストベースLP作成 - 一時的に非表示 */}
                                    {/* <button
                                        onClick={() => {
                                            setShowSelection(false);
                                            setIsTextLPModalOpen(true);
                                        }}
                                        className="group w-full flex items-center gap-4 rounded-lg border-2 border-dashed border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-6 text-left transition-all hover:border-green-400 hover:from-green-100 hover:to-emerald-100"
                                    >
                                        <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-3.5 text-white shadow-lg shadow-green-500/20 group-hover:shadow-green-500/40 transition-all">
                                            <PenTool className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-base font-bold text-gray-900">テキストからLPを作成</h3>
                                                <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                                                    New
                                                </span>
                                            </div>
                                            <p className="text-xs font-medium text-gray-600 leading-relaxed">
                                                商材情報を入力するだけで、最適なLPを自動生成します。<br />
                                                <span className="text-green-600 font-semibold">スクリーンショット不要・ゼロから作成</span>
                                            </p>
                                        </div>
                                        <div className="text-green-500 group-hover:translate-x-1 transition-transform">
                                            <Sparkles className="h-5 w-5" />
                                        </div>
                                    </button> */}
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

                                    {/* デュアルモードの場合は2段階インポート */}
                                    {device === 'dual' ? (
                                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                                            {dualStep === 'idle' ? (
                                                <>
                                                    <div className="flex items-center gap-3 text-sm text-gray-900">
                                                        <div className="flex items-center gap-1">
                                                            <Monitor className="w-5 h-5 text-gray-900" />
                                                            <span className="text-gray-400">+</span>
                                                            <Smartphone className="w-4 h-4 text-gray-900" />
                                                        </div>
                                                        <span>2段階でスクリーンショットを取得します</span>
                                                    </div>
                                                    <div className="text-xs text-gray-600 ml-8 space-y-1">
                                                        <p>1. まずデスクトップ版を取得</p>
                                                        <p>2. 次にモバイル版を取得</p>
                                                    </div>
                                                    <p className="text-xs text-red-600 ml-8 bg-red-50 p-2 rounded border border-red-200 font-medium">
                                                        ※ 各デバイス上部から最大10セクションまでの取得となります
                                                    </p>
                                                </>
                                            ) : dualStep === 'desktop-done' ? (
                                                <>
                                                    <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">
                                                        <Monitor className="w-5 h-5" />
                                                        <span className="font-medium">デスクトップ {desktopMedia.length}セグメント取得完了!</span>
                                                    </div>
                                                    <p className="text-sm text-gray-700">
                                                        次にモバイル版を取得しますか？
                                                    </p>
                                                </>
                                            ) : null}
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
                                                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all disabled:opacity-50 ${style === opt.id
                                                                        ? 'bg-primary text-primary-foreground'
                                                                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                                                        }`}
                                                                >
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
                                                            この指示を元にデザインを自動調整します
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
                                            onClick={() => {
                                                setMode('select');
                                                setDualStep('idle');
                                                setDesktopMedia([]);
                                            }}
                                            disabled={isImporting}
                                            className="flex-1 rounded-md border border-border py-3 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-surface-50 transition-all disabled:opacity-50"
                                        >
                                            <span>戻る</span>
                                        </button>

                                        {/* デュアルモードの場合は段階別ボタン */}
                                        {device === 'dual' ? (
                                            dualStep === 'idle' ? (
                                                <button
                                                    onClick={handleDualImportDesktop}
                                                    disabled={isImporting || !importUrl}
                                                    className="flex-[2] flex items-center justify-center gap-2 rounded-md bg-blue-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                                                >
                                                    {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Monitor className="h-4 w-4" />}
                                                    <span>{isImporting ? '取得中...' : '① デスクトップを取得'}</span>
                                                </button>
                                            ) : dualStep === 'desktop-done' ? (
                                                <>
                                                    <button
                                                        onClick={handleDualImportSkipMobile}
                                                        disabled={isImporting}
                                                        className="flex-1 rounded-md border border-gray-300 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
                                                    >
                                                        <span>デスクトップのみで作成</span>
                                                    </button>
                                                    <button
                                                        onClick={handleDualImportMobile}
                                                        disabled={isImporting}
                                                        className="flex-[2] flex items-center justify-center gap-2 rounded-md bg-green-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                                                    >
                                                        {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                                                        <span>{isImporting ? '取得中...' : '② モバイルを取得'}</span>
                                                    </button>
                                                </>
                                            ) : null
                                        ) : (
                                            <button
                                                onClick={handleImport}
                                                disabled={isImporting || !importUrl}
                                                className="flex-[2] flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                                            >
                                                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                                <span>{isImporting ? '処理中...' : 'インポート実行'}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={() => { setShowSelection(true); setMode('select'); }}
                className="flex items-center gap-2 rounded-md bg-primary px-3 sm:px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all active:scale-[0.98] min-h-[44px]"
            >
                <Plus className="h-4 w-4" />
                <span className="hidden xs:inline">新規ページ作成</span>
                <span className="xs:hidden">新規</span>
            </button>

            {/* テキストベースLP作成モーダル */}
            <TextBasedLPGenerator
                isOpen={isTextLPModalOpen}
                onClose={() => setIsTextLPModalOpen(false)}
                onGenerated={handleTextLPGenerated}
            />

        </>
    );
}
