import { NextRequest } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { prisma } from '@/lib/db';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { importUrlSchema, validateRequest } from '@/lib/validations';
import { checkGenerationLimit, recordApiUsage } from '@/lib/usage';
import {
    generateDesignTokens,
    extractDesignTokensFromImage,
    tokensToPromptDescription,
} from '@/lib/design-tokens';
import { DesignTokens } from '@/types';

// カラーログ
const log = {
    info: (msg: string) => console.log(`\x1b[36m[IMPORT-URL INFO]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[IMPORT-URL SUCCESS]\x1b[0m ✓ ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[IMPORT-URL ERROR]\x1b[0m ✗ ${msg}`),
};

// スタイル定義（日本語で具体的なデザイン指示）
const STYLE_DESCRIPTIONS: Record<string, string> = {
    sampling: '元デザイン維持：色、フォント、ボタン形状、装飾など元のデザインのスタイルをそのまま維持。テキストの書き換えと軽微なレイアウト調整のみ行う',
    professional: '企業・信頼感スタイル：ネイビーブルー(#1E3A5F)と白を基調、クリーンなゴシック体、控えめなシャドウ、角丸の長方形ボタン、プロフェッショナルな印象',
    pops: 'ポップ・活気スタイル：明るいグラデーション（ピンク→オレンジ、シアン→パープル）、丸みのある形状、太字フォント、楽しいアイコン、若々しく元気な印象',
    luxury: '高級・エレガントスタイル：黒とゴールド(#D4AF37)を基調、明朝体、細くエレガントなライン、贅沢な余白、上質なテクスチャ、洗練された高級感',
    minimal: 'ミニマル・シンプルスタイル：モノクロ+単一アクセントカラー、最大限の余白、細い軽量フォント、シンプルな幾何学形状、装飾なし、禅のようなシンプルさ',
    emotional: '情熱・エネルギースタイル：暖色系（深紅#C41E3A、オレンジ）、強いコントラスト、インパクトのある大きな文字、ダイナミックな斜め要素、緊急性とエネルギー',
};

// カラースキーム定義（具体的なカラーコード付き）
const COLOR_SCHEME_DESCRIPTIONS: Record<string, string> = {
    original: '',
    blue: 'カラー変更：メイン=#3B82F6、サブ=#1E40AF、アクセント=#60A5FA、背景=#F0F9FF。すべての色をこのブルー系パレットに置き換えてください。',
    green: 'カラー変更：メイン=#22C55E、サブ=#15803D、アクセント=#86EFAC、背景=#F0FDF4。すべての色をこのグリーン系パレットに置き換えてください。',
    purple: 'カラー変更：メイン=#A855F7、サブ=#7C3AED、アクセント=#C4B5FD、背景=#FAF5FF。すべての色をこのパープル系パレットに置き換えてください。',
    orange: 'カラー変更：メイン=#F97316、サブ=#EA580C、アクセント=#FDBA74、背景=#FFF7ED。すべての色をこのオレンジ系パレットに置き換えてください。',
    monochrome: 'カラー変更：黒(#000000)、白(#FFFFFF)、グレー(#374151, #6B7280, #9CA3AF, #E5E7EB)のみ使用。他の色は禁止。',
};

// レイアウトオプション定義（具体的な数値指示付き）
const LAYOUT_DESCRIPTIONS: Record<string, string> = {
    keep: '',
    modernize: 'レイアウト調整：余白を50%増加、セクション間にゆとりを追加、大きめのマージン。モダンで開放的な印象に。',
    compact: 'レイアウト調整：余白を30%削減、要素間を詰める、スクロールなしでより多くのコンテンツを表示。情報密度を高く。',
};

// デバイスプリセット（高解像度対応）
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
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    }
};

// デザインオプションの型定義
interface DesignOptions {
    style: string;
    colorScheme?: string;
    layoutOption?: string;
    customPrompt?: string;
    designTokens?: DesignTokens;  // 事前生成されたデザイントークン
}

