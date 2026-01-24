import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { generateExportCSS } from '@/lib/export-styles';

// Generate a standalone HTML file for deployment (with absolute image URLs)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const pageId = parseInt(id);
  if (isNaN(pageId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const page = await prisma.page.findUnique({
    where: { id: pageId },
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

  if (page.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Header config
  let globalNavValue: any = null;
  try {
    const globalNav = await prisma.globalConfig.findUnique({ where: { key: 'navigation' } });
    if (globalNav) globalNavValue = JSON.parse(globalNav.value);
  } catch { /* GlobalConfig table may not exist yet */ }

  let headerConfig = {
    logoText: globalNavValue?.logoText || page.title,
    sticky: globalNavValue?.sticky ?? true,
    ctaText: globalNavValue?.ctaText || 'お問い合わせ',
    ctaLink: globalNavValue?.ctaLink || '#contact',
    navItems: globalNavValue?.navItems || [] as any[],
  };

  try {
    if (page.headerConfig) {
      const individualConfig = JSON.parse(page.headerConfig);
      headerConfig = { ...headerConfig, ...individualConfig };
    }
  } catch (e) {}

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  // Build sections HTML with absolute image URLs
  const sectionsHtml = page.sections.map((section, index) => {
    let config: any = {
      text: '',
      textColor: 'white',
      position: 'middle',
      brightness: 100,
      grayscale: 0,
      overlayColor: 'transparent',
      overlayOpacity: 0,
    };
    try {
      if (section.config) config = { ...config, ...JSON.parse(section.config) };
    } catch {}

    // html-embed sections
    if (section.role === 'html-embed' && config.htmlContent) {
      return config.htmlContent;
    }

    const positionClasses: Record<string, string> = {
      top: 'top: 40px; align-items: flex-start;',
      middle: 'top: 50%; transform: translateY(-50%); align-items: center;',
      bottom: 'bottom: 40px; align-items: flex-end;',
    };
    const posStyle = positionClasses[config.position] || positionClasses.middle;
    const textColor = config.textColor === 'black' ? '#000' : '#fff';
    const textShadow = config.textColor === 'black' ? 'none' : '0 2px 4px rgba(0,0,0,0.5)';

    // Use absolute Supabase URLs for images
    let desktopSrc = '';
    if (section.image?.filePath) {
      desktopSrc = section.image.filePath.startsWith('http')
        ? section.image.filePath
        : `${supabaseUrl}/storage/v1/object/public/images/${section.image.filePath}`;
    }

    let mobileSrc = '';
    if (section.mobileImage?.filePath) {
      mobileSrc = section.mobileImage.filePath.startsWith('http')
        ? section.mobileImage.filePath
        : `${supabaseUrl}/storage/v1/object/public/images/${section.mobileImage.filePath}`;
    }

    const overlayHtml = (config.overlayColor && config.overlayColor !== 'transparent' && config.overlayOpacity > 0)
      ? `<div style="position:absolute;inset:0;z-index:10;pointer-events:none;background-color:${config.overlayColor};opacity:${config.overlayOpacity / 100}"></div>`
      : '';

    const textHtml = config.text
      ? `<div style="position:absolute;left:0;right:0;z-index:20;padding:0 32px;display:flex;flex-direction:column;pointer-events:none;${posStyle}">
          <div style="max-width:560px;text-align:center;white-space:pre-wrap;font-size:clamp(1.5rem,4vw,2.5rem);font-weight:900;letter-spacing:-0.025em;line-height:1.2;color:${textColor};text-shadow:${textShadow};">
            ${config.text.replace(/\n/g, '<br>')}
          </div>
        </div>`
      : '';

    const filterStyle = `filter: brightness(${config.brightness}%) grayscale(${config.grayscale}%)`;

    if (!desktopSrc) {
      return `<section style="position:relative;width:100%;overflow:hidden;">
        ${overlayHtml}${textHtml}
        <div style="display:flex;height:200px;align-items:center;justify-content:center;background:#f3f4f6;color:#9ca3af;">セクション ${index + 1}</div>
      </section>`;
    }

    // Desktop + mobile responsive image
    const mobileImgHtml = mobileSrc
      ? `<img src="${mobileSrc}" alt="" style="display:none;width:100%;height:auto;${filterStyle}" class="mobile-img" />`
      : '';

    return `<section style="position:relative;width:100%;overflow:hidden;">
      ${overlayHtml}${textHtml}
      <img src="${desktopSrc}" alt="${section.role || ''}" style="display:block;width:100%;height:auto;${filterStyle}" class="desktop-img" />
      ${mobileImgHtml}
    </section>`;
  });

  // Build responsive CSS
  const mobileMediaQuery = sectionsHtml.some(h => h.includes('mobile-img'))
    ? `@media (max-width: 768px) {
        .desktop-img { display: none !important; }
        .mobile-img { display: block !important; }
      }`
    : '';

  const cssContent = generateExportCSS();

  const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap" rel="stylesheet">
  <style>${cssContent}
  ${mobileMediaQuery}
  body { margin: 0; font-family: 'Noto Sans JP', sans-serif; background: #f9fafb; }
  .header { ${headerConfig.sticky ? 'position:sticky;top:0;' : 'position:relative;'} z-index:50; display:flex; height:64px; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.9); padding:0 32px; box-shadow:0 1px 3px rgba(0,0,0,0.1); backdrop-filter:blur(8px); }
  .header-logo { font-size:1.25rem; font-weight:700; color:#111827; }
  .header-cta { display:inline-block; background:#2563eb; color:#fff; padding:8px 24px; border-radius:9999px; font-size:0.875rem; font-weight:700; text-decoration:none; box-shadow:0 4px 6px rgba(37,99,235,0.3); transition:transform 0.15s; }
  .header-cta:hover { transform:scale(1.05); }
  .main-content { max-width:768px; margin:0 auto; background:#fff; box-shadow:0 25px 50px -12px rgba(0,0,0,0.15); }
  .footer { background:#111827; padding:32px; text-align:center; color:#fff; font-size:0.875rem; opacity:0.7; }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-logo">${headerConfig.logoText}</div>
    <a href="${headerConfig.ctaLink}" class="header-cta">${headerConfig.ctaText}</a>
  </header>
  <main class="main-content">
    ${sectionsHtml.join('\n    ')}
  </main>
  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} ${headerConfig.logoText}. All rights reserved.</p>
  </footer>
</body>
</html>`;

  return NextResponse.json({ html: htmlContent, title: page.title });
}
