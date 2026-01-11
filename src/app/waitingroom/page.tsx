"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight,
    Check,
    Sparkles,
    Image,
    Layers,
    Wand2,
    Download,
    Palette,
    Video,
    Globe,
    X
} from 'lucide-react';
import toast from 'react-hot-toast';

// Type declaration for custom web component
declare global {
    namespace JSX {
        interface IntrinsicElements {
            'dotlottie-wc': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
                src: string;
                autoplay?: boolean;
                loop?: boolean;
            }, HTMLElement>;
        }
    }
}

// 機能一覧データ
const FEATURES = [
    {
        icon: Globe,
        title: 'URLからLP取り込み',
        description: '既存のウェブページURLを入力するだけで、デザインを自動解析してセクションごとに取り込みます。',
    },
    {
        icon: Sparkles,
        title: 'AI画像生成',
        description: 'Google Geminiを使用して、プロンプトから高品質な画像を生成。ヒーロー画像やバナーを簡単に作成。',
    },
    {
        icon: Wand2,
        title: 'AIインペイント編集',
        description: '画像の一部を選択して、AIで自然に編集・修正。テキスト変更や要素の追加・削除が可能。',
    },
    {
        icon: Palette,
        title: 'リスタイル機能',
        description: 'ページ全体のデザインスタイルを一括で変更。色調やトーンを統一して洗練されたLPに。',
    },
    {
        icon: Layers,
        title: 'セクション管理',
        description: 'ドラッグ&ドロップでセクションを並び替え。各セクションを個別に編集・再生成できます。',
    },
    {
        icon: Image,
        title: '4Kアップスケール',
        description: '低解像度の画像を高品質な4K画像にアップスケール。印刷にも対応できる高解像度出力。',
    },
    {
        icon: Video,
        title: '動画生成（近日公開）',
        description: '静止画からAIで動画を生成。LPにダイナミックな動きを追加できます。',
    },
    {
        icon: Download,
        title: 'HTMLエクスポート',
        description: '完成したLPをHTMLファイルとしてエクスポート。どこでもホスティング可能な形式で出力。',
    },
];

