"use client";

import { PlayCircle, ExternalLink } from 'lucide-react';

const TUTORIAL_VIDEOS = [
    {
        id: 'tknr6vbsNOM',
        title: 'LP作成ツール説明動画',
        description: 'OTASUKE！なんでもしゅうせいくんの基本的な使い方を解説しています。',
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
                    OTASUKE！なんでもしゅうせいくんの使い方を動画で解説しています。
                </p>
            </div>

            <div className="space-y-6">
                {TUTORIAL_VIDEOS.map((video) => (
                    <a
                        key={video.id}
                        href={`https://youtu.be/${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
                    >
                        <div className="relative aspect-video bg-gray-900">
                            <img
                                src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
                                alt={video.title}
                                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <PlayCircle className="h-8 w-8 text-white" />
                                </div>
                            </div>
                        </div>
                        <div className="p-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">{video.title}</h2>
                                <p className="mt-1 text-sm text-gray-500">{video.description}</p>
                            </div>
                            <ExternalLink className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors flex-shrink-0 ml-4" />
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}
