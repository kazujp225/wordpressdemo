import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
// design-tokens.ts のインポートは不要になりました（editOptions方式に移行）
import { z } from 'zod';

// カラーログ
const log = {
    info: (msg: string) => console.log(`\x1b[36m[RESTYLE INFO]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[RESTYLE SUCCESS]\x1b[0m ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[RESTYLE ERROR]\x1b[0m ${msg}`),
};

// デザイン定義スキーマ
const designDefinitionSchema = z.object({
    colorPalette: z.object({
        primary: z.string().optional(),
        secondary: z.string().optional(),
        accent: z.string().optional(),
        background: z.string().optional(),
    }).optional(),
    typography: z.object({
        style: z.string().optional(),
        mood: z.string().optional(),
    }).optional(),
    layout: z.object({
        density: z.string().optional(),
        style: z.string().optional(),
    }).optional(),
    vibe: z.string().optional(),
    description: z.string().optional(),
}).optional();

// 編集オプションスキーマ
const editOptionsSchema = z.object({
    people: z.object({
        enabled: z.boolean(),
        mode: z.enum(['similar', 'different']),
    }),
    text: z.object({
        enabled: z.boolean(),
        mode: z.enum(['nuance', 'copywriting', 'rewrite']),
    }),
    pattern: z.object({
        enabled: z.boolean(),
    }),
    objects: z.object({
        enabled: z.boolean(),
    }),
    color: z.object({
        enabled: z.boolean(),
        scheme: z.string(),
    }),
    layout: z.object({
        enabled: z.boolean(),
    }),
});

// バリデーションスキーマ
const restyleSchema = z.object({
    editOptions: editOptionsSchema,
    designDefinition: designDefinitionSchema,
});

// カラースキーム定義
const COLOR_SCHEMES: Record<string, { primary: string; secondary: string; accent: string; background: string }> = {
    blue: { primary: '#3B82F6', secondary: '#1E40AF', accent: '#60A5FA', background: '#F0F9FF' },
    green: { primary: '#22C55E', secondary: '#15803D', accent: '#86EFAC', background: '#F0FDF4' },
    purple: { primary: '#A855F7', secondary: '#7C3AED', accent: '#C4B5FD', background: '#FAF5FF' },
    orange: { primary: '#F97316', secondary: '#EA580C', accent: '#FDBA74', background: '#FFF7ED' },
    monochrome: { primary: '#000000', secondary: '#374151', accent: '#6B7280', background: '#FFFFFF' },
};

// editOptionsからプロンプトを生成
function generateEditPrompt(options: z.infer<typeof editOptionsSchema>): string {
    const instructions: string[] = [];

    if (options.people.enabled) {
        if (options.people.mode === 'similar') {
            instructions.push(`【人物・写真の変更】
人物が写っている場合、同じ雰囲気・同じシチュエーションの別の人物に置き換えてください。
- 年齢層、性別、服装の雰囲気は維持
- 表情やポーズは自然に変更
- 背景との調和を保つ`);
        } else {
            instructions.push(`【人物・写真の変更】
人物が写っている場合、完全に異なるイメージの人物に置き換えてください。
- 新しい人物で新鮮な印象を与える
- サービスや商品に合った人物を選択
- 背景との調和を保つ`);
        }
    }

    if (options.text.enabled) {
        if (options.text.mode === 'nuance') {
            instructions.push(`【テキストの変更】
テキストのニュアンスを少し変更してください。
- 意味は同じまま、言い回しを少し変える
- 読みやすさを維持
- フォントスタイルは変更しない`);
        } else if (options.text.mode === 'copywriting') {
            instructions.push(`【テキストの変更 - コピーライティング改善】
テキストをより魅力的なコピーライティングに改善してください。
- ユーザーの心に響く言葉選び
- 行動を促すCTA文言
- 読みやすく印象的なフレーズ
- フォントスタイルは維持`);
        } else {
            instructions.push(`【テキストの変更 - 完全書き換え】
テキストを完全に新しい内容に書き換えてください。
- 同じ目的・役割は維持
- 全く新しい表現で新鮮さを出す
- フォントスタイルは維持`);
        }
    }

    if (options.pattern.enabled) {
        instructions.push(`【模様・パターン・背景の変更】
背景の模様やパターンを変更してください。
- グラデーション、テクスチャ、パターンを新しいものに
- 全体の雰囲気に合った背景に変更
- 読みやすさを損なわないよう注意`);
    }

    if (options.objects.enabled) {
        instructions.push(`【オブジェクト・アイコンの変更】
アイコンや装飾オブジェクトを変更してください。
- アイコンを別のスタイルのものに置き換え
- 装飾要素を新しいデザインに
- 全体の統一感を保つ`);
    }

    if (options.color.enabled) {
        const scheme = COLOR_SCHEMES[options.color.scheme];
        if (scheme) {
            instructions.push(`【カラー・配色の変更】
以下の新しいカラーパレットに完全に置き換えてください：
- メインカラー: ${scheme.primary}
- サブカラー: ${scheme.secondary}
- アクセントカラー: ${scheme.accent}
- 背景色: ${scheme.background}
全ての色要素（ボタン、背景、アイコン、装飾）を新しい配色に統一してください。`);
        }
    }

    if (options.layout.enabled) {
        instructions.push(`【レイアウト・構成の変更】
レイアウトを再構成してください。
- 要素の配置を変更
- 余白のバランスを調整
- より効果的なレイアウトに改善
- セクションの役割は維持`);
    }

    return instructions.join('\n\n');
}

