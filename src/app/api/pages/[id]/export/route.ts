import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import AdmZip from 'adm-zip';
import { generateExportCSS } from '@/lib/export-styles';
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

        // 所有者確認
        if (page.userId !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const zip = new AdmZip();

        // グローバルナビゲーションの取得 (ランタイム同期エラー対策のため安全なアクセスを行う)
        let globalNavValue: any = null;
        try {
            const globalNav = await prisma.globalConfig.findUnique({ where: { key: 'navigation' } });
            if (globalNav) globalNavValue = JSON.parse(globalNav.value);
        } catch { /* GlobalConfig table may not exist yet */ }

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
            let mobileImagePath = '';

            // デスクトップ画像
            if (section.image && section.image.filePath) {
                const extension = section.image.filePath.split('.').pop()?.split('?')[0] || 'jpg';
                const localName = `section-${index}-desktop.${extension}`;
                imagePath = `./images/desktop/${localName}`;

                // 画像を取得してZIPに追加
                try {
                    const response = await fetch(section.image.filePath);
                    if (response.ok) {
                        const buffer = Buffer.from(await response.arrayBuffer());
                        zip.addFile(`images/desktop/${localName}`, buffer);
                    }
                } catch (e) {
                    console.error(`Failed to fetch desktop image ${section.image.filePath}:`, e);
                }
            }

            // モバイル画像
            if (section.mobileImage && section.mobileImage.filePath) {
                const extension = section.mobileImage.filePath.split('.').pop()?.split('?')[0] || 'jpg';
                const localName = `section-${index}-mobile.${extension}`;
                mobileImagePath = `./images/mobile/${localName}`;

                // モバイル画像を取得してZIPに追加
                try {
                    const response = await fetch(section.mobileImage.filePath);
                    if (response.ok) {
                        const buffer = Buffer.from(await response.arrayBuffer());
                        zip.addFile(`images/mobile/${localName}`, buffer);
                    }
                } catch (e) {
                    console.error(`Failed to fetch mobile image ${section.mobileImage.filePath}:`, e);
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

        // セクション情報をJSONとしてエクスポート（Claude Code用）
        const sectionsData = page.sections.map((section, index) => {
            let config: any = {};
            try {
                if (section.config) {
                    config = JSON.parse(section.config);
                }
            } catch (e) {
                console.error('Failed to parse section config for JSON export:', e);
            }

            const desktopExtension = section.image?.filePath?.split('.').pop()?.split('?')[0] || 'jpg';
            const mobileExtension = section.mobileImage?.filePath?.split('.').pop()?.split('?')[0] || 'jpg';

            return {
                index,
                role: section.role,
                order: section.order,
                images: {
                    desktop: section.image ? `images/desktop/section-${index}-desktop.${desktopExtension}` : null,
                    mobile: section.mobileImage ? `images/mobile/section-${index}-mobile.${mobileExtension}` : null,
                },
                // クリック可能エリア（ボタン）
                clickableAreas: config.clickableAreas || [],
                mobileClickableAreas: config.mobileClickableAreas || [],
                // テキスト設定
                text: config.text || null,
                textColor: config.textColor || 'white',
                textPosition: config.position || 'middle',
                // その他の設定
                brightness: config.brightness || 100,
                grayscale: config.grayscale || 0,
                overlayColor: config.overlayColor || 'transparent',
                overlayOpacity: config.overlayOpacity || 0,
            };
        });

        const sectionsJson = {
            pageTitle: page.title,
            pageSlug: page.slug,
            exportedAt: new Date().toISOString(),
            totalSections: sectionsData.length,
            sections: sectionsData,
            // ヘッダー設定
            header: headerConfig,
            // 使い方の説明
            _readme: {
                description: 'このファイルはClaude Codeでの編集用にエクスポートされたセクション情報です。',
                images: {
                    desktop: 'images/desktop/ フォルダにデスクトップ用画像が格納されています',
                    mobile: 'images/mobile/ フォルダにモバイル用画像が格納されています',
                },
                clickableAreas: 'クリック可能エリアは相対座標 (0-1) で定義されています。x, y, width, height は画像サイズに対する比率です。',
                actionTypes: ['url', 'email', 'phone', 'scroll', 'form-input'],
            }
        };

        zip.addFile('sections.json', Buffer.from(JSON.stringify(sectionsJson, null, 2)));

        // READMEファイルを追加
        const readmeContent = `# ${page.title}

## フォルダ構成

\`\`\`
├── index.html          # メインHTMLファイル
├── style.css           # スタイルシート
├── sections.json       # セクション情報（Claude Code編集用）
├── README.md           # このファイル
└── images/
    ├── desktop/        # デスクトップ用画像
    │   └── section-{n}-desktop.{ext}
    └── mobile/         # モバイル用画像
        └── section-{n}-mobile.{ext}
\`\`\`

## Claude Codeでの編集

\`sections.json\` にはクリック可能エリア（ボタン）の情報が含まれています。

### クリック可能エリアの形式

\`\`\`json
{
  "x": 0.1,           // 左端からの相対位置 (0-1)
  "y": 0.2,           // 上端からの相対位置 (0-1)
  "width": 0.3,       // 幅の相対サイズ (0-1)
  "height": 0.1,      // 高さの相対サイズ (0-1)
  "actionType": "url", // アクションタイプ: url, email, phone, scroll, form-input
  "actionValue": "https://example.com", // アクション値
  "label": "今すぐ申し込む" // ボタンラベル
}
\`\`\`

### アクションタイプ

- \`url\`: 外部リンク
- \`email\`: メール送信 (mailto:)
- \`phone\`: 電話発信 (tel:)
- \`scroll\`: ページ内スクロール (#anchor)
- \`form-input\`: フォーム入力モーダル表示

エクスポート日時: ${new Date().toISOString()}
`;

        zip.addFile('README.md', Buffer.from(readmeContent));

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
