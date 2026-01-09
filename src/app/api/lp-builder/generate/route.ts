import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    SYSTEM_PROMPT,
    FULL_LP_PROMPT,
    fillPromptTemplate,
} from '@/lib/gemini-prompts';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { businessInfoSchema, validateRequest } from '@/lib/validations';

// ============================================
// モデル定数（停止・名称変更に対応しやすくする）
// ============================================
const MODELS = {
    // テキスト生成: gemini-1.5-flash は 2025-09-29 に停止済み → gemini-2.5-flash に移行
    TEXT: 'gemini-2.5-flash',
    // 画像生成 Primary: Nano Banana Pro（日本語指示に強い）
    IMAGE_PRIMARY: 'gemini-3-pro-image-preview',
    // 画像生成 Fallback: Nano Banana（高速・安価）
    IMAGE_FALLBACK: 'gemini-2.5-flash-image',
} as const;

// 9:16の解像度テーブル（モデルごとに微妙に異なる）
const IMAGE_DIMENSIONS = {
    'gemini-3-pro-image-preview': { width: 768, height: 1376 },
    'gemini-2.5-flash-image': { width: 768, height: 1344 },
} as const;

// ビジネス情報から不足している変数を自動生成
function enrichBusinessInfo(info: any): Record<string, string> {
    const toneDescriptions: Record<string, { urgency: string; guarantee: string }> = {
        professional: {
            urgency: '今なら無料相談実施中',
            guarantee: '安心の返金保証付き',
        },
        friendly: {
            urgency: 'お気軽にお問い合わせください',
            guarantee: '初回無料でお試しいただけます',
        },
        luxury: {
            urgency: '限定のプレミアムオファー',
            guarantee: '品質保証・アフターサポート完備',
        },
        energetic: {
            urgency: '今すぐ始めよう！期間限定キャンペーン中',
            guarantee: '結果が出なければ全額返金',
        },
    };

    // 安全なデフォルト値を設定
    const businessName = info.businessName || '当社';
    const industry = info.industry || 'サービス業';
    const service = info.service || 'サービス';
    const target = info.target || 'お客様';
    const strengths = info.strengths || '高品質なサービス';
    const tone = info.tone || 'professional';

    const toneConfig = toneDescriptions[tone] || toneDescriptions.professional;

    return {
        businessName,
        industry,
        service,
        target,
        strengths,
        differentiators: info.differentiators || strengths,
        priceRange: info.priceRange || '詳細はお問い合わせください',
        tone,
        // 自動生成される変数（安全に文字列を構築）
        painPoints: `${target}が抱える課題（${service}に関する悩み）`,
        concerns: `${service}の導入・利用に関する不安や疑問`,
        process: `${industry}における一般的な契約・購入プロセス`,
        planCount: '3',
        mainFeatures: strengths,
        offer: `${service}の特別オファー`,
        urgency: toneConfig.urgency,
        guarantee: toneConfig.guarantee,
        results: `${strengths}による具体的な成果・効果`,
    };
}

// カラーログ用のヘルパー
const log = {
    info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ✓ ${msg}`),
    warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ⚠ ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[ERROR]\x1b[0m ✗ ${msg}`),
    progress: (msg: string) => console.log(`\x1b[35m[PROGRESS]\x1b[0m → ${msg}`),
};

// ============================================
// v2: 画像生成プロンプトテンプレート
// ============================================

// 共通プロンプト：スタイル固定（Anchor）+ 禁止事項
const COMMON_IMAGE_PROMPT = `
【役割】
あなたはLP広告用の"背景/キービジュアル"を制作するアートディレクターです。
参照画像（Style Anchor）の色・質感・照明・グラデーションの方向性を厳密に踏襲してください。

【スタイル固定（最優先）】
- 支配的な色相（hue）と彩度（saturation）を参照画像から変えない
- 背景の質感（マット/グロス/粒状/ノイズ感）を揃える
- 光源方向とコントラストを揃える
- 新しい"目立つ色"を追加しない（アクセントは参照画像の範囲内）

【禁止事項（絶対厳守）】
- 文字、英数字、記号、ロゴ、UI、透かし、看板、ラベル、字幕、タイポグラフィ要素を一切入れない
- "文字っぽく見える模様"も避ける（標識・ポスター・紙・画面・パッケージ類は禁止）
- 既存ブランドを想起させる要素は禁止

【出力要件】
- 高解像度、シャープ
- 広告LPに適した"余白（negative space）"を確保
- 情報を邪魔しない背景として成立すること
`;

