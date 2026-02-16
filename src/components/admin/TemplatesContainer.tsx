'use client';

import { useState } from 'react';
import { Plus, Eye, EyeOff, Trash2, Globe, Loader2, X, ExternalLink, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { TemplateImportModal } from './TemplateImportModal';

interface TemplateSection {
    id: number;
    order: number;
    role: string;
    image: { id: number; filePath: string } | null;
    mobileImage: { id: number; filePath: string } | null;
}

interface TemplateDetail {
    id: number;
    title: string;
    description: string | null;
    category: string;
    sourceUrl: string | null;
    isPublished: boolean;
    sections: TemplateSection[];
}

interface TemplateItem {
    id: number;
    title: string;
    description: string | null;
    category: string;
    thumbnailUrl: string | null;
    sourceUrl: string | null;
    isPublished: boolean;
    sectionsCount: number;
    createdAt: string;
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

interface TemplatesContainerProps {
    initialTemplates: TemplateItem[];
}

export function TemplatesContainer({ initialTemplates }: TemplatesContainerProps) {
    const router = useRouter();
    const [templates, setTemplates] = useState<TemplateItem[]>(initialTemplates);
    const [showImportModal, setShowImportModal] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [detailTemplate, setDetailTemplate] = useState<TemplateDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const categories = ['all', ...new Set(templates.map(t => t.category))];

    const filteredTemplates = categoryFilter === 'all'
        ? templates
        : templates.filter(t => t.category === categoryFilter);

    const handleTogglePublish = async (id: number, currentStatus: boolean) => {
        setTogglingId(id);
        try {
            const res = await fetch(`/api/admin/templates/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublished: !currentStatus }),
            });
            if (!res.ok) throw new Error('Failed to update');

            setTemplates(prev => prev.map(t =>
                t.id === id ? { ...t, isPublished: !currentStatus } : t
            ));
            toast.success(!currentStatus ? 'テンプレートを公開しました' : 'テンプレートを非公開にしました');
        } catch {
            toast.error('更新に失敗しました');
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('このテンプレートを削除しますか？')) return;
        setDeletingId(id);
        try {
            const res = await fetch(`/api/admin/templates/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');

            setTemplates(prev => prev.filter(t => t.id !== id));
            toast.success('テンプレートを削除しました');
        } catch {
            toast.error('削除に失敗しました');
        } finally {
            setDeletingId(null);
        }
    };

    const handleImportComplete = () => {
        setShowImportModal(false);
        router.refresh();
    };

    const handleViewDetail = async (id: number) => {
        setLoadingDetail(true);
        try {
            const res = await fetch(`/api/admin/templates/${id}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setDetailTemplate(data);
        } catch {
            toast.error('テンプレート詳細の取得に失敗しました');
        } finally {
            setLoadingDetail(false);
        }
    };

    // テンプレート詳細ビュー
    if (detailTemplate) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setDetailTemplate(null)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        一覧に戻る
                    </button>
                </div>

                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{detailTemplate.title}</h1>
                        {detailTemplate.description && (
                            <p className="text-sm text-muted-foreground mt-1">{detailTemplate.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                                {CATEGORY_LABELS[detailTemplate.category] || detailTemplate.category}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                                detailTemplate.isPublished ? 'text-green-600' : 'text-gray-400'
                            }`}>
                                {detailTemplate.isPublished ? <><Eye className="h-3 w-3" /> 公開中</> : <><EyeOff className="h-3 w-3" /> 非公開</>}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {detailTemplate.sections.length} セクション
                            </span>
                        </div>
                    </div>
                    {detailTemplate.sourceUrl && (
                        <a
                            href={detailTemplate.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            元URL
                        </a>
                    )}
                </div>

                {/* セクション画像一覧 */}
                {detailTemplate.sections.length === 0 ? (
                    <div className="text-center py-12">
                        <ImageIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">セクションがありません</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {detailTemplate.sections.map((section, idx) => (
                            <div key={section.id} className="rounded-lg border border-border overflow-hidden">
                                <div className="px-4 py-2 bg-secondary/50 flex items-center justify-between">
                                    <span className="text-xs font-bold text-foreground">
                                        セクション {idx + 1} — {section.role}
                                    </span>
                                </div>
                                {section.image?.filePath ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={section.image.filePath}
                                        alt={`Section ${idx + 1}`}
                                        className="w-full"
                                    />
                                ) : (
                                    <div className="h-32 flex items-center justify-center bg-secondary/20 text-muted-foreground/30">
                                        <ImageIcon className="h-8 w-8" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <>
            {/* ヘッダー */}
            <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-6 sm:pb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        LPテンプレート
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm font-medium">
                        ナレッジとしてLPテンプレートを管理します。公開するとユーザーが利用できます。
                    </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors min-h-[44px]"
                    >
                        <Plus className="h-4 w-4" />
                        テンプレートをインポート
                    </button>
                </div>
            </div>

            {/* カテゴリフィルター */}
            {categories.length > 2 && (
                <div className="flex gap-2 mb-6 flex-wrap">
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

            {/* テンプレート一覧 */}
            {filteredTemplates.length === 0 ? (
                <div className="text-center py-16">
                    <Globe className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-foreground mb-2">テンプレートがありません</h3>
                    <p className="text-muted-foreground text-sm mb-6">
                        参考LPをインポートしてテンプレートとして保存しましょう。
                    </p>
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        最初のテンプレートを作成
                    </button>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredTemplates.map(template => (
                        <div
                            key={template.id}
                            className="rounded-lg border border-border bg-background overflow-hidden group hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => handleViewDetail(template.id)}
                        >
                            {/* サムネイル */}
                            <div className="aspect-[16/10] bg-secondary relative overflow-hidden">
                                {template.thumbnailUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={template.thumbnailUrl}
                                        alt={template.title}
                                        className="w-full h-full object-cover object-top"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                                        <Globe className="h-12 w-12" />
                                    </div>
                                )}
                                {/* 公開バッジ */}
                                <div className="absolute top-2 right-2">
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                                        template.isPublished
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {template.isPublished ? (
                                            <><Eye className="h-3 w-3" /> 公開中</>
                                        ) : (
                                            <><EyeOff className="h-3 w-3" /> 非公開</>
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* 情報 */}
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h3 className="font-bold text-sm text-foreground truncate">{template.title}</h3>
                                    <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                                        {CATEGORY_LABELS[template.category] || template.category}
                                    </span>
                                </div>

                                {template.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                                        {template.description}
                                    </p>
                                )}

                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                                    <span>{template.sectionsCount} セクション</span>
                                    <span>{new Date(template.updatedAt).toLocaleDateString('ja-JP')}</span>
                                </div>

                                {/* アクション */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleTogglePublish(template.id, template.isPublished); }}
                                        disabled={togglingId === template.id}
                                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition-colors min-h-[36px] ${
                                            template.isPublished
                                                ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                                                : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                                        }`}
                                    >
                                        {togglingId === template.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : template.isPublished ? (
                                            <><EyeOff className="h-3 w-3" /> 非公開にする</>
                                        ) : (
                                            <><Eye className="h-3 w-3" /> 公開する</>
                                        )}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                                        disabled={deletingId === template.id}
                                        className="flex items-center justify-center rounded-md px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 border border-red-200 transition-colors min-h-[36px]"
                                    >
                                        {deletingId === template.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* インポートモーダル */}
            {showImportModal && (
                <TemplateImportModal
                    onClose={() => setShowImportModal(false)}
                    onComplete={handleImportComplete}
                />
            )}
        </>
    );
}
