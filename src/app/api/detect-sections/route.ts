import { NextRequest } from 'next/server';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

// カラーログ
const log = {
    info: (msg: string) => console.log(`\x1b[36m[DETECT-SECTIONS INFO]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[DETECT-SECTIONS SUCCESS]\x1b[0m ✓ ${msg}`),
    warn: (msg: string) => console.log(`\x1b[33m[DETECT-SECTIONS WARN]\x1b[0m ⚠ ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[DETECT-SECTIONS ERROR]\x1b[0m ✗ ${msg}`),
};

// デバイスプリセット
const DEVICE_PRESETS = {
    desktop: {
        width: 1280,
        height: 800,
        deviceScaleFactor: 2,
        isMobile: false,
        userAgent: undefined
    },
    mobile: {
        width: 375,
        height: 812,
        deviceScaleFactor: 3,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version 16.0 Mobile/15E148 Safari/604.1'
    }
};

interface DetectedSection {
    index: number;
    startY: number;
    endY: number;
    height: number;
    label: string;
}

interface DetectSectionsResponse {
    success: boolean;
    screenshotBase64?: string;
    pageHeight: number;
    pageWidth: number;
    sections: DetectedSection[];
    error?: string;
}

// デフォルトの均等分割（フォールバック用）
function createDefaultSections(pageHeight: number, segmentHeight: number = 1600): DetectedSection[] {
    const numSegments = Math.min(Math.ceil(pageHeight / segmentHeight), 10);
    const sections: DetectedSection[] = [];

    for (let i = 0; i < numSegments; i++) {
        const startY = i * segmentHeight;
        const endY = Math.min((i + 1) * segmentHeight, pageHeight);
        sections.push({
            index: i,
            startY,
            endY,
            height: endY - startY,
            label: i === 0 ? 'ヘッダー・ヒーロー' : i === numSegments - 1 ? 'フッター' : `セクション ${i + 1}`
        });
    }

    return sections;
}

