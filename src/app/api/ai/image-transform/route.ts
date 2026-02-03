import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { checkImageGenerationLimit, recordApiUsage } from '@/lib/usage';
import { logGeneration } from '@/lib/generation-logger';
import { supabase } from '@/lib/supabase';

// OCR用システムプロンプト（元画像用）
const SOURCE_OCR_PROMPT = `この画像を詳細に分析してください。

【抽出してほしい情報】
1. 画像内のすべてのテキスト（タイトル、見出し、本文、キャッチコピー等）
2. 画像の主題・テーマ（何についての内容か）
3. 主要なビジュアル要素（人物、商品、背景など）
4. 全体的な雰囲気・トーン

JSON形式で回答してください:
{
  "texts": ["テキスト1", "テキスト2", ...],
  "mainTitle": "メインのタイトルやキャッチコピー",
  "theme": "画像のテーマ・主題",
  "visualElements": ["要素1", "要素2", ...],
  "mood": "雰囲気の説明"
}`;

// OCR用システムプロンプト（参考サムネイル用）
const REFERENCE_OCR_PROMPT = `この参考サムネイル画像のデザインを詳細に分析してください。

【抽出してほしい情報】
1. レイアウト構造（テキストの位置、画像の配置）
2. テキストのスタイル（フォントサイズの相対関係、色、装飾）
3. 配色（メインカラー、アクセントカラー、背景色）
4. デザインの特徴（枠、影、グラデーション等）
5. 全体的なデザインスタイル

JSON形式で回答してください:
{
  "layout": {
    "titlePosition": "上部/中央/下部",
    "subtitlePosition": "位置",
    "imagePosition": "位置",
    "textAlignment": "左寄せ/中央/右寄せ"
  },
  "textStyle": {
    "titleStyle": "大きい、太字、白文字に黒縁取り等",
    "subtitleStyle": "スタイルの説明",
    "decorations": ["装飾1", "装飾2"]
  },
  "colors": {
    "primary": "メインカラー",
    "accent": "アクセントカラー",
    "background": "背景色/グラデーション"
  },
  "designFeatures": ["特徴1", "特徴2", ...],
  "overallStyle": "ポップ/シンプル/高級感/インパクト重視 等"
}`;

// 最終画像生成用システムプロンプト
const THUMBNAIL_GENERATION_PROMPT = `あなたはプロフェッショナルなYouTubeサムネイルデザイナーです。

以下の情報を元に、サムネイル画像を生成してください。

【元画像から抽出したコンテンツ】
{sourceAnalysis}

【参考サムネイルのデザイン分析】
{referenceAnalysis}

【重要な指示】
1. 参考サムネイルの「レイアウト・配色・デザインスタイル」を忠実に再現
2. 元画像の「テキスト内容・テーマ」を使用
3. テキストは必ず画像内に含める（参考サムネイルと同様の配置・スタイルで）
4. 16:9の横長画像
5. YouTubeで映える高コントラスト、視認性の高いデザイン
6. 参考サムネイルにある装飾（縁取り、影、背景効果）も再現

サムネイル画像を1枚生成してください。`;

// 資料化用システムプロンプト
const DOCUMENT_SYSTEM_PROMPT = `あなたはプロフェッショナルなプレゼン資料デザイナーです。

【タスク】
ユーザーから提供された画像（LP、資料、スクリーンショット等）の内容を分析し、
その情報をプレゼンテーションスライド風の画像として再構成してください。

【分析ポイント】
- 画像内のテキスト情報を読み取る
- 情報の階層構造を把握する
- 重要なポイントを抽出する

【出力要件】
- 16:9の横長画像
- プレゼンスライド風のクリーンなデザイン
- 情報が整理された見やすいレイアウト
- ビジネス資料として適切な配色
- 1スライドに詰め込みすぎない
- 重要なテキストは画像内に含める

各スライドは独立して理解できるが、全体として一貫したストーリーを持たせてください。`;

