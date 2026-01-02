import { NextRequest } from 'next/server';
import puppeteer, { Page } from 'puppeteer';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';

// Color logging
const log = {
    info: (msg: string) => console.log(`\x1b[36m[DUAL-SCREENSHOT INFO]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[DUAL-SCREENSHOT SUCCESS]\x1b[0m ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[DUAL-SCREENSHOT ERROR]\x1b[0m ${msg}`),
};

// Device presets
interface DeviceConfig {
    width: number;
    height: number;
    deviceScaleFactor: number;
    isMobile: boolean;
    userAgent?: string;
}

const DEVICE_PRESETS: { desktop: DeviceConfig; mobile: DeviceConfig } = {
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

// Streaming response encoder
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

// Helper: capture full page screenshot with manual scrolling
async function captureFullPage(
    page: Page,
    deviceConfig: DeviceConfig
): Promise<Buffer> {
    // Scroll to trigger lazy loading
    for (let pass = 0; pass < 3; pass++) {
        await page.evaluate(async () => {
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            const scrollStep = 300;
            let maxScroll = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

            for (let y = 0; y < maxScroll; y += scrollStep) {
                window.scrollTo(0, y);
                await delay(100);
                const newHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
                if (newHeight > maxScroll) maxScroll = newHeight;
            }
            window.scrollTo(0, maxScroll);
            await delay(500);
        });
        await new Promise(resolve => setTimeout(resolve, 800));
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Force load images
    await page.evaluate(async () => {
        const lazyImages = document.querySelectorAll('img[loading="lazy"], img[data-src], img[data-lazy]');
        lazyImages.forEach(img => {
            const imgEl = img as HTMLImageElement;
            if (imgEl.dataset.src) imgEl.src = imgEl.dataset.src;
            if (imgEl.dataset.lazy) imgEl.src = imgEl.dataset.lazy;
            imgEl.removeAttribute('loading');
            imgEl.loading = 'eager';
        });

        const allImages = Array.from(document.querySelectorAll('img'));
        await Promise.all(allImages.map(img => {
            if (img.complete && img.naturalHeight > 0) return Promise.resolve();
            return new Promise((resolve) => {
                img.onload = () => resolve(undefined);
                img.onerror = resolve;
                setTimeout(resolve, 5000);
            });
        }));
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Remove popups
    await page.evaluate(() => {
        const modalSelectors = [
            '[class*="cookie"]', '[class*="Cookie"]',
            '[class*="consent"]', '[class*="gdpr"]', '[class*="GDPR"]',
            '[role="dialog"]', '[role="alertdialog"]',
        ];
        modalSelectors.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    const element = el as HTMLElement;
                    const zIndex = parseInt(window.getComputedStyle(element).zIndex) || 0;
                    if (zIndex > 1000) element.remove();
                });
            } catch { }
        });
    });

    // Remove fixed/sticky elements
    await page.evaluate(() => {
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
            const element = el as HTMLElement;
            const position = window.getComputedStyle(element).position;
            if (position === 'fixed' || position === 'sticky') {
                element.remove();
            }
        });

        document.body.style.overflow = 'visible';
        document.body.style.overflowX = 'hidden';
        document.documentElement.style.overflow = 'visible';
        document.documentElement.style.overflowX = 'hidden';
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    // Manual viewport-by-viewport capture
    const documentHeight = await page.evaluate(() => {
        return Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight
        );
    });

    const viewportHeight = deviceConfig.height * deviceConfig.deviceScaleFactor;
    const viewportWidth = deviceConfig.width * deviceConfig.deviceScaleFactor;
    const numCaptures = Math.ceil(documentHeight / deviceConfig.height);

    const viewportBuffers: Buffer[] = [];

    for (let i = 0; i < numCaptures; i++) {
        const scrollY = i * deviceConfig.height;
        await page.evaluate((y: number) => window.scrollTo(0, y), scrollY);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Remove fixed elements again
        await page.evaluate(() => {
            document.querySelectorAll('*').forEach(el => {
                const element = el as HTMLElement;
                const position = window.getComputedStyle(element).position;
                if (position === 'fixed' || position === 'sticky') {
                    element.style.display = 'none';
                }
            });
        });
        await new Promise(resolve => setTimeout(resolve, 100));

        const viewportShot = await page.screenshot({ fullPage: false }) as Buffer;
        viewportBuffers.push(viewportShot);
    }

    // Stitch screenshots
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

    return fullScreenshot;
}

