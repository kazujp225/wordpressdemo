'use client';

import { useState } from 'react';
import { X, Video, Upload, Link2, Youtube, PlayCircle, Check, AlertCircle, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Section {
    id: string | number;
    role?: string;
    image?: { filePath: string };
}

interface VideoInsertModalProps {
    isOpen: boolean;
    onClose: () => void;
    sections: Section[];
    onInsert: (sectionId: string, videoData: VideoData) => Promise<void>;
    userPlan?: 'free' | 'premium' | 'max';
}

interface VideoData {
    type: 'upload' | 'youtube' | 'vimeo' | 'embed';
    url: string;
    thumbnailUrl?: string;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    displayMode: 'background' | 'inline' | 'modal';
}

const VIDEO_SOURCES = [
    { id: 'youtube', label: 'YouTube', icon: Youtube, description: 'YouTube動画を埋め込み' },
    { id: 'upload', label: 'アップロード', icon: Upload, description: '動画ファイルをアップロード' },
    { id: 'embed', label: '埋め込みコード', icon: Link2, description: 'iframe埋め込みコード' },
];

const DISPLAY_MODES = [
    { id: 'background', label: '背景動画', description: 'セクションの背景として表示' },
    { id: 'inline', label: 'インライン', description: 'コンテンツ内に埋め込み' },
    { id: 'modal', label: 'モーダル', description: 'クリックでポップアップ表示' },
];

export default function VideoInsertModal({
    isOpen,
    onClose,
    sections,
    onInsert,
    userPlan = 'free'
}: VideoInsertModalProps) {
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [videoSource, setVideoSource] = useState<'youtube' | 'upload' | 'embed'>('youtube');
    const [videoUrl, setVideoUrl] = useState('');
    const [embedCode, setEmbedCode] = useState('');
    const [displayMode, setDisplayMode] = useState<'background' | 'inline' | 'modal'>('inline');
    const [autoplay, setAutoplay] = useState(false);
    const [loop, setLoop] = useState(false);
    const [muted, setMuted] = useState(true);
    const [isInserting, setIsInserting] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    const isMaxPlan = userPlan === 'max';

    const extractYouTubeId = (url: string): string | null => {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/shorts\/([^&\n?#]+)/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    };

    const getYouTubeThumbnail = (videoId: string): string => {
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    };

    const handleInsert = async () => {
        if (!selectedSection) {
            toast.error('セクションを選択してください');
            return;
        }

        if (!isMaxPlan) {
            toast.error('動画挿入機能はMax Planユーザー限定です');
            return;
        }

        let finalUrl = '';
        let thumbnailUrl = '';

        if (videoSource === 'youtube') {
            const videoId = extractYouTubeId(videoUrl);
            if (!videoId) {
                toast.error('有効なYouTube URLを入力してください');
                return;
            }
            finalUrl = `https://www.youtube.com/embed/${videoId}`;
            thumbnailUrl = getYouTubeThumbnail(videoId);
        } else if (videoSource === 'upload') {
            if (!uploadedFile) {
                toast.error('動画ファイルを選択してください');
                return;
            }
            // アップロード処理（実際のAPIを呼び出す）
            toast.error('動画アップロード機能は準備中です');
            return;
        } else if (videoSource === 'embed') {
            if (!embedCode.trim()) {
                toast.error('埋め込みコードを入力してください');
                return;
            }
            // iframeからsrcを抽出
            const srcMatch = embedCode.match(/src=["']([^"']+)["']/);
            if (srcMatch) {
                finalUrl = srcMatch[1];
            } else {
                toast.error('有効な埋め込みコードを入力してください');
                return;
            }
        }

        setIsInserting(true);
        try {
            await onInsert(selectedSection, {
                type: videoSource,
                url: finalUrl,
                thumbnailUrl,
                autoplay,
                loop,
                muted,
                displayMode
            });
            toast.success('動画を挿入しました');
            onClose();
        } catch (error: any) {
            toast.error(error.message || '動画の挿入に失敗しました');
        } finally {
            setIsInserting(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 100 * 1024 * 1024) { // 100MB制限
                toast.error('ファイルサイズは100MB以下にしてください');
                return;
            }
            setUploadedFile(file);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-violet-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                            <Video className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                動画挿入
                                <span className="flex items-center gap-1 text-[9px] px-2 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full font-bold">
                                    <Crown className="h-3 w-3" />
                                    Max限定
                                </span>
                            </h2>
                            <p className="text-xs text-gray-500">LPに動画を追加</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!isMaxPlan ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="h-16 w-16 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 flex items-center justify-center mb-4">
                                <Crown className="h-8 w-8 text-amber-500" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Max Plan限定機能</h3>
                            <p className="text-sm text-gray-500 text-center mb-4">
                                動画挿入機能はMax Planユーザー限定です。<br />
                                アップグレードして全機能を利用しましょう。
                            </p>
                            <button className="px-6 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold rounded-lg hover:from-amber-500 hover:to-orange-600 transition-all">
                                Max Planにアップグレード
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* セクション選択 */}
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-gray-900 mb-3">動画を挿入するセクション</h3>
                                <div className="grid grid-cols-4 gap-2">
                                    {sections.filter(s => s.image).map((section, idx) => (
                                        <button
                                            key={section.id}
                                            onClick={() => setSelectedSection(String(section.id))}
                                            className={clsx(
                                                "relative rounded-lg overflow-hidden border-2 transition-all",
                                                selectedSection === String(section.id)
                                                    ? "border-indigo-500 ring-2 ring-indigo-200"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            <img
                                                src={section.image?.filePath}
                                                alt={`Section ${idx + 1}`}
                                                className="w-full h-16 object-cover"
                                            />
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                                                <span className="text-[10px] text-white truncate">
                                                    {section.role || `Section ${idx + 1}`}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 動画ソース選択 */}
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-gray-900 mb-3">動画ソース</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    {VIDEO_SOURCES.map(source => {
                                        const Icon = source.icon;
                                        return (
                                            <button
                                                key={source.id}
                                                onClick={() => setVideoSource(source.id as any)}
                                                className={clsx(
                                                    "p-3 rounded-xl border-2 text-left transition-all",
                                                    videoSource === source.id
                                                        ? "border-indigo-500 bg-indigo-50"
                                                        : "border-gray-200 hover:border-gray-300"
                                                )}
                                            >
                                                <Icon className="h-5 w-5 text-gray-600 mb-2" />
                                                <p className="text-sm font-medium text-gray-900">{source.label}</p>
                                                <p className="text-xs text-gray-500">{source.description}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 動画入力 */}
                            <div className="mb-6">
                                {videoSource === 'youtube' && (
                                    <div>
                                        <label className="text-sm font-bold text-gray-900 mb-2 block">YouTube URL</label>
                                        <input
                                            type="text"
                                            value={videoUrl}
                                            onChange={(e) => setVideoUrl(e.target.value)}
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                        />
                                        {videoUrl && extractYouTubeId(videoUrl) && (
                                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                                <img
                                                    src={getYouTubeThumbnail(extractYouTubeId(videoUrl)!)}
                                                    alt="Video thumbnail"
                                                    className="w-full h-32 object-cover rounded"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {videoSource === 'upload' && (
                                    <div>
                                        <label className="text-sm font-bold text-gray-900 mb-2 block">動画ファイル</label>
                                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                                            <input
                                                type="file"
                                                accept="video/*"
                                                onChange={handleFileChange}
                                                className="hidden"
                                                id="video-upload"
                                            />
                                            <label htmlFor="video-upload" className="cursor-pointer">
                                                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                                <p className="text-sm text-gray-600">クリックして動画を選択</p>
                                                <p className="text-xs text-gray-400 mt-1">MP4, WebM, MOV (最大100MB)</p>
                                            </label>
                                        </div>
                                        {uploadedFile && (
                                            <p className="mt-2 text-sm text-gray-600">
                                                選択中: {uploadedFile.name}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {videoSource === 'embed' && (
                                    <div>
                                        <label className="text-sm font-bold text-gray-900 mb-2 block">埋め込みコード</label>
                                        <textarea
                                            value={embedCode}
                                            onChange={(e) => setEmbedCode(e.target.value)}
                                            placeholder='<iframe src="..." ...></iframe>'
                                            className="w-full h-24 px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* 表示モード */}
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-gray-900 mb-3">表示モード</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    {DISPLAY_MODES.map(mode => (
                                        <button
                                            key={mode.id}
                                            onClick={() => setDisplayMode(mode.id as any)}
                                            className={clsx(
                                                "p-3 rounded-xl border-2 text-left transition-all",
                                                displayMode === mode.id
                                                    ? "border-indigo-500 bg-indigo-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            <p className="text-sm font-medium text-gray-900">{mode.label}</p>
                                            <p className="text-xs text-gray-500">{mode.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* オプション */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-gray-900">オプション</h3>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoplay}
                                        onChange={(e) => setAutoplay(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                                    />
                                    <span className="text-sm text-gray-700">自動再生</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={loop}
                                        onChange={(e) => setLoop(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                                    />
                                    <span className="text-sm text-gray-700">ループ再生</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={muted}
                                        onChange={(e) => setMuted(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                                    />
                                    <span className="text-sm text-gray-700">ミュート（自動再生時は必須）</span>
                                </label>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {isMaxPlan && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleInsert}
                            disabled={!selectedSection || isInserting}
                            className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-bold rounded-lg hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            {isInserting ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    挿入中...
                                </>
                            ) : (
                                <>
                                    <PlayCircle className="h-4 w-4" />
                                    動画を挿入
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
