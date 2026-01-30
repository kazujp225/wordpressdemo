import { NextRequest, NextResponse } from 'next/server';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { checkTextGenerationLimit, recordApiUsage } from '@/lib/usage';

// 管理者負担のAPIキー（フォールバック用）
const ADMIN_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

const SYSTEM_PROMPT = `あなたはLP（ランディングページ）画像生成のプロンプト作成を支援するコパイロットです。

【あなたの役割】
- ユーザーの商材やサービスについてヒアリング
- 効果的なプロンプトの提案
- プロンプトの改善アドバイス
- ターゲット層に合わせた表現の提案

【プロンプト作成のポイント】
1. 商材/サービスの特徴を明確に
2. ターゲット層（年齢、性別、悩み）を具体的に
3. 訴求ポイント（価格、品質、限定感など）
4. トーン&マナー（高級感、親しみやすさ、信頼感など）
5. 色味やスタイルの方向性

【回答のルール】
- 簡潔に回答（3-5文程度）
- 具体的なプロンプト例を提示する時は【プロンプト例】として明示
- 質問がある場合は1つずつ聞く
- 日本語で回答`;

export async function POST(request: NextRequest) {
    const startTime = createTimer();
    let inputPrompt = '';

    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // クレジット残高チェック
    const limitCheck = await checkTextGenerationLimit(user.id, 'gemini-2.0-flash', 500, 1024);
    if (!limitCheck.allowed) {
        if (limitCheck.needApiKey) {
            return NextResponse.json({ error: 'API_KEY_REQUIRED', message: limitCheck.reason }, { status: 402 });
        }
        if (limitCheck.needSubscription) {
            return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED', message: limitCheck.reason }, { status: 402 });
        }
        return NextResponse.json({ error: 'INSUFFICIENT_CREDIT', message: limitCheck.reason, needPurchase: true }, { status: 402 });
    }
    const skipCreditConsumption = limitCheck.skipCreditConsumption || false;

    try {
        const { messages } = await request.json();
        inputPrompt = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');

        // ユーザーのAPIキーを優先、なければ管理者キーを使用
        let apiKey = await getGoogleApiKeyForUser(user.id);
        if (!apiKey) {
            apiKey = ADMIN_API_KEY || null;
        }
        if (!apiKey) {
            return NextResponse.json({
                error: 'APIキーが設定されていません。設定画面でAPIキーを設定してください。'
            }, { status: 500 });
        }

        // Gemini 2.0 Flash（高速・低コストモデル）でAPI呼び出し
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: SYSTEM_PROMPT }]
                    },
                    contents: messages.map((m: any) => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    })),
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('Gemini API error:', error);
            throw new Error('AI応答の生成に失敗しました');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'すみません、応答を生成できませんでした。';

        // ログ記録（成功）
        const logResult = await logGeneration({
            userId: user.id,
            type: 'prompt-copilot',
            endpoint: '/api/ai/prompt-copilot',
            model: 'gemini-2.0-flash',
            inputPrompt,
            outputResult: text,
            status: 'succeeded',
            startTime
        });

        // クレジット消費
        if (logResult && !skipCreditConsumption) {
            await recordApiUsage(user.id, logResult.id, logResult.estimatedCost, { model: 'gemini-2.0-flash' });
        }

        return NextResponse.json({ message: text });

    } catch (error: any) {
        console.error('Prompt Copilot Error:', error);

        // ログ記録（エラー）
        await logGeneration({
            userId: user.id,
            type: 'prompt-copilot',
            endpoint: '/api/ai/prompt-copilot',
            model: 'gemini-2.0-flash',
            inputPrompt: inputPrompt || 'Error before input',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
