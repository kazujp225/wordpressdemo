"use client";

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Sparkles, X, AlertCircle, Loader2, DollarSign,
    ChevronRight, ChevronLeft, Check, Building2, Users,
    Target, Zap, MessageSquare, Award, HelpCircle, Lightbulb,
    FileText, Palette, Wand2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { GEMINI_PRICING } from '@/lib/ai-costs';

// Enhanced schema for deep product understanding
const textBasedLPSchema = z.object({
    // Step 1: Basic Business Info
    businessName: z.string().min(1, '会社名/サービス名は必須です'),
    industry: z.string().min(1, '業種を選択してください'),
    businessType: z.enum(['B2B', 'B2C', 'D2C', 'B2B2C']),

    // Step 2: Product/Service Details
    productName: z.string().min(1, '商品・サービス名は必須です'),
    productDescription: z.string().min(20, '詳細な説明を入力してください（20文字以上）'),
    productCategory: z.string().min(1, 'カテゴリを選択してください'),
    priceInfo: z.string().optional(),
    deliveryMethod: z.string().optional(),

    // Step 3: Target & Persona
    targetAudience: z.string().min(1, 'ターゲット層は必須です'),
    targetAge: z.string().optional(),
    targetGender: z.string().optional(),
    targetOccupation: z.string().optional(),
    targetIncome: z.string().optional(),
    painPoints: z.string().min(10, '課題・悩みを詳しく記載してください'),
    desiredOutcome: z.string().min(10, '理想の状態を記載してください'),

    // Step 4: Value Proposition
    mainBenefits: z.string().min(10, '主なメリットを記載してください'),
    uniqueSellingPoints: z.string().min(10, 'USP・差別化ポイントを記載してください'),
    socialProof: z.string().optional(),
    guarantees: z.string().optional(),

    // Step 5: Conversion Goal
    conversionGoal: z.enum(['inquiry', 'purchase', 'signup', 'download', 'consultation', 'trial']),
    ctaText: z.string().optional(),
    urgencyElement: z.string().optional(),

    // Step 6: Design Preferences
    tone: z.enum(['professional', 'friendly', 'luxury', 'energetic', 'minimal', 'playful']),
    colorPreference: z.string().optional(),
    imageStyle: z.enum(['photo', 'illustration', 'abstract', 'minimal', 'dynamic']),
});

export type TextBasedLPData = z.infer<typeof textBasedLPSchema>;

interface TextBasedLPGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerated: (sections: any[], meta?: { duration: number, estimatedCost: number }) => void;
}

const industryOptions = [
    'IT・テクノロジー', 'SaaS', 'EC・小売', '飲食・フード', '美容・サロン',
    '不動産', '教育・研修', 'コンサルティング', 'ヘルスケア・医療',
    '金融・保険', '製造業', '建設・建築', '旅行・観光', 'エンタメ・メディア',
    '人材・HR', '士業（弁護士・税理士等）', 'その他'
];

const productCategories = [
    'ソフトウェア・アプリ', 'サブスクリプションサービス', 'コンサルティング',
    '物販商品', 'オンライン講座・教材', 'スクール・教室', '施術・トリートメント',
    'レンタル・リース', 'マッチングサービス', 'その他'
];

const toneOptions = [
    { value: 'professional', label: 'プロフェッショナル', desc: '信頼感・専門性重視', icon: Building2 },
    { value: 'friendly', label: 'フレンドリー', desc: '親しみやすさ・カジュアル', icon: Users },
    { value: 'luxury', label: 'ラグジュアリー', desc: '高級感・洗練', icon: Award },
    { value: 'energetic', label: 'エネルギッシュ', desc: '活気・情熱', icon: Zap },
    { value: 'minimal', label: 'ミニマル', desc: 'シンプル・洗練', icon: FileText },
    { value: 'playful', label: 'プレイフル', desc: '遊び心・楽しさ', icon: Lightbulb },
];

const imageStyleOptions = [
    { value: 'photo', label: 'フォトリアル', desc: '写真風のリアルな画像' },
    { value: 'illustration', label: 'イラスト', desc: '親しみやすいイラスト' },
    { value: 'abstract', label: '抽象的', desc: 'アート・抽象表現' },
    { value: 'minimal', label: 'ミニマル', desc: 'シンプルな背景' },
    { value: 'dynamic', label: 'ダイナミック', desc: '躍動感のある表現' },
];

