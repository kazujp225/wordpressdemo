"use client";

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, RefreshCw, Pencil } from 'lucide-react';

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
    onEditImage?: (id: string) => void;
    onInpaintImage?: (id: string, imageUrl: string) => void;
    onSaveSection?: (id: string) => void;
    onReviewSection?: (id: string) => void;
    onChatEdit?: (id: string, message: string) => Promise<any>;
    isSaving?: boolean;
    isReviewing?: boolean;
    isChatting?: boolean;
    isEditingImage?: boolean;
    isGeneratingImage?: boolean;
    reviewResult?: any;
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

    const roleLabels: Record<string, string> = {
        hero: 'ヒーロー',
        problem: 'お悩み',
        solution: '解決策',
        pricing: '料金',
        faq: 'FAQ',
        testimony: 'お客様の声',
        footer: 'フッター',
        other: 'その他'
    };

    return (
        <div
            id={`section-${props.id}`}
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-3 rounded-lg border bg-white p-2 shadow-sm hover:shadow-md transition-all"
        >
            {/* ドラッグハンドル */}
            <div {...attributes} {...listeners} className="cursor-grab text-gray-300 hover:text-gray-500">
                <GripVertical className="h-4 w-4" />
            </div>

            {/* サムネイル + 編集ボタン */}
            <div className="relative group h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
                {preview ? (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt="" className="h-full w-full object-cover" />
                        {props.onInpaintImage && !props.isGeneratingImage && !props.isEditingImage && (
                            <button
                                onClick={() => props.onInpaintImage?.(props.id, preview)}
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                title="画像を編集"
                            >
                                <Pencil className="h-4 w-4 text-white" />
                            </button>
                        )}
                    </>
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-[8px] text-gray-400">
                        No Image
                    </div>
                )}
                {(props.isGeneratingImage || props.isEditingImage) && (
                    <div className="absolute inset-0 bg-purple-600/80 flex items-center justify-center">
                        <RefreshCw className="h-4 w-4 text-white animate-spin" />
                    </div>
                )}
            </div>

            {/* 役割セレクト */}
            <select
                value={props.role}
                onChange={(e) => props.onRoleChange(props.id, e.target.value)}
                className="flex-1 min-w-0 text-xs font-medium text-gray-700 bg-gray-50 border-0 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
            >
                <option value="hero">ヒーロー</option>
                <option value="problem">お悩み</option>
                <option value="solution">解決策</option>
                <option value="pricing">料金</option>
                <option value="faq">FAQ</option>
                <option value="testimony">お客様の声</option>
                <option value="footer">フッター</option>
                <option value="other">その他</option>
            </select>

            {/* 削除ボタン */}
            <button
                onClick={() => props.onRemove(props.id)}
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            >
                <Trash2 className="h-4 w-4" />
            </button>
        </div>
    );
}
