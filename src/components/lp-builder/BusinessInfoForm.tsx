import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';

const industryOptions = [
    'SaaS / IT',
    '飲食・フード',
    '美容・サロン',
    '不動産',
    '教育・スクール',
    'コンサルティング',
    'EC・物販',
    '医療・ヘルスケア',
    'その他',
];

const toneOptions = [
    { value: 'professional', label: 'プロフェッショナル', desc: '信頼感、誠実、論理的' },
    { value: 'friendly', label: 'フレンドリー', desc: '親しみやすさ、共感、柔らかい' },
    { value: 'luxury', label: 'ラグジュアリー', desc: '高級感、洗練、特別感' },
    { value: 'energetic', label: 'エネルギッシュ', desc: '活気、情熱、行動的' },
];

export const businessInfoSchema = z.object({
    businessName: z.string().min(1, 'ビジネス名は必須です'),
    industry: z.string().min(1, '業種を選択してください'),
    service: z.string().min(10, 'サービス概要は10文字以上で入力してください'),
    target: z.string().min(1, 'ターゲット顧客は必須です'),
    strengths: z.string().min(1, '主な強みは必須です'),
    differentiators: z.string().optional(),
    priceRange: z.string().optional(),
    tone: z.enum(['professional', 'friendly', 'luxury', 'energetic']),
});

export type BusinessInfo = z.infer<typeof businessInfoSchema>;

interface BusinessInfoFormProps {
    onSubmit: (data: BusinessInfo) => void;
    onCancel: () => void;
    isLoading: boolean;
}

export const BusinessInfoForm: React.FC<BusinessInfoFormProps> = ({
    onSubmit,
    onCancel,
    isLoading,
}) => {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<BusinessInfo>({
        resolver: zodResolver(businessInfoSchema),
        defaultValues: {
            tone: 'professional',
        },
    });

    const selectedTone = watch('tone');

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 左カラム */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            ビジネス名 <span className="text-red-500">*</span>
                        </label>
                        <input
                            {...register('businessName')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                            placeholder="例: TechFlow, 〇〇カフェ"
                        />
                        {errors.businessName && (
                            <p className="text-red-500 text-xs mt-1">{errors.businessName.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            業種 <span className="text-red-500">*</span>
                        </label>
                        <select
                            {...register('industry')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white"
                        >
                            <option value="">選択してください</option>
                            {industryOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                        {errors.industry && (
                            <p className="text-red-500 text-xs mt-1">{errors.industry.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            サービス概要 <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            {...register('service')}
                            rows={4}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none"
                            placeholder="どのようなサービスを提供していますか？主な特徴や提供価値などを具体的に入力してください。"
                        />
                        {errors.service && (
                            <p className="text-red-500 text-xs mt-1">{errors.service.message}</p>
                        )}
                    </div>
                </div>

                {/* 右カラム */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            ターゲット顧客 <span className="text-red-500">*</span>
                        </label>
                        <input
                            {...register('target')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                            placeholder="例: 30代の働く女性, 業務効率化したい中小企業"
                        />
                        {errors.target && (
                            <p className="text-red-500 text-xs mt-1">{errors.target.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            主な強み <span className="text-red-500">*</span>
                        </label>
                        <input
                            {...register('strengths')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                            placeholder="例: 業界最安値, 24時間サポート, 特許技術"
                        />
                        {errors.strengths && (
                            <p className="text-red-500 text-xs mt-1">{errors.strengths.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            差別化ポイント・こだわり (任意)
                        </label>
                        <input
                            {...register('differentiators')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                            placeholder="他社との違いや独自のこだわり"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            価格帯 (任意)
                        </label>
                        <input
                            {...register('priceRange')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                            placeholder="例: 月額980円〜, 1回5,000円"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                    トーン & マナー <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {toneOptions.map((tone) => (
                        <div
                            key={tone.value}
                            onClick={() => setValue('tone', tone.value as any)}
                            className={`
                cursor-pointer p-3 rounded-lg border-2 transition-all relative overflow-hidden
                ${selectedTone === tone.value
                                    ? 'border-blue-500 bg-blue-50 shadow-md'
                                    : 'border-gray-200 hover:border-blue-200 bg-white'
                                }
              `}
                        >
                            <div className="flex flex-col h-full justify-between">
                                <span className={`font-bold block mb-1 ${selectedTone === tone.value ? 'text-blue-700' : 'text-gray-900'}`}>{tone.label}</span>
                                <span className="text-xs text-gray-500">{tone.desc}</span>
                            </div>
                            {selectedTone === tone.value && (
                                <div className="absolute top-2 right-2 text-blue-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="pt-6 border-t border-gray-200 flex justify-end space-x-4">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isLoading}
                    className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors disabled:opacity-50"
                >
                    キャンセル
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="px-8 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            生成中...
                        </>
                    ) : (
                        <>
                            <span className="mr-2">✨</span> AIでLPを生成する
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};
