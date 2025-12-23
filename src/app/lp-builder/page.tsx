"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Search, ArrowRight, Layout, Type, Image as ImageIcon, Check, MousePointer2 } from 'lucide-react';

const GENERATION_STEPS = [
  {
    query: "パーソナルジムの入会促進LPを作って",
    accent: "#4285F4",
    sections: [
      { type: 'Hero', color: 'bg-blue-600', textColor: 'text-white', title: '理想の体へ、最短距離で。', desc: 'プロのトレーナーがあなた専用のプログラムを構築し、理想のボディメイクをサポート。', btn: '体験入会を予約する' },
      { type: 'Features', color: 'bg-white', textColor: 'text-gray-900', title: '選ばれる3つの理由', desc: '完全個室、24時間管理、科学的な食事指導で結果にコミットします。', btn: '詳細を見る' }
    ]
  },
  {
    query: "新発売のオーガニックコーヒーを紹介したい",
    accent: "#34A853",
    sections: [
      { type: 'Hero', color: 'bg-emerald-900', textColor: 'text-emerald-50', title: '至福の一杯を、エシカルに。', desc: 'アフリカ直送の厳選された豆を使用した、100%オーガニックな深い味わい。', btn: '定期便を申し込む' },
      { type: 'Pricing', color: 'bg-white', textColor: 'text-gray-900', title: 'シンプルで続けやすいプラン', desc: '毎月新鮮な豆が届く、あなたにぴったりのコーヒーライフをご提案。', btn: 'プランを選ぶ' }
    ]
  },
  {
    query: "AI特化型プログラミングスクールの募集用",
    accent: "#EA4335",
    sections: [
      { type: 'Hero', color: 'bg-slate-900', textColor: 'text-white', title: 'AIを操り、未来を創る。', desc: '現場第一線のエンジニアが教える、実務特化型のAI開発カリキュラム。', btn: '無料カウンセリング' },
      { type: 'FAQ', color: 'bg-blue-50', textColor: 'text-blue-900', title: 'よくある質問', desc: '学習の進め方やキャリアサポートについて、詳しくお答えします。', btn: 'FAQ一覧へ' }
    ]
  }
];

