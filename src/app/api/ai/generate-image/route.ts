import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkImageGenerationLimit, recordApiUsage } from '@/lib/usage';
import { estimateImageCost } from '@/lib/ai-costs';

// LPデザイナーとしてのシステムプロンプト
const LP_DESIGNER_SYSTEM_PROMPT = `あなたはプロフェッショナルなLPデザイナーです。
1つのランディングページを構成する複数のセクション画像を生成します。

【最重要】1枚の長いLPを縦に分割したかのような一貫性を持たせてください：
- すべての画像は「同じ1枚の絵の一部」として見えるように
- 色調、照明、コントラスト、彩度を完全に統一
- 背景のグラデーションや色味が自然に繋がるように
- 同じカメラ、同じ照明条件で撮影されたかのような統一感

【色彩ルール】
- メインカラー: 1色を決めて全画像で使用
- アクセントカラー: 1〜2色のみ
- 背景: 同系色のグラデーションまたは単色
- 白/黒の使い方も統一

【スタイルルール】
- 写真風なら全部写真風、イラスト風なら全部イラスト風
- 人物の描写スタイル（リアル/イラスト）を統一
- オブジェクトの影の付け方を統一
- 余白の取り方、構図の傾向を統一

【絶対禁止】
- テキスト、文字、ロゴ、数字は一切含めない
- セクションごとに全く違う雰囲気にしない
- 急に色味やスタイルが変わるような画像
- 低品質、ぼやけた画像

すべての画像を並べた時に「1つの美しいLPのパーツ」として完璧に調和させてください。`;

// アスペクト比の設定
const ASPECT_RATIOS: Record<string, { width: number; height: number; prompt: string }> = {
    '9:16': { width: 768, height: 1366, prompt: '縦長の画像（アスペクト比 9:16）' },
    '3:4': { width: 768, height: 1024, prompt: 'ポートレート画像（アスペクト比 3:4）' },
    '1:1': { width: 1024, height: 1024, prompt: '正方形の画像（アスペクト比 1:1）' },
    '4:3': { width: 1024, height: 768, prompt: 'ランドスケープ画像（アスペクト比 4:3）' },
    '16:9': { width: 1366, height: 768, prompt: 'ワイド画像（アスペクト比 16:9）' },
};

