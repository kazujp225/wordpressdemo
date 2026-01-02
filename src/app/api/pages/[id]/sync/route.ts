import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

async function getBase64Image(url: string, baseUrl: string) {
    const absoluteUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    const res = await fetch(absoluteUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${absoluteUrl}`);
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    const baseUrl = new URL(request.url).origin;
    try {
        const id = parseInt(params.id);
        const { type } = await request.json(); // 'github' or 'webhook'

        const page = await prisma.page.findUnique({
            where: { id },
            include: {
                sections: {
                    include: { image: true, mobileImage: true },
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

        // 設定の取得
        const configs = await prisma.globalConfig.findMany();
        const configMap = configs.reduce((acc: any, curr) => {
            acc[curr.key] = JSON.parse(curr.value);
            return acc;
        }, {});

        // 静的HTML生成 (export/route.ts のロジックを簡略化して共通利用)
        // 本来は共通関数化すべきだが、今回は速度優先で直接構築
        const sectionsHtml = await Promise.all(page.sections.map(async (section, index) => {
            let config = JSON.parse(section.config || '{}');
            const pos = config.position || 'middle';
            const positionClasses = pos === 'top' ? 'top-10 items-start' : pos === 'bottom' ? 'bottom-10 items-end' : 'top-1/2 -translate-y-1/2 items-center';
            const color = config.textColor === 'black' ? 'text-black' : 'text-white';
            const shadow = config.textColor === 'black' ? '' : 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]';

            let imagePath = '';
            let imageData = null;
            if (section.image?.filePath) {
                const ext = section.image.filePath.split('.').pop()?.split('?')[0] || 'jpg';
                const filename = `section-${index}.${ext}`;
                imagePath = `./images/${filename}`;
                imageData = {
                    filename: `images/${filename}`,
                    base64: await getBase64Image(section.image.filePath, baseUrl)
                };
            }

            return {
                html: `
                <section class="relative w-full overflow-hidden">
                    <div class="absolute inset-x-0 z-20 px-8 flex flex-col pointer-events-none ${positionClasses}">
                        <div class="max-w-xl text-center whitespace-pre-wrap text-2xl md:text-4xl font-black tracking-tight leading-tight ${color} ${shadow}">
                            ${(config.text || '').replace(/\n/g, '<br>')}
                        </div>
                    </div>
                    ${imagePath ? `<img src="${imagePath}" class="block w-full h-auto" />` : ''}
                </section>`,
                imageData
            };
        }));

        const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-50">${sectionsHtml.map(s => s.html).join('')}</body></html>`;

        if (type === 'github') {
            const { token, owner, repo, branch = 'main', path = 'public/lp' } = configMap.github || {};
            if (!token || !owner || !repo) throw new Error('GitHub configuration missing');

            // GitHub APIでプッシュ
            // 簡略化：index.html だけプッシュする例。本来は画像も1つずつプッシュが必要。
            const pushFile = async (filePath: string, contentBase64: string, message: string) => {
                const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}/${filePath}`;

                // 現在のSHAを取得（更新用）
                const getRes = await fetch(url, {
                    headers: { 'Authorization': `token ${token}` }
                });
                const getData = await getRes.json();
                const sha = getData.sha;

                const putRes = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message,
                        content: contentBase64,
                        branch,
                        sha
                    })
                });
                if (!putRes.ok) {
                    const error = await putRes.json();
                    throw new Error(`GitHub Push Failed (${filePath}): ${error.message || putRes.statusText}`);
                }
                return true;
            };

            await pushFile('index.html', Buffer.from(html).toString('base64'), `Deploy LP: ${page.title}`);

            // 画像もプッシュ
            for (const s of sectionsHtml) {
                if (s.imageData) {
                    await pushFile(s.imageData.filename, s.imageData.base64, `Upload image for ${page.title}`);
                }
            }

            return NextResponse.json({ success: true, message: 'GitHubへの同期が完了しました。' });
        }

        if (type === 'webhook') {
            const { url } = configMap.webhook || {};
            if (!url) throw new Error('Webhook URL missing');

            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'lp.published',
                    pageId: page.id,
                    title: page.title,
                    slug: page.slug,
                    html: html
                })
            });

            return NextResponse.json({ success: true, message: 'Webhookの送信が完了しました。' });
        }

        return NextResponse.json({ error: 'Invalid sync type' }, { status: 400 });

    } catch (error: any) {
        console.error('Sync API Error Details:', error);
        return NextResponse.json({
            error: 'Sync Failed',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
