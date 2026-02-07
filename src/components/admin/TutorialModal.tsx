'use client';

import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Upload, MousePointer, Sparkles, Eye, Scissors, Type, Layers, ArrowRight, Check, Monitor, Smartphone, Download, Link2, Square, GripVertical, Trash2, Save, Undo2, RefreshCw, Video, Palette, Lightbulb } from 'lucide-react';
import clsx from 'clsx';

interface TutorialModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface TutorialStep {
    id: string;
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    description: string;
    visual: React.ReactNode;
    tip?: string;
}

const tutorialSteps: TutorialStep[] = [
    // 1. イントロ
    {
        id: 'start',
        icon: <Sparkles className="h-6 w-6" />,
        iconBg: 'from-violet-500 to-purple-600',
        title: 'OTASUKE LPへようこそ',
        description: '画像をアップロードするだけで\nそのままWebページとして公開できます。\n基本的な使い方を説明します。',
        visual: (
            <div className="relative">
                <div className="flex items-center justify-center gap-4">
                    <div className="w-16 h-20 bg-gray-200 rounded-lg shadow-sm flex items-center justify-center">
                        <Upload className="h-8 w-8 text-gray-400" />
                    </div>
                    <ArrowRight className="h-6 w-6 text-violet-400" />
                    <div className="w-20 h-24 bg-gradient-to-b from-violet-100 to-white rounded-lg shadow-lg border border-violet-200 flex items-center justify-center">
                        <Eye className="h-8 w-8 text-violet-500" />
                    </div>
                </div>
            </div>
        ),
    },
    // 2. 画像アップロード
    {
        id: 'upload',
        icon: <Upload className="h-6 w-6" />,
        iconBg: 'from-blue-500 to-blue-600',
        title: '画像をアップロード',
        description: '左の画像一覧エリアに\n画像をドラッグ＆ドロップするか、\n「+」ボタンをクリックして選択。',
        visual: (
            <div className="space-y-3">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                        左サイドバーを確認
                    </div>
                    <div className="flex gap-2">
                        <div className="w-16 bg-white rounded-lg border-2 border-dashed border-blue-300 p-2 text-center">
                            <Upload className="h-4 w-4 text-blue-400 mx-auto mb-1" />
                            <span className="text-[8px] text-blue-500">ここにドロップ</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-300 self-center" />
                        <div className="flex-1 bg-white rounded-lg border border-gray-200 p-2">
                            <div className="h-8 bg-gray-100 rounded" />
                        </div>
                    </div>
                </div>
            </div>
        ),
        tip: '複数枚を選択すると自動で縦に並びます',
    },
    // 3. 並び順変更
    {
        id: 'reorder',
        icon: <GripVertical className="h-6 w-6" />,
        iconBg: 'from-indigo-500 to-indigo-600',
        title: '並び順を変更',
        description: '左サイドバーの画像サムネイルを\nドラッグして上下に移動。\n離すと順番が確定します。',
        visual: (
            <div className="space-y-3">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                        左サイドバーでサムネイルを長押し
                    </div>
                    <div className="space-y-1.5">
                        <div className="bg-white rounded-lg p-2 flex items-center gap-2 border-2 border-indigo-400 shadow-md">
                            <GripVertical className="h-4 w-4 text-indigo-500" />
                            <div className="w-8 h-6 bg-indigo-100 rounded" />
                            <span className="text-[9px] text-indigo-600">つかんでドラッグ</span>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 flex items-center gap-2 border border-gray-200 opacity-50">
                            <GripVertical className="h-4 w-4 text-gray-300" />
                            <div className="w-8 h-6 bg-gray-200 rounded" />
                        </div>
                    </div>
                </div>
            </div>
        ),
    },
    // 4. 保存
    {
        id: 'save',
        icon: <Save className="h-6 w-6" />,
        iconBg: 'from-emerald-500 to-green-600',
        title: '保存する',
        description: '画面右上の黒い「保存」ボタンを\nクリックして変更を保存。\n編集したら必ず保存しましょう。',
        visual: (
            <div className="space-y-3">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                        右上のボタンをクリック
                    </div>
                    <div className="bg-white rounded-lg p-2 flex items-center justify-end gap-2 border border-gray-200">
                        <div className="px-2 py-1 bg-gray-100 rounded text-[10px] text-gray-400">HD</div>
                        <div className="px-2 py-1 bg-gray-100 rounded text-[10px] text-gray-400">履歴</div>
                        <div className="px-3 py-1.5 bg-gray-900 text-white rounded text-[10px] font-bold flex items-center gap-1 animate-pulse">
                            <Save className="h-3 w-3" />
                            保存
                        </div>
                    </div>
                </div>
            </div>
        ),
        tip: '保存しないと編集内容が消えてしまいます',
    },
    // 5. HD高画質化
    {
        id: 'hd',
        icon: <span className="text-lg font-black">HD</span>,
        iconBg: 'from-violet-500 to-purple-600',
        title: 'AIで高画質化',
        description: '右上の「HD」ボタンをクリック\n→ サイズを選んで「高画質化を実行」\n→ 30秒〜1分ほど待つと完成',
        visual: (
            <div className="space-y-3">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                        「HD」ボタンをクリック
                    </div>
                    <div className="bg-white rounded-lg p-2 flex items-center justify-center gap-2">
                        <div className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded text-[10px] font-bold border-2 border-violet-400">
                            HD
                        </div>
                        <ArrowRight className="h-3 w-3 text-gray-300" />
                        <div className="px-2 py-1 bg-gray-100 rounded text-[10px] text-gray-500">
                            2K推奨
                        </div>
                    </div>
                </div>
            </div>
        ),
        tip: '2Kサイズがキレイでおすすめです',
    },
    // 6. ボタンにリンク設定
    {
        id: 'cta',
        icon: <MousePointer className="h-6 w-6" />,
        iconBg: 'from-green-500 to-emerald-600',
        title: 'ボタンにリンクを設定',
        description: '右サイドバーの「ボタンのリンク先」\n→ 画像上でドラッグして範囲を選択\n→ URLを入力して「追加」',
        visual: (
            <div className="space-y-2">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="space-y-2 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                            右の「ボタンのリンク先」を開く
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                            画像上でボタン部分をドラッグ
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                            URLを入れて「追加」をクリック
                        </div>
                    </div>
                </div>
            </div>
        ),
        tip: 'tel:電話番号 でスマホから直接発信できます',
    },
    // 7. 画像を切り取る
    {
        id: 'crop',
        icon: <Scissors className="h-6 w-6" />,
        iconBg: 'from-blue-500 to-cyan-600',
        title: '画像を切り取る',
        description: '右サイドバーの「画像を切り取る」\n→ 四隅の丸いハンドルをドラッグ\n→ 「切り取りを適用」で確定',
        visual: (
            <div className="space-y-2">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="space-y-2 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                            「画像を切り取る」を開く
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                            角の丸い点をドラッグして調整
                        </div>
                    </div>
                    <div className="mt-2 h-12 bg-gray-300 rounded-lg relative">
                        <div className="absolute inset-2 border-2 border-dashed border-blue-500 rounded bg-blue-500/10">
                            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-blue-500 rounded-full" />
                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full" />
                            <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-blue-500 rounded-full" />
                            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>
        ),
    },
    // 8. ボタン・文字を重ねる
    {
        id: 'overlay',
        icon: <Layers className="h-6 w-6" />,
        iconBg: 'from-amber-500 to-orange-600',
        title: 'ボタン・文字を重ねる',
        description: '右サイドバーの「ボタン・文字を重ねる」\n→ 「ボタン追加」または「テキスト追加」\n→ 位置やサイズを調整',
        visual: (
            <div className="space-y-2">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="space-y-2 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                            「ボタン・文字を重ねる」を開く
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                            追加したい要素を選択
                        </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                        <div className="flex-1 bg-amber-100 rounded-lg p-2 text-center border border-amber-300">
                            <Square className="h-4 w-4 mx-auto text-amber-600" />
                            <span className="text-[8px] text-amber-700">ボタン</span>
                        </div>
                        <div className="flex-1 bg-orange-100 rounded-lg p-2 text-center border border-orange-300">
                            <Type className="h-4 w-4 mx-auto text-orange-600" />
                            <span className="text-[8px] text-orange-700">テキスト</span>
                        </div>
                    </div>
                </div>
            </div>
        ),
    },
    // 9. 背景色をそろえる
    {
        id: 'bgcolor',
        icon: <Palette className="h-6 w-6" />,
        iconBg: 'from-purple-500 to-pink-600',
        title: '背景色をそろえる',
        description: '右サイドバーの「見た目を調整する」\n→ 「背景色」で色を選択\n→ 全ブロックに同じ色が適用されます',
        visual: (
            <div className="space-y-2">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                        「見た目を調整する」の背景色
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="space-y-1">
                            <div className="h-4 w-12 bg-white rounded" />
                            <div className="h-4 w-12 bg-gray-100 rounded" />
                            <div className="h-4 w-12 bg-gray-200 rounded" />
                        </div>
                        <ArrowRight className="h-4 w-4 text-purple-400" />
                        <div className="space-y-1">
                            <div className="h-4 w-12 bg-white rounded border border-purple-300" />
                            <div className="h-4 w-12 bg-white rounded border border-purple-300" />
                            <div className="h-4 w-12 bg-white rounded border border-purple-300" />
                        </div>
                    </div>
                </div>
            </div>
        ),
    },
    // 10. 色の組み合わせ
    {
        id: 'colorpalette',
        icon: <Palette className="h-6 w-6" />,
        iconBg: 'from-pink-500 to-rose-600',
        title: '色の組み合わせ',
        description: '右サイドバーの「色の組み合わせ」\n→ 好きな色を選択\n→ 「この色で再生成」で反映',
        visual: (
            <div className="space-y-2">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                        色を選んで「この色で再生成」
                    </div>
                    <div className="flex justify-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-rose-500 shadow ring-2 ring-rose-300" />
                        <div className="w-6 h-6 rounded-full bg-amber-500 shadow" />
                        <div className="w-6 h-6 rounded-full bg-emerald-500 shadow" />
                        <div className="w-6 h-6 rounded-full bg-blue-500 shadow" />
                    </div>
                </div>
            </div>
        ),
        tip: 'ブランドカラーに合わせたLP作成に便利',
    },
    // 11. 文章をまとめて書き直す
    {
        id: 'copyedit',
        icon: <Type className="h-6 w-6" />,
        iconBg: 'from-cyan-500 to-teal-600',
        title: '文章をまとめて書き直す',
        description: '右サイドバーの「文章をまとめて書き直す」\n→ 修正したいテキストを編集\n→ 「テキストを差し替え」で反映',
        visual: (
            <div className="space-y-2">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="space-y-2 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                            「文章をまとめて書き直す」を開く
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                            テキストを修正して適用
                        </div>
                    </div>
                    <div className="mt-2 space-y-1">
                        <div className="bg-white rounded p-1.5 text-[10px] text-gray-500 line-through">今すぐ申し込み！</div>
                        <div className="bg-cyan-50 rounded p-1.5 text-[10px] text-cyan-700 border border-cyan-200">お気軽にお問い合わせください</div>
                    </div>
                </div>
            </div>
        ),
    },
    // 12. 動画を埋め込む
    {
        id: 'video',
        icon: <Video className="h-6 w-6" />,
        iconBg: 'from-red-500 to-rose-600',
        title: '動画を埋め込む',
        description: '右サイドバーの「動画を埋め込む」\n→ YouTubeのURLを貼り付け\n→ 「埋め込む」で完了（Max限定）',
        visual: (
            <div className="space-y-2">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                        YouTubeのURLをコピペ
                    </div>
                    <div className="bg-gray-900 rounded-lg p-2 relative">
                        <div className="aspect-video bg-gray-800 rounded flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                                <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-0.5" />
                            </div>
                        </div>
                        <div className="absolute top-1 right-1 bg-gray-700 text-[7px] text-white px-1 rounded">Max限定</div>
                    </div>
                </div>
            </div>
        ),
    },
    // 13. まとめて作り直す
    {
        id: 'batchregenerate',
        icon: <RefreshCw className="h-6 w-6" />,
        iconBg: 'from-orange-500 to-amber-600',
        title: 'まとめて作り直す',
        description: '右サイドバーの「まとめて作り直す」\n→ 作り直したいブロックにチェック\n→ 「選択したブロックを再生成」',
        visual: (
            <div className="space-y-2">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                        チェックを入れて実行
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-orange-500 flex items-center justify-center">
                                <Check className="h-2.5 w-2.5 text-white" />
                            </div>
                            <div className="flex-1 h-6 bg-orange-100 rounded border border-orange-300" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-orange-500 flex items-center justify-center">
                                <Check className="h-2.5 w-2.5 text-white" />
                            </div>
                            <div className="flex-1 h-6 bg-orange-100 rounded border border-orange-300" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border border-gray-300" />
                            <div className="flex-1 h-6 bg-gray-50 rounded" />
                        </div>
                    </div>
                </div>
            </div>
        ),
        tip: 'デザインを一新したい時に便利',
    },
    // 14. 操作をやり直す（履歴）
    {
        id: 'history',
        icon: <Undo2 className="h-6 w-6" />,
        iconBg: 'from-slate-500 to-gray-600',
        title: '操作をやり直す',
        description: '右上の「履歴」ボタンをクリック\n→ 戻りたい時点を選択\n→ 「この状態に戻す」で復元',
        visual: (
            <div className="space-y-2">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                        「履歴」から過去の状態を選択
                    </div>
                    <div className="space-y-1">
                        <div className="bg-white rounded p-1.5 flex items-center gap-2 border border-gray-200">
                            <div className="w-6 h-6 bg-gray-100 rounded" />
                            <div className="text-[9px]">
                                <p className="text-gray-700 font-medium">現在</p>
                                <p className="text-gray-400">たった今</p>
                            </div>
                        </div>
                        <div className="bg-blue-50 rounded p-1.5 flex items-center gap-2 border border-blue-200">
                            <div className="w-6 h-6 bg-blue-100 rounded" />
                            <div className="text-[9px]">
                                <p className="text-blue-700 font-medium">ここに戻す</p>
                                <p className="text-gray-400">5分前</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ),
    },
    // 15. ブロックを削除
    {
        id: 'delete',
        icon: <Trash2 className="h-6 w-6" />,
        iconBg: 'from-red-500 to-rose-600',
        title: 'ブロックを削除',
        description: '右サイドバー最下部の\n「ブロックを削除」をクリック\n→ 確認ダイアログで「削除」',
        visual: (
            <div className="space-y-2">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                        右サイドバーを下にスクロール
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-gray-200">
                        <div className="h-8 mb-2 bg-gray-50 rounded" />
                        <div className="bg-red-50 rounded p-2 text-center border border-red-200">
                            <Trash2 className="h-4 w-4 text-red-500 mx-auto mb-1" />
                            <span className="text-[9px] text-red-600 font-medium">ブロックを削除</span>
                        </div>
                    </div>
                </div>
            </div>
        ),
        tip: '削除すると元に戻せないので注意',
    },
    // 16. プレビューで確認
    {
        id: 'preview',
        icon: <Eye className="h-6 w-6" />,
        iconBg: 'from-sky-500 to-blue-600',
        title: 'プレビューで確認',
        description: '画面中央上のPC/スマホアイコンで\n表示を切り替えられます。\n実際の見た目を確認しましょう。',
        visual: (
            <div className="space-y-2">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                        上部のアイコンで切り替え
                    </div>
                    <div className="bg-white rounded-lg p-2 flex items-center justify-center gap-3 border border-gray-200">
                        <div className="p-1.5 bg-blue-100 rounded border border-blue-300">
                            <Monitor className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="p-1.5 bg-gray-50 rounded">
                            <Smartphone className="h-4 w-4 text-gray-400" />
                        </div>
                    </div>
                </div>
            </div>
        ),
        tip: 'ボタンが正しく動くかも確認しましょう',
    },
    // 17. 公開・ダウンロード
    {
        id: 'publish',
        icon: <Check className="h-6 w-6" />,
        iconBg: 'from-green-500 to-emerald-600',
        title: '公開 or ダウンロード',
        description: '保存後、ページ一覧から\n「プレビュー」でURLを取得、\nまたは「ZIP出力」でダウンロード。',
        visual: (
            <div className="space-y-2">
                <div className="bg-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                        ページ一覧で操作
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-green-50 rounded-lg p-2 text-center border border-green-200">
                            <Eye className="h-4 w-4 text-green-600 mx-auto mb-1" />
                            <span className="text-[9px] text-green-700 font-medium">プレビュー</span>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-200">
                            <Download className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                            <span className="text-[9px] text-blue-700 font-medium">ZIP出力</span>
                        </div>
                    </div>
                </div>
            </div>
        ),
    },
];

