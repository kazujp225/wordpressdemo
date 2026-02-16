"use client";

import useSWR from 'swr';

// グローバルフェッチャー
const fetcher = (url: string) => fetch(url).then(res => res.json());

// SWR設定（タブ間でデータを保持）
const swrConfig = {
    revalidateOnFocus: false,      // フォーカス時の再検証を無効化（高速化）
    revalidateOnReconnect: false,  // 再接続時の再検証を無効化
    dedupingInterval: 60000,       // 1分間は重複リクエストを防止
    keepPreviousData: true,        // 前回のデータを保持（タブ切り替え時に即表示）
};

// ユーザー設定フック
export function useUserSettings() {
    return useSWR('/api/user/settings', fetcher, {
        ...swrConfig,
        revalidateOnMount: true,
    });
}

// メディア一覧フック
export function useMedia() {
    return useSWR('/api/media', fetcher, {
        ...swrConfig,
        revalidateOnMount: true,
    });
}

// ページ一覧フック
export function usePages() {
    return useSWR('/api/pages', fetcher, {
        ...swrConfig,
        revalidateOnMount: true,
    });
}

// API使用統計フック
export function useApiStats(period: number = 30) {
    return useSWR(`/api/admin/stats?days=${period}`, fetcher, {
        ...swrConfig,
        revalidateOnMount: true,
    });
}

// LPビルダーページ一覧フック
export function useLpBuilderPages() {
    return useSWR('/api/lp-builder', fetcher, {
        ...swrConfig,
        revalidateOnMount: true,
    });
}

// ナビゲーション設定フック
export function useNavigationConfig() {
    return useSWR('/api/config/navigation', fetcher, {
        ...swrConfig,
        revalidateOnMount: true,
    });
}

// グローバル設定フック
export function useAdminSettings() {
    return useSWR('/api/admin/settings', fetcher, {
        ...swrConfig,
        revalidateOnMount: true,
    });
}

// バナー一覧フック
export function useBanners() {
    return useSWR('/api/banners', fetcher, {
        ...swrConfig,
        revalidateOnMount: true,
    });
}

// 公開テンプレート一覧フック（ユーザー用）
export function useTemplates() {
    return useSWR('/api/templates', fetcher, {
        ...swrConfig,
        revalidateOnMount: true,
    });
}

// 管理者テンプレート一覧フック
export function useAdminTemplates() {
    return useSWR('/api/admin/templates', fetcher, {
        ...swrConfig,
        revalidateOnMount: true,
    });
}

// プリフェッチ関数（Sidebar用）
export async function prefetchAdminData() {
    const urls = [
        '/api/user/settings',
        '/api/media',
        '/api/pages',
        '/api/admin/stats?days=30',
        '/api/lp-builder',
    ];

    // 並列でプリフェッチ
    await Promise.allSettled(urls.map(url => fetch(url)));
}
