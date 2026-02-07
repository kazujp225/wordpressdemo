'use client';

import { useState } from 'react';
import { X, Video, Upload, Link2, Youtube, PlayCircle, Check, AlertCircle, Sparkles, Loader2, DollarSign, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ドラッグ可能なセクションアイテム
function SortableSectionItem({
    section,
    idx,
    isSelected,
    onSelect,
}: {
    section: Section;
    idx: number;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: String(section.id) });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style as React.CSSProperties}
            className={clsx(
                "relative rounded-lg overflow-hidden border-2 transition-all group",
                isSelected
                    ? "border-gray-900 ring-2 ring-gray-200"
                    : "border-gray-200 hover:border-gray-300"
            )}
        >
            {/* ドラッグハンドル */}
            <div
                {...attributes}
                {...listeners}
                className="absolute top-1 left-1 z-10 cursor-grab active:cursor-grabbing bg-white/90 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                title="ドラッグして並び替え"
            >
                <GripVertical className="h-3 w-3 text-gray-500" />
            </div>
            <button
                onClick={onSelect}
                className="w-full h-full"
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
        </div>
    );
}

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
    onReorderSections?: (reorderedSections: Section[]) => void;
}

interface VideoData {
    type: 'upload' | 'youtube' | 'vimeo' | 'embed' | 'ai-generate';
    url: string;
    thumbnailUrl?: string;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    displayMode: 'background' | 'inline' | 'partial';
    // 部分配置用のプロパティ
    x?: number; // パーセント (0-100)
    y?: number; // パーセント (0-100)
    width?: number; // パーセント (10-100)
}

const VIDEO_SOURCES = [
    { id: 'youtube', label: 'YouTube', icon: Youtube, description: 'YouTube動画を埋め込み' },
    { id: 'upload', label: 'アップロード', icon: Upload, description: '動画ファイルをアップロード' },
    { id: 'embed', label: '埋め込みコード', icon: Link2, description: 'iframe埋め込みコード' },
    { id: 'ai-generate', label: '動画生成', icon: Sparkles, description: 'Veo 2で動画を生成' },
];

const DISPLAY_MODES = [
    { id: 'partial', label: '部分配置', description: '好きな位置に配置（ドラッグで移動可）' },
    { id: 'background', label: '背景動画', description: 'セクション全体の背景' },
    { id: 'inline', label: '全体表示', description: 'セクション全体に表示' },
];

