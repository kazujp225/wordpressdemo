import { prisma } from '@/lib/db';
import { isFreePlan } from '@/lib/plans';

// APIキー取得結果
export interface ApiKeyResult {
    apiKey: string | null;
    isUserOwnKey: boolean; // ユーザー自身のAPIキーかどうか
}

// ユーザーIDを指定してAPIキーを取得
export async function getGoogleApiKeyForUser(userId: string | null): Promise<string | null> {
    const result = await getGoogleApiKeyWithInfo(userId);
    return result.apiKey;
}

// ユーザーIDを指定してAPIキーを取得（詳細情報付き）
export async function getGoogleApiKeyWithInfo(userId: string | null): Promise<ApiKeyResult> {
    if (!userId) {
        // ユーザーIDがない場合は環境変数のみ使用
        return {
            apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || null,
            isUserOwnKey: false
        };
    }

    try {
        // ユーザー固有の設定を取得
        const userSettings = await prisma.userSettings.findUnique({
            where: { userId }
        });

        const planId = userSettings?.plan || 'free';

        // Freeプランの場合のみ自分のAPIキーを使用
        if (isFreePlan(planId)) {
            if (userSettings?.googleApiKey) {
                return {
                    apiKey: userSettings.googleApiKey,
                    isUserOwnKey: true
                };
            }
            // Freeプランで自分のAPIキーがない場合はnull
            return {
                apiKey: null,
                isUserOwnKey: false
            };
        }

        // 有料プランの場合は自社APIキーを使用（ユーザーのAPIキーは無視）
        return {
            apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || null,
            isUserOwnKey: false
        };
    } catch (e) {
        console.error('Failed to fetch user API key from DB:', e);
    }

    // エラー時はフォールバック: 環境変数
    return {
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || null,
        isUserOwnKey: false
    };
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
