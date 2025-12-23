import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import sharp from 'sharp';

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

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        const deviceConfig = DEVICE_PRESETS[device as keyof typeof DEVICE_PRESETS] || DEVICE_PRESETS.desktop;

        // 1. Launch Puppeteer
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
        await page.goto(url, { waitUntil: 'networkidle2' });

        // 2. Take Full Page Screenshot
        const fullScreenshot = await page.screenshot({ fullPage: true });
        await browser.close();

        // 3. Segment the screenshot
        const metadata = await sharp(fullScreenshot).metadata();
        const height = metadata.height || 0;
        const width = metadata.width || 0;

        if (height === 0 || width === 0) {
            throw new Error('Screenshot failed: zero dimensions captured.');
        }

        const segmentHeight = 800;
        const numSegments = Math.ceil(height / segmentHeight);
        const createdMedia = [];

        for (let i = 0; i < numSegments; i++) {
            const top = i * segmentHeight;
            const currentSegHeight = Math.min(segmentHeight, height - top);

            // Safety check for leftover pixels
            if (currentSegHeight <= 0) continue;

            const buffer = await sharp(fullScreenshot)
                .extract({ left: 0, top, width, height: currentSegHeight })
                .png()
                .toBuffer();

            const filename = `import-${Date.now()}-seg-${i}.png`;

            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('images')
                .upload(filename, buffer, {
                    contentType: 'image/png',
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

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
                },
            });
            createdMedia.push(media);
        }

        return NextResponse.json({ success: true, media: createdMedia, device });

    } catch (error: any) {
        console.error('URL Screenshot Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
