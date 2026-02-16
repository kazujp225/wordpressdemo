'use client';

import { useState } from 'react';
import { X, Globe, Loader2, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORY_OPTIONS = [
    { id: 'general', label: '汎用' },
    { id: 'beauty', label: '美容' },
    { id: 'real-estate', label: '不動産' },
    { id: 'ec', label: 'EC' },
    { id: 'education', label: '教育' },
    { id: 'finance', label: '金融' },
    { id: 'healthcare', label: '医療' },
    { id: 'recruitment', label: '求人' },
    { id: 'service', label: 'サービス' },
];

interface ImportProgress {
    message: string;
    total?: number;
    current?: number;
}

interface TemplateImportModalProps {
    onClose: () => void;
    onComplete: () => void;
}

export function TemplateImportModal({ onClose, onComplete }: TemplateImportModalProps) {
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('general');
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState<ImportProgress | null>(null);

    const handleImport = async () => {
        if (!url) {
            toast.error('URLを入力してください');
            return;
        }

        setIsImporting(true);
        setProgress({ message: 'インポートを開始しています...' });

        try {
            // 既存のimport-url APIでスクリーンショット取得
            const res = await fetch('/api/import-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    device: 'desktop',
                    importMode: 'faithful',
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'インポートに失敗しました');
            }

            // ストリーミングレスポンス読み取り
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
                    } catch (parseError) {
                        // JSON解析エラーは無視
                    }
                }
            }

            if (!finalData) {
                throw new Error('インポート結果を取得できませんでした');
            }

            // テンプレートとして保存
            setProgress({ message: 'テンプレートを保存中...' });

            const sections = finalData.media.map((m: any, idx: number) => ({
                role: idx === 0 ? 'hero' : 'other',
                imageId: m.id,
                config: { layout: finalData.device },
            }));

            const templateRes = await fetch('/api/admin/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title || `Imported: ${new URL(url).hostname}`,
                    description,
                    category,
                    sourceUrl: url,
                    sections,
                }),
            });

            if (!templateRes.ok) {
                throw new Error('テンプレートの保存に失敗しました');
            }

            toast.success('テンプレートをインポートしました');
            onComplete();
        } catch (error: any) {
            console.error('Template import error:', error);
            toast.error(error.message || 'インポートに失敗しました');
        } finally {
            setIsImporting(false);
            setProgress(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-bold text-foreground">テンプレートをインポート</h2>
                    <button
                        onClick={onClose}
                        disabled={isImporting}
                        className="p-2 rounded-md hover:bg-secondary transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="px-6 py-4 space-y-4">
                    {/* URL入力 */}
                    <div>
                        <label className="block text-sm font-bold text-foreground mb-1.5">
                            参考LPのURL <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="url"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                placeholder="https://example.com/lp"
                                disabled={isImporting}
                                className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                            />
                        </div>
                    </div>

                    {/* テンプレート名 */}
                    <div>
                        <label className="block text-sm font-bold text-foreground mb-1.5">
                            テンプレート名
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="例: 美容サロン向けLP"
                            disabled={isImporting}
                            className="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                        />
                    </div>

                    {/* 説明 */}
                    <div>
                        <label className="block text-sm font-bold text-foreground mb-1.5">
                            説明（任意）
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="このテンプレートの特徴や用途を記載"
                            rows={2}
                            disabled={isImporting}
                            className="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 resize-none"
                        />
                    </div>

                    {/* カテゴリ */}
                    <div>
                        <label className="block text-sm font-bold text-foreground mb-1.5">
                            カテゴリ
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {CATEGORY_OPTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setCategory(opt.id)}
                                    disabled={isImporting}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                        category === opt.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* プログレス */}
                    {progress && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <Loader2 className="h-5 w-5 text-blue-600 animate-spin shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-blue-700">
                                        {progress.message}
                                    </p>
                                    {progress.total && progress.current !== undefined && (
                                        <div className="mt-2">
                                            <div className="w-full bg-blue-200 rounded-full h-1.5">
                                                <div
                                                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-blue-500 mt-1">
                                                {progress.current} / {progress.total}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
                    <button
                        onClick={onClose}
                        disabled={isImporting}
                        className="px-4 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={isImporting || !url}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-bold shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {isImporting ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> インポート中...</>
                        ) : (
                            <><Monitor className="h-4 w-4" /> インポート開始</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
