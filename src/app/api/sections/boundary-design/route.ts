import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { z } from 'zod';

const log = {
    info: (msg: string) => console.log(`\x1b[36m[BOUNDARY]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[BOUNDARY]\x1b[0m ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[BOUNDARY]\x1b[0m ${msg}`),
};

// シンプルなバリデーション
const boundarySchema = z.object({
    boundaries: z.array(z.object({
        upperSectionId: z.number(),
        lowerSectionId: z.number(),
        upperCut: z.number().min(0).max(500), // 上セクションから切る量
        lowerCut: z.number().min(0).max(500), // 下セクションから切る量
    })).min(1).max(20),
    referenceImageBase64: z.string().optional(),
});

// 画像をカットして境界画像を生成
async function processAndGenerate(
    upperBuffer: Buffer,
    lowerBuffer: Buffer,
    upperCut: number,
    lowerCut: number,
    referenceBase64: string | undefined,
    apiKey: string,
    userId: string
): Promise<{
    newUpperBuffer: Buffer;
    newLowerBuffer: Buffer;
    boundaryBuffer: Buffer;
    boundaryHeight: number;
} | null> {
    const startTime = createTimer();

    const upperMeta = await sharp(upperBuffer).metadata();
    const lowerMeta = await sharp(lowerBuffer).metadata();

    if (!upperMeta.width || !upperMeta.height || !lowerMeta.width || !lowerMeta.height) {
        throw new Error('Failed to get image metadata');
    }

    const targetWidth = Math.min(upperMeta.width, lowerMeta.width);
    const boundaryHeight = upperCut + lowerCut;

    if (boundaryHeight < 10) {
        throw new Error('Cut amount too small');
    }

    // 上セクションをカット（下端を削除）
    const newUpperBuffer = await sharp(upperBuffer)
        .extract({
            left: 0,
            top: 0,
            width: upperMeta.width,
            height: upperMeta.height - upperCut,
        })
        .toBuffer();

    // 下セクションをカット（上端を削除）
    const newLowerBuffer = await sharp(lowerBuffer)
        .extract({
            left: 0,
            top: lowerCut,
            width: lowerMeta.width,
            height: lowerMeta.height - lowerCut,
        })
        .toBuffer();

    // コンテキスト用：カット後の上セクション下端
    const upperContextHeight = Math.min(100, Math.floor((upperMeta.height - upperCut) * 0.15));
    const upperContext = await sharp(newUpperBuffer)
        .extract({
            left: 0,
            top: upperMeta.height - upperCut - upperContextHeight,
            width: upperMeta.width,
            height: upperContextHeight,
        })
        .toBuffer();

    // コンテキスト用：カット後の下セクション上端
    const lowerContextHeight = Math.min(100, Math.floor((lowerMeta.height - lowerCut) * 0.15));
    const lowerContext = await sharp(newLowerBuffer)
        .extract({
            left: 0,
            top: 0,
            width: lowerMeta.width,
            height: lowerContextHeight,
        })
        .toBuffer();

    const prompt = `LPの境界画像を生成してください。

【タスク】
1枚目の画像（上セクションの下端）と2枚目の画像（下セクションの上端）を自然に繋ぐ境界画像を生成します。

【出力サイズ】${targetWidth}px × ${boundaryHeight}px（厳守）

【ルール】
- 上端は1枚目の画像と自然に接続すること
- 下端は2枚目の画像と自然に接続すること
- 色・トーン・雰囲気を上下の画像から引き継ぐ
- 境界として違和感のない繋ぎを作る
${referenceBase64 ? '- 3枚目の画像のスタイルを参考にする' : ''}

${targetWidth}x${boundaryHeight}pxの画像を1枚だけ生成してください。`;

    try {
        const parts: any[] = [
            { inlineData: { mimeType: 'image/png', data: upperContext.toString('base64') } },
            { text: '↑ 上セクションの下端（この下に境界画像が来る）' },
            { inlineData: { mimeType: 'image/png', data: lowerContext.toString('base64') } },
            { text: '↑ 下セクションの上端（境界画像の下にこれが来る）' },
        ];

        if (referenceBase64) {
            const cleanRef = referenceBase64.replace(/^data:image\/\w+;base64,/, '');
            parts.push({ inlineData: { mimeType: 'image/png', data: cleanRef } });
            parts.push({ text: '↑ スタイル参考' });
        }

        parts.push({ text: prompt });

        log.info(`Generating boundary: ${targetWidth}x${boundaryHeight}px`);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
                })
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
                const boundaryBuffer = await sharp(generatedBuffer)
                    .resize(targetWidth, boundaryHeight, { fit: 'cover', position: 'center' })
                    .png()
                    .toBuffer();

                log.success(`Boundary generated: ${targetWidth}x${boundaryHeight}px`);

                await logGeneration({
                    userId,
                    type: 'boundary-design',
                    endpoint: '/api/sections/boundary-design',
                    model: 'gemini-3-pro-image-preview',
                    inputPrompt: prompt,
                    imageCount: 1,
                    status: 'succeeded',
                    startTime
                });

                return {
                    newUpperBuffer,
                    newLowerBuffer,
                    boundaryBuffer,
                    boundaryHeight,
                };
            }
        }

        return null;
    } catch (error: any) {
        log.error(`Generation error: ${error.message}`);
        return null;
    }
}