// デザイン定義をプロンプト用テキストに変換
function designDefinitionToPrompt(def: z.infer<typeof designDefinitionSchema>): string {
    if (!def) return '';

    const parts: string[] = [];

    if (def.vibe) {
        parts.push(`【雰囲気】${def.vibe}`);
    }
    if (def.description) {
        parts.push(`【デザインの特徴】${def.description}`);
    }
    if (def.colorPalette) {
        const colors = [];
        if (def.colorPalette.primary) colors.push(`メイン: ${def.colorPalette.primary}`);
        if (def.colorPalette.secondary) colors.push(`サブ: ${def.colorPalette.secondary}`);
        if (def.colorPalette.accent) colors.push(`アクセント: ${def.colorPalette.accent}`);
        if (def.colorPalette.background) colors.push(`背景: ${def.colorPalette.background}`);
        if (colors.length > 0) {
            parts.push(`【カラーパレット】${colors.join(', ')}`);
        }
    }
    if (def.typography) {
        const typo = [];
        if (def.typography.style) typo.push(`スタイル: ${def.typography.style}`);
        if (def.typography.mood) typo.push(`ムード: ${def.typography.mood}`);
        if (typo.length > 0) {
            parts.push(`【タイポグラフィ】${typo.join(', ')}`);
        }
    }
    if (def.layout) {
        const layout = [];
        if (def.layout.density) layout.push(`密度: ${def.layout.density}`);
        if (def.layout.style) layout.push(`スタイル: ${def.layout.style}`);
        if (layout.length > 0) {
            parts.push(`【レイアウト】${layout.join(', ')}`);
        }
    }

    return parts.length > 0 ? parts.join('\n') : '';
}