export default function LPBuilderIntroPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const currentStep = GENERATION_STEPS[stepIndex];

  useEffect(() => {
    const interval = setInterval(() => {
      setIsGenerating(true);
      setTimeout(() => {
        setStepIndex((prev) => (prev + 1) % GENERATION_STEPS.length);
        setIsGenerating(false);
      }, 800);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-50 overflow-x-hidden">
      {/* Google-Style Header */}
      <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-sm px-6 h-16 flex items-center justify-between border-b border-transparent hover:border-gray-100 transition-colors">
        <div className="flex items-center space-x-2">
          <motion.div
            className="flex space-x-0.5"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 4 }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[#4285F4]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#EA4335]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#FBBC05]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#34A853]"></div>
          </motion.div>
          <span className="text-sm font-bold text-gray-600 tracking-tight font-google">ZettAI LP Builder</span>
        </div>
        <div className="flex items-center space-x-6">
          <nav className="hidden md:flex items-center space-x-6 text-[13px] font-medium text-gray-500 font-google">
            <a href="#" className="hover:text-gray-900 transition-colors">製品情報</a>
            <a href="#" className="hover:text-gray-900 transition-colors">活用事例</a>
          </nav>
          <Link
            href="/admin/lp-builder"
            className="px-6 py-2 bg-[#1a73e8] text-white text-sm font-bold rounded-md hover:bg-[#1557b0] transition-colors shadow-sm font-google"
          >
            ログイン
          </Link>
        </div>
      </header>

      {/* Google-Style Search/Hero Section */}
      <section className="pt-40 pb-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h1 className="text-5xl md:text-6xl font-google font-medium tracking-tight text-[#202124] mb-8 leading-tight">
              作りたいLPを、<br />
              言葉にするだけ。
            </h1>
          </motion.div>

          {/* Search Bar Style Input UI Area */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative max-w-2xl mx-auto group"
          >
            <div className="flex items-center bg-white border border-gray-200 rounded-full px-6 py-4 shadow-sm hover:shadow-md transition-shadow group-focus-within:shadow-md group-focus-within:border-transparent group-focus-within:ring-1 group-focus-within:ring-blue-100 min-h-[64px]">
              <Search className="w-5 h-5 text-gray-400 mr-4" />
              <div className="flex-1 text-left text-gray-600 text-lg overflow-hidden whitespace-nowrap font-google">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={stepIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5 }}
                  >
                    {currentStep.query}
                  </motion.span>
                </AnimatePresence>
                <span className="inline-block w-0.5 h-6 bg-blue-500 ml-1 align-middle animate-pulse"></span>
              </div>
              <motion.div
                animate={isGenerating ? { rotate: 360 } : { rotate: 0 }}
                transition={{ duration: 0.8, ease: "linear" }}
              >
                <Sparkles className={`w-5 h-5 ml-4 transition-colors ${isGenerating ? 'text-blue-600' : 'text-blue-400'}`} />
              </motion.div>
            </div>
          </motion.div>

          <div className="mt-12 flex items-center justify-center space-x-6">
            <Link
              href="/admin/lp-builder"
              className="bg-gray-50 px-6 py-2 rounded text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all font-google border border-gray-200"
            >
              Google 検索
            </Link>
            <Link
              href="/admin/lp-builder"
              className="bg-gray-50 px-6 py-2 rounded text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all font-google border border-gray-200"
            >
              I'm Feeling Lucky
            </Link>
          </div>
        </div>
      </section>

      {/* AI Generation Animation Section */}
      <section className="py-24 bg-[#f8f9fa] border-y border-gray-100 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="flex-1 text-left">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl font-google font-medium text-[#202124] mb-6">
                  思考を、そのまま形に。
                </h2>
                <p className="text-[#5f6368] font-google leading-relaxed mb-8 text-lg">
                  ZettAI AIがあなたのビジネスを理解し、一貫性のあるデザインと心に響くコピーを自動生成。
                  磨き抜かれた構成美と機能性が、顧客の心を掴みます。
                </p>
                <div className="space-y-4">
                  {[
                    { icon: <Layout className="w-4 h-4" />, text: "構成案の自動選定" },
                    { icon: <Type className="w-4 h-4" />, text: "コピーライティング生成" },
                    { icon: <ImageIcon className="w-4 h-4" />, text: "ビジュアルトーンの統一" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center text-sm font-medium text-[#202124] font-google">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center mr-3 shadow-sm text-blue-500">
                        {item.icon}
                      </div>
                      {item.text}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Animated LP Preview */}
            <div className="flex-1 w-full max-w-xl">
              <motion.div
                className="bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden aspect-[4/5] flex flex-col relative"
                animate={{ borderColor: currentStep.accent + '33' }}
              >
                {/* Browser Toolbar */}
                <div className="h-10 bg-white border-b border-gray-100 px-4 flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                    <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                    <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                  </div>
                  <div className="w-32 h-4 bg-gray-50 rounded px-2 flex items-center">
                    <div className="w-full h-1 bg-gray-200 rounded-full"></div>
                  </div>
                  <div className="w-4 h-4 rounded-full bg-gray-50 text-[10px] flex items-center justify-center text-gray-300">
                    G
                  </div>
                </div>

                {/* Preview Content Area */}
                <div className="flex-1 relative overflow-hidden bg-gray-50">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={stepIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6 }}
                      className="h-full"
                    >
                      <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-4">
                        {currentStep.sections.map((section, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 40, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: idx * 0.5, type: "spring", damping: 20 }}
                            className={`${section.color} ${section.textColor} rounded-2xl p-8 shadow-sm border border-black/5 flex flex-col items-center text-center`}
                          >
                            <motion.div
                              className="text-[10px] font-black tracking-widest uppercase mb-4 opacity-60 font-google"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0.6 }}
                              transition={{ delay: idx * 0.5 + 0.2 }}
                            >
                              {section.type} Section
                            </motion.div>
                            <motion.h3
                              className="text-xl md:text-2xl font-black mb-4 leading-tight font-google"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.5 + 0.3 }}
                            >
                              {section.title}
                            </motion.h3>
                            <motion.p
                              className="text-xs md:text-sm mb-6 opacity-80 leading-relaxed font-google"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0.8 }}
                              transition={{ delay: idx * 0.5 + 0.5 }}
                            >
                              {section.desc}
                            </motion.p>
                            <motion.div
                              className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${section.textColor === 'text-white' ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'}`}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: idx * 0.5 + 0.7 }}
                            >
                              {section.btn}
                            </motion.div>
                          </motion.div>
                        ))}

                        {/* Placeholder for more content */}
                        <div className="h-32 bg-white/40 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center">
                          <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest font-google">Next Section Generating...</div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* AI Mouse Cursor Overlay */}
                  <motion.div
                    className="absolute text-blue-500 z-20 pointer-events-none drop-shadow-lg"
                    animate={{
                      x: [100, 350, 200, 400, 150],
                      y: [150, 80, 250, 350, 100],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 8,
                      ease: "easeInOut"
                    }}
                  >
                    <MousePointer2 className="w-5 h-5 fill-current" />
                    <motion.div
                      className="absolute top-4 left-4 bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded shadow-lg font-black whitespace-nowrap"
                      animate={{ opacity: [0, 1, 1, 0], x: [0, 5, 5, 0] }}
                      transition={{ repeat: Infinity, duration: 8 }}
                    >
                      ZettAI AI
                    </motion.div>
                  </motion.div>

                  {/* AI Generation Status Overlay */}
                  <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-full border border-blue-100 shadow-xl flex items-center space-x-3 z-30">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-[10px] font-black text-blue-600 tracking-wider uppercase font-google">Synthesizing</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props Section */}
      <section className="py-24 border-b border-gray-50">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-3 gap-16">
          {[
            { icon: <Layout className="text-[#4285F4]" />, title: "本質を捉える構成", desc: "業界特有の訴求ポイントをAIが自動分析し、コンバージョンに特化したレイアウトを生成。" },
            { icon: <Type className="text-[#EA4335]" />, title: "感情を動かすコピー", desc: "Gemini 1.5の高度な言語処理で、単なる紹介に留まらない「売れる」文章を書き上げます。" },
            { icon: <Sparkles className="text-[#FBBC05]" />, title: "洗練された世界観", desc: "ターゲットに合わせたビジュアルトーンを自動選定。ブランドの信頼性を高めます。" }
          ].map((item, i) => (
            <div key={i} className="text-center group">
              <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                {item.icon}
              </div>
              <h3 className="text-[15px] font-bold text-gray-900 mb-3 font-google">{item.title}</h3>
              <p className="text-[13px] text-gray-500 leading-relaxed px-6 font-google">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-40 bg-white">
        <div className="max-w-2xl mx-auto text-center px-6">
          <h2 className="text-4xl md:text-5xl font-google font-medium tracking-tight text-[#202124] mb-12 leading-tight">
            これからの制作は、<br />AIが良きパートナーに。
          </h2>
          <Link
            href="/admin/lp-builder"
            className="inline-flex items-center px-10 py-4 bg-[#1a73e8] text-white font-bold rounded-lg hover:bg-[#1557b0] transition-all shadow-xl hover:shadow-2xl active:scale-95 group font-google"
          >
            ログインしてはじめる
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="mt-8 text-xs text-gray-400 font-google">
            高度な専門知識は不要。数ステップでプロ品質のLPが完成します。
          </p>
        </div>
      </section>

      {/* Google-Style Footer */}
      <footer className="py-12 bg-[#f8f9fa] border-t border-gray-100 px-6 font-google">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between text-[#70757a] text-[13px]">
          <div className="flex items-center space-x-8 mb-4 md:mb-0">
            <a href="#" className="hover:underline">利用規約</a>
            <a href="#" className="hover:underline">プライバシー</a>
            <a href="#" className="hover:underline">ヘルプ</a>
          </div>
          <div>
            © 2024 Gemini LP Builder
          </div>
        </div>
      </footer>

      <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap');
                .font-google {
                    font-family: 'Roboto', 'Noto Sans JP', sans-serif;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
    </div>
  );
}
