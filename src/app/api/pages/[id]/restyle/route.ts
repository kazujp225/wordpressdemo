import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkGenerationLimit, checkFeatureAccess } from '@/lib/usage';
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

// セクション境界オフセットスキーマ
const sectionBoundarySchema = z.object({
    id: z.string(),
    boundaryOffsetTop: z.number().default(0),
    boundaryOffsetBottom: z.number().default(0),
});

// バリデーションスキーマ
const restyleSchema = z.object({
    editOptions: editOptionsSchema,
    designDefinition: designDefinitionSchema,
    includeMobile: z.boolean().default(false),  // モバイル画像も同時に処理するか
    sectionBoundaries: z.array(sectionBoundarySchema).optional(), // 各セクションの境界オフセット
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

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 機能アクセスチェック（リスタイルは有料プラン専用）
    const featureCheck = await checkFeatureAccess(user.id, 'restyle');
    if (!featureCheck.allowed) {
        return Response.json({
            error: 'Feature not available',
            message: featureCheck.reason,
        }, { status: 403 });
    }

    // 使用量制限チェック
    const limitCheck = await checkGenerationLimit(user.id);
    if (!limitCheck.allowed) {
        // FreeプランでAPIキー未設定の場合
        if (limitCheck.needApiKey) {
            return Response.json({
                error: 'API_KEY_REQUIRED',
                message: limitCheck.reason,
            }, { status: 402 });
        }
        return Response.json({
            error: 'Usage limit exceeded',
            message: limitCheck.reason,
        }, { status: 429 });
    }

    const body = await request.json();
    const validation = restyleSchema.safeParse(body);

    if (!validation.success) {
        return Response.json({
            error: 'Validation failed',
            details: validation.error.issues
        }, { status: 400 });
    }

    const { editOptions, designDefinition, includeMobile, sectionBoundaries } = validation.data;

    // 境界オフセット情報をIDでマップ化
    const boundaryMap = new Map<string, { boundaryOffsetTop: number; boundaryOffsetBottom: number }>();
    if (sectionBoundaries) {
        for (const b of sectionBoundaries) {
            boundaryMap.set(b.id, { boundaryOffsetTop: b.boundaryOffsetTop, boundaryOffsetBottom: b.boundaryOffsetBottom });
        }
    }

    return createStreamResponse(async (send) => {
        log.info(`========== Starting Restyle for Page ${pageId} ==========`);
        log.info(`EditOptions: people=${editOptions.people.enabled}, text=${editOptions.text.enabled}, pattern=${editOptions.pattern.enabled}, objects=${editOptions.objects.enabled}, color=${editOptions.color.enabled}(${editOptions.color.scheme}), layout=${editOptions.layout.enabled}`);
        log.info(`HasDesignDef: ${!!designDefinition}, IncludeMobile: ${includeMobile}`);
        log.info(`SectionBoundaries: ${boundaryMap.size} sections with boundary info`);

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

        // 所有者確認
        if (page.userId !== user.id) {
            throw new Error('Forbidden');
        }

        const sections = page.sections.filter(s => s.image?.filePath);
        const desktopCount = sections.length;
        // モバイル画像を持つセクション数
        const sectionsWithMobile = includeMobile ? sections.filter(s => s.mobileImage?.filePath) : [];
        const mobileCount = sectionsWithMobile.length;
        const totalSegments = desktopCount + mobileCount;

        if (desktopCount === 0) {
            throw new Error('No sections with images found');
        }

        log.info(`Found ${desktopCount} desktop sections${includeMobile ? ` + ${mobileCount} mobile sections` : ''}`);

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

        let processedCount = 0;

        // ========================================
        // デスクトップ画像を処理
        // ========================================
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            processedCount++;

            send({
                type: 'progress',
                step: 'processing',
                message: `デスクトップ ${i + 1}/${desktopCount} を処理中...${i > 0 && firstSegmentResult ? '（参照画像あり）' : ''}`,
                total: totalSegments,
                current: processedCount
            });

            // フロントエンドから渡されたIDを使用（DBのセクションID）
            const sectionIdStr = String(section.id);
            const boundary = boundaryMap.get(sectionIdStr);
            const boundaryOffsetTop = boundary?.boundaryOffsetTop || 0;
            const boundaryOffsetBottom = boundary?.boundaryOffsetBottom || 0;

            log.info(`Processing desktop section ${i + 1}: ${section.id} (boundary: top=${boundaryOffsetTop}, bottom=${boundaryOffsetBottom})`);

            try {
                // 画像をダウンロード
                const imageResponse = await fetch(section.image!.filePath);
                const imageArrayBuffer = await imageResponse.arrayBuffer();
                let imageBuffer = Buffer.from(imageArrayBuffer);
                const originalMeta = await sharp(imageBuffer).metadata();
                const originalWidth = originalMeta.width || 0;
                const originalHeight = originalMeta.height || 0;

                // 境界オフセットによる拡張画像の作成
                // boundaryOffsetTop > 0: 上のセクションの下部を取り込む（上に拡張）
                // boundaryOffsetTop < 0: このセクションの上部を削る（上から縮小）
                // boundaryOffsetBottom > 0: 下のセクションの上部を取り込む（下に拡張）
                // boundaryOffsetBottom < 0: このセクションの下部を削る（下から縮小）
                let expandedImageInfo: { originalHeight: number; expandedTop: number; expandedBottom: number; cropTop: number; cropBottom: number } | null = null;

                const hasTopExtension = boundaryOffsetTop > 0 && i > 0;
                const hasBottomExtension = boundaryOffsetBottom > 0 && i < sections.length - 1;
                const hasTopCrop = boundaryOffsetTop < 0;
                const hasBottomCrop = boundaryOffsetBottom < 0;

                if (hasTopExtension || hasBottomExtension || hasTopCrop || hasBottomCrop) {
                    log.info(`Creating adjusted image with boundary offsets (top: ${boundaryOffsetTop}, bottom: ${boundaryOffsetBottom})...`);

                    let topExtensionBuffer: Buffer | null = null;
                    let topExtensionHeight = 0;
                    let cropTopAmount = 0;
                    let cropBottomAmount = 0;

                    // 上方向に拡張（前のセクションの下部を取り込む）
                    if (hasTopExtension) {
                        const prevSection = sections[i - 1];
                        if (prevSection?.image?.filePath) {
                            try {
                                const prevResponse = await fetch(prevSection.image.filePath);
                                const prevArrayBuffer = await prevResponse.arrayBuffer();
                                const prevBuffer = Buffer.from(prevArrayBuffer);
                                const prevMeta = await sharp(prevBuffer).metadata();

                                const extractHeight = Math.min(boundaryOffsetTop, prevMeta.height || 0);
                                const extractTop = Math.max(0, (prevMeta.height || 0) - extractHeight);

                                topExtensionBuffer = await sharp(prevBuffer)
                                    .extract({ left: 0, top: extractTop, width: prevMeta.width || 0, height: extractHeight })
                                    .resize(originalWidth, extractHeight)
                                    .toBuffer();
                                topExtensionHeight = extractHeight;
                                log.info(`Added top extension: ${extractHeight}px from previous section`);
                            } catch (e) {
                                log.error(`Failed to get previous section image: ${e}`);
                            }
                        }
                    }

                    // 上から縮小（このセクションの上部を削る）
                    if (hasTopCrop) {
                        cropTopAmount = Math.min(Math.abs(boundaryOffsetTop), originalHeight - 100); // 最低100px残す
                        log.info(`Will crop top: ${cropTopAmount}px`);
                    }

                    let bottomExtensionBuffer: Buffer | null = null;
                    let bottomExtensionHeight = 0;

                    // 下方向に拡張（次のセクションの上部を取り込む）
                    if (hasBottomExtension) {
                        const nextSection = sections[i + 1];
                        if (nextSection?.image?.filePath) {
                            try {
                                const nextResponse = await fetch(nextSection.image.filePath);
                                const nextArrayBuffer = await nextResponse.arrayBuffer();
                                const nextBuffer = Buffer.from(nextArrayBuffer);
                                const nextMeta = await sharp(nextBuffer).metadata();

                                const extractHeight = Math.min(boundaryOffsetBottom, nextMeta.height || 0);

                                bottomExtensionBuffer = await sharp(nextBuffer)
                                    .extract({ left: 0, top: 0, width: nextMeta.width || 0, height: extractHeight })
                                    .resize(originalWidth, extractHeight)
                                    .toBuffer();
                                bottomExtensionHeight = extractHeight;
                                log.info(`Added bottom extension: ${extractHeight}px from next section`);
                            } catch (e) {
                                log.error(`Failed to get next section image: ${e}`);
                            }
                        }
                    }

                    // 下から縮小（このセクションの下部を削る）
                    if (hasBottomCrop) {
                        cropBottomAmount = Math.min(Math.abs(boundaryOffsetBottom), originalHeight - cropTopAmount - 100); // 最低100px残す
                        log.info(`Will crop bottom: ${cropBottomAmount}px`);
                    }

                    // まず現在の画像をクロップ（必要な場合）
                    let croppedBuffer = imageBuffer;
                    let croppedHeight = originalHeight;
                    if (cropTopAmount > 0 || cropBottomAmount > 0) {
                        const newHeight = originalHeight - cropTopAmount - cropBottomAmount;
                        croppedBuffer = Buffer.from(await sharp(imageBuffer)
                            .extract({ left: 0, top: cropTopAmount, width: originalWidth, height: newHeight })
                            .toBuffer());
                        croppedHeight = newHeight;
                        log.info(`Cropped image: ${originalHeight}px -> ${croppedHeight}px (removed top: ${cropTopAmount}, bottom: ${cropBottomAmount})`);
                    }

                    // 拡張画像を合成（拡張がある場合）
                    if (topExtensionBuffer || bottomExtensionBuffer) {
                        const totalHeight = topExtensionHeight + croppedHeight + bottomExtensionHeight;

                        const compositeBase = sharp({
                            create: {
                                width: originalWidth,
                                height: totalHeight,
                                channels: 4,
                                background: { r: 255, g: 255, b: 255, alpha: 1 }
                            }
                        });

                        const compositeImages: Array<{ input: Buffer; top: number; left: number }> = [];
                        let yOffset = 0;

                        if (topExtensionBuffer) {
                            compositeImages.push({ input: topExtensionBuffer, top: yOffset, left: 0 });
                            yOffset += topExtensionHeight;
                        }

                        compositeImages.push({ input: croppedBuffer, top: yOffset, left: 0 });
                        yOffset += croppedHeight;

                        if (bottomExtensionBuffer) {
                            compositeImages.push({ input: bottomExtensionBuffer, top: yOffset, left: 0 });
                        }

                        imageBuffer = Buffer.from(await compositeBase.composite(compositeImages).png().toBuffer());
                        expandedImageInfo = {
                            originalHeight: croppedHeight,
                            expandedTop: topExtensionHeight,
                            expandedBottom: bottomExtensionHeight,
                            cropTop: cropTopAmount,
                            cropBottom: cropBottomAmount
                        };

                        log.success(`Created expanded image: ${originalWidth}x${totalHeight} (cropped: ${croppedHeight}, top: +${topExtensionHeight}, bottom: +${bottomExtensionHeight})`);
                    } else if (cropTopAmount > 0 || cropBottomAmount > 0) {
                        // 縮小のみの場合
                        imageBuffer = croppedBuffer;
                        expandedImageInfo = {
                            originalHeight: croppedHeight,
                            expandedTop: 0,
                            expandedBottom: 0,
                            cropTop: cropTopAmount,
                            cropBottom: cropBottomAmount
                        };
                        log.success(`Cropped image only: ${originalWidth}x${croppedHeight} (removed top: ${cropTopAmount}, bottom: ${cropBottomAmount})`);
                    }
                }

                // 2番目以降のセグメントには最初のセグメントの結果を参照として渡す
                const styleReference = (i > 0 && firstSegmentResult) ? firstSegmentResult : undefined;

                // AI処理（新しいeditOptions方式）
                let aiBuffer = await processImageWithAI(
                    imageBuffer,
                    editOptions,
                    i,
                    totalSegments,
                    googleApiKey,
                    user.id,
                    styleReference,
                    designDefinition
                );

                // 拡張画像を使った場合、元のサイズにクロップ
                if (aiBuffer && expandedImageInfo) {
                    const aiMeta = await sharp(aiBuffer).metadata();
                    const aiWidth = aiMeta.width || originalWidth;
                    const aiHeight = aiMeta.height || 0;

                    // スケール比率を計算（AIが出力サイズを変えた場合に対応）
                    const inputTotalHeight = expandedImageInfo.originalHeight + expandedImageInfo.expandedTop + expandedImageInfo.expandedBottom;
                    const scale = aiHeight / inputTotalHeight;

                    const extractTop = Math.round(expandedImageInfo.expandedTop * scale);
                    const extractHeight = Math.round(expandedImageInfo.originalHeight * scale);

                    log.info(`Cropping expanded result: extractTop=${extractTop}, extractHeight=${extractHeight} (scale=${scale.toFixed(3)})`);

                    aiBuffer = await sharp(aiBuffer)
                        .extract({ left: 0, top: extractTop, width: aiWidth, height: extractHeight })
                        .toBuffer();

                    log.success(`Cropped to original size: ${aiWidth}x${extractHeight}`);
                }

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

                    log.success(`Desktop ${i + 1} updated: ${section.id} -> ${newMedia.id}`);
                } else {
                    log.error(`Desktop ${i + 1} AI processing failed, keeping original`);
                }
            } catch (error: any) {
                log.error(`Error processing desktop ${i + 1}: ${error.message}`);
            }
        }

        // ========================================
        // モバイル画像を処理（includeMobileがtrueの場合）
        // ========================================
        if (includeMobile && sectionsWithMobile.length > 0) {
            log.info(`Starting mobile image processing (${sectionsWithMobile.length} sections)`);

            for (let i = 0; i < sectionsWithMobile.length; i++) {
                const section = sectionsWithMobile[i];
                processedCount++;

                send({
                    type: 'progress',
                    step: 'processing',
                    message: `モバイル ${i + 1}/${mobileCount} を処理中...${firstSegmentResult ? '（デスクトップ参照あり）' : ''}`,
                    total: totalSegments,
                    current: processedCount
                });

                // 境界オフセットを取得
                const sectionIdStr = String(section.id);
                const boundary = boundaryMap.get(sectionIdStr);
                const boundaryOffsetTop = boundary?.boundaryOffsetTop || 0;
                const boundaryOffsetBottom = boundary?.boundaryOffsetBottom || 0;

                log.info(`Processing mobile section ${i + 1}: ${section.id} (boundary: top=${boundaryOffsetTop}, bottom=${boundaryOffsetBottom})`);

                try {
                    // モバイル画像をダウンロード
                    const imageResponse = await fetch(section.mobileImage!.filePath);
                    const imageArrayBuffer = await imageResponse.arrayBuffer();
                    let imageBuffer = Buffer.from(imageArrayBuffer);
                    const originalMeta = await sharp(imageBuffer).metadata();
                    const originalWidth = originalMeta.width || 0;
                    const originalHeight = originalMeta.height || 0;

                    // 境界オフセットによる拡張画像の作成（モバイル版）
                    let expandedImageInfo: { originalHeight: number; expandedTop: number; expandedBottom: number } | null = null;

                    if (boundaryOffsetTop > 0 || boundaryOffsetBottom > 0) {
                        log.info(`Creating expanded mobile image with boundary offsets...`);

                        let topExtensionBuffer: Buffer | null = null;
                        let topExtensionHeight = 0;

                        // 上方向に拡張（前のセクションから取得）
                        if (boundaryOffsetTop > 0 && i > 0) {
                            const prevSection = sectionsWithMobile[i - 1];
                            if (prevSection?.mobileImage?.filePath) {
                                try {
                                    const prevResponse = await fetch(prevSection.mobileImage.filePath);
                                    const prevArrayBuffer = await prevResponse.arrayBuffer();
                                    const prevBuffer = Buffer.from(prevArrayBuffer);
                                    const prevMeta = await sharp(prevBuffer).metadata();

                                    const extractHeight = Math.min(boundaryOffsetTop, prevMeta.height || 0);
                                    const extractTop = Math.max(0, (prevMeta.height || 0) - extractHeight);

                                    topExtensionBuffer = await sharp(prevBuffer)
                                        .extract({ left: 0, top: extractTop, width: prevMeta.width || 0, height: extractHeight })
                                        .resize(originalWidth, extractHeight)
                                        .toBuffer();
                                    topExtensionHeight = extractHeight;
                                    log.info(`Mobile: Added top extension: ${extractHeight}px from previous section`);
                                } catch (e) {
                                    log.error(`Failed to get previous mobile section image: ${e}`);
                                }
                            }
                        }

                        let bottomExtensionBuffer: Buffer | null = null;
                        let bottomExtensionHeight = 0;

                        // 下方向に拡張（次のセクションから取得）
                        if (boundaryOffsetBottom > 0 && i < sectionsWithMobile.length - 1) {
                            const nextSection = sectionsWithMobile[i + 1];
                            if (nextSection?.mobileImage?.filePath) {
                                try {
                                    const nextResponse = await fetch(nextSection.mobileImage.filePath);
                                    const nextArrayBuffer = await nextResponse.arrayBuffer();
                                    const nextBuffer = Buffer.from(nextArrayBuffer);
                                    const nextMeta = await sharp(nextBuffer).metadata();

                                    const extractHeight = Math.min(boundaryOffsetBottom, nextMeta.height || 0);

                                    bottomExtensionBuffer = await sharp(nextBuffer)
                                        .extract({ left: 0, top: 0, width: nextMeta.width || 0, height: extractHeight })
                                        .resize(originalWidth, extractHeight)
                                        .toBuffer();
                                    bottomExtensionHeight = extractHeight;
                                    log.info(`Mobile: Added bottom extension: ${extractHeight}px from next section`);
                                } catch (e) {
                                    log.error(`Failed to get next mobile section image: ${e}`);
                                }
                            }
                        }

                        // 拡張画像を合成
                        if (topExtensionBuffer || bottomExtensionBuffer) {
                            const totalHeight = topExtensionHeight + originalHeight + bottomExtensionHeight;

                            const compositeBase = sharp({
                                create: {
                                    width: originalWidth,
                                    height: totalHeight,
                                    channels: 4,
                                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                                }
                            });

                            const compositeImages: Array<{ input: Buffer; top: number; left: number }> = [];
                            let yOffset = 0;

                            if (topExtensionBuffer) {
                                compositeImages.push({ input: topExtensionBuffer, top: yOffset, left: 0 });
                                yOffset += topExtensionHeight;
                            }

                            compositeImages.push({ input: imageBuffer, top: yOffset, left: 0 });
                            yOffset += originalHeight;

                            if (bottomExtensionBuffer) {
                                compositeImages.push({ input: bottomExtensionBuffer, top: yOffset, left: 0 });
                            }

                            imageBuffer = Buffer.from(await compositeBase.composite(compositeImages).png().toBuffer());
                            expandedImageInfo = {
                                originalHeight,
                                expandedTop: topExtensionHeight,
                                expandedBottom: bottomExtensionHeight
                            };

                            log.success(`Mobile: Created expanded image: ${originalWidth}x${totalHeight}`);
                        }
                    }

                    // デスクトップの最初の結果を参照画像として使用（一貫性確保）
                    const styleReference = firstSegmentResult || undefined;

                    // AI処理
                    let aiBuffer = await processImageWithAI(
                        imageBuffer,
                        editOptions,
                        i,
                        sectionsWithMobile.length,
                        googleApiKey,
                        user.id,
                        styleReference,
                        designDefinition
                    );

                    // 拡張画像を使った場合、元のサイズにクロップ
                    if (aiBuffer && expandedImageInfo) {
                        const aiMeta = await sharp(aiBuffer).metadata();
                        const aiWidth = aiMeta.width || originalWidth;
                        const aiHeight = aiMeta.height || 0;

                        const inputTotalHeight = expandedImageInfo.originalHeight + expandedImageInfo.expandedTop + expandedImageInfo.expandedBottom;
                        const scale = aiHeight / inputTotalHeight;

                        const extractTop = Math.round(expandedImageInfo.expandedTop * scale);
                        const extractHeight = Math.round(expandedImageInfo.originalHeight * scale);

                        log.info(`Mobile: Cropping expanded result: extractTop=${extractTop}, extractHeight=${extractHeight}`);

                        aiBuffer = await sharp(aiBuffer)
                            .extract({ left: 0, top: extractTop, width: aiWidth, height: extractHeight })
                            .toBuffer();

                        log.success(`Mobile: Cropped to original size: ${aiWidth}x${extractHeight}`);
                    }

                    if (aiBuffer) {
                        // 新しい画像をアップロード
                        const filename = `restyle-mobile-${Date.now()}-seg-${i}.png`;

                        const { error: uploadError } = await supabase
                            .storage
                            .from('images')
                            .upload(filename, aiBuffer, {
                                contentType: 'image/png',
                                cacheControl: '3600',
                                upsert: false
                            });

                        if (uploadError) {
                            log.error(`Upload error for mobile section ${i}: ${uploadError.message}`);
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
                                width: processedMeta.width || section.mobileImage!.width || 0,
                                height: processedMeta.height || section.mobileImage!.height || 0,
                                sourceUrl: section.mobileImage!.filePath,
                                sourceType: 'restyle-edit-mobile',
                            },
                        });

                        // セクションのモバイル画像を更新
                        await prisma.pageSection.update({
                            where: { id: section.id },
                            data: { mobileImageId: newMedia.id },
                        });

                        updatedSections.push({
                            sectionId: section.id,
                            oldImageId: section.mobileImageId,
                            newImageId: newMedia.id,
                            newImageUrl: publicUrl,
                            isMobile: true,
                        });

                        log.success(`Mobile ${i + 1} updated: ${section.id} -> ${newMedia.id}`);
                    } else {
                        log.error(`Mobile ${i + 1} AI processing failed, keeping original`);
                    }
                } catch (error: any) {
                    log.error(`Error processing mobile ${i + 1}: ${error.message}`);
                }
            }
        }

        log.info(`========== Restyle Complete ==========`);
        log.success(`Updated ${updatedSections.length} sections (desktop + mobile)`);

        send({
            type: 'complete',
            success: true,
            updatedCount: updatedSections.length,
            totalCount: totalSegments,
            sections: updatedSections,
        });
    });
}
