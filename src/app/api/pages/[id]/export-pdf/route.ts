import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        // 認証チェック
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const id = parseInt(params.id);
        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const page = await prisma.page.findUnique({
            where: { id },
            select: { id: true, slug: true, userId: true, title: true },
        });

        if (!page) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 });
        }

        // 所有者確認
        if (page.userId !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Puppeteerでブラウザを起動（システムChromium優先 - 日本語フォント対応）
        const { launchBrowser } = await import('@/lib/puppeteer');
        const browser = await launchBrowser();

        try {
            const browserPage = await browser.newPage();

            // デスクトップビューポート設定
            await browserPage.setViewport({
                width: 1280,
                height: 800,
                deviceScaleFactor: 2,
            });

            // プレビューページに移動
            const host = request.headers.get('host') || 'localhost:3002';
            const protocol = host.includes('localhost') ? 'http' : 'https';
            const previewUrl = `${protocol}://${host}/preview/page/${page.id}?mode=desktop`;

            await browserPage.goto(previewUrl, {
                waitUntil: 'networkidle2',
                timeout: 60000,
            });

            // 画像の読み込みを待機
            await browserPage.evaluate(async () => {
                const images = Array.from(document.querySelectorAll('img'));
                await Promise.all(images.map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise((resolve) => {
                        img.onload = resolve;
                        img.onerror = resolve;
                        setTimeout(resolve, 5000);
                    });
                }));
            });

            // 少し待機してレンダリング完了を確保
            await new Promise(resolve => setTimeout(resolve, 2000));

            // PDFを生成
            const pdfBuffer = await browserPage.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '0',
                    right: '0',
                    bottom: '0',
                    left: '0',
                },
                preferCSSPageSize: true,
            });

            await browserPage.close();

            return new Response(Buffer.from(pdfBuffer), {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(page.slug || page.title || 'lp')}.pdf"`,
                },
            });
        } finally {
            await browser.close();
        }
    } catch (error) {
        console.error('PDF Export Error:', error);
        return NextResponse.json({ error: 'Failed to export PDF' }, { status: 500 });
    }
}
