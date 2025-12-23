import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BusinessInfoForm, BusinessInfo } from './BusinessInfoForm';

interface GeminiGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerated: (sections: any[]) => void;
}

type Step = 'input' | 'generating' | 'preview';

export const GeminiGeneratorModal: React.FC<GeminiGeneratorModalProps> = ({
    isOpen,
    onClose,
    onGenerated,
}) => {
    const [step, setStep] = useState<Step>('input');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleGenerate = async (data: BusinessInfo) => {
        setLoading(true);
        setError(null);
        setStep('generating');

        try {
            const response = await fetch('/api/lp-builder/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ businessInfo: data }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '生成に失敗しました');
            }

            if (result.success && result.data) {
                // 成功したら親コンポーネントに通知
                onGenerated(result.data.sections);
                onClose(); // とりあえず閉じる
                setStep('input'); // リセット
            } else {
                throw new Error('データの形式が不正です');
            }
        } catch (err: any) {
            console.error('Generation error:', err);
            setError(err.message || '予期せぬエラーが発生しました');
            setStep('input');
        } finally {
            setLoading(false);
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            ></div>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                            <span className="text-2xl">✨</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">AI LP Generator</h2>
                            <p className="text-sm text-gray-500">Powered by Gemini Pro</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-white/50 rounded-full"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto custom-scrollbar bg-gray-50/50">
                    {step === 'input' && (
                        <div className="animate-fadeIn">
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">ビジネス情報を入力してください</h3>
                                <p className="text-gray-600">
                                    あなたのビジネスについて教えてください。AIが最適な構成と文章を提案します。
                                </p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {error}
                                </div>
                            )}

                            <BusinessInfoForm
                                onSubmit={handleGenerate}
                                onCancel={onClose}
                                isLoading={loading}
                            />
                        </div>
                    )}

                    {step === 'generating' && (
                        <div className="flex flex-col items-center justify-center py-20 text-center animate-fadeIn">
                            <div className="relative w-24 h-24 mb-8">
                                <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center text-3xl animate-bounce">
                                    ✨
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-3">AIがLPを生成中です...</h3>
                            <p className="text-gray-500 max-w-md mx-auto">
                                市場分析、構成案の作成、キャッチコピーの執筆を行っています。<br />
                                これには30秒〜1分ほどかかる場合があります。
                            </p>

                            <div className="mt-10 w-full max-w-md bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-blue-600 h-1.5 rounded-full animate-progress"></div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );

    // Next.jsのApp Routerでもdocument.bodyがあればcreatePortalは使える
    // ただしSSR時はnullになるので注意
    if (typeof document === 'undefined') return null;

    return createPortal(modalContent, document.body);
};
