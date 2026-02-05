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
    getRateLimitHeaders,
} from '@/lib/rate-limit';
import { v4 as uuidv4 } from 'uuid';

const ENDPOINT = '/api/ai/edit-image';

export async function POST(request: NextRequest) {
    const startTime = createTimer();
    let editPrompt = '';
    const modelUsed = 'gemini-3-pro-image-preview';

    // ユーザー認証を確認
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // リクエストID生成（冪等性キー）
    const requestId = uuidv4();
    let creditDeducted = false;
    let estimatedCostUsd = 0;

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

        // リクエストボディをパース
        const { imageBase64, imageUrl, prompt, productInfo } = await request.json();

        if (!prompt && !productInfo) {
            return NextResponse.json({ error: 'Prompt or productInfo is required' }, { status: 400 });
        }

        // 2. クレジット残高チェック（先払いのための事前確認）
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
                `画像編集 (${modelUsed})`
            );

            if (!deductResult.success) {
                return NextResponse.json({
                    error: 'INSUFFICIENT_CREDIT',
                    message: deductResult.error || 'クレジット不足です',
                    needPurchase: true,
                }, { status: 402 });
            }

            creditDeducted = true;
            console.log(`[EDIT-IMAGE] Credit deducted: $${estimatedCostUsd}, requestId: ${requestId}`);
        }

        // 4. GenerationRun を processing 状態で作成
        editPrompt = productInfo
            ? `この画像のレイアウトと構成を維持しながら、以下の商材/サービス用にリブランディングしてください:

${productInfo}

指示:
- 元のデザインレイアウトを維持
- テキスト部分を新しい商材に合わせて変更
- 色味やスタイルは新商材に適したものに調整
- プロフェッショナルなLP画像として仕上げてください
- 縦長の画像（ポートレート、アスペクト比 9:16 または 3:4）で出力すること

${prompt ? `追加指示: ${prompt}` : ''}`
            : `${prompt}\n\n【重要】縦長の画像（ポートレート形式）で出力してください。`;

        const { run, isExisting } = await createOrGetGenerationRun(user.id, requestId, {
            type: 'edit-image',
            endpoint: ENDPOINT,
            model: modelUsed,
            inputPrompt: editPrompt,
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

        // 5. APIキーを取得
        const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user.id);
        if (!GOOGLE_API_KEY) {
            // APIキーがない場合は返金
            if (creditDeducted) {
                await refundCredit(user.id, estimatedCostUsd, requestId, 'APIキー未設定');
                console.log(`[EDIT-IMAGE] Credit refunded (no API key), requestId: ${requestId}`);
            }
            await updateGenerationRunStatus(requestId, 'failed', {
                errorMessage: 'Google API key is not configured',
            });
            return NextResponse.json({ error: 'Google API key is not configured. 設定画面でAPIキーを設定してください。' }, { status: 500 });
        }

        // 6. 画像データを取得
        let base64Data: string;
        let mimeType = 'image/png';

        if (imageBase64) {
            base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        } else if (imageUrl) {
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                if (creditDeducted) {
                    await refundCredit(user.id, estimatedCostUsd, requestId, '画像取得失敗');
                    console.log(`[EDIT-IMAGE] Credit refunded (image fetch failed), requestId: ${requestId}`);
                }
                await updateGenerationRunStatus(requestId, 'failed', {
                    errorMessage: 'Failed to fetch image from URL',
                });
                return NextResponse.json({ error: 'Failed to fetch image from URL' }, { status: 400 });
            }
            const arrayBuffer = await imageResponse.arrayBuffer();
            base64Data = Buffer.from(arrayBuffer).toString('base64');
            mimeType = imageResponse.headers.get('content-type') || 'image/png';
        } else {
            if (creditDeducted) {
                await refundCredit(user.id, estimatedCostUsd, requestId, '画像データ不足');
                console.log(`[EDIT-IMAGE] Credit refunded (no image data), requestId: ${requestId}`);
            }
            await updateGenerationRunStatus(requestId, 'failed', {
                errorMessage: 'Either imageBase64 or imageUrl is required',
            });
            return NextResponse.json({ error: 'Either imageBase64 or imageUrl is required' }, { status: 400 });
        }

        // 7. Gemini API を呼び出し（リトライ付き）
        const maxRetries = 3;
        let response: Response | null = null;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[EDIT-IMAGE] Attempt ${attempt}/${maxRetries}...`);
                response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    { text: editPrompt },
                                    {
                                        inlineData: {
                                            mimeType: mimeType,
                                            data: base64Data
                                        }
                                    }
                                ]
                            }],
                            generationConfig: {
                                responseModalities: ["TEXT", "IMAGE"]
                            }
                        })
                    }
                );

                if (response.ok) {
                    console.log(`[EDIT-IMAGE] Success on attempt ${attempt}`);
                    break;
                }

                // 503/429エラーの場合はリトライ
                if (response.status === 503 || response.status === 429) {
                    const errorText = await response.text();
                    console.error(`[EDIT-IMAGE] Attempt ${attempt} failed with ${response.status}:`, errorText);
                    lastError = new Error(`画像編集に失敗しました: ${response.status}`);

                    if (attempt < maxRetries) {
                        const waitTime = Math.pow(2, attempt) * 1000;
                        console.log(`[EDIT-IMAGE] Retrying in ${waitTime}ms...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        response = null;
                        continue;
                    }
                } else {
                    // その他のエラーは即座に失敗
                    const errorText = await response.text();
                    console.error('Image editing failed:', errorText);
                    lastError = new Error(`Image editing failed: ${response.status} - ${errorText}`);
                    break;
                }
            } catch (fetchError: any) {
                console.error(`[EDIT-IMAGE] Attempt ${attempt} fetch error:`, fetchError.message);
                lastError = fetchError;
                if (attempt < maxRetries) {
                    const waitTime = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
            }
        }

        // 8. API失敗時は返金
        if (!response || !response.ok) {
            const errorMessage = lastError?.message || 'Unknown error after retries';

            if (creditDeducted) {
                await refundCredit(user.id, estimatedCostUsd, requestId, `API失敗: ${errorMessage}`);
                console.log(`[EDIT-IMAGE] Credit refunded due to error, requestId: ${requestId}`);
            }

            await updateGenerationRunStatus(requestId, 'failed', {
                errorMessage,
                durationMs: Date.now() - startTime,
            });

            await logGeneration({
                userId: user.id,
                type: 'edit-image',
                endpoint: ENDPOINT,
                model: modelUsed,
                inputPrompt: editPrompt,
                imageCount: 1,
                status: 'failed',
                errorMessage,
                startTime
            });

            return NextResponse.json({ error: errorMessage }, { status: 500 });
        }

        // 9. レスポンスを処理
        const data = await response.json();
        const result = await processImageResponse(data, user.id);

        // 10. 成功時のステータス更新
        const resultJson = await result.json();
        const resultClone = NextResponse.json(resultJson);

        await updateGenerationRunStatus(requestId, 'succeeded', {
            outputResult: JSON.stringify(resultJson),
            durationMs: Date.now() - startTime,
        });

        // ログ記録（成功）
        await logGeneration({
            userId: user.id,
            type: 'edit-image',
            endpoint: ENDPOINT,
            model: modelUsed,
            inputPrompt: editPrompt,
            imageCount: 1,
            status: 'succeeded',
            startTime
        });

        console.log(`[EDIT-IMAGE] Completed successfully, requestId: ${requestId}`);

        return resultClone;

    } catch (error: any) {
        console.error('Image Edit Error:', error);

        // エラー時は返金
        if (creditDeducted) {
            try {
                await refundCredit(user.id, estimatedCostUsd, requestId, `エラー: ${error.message}`);
                console.log(`[EDIT-IMAGE] Credit refunded due to exception, requestId: ${requestId}`);
            } catch (refundError) {
                console.error('[EDIT-IMAGE] Failed to refund credit:', refundError);
            }
        }

        // GenerationRun ステータス更新
        try {
            await updateGenerationRunStatus(requestId, 'failed', {
                errorMessage: error.message,
                durationMs: Date.now() - startTime,
            });
        } catch (updateError) {
            console.error('[EDIT-IMAGE] Failed to update generation run status:', updateError);
        }

        // ログ記録（エラー）
        await logGeneration({
            userId: user.id,
            type: 'edit-image',
            endpoint: ENDPOINT,
            model: modelUsed,
            inputPrompt: editPrompt || 'Error before prompt',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

async function processImageResponse(data: any, userId: string | null) {
    // Extract image from response
    const parts = data.candidates?.[0]?.content?.parts || [];
    let editedImageBase64: string | null = null;
    let textResponse: string | null = null;

    for (const part of parts) {
        if (part.inlineData?.data) {
            editedImageBase64 = part.inlineData.data;
        }
        if (part.text) {
            textResponse = part.text;
        }
    }

    if (!editedImageBase64) {
        // If no image was generated, return just the text analysis
        return NextResponse.json({
            success: false,
            message: 'Image editing not available for this request. Model returned text only.',
            textResponse
        });
    }

    // Upload edited image to Supabase
    const buffer = Buffer.from(editedImageBase64, 'base64');
    const filename = `edited-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;

    const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('images')
        .upload(filename, buffer, {
            contentType: 'image/png',
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        throw new Error('Failed to upload edited image to storage');
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
        .storage
        .from('images')
        .getPublicUrl(filename);

    // Create DB record (縦長画像: 9:16比率)
    const media = await prisma.mediaImage.create({
        data: {
            userId,
            filePath: publicUrl,
            mime: 'image/png',
            width: 768,
            height: 1366,
        },
    });

    return NextResponse.json({
        success: true,
        media,
        textResponse
    });
}