export async function POST(request: NextRequest) {
    // ユーザー認証
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const {
            mode, // 'thumbnail' | 'document'
            sourceImageBase64, // 元画像（Base64）
            referenceImageBase64, // 参考画像（サムネイルモードのみ、Base64）
            slideCount = 3, // 資料モードのスライド枚数
        } = await request.json();

        if (!mode || !sourceImageBase64) {
            return NextResponse.json({ error: 'mode and sourceImageBase64 are required' }, { status: 400 });
        }

        // referenceImageBase64 is now optional for thumbnail mode

        // クレジットチェック（画像生成分のみ）
        const imageCount = mode === 'thumbnail' ? 1 : slideCount;
        const limitCheck = await checkImageGenerationLimit(user.id, 'gemini-3-pro-image-preview', imageCount);
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
                needPurchase: true,
            }, { status: 402 });
        }

        const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user.id);
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({ error: 'Google API key is not configured' }, { status: 500 });
        }

        const results: string[] = [];

        if (mode === 'thumbnail') {
            // ===== サムネイル変換 =====

            // Step 1: 元画像のOCR分析
            console.log('[Thumbnail] Step 1: Analyzing source image...');
            const sourceAnalysis = await analyzeImageWithOCR(
                GOOGLE_API_KEY,
                SOURCE_OCR_PROMPT,
                sourceImageBase64
            );
            console.log('[Thumbnail] Source analysis:', sourceAnalysis);

            let generationPrompt: string;

            if (referenceImageBase64) {
                // 参考画像がある場合: 2段階OCR方式
                console.log('[Thumbnail] Step 2: Analyzing reference thumbnail...');
                const referenceAnalysis = await analyzeImageWithOCR(
                    GOOGLE_API_KEY,
                    REFERENCE_OCR_PROMPT,
                    referenceImageBase64
                );
                console.log('[Thumbnail] Reference analysis:', referenceAnalysis);

                // Step 3: 分析結果を元に画像生成
                console.log('[Thumbnail] Step 3: Generating thumbnail with reference...');
                generationPrompt = THUMBNAIL_GENERATION_PROMPT
                    .replace('{sourceAnalysis}', sourceAnalysis)
                    .replace('{referenceAnalysis}', referenceAnalysis);
            } else {
                // 参考画像がない場合: AIが自動でスタイルを決定
                console.log('[Thumbnail] Step 2: Generating thumbnail without reference...');
                generationPrompt = `あなたはプロフェッショナルなYouTubeサムネイルデザイナーです。

以下の元画像の分析結果を元に、YouTubeサムネイル画像を生成してください。

【元画像から抽出したコンテンツ】
${sourceAnalysis}

【重要な指示】
1. YouTubeで映える高コントラスト、視認性の高いデザイン
2. 元画像の「テキスト内容・テーマ」を大きく目立つように配置
3. テキストは必ず画像内に含める（大きく、読みやすく）
4. 16:9の横長画像
5. 目を引くインパクトのあるデザイン（ポップな配色、太字テキスト、縁取りなど）
6. サムネイルとして適切な情報量（詰め込みすぎない）

サムネイル画像を1枚生成してください。`;
            }

            const result = await generateImageWithGemini(
                GOOGLE_API_KEY,
                generationPrompt,
                sourceImageBase64,
                referenceImageBase64
            );
            if (result) results.push(result);

        } else {
            // ===== 資料化モード =====

            // Step 1: 元画像のOCR分析（重要: 画像の内容を正確に把握する）
            console.log('[Document] Step 1: Analyzing source image content...');
            const documentOcrPrompt = `この画像を詳細に分析し、プレゼン資料に変換するための情報を抽出してください。

【抽出してほしい情報】
1. 画像内のすべてのテキスト（タイトル、見出し、本文、箇条書き、表の内容等）
2. 画像の主題・テーマ（何についての内容か）
3. 情報の構造（セクション分け、階層関係）
4. 重要なキーワードやデータ
5. 図表やグラフがあればその内容

JSON形式で回答してください:
{
  "mainTitle": "メインのタイトル",
  "theme": "全体のテーマ・主題",
  "sections": [
    {"heading": "セクション見出し", "content": "内容", "keyPoints": ["ポイント1", "ポイント2"]}
  ],
  "keyData": ["重要なデータ1", "重要なデータ2"],
  "allTexts": ["画像内の全テキスト"]
}`;

            const sourceAnalysis = await analyzeImageWithOCR(
                GOOGLE_API_KEY,
                documentOcrPrompt,
                sourceImageBase64
            );
            console.log('[Document] Source analysis:', sourceAnalysis.substring(0, 500));

            // Step 2: 分析結果を元にスライドを生成
            for (let i = 0; i < slideCount; i++) {
                console.log(`[Document] Step 2: Generating slide ${i + 1}/${slideCount}...`);

                const slidePrompt = `以下の画像分析結果を元に、${slideCount}枚のプレゼンスライドのうち${i + 1}枚目を生成してください。

【元画像から抽出した情報】
${sourceAnalysis}

${i === 0 ? '【1枚目】タイトルスライド：上記分析から得られたメインタイトルとテーマを大きく表示。' : ''}
${i > 0 && i < slideCount - 1 ? `【${i + 1}枚目】本文スライド：上記分析から得られた具体的な内容・データを図解で表現。` : ''}
${i === slideCount - 1 && slideCount > 1 ? `【${slideCount}枚目】まとめスライド：上記分析から得られた重要ポイントの総括。` : ''}

【重要】
- 元画像に含まれていた実際のテキスト・データを必ず使用してください
- 勝手に内容を作り変えないでください
- 16:9の横長スライド画像を生成してください`;

                const result = await generateImageWithGemini(
                    GOOGLE_API_KEY,
                    DOCUMENT_SYSTEM_PROMPT + '\n\n' + slidePrompt,
                    sourceImageBase64
                );
                if (result) results.push(result);
            }
        }

        if (results.length === 0) {
            return NextResponse.json({ error: 'Failed to generate images' }, { status: 500 });
        }

        // ログ記録とクレジット消費
        const logResult = await logGeneration({
            userId: user.id,
            type: 'image',
            endpoint: '/api/ai/image-transform',
            model: 'gemini-3-pro-image-preview',
            inputPrompt: mode === 'thumbnail' ? 'Thumbnail transformation' : `Document transformation (${slideCount} slides)`,
            imageCount: results.length,
            status: 'succeeded',
        });

        if (logResult && !limitCheck.skipCreditConsumption) {
            await recordApiUsage(user.id, logResult.id, logResult.estimatedCost, {
                model: 'gemini-3-pro-image-preview',
                imageCount: results.length,
            });
        }

        // 画像をSupabaseにアップロードして永続化
        const uploadedUrls: string[] = [];
        for (let i = 0; i < results.length; i++) {
            const base64Data = results[i];
            const buffer = Buffer.from(base64Data, 'base64');
            const fileName = `${mode}/${user.id}/${Date.now()}_${i}.png`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('generated-images')
                .upload(fileName, buffer, {
                    contentType: 'image/png',
                    upsert: true,
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                // アップロード失敗してもBase64は返す
                uploadedUrls.push(`data:image/png;base64,${base64Data}`);
            } else {
                const { data: publicUrl } = supabase.storage
                    .from('generated-images')
                    .getPublicUrl(fileName);
                uploadedUrls.push(publicUrl.publicUrl);
            }
        }

        return NextResponse.json({
            success: true,
            images: uploadedUrls,
            mode,
            count: results.length,
        });

    } catch (error) {
        console.error('Image transform error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// OCR分析（テキストモデル使用）- リトライ機能付き
async function analyzeImageWithOCR(
    apiKey: string,
    prompt: string,
    imageBase64: string
): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[OCR] Attempt ${attempt}/${maxRetries}...`);
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: 'image/png',
                                        data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.2,
                            maxOutputTokens: 2048,
                        }
                    })
                }
            );

            if (response.ok) {
                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (text) {
                    console.log(`[OCR] Success on attempt ${attempt}`);
                    return text;
                }
                // テキストが空の場合もリトライ
                lastError = new Error('OCR returned empty response');
            } else if (response.status === 503 || response.status === 429) {
                const errorText = await response.text();
                console.error(`[OCR] Attempt ${attempt} failed with ${response.status}:`, errorText);
                lastError = new Error(`OCR failed: ${response.status}`);
            } else {
                const errorText = await response.text();
                console.error('Gemini OCR error:', errorText);
                throw new Error(`OCR分析に失敗しました: ${response.status}`);
            }

            if (attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`[OCR] Retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        } catch (fetchError: any) {
            console.error(`[OCR] Attempt ${attempt} fetch error:`, fetchError.message);
            lastError = fetchError;
            if (attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    // 全リトライ失敗
    throw lastError || new Error('OCR分析に失敗しました');
}

// 画像生成（Gemini 3 Pro Image使用）
async function generateImageWithGemini(
    apiKey: string,
    prompt: string,
    sourceImageBase64: string,
    referenceImageBase64?: string
): Promise<string | null> {
    const parts: any[] = [{ text: prompt }];

    // 元画像を追加
    parts.push({
        inlineData: {
            mimeType: 'image/png',
            data: sourceImageBase64.replace(/^data:image\/\w+;base64,/, ''),
        }
    });

    // 参考画像がある場合は追加
    if (referenceImageBase64) {
        parts.push({
            inlineData: {
                mimeType: 'image/png',
                data: referenceImageBase64.replace(/^data:image\/\w+;base64,/, ''),
            }
        });
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: {
                    responseModalities: ["IMAGE", "TEXT"],
                    temperature: 0.8,
                }
            })
        }
    );

    if (!response.ok) {
        console.error('Gemini Image API error:', await response.text());
        return null;
    }

    const data = await response.json();

    // 画像データを抽出
    const candidates = data.candidates || [];
    for (const candidate of candidates) {
        const content = candidate.content;
        if (content?.parts) {
            for (const part of content.parts) {
                if (part.inlineData?.data) {
                    return part.inlineData.data;
                }
            }
        }
    }

    return null;
}
