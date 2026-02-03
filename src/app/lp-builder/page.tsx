"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, MoveRight } from 'lucide-react';

const GENERATION_STEPS = [
  {
    query: "パーソナルジムの入会促進LP",
    accent: "#111",
    sections: [
      { type: '01. Hero', title: '理想の体へ、最短距離で。', desc: 'プロのトレーナーがあなた専用のプログラムを構築し、理想のボディメイクをサポート。', btn: '体験入会を予約する' },
      { type: '02. Features', title: '選ばれる3つの理由', desc: '完全個室、24時間管理、科学的な食事指導で結果にコミットします。', btn: '詳細を見る' }
    ]
  },
  {
    query: "新発売のオーガニックコーヒー",
    accent: "#111",
    sections: [
      { type: '01. Hero', title: '至福の一杯を、エシカルに。', desc: 'アフリカ直送の厳選された豆を使用した、100%オーガニックな深い味わい。', btn: '定期便を申し込む' },
      { type: '02. Pricing', title: 'シンプルで続けやすいプラン', desc: '毎月新鮮な豆が届く、あなたにぴったりのコーヒーライフをご提案。', btn: 'プランを選ぶ' }
    ]
  },
  {
    query: "AI特化型プログラミングスクール",
    accent: "#111",
    sections: [
      { type: '01. Hero', title: 'AIを操り、未来を創る。', desc: '現場第一線のエンジニアが教える、実務特化型のAI開発カリキュラム。', btn: '無料カウンセリング' },
      { type: '02. FAQ', title: 'よくある質問', desc: '学習の進め方やキャリアサポートについて、詳しくお答えします。', btn: 'FAQ一覧へ' }
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
      }, 1200);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#111] font-sans selection:bg-black selection:text-white">
      {/* Minimal Header */}
      <header className="fixed top-0 w-full z-50 bg-[#f8f8f8]/80 backdrop-blur-md px-6 md:px-12 h-20 flex items-center justify-between border-b border-black/5">
        <div className="text-lg font-bold tracking-tight font-manrope">
          そっくりLP
        </div>
        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-500">
          <Link
            href="/admin/lp-builder"
            className="text-black border-b border-black pb-0.5 hover:opacity-70 transition-opacity"
          >
            Login
          </Link>
        </nav>
      </header>

      {/* Typographic Hero Section */}
      <section className="pt-32 md:pt-48 pb-16 md:pb-32 px-6 md:px-12 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Main Title Area */}
          <div className="lg:col-span-8">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-8xl lg:text-[7rem] font-bold leading-[0.9] tracking-tighter mb-12"
            >
              Words become<br />
              <span className="text-gray-400">Interface.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-gray-600 max-w-xl leading-relaxed font-jp mb-12"
            >
              あなたのビジョンを言葉にするだけで、<br className="hidden md:block" />
              ビジネスを加速させるランディングページが完成します。<br />
              デザインも、コピーも、すべてAIと共に。
            </motion.p>

            {/* Input Simulation */}
            <div className="relative max-w-2xl group">
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-black opacity-0 group-hover:opacity-100 transition-opacity" />
              <input
                type="text"
                readOnly
                value=""
                placeholder="What do you want to build?"
                className="w-full bg-transparent border-b-2 border-gray-200 py-4 text-2xl md:text-3xl font-light text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-black transition-colors"
              />
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex items-center">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={stepIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                    className="text-2xl md:text-3xl font-light text-black truncate"
                  >
                    {currentStep.query}
                  </motion.span>
                </AnimatePresence>
                {isGenerating && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="ml-4 px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-widest"
                  >
                    Thinking
                  </motion.div>
                )}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-12"
            >
              <Link
                href="/admin/lp-builder"
                className="group inline-flex items-center text-lg font-bold border-b-2 border-black pb-1 hover:text-gray-600 hover:border-gray-600 transition-colors"
              >
                Start Building
                <MoveRight className="ml-3 w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </Link>
            </motion.div>
          </div>

          {/* Right Column: Preview Feed */}
          <div className="lg:col-span-4 mt-12 lg:mt-0 lg:pl-12 border-l border-gray-100 h-full min-h-[400px]">
            <div className="relative">
              <div className="absolute -left-[3.25rem] top-0 text-xs font-mono text-gray-300 -rotate-90 origin-bottom-right">LIVE PREVIEW</div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={stepIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.5, ease: "circOut" }}
                  className="space-y-6"
                >
                  {currentStep.sections.map((section, i) => (
                    <div key={i} className="bg-white p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-gray-100/50">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-4">{section.type}</div>
                      <h3 className="text-xl font-bold mb-3 font-jp">{section.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed font-jp mb-6">{section.desc}</p>
                      <div className="inline-block border border-gray-200 px-4 py-2 text-xs font-medium uppercase tracking-wider hover:bg-black hover:text-white transition-colors cursor-default">
                        {section.btn}
                      </div>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* Feature List (Editorial Style) */}
      <section className="py-16 md:py-32 border-t border-black/5">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="grid md:grid-cols-3 gap-x-12 gap-y-16">
            {[
              { label: "01", title: "Structure", desc: "業界特有の成功パターンを学習したAIが、目的達成に最適な構成を提案します。" },
              { label: "02", title: "Copywriting", desc: "人の心を動かす言葉選び。商品の魅力を最大限に引き出すコピーを自動生成。" },
              { label: "03", title: "Visuals", desc: "ブランドの世界観に合わせたトーン&マナーで、洗練されたビジュアルを構築。" }
            ].map((item, i) => (
              <div key={i} className="group cursor-default">
                <div className="text-xs font-mono text-gray-300 mb-6 group-hover:text-black transition-colors">{item.label}</div>
                <h3 className="text-2xl font-bold mb-4 font-manrope">{item.title}</h3>
                <p className="text-gray-500 leading-loose text-sm font-jp border-l border-gray-100 pl-6 group-hover:border-black/20 transition-colors">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-black/5 bg-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 flex justify-between items-end">
          <div>
            <div className="text-sm font-bold tracking-tight mb-2">そっくりLP</div>
            <p className="text-xs text-gray-400">© 2025 All rights reserved.</p>
          </div>
          <div className="text-[10px] font-mono text-gray-300 uppercase tracking-widest">
            Designed by Intelligence
          </div>
        </div>
      </footer>
    </div>
  );
}
