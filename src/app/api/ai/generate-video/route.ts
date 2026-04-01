import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { supabase as supabaseStorage } from '@/lib/supabase';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkFeatureAccess, checkVideoGenerationLimit, recordApiUsage } from '@/lib/usage';
import { checkBanStatus } from '@/lib/security';

// Veo 3.1 Lite API (Gemini API経由)
// https://ai.google.dev/gemini-api/docs/video
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const VEO_MODEL = 'veo-3.1-lite-generate-preview';

// 動画生成の料金 (解像度別)
const COST_PER_SECOND: Record<string, number> = {
    '720p': 0.05,
    '1080p': 0.08,
};

export async function POST(request: NextRequest) {
    const startTime = createTimer();

    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // BANチェック
    const banResponse = await checkBanStatus(user.id);
    if (banResponse) return banResponse;

    try {
        // 動画生成機能のアクセスチェック（Enterpriseプランのみ）
        const featureCheck = await checkFeatureAccess(user.id, 'generateVideo');
        if (!featureCheck.allowed) {
            return NextResponse.json(
                { error: featureCheck.reason || '動画生成機能はEnterpriseプランでのみ利用可能です' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { prompt, sourceImageUrl, duration = 4, resolution = '720p' } = body;
        const validResolution = resolution === '1080p' ? '1080p' : '720p';

        // クレジット残高チェック
        const creditCheck = await checkVideoGenerationLimit(user.id, duration, validResolution as any);
        if (!creditCheck.allowed) {
            if (creditCheck.needApiKey) {
                return NextResponse.json({
                    error: 'API_KEY_REQUIRED',
                    message: creditCheck.reason,
                }, { status: 402 });
            }
            if (creditCheck.needSubscription) {
                return NextResponse.json({
                    error: 'SUBSCRIPTION_REQUIRED',
                    message: creditCheck.reason,
                }, { status: 402 });
            }
            return NextResponse.json({
                error: 'INSUFFICIENT_CREDIT',
                message: creditCheck.reason,
                credits: {
                    currentBalance: creditCheck.currentBalanceUsd,
                    estimatedCost: creditCheck.estimatedCostUsd,
                },
                needPurchase: true,
            }, { status: 402 });
        }

        // クレジット消費をスキップするかどうか
        const skipCreditConsumption = creditCheck.skipCreditConsumption || false;

        if (!prompt || typeof prompt !== 'string') {
            return NextResponse.json({ error: 'プロンプトは必須です' }, { status: 400 });
        }

        // Google API Keyを取得
        const googleApiKey = await getGoogleApiKeyForUser(user.id);
        if (!googleApiKey) {
            return NextResponse.json(
                { error: 'Google API Keyが設定されていません。設定ページでAPIキーを登録してください。' },
                { status: 400 }
            );
        }

        // リクエストボディを構築 (Veo 3.1 Lite形式)
        const requestBody: any = {
            instances: [{
                prompt: prompt,
            }],
            parameters: {
                aspectRatio: "16:9",
                durationSeconds: Number(duration),
                resolution: validResolution,
                personGeneration: "allow_all",
            }
        };

        // Image-to-Video: 参照画像がある場合
        if (sourceImageUrl) {
            let imageBase64: string = '';
            let mimeType: string = 'image/png';

            if (sourceImageUrl.startsWith('data:')) {
                // 既にBase64の場合
                const base64Match = sourceImageUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
                if (base64Match) {
                    mimeType = base64Match[1];
                    imageBase64 = base64Match[2];
                }
            } else {
                // URLから画像を取得
                const imageResponse = await fetch(sourceImageUrl);
                const imageBuffer = await imageResponse.arrayBuffer();
                imageBase64 = Buffer.from(imageBuffer).toString('base64');

                // Content-Typeを取得
                const contentType = imageResponse.headers.get('content-type');
                if (contentType) {
                    mimeType = contentType;
                }
            }

            if (imageBase64) {
                requestBody.instances[0].image = {
                    inlineData: {
                        mimeType: mimeType,
                        data: imageBase64,
                    },
                };
            }
        }

        console.log('[Veo 3.1 Lite] Sending request to:', `${BASE_URL}/models/${VEO_MODEL}:predictLongRunning`);
        console.log('[Veo 3.1 Lite] Request:', {
            prompt: prompt.substring(0, 100) + '...',
            hasSourceImage: !!sourceImageUrl,
            duration,
            resolution: validResolution,
        });

        // Veo 3.1 Lite APIを呼び出し (Long Running Operation)
        const response = await fetch(`${BASE_URL}/models/${VEO_MODEL}:predictLongRunning`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': googleApiKey,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Veo 3.1 Lite] Error response:', response.status, errorText);

            // エラーログを記録
            await logGeneration({
                userId: user.id,
                type: 'video-generate',
                endpoint: '/api/ai/generate-video',
                model: VEO_MODEL,
                inputPrompt: prompt,
                status: 'failed',
                errorMessage: `API Error: ${response.status} - ${errorText}`,
                startTime,
            });

            // エラーメッセージを解析
            let errorMessage = 'AI動画生成に失敗しました';
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error?.message) {
                    errorMessage = errorJson.error.message;
                }
            } catch (e) {
                // JSONパースエラーは無視
            }

            return NextResponse.json({ error: errorMessage }, { status: response.status });
        }

        const operationResult = await response.json();
        console.log('[Veo 3.1 Lite] Operation started:', operationResult.name);

        // Long-running operationの完了をポーリング
        const operationName = operationResult.name;
        let videoData: any = null;
        let attempts = 0;
        const maxAttempts = 180; // 最大3分待機 (動画生成は時間がかかる)

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機

            const opResponse = await fetch(
                `${BASE_URL}/${operationName}`,
                {
                    headers: {
                        'x-goog-api-key': googleApiKey,
                    },
                }
            );

            if (opResponse.ok) {
                const opResult = await opResponse.json();
                console.log('[Veo 3.1 Lite] Polling attempt', attempts + 1, '- done:', opResult.done);

                if (opResult.done) {
                    if (opResult.error) {
                        throw new Error(opResult.error.message || 'Video generation failed');
                    }
                    videoData = opResult.response;
                    break;
                }
            } else {
                console.error('[Veo 3.1 Lite] Polling error:', await opResponse.text());
            }

            attempts++;
        }

        if (!videoData) {
            throw new Error('動画生成がタイムアウトしました。後でもう一度お試しください。');
        }

        console.log('[Veo 3.1 Lite] Video generated:', JSON.stringify(videoData).substring(0, 500));

        // 動画URLを抽出 (Veo 3.1 Lite レスポンス形式)
        let videoUrl = '';
        const videoDuration = duration;

        // Veo 3.1 Lite: generateVideoResponse.generatedSamples 形式
        const generatedSamples = videoData.generateVideoResponse?.generatedSamples
            || videoData.generatedVideos; // フォールバック

        if (generatedSamples && generatedSamples[0]) {
            const generatedVideo = generatedSamples[0];

            // 動画はURIとして返される
            if (generatedVideo.video?.uri) {
                videoUrl = generatedVideo.video.uri;
            }

            // または、バイナリデータとして返される場合
            const base64Data = generatedVideo.video?.bytesBase64Encoded
                || generatedVideo.video?.inlineData?.data;
            if (base64Data) {
                const videoBuffer = Buffer.from(base64Data, 'base64');
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const filename = `veo-generated-${uniqueSuffix}.mp4`;

                const { error: uploadError } = await supabaseStorage
                    .storage
                    .from('videos')
                    .upload(filename, videoBuffer, {
                        contentType: 'video/mp4',
                        cacheControl: '3600',
                    });

                if (uploadError) {
                    console.error('[Veo 3.1 Lite] Upload error:', uploadError);
                    throw new Error('生成された動画のアップロードに失敗しました');
                }

                const { data: { publicUrl } } = supabaseStorage
                    .storage
                    .from('videos')
                    .getPublicUrl(filename);

                videoUrl = publicUrl;
            }
        }

        if (!videoUrl) {
            throw new Error('動画URLの取得に失敗しました');
        }

        // DBに保存
        await prisma.mediaVideo.create({
            data: {
                userId: user.id,
                filePath: videoUrl,
                mime: 'video/mp4',
                duration: videoDuration,
                prompt,
                sourceType: 'ai-generate',
                sourceUrl: sourceImageUrl || null,
            },
        });

        // 成功ログを記録
        const estimatedCost = videoDuration * (COST_PER_SECOND[validResolution] ?? COST_PER_SECOND['720p']);
        const logResult = await logGeneration({
            userId: user.id,
            type: 'video-generate',
            endpoint: '/api/ai/generate-video',
            model: VEO_MODEL,
            inputPrompt: prompt,
            imageCount: 1,
            status: 'succeeded',
            startTime,
        });

        // クレジット消費（自分のAPIキー使用時はスキップ）
        if (logResult && !skipCreditConsumption) {
            await recordApiUsage(user.id, logResult.id, estimatedCost, {
                model: VEO_MODEL,
            });
        }

        return NextResponse.json({
            success: true,
            videoUrl,
            duration: videoDuration,
            estimatedCost,
        });

    } catch (error: any) {
        console.error('[Veo 3.1 Lite] Error:', error);

        // エラーログを記録
        await logGeneration({
            userId: user.id,
            type: 'video-generate',
            endpoint: '/api/ai/generate-video',
            model: VEO_MODEL,
            inputPrompt: 'Error occurred',
            status: 'failed',
            errorMessage: error.message,
            startTime,
        });

        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'AI動画生成に失敗しました' : error.message },
            { status: 500 }
        );
    }
}