export default function VideoInsertModal({
    isOpen,
    onClose,
    sections,
    onInsert,
    onReorderSections,
}: VideoInsertModalProps) {
    // dnd-kit sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // ドラッグ終了時の処理
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id && onReorderSections) {
            const oldIndex = sections.findIndex(s => String(s.id) === active.id);
            const newIndex = sections.findIndex(s => String(s.id) === over?.id);
            const reordered = arrayMove(sections, oldIndex, newIndex);
            onReorderSections(reordered);
        }
    };
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [videoSource, setVideoSource] = useState<'youtube' | 'upload' | 'embed' | 'ai-generate'>('youtube');
    const [videoUrl, setVideoUrl] = useState('');
    const [embedCode, setEmbedCode] = useState('');
    const [displayMode, setDisplayMode] = useState<'background' | 'inline' | 'partial'>('partial');
    const [autoplay, setAutoplay] = useState(false);
    const [loop, setLoop] = useState(false);
    const [muted, setMuted] = useState(true);
    const [isInserting, setIsInserting] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);

    // 部分配置用
    const [videoX, setVideoX] = useState(50); // 中央
    const [videoY, setVideoY] = useState(50); // 中央
    const [videoWidth, setVideoWidth] = useState(40); // 40%

    // AI生成用
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiSourceImage, setAiSourceImage] = useState<string | null>(null);
    const [aiDuration, setAiDuration] = useState<5 | 10>(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

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

    // 動画ファイルアップロード処理
    const handleUploadVideo = async () => {
        if (!uploadedFile) {
            toast.error('動画ファイルを選択してください');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', uploadedFile);

            const response = await fetch('/api/upload/video', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'アップロードに失敗しました');
            }

            const data = await response.json();
            setUploadedVideoUrl(data.video.url);
            setUploadProgress(100);
            toast.success('アップロードが完了しました');

        } catch (error: any) {
            toast.error(error.message || '動画のアップロードに失敗しました');
        } finally {
            setIsUploading(false);
        }
    };

    // AI動画生成処理
    const handleGenerateVideo = async () => {
        if (!aiPrompt.trim()) {
            toast.error('プロンプトを入力してください');
            return;
        }

        setIsGenerating(true);

        try {
            const response = await fetch('/api/ai/generate-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: aiPrompt,
                    sourceImageUrl: aiSourceImage,
                    duration: aiDuration,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'AI動画生成に失敗しました');
            }

            const data = await response.json();
            setGeneratedVideoUrl(data.videoUrl);
            toast.success('AI動画を生成しました');

        } catch (error: any) {
            toast.error(error.message || 'AI動画生成に失敗しました');
        } finally {
            setIsGenerating(false);
        }
    };

    // 選択中のセクションの画像をAI生成のソースに設定
    const useSelectedSectionImage = () => {
        if (selectedSection) {
            const section = sections.find(s => String(s.id) === selectedSection);
            if (section?.image?.filePath) {
                setAiSourceImage(section.image.filePath);
                toast.success('セクション画像を参照に設定しました');
            }
        }
    };

    const handleInsert = async () => {
        if (!selectedSection) {
            toast.error('セクションを選択してください');
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
            if (!uploadedVideoUrl) {
                toast.error('動画をアップロードしてください');
                return;
            }
            finalUrl = uploadedVideoUrl;
        } else if (videoSource === 'embed') {
            if (!embedCode.trim()) {
                toast.error('埋め込みコードを入力してください');
                return;
            }
            const srcMatch = embedCode.match(/src=["']([^"']+)["']/);
            if (srcMatch) {
                finalUrl = srcMatch[1];
            } else {
                toast.error('有効な埋め込みコードを入力してください');
                return;
            }
        } else if (videoSource === 'ai-generate') {
            if (!generatedVideoUrl) {
                toast.error('動画を生成してください');
                return;
            }
            finalUrl = generatedVideoUrl;
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
                displayMode,
                // 部分配置の場合は位置とサイズを含める
                ...(displayMode === 'partial' ? {
                    x: videoX,
                    y: videoY,
                    width: videoWidth,
                } : {})
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
            if (file.size > 100 * 1024 * 1024) {
                toast.error('ファイルサイズは100MB以下にしてください');
                return;
            }
            setUploadedFile(file);
            setUploadedVideoUrl(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-black flex items-center justify-center shadow-lg">
                            <Video className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">動画挿入</h2>
                            <p className="text-xs text-gray-500">LPに動画を追加</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* セクション選択 */}
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-gray-900 mb-3">動画を挿入するセクション</h3>
                        <p className="text-xs text-gray-500 mb-2">ドラッグ＆ドロップで並び替えできます</p>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={sections.filter(s => s.image).map(s => String(s.id))}
                                strategy={rectSortingStrategy}
                            >
                                <div className="grid grid-cols-4 gap-2">
                                    {sections.filter(s => s.image).map((section, idx) => (
                                        <SortableSectionItem
                                            key={section.id}
                                            section={section}
                                            idx={idx}
                                            isSelected={selectedSection === String(section.id)}
                                            onSelect={() => setSelectedSection(String(section.id))}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>

                    {/* 動画ソース選択 */}
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-gray-900 mb-3">動画ソース</h3>
                        <div className="grid grid-cols-4 gap-2">
                            {VIDEO_SOURCES.map(source => {
                                const Icon = source.icon;
                                return (
                                    <button
                                        key={source.id}
                                        onClick={() => setVideoSource(source.id as any)}
                                        className={clsx(
                                            "p-3 rounded-xl border-2 text-left transition-all",
                                            videoSource === source.id
                                                ? "border-gray-900 bg-gray-50"
                                                : "border-gray-200 hover:border-gray-300",
                                            source.id === 'ai-generate' && "border-gray-200 hover:border-gray-300",
                                            source.id === 'ai-generate' && videoSource === source.id && "border-gray-900 bg-gray-50"
                                        )}
                                    >
                                        <Icon className={clsx(
                                            "h-5 w-5 mb-2",
                                            source.id === 'ai-generate' ? "text-gray-900" : "text-gray-600"
                                        )} />
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
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
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
                                    <div className="mt-3">
                                        <p className="text-sm text-gray-600 mb-2">
                                            選択中: {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(1)}MB)
                                        </p>
                                        {!uploadedVideoUrl ? (
                                            <button
                                                onClick={handleUploadVideo}
                                                disabled={isUploading}
                                                className="px-4 py-2 bg-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {isUploading ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        アップロード中...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="h-4 w-4" />
                                                        アップロード
                                                    </>
                                                )}
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-2 text-green-600">
                                                <Check className="h-4 w-4" />
                                                <span className="text-sm font-medium">アップロード完了</span>
                                            </div>
                                        )}
                                    </div>
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
                                    className="w-full h-24 px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
                                />
                            </div>
                        )}

                        {videoSource === 'ai-generate' && (
                            <div className="space-y-4">
                                {/* クレジット消費目安 */}
                                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-indigo-600" />
                                        <span className="text-xs font-bold text-indigo-800">
                                            消費クレジット: 約{(aiDuration * 3500).toLocaleString()}クレジット
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-indigo-600 mt-1 ml-6">
                                        Veo 2: {aiDuration}秒 × 3,500クレジット/秒
                                    </p>
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-gray-900 mb-2 block">プロンプト</label>
                                    <textarea
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        placeholder="例: 青い空の下、波が静かに打ち寄せるビーチの風景。カメラはゆっくりと右にパンする。"
                                        className="w-full h-24 px-4 py-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-gray-900 mb-2 block">参照画像（オプション）</label>
                                    <div className="flex items-center gap-3">
                                        {selectedSection && (
                                            <button
                                                onClick={useSelectedSectionImage}
                                                className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                                            >
                                                選択中のセクション画像を使用
                                            </button>
                                        )}
                                        {aiSourceImage && (
                                            <div className="flex items-center gap-2">
                                                <img src={aiSourceImage} alt="Source" className="h-10 w-16 object-cover rounded" />
                                                <button
                                                    onClick={() => setAiSourceImage(null)}
                                                    className="text-gray-400 hover:text-red-500"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">画像を参照すると、その画像に基づいた動画が生成されます（Image-to-Video）</p>
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-gray-900 mb-2 block">動画の長さ</label>
                                    <div className="flex gap-2">
                                        {[5, 10].map(d => (
                                            <button
                                                key={d}
                                                onClick={() => setAiDuration(d as 5 | 10)}
                                                className={clsx(
                                                    "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                                    aiDuration === d
                                                        ? "bg-black text-white"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                )}
                                            >
                                                {d}秒
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleGenerateVideo}
                                    disabled={!aiPrompt.trim() || isGenerating}
                                    className="w-full py-3 bg-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            生成中...（約30秒〜1分）
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4" />
                                            AI動画を生成
                                        </>
                                    )}
                                </button>

                                {generatedVideoUrl && (
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                        <div className="flex items-center gap-2 text-gray-700 mb-2">
                                            <Check className="h-4 w-4" />
                                            <span className="text-sm font-bold">生成完了</span>
                                        </div>
                                        <video
                                            src={generatedVideoUrl}
                                            controls
                                            className="w-full rounded-lg"
                                        />
                                    </div>
                                )}
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
                                            ? "border-gray-900 bg-gray-50"
                                            : "border-gray-200 hover:border-gray-300"
                                    )}
                                >
                                    <p className="text-sm font-medium text-gray-900">{mode.label}</p>
                                    <p className="text-xs text-gray-500">{mode.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 部分配置の設定 */}
                    {displayMode === 'partial' && (
                        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">配置設定</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-gray-600 mb-1 block">横位置: {videoX}%</label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="90"
                                        value={videoX}
                                        onChange={(e) => setVideoX(Number(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-600 mb-1 block">縦位置: {videoY}%</label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="90"
                                        value={videoY}
                                        onChange={(e) => setVideoY(Number(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-600 mb-1 block">サイズ: {videoWidth}%</label>
                                    <input
                                        type="range"
                                        min="20"
                                        max="80"
                                        value={videoWidth}
                                        onChange={(e) => setVideoWidth(Number(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-3">※ 挿入後、ドラッグで位置を調整できます</p>
                        </div>
                    )}

                    {/* オプション */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-900">オプション</h3>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoplay}
                                onChange={(e) => setAutoplay(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-black focus:ring-gray-500"
                            />
                            <span className="text-sm text-gray-700">自動再生</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={loop}
                                onChange={(e) => setLoop(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-black focus:ring-gray-500"
                            />
                            <span className="text-sm text-gray-700">ループ再生</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={muted}
                                onChange={(e) => setMuted(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-black focus:ring-gray-500"
                            />
                            <span className="text-sm text-gray-700">ミュート（自動再生時は必須）</span>
                        </label>
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
                        onClick={handleInsert}
                        disabled={!selectedSection || isInserting}
                        className="px-6 py-2 bg-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {isInserting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
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
            </div>
        </div>
    );
}
