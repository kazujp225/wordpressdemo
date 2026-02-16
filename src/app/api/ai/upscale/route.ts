import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { supabase } from '@/lib/supabase';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkImageGenerationLimit } from '@/lib/usage';
import { deductCreditAtomic, refundCredit } from '@/lib/credits';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { fetchWithRetry } from '@/lib/gemini-retry';
import {
    checkAllRateLimits,
    createOrGetGenerationRun,
    updateGenerationRunStatus,
} from '@/lib/rate-limit';
import { v4 as uuidv4 } from 'uuid';

interface UpscaleRequest {
    imageUrl?: string;
    imageBase64?: string;
    scale?: number;
    useAI?: boolean;
}

const ENDPOINT = '/api/ai/upscale';
const MODEL = 'gemini-3-pro-image-preview';

export async function POST(request: NextRequest) {
    const startTime = createTimer();

    // ユーザー認証
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestId = uuidv4();
    let creditDeducted = false;
    let estimatedCostUsd = 0;
    let inputPrompt = '';
    let skipCreditConsumption = false;

    try {
        // 1. レート制限チェック
        const rateLimitResult = await checkAllRateLimits(user.id, ENDPOINT);
        if (!rateLimitResult.allowed) {
            return NextResponse.json(
                {
                    error: 'RATE_LIMITED',
                    message: rateLimitResult.reason,
                    retryAfterMs: rateLimitResult.retryAfterMs,
                },
                {
                    status: 429,
                    headers: rateLimitResult.retryAfterMs
                        ? { 'Retry-After': String(Math.ceil(rateLimitResult.retryAfterMs / 1000)) }
                        : undefined,
                }
            );
        }

        const {
            imageUrl,
            imageBase64,
            scale = 2,
        }: UpscaleRequest = await request.json();

        const safeScale = scale >= 3 ? 4 : 2;

        // 2. クレジット残高チェック
        const isBannerEdit = request.headers.get('x-source') === 'banner';
        const limitCheck = await checkImageGenerationLimit(user.id, MODEL, 1, { isBannerEdit });
        if (!limitCheck.allowed) {
            if (limitCheck.needApiKey) {
                return NextResponse.json({ error: 'API_KEY_REQUIRED', message: limitCheck.reason }, { status: 402 });
            }
            if (limitCheck.needSubscription) {
                return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED', message: limitCheck.reason }, { status: 402 });
            }
            return NextResponse.json({
                error: 'INSUFFICIENT_CREDIT',
                message: limitCheck.reason,
                credits: { currentBalance: limitCheck.currentBalanceUsd, estimatedCost: limitCheck.estimatedCostUsd },
                needPurchase: true,
            }, { status: 402 });
        }

        skipCreditConsumption = limitCheck.skipCreditConsumption || false;
        estimatedCostUsd = limitCheck.estimatedCostUsd || 0;

        // 3. 先払い
        if (!skipCreditConsumption && estimatedCostUsd > 0) {
            const deductResult = await deductCreditAtomic(
                user.id,
                estimatedCostUsd,
                requestId,
                `アップスケール (${MODEL})`
            );

            if (!deductResult.success) {
                return NextResponse.json({
                    error: 'INSUFFICIENT_CREDIT',
                    message: deductResult.error || 'クレジット不足です',
                    needPurchase: true,
                }, { status: 402 });
            }

            if (deductResult.alreadyProcessed) {
                return NextResponse.json({
                    error: 'DUPLICATE_REQUEST',
                    message: 'このリクエストは既に処理されています',
                    requestId,
                }, { status: 409 });
            }

            creditDeducted = true;
            console.log(`[UPSCALE] Credit deducted: $${estimatedCostUsd}, requestId: ${requestId}`);
        }

        // 4. 画像データ取得
        let imageBuffer: Buffer;

        if (imageBase64) {
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64Data, 'base64');
        } else if (imageUrl) {
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error('画像の取得に失敗しました');
            }
            const arrayBuffer = await imageResponse.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
        } else {
            return NextResponse.json({ error: '画像を指定してください' }, { status: 400 });
        }

        // 元画像のメタデータ取得
        const metadata = await sharp(imageBuffer).metadata();
        const originalWidth = metadata.width || 1024;
        const originalHeight = metadata.height || 1024;
        const targetWidth = originalWidth * safeScale;
        const targetHeight = originalHeight * safeScale;

        inputPrompt = `Upscale ${originalWidth}x${originalHeight} → ${targetWidth}x${targetHeight} (${safeScale}x)`;
        console.log(`[UPSCALE] ${inputPrompt}`);

        // 5. Gemini APIで高画質化
        const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user.id, { useSystemKey: !!limitCheck.isFreeBannerEdit });
        if (!GOOGLE_API_KEY) {
            throw new Error('Google API key is not configured.');
        }

        // 画像をbase64に変換
        let mimeType = 'image/png';
        if (metadata.format === 'jpeg') mimeType = 'image/jpeg';
        else if (metadata.format === 'webp') mimeType = 'image/webp';

        const base64Data = imageBuffer.toString('base64');

        const upscalePrompt = `Upscale and enhance this image to higher resolution and quality.
Make the image sharper, clearer, and more detailed.
Enhance fine details, textures, and edges while preserving the original content, colors, layout, and composition exactly.
Do NOT change any content, text, objects, or composition - only improve the quality and resolution.
Output the image at the highest possible resolution.`;

        const response = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType, data: base64Data } },
                            { text: upscalePrompt },
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ["IMAGE", "TEXT"],
                        temperature: 0.2,
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[UPSCALE] Gemini API error:', errorText);
            throw new Error(`高画質化に失敗しました: ${response.status}`);
        }

        const data = await response.json();

        // レスポンスから画像を抽出
        let upscaledBuffer: Buffer | null = null;
        const candidates = data.candidates || [];
        for (const candidate of candidates) {
            const parts = candidate.content?.parts || [];
            for (const part of parts) {
                if (part.inlineData?.data) {
                    upscaledBuffer = Buffer.from(part.inlineData.data, 'base64');
                    break;
                }
            }
            if (upscaledBuffer) break;
        }

        if (!upscaledBuffer) {
            console.error('[UPSCALE] No image in Gemini response');
            throw new Error('高画質化された画像が返されませんでした');
        }

        console.log(`[UPSCALE] Gemini returned image, size: ${upscaledBuffer.length} bytes`);

        // 6. 最終的なサイズを取得
        const finalMetadata = await sharp(upscaledBuffer).metadata();
        const newWidth = finalMetadata.width || targetWidth;
        const newHeight = finalMetadata.height || targetHeight;

        console.log(`[UPSCALE] Result: ${originalWidth}x${originalHeight} → ${newWidth}x${newHeight}`);

        // 7. Supabaseにアップロード
        const filename = `upscaled-gemini-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;

        // PNG変換
        const pngBuffer = await sharp(upscaledBuffer).png({ quality: 95 }).toBuffer();

        const { error: uploadError } = await supabase
            .storage
            .from('images')
            .upload(filename, pngBuffer, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('[UPSCALE] Supabase upload error:', uploadError);
            throw new Error('画像のアップロードに失敗しました');
        }

        // 8. 公開URL取得
        const { data: { publicUrl } } = supabase
            .storage
            .from('images')
            .getPublicUrl(filename);

        // 9. DB保存
        const media = await prisma.mediaImage.create({
            data: {
                userId: user.id,
                filePath: publicUrl,
                mime: 'image/png',
                width: newWidth,
                height: newHeight,
                sourceType: 'upscale-ai',
            },
        });

        const durationMs = Date.now() - startTime;

        const resultData = {
            success: true,
            media,
            upscaleInfo: {
                model: MODEL,
                isAI: true,
                originalSize: { width: originalWidth, height: originalHeight },
                newSize: { width: newWidth, height: newHeight },
                scale: safeScale,
                durationMs
            }
        };

        // ログ記録
        await logGeneration({
            userId: user.id,
            type: 'upscale',
            endpoint: ENDPOINT,
            model: MODEL,
            inputPrompt,
            imageCount: 1,
            status: 'succeeded',
            startTime,
            resolution: '1K',
        });

        console.log(`[UPSCALE] Completed successfully, requestId: ${requestId}`);

        return NextResponse.json(resultData);

    } catch (error: any) {
        console.error('[UPSCALE] Error:', error);

        // エラー時は返金
        if (creditDeducted && !skipCreditConsumption) {
            try {
                await refundCredit(user.id, estimatedCostUsd, requestId, `エラー: ${error.message}`);
                console.log(`[UPSCALE] Credit refunded due to exception, requestId: ${requestId}`);
            } catch (refundError) {
                console.error('[UPSCALE] Failed to refund credit:', refundError);
            }
        }

        await logGeneration({
            userId: user.id,
            type: 'upscale',
            endpoint: ENDPOINT,
            model: MODEL,
            inputPrompt: inputPrompt || 'Error',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
