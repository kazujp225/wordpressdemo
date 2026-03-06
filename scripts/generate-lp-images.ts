import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
function loadEnv() {
    const envPath = path.join(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex);
                const value = trimmed.substring(eqIndex + 1).replace(/^["']|["']$/g, '');
                process.env[key] = value;
            }
        }
    }
}

loadEnv();

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
const PAGE_ID = 49;

// モデル定義
const MODELS = {
    IMAGE_PRIMARY: 'gemini-3.1-flash-image-preview',
    IMAGE_FALLBACK: 'gemini-2.5-flash-image',
};

const IMAGE_DIMENSIONS: Record<string, { width: number; height: number }> = {
    'gemini-3.1-flash-image-preview': { width: 768, height: 1376 },
    'gemini-2.5-flash-image': { width: 768, height: 1344 },
};

// ============================================
// デザインガイドライン
// ============================================

interface DesignGuideline {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    gradientDirection: 'top-to-bottom' | 'bottom-to-top' | 'left-to-right' | 'radial';
    seamStyle: 'gradient-fade' | 'soft-blur' | 'pattern-dissolve' | 'color-blend';
    seamColorTop: string;
    seamColorBottom: string;
    brightness: 'light' | 'medium' | 'dark';
    saturation: 'vivid' | 'muted' | 'neutral';
    contrast: 'high' | 'medium' | 'low';
    texture: 'smooth' | 'grainy' | 'glossy' | 'matte';
    visualFlow: 'centered' | 'left-aligned' | 'right-aligned' | 'diagonal';
}

function generateDesignGuideline(tone: string = 'professional', colorPreference?: string): DesignGuideline {
    const toneDefaults: Record<string, Partial<DesignGuideline>> = {
        professional: {
            primaryColor: '#1e3a5f',
            secondaryColor: '#3b82f6',
            accentColor: '#60a5fa',
            backgroundColor: '#f8fafc',
            brightness: 'light',
            saturation: 'muted',
            contrast: 'medium',
            texture: 'smooth',
        },
        friendly: {
            primaryColor: '#059669',
            secondaryColor: '#34d399',
            accentColor: '#fbbf24',
            backgroundColor: '#f0fdf4',
            brightness: 'light',
            saturation: 'vivid',
            contrast: 'medium',
            texture: 'smooth',
        },
        luxury: {
            primaryColor: '#1f2937',
            secondaryColor: '#b8860b',
            accentColor: '#d4af37',
            backgroundColor: '#0f0f0f',
            brightness: 'dark',
            saturation: 'muted',
            contrast: 'high',
            texture: 'glossy',
        },
        energetic: {
            primaryColor: '#dc2626',
            secondaryColor: '#f97316',
            accentColor: '#fbbf24',
            backgroundColor: '#fffbeb',
            brightness: 'light',
            saturation: 'vivid',
            contrast: 'high',
            texture: 'matte',
        },
    };

    const defaults = toneDefaults[tone] || toneDefaults.professional;

    let finalPrimaryColor = defaults.primaryColor!;
    if (colorPreference) {
        const colorMap: Record<string, string> = {
            'ブルー': '#3b82f6', 'blue': '#3b82f6',
            'グリーン': '#10b981', 'green': '#10b981',
            'レッド': '#ef4444', 'red': '#ef4444',
            'パープル': '#8b5cf6', 'purple': '#8b5cf6',
            'オレンジ': '#f97316', 'orange': '#f97316',
        };
        for (const [key, hex] of Object.entries(colorMap)) {
            if (colorPreference.toLowerCase().includes(key.toLowerCase())) {
                finalPrimaryColor = hex;
                break;
            }
        }
    }

    return {
        primaryColor: finalPrimaryColor,
        secondaryColor: defaults.secondaryColor!,
        accentColor: defaults.accentColor!,
        backgroundColor: defaults.backgroundColor!,
        gradientDirection: 'top-to-bottom',
        seamStyle: 'gradient-fade',
        seamColorTop: defaults.backgroundColor!,
        seamColorBottom: defaults.backgroundColor!,
        brightness: defaults.brightness!,
        saturation: defaults.saturation!,
        contrast: defaults.contrast!,
        texture: defaults.texture!,
        visualFlow: 'centered',
    };
}

