import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkImageGenerationLimit } from '@/lib/usage';
import { deductCreditAtomic, refundCredit } from '@/lib/credits';
import {
    checkAllRateLimits,
    createOrGetGenerationRun,
    updateGenerationRunStatus,
} from '@/lib/rate-limit';
import { v4 as uuidv4 } from 'uuid';

const ENDPOINT = '/api/ai/generate-banner';

export async function POST(request: NextRequest) {
    const startTime = createTimer();
    let bannerPrompt = '';
    const modelUsed = 'gemini-3-pro-image-preview';

    // ユーザー認証
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestId = uuidv4();
    let creditDeducted = false;
    let estimatedCostUsd = 0;

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

        // リクエストボディをパース
        const { prompt, productInfo, referenceImageBase64, referenceImageUrl, width, height, platform, segment } = await request.json();

        if (!prompt && !productInfo) {
            return NextResponse.json({ error: 'Prompt or productInfo is required' }, { status: 400 });
        }

        if (!width || !height) {
            return NextResponse.json({ error: 'width and height are required' }, { status: 400 });
        }

        // 2. クレジット残高チェック
        const limitCheck = await checkImageGenerationLimit(user.id, modelUsed, 1);
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

        // 3. 先払い：クレジットをアトミックに引き落とし
        if (!skipCreditConsumption && estimatedCostUsd > 0) {
            const deductResult = await deductCreditAtomic(
                user.id,
                estimatedCostUsd,
                requestId,
                `バナー生成 (${modelUsed})`
            );

            if (!deductResult.success) {
                return NextResponse.json({
                    error: 'INSUFFICIENT_CREDIT',
                    message: deductResult.error || 'クレジット不足です',
                    needPurchase: true,
                }, { status: 402 });
            }

            creditDeducted = true;
            console.log(`[BANNER-GEN] Credit deducted: $${estimatedCostUsd}, requestId: ${requestId}`);
        }

        // 4. プロンプト構築
        const aspectRatio = `${width}x${height}`;
        const segmentInfo = segment ? `\nターゲット: ${segment}` : '';

        bannerPrompt = productInfo
            ? `以下の商材/サービス用の広告バナーを生成してください。

商材情報:
${productInfo}
${segmentInfo}

バナー仕様:
- サイズ: ${aspectRatio}ピクセル（正確にこのアスペクト比で出力）
- プラットフォーム: ${platform || '汎用'}
- プロフェッショナルな広告バナーとして仕上げること
- テキストは読みやすく、インパクトのあるデザイン
- CTA（行動喚起）要素を含めること

${prompt ? `追加指示: ${prompt}` : ''}`
            : `${prompt}

【重要】${aspectRatio}ピクセルの広告バナーとして生成してください。${segmentInfo}`;

        // 5. GenerationRun を processing 状態で作成
        const { run, isExisting } = await createOrGetGenerationRun(user.id, requestId, {
            type: 'banner-generate',
            endpoint: ENDPOINT,
            model: modelUsed,
            inputPrompt: bannerPrompt,
            imageCount: 1,
            estimatedCost: estimatedCostUsd,
        });

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
            return NextResponse.json(
                { error: '同じリクエストが処理中です', requestId },
                { status: 409 }
            );
        }

        // 6. APIキーを取得
        const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user.id);
        if (!GOOGLE_API_KEY) {
            if (creditDeducted) {
                await refundCredit(user.id, estimatedCostUsd, requestId, 'APIキー未設定');
                console.log(`[BANNER-GEN] Credit refunded (no API key), requestId: ${requestId}`);
            }
            await updateGenerationRunStatus(requestId, 'failed', {
                errorMessage: 'Google API key is not configured',
            });
            return NextResponse.json({ error: 'Google API key is not configured. 設定画面でAPIキーを設定してください。' }, { status: 500 });
        }

        // 7. リクエスト構築（参照画像あり/なし）
        const parts: any[] = [{ text: bannerPrompt }];

        // 参照画像がある場合
        if (referenceImageBase64) {
            const base64Data = referenceImageBase64.replace(/^data:image\/\w+;base64,/, '');
            parts.push({
                inlineData: {
                    mimeType: 'image/png',
                    data: base64Data,
                },
            });
        } else if (referenceImageUrl) {
            try {
                const imageResponse = await fetch(referenceImageUrl);
                if (imageResponse.ok) {
                    const arrayBuffer = await imageResponse.arrayBuffer();
                    const base64Data = Buffer.from(arrayBuffer).toString('base64');
                    const mimeType = imageResponse.headers.get('content-type') || 'image/png';
                    parts.push({
                        inlineData: {
                            mimeType,
                            data: base64Data,
                        },
                    });
                }
            } catch (e) {
                console.warn('[BANNER-GEN] Failed to fetch reference image:', e);
            }
        }

        // 8. Gemini API を呼び出し（リトライ付き）
        const maxRetries = 3;
        let response: Response | null = null;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[BANNER-GEN] Attempt ${attempt}/${maxRetries}...`);
                response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts }],
                            generationConfig: {
                                responseModalities: ['TEXT', 'IMAGE'],
                            },
                        }),
                    }
                );

                if (response.ok) {
                    console.log(`[BANNER-GEN] Success on attempt ${attempt}`);
                    break;
                }

                if (response.status === 503 || response.status === 429) {
                    const errorText = await response.text();
                    console.error(`[BANNER-GEN] Attempt ${attempt} failed with ${response.status}:`, errorText);
                    lastError = new Error(`バナー生成に失敗しました: ${response.status}`);

                    if (attempt < maxRetries) {
                        const waitTime = Math.pow(2, attempt) * 1000;
                        console.log(`[BANNER-GEN] Retrying in ${waitTime}ms...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        response = null;
                        continue;
                    }
                } else {
                    const errorText = await response.text();
                    console.error('Banner generation failed:', errorText);
                    lastError = new Error(`Banner generation failed: ${response.status} - ${errorText}`);
                    break;
                }
            } catch (fetchError: any) {
                console.error(`[BANNER-GEN] Attempt ${attempt} fetch error:`, fetchError.message);
                lastError = fetchError;
                if (attempt < maxRetries) {
                    const waitTime = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
            }
        }

        // 9. API失敗時は返金
        if (!response || !response.ok) {
            const errorMessage = lastError?.message || 'Unknown error after retries';

            if (creditDeducted) {
                await refundCredit(user.id, estimatedCostUsd, requestId, `API失敗: ${errorMessage}`);
                console.log(`[BANNER-GEN] Credit refunded due to error, requestId: ${requestId}`);
            }

            await updateGenerationRunStatus(requestId, 'failed', {
                errorMessage,
                durationMs: Date.now() - startTime,
            });

            await logGeneration({
                userId: user.id,
                type: 'banner-generate',
                endpoint: ENDPOINT,
                model: modelUsed,
                inputPrompt: bannerPrompt,
                imageCount: 1,
                status: 'failed',
                errorMessage,
                startTime,
            });

            return NextResponse.json({ error: errorMessage }, { status: 500 });
        }

        // 10. レスポンスを処理
        const data = await response.json();
        const resultResponse = await processImageResponse(data, user.id, width, height);
        const resultJson = await resultResponse.json();
        const resultClone = NextResponse.json(resultJson);

        await updateGenerationRunStatus(requestId, 'succeeded', {
            outputResult: JSON.stringify(resultJson),
            durationMs: Date.now() - startTime,
        });

        await logGeneration({
            userId: user.id,
            type: 'banner-generate',
            endpoint: ENDPOINT,
            model: modelUsed,
            inputPrompt: bannerPrompt,
            imageCount: 1,
            status: 'succeeded',
            startTime,
        });

        console.log(`[BANNER-GEN] Completed successfully, requestId: ${requestId}`);

        return resultClone;

    } catch (error: any) {
        console.error('Banner Generation Error:', error);

        if (creditDeducted) {
            try {
                await refundCredit(user.id, estimatedCostUsd, requestId, `エラー: ${error.message}`);
                console.log(`[BANNER-GEN] Credit refunded due to exception, requestId: ${requestId}`);
            } catch (refundError) {
                console.error('[BANNER-GEN] Failed to refund credit:', refundError);
            }
        }

        try {
            await updateGenerationRunStatus(requestId, 'failed', {
                errorMessage: error.message,
                durationMs: Date.now() - startTime,
            });
        } catch (updateError) {
            console.error('[BANNER-GEN] Failed to update generation run status:', updateError);
        }

        await logGeneration({
            userId: user.id,
            type: 'banner-generate',
            endpoint: ENDPOINT,
            model: modelUsed,
            inputPrompt: bannerPrompt || 'Error before prompt',
            status: 'failed',
            errorMessage: error.message,
            startTime,
        });

        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

async function processImageResponse(data: any, userId: string, width: number, height: number) {
    const parts = data.candidates?.[0]?.content?.parts || [];
    let generatedImageBase64: string | null = null;
    let textResponse: string | null = null;

    for (const part of parts) {
        if (part.inlineData?.data) {
            generatedImageBase64 = part.inlineData.data;
        }
        if (part.text) {
            textResponse = part.text;
        }
    }

    if (!generatedImageBase64) {
        return NextResponse.json({
            success: false,
            message: 'バナー画像を生成できませんでした。',
            textResponse,
        });
    }

    // Supabase Storage にアップロード
    const buffer = Buffer.from(generatedImageBase64, 'base64');
    const filename = `banner-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`;

    const { error: uploadError } = await supabase
        .storage
        .from('images')
        .upload(filename, buffer, {
            contentType: 'image/png',
            cacheControl: '3600',
            upsert: false,
        });

    if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        throw new Error('Failed to upload banner image to storage');
    }

    const { data: { publicUrl } } = supabase
        .storage
        .from('images')
        .getPublicUrl(filename);

    // DB record 作成
    const media = await prisma.mediaImage.create({
        data: {
            userId,
            filePath: publicUrl,
            mime: 'image/png',
            width,
            height,
        },
    });

    return NextResponse.json({
        success: true,
        media,
        textResponse,
    });
}