const conversionGoalOptions = [
    { value: 'inquiry', label: 'お問い合わせ', desc: '問い合わせフォームへの誘導' },
    { value: 'purchase', label: '購入', desc: '商品購入・決済' },
    { value: 'signup', label: '会員登録', desc: 'サービス登録・申込' },
    { value: 'download', label: '資料請求', desc: '資料ダウンロード' },
    { value: 'consultation', label: '無料相談', desc: '相談予約・カウンセリング' },
    { value: 'trial', label: '無料体験', desc: 'トライアル・お試し' },
];

const STEPS = [
    { id: 1, title: '基本情報', icon: Building2, desc: 'ビジネスの基本情報' },
    { id: 2, title: '商品・サービス', icon: FileText, desc: '提供するものの詳細' },
    { id: 3, title: 'ターゲット', icon: Target, desc: '顧客像と課題' },
    { id: 4, title: '価値提案', icon: Award, desc: 'USP・メリット' },
    { id: 5, title: 'コンバージョン', icon: Zap, desc: '目標と行動喚起' },
    { id: 6, title: 'デザイン', icon: Palette, desc: 'トーン・スタイル' },
];

export const TextBasedLPGenerator: React.FC<TextBasedLPGeneratorProps> = ({
    isOpen,
    onClose,
    onGenerated,
}) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [autoSuggestLoading, setAutoSuggestLoading] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        control,
        watch,
        trigger,
        setValue,
        getValues,
        formState: { errors },
    } = useForm<TextBasedLPData>({
        resolver: zodResolver(textBasedLPSchema),
        defaultValues: {
            businessType: 'B2C',
            tone: 'professional',
            imageStyle: 'photo',
            conversionGoal: 'inquiry',
        },
    });

    const watchedTone = watch('tone');
    const watchedImageStyle = watch('imageStyle');
    const watchedConversionGoal = watch('conversionGoal');
    const watchedBusinessType = watch('businessType');

    // Step validation before moving forward
    const validateStep = async (step: number): Promise<boolean> => {
        const stepFields: Record<number, (keyof TextBasedLPData)[]> = {
            1: ['businessName', 'industry', 'businessType'],
            2: ['productName', 'productDescription', 'productCategory'],
            3: ['targetAudience', 'painPoints', 'desiredOutcome'],
            4: ['mainBenefits', 'uniqueSellingPoints'],
            5: ['conversionGoal'],
            6: ['tone', 'imageStyle'],
        };

        const fields = stepFields[step];
        if (!fields) return true;

        const result = await trigger(fields);
        return result;
    };

    const handleNext = async () => {
        const isValid = await validateStep(currentStep);
        if (isValid && currentStep < 6) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    // 自動提案機能
    const handleAutoSuggest = async (type: 'benefits' | 'usp' | 'socialProof' | 'guarantees' | 'all') => {
        setAutoSuggestLoading(type);
        setError(null);

        try {
            const values = getValues();

            // 必要な情報が揃っているかチェック
            if (!values.businessName || !values.productDescription || !values.targetAudience || !values.painPoints) {
                toast.error('基本情報・商品情報・ターゲット情報を先に入力してください');
                setAutoSuggestLoading(null);
                return;
            }

            const response = await fetch('/api/ai/suggest-benefits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessName: values.businessName,
                    industry: values.industry,
                    businessType: values.businessType,
                    productName: values.productName,
                    productDescription: values.productDescription,
                    productCategory: values.productCategory,
                    priceInfo: values.priceInfo,
                    deliveryMethod: values.deliveryMethod,
                    targetAudience: values.targetAudience,
                    targetAge: values.targetAge,
                    targetGender: values.targetGender,
                    targetOccupation: values.targetOccupation,
                    painPoints: values.painPoints,
                    desiredOutcome: values.desiredOutcome,
                    generateType: type,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '提案の生成に失敗しました');
            }

            if (result.success && result.suggestions) {
                // 提案を各フィールドに設定
                if (type === 'all' || type === 'benefits') {
                    if (result.suggestions.benefits?.length > 0) {
                        setValue('mainBenefits', result.suggestions.benefits.map((b: string) => `・${b}`).join('\n'));
                    }
                }
                if (type === 'all' || type === 'usp') {
                    if (result.suggestions.usp?.length > 0) {
                        setValue('uniqueSellingPoints', result.suggestions.usp.map((u: string) => `・${u}`).join('\n'));
                    }
                }
                if (type === 'all' || type === 'socialProof') {
                    if (result.suggestions.socialProof?.length > 0) {
                        setValue('socialProof', result.suggestions.socialProof.map((s: string) => `・${s}`).join('\n'));
                    }
                }
                if (type === 'all' || type === 'guarantees') {
                    if (result.suggestions.guarantees?.length > 0) {
                        setValue('guarantees', result.suggestions.guarantees.join('、'));
                    }
                }

                toast.success(type === 'all' ? '全項目の提案を生成しました' : '提案を生成しました');
            }
        } catch (err: any) {
            console.error('Auto suggest error:', err);
            toast.error(err.message || '提案の生成に失敗しました');
        } finally {
            setAutoSuggestLoading(null);
        }
    };

    const handleGenerate = async (data: TextBasedLPData) => {
        setLoading(true);
        setError(null);

        try {
            // Convert form data to BusinessInfo format for API
            // Map 6 tones to 4 supported API tones
            const toneMapping: Record<string, string> = {
                professional: 'professional',
                friendly: 'friendly',
                luxury: 'luxury',
                energetic: 'energetic',
                minimal: 'professional', // シンプル → プロフェッショナル
                playful: 'friendly',     // 遊び心 → フレンドリー
            };

            const businessInfo = {
                businessName: data.businessName,
                industry: data.industry,
                service: data.productDescription,
                target: data.targetAudience,
                strengths: data.mainBenefits,
                differentiators: data.uniqueSellingPoints,
                priceRange: data.priceInfo || '',
                tone: toneMapping[data.tone] || 'professional',
            };

            // Enhanced context for AI
            const enhancedContext = {
                businessType: data.businessType,
                productName: data.productName,
                productCategory: data.productCategory,
                deliveryMethod: data.deliveryMethod,
                targetAge: data.targetAge,
                targetGender: data.targetGender,
                targetOccupation: data.targetOccupation,
                targetIncome: data.targetIncome,
                painPoints: data.painPoints,
                desiredOutcome: data.desiredOutcome,
                socialProof: data.socialProof,
                guarantees: data.guarantees,
                conversionGoal: data.conversionGoal,
                ctaText: data.ctaText,
                urgencyElement: data.urgencyElement,
                colorPreference: data.colorPreference,
                imageStyle: data.imageStyle,
                // 元のトーン情報も保持（'minimal', 'playful'含む）
                originalTone: data.tone,
            };

            const response = await fetch('/api/lp-builder/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    businessInfo,
                    enhancedContext,
                    mode: 'text-based',
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '生成に失敗しました');
            }

            if (result.success && result.data) {
                onGenerated(result.data.sections, result.data.meta);
                onClose();
                setCurrentStep(1);
            } else {
                throw new Error('不正なデータ形式です');
            }
        } catch (err: any) {
            console.error('Generation error:', err);
            setError(err.message || '予期しないエラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                会社名 / サービス名 <span className="text-red-500">*</span>
                            </label>
                            <input
                                {...register('businessName')}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                placeholder="例: 株式会社ABC、ABCサービス"
                            />
                            {errors.businessName && (
                                <p className="text-red-500 text-[10px] mt-1">{errors.businessName.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                業種 <span className="text-red-500">*</span>
                            </label>
                            <select
                                {...register('industry')}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                            >
                                <option value="">選択してください</option>
                                {industryOptions.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                            {errors.industry && (
                                <p className="text-red-500 text-[10px] mt-1">{errors.industry.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                ビジネスモデル <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {['B2B', 'B2C', 'D2C', 'B2B2C'].map((type) => (
                                    <label
                                        key={type}
                                        className={`
                                            cursor-pointer p-3 rounded-xl border text-center transition-all
                                            ${watchedBusinessType === type
                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-200 bg-white/60 hover:border-indigo-300'
                                            }
                                        `}
                                    >
                                        <input
                                            type="radio"
                                            value={type}
                                            {...register('businessType')}
                                            className="sr-only"
                                        />
                                        <span className="text-sm font-bold">{type}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                商品・サービス名 <span className="text-red-500">*</span>
                            </label>
                            <input
                                {...register('productName')}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                placeholder="例: プレミアム経営コンサルティング"
                            />
                            {errors.productName && (
                                <p className="text-red-500 text-[10px] mt-1">{errors.productName.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                カテゴリ <span className="text-red-500">*</span>
                            </label>
                            <select
                                {...register('productCategory')}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                            >
                                <option value="">選択してください</option>
                                {productCategories.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            {errors.productCategory && (
                                <p className="text-red-500 text-[10px] mt-1">{errors.productCategory.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                商品・サービスの詳細説明 <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                {...register('productDescription')}
                                rows={5}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm resize-none"
                                placeholder="何を提供していて、どのような特徴があるか詳しく記載してください"
                            />
                            {errors.productDescription && (
                                <p className="text-red-500 text-[10px] mt-1">{errors.productDescription.message}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                    価格帯・料金
                                </label>
                                <input
                                    {...register('priceInfo')}
                                    className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                    placeholder="例: 月額9,800円〜"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                    提供方法
                                </label>
                                <input
                                    {...register('deliveryMethod')}
                                    className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                    placeholder="例: オンライン、対面、配送"
                                />
                            </div>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                ターゲット層（誰に届けたいか） <span className="text-red-500">*</span>
                            </label>
                            <input
                                {...register('targetAudience')}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                placeholder="例: 売上アップを目指す中小企業の経営者"
                            />
                            {errors.targetAudience && (
                                <p className="text-red-500 text-[10px] mt-1">{errors.targetAudience.message}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                    年齢層
                                </label>
                                <input
                                    {...register('targetAge')}
                                    className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                    placeholder="例: 30〜50代"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                    性別
                                </label>
                                <select
                                    {...register('targetGender')}
                                    className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                >
                                    <option value="">指定なし</option>
                                    <option value="male">男性</option>
                                    <option value="female">女性</option>
                                    <option value="both">両方</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                    職業・役職
                                </label>
                                <input
                                    {...register('targetOccupation')}
                                    className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                    placeholder="例: 経営者、マーケター"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                    収入・予算感
                                </label>
                                <input
                                    {...register('targetIncome')}
                                    className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                    placeholder="例: 年収800万以上"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                ターゲットが抱える課題・悩み <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                {...register('painPoints')}
                                rows={3}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm resize-none"
                                placeholder="ターゲットが日々感じている不満、困っていること"
                            />
                            {errors.painPoints && (
                                <p className="text-red-500 text-[10px] mt-1">{errors.painPoints.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                ターゲットの理想の状態 <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                {...register('desiredOutcome')}
                                rows={3}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm resize-none"
                                placeholder="サービス利用後にどうなりたいか、理想のゴール"
                            />
                            {errors.desiredOutcome && (
                                <p className="text-red-500 text-[10px] mt-1">{errors.desiredOutcome.message}</p>
                            )}
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-6 animate-fadeIn">
                        {/* 一括提案ボタン */}
                        <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg text-white">
                                        <Wand2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900">自動提案</h4>
                                        <p className="text-[10px] text-gray-500">商材情報から自動でコピーを生成</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleAutoSuggest('all')}
                                    disabled={autoSuggestLoading !== null}
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20"
                                >
                                    {autoSuggestLoading === 'all' ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            生成中...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4" />
                                            全項目を提案
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                    主なメリット・ベネフィット <span className="text-red-500">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => handleAutoSuggest('benefits')}
                                    disabled={autoSuggestLoading !== null}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 disabled:opacity-50 transition-all"
                                >
                                    {autoSuggestLoading === 'benefits' ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Wand2 className="h-3 w-3" />
                                    )}
                                    自動提案
                                </button>
                            </div>
                            <textarea
                                {...register('mainBenefits')}
                                rows={4}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm resize-none"
                                placeholder="顧客が得られる具体的なメリットを箇条書きで&#10;例: &#10;・売上が平均30%アップ&#10;・業務時間を50%削減&#10;・専任サポートで安心"
                            />
                            {errors.mainBenefits && (
                                <p className="text-red-500 text-[10px] mt-1">{errors.mainBenefits.message}</p>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                    独自の強み・差別化ポイント (USP) <span className="text-red-500">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => handleAutoSuggest('usp')}
                                    disabled={autoSuggestLoading !== null}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 disabled:opacity-50 transition-all"
                                >
                                    {autoSuggestLoading === 'usp' ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Wand2 className="h-3 w-3" />
                                    )}
                                    自動提案
                                </button>
                            </div>
                            <textarea
                                {...register('uniqueSellingPoints')}
                                rows={4}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm resize-none"
                                placeholder="競合と比べて何が違うか、なぜ選ばれるのか&#10;例:&#10;・業界唯一のAI自動分析機能&#10;・10年の実績と500社以上の導入実績"
                            />
                            {errors.uniqueSellingPoints && (
                                <p className="text-red-500 text-[10px] mt-1">{errors.uniqueSellingPoints.message}</p>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                    社会的証明（実績・お客様の声など）
                                </label>
                                <button
                                    type="button"
                                    onClick={() => handleAutoSuggest('socialProof')}
                                    disabled={autoSuggestLoading !== null}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 disabled:opacity-50 transition-all"
                                >
                                    {autoSuggestLoading === 'socialProof' ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Wand2 className="h-3 w-3" />
                                    )}
                                    自動提案
                                </button>
                            </div>
                            <textarea
                                {...register('socialProof')}
                                rows={3}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm resize-none"
                                placeholder="導入企業数、満足度、受賞歴、メディア掲載など"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                    保証・安心要素
                                </label>
                                <button
                                    type="button"
                                    onClick={() => handleAutoSuggest('guarantees')}
                                    disabled={autoSuggestLoading !== null}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 disabled:opacity-50 transition-all"
                                >
                                    {autoSuggestLoading === 'guarantees' ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Wand2 className="h-3 w-3" />
                                    )}
                                    自動提案
                                </button>
                            </div>
                            <textarea
                                {...register('guarantees')}
                                rows={2}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm resize-none"
                                placeholder="例: 30日間返金保証、無料トライアル、24時間サポート"
                            />
                        </div>

                        <p className="text-[10px] text-gray-400 text-center mt-2">
                            ※ 自動提案は参考情報です。実際の内容に合わせて編集してください。
                        </p>
                    </div>
                );

            case 5:
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
                                コンバージョン目標 <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {conversionGoalOptions.map((goal) => (
                                    <label
                                        key={goal.value}
                                        className={`
                                            cursor-pointer p-4 rounded-xl border transition-all
                                            ${watchedConversionGoal === goal.value
                                                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/20'
                                                : 'border-gray-200 bg-white/60 hover:border-indigo-300'
                                            }
                                        `}
                                    >
                                        <input
                                            type="radio"
                                            value={goal.value}
                                            {...register('conversionGoal')}
                                            className="sr-only"
                                        />
                                        <span className={`block text-sm font-bold ${watchedConversionGoal === goal.value ? 'text-indigo-700' : 'text-gray-700'}`}>
                                            {goal.label}
                                        </span>
                                        <span className="text-[10px] text-gray-500">{goal.desc}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                CTAボタンのテキスト
                            </label>
                            <input
                                {...register('ctaText')}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                placeholder="例: 今すぐ無料相談する、資料をダウンロード"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                緊急性・限定要素
                            </label>
                            <input
                                {...register('urgencyElement')}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                placeholder="例: 先着30名限定、今月末まで20%OFF"
                            />
                        </div>
                    </div>
                );

            case 6:
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
                                トーン＆マナー <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {toneOptions.map((tone) => {
                                    const Icon = tone.icon;
                                    return (
                                        <label
                                            key={tone.value}
                                            className={`
                                                cursor-pointer p-4 rounded-xl border transition-all flex items-start gap-3
                                                ${watchedTone === tone.value
                                                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/20'
                                                    : 'border-gray-200 bg-white/60 hover:border-indigo-300'
                                                }
                                            `}
                                        >
                                            <input
                                                type="radio"
                                                value={tone.value}
                                                {...register('tone')}
                                                className="sr-only"
                                            />
                                            <Icon className={`w-5 h-5 mt-0.5 ${watchedTone === tone.value ? 'text-indigo-600' : 'text-gray-400'}`} />
                                            <div>
                                                <span className={`block text-sm font-bold ${watchedTone === tone.value ? 'text-indigo-700' : 'text-gray-700'}`}>
                                                    {tone.label}
                                                </span>
                                                <span className="text-[10px] text-gray-500">{tone.desc}</span>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
                                画像スタイル <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {imageStyleOptions.map((style) => (
                                    <label
                                        key={style.value}
                                        className={`
                                            cursor-pointer p-3 rounded-xl border text-center transition-all
                                            ${watchedImageStyle === style.value
                                                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/20'
                                                : 'border-gray-200 bg-white/60 hover:border-indigo-300'
                                            }
                                        `}
                                    >
                                        <input
                                            type="radio"
                                            value={style.value}
                                            {...register('imageStyle')}
                                            className="sr-only"
                                        />
                                        <span className={`block text-sm font-bold ${watchedImageStyle === style.value ? 'text-indigo-700' : 'text-gray-700'}`}>
                                            {style.label}
                                        </span>
                                        <span className="text-[9px] text-gray-500 block mt-0.5">{style.desc}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                カラー指定（任意）
                            </label>
                            <input
                                {...register('colorPreference')}
                                className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                placeholder="例: ブルー系、コーポレートカラー #3B82F6"
                            />
                        </div>

                        {/* Cost Estimate */}
                        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl">
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-amber-600" />
                                <span className="text-sm font-bold text-amber-800">
                                    API課金費用: 約$0.20〜$0.50
                                </span>
                            </div>
                            <p className="text-xs text-amber-600 mt-1 ml-7">
                                約5-10セクション × ${GEMINI_PRICING['gemini-3-pro-image-preview'].perImage}（Gemini 3 Pro Image）
                            </p>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 30, stiffness: 350 }}
                className="relative bg-white/90 backdrop-blur-2xl border border-white/40 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-white/20 bg-white/30 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                            <div className="p-2.5 bg-gradient-to-tr from-green-500 via-emerald-500 to-teal-500 rounded-xl shadow-lg shadow-green-500/30">
                                <FileText className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                                    テキストベースLP作成
                                </h2>
                                <p className="text-[10px] font-bold text-green-600/80 uppercase tracking-widest mt-1 bg-green-50/50 px-2 py-0.5 rounded-full inline-block border border-green-100">
                                    商材理解から自動生成
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 text-gray-400 hover:bg-white/80 hover:text-gray-900 rounded-full transition-all"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Step Indicator */}
                    <div className="mt-6 flex items-center justify-between">
                        {STEPS.map((step, idx) => {
                            const Icon = step.icon;
                            const isActive = currentStep === step.id;
                            const isCompleted = currentStep > step.id;
                            return (
                                <React.Fragment key={step.id}>
                                    <div className="flex flex-col items-center">
                                        <div className={`
                                            w-10 h-10 rounded-full flex items-center justify-center transition-all
                                            ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : ''}
                                            ${isCompleted ? 'bg-green-500 text-white' : ''}
                                            ${!isActive && !isCompleted ? 'bg-gray-100 text-gray-400' : ''}
                                        `}>
                                            {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                                        </div>
                                        <span className={`text-[10px] font-bold mt-1.5 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
                                            {step.title}
                                        </span>
                                    </div>
                                    {idx < STEPS.length - 1 && (
                                        <div className={`flex-1 h-0.5 mx-2 ${currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'}`} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto flex-1 bg-gradient-to-b from-white/40 to-white/10">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="relative w-32 h-32 mb-8">
                                <div className="absolute inset-0 border-4 border-indigo-100/50 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Sparkles className="h-10 w-10 text-indigo-500 animate-pulse" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">LP を生成中...</h3>
                            <p className="text-gray-500 text-sm">商材情報を分析し、最適なLPを構築しています</p>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="mb-6 p-4 bg-red-50/80 border border-red-100 rounded-xl text-red-600 flex items-center text-sm"
                                >
                                    <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
                                    <span className="font-bold">{error}</span>
                                </motion.div>
                            )}

                            <form onSubmit={handleSubmit(handleGenerate)}>
                                {renderStepContent()}
                            </form>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!loading && (
                    <div className="px-8 py-5 border-t border-gray-100 bg-white/50 flex justify-between items-center">
                        <button
                            type="button"
                            onClick={handleBack}
                            disabled={currentStep === 1}
                            className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 px-4 py-2 rounded-xl hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            戻る
                        </button>

                        {currentStep < 6 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all"
                            >
                                次へ
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit(handleGenerate)}
                                disabled={loading}
                                className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-3 rounded-xl text-sm font-bold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-green-500/20"
                            >
                                <Sparkles className="h-4 w-4" />
                                LP を生成する
                            </button>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );

    if (typeof document === 'undefined') return null;

    return createPortal(modalContent, document.body);
};