function guidelineToPrompt(guideline: DesignGuideline): string {
    const brightnessJa = { light: '明るい', medium: '中間', dark: 'ダーク' };
    const saturationJa = { vivid: '鮮やか', muted: '落ち着いた', neutral: 'ニュートラル' };
    const contrastJa = { high: '高コントラスト', medium: '中コントラスト', low: '低コントラスト' };
    const textureJa = { smooth: 'スムース', grainy: '粒状感', glossy: '光沢', matte: 'マット' };

    return `
【デザインガイドライン（全セクション共通・厳守）】
■ カラーパレット:
  - プライマリ: ${guideline.primaryColor}
  - セカンダリ: ${guideline.secondaryColor}
  - アクセント: ${guideline.accentColor}
  - 背景ベース: ${guideline.backgroundColor}
  ※ 上記4色とその中間トーンのみ使用可。新しい色相の追加は禁止。

■ トーン・質感:
  - 明度: ${brightnessJa[guideline.brightness]}
  - 彩度: ${saturationJa[guideline.saturation]}
  - コントラスト: ${contrastJa[guideline.contrast]}
  - テクスチャ: ${textureJa[guideline.texture]}

■ 境界接続スタイル:
  - 方式: グラデーションフェード
  - グラデーション方向: 上から下へ
  - 上端は前セクションの下端色に合わせる
  - 下端は次セクションへ繋がる色で終わる
`;
}

// ============================================
// Seam Reference (Sharp使用)
// ============================================

function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

interface SeamStripResult {
    base64: string;
    dominantColor: string;
    width: number;
    height: number;
}

async function extractSeamStrip(
    base64Image: string,
    stripRatio: number = 0.15,
    defaultColor: string = '#f8fafc'
): Promise<SeamStripResult> {
    try {
        const buffer = Buffer.from(base64Image, 'base64');
        const metadata = await sharp(buffer).metadata();

        if (!metadata.width || !metadata.height) {
            return { base64: base64Image, dominantColor: defaultColor, width: 0, height: 0 };
        }

        let stripHeight = Math.floor(metadata.height * stripRatio);
        if (stripHeight < 50) {
            stripHeight = Math.min(50, Math.floor(metadata.height * 0.25));
        }

        const seamImage = sharp(buffer).extract({
            left: 0,
            top: metadata.height - stripHeight,
            width: metadata.width,
            height: stripHeight
        });

        const { channels } = await seamImage.clone().stats();
        let dominantColor = defaultColor;
        if (channels && channels.length >= 3) {
            const r = channels[0].mean;
            const g = channels[1].mean;
            const b = channels[2].mean;
            dominantColor = rgbToHex(r, g, b);
        }

        const seamBuffer = await seamImage.png({ quality: 90 }).toBuffer();

        console.log(`  → Extracted seam: ${metadata.width}x${stripHeight}, color: ${dominantColor}`);

        return {
            base64: seamBuffer.toString('base64'),
            dominantColor,
            width: metadata.width,
            height: stripHeight,
        };
    } catch (error: any) {
        console.error(`  Seam extraction failed: ${error.message}`);
        return { base64: base64Image, dominantColor: defaultColor, width: 0, height: 0 };
    }
}

// ============================================
// 共通プロンプト
// ============================================

const COMMON_IMAGE_PROMPT = `
【役割】
あなたは高CVR（コンバージョン率）を実現するLP広告専門のビジュアルデザイナーです。
日本語のランディングページ画像を生成してください。

【LP広告クリエイティブの鉄則】
1. 感情トリガー: 見た瞬間に「欲しい」「解決したい」と感じさせる
2. ビジュアルヒエラルキー: 視線誘導を意識した構図
3. 信頼性演出: プロフェッショナルで高品質な仕上がり

【画像仕様】
- 縦長のLP用画像（9:16アスペクト比）
- 高品質、プロフェッショナルな仕上がり
- スタイル: モダン、プロフェッショナル、テクノロジー感

【テキストレイアウトルール】
- 日本語テキストは明確に読みやすく配置
- 見出しは大きく太字で目立たせる
- サブテキストは適切な階層で配置
- テキストと背景のコントラストを確保
- フォントは洗練されたゴシック体風

【スタイル統一（最優先）】
- 参照画像（Style Anchor）の色相・彩度・明度を厳密に踏襲
- グラデーションの方向性と質感を統一
- 新しいアクセントカラーの追加は禁止

【セクション間の連続性（超重要）】
- 各セクションは1枚の長いLPとして縦に並ぶ
- 画像の「上端」と「下端」は次セクションとの接続点
- 上端20%: 前セクションの下端と自然に繋がる
- 下端20%: 次セクションへ自然に移行できる余韻
- 急激な色変化・明度ジャンプを避ける
`;