// 境界接続用プロンプト（Seam Reference使用時）
const SEAM_REFERENCE_PROMPT = `
【境界接続（超重要）】
添付されている2枚目の参照画像は「前セクション画像の下端ストリップ」です。
生成する画像の上端20%は、このストリップと自然に連続するようにしてください。
- 色調、グラデーション、ノイズ、陰影の流れを一致させる
- 上端で不自然な切り替わり・段差・色相ジャンプを起こさない
`;

// セクションタイプ別の画像生成プロンプト（v2: 構図ルール分離）
const SECTION_IMAGE_PROMPTS: Record<string, (info: any) => string> = {
    hero: (info) => `【このセクションの目的：HERO】
- 第一印象で価値が伝わる"象徴的なメインモチーフ"を1つ
- ただし文字を置ける余白を残す（中央〜上部に余白多め）
- ビジネス内容：${info.industry} / ${info.service}
- ターゲット：${info.target}
- トーン：${info.tone === 'luxury' ? '高級感・洗練' : info.tone === 'friendly' ? '親しみやすさ・明るさ' : info.tone === 'energetic' ? '活気・情熱' : 'プロフェッショナル・信頼'}
- 人物やプロダクトを含めてもOK（ただしテキスト禁止）`,

    features: (info) => `【このセクションの目的：FEATURES（特徴紹介）】
- 抽象的なパターンや質感を活用
- アイコン風の形状はOKだが「文字っぽい形」はNG
- ${info.strengths}を連想させる視覚要素
- 情報密度は中程度、余白を確保`,

    pricing: (info) => `【このセクションの目的：PRICING（料金表）】
- 表の背景として使う前提
- コントラストは弱め、均一な面積を多めに
- ${info.tone === 'luxury' ? 'プレミアム感のある上品な背景' : 'シンプルで清潔感のある背景'}
- 価格表示を邪魔しない控えめなビジュアル`,

    testimonials: (info) => `【このセクションの目的：TESTIMONIALS（お客様の声）】
- 信頼感・安心感を表現
- ${info.target}層に響く温かみのあるビジュアル
- 人物のシルエットや抽象的な"つながり"を表現してもOK
- テキストカードを配置できる余白を確保`,

    faq: (info) => `【このセクションの目的：FAQ（よくある質問）】
- 安心感を表現、刺激要素は少なめ
- 明るさ一定、穏やかなトーン
- Q&Aリストを配置できる広い余白
- 疑問解決・サポートを連想させる要素`,

    cta: (info) => `【このセクションの目的：CTA（行動喚起）】
- やや強めのインパクト（ただし派手な新色は禁止）
- 参照色の範囲内でコントラストを上げる
- ${info.tone === 'energetic' ? 'ダイナミックで情熱的' : info.tone === 'luxury' ? '洗練された高級感' : '行動を促す力強さ'}
- CTAボタンが目立つ余白と背景のバランス`,
};

// リトライ時の追加プロンプト（色ズレ対策強化）
const RETRY_COLOR_FIX_PROMPT = `
【色の厳密固定（再生成時のみ追加）】
参照画像から外れる色相変化は禁止。
特に背景色のベース（background）を変更しない。
新しいアクセントカラーの追加は禁止。
前回の生成で色がズレた可能性があるため、参照画像の色を100%踏襲すること。
`;

// ============================================
// v2: 画像生成関数（Style Anchor + Seam Reference 方式）
// ============================================

// Seam Reference用：画像の下端20%を切り出す
async function extractSeamStrip(base64Image: string, stripRatio: number = 0.2): Promise<string> {
    // Note: 本番環境ではsharpなどのライブラリを使用して正確に切り出す
    // ここでは簡易的に全体を返す（将来的にsharp導入時に置き換え）
    // TODO: sharp導入後に下端切り出しを実装
    // const buffer = Buffer.from(base64Image, 'base64');
    // const metadata = await sharp(buffer).metadata();
    // const stripHeight = Math.floor(metadata.height! * stripRatio);
    // const seamBuffer = await sharp(buffer)
    //     .extract({ left: 0, top: metadata.height! - stripHeight, width: metadata.width!, height: stripHeight })
    //     .toBuffer();
    // return seamBuffer.toString('base64');

    // 暫定：全体を返す（参照としては機能する）
    return base64Image;
}

