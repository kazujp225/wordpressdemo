import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { z } from 'zod';

const log = {
    info: (msg: string) => console.log(`\x1b[36m[RESTORE]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[RESTORE]\x1b[0m ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[RESTORE]\x1b[0m ${msg}`),
};

const restoreSchema = z.object({
    direction: z.enum(['top', 'bottom', 'both']),
    topAmount: z.number().min(0).max(500).default(0),
    bottomAmount: z.number().min(0).max(500).default(0),
    prompt: z.string().min(1).max(1000),
    referenceImageBase64: z.string().optional(),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const sectionId = parseInt(id, 10);

    if (isNaN(sectionId)) {
        return Response.json({ error: 'Invalid section ID' }, { status: 400 });
    }

    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = restoreSchema.safeParse(body);

    if (!validation.success) {
        return Response.json({ error: 'Validation failed', details: validation.error.issues }, { status: 400 });
    }

    const { direction, topAmount, bottomAmount, prompt, referenceImageBase64 } = validation.data;

    // 増築量チェック
    const totalAmount = (direction === 'top' ? topAmount : 0) +
                       (direction === 'bottom' ? bottomAmount : 0) +
                       (direction === 'both' ? topAmount + bottomAmount : 0);

    if (totalAmount < 10) {
        return Response.json({ error: '増築量が少なすぎます' }, { status: 400 });
    }

    try {
        const startTime = createTimer();

        // セクション取得
        const section = await prisma.pageSection.findUnique({
            where: { id: sectionId },
            include: { image: true },
        });

        if (!section?.image?.filePath) {
            return Response.json({ error: 'Section or image not found' }, { status: 404 });
        }

        log.info(`Restoring section ${sectionId}: ${direction} +${topAmount}px top, +${bottomAmount}px bottom`);

        // 現在の画像を取得
        const imageResponse = await fetch(section.image.filePath);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        const imageMeta = await sharp(imageBuffer).metadata();

        if (!imageMeta.width || !imageMeta.height) {
            return Response.json({ error: 'Failed to get image metadata' }, { status: 500 });
        }

        const googleApiKey = await getGoogleApiKeyForUser(user.id);
        if (!googleApiKey) {
            return Response.json({ error: 'Google API key not configured' }, { status: 500 });
        }

        // 新しい画像サイズ
        const newWidth = imageMeta.width;
        const actualTopAmount = direction === 'top' || direction === 'both' ? topAmount : 0;
        const actualBottomAmount = direction === 'bottom' || direction === 'both' ? bottomAmount : 0;
        const newHeight = imageMeta.height + actualTopAmount + actualBottomAmount;

        // コンテキスト用の画像部分を取得
        const contextHeight = Math.min(150, Math.floor(imageMeta.height * 0.2));

        let topContext: Buffer | null = null;
        let bottomContext: Buffer | null = null;

        if (actualTopAmount > 0) {
            // 上を増築する場合、現在の画像の上端をコンテキストとして使用
            topContext = await sharp(imageBuffer)
                .extract({
                    left: 0,
                    top: 0,
                    width: imageMeta.width,
                    height: contextHeight,
                })
                .toBuffer();
        }

        if (actualBottomAmount > 0) {
            // 下を増築する場合、現在の画像の下端をコンテキストとして使用
            bottomContext = await sharp(imageBuffer)
                .extract({
                    left: 0,
                    top: imageMeta.height - contextHeight,
                    width: imageMeta.width,
                    height: contextHeight,
                })
                .toBuffer();
        }

        // 増築部分を生成
        let topExtension: Buffer | null = null;
        let bottomExtension: Buffer | null = null;

        if (actualTopAmount > 0 && topContext) {
            log.info(`Generating top extension: ${newWidth}x${actualTopAmount}px`);
            topExtension = await generateExtension(
                topContext,
                newWidth,
                actualTopAmount,
                'top',
                prompt,
                referenceImageBase64,
                googleApiKey
            );
        }

        if (actualBottomAmount > 0 && bottomContext) {
            log.info(`Generating bottom extension: ${newWidth}x${actualBottomAmount}px`);
            bottomExtension = await generateExtension(
                bottomContext,
                newWidth,
                actualBottomAmount,
                'bottom',
                prompt,
                referenceImageBase64,
                googleApiKey
            );
        }

        // 画像を合成
        const composites: sharp.OverlayOptions[] = [];

        // 上の増築部分
        if (topExtension) {
            composites.push({
                input: topExtension,
                top: 0,
                left: 0,
            });
        }

        // 元の画像
        composites.push({
            input: imageBuffer,
            top: actualTopAmount,
            left: 0,
        });

        // 下の増築部分
        if (bottomExtension) {
            composites.push({
                input: bottomExtension,
                top: actualTopAmount + imageMeta.height,
                left: 0,
            });
        }

        // 新しい画像を作成
        const newImageBuffer = await sharp({
            create: {
                width: newWidth,
                height: newHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
            },
        })
            .composite(composites)
            .png()
            .toBuffer();

        // アップロード
        const timestamp = Date.now();
        const filename = `section-restored-${sectionId}-${timestamp}.png`;

        const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filename, newImageBuffer, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            log.error(`Upload error: ${uploadError.message}`);
            return Response.json({ error: 'Upload failed' }, { status: 500 });
        }

        const newImageUrl = supabase.storage.from('images').getPublicUrl(filename).data.publicUrl;

        // MediaImage作成
        const newMeta = await sharp(newImageBuffer).metadata();
        const newMedia = await prisma.mediaImage.create({
            data: {
                filePath: newImageUrl,
                mime: 'image/png',
                width: newMeta.width || 0,
                height: newMeta.height || 0,
                sourceType: 'restored',
            },
        });

        // セクション更新
        await prisma.pageSection.update({
            where: { id: sectionId },
            data: { imageId: newMedia.id },
        });

        await logGeneration({
            userId: user.id,
            type: 'boundary-design',
            endpoint: `/api/sections/${sectionId}/restore`,
            model: 'gemini-3-pro-image-preview',
            inputPrompt: prompt,
            imageCount: (topExtension ? 1 : 0) + (bottomExtension ? 1 : 0),
            status: 'succeeded',
            startTime,
        });

        log.success(`Section ${sectionId} restored: ${imageMeta.height}px → ${newHeight}px`);

        return Response.json({
            success: true,
            newImageUrl,
            newWidth,
            newHeight,
            addedTop: actualTopAmount,
            addedBottom: actualBottomAmount,
        });

    } catch (error: any) {
        log.error(`Restore error: ${error.message}`);
        return Response.json({ error: error.message }, { status: 500 });
    }
}