export default function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [showMenu, setShowMenu] = useState(false);

    if (!isOpen) return null;

    const step = tutorialSteps[currentStep];
    const isFirst = currentStep === 0;
    const isLast = currentStep === tutorialSteps.length - 1;
    const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

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
        setShowMenu(false);
    };

    const handleSelectStep = (index: number) => {
        setCurrentStep(index);
        setShowMenu(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
                {/* プログレスバー */}
                <div className="h-1 bg-gray-100">
                    <div
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* ヘッダー */}
                <div className="px-6 pt-5 pb-4 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className={clsx(
                            "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg",
                            step.iconBg
                        )}>
                            {step.icon}
                        </div>
                        <div>
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="text-xs text-gray-400 font-medium mb-0.5 hover:text-violet-600 flex items-center gap-1 transition-colors"
                            >
                                {currentStep + 1} / {tutorialSteps.length}
                                <ChevronRight className={clsx("h-3 w-3 transition-transform", showMenu && "rotate-90")} />
                            </button>
                            <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 -mr-2 -mt-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* ステップメニュー */}
                {showMenu && (
                    <div className="px-6 pb-4 -mt-2">
                        <div className="bg-gray-50 rounded-2xl p-3 max-h-60 overflow-y-auto border border-gray-100">
                            <div className="grid grid-cols-2 gap-1.5">
                                {tutorialSteps.map((s, idx) => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleSelectStep(idx)}
                                        className={clsx(
                                            "flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all text-xs",
                                            idx === currentStep
                                                ? "bg-violet-100 text-violet-700 font-medium"
                                                : "hover:bg-white text-gray-600 hover:text-gray-900"
                                        )}
                                    >
                                        <span className={clsx(
                                            "w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                                            idx === currentStep ? "bg-violet-500 text-white" : "bg-gray-200 text-gray-500"
                                        )}>
                                            {idx + 1}
                                        </span>
                                        <span className="truncate">{s.title}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* コンテンツ */}
                <div className="flex-1 overflow-y-auto px-6 pb-4">
                    {/* 説明文 */}
                    <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line mb-5">
                        {step.description}
                    </p>

                    {/* ビジュアル */}
                    <div className="mb-4">
                        {step.visual}
                    </div>

                    {/* ヒント */}
                    {step.tip && (
                        <div className="flex items-start gap-2 text-xs bg-amber-50 rounded-xl p-3 border border-amber-100">
                            <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <span className="text-amber-700 leading-relaxed">{step.tip}</span>
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="px-6 py-4 bg-gray-50 flex gap-3">
                    {!isFirst && (
                        <button
                            onClick={handlePrev}
                            className="flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl text-sm font-semibold bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            戻る
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        className={clsx(
                            "flex-1 flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all",
                            isLast
                                ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-green-500/25"
                                : "bg-gray-900 text-white hover:bg-gray-800"
                        )}
                    >
                        {isFirst ? 'チュートリアルを始める' : isLast ? '完了！閉じる' : '次へ'}
                        {!isLast && <ChevronRight className="h-4 w-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
