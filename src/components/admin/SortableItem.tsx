"use client";

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, X, Upload, Sparkles, RefreshCw, Sun, Contrast, Droplet, Palette, Save, ShieldCheck, Target, Info, AlertTriangle, CheckCircle, MessageSquare, Send, Check } from 'lucide-react';
import Image from 'next/image';

interface SortableItemProps {
    id: string;
    file?: File;
    imageUrl?: string;
    role: string;
    config: any;
    onRoleChange: (id: string, role: string) => void;
    onConfigChange: (id: string, config: any) => void;
    onRemove: (id: string) => void;
    onImageChange: (id: string) => void;
    onAIImage: (id: string) => void;
    onSaveSection?: (id: string) => void;
    onReviewSection?: (id: string) => void;
    onChatEdit?: (id: string, message: string) => Promise<any>;
    isSaving?: boolean;
    isReviewing?: boolean;
    isChatting?: boolean;
    reviewResult?: {
        status: string;
        count: number;
        messages: string[];
        scores?: { legal: number; brand: number; ux: number };
        direction?: string;
    } | null;
}

export function SortableItem(props: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: props.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const [preview, setPreview] = React.useState<string | null>(null);

    const [chatMessage, setChatMessage] = React.useState('');
    const [chatResult, setChatResult] = React.useState<any>(null);

    React.useEffect(() => {
        let url: string | null = null;
        if (props.file) {
            url = URL.createObjectURL(props.file);
            setPreview(url);
        } else if (props.imageUrl) {
            setPreview(props.imageUrl);
        }
        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [props.file, props.imageUrl]);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="mb-8 flex flex-col gap-4 rounded-xl border bg-white p-6 shadow-md transition-all hover:shadow-lg"
        >
            <div className="flex items-center gap-4">
                <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
                    <GripVertical className="h-6 w-6" />
                </div>

                <div className="relative group/img h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border bg-gray-50 shadow-inner">
                    {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="Preview" className="h-full w-full object-cover transition-transform group-hover/img:scale-110" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400"><span>画像なし</span></div>
                    )}

                    {/* 画像ホバー時のアクション */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                        <button
                            onClick={() => props.onImageChange(props.id)}
                            className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                            title="画像を変更"
                        >
                            <Upload className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => props.onAIImage(props.id)}
                            className="p-1.5 rounded-full bg-blue-500/80 hover:bg-blue-500 text-white transition-colors"
                            title="AIで新しく生成"
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400"><span>セクションの役割</span></label>
                    <div className="relative">
                        <select
                            value={props.role}
                            onChange={(e) => props.onRoleChange(props.id, e.target.value)}
                            className="w-full appearance-none rounded-xl border border-gray-100 bg-gray-50 pl-4 pr-10 py-2.5 text-sm font-bold text-gray-700 transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none cursor-pointer"
                        >
                            <option value="hero">メイン画像 (最上部)</option>
                            <option value="problem">お悩み・導入</option>
                            <option value="solution">解決策・製品紹介</option>
                            <option value="pricing">料金表</option>
                            <option value="faq">よくある質問</option>
                            <option value="testimony">お客様の声</option>
                            <option value="footer">フッター</option>
                            <option value="other">その他</option>
                        </select>
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <RefreshCw className="h-3 w-3 rotate-90" />
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => props.onRemove(props.id)}
                    className="rounded-full p-2 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                    <Trash2 className="h-5 w-5" />
                </button>
            </div>

            {/* テキスト埋め込み設定 */}
            <div className="mt-2 rounded-lg bg-zinc-50 p-4 border border-zinc-100 relative group/texts">
                <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500"><span>テキスト埋め込み設定</span></h4>
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <label className="block text-[10px] font-bold uppercase text-zinc-400"><span>埋め込むテキスト</span></label>
                            <button
                                onClick={() => props.onAIImage(props.id)}
                                className="flex items-center gap-1 text-[9px] font-black text-blue-500 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full transition-all border border-blue-100"
                                title="このテキストに合う画像を生成"
                            >
                                <Sparkles className="h-2.5 w-2.5" />
                                <span>画像生成</span>
                            </button>
                            <div className="flex-1" />
                            <div className="flex items-center gap-1.5">
                                <MessageSquare className="h-3 w-3 text-indigo-400" />
                                <input
                                    type="text"
                                    value={chatMessage}
                                    onChange={(e) => setChatMessage(e.target.value)}
                                    onKeyDown={async (e) => {
                                        if (e.key === 'Enter' && chatMessage && props.onChatEdit) {
                                            const res = await props.onChatEdit(props.id, chatMessage);
                                            setChatResult(res);
                                            setChatMessage('');
                                        }
                                    }}
                                    placeholder="AIに修正を指示（例: もっと情熱的に）"
                                    className="bg-indigo-50/50 border border-indigo-100 rounded-full px-4 py-1 text-[11px] font-medium text-indigo-900 outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all w-64 shadow-inner"
                                />
                                <button
                                    onClick={async () => {
                                        if (chatMessage && props.onChatEdit) {
                                            const res = await props.onChatEdit(props.id, chatMessage);
                                            setChatResult(res);
                                            setChatMessage('');
                                        }
                                    }}
                                    disabled={!chatMessage || props.isChatting}
                                    className="rounded-full bg-indigo-600 p-1.5 text-white shadow-lg shadow-indigo-100 transition-all active:scale-90 disabled:opacity-30"
                                >
                                    {props.isChatting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                                </button>
                            </div>
                        </div>

                        {/* AIチャット提案の表示 */}
                        {chatResult && (
                            <div className="mb-4 rounded-2xl bg-indigo-600 p-4 text-white shadow-xl animate-in zoom-in duration-300">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded bg-white/20 p-1">
                                            <Sparkles className="h-3 w-3" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest"><span>AIディレクターの提案</span></span>
                                    </div>
                                    <button onClick={() => setChatResult(null)} className="text-white/50 hover:text-white"><X className="h-3 w-3" /></button>
                                </div>
                                <p className="text-sm font-bold leading-relaxed mb-4"><span>{chatResult.revisedText}</span></p>
                                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                                    <div className="text-[10px] text-white/70 italic flex items-center gap-1">
                                        <Info className="h-3 w-3" />
                                        <span>{chatResult.reason}</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            props.onConfigChange(props.id, { text: chatResult.revisedText });
                                            setChatResult(null);
                                        }}
                                        className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-1.5 text-[11px] font-black text-indigo-600 shadow-xl transition-all hover:scale-105 active:scale-95"
                                    >
                                        <Check className="h-3 w-3" />
                                        <span>この案を採用</span>
                                    </button>
                                </div>
                            </div>
                        )}
                        <textarea
                            value={props.config?.text || ''}
                            onChange={(e) => props.onConfigChange(props.id, { text: e.target.value })}
                            placeholder="ここに文字を入力してください（パワポのように画像上に表示されます）"
                            className="w-full min-h-[80px] rounded border border-zinc-200 bg-white p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400"><span>テキストの色</span></label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => props.onConfigChange(props.id, { textColor: 'white' })}
                                    className={`h-8 flex-1 rounded border text-xs font-medium transition-all ${props.config?.textColor === 'white' || !props.config?.textColor ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-500/20' : 'border-zinc-200 bg-white text-zinc-600'}`}
                                >
                                    <span>白</span>
                                </button>
                                <button
                                    onClick={() => props.onConfigChange(props.id, { textColor: 'black' })}
                                    className={`h-8 flex-1 rounded border text-xs font-medium transition-all ${props.config?.textColor === 'black' ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-500/20' : 'border-zinc-200 bg-white text-zinc-600'}`}
                                >
                                    <span>黒</span>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-400"><span>表示位置</span></label>
                            <div className="grid grid-cols-3 gap-1">
                                {['top', 'middle', 'bottom'].map((pos) => (
                                    <button
                                        key={pos}
                                        onClick={() => props.onConfigChange(props.id, { position: pos })}
                                        className={`h-8 rounded border text-[10px] font-bold uppercase transition-all ${props.config?.position === pos || (!props.config?.position && pos === 'middle') ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-500/20' : 'border-zinc-200 bg-white text-zinc-400'}`}
                                    >
                                        <span>{pos === 'top' ? '上' : pos === 'middle' ? '中' : '下'}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* ビジュアル調整セクション */}
            <div className="mt-4 rounded-lg bg-indigo-50/50 p-4 border border-indigo-100">
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-indigo-500" />
                        <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600"><span>ビジュアル調整（無料）</span></h4>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-bold uppercase text-indigo-400 flex items-center gap-1.5">
                                    <Sun className="h-3 w-3" /> <span>明るさ</span>
                                </label>
                                <span className="text-[10px] font-black text-indigo-600"><span>{props.config?.brightness || 100}%</span></span>
                            </div>
                            <input
                                type="range" min="50" max="150" value={props.config?.brightness || 100}
                                onChange={(e) => props.onConfigChange(props.id, { brightness: parseInt(e.target.value) })}
                                className="w-full h-1.5 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-bold uppercase text-indigo-400"><span>白黒化</span></label>
                                <span className="text-[10px] font-black text-indigo-600"><span>{props.config?.grayscale || 0}%</span></span>
                            </div>
                            <input
                                type="range" min="0" max="100" value={props.config?.grayscale || 0}
                                onChange={(e) => props.onConfigChange(props.id, { grayscale: parseInt(e.target.value) })}
                                className="w-full h-1.5 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase text-indigo-400"><span>オーバーレイの色</span></label>
                            <div className="flex gap-1.5 flex-wrap">
                                {['transparent', 'black', 'white', '#1e3a8a', '#1e1b4b'].map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => props.onConfigChange(props.id, { overlayColor: color })}
                                        className={`h-6 w-6 rounded-full border shadow-sm transition-transform hover:scale-125 ${props.config?.overlayColor === color ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                        style={{ backgroundColor: color === 'transparent' ? 'white' : color, backgroundImage: color === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)' : 'none', backgroundSize: '4px 4px', backgroundPosition: '0 0, 2px 2px' }}
                                    />
                                ))}
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-bold uppercase text-indigo-400"><span>色の濃さ</span></label>
                                <span className="text-[10px] font-black text-indigo-600"><span>{props.config?.overlayOpacity || 0}%</span></span>
                            </div>
                            <input
                                type="range" min="0" max="90" value={props.config?.overlayOpacity || 0}
                                onChange={(e) => props.onConfigChange(props.id, { overlayOpacity: parseInt(e.target.value) })}
                                className="w-full h-1.5 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* AIディレクター・コントロール (DSL & Review) */}
            <div className="mt-4 rounded-[2rem] bg-indigo-50/30 p-6 border border-indigo-100/50">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-indigo-600 p-1.5 text-white">
                            <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-900"><span>AIディレクター：品質保証</span></h4>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-tight"><span>AI Director & Quality Guard</span></p>
                        </div>
                    </div>
                    <button
                        onClick={() => props.onReviewSection?.(props.id)}
                        disabled={props.isReviewing}
                        className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[10px] font-black text-indigo-600 shadow-sm hover:shadow-md transition-all border border-indigo-100 disabled:opacity-50"
                    >
                        {props.isReviewing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                        <span>AIレビュー（赤入れ）を実行</span>
                    </button>
                </div>

                {/* レビュー結果の表示 */}
                {props.reviewResult && (
                    <div className={`mb-4 rounded-2xl p-6 shadow-sm border ${props.reviewResult.status === 'danger' ? 'bg-red-50 text-red-700 border-red-100' :
                        props.reviewResult.status === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                {props.reviewResult.status === 'danger' ? <AlertTriangle className="h-5 w-5" /> :
                                    props.reviewResult.status === 'warning' ? <Info className="h-5 w-5" /> :
                                        <CheckCircle className="h-5 w-5" />}
                                <span className="text-sm font-black uppercase tracking-tight"><span>AIディレクター判定: {
                                    props.reviewResult.status === 'danger' ? 'リスク検出' :
                                        props.reviewResult.status === 'warning' ? '改善推奨' : '品質クリア'
                                }</span></span>
                            </div>
                            <div className="text-[10px] font-black bg-white/50 px-3 py-1 rounded-full border border-current opacity-50">
                                <span>指摘 {props.reviewResult.count}点</span>
                            </div>
                        </div>

                        {/* スコア表示 */}
                        {props.reviewResult.scores && (
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {[
                                    { label: '法務', score: props.reviewResult.scores.legal, color: 'current' },
                                    { label: 'ブランド', score: props.reviewResult.scores.brand, color: 'current' },
                                    { label: 'UX', score: props.reviewResult.scores.ux, color: 'current' }
                                ].map((s, i) => (
                                    <div key={i} className="bg-white/40 rounded-xl p-2 text-center border border-current/5">
                                        <div className="text-[9px] font-black uppercase opacity-60 mb-1"><span>{s.label}</span></div>
                                        <div className="text-lg font-black leading-none"><span>{s.score}</span></div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-3">
                            {props.reviewResult.direction && (
                                <p className="text-[11px] font-black italic bg-white/30 p-2 rounded-lg border border-current/10">
                                    <span>ディレクション: {props.reviewResult.direction}</span>
                                </p>
                            )}
                            <ul className="space-y-1.5">
                                {props.reviewResult.messages?.map((m, i) => (
                                    <li key={i} className="flex gap-2 text-[11px] leading-relaxed">
                                        <span className="shrink-0 mt-1.5 h-1 w-1 rounded-full bg-current" />
                                        <span>{m}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-indigo-400 tracking-widest"><span>トーンの指定</span></label>
                        <div className="flex flex-wrap gap-2">
                            {['Professional', 'Pop', 'Luxury', 'Impact'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => props.onConfigChange(props.id, { dsl: { ...props.config?.dsl, tone: t } })}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${props.config?.dsl?.tone === t ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-indigo-400 border border-indigo-50 hover:border-indigo-200'}`}
                                >
                                    <span>{t}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-indigo-400 tracking-widest"><span>業界・法務プリセット</span></label>
                        <select
                            value={props.config?.dsl?.preset || ''}
                            onChange={(e) => props.onConfigChange(props.id, { dsl: { ...props.config?.dsl, preset: e.target.value } })}
                            className="w-full bg-white border border-indigo-50 rounded-xl px-3 py-2 text-[10px] font-bold text-indigo-900 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none"
                        >
                            <option value="">指定なし（一般）</option>
                            <option value="legal">薬機法・景表法重視</option>
                            <option value="b2b">B2B・誠実性重視</option>
                            <option value="lp">CVR特化型</option>
                        </select>
                    </div>
                </div>

                {/* 詳細設定 (Advanced) - 必要時のみ開く */}
                <details className="mt-4 group">
                    <summary className="text-[9px] font-black uppercase text-indigo-300 cursor-pointer hover:text-indigo-500 list-none flex items-center gap-1 group-open:mb-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-200 transition-all group-open:bg-indigo-500" />
                        <span>高度な設計データ (Raw DSL)</span>
                    </summary>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-1">
                            <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-indigo-400"><span>戦略意図</span></label>
                            <textarea
                                value={props.config?.dsl?.strategy_intent || ''}
                                placeholder="このセクションの狙い..."
                                onChange={(e) => props.onConfigChange(props.id, { dsl: { ...props.config?.dsl, strategy_intent: e.target.value } })}
                                className="w-full text-[10px] h-16 bg-white/50 border border-indigo-50 rounded-xl p-3 focus:bg-white outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-indigo-400"><span>制約/ベネフィット</span></label>
                            <textarea
                                value={props.config?.dsl?.constraints || ''}
                                onChange={(e) => props.onConfigChange(props.id, { dsl: { ...props.config?.dsl, constraints: e.target.value } })}
                                className="w-full text-[10px] h-16 bg-white/50 border border-indigo-50 rounded-xl p-3 focus:bg-white outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-indigo-400"><span>画像意図</span></label>
                            <textarea
                                value={props.config?.dsl?.image_intent || ''}
                                onChange={(e) => props.onConfigChange(props.id, { dsl: { ...props.config?.dsl, image_intent: e.target.value } })}
                                className="w-full text-[10px] h-16 bg-white/50 border border-indigo-50 rounded-xl p-3 focus:bg-white outline-none transition-all"
                            />
                        </div>
                    </div>
                </details>
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={() => props.onSaveSection?.(props.id)}
                    disabled={props.isSaving}
                    className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-[10px] font-black text-white hover:bg-black transition-all disabled:opacity-50"
                >
                    {props.isSaving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    <span>このセクションのみ保存</span>
                </button>
            </div>
        </div>
    );
}
