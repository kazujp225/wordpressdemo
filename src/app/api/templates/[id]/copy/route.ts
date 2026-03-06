import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase as supabaseStorage } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { checkPageLimit } from '@/lib/usage';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { estimateImageCost } from '@/lib/ai-costs';
import { checkImageGenerationLimit, recordApiUsage } from '@/lib/usage';

// テンプレートの各セクション画像内テキストをユーザー商材情報で差し替えるプロンプト
function buildTextReplacePrompt(productInfo: {
    productName: string;
    productDescription?: string;
    tone?: string;
    priceInfo?: string;
    targetAudience?: string;
    colorScheme?: string;
}) {
    const toneMap: Record<string, string> = {
        professional: 'プロフェッショナルで信頼感のある',
        friendly: 'フレンドリーで親しみやすい',
        luxury: '高級感と上質さを感じさせる',
        energetic: 'エネルギッシュで活力のある',
        calm: '落ち着きと安心感のある',
    };
    const toneDesc = toneMap[productInfo.tone || 'professional'] || 'プロフェッショナルな';

    const colorPalettes: Record<string, { name: string; palette: string }> = {
        blue:       { name: 'ブルー',     palette: 'メインカラー: #3B82F6, ダーク: #1E40AF, ライト背景: #DBEAFE, アクセント: #2563EB, テキスト: #1E3A5F' },
        green:      { name: 'グリーン',   palette: 'メインカラー: #22C55E, ダーク: #15803D, ライト背景: #DCFCE7, アクセント: #16A34A, テキスト: #14532D' },
        purple:     { name: 'パープル',   palette: 'メインカラー: #A855F7, ダーク: #7C3AED, ライト背景: #F3E8FF, アクセント: #9333EA, テキスト: #581C87' },
        orange:     { name: 'オレンジ',   palette: 'メインカラー: #F97316, ダーク: #EA580C, ライト背景: #FFF7ED, アクセント: #F59E0B, テキスト: #7C2D12' },
        red:        { name: 'レッド',     palette: 'メインカラー: #EF4444, ダーク: #DC2626, ライト背景: #FEF2F2, アクセント: #E11D48, テキスト: #7F1D1D' },
        teal:       { name: 'ティール',   palette: 'メインカラー: #14B8A6, ダーク: #0D9488, ライト背景: #CCFBF1, アクセント: #0F766E, テキスト: #134E4A' },
        pink:       { name: 'ピンク',     palette: 'メインカラー: #EC4899, ダーク: #DB2777, ライト背景: #FCE7F3, アクセント: #D946EF, テキスト: #831843' },
        gold:       { name: 'ゴールド',   palette: 'メインカラー: #D4AF37, ダーク: #B8960C, ライト背景: #FEF9E7, アクセント: #CA8A04, テキスト: #1A1A2E' },
        monochrome: { name: 'モノクロ',   palette: 'メインカラー: #374151, ダーク: #1F2937, ライト背景: #F3F4F6, アクセント: #111827, テキスト: #030712' },
        navy:       { name: 'ネイビー',   palette: 'メインカラー: #1E3A5F, ダーク: #0F2440, ライト背景: #E8EEF4, アクセント: #1E40AF, テキスト: #0C1E3A' },
    };
    const colorInfo = colorPalettes[productInfo.colorScheme || 'blue'] || colorPalettes.blue;

    return `You are an expert LP designer and image editor. Your task is to transform this landing page section into a completely new design for a different brand.

【TASK: FULL BRAND TRANSFORMATION】
This image is a section of a reference landing page. You must:
1. Replace ALL visible text with new copy for the product below
2. COMPLETELY CHANGE the color scheme to the specified palette
3. ADAPT visual elements (illustrations, icons, decorative graphics) to match the new product's industry
4. The result must look like a COMPLETELY DIFFERENT website

【PRODUCT/SERVICE INFORMATION】
商品・サービス名: ${productInfo.productName}
${productInfo.productDescription ? `説明: ${productInfo.productDescription}` : ''}
${productInfo.targetAudience ? `ターゲット層: ${productInfo.targetAudience}` : ''}
${productInfo.priceInfo ? `価格情報: ${productInfo.priceInfo}` : ''}
トーン: ${toneDesc}

【MANDATORY COLOR CHANGE - 配色は${colorInfo.name}に完全変更】
元の画像の配色をすべて破棄し、以下のカラーパレットで統一してください:
${colorInfo.palette}

変更対象:
- 背景色 → ライト背景カラーまたはメインカラーのグラデーション
- ボタン・CTA → メインカラーまたはアクセントカラー（形状は維持）
- 見出し → ダークカラーまたはメインカラー
- 本文テキスト → テキストカラー
- 装飾帯・バッジ・ラベル → メインカラーの濃淡で構成
- グラデーション → パレット内の色で再構成

【VISUAL ELEMENT ADAPTATION - ビジュアル要素の自動調整】
画像内のイラスト・アイコン・装飾グラフィックを、新しい商品/サービスの業種に合うよう自動的に調整してください:
- 元が「広告業界」のイラストなら → 「${productInfo.productName}」の業種に関連するイラストに変更
- アイコンの内容を商品に合ったものに差し替え（例: メガホン→美容なら化粧品ボトル）
- 装飾パターンやグラフィック要素の色をカラーパレットに合わせる
- 人物写真はそのまま維持（差し替えない）
- 元のイラストの画風（フラット、3D、手書き等）は維持する

【LAYOUT PRESERVATION - レイアウトは維持】
- セクションの構造・配置・余白はそのまま
- ボタンの形状（角丸・サイズ・位置）はそのまま
- 要素の配置位置は変えない

【TEXT REPLACEMENT - テキスト差替】
- すべての見出し、本文、キャプション、ボタンラベルを新商品用に差し替え
- ${toneDesc}トーンで自然な日本語コピーを生成
- 元のテキストと同程度の文字数
- ボタンは商品に合ったCTA（例: 「今すぐ申し込む」「無料で始める」等）

【🇯🇵 JAPANESE TEXT RENDERING】
1. ひらがな、カタカナ、漢字を一文字ずつ正確に描画
2. 類似文字への置換禁止（例: あ→お、シ→ツ）
3. ゴシック体（サンセリフ）で読みやすく
4. 文字サイズは元のテキストの110-120%
5. 新しい背景色に対して十分なコントラストを確保

【OUTPUT REQUIREMENTS】
- 完全な画像を出力（トリミングしない）
- 元の画像と同じサイズ
- 配色・ビジュアル要素が変わっていて、元のサイトとは完全に別のブランドに見えること

Generate the transformed image now.`;
}

