import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import Replicate from 'replicate';
import { supabase } from '@/lib/supabase';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkImageGenerationLimit, recordApiUsage } from '@/lib/usage';

interface UpscaleRequest {
    imageUrl?: string;
    imageBase64?: string;
    scale?: number;        // 拡大倍率（2, 4）
    useAI?: boolean;       // AI超解像を使用するか（デフォルト: true）
}

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

    // クレジット残高チェック (Real-ESRGANモデル用)
    const limitCheck = await checkImageGenerationLimit(user.id, 'real-esrgan', 1);
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
            needPurchase: true,
        }, { status: 402 });
    }
    const skipCreditConsumption = limitCheck.skipCreditConsumption || false;

    try {
        const {
            imageUrl,
            imageBase64,
            scale = 2,
            useAI = true,
        }: UpscaleRequest = await request.json();

        // 拡大倍率を制限（2x または 4x）
        const safeScale = scale >= 3 ? 4 : 2;

        // 画像データ取得
        let imageBuffer: Buffer;
        let inputImageUrl: string | null = null;

        if (imageBase64) {
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64Data, 'base64');
        } else if (imageUrl) {
            inputImageUrl = imageUrl;
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

        let upscaledBuffer: Buffer;
        let modelName = 'sharp-lanczos3';

        // AI超解像を試行
        const replicate = getReplicate();
        if (useAI && replicate) {
            try {
                console.log('Using Real-ESRGAN via Replicate API...');

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
                console.log('Real-ESRGAN upscale completed successfully');

            } catch (aiError: any) {
                console.warn('Real-ESRGAN failed, falling back to Sharp:', aiError.message);
                // フォールバック: Sharp使用
                upscaledBuffer = await sharpUpscale(imageBuffer, safeScale);
                modelName = 'sharp-lanczos3-fallback';
            }
        } else {
            // Sharp使用（AIが無効またはReplicate未設定）
            upscaledBuffer = await sharpUpscale(imageBuffer, safeScale);
            if (!replicate && useAI) {
                console.log('REPLICATE_API_TOKEN not configured, using Sharp');
            }
        }

        // 最終的なサイズを取得
        const finalMetadata = await sharp(upscaledBuffer).metadata();
        const newWidth = finalMetadata.width || originalWidth * safeScale;
        const newHeight = finalMetadata.height || originalHeight * safeScale;

        // Supabaseにアップロード
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
            console.error('Supabase upload error:', uploadError);
            throw new Error('画像のアップロードに失敗しました');
        }

        // 公開URL取得
        const { data: { publicUrl } } = supabase
            .storage
            .from('images')
            .getPublicUrl(filename);

        // DB保存
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

        // ログ記録
        const logResult = await logGeneration({
            userId: user.id,
            type: 'upscale',
            endpoint: '/api/ai/upscale',
            model: modelName,
            inputPrompt: `Upscale ${originalWidth}x${originalHeight} → ${newWidth}x${newHeight} (${safeScale}x)`,
            status: 'succeeded',
            startTime
        });

        // クレジット消費（自分のAPIキー使用時はスキップ、Sharpのみ使用時もスキップ）
        if (logResult && !skipCreditConsumption && modelName.includes('esrgan')) {
            await recordApiUsage(user.id, logResult.id, logResult.estimatedCost, {
                model: modelName,
                imageCount: 1,
            });
        }

        return NextResponse.json({
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
        });

    } catch (error: any) {
        console.error('Upscale Error:', error);

        await logGeneration({
            userId: user.id,
            type: 'upscale',
            endpoint: '/api/ai/upscale',
            model: 'error',
            inputPrompt: 'Error',
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
