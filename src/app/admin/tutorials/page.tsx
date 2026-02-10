"use client";

import { PlayCircle } from 'lucide-react';

const TUTORIAL_VIDEOS = [
    {
        id: 'tknr6vbsNOM',
        title: 'LP作成ツール説明動画',
        description: 'オタスケ LPの基本的な使い方を解説しています。',
    },
];

export default function TutorialsPage() {
    return (
        <div className="p-6 lg:p-10 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <PlayCircle className="h-7 w-7 text-purple-600" />
                    説明動画
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                    オタスケ LPの使い方を動画で解説しています。
                </p>
            </div>

            <div className="space-y-6">
                {TUTORIAL_VIDEOS.map((video) => (
                    <div key={video.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="aspect-video">
                            <iframe
                                src={`https://www.youtube.com/embed/${video.id}`}
                                title={video.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full"
                            />
                        </div>
                        <div className="p-5">
                            <h2 className="text-lg font-semibold text-gray-900">{video.title}</h2>
                            <p className="mt-1 text-sm text-gray-500">{video.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
