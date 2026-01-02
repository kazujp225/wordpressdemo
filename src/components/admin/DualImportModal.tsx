"use client";

import React, { useState } from 'react';
import { X, Loader2, Monitor, Smartphone, Download, Check, AlertCircle } from 'lucide-react';

interface MediaImage {
    id: number;
    filePath: string;
    width?: number | null;
    height?: number | null;
}

interface DualImportResult {
    desktop: MediaImage[];
    mobile: MediaImage[];
}

interface DualImportModalProps {
    onClose: () => void;
    onImport: (result: DualImportResult) => void;
}

type ImportStep = 'input' | 'capturing' | 'preview' | 'error';

export function DualImportModal({ onClose, onImport }: DualImportModalProps) {
    const [url, setUrl] = useState('');
    const [step, setStep] = useState<ImportStep>('input');
    const [progress, setProgress] = useState<string>('');
    const [result, setResult] = useState<DualImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCapture = async () => {
        if (!url.trim()) return;

        setStep('capturing');
        setProgress('');
        setError(null);

        try {
            const response = await fetch('/api/screenshot/dual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url.trim() }),
            });

            if (!response.ok) {
                throw new Error('Failed to start capture');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response stream');
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line.replace('data: ', ''));

                        if (data.type === 'progress') {
                            setProgress(data.message || '');
                        } else if (data.type === 'complete' && data.success) {
                            setResult({
                                desktop: data.desktop,
                                mobile: data.mobile,
                            });
                            setStep('preview');
                        } else if (data.type === 'error') {
                            throw new Error(data.error || 'Unknown error');
                        }
                    } catch (parseError) {
                        // Skip invalid JSON
                    }
                }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to capture screenshots');
            setStep('error');
        }
    };

    const handleConfirmImport = () => {
        if (result) {
            onImport(result);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            <Monitor className="w-5 h-5 text-blue-600" />
                            <span className="text-gray-400">+</span>
                            <Smartphone className="w-4 h-4 text-purple-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">
                            デュアルスクリーンショット
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {step === 'input' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <p className="text-gray-600 mb-4">
                                    URLからデスクトップとモバイル両方のスクリーンショットを取得します
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    取り込むURL
                                </label>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://example.com"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && url.trim()) {
                                            handleCapture();
                                        }
                                    }}
                                />
                            </div>

                            <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                                <div className="flex-1 flex items-center gap-3 text-sm text-gray-600">
                                    <Monitor className="w-8 h-8 text-blue-500" />
                                    <div>
                                        <div className="font-medium">デスクトップ</div>
                                        <div className="text-gray-400">1280 x 800</div>
                                    </div>
                                </div>
                                <div className="flex-1 flex items-center gap-3 text-sm text-gray-600">
                                    <Smartphone className="w-8 h-8 text-purple-500" />
                                    <div>
                                        <div className="font-medium">モバイル</div>
                                        <div className="text-gray-400">375 x 812</div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleCapture}
                                disabled={!url.trim()}
                                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Download className="w-5 h-5" />
                                両方を同時に取り込む
                            </button>
                        </div>
                    )}

                    {step === 'capturing' && (
                        <div className="py-12 text-center">
                            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                            <p className="text-lg font-medium text-gray-700 mb-2">
                                スクリーンショットを取得中...
                            </p>
                            <p className="text-sm text-gray-500">
                                {progress || '準備中...'}
                            </p>
                        </div>
                    )}

                    {step === 'preview' && result && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full mb-4">
                                    <Check className="w-4 h-4" />
                                    取得完了
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                {/* Desktop Preview */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Monitor className="w-5 h-5 text-blue-600" />
                                        <span className="font-medium text-gray-700">デスクトップ</span>
                                        <span className="text-sm text-gray-400">
                                            ({result.desktop.length} セグメント)
                                        </span>
                                    </div>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                                        {result.desktop.map((img, idx) => (
                                            <img
                                                key={img.id}
                                                src={img.filePath}
                                                alt={`Desktop segment ${idx + 1}`}
                                                className="w-full"
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Mobile Preview */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Smartphone className="w-5 h-5 text-purple-600" />
                                        <span className="font-medium text-gray-700">モバイル</span>
                                        <span className="text-sm text-gray-400">
                                            ({result.mobile.length} セグメント)
                                        </span>
                                    </div>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto flex justify-center bg-gray-50">
                                        <div className="w-48">
                                            {result.mobile.map((img, idx) => (
                                                <img
                                                    key={img.id}
                                                    src={img.filePath}
                                                    alt={`Mobile segment ${idx + 1}`}
                                                    className="w-full"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setStep('input');
                                        setResult(null);
                                    }}
                                    className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    やり直す
                                </button>
                                <button
                                    onClick={handleConfirmImport}
                                    className="flex-1 py-3 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Check className="w-5 h-5" />
                                    この内容で進む
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'error' && (
                        <div className="py-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                                エラーが発生しました
                            </h3>
                            <p className="text-gray-600 text-sm mb-6">
                                {error || 'スクリーンショットの取得に失敗しました'}
                            </p>
                            <button
                                onClick={() => {
                                    setStep('input');
                                    setError(null);
                                }}
                                className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                戻る
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
