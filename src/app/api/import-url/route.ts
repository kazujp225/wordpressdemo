import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// カラーログ
const log = {
    info: (msg: string) => console.log(`\x1b[36m[IMPORT-URL INFO]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[IMPORT-URL SUCCESS]\x1b[0m ✓ ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[IMPORT-URL ERROR]\x1b[0m ✗ ${msg}`),
};

// デバイスプリセット（高解像度対応）
const DEVICE_PRESETS = {
    desktop: {
        width: 1280,
        height: 800,
        deviceScaleFactor: 2, // Retina品質
        isMobile: false,
        userAgent: undefined
    },
    mobile: {
        width: 375,
        height: 812,
        deviceScaleFactor: 3, // iPhone Retina品質
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    }
};

export async function POST(request: NextRequest) {
    try {
        const { url, device = 'desktop' } = await request.json();

        log.info(`========== Starting URL Import ==========`);
        log.info(`URL: ${url}`);
        log.info(`Device: ${device}`);

        if (!url) {
            log.error('URL is required');
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        const deviceConfig = DEVICE_PRESETS[device as keyof typeof DEVICE_PRESETS] || DEVICE_PRESETS.desktop;

        // 1. Launch Puppeteer
        log.info('Launching Puppeteer...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();

        // Set viewport based on device selection (高解像度)
        await page.setViewport({
            width: deviceConfig.width,
            height: deviceConfig.height,
            deviceScaleFactor: deviceConfig.deviceScaleFactor,
            isMobile: deviceConfig.isMobile,
            hasTouch: deviceConfig.isMobile
        });

        // Set mobile user agent if needed
        if (deviceConfig.userAgent) {
            await page.setUserAgent(deviceConfig.userAgent);
        }

        // Go to URL
        log.info('Navigating to URL...');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // ページの実際の高さを取得
        const bodyHeight = await page.evaluate(() => {
            return Math.max(
                document.body.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.clientHeight,
                document.documentElement.scrollHeight,
                document.documentElement.offsetHeight
            );
        });
        log.info(`Page body height (before scroll): ${bodyHeight}px`);

        // 遅延読み込みコンテンツを強制ロードするためにページ全体をスクロール（複数回）
        log.info('Scrolling page to trigger lazy loading...');

        // 3回スクロールして確実にコンテンツをロード
        for (let pass = 0; pass < 3; pass++) {
            log.info(`Scroll pass ${pass + 1}/3 starting...`);

            const currentHeight = await page.evaluate(async () => {
                const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
                const scrollStep = 300;

                // 現在のページ高さを取得
                let maxScroll = Math.max(
                    document.body.scrollHeight,
                    document.documentElement.scrollHeight
                );

                // ゆっくりスクロールして遅延読み込みをトリガー
                for (let y = 0; y < maxScroll; y += scrollStep) {
                    window.scrollTo(0, y);
                    await delay(50);

                    // スクロール中に高さが変わった場合は更新
                    const newHeight = Math.max(
                        document.body.scrollHeight,
                        document.documentElement.scrollHeight
                    );
                    if (newHeight > maxScroll) {
                        maxScroll = newHeight;
                    }
                }

                // ページ末尾まで確実にスクロール
                window.scrollTo(0, maxScroll);
                await delay(300);

                return maxScroll;
            });

            log.info(`Scroll pass ${pass + 1}/3 complete: page height = ${currentHeight}px`);

            // パス間で待機してコンテンツ読み込み
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 先頭に戻る
        await page.evaluate(() => window.scrollTo(0, 0));

        // 追加の画像・コンテンツ読み込み待機
        await new Promise(resolve => setTimeout(resolve, 1500));

        // ポップアップ・モーダル・オーバーレイを削除
        log.info('Removing popups, modals, and overlays...');
        const removedCount = await page.evaluate(() => {
            let removed = 0;

            // 一般的なモーダル/ポップアップのセレクタ
            const modalSelectors = [
                // クラス名ベース
                '[class*="modal"]',
                '[class*="Modal"]',
                '[class*="popup"]',
                '[class*="Popup"]',
                '[class*="overlay"]',
                '[class*="Overlay"]',
                '[class*="dialog"]',
                '[class*="Dialog"]',
                '[class*="lightbox"]',
                '[class*="cookie"]',
                '[class*="Cookie"]',
                '[class*="banner"]',
                '[class*="consent"]',
                '[class*="gdpr"]',
                '[class*="newsletter"]',
                '[class*="subscribe"]',
                '[class*="notification"]',
                // IDベース
                '[id*="modal"]',
                '[id*="Modal"]',
                '[id*="popup"]',
                '[id*="Popup"]',
                '[id*="overlay"]',
                '[id*="cookie"]',
                '[id*="dialog"]',
                // 役割ベース
                '[role="dialog"]',
                '[role="alertdialog"]',
                // 固定位置の要素（ただしヘッダー/ナビゲーションは除外）
                'div[style*="position: fixed"]',
                'div[style*="position:fixed"]',
            ];

            // 各セレクタに一致する要素を削除
            modalSelectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(el => {
                        const element = el as HTMLElement;
                        const rect = element.getBoundingClientRect();
                        const computedStyle = window.getComputedStyle(element);

                        // ヘッダー（上部の細いバー）やナビゲーションは除外
                        const isHeader = rect.top < 100 && rect.height < 150;
                        const isNav = element.tagName === 'NAV' || element.tagName === 'HEADER';

                        // z-indexが高い要素（モーダルの特徴）
                        const zIndex = parseInt(computedStyle.zIndex) || 0;
                        const isHighZIndex = zIndex > 100;

                        // 画面の大部分を覆う要素
                        const coversScreen = rect.width > window.innerWidth * 0.5 && rect.height > window.innerHeight * 0.5;

                        // モーダルらしい特徴がある場合のみ削除
                        if (!isHeader && !isNav && (isHighZIndex || coversScreen)) {
                            element.remove();
                            removed++;
                        }
                    });
                } catch (e) {
                    // セレクタエラーは無視
                }
            });

            // bodyのoverflow:hiddenを解除（モーダル表示時によく設定される）
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';

            return removed;
        });
        log.info(`Removed ${removedCount} popup/modal elements`);

        // 削除後に少し待機
        await new Promise(resolve => setTimeout(resolve, 500));

        // スクロール後の高さを再取得
        const finalBodyHeight = await page.evaluate(() => {
            return Math.max(
                document.body.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.clientHeight,
                document.documentElement.scrollHeight,
                document.documentElement.offsetHeight
            );
        });
        log.info(`Page body height (after scroll): ${finalBodyHeight}px`);

        // 2. Take Full Page Screenshot
        log.info('Taking full page screenshot...');
        const fullScreenshot = await page.screenshot({ fullPage: true }) as Buffer;
        await browser.close();

        log.info(`Raw screenshot buffer size: ${fullScreenshot.length} bytes`);

        // デバッグ: フルスクリーンショットを一時保存
        const debugDir = '/tmp/import-debug';
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
        }
        const debugFullPath = path.join(debugDir, `full-${Date.now()}-${device}.png`);
        fs.writeFileSync(debugFullPath, fullScreenshot);
        log.info(`DEBUG: Full screenshot saved to ${debugFullPath}`);

        // 3. Segment the screenshot
        const metadata = await sharp(fullScreenshot).metadata();
        const height = metadata.height || 0;
        const width = metadata.width || 0;

        if (height === 0 || width === 0) {
            throw new Error('Screenshot failed: zero dimensions captured.');
        }

        log.info(`Screenshot dimensions: ${width}x${height}px`);
        log.info(`Screenshot format: ${metadata.format}, channels: ${metadata.channels}`);
        log.info(`Device scale factor: ${deviceConfig.deviceScaleFactor}`);

        // deviceScaleFactorを考慮したセグメント高さ（論理800pxに相当）
        const baseSegmentHeight = 800;
        const segmentHeight = baseSegmentHeight * deviceConfig.deviceScaleFactor;
        const numSegments = Math.ceil(height / segmentHeight);
        const createdMedia = [];

        log.info(`Segmenting into ${numSegments} parts (${segmentHeight}px each, ${baseSegmentHeight}px logical)...`);

        for (let i = 0; i < numSegments; i++) {
            const top = i * segmentHeight;
            const currentSegHeight = Math.min(segmentHeight, height - top);

            // Safety check for leftover pixels
            if (currentSegHeight <= 0) continue;

            log.info(`Segment ${i + 1}: extracting top=${top}, height=${currentSegHeight}`);

            const buffer = await sharp(fullScreenshot)
                .extract({ left: 0, top, width, height: currentSegHeight })
                .png()
                .toBuffer();

            log.info(`Segment ${i + 1}: buffer size = ${buffer.length} bytes`);

            const filename = `import-${Date.now()}-seg-${i}.png`;

            const { data: uploadData, error: uploadError } = await supabase
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

            const { data: { publicUrl } } = supabase
                .storage
                .from('images')
                .getPublicUrl(filename);

            const media = await prisma.mediaImage.create({
                data: {
                    filePath: publicUrl,
                    mime: 'image/png',
                    width,
                    height: currentSegHeight,
                    sourceUrl: url,
                    sourceType: 'import',
                },
            });
            log.success(`Segment ${i + 1}/${numSegments} created → MediaImage ID: ${media.id}`);
            createdMedia.push(media);
        }

        log.info(`========== Import Complete ==========`);
        log.success(`Total segments: ${createdMedia.length}`);
        log.info(`Media IDs: [${createdMedia.map(m => m.id).join(', ')}]`);

        return NextResponse.json({ success: true, media: createdMedia, device });

    } catch (error: any) {
        console.error('URL Screenshot Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
