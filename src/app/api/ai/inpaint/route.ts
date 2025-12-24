import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { estimateImageCost } from '@/lib/ai-costs';

interface MaskArea {
    x: number;      // 選択範囲の左上X（0-1の比率）
    y: number;      // 選択範囲の左上Y（0-1の比率）
    width: number;  // 選択範囲の幅（0-1の比率）
    height: number; // 選択範囲の高さ（0-1の比率）
}

interface InpaintRequest {
    imageUrl?: string;
    imageBase64?: string;
    mask?: MaskArea;        // 単一選択（後方互換性）
    masks?: MaskArea[];     // 複数選択
    prompt: string;         // 修正指示
}

export async function POST(request: NextRequest) {
    const startTime = createTimer();
    let inpaintPrompt = '';

    // ユーザー認証
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    try {
        const { imageUrl, imageBase64, mask, masks, prompt }: InpaintRequest = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: '修正指示(prompt)を入力してください' }, { status: 400 });
        }

        // 複数選択か単一選択か判定
        const allMasks: MaskArea[] = masks && masks.length > 0 ? masks : (mask ? [mask] : []);

        const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user?.id || null);
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({
                error: 'Google API key is not configured. 設定画面でAPIキーを設定してください。'
            }, { status: 500 });
        }

        // 画像データ取得
        let base64Data: string;
        let mimeType = 'image/png';

        if (imageBase64) {
            base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        } else if (imageUrl) {
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error('画像の取得に失敗しました');
            }
            const arrayBuffer = await imageResponse.arrayBuffer();
            base64Data = Buffer.from(arrayBuffer).toString('base64');
            mimeType = imageResponse.headers.get('content-type') || 'image/png';
        } else {
            return NextResponse.json({ error: '画像を指定してください' }, { status: 400 });
        }

        // 複数の選択範囲を説明に変換
        const getPositionDesc = (m: MaskArea) => {
            const xPercent = Math.round(m.x * 100);
            const yPercent = Math.round(m.y * 100);
            let pos = '';
            if (yPercent < 33) pos = '上部';
            else if (yPercent < 66) pos = '中央';
            else pos = '下部';
            if (xPercent < 33) pos += '左側';
            else if (xPercent < 66) pos += '中央';
            else pos += '右側';
            return pos;
        };

        const areasDescription = allMasks.map((m, i) => {
            const xPercent = Math.round(m.x * 100);
            const yPercent = Math.round(m.y * 100);
            const widthPercent = Math.round(m.width * 100);
            const heightPercent = Math.round(m.height * 100);
            return `領域${i + 1}: ${getPositionDesc(m)}（左から${xPercent}%、上から${yPercent}%、幅${widthPercent}%、高さ${heightPercent}%）`;
        }).join('\n');

        // インペインティング用プロンプト - 画像生成を強制
        inpaintPrompt = `You are an image editor. Generate a new image based on the provided image with the following modification:

${prompt}

Apply this change to the area: ${areasDescription}

Output the complete edited image. Do not describe the changes - generate the actual modified image.`;

        // Gemini 3.0 Pro（最新画像生成モデル）を使用
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Data
                                }
                            },
                            { text: inpaintPrompt }
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ["IMAGE", "TEXT"],
                        temperature: 1.0
                    },
                    toolConfig: {
                        functionCallingConfig: {
                            mode: "NONE"
                        }
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini Flash API error:', errorText);
            throw new Error(`インペインティングに失敗しました: ${response.status}`);
        }

        const data = await response.json();
        const modelUsed = 'gemini-3-pro-image-preview';
        const estimatedCost = estimateImageCost(modelUsed, 1);
        const durationMs = Date.now() - startTime;

        const result = await processInpaintResponse(data, user?.id || null, {
            model: modelUsed,
            estimatedCost,
            durationMs
        });

        // ログ記録（成功）
        await logGeneration({
            userId: user?.id || null,
            type: 'inpaint',
            endpoint: '/api/ai/inpaint',
            model: modelUsed,
            inputPrompt: inpaintPrompt,
            imageCount: 1,
            status: 'succeeded',
            startTime
        });

        return result;

    } catch (error: any) {
        console.error('Inpaint Error:', error);

        // ログ記録（エラー）
        await logGeneration({
            userId: user?.id || null,
            type: 'inpaint',
            endpoint: '/api/ai/inpaint',
            model: 'gemini-3-pro-image-preview',
            inputPrompt: inpaintPrompt || 'Error before prompt',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

interface CostInfo {
    model: string;
    estimatedCost: number;
    durationMs: number;
}

async function processInpaintResponse(data: any, userId: string | null, costInfo?: CostInfo) {
    console.log('Gemini Response:', JSON.stringify(data, null, 2));

    const parts = data.candidates?.[0]?.content?.parts || [];
    let editedImageBase64: string | null = null;
    let textResponse: string | null = null;

    for (const part of parts) {
        console.log('Part keys:', Object.keys(part));
        if (part.inlineData?.data) {
            editedImageBase64 = part.inlineData.data;
            console.log('Found image data, length:', editedImageBase64?.length);
        }
        if (part.text) {
            textResponse = part.text;
            console.log('Text response:', textResponse);
        }
    }

    if (!editedImageBase64) {
        console.log('No image data found in response');
        return NextResponse.json({
            success: false,
            message: '画像の編集に失敗しました。選択範囲やプロンプトを変更してお試しください。',
            textResponse
        });
    }

    // Supabaseにアップロード
    const buffer = Buffer.from(editedImageBase64, 'base64');
    const filename = `inpaint-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;

    const { error: uploadError } = await supabase
        .storage
        .from('images')
        .upload(filename, buffer, {
            contentType: 'image/png',
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        throw new Error('画像のアップロードに失敗しました');
    }

    // 公開URL取得
    const { data: { publicUrl } } = supabase
        .storage
        .from('images')
        .getPublicUrl(filename);

    // DB保存
    const media = await prisma.mediaImage.create({
        data: {
            userId,
            filePath: publicUrl,
            mime: 'image/png',
            width: 0,  // 元画像サイズを維持
            height: 0,
        },
    });

    return NextResponse.json({
        success: true,
        media,
        textResponse,
        costInfo: costInfo ? {
            model: costInfo.model,
            estimatedCost: costInfo.estimatedCost,
            durationMs: costInfo.durationMs
        } : null
    });
}
