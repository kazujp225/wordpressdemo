import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import path from 'path';
import os from 'os';
import fs from 'fs';

// カラーログ
const log = {
    info: (msg: string) => console.log(`\x1b[36m[PDF-UPLOAD INFO]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[PDF-UPLOAD SUCCESS]\x1b[0m ✓ ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[PDF-UPLOAD ERROR]\x1b[0m ✗ ${msg}`),
};

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let browser: any = null;
    let tempFilePath: string | null = null;

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'ファイルが選択されていません' }, { status: 400 });
        }

        if (file.type !== 'application/pdf') {
            return NextResponse.json({ error: 'PDFファイルのみアップロード可能です' }, { status: 400 });
        }

        log.info(`Processing PDF: ${file.name}, size: ${file.size} bytes`);

        // PDFを一時ファイルとして保存
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        tempFilePath = path.join(os.tmpdir(), `pdf-${Date.now()}.pdf`);
        fs.writeFileSync(tempFilePath, buffer);

        log.info(`Temp file saved: ${tempFilePath}`);

        // Puppeteerを起動
        const isDev = process.env.NODE_ENV === 'development';
        let executablePath: string;
        let launchArgs: string[];

        if (isDev) {
            executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            launchArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
            log.info('Using local Chrome for PDF rendering');
        } else {
            executablePath = await chromium.executablePath();
            launchArgs = [
                ...chromium.args,
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
                '--no-zygote',
            ];
            log.info('Using serverless Chromium for PDF rendering');
        }

        browser = await puppeteer.launch({
            args: launchArgs,
            executablePath,
            headless: true,
        });

        const page = await browser.newPage();

        // PDFを開く（file:// プロトコル使用）
        await page.goto(`file://${tempFilePath}`, { waitUntil: 'networkidle0' });

        // PDFビューワーの情報を取得（ページ数など）
        // ChromeのPDFビューワーではページ数を取得しにくいので、
        // 代わりにシンプルにPDFの最初のページをスクリーンショット

        await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

        // PDFビューワーが読み込まれるまで待機
        await new Promise(resolve => setTimeout(resolve, 2000));

        // スクリーンショットを撮影
        const screenshot = await page.screenshot({ fullPage: true }) as Buffer;

        await browser.close();
        browser = null;

        // 一時ファイルを削除
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            tempFilePath = null;
        }

        log.info('PDF screenshot captured');

        // Supabase Storageにアップロード
        const filename = `pdf-pages/${user.id}/${Date.now()}-pdf.png`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('images')
            .upload(filename, screenshot, {
                contentType: 'image/png',
                upsert: false,
            });

        if (uploadError) {
            log.error(`Upload error: ${uploadError.message}`);
            throw uploadError;
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('images')
            .getPublicUrl(filename);

        // MediaImageレコードを作成
        const media = await prisma.mediaImage.create({
            data: {
                filePath: publicUrl,
                mime: 'image/png',
                width: 2400,
                height: 3200,
                sourceUrl: file.name,
                sourceType: 'pdf-import',
            },
        });

        log.success(`PDF uploaded: MediaImage ID ${media.id}`);

        return NextResponse.json({
            success: true,
            media: [media],
            pageCount: 1,
            message: 'PDFの最初のページをインポートしました。複数ページのPDFは今後対応予定です。',
        });

    } catch (error: any) {
        log.error(`PDF processing failed: ${error.message}`);
        console.error(error);
        return NextResponse.json(
            { error: error.message || 'PDFの処理に失敗しました' },
            { status: 500 }
        );
    } finally {
        // クリーンアップ
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                // ignore
            }
        }
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (e) {
                // ignore
            }
        }
    }
}
