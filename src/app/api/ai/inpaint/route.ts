import { NextRequest, NextResponse } from 'next/server';
import { supabase as supabaseStorage } from '@/lib/supabase';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { estimateImageCost } from '@/lib/ai-costs';
import { fetchWithRetry } from '@/lib/gemini-retry';
import { checkImageGenerationLimit, incrementFreeBannerEditCount } from '@/lib/usage';
import { deductCreditAtomic, refundCredit } from '@/lib/credits';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

interface MaskArea {
    x: number;      // 選択範囲の左上X（0-1の比率）
    y: number;      // 選択範囲の左上Y（0-1の比率）
    width: number;  // 選択範囲の幅（0-1の比率）
    height: number; // 選択範囲の高さ（0-1の比率）
}

// デザイン定義（参考画像から解析されたスタイル）
interface DesignDefinition {
    colorPalette: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
    };
    typography: {
        style: string;
        mood: string;
    };
    layout: {
        density: string;
        style: string;
    };
    vibe: string;
    description: string;
}

// 出力画像サイズの型定義（Gemini APIがサポートする値のみ）
// 参考: https://ai.google.dev/gemini-api/docs/image-generation
// - 1K: 最大 1024×1024px（デフォルト）
// - 2K: 最大 2048×2048px
// - 4K: 最大 4096×4096px
const VALID_IMAGE_SIZES = ['1K', '2K', '4K'] as const;
type GeminiImageSize = typeof VALID_IMAGE_SIZES[number];

// フロントエンドから受け取る可能性のある値（originalは4Kにフォールバック）
type OutputImageSize = GeminiImageSize | 'original';

// 安全なサイズ変換関数: 無効な値が来ても必ず有効な値を返す
function toValidImageSize(size: string | undefined | null): GeminiImageSize {
    if (!size) return '4K'; // デフォルトは4K（高画質）

    const upperSize = size.toUpperCase();

    // 完全一致チェック
    if (VALID_IMAGE_SIZES.includes(upperSize as GeminiImageSize)) {
        return upperSize as GeminiImageSize;
    }

    // 'original'は4Kにフォールバック（元サイズ維持はAPIでサポートされていない）
    if (upperSize === 'ORIGINAL') {
        return '4K';
    }

    // その他の不正な値は4Kにフォールバック
    console.warn(`[INPAINT] Invalid outputSize "${size}", falling back to 4K`);
    return '4K';
}

// Gemini APIの入力画像サイズ制限（ピクセル）
// 大きすぎる画像は400エラーになるため、適切なサイズにリサイズする
const MAX_INPUT_DIMENSION = 1024; // 最大辺のサイズ（400エラー対策で小さく）

// 画像をリサイズする関数（必要な場合のみ）
async function resizeImageIfNeeded(
    base64Data: string,
    mimeType: string
): Promise<{ base64Data: string; mimeType: string; resized: boolean; originalSize?: { width: number; height: number }; newSize?: { width: number; height: number } }> {
    try {
        const buffer = Buffer.from(base64Data, 'base64');
        const metadata = await sharp(buffer).metadata();

        const width = metadata.width || 0;
        const height = metadata.height || 0;

        // 最大サイズ以下なら何もしない
        if (width <= MAX_INPUT_DIMENSION && height <= MAX_INPUT_DIMENSION) {
            return { base64Data, mimeType, resized: false };
        }

        // アスペクト比を維持してリサイズ
        const scale = Math.min(MAX_INPUT_DIMENSION / width, MAX_INPUT_DIMENSION / height);
        const newWidth = Math.round(width * scale);
        const newHeight = Math.round(height * scale);

        console.log(`[INPAINT] Resizing input image: ${width}x${height} → ${newWidth}x${newHeight}`);

        const resizedBuffer = await sharp(buffer)
            .resize(newWidth, newHeight, {
                fit: 'inside',
                withoutEnlargement: true,
                kernel: sharp.kernel.lanczos3
            })
            .png({ quality: 95 })
            .toBuffer();

        return {
            base64Data: resizedBuffer.toString('base64'),
            mimeType: 'image/png', // リサイズ後はPNGに統一
            resized: true,
            originalSize: { width, height },
            newSize: { width: newWidth, height: newHeight }
        };
    } catch (error) {
        console.error('[INPAINT] Failed to resize image:', error);
        // リサイズに失敗した場合は元の画像をそのまま返す
        return { base64Data, mimeType, resized: false };
    }
}