// 画像生成関数（v2: Style Anchor + Seam Reference 対応）
async function generateSectionImage(
    sectionType: string,
    businessInfo: any,
    apiKey: string,
    userId: string | null,
    maxRetries: number = 3,
    styleAnchorBase64?: string,    // Style Anchor: 色・質感の基準（全セクション共通）
    seamReferenceBase64?: string,  // Seam Reference: 前画像の下端ストリップ（境界接続用）
    designDefinition?: any         // デザイン定義（ユーザーアップロード画像から抽出）
): Promise<{ imageId: number | null; base64: string | null; usedModel: string | null }> {
    const promptGenerator = SECTION_IMAGE_PROMPTS[sectionType];
    if (!promptGenerator) {
        log.warn(`No image prompt defined for section type: ${sectionType}`);
        return { imageId: null, base64: null, usedModel: null };
    }

    // セクション固有プロンプト
    const sectionPrompt = promptGenerator(businessInfo);

    // デザイン定義からのスタイル指示
    let designInstruction = '';
    if (designDefinition && designDefinition.colorPalette) {
        const vibe = designDefinition.vibe || 'Modern';
        const primaryColor = designDefinition.colorPalette?.primary || '#000000';
        const bgColor = designDefinition.colorPalette?.background || '#ffffff';
        const description = designDefinition.description || '';
        const mood = designDefinition.typography?.mood || 'Professional';

        designInstruction = `
【参照デザインからの指示】
- Vibe: ${vibe}
- Primary Color: ${primaryColor}
- Background Color: ${bgColor}
- Style: ${description}
- Mood: ${mood}
`;
    }

    // リトライループ
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            log.progress(`Generating image for [${sectionType}] section... (attempt ${attempt}/${maxRetries})`);

            // プロンプト構築
            let fullPrompt = COMMON_IMAGE_PROMPT + sectionPrompt + designInstruction;

            // Seam Referenceがある場合は境界接続プロンプトを追加
            if (seamReferenceBase64) {
                fullPrompt += SEAM_REFERENCE_PROMPT;
            }

            // リトライ時は色ズレ対策を強化
            if (attempt > 1) {
                fullPrompt += RETRY_COLOR_FIX_PROMPT;
            }

            // リクエストのpartsを構築
            const requestParts: any[] = [];

            // 1. Style Anchor（色・質感の基準）
            if (styleAnchorBase64) {
                requestParts.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: styleAnchorBase64
                    }
                });
                requestParts.push({
                    text: '【Style Anchor】上記の画像は色・質感・照明の基準です。この画像のスタイルを厳密に踏襲してください。'
                });
            }

            // 2. Seam Reference（境界接続用：前画像の下端）
            if (seamReferenceBase64) {
                requestParts.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: seamReferenceBase64
                    }
                });
                requestParts.push({
                    text: '【Seam Reference】上記は前セクションの下端部分です。生成画像の上端がこれと自然に繋がるようにしてください。'
                });
            }

            // 3. メインプロンプト
            requestParts.push({ text: fullPrompt });

            // Primary Model: Gemini 3 Pro Image (Nano Banana Pro)
            let usedModel: string = MODELS.IMAGE_PRIMARY;
            let response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.IMAGE_PRIMARY}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: requestParts
                        }],
                        generationConfig: {
                            // v2: IMAGEのみ（TEXTを含めない）
                            responseModalities: ["IMAGE"],
                            // v2: アスペクト比をAPI設定で明示（プロンプト頼みにしない）
                            imageConfig: {
                                aspectRatio: "9:16"
                            }
                        }
                    })
                }
            );

            let data;
            if (!response.ok) {
                const errorText = await response.text();
                log.warn(`Primary model (${MODELS.IMAGE_PRIMARY}) failed (${response.status}): ${errorText.substring(0, 200)}`);

                // Fallback: Gemini 2.5 Flash Image (Nano Banana)
                log.info(`Trying fallback model (${MODELS.IMAGE_FALLBACK})...`);
                usedModel = MODELS.IMAGE_FALLBACK;

                const fallbackResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.IMAGE_FALLBACK}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: requestParts
                            }],
                            generationConfig: {
                                responseModalities: ["IMAGE"],
                                imageConfig: {
                                    aspectRatio: "9:16"
                                }
                            }
                        })
                    }
                );

                if (!fallbackResponse.ok) {
                    const fallbackError = await fallbackResponse.text();
                    log.error(`Fallback model also failed (${fallbackResponse.status}): ${fallbackError.substring(0, 200)}`);

                    // 429/RESOURCE_EXHAUSTED の場合は長めに待機
                    if (fallbackResponse.status === 429) {
                        const waitTime = Math.pow(2, attempt) * 5000; // 10s, 20s, 40s
                        log.info(`Rate limited. Waiting ${waitTime}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    } else if (attempt < maxRetries) {
                        const waitTime = Math.pow(2, attempt) * 2000;
                        log.info(`Waiting ${waitTime}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }

                    if (attempt >= maxRetries) {
                        log.error(`[${sectionType}] 画像生成に失敗しました（両モデルでエラー）`);
                        return { imageId: null, base64: null, usedModel: null };
                    }
                    continue;
                }
                data = await fallbackResponse.json();
            } else {
                data = await response.json();
            }

            // 画像データを抽出
            const parts = data.candidates?.[0]?.content?.parts || [];
            let base64Image: string | null = null;

            for (const part of parts) {
                if (part.inlineData?.data) {
                    base64Image = part.inlineData.data;
                    break;
                }
            }

            if (!base64Image) {
                log.error(`No image data in response for [${sectionType}]`);
                if (attempt < maxRetries) {
                    const waitTime = Math.pow(2, attempt) * 2000;
                    log.info(`Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                log.error(`[${sectionType}] 画像データが取得できませんでした`);
                return { imageId: null, base64: null, usedModel: null };
            }

            // 成功 - 画像をアップロード
            const buffer = Buffer.from(base64Image, 'base64');
            const filename = `lp-${sectionType}-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;

            const { error: uploadError } = await supabase
                .storage
                .from('images')
                .upload(filename, buffer, {
                    contentType: 'image/png',
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                log.error(`Upload error for [${sectionType}]: ${uploadError.message}`);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
                return { imageId: null, base64: null, usedModel: null };
            }

            const { data: { publicUrl } } = supabase
                .storage
                .from('images')
                .getPublicUrl(filename);

            // v2: 解像度はモデルに応じた値を使用（固定値ではなく）
            const dimensions = IMAGE_DIMENSIONS[usedModel as keyof typeof IMAGE_DIMENSIONS]
                || { width: 768, height: 1376 };

            // MediaImageレコード作成
            const media = await prisma.mediaImage.create({
                data: {
                    userId,
                    filePath: publicUrl,
                    mime: 'image/png',
                    width: dimensions.width,
                    height: dimensions.height,
                },
            });

            log.success(`Image generated for [${sectionType}] → ID: ${media.id} (model: ${usedModel})`);
            return { imageId: media.id, base64: base64Image, usedModel };

        } catch (error: any) {
            log.error(`Exception on attempt ${attempt} for [${sectionType}]: ${error.message || error}`);
            if (attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt) * 2000;
                log.info(`Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    log.error(`====== [${sectionType}] 画像生成に完全に失敗しました（${maxRetries}回リトライ後）======`);
    return { imageId: null, base64: null, usedModel: null };
}

export async function POST(req: NextRequest) {
    const startTime = createTimer();
    let prompt = '';

    // ユーザー認証を確認してAPIキーを取得
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { businessInfo } = body;

        if (!businessInfo) {
            return NextResponse.json({
                error: 'ビジネス情報が入力されていません。フォームに必要事項を入力してください。'
            }, { status: 400 });
        }

        // Validate business info
        const validation = validateRequest(businessInfoSchema, businessInfo);
        if (!validation.success) {
            return NextResponse.json({
                error: validation.error,
                details: validation.details
            }, { status: 400 });
        }

        const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user.id);
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({
                error: 'Google API key is not configured. 設定画面でAPIキーを設定してください。'
            }, { status: 500 });
        }

        // Prepare Prompt with enriched business info
        const enrichedInfo = enrichBusinessInfo(businessInfo);
        prompt = fillPromptTemplate(FULL_LP_PROMPT, enrichedInfo);

        // Design Definition Injection (with safe property access)
        const designDefinition = body.designDefinition;
        if (designDefinition && typeof designDefinition === 'object') {
            const vibe = designDefinition.vibe || 'Modern';
            const description = designDefinition.description || '';
            const primaryColor = designDefinition.colorPalette?.primary || '#3b82f6';
            const secondaryColor = designDefinition.colorPalette?.secondary || '#6366f1';
            const bgColor = designDefinition.colorPalette?.background || '#ffffff';
            const typographyStyle = designDefinition.typography?.style || 'Sans-Serif';
            const typographyMood = designDefinition.typography?.mood || 'Modern';
            const layoutStyle = designDefinition.layout?.style || 'Standard';
            const layoutDensity = designDefinition.layout?.density || 'Medium';

            prompt += `\n\n【IMPORTANT: DESIGN INSTRUCTION】
You MUST strictly follow the "Design Definition" below for the visual style, color palette, and component structure.
The user wants to REPLICATE the design style of a specific reference image.

<Design Definition>
- Vibe: ${vibe}
- Description: ${description}
- Color Palette: Primary=${primaryColor}, Secondary=${secondaryColor}, Background=${bgColor}
- Typography: ${typographyStyle} (${typographyMood})
- Layout: ${layoutStyle} (Density: ${layoutDensity})
</Design Definition>

Use these colors and styles in your Tailwind classes.
For example, if the background is dark, use 'bg-slate-900' or similar.
If the layout is 'Hero-focused', ensure the Hero section is dominant.
`;
        }


        // Call Gemini API for text content (using user's API key)
        // v2: gemini-1.5-flash は停止済み → gemini-2.5-flash に移行
        const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
        const textModel = genAI.getGenerativeModel({ model: MODELS.TEXT });

        const result = await textModel.generateContent([
            { text: SYSTEM_PROMPT },
            { text: prompt }
        ]);
        const response = await result.response;
        const text = response.text();

        log.info("Gemini text content generated successfully");

        // Parse Response - より堅牢なJSONパース
        let generatedData;
        try {
            let jsonString = text.trim();

            // マークダウンコードブロックを削除（複数パターン対応）
            // パターン1: ```json ... ```
            const jsonBlockMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonBlockMatch) {
                jsonString = jsonBlockMatch[1];
            } else {
                // パターン2: ``` ... ```
                const codeBlockMatch = jsonString.match(/```\s*([\s\S]*?)\s*```/);
                if (codeBlockMatch) {
                    jsonString = codeBlockMatch[1];
                } else {
                    // パターン3: 先頭/末尾の```を除去
                    jsonString = jsonString.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
                }
            }

            // JSONオブジェクトを抽出（先頭の{から最後の}まで）
            const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonString = jsonMatch[0];
            }

            generatedData = JSON.parse(jsonString);

            // 必須フィールドの検証
            if (!generatedData.sections || !Array.isArray(generatedData.sections)) {
                throw new Error('Invalid response structure: sections array is missing');
            }
        } catch (e: any) {
            log.error("JSON Parse Error - AI response was not valid JSON");
            log.error(`Raw Text: ${text.substring(0, 500)}`);
            log.error(`Parse Error: ${e.message}`);
            return NextResponse.json({
                error: 'AIからの応答を処理できませんでした。もう一度お試しください。問題が続く場合は、入力内容を簡潔にしてみてください。'
            }, { status: 500 });
        }

        // ============================================
        // v2: Style Anchor + Seam Reference 方式で画像生成
        // ============================================
        const sections = generatedData.sections || [];
        const sectionCount = sections.length;
        log.info(`========== Starting SEQUENTIAL image generation (v2: Anchor + Seam) for ${sectionCount} sections ==========`);

        // Style Anchor: ユーザーがデザイン画像をアップロードしていればそれを使用
        // なければ最初のheroセクション生成後にheroをAnchorとして固定
        let styleAnchorBase64: string | null = null;

        // ユーザーアップロード画像からの参照（designDefinitionに含まれていれば）
        if (body.designImageBase64) {
            styleAnchorBase64 = body.designImageBase64;
            log.info('Using user-uploaded design image as Style Anchor');
        }

        // 順次生成：Style Anchor（固定）+ Seam Reference（前画像の下端）
        const sectionsWithImages: any[] = [];
        let previousImageBase64: string | null = null;

        for (let index = 0; index < sections.length; index++) {
            const section = sections[index];
            log.progress(`Processing section ${index + 1}/${sections.length}: ${section.type}`);

            // Seam Reference: 前画像の下端ストリップを作成
            let seamReference: string | undefined;
            if (previousImageBase64) {
                seamReference = await extractSeamStrip(previousImageBase64, 0.2);
            }

            const result = await generateSectionImage(
                section.type,
                businessInfo,
                GOOGLE_API_KEY,
                user.id,
                3, // maxRetries
                styleAnchorBase64 || undefined,  // Style Anchor（色・質感の基準）
                seamReference,                    // Seam Reference（境界接続用）
                body.designDefinition             // デザイン定義
            );

            sectionsWithImages.push({
                ...section,
                imageId: result.imageId,
                properties: section.data || section.properties || {},
            });

            // 成功した場合の処理
            if (result.base64) {
                previousImageBase64 = result.base64;

                // 最初のセクション（hero）が成功したら、それをStyle Anchorとして固定
                // （ユーザーアップロード画像がない場合のみ）
                if (index === 0 && !styleAnchorBase64) {
                    styleAnchorBase64 = result.base64;
                    log.info('Hero section set as Style Anchor for remaining sections');
                }

                log.info(`Seam reference updated for next section`);
            }

            // レート制限回避のため少し待機（previewモデルは制限が厳しめ）
            if (index < sections.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        // 結果サマリー
        const successCount = sectionsWithImages.filter(s => s.imageId).length;
        const failCount = sectionsWithImages.filter(s => !s.imageId).length;

        log.info(`========== Image generation complete ==========`);
        log.success(`Successfully generated: ${successCount}/${sectionsWithImages.length} sections (sequential with reference)`);
        if (failCount > 0) {
            log.warn(`Failed to generate: ${failCount} sections`);
        }

        // ログ記録（テキスト生成）
        await logGeneration({
            userId: user.id,
            type: 'lp-generate',
            endpoint: '/api/lp-builder/generate',
            model: MODELS.TEXT,
            inputPrompt: prompt,
            outputResult: JSON.stringify(generatedData),
            status: 'succeeded',
            startTime
        });

        // ログ記録（画像生成サマリー）
        if (successCount > 0) {
            await logGeneration({
                userId: user.id,
                type: 'lp-generate',
                endpoint: '/api/lp-builder/generate',
                model: MODELS.IMAGE_PRIMARY,
                inputPrompt: `LP image generation for ${sectionsWithImages.length} sections (v2: Anchor+Seam)`,
                imageCount: successCount,
                status: 'succeeded',
                startTime
            });
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Cost Calculation (JPY Estimation)
        // Gemini 1.5 Flash (Text): ~0.01 JPY / 1k input chars, ~0.03 JPY / 1k output chars
        // Gemini Image (Flash/Pro): ~0.6 JPY (Flash) - ~4.0 JPY (Pro) per image
        // *Using conservative estimates for user display*

        const textInputCost = (prompt.length / 1000) * 0.01;
        const textOutputCost = (text.length / 1000) * 0.03;

        // Image usage: successCount images
        // Assuming mix of Pro/Flash or just strictly estimating roughly 2 JPY per image for safety/clarity
        const imageCost = successCount * 2.0;

        const totalCost = Math.ceil((textInputCost + textOutputCost + imageCost) * 100) / 100; // Round to 2 decimals

        return NextResponse.json({
            success: true,
            data: {
                ...generatedData,
                sections: sectionsWithImages
            },
            meta: {
                duration: duration,
                estimatedCost: totalCost
            }
        });

    } catch (error: any) {
        log.error(`Generation API Error: ${error.message || error}`);

        // ログ記録（エラー）
        await logGeneration({
            userId: user.id,
            type: 'lp-generate',
            endpoint: '/api/lp-builder/generate',
            model: MODELS.TEXT,
            inputPrompt: prompt || 'Error before prompt',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        // ユーザーフレンドリーなエラーメッセージを生成
        let userMessage = 'LP生成中にエラーが発生しました。';

        if (error.message?.includes('API key')) {
            userMessage = 'APIキーに問題があります。設定画面でAPIキーを確認してください。';
        } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
            userMessage = 'API利用上限に達しました。しばらく待ってから再試行してください。';
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            userMessage = 'ネットワークエラーが発生しました。接続を確認して再試行してください。';
        } else if (error.message?.includes('timeout')) {
            userMessage = '処理がタイムアウトしました。もう一度お試しください。';
        } else {
            userMessage = 'LP生成中に予期せぬエラーが発生しました。もう一度お試しください。問題が続く場合はサポートにご連絡ください。';
        }

        return NextResponse.json({
            error: userMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
    }
}