// AI画像変換処理（editOptions対応）
async function processImageWithAI(
    imageBuffer: Buffer,
    editOptions: z.infer<typeof editOptionsSchema>,
    segmentIndex: number,
    totalSegments: number,
    apiKey: string,
    userId: string | null,
    styleReferenceImage?: Buffer,  // 最初のセグメントの結果を参照として渡す
    originalDesignDefinition?: z.infer<typeof designDefinitionSchema>  // 元のデザイン解析結果
): Promise<Buffer | null> {
    const startTime = createTimer();
    const editPrompt = generateEditPrompt(editOptions);
    const originalDesignPrompt = designDefinitionToPrompt(originalDesignDefinition);

    // 何も選択されていない場合はスキップ
    const hasAnyEdit = editOptions.people.enabled ||
        editOptions.text.enabled ||
        editOptions.pattern.enabled ||
        editOptions.objects.enabled ||
        editOptions.color.enabled ||
        editOptions.layout.enabled;

    if (!hasAnyEdit) {
        log.info(`[AI] Segment ${segmentIndex + 1}: No edits selected, skipping`);
        return null;
    }

    const segmentInfo = segmentIndex === 0
        ? { position: 'ヘッダー・ヒーローセクション', role: 'ナビゲーション、ロゴ、メインビジュアル' }
        : segmentIndex === totalSegments - 1
        ? { position: 'フッターセクション', role: 'CTA、問い合わせ、著作権表示' }
        : { position: `コンテンツセクション（${segmentIndex + 1}/${totalSegments}）`, role: '本文コンテンツ' };

    // 参照画像がある場合（2番目以降のセグメント）は一貫性指示を追加
    const hasStyleReference = styleReferenceImage && segmentIndex > 0;
    const styleReferenceInstruction = hasStyleReference
        ? `【最重要：スタイル統一】
添付した「スタイル参照画像」は、このページの最初のセグメントです。
以下を参照画像と完全に統一してください：
- 背景色・グラデーション
- ボタンの色・形状・角丸
- フォントスタイル
- アイコンのスタイル
- シャドウの強さ
- 装飾要素のスタイル

`
        : '';

    const prompt = `あなたはプロのWebデザイナーです。Webページの一部分（セグメント画像）を編集してください。

${styleReferenceInstruction}【重要】この画像はページ全体の一部分です。他のセグメントと結合されるため、以下を厳守してください。

【セグメント情報】
- 位置：${segmentInfo.position}（全${totalSegments}セグメント中）
- 役割：${segmentInfo.role}

【絶対厳守ルール】
1. 画像サイズ維持：入力画像と完全に同じ縦横比・解像度で出力する
2. 上下の端：他セグメントと繋がるため、背景色やパターンが途切れないようにする
3. 指定された要素のみ変更：下記の【編集指示】で指定されていない要素はそのまま維持

${originalDesignPrompt ? `【維持すべき元のデザイン特性】
${originalDesignPrompt}
上記を参考に全体の雰囲気を維持してください。

` : ''}【編集指示】
${editPrompt}

【出力】入力と同じサイズの高品質なWebデザイン画像を出力。`;

    log.info(`[AI] Processing segment ${segmentIndex + 1}${hasStyleReference ? ' (with style reference)' : ''}`);
    log.info(`[AI] Edit options: people=${editOptions.people.enabled}, text=${editOptions.text.enabled}, pattern=${editOptions.pattern.enabled}, objects=${editOptions.objects.enabled}, color=${editOptions.color.enabled}, layout=${editOptions.layout.enabled}`);

    try {
        const base64Data = imageBuffer.toString('base64');

        // API リクエストのパーツを構築
        const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

        // 参照画像がある場合、最初に追加（スタイル参照として）
        if (hasStyleReference && styleReferenceImage) {
            const refBase64 = styleReferenceImage.toString('base64');
            parts.push({ inlineData: { mimeType: 'image/png', data: refBase64 } });
            parts.push({ text: '↑ スタイル参照画像（このスタイルに合わせてください）' });
        }

        // 処理対象の画像を追加
        parts.push({ inlineData: { mimeType: 'image/png', data: base64Data } });
        parts.push({ text: hasStyleReference ? `↑ 処理対象画像\n\n${prompt}` : prompt });

        // レイアウト変更がある場合は高めの温度、それ以外は低温度
        const temperature = editOptions.layout.enabled ? 0.35 : 0.15;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts
                    }],
                    generationConfig: {
                        responseModalities: ["IMAGE", "TEXT"],
                        temperature: hasStyleReference ? 0.1 : temperature,
                    },
                    toolConfig: { functionCallingConfig: { mode: "NONE" } }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            log.error(`[AI] Gemini API error: ${errorText}`);
            return null;
        }

        const data = await response.json();
        const responseParts = data.candidates?.[0]?.content?.parts || [];

        for (const part of responseParts) {
            if (part.inlineData?.data) {
                log.success(`[AI] Segment ${segmentIndex + 1} processed successfully`);

                await logGeneration({
                    userId,
                    type: 'import-arrange',
                    endpoint: '/api/pages/[id]/restyle',
                    model: 'gemini-3-pro-image-preview',
                    inputPrompt: prompt,
                    imageCount: 1,
                    status: 'succeeded',
                    startTime
                });

                return Buffer.from(part.inlineData.data, 'base64');
            }
        }

        log.error(`[AI] No image data in response for segment ${segmentIndex + 1}`);
        return null;

    } catch (error: any) {
        log.error(`[AI] Error processing segment ${segmentIndex + 1}: ${error.message}`);
        return null;
    }
}