// POST: テンプレートを自分のページとしてコピー（テキスト差し替え付き）
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // ページ数制限チェック
        const limitCheck = await checkPageLimit(user.id);
        if (!limitCheck.allowed) {
            return NextResponse.json(
                { error: limitCheck.reason || 'ページ数の上限に達しました' },
                { status: 403 }
            );
        }

        const { id } = await params;
        const templateId = parseInt(id);

        // リクエストボディから商材情報を取得
        let body: any = {};
        try {
            body = await request.json();
        } catch {
            // bodyなしでもOK
        }

        const { productName, productDescription, tone, priceInfo, targetAudience, colorScheme, ctaText, ctaLink } = body;

        // テンプレート取得（公開済みのみ）
        const template = await prisma.lpTemplate.findFirst({
            where: { id: templateId, isPublished: true },
            include: {
                sections: {
                    orderBy: { order: 'asc' },
                    include: { image: true, mobileImage: true },
                }
            }
        });

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        const pageTitle = productName ? `${productName} - LP` : template.title;

        // ヘッダー設定をマージ（ユーザー入力で上書き）
        let mergedHeaderConfig = template.headerConfig || '{}';
        try {
            const parsed = JSON.parse(mergedHeaderConfig);
            if (productName) parsed.logoText = productName;
            if (ctaText) parsed.ctaText = ctaText;
            if (ctaLink) parsed.ctaLink = ctaLink;
            mergedHeaderConfig = JSON.stringify(parsed);
        } catch {}

        // 商材情報がある場合はGeminiでテキスト差し替え
        const hasProductInfo = productName && productName.trim();

        if (!hasProductInfo) {
            // 商材情報なし = そのままコピー
            const page = await prisma.page.create({
                data: {
                    userId: user.id,
                    title: pageTitle,
                    slug: `page-${Date.now()}`,
                    status: 'draft',
                    headerConfig: mergedHeaderConfig,
                    formConfig: template.formConfig,
                    designDefinition: template.designDefinition,
                    sections: {
                        create: template.sections.map((sec) => ({
                            role: sec.role,
                            order: sec.order,
                            imageId: sec.imageId,
                            mobileImageId: sec.mobileImageId,
                            config: sec.config,
                            boundaryOffsetTop: sec.boundaryOffsetTop,
                            boundaryOffsetBottom: sec.boundaryOffsetBottom,
                        })),
                    },
                },
            });
            return NextResponse.json({ pageId: page.id, slug: page.slug });
        }

        // === SSE ストリーミングでテキスト差し替え進捗を返す ===
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const send = (data: any) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                };

                try {
                    // APIキー取得
                    const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user.id);
                    if (!GOOGLE_API_KEY) {
                        send({ type: 'error', error: 'Google APIキーが設定されていません' });
                        controller.close();
                        return;
                    }

                    const productInfo = { productName, productDescription, tone, priceInfo, targetAudience, colorScheme };
                    const prompt = buildTextReplacePrompt(productInfo);

                    // 画像があるセクションをフィルター
                    const sectionsWithImages = template.sections.filter(s => s.image?.filePath);
                    const totalSections = sectionsWithImages.length;

                    // クレジット上限チェック（2K解像度 × セクション数）
                    const creditCheck = await checkImageGenerationLimit(user.id, 'gemini-3.1-flash-image-preview', totalSections, undefined, '2K');
                    if (!creditCheck.allowed) {
                        send({ type: 'error', error: creditCheck.reason || 'クレジットが不足しています。設定からクレジットを追加してください。' });
                        controller.close();
                        return;
                    }

                    send({ type: 'progress', message: `${totalSections}セクションのテキストを差し替え中...`, total: totalSections, current: 0 });

                    // 各セクションの画像をGeminiで差し替え
                    const newSectionData: Array<{
                        role: string;
                        order: number;
                        imageId: number | null;
                        mobileImageId: number | null;
                        config: string | null;
                        boundaryOffsetTop: number;
                        boundaryOffsetBottom: number;
                    }> = [];

                    let sectionIndex = 0;
                    for (const sec of template.sections) {
                        if (!sec.image?.filePath) {
                            // 画像なしセクションはそのままコピー
                            newSectionData.push({
                                role: sec.role,
                                order: sec.order,
                                imageId: sec.imageId,
                                mobileImageId: sec.mobileImageId,
                                config: sec.config,
                                boundaryOffsetTop: sec.boundaryOffsetTop,
                                boundaryOffsetBottom: sec.boundaryOffsetBottom,
                            });
                            continue;
                        }

                        sectionIndex++;
                        send({ type: 'progress', message: `セクション ${sectionIndex}/${totalSections} を処理中...`, total: totalSections, current: sectionIndex });

                        let newImageId = sec.imageId;

                        try {
                            // 画像を取得してBase64化
                            const imgRes = await fetch(sec.image.filePath);
                            if (!imgRes.ok) throw new Error('画像取得失敗');
                            const imgBuffer = await imgRes.arrayBuffer();
                            const base64Data = Buffer.from(imgBuffer).toString('base64');
                            const mimeType = imgRes.headers.get('content-type') || 'image/png';

                            // Gemini API でテキスト差し替え
                            const startTime = createTimer();
                            const geminiRes = await fetch(
                                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GOOGLE_API_KEY}`,
                                {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        contents: [{
                                            parts: [
                                                { inlineData: { mimeType, data: base64Data } },
                                                { text: prompt }
                                            ]
                                        }],
                                        generationConfig: {
                                            responseModalities: ["IMAGE", "TEXT"],
                                            temperature: 0.3,
                                            imageConfig: { imageSize: "2K" }
                                        },
                                        toolConfig: { functionCallingConfig: { mode: "NONE" } }
                                    })
                                }
                            );

                            if (!geminiRes.ok) {
                                console.error(`Gemini error for section ${sectionIndex}:`, await geminiRes.text());
                                throw new Error('Gemini API error');
                            }

                            const geminiData = await geminiRes.json();
                            const parts = geminiData.candidates?.[0]?.content?.parts || [];
                            let editedBase64: string | null = null;
                            for (const part of parts) {
                                if (part.inlineData?.data) {
                                    editedBase64 = part.inlineData.data;
                                    break;
                                }
                            }

                            if (editedBase64) {
                                // Supabaseにアップロード
                                const buffer = Buffer.from(editedBase64, 'base64');
                                const filename = `template-gen-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;

                                const { error: uploadError } = await supabaseStorage
                                    .storage
                                    .from('images')
                                    .upload(filename, buffer, {
                                        contentType: 'image/png',
                                        cacheControl: '3600',
                                        upsert: false
                                    });

                                if (uploadError) throw uploadError;

                                const { data: { publicUrl } } = supabaseStorage
                                    .storage
                                    .from('images')
                                    .getPublicUrl(filename);

                                // DB保存
                                const media = await prisma.mediaImage.create({
                                    data: {
                                        userId: user.id,
                                        filePath: publicUrl,
                                        mime: 'image/png',
                                        width: 0,
                                        height: 0,
                                        sourceType: 'template-gen',
                                    },
                                });

                                newImageId = media.id;

                                // ログ記録
                                const logResult = await logGeneration({
                                    userId: user.id,
                                    type: 'template-gen',
                                    endpoint: '/api/templates/copy',
                                    model: 'gemini-3.1-flash-image-preview',
                                    inputPrompt: prompt.substring(0, 500),
                                    imageCount: 1,
                                    status: 'succeeded',
                                    startTime,
                                    resolution: '2K',
                                });

                                if (logResult) {
                                    await recordApiUsage(user.id, logResult.id, logResult.estimatedCost, {
                                        model: 'gemini-3.1-flash-image-preview',
                                        imageCount: 1,
                                    });
                                }

                                send({ type: 'progress', message: `セクション ${sectionIndex}/${totalSections} 完了`, total: totalSections, current: sectionIndex });
                            } else {
                                // Geminiが画像を返さなかった場合は元画像を使用
                                console.warn(`No image from Gemini for section ${sectionIndex}, using original`);
                                send({ type: 'progress', message: `セクション ${sectionIndex} は元画像を使用`, total: totalSections, current: sectionIndex });
                            }
                        } catch (secError: any) {
                            console.error(`Section ${sectionIndex} text replace failed:`, secError);
                            // エラー時は元画像をそのまま使う
                            send({ type: 'progress', message: `セクション ${sectionIndex} は元画像を使用（エラー）`, total: totalSections, current: sectionIndex });
                        }

                        newSectionData.push({
                            role: sec.role,
                            order: sec.order,
                            imageId: newImageId,
                            mobileImageId: sec.mobileImageId,
                            config: sec.config,
                            boundaryOffsetTop: sec.boundaryOffsetTop,
                            boundaryOffsetBottom: sec.boundaryOffsetBottom,
                        });
                    }

                    // ページ作成
                    send({ type: 'progress', message: 'ページを作成中...', total: totalSections, current: totalSections });

                    const page = await prisma.page.create({
                        data: {
                            userId: user.id,
                            title: pageTitle,
                            slug: `page-${Date.now()}`,
                            status: 'draft',
                            headerConfig: mergedHeaderConfig,
                            formConfig: template.formConfig,
                            designDefinition: template.designDefinition,
                            sections: {
                                create: newSectionData,
                            },
                        },
                    });

                    send({ type: 'complete', pageId: page.id, slug: page.slug });
                } catch (error: any) {
                    console.error('Template copy with text replace error:', error);
                    send({ type: 'error', error: error.message || 'テンプレートの処理に失敗しました' });
                }

                controller.close();
            }
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error: any) {
        console.error('Failed to copy template:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
