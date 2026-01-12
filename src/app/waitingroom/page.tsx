"use client";

import React, { useState } from 'react';
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
        answer: 'シンプルなLP（5〜6セクション、画像3〜5枚生成）で約$0.10〜$0.20（約15〜30円）、本格的なLP（10セクション以上、画像10枚以上）で約$0.30〜$0.80（約45〜120円）が目安です。Proプラン（月$16.67）なら、月に50〜150ページ程度のLPを作成できます。',
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
        answer: 'メールサポート（team@zettai.co.jp）をご利用いただけます。Expertプラン以上では優先サポートが適用され、より迅速な対応が可能です。',
    },
];

// Plan data
const PLAN_DATA = [
    {
        id: 'free',
        name: 'Free',
        price: '¥0',
        period: '/月',
        credit: '0',
        creditNote: '※自分のAPIキーが必要',
        description: 'まずは試してみたい方に',
        icon: User,
        features: [
            '最大10ページ',
            '画像生成（自分のAPIキー）',
            'HTMLエクスポート',
        ],
        limitations: [
            '4Kアップスケール不可',
            'リスタイル不可',
            '動画生成不可',
        ],
        highlight: false,
        gradient: 'from-gray-100 to-gray-50',
    },
    {
        id: 'pro',
        name: 'Pro',
        price: '¥10,000',
        period: '/月',
        credit: '$16.67',
        creditNote: '約50〜150LP分',
        description: 'スタートアップ・個人事業主に',
        icon: Zap,
        features: [
            '最大50ページ',
            '月間クレジット $16.67分',
            '画像生成',
            '4Kアップスケール',
            'リスタイル機能',
            'HTMLエクスポート',
        ],
        limitations: [],
        highlight: true,
        gradient: 'from-amber-500 to-orange-500',
    },
    {
        id: 'expert',
        name: 'Expert',
        price: '¥30,000',
        period: '/月',
        credit: '$50',
        creditNote: '約150〜500LP分',
        description: '代理店・中規模ビジネスに',
        icon: Building2,
        features: [
            '最大200ページ',
            '月間クレジット $50分',
            'Pro全機能',
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
    { action: '画像生成', cost: '約3〜6円', icon: Image },
    { action: 'インペイント', cost: '約3〜6円', icon: Wand2 },
    { action: 'リスタイル', cost: '約3〜6円', icon: Palette },
    { action: '動画生成', cost: '約53円/秒', icon: Video },
    { action: 'URL取り込み', cost: '〜1円', icon: Globe },
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch('/api/waitingroom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                    <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 py-8 lg:py-16 items-center min-h-[calc(100vh-100px)]">
                        {/* Left: Brand & Vision */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="flex flex-col justify-center"
                        >
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight mb-4">
                                LP制作を、
                                <span className="text-amber-500">もっと簡単に。</span>
                            </h1>

                            <p className="text-gray-600 mb-6 max-w-md">
                                既存サイトのURLを入力するだけで、デザインを自動で取り込み。
                                画像生成やインペイント編集で自由にカスタマイズできます。
                            </p>

                            {/* Feature List */}
                            <ul className="space-y-2 text-sm text-gray-700">
                                <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                    URLからデザインを自動取り込み
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                    画像生成・インペイント編集
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
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
                                            {/* Current Plan */}
                                            <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs text-amber-600 font-medium mb-1">現在ご案内中</p>
                                                        <p className="font-bold text-gray-900">PoCプラン</p>
                                                        <p className="text-xl font-bold text-amber-600">¥20,000<span className="text-sm font-normal text-gray-500">/月</span></p>
                                                    </div>
                                                    <div className="text-right text-xs text-gray-600">
                                                        <p>初月無料</p>
                                                        <p>全機能利用可</p>
                                                    </div>
                                                </div>
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
                                                        disabled={isLoading || !formData.accountType}
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
            <section className="py-24 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <Badge variant="amber" className="mb-4">Features</Badge>
                        <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
                            LP Builderでできること
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            高品質なランディングページを誰でも簡単に作成・編集できます。
                        </p>
                    </motion.div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {FEATURES.map((feature, index) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className="h-full hover:shadow-lg transition-all duration-300 group border-0 bg-white">
                                    <CardHeader>
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white transition-transform group-hover:scale-110",
                                            feature.color
                                        )}>
                                            <feature.icon className="w-6 h-6" />
                                        </div>
                                        <CardTitle className="text-lg group-hover:text-amber-600 transition-colors">
                                            {feature.title}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-gray-600">{feature.description}</p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <Badge variant="amber" className="mb-4">How It Works</Badge>
                        <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
                            3ステップで完成
                        </h2>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-8 relative">
                        {/* Connecting line */}
                        <div className="hidden md:block absolute top-16 left-[16.66%] right-[16.66%] h-0.5 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200" />

                        {[
                            { step: '01', title: 'URLを入力', description: '参考にしたいLPのURLを入力するか、新規作成を選択します。', icon: Globe },
                            { step: '02', title: '自由に編集', description: 'テキストや画像を自由に編集。プロンプトを入力するだけで簡単に変更。', icon: Wand2 },
                            { step: '03', title: 'エクスポート', description: '完成したLPをHTMLでエクスポート。すぐに公開できます。', icon: Download },
                        ].map((item, index) => (
                            <motion.div
                                key={item.step}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.15 }}
                                className="text-center relative"
                            >
                                <div className="relative inline-block mb-6">
                                    <div className="w-20 h-20 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center shadow-lg">
                                        <item.icon className="w-8 h-8 text-gray-700" />
                                    </div>
                                    <span className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 text-white text-sm font-black rounded-full flex items-center justify-center shadow-lg">
                                        {item.step}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                                <p className="text-gray-600">{item.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section className="py-24 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
                <div className="absolute top-20 left-10 w-72 h-72 bg-amber-200/20 rounded-full blur-3xl" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-200/20 rounded-full blur-3xl" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <Badge variant="amber" className="mb-4 gap-1.5">
                            <CreditCard className="w-3 h-3" />
                            シンプルな料金体系
                        </Badge>
                        <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
                            LP1つ、<span className="text-amber-600">約15円</span>から。
                        </h2>
                        <p className="text-lg text-gray-600">
                            使った分だけのクレジット制。ムダな固定費はかかりません。
                        </p>
                    </motion.div>

                    {/* Cost highlight */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mb-16"
                    >
                        <Card className="bg-gradient-to-r from-amber-500 to-orange-500 border-0 text-white overflow-hidden">
                            <CardContent className="p-8">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                                    <div>
                                        <p className="text-amber-100 mb-2">LP1つあたりの制作コスト</p>
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-5xl md:text-6xl font-black">¥15</span>
                                            <span className="text-2xl font-bold text-amber-200">〜 ¥120</span>
                                        </div>
                                        <p className="text-amber-100 mt-2 text-sm">※画像生成5〜20回の場合</p>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                                        <p className="text-amber-100 text-sm mb-3 font-medium">制作コスト内訳（目安）</p>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between gap-8">
                                                <span className="text-white/80">画像生成 ×5枚</span>
                                                <span className="font-bold">¥15〜30</span>
                                            </div>
                                            <div className="flex justify-between gap-8">
                                                <span className="text-white/80">インペイント ×3回</span>
                                                <span className="font-bold">¥9〜18</span>
                                            </div>
                                            <div className="border-t border-white/20 pt-2 mt-2 flex justify-between gap-8">
                                                <span className="font-bold">合計</span>
                                                <span className="font-black">約¥24〜48</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Plan Cards */}
                    <div className="grid md:grid-cols-3 gap-6 mb-16">
                        {PLAN_DATA.map((plan, index) => (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Card className={cn(
                                    "h-full relative transition-all duration-300 hover:-translate-y-2",
                                    plan.highlight
                                        ? "shadow-2xl shadow-amber-500/20 ring-2 ring-amber-500 border-0"
                                        : "border-gray-200 hover:shadow-xl"
                                )}>
                                    {plan.highlight && (
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg gap-1">
                                                <Star className="w-3 h-3" />
                                                人気No.1
                                            </Badge>
                                        </div>
                                    )}

                                    <CardHeader className="text-center pt-8">
                                        <div className={cn(
                                            "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
                                            plan.highlight
                                                ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30"
                                                : "bg-gray-100 text-gray-600"
                                        )}>
                                            <plan.icon className="w-8 h-8" />
                                        </div>
                                        <CardTitle className="text-2xl">{plan.name}</CardTitle>
                                        <CardDescription>{plan.description}</CardDescription>
                                    </CardHeader>

                                    <CardContent className="text-center">
                                        <div className="mb-6 pb-6 border-b border-gray-100">
                                            <div className="flex items-baseline justify-center gap-1">
                                                <span className="text-4xl font-black">{plan.price}</span>
                                                <span className="text-gray-400">{plan.period}</span>
                                            </div>
                                            <Badge variant={plan.highlight ? "amber" : "secondary"} className="mt-3 gap-1">
                                                <CreditCard className="w-3 h-3" />
                                                月間: {plan.credit}
                                            </Badge>
                                            <p className="text-xs text-gray-400 mt-2">{plan.creditNote}</p>
                                        </div>

                                        <ul className="space-y-3 text-left">
                                            {plan.features.map((feature, i) => (
                                                <li key={i} className="flex items-start gap-3 text-sm">
                                                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        <Check className="w-3 h-3 text-green-600" />
                                                    </div>
                                                    {feature}
                                                </li>
                                            ))}
                                            {plan.limitations.map((limitation, i) => (
                                                <li key={i} className="flex items-start gap-3 text-sm text-gray-400">
                                                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        <X className="w-3 h-3" />
                                                    </div>
                                                    {limitation}
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>

                    {/* Credit Usage */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <div className="text-center mb-8">
                            <h3 className="text-2xl font-black">各機能のクレジット消費</h3>
                            <p className="text-gray-500">機能を使うたびにクレジットが消費されます</p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                            {CREDIT_USAGE.map((item, index) => (
                                <motion.div
                                    key={item.action}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Card className="text-center hover:shadow-md transition-all group border-gray-100">
                                        <CardContent className="p-4">
                                            <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-amber-100 flex items-center justify-center mx-auto mb-3 transition-colors">
                                                <item.icon className="w-5 h-5 text-gray-500 group-hover:text-amber-600 transition-colors" />
                                            </div>
                                            <p className="text-xs font-bold mb-1">{item.action}</p>
                                            <p className="text-lg font-black text-amber-600">{item.cost}</p>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
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
                            PoCプランは初月無料でお試しいただけます。
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
                                <div className="prose prose-sm prose-gray max-w-none">
                                    <p className="text-sm text-gray-500">
                                        {modalType === 'terms'
                                            ? '利用規約の詳細は /terms ページをご確認ください。'
                                            : 'プライバシーポリシーの詳細は /privacy ページをご確認ください。'}
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="mt-4"
                                        onClick={() => window.open(modalType === 'terms' ? '/terms' : '/privacy', '_blank')}
                                    >
                                        詳細を見る
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
