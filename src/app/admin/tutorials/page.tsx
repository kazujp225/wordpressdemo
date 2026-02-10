"use client";

import { PlayCircle, ExternalLink } from 'lucide-react';

// TODO: 実際のYouTubeチャンネルURLに差し替え
const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@otasuke-lp";

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

            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                    <PlayCircle className="h-8 w-8 text-red-500" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    YouTubeチャンネルで動画を視聴
                </h2>
                <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                    基本的な操作方法から応用テクニックまで、限定公開の説明動画をご用意しています。
                </p>
                <a
                    href={YOUTUBE_CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                    <PlayCircle className="h-5 w-5" />
                    動画を見る
                    <ExternalLink className="h-4 w-4" />
                </a>
            </div>
        </div>
    );
}
