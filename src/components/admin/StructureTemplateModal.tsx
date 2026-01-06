'use client';

import { useState } from 'react';
import { X, LayoutTemplate, Check, Sparkles, ChevronRight, Eye, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface StructureTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (template: LPTemplate) => void;
    userPlan?: 'free' | 'premium' | 'max';
}

interface LPTemplate {
    id: string;
    name: string;
    category: string;
    description: string;
    sections: TemplateSectionDefinition[];
    isPremium?: boolean;
}

interface TemplateSectionDefinition {
    role: string;
    title: string;
    description: string;
}

const TEMPLATE_CATEGORIES = [
    { id: 'all', label: 'すべて' },
    { id: 'service', label: 'サービス' },
    { id: 'product', label: '商品' },
    { id: 'saas', label: 'SaaS' },
    { id: 'consulting', label: 'コンサル' },
    { id: 'event', label: 'イベント' },
];

const LP_TEMPLATES: LPTemplate[] = [
    {
        id: 'classic-service',
        name: 'クラシック サービスLP',
        category: 'service',
        description: '王道の構成。問題提起から解決策、実績、CTAまで。',
        sections: [
            { role: 'hero', title: 'ヒーロー', description: 'メインキャッチコピーと主要CTA' },
            { role: 'problem', title: '問題提起', description: 'ターゲットの悩みに共感' },
            { role: 'solution', title: '解決策', description: 'サービスで解決できることを提示' },
            { role: 'features', title: '特徴・メリット', description: '3〜5つの主要な強み' },
            { role: 'how-it-works', title: '使い方', description: 'ステップ形式で説明' },
            { role: 'testimonials', title: 'お客様の声', description: '実績と信頼性' },
            { role: 'pricing', title: '料金', description: 'プランと価格表' },
            { role: 'faq', title: 'よくある質問', description: '不安を解消' },
            { role: 'cta', title: 'CTA', description: '最終的な行動喚起' },
        ]
    },
    {
        id: 'product-launch',
        name: '商品ローンチLP',
        category: 'product',
        description: '新商品発売に最適。期待感を高めて購入へ導く。',
        sections: [
            { role: 'hero', title: 'ヒーロー', description: '商品ビジュアルとキャッチコピー' },
            { role: 'announcement', title: '新登場', description: '新しさ・革新性をアピール' },
            { role: 'benefits', title: 'ベネフィット', description: 'ユーザーにとっての価値' },
            { role: 'specs', title: 'スペック', description: '商品の詳細仕様' },
            { role: 'comparison', title: '比較', description: '競合との差別化' },
            { role: 'gallery', title: 'ギャラリー', description: '商品写真・動画' },
            { role: 'reviews', title: 'レビュー', description: 'ユーザーの評価' },
            { role: 'purchase', title: '購入', description: '購入ボタンと特典' },
        ]
    },
    {
        id: 'saas-conversion',
        name: 'SaaS コンバージョンLP',
        category: 'saas',
        description: '無料トライアルや登録への誘導に特化。',
        sections: [
            { role: 'hero', title: 'ヒーロー', description: '価値提案と無料トライアルCTA' },
            { role: 'demo', title: 'デモ・スクリーンショット', description: '製品の見た目・使用感' },
            { role: 'pain-points', title: '課題', description: '解決する業務課題' },
            { role: 'features', title: '機能一覧', description: '主要機能の説明' },
            { role: 'integrations', title: '連携', description: '他ツールとの連携' },
            { role: 'security', title: 'セキュリティ', description: 'データ保護・信頼性' },
            { role: 'case-studies', title: '導入事例', description: '企業の成功事例' },
            { role: 'pricing', title: '料金プラン', description: 'プラン比較表' },
            { role: 'signup', title: '登録', description: '無料で始めるCTA' },
        ]
    },
    {
        id: 'consulting-authority',
        name: 'コンサルティング権威LP',
        category: 'consulting',
        description: '専門性と信頼性を前面に。相談・問い合わせへ導く。',
        sections: [
            { role: 'hero', title: 'ヒーロー', description: '専門性を示すキャッチコピー' },
            { role: 'credentials', title: '実績・資格', description: '信頼性の証明' },
            { role: 'methodology', title: '手法', description: '独自のアプローチ' },
            { role: 'results', title: '成果', description: '具体的な数字・事例' },
            { role: 'profile', title: 'プロフィール', description: 'コンサルタント紹介' },
            { role: 'service-flow', title: 'サービスの流れ', description: '相談から成果まで' },
            { role: 'packages', title: 'プラン', description: 'サービス内容と料金' },
            { role: 'contact', title: 'お問い合わせ', description: '無料相談の案内' },
        ],
        isPremium: true
    },
    {
        id: 'event-registration',
        name: 'イベント・セミナーLP',
        category: 'event',
        description: 'セミナーやウェビナーへの参加登録に最適。',
        sections: [
            { role: 'hero', title: 'ヒーロー', description: 'イベント名と日時' },
            { role: 'speaker', title: '登壇者', description: '講師・スピーカー紹介' },
            { role: 'agenda', title: 'プログラム', description: '内容・タイムテーブル' },
            { role: 'who-should-attend', title: 'こんな方へ', description: '対象者' },
            { role: 'takeaways', title: '得られること', description: '参加メリット' },
            { role: 'past-events', title: '過去のイベント', description: '開催実績' },
            { role: 'venue', title: '開催概要', description: '場所・日時・参加方法' },
            { role: 'registration', title: '申し込み', description: '登録フォーム' },
        ],
        isPremium: true
    },
    {
        id: 'minimal-lp',
        name: 'ミニマルLP',
        category: 'service',
        description: 'シンプルな5セクション構成。素早く作成可能。',
        sections: [
            { role: 'hero', title: 'ヒーロー', description: 'キャッチコピーとCTA' },
            { role: 'about', title: '概要', description: 'サービス・商品の説明' },
            { role: 'features', title: '特徴', description: '3つの主要ポイント' },
            { role: 'testimonial', title: '声', description: '1つの強力な推薦' },
            { role: 'cta', title: 'CTA', description: '行動喚起' },
        ]
    },
    {
        id: 'long-form-sales',
        name: 'ロングフォーム セールスLP',
        category: 'product',
        description: '情報量で説得。高額商品やサービスに。',
        sections: [
            { role: 'hero', title: 'ヒーロー', description: '強力なヘッドライン' },
            { role: 'story', title: 'ストーリー', description: '背景・開発秘話' },
            { role: 'problem', title: '問題', description: '深掘りした課題提起' },
            { role: 'agitation', title: '危機感', description: '問題を放置するリスク' },
            { role: 'solution', title: '解決策', description: '商品・サービスの紹介' },
            { role: 'benefits', title: 'ベネフィット', description: '得られる価値一覧' },
            { role: 'proof', title: '証拠', description: 'データ・研究・実績' },
            { role: 'testimonials', title: '体験談', description: '複数の成功事例' },
            { role: 'bonuses', title: '特典', description: '今だけの追加特典' },
            { role: 'guarantee', title: '保証', description: '返金保証など' },
            { role: 'scarcity', title: '限定', description: '期間・数量限定' },
            { role: 'final-cta', title: '最終CTA', description: '購入・申込ボタン' },
        ],
        isPremium: true
    },
];