async function generateExtension(
    contextBuffer: Buffer,
    width: number,
    height: number,
    position: 'top' | 'bottom',
    userPrompt: string,
    referenceBase64: string | undefined,
    apiKey: string
): Promise<Buffer | null> {
    const positionText = position === 'top' ? '上' : '下';

    const prompt = `【重要】これは画像の「復元・修復」タスクです。

添付した画像は、元々もっと大きな画像の一部でしたが、誤ってカット（切り取り）されてしまい、${positionText}側の部分が失われてしまいました。

あなたのタスクは、失われた${positionText}側の部分を復元することです。

【復元する内容（ユーザーからの説明）】
${userPrompt}

【技術的な指示】
- 出力サイズ: ${width}px × ${height}px（この通りに生成してください）
- 添付画像の${position === 'top' ? '上端' : '下端'}と、生成画像の${position === 'top' ? '下端' : '上端'}が完全にシームレスに繋がるようにしてください
- 添付画像のデザインスタイル、色調、フォント、レイアウトを正確に継続してください
- 特に文字やUIコンポーネントがある場合は、それらを正確に復元してください
- 日本語テキストは正確に、読みやすく生成してください
${referenceBase64 ? '- 参考画像のスタイルも考慮してください' : ''}

添付画像を注意深く観察し、失われた部分を自然に復元してください。`;

    try {
        const parts: any[] = [
            { inlineData: { mimeType: 'image/png', data: contextBuffer.toString('base64') } },
            { text: `【添付画像】これが現在残っている画像の${positionText}端です。この${position === 'top' ? '上' : '下'}に、失われた部分を復元して追加してください。画像のスタイル、色、デザインを継続させてください。` },
        ];

        if (referenceBase64) {
            const cleanRef = referenceBase64.replace(/^data:image\/\w+;base64,/, '');
            parts.push({ inlineData: { mimeType: 'image/png', data: cleanRef } });
            parts.push({ text: '【参考画像】この画像のスタイルや内容を参考にしてください。' });
        }

        parts.push({ text: prompt });

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
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
            return null;
        }

        const data = await response.json();
        const responseParts = data.candidates?.[0]?.content?.parts || [];

        for (const part of responseParts) {
            if (part.inlineData?.data) {
                const generatedBuffer = Buffer.from(part.inlineData.data, 'base64');

                // 指定サイズにリサイズ
                const resizedBuffer = await sharp(generatedBuffer)
                    .resize(width, height, { fit: 'cover', position: position === 'top' ? 'bottom' : 'top' })
                    .png()
                    .toBuffer();

                return resizedBuffer;
            }
        }

        return null;
    } catch (error: any) {
        log.error(`Generation error: ${error.message}`);
        return null;
    }
}
