'use client';

import { useState, useRef } from 'react';
import { Timeline } from '@xzdarcy/react-timeline-editor';
import type { TimelineRow, TimelineAction, TimelineEffect } from '@xzdarcy/timeline-engine';
import type { TimelineState } from '@xzdarcy/react-timeline-editor';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';
import {
    Film, Scissors, Gauge, Palette, Type, Music, Crop, Lock,
    Play, Pause, SkipBack, SkipForward, ImagePlus,
    Upload, Plus, Volume2, VolumeX, Video, Trash2,
    ZoomIn, ZoomOut, MousePointer, Download, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ================================
// Types
// ================================
type ToolId = 'select' | 'image-to-video' | 'trim' | 'speed' | 'filter' | 'text' | 'music' | 'crop';
type LeftTab = 'media' | 'text' | 'audio';

interface MediaItem {
    id: string;
    type: 'video' | 'image' | 'audio';
    name: string;
    url: string;
    thumbnailUrl?: string;
    duration?: number;
}

// ================================
// Constants
// ================================
const HEADER_TOOLS = [
    { id: 'select' as const, label: '選択', icon: MousePointer, available: true },
    { id: 'trim' as const, label: 'カット', icon: Scissors, available: false },
    { id: 'speed' as const, label: '速度', icon: Gauge, available: false },
    { id: 'text' as const, label: 'テキスト', icon: Type, available: false },
    { id: 'filter' as const, label: 'フィルタ', icon: Palette, available: false },
    { id: 'crop' as const, label: 'クロップ', icon: Crop, available: false },
] as const;

const ASPECT_RATIOS = [
    { id: '9:16', label: '9:16', description: 'TikTok' },
    { id: '16:9', label: '16:9', description: 'YouTube' },
    { id: '1:1', label: '1:1', description: 'Instagram' },
] as const;

const LEFT_TABS = [
    { id: 'media' as const, label: 'メディア', icon: Video },
    { id: 'text' as const, label: 'テキスト', icon: Type },
    { id: 'audio' as const, label: 'オーディオ', icon: Music },
] as const;

const effects: Record<string, TimelineEffect> = {
    videoEffect: { id: 'videoEffect', name: 'Video' },
    imageEffect: { id: 'imageEffect', name: 'Image' },
    textEffect: { id: 'textEffect', name: 'Text' },
    audioEffect: { id: 'audioEffect', name: 'Audio' },
};

const initialEditorData: TimelineRow[] = [
    { id: 'track-video', actions: [] },
    { id: 'track-text', actions: [] },
    { id: 'track-audio', actions: [] },
];

const TRACK_LABELS: Record<string, { label: string; icon: any; color: string }> = {
    'track-video': { label: '動画', icon: Video, color: 'bg-primary' },
    'track-text': { label: 'テキスト', icon: Type, color: 'bg-blue-400' },
    'track-audio': { label: 'BGM', icon: Music, color: 'bg-emerald-500' },
};

// ================================
// Component
// ================================
export default function VideoEditPage() {
    const [activeTool, setActiveTool] = useState<ToolId>('select');
    const [leftTab, setLeftTab] = useState<LeftTab>('media');
    const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration] = useState(30);
    const [isMuted, setIsMuted] = useState(false);
    const [scaleWidth, setScaleWidth] = useState(160);
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [editorData, setEditorData] = useState<TimelineRow[]>(initialEditorData);
    const [selectedAction, setSelectedAction] = useState<string | null>(null);
    const timelineRef = useRef<TimelineState>(null);

    const getPreviewStyle = (): React.CSSProperties => {
        if (aspectRatio === '9:16') return { aspectRatio: '9/16', maxHeight: '100%', width: 'auto' };
        if (aspectRatio === '1:1') return { aspectRatio: '1/1', maxHeight: '100%', width: 'auto' };
        return { aspectRatio: '16/9', width: '100%', maxHeight: '100%' };
    };

    const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        Array.from(files).forEach(file => {
            const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const url = URL.createObjectURL(file);
            const isVideo = file.type.startsWith('video/');
            const isImage = file.type.startsWith('image/');
            setMediaItems(prev => [...prev, {
                id,
                type: isVideo ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image',
                name: file.name,
                url,
                thumbnailUrl: isImage ? url : undefined,
                duration: isVideo ? 8 : isImage ? 5 : undefined,
            }]);
        });
        e.target.value = '';
    };

    const removeMedia = (id: string) => {
        setMediaItems(prev => prev.filter(m => m.id !== id));
    };

    const addToTimeline = (item: MediaItem) => {
        const trackId = item.type === 'audio' ? 'track-audio' : 'track-video';
        const effectId = item.type === 'audio' ? 'audioEffect' : item.type === 'image' ? 'imageEffect' : 'videoEffect';
        const track = editorData.find(r => r.id === trackId);
        const lastEnd = track?.actions.reduce((max: number, a: TimelineAction) => Math.max(max, a.end), 0) || 0;
        const newAction: TimelineAction = {
            id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            start: lastEnd,
            end: lastEnd + (item.duration || 5),
            effectId,
        };
        setEditorData(prev => prev.map(row =>
            row.id === trackId ? { ...row, actions: [...row.actions, newAction] } : row
        ));
        toast.success(`タイムラインに追加`);
    };

    const togglePlay = () => {
        if (isPlaying) timelineRef.current?.pause();
        else timelineRef.current?.play({ autoEnd: true });
        setIsPlaying(!isPlaying);
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        const f = Math.floor((s % 1) * 30); // 30fps frame count
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
    };

    const getActionRender = (action: TimelineAction, row: TimelineRow) => {
        const info = TRACK_LABELS[row.id];
        const isSelected = selectedAction === action.id;
        return (
            <div
                onClick={() => setSelectedAction(action.id)}
                className={clsx(
                    "h-full rounded flex items-center px-2 text-[10px] font-medium text-white truncate cursor-pointer transition-all",
                    info?.color || 'bg-gray-400',
                    isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                )}
            >
                {action.effectId === 'textEffect' ? 'テキスト' :
                 action.effectId === 'audioEffect' ? 'BGM' : 'クリップ'}
            </div>
        );
    };

    const hasClips = editorData.some(row => row.actions.length > 0);

    return (
        <div className="flex flex-col h-[calc(100vh-1px)] bg-background text-foreground select-none">
            {/* ======== Header: ロゴ + ツールバー + アスペクト比 + エクスポート ======== */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0">
                {/* ロゴ */}
                <div className="flex items-center gap-2 pr-3 border-r mr-1">
                    <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
                        <Film className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                    <span className="text-xs font-bold">Video Studio</span>
                    <span className="px-1 py-0.5 text-[8px] font-bold bg-primary/10 text-primary rounded">BETA</span>
                </div>

                {/* ツールバー */}
                <div className="flex items-center gap-0.5">
                    {HEADER_TOOLS.map(tool => {
                        const Icon = tool.icon;
                        const isActive = activeTool === tool.id;
                        return (
                            <button
                                key={tool.id}
                                onClick={() => tool.available ? setActiveTool(tool.id) : toast('準備中です', { icon: '🔜' })}
                                className={clsx(
                                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all",
                                    tool.available && isActive
                                        ? "bg-primary/10 text-primary"
                                        : tool.available
                                            ? "hover:bg-surface-100 text-muted-foreground"
                                            : "text-muted-foreground/30 cursor-default"
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {tool.label}
                                {!tool.available && <Lock className="h-2.5 w-2.5" />}
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1" />

                {/* アスペクト比 */}
                <div className="flex items-center gap-0.5 bg-surface-100 rounded-md p-0.5">
                    {ASPECT_RATIOS.map(r => (
                        <button
                            key={r.id}
                            onClick={() => setAspectRatio(r.id as any)}
                            className={clsx(
                                "px-2 py-1 rounded text-[10px] font-medium transition-all",
                                aspectRatio === r.id
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                            title={r.description}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>

                {/* エクスポート */}
                <button
                    disabled={!hasClips}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-[11px] font-bold rounded-md hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all ml-2"
                >
                    <Download className="h-3.5 w-3.5" />
                    エクスポート
                </button>
            </div>

            {/* ======== Body: 左パネル + プレビュー ======== */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                {/* ---- Left Panel: タブ + コンテンツ ---- */}
                <div className="w-60 flex-shrink-0 border-r flex flex-col">
                    {/* タブ */}
                    <div className="flex border-b">
                        {LEFT_TABS.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setLeftTab(tab.id)}
                                    className={clsx(
                                        "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-all border-b-2",
                                        leftTab === tab.id
                                            ? "border-primary text-primary"
                                            : "border-transparent text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* タブコンテンツ */}
                    <div className="flex-1 p-3 overflow-y-auto">
                        {leftTab === 'media' && (
                            <>
                                {/* アップロードボタン */}
                                <label className="flex items-center justify-center gap-1.5 w-full py-2 mb-3 bg-primary/10 text-primary text-[11px] font-bold rounded-md cursor-pointer hover:bg-primary/15 transition-colors">
                                    <Upload className="h-3.5 w-3.5" />
                                    メディアをアップロード
                                    <input type="file" accept="image/*,video/*,audio/*" multiple onChange={handleMediaUpload} className="hidden" />
                                </label>

                                {mediaItems.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Film className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                                        <p className="text-[11px] text-muted-foreground/50">動画・画像・音声を追加</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {mediaItems.map(item => (
                                            <div
                                                key={item.id}
                                                className="relative group rounded-md overflow-hidden bg-surface-100 aspect-square cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                                                onClick={() => addToTimeline(item)}
                                                title="クリックでタイムラインに追加"
                                            >
                                                {item.thumbnailUrl ? (
                                                    <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center">
                                                        {item.type === 'video' ? <Video className="h-5 w-5 text-primary/40" /> : <Music className="h-5 w-5 text-emerald-500/40" />}
                                                    </div>
                                                )}
                                                {/* ホバーオーバーレイ */}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                    <Plus className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                {/* 削除 */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeMedia(item.id); }}
                                                    className="absolute top-1 right-1 p-0.5 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                                >
                                                    <X className="h-2.5 w-2.5 text-white" />
                                                </button>
                                                {/* ファイル名 */}
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                                                    <p className="text-[8px] text-white truncate">{item.name}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {leftTab === 'text' && (
                            <div className="space-y-2">
                                <button
                                    onClick={() => {
                                        const newAction: TimelineAction = {
                                            id: `action-${Date.now()}`,
                                            start: currentTime,
                                            end: currentTime + 3,
                                            effectId: 'textEffect',
                                        };
                                        setEditorData(prev => prev.map(row =>
                                            row.id === 'track-text' ? { ...row, actions: [...row.actions, newAction] } : row
                                        ));
                                        toast.success('テキストを追加');
                                    }}
                                    className="w-full py-2.5 border-2 border-dashed rounded-md text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                                >
                                    + テキストを追加
                                </button>
                                <p className="text-[10px] text-muted-foreground/50 text-center">
                                    フォント・サイズ・アニメーションはPhase 2で実装
                                </p>
                            </div>
                        )}

                        {leftTab === 'audio' && (
                            <div className="space-y-2">
                                <label className="flex items-center justify-center gap-1.5 w-full py-2.5 border-2 border-dashed rounded-md text-[11px] font-medium text-muted-foreground cursor-pointer hover:border-primary/40 hover:text-primary transition-colors">
                                    <Music className="h-3.5 w-3.5" />
                                    BGMをアップロード
                                    <input type="file" accept="audio/*" onChange={handleMediaUpload} className="hidden" />
                                </label>
                                <p className="text-[10px] text-muted-foreground/50 text-center">
                                    MP3, WAV, AAC対応
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ---- Center: プレビュー ---- */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* プレビュー */}
                    <div className="flex-1 flex items-center justify-center p-6 bg-surface-50 overflow-hidden">
                        <div
                            className="bg-black rounded overflow-hidden shadow-xl flex items-center justify-center max-w-full"
                            style={getPreviewStyle()}
                        >
                            <div className="w-full h-full min-h-[240px] min-w-[135px] flex items-center justify-center">
                                {hasClips ? (
                                    <div className="text-center">
                                        <Play className="h-10 w-10 text-white/20 mx-auto mb-1" />
                                        <p className="text-[10px] text-white/30">プレビュー（Phase 2）</p>
                                    </div>
                                ) : (
                                    <div className="text-center px-4">
                                        <Film className="h-8 w-8 text-white/10 mx-auto mb-2" />
                                        <p className="text-[11px] text-white/20">左パネルからメディアを追加</p>
                                        <p className="text-[9px] text-white/10 mt-1">タイムラインにドロップして編集開始</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 再生コントロール */}
                    <div className="flex items-center gap-2 px-4 py-1.5 border-t bg-background">
                        <span className="text-[10px] text-muted-foreground font-mono w-20">
                            {formatTime(currentTime)}
                        </span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => timelineRef.current?.setTime(0)} className="p-1 hover:bg-surface-100 rounded">
                                <SkipBack className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button onClick={togglePlay} className="p-1.5 bg-primary hover:bg-primary/90 rounded-full shadow-sm">
                                {isPlaying
                                    ? <Pause className="h-3 w-3 text-primary-foreground" />
                                    : <Play className="h-3 w-3 text-primary-foreground ml-px" />
                                }
                            </button>
                            <button className="p-1 hover:bg-surface-100 rounded">
                                <SkipForward className="h-3 w-3 text-muted-foreground" />
                            </button>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                            / {formatTime(duration)}
                        </span>
                        <div className="flex-1" />
                        <button onClick={() => setIsMuted(!isMuted)} className="p-1 hover:bg-surface-100 rounded">
                            {isMuted ? <VolumeX className="h-3 w-3 text-muted-foreground" /> : <Volume2 className="h-3 w-3 text-muted-foreground" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* ======== Timeline ======== */}
            <div className="flex-shrink-0 border-t" style={{ height: '200px' }}>
                {/* タイムラインヘッダー */}
                <div className="flex items-center justify-between px-3 py-1 border-b bg-surface-50">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">タイムライン</span>
                        {selectedAction && (
                            <button
                                onClick={() => {
                                    setEditorData(prev => prev.map(row => ({
                                        ...row,
                                        actions: row.actions.filter(a => a.id !== selectedAction)
                                    })));
                                    setSelectedAction(null);
                                    toast.success('クリップを削除');
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-red-500 hover:bg-red-50 rounded transition-colors"
                            >
                                <Trash2 className="h-3 w-3" />
                                削除
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setScaleWidth(Math.max(80, scaleWidth - 20))} className="p-0.5 hover:bg-surface-100 rounded">
                            <ZoomOut className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <div className="w-16 h-1 bg-surface-200 rounded-full mx-1">
                            <div className="h-full bg-primary/40 rounded-full" style={{ width: `${((scaleWidth - 80) / 240) * 100}%` }} />
                        </div>
                        <button onClick={() => setScaleWidth(Math.min(320, scaleWidth + 20))} className="p-0.5 hover:bg-surface-100 rounded">
                            <ZoomIn className="h-3 w-3 text-muted-foreground" />
                        </button>
                    </div>
                </div>

                <div className="flex h-[calc(100%-28px)]">
                    {/* トラックラベル */}
                    <div className="w-24 flex-shrink-0 border-r bg-surface-50">
                        {editorData.map(row => {
                            const info = TRACK_LABELS[row.id];
                            if (!info) return null;
                            const Icon = info.icon;
                            return (
                                <div key={row.id} className="h-[50px] flex items-center gap-2 px-3 border-b border-border/30">
                                    <div className={clsx("w-2 h-2 rounded-full", info.color)} />
                                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-[11px] text-muted-foreground font-medium">{info.label}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* タイムライン */}
                    <div className="flex-1 overflow-hidden">
                        <Timeline
                            ref={timelineRef}
                            editorData={editorData}
                            effects={effects}
                            scale={1}
                            scaleWidth={scaleWidth}
                            rowHeight={50}
                            startLeft={10}
                            gridSnap={true}
                            dragLine={true}
                            onChange={(data) => setEditorData(data)}
                            onCursorDrag={(time) => setCurrentTime(time)}
                            getActionRender={getActionRender}
                            autoScroll={true}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
