import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { supabase } from '@/lib/supabase';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { logGeneration, createTimer } from '@/lib/generation-logger';

// Real-ESRGAN (UpscalerJS) を動的インポート（TensorFlow.js対応）
let Upscaler: any = null;
let esrganModel: any = null;

async function getUpscaler() {
    if (!Upscaler) {
        // 動的インポートでサーバーサイドのみでロード
        const upscalerModule = await import('upscaler');
        Upscaler = upscalerModule.default;

        // ESRGAN Thick モデル（高品質版）
        const modelModule = await import('@upscalerjs/esrgan-thick');
        esrganModel = modelModule.default;
    }
    return { Upscaler, esrganModel };
}

interface UpscaleRequest {
    imageUrl?: string;
    imageBase64?: string;
    scale?: number;        // 拡大倍率（2, 4）Real-ESRGANは2x/4xをサポート
    useRealESRGAN?: boolean; // Real-ESRGAN使用（デフォルト: true）
}

export async function POST(request: NextRequest) {
    const startTime = createTimer();

    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const {
            imageUrl,
            imageBase64,
            scale = 2,
            useRealESRGAN = true
        }: UpscaleRequest = await request.json();

        // Real-ESRGANは2xと4xのみサポート
        const safeScale = scale >= 3 ? 4 : 2;

        // 画像データ取得
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

        let upscaledBuffer: Buffer;
        let modelName = 'sharp-lanczos3';

        if (useRealESRGAN) {
            try {
                // Real-ESRGAN (UpscalerJS) を使用
                const { Upscaler, esrganModel } = await getUpscaler();

                // UpscalerJSインスタンス作成
                const upscaler = new Upscaler({
                    model: esrganModel,
                });

                // Base64形式で入力
                const inputBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;

                // アップスケール実行（結果はBase64 Data URL）
                const upscaledDataUrl = await upscaler.upscale(inputBase64, {
                    output: 'base64',
                    patchSize: 64,      // メモリ使用量を抑えるためパッチ処理
                    padding: 2,
                });

                // Base64からBufferに変換
                const upscaledBase64 = upscaledDataUrl.replace(/^data:image\/\w+;base64,/, '');
                upscaledBuffer = Buffer.from(upscaledBase64, 'base64');
                modelName = 'real-esrgan-thick';

                // 必要に応じて追加のスケール調整（4xの場合）
                if (safeScale === 4) {
                    // Real-ESRGANを2回適用で4x
                    const secondPass = await upscaler.upscale(upscaledDataUrl, {
                        output: 'base64',
                        patchSize: 64,
                        padding: 2,
                    });
                    const secondBase64 = secondPass.replace(/^data:image\/\w+;base64,/, '');
                    upscaledBuffer = Buffer.from(secondBase64, 'base64');
                }

                // クリーンアップ
                upscaler.dispose();

            } catch (esrganError: any) {
                console.warn('Real-ESRGAN failed, falling back to Sharp:', esrganError.message);
                // フォールバック: Sharp使用
                upscaledBuffer = await sharpUpscale(imageBuffer, safeScale);
                modelName = 'sharp-lanczos3-fallback';
            }
        } else {
            // Sharp使用
            upscaledBuffer = await sharpUpscale(imageBuffer, safeScale);
        }

        // 最終的なサイズを取得
        const finalMetadata = await sharp(upscaledBuffer).metadata();
        const newWidth = finalMetadata.width || originalWidth * safeScale;
        const newHeight = finalMetadata.height || originalHeight * safeScale;

        // Supabaseにアップロード
        const filename = `upscaled-esrgan-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
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
                sourceType: 'upscale-esrgan',
            },
        });

        const durationMs = Date.now() - startTime;

        // ログ記録
        await logGeneration({
            userId: user.id,
            type: 'upscale',
            endpoint: '/api/ai/upscale',
            model: modelName,
            inputPrompt: `Real-ESRGAN Upscale ${originalWidth}x${originalHeight} → ${newWidth}x${newHeight} (${safeScale}x)`,
            status: 'succeeded',
            startTime
        });

        return NextResponse.json({
            success: true,
            media,
            upscaleInfo: {
                model: modelName,
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
            model: 'real-esrgan-thick',
            inputPrompt: 'Error',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// Sharp フォールバック関数
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
