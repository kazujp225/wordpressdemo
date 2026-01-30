import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import { prisma } from '@/lib/db';
import { getGoogleApiKey } from '@/lib/apiKeys';
import { createClient } from '@/lib/supabase/server';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkTextGenerationLimit, recordApiUsage } from '@/lib/usage';

export async function POST(request: NextRequest) {
    const startTime = createTimer();
    const prompt = '';

    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // クレジット残高チェック
    const limitCheck = await checkTextGenerationLimit(user.id, 'gemini-2.0-flash', 2000, 4000);
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
        const { productInfo, taste, sections, designDefinition } = await request.json();

        const apiKey = await getGoogleApiKey();
        if (!apiKey) {
            return NextResponse.json({ error: 'Google API key is not configured. 設定画面でAPIキーを設定してください。' }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        // Use Gemini 2.0 Flash - fast and cost-effective text model
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        if (!sections || sections.length === 0) {
            return NextResponse.json({ error: '画像がありません。' }, { status: 400 });
        }

        // Mapping info for the AI
        const mappingInfo = sections.map((s: any, i: number) => {
            return `[Section ${i + 1}] ID: ${s.id} | Role: ${s.role || 'unknown'}`;
        }).join('\n');

        // 1. Process images (Stitching)
        const buffers = await Promise.all(sections.map(async (s: any) => {
            let buffer: Buffer;
            if (s.base64 && s.base64.includes('base64,')) {
                buffer = Buffer.from(s.base64.split(',')[1], 'base64');
            } else if (s.image?.filePath) {
                // Fetch from Supabase URL if it's already uploaded
                const res = await fetch(s.image.filePath);
                buffer = Buffer.from(await res.arrayBuffer());
            } else {
                return null;
            }

            try {
                const metadata = await sharp(buffer).metadata();
                return { buffer, metadata, id: s.id };
            } catch (e) {
                console.error('Sharp metadata error:', e);
                return null;
            }
        })).then(res => res.filter((r): r is any => r !== null));

        if (buffers.length === 0) {
            return NextResponse.json({ error: '分析できる画像が見つかりません。' }, { status: 400 });
        }

        const STITCH_LIMIT = 10000;
        const canvasWidth = 800;

        // Dynamic resizing to fit within Gemini/Sharp limits
        // If many sections, reduce individual image height to fit total limit
        let scaleFactor = 1.0;
        const initialTotalHeight = buffers.reduce((acc, img) => acc + (img.metadata.height || 0) * (canvasWidth / (img.metadata.width || 800)), 0);

        if (initialTotalHeight > STITCH_LIMIT) {
            scaleFactor = STITCH_LIMIT / initialTotalHeight;
        }

        let currentY = 0;
        const processedImages = await Promise.all(buffers.map(async (img) => {
            const targetWidth = Math.floor(canvasWidth);
            const targetHeight = Math.floor((img.metadata.height || 0) * (canvasWidth / (img.metadata.width || 800)) * scaleFactor);

            const resized = await sharp(img.buffer)
                .resize(targetWidth, targetHeight, { fit: 'fill' })
                .toBuffer();

            const top = currentY;
            currentY += targetHeight;
            return { input: resized, top, left: 0 };
        }));

        const stitchedImage = await sharp({
            create: {
                width: canvasWidth,
                height: Math.max(1, Math.min(currentY, STITCH_LIMIT)),
                channels: 3,
                background: { r: 255, g: 255, b: 255 }
            }
        })
            .composite(processedImages)
            .jpeg({ quality: 75 }) // Slightly lower quality to save bandwidth
            .toBuffer();

        const prompt = `
            あなたは、数々の億単位の売上を叩き出してきた【超一流のLPシニアクリエイティブディレクター】です。
            渡された「LPの下書き画像」の構成を維持しつつ、中身（商材）を「完全に指定の商材にリブランディング」してください。

            【リブランディング指示：最優先！】
            1. 新商材情報: "${productInfo}"
            2. 全体のテイスト: "${taste}"
            ${designDefinition ? `
            3. 【重要】デザインリファレンスからの指示:
               - Vibe: ${designDefinition.vibe}
               - Description: ${designDefinition.description}
               - Mood: ${designDefinition.typography?.mood}
               このデザインの雰囲気にマッチする言葉選びとトーン＆マナーを徹底してください。
            ` : ''}

            【重要：画像は「レイアウト構成のヒント」としてのみ扱うこと】
            アップロードされた画像に含まれるテキストや商材情報は、一切無視してください。
            今回の絶対的な任務は、画像が示しているセクション構成（hero, solution 等）を維持しつつ、中身を"${productInfo}"に「完全に、かつ戦略的に」書き換えることです。
            業界プリセット（legal等）が指定されている場合は、その規制やトーンを厳守せよ。

            【セクション構成（上から順に並んでいます）】
            ${mappingInfo}

            【思考ステップ (Strategic Thinking)】
            1. 役割の解析: 各セクションの ID と Roleを確認し、指定商材("${productInfo}")におけるそのセクションの最適な訴求ポイントを定義せよ。
            2. コピー執筆: テイスト("${taste}")に基づき、ターゲットに刺さるキャッチコピーをセクションごとに生成せよ。
            3. マッピング: 各セクションの ID を一字一句違わずに JSON に埋め込め。絶対に捏造するな。

            【重要：マッピングルール】
            渡された各セクションの ID ("temp-..." または数値) を、一字一句違わずに JSON の "id" フィールドに設定してください。「Section 1」などの番号や「ID=」などの文字は含めず、純粋なID文字列/数値のみを入れること。

            出力形式（JSON配列のみ。余計な解説は不要。省略禁止）:
            [
              {
                "id": "ここに mappingInfo の各 ID (例: temp-xxx または 7) を正確に入れる",
                "text": "生成された戦略的コピー",
                "dsl": {
                  "strategy_intent": "このセクションでユーザーの心理をどう動かそうとしているか",
                  "constraints": "文字数、必須キーワード、ベネフィット",
                  "preset": "現在のプリセット（継続または最適化）",
                  "tone": "${taste} に基づく詳細なトーン指定",
                  "image_intent": "このセクションにふさわしい画像の構図・色彩指示"
                }
              }
            ]
        `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: stitchedImage.toString('base64'),
                    mimeType: "image/jpeg"
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            // 失敗ログの記録
            await logGeneration({
                userId: user.id,
                type: 'copy',
                endpoint: '/api/ai/generate-copy',
                model: 'gemini-2.0-flash',
                inputPrompt: prompt,
                outputResult: text,
                status: 'failed',
                errorMessage: 'JSON format mismatch',
                startTime
            });
            throw new Error('JSONの生成に失敗しました。');
        }

        const resultData = JSON.parse(jsonMatch[0]);

        // 成功ログの記録
        const logResult = await logGeneration({
            userId: user.id,
            type: 'copy',
            endpoint: '/api/ai/generate-copy',
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
        console.error('Gemini Copy Generation Final Error:', error);
        await logGeneration({
            userId: user.id,
            type: 'copy',
            endpoint: '/api/ai/generate-copy',
            model: 'gemini-2.0-flash',
            inputPrompt: prompt || 'Error occurred before prompt finalization',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });
        return NextResponse.json({
            error: 'AI Copy Generation Failed',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
