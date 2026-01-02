import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import {
    generateDesignTokens,
    tokensToPromptDescription,
} from '@/lib/design-tokens';
import { z } from 'zod';

// カラーログ
const log = {
    info: (msg: string) => console.log(`\x1b[36m[REGENERATE INFO]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[REGENERATE SUCCESS]\x1b[0m ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[REGENERATE ERROR]\x1b[0m ${msg}`),
};

// バリデーションスキーマ
const regenerateSchema = z.object({
    style: z.enum(['sampling', 'professional', 'pops', 'luxury', 'minimal', 'emotional', 'design-definition']).optional(),
    colorScheme: z.enum(['original', 'blue', 'green', 'purple', 'orange', 'monochrome']).optional(),
    customPrompt: z.string().max(500).optional(),
    mode: z.enum(['light', 'heavy']).default('light'),
    // 隣接セクションとの整合性を取るためのコンテキスト
    contextStyle: z.string().optional(),
    // デザイン定義（ページ全体のスタイル定義）- 柔軟なスキーマ
    designDefinition: z.any().optional(),
    // ユーザー指定の参照スタイル画像URL（一括再生成で使用）
    styleReferenceUrl: z.string().url().optional(),
});

// スタイル定義
const STYLE_DESCRIPTIONS: Record<string, string> = {
    sampling: '元デザイン維持：色、フォント、ボタン形状、装飾など元のデザインのスタイルをそのまま維持',
    professional: '企業・信頼感スタイル：ネイビーブルー(#1E3A5F)と白を基調、クリーンなゴシック体',
    pops: 'ポップ・活気スタイル：明るいグラデーション（ピンク→オレンジ）、丸みのある形状、太字フォント',
    luxury: '高級・エレガントスタイル：黒とゴールド(#D4AF37)を基調、明朝体、細くエレガントなライン',
    minimal: 'ミニマル・シンプルスタイル：モノクロ+単一アクセントカラー、最大限の余白',
    emotional: '情熱・エネルギースタイル：暖色系（深紅#C41E3A、オレンジ）、強いコントラスト',
};

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const sectionId = parseInt(id);

    if (isNaN(sectionId)) {
        return Response.json({ error: 'Invalid section ID' }, { status: 400 });
    }

    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = regenerateSchema.safeParse(body);

    if (!validation.success) {
        return Response.json({
            error: 'Validation failed',
            details: validation.error.issues
        }, { status: 400 });
    }

    const { style = 'professional', colorScheme, customPrompt, mode, contextStyle, designDefinition, styleReferenceUrl } = validation.data;

    try {
        log.info(`========== Starting Regenerate for Section ${sectionId} ==========`);
        log.info(`Section ID type: ${typeof sectionId}, value: ${sectionId}`);

        // セクションを取得
        const section = await prisma.pageSection.findUnique({
            where: { id: sectionId },
            include: {
                image: true,
                mobileImage: true,
                page: {
                    include: {
                        sections: {
                            include: { image: true, mobileImage: true },
                            orderBy: { order: 'asc' },
                        },
                    },
                },
            },
        });

        if (!section) {
            // デバッグ: 存在するセクションIDを確認
            const allSections = await prisma.pageSection.findMany({
                select: { id: true, pageId: true },
                take: 20
            });
            log.error(`Section ${sectionId} not found. Existing sections: ${JSON.stringify(allSections)}`);
            return Response.json({ error: 'Section not found' }, { status: 404 });
        }

        if (!section.image?.filePath) {
            return Response.json({ error: 'Section has no image' }, { status: 400 });
        }

        // API キーを取得
        const googleApiKey = await getGoogleApiKeyForUser(user.id);
        if (!googleApiKey) {
            return Response.json({ error: 'Google API key is not configured' }, { status: 400 });
        }

        // セグメント位置を特定
        const allSections = section.page.sections;
        const segmentIndex = allSections.findIndex(s => s.id === sectionId);
        const totalSegments = allSections.length;

        log.info(`Section position: ${segmentIndex + 1}/${totalSegments}`);

        // デザイン定義を使用する場合は専用の説明を生成
        const isUsingDesignDefinition = style === 'design-definition' && designDefinition;

        let styleDesc: string;
        let tokenDescription: string;

        if (isUsingDesignDefinition) {
            log.info('Using design definition for regeneration');

            // デザイン定義からスタイル説明を生成
            const colors = designDefinition.colorPalette || {};
            const colorDesc = [
                colors.primary && `メインカラー: ${colors.primary}`,
                colors.secondary && `サブカラー: ${colors.secondary}`,
                colors.accent && `アクセントカラー: ${colors.accent}`,
                colors.background && `背景色: ${colors.background}`,
            ].filter(Boolean).join('、');

            styleDesc = `ページ全体のデザイン定義に基づくスタイル：
- 雰囲気: ${designDefinition.vibe || '統一感のあるデザイン'}
- 特徴: ${designDefinition.description || ''}
- カラーパレット: ${colorDesc || '既存の色調を維持'}
${designDefinition.typography?.headingStyle ? `- 見出しスタイル: ${designDefinition.typography.headingStyle}` : ''}
${designDefinition.style?.buttonStyle ? `- ボタンスタイル: ${designDefinition.style.buttonStyle}` : ''}
${designDefinition.style?.borderRadius ? `- 角丸: ${designDefinition.style.borderRadius}` : ''}`;

            tokenDescription = `【デザイン定義（厳守）】
このページは統一されたデザインシステムを持っています。以下の定義に完全に従ってください：

${colorDesc ? `【カラー】\n${colorDesc}\n` : ''}
${designDefinition.vibe ? `【雰囲気】\n${designDefinition.vibe}\n` : ''}
${designDefinition.description ? `【デザインの特徴】\n${designDefinition.description}\n` : ''}
${designDefinition.typography?.headingStyle ? `【タイポグラフィ】\n見出し: ${designDefinition.typography.headingStyle}\n` : ''}
${designDefinition.style?.buttonStyle ? `【ボタン】\n${designDefinition.style.buttonStyle}\n` : ''}

この定義に合わせて、セクションのデザインを再生成してください。
他のセクションと完全に統一感のあるデザインにすることが最重要です。`;
        } else {
            // 通常のスタイル処理
            const designTokens = generateDesignTokens(style, colorScheme);
            tokenDescription = tokensToPromptDescription(designTokens);
            styleDesc = STYLE_DESCRIPTIONS[style] || STYLE_DESCRIPTIONS.professional;
        }

        // セグメント情報
        const segmentInfo = segmentIndex === 0
            ? { position: 'ヘッダー・ヒーローセクション', role: 'ナビゲーション、ロゴ、メインビジュアル' }
            : segmentIndex === totalSegments - 1
            ? { position: 'フッターセクション', role: 'CTA、問い合わせ、著作権表示' }
            : { position: `コンテンツセクション（${segmentIndex + 1}/${totalSegments}）`, role: '本文コンテンツ' };

        // ========================================
        // 参照画像方式：ユーザー指定または最初のセクションの画像を参照として使用
        // ========================================
        const isSamplingMode = style === 'sampling';
        const firstSection = allSections[0];

        // ユーザー指定の参照URLがある場合はそれを使用、なければ自動で最初のセクションを使用
        const useUserReference = !!styleReferenceUrl;
        const useAutoReference = !isSamplingMode && !useUserReference && segmentIndex > 0 && firstSection?.image?.filePath;
        const useStyleReference = useUserReference || useAutoReference;

        let styleReferenceBuffer: Buffer | null = null;
        if (useStyleReference) {
            const refUrl = useUserReference ? styleReferenceUrl : firstSection?.image?.filePath;
            if (refUrl) {
                try {
                    log.info(`Fetching style reference image: ${useUserReference ? 'user-specified' : 'first section'}...`);
                    const refResponse = await fetch(refUrl);
                    const refArrayBuffer = await refResponse.arrayBuffer();
                    styleReferenceBuffer = Buffer.from(refArrayBuffer);
                    log.success(`Style reference image loaded (${styleReferenceBuffer.length} bytes)`);
                } catch (error: any) {
                    log.error(`Failed to load style reference: ${error.message}`);
                }
            }
        }

        // 参照画像がある場合は一貫性指示を追加
        const styleReferenceInstruction = styleReferenceBuffer
            ? useUserReference
                ? `【最重要：ユーザー指定の参照スタイルに完全一致させる】
添付した1枚目の「スタイル参照画像」は、ユーザーが明示的に選択した「お手本となるデザイン」です。
このお手本のデザインスタイルを2枚目の処理対象画像に適用してください。

【必ず一致させる要素】
- 背景色・グラデーションの色味と方向
- ボタンの色・形状・角丸・影
- 見出し・本文のフォントスタイル（太さ、色、装飾）
- アイコンや装飾要素のスタイル
- 全体的な配色トーン（暖色系/寒色系/モノトーン等）
- 余白の取り方やレイアウトの雰囲気

【重要】参照画像のスタイルを忠実に再現することが最優先です。

`
                : `【最重要：スタイル統一】
添付した「スタイル参照画像」は、このページの最初のセクションです。
以下を参照画像と完全に統一してください：
- 背景色・グラデーション
- ボタンの色・形状・角丸
- フォントスタイル
- アイコンのスタイル
- シャドウの強さ
- 装飾要素のスタイル

`
            : '';

        // 隣接セクションの情報を取得（一貫性のため）
        const prevSection = segmentIndex > 0 ? allSections[segmentIndex - 1] : null;
        const nextSection = segmentIndex < totalSegments - 1 ? allSections[segmentIndex + 1] : null;

        const contextInfo = [];
        if (prevSection?.image) {
            contextInfo.push('前のセクションとデザインの連続性を保ってください');
        }
        if (nextSection?.image) {
            contextInfo.push('次のセクションとデザインの連続性を保ってください');
        }

        const prompt = mode === 'light'
            ? `あなたはプロのWebデザイナーです。Webページの一部分（セグメント画像）を新しいスタイルに変換してください。

${styleReferenceInstruction}【重要】この画像はページ全体の一部分です。他のセグメントと結合されるため、以下を厳守してください。

【セグメント情報】
- 位置：${segmentInfo.position}（全${totalSegments}セグメント中）
- 役割：${segmentInfo.role}

【絶対厳守ルール】
1. 画像サイズ維持：入力画像と完全に同じ縦横比・解像度で出力する
2. レイアウト固定：要素の位置、サイズ、間隔は1ピクセルも変えない
3. 上下の端：他セグメントと繋がるため、背景色やパターンが途切れないようにする
${contextInfo.length > 0 ? `4. 連続性：${contextInfo.join('。')}` : ''}

【スタイル変更ルール】
- 適用スタイル：${styleDesc}
- テキスト書き換え：意味を保ち言い回しを変える

${tokenDescription}

${customPrompt ? `【ユーザー指示】${customPrompt}` : ''}
${contextStyle ? `【コンテキストスタイル】${contextStyle}` : ''}

【出力】入力と同じサイズの高品質なWebデザイン画像を出力。`
            : `あなたはクリエイティブなWebデザイナーです。Webページの一部分（セグメント画像）を参考に新しいデザインを作成してください。

${styleReferenceInstruction}【セグメント情報】
- 位置：${segmentInfo.position}（全${totalSegments}セグメント中）
- 役割：${segmentInfo.role}

【絶対厳守ルール】
1. 画像サイズ維持：入力画像と完全に同じ縦横比・解像度で出力する
2. 上下の端：他セグメントと繋がるため、背景色が途切れないようにする
${contextInfo.length > 0 ? `3. 連続性：${contextInfo.join('。')}` : ''}

【デザイン変更ルール】
- 新スタイル：${styleDesc}
- レイアウト再構成：要素の配置は自由に変更してよいが、セクションの役割は維持

${tokenDescription}

${customPrompt ? `【ユーザー指示】${customPrompt}` : ''}
${contextStyle ? `【コンテキストスタイル】${contextStyle}` : ''}

【出力】入力と同じサイズの高品質なWebデザイン画像を出力。`;

        log.info(`Processing with ${mode} mode, style: ${style}${styleReferenceBuffer ? (useUserReference ? ' (with USER-SPECIFIED style reference)' : ' (with auto style reference)') : ''}`);

        // 画像をダウンロード
        const imageResponse = await fetch(section.image.filePath);
        const imageArrayBuffer = await imageResponse.arrayBuffer();
        const imageBuffer = Buffer.from(imageArrayBuffer);

        const startTime = createTimer();
        const base64Data = imageBuffer.toString('base64');

        // API リクエストのパーツを構築
        const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

        // 参照画像がある場合、最初に追加（スタイル参照として）
        if (styleReferenceBuffer) {
            const refBase64 = styleReferenceBuffer.toString('base64');
            parts.push({ inlineData: { mimeType: 'image/png', data: refBase64 } });
            parts.push({ text: useUserReference
                ? '↑【お手本】ユーザーが選択した参照セクション。このデザインスタイル（色、フォント、装飾、雰囲気）を下の画像に適用してください。'
                : '↑ スタイル参照画像（このスタイルに合わせてください）'
            });
        }

        // 処理対象の画像を追加
        parts.push({ inlineData: { mimeType: 'image/png', data: base64Data } });
        parts.push({ text: styleReferenceBuffer ? `↑ 処理対象画像\n\n${prompt}` : prompt });

        // Gemini API呼び出し
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${googleApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts
                    }],
                    generationConfig: {
                        responseModalities: ["IMAGE", "TEXT"],
                        // 温度設定の最適化（一貫性重視）
                        // light: 0.15（レイアウト固定、スタイルのみ変更）
                        // heavy: 0.35（デザイン変更しつつ一貫性維持）
                        // 参照画像がある場合はさらに低めに設定して一貫性を高める
                        temperature: styleReferenceBuffer ? 0.1 : (mode === 'heavy' ? 0.35 : 0.15),
                    },
                    toolConfig: { functionCallingConfig: { mode: "NONE" } }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            log.error(`Gemini API error: ${errorText}`);
            return Response.json({ error: 'AI processing failed' }, { status: 500 });
        }

        const data = await response.json();
        const responseParts = data.candidates?.[0]?.content?.parts || [];

        let aiBuffer: Buffer | null = null;
        for (const part of responseParts) {
            if (part.inlineData?.data) {
                aiBuffer = Buffer.from(part.inlineData.data, 'base64');
                break;
            }
        }

        if (!aiBuffer) {
            log.error('No image data in response');
            return Response.json({ error: 'AI did not generate an image' }, { status: 500 });
        }

        await logGeneration({
            userId: user.id,
            type: 'import-arrange',
            endpoint: '/api/sections/[id]/regenerate',
            model: 'gemini-3-pro-image-preview',
            inputPrompt: prompt,
            imageCount: 1,
            status: 'succeeded',
            startTime
        });

        // 新しい画像をアップロード
        const filename = `regenerate-${Date.now()}-sec-${sectionId}.png`;

        const { error: uploadError } = await supabase
            .storage
            .from('images')
            .upload(filename, aiBuffer, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            log.error(`Upload error: ${uploadError.message}`);
            return Response.json({ error: 'Failed to upload image' }, { status: 500 });
        }

        const { data: { publicUrl } } = supabase
            .storage
            .from('images')
            .getPublicUrl(filename);

        const processedMeta = await sharp(aiBuffer).metadata();

        // 新しいMediaImageを作成
        const newMedia = await prisma.mediaImage.create({
            data: {
                filePath: publicUrl,
                mime: 'image/png',
                width: processedMeta.width || section.image.width || 0,
                height: processedMeta.height || section.image.height || 0,
                sourceUrl: section.image.filePath,
                sourceType: `regenerate-${mode}`,
            },
        });

        // 履歴を保存（復元機能用）
        if (section.imageId) {
            await prisma.sectionImageHistory.create({
                data: {
                    sectionId: sectionId,
                    userId: user.id,
                    previousImageId: section.imageId,
                    newImageId: newMedia.id,
                    actionType: `regenerate-${mode}`,
                    prompt: customPrompt || null,
                },
            });
            log.info(`History saved: ${section.imageId} -> ${newMedia.id}`);
        }

        // セクションを更新
        await prisma.pageSection.update({
            where: { id: sectionId },
            data: { imageId: newMedia.id },
        });

        log.success(`Section ${sectionId} regenerated: ${section.imageId} -> ${newMedia.id}`);

        return Response.json({
            success: true,
            sectionId,
            oldImageId: section.imageId,
            newImageId: newMedia.id,
            newImageUrl: publicUrl,
            media: newMedia,
        });

    } catch (error: any) {
        log.error(`Error: ${error.message}`);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
