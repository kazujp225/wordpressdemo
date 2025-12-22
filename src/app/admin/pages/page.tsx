import Link from 'next/link';
import { Plus, Edit, Trash, Copy, FileText } from 'lucide-react';
import { prisma } from '@/lib/db';
import clsx from 'clsx';

// Mock data for MVP if DB fails
const MOCK_PAGES = [
    { id: 1, title: 'Demo Landing Page', slug: 'demo', status: 'published', updatedAt: new Date() },
    { id: 2, title: 'Draft Campaign', slug: 'draft-1', status: 'draft', updatedAt: new Date() },
];

import { PagesHeader } from '@/components/admin/PagesHeader';

export default async function PagesList() {
    // Try to fetch from DB, fallback to mock if DB not ready (safe for development step)
    let pages = MOCK_PAGES;
    try {
        pages = await prisma.page.findMany({ orderBy: { updatedAt: 'desc' } });
    } catch (e) {
        console.error("DB connection failed, using mock", e);
    }

    return (
        <div className="p-10 max-w-7xl mx-auto">
            <PagesHeader />

            {pages.length === 0 ? (
                <div className="flex h-96 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/50">
                    <div className="mb-4 rounded-full bg-white p-4 shadow-sm">
                        <Plus className="h-8 w-8 text-gray-300" />
                    </div>
                    <p className="font-bold text-gray-400 text-lg"><span>まだページがありません</span></p>
                    <p className="text-gray-400 text-sm mt-1"><span>右上のボタンから最初のページを作成しましょう。</span></p>
                </div>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {pages.map((page) => (
                        <div key={page.id} className="group overflow-hidden rounded-3xl border border-gray-100 bg-white p-2 shadow-sm transition-all hover:shadow-xl hover:shadow-gray-100">
                            <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-gray-50 relative">
                                <Link href={`/admin/pages/${page.id}`} className="absolute inset-0 flex items-center justify-center bg-gray-900/0 transition-colors group-hover:bg-gray-900/5 z-10">
                                    <div className="opacity-0 transition-opacity group-hover:opacity-100 flex gap-2">
                                        <span className="rounded-full bg-white px-4 py-2 text-xs font-bold text-gray-900 shadow-sm"><span>編集する</span></span>
                                    </div>
                                </Link>
                                <div className="absolute top-4 right-4 z-20">
                                    <span className={clsx(
                                        'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm',
                                        page.status === 'published' ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'
                                    )}>
                                        <span>{page.status === 'published' ? '公開中' : '下書き'}</span>
                                    </span>
                                </div>
                                {/* Placeholder for thumbnail */}
                                <div className="flex h-full w-full items-center justify-center text-gray-200">
                                    <FileText className="h-12 w-12 opacity-20" />
                                </div>
                            </div>

                            <div className="p-4 py-3">
                                <div className="flex items-start justify-between">
                                    <div className="overflow-hidden">
                                        <h3 className="truncate font-bold text-gray-900 leading-tight"><span>{page.title}</span></h3>
                                        <p className="truncate text-xs text-gray-400 mt-1 font-medium"><span>/{page.slug}</span></p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Link
                                            href={`/p/${page.slug}`}
                                            target="_blank"
                                            className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                            title="公開ページを表示"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Link>
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-3">
                                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">
                                        <span>更新: {new Date(page.updatedAt).toLocaleDateString()}</span>
                                    </span>
                                    <button className="text-gray-300 hover:text-red-500 transition-colors">
                                        <Trash className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
