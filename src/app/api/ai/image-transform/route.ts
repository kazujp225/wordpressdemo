import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { checkImageGenerationLimit, recordApiUsage } from '@/lib/usage';
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

        if (mode === 'thumbnail' && !referenceImageBase64) {
            return NextResponse.json({ error: 'referenceImageBase64 is required for thumbnail mode' }, { status: 400 });
        }

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
            // ===== サムネイル変換（2段階OCR方式） =====

            // Step 1: 元画像のOCR分析
            console.log('[Thumbnail] Step 1: Analyzing source image...');
            const sourceAnalysis = await analyzeImageWithOCR(
                GOOGLE_API_KEY,
                SOURCE_OCR_PROMPT,
                sourceImageBase64
            );
            console.log('[Thumbnail] Source analysis:', sourceAnalysis);

            // Step 2: 参考サムネイルのOCR分析
            console.log('[Thumbnail] Step 2: Analyzing reference thumbnail...');
            const referenceAnalysis = await analyzeImageWithOCR(
                GOOGLE_API_KEY,
                REFERENCE_OCR_PROMPT,
                referenceImageBase64!
            );
            console.log('[Thumbnail] Reference analysis:', referenceAnalysis);

            // Step 3: 分析結果を元に画像生成
            console.log('[Thumbnail] Step 3: Generating thumbnail...');
            const generationPrompt = THUMBNAIL_GENERATION_PROMPT
                .replace('{sourceAnalysis}', sourceAnalysis)
                .replace('{referenceAnalysis}', referenceAnalysis);

            const result = await generateImageWithGemini(
                GOOGLE_API_KEY,
                generationPrompt,
                sourceImageBase64,
                referenceImageBase64
            );
            if (result) results.push(result);

        } else {
            // ===== 資料化モード =====
            for (let i = 0; i < slideCount; i++) {
                const slidePrompt = `この画像の内容を分析し、${slideCount}枚のプレゼンスライドのうち${i + 1}枚目を生成してください。

${i === 0 ? '【1枚目】タイトルスライド：全体の概要や主題を表現。大きなタイトルテキストを含める。' : ''}
${i > 0 && i < slideCount - 1 ? `【${i + 1}枚目】本文スライド：詳細情報やポイントを図解で表現。箇条書きやキーワードを含める。` : ''}
${i === slideCount - 1 && slideCount > 1 ? `【${slideCount}枚目】まとめスライド：重要ポイントの総括。結論やCTAを含める。` : ''}

16:9の横長スライド画像を生成してください。テキストも画像内に含めてください。`;

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

        // クレジット消費を記録
        if (!limitCheck.skipCreditConsumption) {
            await recordApiUsage(user.id, 'gemini-3-pro-image-preview', results.length);
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

// OCR分析（テキストモデル使用）
async function analyzeImageWithOCR(
    apiKey: string,
    prompt: string,
    imageBase64: string
): Promise<string> {
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

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini OCR error:', errorText);
        return '分析に失敗しました';
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
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