export async function POST(request: NextRequest) {
    const startTime = createTimer();
    let imagePrompt = '';
    const modelUsed = 'gemini-3-pro-image-preview';

    // ユーザー認証を確認してAPIキーを取得
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // クレジット残高チェック
    const limitCheck = await checkImageGenerationLimit(user.id, 'gemini-3-pro-image-preview', 1);
    if (!limitCheck.allowed) {
        // FreeプランでAPIキー未設定の場合
        if (limitCheck.needApiKey) {
            return NextResponse.json({
                error: 'API_KEY_REQUIRED',
                message: limitCheck.reason,
            }, { status: 402 });
        }
        // サブスク未契約の場合
        if (limitCheck.needSubscription) {
            return NextResponse.json({
                error: 'SUBSCRIPTION_REQUIRED',
                message: limitCheck.reason,
            }, { status: 402 });
        }
        // クレジット不足の場合
        return NextResponse.json({
            error: 'INSUFFICIENT_CREDIT',
            message: limitCheck.reason,
            credits: {
                currentBalance: limitCheck.currentBalanceUsd,
                estimatedCost: limitCheck.estimatedCostUsd,
            },
            needPurchase: true,
        }, { status: 402 });
    }

    // クレジット消費をスキップするかどうか
    const skipCreditConsumption = limitCheck.skipCreditConsumption || false;

    try {
        const { prompt, taste, brandInfo, aspectRatio = '9:16', designDefinition } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const arConfig = ASPECT_RATIOS[aspectRatio] || ASPECT_RATIOS['9:16'];

        const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user.id);
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({ error: 'Google API key is not configured. 設定画面でAPIキーを設定してください。' }, { status: 500 });
        }

        // テイストに応じたスタイル指示
        const tasteStyles: Record<string, string> = {
            'ビジネス・信頼': '青系の落ち着いた色調、クリーンでプロフェッショナル、信頼感のあるビジネスライクなスタイル',
            'ポップ・親しみ': '明るくカラフル、親しみやすい、楽しげで活気のあるスタイル',
            '高級・洗練': 'ダークトーンまたはゴールド系、高級感、ミニマルで洗練されたスタイル',
            'シンプル・清潔': '白ベース、余白を活かした、清潔感のあるミニマルスタイル',
            '情熱・エモい': '赤やオレンジの暖色系、ダイナミック、感情に訴えかけるスタイル'
        };

        const styleInstruction = taste && tasteStyles[taste]
            ? `\n\n【指定されたテイスト】${taste}\nスタイル: ${tasteStyles[taste]}`
            : '';

        let designInstruction = '';
        if (designDefinition) {
            designInstruction = `
\n\n【DESIGN REFERENCE - STRICTLY FOLLOW】
Reference Vibe: ${designDefinition.vibe}
Colors: Primary=${designDefinition.colorPalette?.primary}, Background=${designDefinition.colorPalette?.background}
Visual Style: ${designDefinition.description}
Mood: ${designDefinition.typography?.mood}
Generate the image to EXACTLY match this visual style and color palette.
`;
        }

        const brandContext = brandInfo
            ? `\n\n【ブランド/商材情報】${brandInfo}`
            : '';

        // Gemini 3 Pro Image (Nano Banana Pro) で画像生成
        imagePrompt = `${prompt}${styleInstruction}${designInstruction}${brandContext}

【要件】
- ${arConfig.prompt}を生成すること
- このLPの他の画像と統一感のあるビジュアル
- 高解像度、シャープな画質
- LP/広告に適した構図
- テキストや文字は一切含めない（純粋な画像のみ）

【アスペクト比指定】
必ず${arConfig.prompt}で出力してください。幅${arConfig.width}px、高さ${arConfig.height}pxの比率。`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: LP_DESIGNER_SYSTEM_PROMPT }]
                    },
                    contents: [{
                        parts: [{ text: imagePrompt }]
                    }],
                    generationConfig: {
                        responseModalities: ["IMAGE", "TEXT"],
                        temperature: 0.8,  // 創造性を維持しつつ品質を安定
                        // 最高解像度出力
                        imageConfig: {
                            imageSize: "4K"  // LP用高解像度画像
                        }
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Image generation failed:', errorText);

            // ログ記録（失敗）
            await logGeneration({
                userId: user.id,
                type: 'image',
                endpoint: '/api/ai/generate-image',
                model: modelUsed,
                inputPrompt: imagePrompt,
                imageCount: 1,
                status: 'failed',
                errorMessage: `${response.status} - ${errorText.substring(0, 200)}`,
                startTime
            });

            throw new Error(`画像生成に失敗しました: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const result = await processImageResponse(data, arConfig, user.id);

        // ログ記録（成功）
        const logResult = await logGeneration({
            userId: user.id,
            type: 'image',
            endpoint: '/api/ai/generate-image',
            model: modelUsed,
            inputPrompt: imagePrompt,
            imageCount: 1,
            status: 'succeeded',
            startTime
        });

        // クレジット消費（自分のAPIキー使用時はスキップ）
        if (logResult && !skipCreditConsumption) {
            await recordApiUsage(user.id, logResult.id, logResult.estimatedCost, {
                model: modelUsed,
                imageCount: 1,
            });
        }

        return result;

    } catch (error: any) {
        console.error('Image Generation Error:', error);

        // ログ記録（エラー）
        await logGeneration({
            userId: user.id,
            type: 'image',
            endpoint: '/api/ai/generate-image',
            model: modelUsed,
            inputPrompt: imagePrompt || 'Error before prompt',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

async function processImageResponse(data: any, arConfig: { width: number; height: number; prompt: string }, userId: string | null) {
    const parts = data.candidates?.[0]?.content?.parts || [];
    let base64Image: string | null = null;

    for (const part of parts) {
        if (part.inlineData?.data) {
            base64Image = part.inlineData.data;
            break;
        }
    }

    if (!base64Image) {
        throw new Error('画像が生成されませんでした。プロンプトを変更してお試しください。');
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Image, 'base64');

    // Upload to Supabase Storage
    const filename = `nano-banana-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
    const { data: uploadData, error: uploadError } = await supabase
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

    // Get Public URL
    const { data: { publicUrl } } = supabase
        .storage
        .from('images')
        .getPublicUrl(filename);

    // Create DB Record with selected aspect ratio
    const media = await prisma.mediaImage.create({
        data: {
            userId,
            filePath: publicUrl,
            mime: 'image/png',
            width: arConfig.width,
            height: arConfig.height,
        },
    });

    return NextResponse.json(media);
}
