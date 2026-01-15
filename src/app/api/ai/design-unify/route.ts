import { NextRequest, NextResponse } from 'next/server';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkGenerationLimit, recordApiUsage } from '@/lib/usage';
import sharp from 'sharp';

const log = {
    info: (msg: string) => console.log(`\x1b[36m[DESIGN-UNIFY]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[DESIGN-UNIFY]\x1b[0m ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[DESIGN-UNIFY]\x1b[0m ${msg}`),
};

interface MaskArea {
    x: number;      // 0-1の比率
    y: number;      // 0-1の比率
    width: number;  // 0-1の比率
    height: number; // 0-1の比率
}

interface DesignUnifyRequest {
    referenceImageUrl: string;      // 参照画像（デザインの正解）
    targetImageUrl: string;         // 修正対象画像
    targetSectionId: number;        // 修正対象セクションID
    masks: MaskArea[];              // マスク領域（不一致部分）
    prompt?: string;                // 追加の指示（オプション）
}

export async function POST(request: NextRequest) {
    const startTime = createTimer();

    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // クレジットチェック（開発環境ではスキップ可能）
    const isDev = process.env.NODE_ENV === 'development';
    const limitCheck = isDev
        ? { allowed: true, skipCreditConsumption: true }
        : await checkGenerationLimit(user.id);

    if (!limitCheck.allowed) {
        return NextResponse.json({
            error: limitCheck.needApiKey ? 'API_KEY_REQUIRED' :
                   limitCheck.needPurchase ? 'CREDIT_INSUFFICIENT' : 'USAGE_LIMIT_EXCEEDED',
            message: limitCheck.reason,
            needApiKey: limitCheck.needApiKey,
            needPurchase: limitCheck.needPurchase,
        }, { status: limitCheck.needApiKey ? 402 : 429 });
    }

    try {
        const body: DesignUnifyRequest = await request.json();
        const { referenceImageUrl, targetImageUrl, targetSectionId, masks, prompt } = body;

        if (!referenceImageUrl || !targetImageUrl || !targetSectionId) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }

        if (!masks || masks.length === 0) {
            return NextResponse.json({ error: 'マスク領域を指定してください' }, { status: 400 });
        }

        const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user.id);
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({
                error: 'Google API key is not configured'
            }, { status: 500 });
        }

        log.info(`Design unify: section ${targetSectionId}, ${masks.length} mask(s)`);

        // 画像を取得
        const [refResponse, targetResponse] = await Promise.all([
            fetch(referenceImageUrl),
            fetch(targetImageUrl),
        ]);

        if (!refResponse.ok || !targetResponse.ok) {
            return NextResponse.json({ error: '画像の取得に失敗しました' }, { status: 500 });
        }

        const refBuffer = Buffer.from(await refResponse.arrayBuffer());
        const targetBuffer = Buffer.from(await targetResponse.arrayBuffer());
        const targetMeta = await sharp(targetBuffer).metadata();

        if (!targetMeta.width || !targetMeta.height) {
            return NextResponse.json({ error: '画像メタデータの取得に失敗しました' }, { status: 500 });
        }

        // === マスク画像を生成 ===
        // 黒背景に白でマスク領域を描画
        const maskBuffer = await createMaskImage(targetMeta.width, targetMeta.height, masks);
        log.info(`Mask image created: ${targetMeta.width}x${targetMeta.height}px, ${masks.length} regions`);

        // === マスク付き対象画像を作成 ===
        // マスク領域を半透明の赤でオーバーレイ（AIに視覚的に伝える）
        const targetWithMaskBuffer = await createTargetWithMaskOverlay(targetBuffer, targetMeta.width, targetMeta.height, masks);

        const refBase64 = refBuffer.toString('base64');
        const targetWithMaskBase64 = targetWithMaskBuffer.toString('base64');

        // プロンプト構築 - デザイン統一用
        const unifyPrompt = `【デザイン統一タスク】

2枚の画像があります。

【1枚目】参照画像 - このデザインスタイルが正しいです
【2枚目】修正対象 - 赤枠の部分を参照画像のスタイルに合わせてください

【重要：自然に馴染ませる】
- 赤枠内のデザイン（色、装飾、アイコンスタイル）を参照画像に合わせる
- 全体のバランスを崩さない
- 周囲と自然に馴染むように修正する
- 元の画像の構造・レイアウトは完全に維持する

【テキストについて】
- テキストの内容は変更しない
- 文字が読めなくなるような変更はしない
- フォントの色は変えてもOK（参照画像に合わせる）

【やってはいけないこと】
- 歪んだ画像を生成する
- 赤枠外を変更する
- レイアウトを崩す
- 参照画像の内容をそのままコピーする
${prompt ? `\n【追加指示】${prompt}` : ''}

自然で違和感のない結果を出力してください。`;

        // Gemini API呼び出し
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            // 参照画像
                            { inlineData: { mimeType: 'image/png', data: refBase64 } },
                            { text: '【参照画像】この画像のバッジ・アイコン・色使いを見本にしてください。' },
                            // マスク付き修正対象画像
                            { inlineData: { mimeType: 'image/png', data: targetWithMaskBase64 } },
                            { text: unifyPrompt },
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ["IMAGE", "TEXT"],
                        temperature: 0.2,  // より安定した出力のため低めに
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            log.error(`Gemini API error: ${errorText}`);
            return NextResponse.json({ error: 'AI処理に失敗しました' }, { status: 500 });
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
            log.error('No image in Gemini response');
            return NextResponse.json({ error: '画像の生成に失敗しました' }, { status: 500 });
        }

        // 結果画像のサイズを確認・調整
        let generatedBuffer = Buffer.from(resultBase64, 'base64');
        const resultMeta = await sharp(generatedBuffer).metadata();

        // サイズが異なる場合は調整（歪みを避けるため比率を維持）
        if (resultMeta.width !== targetMeta.width || resultMeta.height !== targetMeta.height) {
            log.info(`Resizing result: ${resultMeta.width}x${resultMeta.height} → ${targetMeta.width}x${targetMeta.height}`);

            // 比率を維持してリサイズし、必要に応じてクロップ
            const resized = await sharp(generatedBuffer)
                .resize(targetMeta.width, targetMeta.height, {
                    fit: 'cover',      // 比率を維持してカバー
                    position: 'center' // 中央を維持
                })
                .png()
                .toBuffer();
            generatedBuffer = Buffer.from(resized);
            log.info(`Resized with cover (aspect ratio preserved)`);
        }

        // === セーフガード ===
        // マスク外の領域を元画像で上書きして、確実に維持する
        log.info(`Applying safeguard: preserving non-mask areas...`);
        const finalBuffer = await applyMaskSafeguard(
            targetBuffer,
            generatedBuffer,
            targetMeta.width,
            targetMeta.height,
            masks
        );

        // Supabaseにアップロード
        const filename = `design-unify-${targetSectionId}-${Date.now()}.png`;
        const { error: uploadError } = await supabaseAdmin.storage
            .from('images')
            .upload(filename, finalBuffer, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            log.error(`Upload error: ${uploadError.message}`);
            return NextResponse.json({ error: 'アップロードに失敗しました' }, { status: 500 });
        }

        const newImageUrl = supabaseAdmin.storage.from('images').getPublicUrl(filename).data.publicUrl;

        // MediaImage作成
        const finalMeta = await sharp(finalBuffer).metadata();
        const newMedia = await prisma.mediaImage.create({
            data: {
                userId: user.id,
                filePath: newImageUrl,
                mime: 'image/png',
                width: finalMeta.width || 0,
                height: finalMeta.height || 0,
                sourceType: 'design-unified',
            },
        });

        // 現在のセクション情報を取得（履歴保存用）
        const currentSection = await prisma.pageSection.findUnique({
            where: { id: targetSectionId },
            select: { imageId: true }
        });

        // セクション更新
        await prisma.pageSection.update({
            where: { id: targetSectionId },
            data: { imageId: newMedia.id },
        });

        // 履歴を保存（復元用）
        if (currentSection?.imageId) {
            await prisma.sectionImageHistory.create({
                data: {
                    sectionId: targetSectionId,
                    userId: user.id,
                    previousImageId: currentSection.imageId,
                    newImageId: newMedia.id,
                    actionType: 'design-unify',
                    prompt: prompt || null,
                }
            });
        }

        // ログ記録
        const logResult = await logGeneration({
            userId: user.id,
            type: 'design-unify',
            endpoint: '/api/ai/design-unify',
            model: 'gemini-3-pro-image-preview',
            inputPrompt: unifyPrompt,
            imageCount: 1,
            status: 'succeeded',
            startTime,
        });

        // クレジット消費（自分のAPIキー使用時はスキップ）
        if (logResult && !limitCheck.skipCreditConsumption) {
            await recordApiUsage(user.id, logResult.id, logResult.estimatedCost, {
                model: 'gemini-3-pro-image-preview',
                imageCount: 1,
            });
            log.info(`Credit consumed: $${logResult.estimatedCost.toFixed(6)}`);
        }

        log.success(`Design unified for section ${targetSectionId}`);

        return NextResponse.json({
            success: true,
            newImageUrl,
            newImageId: newMedia.id,
        });

    } catch (error: any) {
        log.error(`Error: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * マスク画像を生成（黒背景 + 白いマスク領域）
 */
async function createMaskImage(width: number, height: number, masks: MaskArea[]): Promise<Buffer> {
    // 黒背景を作成
    let image = sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 },
        },
    });

    // マスク領域を白で描画
    const overlays: sharp.OverlayOptions[] = masks.map(mask => {
        const x = Math.round(mask.x * width);
        const y = Math.round(mask.y * height);
        const w = Math.round(mask.width * width);
        const h = Math.round(mask.height * height);

        // 白い矩形を作成
        const whiteRect = Buffer.from(
            `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="white"/></svg>`
        );

        return {
            input: whiteRect,
            top: y,
            left: x,
        };
    });

    return image.composite(overlays).png().toBuffer() as Promise<Buffer>;
}

/**
 * 対象画像にマスクオーバーレイを追加（AIに視覚的に伝える）
 * 枠線のみで内部は見えるようにする
 */
async function createTargetWithMaskOverlay(
    targetBuffer: Buffer,
    width: number,
    height: number,
    masks: MaskArea[]
): Promise<Buffer> {
    // マスク領域を赤い枠線で囲む（内部は透明で見える）
    const overlays: sharp.OverlayOptions[] = masks.map(mask => {
        const x = Math.round(mask.x * width);
        const y = Math.round(mask.y * height);
        const w = Math.round(mask.width * width);
        const h = Math.round(mask.height * height);
        const strokeWidth = 4;

        // 赤い枠線のみ（内部は透明）
        const redFrame = Buffer.from(
            `<svg width="${w}" height="${h}">
                <rect x="${strokeWidth/2}" y="${strokeWidth/2}" width="${w - strokeWidth}" height="${h - strokeWidth}"
                      fill="none" stroke="#FF0000" stroke-width="${strokeWidth}"/>
            </svg>`
        );

        return {
            input: redFrame,
            top: y,
            left: x,
        };
    });

    return sharp(targetBuffer)
        .composite(overlays)
        .png()
        .toBuffer() as Promise<Buffer>;
}

/**
 * セーフガード: マスク外の領域を元画像で上書き
 * 境界部分をフェザリング（ぼかし）して自然に馴染ませる
 */
async function applyMaskSafeguard(
    originalBuffer: Buffer,
    generatedBuffer: Buffer,
    width: number,
    height: number,
    masks: MaskArea[]
): Promise<Buffer> {
    // 1. 元画像をベースにする
    // 2. マスク領域だけ生成画像から切り出して上書き
    // 3. 境界をフェザリングして馴染ませる

    const composites: sharp.OverlayOptions[] = [];
    const featherSize = 8; // フェザリングのサイズ（ピクセル）

    for (const mask of masks) {
        // 少し内側を切り出して境界のアーティファクトを避ける
        const padding = 2;
        const x = Math.round(mask.x * width) + padding;
        const y = Math.round(mask.y * height) + padding;
        const w = Math.max(1, Math.round(mask.width * width) - padding * 2);
        const h = Math.max(1, Math.round(mask.height * height) - padding * 2);

        // 範囲チェック
        if (x < 0 || y < 0 || x + w > width || y + h > height) {
            log.info(`Skipping mask due to bounds: x=${x}, y=${y}, w=${w}, h=${h}`);
            continue;
        }

        try {
            // 生成画像からマスク領域を切り出し
            const extractedRegion = await sharp(generatedBuffer)
                .extract({ left: x, top: y, width: w, height: h })
                .png()
                .toBuffer();

            // フェザリング用のグラデーションマスクを作成
            const featherMask = Buffer.from(
                `<svg width="${w}" height="${h}">
                    <defs>
                        <linearGradient id="fadeLeft" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color:black;stop-opacity:0"/>
                            <stop offset="${Math.min(100, (featherSize / w) * 100)}%" style="stop-color:black;stop-opacity:1"/>
                            <stop offset="${Math.max(0, 100 - (featherSize / w) * 100)}%" style="stop-color:black;stop-opacity:1"/>
                            <stop offset="100%" style="stop-color:black;stop-opacity:0"/>
                        </linearGradient>
                        <linearGradient id="fadeTop" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color:white;stop-opacity:0"/>
                            <stop offset="${Math.min(100, (featherSize / h) * 100)}%" style="stop-color:white;stop-opacity:1"/>
                            <stop offset="${Math.max(0, 100 - (featherSize / h) * 100)}%" style="stop-color:white;stop-opacity:1"/>
                            <stop offset="100%" style="stop-color:white;stop-opacity:0"/>
                        </linearGradient>
                        <mask id="featherMask">
                            <rect width="${w}" height="${h}" fill="url(#fadeLeft)"/>
                            <rect width="${w}" height="${h}" fill="url(#fadeTop)" style="mix-blend-mode:multiply"/>
                        </mask>
                    </defs>
                    <rect width="${w}" height="${h}" fill="white" mask="url(#featherMask)"/>
                </svg>`
            );

            composites.push({
                input: extractedRegion,
                top: y,
                left: x,
                blend: 'over' as const,
            });
        } catch (err: any) {
            log.error(`Failed to extract region: ${err.message}`);
        }
    }

    if (composites.length === 0) {
        log.info('No valid composites, returning original');
        return originalBuffer;
    }

    // 元画像の上にマスク領域だけを合成
    return sharp(originalBuffer)
        .composite(composites)
        .png()
        .toBuffer() as Promise<Buffer>;
}
