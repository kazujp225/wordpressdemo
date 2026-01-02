import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import AdmZip from 'adm-zip';
import { generateExportCSS } from '@/lib/export-styles';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const id = parseInt(params.id);
        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const page = await prisma.page.findUnique({
            where: { id },
            include: {
                sections: {
                    include: { image: true, mobileImage: true },
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!page) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 });
        }

        const zip = new AdmZip();

        // グローバルナビゲーションの取得 (ランタイム同期エラー対策のため安全なアクセスを行う)
        const globalNav = await (prisma as any).globalConfig?.findUnique({ where: { key: 'navigation' } }).catch(() => null);
        const globalNavValue = globalNav ? JSON.parse(globalNav.value) : null;

        // ヘッダー設定の構築
        let headerConfig = {
            logoText: globalNavValue?.logoText || page.title,
            sticky: globalNavValue?.sticky ?? true,
            ctaText: globalNavValue?.ctaText || 'お問い合わせ',
            ctaLink: globalNavValue?.ctaLink || '#contact',
            navItems: globalNavValue?.navItems || [] as any[]
        };

        try {
            if (page.headerConfig) {
                const individualConfig = JSON.parse(page.headerConfig);
                headerConfig = { ...headerConfig, ...individualConfig };
            }
        } catch (e) {
            console.error('Failed to parse headerConfig:', e);
        }

        // セクションごとのHTMLと画像の処理
        const sectionsHtml = await Promise.all(page.sections.map(async (section, index) => {
            let config = {
                text: '',
                textColor: 'white',
                position: 'middle',
                brightness: 100,
                grayscale: 0,
                overlayColor: 'transparent',
                overlayOpacity: 0
            };
            try {
                if (section.config) {
                    config = { ...config, ...JSON.parse(section.config) };
                }
            } catch (e) {
                console.error('Failed to parse section config:', e);
            }

            const positionClasses = {
                top: 'top-10 items-start',
                middle: 'top-1/2 -translate-y-1/2 items-center',
                bottom: 'bottom-10 items-end'
            }[config.position as 'top' | 'middle' | 'bottom'] || 'top-1/2 -translate-y-1/2 items-center';

            const colorClasses = config.textColor === 'black' ? 'text-black' : 'text-white';
            const shadowClasses = config.textColor === 'black' ? '' : 'drop-shadow-text';

            let imagePath = '';
            if (section.image && section.image.filePath) {
                const extension = section.image.filePath.split('.').pop()?.split('?')[0] || 'jpg';
                const localName = `section-${index}.${extension}`;
                imagePath = `./images/${localName}`;

                // 画像を取得してZIPに追加
                try {
                    const response = await fetch(section.image.filePath);
                    if (response.ok) {
                        const buffer = Buffer.from(await response.arrayBuffer());
                        zip.addFile(`images/${localName}`, buffer);
                    }
                } catch (e) {
                    console.error(`Failed to fetch image ${section.image.filePath}:`, e);
                }
            }

            return `
        <section id="${section.role}-${index}" class="relative w-full overflow-hidden">
            <div class="absolute inset-0 z-10 pointer-events-none" style="background-color: ${config.overlayColor}; opacity: ${(config.overlayOpacity || 0) / 100}"></div>
            <div class="absolute inset-x-0 z-20 px-8 flex flex-col pointer-events-none ${positionClasses}">
                ${config.text ? `
                    <div class="max-w-xl text-center whitespace-pre-wrap text-2xl md:text-4xl font-black tracking-tight leading-tight ${colorClasses} ${shadowClasses}">
                        ${config.text.replace(/\n/g, '<br>')}
                    </div>
                ` : ''}
            </div>
            ${imagePath ? `
                <img
                    src="${imagePath}"
                    alt="${section.role}"
                    class="block w-full h-auto"
                    style="filter: brightness(${config.brightness}%) grayscale(${config.grayscale}%)"
                />
            ` : `
                <div class="flex h-48 items-center justify-center bg-gray-100 text-gray-400">
                    セクション: ${section.role} (画像なし)
                </div>
            `}
        </section>`;
        }));

        const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${page.title}</title>
    <link rel="stylesheet" href="./style.css">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap" rel="stylesheet">
</head>
<body class="min-h-screen bg-gray-50 flex flex-col">
    <header class="${headerConfig.sticky ? 'sticky top-0' : 'relative'} z-50 flex h-16 items-center justify-between bg-white/90 px-4 shadow-sm backdrop-blur-md md:px-8">
        <div class="text-xl font-bold text-gray-900">${headerConfig.logoText}</div>
        <nav class="hidden md:flex gap-6">
            ${headerConfig.navItems && headerConfig.navItems.length > 0 ?
                headerConfig.navItems.map((item: any) => `
                <a href="${item.href}" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">${item.label}</a>`).join('') : `
                <a href="#hero" class="text-sm font-medium text-gray-700 hover:text-blue-600">トップ</a>
                <a href="#contact" class="text-sm font-medium text-gray-700 hover:text-blue-600">お問い合わせ</a>
            `}
        </nav>
        <a href="${headerConfig.ctaLink}" class="rounded-full bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95">
            ${headerConfig.ctaText}
        </a>
    </header>

    <main class="mx-auto w-full max-w-md bg-white shadow-2xl md:max-w-xl lg:max-w-2xl">
        ${sectionsHtml.join('')}

        <section id="contact" class="px-6 py-12 bg-gray-50">
            <div class="text-center mb-8">
                <h2 class="text-2xl font-bold text-gray-900">お問い合わせ</h2>
                <p class="text-gray-600 mt-2">以下のフォームよりお気軽にご連絡ください。</p>
            </div>
            <form class="space-y-4 max-w-sm mx-auto">
                <div>
                    <label class="block text-sm font-medium text-gray-700">会社名</label>
                    <input type="text" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">お名前</label>
                    <input type="text" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">メールアドレス</label>
                    <input type="email" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">メッセージ</label>
                    <textarea rows="4" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"></textarea>
                </div>
                <button type="button" onclick="alert('送信完了しました。')" class="w-full rounded-md bg-blue-600 py-3 font-bold text-white shadow hover:bg-blue-700">
                    メッセージを送信
                </button>
            </form>
        </section>
    </main>

    <footer class="bg-gray-900 py-8 text-center text-white">
        <p class="text-sm opacity-70">&copy; ${new Date().getFullYear()} ${headerConfig.logoText}. All rights reserved.</p>
    </footer>
</body>
</html>`;

        // CSSファイルを追加
        const cssContent = generateExportCSS();
        zip.addFile('style.css', Buffer.from(cssContent));

        zip.addFile('index.html', Buffer.from(htmlContent));

        const zipBuffer = zip.toBuffer();

        return new Response(new Uint8Array(zipBuffer), {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(page.slug || 'lp')}.zip"`,
            },
        });
    } catch (error) {
        console.error('Export Error:', error);
        return NextResponse.json({ error: 'Failed to export page' }, { status: 500 });
    }
}
