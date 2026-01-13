"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight,
    Check,
    Image,
    Layers,
    Wand2,
    Download,
    Palette,
    Video,
    Globe,
    X,
    HelpCircle,
    CreditCard,
    Building2,
    User,
    Mail,
    Phone,
    Zap,
    Star,
    Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

// Type declaration for Lottie web component
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

// Feature data
const FEATURES = [
    {
        icon: Globe,
        title: 'URLからLP取り込み',
        description: '既存のウェブページURLを入力するだけで、デザインを自動解析してセクションごとに取り込みます。',
        color: 'bg-blue-500',
    },
    {
        icon: Image,
        title: '画像生成',
        description: 'プロンプトから高品質な画像を生成。ヒーロー画像やバナーを簡単に作成。',
        color: 'bg-purple-500',
    },
    {
        icon: Wand2,
        title: 'インペイント編集',
        description: '画像の一部を選択して自然に編集・修正。テキスト変更や要素の追加・削除が可能。',
        color: 'bg-pink-500',
    },
    {
        icon: Palette,
        title: 'リスタイル機能',
        description: 'ページ全体のデザインスタイルを一括で変更。色調やトーンを統一して洗練されたLPに。',
        color: 'bg-amber-500',
    },
    {
        icon: Layers,
        title: 'セクション管理',
        description: 'ドラッグ&ドロップでセクションを並び替え。各セクションを個別に編集・再生成できます。',
        color: 'bg-green-500',
    },
    {
        icon: Image,
        title: '4Kアップスケール',
        description: '低解像度の画像を高品質な4K画像にアップスケール。印刷にも対応できる高解像度出力。',
        color: 'bg-cyan-500',
    },
    {
        icon: Video,
        title: '動画生成',
        description: '静止画から動画を生成。LPにダイナミックな動きを追加できます。',
        color: 'bg-red-500',
    },
    {
        icon: Download,
        title: 'HTMLエクスポート',
        description: '完成したLPをHTMLファイルとしてエクスポート。どこでもホスティング可能な形式で出力。',
        color: 'bg-indigo-500',
    },
];

// FAQ data
const FAQ_DATA = [
    {
        question: 'LP Builder とは何ですか？',
        answer: 'LP Builderは高機能なランディングページ作成ツールです。既存LPのURLを入力して取り込み、画像生成やインペイント編集で自由にカスタマイズできます。コーディング不要で、誰でも簡単に高品質なLPを作成できます。',
    },
    {
        question: 'クレジットとは何ですか？',
        answer: 'クレジットは各種機能を使用するための通貨です。画像生成、インペイント編集、リスタイルなどの処理にクレジットが消費されます。月額プランには毎月クレジットが付与され、追加購入も可能です。',
    },
    {
        question: 'LP1つ作成するのにどのくらいクレジットが必要ですか？',
        answer: 'シンプルなLP（5〜6セクション、画像3〜5枚生成）で約1,000〜1,500円、本格的なLP（10セクション以上、画像10枚以上）で約1,500〜2,500円が目安です。使用する機能や生成回数によって変動します。',
    },
    {
        question: 'どのような画像を生成できますか？',
        answer: 'ヒーロー画像、商品画像、背景画像など様々な画像を生成できます。プロンプトを入力するだけで、LP用に最適化された高品質な画像が生成されます。また、既存画像の一部を編集するインペイント機能も利用可能です。',
    },
    {
        question: '無料で試せますか？',
        answer: 'Freeプランでは、ご自身のAPIキーをご用意いただければ、基本機能を無料でお試しいただけます。4Kアップスケール、リスタイル、動画生成は有料プランのみの機能となります。',
    },
    {
        question: 'URLから取り込んだLPの著作権はどうなりますか？',
        answer: '取り込んだLPのデザインを参考にする場合は、元のサイトの著作権にご注意ください。生成した新しいコンテンツ（画像など）の著作権は利用者に帰属しますが、元サイトのコンテンツをそのまま使用する場合は権利者の許可が必要です。',
    },
    {
        question: '作成したLPはどのように公開できますか？',
        answer: 'HTMLエクスポート機能で、完成したLPをHTMLファイルとしてダウンロードできます。お好みのホスティングサービス（Vercel、Netlify、AWS S3など）にアップロードするだけで公開できます。',
    },
    {
        question: 'サポートはありますか？',
        answer: 'メールサポート（team@zettai.co.jp）をご利用いただけます。Enterpriseプランでは優先サポートが適用され、より迅速な対応が可能です。',
    },
];