function createStreamResponse(processFunction: (send: (data: any) => void) => Promise<void>) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                await processFunction(send);
            } catch (error: any) {
                send({ type: 'error', error: error.message });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        }
    });
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = boundarySchema.safeParse(body);

    if (!validation.success) {
        return Response.json({ error: 'Validation failed', details: validation.error.issues }, { status: 400 });
    }

    const { boundaries, referenceImageBase64 } = validation.data;

    return createStreamResponse(async (send) => {
        log.info(`Processing ${boundaries.length} boundaries`);

        send({
            type: 'progress',
            message: `${boundaries.length}箇所の境界を処理中...`,
            total: boundaries.length,
            current: 0,
        });

        const googleApiKey = await getGoogleApiKeyForUser(user.id);
        if (!googleApiKey) {
            throw new Error('Google API key is not configured');
        }

        const results: any[] = [];

        for (let i = 0; i < boundaries.length; i++) {
            const boundary = boundaries[i];

            send({
                type: 'progress',
                message: `境界 ${i + 1}/${boundaries.length} を処理中...`,
                total: boundaries.length,
                current: i + 1,
            });

            try {
                // セクションを取得
                const [upperSection, lowerSection] = await Promise.all([
                    prisma.pageSection.findUnique({
                        where: { id: boundary.upperSectionId },
                        include: { image: true },
                    }),
                    prisma.pageSection.findUnique({
                        where: { id: boundary.lowerSectionId },
                        include: { image: true },
                    }),
                ]);

                if (!upperSection?.image?.filePath || !lowerSection?.image?.filePath) {
                    log.error(`Boundary ${i + 1}: Missing images`);
                    continue;
                }

                // 画像をダウンロード
                const [upperResponse, lowerResponse] = await Promise.all([
                    fetch(upperSection.image.filePath),
                    fetch(lowerSection.image.filePath),
                ]);

                const upperBuffer = Buffer.from(await upperResponse.arrayBuffer());
                const lowerBuffer = Buffer.from(await lowerResponse.arrayBuffer());

                // カット＆生成
                const result = await processAndGenerate(
                    upperBuffer,
                    lowerBuffer,
                    boundary.upperCut,
                    boundary.lowerCut,
                    referenceImageBase64,
                    googleApiKey,
                    user.id
                );

                if (!result) {
                    log.error(`Boundary ${i + 1}: Generation failed`);
                    continue;
                }

                const timestamp = Date.now();

                // 1. カット後の上セクション画像をアップロード
                const upperFilename = `section-cut-upper-${timestamp}-${i}.png`;
                await supabase.storage.from('images').upload(upperFilename, result.newUpperBuffer, {
                    contentType: 'image/png', cacheControl: '3600', upsert: false
                });
                const newUpperUrl = supabase.storage.from('images').getPublicUrl(upperFilename).data.publicUrl;

                // 2. カット後の下セクション画像をアップロード
                const lowerFilename = `section-cut-lower-${timestamp}-${i}.png`;
                await supabase.storage.from('images').upload(lowerFilename, result.newLowerBuffer, {
                    contentType: 'image/png', cacheControl: '3600', upsert: false
                });
                const newLowerUrl = supabase.storage.from('images').getPublicUrl(lowerFilename).data.publicUrl;

                // 3. 境界画像をアップロード
                const boundaryFilename = `boundary-${timestamp}-${i}.png`;
                await supabase.storage.from('images').upload(boundaryFilename, result.boundaryBuffer, {
                    contentType: 'image/png', cacheControl: '3600', upsert: false
                });
                const boundaryUrl = supabase.storage.from('images').getPublicUrl(boundaryFilename).data.publicUrl;

                // メタデータ取得
                const [upperMeta, lowerMeta, boundaryMeta] = await Promise.all([
                    sharp(result.newUpperBuffer).metadata(),
                    sharp(result.newLowerBuffer).metadata(),
                    sharp(result.boundaryBuffer).metadata(),
                ]);

                // 上セクションのMediaImageを更新
                const newUpperMedia = await prisma.mediaImage.create({
                    data: {
                        filePath: newUpperUrl,
                        mime: 'image/png',
                        width: upperMeta.width || 0,
                        height: upperMeta.height || 0,
                        sourceType: 'boundary-cut',
                    },
                });
                // 履歴保存（上セクション）
                if (upperSection.imageId) {
                    await prisma.sectionImageHistory.create({
                        data: {
                            sectionId: upperSection.id,
                            userId: user.id,
                            previousImageId: upperSection.imageId,
                            newImageId: newUpperMedia.id,
                            actionType: 'boundary-design',
                        }
                    });
                }
                await prisma.pageSection.update({
                    where: { id: upperSection.id },
                    data: { imageId: newUpperMedia.id },
                });

                // 下セクションのMediaImageを更新
                const newLowerMedia = await prisma.mediaImage.create({
                    data: {
                        filePath: newLowerUrl,
                        mime: 'image/png',
                        width: lowerMeta.width || 0,
                        height: lowerMeta.height || 0,
                        sourceType: 'boundary-cut',
                    },
                });
                // 履歴保存（下セクション）
                if (lowerSection.imageId) {
                    await prisma.sectionImageHistory.create({
                        data: {
                            sectionId: lowerSection.id,
                            userId: user.id,
                            previousImageId: lowerSection.imageId,
                            newImageId: newLowerMedia.id,
                            actionType: 'boundary-design',
                        }
                    });
                }
                await prisma.pageSection.update({
                    where: { id: lowerSection.id },
                    data: { imageId: newLowerMedia.id },
                });

                // 境界セクションを作成
                const boundaryMedia = await prisma.mediaImage.create({
                    data: {
                        filePath: boundaryUrl,
                        mime: 'image/png',
                        width: boundaryMeta.width || 0,
                        height: boundaryMeta.height || 0,
                        sourceType: 'boundary-generated',
                    },
                });

                // order調整して境界セクションを挿入
                const freshLower = await prisma.pageSection.findUnique({ where: { id: lowerSection.id } });
                if (freshLower) {
                    await prisma.pageSection.updateMany({
                        where: { pageId: upperSection.pageId, order: { gte: freshLower.order } },
                        data: { order: { increment: 1 } },
                    });

                    const boundarySection = await prisma.pageSection.create({
                        data: {
                            pageId: upperSection.pageId,
                            order: freshLower.order,
                            role: 'boundary',
                            imageId: boundaryMedia.id,
                            config: JSON.stringify({ upperCut: boundary.upperCut, lowerCut: boundary.lowerCut }),
                        },
                    });

                    results.push({
                        boundaryIndex: i,
                        upperSection: { sectionId: upperSection.id, newImageUrl: newUpperUrl },
                        lowerSection: { sectionId: lowerSection.id, newImageUrl: newLowerUrl },
                        boundarySection: { sectionId: boundarySection.id, imageUrl: boundaryUrl, height: result.boundaryHeight },
                    });
                }

                log.success(`Boundary ${i + 1}/${boundaries.length} done`);

            } catch (error: any) {
                log.error(`Boundary ${i + 1} error: ${error.message}`);
            }
        }

        log.info(`Complete: ${results.length}/${boundaries.length}`);

        send({
            type: 'complete',
            success: true,
            results,
        });
    });
}
