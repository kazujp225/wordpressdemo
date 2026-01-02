import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';

const log = {
    info: (msg: string) => console.log(`\x1b[35m[4K-UPSCALE]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[4K-UPSCALE]\x1b[0m ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[4K-UPSCALE]\x1b[0m ${msg}`),
};

// 4K基準幅（LPは縦長なので幅を基準に）
const TARGET_4K_WIDTH = 1500; // 4K相当の高解像度

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

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const pageId = parseInt(id, 10);

    if (isNaN(pageId)) {
        return Response.json({ error: 'Invalid page ID' }, { status: 400 });
    }

    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return createStreamResponse(async (send) => {
        const startTime = createTimer();

        // ページとセクションを取得
        const page = await prisma.page.findUnique({
            where: { id: pageId },
            include: {
                sections: {
                    include: { image: true, mobileImage: true },
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!page) {
            throw new Error('Page not found');
        }

        const sectionsWithImages = page.sections.filter(s => s.image?.filePath);
        const total = sectionsWithImages.length;

        if (total === 0) {
            throw new Error('No sections with images found');
        }

        log.info(`Starting 4K upscale for page ${pageId}: ${total} sections`);

        send({
            type: 'start',
            message: `4Kアップスケール開始: ${total}セクション`,
            total,
        });

        const googleApiKey = await getGoogleApiKeyForUser(user.id);
        if (!googleApiKey) {
            throw new Error('Google API key not configured');
        }

        const results: any[] = [];

        for (let i = 0; i < sectionsWithImages.length; i++) {
            const section = sectionsWithImages[i];
            const sectionStartTime = createTimer();

            send({
                type: 'progress',
                message: `セクション ${i + 1}/${total} を処理中...`,
                current: i + 1,
                total,
                sectionId: section.id,
            });

            try {
                if (!section.image?.filePath) continue;

                // 画像をダウンロード
                const imageResponse = await fetch(section.image.filePath);
                const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                const imageMeta = await sharp(imageBuffer).metadata();

                if (!imageMeta.width || !imageMeta.height) {
                    log.error(`Section ${section.id}: Failed to get metadata`);
                    continue;
                }

                // 既に4K以上ならスキップ
                if (imageMeta.width >= TARGET_4K_WIDTH) {
                    log.info(`Section ${section.id}: Already 4K+ (${imageMeta.width}px), skipping`);
                    send({
                        type: 'skip',
                        message: `セクション ${i + 1}: 既に高解像度のためスキップ`,
                        sectionId: section.id,
                    });
                    continue;
                }

                // アップスケール倍率を計算
                const scale = TARGET_4K_WIDTH / imageMeta.width;
                const newWidth = TARGET_4K_WIDTH;
                const newHeight = Math.round(imageMeta.height * scale);

                log.info(`Section ${section.id}: Upscaling ${imageMeta.width}x${imageMeta.height} -> ${newWidth}x${newHeight}`);

                // まずsharpで拡大（ベースライン）
                const upscaledBase = await sharp(imageBuffer)
                    .resize(newWidth, newHeight, {
                        kernel: sharp.kernel.lanczos3,
                        withoutEnlargement: false,
                    })
                    .png()
                    .toBuffer();

                // AIで文字修復＆品質向上
                const enhancedBuffer = await enhanceWith4KAI(
                    upscaledBase,
                    newWidth,
                    newHeight,
                    googleApiKey
                );

                if (!enhancedBuffer) {
                    log.error(`Section ${section.id}: AI enhancement failed, using base upscale`);
                    // AIが失敗してもベースのアップスケールは使用
                }

                const finalBuffer = enhancedBuffer || upscaledBase;

                // アップロード
                const timestamp = Date.now();
                const filename = `4k-upscale-${section.id}-${timestamp}.png`;

                const { error: uploadError } = await supabase.storage
                    .from('images')
                    .upload(filename, finalBuffer, {
                        contentType: 'image/png',
                        cacheControl: '3600',
                        upsert: false,
                    });

                if (uploadError) {
                    log.error(`Section ${section.id}: Upload failed - ${uploadError.message}`);
                    continue;
                }

                const newImageUrl = supabase.storage.from('images').getPublicUrl(filename).data.publicUrl;

                // メタデータ取得
                const finalMeta = await sharp(finalBuffer).metadata();

                // MediaImage作成
                const newMedia = await prisma.mediaImage.create({
                    data: {
                        filePath: newImageUrl,
                        mime: 'image/png',
                        width: finalMeta.width || newWidth,
                        height: finalMeta.height || newHeight,
                        sourceType: '4k-upscale',
                    },
                });

                // セクション更新
                await prisma.pageSection.update({
                    where: { id: section.id },
                    data: { imageId: newMedia.id },
                });

                results.push({
                    sectionId: section.id,
                    oldSize: `${imageMeta.width}x${imageMeta.height}`,
                    newSize: `${finalMeta.width}x${finalMeta.height}`,
                    newImageUrl,
                });

                await logGeneration({
                    userId: user.id,
                    type: '4k-upscale',
                    endpoint: `/api/pages/${pageId}/upscale-4k`,
                    model: 'gemini-3-pro-image-preview',
                    inputPrompt: `4K upscale section ${section.id}`,
                    imageCount: 1,
                    status: 'succeeded',
                    startTime: sectionStartTime,
                });

                log.success(`Section ${section.id}: ${imageMeta.width}x${imageMeta.height} -> ${finalMeta.width}x${finalMeta.height}`);

                send({
                    type: 'section_complete',
                    message: `セクション ${i + 1}/${total} 完了`,
                    sectionId: section.id,
                    oldSize: `${imageMeta.width}x${imageMeta.height}`,
                    newSize: `${finalMeta.width}x${finalMeta.height}`,
                    newImageUrl,
                });

            } catch (error: any) {
                log.error(`Section ${section.id}: ${error.message}`);
                send({
                    type: 'section_error',
                    message: `セクション ${i + 1} でエラー: ${error.message}`,
                    sectionId: section.id,
                });
            }
        }

        log.success(`4K upscale complete: ${results.length}/${total} sections processed`);

        send({
            type: 'complete',
            message: `4Kアップスケール完了: ${results.length}/${total}セクション処理`,
            results,
            total,
            processed: results.length,
        });
    });
}

async function enhanceWith4KAI(
    imageBuffer: Buffer,
    width: number,
    height: number,
    apiKey: string
): Promise<Buffer | null> {
    const prompt = `この画像を高品質に修復・強化してください。

【タスク】
1. 文字化けや読みにくい日本語テキストを正確で読みやすいものに修復
2. ぼやけた部分をシャープに
3. 色の鮮やかさを適切に調整
4. ノイズやアーティファクトを除去
5. UIコンポーネント（ボタン、アイコン等）のエッジを鮮明に

【重要】
- 画像のレイアウト、構成、デザインは一切変更しないでください
- テキストの内容を変えずに、読みやすさだけを改善してください
- 出力サイズは ${width}x${height}px を厳守してください
- 元の画像の雰囲気やスタイルを維持してください

高品質な ${width}x${height}px の画像を1枚だけ出力してください。`;

    try {
        const base64 = imageBuffer.toString('base64');

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: 'image/png', data: base64 } },
                            { text: prompt },
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ["IMAGE", "TEXT"],
                        temperature: 0.1, // 低温度で忠実な再現
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            log.error(`AI API error: ${errorText}`);
            return null;
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
            if (part.inlineData?.data) {
                const enhancedBuffer = Buffer.from(part.inlineData.data, 'base64');

                // サイズを確認して必要なら調整
                const meta = await sharp(enhancedBuffer).metadata();
                if (meta.width !== width || meta.height !== height) {
                    return await sharp(enhancedBuffer)
                        .resize(width, height, { fit: 'cover', position: 'center' })
                        .png()
                        .toBuffer();
                }

                return enhancedBuffer;
            }
        }

        return null;
    } catch (error: any) {
        log.error(`AI enhancement error: ${error.message}`);
        return null;
    }
}
