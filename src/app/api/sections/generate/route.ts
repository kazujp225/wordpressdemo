import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { z } from 'zod';

const log = {
    info: (msg: string) => console.log(`\x1b[36m[GENERATE]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[GENERATE]\x1b[0m ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[GENERATE]\x1b[0m ${msg}`),
};

const generateSchema = z.object({
    prompt: z.string().min(1).max(2000),
    width: z.number().min(100).max(2000).default(750),
    height: z.number().min(100).max(2000).default(400),
    prevImageUrl: z.string().url().optional(),
    nextImageUrl: z.string().url().optional(),
    designDefinition: z.any().optional(),
});

export async function POST(request: NextRequest) {
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = generateSchema.safeParse(body);

    if (!validation.success) {
        return Response.json({ error: 'Validation failed', details: validation.error.issues }, { status: 400 });
    }

    const { prompt, width, height, prevImageUrl, nextImageUrl, designDefinition } = validation.data;

    try {
        const startTime = createTimer();

        const googleApiKey = await getGoogleApiKeyForUser(user.id);
        if (!googleApiKey) {
            return Response.json({ error: 'Google API key not configured' }, { status: 500 });
        }

        log.info(`Generating section: ${width}x${height}px`);

        // デザイン定義からスタイル説明を生成
        let styleDescription = '';
        if (designDefinition) {
            const colors = designDefinition.colorPalette || {};
            const colorDesc = [
                colors.primary && `メインカラー: ${colors.primary}`,
                colors.secondary && `サブカラー: ${colors.secondary}`,
                colors.accent && `アクセントカラー: ${colors.accent}`,
                colors.background && `背景色: ${colors.background}`,
            ].filter(Boolean).join('、');

            styleDescription = `
【デザイン定義（厳守）】
${designDefinition.vibe ? `雰囲気: ${designDefinition.vibe}` : ''}
${designDefinition.description ? `特徴: ${designDefinition.description}` : ''}
${colorDesc ? `カラー: ${colorDesc}` : ''}
${designDefinition.typography?.headingStyle ? `見出し: ${designDefinition.typography.headingStyle}` : ''}
${designDefinition.style?.buttonStyle ? `ボタン: ${designDefinition.style.buttonStyle}` : ''}
`;
        }

        // コンテキスト画像を取得
        const contextParts: any[] = [];

        if (prevImageUrl) {
            try {
                const prevResponse = await fetch(prevImageUrl);
                const prevBuffer = Buffer.from(await prevResponse.arrayBuffer());
                const prevMeta = await sharp(prevBuffer).metadata();

                // 下端100pxをコンテキストとして使用
                const contextHeight = Math.min(100, Math.floor((prevMeta.height || 100) * 0.15));
                const prevContext = await sharp(prevBuffer)
                    .extract({
                        left: 0,
                        top: (prevMeta.height || 100) - contextHeight,
                        width: prevMeta.width || width,
                        height: contextHeight,
                    })
                    .toBuffer();

                contextParts.push({ inlineData: { mimeType: 'image/png', data: prevContext.toString('base64') } });
                contextParts.push({ text: '↑ 上のセクションの下端（この下に新しいセクションが来る）' });
            } catch (e: any) {
                log.error(`Failed to load prev image: ${e.message}`);
            }
        }

        if (nextImageUrl) {
            try {
                const nextResponse = await fetch(nextImageUrl);
                const nextBuffer = Buffer.from(await nextResponse.arrayBuffer());
                const nextMeta = await sharp(nextBuffer).metadata();

                // 上端100pxをコンテキストとして使用
                const contextHeight = Math.min(100, Math.floor((nextMeta.height || 100) * 0.15));
                const nextContext = await sharp(nextBuffer)
                    .extract({
                        left: 0,
                        top: 0,
                        width: nextMeta.width || width,
                        height: contextHeight,
                    })
                    .toBuffer();

                contextParts.push({ inlineData: { mimeType: 'image/png', data: nextContext.toString('base64') } });
                contextParts.push({ text: '↑ 下のセクションの上端（新しいセクションの下にこれが来る）' });
            } catch (e: any) {
                log.error(`Failed to load next image: ${e.message}`);
            }
        }

        const fullPrompt = `LPのセクション画像を生成してください。

【生成内容】
${prompt}

【出力サイズ】${width}px × ${height}px（厳守）

${styleDescription}

【重要なルール】
- 日本語テキストは正確に、読みやすく生成してください
- プロフェッショナルなWebデザインの品質で生成してください
${prevImageUrl ? '- 上のセクションとデザインの連続性を保ってください（色調、スタイルを合わせる）' : ''}
${nextImageUrl ? '- 下のセクションとデザインの連続性を保ってください（色調、スタイルを合わせる）' : ''}
${prevImageUrl || nextImageUrl ? '- 境界が自然に繋がるようにしてください' : ''}

${width}x${height}pxの画像を1枚だけ生成してください。`;

        const parts: any[] = [...contextParts, { text: fullPrompt }];

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${googleApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            log.error(`API error: ${errorText}`);
            return Response.json({ error: 'AI generation failed' }, { status: 500 });
        }

        const data = await response.json();
        const responseParts = data.candidates?.[0]?.content?.parts || [];

        let generatedBuffer: Buffer | null = null;
        for (const part of responseParts) {
            if (part.inlineData?.data) {
                generatedBuffer = Buffer.from(part.inlineData.data, 'base64');
                break;
            }
        }

        if (!generatedBuffer) {
            log.error('No image data in response');
            return Response.json({ error: 'AI did not generate an image' }, { status: 500 });
        }

        // 指定サイズにリサイズ
        const resizedBuffer = await sharp(generatedBuffer)
            .resize(width, height, { fit: 'cover', position: 'center' })
            .png()
            .toBuffer();

        // アップロード
        const timestamp = Date.now();
        const filename = `section-generated-${timestamp}.png`;

        const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filename, resizedBuffer, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            log.error(`Upload error: ${uploadError.message}`);
            return Response.json({ error: 'Upload failed' }, { status: 500 });
        }

        const imageUrl = supabase.storage.from('images').getPublicUrl(filename).data.publicUrl;

        // MediaImage作成
        const meta = await sharp(resizedBuffer).metadata();
        const media = await prisma.mediaImage.create({
            data: {
                filePath: imageUrl,
                mime: 'image/png',
                width: meta.width || width,
                height: meta.height || height,
                sourceType: 'generated',
            },
        });

        await logGeneration({
            userId: user.id,
            type: 'section-generate',
            endpoint: '/api/sections/generate',
            model: 'gemini-3-pro-image-preview',
            inputPrompt: prompt,
            imageCount: 1,
            status: 'succeeded',
            startTime,
        });

        log.success(`Section generated: ${meta.width}x${meta.height}px`);

        return Response.json({
            success: true,
            imageUrl,
            mediaId: media.id,
            width: meta.width,
            height: meta.height,
        });

    } catch (error: any) {
        log.error(`Generate error: ${error.message}`);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
