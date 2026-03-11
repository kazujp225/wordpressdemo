"use client";

import React, { useState, useRef } from 'react';
import { X, Upload, ImageIcon, FolderOpen, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    isOpen: boolean;
    insertIndex: number; // 挿入位置（この位置に挿入される）
    onClose: () => void;
    onInsert: (imageFile: File, insertIndex: number) => Promise<void>;
    onSelectFromLibrary: (insertIndex: number) => void;
}

export default function SectionInsertModal({
    isOpen,
    insertIndex,
    onClose,
    onInsert,
    onSelectFromLibrary,
}: Props) {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadFailed, setUploadFailed] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [lastFile, setLastFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileSelect = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('画像ファイルを選択してください');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            toast.error('50MB以下の画像を選択してください');
            return;
        }

        setLastFile(file);
        setIsUploading(true);
        setUploadFailed(false);
        try {
            await onInsert(file, insertIndex);
            onClose();
        } catch (error: any) {
            setUploadFailed(true);
            toast.error(error.message || '画像のアップロードに失敗しました');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* ヘッダー */}
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-5 py-4 border-b bg-white border-gray-100">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <ImageIcon className="h-5 w-5" />
                            セクションを挿入
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            セクション {insertIndex + 1} の位置に挿入します
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="p-5">
                    {isUploading ? (
                        <div className="py-12 flex flex-col items-center justify-center">
                            <Loader2 className="h-10 w-10 text-gray-900 animate-spin mb-3" />
                            <p className="text-sm text-gray-600">アップロード中...</p>
                            <button
                                onClick={() => { setIsUploading(false); setUploadFailed(true); }}
                                className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
                            >
                                キャンセル
                            </button>
                        </div>
                    ) : uploadFailed ? (
                        <div className="py-10 flex flex-col items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                                <X className="h-6 w-6 text-red-500" />
                            </div>
                            <p className="text-sm font-medium text-gray-900 mb-1">アップロードに失敗しました</p>
                            <p className="text-xs text-gray-400 mb-4">接続を確認してもう一度お試しください</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setUploadFailed(false); }}
                                    className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                                >
                                    別の画像を選ぶ
                                </button>
                                {lastFile && (
                                    <button
                                        onClick={() => handleFileSelect(lastFile)}
                                        className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-black rounded-xl transition-colors"
                                    >
                                        再試行
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* ドラッグ＆ドロップエリア */}
                            <div
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${dragOver
                                        ? 'border-gray-900 bg-gray-50'
                                        : 'border-gray-300 hover:border-gray-500 hover:bg-gray-50'
                                    }`}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragOver(true);
                                }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                                <p className="text-sm font-medium text-gray-700">
                                    画像をドラッグ＆ドロップ
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    またはクリックしてファイルを選択
                                </p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileInputChange}
                                />
                            </div>

                            {/* 区切り線 */}
                            <div className="flex items-center gap-3 my-4">
                                <div className="flex-1 h-px bg-gray-200" />
                                <span className="text-xs text-gray-400">または</span>
                                <div className="flex-1 h-px bg-gray-200" />
                            </div>

                            {/* アセットライブラリから選択 */}
                            <button
                                onClick={() => {
                                    onSelectFromLibrary(insertIndex);
                                    onClose();
                                }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
                            >
                                <FolderOpen className="h-5 w-5" />
                                <span className="font-medium">アセットライブラリから選択</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