// AI画像変換処理
async function processImageWithAI(
    imageBuffer: Buffer,
    importMode: 'light' | 'heavy',
    designOptions: DesignOptions,
    segmentIndex: number,
    totalSegments: number,
    apiKey: string,
    userId: string | null,
    skipCreditConsumption: boolean,
    styleReferenceImage?: Buffer  // 最初のセグメントの結果を参照として渡す
): Promise<Buffer | null> {
    const startTime = createTimer();
    const { style, colorScheme, layoutOption, customPrompt, designTokens } = designOptions;
    const styleDesc = STYLE_DESCRIPTIONS[style] || STYLE_DESCRIPTIONS.professional;
    const colorDesc = colorScheme ? COLOR_SCHEME_DESCRIPTIONS[colorScheme] || '' : '';
    // lightモードではレイアウト固定なのでlayoutOptionは無視
    const layoutDesc = (importMode === 'heavy' && layoutOption) ? LAYOUT_DESCRIPTIONS[layoutOption] || '' : '';

    // デザイントークンがある場合は詳細なスタイル指示を生成
    const tokenDescription = designTokens ? tokensToPromptDescription(designTokens) : '';

    // カスタムプロンプトとオプションを組み合わせる
    const additionalInstructions = [
        tokenDescription,  // デザイントークンを最優先で含める
        colorDesc,
        layoutDesc,
        customPrompt ? `ユーザー指示：${customPrompt}` : ''
    ].filter(Boolean).join('\n\n');

    // セグメント位置と役割の定義（セグメント独立処理のため詳細に）
    const segmentInfo = segmentIndex === 0
        ? { position: 'ヘッダー・ヒーローセクション', role: 'ナビゲーション、ロゴ、メインビジュアル、キャッチコピーを含む最重要セクション' }
        : segmentIndex === totalSegments - 1
            ? { position: 'フッターセクション', role: 'CTA、問い合わせ、著作権表示などページの締めくくり' }
            : { position: `コンテンツセクション（${segmentIndex + 1}/${totalSegments}）`, role: '商品説明、特徴、お客様の声などの本文コンテンツ' };

    // samplingモードの場合は特別に厳格なプロンプト
    const isSamplingMode = style === 'sampling';

    // 参照画像がある場合（2番目以降のセグメント）は一貫性指示を追加
    // ただしsamplingモードでは元画像の忠実な再現が目的なので、参照画像は使用しない
    const hasStyleReference = !isSamplingMode && styleReferenceImage && segmentIndex > 0;
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

    const prompt = importMode === 'light'
        ? (isSamplingMode
            ? `この画像をほぼそのまま再現してください。

【最重要】入力画像を可能な限り忠実にコピーしてください。

【セグメント情報】
- 位置：${segmentInfo.position}（全${totalSegments}セグメント中）
- 役割：${segmentInfo.role}

【許可される変更】
- テキストの言い回しのみ微調整（例：「詳しくはこちら」→「もっと見る」）

【禁止事項】
- 色の変更禁止
- レイアウトの変更禁止
- フォントの変更禁止
- 要素の追加・削除禁止
- 背景の変更禁止

${tokenDescription ? `【元画像から抽出したデザイン情報 - 必ず維持】\n${tokenDescription}` : ''}

【出力】入力画像とほぼ同一の画像を出力。テキストの言い回しのみ変更可。`
            : `あなたはプロのWebデザイナーです。Webページの一部分（セグメント画像）を新しいスタイルに変換してください。

${styleReferenceInstruction}【重要】この画像はページ全体の一部分です。他のセグメントと結合されるため、以下を厳守してください。

【セグメント情報】
- 位置：${segmentInfo.position}（全${totalSegments}セグメント中）
- 役割：${segmentInfo.role}

【絶対厳守ルール】
1. 画像サイズ維持：入力画像と完全に同じ縦横比・解像度で出力する
2. レイアウト固定：要素の位置、サイズ、間隔は1ピクセルも変えない
3. 上下の端：他セグメントと繋がるため、背景色やパターンが途切れないようにする

【スタイル変更ルール】
4. 適用スタイル：${styleDesc}
5. テキスト書き換え：意味を保ち言い回しを変える（例：「今すぐ始める」→「スタートする」）

${additionalInstructions}

【出力】入力と同じサイズの高品質なWebデザイン画像を出力。`)
        : `あなたはクリエイティブなWebデザイナーです。Webページの一部分（セグメント画像）を参考に新しいデザインを作成してください。

${styleReferenceInstruction}【重要】この画像はページ全体の一部分です。他のセグメントと結合されるため、以下を厳守してください。

【セグメント情報】
- 位置：${segmentInfo.position}（全${totalSegments}セグメント中）
- 役割：${segmentInfo.role}

【絶対厳守ルール】
1. 画像サイズ維持：入力画像と完全に同じ縦横比・解像度で出力する
2. 上下の端：他セグメントと繋がるため、背景色が途切れないようにする
3. 横幅いっぱい：左右の余白を統一し、コンテンツ幅を揃える

【デザイン変更ルール】
4. 新スタイル：${styleDesc}
5. レイアウト再構成：要素の配置は自由に変更してよいが、セクションの役割は維持
6. テキスト書き換え：意味を保ち新鮮な言い回しに変更

${additionalInstructions}

【出力】入力と同じサイズの高品質なWebデザイン画像を出力。`;

    log.info(`[AI] Processing segment ${segmentIndex + 1} with ${importMode} mode, style: ${style}${hasStyleReference ? ' (with style reference)' : ''}`);

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
                        // 温度設定の最適化（一貫性重視）
                        // sampling: 0.1（最小 - 忠実度重視）
                        // light: 0.15（低 - レイアウト固定、スタイルのみ変更）
                        // heavy: 0.4（中程度 - デザイン変更しつつ一貫性維持）
                        // 参照画像がある場合はさらに低めに設定して一貫性を高める
                        temperature: isSamplingMode ? 0.1 : hasStyleReference ? 0.1 : (importMode === 'heavy' ? 0.35 : 0.15)
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

                const logResult = await logGeneration({
                    userId,
                    type: 'import-arrange',
                    endpoint: '/api/import-url',
                    model: 'gemini-3-pro-image-preview',
                    inputPrompt: prompt,
                    imageCount: 1,
                    status: 'succeeded',
                    startTime
                });

                // クレジット消費（自分のAPIキー使用時はスキップ）
                if (logResult && userId && !skipCreditConsumption) {
                    await recordApiUsage(userId, logResult.id, logResult.estimatedCost, {
                        model: 'gemini-3-pro-image-preview',
                        imageCount: 1,
                    });
                    log.info(`[AI] Credit consumed: $${logResult.estimatedCost.toFixed(6)}`);
                }

                return Buffer.from(part.inlineData.data, 'base64');
            }
        }

        log.error(`[AI] No image data in response for segment ${segmentIndex + 1}`);
        return null;

    } catch (error: any) {
        log.error(`[AI] Error processing segment ${segmentIndex + 1}: ${error.message}`);

        await logGeneration({
            userId,
            type: 'import-arrange',
            endpoint: '/api/import-url',
            model: 'gemini-3-pro-image-preview',
            inputPrompt: prompt,
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

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
                console.error('[IMPORT-URL STREAM ERROR]', error);
                try {
                    send({ type: 'error', error: error.message });
                } catch (sendError) {
                    console.error('[IMPORT-URL] Failed to send error:', sendError);
                }
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

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 使用量制限チェック（開発環境ではスキップ可能）
    log.info(`Checking generation limit for user: ${user.id}`);
    const isDev = process.env.NODE_ENV === 'development';
    const limitCheck = isDev
        ? { allowed: true, skipCreditConsumption: true }
        : await checkGenerationLimit(user.id);

    if (!limitCheck.allowed) {
        // FreeプランでAPIキー未設定の場合
        if (limitCheck.needApiKey) {
            log.error(`[LIMIT] API key required for user ${user.id}`);
            console.error('[IMPORT-URL] 402 Error: API key required', { userId: user.id, reason: limitCheck.reason });
            return Response.json({
                error: 'API_KEY_REQUIRED',
                message: limitCheck.reason || 'Freeプランでは自分のGoogle AI APIキーの設定が必要です。設定画面でAPIキーを入力してください。',
                needApiKey: true,
            }, { status: 402 });
        }

        // クレジット不足の場合
        if (limitCheck.needPurchase) {
            log.error(`[LIMIT] Credit insufficient for user ${user.id}: balance=$${limitCheck.currentBalanceUsd?.toFixed(4)}`);
            console.error('[IMPORT-URL] 429 Error: Credit insufficient', {
                userId: user.id,
                balance: limitCheck.currentBalanceUsd,
                reason: limitCheck.reason
            });
            return Response.json({
                error: 'CREDIT_INSUFFICIENT',
                message: limitCheck.reason || `クレジットが不足しています。現在の残高: $${limitCheck.currentBalanceUsd?.toFixed(2) || '0.00'}`,
                needPurchase: true,
                currentBalanceUsd: limitCheck.currentBalanceUsd,
            }, { status: 429 });
        }

        // サブスクリプションが必要な場合
        if (limitCheck.needSubscription) {
            log.error(`[LIMIT] Subscription required for user ${user.id}`);
            console.error('[IMPORT-URL] 429 Error: Subscription required', { userId: user.id, reason: limitCheck.reason });
            return Response.json({
                error: 'SUBSCRIPTION_REQUIRED',
                message: limitCheck.reason || 'サブスクリプションが必要です。プランを選択してください。',
                needSubscription: true,
            }, { status: 429 });
        }

        // その他の制限
        log.error(`[LIMIT] Usage limit exceeded for user ${user.id}: ${limitCheck.reason}`);
        console.error('[IMPORT-URL] 429 Error: Usage limit exceeded', {
            userId: user.id,
            reason: limitCheck.reason,
            current: limitCheck.current,
            limit: limitCheck.limit
        });
        return Response.json({
            error: 'USAGE_LIMIT_EXCEEDED',
            message: limitCheck.reason || '使用量制限に達しました。',
            usage: {
                current: limitCheck.current,
                limit: limitCheck.limit,
            }
        }, { status: 429 });
    }

    log.success(`Limit check passed for user ${user.id}`);
    if (limitCheck.usingOwnApiKey) {
        log.info(`Using user's own API key (credit consumption skipped)`);
    } else {
        log.info(`Using system API key, balance: $${limitCheck.currentBalanceUsd?.toFixed(4) || 'N/A'}`);
    }

    const body = await request.json();

    // Validate input
    const validation = validateRequest(importUrlSchema, body);
    if (!validation.success) {
        return Response.json({
            error: validation.error,
            details: validation.details
        }, { status: 400 });
    }

    const {
        url,
        device = 'desktop',
        importMode = 'faithful',
        style = 'sampling',  // デフォルトは元デザイン維持
        colorScheme,
        layoutOption,
        customPrompt,
        customSections,  // ユーザーが調整したセクション境界
        startFrom = 0,   // 開始セクション番号（続きを取得用）
    } = validation.data;

    // デザインオプションをまとめる
    const designOptions: DesignOptions = {
        style,
        colorScheme,
        layoutOption,
        customPrompt,
    };

    // ストリーミングレスポンスを返す
    return createStreamResponse(async (send) => {
        log.info(`========== Starting URL Import ==========`);
        log.info(`URL: ${url}, Mode: ${importMode}, Device: ${device}`);
        if (importMode !== 'faithful') {
            log.info(`Design Options: Style=${style}, Color=${colorScheme || 'original'}, Layout=${layoutOption || 'keep'}`);
            if (customPrompt) {
                log.info(`Custom Prompt: ${customPrompt.substring(0, 100)}${customPrompt.length > 100 ? '...' : ''}`);
            }
        }

        send({ type: 'progress', step: 'init', message: 'インポートを開始しています...' });

        const deviceConfig = DEVICE_PRESETS[device as keyof typeof DEVICE_PRESETS] || DEVICE_PRESETS.desktop;

        // 1. Launch Puppeteer
        send({ type: 'progress', step: 'browser', message: 'ブラウザを起動中...' });
        log.info('Launching Puppeteer...');

        // 環境に応じてChromiumパスを設定
        const isDev = process.env.NODE_ENV === 'development';
        let executablePath: string;
        let launchArgs: string[];

        if (isDev) {
            // ローカル開発環境: システムのGoogle Chromeを使用
            executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            launchArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
            log.info('Using local Chrome for development');
        } else {
            // 本番環境: @sparticuz/chromiumを使用（メモリ最適化）
            executablePath = await chromium.executablePath();
            launchArgs = [
                ...chromium.args,
                '--disable-dev-shm-usage', // /dev/shm使用を無効化（メモリ節約）
                '--disable-gpu', // GPU無効化
                '--single-process', // シングルプロセスモード
                '--no-zygote', // Zygoteプロセス無効化
            ];
            log.info(`Using serverless Chromium: ${executablePath}`);
        }

        let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
        try {
            browser = await puppeteer.launch({
                args: launchArgs,
                executablePath,
                headless: true,
                protocolTimeout: 30000, // プロトコルタイムアウトを30秒に設定
            });
        } catch (launchError: any) {
            log.error(`Failed to launch browser: ${launchError.message}`);
            throw new Error(`ブラウザの起動に失敗しました: ${launchError.message}`);
        }

        // ブラウザ操作で使う変数を外部スコープで宣言
        let viewportHeight = 0;
        let viewportWidth = 0;
        let numCaptures = 0;
        let viewportBuffers: Buffer[] = [];
        let hasMore = false;  // 続きがあるかどうか
        let nextStartFrom = 0;  // 次の開始位置

        try {
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
        send({ type: 'progress', step: 'navigate', message: 'ページを読み込み中...' });
        log.info('Navigating to URL...');
        // 本番環境では短いタイムアウト＆早めの完了条件を使用（Renderの30秒制限対策）
        const navigationTimeout = isDev ? 60000 : 25000;
        const waitUntilOption = isDev ? 'networkidle2' : 'domcontentloaded';
        try {
            await page.goto(url, { waitUntil: waitUntilOption as any, timeout: navigationTimeout });
        } catch (navError: any) {
            // タイムアウトでも続行を試みる（一部コンテンツは読み込まれている可能性）
            if (navError.message?.includes('timeout')) {
                log.info('Navigation timeout, but continuing with partial content...');
            } else {
                throw navError;
            }
        }

        // Scroll to trigger lazy loading (本番環境では高速化のため軽量化)
        send({ type: 'progress', step: 'scroll', message: 'コンテンツを読み込み中...' });

        if (isDev) {
            // 開発環境：しっかりスクロール
            for (let pass = 0; pass < 3; pass++) {
                log.info(`Scroll pass ${pass + 1}/3 starting...`);

                await page.evaluate(async () => {
                    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
                    const scrollStep = 800;

                    let maxScroll = Math.max(
                        document.body.scrollHeight,
                        document.documentElement.scrollHeight
                    );

                    for (let y = 0; y < maxScroll; y += scrollStep) {
                        window.scrollTo(0, y);
                        await delay(30);

                        const newHeight = Math.max(
                            document.body.scrollHeight,
                            document.documentElement.scrollHeight
                        );
                        if (newHeight > maxScroll) maxScroll = newHeight;
                    }

                    window.scrollTo(0, maxScroll);
                    await delay(100);
                });

                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } else {
            // 本番環境：高速スクロール（タイムアウト対策）
            log.info('Quick scroll for production...');
            try {
                await page.evaluate(async () => {
                    const scrollStep = 2000; // 大きなステップで高速スクロール
                    const maxScroll = Math.max(
                        document.body.scrollHeight,
                        document.documentElement.scrollHeight
                    );

                    // 3回だけジャンプしてlazy loadをトリガー
                    const positions = [0, maxScroll * 0.33, maxScroll * 0.66, maxScroll];
                    for (const y of positions) {
                        window.scrollTo(0, y);
                        await new Promise(r => setTimeout(r, 50));
                    }
                    window.scrollTo(0, 0);
                });
            } catch (scrollError: any) {
                log.info(`Scroll skipped due to timeout: ${scrollError.message}`);
            }
        }

        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise(resolve => setTimeout(resolve, 300));

        // Force load ALL images (including lazy-loaded ones)
        log.info('Force loading all images...');
        try {
            await page.evaluate(async () => {
                // 1. Force lazy images to load by removing lazy attributes
                const lazyImages = document.querySelectorAll('img[loading="lazy"], img[data-src], img[data-lazy]');
                lazyImages.forEach(img => {
                    const imgEl = img as HTMLImageElement;
                    if (imgEl.dataset.src) {
                        imgEl.src = imgEl.dataset.src;
                    }
                    if (imgEl.dataset.lazy) {
                        imgEl.src = imgEl.dataset.lazy;
                    }
                    imgEl.removeAttribute('loading');
                    imgEl.loading = 'eager';
                });

                // 2. Force all images to load (with shorter timeout for production)
                const allImages = Array.from(document.querySelectorAll('img'));
                const imageTimeout = 2000; // 2秒タイムアウト

                await Promise.all(allImages.slice(0, 30).map(img => { // 最大30枚に制限
                    if (img.complete && img.naturalHeight > 0) return Promise.resolve();
                    return new Promise((resolve) => {
                        img.onload = () => resolve(undefined);
                        img.onerror = resolve;
                        setTimeout(resolve, imageTimeout);
                    });
                }));
            });
        } catch (imgError: any) {
            log.info(`Image loading skipped due to timeout: ${imgError.message}`);
        }

        log.info('Images loaded, waiting for render...');
        await new Promise(resolve => setTimeout(resolve, isDev ? 2000 : 500)); // 本番は短く

        // Remove popups - LESS AGGRESSIVE to avoid removing legitimate content
        log.info('Removing popups...');
        await page.evaluate(() => {
            // Only target very specific popup/modal patterns
            const modalSelectors = [
                '[class*="cookie"]', '[class*="Cookie"]',
                '[class*="consent"]', '[class*="gdpr"]', '[class*="GDPR"]',
                '[role="dialog"]', '[role="alertdialog"]',
                '[class*="newsletter-popup"]', '[class*="subscribe-popup"]',
                '[id*="cookie"]', '[id*="consent"]',
            ];

            modalSelectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(el => {
                        const element = el as HTMLElement;
                        const computedStyle = window.getComputedStyle(element);
                        const zIndex = parseInt(computedStyle.zIndex) || 0;
                        // Only remove if it's a high z-index overlay (likely a popup)
                        if (zIndex > 1000) {
                            console.log(`[IMPORT] Removing popup: ${element.tagName}.${element.className}`);
                            element.remove();
                        }
                    });
                } catch (e) { }
            });

            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        // Fix fixed/sticky elements for proper fullPage screenshot
        // These elements repeat at every viewport position, corrupting the final image
        log.info('Disabling fixed/sticky elements to prevent repetition...');
        await page.evaluate(() => {
            // Collect ALL fixed/sticky elements in document order
            const fixedElements: HTMLElement[] = [];
            const allElements = document.querySelectorAll('*');

            allElements.forEach(el => {
                const element = el as HTMLElement;
                const computedStyle = window.getComputedStyle(element);
                const position = computedStyle.position;

                if (position === 'fixed' || position === 'sticky') {
                    fixedElements.push(element);
                }
            });

            console.log(`[IMPORT] Found ${fixedElements.length} fixed/sticky elements`);

            // COMPLETELY REMOVE fixed elements from DOM
            fixedElements.forEach((element) => {
                console.log(`[IMPORT] Removing from DOM: ${element.tagName}.${element.className}`);
                element.remove();
            });

            // Inject global CSS to hide any remaining fixed/sticky elements
            // This catches elements that might be dynamically added or have inline styles
            const style = document.createElement('style');
            style.id = 'import-fix-fixed';
            style.textContent = `
                [style*="position: fixed"],
                [style*="position:fixed"],
                [style*="position: sticky"],
                [style*="position:sticky"] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                }
            `;
            document.head.appendChild(style);
            console.log('[IMPORT] Injected global CSS to hide fixed elements');

            // Force body/html settings
            document.body.style.overflow = 'visible';
            document.body.style.overflowX = 'hidden';
            document.body.style.position = 'static';
            document.documentElement.style.overflow = 'visible';
            document.documentElement.style.overflowX = 'hidden';
            document.documentElement.style.position = 'static';
        });

        await new Promise(resolve => setTimeout(resolve, 300));

        // Take screenshots manually by scrolling viewport-by-viewport
        // This avoids Puppeteer's buggy fullPage implementation that repeats fixed elements
        send({ type: 'progress', step: 'screenshot', message: 'スクロールしながら撮影中...' });
        log.info('Taking manual viewport screenshots (avoiding fullPage bug)...');

        // Get full document height
        const documentHeight = await page.evaluate(() => {
            return Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.offsetHeight
            );
        });

        viewportHeight = deviceConfig.height * deviceConfig.deviceScaleFactor;
        viewportWidth = deviceConfig.width * deviceConfig.deviceScaleFactor;
        const totalCaptures = Math.ceil(documentHeight / deviceConfig.height);

        // 本番環境では1回あたりの撮影枚数を制限（タイムアウト対策）
        const maxCapturesPerRequest = isDev ? 100 : 10;

        // startFromが指定されている場合は、その位置から取得
        const startIndex = Math.min(startFrom, totalCaptures);
        const remainingCaptures = totalCaptures - startIndex;
        numCaptures = Math.min(remainingCaptures, maxCapturesPerRequest);

        log.info(`Document height: ${documentHeight}px, Viewport: ${deviceConfig.width}x${deviceConfig.height}`);
        log.info(`Total captures: ${totalCaptures}, Starting from: ${startIndex}, Capturing: ${numCaptures}`);

        // まだ続きがあるかどうかを計算
        hasMore = (startIndex + numCaptures) < totalCaptures;
        nextStartFrom = startIndex + numCaptures;

        viewportBuffers = [];

        for (let i = 0; i < numCaptures; i++) {
            const actualIndex = startIndex + i;
            const scrollY = actualIndex * deviceConfig.height;

            // Scroll to position
            await page.evaluate((y) => window.scrollTo(0, y), scrollY);
            await new Promise(resolve => setTimeout(resolve, 100));

            // Remove fixed elements AGAIN before each capture (in case JS re-added them)
            await page.evaluate(() => {
                const allElements = document.querySelectorAll('*');
                allElements.forEach(el => {
                    const element = el as HTMLElement;
                    const computedStyle = window.getComputedStyle(element);
                    if (computedStyle.position === 'fixed' || computedStyle.position === 'sticky') {
                        element.style.display = 'none';
                    }
                });
            });
            await new Promise(resolve => setTimeout(resolve, 100));

            // Take viewport screenshot
            const viewportShot = await page.screenshot({ fullPage: false }) as Buffer;
            viewportBuffers.push(viewportShot);

            log.info(`Captured viewport ${actualIndex + 1}/${totalCaptures} at scrollY=${scrollY}`);
        }

        // ブラウザ操作完了、すぐにクローズしてメモリを解放
        try {
            await browser.close();
            log.info('Browser closed successfully');
        } catch (closeError: any) {
            log.error(`Failed to close browser: ${closeError.message}`);
        }
        } catch (browserError: any) {
            // ブラウザ操作でエラーが発生した場合
            if (browser) {
                try {
                    await browser.close();
                    log.info('Browser closed after error');
                } catch (closeError: any) {
                    log.error(`Failed to close browser after error: ${closeError.message}`);
                }
            }
            throw browserError;
        }

        // Stitch all viewport screenshots together using sharp
        log.info('Stitching viewport screenshots...');
        const stitchedHeight = viewportHeight * numCaptures;

        const compositeOperations = viewportBuffers.map((buffer, index) => ({
            input: buffer,
            top: index * viewportHeight,
            left: 0
        }));

        const fullScreenshot = await sharp({
            create: {
                width: viewportWidth,
                height: stitchedHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        })
            .composite(compositeOperations)
            .png()
            .toBuffer();

        log.info('Stitching complete!');

        // Debug save
        const debugDir = '/tmp/import-debug';
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        fs.writeFileSync(path.join(debugDir, `full-${Date.now()}-${device}.png`), fullScreenshot);

        // Get metadata
        const metadata = await sharp(fullScreenshot).metadata();
        const height = metadata.height || 0;
        const width = metadata.width || 0;

        if (height === 0 || width === 0) {
            throw new Error('Screenshot failed: zero dimensions captured.');
        }

        log.info(`Final screenshot dimensions: ${width}x${height}px`);

        // ========================================
        // セグメント境界の決定
        // customSectionsがある場合はユーザー指定の境界を使用
        // ない場合は均等分割
        // ========================================
        interface SegmentBoundary {
            top: number;
            height: number;
            label: string;
        }

        let segments: SegmentBoundary[];

        if (customSections && customSections.length > 0) {
            // ユーザー指定の境界を使用（スケールファクターで調整）
            const scaleFactor = deviceConfig.deviceScaleFactor;
            segments = customSections.map(section => ({
                top: Math.round(section.startY * scaleFactor),
                height: Math.round(section.height * scaleFactor),
                label: section.label
            }));
            log.info(`Using custom sections: ${customSections.length} segments from user`);
        } else {
            // 従来の均等分割
            const baseSegmentHeight = 800;
            const segmentHeight = baseSegmentHeight * deviceConfig.deviceScaleFactor;
            const rawNumSegments = Math.ceil(height / segmentHeight);
            const numSegments = Math.min(rawNumSegments, 10);
            if (rawNumSegments > 10) {
                log.info(`Limiting segments from ${rawNumSegments} to 10 (AI processing limit)`);
            }

            segments = Array.from({ length: numSegments }, (_, i) => {
                const top = i * segmentHeight;
                const segHeight = Math.min(segmentHeight, height - top);
                return {
                    top,
                    height: segHeight,
                    label: i === 0 ? 'ヘッダー・ヒーロー' : i === numSegments - 1 ? 'フッター' : `セクション ${i + 1}`
                };
            });
        }

        // AI処理が重いため、最大10セグメントに制限
        if (segments.length > 10) {
            log.info(`Limiting segments from ${segments.length} to 10 (AI processing limit)`);
            segments = segments.slice(0, 10);
        }

        const numSegments = segments.length;
        const createdMedia: any[] = [];

        log.info(`Segmenting into ${numSegments} parts...`);
        log.info(`Segment breakdown: ${segments.map((s, i) => `[${i}] top=${s.top}px, h=${s.height}px`).join(', ')}`);

        // Get API key if needed
        let googleApiKey: string | null = null;
        if (importMode !== 'faithful') {
            googleApiKey = await getGoogleApiKeyForUser(user.id);
            if (!googleApiKey) {
                throw new Error('Google API key is not configured. アレンジモードを使用するには設定画面でAPIキーを設定してください。');
            }
            log.info(`AI processing enabled (mode: ${importMode}, style: ${style})`);
        }

        // ========================================
        // デザイントークン先行生成（一貫性保証）
        // ========================================
        //
        // 処理フロー:
        // - faithful: AI処理なし（スクショそのまま）
        // - sampling: AI処理あり（元デザイン維持、テキスト言い回しのみ変更）→ 元画像からトークン抽出
        // - それ以外: AI処理あり（スタイル変更）→ スタイル設定からトークン生成
        //
        let designTokens: DesignTokens | undefined;

        if (importMode !== 'faithful' && googleApiKey) {
            send({
                type: 'progress',
                step: 'tokens',
                message: 'デザイントークンを生成中...',
            });

            log.info('Generating design tokens for consistent styling...');

            if (style === 'sampling') {
                // samplingモード: 元画像からデザイントークンを抽出（元デザインを忠実に維持するため）
                log.info('Sampling mode: extracting tokens from original image...');
                const thumbnailBuffer = await sharp(fullScreenshot)
                    .resize({ width: 800, height: 800, fit: 'inside' })
                    .png()
                    .toBuffer();

                const extractResult = await extractDesignTokensFromImage(thumbnailBuffer, googleApiKey);
                if (extractResult.success && extractResult.tokens) {
                    designTokens = extractResult.tokens;
                    log.success('Design tokens extracted from original image');
                } else {
                    // 抽出失敗時はデフォルトトークンを使用
                    designTokens = generateDesignTokens('sampling', colorScheme, layoutOption);
                    log.info('Could not extract tokens from image, using default sampling tokens');
                }
            } else {
                // その他のスタイル: スタイル設定からトークンを生成
                designTokens = generateDesignTokens(style, colorScheme, layoutOption);
                log.info(`Base tokens generated from style: ${style}`);
            }

            // designOptionsにトークンを追加（全モードで使用）
            designOptions.designTokens = designTokens;
            log.success(`Design tokens ready: primary=${designTokens.colors.primary}, button=${designTokens.components.buttonStyle}`);
        }

        send({
            type: 'progress',
            step: 'segments',
            message: `${numSegments}個のセグメントを処理中...`,
            total: numSegments,
            current: 0
        });

        // ========================================
        // 参照画像方式：最初のセグメントの結果を保存
        // 後続セグメントに渡してスタイル一貫性を確保
        // ========================================
        let firstSegmentResult: Buffer | null = null;

        // Process each segment
        for (let i = 0; i < numSegments; i++) {
            const segment = segments[i];
            const top = segment.top;
            const currentSegHeight = segment.height;

            if (currentSegHeight <= 0) continue;

            // AI処理の判定
            // - faithful: スクショそのまま（AI処理なし）
            // - light/heavy + sampling: 元デザイン維持でテキスト言い回しのみ変更（AI処理あり）
            // - light/heavy + その他スタイル: スタイル変更（AI処理あり）
            const shouldProcessWithAI = importMode !== 'faithful' && googleApiKey;

            send({
                type: 'progress',
                step: 'processing',
                message: shouldProcessWithAI
                    ? `セグメント ${i + 1}/${numSegments} をAI処理中...${i > 0 && firstSegmentResult ? '（参照画像あり）' : ''}`
                    : `セグメント ${i + 1}/${numSegments} を保存中...`,
                total: numSegments,
                current: i + 1
            });

            log.info(`Segment ${i + 1}: extracting top=${top}, height=${currentSegHeight}`);

            let buffer = await sharp(fullScreenshot)
                .extract({ left: 0, top, width, height: currentSegHeight })
                .png()
                .toBuffer();

            // AI processing if needed
            if (shouldProcessWithAI && googleApiKey) {
                // 2番目以降のセグメントには最初のセグメントの結果を参照として渡す
                // ただしsamplingモードでは元画像の忠実な再現が目的なので、参照画像は使用しない
                const isSamplingMode = style === 'sampling';
                const styleReference = (!isSamplingMode && i > 0 && firstSegmentResult) ? firstSegmentResult : undefined;

                log.info(`Segment ${i + 1}: Applying AI transformation...${styleReference ? ' (with style reference from segment 1)' : ''}`);
                const aiBuffer = await processImageWithAI(
                    buffer,
                    importMode as 'light' | 'heavy',
                    designOptions,
                    i,
                    numSegments,
                    googleApiKey,
                    user.id,
                    limitCheck.skipCreditConsumption || false,
                    styleReference  // 参照画像を渡す
                );

                if (aiBuffer) {
                    buffer = aiBuffer;

                    // 最初のセグメントの結果を保存（後続セグメントの参照用）
                    // samplingモード以外の場合のみ
                    if (i === 0 && !isSamplingMode) {
                        firstSegmentResult = aiBuffer;
                        log.success(`Segment 1: Saved as style reference for subsequent segments`);
                    }

                    log.success(`Segment ${i + 1}: AI transformation complete`);
                } else {
                    log.error(`Segment ${i + 1}: AI transformation failed, using original`);
                }
            }

            // Upload to Supabase (use admin client to bypass RLS)
            log.info(`Segment ${i + 1}: Starting upload to Supabase...`);
            const filename = `import-${Date.now()}-seg-${i}.png`;

            const { error: uploadError } = await supabaseAdmin
                .storage
                .from('images')
                .upload(filename, buffer, {
                    contentType: 'image/png',
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                log.error(`Upload error for segment ${i}: ${uploadError.message}`);
                throw uploadError;
            }

            const { data: { publicUrl } } = supabaseAdmin
                .storage
                .from('images')
                .getPublicUrl(filename);

            const processedMeta = await sharp(buffer).metadata();
            const finalWidth = processedMeta.width || width;
            const finalHeight = processedMeta.height || currentSegHeight;

            const media = await prisma.mediaImage.create({
                data: {
                    filePath: publicUrl,
                    mime: 'image/png',
                    width: finalWidth,
                    height: finalHeight,
                    sourceUrl: url,
                    sourceType: importMode === 'faithful' ? 'import' : `import-${importMode}`,
                },
            });

            log.success(`Segment ${i + 1}/${numSegments} created → MediaImage ID: ${media.id} (order: ${createdMedia.length})`);
            createdMedia.push(media);
            log.info(`  → createdMedia now has ${createdMedia.length} items, IDs: [${createdMedia.map(m => m.id).join(', ')}]`);
        }

        log.info(`========== Import Complete ==========`);
        log.success(`Total segments: ${createdMedia.length}`);
        log.info(`Final media order: [${createdMedia.map((m, idx) => `${idx}:ID${m.id}`).join(', ')}]`);

        // Send final result
        send({
            type: 'complete',
            success: true,
            media: createdMedia,
            device,
            importMode,
            style,
            hasMore,
            nextStartFrom: hasMore ? nextStartFrom : null,
        });
    });
}
