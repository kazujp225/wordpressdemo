import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';

/**
 * システムChromiumを優先してPuppeteerブラウザを起動する
 * Docker/Render環境ではシステムChromiumを使用（日本語フォント対応）
 * サーバーレス環境では @sparticuz/chromium にフォールバック
 */
export async function launchBrowser() {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    return puppeteer.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  // 本番環境: システムChromiumを優先（日本語フォント利用可能）
  const systemPaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];

  for (const p of systemPaths) {
    if (!p) continue;
    try {
      if (fs.existsSync(p)) {
        return puppeteer.launch({
          executablePath: p,
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
        });
      }
    } catch {}
  }

  // フォールバック: @sparticuz/chromium（Vercel等サーバーレス環境）
  const executablePath = await chromium.executablePath();
  return puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });
}
