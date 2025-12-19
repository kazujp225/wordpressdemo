import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import { prisma } from '@/lib/db';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export async function POST(request: NextRequest) {
    try {
        const { sections } = await request.json();

        if (!sections || sections.length === 0) {
            return NextResponse.json({ error: '画像がありません。' }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

        // Simple stitch to give Gemini full page context
        const canvasWidth = 800;
        let currentY = 0;
        const processedImages = await Promise.all(buffers.slice(0, 5).map(async (img) => { // Sample top 5
            const resized = await sharp(img.buffer).resize(canvasWidth).toBuffer();
            const metadata = await sharp(resized).metadata();
            const top = currentY;
            currentY += metadata.height || 0;
            return { input: resized, top, left: 0 };
        }));

        const stitchedImage = await sharp({
            create: {
                width: canvasWidth,
                height: Math.min(currentY, 8000),
                channels: 3,
                background: { r: 255, g: 255, b: 255 }
            }
        }).composite(processedImages).jpeg({ quality: 80 }).toBuffer();

        const prompt = `
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

        return NextResponse.json(navConfig);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
