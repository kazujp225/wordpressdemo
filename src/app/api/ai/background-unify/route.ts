import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import sharp from 'sharp';

const log = {
    info: (msg: string) => console.log(`\x1b[36m[BG-UNIFY]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[BG-UNIFY]\x1b[0m ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[BG-UNIFY]\x1b[0m ${msg}`),
};

interface MaskArea {
    x: number;      // 0-1の比率
    y: number;      // 0-1の比率
    width: number;  // 0-1の比率
    height: number; // 0-1の比率
}

interface BackgroundUnifyRequest {
    targetImageUrl: string;         // 修正対象画像
    targetSectionId: number;        // 修正対象セクションID
    masks: MaskArea[];              // マスク領域（背景部分）
    targetColor: string;            // 目標の背景色（#RRGGBB形式）
    resolution: '1K' | '2K' | '4K'; // 出力解像度
    targetType?: 'desktop' | 'mobile'; // 対象画像タイプ（デフォルト: desktop）
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
        const body: BackgroundUnifyRequest = await request.json();
        const { targetImageUrl, targetSectionId, masks, targetColor, resolution, targetType = 'desktop' } = body;
        const isMobile = targetType === 'mobile';

        if (!targetSectionId) {
            return NextResponse.json({ error: 'セクションIDが必要です' }, { status: 400 });
        }

        if (!targetImageUrl || typeof targetImageUrl !== 'string' || !targetImageUrl.startsWith('http')) {
            return NextResponse.json({ error: '有効な画像URLが必要です' }, { status: 400 });
        }

        if (!masks || masks.length === 0) {
            return NextResponse.json({ error: '背景領域を選択してください' }, { status: 400 });
        }

        if (!targetColor || !/^#[0-9A-Fa-f]{6}$/.test(targetColor)) {
            return NextResponse.json({ error: '有効な色コードを指定してください（例: #FFFFFF）' }, { status: 400 });
        }

        if (!resolution || !['1K', '2K', '4K'].includes(resolution)) {
            return NextResponse.json({ error: '解像度は1K, 2K, 4Kのいずれかを指定してください' }, { status: 400 });
        }

