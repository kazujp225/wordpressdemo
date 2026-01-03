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
    creativity: z.enum(['low', 'medium', 'high']).default('medium'),
});

// creativity → temperature マッピング
const creativityToTemperature = {
    low: 0.3,
    medium: 0.5,
    high: 0.8,
};

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

    const { direction, topAmount, bottomAmount, prompt, referenceImageBase64, creativity } = validation.data;
    const temperature = creativityToTemperature[creativity];

    // 増築量チェック
    const actualTopAmount = direction === 'top' || direction === 'both' ? topAmount : 0;
    const actualBottomAmount = direction === 'bottom' || direction === 'both' ? bottomAmount : 0;
    const totalAmount = actualTopAmount + actualBottomAmount;

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

        log.info(`Restoring section ${sectionId}: ${direction} +${actualTopAmount}px top, +${actualBottomAmount}px bottom`);

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

        // === 拡張キャンバス方式 ===
        // 元画像を含む拡張キャンバスを作成し、拡張部分は白で埋める
        // この1枚の画像をGeminiに渡して「白い部分を補完して」と指示

        const newWidth = imageMeta.width;
        const newHeight = imageMeta.height + actualTopAmount + actualBottomAmount;

        log.info(`Creating extended canvas: ${newWidth}x${newHeight}px (original: ${imageMeta.width}x${imageMeta.height}px)`);

        // 拡張キャンバスを作成（白背景 + 元画像を配置）
        const extendedCanvas = await sharp({
            create: {
                width: newWidth,
                height: newHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
            },
        })
            .composite([
                {
                    input: imageBuffer,
                    top: actualTopAmount,  // 上に増築する場合、元画像は下にずらす
                    left: 0,
                },
            ])
            .png()
            .toBuffer();

        log.info(`Extended canvas created, sending to Gemini for inpainting...`);

        // Geminiに拡張キャンバスを渡して補完させる
        const generatedBuffer = await inpaintExtendedCanvas(
            extendedCanvas,
            newWidth,
            newHeight,
            actualTopAmount,
            actualBottomAmount,
            prompt,
            referenceImageBase64,
            googleApiKey,
            temperature
        );

        if (!generatedBuffer) {
            return Response.json({ error: '復元に失敗しました' }, { status: 500 });
        }

        // === セーフガード ===
        // Geminiが元画像部分を変更している可能性があるため、
        // 元画像を強制的に上書きして確実に維持する
        log.info(`Applying safeguard: preserving original image area...`);

        const restoredBuffer = await sharp(generatedBuffer)
            .composite([
                {
                    input: imageBuffer,
                    top: actualTopAmount,
                    left: 0,
                },
            ])
            .png()
            .toBuffer();

        // アップロード
        const timestamp = Date.now();
        const filename = `section-restored-${sectionId}-${timestamp}.png`;

        const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filename, restoredBuffer, {
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
        const newMeta = await sharp(restoredBuffer).metadata();
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
            imageCount: 1,
            status: 'succeeded',
            startTime,
        });

        log.success(`Section ${sectionId} restored: ${imageMeta.height}px → ${newHeight}px`);

        return Response.json({
            success: true,
            newImageUrl,
            newImageId: newMedia.id,
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

/**
 * 拡張キャンバス方式でインペイント
 * - 白い部分（拡張領域）を元画像に合わせて補完
 * - 元画像部分はそのまま維持
 */
async function inpaintExtendedCanvas(
    extendedCanvasBuffer: Buffer,
    width: number,
    height: number,
    topExtension: number,
    bottomExtension: number,
    userPrompt: string,
    referenceBase64: string | undefined,
    apiKey: string,
    temperature: number
): Promise<Buffer | null> {
    try {
        // 拡張領域の説明を作成
        let extensionDesc = '';
        if (topExtension > 0 && bottomExtension > 0) {
            extensionDesc = `上部${topExtension}pxと下部${bottomExtension}pxの白い領域`;
        } else if (topExtension > 0) {
            extensionDesc = `上部${topExtension}pxの白い領域`;
        } else {
            extensionDesc = `下部${bottomExtension}pxの白い領域`;
        }

        const prompt = `【画像補完タスク】

この画像には${extensionDesc}があります。
この白い部分は、元々存在していた内容がカット（切り取り）されて失われた部分です。

【復元指示】
${userPrompt}

【重要なルール】
1. 白い領域のみを補完してください
2. 元画像部分（白くない部分）は絶対に変更しないでください
3. 境界が自然に繋がるように補完してください
4. 元画像のデザインスタイル、色使い、雰囲気を維持してください
5. 画像全体を出力してください（同じサイズで）

白い領域を補完した完全な画像を生成してください。`;

        const parts: any[] = [];

        // 参考画像（あれば）
        if (referenceBase64) {
            const cleanRef = referenceBase64.replace(/^data:image\/\w+;base64,/, '');
            parts.push({ inlineData: { mimeType: 'image/png', data: cleanRef } });
            parts.push({ text: '【参考画像】この画像のデザインスタイルを参考にしてください。' });
        }

        // 拡張キャンバス（補完対象）
        parts.push({ inlineData: { mimeType: 'image/png', data: extendedCanvasBuffer.toString('base64') } });
        parts.push({ text: prompt });

        // Gemini 3.0 Pro（画像生成・編集に最適）を使用
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: {
                        responseModalities: ["IMAGE", "TEXT"],
                        temperature,
                    },
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
                const genMeta = await sharp(generatedBuffer).metadata();

                log.info(`Gemini returned: ${genMeta.width}x${genMeta.height}px (expected: ${width}x${height}px)`);

                // サイズが一致する場合はそのまま使用
                if (genMeta.width === width && genMeta.height === height) {
                    log.success(`Perfect size match!`);
                    return generatedBuffer;
                }

                // サイズが異なる場合は調整（ただし歪みを最小限に）
                if (genMeta.width && genMeta.height) {
                    // アスペクト比がほぼ同じならリサイズ
                    const expectedRatio = width / height;
                    const actualRatio = genMeta.width / genMeta.height;
                    const ratioDiff = Math.abs(expectedRatio - actualRatio);

                    if (ratioDiff < 0.1) {
                        // アスペクト比が近い場合、単純リサイズ
                        log.info(`Aspect ratio close (diff: ${ratioDiff.toFixed(3)}), resizing...`);
                        const resized = await sharp(generatedBuffer)
                            .resize(width, height, { fit: 'fill' })
                            .png()
                            .toBuffer();
                        return resized;
                    } else {
                        // アスペクト比が大きく異なる場合、containで対応
                        log.info(`Aspect ratio different (diff: ${ratioDiff.toFixed(3)}), using contain...`);
                        const resized = await sharp(generatedBuffer)
                            .resize(width, height, {
                                fit: 'contain',
                                background: { r: 255, g: 255, b: 255, alpha: 1 },
                            })
                            .png()
                            .toBuffer();
                        return resized;
                    }
                }

                return generatedBuffer;
            }
        }

        log.error('No image in Gemini response');
        return null;

    } catch (error: any) {
        log.error(`Inpaint error: ${error.message}`);
        return null;
    }
}
