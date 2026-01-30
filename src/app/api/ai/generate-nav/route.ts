import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import { prisma } from '@/lib/db';
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
        const { sections } = await request.json();

        if (!sections || sections.length === 0) {
            return NextResponse.json({ error: '画像がありません。' }, { status: 400 });
        }

        const apiKey = await getGoogleApiKeyForUser(user.id);
        if (!apiKey) {
            return NextResponse.json({ error: '設定画面でAPIキーを設定してください。' }, { status: 500 });
        }
        const genAI = new GoogleGenerativeAI(apiKey);

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Mapping info for context
        const mappingInfo = sections.map((s: any, i: number) => `Section ${i + 1}: ${s.role || 'unknown'}`).join('\n');

        // 1. Process images (Stitching for context)
        const buffers = await Promise.all(sections.map(async (s: any) => {
            let buffer: Buffer;
            if (s.base64 && s.base64.includes('base64,')) {
                buffer = Buffer.from(s.base64.split(',')[1], 'base64');
            } else if (s.image?.filePath) {
                const res = await fetch(s.image.filePath);
                buffer = Buffer.from(await res.arrayBuffer());
            } else {
                return null;
            }
            try {
                const metadata = await sharp(buffer).metadata();
                return { buffer, metadata };
            } catch (e) { return null; }
        })).then(res => res.filter((r): r is any => r !== null));

        if (buffers.length === 0) {
            return NextResponse.json({ error: '分析できる画像が見つかりません。' }, { status: 400 });
        }

        const STITCH_LIMIT = 8000;
        const canvasWidth = 800;

        // Dynamic resizing for nav context
        let scaleFactor = 1.0;
        const initialTotalHeight = buffers.slice(0, 10).reduce((acc, img) => acc + (img.metadata.height || 0) * (canvasWidth / (img.metadata.width || 800)), 0);

        if (initialTotalHeight > STITCH_LIMIT) {
            scaleFactor = STITCH_LIMIT / initialTotalHeight;
        }

        let currentY = 0;
        const processedImages = await Promise.all(buffers.slice(0, 10).map(async (img) => {
            const targetWidth = Math.floor(canvasWidth);
            const targetHeight = Math.floor((img.metadata.height || 0) * (canvasWidth / (img.metadata.width || 800)) * scaleFactor);

            const resized = await sharp(img.buffer).resize(targetWidth, targetHeight).toBuffer();

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
        }).composite(processedImages).jpeg({ quality: 80 }).toBuffer();

        prompt = `
            あなたはLP専門のUI/UXディレクターです。
            提出されたLPの下書き画像を見て、この商材に最適な「共通ナビゲーション（ヘッダー）」の構成を提案してください。

            指示:
            1. ロゴ名（商材名またはブランド名）を決定。
            2. メニュー項目を4〜5個提案（例: 「特徴」「料金」「お客様の声」「Q&A」など、画像の内容に合わせる）。
            3. 各メニュー。
            4. CTAボタンの文言（「今すぐ申し込む」「無料体験」など、商材に合わせる）。

            出力形式（JSONのみ）:
            {
              "logoText": "ブランド名",
              "navItems": [
                {"label": "項目名", "href": "#id名（役割）"},
                ...
              ],
              "ctaText": "CTAボタン文言"
            }
        `;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: stitchedImage.toString('base64'), mimeType: "image/jpeg" } }
        ]);

        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('JSON生成失敗');

        const navConfig = JSON.parse(jsonMatch[0]);

        // ログ記録（成功）
        const logResult = await logGeneration({
            userId: user.id,
            type: 'generate-nav',
            endpoint: '/api/ai/generate-nav',
            model: 'gemini-2.0-flash',
            inputPrompt: prompt,
            outputResult: JSON.stringify(navConfig),
            status: 'succeeded',
            startTime
        });

        // クレジット消費
        if (logResult && !skipCreditConsumption) {
            await recordApiUsage(user.id, logResult.id, logResult.estimatedCost, { model: 'gemini-2.0-flash' });
        }

        return NextResponse.json(navConfig);
    } catch (error: any) {
        console.error('AI Nav Generation Final Error:', error);

        // ログ記録（エラー）
        await logGeneration({
            userId: user.id,
            type: 'generate-nav',
            endpoint: '/api/ai/generate-nav',
            model: 'gemini-2.0-flash',
            inputPrompt: prompt || 'Error before prompt',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        return NextResponse.json({
            error: 'AI Nav Generation Failed',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