const SEAM_REFERENCE_PROMPT = `
【境界接続（最重要）】
添付の2枚目画像は「直前セクションの下端ストリップ」です。
生成画像はこの直前セクションの「真下」に配置されます。

★ 接続の鉄則:
1. 上端20%は前セクションと完全に連続させる
2. 視覚的な「継ぎ目」を感じさせない
3. 色の段差・ジャンプが発生しないこと
4. 2枚を縦に並べた時に1枚の画像に見えるレベル
`;

const RETRY_COLOR_FIX_PROMPT = `
【リトライ時の厳密指示】
前回の生成に問題がありました。以下を100%遵守：

1. 色の厳密固定:
   - 参照画像から外れる色相変化は絶対禁止
   - 背景色のベースを変更しない

2. 境界接続の厳密化:
   - 上端20%は前セクションの下端と完全に一致
   - 色の段差を絶対に発生させない
`;

// ============================================
// セクションプロンプト生成
// ============================================

function getSectionPrompt(role: string, config: any, sectionIndex: number, totalSections: number): string {
    const headline = config.headline || '';
    const subheadline = config.subheadline || '';
    const description = config.description || '';
    const items = config.items || [];
    const ctaText = config.cta_text || '';

    const isFirst = sectionIndex === 0;
    const isLast = sectionIndex === totalSections - 1;

    let positionNote = '';
    if (isFirst) {
        positionNote = '【セクション位置: 最初】上端は自由、下端は次セクションへの接続を意識。';
    } else if (isLast) {
        positionNote = '【セクション位置: 最後】上端は前セクションと接続、下端は自然な終わり。';
    } else {
        positionNote = '【セクション位置: 中間】上端・下端ともに前後セクションとの接続を最優先。';
    }

    const basePrompt = (sectionTitle: string, layoutInstructions: string) => `
【${sectionTitle}】
${positionNote}

■ 表示するテキスト（必ず画像内に配置）:
【見出し】${headline}
${subheadline ? `【サブ見出し】${subheadline}` : ''}
${description ? `【本文】\n${description}` : ''}

■ レイアウト:
${layoutInstructions}
`;

    switch (role) {
        case 'hero':
            return basePrompt('HERO - ファーストビュー', `
- 背景: テクノロジー感のあるブルー系グラデーション、抽象的なコード/AI要素
- メインコピーは画面中央〜上部に大きく配置（白文字、太字）
- サブコピーはメインコピーの下に配置
- 下部1/3に視覚的なフォーカスポイント`);

        case 'problem':
            return basePrompt('PROBLEM - 課題提起', `
- 背景: やや暗めのブルー〜グレー系グラデーション
- 課題・悩みを感じさせる雰囲気（ただし重すぎない）
- テキストは中央寄せで読みやすく配置
- 白またはライトグレーの文字色`);

        case 'solution':
            return basePrompt('SOLUTION - 解決策', `
- 背景: 暗から明へ、希望を感じさせるブルー系グラデーション
- 光・希望・突破口をイメージする視覚要素
- テキストは中央寄せ、明るく前向きな印象`);

        case 'benefits':
            return basePrompt('BENEFITS - メリット', `
- 背景: 明るいブルー〜ライトブルー、成功・成長を暗示
- 希望に満ちた明るいトーン
- テキストは読みやすく階層的に配置`);

        case 'features':
            const featureItems = items.map((item: any, i: number) =>
                `${i + 1}. ${item.title || ''}`
            ).join('\n');
            return basePrompt('FEATURES - 特徴', `
- 背景: クリーンなブルー系、プロフェッショナルな印象
- 特徴リストをカードまたはアイコン付きで配置
${featureItems ? `【特徴】\n${featureItems}` : ''}`);

        case 'testimonials':
            const testimonialItems = items.slice(0, 3).map((item: any) =>
                `「${(item.comment || '').substring(0, 50)}...」- ${item.name || ''}`
            ).join('\n');
            return basePrompt('TESTIMONIALS - お客様の声', `
- 背景: 温かみのあるブルー〜ライトグレー
- 人間味・温かみを感じさせる雰囲気
- 声はカード形式で配置
${testimonialItems ? `【声】\n${testimonialItems}` : ''}`);

        case 'process':
            const processItems = items.map((item: any) =>
                `STEP${item.step || ''}: ${item.title || item.description || ''}`
            ).join('\n');
            return basePrompt('PROCESS - 受講の流れ', `
- 背景: クリーンなブルー〜ホワイト
- ステップは番号付きで配置
- 矢印やフローで進行を視覚化
${processItems ? `【ステップ】\n${processItems}` : ''}`);

        case 'guarantee':
            return basePrompt('GUARANTEE - 保証', `
- 背景: 誠実なブルー〜ネイビー系
- 信頼・安心を連想させる視覚要素
- テキストは落ち着いた配置`);

        case 'pricing':
            return basePrompt('PRICING - 料金', `
- 背景: クリーンなブルー〜ライトグレー
- 価格は大きく目立たせる
- プロフェッショナルで信頼感のある印象`);

        case 'faq':
            const faqItems = items.slice(0, 3).map((item: any) =>
                `Q: ${item.question || ''}`
            ).join('\n');
            return basePrompt('FAQ - よくある質問', `
- 背景: 穏やかなライトブルー〜ホワイト
- Q&Aは明確に区別して配置
- 読みやすさを最優先
${faqItems ? `【質問】\n${faqItems}` : ''}`);

        case 'cta':
            return basePrompt('CTA - 行動喚起', `
- 背景: インパクトのあるブルー系グラデーション
- CTAボタン「${ctaText || '無料カウンセリングを予約する'}」を大きくオレンジ系で目立たせる
- 緊急性・ワクワク感を演出`);

        default:
            return basePrompt(`${role.toUpperCase()}セクション`, `
- 背景: ブルー系のプロフェッショナルなデザイン
- テキストは読みやすく配置`);
    }
}

