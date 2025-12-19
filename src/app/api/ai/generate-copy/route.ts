import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import { prisma } from '@/lib/db';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export async function POST(request: NextRequest) {
    try {
        const { productInfo, taste, sections } = await request.json();

        // Use the stable model identifier to resolve 404 errors (v1beta requires specific versions sometimes)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        if (!sections || sections.length === 0) {
            return NextResponse.json({ error: '画像がありません。' }, { status: 400 });
        }

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

        const canvasWidth = 800;
        let currentY = 0;
        const processedImages = await Promise.all(buffers.map(async (img) => {
            const resized = await sharp(img.buffer).resize(canvasWidth).toBuffer();
            const metadata = await sharp(resized).metadata();
            const top = currentY;
            currentY += metadata.height || 0;
            return { input: resized, top, left: 0 };
        }));

        const stitchedImage = await sharp({
            create: {
                width: canvasWidth,
                height: Math.min(currentY, 10000), // Cap height for Gemini stability
                channels: 3,
                background: { r: 255, g: 255, b: 255 }
            }
        })
            .composite(processedImages)
            .jpeg({ quality: 80 })
            .toBuffer();

        const prompt = `
            あなたはLP専属のプロコピーライター兼ディレクターです。
            全画像を縦に繋ぎ合わせた「1枚の開発中LP（下書き）」を見て、全体のストーリーが繋がるように各セクションに最適な日本語キャッチコピーを提案し、さらに実務運用に耐えうる「設計データ（DSL）」を定義してください。
            
            【重要】リブランディング指示:
            - 今回のプロモーション内容: "${productInfo || '特に指定なし（画像から推測してください）'}"
            - 全体のテイスト: "${taste || 'professional'}" (例: popsなら親しみやすく、luxuryなら格調高く)
            
            ※もしプロモーション内容に別の商材への書き換え指示がある場合は、**その指示を最優先**し、画像はイメージとして扱いながら、文言と設計は完全に新しい商材向けに構築してください。

            入力情報:
            - 各セクションのID: ${buffers.map(b => b.id).join(', ')}

            出力形式（純粋なJSON配列のみ）:
            [
              {
                "id": "セクションID",
                "text": "生成されたキャッチコピー",
                "dsl": {
                  "constraints": "文字数、必須キーワード、訴求ポイントの制約",
                  "brand_guidelines": "語尾（ですます等）、ブランドトーン、表記揺れルール",
                  "image_intent": "このセクションの画像に込める意図、構図、避けるべき要素"
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
            await prisma.generationRun.create({
                data: {
                    type: 'copy',
                    model: "gemini-1.5-flash-001",
                    inputPrompt: prompt,
                    outputResult: text,
                    status: "failed",
                    errorMessage: "JSON format mismatch"
                }
            });
            throw new Error('JSONの生成に失敗しました。');
        }

        const resultData = JSON.parse(jsonMatch[0]);

        // 成功ログの記録
        await prisma.generationRun.create({
            data: {
                type: 'copy',
                model: "gemini-1.5-flash-001",
                inputPrompt: prompt,
                outputResult: JSON.stringify(resultData),
                status: "succeeded"
            }
        });

        return NextResponse.json(resultData);
    } catch (error: any) {
        console.error('Gemini Final Error:', error);
        // エラーログの記録
        try {
            await prisma.generationRun.create({
                data: {
                    type: 'copy',
                    model: "gemini-1.5-flash-001",
                    inputPrompt: "Error occurred before prompt finalization",
                    status: "failed",
                    errorMessage: error.message
                }
            });
        } catch (e) { }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