export default function WaitingRoomPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        accountType: '' as 'individual' | 'corporate' | '',
        companyName: '',
        name: '',
        email: '',
        phone: '',
        remarks: '',
    });
    const [modalType, setModalType] = useState<'terms' | 'privacy' | null>(null);

    // Load Lottie Script
    useEffect(() => {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/@lottiefiles/dotlottie-wc@0.8.11/dist/dotlottie-wc.js";
        script.type = "module";
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch('/api/waitingroom', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountType: formData.accountType,
                    companyName: formData.companyName || undefined,
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone || undefined,
                    remarks: formData.remarks || undefined,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '登録に失敗しました');
            }

            toast.custom((t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-white text-gray-800 px-6 py-4 shadow-xl rounded-xl flex items-center gap-4 border border-amber-200`}>
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Check className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800">登録が完了しました</h3>
                        <p className="text-sm text-gray-500">順番が来ましたらメールでお知らせします</p>
                    </div>
                </div>
            ));

            setStep(2);
        } catch (error: any) {
            toast.custom((t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-white text-gray-800 px-6 py-4 shadow-xl rounded-xl flex items-center gap-4 border border-red-200`}>
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-red-600 font-bold">!</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800">登録に失敗しました</h3>
                        <p className="text-sm text-gray-500">{error.message}</p>
                    </div>
                </div>
            ));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-white text-black overflow-x-hidden selection:bg-amber-500 selection:text-white">
            {/* Hero Section */}
            <div className="relative">
                {/* Background Grid */}
                <div className="absolute inset-0 pointer-events-none z-0">
                    <div className="absolute left-[4rem] top-0 bottom-0 w-[1px] bg-gray-100 hidden md:block" />
                    <div className="absolute right-[4rem] top-0 bottom-0 w-[1px] bg-gray-100 hidden md:block" />
                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-gray-100 hidden md:block" />
                </div>

                <div className="relative z-10 flex flex-col lg:flex-row min-h-screen lg:h-screen lg:max-h-screen">
                    {/* Left Panel: Brand & Vision */}
                    {/* Left Panel: Brand & Vision */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-100 bg-white/50 backdrop-blur-sm relative overflow-hidden justify-center"
                    >
                        <header className="relative lg:absolute lg:top-0 lg:left-0 lg:w-full z-30 p-6 md:p-10 lg:p-10">
                            <a href="/" className="inline-block group">
                                <h1 className="text-lg font-black tracking-tighter transition-colors group-hover:text-amber-600">
                                    LP Builder
                                </h1>
                            </a>
                        </header>

                        {/* Main Content - Centered */}
                        <div className="relative z-20 flex flex-col justify-center px-6 md:px-10 lg:px-16 py-8 lg:py-0 h-full">
                            <div className="flex items-center mb-6">
                                <span className="text-amber-600 font-bold tracking-widest uppercase text-[10px] md:text-xs border border-amber-200 px-3 py-1 rounded-full bg-amber-50">
                                    AI-Powered LP Creation
                                </span>
                            </div>

                            {/* Lottie Animation */}
                            <div className="w-20 h-20 md:w-28 md:h-28 mb-4">
                                <dotlottie-wc
                                    src="https://lottie.host/bef0c297-c293-4e57-a030-24ff0c5cb2f0/xZUAd4jXZg.lottie"
                                    autoplay={true}
                                    loop={true}
                                    style={{ width: '100%', height: '100%' }}
                                ></dotlottie-wc>
                            </div>

                            {/* Typography */}
                            <h2 className="text-3xl md:text-5xl lg:text-5xl xl:text-6xl font-black tracking-tighter leading-[1.1] md:leading-[1.05] mb-6">
                                LP制作を、<br />
                                <span className="text-amber-600">AIの力で</span>革新する。
                            </h2>
                            {/* Paragraph */}
                            <p className="text-gray-600 font-medium text-sm md:text-base leading-relaxed max-w-lg mb-8">
                                URLから取り込み、AI画像生成、インペイント編集...<br />
                                <span className="text-black font-bold">すべてが一つのツールで完結します。</span>
                            </p>

                            {/* Feature Highlights */}
                            <div className="grid grid-cols-2 gap-2 md:gap-3 max-w-lg">
                                <div className="bg-white/60 backdrop-blur-sm border border-gray-100 rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center gap-2 md:gap-3 mb-1">
                                        <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                            <Globe className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                        </div>
                                        <span className="text-[10px] md:text-xs font-bold text-gray-800">URL取り込み</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 font-medium pl-1 hidden md:block">既存LPを瞬時に解析</p>
                                </div>
                                <div className="bg-white/60 backdrop-blur-sm border border-gray-100 rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center gap-2 md:gap-3 mb-1">
                                        <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                            <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                        </div>
                                        <span className="text-[10px] md:text-xs font-bold text-gray-800">AI画像生成</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 font-medium pl-1 hidden md:block">プロンプトから作成</p>
                                </div>
                                <div className="bg-white/60 backdrop-blur-sm border border-gray-100 rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center gap-2 md:gap-3 mb-1">
                                        <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                            <Wand2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                        </div>
                                        <span className="text-[10px] md:text-xs font-bold text-gray-800">インペイント</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 font-medium pl-1 hidden md:block">部分編集で自然に修正</p>
                                </div>
                                <div className="bg-white/60 backdrop-blur-sm border border-gray-100 rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center gap-2 md:gap-3 mb-1">
                                        <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                            <Download className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                        </div>
                                        <span className="text-[10px] md:text-xs font-bold text-gray-800">HTML出力</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 font-medium pl-1 hidden md:block">どこでも公開可能</p>
                                </div>
                            </div>
                        </div>

                        <div className="hidden lg:block absolute bottom-0 left-0 w-full z-20 p-6 lg:p-8">
                            <p className="text-[10px] font-bold text-gray-300 tracking-[0.2em]">
                                © 2026 ZETTAI INC.
                            </p>
                        </div>
                    </motion.div>

                    {/* Right Panel: Form & Pricing */}
                    <div className="w-full lg:w-1/2 p-6 md:p-8 lg:px-16 lg:py-4 flex flex-col justify-center min-h-0 lg:h-full bg-white/50 backdrop-blur-sm relative overflow-visible">
                        <AnimatePresence mode='wait'>
                            {step === 1 ? (
                                <motion.div
                                    key="form"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.6, delay: 0.2 }}
                                    className="max-w-md w-full mx-auto"
                                >
                                    {/* Welcome Message */}
                                    <div className="mb-4 text-center">
                                        <p className="text-gray-600 text-xs leading-relaxed">
                                            LP Builderにご興味をお持ちいただきありがとうございます。
                                        </p>
                                    </div>

                                    {/* Pricing Card */}
                                    <div className="mb-4 p-3 bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-xl relative shadow-sm">
                                        <div className="absolute -top-2.5 left-4 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                            現在ご案内中のプラン
                                        </div>
                                        <div className="pt-1 flex items-center justify-between">
                                            <div>
                                                <h3 className="text-xs font-bold text-amber-700">PoCプラン</h3>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-black text-gray-900">¥20,000</span>
                                                    <span className="text-gray-500 text-xs font-bold">/月（税別）</span>
                                                </div>
                                            </div>
                                            <ul className="space-y-1 text-[10px] text-gray-600 font-medium">
                                                <li className="flex items-center gap-1.5">
                                                    <Check className="w-3 h-3 text-amber-600" />
                                                    <span>AI生成 月100回</span>
                                                </li>
                                                <li className="flex items-center gap-1.5">
                                                    <Check className="w-3 h-3 text-amber-600" />
                                                    <span>全機能利用可能</span>
                                                </li>
                                                <li className="flex items-center gap-1.5">
                                                    <Check className="w-3 h-3 text-amber-600" />
                                                    <span>初月無料トライアル</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Waiting Room Notice - Simplified */}
                                    <div className="mb-4 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                                        <div className="flex gap-2 items-center">
                                            <div className="w-1 bg-amber-500 rounded-full h-8 self-center"></div>
                                            <p className="text-[10px] text-gray-600 leading-tight">
                                                <span className="font-bold text-gray-800 block">Waiting Room形式でのご案内</span>
                                                お申し込み順に、<span className="text-amber-600 font-bold">メールにて本登録のご案内</span>をお送りします。
                                            </p>
                                        </div>
                                    </div>

                                    {/* Form */}
                                    <form onSubmit={handleSubmit} className="space-y-3">
                                        {/* Account Type Selection */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-700">
                                                ご利用形態 <span className="text-red-500">*</span>
                                            </label>
                                            <div className="flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, accountType: 'individual' })}
                                                    className={`flex-1 py-2 px-3 rounded-lg border transition-all text-xs font-bold flex items-center justify-center gap-2 ${formData.accountType === 'individual'
                                                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                                                        : 'border-gray-100 hover:border-gray-200 text-gray-500 bg-gray-50'
                                                        }`}
                                                >
                                                    個人
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, accountType: 'corporate' })}
                                                    className={`flex-1 py-2 px-3 rounded-lg border transition-all text-xs font-bold flex items-center justify-center gap-2 ${formData.accountType === 'corporate'
                                                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                                                        : 'border-gray-100 hover:border-gray-200 text-gray-500 bg-gray-50'
                                                        }`}
                                                >
                                                    法人
                                                </button>
                                            </div>
                                        </div>

                                        {/* Company Name - only show for corporate */}
                                        <AnimatePresence>
                                            {formData.accountType === 'corporate' && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="space-y-1 pt-1">
                                                        <label className="text-xs font-bold text-gray-700">
                                                            会社名・屋号 <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            required
                                                            type="text"
                                                            value={formData.companyName}
                                                            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                                            placeholder="株式会社〇〇"
                                                            className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-base md:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-medium"
                                                        />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-gray-700">
                                                    お名前 <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    required
                                                    type="text"
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    placeholder="山田 太郎"
                                                    className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-base md:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-medium"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-gray-700">
                                                    メール <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    required
                                                    type="email"
                                                    value={formData.email}
                                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                    placeholder="example@co.jp"
                                                    className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-base md:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-medium"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-700">
                                                電話番号 <span className="text-gray-400 text-[10px] font-normal">（任意）</span>
                                            </label>
                                            <input
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                placeholder="03-1234-5678"
                                                className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-base md:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-medium"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-700">
                                                備考 <span className="text-gray-400 text-[10px] font-normal">（任意）</span>
                                            </label>
                                            <textarea
                                                value={formData.remarks}
                                                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                                placeholder="ご質問など"
                                                rows={2}
                                                className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-base md:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-medium resize-none"
                                            />
                                        </div>

                                        <div className="pt-2">
                                            <button
                                                type="submit"
                                                disabled={isLoading || !formData.accountType}
                                                className="w-full bg-gray-900 text-white hover:bg-amber-600 text-sm font-bold py-3 px-6 transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-amber-900/10"
                                            >
                                                {isLoading ? (
                                                    <span className="flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </span>
                                                ) : (
                                                    <>
                                                        リストに登録する
                                                        <ArrowRight className="w-4 h-4" />
                                                    </>
                                                )}
                                            </button>
                                            <p className="mt-2 text-[10px] text-gray-400 leading-tight text-center">
                                                ご登録いただくことで、<button type="button" onClick={() => setModalType('terms')} className="underline hover:text-amber-600">利用規約</button>および<button type="button" onClick={() => setModalType('privacy')} className="underline hover:text-amber-600">プライバシーポリシー</button>に同意したものとみなされます。
                                            </p>
                                        </div>
                                    </form>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                    className="max-w-md w-full mx-auto text-center"
                                >
                                    <div className="w-20 h-20 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/30">
                                        <Check className="w-10 h-10" />
                                    </div>
                                    <h3 className="text-2xl font-black mb-3 text-gray-900">
                                        You're on the list.
                                    </h3>
                                    <p className="text-gray-600 leading-relaxed mb-8">
                                        ご登録ありがとうございます。<br />
                                        ご案内まで今しばらくお待ちください。
                                    </p>

                                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 mb-8 text-left">
                                        <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4" /> Next Step
                                        </h4>
                                        <p className="text-sm text-amber-900/80 leading-relaxed">
                                            準備が整い次第、ご登録のメールアドレス宛に<br />
                                            <strong>本登録のご案内</strong>をお送りいたします。
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => setStep(1)}
                                        className="text-sm font-bold text-gray-400 hover:text-amber-600 transition-colors"
                                    >
                                        フォームに戻る
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <section className="py-24 px-6 md:px-12 lg:px-20 bg-gray-50 border-t border-gray-100">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-16"
                    >
                        <div className="flex items-center justify-center gap-4 mb-4">
                            <span className="inline-block w-8 h-[2px] bg-amber-500"></span>
                            <span className="text-amber-600 font-bold tracking-widest uppercase text-xs">
                                Features
                            </span>
                            <span className="inline-block w-8 h-[2px] bg-amber-500"></span>
                        </div>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-8">
                            Lp Builderでできること
                        </h2>
                        <p className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed">
                            最新のAI技術を活用して、高品質なランディングページを<br className="hidden md:block" />
                            誰でも簡単に作成・編集できます。
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
                        {FEATURES.map((feature, index) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="group"
                            >
                                <div className="w-14 h-14 bg-white rounded-2xl border border-gray-100 flex items-center justify-center mb-6 group-hover:border-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-sm group-hover:shadow-amber-500/20 duration-300">
                                    <feature.icon className="w-7 h-7" />
                                </div>
                                <h3 className="font-bold text-xl mb-3 text-gray-900 group-hover:text-amber-600 transition-colors">{feature.title}</h3>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    {feature.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="py-24 px-6 md:px-12 lg:px-20 bg-white">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-16"
                    >
                        <div className="flex items-center justify-center gap-4 mb-4">
                            <span className="inline-block w-8 h-[2px] bg-amber-500"></span>
                            <span className="text-amber-600 font-bold tracking-widest uppercase text-xs">
                                How It Works
                            </span>
                            <span className="inline-block w-8 h-[2px] bg-amber-500"></span>
                        </div>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6">
                            3ステップで完成
                        </h2>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="hidden md:block absolute top-[2.5rem] left-[16.66%] right-[16.66%] h-[2px] bg-gray-100 -z-10"></div>

                        {[
                            {
                                step: '01',
                                title: 'URLを入力',
                                description: '参考にしたいLPのURLを入力するか、新規作成を選択します。',
                                icon: Globe,
                            },
                            {
                                step: '02',
                                title: 'AIで編集',
                                description: 'テキストや画像をAIの力で自由に編集。プロンプトを入力するだけ。',
                                icon: Wand2,
                            },
                            {
                                step: '03',
                                title: 'エクスポート',
                                description: '完成したLPをHTMLでエクスポート。すぐに公開できます。',
                                icon: Download,
                            },
                        ].map((item, index) => (
                            <motion.div
                                key={item.step}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.2 }}
                                className="text-center relative bg-white md:bg-transparent p-6 md:p-0 rounded-xl md:rounded-none border md:border-0 border-gray-100 md:shadow-none shadow-sm"
                            >
                                <div className="relative inline-block mb-8">
                                    <div className="w-20 h-20 bg-white border-2 border-gray-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
                                        <item.icon className="w-8 h-8 text-gray-700" />
                                    </div>
                                    <span className="absolute -top-3 -right-3 w-8 h-8 bg-amber-500 text-white text-sm font-black rounded-full flex items-center justify-center shadow-md border-2 border-white">
                                        {item.step}
                                    </span>
                                </div>
                                <h3 className="font-bold text-xl mb-3 text-gray-900">{item.title}</h3>
                                <p className="text-gray-600 leading-relaxed font-medium text-sm">{item.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-6 md:px-12 lg:px-20 bg-gray-900 text-white relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-8">
                            LP制作をもっとシンプルに。<br />
                            もっとクリエイティブに。
                        </h2>
                        <p className="text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed text-lg">
                            PoCプランは初月無料でお試しいただけます。<br />
                            まずは順番待ちリストにご登録ください。
                        </p>
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="inline-flex items-center gap-3 bg-amber-500 text-white hover:bg-amber-600 font-bold py-5 px-10 transition-colors duration-300 rounded-xl shadow-lg shadow-amber-500/25 text-lg"
                        >
                            順番待ちリストに登録する
                            <ArrowRight className="w-6 h-6" />
                        </a>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-8 bg-gray-950 text-white border-t border-gray-800">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-gray-500 tracking-wide font-medium">
                        © 2026 ZETTAI INC. ALL RIGHTS RESERVED.
                    </p>
                    <div className="flex items-center gap-6 text-sm">
                        <a href="mailto:team@zettai.co.jp" className="text-gray-500 hover:text-amber-500 transition-colors font-medium">
                            team@zettai.co.jp
                        </a>
                    </div>
                </div>
            </footer>

            {/* Terms / Privacy Modal */}
            <AnimatePresence>
                {modalType && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                        onClick={() => setModalType(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-100">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {modalType === 'terms' ? '利用規約' : 'プライバシーポリシー'}
                                </h2>
                                <button
                                    onClick={() => setModalType(null)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
                                {modalType === 'terms' ? (
                                    <TermsContent />
                                ) : (
                                    <PrivacyContent />
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}

// 利用規約コンテンツ（フルバージョン）
function TermsContent() {
    return (
        <div className="prose prose-sm prose-gray max-w-none">
            <p className="text-xs text-gray-500 mb-6">最終更新日: 2026年1月10日</p>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第1条（総則）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>本利用規約（以下「本規約」といいます）は、株式会社ZETTAI（以下「当社」といいます）が提供するLP Builder（以下「本サービス」といいます）の利用条件を定めるものです。</li>
                    <li>本サービスを利用するすべての方（以下「利用者」といいます）は、本規約に同意したものとみなされます。</li>
                    <li>当社は、利用者に事前に通知することなく、本規約を変更することができるものとします。変更後の規約は、本サービス上に掲載した時点から効力を生じます。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第2条（サービスの内容）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>本サービスは、AI技術を活用したランディングページ（LP）の作成・編集支援ツールです。</li>
                    <li>本サービスには、URL取り込み、AI画像生成、インペイント編集、リスタイル、4Kアップスケール、HTMLエクスポート等の機能が含まれます。</li>
                    <li>当社は、本サービスの内容を予告なく変更、追加、または廃止することができます。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第3条（利用登録）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>本サービスの利用を希望する者は、当社が定める方法により利用登録を申請するものとします。</li>
                    <li>当社は、利用登録の申請者に以下の事由があると判断した場合、利用登録を拒否することがあります。<ul className="list-disc list-inside ml-4 mt-1"><li>虚偽の情報を提供した場合</li><li>過去に本規約に違反したことがある場合</li><li>その他、当社が利用登録を適当でないと判断した場合</li></ul></li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第4条（アカウント管理）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>利用者は、自己の責任においてアカウント情報を管理するものとします。</li>
                    <li>利用者は、アカウント情報を第三者に貸与、譲渡、または共有することはできません。</li>
                    <li>アカウント情報の管理不十分、第三者の使用等による損害の責任は、利用者が負うものとします。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第5条（料金および支払い）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>利用者は、本サービスの利用にあたり、当社が定める料金を支払うものとします。</li>
                    <li>料金の支払方法は、当社が指定する方法によるものとします。</li>
                    <li>支払われた料金は、法令に定める場合を除き、返金されません。</li>
                    <li>当社は、料金を変更する場合、事前に利用者に通知するものとします。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第6条（知的財産権・著作権）</h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
                    <p className="text-amber-800 font-bold text-xs">重要：生成コンテンツの権利帰属について</p>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li><strong>本サービスを利用して利用者が生成したコンテンツ（以下「生成コンテンツ」といいます）の著作権は、利用者に帰属します。</strong>当社は、生成コンテンツに関するいかなる権利も主張しません。</li>
                    <li>利用者は、生成コンテンツを自由に使用、複製、改変、頒布、公衆送信その他の方法で利用することができます。</li>
                    <li>本サービス自体（ソフトウェア、ユーザーインターフェース、ロゴ、商標等）に関する知的財産権は、当社または正当な権利者に帰属します。</li>
                    <li>利用者は、本サービス自体を複製、改変、リバースエンジニアリング、逆コンパイル、逆アセンブルすることはできません。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第7条（利用者の責任）</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-2">
                    <p className="text-red-800 font-bold text-xs">重要：利用者は以下の責任を負います</p>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li><strong>利用者は、入力データおよび生成コンテンツが第三者の著作権、商標権、肖像権、プライバシー権その他一切の権利を侵害しないことを保証し、その責任を負います。</strong></li>
                    <li>利用者は、本サービスを利用して作成したコンテンツの内容について、全責任を負います。</li>
                    <li>利用者は、他のウェブサイトのURLを入力する場合、当該ウェブサイトの利用規約および著作権法その他の法令を遵守する責任を負います。</li>
                    <li>第三者から当社に対して、利用者の生成コンテンツに関する権利侵害等の申立てがなされた場合、<strong>利用者は自己の費用と責任においてこれを解決し、当社に一切の迷惑をかけないものとします。</strong></li>
                    <li>前項の場合において、当社が損害（弁護士費用を含む）を被ったときは、利用者は当該損害を賠償するものとします。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第8条（禁止事項）</h3>
                <p className="text-gray-700 text-sm leading-relaxed mb-1">利用者は、本サービスの利用にあたり、以下の行為を行ってはなりません。</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>法令または公序良俗に違反する行為</li>
                    <li>犯罪行為に関連する行為</li>
                    <li>第三者の著作権、商標権、特許権等の知的財産権を侵害する行為</li>
                    <li>第三者の肖像権、プライバシー権、名誉権を侵害する行為</li>
                    <li>わいせつ、児童ポルノ、または児童虐待に相当する画像等を生成する行為</li>
                    <li>差別、誹謗中傷、ヘイトスピーチに該当するコンテンツを生成する行為</li>
                    <li>当社のサーバーまたはネットワークの機能を破壊または妨害する行為</li>
                    <li>本サービスの運営を妨害する行為</li>
                    <li>不正アクセスまたはこれを試みる行為</li>
                    <li>他の利用者に成りすます行為</li>
                    <li>当社のサービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為</li>
                    <li>その他、当社が不適切と判断する行為</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第9条（免責事項）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li><strong>当社は、本サービスを「現状有姿」で提供し、明示または黙示を問わず、商品性、特定目的への適合性、権利非侵害その他いかなる保証も行いません。</strong></li>
                    <li><strong>当社は、生成コンテンツの正確性、完全性、有用性、適法性、第三者の権利非侵害について、一切保証しません。</strong></li>
                    <li><strong>当社は、利用者が本サービスを利用して作成したコンテンツに起因または関連する著作権侵害、商標権侵害、肖像権侵害その他一切の権利侵害について、一切の責任を負いません。</strong></li>
                    <li>当社は、本サービスの中断、停止、終了、利用不能または変更について、責任を負いません。</li>
                    <li>当社は、本サービスの利用によって利用者に生じた損害について、当社の故意または重過失による場合を除き、責任を負いません。</li>
                    <li>当社は、利用者と第三者との間で生じた紛争について、一切関与せず、責任を負いません。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第10条（損害賠償の制限）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li><strong>当社は、本サービスに関して利用者に生じた損害について、当社の故意または重大な過失による場合を除き、一切の損害賠償責任を負いません。</strong></li>
                    <li>前項にかかわらず、当社が損害賠償責任を負う場合であっても、当社の責任は、損害発生時の直近1ヶ月間に当該利用者が当社に支払った利用料金相当額を上限とします。</li>
                    <li>当社は、いかなる場合においても、間接損害、特別損害、偶発的損害、派生的損害、逸失利益、データの喪失について、予見可能性の有無にかかわらず、責任を負いません。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第11条（サービスの停止・中断）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>当社は、以下のいずれかに該当する場合、利用者に事前に通知することなく、本サービスの全部または一部を停止または中断することができます。<ul className="list-disc list-inside ml-4 mt-1"><li>本サービスのシステムの保守点検または更新を行う場合</li><li>地震、落雷、火災、停電等の不可抗力により本サービスの提供が困難となった場合</li><li>コンピュータまたは通信回線等が事故により停止した場合</li><li>その他、当社が本サービスの提供が困難と判断した場合</li></ul></li>
                    <li>当社は、本サービスの停止または中断により利用者に生じた損害について、責任を負いません。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第12条（利用制限・登録抹消）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>当社は、利用者が以下のいずれかに該当する場合、事前の通知なく、利用者に対して本サービスの全部または一部の利用を制限し、または利用者としての登録を抹消することができます。<ul className="list-disc list-inside ml-4 mt-1"><li>本規約のいずれかの条項に違反した場合</li><li>登録事項に虚偽の事実があることが判明した場合</li><li>料金の支払債務の履行を遅滞した場合</li><li>当社からの連絡に対し、一定期間返答がない場合</li><li>その他、当社が本サービスの利用を適当でないと判断した場合</li></ul></li>
                    <li>当社は、本条に基づき当社が行った行為により利用者に生じた損害について、責任を負いません。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第13条（退会）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>利用者は、当社が定める手続により、本サービスを退会することができます。</li>
                    <li>退会した場合、利用者のアカウントおよび関連するデータは、当社の定める期間経過後に削除されます。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第14条（個人情報の取扱い）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>当社は、本サービスの利用によって取得した個人情報を、当社のプライバシーポリシーに従い適切に取り扱うものとします。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第15条（通知）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>当社から利用者への通知は、本サービス上での掲示、電子メールの送信、その他当社が適当と判断する方法により行うものとします。</li>
                    <li>前項の通知は、当社が当該通知を発信した時点から効力を生じるものとします。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第16条（権利義務の譲渡禁止）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>利用者は、当社の書面による事前の承諾なく、利用契約上の地位または本規約に基づく権利もしくは義務を第三者に譲渡し、または担保に供することはできません。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第17条（準拠法および管轄裁判所）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>本規約は、日本法に準拠し、日本法に従って解釈されるものとします。</li>
                    <li>本規約に関する一切の紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">第18条（分離可能性）</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>本規約のいずれかの条項が無効または執行不能と判断された場合でも、残りの条項は引き続き有効に存続するものとします。</li>
                </ol>
            </section>

            <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                    制定日: 2026年1月10日<br />
                    株式会社ZETTAI
                </p>
            </div>
        </div>
    );
}

// プライバシーポリシーコンテンツ（フルバージョン）
function PrivacyContent() {
    return (
        <div className="prose prose-sm prose-gray max-w-none">
            <p className="text-xs text-gray-500 mb-6">最終更新日: 2026年1月10日</p>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">1. はじめに</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                    株式会社ZETTAI（以下「当社」といいます）は、LP Builder（以下「本サービス」といいます）を通じて取得する個人情報の重要性を認識し、その保護を徹底するため、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
                </p>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">2. 取得する情報</h3>
                <p className="text-gray-700 text-sm leading-relaxed mb-2">当社は、本サービスの提供にあたり、以下の情報を取得することがあります。</p>

                <h4 className="text-sm font-bold mt-3 mb-1 text-gray-800">2.1 利用者から直接提供される情報</h4>
                <ul className="list-disc list-inside space-y-0.5 text-gray-700 text-sm">
                    <li>氏名</li>
                    <li>メールアドレス</li>
                    <li>電話番号</li>
                    <li>会社名・屋号</li>
                    <li>その他、登録フォームで入力された情報</li>
                </ul>

                <h4 className="text-sm font-bold mt-3 mb-1 text-gray-800">2.2 サービス利用に伴い自動的に取得される情報</h4>
                <ul className="list-disc list-inside space-y-0.5 text-gray-700 text-sm">
                    <li>IPアドレス</li>
                    <li>ブラウザの種類・バージョン</li>
                    <li>オペレーティングシステム</li>
                    <li>アクセス日時</li>
                    <li>参照元URL</li>
                    <li>Cookie情報</li>
                    <li>サービス利用履歴</li>
                </ul>

                <h4 className="text-sm font-bold mt-3 mb-1 text-gray-800">2.3 サービス利用に関連する情報</h4>
                <ul className="list-disc list-inside space-y-0.5 text-gray-700 text-sm">
                    <li>入力されたURL</li>
                    <li>入力されたプロンプト</li>
                    <li>アップロードされた画像</li>
                    <li>生成されたコンテンツ</li>
                    <li>サービス利用状況（生成回数、使用機能等）</li>
                </ul>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">3. 情報の利用目的</h3>
                <p className="text-gray-700 text-sm leading-relaxed mb-2">当社は、取得した情報を以下の目的で利用します。</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>本サービスの提供、運営、改善</li>
                    <li>利用者からのお問い合わせへの対応</li>
                    <li>利用料金の請求</li>
                    <li>本サービスに関する通知、案内の送信</li>
                    <li>マーケティング・広告配信（利用者の同意がある場合）</li>
                    <li>利用状況の分析・統計処理</li>
                    <li>不正利用の防止、セキュリティの確保</li>
                    <li>法令に基づく対応</li>
                    <li>その他、上記利用目的に付随する目的</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">4. 情報の第三者提供</h3>
                <p className="text-gray-700 text-sm leading-relaxed mb-2">当社は、以下の場合を除き、利用者の同意なく個人情報を第三者に提供しません。</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>法令に基づく場合</li>
                    <li>人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき</li>
                    <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難であるとき</li>
                    <li>国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき</li>
                    <li>合併、会社分割、事業譲渡その他の事由による事業の承継に伴って個人情報が提供される場合</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">5. 外部サービスの利用</h3>
                <p className="text-gray-700 text-sm leading-relaxed mb-2">当社は、本サービスの提供にあたり、以下の外部サービスを利用する場合があります。各サービスにおける情報の取扱いについては、各社のプライバシーポリシーをご確認ください。</p>

                <h4 className="text-sm font-bold mt-3 mb-1 text-gray-800">5.1 AI・機械学習サービス</h4>
                <ul className="list-disc list-inside space-y-0.5 text-gray-700 text-sm">
                    <li>Google Cloud Platform（Gemini API等）</li>
                    <li>その他のAIサービスプロバイダー</li>
                </ul>
                <p className="text-gray-600 text-xs mt-1">※ これらのサービスに送信されるデータ（プロンプト、画像等）は、各サービス提供者のプライバシーポリシーに従って処理されます。</p>

                <h4 className="text-sm font-bold mt-3 mb-1 text-gray-800">5.2 インフラ・ホスティング</h4>
                <ul className="list-disc list-inside space-y-0.5 text-gray-700 text-sm">
                    <li>Supabase（認証、データベース）</li>
                    <li>Vercel（ホスティング）</li>
                    <li>Cloudflare（CDN、セキュリティ）</li>
                </ul>

                <h4 className="text-sm font-bold mt-3 mb-1 text-gray-800">5.3 分析ツール</h4>
                <ul className="list-disc list-inside space-y-0.5 text-gray-700 text-sm">
                    <li>Google Analytics（利用状況の分析）</li>
                </ul>

                <h4 className="text-sm font-bold mt-3 mb-1 text-gray-800">5.4 決済サービス</h4>
                <ul className="list-disc list-inside space-y-0.5 text-gray-700 text-sm">
                    <li>Stripe（決済処理）</li>
                </ul>
                <p className="text-gray-600 text-xs mt-1">※ クレジットカード情報は当社では保持せず、決済サービス提供者が直接処理します。</p>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">6. Cookieの利用</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>当社は、本サービスにおいてCookie（クッキー）を使用します。</li>
                    <li>Cookieは、利用者の認証状態の維持、利用状況の分析、サービスの改善等のために使用されます。</li>
                    <li>利用者は、ブラウザの設定によりCookieの受け入れを拒否することができますが、その場合、本サービスの一部機能が利用できなくなる可能性があります。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">7. 情報の安全管理</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>当社は、個人情報の漏洩、滅失、毀損を防止するため、適切なセキュリティ対策を講じます。</li>
                    <li>当社は、個人情報を取り扱う従業員に対し、適切な教育・監督を行います。</li>
                    <li>当社は、個人情報の取扱いを外部に委託する場合、委託先に対し適切な監督を行います。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">8. 情報の保存期間</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>当社は、利用目的の達成に必要な期間、個人情報を保存します。</li>
                    <li>アカウント情報は、アカウント削除後6ヶ月間保存した後、削除します。</li>
                    <li>サービス利用履歴は、統計処理後、匿名化した上で保存することがあります。</li>
                    <li>法令により保存が義務付けられている情報は、法令で定められた期間保存します。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">9. 利用者の権利</h3>
                <p className="text-gray-700 text-sm leading-relaxed mb-2">利用者は、当社に対し、以下の権利を行使することができます。</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li><strong>開示請求権:</strong> 当社が保有する利用者の個人情報の開示を請求することができます。</li>
                    <li><strong>訂正請求権:</strong> 個人情報が事実と異なる場合、訂正を請求することができます。</li>
                    <li><strong>利用停止請求権:</strong> 個人情報の利用の停止を請求することができます。</li>
                    <li><strong>削除請求権:</strong> 個人情報の削除を請求することができます。</li>
                    <li><strong>第三者提供停止請求権:</strong> 第三者への提供の停止を請求することができます。</li>
                </ol>
                <p className="text-gray-700 text-sm leading-relaxed mt-2">
                    上記の請求を行う場合は、本ポリシー末尾の連絡先までお問い合わせください。なお、ご本人確認のための書類の提出をお願いする場合があります。
                </p>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">10. 未成年者の利用</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>本サービスは、18歳以上の方を対象としています。</li>
                    <li>18歳未満の方が本サービスを利用する場合は、親権者または法定代理人の同意が必要です。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">11. 海外への情報移転</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                    当社が利用する外部サービス（クラウドサービス、AI API等）のサーバーは、日本国外に所在する場合があります。この場合、利用者の情報は、当該国・地域の法令に従って処理される可能性があります。当社は、海外への情報移転にあたり、適切な安全管理措置を講じます。
                </p>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">12. 本ポリシーの変更</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>当社は、法令の改正、事業内容の変更等により、本ポリシーを変更することがあります。</li>
                    <li>重要な変更を行う場合は、本サービス上での通知またはメールにより利用者にお知らせします。</li>
                    <li>変更後の本ポリシーは、本サービス上に掲載した時点から効力を生じます。</li>
                </ol>
            </section>

            <section className="mb-6">
                <h3 className="text-base font-bold mb-2 pb-1 border-b border-gray-200 text-gray-900">13. お問い合わせ</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                    本ポリシーに関するお問い合わせ、個人情報に関する請求は、以下の連絡先までお願いいたします。
                </p>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-700 text-sm">
                        <strong>株式会社ZETTAI</strong><br />
                        <strong>個人情報保護責任者:</strong> 代表取締役<br />
                        メール: <a href="mailto:team@zettai.co.jp" className="text-amber-600 hover:underline">team@zettai.co.jp</a>
                    </p>
                </div>
            </section>

            <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                    制定日: 2026年1月10日<br />
                    株式会社ZETTAI
                </p>
            </div>
        </div>
    );
}