// ============================================
// 画像生成
// ============================================

async function generateImage(
    sectionType: string,
    config: any,
    sectionIndex: number,
    totalSections: number,
    designGuideline: DesignGuideline,
    styleAnchor?: string,
    seamReference?: string,
    maxRetries: number = 3
): Promise<{ base64: string | null; usedModel: string | null }> {

    const sectionPrompt = getSectionPrompt(sectionType, config, sectionIndex, totalSections);
    const designInstruction = guidelineToPrompt(designGuideline);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            let fullPrompt = COMMON_IMAGE_PROMPT + sectionPrompt + designInstruction;

            if (seamReference) {
                fullPrompt += SEAM_REFERENCE_PROMPT;
            }

            if (attempt > 1) {
                fullPrompt += RETRY_COLOR_FIX_PROMPT;
            }

            const requestParts: any[] = [];

            // Style Anchor
            if (styleAnchor) {
                requestParts.push({
                    inlineData: { mimeType: 'image/png', data: styleAnchor }
                });
                requestParts.push({
                    text: '【Style Anchor】上記の画像は色・質感・フォントスタイルの基準です。このスタイルを厳密に踏襲してください。'
                });
            }

            // Seam Reference
            if (seamReference) {
                requestParts.push({
                    inlineData: { mimeType: 'image/png', data: seamReference }
                });
                requestParts.push({
                    text: '【Seam Reference】上記は前セクションの下端部分です。生成画像の上端がこれと自然に繋がるようにしてください。'
                });
            }

            requestParts.push({ text: fullPrompt });

            // Primary model
            let usedModel = MODELS.IMAGE_PRIMARY;
            let response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.IMAGE_PRIMARY}:generateContent?key=${GOOGLE_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: requestParts }],
                        generationConfig: {
                            responseModalities: ["IMAGE"],
                            imageConfig: { aspectRatio: "9:16" }
                        }
                    })
                }
            );

            let data;
            if (!response.ok) {
                console.log(`    Primary model failed, trying fallback...`);
                usedModel = MODELS.IMAGE_FALLBACK;

                response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.IMAGE_FALLBACK}:generateContent?key=${GOOGLE_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: requestParts }],
                            generationConfig: {
                                responseModalities: ["IMAGE"],
                                imageConfig: { aspectRatio: "9:16" }
                            }
                        })
                    }
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`    Both models failed (${response.status}):`, errorText.substring(0, 100));

                    if (response.status === 429) {
                        const waitTime = Math.pow(2, attempt) * 5000;
                        console.log(`    Rate limited. Waiting ${waitTime}ms...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }

                    if (attempt >= maxRetries) {
                        return { base64: null, usedModel: null };
                    }
                    continue;
                }
            }

            data = await response.json();
            const parts = data.candidates?.[0]?.content?.parts || [];

            for (const part of parts) {
                if (part.inlineData?.data) {
                    return { base64: part.inlineData.data, usedModel };
                }
            }

            console.error(`    No image data in response`);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

        } catch (error: any) {
            console.error(`    Exception (attempt ${attempt}):`, error.message);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    return { base64: null, usedModel: null };
}

// ============================================
// アップロード
// ============================================

async function uploadImage(base64: string, sectionType: string, usedModel: string): Promise<number | null> {
    try {
        const buffer = Buffer.from(base64, 'base64');
        const filename = `lp-${sectionType}-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;

        const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filename, buffer, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error(`  Upload error:`, uploadError.message);
            return null;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(filename);

        const dimensions = IMAGE_DIMENSIONS[usedModel] || { width: 768, height: 1376 };

        const media = await prisma.mediaImage.create({
            data: {
                userId: '17b4e0d7-f5fc-4561-aeb7-518a8d9b8427',
                filePath: publicUrl,
                mime: 'image/png',
                width: dimensions.width,
                height: dimensions.height
            }
        });

        return media.id;
    } catch (error: any) {
        console.error(`  Upload error:`, error.message);
        return null;
    }
}