// ストリーミングレスポンス用のエンコーダー
function createStreamResponse(processFunction: (send: (data: any) => void) => Promise<void>) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                await processFunction(send);
            } catch (error: any) {
                send({ type: 'error', error: error.message });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        }
    });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const pageId = parseInt(id);

    if (isNaN(pageId)) {
        return Response.json({ error: 'Invalid page ID' }, { status: 400 });
    }

    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = restyleSchema.safeParse(body);

    if (!validation.success) {
        return Response.json({
            error: 'Validation failed',
            details: validation.error.issues
        }, { status: 400 });
    }

    const { editOptions, designDefinition } = validation.data;

    return createStreamResponse(async (send) => {
        log.info(`========== Starting Restyle for Page ${pageId} ==========`);
        log.info(`EditOptions: people=${editOptions.people.enabled}, text=${editOptions.text.enabled}, pattern=${editOptions.pattern.enabled}, objects=${editOptions.objects.enabled}, color=${editOptions.color.enabled}(${editOptions.color.scheme}), layout=${editOptions.layout.enabled}`);
        log.info(`HasDesignDef: ${!!designDefinition}`);

        // 選択された編集オプションを確認
        const enabledOptions: string[] = [];
        if (editOptions.people.enabled) enabledOptions.push('人物');
        if (editOptions.text.enabled) enabledOptions.push('テキスト');
        if (editOptions.pattern.enabled) enabledOptions.push('模様');
        if (editOptions.objects.enabled) enabledOptions.push('オブジェクト');
        if (editOptions.color.enabled) enabledOptions.push('カラー');
        if (editOptions.layout.enabled) enabledOptions.push('レイアウト');

        if (enabledOptions.length === 0) {
            throw new Error('編集オプションが選択されていません');
        }

        send({ type: 'progress', step: 'init', message: `${enabledOptions.join('・')}の編集を開始しています...` });

        // ページとセクションを取得
        const page = await prisma.page.findUnique({
            where: { id: pageId },
            include: {
                sections: {
                    include: { image: true, mobileImage: true },
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!page) {
            throw new Error('Page not found');
        }

        const sections = page.sections.filter(s => s.image?.filePath);
        const totalSegments = sections.length;

        if (totalSegments === 0) {
            throw new Error('No sections with images found');
        }

        log.info(`Found ${totalSegments} sections with images`);

        // API キーを取得
        const googleApiKey = await getGoogleApiKeyForUser(user.id);
        if (!googleApiKey) {
            throw new Error('Google API key is not configured');
        }

        send({ type: 'progress', step: 'tokens', message: '編集プロンプトを生成中...' });
        const editPrompt = generateEditPrompt(editOptions);
        log.success(`Edit prompt generated`);

        const updatedSections: any[] = [];

        // ========================================
        // 参照画像方式：最初のセグメントの結果を保存
        // 後続セグメントに渡してスタイル一貫性を確保
        // ========================================
        let firstSegmentResult: Buffer | null = null;

        // 各セクションを処理
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];

            send({
                type: 'progress',
                step: 'processing',
                message: `セクション ${i + 1}/${totalSegments} を処理中...${i > 0 && firstSegmentResult ? '（参照画像あり）' : ''}`,
                total: totalSegments,
                current: i + 1
            });

            log.info(`Processing section ${i + 1}: ${section.id}`);

            try {
                // 画像をダウンロード
                const imageResponse = await fetch(section.image!.filePath);
                const imageArrayBuffer = await imageResponse.arrayBuffer();
                let imageBuffer = Buffer.from(imageArrayBuffer);

                // 2番目以降のセグメントには最初のセグメントの結果を参照として渡す
                const styleReference = (i > 0 && firstSegmentResult) ? firstSegmentResult : undefined;

                // AI処理（新しいeditOptions方式）
                const aiBuffer = await processImageWithAI(
                    imageBuffer,
                    editOptions,
                    i,
                    totalSegments,
                    googleApiKey,
                    user.id,
                    styleReference,
                    designDefinition
                );

                if (aiBuffer) {
                    // 最初のセグメントの結果を保存（後続セグメントの参照用）
                    if (i === 0) {
                        firstSegmentResult = aiBuffer;
                        log.success(`Section 1: Saved as style reference for subsequent sections`);
                    }
                    // 新しい画像をアップロード
                    const filename = `restyle-${Date.now()}-seg-${i}.png`;

                    const { error: uploadError } = await supabase
                        .storage
                        .from('images')
                        .upload(filename, aiBuffer, {
                            contentType: 'image/png',
                            cacheControl: '3600',
                            upsert: false
                        });

                    if (uploadError) {
                        log.error(`Upload error for section ${i}: ${uploadError.message}`);
                        throw uploadError;
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
                            width: processedMeta.width || section.image!.width || 0,
                            height: processedMeta.height || section.image!.height || 0,
                            sourceUrl: section.image!.filePath,
                            sourceType: 'restyle-edit',
                        },
                    });

                    // セクションを更新
                    await prisma.pageSection.update({
                        where: { id: section.id },
                        data: { imageId: newMedia.id },
                    });

                    updatedSections.push({
                        sectionId: section.id,
                        oldImageId: section.imageId,
                        newImageId: newMedia.id,
                        newImageUrl: publicUrl,
                    });

                    log.success(`Section ${i + 1} updated: ${section.id} -> ${newMedia.id}`);
                } else {
                    log.error(`Section ${i + 1} AI processing failed, keeping original`);
                }
            } catch (error: any) {
                log.error(`Error processing section ${i + 1}: ${error.message}`);
            }
        }

        log.info(`========== Restyle Complete ==========`);
        log.success(`Updated ${updatedSections.length} sections`);

        send({
            type: 'complete',
            success: true,
            updatedCount: updatedSections.length,
            totalCount: totalSegments,
            sections: updatedSections,
        });
    });
}
