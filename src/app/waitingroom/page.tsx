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
                            <div className="w-28 h-28 mb-4">
                                <dotlottie-wc
                                    src="https://lottie.host/bef0c297-c293-4e57-a030-24ff0c5cb2f0/xZUAd4jXZg.lottie"
                                    autoplay={true}
                                    loop={true}
                                    style={{ width: '100%', height: '100%' }}
                                ></dotlottie-wc>
                            </div>

                            {/* Typography */}
                            <h2 className="text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-black tracking-tighter leading-[1.05] mb-6">
                                LP制作を、<br />
                                <span className="text-amber-600">AIの力で</span>革新する。
                            </h2>
                            {/* Paragraph */}
                            <p className="text-gray-600 font-medium text-sm md:text-base leading-relaxed max-w-lg mb-8">
                                URLから取り込み、AI画像生成、インペイント編集...<br />
                                <span className="text-black font-bold">すべてが一つのツールで完結します。</span>
                            </p>

                            {/* Feature Highlights */}
                            <div className="grid grid-cols-2 gap-3 max-w-lg">
                                <div className="bg-white/60 backdrop-blur-sm border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                            <Globe className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-800">URL取り込み</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 font-medium pl-1">既存LPを瞬時に解析</p>
                                </div>
                                <div className="bg-white/60 backdrop-blur-sm border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                            <Sparkles className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-800">AI画像生成</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 font-medium pl-1">プロンプトから作成</p>
                                </div>
                                <div className="bg-white/60 backdrop-blur-sm border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                            <Wand2 className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-800">インペイント</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 font-medium pl-1">部分編集で自然に修正</p>
                                </div>
                                <div className="bg-white/60 backdrop-blur-sm border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                            <Download className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-800">HTML出力</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 font-medium pl-1">どこでも公開可能</p>
                                </div>
                            </div>
                        </div>

                        <div className="hidden lg:block absolute bottom-0 left-0 w-full z-20 p-8 lg:p-10">
                            <p className="text-[10px] font-bold text-gray-300 tracking-[0.2em]">
                                © 2026 ZETTAI INC.
                            </p>
                        </div>
                    </motion.div>

                    {/* Right Panel: Form & Pricing */}
                    <div className="w-full lg:w-1/2 p-6 md:p-10 lg:p-16 flex flex-col justify-center bg-white/50 backdrop-blur-sm relative">
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
                                    <div className="mb-8 text-center">
                                        <p className="text-gray-600 text-sm leading-relaxed">
                                            LP Builderにご興味をお持ちいただき、<br />
                                            ありがとうございます。
                                        </p>
                                    </div>

                                    {/* Pricing Card */}
                                    <div className="mb-8 p-6 bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-2xl relative shadow-sm">
                                        <div className="absolute -top-3 left-6 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                            現在ご案内中のプラン
                                        </div>
                                        <div className="pt-2">
                                            <h3 className="text-sm font-bold text-amber-700 mb-2">PoCプラン</h3>
                                            <div className="flex items-baseline gap-1 mb-4">
                                                <span className="text-4xl font-black text-gray-900">¥20,000</span>
                                                <span className="text-gray-500 text-sm font-bold">/月（税別）</span>
                                            </div>
                                            <ul className="space-y-2 text-sm text-gray-600 font-medium">
                                                <li className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                                        <Check className="w-3 h-3 text-amber-600" />
                                                    </div>
                                                    <span>AI生成 月100回</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                                        <Check className="w-3 h-3 text-amber-600" />
                                                    </div>
                                                    <span>全機能利用可能</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                                        <Check className="w-3 h-3 text-amber-600" />
                                                    </div>
                                                    <span>初月無料トライアル</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Waiting Room Notice - Simplified */}
                                    <div className="mb-8 p-4 bg-gray-50 border border-gray-100 rounded-xl">
                                        <div className="flex gap-3">
                                            <div className="w-1 bg-amber-500 rounded-full h-auto self-stretch"></div>
                                            <p className="text-xs text-gray-600 leading-relaxed py-1">
                                                <span className="font-bold text-gray-800 block mb-1">Waiting Room形式でのご案内</span>
                                                お申し込み順に、<span className="text-amber-600 font-bold">メールにて本登録のご案内</span>をお送りいたします。
                                            </p>
                                        </div>
                                    </div>

                                    {/* Form */}
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        {/* Account Type Selection */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-700">
                                                ご利用形態 <span className="text-red-500">*</span>
                                            </label>
                                            <div className="flex gap-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, accountType: 'individual' })}
                                                    className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all text-sm font-bold flex items-center justify-center gap-2 ${formData.accountType === 'individual'
                                                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                                                        : 'border-gray-100 hover:border-gray-200 text-gray-500 bg-gray-50'
                                                        }`}
                                                >
                                                    個人
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, accountType: 'corporate' })}
                                                    className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all text-sm font-bold flex items-center justify-center gap-2 ${formData.accountType === 'corporate'
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
                                                    <div className="space-y-1 pt-2">
                                                        <label className="text-sm font-bold text-gray-700">
                                                            会社名・屋号 <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            required
                                                            type="text"
                                                            value={formData.companyName}
                                                            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                                            placeholder="株式会社〇〇"
                                                            className="w-full bg-white border border-gray-200 rounded-lg py-3 px-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-medium"
                                                        />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <div className="space-y-1">
                                            <label className="text-sm font-bold text-gray-700">
                                                お名前 <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                required
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="山田 太郎"
                                                className="w-full bg-white border border-gray-200 rounded-lg py-3 px-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-medium"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-sm font-bold text-gray-700">
                                                メールアドレス <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                required
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="example@email.com"
                                                className="w-full bg-white border border-gray-200 rounded-lg py-3 px-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-medium"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-sm font-bold text-gray-700">
                                                電話番号 <span className="text-gray-400 text-xs font-normal">（任意）</span>
                                            </label>
                                            <input
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                placeholder="03-1234-5678"
                                                className="w-full bg-white border border-gray-200 rounded-lg py-3 px-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-medium"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-sm font-bold text-gray-700">
                                                備考 <span className="text-gray-400 text-xs font-normal">（任意）</span>
                                            </label>
                                            <textarea
                                                value={formData.remarks}
                                                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                                placeholder="ご質問やご要望があればお書きください"
                                                rows={3}
                                                className="w-full bg-white border border-gray-200 rounded-lg py-3 px-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-medium resize-none"
                                            />
                                        </div>

                                        <div className="pt-4">
                                            <button
                                                type="submit"
                                                disabled={isLoading || !formData.accountType}
                                                className="w-full bg-gray-900 text-white hover:bg-amber-600 text-base font-bold py-4 px-8 transition-colors duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-amber-900/10"
                                            >
                                                {isLoading ? (
                                                    <span className="flex items-center gap-2">
                                                        <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </span>
                                                ) : (
                                                    <>
                                                        順番待ちリストに登録する
                                                        <ArrowRight className="w-5 h-5" />
                                                    </>
                                                )}
                                            </button>
                                            <p className="mt-4 text-xs text-gray-400 leading-relaxed text-center">
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

// 利用規約コンテンツ
function TermsContent() {
    return (
        <div className="prose prose-sm prose-gray max-w-none">
            <p className="text-xs text-gray-500 mb-6">最終更新日: 2026年1月10日</p>

            <section className="mb-8">
                <h3 className="text-lg font-bold mb-3 text-gray-900">第1条（総則）</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm leading-relaxed">
                    <li>本利用規約（以下「本規約」といいます）は、株式会社ZETTAI（以下「当社」といいます）が提供するLP Builder（以下「本サービス」といいます）の利用条件を定めるものです。</li>
                    <li>本サービスを利用するすべての方（以下「利用者」といいます）は、本規約に同意したものとみなされます。</li>
                </ol>
            </section>

            <section className="mb-8">
                <h3 className="text-lg font-bold mb-3 text-gray-900">第6条（知的財産権・著作権）</h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                    <p className="text-amber-800 font-bold text-xs">重要：生成コンテンツの権利帰属について</p>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm leading-relaxed">
                    <li><strong>生成コンテンツの著作権は、利用者に帰属します。</strong>当社は、生成コンテンツに関するいかなる権利も主張しません。</li>
                    <li>利用者は、生成コンテンツを自由に使用、複製、改変、頒布、公衆送信することができます。</li>
                    <li>本サービス自体（ソフトウェア、UI、ロゴ、商標等）に関する知的財産権は、当社または正当な権利者に帰属します。</li>
                </ol>
            </section>

            <section className="mb-8">
                <h3 className="text-lg font-bold mb-3 text-gray-900">第7条（利用者の責任）</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                    <p className="text-red-800 font-bold text-xs">重要：利用者は以下の責任を負います</p>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm leading-relaxed">
                    <li><strong>利用者は、入力データおよび生成コンテンツが第三者の著作権、商標権、肖像権、プライバシー権その他一切の権利を侵害しないことを保証し、その責任を負います。</strong></li>
                    <li>利用者は、本サービスを利用して作成したコンテンツの内容について、全責任を負います。</li>
                    <li>第三者から当社に対して権利侵害等の申立てがなされた場合、利用者は自己の費用と責任においてこれを解決し、当社に一切の迷惑をかけないものとします。</li>
                </ol>
            </section>

            <section className="mb-8">
                <h3 className="text-lg font-bold mb-3 text-gray-900">第9条（免責事項）</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm leading-relaxed">
                    <li><strong>当社は、本サービスを「現状有姿」で提供し、明示または黙示を問わず、いかなる保証も行いません。</strong></li>
                    <li><strong>当社は、生成コンテンツの正確性、完全性、有用性、適法性、第三者の権利非侵害について、一切保証しません。</strong></li>
                    <li><strong>当社は、利用者が本サービスを利用して作成したコンテンツに起因する著作権侵害その他一切の権利侵害について、一切の責任を負いません。</strong></li>
                </ol>
            </section>

            <section className="mb-8">
                <h3 className="text-lg font-bold mb-3 text-gray-900">第10条（損害賠償の制限）</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm leading-relaxed">
                    <li>当社が利用者に対して損害賠償責任を負う場合であっても、当社の責任は、当該利用者が過去12ヶ月間に当社に支払った利用料金の総額を上限とします。</li>
                    <li>当社は、いかなる場合も、間接損害、特別損害、逸失利益について責任を負いません。</li>
                </ol>
            </section>

            <section className="mb-8">
                <h3 className="text-lg font-bold mb-3 text-gray-900">第17条（準拠法および管轄裁判所）</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm leading-relaxed">
                    <li>本規約は、日本法に準拠し、日本法に従って解釈されるものとします。</li>
                    <li>本規約に関する一切の紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。</li>
                </ol>
            </section>

            <div className="mt-8 pt-6 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                    ※ これは利用規約の要約です。完全版は <a href="/terms" target="_blank" className="text-amber-600 underline">こちら</a> でご確認いただけます。
                </p>
                <p className="text-xs text-gray-500 mt-2">株式会社ZETTAI</p>
            </div>
        </div>
    );
}

// プライバシーポリシーコンテンツ
function PrivacyContent() {
    return (
        <div className="prose prose-sm prose-gray max-w-none">
            <p className="text-xs text-gray-500 mb-6">最終更新日: 2026年1月10日</p>

            <section className="mb-8">
                <h3 className="text-lg font-bold mb-3 text-gray-900">1. はじめに</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                    株式会社ZETTAI（以下「当社」といいます）は、LP Builder（以下「本サービス」といいます）を通じて取得する個人情報の重要性を認識し、その保護を徹底するため、本プライバシーポリシーを定めます。
                </p>
            </section>

            <section className="mb-8">
                <h3 className="text-lg font-bold mb-3 text-gray-900">2. 取得する情報</h3>
                <h4 className="text-sm font-bold mt-4 mb-2 text-gray-800">2.1 利用者から直接提供される情報</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
                    <li>氏名、メールアドレス、電話番号、会社名・屋号</li>
                </ul>
                <h4 className="text-sm font-bold mt-4 mb-2 text-gray-800">2.2 自動的に取得される情報</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
                    <li>IPアドレス、ブラウザ情報、アクセス日時、Cookie情報</li>
                </ul>
                <h4 className="text-sm font-bold mt-4 mb-2 text-gray-800">2.3 サービス利用に関連する情報</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
                    <li>入力されたURL、プロンプト、アップロード画像、生成コンテンツ</li>
                </ul>
            </section>

            <section className="mb-8">
                <h3 className="text-lg font-bold mb-3 text-gray-900">3. 情報の利用目的</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm leading-relaxed">
                    <li>本サービスの提供、運営、改善</li>
                    <li>利用者からのお問い合わせへの対応</li>
                    <li>利用料金の請求</li>
                    <li>利用状況の分析・統計処理</li>
                    <li>不正利用の防止、セキュリティの確保</li>
                </ul>
            </section>

            <section className="mb-8">
                <h3 className="text-lg font-bold mb-3 text-gray-900">5. 外部サービスの利用</h3>
                <p className="text-gray-700 text-sm leading-relaxed mb-2">
                    当社は以下の外部サービスを利用します。各サービスにおける情報の取扱いについては、各社のプライバシーポリシーをご確認ください。
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
                    <li>Google Cloud Platform（Gemini API等）</li>
                    <li>Supabase（認証、データベース）</li>
                    <li>Vercel（ホスティング）</li>
                </ul>
                <p className="text-gray-600 text-xs mt-2">※ AI APIに送信されるデータは、各サービス提供者のポリシーに従って処理されます。</p>
            </section>

            <section className="mb-8">
                <h3 className="text-lg font-bold mb-3 text-gray-900">9. 利用者の権利</h3>
                <p className="text-gray-700 text-sm leading-relaxed mb-2">利用者は以下の権利を行使できます：</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
                    <li><strong>開示請求権:</strong> 保有する個人情報の開示を請求できます</li>
                    <li><strong>訂正請求権:</strong> 個人情報の訂正を請求できます</li>
                    <li><strong>削除請求権:</strong> 個人情報の削除を請求できます</li>
                </ul>
            </section>

            <section className="mb-8">
                <h3 className="text-lg font-bold mb-3 text-gray-900">13. お問い合わせ</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 text-sm">
                        <strong>株式会社ZETTAI</strong><br />
                        メール: <a href="mailto:team@zettai.co.jp" className="text-amber-600">team@zettai.co.jp</a>
                    </p>
                </div>
            </section>

            <div className="mt-8 pt-6 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                    ※ これはプライバシーポリシーの要約です。完全版は <a href="/privacy" target="_blank" className="text-amber-600 underline">こちら</a> でご確認いただけます。
                </p>
                <p className="text-xs text-gray-500 mt-2">株式会社ZETTAI</p>
            </div>
        </div>
    );
}