// ============================================
// メイン処理
// ============================================

async function generateAllImages() {
    console.log('🎨 LP Image Generation (Full Logic Version)');
    console.log('📦 Page ID:', PAGE_ID);
    console.log('✨ Features: Design Guideline + Style Anchor + Seam Reference\n');

    // デザインガイドライン生成
    const designGuideline = generateDesignGuideline('professional', 'ブルー');
    console.log('📐 Design Guideline generated');
    console.log(`   Primary: ${designGuideline.primaryColor}`);
    console.log(`   Secondary: ${designGuideline.secondaryColor}`);
    console.log(`   Background: ${designGuideline.backgroundColor}\n`);

    // セクション取得
    const sections = await prisma.pageSection.findMany({
        where: { pageId: PAGE_ID },
        orderBy: { order: 'asc' }
    });

    console.log(`Found ${sections.length} sections\n`);

    let styleAnchor: string | null = null;
    let previousImageBase64: string | null = null;
    let successCount = 0;

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];

        // Parse config
        let config: any = {};
        try {
            if (section.config) {
                config = typeof section.config === 'string'
                    ? JSON.parse(section.config)
                    : section.config;
            }
        } catch (e) {
            console.error(`  Failed to parse config for ${section.role}`);
        }

        console.log(`[${i + 1}/${sections.length}] Generating: ${section.role}`);
        if (config.headline) {
            console.log(`  → Headline: ${config.headline.substring(0, 35)}...`);
        }

        // Seam Reference (前画像の下端を切り出し)
        let seamReference: string | undefined;
        if (previousImageBase64) {
            const seamResult = await extractSeamStrip(previousImageBase64);
            seamReference = seamResult.base64;
            // ガイドラインのseamColorTopを更新
            designGuideline.seamColorTop = seamResult.dominantColor;
        }

        // 画像生成
        const { base64, usedModel } = await generateImage(
            section.role,
            config,
            i,
            sections.length,
            designGuideline,
            styleAnchor || undefined,
            seamReference,
            3
        );

        if (!base64) {
            console.log(`  ❌ Failed to generate image\n`);
            continue;
        }

        console.log(`  ✓ Image generated (model: ${usedModel})`);

        // Style Anchor設定
        if (!styleAnchor) {
            styleAnchor = base64;
            console.log(`  → Set as Style Anchor`);
        }

        // 次のSeam Reference用に保存
        previousImageBase64 = base64;

        // アップロード
        const imageId = await uploadImage(base64, section.role, usedModel!);

        if (!imageId) {
            console.log(`  ❌ Failed to upload image\n`);
            continue;
        }

        console.log(`  ✓ Uploaded (ID: ${imageId})`);

        // セクション更新
        await prisma.pageSection.update({
            where: { id: section.id },
            data: { imageId }
        });

        console.log(`  ✓ Section updated\n`);
        successCount++;

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('='.repeat(50));
    console.log(`✅ Complete! ${successCount}/${sections.length} images generated`);
    console.log('');
    console.log('View at:');
    console.log(`  http://localhost:3000/admin/pages/${PAGE_ID}`);
    console.log(`  http://localhost:3000/preview/page/${PAGE_ID}`);

    await prisma.$disconnect();
}

generateAllImages().catch(console.error);
