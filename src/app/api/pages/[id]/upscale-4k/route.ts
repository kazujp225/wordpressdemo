import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkGenerationLimit, checkFeatureAccess } from '@/lib/usage';

const log = {
    info: (msg: string) => console.log(`\x1b[35m[HD-UPSCALE]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[HD-UPSCALE]\x1b[0m ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[HD-UPSCALE]\x1b[0m ${msg}`),
};

// 解像度マッピング
const RESOLUTION_MAP: Record<string, number> = {
    '1K': 1024,
    '2K': 2048,
    '4K': 3840,
};

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

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 機能アクセスチェック（4Kアップスケールは有料プラン専用）
    const featureCheck = await checkFeatureAccess(user.id, 'upscale4K');
    if (!featureCheck.allowed) {
        return Response.json({
            error: 'Feature not available',
            message: featureCheck.reason,
        }, { status: 403 });
    }

    // 使用量制限チェック
    const limitCheck = await checkGenerationLimit(user.id);
    if (!limitCheck.allowed) {
        // FreeプランでAPIキー未設定の場合
        if (limitCheck.needApiKey) {
            return Response.json({
                error: 'API_KEY_REQUIRED',
                message: limitCheck.reason,
            }, { status: 402 });
        }
        return Response.json({
            error: 'Usage limit exceeded',
            message: limitCheck.reason,
        }, { status: 429 });
    }

    // リクエストボディからオプションを取得
    let textCorrection = true;
    let resolution = '2K'; // デフォルト
    let sectionIds: number[] | null = null; // null = 全体, 配列 = 個別
    let useRealESRGAN = false; // Real-ESRGAN使用フラグ
    let customPrompt: string | null = null; // カスタムプロンプト
    try {
        const body = await request.json();
        textCorrection = body.textCorrection !== false;
        if (body.resolution && RESOLUTION_MAP[body.resolution]) {
            resolution = body.resolution;
        }
        // 個別セクション指定
        if (body.sectionIds && Array.isArray(body.sectionIds) && body.sectionIds.length > 0) {
            sectionIds = body.sectionIds.map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
        }
        // Real-ESRGAN使用オプション
        if (body.useRealESRGAN === true) {
            useRealESRGAN = true;
        }
        // カスタムプロンプト
        if (body.customPrompt && typeof body.customPrompt === 'string' && body.customPrompt.trim()) {
            customPrompt = body.customPrompt.trim();
        }
    } catch {
        // ボディがない場合はデフォルト値を使用
    }

    const targetWidth = RESOLUTION_MAP[resolution];

    return createStreamResponse(async (send) => {
        const startTime = createTimer();

        log.info(`Resolution: ${resolution} (${targetWidth}px), Text correction: ${textCorrection ? 'ON' : 'OFF'}`);

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

        // 所有者確認
        if (page.userId !== user.id) {
            throw new Error('Forbidden');
        }

        // 画像があるセクションをフィルタ、個別指定がある場合はさらにフィルタ
        let sectionsWithImages = page.sections.filter(s => s.image?.filePath);
        if (sectionIds && sectionIds.length > 0) {
            sectionsWithImages = sectionsWithImages.filter(s => sectionIds!.includes(s.id));
            log.info(`Individual mode: processing ${sectionsWithImages.length} selected sections`);
        }
        const total = sectionsWithImages.length;

        if (total === 0) {
            throw new Error('No sections with images found');
        }

        const modeLabel = sectionIds ? '個別' : '全体';
        log.info(`Starting 4K upscale for page ${pageId}: ${total} sections (${modeLabel})`);

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

                // 出力サイズを計算（既に大きい場合はそのまま、小さい場合は拡大）
                const needsUpscale = imageMeta.width < targetWidth;
                const scale = needsUpscale ? targetWidth / imageMeta.width : 1;
                const newWidth = needsUpscale ? targetWidth : imageMeta.width;
                const newHeight = needsUpscale ? Math.round(imageMeta.height * scale) : imageMeta.height;

                log.info(`Section ${section.id}: Processing ${imageMeta.width}x${imageMeta.height} -> ${newWidth}x${newHeight}${needsUpscale ? '' : ' (AI enhance only)'}`);

                // 元画像をPNGに変換（AIに送る前処理）
                const pngBuffer = await sharp(imageBuffer).png().toBuffer();

                let finalBuffer: Buffer;

                if (useRealESRGAN) {
                    // Real-ESRGANモード: 内部APIを呼び出し
                    log.info(`Section ${section.id}: Using Real-ESRGAN upscaler`);
                    try {
                        const esrganScale = targetWidth / imageMeta.width >= 3 ? 4 : 2;
                        const esrganResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/upscale`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                // 認証ヘッダーを転送
                                'Cookie': request.headers.get('cookie') || '',
                            },
                            body: JSON.stringify({
                                imageBase64: `data:image/png;base64,${pngBuffer.toString('base64')}`,
                                scale: esrganScale,
                                useRealESRGAN: true,
                            }),
                        });

                        if (esrganResponse.ok) {
                            const esrganResult = await esrganResponse.json();
                            if (esrganResult.success && esrganResult.media?.filePath) {
                                // Real-ESRGANの結果をダウンロード
                                const esrganImageResponse = await fetch(esrganResult.media.filePath);
                                finalBuffer = Buffer.from(await esrganImageResponse.arrayBuffer());
                                log.success(`Section ${section.id}: Real-ESRGAN upscale successful`);
                            } else {
                                throw new Error('Real-ESRGAN response invalid');
                            }
                        } else {
                            throw new Error(`Real-ESRGAN API error: ${esrganResponse.status}`);
                        }
                    } catch (esrganError: any) {
                        log.error(`Section ${section.id}: Real-ESRGAN failed (${esrganError.message}), using Sharp fallback`);
                        finalBuffer = await sharp(imageBuffer)
                            .resize(newWidth, newHeight, {
                                kernel: sharp.kernel.lanczos3,
                                withoutEnlargement: false,
                            })
                            .sharpen({ sigma: 1.0 })
                            .png()
                            .toBuffer();
                    }
                } else {
                    // Gemini AIモード: 文字補正＋高画質化
                    const enhancedBuffer = await upscaleWith4KAI(
                        pngBuffer,
                        imageMeta.width,
                        imageMeta.height,
                        newWidth,
                        newHeight,
                        googleApiKey,
                        textCorrection,
                        customPrompt
                    );

                    if (!enhancedBuffer) {
                        log.error(`Section ${section.id}: AI 4K upscale failed, using sharp fallback`);
                        finalBuffer = await sharp(imageBuffer)
                            .resize(newWidth, newHeight, {
                                kernel: sharp.kernel.lanczos3,
                                withoutEnlargement: false,
                            })
                            .png()
                            .toBuffer();
                    } else {
                        finalBuffer = enhancedBuffer;
                    }
                }

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

async function upscaleWith4KAI(
    imageBuffer: Buffer,
    originalWidth: number,
    originalHeight: number,
    targetWidth: number,
    targetHeight: number,
    apiKey: string,
    textCorrection: boolean = true,
    customPrompt: string | null = null
): Promise<Buffer | null> {
    const scaleRatio = (targetWidth / originalWidth).toFixed(1);

    // カスタムプロンプト（正しいテキスト）がある場合
    const customTextSection = customPrompt
        ? `
【正しいテキスト（参照）】★最重要★
以下が画像内に表示されるべき正しいテキストです。
画像内の文字化け・崩れた文字を見つけ、以下の正しいテキストに置き換えてください：

「${customPrompt}」

上記のテキストを参照して、画像内の対応する箇所を正確に修正してください。
`
        : '';

    // 文字補正ON/OFFでプロンプトを切り替え
    const textCorrectionSection = textCorrection
        ? `
【文字・テキストの補正】★重要★
- すべての日本語テキストを鮮明で読みやすく再描画してください
- 文字化け、ぼやけ、にじみを完全に修正してください
- フォントの形状を正確に維持しながら、エッジをシャープにしてください
- 小さな文字も拡大後に読めるようにしてください
`
        : '';

    const prompt = `この画像を高画質に補正・強化してください。
${customTextSection}
${textCorrectionSection}
【画質向上タスク】
- ぼやけた部分をシャープに鮮明化
- ノイズやアーティファクトを除去
- 色の鮮やかさを適切に調整
- UIコンポーネント（ボタン、アイコン等）のエッジを鮮明に
- 細部のディテールを強化

【絶対に守ること】
- 画像のレイアウト、構成、デザインは一切変更しないでください
${customPrompt ? '- 正しいテキストに従って文字を修正してください' : '- テキストの内容（文言）を変えずに、見た目の品質だけを改善してください'}
- 元の画像の雰囲気やスタイルを維持してください
- アスペクト比を維持してください

高画質に補正した画像を1枚だけ出力してください。`;

    try {
        const base64 = imageBuffer.toString('base64');

        // Gemini 3 Pro Image (最新モデル)
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
                        responseModalities: ["TEXT", "IMAGE"],
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
                const aiOutputBuffer = Buffer.from(part.inlineData.data, 'base64');
                const meta = await sharp(aiOutputBuffer).metadata();
                log.info(`AI output: ${meta.width}x${meta.height}`);

                // AIの出力が目標サイズより小さい場合のみリサイズ
                if (meta.width && meta.width < targetWidth) {
                    log.info(`Upscaling AI output to ${targetWidth}x${targetHeight} with lanczos3`);
                    return await sharp(aiOutputBuffer)
                        .resize(targetWidth, targetHeight, {
                            kernel: sharp.kernel.lanczos3,
                            withoutEnlargement: false,
                        })
                        .sharpen({ sigma: 0.3 })
                        .png()
                        .toBuffer();
                }

                // AIの出力がすでに十分なサイズならそのまま使用
                log.info(`AI output already sufficient size, using as-is`);
                return aiOutputBuffer;
            }
        }

        return null;
    } catch (error: any) {
        log.error(`AI upscale error: ${error.message}`);
        return null;
    }
}
