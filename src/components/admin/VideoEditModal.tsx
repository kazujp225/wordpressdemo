'use client';

import { useState } from 'react';
import { X, Film, Scissors, Gauge, Palette, Type, Music, Crop, Lock, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Section {
    id: string | number;
    role?: string;
    image?: { filePath: string };
    config?: string | Record<string, any>;
}

interface VideoEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    sections: Section[];
}

const EDIT_TOOLS = [
    { id: 'trim', label: 'トリミング', icon: Scissors, description: '開始・終了時間を指定' },
    { id: 'speed', label: '速度変更', icon: Gauge, description: '0.5x〜2.0x' },
    { id: 'filter', label: 'フィルタ', icon: Palette, description: 'カラーフィルタを適用' },
    { id: 'text', label: 'テキスト挿入', icon: Type, description: '字幕・テロップを追加' },
    { id: 'music', label: 'BGM追加', icon: Music, description: 'バックグラウンド音楽' },
    { id: 'crop', label: 'クロップ', icon: Crop, description: '動画の一部を切り出し' },
] as const;

function getVideoFromConfig(config: string | Record<string, any> | undefined): any | null {
    if (!config) return null;
    try {
        const parsed = typeof config === 'string' ? JSON.parse(config) : config;
        return parsed?.video?.url ? parsed.video : null;
    } catch {
        return null;
    }
}

export default function VideoEditModal({ isOpen, onClose, sections }: VideoEditModalProps) {
    const [selectedSection, setSelectedSection] = useState<string | null>(null);

    const sectionsWithVideo = sections.filter(s => getVideoFromConfig(s.config));

    const selectedVideo = selectedSection
        ? getVideoFromConfig(sections.find(s => String(s.id) === selectedSection)?.config)
        : null;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-black flex items-center justify-center shadow-lg">
                            <Film className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-gray-900">動画を編集</h2>
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded-full">
                                    BETA
                                </span>
                            </div>
                            <p className="text-xs text-gray-500">動画のトリミング・速度変更・フィルタなど</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* 動画セクション選択 */}
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-gray-900 mb-3">編集する動画を選択</h3>
                        {sectionsWithVideo.length === 0 ? (
                            <div className="p-8 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                <Film className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">動画が挿入されたセクションがありません</p>
                                <p className="text-xs text-gray-400 mt-1">先に動画を追加してください</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 gap-2">
                                {sectionsWithVideo.map((section, idx) => {
                                    const video = getVideoFromConfig(section.config);
                                    const isSelected = selectedSection === String(section.id);
                                    return (
                                        <button
                                            key={section.id}
                                            onClick={() => setSelectedSection(String(section.id))}
                                            className={clsx(
                                                "relative rounded-lg overflow-hidden border-2 transition-all",
                                                isSelected
                                                    ? "border-purple-500 ring-2 ring-purple-200"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            {section.image?.filePath ? (
                                                <img
                                                    src={section.image.filePath}
                                                    alt={`Section ${idx + 1}`}
                                                    className="w-full h-16 object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-16 bg-gray-100 flex items-center justify-center">
                                                    <Play className="h-4 w-4 text-gray-400" />
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                                                <span className="text-[10px] text-white truncate">
                                                    {section.role || `Section ${idx + 1}`}
                                                </span>
                                            </div>
                                            {/* 動画タイプバッジ */}
                                            <div className="absolute top-1 right-1">
                                                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-black/70 text-white rounded">
                                                    {video?.type === 'ai-generate' ? 'AI' : video?.type === 'youtube' ? 'YT' : 'MP4'}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 選択中の動画プレビュー */}
                    {selectedVideo && (
                        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">プレビュー</h3>
                            <div className="aspect-video bg-black rounded-lg overflow-hidden">
                                {selectedVideo.type === 'youtube' ? (
                                    <iframe
                                        src={`${selectedVideo.url}?autoplay=0`}
                                        className="w-full h-full"
                                        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <video
                                        src={selectedVideo.url}
                                        controls
                                        className="w-full h-full object-contain"
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* 編集ツール */}
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-gray-900 mb-3">編集ツール</h3>
                        <div className="grid grid-cols-3 gap-3">
                            {EDIT_TOOLS.map(tool => {
                                const Icon = tool.icon;
                                return (
                                    <button
                                        key={tool.id}
                                        onClick={() => toast('この機能は準備中です', { icon: '🔜' })}
                                        className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-left transition-all hover:border-gray-300 hover:bg-gray-100 group relative"
                                    >
                                        <div className="flex items-center gap-3 mb-1">
                                            <Icon className="h-5 w-5 text-gray-400" />
                                            <span className="text-sm font-medium text-gray-500">{tool.label}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 ml-8">{tool.description}</p>
                                        {/* 近日公開バッジ */}
                                        <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-gray-200 rounded text-[9px] font-bold text-gray-500">
                                            <Lock className="h-2.5 w-2.5" />
                                            近日公開
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        disabled
                        className="px-6 py-2 bg-gray-300 text-white text-sm font-bold rounded-lg cursor-not-allowed"
                    >
                        編集を適用
                    </button>
                </div>
            </div>
        </div>
    );
}
