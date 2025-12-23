import { prisma } from '@/lib/db';

// ユーザーIDを指定してAPIキーを取得
export async function getGoogleApiKeyForUser(userId: string | null): Promise<string | null> {
    if (!userId) {
        // ユーザーIDがない場合は環境変数のみ使用
        return process.env.GOOGLE_GENERATIVE_AI_API_KEY || null;
    }

    try {
        // ユーザー固有の設定を取得
        const userSettings = await prisma.userSettings.findUnique({
            where: { userId }
        });

        if (userSettings?.googleApiKey) {
            return userSettings.googleApiKey;
        }
    } catch (e) {
        console.error('Failed to fetch user API key from DB:', e);
    }

    // フォールバック: 環境変数
    return process.env.GOOGLE_GENERATIVE_AI_API_KEY || null;
}

// 後方互換性のため（ユーザーIDなしで呼び出された場合）
export async function getGoogleApiKey(): Promise<string | null> {
    return process.env.GOOGLE_GENERATIVE_AI_API_KEY || null;
}

// ユーザーのAPIキーを保存
export async function saveGoogleApiKeyForUser(userId: string, apiKey: string): Promise<void> {
    await prisma.userSettings.upsert({
        where: { userId },
        update: { googleApiKey: apiKey },
        create: { userId, googleApiKey: apiKey }
    });
}

// ユーザー設定を取得
export async function getUserSettings(userId: string) {
    return prisma.userSettings.findUnique({
        where: { userId }
    });
}