interface InpaintRequest {
    imageUrl?: string;
    imageBase64?: string;
    mask?: MaskArea;        // 単一選択（後方互換性）
    masks?: MaskArea[];     // 複数選択
    prompt: string;         // 修正指示
    referenceDesign?: DesignDefinition; // 参考デザイン定義（オプション）
    referenceImageBase64?: string; // 参考デザイン画像（Base64、オプション）
    outputSize?: OutputImageSize; // 出力画像サイズ（デフォルト: 4K）
    originalWidth?: number;  // 元画像の幅（アスペクト比維持用）
    originalHeight?: number; // 元画像の高さ（アスペクト比維持用）
    sectionId?: number;      // セクションID（履歴保存用）
    previousImageId?: number; // 変更前の画像ID（履歴保存用）
}

interface InpaintHistoryData {
    originalImage: string;
    masks: MaskArea[];
    prompt: string;
}

export async function POST(request: NextRequest) {
    const startTime = createTimer();
    let inpaintPrompt = '';
    const requestId = uuidv4(); // 重複防止用のリクエストID
    let creditDeducted = false;
    let skipCreditConsumption = false;

    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // バナー操作かどうかをヘッダーで判定
    const isBannerEdit = request.headers.get('x-source') === 'banner';

    // クレジット残高チェック（先にチェックのみ）
    const limitCheck = await checkImageGenerationLimit(user.id, 'gemini-3-pro-image-preview', 1, { isBannerEdit });
    if (!limitCheck.allowed) {
        if (limitCheck.needApiKey) {
            return NextResponse.json({
                error: 'API_KEY_REQUIRED',
                message: limitCheck.reason,
            }, { status: 402 });
        }
        if (limitCheck.needSubscription) {
            return NextResponse.json({
                error: 'SUBSCRIPTION_REQUIRED',
                message: limitCheck.reason,
            }, { status: 402 });
        }
        return NextResponse.json({
            error: 'INSUFFICIENT_CREDIT',
            message: limitCheck.reason,
            credits: {
                currentBalance: limitCheck.currentBalanceUsd,
                estimatedCost: limitCheck.estimatedCostUsd,
            },
            needPurchase: true,
        }, { status: 402 });
    }

    skipCreditConsumption = limitCheck.skipCreditConsumption || false;
    const estimatedCost = estimateImageCost('gemini-3-pro-image-preview', 1);

    // ★ 先払い方式: API呼び出し前にクレジットを原子的に減算
    if (!skipCreditConsumption) {
        const deductResult = await deductCreditAtomic(
            user.id,
            estimatedCost,
            requestId,
            'API使用: gemini-3-pro-image-preview (inpaint)'
        );

        if (!deductResult.success) {
            return NextResponse.json({
                error: 'INSUFFICIENT_CREDIT',
                message: deductResult.error || 'クレジット残高が不足しています',
                credits: {
                    currentBalance: deductResult.balanceAfter,
                    estimatedCost: estimatedCost,
                },
                needPurchase: true,
            }, { status: 402 });
        }

        // 重複リクエストの場合は既存結果を返す（冪等性）
        if (deductResult.alreadyProcessed) {
            console.log(`[INPAINT] Duplicate request detected: ${requestId}`);
            return NextResponse.json({
                error: 'DUPLICATE_REQUEST',
                message: 'このリクエストは既に処理されています',
                requestId,
            }, { status: 409 });
        }

        creditDeducted = true;
        console.log(`[INPAINT] Credit deducted: $${estimatedCost}, requestId: ${requestId}`);
    }

    try {
        const { imageUrl, imageBase64, mask, masks, prompt, referenceDesign, referenceImageBase64, outputSize, originalWidth, originalHeight, sectionId, previousImageId }: InpaintRequest = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: '修正指示(prompt)を入力してください' }, { status: 400 });
        }

        // 出力サイズを安全に変換（無効な値は4Kにフォールバック）
        const validImageSize = toValidImageSize(outputSize);
        console.log(`[INPAINT] Output size: requested="${outputSize}", using="${validImageSize}"`);

        // 元画像のサイズ情報をログ出力
        if (originalWidth && originalHeight) {
            const aspectRatio = originalWidth / originalHeight;
            const orientation = aspectRatio > 1 ? '横長' : aspectRatio < 1 ? '縦長' : '正方形';
            console.log(`[INPAINT] Original image: ${originalWidth}x${originalHeight} (${orientation}, aspect ratio: ${aspectRatio.toFixed(2)})`);
        }

        // 複数選択か単一選択か判定
        const allMasks: MaskArea[] = masks && masks.length > 0 ? masks : (mask ? [mask] : []);

        const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user.id, { useSystemKey: !!limitCheck.isFreeBannerEdit });
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({
                error: 'Google API key is not configured. 設定画面でAPIキーを設定してください。'
            }, { status: 500 });
        }

        // 画像データ取得
        let base64Data: string;
        let mimeType = 'image/png';

        if (imageBase64) {
            // Data URLからmimeTypeを抽出
            const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
            if (mimeMatch) {
                mimeType = mimeMatch[1];
            }
            base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        } else if (imageUrl) {
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error('画像の取得に失敗しました');
            }
            const arrayBuffer = await imageResponse.arrayBuffer();
            base64Data = Buffer.from(arrayBuffer).toString('base64');
            mimeType = imageResponse.headers.get('content-type') || 'image/png';
        } else {
            return NextResponse.json({ error: '画像を指定してください' }, { status: 400 });
        }

        // ★ 重要: Base64データの先頭からmimeTypeを正確に検出（Content-Typeヘッダーが間違っている場合の対策）
        if (base64Data.startsWith('/9j/')) {
            mimeType = 'image/jpeg';
        } else if (base64Data.startsWith('iVBORw0KGgo')) {
            mimeType = 'image/png';
        } else if (base64Data.startsWith('R0lGOD')) {
            mimeType = 'image/gif';
        } else if (base64Data.startsWith('UklGR')) {
            mimeType = 'image/webp';
        }
        console.log(`[INPAINT] Final mimeType: ${mimeType} (base64 preview: ${base64Data.substring(0, 20)}...)`)

        // 入力画像が大きすぎる場合はリサイズ（Gemini API制限対策）
        const resizeResult = await resizeImageIfNeeded(base64Data, mimeType);
        base64Data = resizeResult.base64Data;
        mimeType = resizeResult.mimeType;
        if (resizeResult.resized) {
            console.log(`[INPAINT] Input image resized: ${resizeResult.originalSize?.width}x${resizeResult.originalSize?.height} → ${resizeResult.newSize?.width}x${resizeResult.newSize?.height}`);
        } else {
            console.log(`[INPAINT] Image size OK, no resize needed`);
        }

        // 複数の選択範囲を説明に変換
        const getPositionDesc = (m: MaskArea) => {
            const xPercent = Math.round(m.x * 100);
            const yPercent = Math.round(m.y * 100);
            let pos = '';
            if (yPercent < 33) pos = '上部';
            else if (yPercent < 66) pos = '中央';
            else pos = '下部';
            if (xPercent < 33) pos += '左側';
            else if (xPercent < 66) pos += '中央';
            else pos += '右側';
            return pos;
        };

        const areasDescription = allMasks.map((m, i) => {
            const xPercent = Math.round(m.x * 100);
            const yPercent = Math.round(m.y * 100);
            const widthPercent = Math.round(m.width * 100);
            const heightPercent = Math.round(m.height * 100);
            return `領域${i + 1}: ${getPositionDesc(m)}（左から${xPercent}%、上から${yPercent}%、幅${widthPercent}%、高さ${heightPercent}%）`;
        }).join('\n');

        // 参考デザインスタイルの説明を生成
        let designStyleSection = '';
        if (referenceDesign || referenceImageBase64) {
            if (referenceImageBase64) {
                // 参考画像が添付されている場合
                designStyleSection = `
【参考デザイン画像について】
2枚目の画像は「参考デザイン」です。この画像のデザインスタイル（色使い、雰囲気、トーン、質感）を参考にして、1枚目の画像を編集してください。
`;
            }
            if (referenceDesign) {
                const { colorPalette, typography, layout, vibe, description } = referenceDesign;
                designStyleSection += `
【参考デザインスタイル解析結果】
- カラーパレット:
  - プライマリ: ${colorPalette.primary}
  - セカンダリ: ${colorPalette.secondary}
  - アクセント: ${colorPalette.accent}
  - 背景: ${colorPalette.background}
- タイポグラフィ: ${typography.style}（${typography.mood}）
- レイアウト: ${layout.style}（密度: ${layout.density}）
- 雰囲気: ${vibe}
- スタイル説明: ${description}

編集後の画像は上記のデザインスタイル（色味、雰囲気、トーン）に合わせてください。
`;
            }
        }

        // テキスト追加系の指示かどうかを判定
        const isTextAddition = /(?:入れ|追加|書い|変更|テキスト|文字|タイトル|見出し)/i.test(prompt);

        // 元画像のサイズ・アスペクト比情報を生成
        let imageSizeSection = '';
        if (originalWidth && originalHeight) {
            const aspectRatio = originalWidth / originalHeight;
            const orientation = aspectRatio > 1 ? '横長（landscape）' : aspectRatio < 1 ? '縦長（portrait）' : '正方形（square）';
            imageSizeSection = `
【🚨 最重要: 画像サイズ・アスペクト比の厳守 - CRITICAL SIZE REQUIREMENT】
元画像のサイズ: ${originalWidth}px × ${originalHeight}px
アスペクト比: ${aspectRatio.toFixed(3)} (${orientation})

⚠️ 絶対厳守事項:
- 出力画像は必ず元画像と同じアスペクト比（${aspectRatio.toFixed(3)}）を維持すること
- ${aspectRatio < 1 ? '縦長の画像を横長に変換することは絶対禁止' : aspectRatio > 1 ? '横長の画像を縦長に変換することは絶対禁止' : '正方形のアスペクト比を変更することは禁止'}
- 画像の向き（${orientation}）を変更しないこと
- 元画像の縦横比を崩さないこと
`;
        }

        // インペインティング用プロンプト - シンプル版（400エラーデバッグ用）
        // 長いプロンプトが問題の可能性があるため、まずシンプルにテスト
        // 元画像のアスペクト比を計算
        const aspectRatio = originalWidth && originalHeight ? (originalWidth / originalHeight) : 1;
        const isPortrait = aspectRatio < 1;
        const orientationText = isPortrait ? 'PORTRAIT (vertical/tall)' : (aspectRatio > 1 ? 'LANDSCAPE (horizontal/wide)' : 'SQUARE');

        // マスク画像を生成（選択範囲がある場合）
        let maskBase64: string | null = null;
        if (allMasks.length > 0 && originalWidth && originalHeight) {
            try {
                // sharpで黒背景にマスク領域を白く塗ったPNG画像を生成
                const imgWidth = resizeResult.newSize?.width || originalWidth;
                const imgHeight = resizeResult.newSize?.height || originalHeight;

                // SVGでマスクを描画
                const rects = allMasks.map(m => {
                    const x = Math.round(m.x * imgWidth);
                    const y = Math.round(m.y * imgHeight);
                    const w = Math.round(m.width * imgWidth);
                    const h = Math.round(m.height * imgHeight);
                    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white"/>`;
                }).join('');

                const svgMask = `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100%" height="100%" fill="black"/>
                    ${rects}
                </svg>`;

                const maskBuffer = await sharp(Buffer.from(svgMask))
                    .png()
                    .toBuffer();

                maskBase64 = maskBuffer.toString('base64');
                console.log(`[INPAINT] Mask image generated: ${imgWidth}x${imgHeight}, ${allMasks.length} region(s)`);
            } catch (maskError) {
                console.error('[INPAINT] Failed to generate mask image:', maskError);
                // マスク生成に失敗してもテキスト指示で続行
            }
        }

        // プロンプト構築
        const hasMask = maskBase64 !== null;
        const hasReference = !!referenceImageBase64;

        if (hasReference && hasMask) {
            inpaintPrompt = `I'm providing 3 images:
1. The original image to edit
2. A black-and-white mask image - white areas indicate where to make changes, black areas MUST remain completely unchanged
3. A reference photo of a person/object

CRITICAL RULES:
- ONLY modify the white areas of the mask. The black areas must be pixel-perfect identical to the original.
- Replace the person/object in the white masked area with the person/object from the reference photo.
- Preserve all text, graphics, layout, and design elements in the black areas exactly as they are.
- Match the lighting, style, and perspective of the original image.

User instruction: ${prompt}`;
        } else if (hasMask) {
            inpaintPrompt = `I'm providing 2 images:
1. The original image to edit
2. A black-and-white mask image - white areas indicate where to make changes, black areas MUST remain completely unchanged

CRITICAL RULES:
- ONLY modify the white areas of the mask. The black areas must be pixel-perfect identical to the original.
- Preserve all text, graphics, layout, and design elements in the black areas exactly as they are.
- Do NOT change anything outside the white masked region.

User instruction: ${prompt}`;
        } else if (hasReference) {
            inpaintPrompt = `I'm providing 2 images:
1. The original image to edit
2. A reference photo of a person/object

Replace the person/object in the first image with the person/object shown in the reference photo. Keep the same pose, position, and composition. Preserve all text, graphics, and layout elements.

User instruction: ${prompt}`;
        } else {
            inpaintPrompt = `Edit this image: ${prompt}`;
        }

        const MODEL_ID = 'gemini-3-pro-image-preview';

        // リクエストのpartsを構築
        const requestParts: any[] = [];

        // 1. 編集対象画像
        requestParts.push({
            inlineData: { mimeType: 'image/png', data: base64Data }
        });

        // 2. マスク画像（選択範囲がある場合）
        if (maskBase64) {
            requestParts.push({
                inlineData: { mimeType: 'image/png', data: maskBase64 }
            });
            console.log(`[INPAINT] Mask image added to request`);
        }

        // 3. 参照画像がある場合は追加（人物/オブジェクト差し替え用）
        if (referenceImageBase64) {
            const refBase64 = referenceImageBase64.replace(/^data:image\/\w+;base64,/, '');
            let refMimeType = 'image/png';
            if (refBase64.startsWith('/9j/')) {
                refMimeType = 'image/jpeg';
            } else if (refBase64.startsWith('iVBORw0KGgo')) {
                refMimeType = 'image/png';
            } else if (refBase64.startsWith('UklGR')) {
                refMimeType = 'image/webp';
            }

            // 参照画像を元画像と同じサイズにリサイズ（サイズ不一致によるGeminiの混乱を防止）
            const refBuffer = Buffer.from(refBase64, 'base64');
            const refMeta = await sharp(refBuffer).metadata();
            const targetWidth = resizeResult.newSize?.width || (originalWidth || refMeta.width || 512);
            const targetHeight = resizeResult.newSize?.height || (originalHeight || refMeta.height || 512);

            let refFinalBase64 = refBase64;
            let refFinalMimeType = refMimeType;

            if (refMeta.width && refMeta.height && (refMeta.width !== targetWidth || refMeta.height !== targetHeight)) {
                const resizedRefBuffer = await sharp(refBuffer)
                    .resize(targetWidth, targetHeight, {
                        fit: 'contain',
                        background: { r: 255, g: 255, b: 255, alpha: 1 },
                        kernel: sharp.kernel.lanczos3
                    })
                    .png()
                    .toBuffer();
                refFinalBase64 = resizedRefBuffer.toString('base64');
                refFinalMimeType = 'image/png';
                console.log(`[INPAINT] Reference image resized: ${refMeta.width}x${refMeta.height} → ${targetWidth}x${targetHeight}`);
            }

            requestParts.push({
                inlineData: { mimeType: refFinalMimeType, data: refFinalBase64 }
            });
            console.log(`[INPAINT] Reference image added: ${refFinalMimeType}, length: ${refFinalBase64.length}`);
        }

        // 4. プロンプト
        requestParts.push({ text: inpaintPrompt });

        console.log(`[INPAINT] Using model: ${MODEL_ID}`);
        console.log(`[INPAINT] Parts count: ${requestParts.length} (${referenceImageBase64 ? 'with reference' : 'no reference'})`);
        console.log(`[INPAINT] Prompt: ${inpaintPrompt.substring(0, 200)}...`);

        let response: Response;
        try {
            response = await fetchWithRetry(
                `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GOOGLE_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: requestParts
                        }],
                        generationConfig: {
                            responseModalities: ["IMAGE", "TEXT"],
                            temperature: 0.4
                        }
                    })
                }
            );
        } catch (fetchError: any) {
            console.error('[INPAINT] API call failed:', fetchError.message);
            throw fetchError;
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[INPAINT] API error response:', errorText);
            throw new Error(`インペインティングに失敗しました: ${response.status}`);
        }

        const data = await response.json();
        const modelUsed = 'gemini-3-pro-image-preview';
        const durationMs = Date.now() - startTime;

        // 履歴用データを準備
        const historyData: InpaintHistoryData = {
            originalImage: imageUrl || `data:${mimeType};base64,${base64Data.substring(0, 50)}...`, // URLがない場合は識別子
            masks: allMasks,
            prompt: prompt,
        };

        const result = await processInpaintResponse(
            data,
            user.id,
            { model: modelUsed, estimatedCost, durationMs },
            historyData
        );

        // ログ記録（成功）- generationConfigにimageSize未設定のためデフォルト1K
        await logGeneration({
            userId: user.id,
            type: 'inpaint',
            endpoint: '/api/ai/inpaint',
            model: modelUsed,
            inputPrompt: inpaintPrompt,
            imageCount: 1,
            status: 'succeeded',
            startTime,
            resolution: '1K',
        });

        // クレジットは先払い済みなので、成功時は何もしない
        console.log(`[INPAINT] Success, requestId: ${requestId}`);

        // Freeプラン無料バナー編集カウンターをインクリメント
        if (limitCheck.isFreeBannerEdit) {
            await incrementFreeBannerEditCount(user.id);
        }

        // セクション画像変更履歴を保存（sectionIdとpreviousImageIdが渡された場合）
        if (sectionId && previousImageId) {
            try {
                // resultからmedia.idを取得
                const resultBody = await result.clone().json();
                if (resultBody.media?.id) {
                    await prisma.sectionImageHistory.create({
                        data: {
                            sectionId,
                            userId: user.id,
                            previousImageId,
                            newImageId: resultBody.media.id,
                            actionType: 'inpaint',
                            prompt: prompt || null,
                        },
                    });
                    console.log(`[INPAINT] Section image history saved: section=${sectionId}, prev=${previousImageId}, new=${resultBody.media.id}`);
                }
            } catch (e) {
                console.error('[INPAINT] Failed to save section image history:', e);
            }
        }

        return result;

    } catch (error: any) {
        console.error('Inpaint Error:', error);

        // ★ API失敗時はクレジットを返金
        if (creditDeducted && !skipCreditConsumption) {
            await refundCredit(
                user.id,
                estimatedCost,
                requestId,
                `API失敗: ${error.message}`
            );
            console.log(`[INPAINT] Credit refunded due to error, requestId: ${requestId}`);
        }

        // ログ記録（エラー）
        await logGeneration({
            userId: user.id,
            type: 'inpaint',
            endpoint: '/api/ai/inpaint',
            model: 'gemini-3-pro-image-preview',
            inputPrompt: inpaintPrompt || 'Error before prompt',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

interface CostInfo {
    model: string;
    estimatedCost: number;
    durationMs: number;
}

async function processInpaintResponse(
    data: any,
    userId: string | null,
    costInfo?: CostInfo,
    historyData?: InpaintHistoryData
) {
    console.log('Gemini Response:', JSON.stringify(data, null, 2));

    const parts = data.candidates?.[0]?.content?.parts || [];
    let editedImageBase64: string | null = null;
    let textResponse: string | null = null;

    for (const part of parts) {
        console.log('Part keys:', Object.keys(part));
        if (part.inlineData?.data) {
            editedImageBase64 = part.inlineData.data;
            console.log('Found image data, length:', editedImageBase64?.length);
        }
        if (part.text) {
            textResponse = part.text;
            console.log('Text response:', textResponse);
        }
    }

    if (!editedImageBase64) {
        console.log('No image data found in response');
        return NextResponse.json({
            success: false,
            message: '画像の編集に失敗しました。選択範囲やプロンプトを変更してお試しください。',
            textResponse
        });
    }

    // Supabaseにアップロード
    const buffer = Buffer.from(editedImageBase64, 'base64');
    const filename = `inpaint-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;

    const { error: uploadError } = await supabaseStorage
        .storage
        .from('images')
        .upload(filename, buffer, {
            contentType: 'image/png',
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        throw new Error('画像のアップロードに失敗しました');
    }

    // 公開URL取得
    const { data: { publicUrl } } = supabaseStorage
        .storage
        .from('images')
        .getPublicUrl(filename);

    // DB保存
    const media = await prisma.mediaImage.create({
        data: {
            userId,
            filePath: publicUrl,
            mime: 'image/png',
            width: 0,  // 元画像サイズを維持
            height: 0,
        },
    });

    // インペイント履歴を保存
    let history = null;
    if (historyData) {
        history = await prisma.inpaintHistory.create({
            data: {
                userId,
                originalImage: historyData.originalImage,
                resultImage: publicUrl,
                prompt: historyData.prompt,
                masks: JSON.stringify(historyData.masks),
                model: costInfo?.model || 'unknown',
                estimatedCost: costInfo?.estimatedCost || null,
                durationMs: costInfo?.durationMs || null,
            },
        });
    }

    return NextResponse.json({
        success: true,
        media,
        textResponse,
        history,
        costInfo: costInfo ? {
            model: costInfo.model,
            estimatedCost: costInfo.estimatedCost,
            durationMs: costInfo.durationMs
        } : null
    });
}