// Helper: segment and upload screenshots (parallelized)
async function segmentAndUpload(
    screenshot: Buffer,
    deviceType: 'desktop' | 'mobile',
    url: string,
    userId: string
): Promise<any[]> {
    const deviceConfig = DEVICE_PRESETS[deviceType];
    const metadata = await sharp(screenshot).metadata();
    const height = metadata.height || 0;
    const width = metadata.width || 0;

    const baseSegmentHeight = 800;
    const segmentHeight = baseSegmentHeight * deviceConfig.deviceScaleFactor;
    const numSegments = Math.ceil(height / segmentHeight);

    // セグメント情報を事前計算
    const segmentInfos: { top: number; height: number; index: number }[] = [];
    for (let i = 0; i < numSegments; i++) {
        const top = i * segmentHeight;
        const currentSegHeight = Math.min(segmentHeight, height - top);
        if (currentSegHeight > 0) {
            segmentInfos.push({ top, height: currentSegHeight, index: i });
        }
    }

    // 並列でセグメント処理（抽出 → アップロード → DB保存）
    const timestamp = Date.now();
    const uploadPromises = segmentInfos.map(async (seg) => {
        // 1. 画像を抽出
        const buffer = await sharp(screenshot)
            .extract({ left: 0, top: seg.top, width, height: seg.height })
            .png()
            .toBuffer();

        // 2. Supabaseにアップロード
        const filename = `dual-${deviceType}-${timestamp}-seg-${seg.index}.png`;
        const { error: uploadError } = await supabase
            .storage
            .from('images')
            .upload(filename, buffer, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            throw new Error(`セグメント${seg.index}のアップロード失敗: ${uploadError.message}`);
        }

        // 3. 公開URLを取得
        const { data: { publicUrl } } = supabase
            .storage
            .from('images')
            .getPublicUrl(filename);

        // 4. メタデータ取得
        const segMeta = await sharp(buffer).metadata();

        // 5. DBに保存
        const media = await prisma.mediaImage.create({
            data: {
                userId,
                filePath: publicUrl,
                mime: 'image/png',
                width: segMeta.width || width,
                height: segMeta.height || seg.height,
                sourceUrl: url,
                sourceType: `dual-import-${deviceType}`,
            },
        });

        return { index: seg.index, media };
    });

    // 全て並列実行して結果を取得
    const results = await Promise.all(uploadPromises);

    // インデックス順にソートして返却
    return results.sort((a, b) => a.index - b.index).map(r => r.media);
}

export async function POST(request: NextRequest) {
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url } = body;

    if (!url) {
        return Response.json({ error: 'URL is required' }, { status: 400 });
    }

    return createStreamResponse(async (send) => {
        log.info(`========== Starting Dual Screenshot (Parallel) ==========`);
        log.info(`URL: ${url}`);

        send({ type: 'progress', step: 'init', message: 'デュアルスクリーンショットを開始...' });

        // Launch Puppeteer
        send({ type: 'progress', step: 'browser', message: 'ブラウザを起動中...' });
        log.info('Launching Puppeteer...');

        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
        } catch (launchError: any) {
            log.error(`Browser launch failed: ${launchError.message}`);
            send({ type: 'error', error: 'ブラウザの起動に失敗しました' });
            return;
        }

        try {
            // ========== 並列スクリーンショット取得 ==========
            send({ type: 'progress', step: 'capture', message: 'デスクトップ・モバイル版を同時取得中...' });
            log.info('Creating two pages for parallel capture...');

            // 2つのページを同時作成
            const [desktopPage, mobilePage] = await Promise.all([
                browser.newPage(),
                browser.newPage()
            ]);

            const desktopConfig = DEVICE_PRESETS.desktop;
            const mobileConfig = DEVICE_PRESETS.mobile;

            // デスクトップページの設定
            const setupDesktop = async () => {
                await desktopPage.setViewport({
                    width: desktopConfig.width,
                    height: desktopConfig.height,
                    deviceScaleFactor: desktopConfig.deviceScaleFactor,
                    isMobile: desktopConfig.isMobile,
                    hasTouch: desktopConfig.isMobile
                });
                log.info('Desktop: navigating to URL...');
                await desktopPage.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                log.info('Desktop: capturing full page...');
                const screenshot = await captureFullPage(desktopPage, desktopConfig);
                log.success('Desktop screenshot captured!');
                return screenshot;
            };

            // モバイルページの設定
            const setupMobile = async () => {
                await mobilePage.setViewport({
                    width: mobileConfig.width,
                    height: mobileConfig.height,
                    deviceScaleFactor: mobileConfig.deviceScaleFactor,
                    isMobile: mobileConfig.isMobile,
                    hasTouch: mobileConfig.isMobile
                });
                if (mobileConfig.userAgent) {
                    await mobilePage.setUserAgent(mobileConfig.userAgent);
                }
                log.info('Mobile: navigating to URL...');
                await mobilePage.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                log.info('Mobile: capturing full page...');
                const screenshot = await captureFullPage(mobilePage, mobileConfig);
                log.success('Mobile screenshot captured!');
                return screenshot;
            };

            // 並列実行
            const [desktopScreenshot, mobileScreenshot] = await Promise.all([
                setupDesktop(),
                setupMobile()
            ]);

            // ページを閉じる
            await Promise.all([desktopPage.close(), mobilePage.close()]);

            // ========== セグメント分割とアップロード（並列） ==========
            send({ type: 'progress', step: 'upload', message: 'セグメント分割とアップロード中...' });
            log.info('Segmenting and uploading in parallel...');

            const [desktopMedia, mobileMedia] = await Promise.all([
                segmentAndUpload(desktopScreenshot, 'desktop', url, user.id),
                segmentAndUpload(mobileScreenshot, 'mobile', url, user.id)
            ]);

            log.success(`Desktop: ${desktopMedia.length} segments created`);
            log.success(`Mobile: ${mobileMedia.length} segments created`);

            log.info(`========== Dual Screenshot Complete ==========`);
            log.success(`Desktop segments: ${desktopMedia.length}, Mobile segments: ${mobileMedia.length}`);

            send({
                type: 'complete',
                success: true,
                desktop: desktopMedia,
                mobile: mobileMedia,
            });

        } finally {
            await browser.close();
        }
    });
}
