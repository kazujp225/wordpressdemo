import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkTextGenerationLimit, recordApiUsage } from '@/lib/usage';

export async function POST(request: NextRequest) {
    const startTime = createTimer();
    let prompt = '';

    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // クレジット残高チェック
    const limitCheck = await checkTextGenerationLimit(user.id, 'gemini-2.0-flash', 1000, 2000);
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
        const { imageUrl } = await request.json();

        const apiKey = await getGoogleApiKeyForUser(user.id);
        if (!apiKey) {
            return NextResponse.json({ error: '設定画面でAPIキーを設定してください。' }, { status: 500 });
        }
        const genAI = new GoogleGenerativeAI(apiKey);

        // 画像のBase64取得（絶対URLを想定）
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`;

        const imgRes = await fetch(fullUrl);
        const buffer = await imgRes.arrayBuffer();
        const base64Content = Buffer.from(buffer).toString('base64');

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        prompt = `
            あなたは画像生成AI（MidjourneyやDALL-E 3）のプロンプトエンジニアです。
            渡された画像を詳細に解析し、この画像の「魂（テイスト・構成）」を完全に再現するためのプロンプトを作成してください。

            【解析のポイント】
            1. 被写体: 何が写っているか（詳細に）
            2. 構図: カメラアングル、焦点距離、配置
            3. ライティング: 光の種類、影のつき方
            4. 色調: 配色、彩度、コントラスト
            5. テイスト: 写真風、イラスト風、3Dレンダリング、特定の画風など

            【指示】
            英語のプロンプトをメインとし、ユーザーが理解しやすいように日本語の解説も添えてください。

            出力形式（JSONのみ）:
            {
              "prompt": "英語での詳細な画像生成プロンプト",
              "explanation": "日本語によるこの画像の言語化・解説"
            }
        `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Content,
                    mimeType: "image/jpeg"
                }
            }
        ]);

        const resText = result.response.text();
        const jsonMatch = resText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('解析結果の取得に失敗しました');

        const resultData = JSON.parse(jsonMatch[0]);

        // ログ記録（成功）
        const logResult = await logGeneration({
            userId: user.id,
            type: 'image-to-prompt',
            endpoint: '/api/ai/image-to-prompt',
            model: 'gemini-2.0-flash',
            inputPrompt: prompt,
            outputResult: JSON.stringify(resultData),
            status: 'succeeded',
            startTime
        });

        // クレジット消費
        if (logResult && !skipCreditConsumption) {
            await recordApiUsage(user.id, logResult.id, logResult.estimatedCost, { model: 'gemini-2.0-flash' });
        }

        return NextResponse.json(resultData);
    } catch (error: any) {
        console.error('Image Analysis Final Error:', error);

        // ログ記録（エラー）
        await logGeneration({
            userId: user.id,
            type: 'image-to-prompt',
            endpoint: '/api/ai/image-to-prompt',
            model: 'gemini-2.0-flash',
            inputPrompt: prompt || 'Error before prompt',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        return NextResponse.json({
            error: 'Image Analysis Failed',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
