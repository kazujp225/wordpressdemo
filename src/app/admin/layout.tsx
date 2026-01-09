"use client";

import { useState } from 'react';
import { Sidebar, MobileMenuButton } from '@/components/admin/Sidebar';
import { SWRProvider } from '@/components/providers/SWRProvider';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <SWRProvider>
            <div className="flex min-h-screen bg-gray-50">
                {/* モバイル用メニューボタン */}
                <MobileMenuButton onClick={() => setSidebarOpen(true)} />

                {/* サイドバー */}
                <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                />

                {/* メインコンテンツ */}
                <main className="flex-1 overflow-y-auto lg:ml-0 pt-16 lg:pt-0">
                    {children}
                </main>
            </div>
        </SWRProvider>
    );
}
