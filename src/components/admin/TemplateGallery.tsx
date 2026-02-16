'use client';

import { useState, useEffect } from 'react';
import { Loader2, ArrowLeft, Library, Check, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface PublicTemplate {
    id: number;
    title: string;
    description: string | null;
    category: string;
    thumbnailUrl: string | null;
    updatedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
    general: '汎用',
    beauty: '美容',
    'real-estate': '不動産',
    ec: 'EC',
    education: '教育',
    finance: '金融',
    healthcare: '医療',
    recruitment: '求人',
    service: 'サービス',
};

const TONE_OPTIONS = [
    { id: 'professional', label: 'ビジネス・信頼感' },
    { id: 'friendly', label: 'フレンドリー・親しみやすい' },
    { id: 'luxury', label: '高級・上質' },
    { id: 'energetic', label: 'エネルギッシュ・活力' },
    { id: 'calm', label: '落ち着き・安心感' },
];

const COLOR_SCHEME_OPTIONS = [
    { id: 'blue',       label: 'ブルー',       colors: ['#3B82F6', '#1E40AF', '#DBEAFE'] },
    { id: 'green',      label: 'グリーン',     colors: ['#22C55E', '#15803D', '#DCFCE7'] },
    { id: 'purple',     label: 'パープル',     colors: ['#A855F7', '#7C3AED', '#F3E8FF'] },
    { id: 'orange',     label: 'オレンジ',     colors: ['#F97316', '#EA580C', '#FFF7ED'] },
    { id: 'red',        label: 'レッド',       colors: ['#EF4444', '#DC2626', '#FEF2F2'] },
    { id: 'teal',       label: 'ティール',     colors: ['#14B8A6', '#0D9488', '#CCFBF1'] },
    { id: 'pink',       label: 'ピンク',       colors: ['#EC4899', '#DB2777', '#FCE7F3'] },
    { id: 'gold',       label: 'ゴールド',     colors: ['#D4AF37', '#B8960C', '#FEF9E7'] },
    { id: 'monochrome', label: 'モノクロ',     colors: ['#374151', '#1F2937', '#F3F4F6'] },
    { id: 'navy',       label: 'ネイビー',     colors: ['#1E3A5F', '#0F2440', '#E8EEF4'] },
];

interface TemplateGalleryProps {
    onBack: () => void;
    onClose: () => void;
}

export function TemplateGallery({ onBack, onClose }: TemplateGalleryProps) {
    const router = useRouter();
    const [templates, setTemplates] = useState<PublicTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [progress, setProgress] = useState<{ message: string; total?: number; current?: number } | null>(null);

    // ステップ管理: select → customize
    const [step, setStep] = useState<'select' | 'customize'>('select');
    const [selectedTemplate, setSelectedTemplate] = useState<PublicTemplate | null>(null);

    // カスタマイズ入力
    const [productName, setProductName] = useState('');
    const [productDescription, setProductDescription] = useState('');
    const [tone, setTone] = useState('professional');
    const [priceInfo, setPriceInfo] = useState('');
    const [targetAudience, setTargetAudience] = useState('');
    const [colorScheme, setColorScheme] = useState('blue');

    useEffect(() => {
        fetch('/api/templates')
            .then(res => res.json())
            .then(data => setTemplates(data))
            .catch(() => toast.error('テンプレートの読み込みに失敗しました'))
            .finally(() => setLoading(false));
    }, []);

    const categories = ['all', ...new Set(templates.map(t => t.category))];
    const filtered = categoryFilter === 'all'
        ? templates
        : templates.filter(t => t.category === categoryFilter);

    const handleSelectTemplate = (template: PublicTemplate) => {
        setSelectedTemplate(template);
        setStep('customize');
    };

    const handleCreate = async () => {
        if (!selectedTemplate) return;
        if (!productName.trim()) {
            toast.error('商品・サービス名を入力してください');
            return;
        }

        setCreating(true);
        setProgress({ message: 'LP を生成しています...' });

        try {
            const res = await fetch(`/api/templates/${selectedTemplate.id}/copy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productName,
                    productDescription,
                    tone,
                    priceInfo,
                    targetAudience,
                    colorScheme,
                }),
            });

            // SSEストリーミングレスポンスを処理
            if (res.headers.get('content-type')?.includes('text/event-stream')) {
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
                            const data = JSON.parse(line.replace('data: ', ''));
                            if (data.type === 'progress') {
                                setProgress({
                                    message: data.message,
                                    total: data.total,
                                    current: data.current,
                                });
                            } else if (data.type === 'complete') {
                                finalData = data;
                            } else if (data.type === 'error') {
                                throw new Error(data.error);
                            }
                        } catch (e: any) {
                            if (e.message && !e.message.includes('JSON')) throw e;
                        }
                    }
                }

                if (finalData?.pageId) {
                    toast.success('LPを生成しました！');
                    onClose();
                    router.push(`/admin/pages/${finalData.pageId}`);
                    return;
                }

                throw new Error('LP生成結果を取得できませんでした');
            }

            // 通常のJSONレスポンス
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'ページの作成に失敗しました');
            }

            const { pageId } = await res.json();
            toast.success('LPを生成しました！');
            onClose();
            router.push(`/admin/pages/${pageId}`);
        } catch (error: any) {
            toast.error(error.message || 'ページの作成に失敗しました');
        } finally {
            setCreating(false);
            setProgress(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // ステップ2: カスタマイズ入力
    if (step === 'customize' && selectedTemplate) {
        return (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                <button
                    onClick={() => { if (!creating) setStep('select'); }}
                    disabled={creating}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                    <ArrowLeft className="h-4 w-4" />
                    テンプレート選択に戻る
                </button>

                {/* 選択したテンプレート */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 border border-purple-200">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-purple-900 truncate">{selectedTemplate.title}</p>
                        <p className="text-[10px] text-purple-600">
                            {CATEGORY_LABELS[selectedTemplate.category] || selectedTemplate.category}
                        </p>
                    </div>
                    <Check className="h-4 w-4 text-purple-600 shrink-0" />
                </div>

                <h3 className="text-lg font-bold text-foreground">商材情報を入力</h3>
                <p className="text-xs text-muted-foreground">
                    入力された情報をもとに、あなた専用のLPをAIが自動生成します。
                </p>

                {/* 入力フォーム */}
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-foreground mb-1">
                            商品・サービス名 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={productName}
                            onChange={e => setProductName(e.target.value)}
                            placeholder="例: プレミアム美容クリーム"
                            disabled={creating}
                            className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-foreground mb-1">
                            商品・サービスの説明
                        </label>
                        <textarea
                            value={productDescription}
                            onChange={e => setProductDescription(e.target.value)}
                            placeholder="特徴、強み、他社との違いなどを記載"
                            rows={3}
                            disabled={creating}
                            className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-foreground mb-1">
                            ターゲット層
                        </label>
                        <input
                            type="text"
                            value={targetAudience}
                            onChange={e => setTargetAudience(e.target.value)}
                            placeholder="例: 30代〜40代の女性"
                            disabled={creating}
                            className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-foreground mb-1">
                            価格・料金
                        </label>
                        <input
                            type="text"
                            value={priceInfo}
                            onChange={e => setPriceInfo(e.target.value)}
                            placeholder="例: 初回限定 3,980円（税込）"
                            disabled={creating}
                            className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-foreground mb-1">
                            トーン・雰囲気
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {TONE_OPTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setTone(opt.id)}
                                    disabled={creating}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                        tone === opt.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                    } disabled:opacity-50`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-foreground mb-1">
                            カラースキーム <span className="text-red-500">*</span>
                        </label>
                        <p className="text-[10px] text-muted-foreground mb-2">
                            LPの配色を選択してください。テンプレートの色はこのカラーに変換されます。
                        </p>
                        <div className="grid grid-cols-5 gap-2">
                            {COLOR_SCHEME_OPTIONS.map(scheme => (
                                <button
                                    key={scheme.id}
                                    onClick={() => setColorScheme(scheme.id)}
                                    disabled={creating}
                                    className={`flex flex-col items-center gap-1.5 rounded-lg p-2 text-[10px] font-medium transition-all ${
                                        colorScheme === scheme.id
                                            ? 'bg-gray-100 ring-2 ring-primary ring-offset-1'
                                            : 'hover:bg-gray-50'
                                    } disabled:opacity-50`}
                                >
                                    <div className="flex gap-0.5">
                                        <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: scheme.colors[0] }} />
                                        <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: scheme.colors[1] }} />
                                        <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: scheme.colors[2] }} />
                                    </div>
                                    <span className="text-foreground">{scheme.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* プログレス */}
                {progress && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                            <Loader2 className="h-5 w-5 text-purple-600 animate-spin shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-purple-700">
                                    {progress.message}
                                </p>
                                {progress.total && progress.current !== undefined && (
                                    <div className="mt-2">
                                        <div className="w-full bg-purple-200 rounded-full h-1.5">
                                            <div
                                                className="bg-purple-600 h-1.5 rounded-full transition-all duration-500"
                                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-purple-500 mt-1">
                                            {progress.current} / {progress.total} セクション
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 作成ボタン */}
                <button
                    onClick={handleCreate}
                    disabled={creating || !productName.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {creating ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> AI がLP を生成中...</>
                    ) : (
                        'AIでLPを自動生成'
                    )}
                </button>
            </div>
        );
    }

    // ステップ1: テンプレート選択（画像は絶対に表示しない）
    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                戻る
            </button>

            <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">テンプレートを選択</h3>
                <span className="px-2 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                    Beta
                </span>
            </div>
            <p className="text-xs text-muted-foreground">
                業種に合ったテンプレートを選んで、商材情報を入力するだけでLPが完成します。
                <span className="text-muted-foreground/60 ml-1">（デスクトップ版のみ対応）</span>
            </p>

            {/* カテゴリフィルター */}
            {categories.length > 2 && (
                <div className="flex gap-2 flex-wrap">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                categoryFilter === cat
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                            }`}
                        >
                            {cat === 'all' ? 'すべて' : (CATEGORY_LABELS[cat] || cat)}
                        </button>
                    ))}
                </div>
            )}

            {/* テンプレート一覧（テキストのみ・画像なし） */}
            {filtered.length === 0 ? (
                <div className="text-center py-12">
                    <Library className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                        {templates.length === 0
                            ? '利用可能なテンプレートがまだありません'
                            : 'このカテゴリにテンプレートがありません'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(template => (
                        <button
                            key={template.id}
                            onClick={() => handleSelectTemplate(template)}
                            className="w-full flex items-center gap-4 rounded-lg border border-border bg-background p-4 text-left hover:border-purple-300 hover:bg-purple-50/50 transition-all"
                        >
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center shrink-0">
                                <FileText className="h-5 w-5 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm text-foreground truncate">{template.title}</h4>
                                {template.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                        {template.description}
                                    </p>
                                )}
                            </div>
                            <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                {CATEGORY_LABELS[template.category] || template.category}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
