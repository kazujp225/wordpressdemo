import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { checkGenerationLimit, recordApiUsage } from '@/lib/usage';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { prisma } from '@/lib/db';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { image, direction, expandAmount, prompt, targetWidth, targetHeight } = await request.json();

        if (!image) {
            return NextResponse.json({ error: '画像が必要です' }, { status: 400 });
        }

        // 使用量チェック
        const limitCheck = await checkGenerationLimit(user.id);

        if (!limitCheck.allowed) {
            return NextResponse.json({
                error: limitCheck.needApiKey ? 'API_KEY_REQUIRED' : 'USAGE_LIMIT_EXCEEDED',
                message: limitCheck.reason,
            }, { status: limitCheck.needApiKey ? 402 : 429 });
        }

        // APIキー取得
        const apiKey = await getGoogleApiKeyForUser(user.id);
        if (!apiKey) {
            return NextResponse.json({
                error: 'API_KEY_REQUIRED',
                message: 'Google AI APIキーの設定が必要です',
            }, { status: 402 });
        }

        const startTime = createTimer();

        // 方向に応じたプロンプト生成
        const directionDesc = {
            left: '左側に',
            right: '右側に',
            top: '上側に',
            bottom: '下側に',
            all: '四方に'
        }[direction] || '周囲に';

        const fullPrompt = `この画像を${directionDesc}拡張してください。

【重要なルール】
1. 元の画像の内容と境界は完全に維持する
2. 拡張部分は元の画像と自然に繋がるようにする
3. 拡張部分のスタイル（色調、質感、照明）は元の画像と統一する
4. 出力サイズ: ${targetWidth}x${targetHeight}px

${prompt ? `【追加指示】\n${prompt}` : '【拡張内容】\n周囲の背景を自然に拡張し、違和感のない画像にしてください。'}

元の画像を中心に配置し、${directionDesc}新しい領域を生成してください。`;

        // Base64データを抽出
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

        // Gemini APIコール
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: 'image/png', data: base64Data } },
                            { text: fullPrompt }
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ["IMAGE", "TEXT"],
                        temperature: 0.4
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[OUTPAINT] Gemini API error:', errorText);
            throw new Error('AI画像生成に失敗しました');
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];

        let resultBase64: string | null = null;
        for (const part of parts) {
            if (part.inlineData?.data) {
                resultBase64 = part.inlineData.data;
                break;
            }
        }

        if (!resultBase64) {
            throw new Error('画像生成結果が取得できませんでした');
        }

        // Supabaseにアップロード
        const buffer = Buffer.from(resultBase64, 'base64');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filePath = `${uniqueSuffix}-outpaint.png`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('images')
            .upload(filePath, buffer, {
                contentType: 'image/png',
                upsert: false
            });

        if (uploadError) {
            console.error('[OUTPAINT] Upload error:', uploadError);
            throw new Error('画像のアップロードに失敗しました');
        }

        const { data: urlData } = supabaseAdmin.storage
            .from('images')
            .getPublicUrl(filePath);

        // MediaImageレコードを作成
        const mediaImage = await prisma.mediaImage.create({
            data: {
                userId: user.id,
                filePath: urlData.publicUrl,
                mime: 'image/png',
                width: targetWidth,
                height: targetHeight,
            }
        });

        // ログ記録
        const logResult = await logGeneration({
            userId: user.id,
            type: 'outpaint',
            endpoint: '/api/ai/outpaint',
            model: 'gemini-3-pro-image-preview',
            inputPrompt: fullPrompt,
            imageCount: 1,
            status: 'succeeded',
            startTime
        });

        // クレジット消費
        if (logResult && !limitCheck.skipCreditConsumption) {
            await recordApiUsage(user.id, logResult.id, logResult.estimatedCost, {
                model: 'gemini-3-pro-image-preview',
                imageCount: 1,
            });
        }

        return NextResponse.json({
            url: urlData.publicUrl,
            id: mediaImage.id,
            cost: logResult?.estimatedCost,
        });

    } catch (error: any) {
        console.error('[OUTPAINT] Error:', error);
        return NextResponse.json({ error: error.message || 'AI拡張に失敗しました' }, { status: 500 });
    }
}