// Gemini Vision APIでセクション検出
async function detectSectionsWithAI(
    screenshotBuffer: Buffer,
    pageHeight: number,
    pageWidth: number,
    apiKey: string
): Promise<DetectedSection[]> {
    log.info('Starting AI-powered section detection with Gemini Vision...');

    const base64Image = screenshotBuffer.toString('base64');

    const prompt = `あなたはランディングページ（LP）の構造分析エキスパートです。
この画像はウェブページの全体スクリーンショットです。

【重要な指示】
このページをセマンティック（意味のある単位）で分割してください。

分割の絶対ルール：
1. 表（テーブル）は絶対に途中で切らない - 表全体を1つのセクションに含める
2. 料金プラン・価格比較は絶対に途中で切らない - 全プランを1つのセクションに
3. カード型レイアウト（3カラム、4カラム等）は途中で切らない
4. リスト・箇条書きは途中で切らない
5. FAQ・Q&Aは全体を1つのセクションに
6. お客様の声・レビューは全体を1つのセクションに
7. フォームは全体を1つのセクションに

典型的なLPセクション：
- ヘッダー/ナビゲーション
- ヒーローセクション（メインビジュアル、キャッチコピー）
- 特徴・メリット紹介
- サービス内容
- 料金プラン
- 導入事例・実績
- お客様の声
- よくある質問（FAQ）
- CTA（お問い合わせ・申し込み）
- 会社概要
- フッター

【出力形式】
以下のJSON形式で出力してください。他の文字は一切出力しないでください。

{
  "sections": [
    {
      "startY": 0,
      "endY": 800,
      "label": "ヘッダー・ヒーロー"
    },
    {
      "startY": 800,
      "endY": 1600,
      "label": "特徴・メリット"
    }
  ]
}

注意：
- startY, endYはピクセル単位（この画像の高さは${pageHeight}px）
- 各セクションは隙間なく連続すること（前のendY = 次のstartY）
- 最初のstartYは0、最後のendYは${pageHeight}
- セクション数は3〜15程度が適切
- labelは日本語で内容を簡潔に表現`;

    try {
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
                                inline_data: {
                                    mime_type: 'image/jpeg',
                                    data: base64Image
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 4096,
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            log.error(`Gemini API error: ${response.status} - ${errorText}`);
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textContent) {
            throw new Error('No response from Gemini');
        }

        log.info(`Gemini response received, parsing...`);

        // JSONを抽出（余分なテキストを除去）
        let jsonStr = textContent;
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);

        if (!parsed.sections || !Array.isArray(parsed.sections)) {
            throw new Error('Invalid response format: no sections array');
        }

        // セクションを整形
        const sections: DetectedSection[] = parsed.sections.map((s: any, idx: number) => ({
            index: idx,
            startY: Math.round(s.startY),
            endY: Math.round(s.endY),
            height: Math.round(s.endY - s.startY),
            label: s.label || `セクション ${idx + 1}`
        }));

        // 検証：連続性チェック
        for (let i = 1; i < sections.length; i++) {
            if (sections[i].startY !== sections[i - 1].endY) {
                log.warn(`Gap detected between section ${i - 1} and ${i}, fixing...`);
                sections[i].startY = sections[i - 1].endY;
                sections[i].height = sections[i].endY - sections[i].startY;
            }
        }

        // 最初と最後を調整
        if (sections.length > 0) {
            sections[0].startY = 0;
            sections[0].height = sections[0].endY - sections[0].startY;
            sections[sections.length - 1].endY = pageHeight;
            sections[sections.length - 1].height = sections[sections.length - 1].endY - sections[sections.length - 1].startY;
        }

        log.success(`AI detected ${sections.length} semantic sections`);
        sections.forEach((s, i) => {
            log.info(`  Section ${i + 1}: ${s.label} (${s.startY}-${s.endY}, ${s.height}px)`);
        });

        return sections;

    } catch (error: any) {
        log.error(`AI section detection failed: ${error.message}`);
        throw error;
    }
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { url, device = 'desktop' } = body;

        if (!url) {
            return Response.json({ error: 'URL is required' }, { status: 400 });
        }

        log.info(`========== Starting Section Detection ==========`);
        log.info(`URL: ${url}, Device: ${device}`);

        const deviceConfig = DEVICE_PRESETS[device as keyof typeof DEVICE_PRESETS] || DEVICE_PRESETS.desktop;

        // Launch Puppeteer
        log.info('Launching Puppeteer...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();

        await page.setViewport({
            width: deviceConfig.width,
            height: deviceConfig.height,
            deviceScaleFactor: deviceConfig.deviceScaleFactor,
            isMobile: deviceConfig.isMobile,
            hasTouch: deviceConfig.isMobile
        });

        if (deviceConfig.userAgent) {
            await page.setUserAgent(deviceConfig.userAgent);
        }

        // Navigate to URL
        log.info('Navigating to URL...');
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for content to load
        await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 }).catch(() => { });

        // Scroll to load lazy content
        log.info('Loading lazy content...');
        await page.evaluate(async () => {
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            for (let i = 0; i < 3; i++) {
                window.scrollTo(0, (i + 1) * (document.body.scrollHeight / 3));
                await delay(500);
            }
            window.scrollTo(0, 0);
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get page dimensions
        const dimensions = await page.evaluate(() => ({
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight
        }));

        log.info(`Page dimensions: ${dimensions.width}x${dimensions.height}px`);

        // Take full page screenshot using viewport stitching
        log.info('Taking full page screenshot...');

        const viewportHeight = deviceConfig.height;
        const numCaptures = Math.ceil(dimensions.height / viewportHeight);
        const screenshots: Buffer[] = [];

        for (let i = 0; i < numCaptures; i++) {
            await page.evaluate((scrollY) => window.scrollTo(0, scrollY), i * viewportHeight);
            await new Promise(resolve => setTimeout(resolve, 200));
            const screenshot = await page.screenshot({ type: 'png' }) as Buffer;
            screenshots.push(screenshot);
        }

        await browser.close();

        // Stitch screenshots
        log.info('Stitching screenshots...');
        const fullWidth = deviceConfig.width * deviceConfig.deviceScaleFactor;
        const fullHeight = dimensions.height * deviceConfig.deviceScaleFactor;

        const compositeOperations = await Promise.all(
            screenshots.map(async (buf, i) => {
                const meta = await sharp(buf).metadata();
                const top = i * viewportHeight * deviceConfig.deviceScaleFactor;
                const actualHeight = Math.min(
                    meta.height || viewportHeight * deviceConfig.deviceScaleFactor,
                    fullHeight - top
                );
                return {
                    input: await sharp(buf).extract({ left: 0, top: 0, width: meta.width!, height: actualHeight }).toBuffer(),
                    left: 0,
                    top
                };
            })
        );

        const fullScreenshot = await sharp({
            create: {
                width: fullWidth,
                height: fullHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        })
            .composite(compositeOperations)
            .png()
            .toBuffer();

        // Create preview image for the response (smaller for faster transfer)
        const previewScreenshot = await sharp(fullScreenshot)
            .resize({ width: 600, withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

        // AI画像認識でセクション検出を試みる
        let sections: DetectedSection[];

        // ユーザーのGoogle APIキーを取得
        const userSettings = await prisma.userSettings.findUnique({
            where: { userId: user.id }
        });

        const apiKey = userSettings?.googleApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

        if (apiKey) {
            try {
                log.info('Attempting AI-powered section detection...');

                // AI認識用の画像を作成（解像度を調整してAPI制限に収める）
                const aiScreenshot = await sharp(fullScreenshot)
                    .resize({ width: 1200, withoutEnlargement: true })
                    .jpeg({ quality: 90 })
                    .toBuffer();

                sections = await detectSectionsWithAI(
                    aiScreenshot,
                    dimensions.height,
                    dimensions.width,
                    apiKey
                );

                log.success(`AI detection successful: ${sections.length} semantic sections detected`);
            } catch (aiError: any) {
                log.warn(`AI detection failed, falling back to default sections: ${aiError.message}`);
                sections = createDefaultSections(dimensions.height);
            }
        } else {
            log.warn('No API key available, using default section division');
            sections = createDefaultSections(dimensions.height);
        }

        const response: DetectSectionsResponse = {
            success: true,
            screenshotBase64: previewScreenshot.toString('base64'),
            pageHeight: dimensions.height,
            pageWidth: dimensions.width,
            sections
        };

        log.success(`Detection complete: ${sections.length} sections created`);

        return Response.json(response);

    } catch (error: any) {
        log.error(`Detection failed: ${error.message}`);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
