import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkTextGenerationLimit, recordApiUsage } from '@/lib/usage';

const log = {
    info: (msg: string) => console.log(`\x1b[36m[EXTRACT-BG]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[EXTRACT-BG]\x1b[0m ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[EXTRACT-BG]\x1b[0m ${msg}`),
};

interface ExtractBackgroundColorRequest {
    imageUrl: string;
}

export async function POST(request: NextRequest) {
    const startTime = createTimer();

    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // クレジット残高チェック
    const limitCheck = await checkTextGenerationLimit(user.id, 'gemini-2.0-flash', 500, 500);
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
        const body: ExtractBackgroundColorRequest = await request.json();
        const { imageUrl } = body;

        if (!imageUrl) {
            return NextResponse.json({ error: '画像URLが必要です' }, { status: 400 });
        }

        const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user.id);
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({
                error: 'Google API key is not configured'
            }, { status: 500 });
        }

        log.info(`Extracting background color from image`);

        // 画像を取得してBase64に変換
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            return NextResponse.json({ error: '画像の取得に失敗しました' }, { status: 500 });
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        const base64Image = imageBuffer.toString('base64');

        // Gemini APIで背景色を分析
        const prompt = `この画像を分析して、主要な背景色を特定してください。

【タスク】
1. 画像の背景として使われている色を特定する
2. 最も広い面積を占める背景色を1つ選ぶ
3. その色のHEXカラーコード（#RRGGBB形式）を返す

【注意】
- テキストやアイコン、ボタンの色ではなく、背景色を特定してください
- グラデーションの場合は、最も目立つ色を選んでください
- 複数の背景色がある場合は、最も広い面積の色を選んでください

【回答形式】
以下のJSON形式で回答してください：
{
  "primaryColor": "#XXXXXX",
  "colorName": "色の名前（日本語）",
  "confidence": "high/medium/low",
  "description": "この色が選ばれた理由（簡潔に）"
}

JSONのみを返してください。説明文は不要です。`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: 'image/png', data: base64Image } },
                            { text: prompt },
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 500,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            log.error(`Gemini API error: ${errorText}`);
            return NextResponse.json({ error: 'AI処理に失敗しました' }, { status: 500 });
        }

        const data = await response.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // JSONを抽出
        let result;
        try {
            // マークダウンのコードブロックを除去
            const jsonMatch = textContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('JSON not found in response');
            }
        } catch (parseError) {
            log.error(`Failed to parse response: ${textContent}`);
            // フォールバック: テキストからカラーコードを抽出
            const colorMatch = textContent.match(/#[0-9A-Fa-f]{6}/);
            if (colorMatch) {
                result = {
                    primaryColor: colorMatch[0].toUpperCase(),
                    colorName: '検出された色',
                    confidence: 'medium',
                    description: '画像から抽出'
                };
            } else {
                return NextResponse.json({ error: '背景色の検出に失敗しました' }, { status: 500 });
            }
        }

        // カラーコードの検証
        if (!result.primaryColor || !/^#[0-9A-Fa-f]{6}$/.test(result.primaryColor)) {
            return NextResponse.json({ error: '有効な色コードを検出できませんでした' }, { status: 500 });
        }

        log.success(`Extracted background color: ${result.primaryColor} (${result.colorName})`);

        // ログ記録（成功）
        const logResult = await logGeneration({
            userId: user.id,
            type: 'extract-background-color',
            endpoint: '/api/ai/extract-background-color',
            model: 'gemini-2.0-flash',
            inputPrompt: prompt,
            outputResult: JSON.stringify(result),
            status: 'succeeded',
            startTime
        });

        // クレジット消費
        if (logResult && !skipCreditConsumption) {
            await recordApiUsage(user.id, logResult.id, logResult.estimatedCost, { model: 'gemini-2.0-flash' });
        }

        return NextResponse.json({
            success: true,
            color: result.primaryColor.toUpperCase(),
            colorName: result.colorName,
            confidence: result.confidence,
            description: result.description,
        });

    } catch (error: any) {
        log.error(`Error: ${error.message}`);

        // ログ記録（エラー）
        await logGeneration({
            userId: user.id,
            type: 'extract-background-color',
            endpoint: '/api/ai/extract-background-color',
            model: 'gemini-2.0-flash',
            inputPrompt: 'Error before prompt',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
