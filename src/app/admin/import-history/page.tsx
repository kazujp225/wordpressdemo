import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Globe, Calendar, Image as ImageIcon, ExternalLink, ArrowLeft } from 'lucide-react';

export default async function ImportHistoryPage() {
    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // インポート履歴を取得（sourceType='import'のものをURLごとにグループ化）
    const imports = await prisma.mediaImage.findMany({
        where: {
            sourceType: 'import',
            userId: user?.id ?? 'no-user', // 未認証時は何も返さない
        },
        orderBy: { createdAt: 'desc' },
    });

    // URLごとにグループ化
    const groupedByUrl = imports.reduce((acc, img) => {
        const url = img.sourceUrl || 'Unknown';
        if (!acc[url]) {
            acc[url] = {
                url,
                images: [],
                createdAt: img.createdAt,
            };
        }
        acc[url].images.push(img);
        return acc;
    }, {} as Record<string, { url: string; images: typeof imports; createdAt: Date }>);

    const importGroups = Object.values(groupedByUrl).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 sm:mb-8">
                    <Link
                        href="/admin/pages"
                        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        ページ一覧に戻る
                    </Link>
                    <h1 className="text-xl sm:text-3xl font-black text-gray-900">インポート履歴</h1>
                    <p className="text-gray-500 mt-1">URLからインポートしたスクリーンショットの履歴</p>
                </div>

                {importGroups.length === 0 ? (
                    <div className="bg-white rounded-3xl shadow-sm p-12 text-center">
                        <Globe className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-gray-400">インポート履歴がありません</h2>
                        <p className="text-gray-400 mt-2">URLからインポートすると、ここに履歴が表示されます</p>
                        <Link
                            href="/admin/pages"
                            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                        >
                            <Globe className="h-4 w-4" />
                            新規インポート
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {importGroups.map((group, groupIdx) => (
                            <div key={groupIdx} className="bg-white rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
                                {/* Group Header */}
                                <div className="p-4 sm:p-6 border-b border-gray-100">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 sm:gap-3 mb-2">
                                                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg sm:rounded-xl flex-shrink-0">
                                                    <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                                                </div>
                                                <h2 className="text-sm sm:text-lg font-bold text-gray-900 truncate">
                                                    {group.url}
                                                </h2>
                                            </div>
                                            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                                                    {new Date(group.createdAt).toLocaleString('ja-JP')}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                                                    {group.images.length}枚
                                                </span>
                                            </div>
                                        </div>
                                        <a
                                            href={group.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg sm:rounded-xl transition-colors min-h-[40px] self-start"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            元サイト
                                        </a>
                                    </div>
                                </div>

                                {/* Image Grid */}
                                <div className="p-3 sm:p-6">
                                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
                                        {group.images.map((img, imgIdx) => (
                                            <div
                                                key={img.id}
                                                className="relative group aspect-[9/16] bg-gray-100 rounded-2xl overflow-hidden"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={img.filePath}
                                                    alt={`Segment ${imgIdx + 1}`}
                                                    className="w-full h-full object-cover object-top"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="absolute bottom-2 left-2 right-2">
                                                        <span className="inline-block px-2 py-1 bg-white/90 text-xs font-bold text-gray-700 rounded-lg">
                                                            #{imgIdx + 1}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