        const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user.id);
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({
                error: 'Google API key is not configured'
            }, { status: 500 });
        }

        log.info(`Background unify: section ${targetSectionId} (${targetType}), color ${targetColor}, resolution ${resolution}, ${masks.length} mask(s)`);

        // 画像を取得
        const targetResponse = await fetch(targetImageUrl);
        if (!targetResponse.ok) {
            return NextResponse.json({ error: '画像の取得に失敗しました' }, { status: 500 });
        }

        const targetBuffer = Buffer.from(await targetResponse.arrayBuffer());
        const targetMeta = await sharp(targetBuffer).metadata();

        if (!targetMeta.width || !targetMeta.height) {
            return NextResponse.json({ error: '画像メタデータの取得に失敗しました' }, { status: 500 });
        }

        // 全画像モード判定（マスクオーバーレイ不要判定用）
        // 浮動小数点の誤差を考慮して判定
        const isFullImageMaskForOverlay = masks.length === 1 &&
            masks[0].x <= 0.01 && masks[0].y <= 0.01 &&
            masks[0].width >= 0.99 && masks[0].height >= 0.99;

        log.info(`Full image mode check: ${isFullImageMaskForOverlay} (mask: x=${masks[0].x}, y=${masks[0].y}, w=${masks[0].width}, h=${masks[0].height})`);

        // マスク付き対象画像を作成（全画像モードではオーバーレイ不要）
        let targetImageBase64: string;
        if (isFullImageMaskForOverlay) {
            // 全画像モード：元画像をそのまま使用（赤枠なし）
            log.info('Using original image without red frame overlay');
            targetImageBase64 = targetBuffer.toString('base64');
        } else {
            // 部分マスクモード：赤枠オーバーレイを追加
            log.info('Adding red frame overlay for partial mask mode');
            const targetWithMaskBuffer = await createTargetWithMaskOverlay(targetBuffer, targetMeta.width, targetMeta.height, masks);
            targetImageBase64 = targetWithMaskBuffer.toString('base64');
        }

        // 色名を取得（より自然なプロンプトのため）
        const colorName = getColorName(targetColor);

        // 全画像モード判定（プロンプト分岐用）- 同じ判定ロジックを使用
        const isFullImageMask = isFullImageMaskForOverlay;

        // プロンプト構築 - 背景色統一用
        const unifyPrompt = isFullImageMask
            ? `【画像の背景色変更】

この画像の背景色を「${targetColor}」(${colorName})に変更してください。

【絶対に守ること】
- テキスト、文字、ロゴ、アイコン、ボタン、写真などの「コンテンツ要素」は完全に保持
- 要素の位置、サイズ、色、フォントは一切変更しない
- 背景部分のみを新しい色に置き換える
- レイアウトや構図は維持する

【背景の判定基準】
- テキストや画像の「後ろ」にある色の領域が背景
- ヘッダー、フッター、セクションの塗りつぶし領域
- 余白部分

【禁止事項】
- テキストの内容や色を変更すること
- 要素を追加・削除すること
- 画像を歪ませること
- ボタンや装飾の色を変えること

背景色だけを「${targetColor}」に変更した完全な画像を出力してください。`
            : `【背景色変更タスク】

この画像の赤枠で囲まれた領域の背景色を変更してください。

【目標の色】
- カラーコード: ${targetColor}
- 色の説明: ${colorName}

【重要な指示】
1. 赤枠内の背景色のみを「${targetColor}」に変更する
2. テキスト、アイコン、ボタン、画像などの要素は一切変更しない
3. 要素の位置やサイズは維持する
4. 背景色は均一に塗りつぶす（グラデーションにしない）
5. 赤枠外の領域は絶対に変更しない

【やってはいけないこと】
- テキストの色や内容を変える
- 要素を追加・削除する
- レイアウトを変える
- 画像を歪ませる
- 赤枠外を編集する

背景色だけを正確に変更した画像を出力してください。`;

        // Gemini API呼び出し
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: 'image/png', data: targetImageBase64 } },
                            { text: unifyPrompt },
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ["IMAGE", "TEXT"],
                        temperature: 0.1,  // より安定した出力のため低めに
                        imageConfig: {
                            image_size: resolution  // "1K", "2K", "4K"
                        }
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

        // サイズが異なる場合は調整
        if (resultMeta.width !== targetMeta.width || resultMeta.height !== targetMeta.height) {
            log.info(`Resizing result: ${resultMeta.width}x${resultMeta.height} → ${targetMeta.width}x${targetMeta.height}`);

            // fillを使用して正確なサイズに合わせる（多少の歪みは許容）
            // 背景色変更なので、厳密な比率維持より正確なサイズを優先
            const resized = await sharp(generatedBuffer)
                .resize(targetMeta.width, targetMeta.height, {
                    fit: 'fill'  // 正確なサイズに合わせる
                })
                .png()
                .toBuffer();
            generatedBuffer = Buffer.from(resized);
            log.info(`Resized to exact dimensions`);
        }

        // 全画像モード（マスクが1つで全体をカバー）の場合はセーフガードをスキップ
        // AIの出力をそのまま使用（AIがテキストや要素を保持することを信頼）
        let finalBuffer: Buffer;
        if (isFullImageMaskForOverlay) {
            log.info(`Full image mode: using AI output directly (trusting AI to preserve elements)`);
            finalBuffer = generatedBuffer;
        } else {
            // 部分マスクモード: マスク外の領域を元画像で保持
            log.info(`Partial mask mode: applying safeguard to preserve non-mask areas...`);
            finalBuffer = await applyMaskSafeguard(
                targetBuffer,
                generatedBuffer,
                targetMeta.width,
                targetMeta.height,
                masks
            );
        }

        // Supabaseにアップロード
        const filename = `bg-unify-${targetSectionId}-${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
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

        const newImageUrl = supabase.storage.from('images').getPublicUrl(filename).data.publicUrl;

        // MediaImage作成
        const finalMeta = await sharp(finalBuffer).metadata();
        const newMedia = await prisma.mediaImage.create({
            data: {
                userId: user.id,
                filePath: newImageUrl,
                mime: 'image/png',
                width: finalMeta.width || 0,
                height: finalMeta.height || 0,
                sourceType: 'background-unified',
            },
        });

        // 現在のセクション情報を取得（履歴保存用）
        const currentSection = await prisma.pageSection.findUnique({
            where: { id: targetSectionId },
            select: { imageId: true, mobileImageId: true }
        });

        // セクション更新（モバイルかデスクトップかで分岐）
        if (isMobile) {
            await prisma.pageSection.update({
                where: { id: targetSectionId },
                data: { mobileImageId: newMedia.id },
            });

            // モバイル用履歴を保存
            if (currentSection?.mobileImageId) {
                await prisma.sectionImageHistory.create({
                    data: {
                        sectionId: targetSectionId,
                        userId: user.id,
                        previousImageId: currentSection.mobileImageId,
                        newImageId: newMedia.id,
                        actionType: 'background-unify-mobile',
                        prompt: `モバイル背景色を${targetColor}に変更（${resolution}）`,
                    }
                });
            }
        } else {
            await prisma.pageSection.update({
                where: { id: targetSectionId },
                data: { imageId: newMedia.id },
            });

            // デスクトップ用履歴を保存
            if (currentSection?.imageId) {
                await prisma.sectionImageHistory.create({
                    data: {
                        sectionId: targetSectionId,
                        userId: user.id,
                        previousImageId: currentSection.imageId,
                        newImageId: newMedia.id,
                        actionType: 'background-unify',
                        prompt: `背景色を${targetColor}に変更（${resolution}）`,
                    }
                });
            }
        }

        // ログ記録
        await logGeneration({
            userId: user.id,
            type: 'background-unify',
            endpoint: '/api/ai/background-unify',
            model: 'gemini-3-pro-image-preview',
            inputPrompt: unifyPrompt,
            imageCount: 1,
            status: 'succeeded',
            startTime,
        });

        log.success(`Background unified for section ${targetSectionId} (${targetType}): ${targetColor} at ${resolution}`);

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
 * 対象画像にマスクオーバーレイを追加（AIに視覚的に伝える）
 */
async function createTargetWithMaskOverlay(
    targetBuffer: Buffer,
    width: number,
    height: number,
    masks: MaskArea[]
): Promise<Buffer> {
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
 */
async function applyMaskSafeguard(
    originalBuffer: Buffer,
    generatedBuffer: Buffer,
    width: number,
    height: number,
    masks: MaskArea[]
): Promise<Buffer> {
    const composites: sharp.OverlayOptions[] = [];

    for (const mask of masks) {
        const padding = 2;
        const x = Math.round(mask.x * width) + padding;
        const y = Math.round(mask.y * height) + padding;
        const w = Math.max(1, Math.round(mask.width * width) - padding * 2);
        const h = Math.max(1, Math.round(mask.height * height) - padding * 2);

        if (x < 0 || y < 0 || x + w > width || y + h > height) {
            log.info(`Skipping mask due to bounds: x=${x}, y=${y}, w=${w}, h=${h}`);
            continue;
        }

        try {
            const extractedRegion = await sharp(generatedBuffer)
                .extract({ left: x, top: y, width: w, height: h })
                .png()
                .toBuffer();

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

    return sharp(originalBuffer)
        .composite(composites)
        .png()
        .toBuffer() as Promise<Buffer>;
}

/**
 * 色コードから色名を取得（プロンプト用）
 */
function getColorName(hex: string): string {
    const colorNames: Record<string, string> = {
        '#FFFFFF': '白 (white)',
        '#000000': '黒 (black)',
        '#FF0000': '赤 (red)',
        '#00FF00': '緑 (green)',
        '#0000FF': '青 (blue)',
        '#FFFF00': '黄 (yellow)',
        '#FF00FF': 'マゼンタ (magenta)',
        '#00FFFF': 'シアン (cyan)',
        '#808080': 'グレー (gray)',
        '#F5F5F5': 'ホワイトスモーク (whitesmoke)',
        '#F0F0F0': 'ライトグレー (light gray)',
        '#E0E0E0': 'シルバー (silver)',
    };

    const upperHex = hex.toUpperCase();
    if (colorNames[upperHex]) {
        return colorNames[upperHex];
    }

    // RGB値から大まかな色を推定
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const brightness = (r + g + b) / 3;
    if (brightness > 200) return '明るい色 (light color)';
    if (brightness < 50) return '暗い色 (dark color)';

    if (r > g && r > b) return '赤系の色 (reddish color)';
    if (g > r && g > b) return '緑系の色 (greenish color)';
    if (b > r && b > g) return '青系の色 (bluish color)';

    return `RGB(${r}, ${g}, ${b})`;
}