// Plan data
const PLAN_DATA = [
    {
        id: 'pro',
        name: 'Pro',
        price: '¥20,000',
        period: '/月',
        credit: '¥5,000',
        creditNote: '約3〜4LP分',
        description: 'スタートアップ・個人事業主に',
        icon: User,
        features: [
            '最大30ページ',
            '月間クレジット ¥5,000分',
            '画像生成',
            'インペイント編集',
            'HTMLエクスポート',
        ],
        limitations: [
            '動画生成不可',
        ],
        highlight: false,
        gradient: 'from-gray-100 to-gray-50',
    },
    {
        id: 'business',
        name: 'Business',
        price: '¥40,000',
        period: '/月',
        credit: '¥10,000',
        creditNote: '約6〜7LP分',
        description: '成長企業・制作会社に',
        icon: Zap,
        features: [
            '最大100ページ',
            '月間クレジット ¥10,000分',
            'Pro全機能',
            '4Kアップスケール',
            'リスタイル機能',
        ],
        limitations: [],
        highlight: true,
        gradient: 'from-amber-500 to-orange-500',
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: '¥100,000',
        period: '/月',
        credit: '¥25,000',
        creditNote: '約16〜17LP分',
        description: '代理店・大規模ビジネスに',
        icon: Building2,
        features: [
            '無制限ページ',
            '月間クレジット ¥25,000分',
            'Business全機能',
            '動画生成',
            '優先サポート',
        ],
        limitations: [],
        highlight: false,
        gradient: 'from-violet-500 to-purple-500',
    },
];

// Credit usage data
const CREDIT_USAGE = [
    { action: '画像生成', cost: '約150〜200円', icon: Image },
    { action: 'インペイント', cost: '約100〜150円', icon: Wand2 },
    { action: 'リスタイル', cost: '約200〜300円', icon: Palette },
    { action: '動画生成', cost: '約50〜100円/秒', icon: Video },
    { action: 'URL取り込み', cost: '約50〜100円', icon: Globe },
];

