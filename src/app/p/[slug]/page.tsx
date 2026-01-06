import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { ClickableArea } from '@/types';
import { ContactForm } from '@/components/public/ContactForm';
import { InteractiveAreaOverlay } from '@/components/public/InteractiveAreaOverlay';

export async function generateMetadata({ params }: { params: { slug: string } }) {
    const page = await prisma.page.findUnique({ where: { slug: params.slug }, select: { title: true } });
    if (!page) return { title: 'Not Found' };
    return { title: page.title };
}

export default async function PublicPage({ params }: { params: { slug: string } }) {
    const id = parseInt(params.slug);
    const page = await prisma.page.findFirst({
        where: {
            OR: [
                { slug: params.slug },
                { id: isNaN(id) ? -1 : id }
            ]
        },
        include: {
            sections: {
                include: { image: true, mobileImage: true },
                orderBy: { order: 'asc' },
            },
        },
    });

    if (!page) return notFound();

    // Parse Configs & Global Navigation Integration (Safe access for runtime sync issues)
    const globalNav = await (prisma as any).globalConfig?.findUnique({ where: { key: 'navigation' } }).catch(() => null);
    const globalNavValue = globalNav ? JSON.parse(globalNav.value) : null;

    let headerConfig = {
        title: page.title,
        logoText: globalNavValue?.logoText || page.title,
        sticky: globalNavValue?.sticky ?? true,
        ctaText: globalNavValue?.ctaText || 'お問い合わせ',
        ctaLink: globalNavValue?.ctaLink || '#contact',
        navItems: globalNavValue?.navItems || [] as any[]
    };

    // If individual page has specific header config, merge it (individual overrides global if desired, but here we prioritize global for B2B consistency or vice versa)
    try {
        if (page.headerConfig) {
            const individualConfig = JSON.parse(page.headerConfig);
            headerConfig = { ...headerConfig, ...individualConfig };
        }
    } catch { }

    // ページ全体のレイアウトを最初のセクションから判定
    let pageLayout = 'mobile'; // デフォルト
    if (page.sections.length > 0 && page.sections[0].config) {
        try {
            const firstConfig = JSON.parse(page.sections[0].config);
            if (firstConfig.layout) pageLayout = firstConfig.layout;
        } catch { }
    }

    const isDesktopLayout = pageLayout === 'desktop';

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Dynamic Header */}
            <header className={`${headerConfig.sticky ? 'sticky top-0' : 'relative'} z-50 flex h-16 items-center justify-between bg-white/90 px-4 shadow-sm backdrop-blur-md md:px-8`}>
                <div className="text-xl font-bold text-gray-900">
                    {headerConfig.logoText}
                </div>
                <nav className="hidden md:flex gap-6">
                    {headerConfig.navItems?.map((item: any) => (
                        <a key={item.id} href={item.href} className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">
                            {item.label}
                        </a>
                    ))}
                    {(!headerConfig.navItems || !headerConfig.navItems.length) && (
                        <>
                            <a href="#hero" className="text-sm font-medium text-gray-700 hover:text-blue-600">トップ</a>
                            <a href="#contact" className="text-sm font-medium text-gray-700 hover:text-blue-600">お問い合わせ</a>
                        </>
                    )}
                </nav>
                <a href={headerConfig.ctaLink} className="rounded-full bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95">
                    {headerConfig.ctaText}
                </a>
            </header>

            {/* Main Content: レイアウトに応じて幅を調整 */}
            <main className={`mx-auto w-full bg-white shadow-2xl ${
                isDesktopLayout
                    ? 'max-w-7xl' // デスクトップ: ほぼ全幅
                    : 'max-w-md md:max-w-xl lg:max-w-2xl' // モバイル: 縦長中央
            }`}>
                {page.sections.map((section) => (
                    <section key={section.id} id={section.role} className="relative w-full overflow-hidden group">
                        {/* Visual Adjustments & Text Overlay */}
                        {(() => {
                            let config: {
                                text: string;
                                textColor: string;
                                position: string;
                                brightness: number;
                                grayscale: number;
                                overlayColor: string;
                                overlayOpacity: number;
                                clickableAreas?: ClickableArea[];
                                properties?: {
                                    clickableAreas?: ClickableArea[];
                                    [key: string]: unknown;
                                };
                            } = {
                                text: '',
                                textColor: 'white',
                                position: 'middle',
                                brightness: 100,
                                grayscale: 0,
                                overlayColor: 'transparent',
                                overlayOpacity: 0,
                                clickableAreas: []
                            };
                            try {
                                if (section.config) {
                                    const parsed = JSON.parse(section.config);
                                    config = { ...config, ...parsed };
                                    // LP Builderからの保存形式: properties.clickableAreas
                                    if (parsed.properties?.clickableAreas) {
                                        config.clickableAreas = parsed.properties.clickableAreas;
                                    }
                                    // デバッグ用ログ
                                    console.log(`Section ${section.role} clickableAreas:`, config.clickableAreas);
                                }
                            } catch { }

                            const imgStyle = {
                                filter: `brightness(${config.brightness}%) grayscale(${config.grayscale}%)`,
                            };

                            return (
                                <>
                                    {/* カラーオーバーレイ（背景色調整用） */}
                                    {config.overlayOpacity > 0 && (
                                        <div className="absolute inset-0 z-10 pointer-events-none" style={{ backgroundColor: config.overlayColor, opacity: config.overlayOpacity / 100 }}></div>
                                    )}
                                    {/* テキストオーバーレイは無効化 - 画像に直接焼き込む方式に変更 */}

                                    {section.image ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={section.image.filePath}
                                            alt={section.role}
                                            className="block w-full h-auto transition-all duration-500"
                                            style={imgStyle}
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="flex h-48 items-center justify-center bg-gray-100 text-gray-400">
                                            セクション: {section.role} (画像なし)
                                        </div>
                                    )}

                                    {/* Clickable Areas Overlay (with form support) - 画像の後にレンダリング */}
                                    {config.clickableAreas && config.clickableAreas.length > 0 && (
                                        <InteractiveAreaOverlay
                                            areas={config.clickableAreas}
                                            pageSlug={params.slug}
                                        />
                                    )}
                                </>
                            );
                        })()}
                    </section>
                ))}

                {/* Form Section */}
                <ContactForm />
            </main>

            {/* Footer */}
            <footer className="bg-gray-900 py-8 text-center text-white">
                <p className="text-sm opacity-70">&copy; {new Date().getFullYear()} {headerConfig.title}. All rights reserved. (日本語)</p>
            </footer>
        </div>
    );
}
