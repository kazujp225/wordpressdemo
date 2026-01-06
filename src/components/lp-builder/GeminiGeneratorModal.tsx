import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BusinessInfoForm, BusinessInfo } from './BusinessInfoForm';
import { Sparkles, X, AlertCircle, Loader2, DollarSign } from 'lucide-react';
import { GEMINI_PRICING } from '@/lib/ai-costs';

interface GeminiGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerated: (sections: any[], meta?: { duration: number, estimatedCost: number }) => void;
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

    // Design Analysis State
    const [designImage, setDesignImage] = useState<string | null>(null);
    const [designDefinition, setDesignDefinition] = useState<any | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleDesignImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        setError(null);

        try {
            // Convert to Base64
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result as string;
                setDesignImage(base64);

                // Analyze
                try {
                    const res = await fetch('/api/ai/analyze-design', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageUrl: base64 })
                    });

                    if (!res.ok) throw new Error('Failed to analyze design');

                    const data = await res.json();
                    setDesignDefinition(data);
                } catch (err) {
                    console.error(err);
                    setError('Failed to analyze design. Please try another image.');
                    setDesignImage(null);
                } finally {
                    setIsAnalyzing(false);
                }
            };
        } catch (err) {
            console.error(err);
            setIsAnalyzing(false);
        }
    };

    if (!isOpen) return null;

    const handleGenerate = async (data: BusinessInfo) => {
        setLoading(true);
        setError(null);
        setStep('generating');

        try {
            // v2: designImageBase64をStyle Anchorとして送信（Base64のdataプレフィックスを除去）
            let designImageBase64: string | undefined;
            if (designImage) {
                // "data:image/png;base64,xxxxx" から "xxxxx" 部分だけ抽出
                const base64Match = designImage.match(/^data:image\/[^;]+;base64,(.+)$/);
                if (base64Match) {
                    designImageBase64 = base64Match[1];
                }
            }

            const response = await fetch('/api/lp-builder/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    businessInfo: data,
                    designDefinition: designDefinition, // デザイン分析結果（色・トーン情報）
                    designImageBase64: designImageBase64 // v2: Style Anchor用の画像データ
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Generation failed');
            }

            if (result.success && result.data) {
                onGenerated(result.data.sections, result.data.meta);
                onClose();
                setStep('input');
            } else {
                throw new Error('Invalid data format received');
            }
        } catch (err: any) {
            console.error('Generation error:', err);
            setError(err.message || 'An unexpected error occurred');
            setStep('input');
        } finally {
            setLoading(false);
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
                initial={{ opacity: 0, scale: 0.95, y: 20, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.95, y: 20, filter: "blur(10px)" }}
                transition={{ type: "spring", damping: 30, stiffness: 350 }}
                className="relative bg-white/80 backdrop-blur-2xl border border-white/40 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col ring-1 ring-white/50"
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-white/20 flex justify-between items-center bg-white/30 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center space-x-4">
                        <div className="p-2.5 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-xl shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                            <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 tracking-tight leading-none font-manrope">AI Page Generator</h2>
                            <p className="text-[10px] font-bold text-indigo-600/80 uppercase tracking-widest mt-1.5 font-mono bg-indigo-50/50 px-2 py-0.5 rounded-full inline-block border border-indigo-100">Powered by Gemini 2.0 Flash</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 text-gray-400 hover:bg-white/80 hover:text-gray-900 rounded-full transition-all hover:shadow-sm"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-gradient-to-b from-white/40 to-white/10">
                    {step === 'input' && (
                        <div className="animate-fadeIn max-w-2xl mx-auto py-4">
                            <div className="mb-10 text-center">
                                <h3 className="text-3xl font-bold text-gray-900 mb-3 tracking-tighter">Tell us about your business</h3>
                                <p className="text-gray-500 leading-relaxed text-base font-medium">
                                    Share the details, and our AI will architect the perfect landing page structure and copy.<br />
                                    <span className="text-xs opacity-70 block mt-3 font-semibold tracking-wide text-indigo-400">MORE DETAILS = BETTER RESULTS</span>
                                </p>
                            </div>

                            {/* Design Reference Upload Section */}
                            <div className="mb-10 p-1 rounded-3xl bg-gradient-to-br from-indigo-100/50 via-white/50 to-purple-100/50 border border-indigo-100/50 shadow-sm backdrop-blur-sm group hover:shadow-md transition-all duration-500">
                                <div className="bg-white/60 backdrop-blur-xl rounded-[20px] p-6 transition-all group-hover:bg-white/80">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-bold text-gray-900 flex items-center text-sm tracking-tight">
                                            <Sparkles className="w-4 h-4 mr-2 text-indigo-500" />
                                            Design Reference (Optional)
                                        </h4>
                                        {designDefinition && (
                                            <span className="text-[10px] px-3 py-1 bg-green-100/80 text-green-700 rounded-full font-bold uppercase tracking-wide border border-green-200 backdrop-blur-sm">
                                                Analyzed: {designDefinition.vibe}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mb-6 leading-relaxed font-medium">
                                        Upload a reference image (screenshot or design), and the AI will analyze its "vibe" and color palette to match your page.
                                    </p>

                                    {!designImage && !designDefinition ? (
                                        <div className="relative border-2 border-dashed border-indigo-100 hover:border-indigo-400 transition-all rounded-2xl p-10 text-center cursor-pointer group/upload bg-indigo-50/20 hover:bg-white/50">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                onChange={handleDesignImageUpload}
                                                disabled={isAnalyzing}
                                            />
                                            <div className="flex flex-col items-center pointer-events-none">
                                                <div className="p-4 bg-white shadow-lg shadow-indigo-100 ring-1 ring-gray-100 group-hover/upload:ring-indigo-200 group-hover/upload:scale-110 rounded-2xl mb-4 transition-all duration-300">
                                                    {isAnalyzing ? (
                                                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                                                    ) : (
                                                        <Sparkles className="w-6 h-6 text-indigo-400 group-hover/upload:text-indigo-600 transition-colors" />
                                                    )}
                                                </div>
                                                <p className="text-sm font-bold text-gray-700 group-hover/upload:text-indigo-600 transition-colors">
                                                    {isAnalyzing ? 'Analyzing Design...' : 'Upload Reference Image'}
                                                </p>
                                                <p className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wide font-medium">PNG, JPG, WEBP (Max 5MB)</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start space-x-4 bg-white/80 p-4 rounded-2xl border border-indigo-50 shadow-sm relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/30 to-purple-50/30 pointer-events-none" />
                                            {designImage && (
                                                <img
                                                    src={designImage}
                                                    alt="Reference"
                                                    className="w-20 h-20 object-cover rounded-xl border-2 border-white shadow-md z-10"
                                                />
                                            )}
                                            <div className="flex-1 min-w-0 z-10 py-1">
                                                <h5 className="text-xs font-bold text-gray-900 mb-2 uppercase tracking-wider flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                    Design Definition
                                                </h5>
                                                {designDefinition ? (
                                                    <div className="text-xs text-gray-600 space-y-1.5 font-mono bg-white/50 p-2 rounded-lg border border-gray-100">
                                                        <p><span className="text-gray-400 font-bold">Vibe</span> {designDefinition.vibe}</p>
                                                        <p><span className="text-gray-400 font-bold">Palette</span> <span className="inline-flex gap-1 align-middle"><span className="w-3 h-3 rounded-full border border-gray-200" style={{ background: designDefinition.colorPalette?.primary }}></span><span className="w-3 h-3 rounded-full border border-gray-200" style={{ background: designDefinition.colorPalette?.background }}></span></span></p>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-400 italic">Analyzing visuals...</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setDesignImage(null);
                                                    setDesignDefinition(null);
                                                }}
                                                className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all z-10"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="mb-8 p-4 bg-red-50/80 backdrop-blur-sm border border-red-100 rounded-xl text-red-600 flex items-center text-sm shadow-sm ring-1 ring-red-200"
                                >
                                    <AlertCircle className="h-5 w-5 mr-3 text-red-500 flex-shrink-0" />
                                    <span className="font-bold">{error}</span>
                                </motion.div>
                            )}

                            {/* API課金費用の表示 */}
                            <div className="mb-8 p-4 bg-amber-50/80 backdrop-blur-sm border border-amber-200 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-5 w-5 text-amber-600" />
                                    <span className="text-sm font-bold text-amber-800">
                                        この作業のAPI課金費用: 約$0.20〜$0.40
                                    </span>
                                </div>
                                <p className="text-xs text-amber-600 mt-1 ml-7">
                                    約5-10セクション × ${GEMINI_PRICING['gemini-3-pro-image-preview'].perImage}（Gemini 3 Pro Image）
                                </p>
                            </div>

                            <BusinessInfoForm
                                onSubmit={handleGenerate}
                                onCancel={onClose}
                                isLoading={loading}
                            />
                        </div>
                    )}

                    {step === 'generating' && (
                        <div className="flex flex-col items-center justify-center py-32 text-center animate-fadeIn">
                            <div className="relative w-40 h-40 mb-12">
                                {/* Outer pulsing rings */}
                                <div className="absolute inset-0 border-2 border-indigo-100/30 rounded-full animate-ping opacity-20 duration-1000"></div>
                                <div className="absolute inset-[-12px] border border-indigo-100/20 rounded-full animate-pulse opacity-40"></div>

                                {/* Rotating gradients */}
                                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500/20 to-purple-500/0 animate-spin-slow blur-xl"></div>

                                {/* Main Loader */}
                                <div className="absolute inset-0 border-[6px] border-indigo-100/50 rounded-full backdrop-blur-sm"></div>
                                <div className="absolute inset-0 border-[6px] border-indigo-500 rounded-full border-t-transparent animate-spin shadow-[0_0_20px_rgba(99,102,241,0.3)]"></div>

                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full shadow-2xl shadow-indigo-500/50 flex items-center justify-center animate-bounce-subtle ring-4 ring-white/20">
                                        <Sparkles className="h-10 w-10 text-white animate-pulse" />
                                    </div>
                                </div>
                            </div>

                            <h3 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-indigo-800 to-gray-900 mb-6 tracking-tighter animate-gradient-x bg-[length:200%_auto]">
                                Generating your page...
                            </h3>
                            <p className="text-gray-500 font-medium max-w-sm mx-auto leading-relaxed mb-12 text-sm">
                                Analyzing market trends, structuring content, and crafting high-converting copy.<br />
                                <span className="text-indigo-600 font-bold mt-2 block bg-indigo-50/50 py-1 px-3 rounded-full inline-block border border-indigo-100">Creating a premium experience</span>
                            </p>

                            <div className="w-72 h-1.5 bg-gray-100 rounded-full overflow-hidden shadow-inner ring-1 ring-gray-200/50">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"
                                    initial={{ width: "0%", x: "-100%" }}
                                    animate={{ width: "100%", x: "0%" }}
                                    transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
                                />
                            </div>
                            <p className="mt-5 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] animate-pulse">
                                AI Processing
                            </p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );

    if (typeof document === 'undefined') return null;

    return createPortal(modalContent, document.body);
};
