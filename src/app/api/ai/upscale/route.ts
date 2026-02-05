import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import Replicate from 'replicate';
import { supabase } from '@/lib/supabase';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkImageGenerationLimit } from '@/lib/usage';
import { deductCreditAtomic, refundCredit } from '@/lib/credits';
import {
    checkAllRateLimits,
    createOrGetGenerationRun,
    updateGenerationRunStatus,
} from '@/lib/rate-limit';
import { v4 as uuidv4 } from 'uuid';

interface UpscaleRequest {
    imageUrl?: string;
    imageBase64?: string;
    scale?: number;        // 拡大倍率（2, 4）
    useAI?: boolean;       // AI超解像を使用するか（デフォルト: true）
}

const ENDPOINT = '/api/ai/upscale';
const MODEL = 'real-esrgan';

// Replicate クライアント遅延初期化
let _replicate: Replicate | null = null;

function getReplicate(): Replicate | null {
    if (!_replicate) {
        const apiToken = process.env.REPLICATE_API_TOKEN;
        if (!apiToken) {
            return null;
        }
        _replicate = new Replicate({ auth: apiToken });
    }
    return _replicate;
}

export async function POST(request: NextRequest) {
    const startTime = createTimer();

    // ユーザー認証
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // リクエストID生成（冪等性キー）
    const requestId = uuidv4();
    let creditDeducted = false;
    let estimatedCostUsd = 0;
    let inputPrompt = '';

    try {
        // 1. レート制限チェック（インメモリ + DB同時実行）
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
            useAI = true,
        }: UpscaleRequest = await request.json();

        // 拡大倍率を制限（2x または 4x）
        const safeScale = scale >= 3 ? 4 : 2;

        // AI超解像を使用するかどうか確認
        const replicate = getReplicate();
        const willUseAI = useAI && replicate !== null;

        // 2. クレジット残高チェック（AI使用時のみ先払い）
        if (willUseAI) {
            const limitCheck = await checkImageGenerationLimit(user.id, MODEL, 1);
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

            const skipCreditConsumption = limitCheck.skipCreditConsumption || false;
            estimatedCostUsd = limitCheck.estimatedCostUsd || 0;

            // 3. 先払い：クレジットをアトミックに引き落とし（AI使用時のみ）
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

                creditDeducted = true;
                console.log(`[UPSCALE] Credit deducted: $${estimatedCostUsd}, requestId: ${requestId}`);
            }
        }

        // 4. 画像データ取得
        let imageBuffer: Buffer;
        let inputImageUrl: string | null = null;

        if (imageBase64) {
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64Data, 'base64');
        } else if (imageUrl) {
            inputImageUrl = imageUrl;
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                if (creditDeducted) {
                    await refundCredit(user.id, estimatedCostUsd, requestId, '画像取得失敗');
                    console.log(`[UPSCALE] Credit refunded (image fetch failed), requestId: ${requestId}`);
                }
                return NextResponse.json({ error: '画像の取得に失敗しました' }, { status: 400 });
            }
            const arrayBuffer = await imageResponse.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
        } else {
            if (creditDeducted) {
                await refundCredit(user.id, estimatedCostUsd, requestId, '画像データ不足');
                console.log(`[UPSCALE] Credit refunded (no image data), requestId: ${requestId}`);
            }
            return NextResponse.json({ error: '画像を指定してください' }, { status: 400 });
        }

        // 元画像のメタデータ取得
        const metadata = await sharp(imageBuffer).metadata();
        const originalWidth = metadata.width || 1024;
        const originalHeight = metadata.height || 1024;

        inputPrompt = `Upscale ${originalWidth}x${originalHeight} → ${originalWidth * safeScale}x${originalHeight * safeScale} (${safeScale}x)`;

        // 5. GenerationRun を processing 状態で作成（AI使用時のみ）
        if (willUseAI) {
            const { run, isExisting } = await createOrGetGenerationRun(user.id, requestId, {
                type: 'upscale',
                endpoint: ENDPOINT,
                model: MODEL,
                inputPrompt,
                imageCount: 1,
                estimatedCost: estimatedCostUsd,
            });

            // 既存リクエストの場合は結果を返す
            if (isExisting) {
                if (run.status === 'succeeded' && run.outputResult) {
                    return NextResponse.json(JSON.parse(run.outputResult));
                }
                if (run.status === 'failed') {
                    return NextResponse.json(
                        { error: run.errorMessage || '以前のリクエストが失敗しました' },
                        { status: 500 }
                    );
                }
                // processing 中の場合
                return NextResponse.json(
                    { error: '同じリクエストが処理中です', requestId },
                    { status: 409 }
                );
            }
        }

        let upscaledBuffer: Buffer;
        let modelName = 'sharp-lanczos3';

        // 6. AI超解像を試行
        if (willUseAI && replicate) {
            try {
                console.log('[UPSCALE] Using Real-ESRGAN via Replicate API...');

                // Base64からデータURLを生成（Replicateが直接受け入れ可能）
                let inputForReplicate: string;
                if (inputImageUrl) {
                    inputForReplicate = inputImageUrl;
                } else {
                    // Base64の場合はデータURLとして渡す
                    inputForReplicate = `data:image/png;base64,${imageBuffer.toString('base64')}`;
                }

                // Real-ESRGAN モデルを実行
                const output = await replicate.run(
                    "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
                    {
                        input: {
                            image: inputForReplicate,
                            scale: safeScale,
                            face_enhance: false,  // 顔補正は無効（LP画像用）
                        }
                    }
                );

                // 結果URLから画像を取得（Replicateは画像URLを返す）
                const outputUrl = String(output);
                const resultResponse = await fetch(outputUrl);
                if (!resultResponse.ok) {
                    throw new Error('Real-ESRGAN結果の取得に失敗しました');
                }
                upscaledBuffer = Buffer.from(await resultResponse.arrayBuffer());
                modelName = 'real-esrgan-replicate';
                console.log('[UPSCALE] Real-ESRGAN upscale completed successfully');

            } catch (aiError: any) {
                console.warn('[UPSCALE] Real-ESRGAN failed, falling back to Sharp:', aiError.message);

                // AI失敗時は返金してSharpにフォールバック
                if (creditDeducted) {
                    await refundCredit(user.id, estimatedCostUsd, requestId, `AI失敗: ${aiError.message}、Sharpにフォールバック`);
                    creditDeducted = false;
                    console.log(`[UPSCALE] Credit refunded (AI failed, using Sharp), requestId: ${requestId}`);
                }

                // フォールバック: Sharp使用
                upscaledBuffer = await sharpUpscale(imageBuffer, safeScale);
                modelName = 'sharp-lanczos3-fallback';
            }
        } else {
            // Sharp使用（AIが無効またはReplicate未設定）
            upscaledBuffer = await sharpUpscale(imageBuffer, safeScale);
            if (!replicate && useAI) {
                console.log('[UPSCALE] REPLICATE_API_TOKEN not configured, using Sharp');
            }
        }

        // 7. 最終的なサイズを取得
        const finalMetadata = await sharp(upscaledBuffer).metadata();
        const newWidth = finalMetadata.width || originalWidth * safeScale;
        const newHeight = finalMetadata.height || originalHeight * safeScale;

        // 8. Supabaseにアップロード
        const filename = `upscaled-${modelName}-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
        const { error: uploadError } = await supabase
            .storage
            .from('images')
            .upload(filename, upscaledBuffer, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('[UPSCALE] Supabase upload error:', uploadError);
            const errorMessage = '画像のアップロードに失敗しました';
            if (creditDeducted) {
                await refundCredit(user.id, estimatedCostUsd, requestId, errorMessage);
                console.log(`[UPSCALE] Credit refunded (upload failed), requestId: ${requestId}`);
            }
            if (willUseAI) {
                await updateGenerationRunStatus(requestId, 'failed', {
                    errorMessage,
                    durationMs: Date.now() - startTime,
                });
            }
            throw new Error(errorMessage);
        }

        // 9. 公開URL取得
        const { data: { publicUrl } } = supabase
            .storage
            .from('images')
            .getPublicUrl(filename);

        // 10. DB保存
        const media = await prisma.mediaImage.create({
            data: {
                userId: user.id,
                filePath: publicUrl,
                mime: 'image/png',
                width: newWidth,
                height: newHeight,
                sourceType: modelName.includes('esrgan') ? 'upscale-ai' : 'upscale',
            },
        });

        const durationMs = Date.now() - startTime;

        // 11. 成功結果を作成
        const resultData = {
            success: true,
            media,
            upscaleInfo: {
                model: modelName,
                isAI: modelName.includes('esrgan'),
                originalSize: { width: originalWidth, height: originalHeight },
                newSize: { width: newWidth, height: newHeight },
                scale: safeScale,
                durationMs
            }
        };

        // 12. 成功時のステータス更新（AI使用時のみ）
        if (willUseAI) {
            await updateGenerationRunStatus(requestId, 'succeeded', {
                outputResult: JSON.stringify(resultData),
                durationMs,
            });
        }

        // ログ記録
        await logGeneration({
            userId: user.id,
            type: 'upscale',
            endpoint: ENDPOINT,
            model: modelName,
            inputPrompt: `Upscale ${originalWidth}x${originalHeight} → ${newWidth}x${newHeight} (${safeScale}x)`,
            status: 'succeeded',
            startTime
        });

        console.log(`[UPSCALE] Completed successfully, requestId: ${requestId}, model: ${modelName}`);

        return NextResponse.json(resultData);

    } catch (error: any) {
        console.error('[UPSCALE] Error:', error);

        // エラー時は返金
        if (creditDeducted) {
            try {
                await refundCredit(user.id, estimatedCostUsd, requestId, `エラー: ${error.message}`);
                console.log(`[UPSCALE] Credit refunded due to exception, requestId: ${requestId}`);
            } catch (refundError) {
                console.error('[UPSCALE] Failed to refund credit:', refundError);
            }
        }

        // GenerationRun ステータス更新
        try {
            await updateGenerationRunStatus(requestId, 'failed', {
                errorMessage: error.message,
                durationMs: Date.now() - startTime,
            });
        } catch (updateError) {
            // GenerationRunが作成されていない場合はスキップ
        }

        await logGeneration({
            userId: user.id,
            type: 'upscale',
            endpoint: ENDPOINT,
            model: 'error',
            inputPrompt: inputPrompt || 'Error',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// Sharp フォールバック関数（高品質補間）
async function sharpUpscale(imageBuffer: Buffer, scale: number): Promise<Buffer> {
    const metadata = await sharp(imageBuffer).metadata();
    const newWidth = Math.round((metadata.width || 1024) * scale);
    const newHeight = Math.round((metadata.height || 1024) * scale);

    return sharp(imageBuffer)
        .resize(newWidth, newHeight, {
            kernel: sharp.kernel.lanczos3,
            fit: 'fill',
            withoutEnlargement: false
        })
        .sharpen({
            sigma: 1.0,
            m1: 1.5,
            m2: 0.7,
            x1: 2.0,
            y2: 10,
            y3: 20
        })
        .png({
            quality: 95,
            compressionLevel: 6,
            palette: false
        })
        .toBuffer();
}
