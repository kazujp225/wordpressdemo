import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration } from '@/lib/generation-logger';

// Veo 2 API (Gemini API経由)
// https://ai.google.dev/gemini-api/docs/video
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const VEO_MODEL = 'veo-2.0-generate-001';

// 動画生成の料金: $0.35/秒
const COST_PER_SECOND = 0.35;

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    // ユーザー認証
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { prompt, sourceImageUrl, duration = 5 } = body;

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

        // リクエストボディを構築
        const requestBody: any = {
            instances: [{
                prompt: prompt,
            }],
            parameters: {
                aspectRatio: "16:9",
                personGeneration: "allow_adult",
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
                    bytesBase64Encoded: imageBase64,
                    mimeType: mimeType,
                };
            }
        }

        console.log('[Veo API] Sending request to:', `${BASE_URL}/models/${VEO_MODEL}:predictLongRunning`);
        console.log('[Veo API] Request:', {
            prompt: prompt.substring(0, 100) + '...',
            hasSourceImage: !!sourceImageUrl,
        });

        // Veo 2 APIを呼び出し (Long Running Operation)
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
            console.error('[Veo API] Error response:', response.status, errorText);

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
        console.log('[Veo API] Operation started:', operationResult.name);

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
                console.log('[Veo API] Polling attempt', attempts + 1, '- done:', opResult.done);

                if (opResult.done) {
                    if (opResult.error) {
                        throw new Error(opResult.error.message || 'Video generation failed');
                    }
                    videoData = opResult.response;
                    break;
                }
            } else {
                console.error('[Veo API] Polling error:', await opResponse.text());
            }

            attempts++;
        }

        if (!videoData) {
            throw new Error('動画生成がタイムアウトしました。後でもう一度お試しください。');
        }

        console.log('[Veo API] Video generated:', JSON.stringify(videoData).substring(0, 500));

        // 動画URLを抽出
        let videoUrl = '';
        let videoDuration = duration;

        if (videoData.generatedVideos && videoData.generatedVideos[0]) {
            const generatedVideo = videoData.generatedVideos[0];

            // 動画はURIとして返される
            if (generatedVideo.video?.uri) {
                videoUrl = generatedVideo.video.uri;
            }

            // または、バイナリデータとして返される場合
            if (generatedVideo.video?.bytesBase64Encoded) {
                const videoBuffer = Buffer.from(generatedVideo.video.bytesBase64Encoded, 'base64');
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const filename = `veo-generated-${uniqueSuffix}.mp4`;

                const { error: uploadError } = await supabase
                    .storage
                    .from('videos')
                    .upload(filename, videoBuffer, {
                        contentType: 'video/mp4',
                        cacheControl: '3600',
                    });

                if (uploadError) {
                    console.error('[Veo API] Upload error:', uploadError);
                    throw new Error('生成された動画のアップロードに失敗しました');
                }

                const { data: { publicUrl } } = supabase
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
        const estimatedCost = videoDuration * COST_PER_SECOND;
        await logGeneration({
            userId: user.id,
            type: 'video-generate',
            endpoint: '/api/ai/generate-video',
            model: VEO_MODEL,
            inputPrompt: prompt,
            imageCount: 1,
            status: 'succeeded',
            startTime,
        });

        return NextResponse.json({
            success: true,
            videoUrl,
            duration: videoDuration,
            estimatedCost,
        });

    } catch (error: any) {
        console.error('[Veo API] Error:', error);

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
            { error: error.message || 'AI動画生成に失敗しました' },
            { status: 500 }
        );
    }
}
