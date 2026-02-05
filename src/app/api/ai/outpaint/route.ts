import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { checkImageGenerationLimit } from '@/lib/usage';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { prisma } from '@/lib/db';
import { fetchWithRetry } from '@/lib/gemini-retry';
import { deductCreditAtomic, refundCredit } from '@/lib/credits';
import {
    checkAllRateLimits,
    createOrGetGenerationRun,
    updateGenerationRunStatus,
} from '@/lib/rate-limit';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 60;

const ENDPOINT = '/api/ai/outpaint';
const MODEL = 'gemini-3-pro-image-preview';

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // リクエストID生成（冪等性キー）
    const requestId = uuidv4();
    let creditDeducted = false;
    let estimatedCostUsd = 0;
    const startTime = createTimer();
    let fullPrompt = '';

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

        const { image, direction, expandAmount, prompt, targetWidth, targetHeight } = await request.json() as {
            image: string;
            direction: 'left' | 'right' | 'top' | 'bottom' | 'all';
            expandAmount: number;
            prompt?: string;
            targetWidth: number;
            targetHeight: number;
        };

        if (!image) {
            return NextResponse.json({ error: '画像が必要です' }, { status: 400 });
        }

        // 2. クレジット残高チェック（先払いのための事前確認）
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

        // 3. 先払い：クレジットをアトミックに引き落とし
        if (!skipCreditConsumption && estimatedCostUsd > 0) {
            const deductResult = await deductCreditAtomic(
                user.id,
                estimatedCostUsd,
                requestId,
                `アウトペイント (${MODEL})`
            );

            if (!deductResult.success) {
                return NextResponse.json({
                    error: 'INSUFFICIENT_CREDIT',
                    message: deductResult.error || 'クレジット不足です',
                    needPurchase: true,
                }, { status: 402 });
            }

            creditDeducted = true;
            console.log(`[OUTPAINT] Credit deducted: $${estimatedCostUsd}, requestId: ${requestId}`);
        }

        // 4. 方向に応じたプロンプト生成
        const directionDesc = {
            left: '左側に',
            right: '右側に',
            top: '上側に',
            bottom: '下側に',
            all: '四方に'
        }[direction] || '周囲に';

        fullPrompt = `この画像を${directionDesc}拡張してください。

【重要なルール】
1. 元の画像の内容と境界は完全に維持する
2. 拡張部分は元の画像と自然に繋がるようにする
3. 拡張部分のスタイル（色調、質感、照明）は元の画像と統一する
4. 出力サイズ: ${targetWidth}x${targetHeight}px

${prompt ? `【追加指示】\n${prompt}` : '【拡張内容】\n周囲の背景を自然に拡張し、違和感のない画像にしてください。'}

元の画像を中心に配置し、${directionDesc}新しい領域を生成してください。`;

        // 5. GenerationRun を processing 状態で作成
        const { run, isExisting } = await createOrGetGenerationRun(user.id, requestId, {
            type: 'outpaint',
            endpoint: ENDPOINT,
            model: MODEL,
            inputPrompt: fullPrompt,
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

        // 6. APIキー取得
        const apiKey = await getGoogleApiKeyForUser(user.id);
        if (!apiKey) {
            if (creditDeducted) {
                await refundCredit(user.id, estimatedCostUsd, requestId, 'APIキー未設定');
                console.log(`[OUTPAINT] Credit refunded (no API key), requestId: ${requestId}`);
            }
            await updateGenerationRunStatus(requestId, 'failed', {
                errorMessage: 'Google AI APIキーの設定が必要です',
            });
            return NextResponse.json({
                error: 'API_KEY_REQUIRED',
                message: 'Google AI APIキーの設定が必要です',
            }, { status: 402 });
        }

        // 7. Base64データを抽出
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

        // 8. Gemini APIコール（リトライ付き）
        let response: Response;
        try {
            response = await fetchWithRetry(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { inlineData: { mimeType: 'image/png', data: base64Data } },
                                { text: fullPrompt }
                            ]
                        }],
                        generationConfig: {
                            responseModalities: ["IMAGE", "TEXT"],
                            temperature: 0.4
                        }
                    })
                }
            );
        } catch (fetchError: any) {
            // API呼び出し失敗時は返金
            if (creditDeducted) {
                await refundCredit(user.id, estimatedCostUsd, requestId, `API失敗: ${fetchError.message}`);
                console.log(`[OUTPAINT] Credit refunded due to fetch error, requestId: ${requestId}`);
            }
            await updateGenerationRunStatus(requestId, 'failed', {
                errorMessage: fetchError.message,
                durationMs: Date.now() - startTime,
            });

            await logGeneration({
                userId: user.id,
                type: 'outpaint',
                endpoint: ENDPOINT,
                model: MODEL,
                inputPrompt: fullPrompt,
                imageCount: 1,
                status: 'failed',
                errorMessage: fetchError.message,
                startTime
            });

            throw fetchError;
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];

        let resultBase64: string | null = null;
        for (const part of parts) {
            if (part.inlineData?.data) {
                resultBase64 = part.inlineData.data;
                break;
            }
        }

        if (!resultBase64) {
            const errorMessage = '画像生成結果が取得できませんでした';
            if (creditDeducted) {
                await refundCredit(user.id, estimatedCostUsd, requestId, errorMessage);
                console.log(`[OUTPAINT] Credit refunded (no result), requestId: ${requestId}`);
            }
            await updateGenerationRunStatus(requestId, 'failed', {
                errorMessage,
                durationMs: Date.now() - startTime,
            });

            await logGeneration({
                userId: user.id,
                type: 'outpaint',
                endpoint: ENDPOINT,
                model: MODEL,
                inputPrompt: fullPrompt,
                imageCount: 1,
                status: 'failed',
                errorMessage,
                startTime
            });

            throw new Error(errorMessage);
        }

        // 9. Supabaseにアップロード
        const buffer = Buffer.from(resultBase64, 'base64');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filePath = `${uniqueSuffix}-outpaint.png`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('images')
            .upload(filePath, buffer, {
                contentType: 'image/png',
                upsert: false
            });

        if (uploadError) {
            console.error('[OUTPAINT] Upload error:', uploadError);
            const errorMessage = '画像のアップロードに失敗しました';
            if (creditDeducted) {
                await refundCredit(user.id, estimatedCostUsd, requestId, errorMessage);
                console.log(`[OUTPAINT] Credit refunded (upload failed), requestId: ${requestId}`);
            }
            await updateGenerationRunStatus(requestId, 'failed', {
                errorMessage,
                durationMs: Date.now() - startTime,
            });
            throw new Error(errorMessage);
        }

        const { data: urlData } = supabaseAdmin.storage
            .from('images')
            .getPublicUrl(filePath);

        // 10. MediaImageレコードを作成
        const mediaImage = await prisma.mediaImage.create({
            data: {
                userId: user.id,
                filePath: urlData.publicUrl,
                mime: 'image/png',
                width: targetWidth,
                height: targetHeight,
            }
        });

        // 11. 成功時のステータス更新
        const resultData = {
            url: urlData.publicUrl,
            id: mediaImage.id,
            cost: estimatedCostUsd,
        };

        await updateGenerationRunStatus(requestId, 'succeeded', {
            outputResult: JSON.stringify(resultData),
            durationMs: Date.now() - startTime,
        });

        // ログ記録（成功）
        await logGeneration({
            userId: user.id,
            type: 'outpaint',
            endpoint: ENDPOINT,
            model: MODEL,
            inputPrompt: fullPrompt,
            imageCount: 1,
            status: 'succeeded',
            startTime
        });

        console.log(`[OUTPAINT] Completed successfully, requestId: ${requestId}`);

        return NextResponse.json(resultData);

    } catch (error: any) {
        console.error('[OUTPAINT] Error:', error);

        // エラー時は返金
        if (creditDeducted) {
            try {
                await refundCredit(user.id, estimatedCostUsd, requestId, `エラー: ${error.message}`);
                console.log(`[OUTPAINT] Credit refunded due to exception, requestId: ${requestId}`);
            } catch (refundError) {
                console.error('[OUTPAINT] Failed to refund credit:', refundError);
            }
        }

        // GenerationRun ステータス更新
        try {
            await updateGenerationRunStatus(requestId, 'failed', {
                errorMessage: error.message,
                durationMs: Date.now() - startTime,
            });
        } catch (updateError) {
            console.error('[OUTPAINT] Failed to update generation run status:', updateError);
        }

        // ログ記録（エラー）- まだ記録されていない場合のみ
        if (fullPrompt) {
            await logGeneration({
                userId: user.id,
                type: 'outpaint',
                endpoint: ENDPOINT,
                model: MODEL,
                inputPrompt: fullPrompt,
                status: 'failed',
                errorMessage: error.message,
                startTime
            });
        }

        return NextResponse.json({ error: error.message || 'AI拡張に失敗しました' }, { status: 500 });
    }
}