export default function StructureTemplateModal({
    isOpen,
    onClose,
    onApply,
    userPlan = 'free'
}: StructureTemplateModalProps) {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedTemplate, setSelectedTemplate] = useState<LPTemplate | null>(null);
    const [previewTemplate, setPreviewTemplate] = useState<LPTemplate | null>(null);

    const filteredTemplates = LP_TEMPLATES.filter(t =>
        selectedCategory === 'all' || t.category === selectedCategory
    );

    const canUseTemplate = (template: LPTemplate) => {
        if (!template.isPremium) return true;
        return userPlan === 'premium' || userPlan === 'max';
    };

    const handleApply = () => {
        if (!selectedTemplate) {
            toast.error('テンプレートを選択してください');
            return;
        }

        if (!canUseTemplate(selectedTemplate)) {
            toast.error('このテンプレートはPremiumプラン以上で利用可能です');
            return;
        }

        onApply(selectedTemplate);
        toast.success(`「${selectedTemplate.name}」を適用しました`);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-600 to-gray-700 flex items-center justify-center shadow-lg">
                            <LayoutTemplate className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">構成テンプレート</h2>
                            <p className="text-xs text-gray-500">効果的なLP構成を選択</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {/* Left: Template List */}
                    <div className="flex-1 overflow-y-auto p-6 border-r border-gray-100">
                        {/* Category Filter */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            {TEMPLATE_CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={clsx(
                                        "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                                        selectedCategory === cat.id
                                            ? "bg-slate-700 text-white"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    )}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>

                        {/* Template Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {filteredTemplates.map(template => (
                                <button
                                    key={template.id}
                                    onClick={() => {
                                        setSelectedTemplate(template);
                                        setPreviewTemplate(template);
                                    }}
                                    className={clsx(
                                        "relative p-4 rounded-xl border-2 text-left transition-all",
                                        selectedTemplate?.id === template.id
                                            ? "border-slate-600 bg-slate-50"
                                            : "border-gray-200 hover:border-gray-300",
                                        !canUseTemplate(template) && "opacity-60"
                                    )}
                                >
                                    {template.isPremium && (
                                        <span className="absolute top-2 right-2 flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full font-bold">
                                            <Crown className="h-2.5 w-2.5" />
                                            Premium
                                        </span>
                                    )}
                                    <h4 className="text-sm font-bold text-gray-900 mb-1 pr-16">{template.name}</h4>
                                    <p className="text-xs text-gray-500 mb-2">{template.description}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                        <span className="px-1.5 py-0.5 bg-gray-100 rounded">{template.sections.length}セクション</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: Preview */}
                    <div className="w-80 bg-gray-50 p-6 overflow-y-auto">
                        {previewTemplate ? (
                            <>
                                <div className="flex items-center gap-2 mb-4">
                                    <Eye className="h-4 w-4 text-gray-400" />
                                    <h3 className="text-sm font-bold text-gray-900">構成プレビュー</h3>
                                </div>
                                <div className="space-y-2">
                                    {previewTemplate.sections.map((section, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200"
                                        >
                                            <span className="flex-shrink-0 w-6 h-6 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-xs font-bold">
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900">{section.title}</p>
                                                <p className="text-[10px] text-gray-500">{section.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <LayoutTemplate className="h-12 w-12 text-gray-300 mb-3" />
                                <p className="text-sm text-gray-500">テンプレートを選択すると<br />構成がプレビューされます</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!selectedTemplate || !canUseTemplate(selectedTemplate)}
                        className="px-6 py-2 bg-gradient-to-r from-slate-600 to-gray-700 text-white text-sm font-bold rounded-lg hover:from-slate-700 hover:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        <Check className="h-4 w-4" />
                        テンプレートを適用
                    </button>
                </div>
            </div>
        </div>
    );
}
