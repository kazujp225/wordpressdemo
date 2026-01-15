'use client';

import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Upload, Wand2, MousePointer, Sparkles, Eye, Scissors, Palette, Type, Layers, ArrowRight, Check } from 'lucide-react';
import clsx from 'clsx';

interface TutorialModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const tutorialSteps = [
    {
        id: 'start',
        title: 'LP Builderの使い方',
        subtitle: '5分で分かる基本操作',
        content: (
            <div className="space-y-6">
                <div className="text-center py-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 mb-4 shadow-lg">
                        <Sparkles className="h-10 w-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">画像をアップするだけで<br/>LPが完成します</h3>
                    <p className="text-gray-500 text-sm">Canva、パワポ、Figmaなどで作った<br/>デザイン画像をそのままWebページに</p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">このチュートリアルで学べること</p>
                    <div className="space-y-2">
                        {['画像のアップロード方法', 'AIで高画質化する方法', 'ボタンにリンクを設定する方法', '見た目を調整する方法'].map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                                <Check className="h-4 w-4 text-green-500" />
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        ),
    },
    {
        id: 'upload',
        title: 'Step 1: 画像をアップロード',
        subtitle: 'まずはLPの元になる画像を追加',
        content: (
            <div className="space-y-5">
                {/* 操作説明 */}
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                    <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <Upload className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 text-sm mb-1">「画像追加」ボタンをクリック</p>
                            <p className="text-xs text-gray-600">右サイドバーの基本操作にあります</p>
                        </div>
                    </div>
                </div>

                {/* UIモック */}
                <div className="bg-gray-100 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">ボタンの場所</p>
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700">使い方</div>
                            <div className="px-3 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 animate-pulse">
                                <Upload className="h-3 w-3" /> 画像追加 ← ここ！
                            </div>
                            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">プレビュー</div>
                            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">ZIP出力</div>
                        </div>
                    </div>
                </div>

                {/* 補足 */}
                <div className="flex items-start gap-2 text-xs text-gray-500 bg-amber-50 rounded-xl p-3 border border-amber-100">
                    <span className="text-base">💡</span>
                    <div>
                        <p className="font-medium text-amber-800">対応フォーマット</p>
                        <p className="text-amber-700">PNG, JPG, WebPに対応。複数枚を一度に追加すると自動で縦に並びます。</p>
                    </div>
                </div>
            </div>
        ),
    },
    {
        id: 'hd',
        title: 'Step 2: AIで高画質化',
        subtitle: '画像をくっきり綺麗に',
        content: (
            <div className="space-y-5">
                {/* 操作説明 */}
                <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100">
                    <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-black">HD</span>
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 text-sm mb-1">上部の「HD」ボタンをクリック</p>
                            <p className="text-xs text-gray-600">画面上部のツールバーにあります</p>
                        </div>
                    </div>
                </div>

                {/* ビフォーアフター */}
                <div className="bg-gray-100 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">変化のイメージ</p>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 bg-white rounded-xl p-3 text-center border border-gray-200">
                            <div className="h-16 bg-gray-200 rounded-lg mb-2 flex items-center justify-center">
                                <span className="text-gray-400 text-xs blur-[1px]">ぼやけた画像</span>
                            </div>
                            <p className="text-[10px] text-gray-500">Before</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 bg-white rounded-xl p-3 text-center border-2 border-violet-300">
                            <div className="h-16 bg-gradient-to-br from-violet-100 to-purple-100 rounded-lg mb-2 flex items-center justify-center">
                                <span className="text-violet-700 text-xs font-bold">くっきり鮮明！</span>
                            </div>
                            <p className="text-[10px] text-violet-600 font-medium">After</p>
                        </div>
                    </div>
                </div>

                {/* 設定のおすすめ */}
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <p className="text-xs font-bold text-gray-700 mb-3">おすすめ設定</p>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">仕上がりサイズ</span>
                            <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-1 rounded">2K（推奨）</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">対象ブロック</span>
                            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">すべて</span>
                        </div>
                    </div>
                </div>
            </div>
        ),
    },
    {
        id: 'cta',
        title: 'Step 3: ボタンにリンクを設定',
        subtitle: 'お問い合わせボタンを動くようにする',
        content: (
            <div className="space-y-5">
                {/* 操作説明 */}
                <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
                    <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                            <MousePointer className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 text-sm mb-1">「ボタンのリンク先」を開く</p>
                            <p className="text-xs text-gray-600">右サイドバー「内容を編集する」の中</p>
                        </div>
                    </div>
                </div>

                {/* 手順 */}
                <div className="bg-gray-100 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">設定の流れ</p>
                    <div className="space-y-3">
                        <div className="flex items-start gap-3 bg-white rounded-xl p-3 border border-gray-200">
                            <div className="h-6 w-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">ボタンがある画像を選択</p>
                                <p className="text-xs text-gray-500">リンクを設定したいブロックを選びます</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 bg-white rounded-xl p-3 border border-gray-200">
                            <div className="h-6 w-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">ボタンの範囲をドラッグで指定</p>
                                <p className="text-xs text-gray-500">クリックできる範囲を四角で囲みます</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 bg-white rounded-xl p-3 border border-gray-200">
                            <div className="h-6 w-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">リンク先URLを入力</p>
                                <p className="text-xs text-gray-500">https://〜 または tel:, mailto: も可</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 補足 */}
                <div className="flex items-start gap-2 text-xs bg-amber-50 rounded-xl p-3 border border-amber-100">
                    <span className="text-base">💡</span>
                    <div>
                        <p className="font-medium text-amber-800">複数のボタンも設定できます</p>
                        <p className="text-amber-700">1つの画像内に複数のクリック範囲を追加できます。</p>
                    </div>
                </div>
            </div>
        ),
    },
    {
        id: 'tools',
        title: 'Step 4: 見た目を調整する',
        subtitle: '右サイドバーの便利ツール',
        content: (
            <div className="space-y-4">
                <p className="text-sm text-gray-600">右サイドバーから様々な調整ができます。よく使う機能を紹介します。</p>

                {/* ツール一覧 */}
                <div className="space-y-2">
                    <div className="bg-white rounded-xl p-3 border border-gray-200 flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Scissors className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">画像を切り取る</p>
                            <p className="text-xs text-gray-500">余白や不要な部分をカット。上下の余分な空白を削除するのに便利。</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-gray-200 flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <Palette className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">背景色をそろえる</p>
                            <p className="text-xs text-gray-500">複数ブロックの背景色を統一。つなぎ目が自然になります。</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-gray-200 flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <Layers className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">ボタン・文字を重ねる</p>
                            <p className="text-xs text-gray-500">画像の上にボタンやテキストを追加できます。</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-gray-200 flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
                            <Type className="h-4 w-4 text-cyan-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">文章をまとめて書き直す</p>
                            <p className="text-xs text-gray-500">AIがテキストを書き換え。トーンの変更も可能。</p>
                        </div>
                    </div>
                </div>
            </div>
        ),
    },
    {
        id: 'preview',
        title: 'Step 5: プレビューで確認',
        subtitle: '実際の見た目をチェック',
        content: (
            <div className="space-y-5">
                {/* 操作説明 */}
                <div className="bg-cyan-50 rounded-2xl p-4 border border-cyan-100">
                    <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-cyan-500 flex items-center justify-center flex-shrink-0">
                            <Eye className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 text-sm mb-1">「プレビュー」ボタンをクリック</p>
                            <p className="text-xs text-gray-600">新しいタブで実際のページが開きます</p>
                        </div>
                    </div>
                </div>

                {/* 確認ポイント */}
                <div className="bg-gray-100 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">確認ポイント</p>
                    <div className="space-y-2">
                        {[
                            { text: '画像がくっきり表示されているか', emoji: '🖼️' },
                            { text: 'ボタンをクリックしてリンクが動くか', emoji: '👆' },
                            { text: 'スマホで見ても崩れていないか', emoji: '📱' },
                            { text: '読み込み速度は問題ないか', emoji: '⚡' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-200">
                                <span>{item.emoji}</span>
                                <span className="text-sm text-gray-700">{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 完了 */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500 mb-3">
                        <Check className="h-6 w-6 text-white" />
                    </div>
                    <p className="font-bold text-green-800">これでLPの完成です！</p>
                    <p className="text-xs text-green-600 mt-1">プレビューのURLをそのまま公開できます</p>
                </div>
            </div>
        ),
    },
];

export default function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
    const [currentStep, setCurrentStep] = useState(0);

    if (!isOpen) return null;

    const step = tutorialSteps[currentStep];
    const isFirst = currentStep === 0;
    const isLast = currentStep === tutorialSteps.length - 1;

    const handleNext = () => {
        if (isLast) {
            onClose();
            setCurrentStep(0);
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirst) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleClose = () => {
        onClose();
        setCurrentStep(0);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] flex flex-col">
                {/* ヘッダー */}
                <div className="relative p-5 pb-0 flex-shrink-0">
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    {/* ステップインジケーター */}
                    <div className="flex items-center justify-center gap-1.5 mb-4">
                        {tutorialSteps.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentStep(idx)}
                                className={clsx(
                                    "h-1.5 rounded-full transition-all",
                                    idx === currentStep
                                        ? "w-8 bg-gray-900"
                                        : idx < currentStep
                                            ? "w-1.5 bg-green-500"
                                            : "w-1.5 bg-gray-200 hover:bg-gray-300"
                                )}
                            />
                        ))}
                    </div>

                    {/* タイトル */}
                    <div className="text-center mb-4">
                        <h2 className="text-lg font-black text-gray-900">{step.title}</h2>
                        <p className="text-sm text-gray-500">{step.subtitle}</p>
                    </div>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 overflow-y-auto px-5 pb-2">
                    {step.content}
                </div>

                {/* フッター */}
                <div className="p-5 pt-3 flex gap-3 flex-shrink-0 border-t border-gray-100">
                    {!isFirst && (
                        <button
                            onClick={handlePrev}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            戻る
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        className={clsx(
                            "flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-colors",
                            isFirst ? "flex-1" : "flex-[2]",
                            "bg-gray-900 text-white hover:bg-gray-800"
                        )}
                    >
                        {isFirst ? '始める' : isLast ? '閉じる' : '次へ'}
                        {!isLast && <ChevronRight className="h-4 w-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