export default function WaitingRoomPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        accountType: '' as 'individual' | 'corporate' | '',
        selectedPlan: '' as 'pro' | 'business' | 'enterprise' | '',
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
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch('/api/waitingroom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountType: formData.accountType,
                    selectedPlan: formData.selectedPlan,
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

            toast.success('登録が完了しました！', {
                icon: <Check className="w-5 h-5 text-green-500" />,
            });

            setStep(2);
        } catch (error: any) {
            toast.error(error.message || '登録に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <main className="min-h-screen bg-white text-gray-900 overflow-x-hidden selection:bg-amber-500 selection:text-white">
            {/* Hero Section */}
            <section className="relative min-h-screen">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-[100px]" />

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <header className="py-6">
                        <nav className="flex items-center justify-between">
                            <a href="/" className="flex items-center gap-2 group">
                                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg shadow-lg shadow-amber-500/25" />
                                <span className="text-xl font-black tracking-tight group-hover:text-amber-600 transition-colors">
                                    LP Builder
                                </span>
                            </a>
                            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                Beta
                            </span>
                        </nav>
                    </header>

                    {/* Hero Content */}
                    <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 py-8 lg:py-12 items-start min-h-[calc(100vh-100px)]">
                        {/* Left: Brand & Vision */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="flex flex-col pt-4 lg:pt-8"
                        >
                            {/* Lottie Animation */}
                            <div className="w-20 h-20 mb-4">
                                <dotlottie-wc
                                    src="https://lottie.host/bef0c297-c293-4e57-a030-24ff0c5cb2f0/xZUAd4jXZg.lottie"
                                    autoplay={true}
                                    loop={true}
                                    style={{ width: '100%', height: '100%' }}
                                />
                            </div>

                            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6">
                                LP制作を、
                                <br className="hidden lg:block" />
                                <span className="text-amber-500">もっと簡単に。</span>
                            </h1>

                            <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-lg leading-relaxed">
                                既存サイトのURLを入力するだけで、デザインを自動で取り込み。
                                画像生成やインペイント編集で自由にカスタマイズできます。
                            </p>

                            {/* Feature List */}
                            <ul className="space-y-3 text-base sm:text-lg text-gray-700 font-medium">
                                <li className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-4 h-4 text-amber-600" />
                                    </div>
                                    URLからデザインを自動取り込み
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-4 h-4 text-amber-600" />
                                    </div>
                                    画像生成・インペイント編集
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-4 h-4 text-amber-600" />
                                    </div>
                                    HTMLエクスポートですぐに公開
                                </li>
                            </ul>
                        </motion.div>

                        {/* Right: Form */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="flex items-center justify-center"
                        >
                            <Card className="w-full max-w-md shadow-lg border bg-white">
                                <CardHeader className="pb-4">
                                    {step === 1 ? (
                                        <div>
                                            <CardTitle className="text-xl font-bold">
                                                順番待ちリストに登録
                                            </CardTitle>
                                            <CardDescription className="mt-1">
                                                お申し込み順にご案内いたします
                                            </CardDescription>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <div className="w-12 h-12 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                                                <Check className="w-6 h-6 text-green-600" />
                                            </div>
                                            <CardTitle className="text-xl font-bold">
                                                登録完了
                                            </CardTitle>
                                            <CardDescription className="mt-1">
                                                ご登録ありがとうございます
                                            </CardDescription>
                                        </div>
                                    )}
                                </CardHeader>

                                <CardContent>
                                    {step === 1 ? (
                                        <div>
                                            {/* Plan Info Banner */}
                                            <div className="mb-5 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                                    <span className="text-gray-700">
                                                        <span className="font-bold">Pro</span>（¥20,000/月）〜
                                                        <span className="font-bold">Enterprise</span>（¥100,000/月）
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1.5">
                                                    初期費用無料・すべてのプランで主要機能をご利用いただけます
                                                </p>
                                            </div>

                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                {/* Account Type */}
                                                <div className="space-y-2">
                                                    <Label>ご利用形態 <span className="text-red-500">*</span></Label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Button
                                                            type="button"
                                                            variant={formData.accountType === 'individual' ? 'amber' : 'outline'}
                                                            className="w-full"
                                                            onClick={() => setFormData({ ...formData, accountType: 'individual' })}
                                                        >
                                                            <User className="w-4 h-4" />
                                                            個人
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={formData.accountType === 'corporate' ? 'amber' : 'outline'}
                                                            className="w-full"
                                                            onClick={() => setFormData({ ...formData, accountType: 'corporate' })}
                                                        >
                                                            <Building2 className="w-4 h-4" />
                                                            法人
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Plan Selection */}
                                                <div className="space-y-2">
                                                    <Label>ご希望プラン <span className="text-red-500">*</span></Label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {PLAN_DATA.map((plan) => (
                                                            <Button
                                                                key={plan.id}
                                                                type="button"
                                                                variant={formData.selectedPlan === plan.id ? 'amber' : 'outline'}
                                                                className={cn(
                                                                    "w-full flex-col h-auto py-3 px-2",
                                                                    plan.highlight && formData.selectedPlan !== plan.id && "border-amber-300 bg-amber-50/50"
                                                                )}
                                                                onClick={() => setFormData({ ...formData, selectedPlan: plan.id as 'pro' | 'business' | 'enterprise' })}
                                                            >
                                                                <plan.icon className="w-4 h-4 mb-1" />
                                                                <span className="text-xs font-bold">{plan.name}</span>
                                                                <span className="text-[10px] text-gray-500">{plan.price}</span>
                                                            </Button>
                                                        ))}
                                                    </div>
                                                    {formData.selectedPlan && (
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            月間クレジット: {PLAN_DATA.find(p => p.id === formData.selectedPlan)?.credit}分
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Company Name (Corporate only) */}
                                                <AnimatePresence>
                                                    {formData.accountType === 'corporate' && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="space-y-2 overflow-hidden"
                                                        >
                                                            <Label htmlFor="companyName">
                                                                会社名 <span className="text-red-500">*</span>
                                                            </Label>
                                                            <Input
                                                                id="companyName"
                                                                required
                                                                value={formData.companyName}
                                                                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                                                placeholder="株式会社〇〇"
                                                            />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                {/* Name & Email */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="name">
                                                            お名前 <span className="text-red-500">*</span>
                                                        </Label>
                                                        <div className="relative">
                                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                            <Input
                                                                id="name"
                                                                required
                                                                className="pl-9"
                                                                value={formData.name}
                                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                                placeholder="山田 太郎"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="email">
                                                            メール <span className="text-red-500">*</span>
                                                        </Label>
                                                        <div className="relative">
                                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                            <Input
                                                                id="email"
                                                                type="email"
                                                                required
                                                                className="pl-9"
                                                                value={formData.email}
                                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                                placeholder="email@example.com"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Phone */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="phone">
                                                        電話番号 <span className="text-gray-400 text-xs font-normal">(任意)</span>
                                                    </Label>
                                                    <div className="relative">
                                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                        <Input
                                                            id="phone"
                                                            type="tel"
                                                            className="pl-9"
                                                            value={formData.phone}
                                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                            placeholder="03-1234-5678"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Remarks */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="remarks">
                                                        備考 <span className="text-gray-400 text-xs font-normal">(任意)</span>
                                                    </Label>
                                                    <Textarea
                                                        id="remarks"
                                                        rows={2}
                                                        value={formData.remarks}
                                                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                                        placeholder="ご質問やご要望など"
                                                    />
                                                </div>

                                                {/* Submit */}
                                                <Button
                                                    type="submit"
                                                    variant="dark"
                                                    size="lg"
                                                    className="w-full"
                                                    disabled={isLoading || !formData.accountType || !formData.selectedPlan}
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
                                                </Button>

                                                <p className="text-xs text-gray-400 text-center">
                                                    登録により
                                                    <button type="button" onClick={() => setModalType('terms')} className="underline hover:text-amber-600 mx-1">利用規約</button>
                                                    と
                                                    <button type="button" onClick={() => setModalType('privacy')} className="underline hover:text-amber-600 mx-1">プライバシーポリシー</button>
                                                    に同意
                                                </p>
                                            </form>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <p className="text-gray-600 mb-4 text-sm">
                                                準備が整い次第、ご登録のメールアドレス宛に
                                                <strong className="text-gray-900">本登録のご案内</strong>をお送りいたします。
                                            </p>

                                            <p className="text-xs text-gray-500 mb-4">
                                                順番が来ましたらメールでお知らせします。
                                            </p>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setStep(1)}
                                                className="text-gray-500"
                                            >
                                                フォームに戻る
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-12 md:py-32 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-10 md:mb-16"
                    >
                        <Badge variant="amber" className="mb-4">Features</Badge>
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
                            LP Builderでできること
                        </h2>
                        <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
                            高品質なランディングページを<br className="md:hidden" />誰でも簡単に作成・編集できます。
                        </p>
                    </motion.div>

                    {/* Swiss/Brutalist Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-2 border-black bg-white">
                        {FEATURES.map((feature, index) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.05 }}
                                className="group p-6 md:p-8 border-b-2 border-black last:border-b-0 md:last:border-b-2 lg:last:border-b-0 lg:border-b-0 md:border-r-2 md:even:border-r-0 lg:even:border-r-2 lg:last:border-r-0 hover:bg-black hover:text-white transition-colors duration-300"
                            >
                                <div className="mb-6">
                                    <feature.icon className="w-8 h-8 text-black group-hover:text-amber-500 transition-colors" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-xl font-black tracking-tight mb-3 group-hover:text-amber-500 transition-colors">
                                    {feature.title}
                                </h3>
                                <p className="text-sm font-bold text-gray-500 group-hover:text-gray-400 leading-relaxed">
                                    {feature.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it works */}
            {/* How it works - Swiss Style */}
            <section className="py-16 md:py-32 bg-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="mb-12 md:mb-24">
                        <h2 className="text-5xl sm:text-8xl font-black tracking-tighter text-gray-900 mb-6 md:mb-8 leading-[0.9]">
                            HOW IT<br />WORKS
                        </h2>
                        <div className="h-2 w-32 bg-amber-500" />
                    </div>

                    <div className="flex overflow-x-auto snap-x snap-mandatory md:grid md:grid-cols-3 border-t-2 border-black scrollbar-hide">
                        {[
                            {
                                step: '01',
                                title: 'INPUT URL',
                                jpTitle: 'URLを入力',
                                description: '参考にしたいLPのURLを入力、\nまたは新規作成を選択。',
                                icon: Globe
                            },
                            {
                                step: '02',
                                title: 'EDIT FREELY',
                                jpTitle: '自由に編集',
                                description: 'テキスト修正や画像生成も。\nプロンプトで直感的に変更。',
                                icon: Wand2
                            },
                            {
                                step: '03',
                                title: 'EXPORT HTML',
                                jpTitle: 'エクスポート',
                                description: '完成したLPをHTMLで書き出し。\n即座に公開可能です。',
                                icon: Download
                            },
                        ].map((item, index) => (
                            <div
                                key={item.step}
                                className="group relative border-b-2 md:border-b-0 md:border-r-2 border-black last:border-r-0 p-6 md:p-8 pt-10 md:pt-12 hover:bg-black hover:text-white transition-colors duration-300 min-w-[280px] snap-center flex-shrink-0 md:min-w-0"
                            >
                                <div className="mb-8 md:mb-12 flex justify-between items-start">
                                    <span className="text-6xl md:text-7xl font-black text-gray-200 group-hover:text-amber-500 transition-colors font-mono tracking-tighter">
                                        {item.step}
                                    </span>
                                    <item.icon className="w-8 h-8 md:w-10 md:h-10 text-black group-hover:text-white transition-colors" strokeWidth={1.5} />
                                </div>

                                <h3 className="text-2xl md:text-3xl font-black mb-2 tracking-tight uppercase">
                                    {item.title}
                                </h3>
                                <p className="text-base md:text-lg font-bold text-gray-400 group-hover:text-gray-500 mb-4 md:mb-6">{item.jpTitle}</p>
                                <p className="text-gray-600 group-hover:text-gray-300 leading-relaxed font-medium text-sm md:text-base whitespace-pre-line">
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section - Linear/Angular */}
            <section className="py-20 md:py-32 bg-gray-50 border-t-2 border-black">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-16 md:mb-32">
                        <h2 className="text-6xl sm:text-9xl font-black tracking-tighter text-gray-900 mb-8 leading-[0.85]">
                            PRICING
                        </h2>
                        <div className="h-2 w-32 bg-amber-500 mb-10" />
                        <p className="text-xl md:text-3xl text-gray-900 font-bold max-w-2xl leading-tight">
                            必要な分だけ、必要な時に。<br className="hidden md:block" />
                            透明性の高い<span className="inline-block">「Pay as you go」</span>システム。
                        </p>
                    </div>

                    {/* Cost Logic Grid */}
                    <div className="mb-24 bg-white border-2 border-black p-6 md:p-16">
                        <div className="grid lg:grid-cols-2 gap-12 md:gap-20 items-center">
                            <div>
                                <div className="inline-block bg-black text-white text-xs md:text-sm font-black px-4 py-2 mb-6 md:mb-8 uppercase tracking-widest">
                                    Cost Performance
                                </div>
                                <h3 className="text-3xl md:text-5xl font-black mb-4 tracking-tight">LP制作コストの革命</h3>
                                <div className="flex flex-wrap items-baseline gap-2 md:gap-4 mb-6 md:mb-8">
                                    <span className="text-7xl md:text-9xl font-black tracking-tighter text-black leading-none">
                                        ¥1,500
                                    </span>
                                    <span className="text-xl md:text-3xl font-bold text-gray-500">〜 / 1LP</span>
                                </div>
                                <p className="text-base md:text-xl text-gray-600 font-bold leading-relaxed">
                                    従来の制作フローにおける<span className="inline-block">「固定費」を撤廃。</span><br className="hidden md:block" />
                                    <span className="inline-block">AIによる自動化で、</span><span className="inline-block">圧倒的なコスト効率を実現しました。</span>
                                </p>
                            </div>

                            <div className="border-2 border-black bg-gray-50 p-6 md:p-10">
                                <h4 className="text-sm md:text-base font-black text-gray-900 uppercase tracking-wider mb-6 md:mb-8 border-b-2 border-black pb-4">
                                    Breakdown (Estimate)
                                </h4>
                                <div className="space-y-4 md:space-y-6">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-sm md:text-lg font-bold gap-1 md:gap-0">
                                        <span className="flex items-center gap-3">
                                            <span className="w-8 h-8 bg-black text-white flex items-center justify-center rounded-none">
                                                <Image className="w-4 h-4" />
                                            </span>
                                            画像生成 (x5)
                                        </span>
                                        <span className="font-mono text-lg md:text-xl pl-11 md:pl-0">¥750 - ¥1,000</span>
                                    </div>
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-sm md:text-lg font-bold gap-1 md:gap-0">
                                        <span className="flex items-center gap-3">
                                            <span className="w-8 h-8 bg-black text-white flex items-center justify-center rounded-none">
                                                <Wand2 className="w-4 h-4" />
                                            </span>
                                            インペイント (x3)
                                        </span>
                                        <span className="font-mono text-lg md:text-xl pl-11 md:pl-0">¥300 - ¥450</span>
                                    </div>
                                    <div className="pt-6 mt-6 border-t-2 border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-0">
                                        <span className="font-black text-lg md:text-xl text-gray-900">ESTIMATED TOTAL</span>
                                        <span className="font-mono text-2xl md:text-3xl font-black text-amber-600 bg-amber-100 px-2">¥1,050 - ¥1,450</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Plans Grid */}
                    <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 md:grid md:grid-cols-3 md:gap-0 md:pb-0 md:mx-0 md:px-0 bg-transparent md:bg-white md:border-2 md:border-black md:divide-x-2 divide-black scrollbar-hide">
                        {PLAN_DATA.map((plan) => (
                            <div
                                key={plan.id}
                                className={cn(
                                    "p-6 md:p-12 transition-all hover:bg-gray-50 flex flex-col h-full min-w-[300px] snap-center flex-shrink-0 md:min-w-0 bg-white border-2 border-black md:border-none",
                                    plan.highlight ? "bg-amber-50" : ""
                                )}
                            >
                                <div className="mb-auto">
                                    <h3 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">{plan.name}</h3>
                                    <p className="text-xs text-black font-black tracking-widest uppercase mb-6 md:mb-8 border-b-2 border-black pb-4 inline-block">{plan.description}</p>

                                    <div className="flex items-baseline gap-1 mb-6 md:mb-8">
                                        <span className="text-5xl md:text-6xl font-black tracking-tighter">{plan.price}</span>
                                        <span className="text-gray-500 font-mono text-xs md:text-sm font-bold">{plan.period}</span>
                                    </div>

                                    <div className="mb-8 md:mb-10 inline-flex items-center gap-2 text-xs md:text-sm font-bold font-mono text-black bg-white border-2 border-black px-3 md:px-4 py-2">
                                        <CreditCard className="w-4 h-4" />
                                        CREDIT: {plan.credit}
                                    </div>

                                    <ul className="space-y-4 md:space-y-5 mb-8 md:mb-12">
                                        {plan.features.map((feature, i) => (
                                            <li key={i} className="flex items-start gap-4 text-sm md:text-base font-bold text-gray-900">
                                                <div className="w-5 h-5 md:w-6 md:h-6 bg-black text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <Check className="w-3 h-3 md:w-4 md:h-4" strokeWidth={4} />
                                                </div>
                                                {feature}
                                            </li>
                                        ))}
                                        {plan.limitations.map((limitation, i) => (
                                            <li key={i} className="flex items-start gap-4 text-xs md:text-sm font-bold text-gray-400">
                                                <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-gray-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <X className="w-3 h-3 md:w-4 md:h-4 text-gray-300" strokeWidth={3} />
                                                </div>
                                                {limitation}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <Button
                                    className={cn(
                                        "w-full h-12 md:h-14 rounded-none text-base md:text-lg font-black tracking-widest uppercase transition-all duration-200 border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]",
                                        plan.highlight
                                            ? "bg-amber-500 border-black text-black hover:bg-amber-400"
                                            : "bg-white border-black text-black hover:bg-gray-100"
                                    )}
                                >
                                    {plan.highlight ? "Get Started" : "Start Free"}
                                </Button>
                            </div>
                        ))}
                    </div>

                    {/* Credit Usage */}
                    <div className="max-w-5xl mx-auto mt-20 md:mt-32">
                        <div className="flex flex-col md:flex-row items-end justify-between gap-4 mb-8">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Credit Consumption</h3>
                                <p className="text-sm font-bold text-gray-500 mt-2">各機能のクレジット消費一覧</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 border-2 border-black bg-black gap-0.5">
                            {CREDIT_USAGE.map((item, index) => (
                                <div
                                    key={item.action}
                                    className="bg-white p-4 md:p-6 flex flex-col justify-between h-full hover:bg-amber-50 transition-colors"
                                >
                                    <div className="mb-4">
                                        <item.icon className="w-5 h-5 text-black mb-3" />
                                        <p className="text-xs font-black text-gray-500 uppercase tracking-wider">{item.action}</p>
                                    </div>
                                    <p className="text-lg font-black text-gray-900 tracking-tight tabular-nums">{item.cost}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-24 bg-gray-50">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-12"
                    >
                        <Badge variant="secondary" className="mb-4 gap-1.5">
                            <HelpCircle className="w-3 h-3" />
                            よくある質問
                        </Badge>
                        <h2 className="text-4xl font-black tracking-tight">
                            わからないことはありませんか？
                        </h2>
                    </motion.div>

                    <Accordion type="single" collapsible className="space-y-3">
                        {FAQ_DATA.map((faq, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <AccordionItem
                                    value={`item-${index}`}
                                    className="bg-white rounded-xl px-6 border-0 shadow-sm data-[state=open]:shadow-lg data-[state=open]:ring-2 data-[state=open]:ring-amber-400 transition-all"
                                >
                                    <AccordionTrigger className="text-left font-bold hover:no-underline py-5">
                                        <div className="flex items-center gap-4">
                                            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-black flex-shrink-0">
                                                Q{index + 1}
                                            </span>
                                            <span>{faq.question}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-gray-600 pb-5 pl-12">
                                        {faq.answer}
                                    </AccordionContent>
                                </AccordionItem>
                            </motion.div>
                        ))}
                    </Accordion>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mt-12 text-center"
                    >
                        <p className="text-gray-500 mb-4">その他のご質問は</p>
                        <a
                            href="mailto:team@zettai.co.jp"
                            className="inline-flex items-center gap-2 text-amber-600 font-bold hover:text-amber-700 transition-colors"
                        >
                            <Mail className="w-4 h-4" />
                            team@zettai.co.jp
                            <ArrowRight className="w-4 h-4" />
                        </a>
                    </motion.div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 bg-gray-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />

                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-8">
                            LP制作をもっとシンプルに。
                            <br />
                            もっとクリエイティブに。
                        </h2>
                        <p className="text-gray-400 mb-10 max-w-xl mx-auto text-lg">
                            PoCプランは初期費用無料でお試しいただけます。
                            <br />
                            まずは順番待ちリストにご登録ください。
                        </p>
                        <Button
                            variant="amber"
                            size="xl"
                            onClick={scrollToTop}
                            className="gap-3"
                        >
                            順番待ちリストに登録する
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 bg-gray-950 text-white border-t border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-500 rounded-md" />
                            <span className="font-bold">LP Builder</span>
                        </div>
                        <p className="text-xs text-gray-500">
                            © 2026 ZETTAI INC. ALL RIGHTS RESERVED.
                        </p>
                        <div className="flex items-center gap-6 text-sm">
                            <button
                                onClick={() => setModalType('terms')}
                                className="text-gray-500 hover:text-amber-500 transition-colors"
                            >
                                利用規約
                            </button>
                            <button
                                onClick={() => setModalType('privacy')}
                                className="text-gray-500 hover:text-amber-500 transition-colors"
                            >
                                プライバシー
                            </button>
                            <a href="mailto:team@zettai.co.jp" className="text-gray-500 hover:text-amber-500 transition-colors">
                                team@zettai.co.jp
                            </a>
                        </div>
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
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-6 border-b border-gray-100">
                                <h2 className="text-xl font-bold">
                                    {modalType === 'terms' ? '利用規約' : 'プライバシーポリシー'}
                                </h2>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setModalType(null)}
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                            <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
                                {modalType === 'terms' ? (
                                    <div className="space-y-6">
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                            <p className="text-amber-800 font-bold text-sm mb-2">重要ポイント</p>
                                            <ul className="text-sm text-amber-700 space-y-1">
                                                <li>・生成コンテンツの著作権は利用者に帰属します</li>
                                                <li>・入力データ・生成物の権利侵害責任は利用者が負います</li>
                                                <li>・サービスは「現状有姿」で提供されます</li>
                                            </ul>
                                        </div>

                                        <div className="space-y-4 text-sm text-gray-700">
                                            <div>
                                                <h3 className="font-bold text-gray-900 mb-2">サービス内容</h3>
                                                <p>LP BuilderはAIを活用したランディングページ作成支援ツールです。当社はサービス内容を予告なく変更・終了する場合があります。</p>
                                            </div>

                                            <div>
                                                <h3 className="font-bold text-gray-900 mb-2">利用料金</h3>
                                                <p>当社が定める料金を指定方法でお支払いください。支払済みの料金は返金いたしません。</p>
                                            </div>

                                            <div>
                                                <h3 className="font-bold text-gray-900 mb-2">禁止事項</h3>
                                                <p>法令違反、権利侵害、虚偽情報の発信、違法・有害コンテンツの作成、不正アクセス等は禁止されています。</p>
                                            </div>

                                            <div>
                                                <h3 className="font-bold text-gray-900 mb-2">免責事項</h3>
                                                <p>当社は生成コンテンツの正確性・適法性を保証しません。AI生成結果に起因する損害について当社は責任を負いません。</p>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-gray-200">
                                            <Button
                                                variant="outline"
                                                className="w-full"
                                                onClick={() => window.open('/terms', '_blank')}
                                            >
                                                利用規約の全文を見る
                                                <ArrowRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <p className="text-blue-800 font-bold text-sm mb-2">お客様の情報の取扱いについて</p>
                                            <ul className="text-sm text-blue-700 space-y-1">
                                                <li>・個人情報はサービス提供・改善目的で使用します</li>
                                                <li>・同意なく第三者に提供することはありません</li>
                                                <li>・情報の開示・削除請求が可能です</li>
                                            </ul>
                                        </div>

                                        <div className="space-y-4 text-sm text-gray-700">
                                            <div>
                                                <h3 className="font-bold text-gray-900 mb-2">取得する情報</h3>
                                                <p>氏名、メールアドレス、電話番号、会社名のほか、IPアドレス、ブラウザ情報、サービス利用履歴等を取得します。</p>
                                            </div>

                                            <div>
                                                <h3 className="font-bold text-gray-900 mb-2">利用目的</h3>
                                                <p>サービスの提供・運営・改善、お問い合わせ対応、利用料金の請求、不正利用の防止等に利用します。</p>
                                            </div>

                                            <div>
                                                <h3 className="font-bold text-gray-900 mb-2">外部サービス</h3>
                                                <p>AI API、クラウドサービス（Supabase、Vercel）、分析ツール（Google Analytics）、決済サービス（Stripe）を利用します。</p>
                                            </div>

                                            <div>
                                                <h3 className="font-bold text-gray-900 mb-2">お客様の権利</h3>
                                                <p>個人情報の開示・訂正・利用停止・削除を請求することができます。</p>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-gray-200">
                                            <Button
                                                variant="outline"
                                                className="w-full"
                                                onClick={() => window.open('/privacy', '_blank')}
                                            >
                                                プライバシーポリシーの全文を見る
                                                <ArrowRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
