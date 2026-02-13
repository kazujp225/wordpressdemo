"use client";

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { CTA_TEMPLATES, getTemplateStyle } from '@/lib/cta-templates';

interface OverlayItem {
    id: string;
    type: 'image' | 'lottie' | 'text' | 'button';
    url?: string;
    text?: string;
    content?: string;
    x: number;
    y: number;
    width: number;
    height?: number;
    fontSize?: number;
    fontColor?: string;
    fontWeight?: string;
    link?: string;
    template?: string;
    action?: {
        type: 'external' | 'anchor' | 'line';
        url: string;
    };
    style?: {
        backgroundColor?: string;
        textColor?: string;
        borderRadius?: number;
        fontSize?: number;
        fontWeight?: string;
        padding?: string;
        border?: string;
        boxShadow?: string;
    };
}

interface OverlayElementsProps {
    overlays: OverlayItem[];
}

// Lottieアニメーション用コンポーネント
function LottiePlayer({ url, className }: { url: string; className?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // lottie-webを動的にロード
        import('lottie-web').then((lottie) => {
            if (!containerRef.current) return;

            const animation = lottie.default.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                path: url,
            });

            return () => {
                animation.destroy();
            };
        }).catch(console.error);
    }, [url]);

    return <div ref={containerRef} className={className} />;
}

export function OverlayElements({ overlays }: OverlayElementsProps) {
    return (
        <>
            {overlays.map((overlay) => {
                const style: React.CSSProperties = {
                    position: 'absolute',
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    width: `${overlay.width}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 40,
                };

                // テキストオーバーレイ
                if (overlay.type === 'text') {
                    const textStyle: React.CSSProperties = {
                        ...style,
                        fontSize: `${overlay.fontSize || 16}px`,
                        color: overlay.fontColor || '#ffffff',
                        fontWeight: overlay.fontWeight || 'normal',
                        textAlign: 'center',
                        whiteSpace: 'pre-wrap',
                    };

                    const content = (
                        <div style={textStyle}>
                            {overlay.text}
                        </div>
                    );

                    if (overlay.link) {
                        return (
                            <Link
                                key={overlay.id}
                                href={overlay.link}
                                target={overlay.link.startsWith('http') ? '_blank' : undefined}
                                rel={overlay.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                            >
                                {content}
                            </Link>
                        );
                    }
                    return <div key={overlay.id}>{content}</div>;
                }

                // Lottieアニメーション
                if (overlay.type === 'lottie' && overlay.url) {
                    const content = (
                        <div style={style}>
                            <LottiePlayer
                                url={overlay.url}
                                className="w-full h-full"
                            />
                        </div>
                    );

                    if (overlay.link) {
                        return (
                            <Link
                                key={overlay.id}
                                href={overlay.link}
                                target={overlay.link.startsWith('http') ? '_blank' : undefined}
                                rel={overlay.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                            >
                                {content}
                            </Link>
                        );
                    }
                    return <div key={overlay.id}>{content}</div>;
                }

                // 画像オーバーレイ
                if (overlay.type === 'image' && overlay.url) {
                    const content = (
                        <div style={style}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={overlay.url}
                                alt=""
                                className="w-full h-auto"
                                style={overlay.height ? { height: `${overlay.height}%` } : undefined}
                            />
                        </div>
                    );

                    if (overlay.link) {
                        return (
                            <Link
                                key={overlay.id}
                                href={overlay.link}
                                target={overlay.link.startsWith('http') ? '_blank' : undefined}
                                rel={overlay.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                                className="block hover:opacity-90 transition-opacity"
                            >
                                {content}
                            </Link>
                        );
                    }
                    return <div key={overlay.id}>{content}</div>;
                }

                // ボタンオーバーレイ（CTAテンプレート対応）
                if (overlay.type === 'button') {
                    const template = overlay.template ? CTA_TEMPLATES[overlay.template] : null;
                    const isFixedBottom = template?.positionMode === 'fixed_bottom';
                    const isPulse = template?.animation === 'pulse';

                    // テンプレートスタイル or カスタムスタイル
                    const buttonStyle: React.CSSProperties = template
                        ? {
                            ...getTemplateStyle(overlay.template!),
                            ...(isFixedBottom
                                ? { position: 'fixed', bottom: 0, left: 0, right: 0, width: '100%', zIndex: 50, borderRadius: 0, textAlign: 'center' as const }
                                : { ...style, width: 'auto' }
                            ),
                        }
                        : {
                            ...style,
                            width: 'auto',
                            backgroundColor: overlay.style?.backgroundColor || '#6366f1',
                            color: overlay.style?.textColor || '#ffffff',
                            borderRadius: overlay.style?.borderRadius,
                            fontSize: overlay.style?.fontSize,
                            fontWeight: overlay.style?.fontWeight,
                            padding: overlay.style?.padding,
                            border: overlay.style?.border,
                            boxShadow: overlay.style?.boxShadow || '0 4px 12px rgba(0,0,0,0.15)',
                            whiteSpace: 'nowrap' as const,
                        };

                    const label = overlay.content || overlay.text || 'Button';

                    // LINE icon SVG
                    const lineIcon = template?.icon === 'line' ? (
                        <svg viewBox="0 0 24 24" fill="currentColor" style={{ height: '1em', width: '1em', marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }}>
                            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                        </svg>
                    ) : null;

                    const buttonContent = (
                        <div
                            style={buttonStyle}
                            className={isPulse ? 'animate-pulse' : undefined}
                        >
                            {lineIcon}{label}
                        </div>
                    );

                    // アクションリンク
                    const action = overlay.action;
                    if (action?.url) {
                        const isExternal = action.type === 'external' || action.type === 'line';
                        const href = action.type === 'anchor' && !action.url.startsWith('#')
                            ? `#${action.url}`
                            : action.url;

                        return (
                            <a
                                key={overlay.id}
                                href={href}
                                target={isExternal ? '_blank' : undefined}
                                rel={isExternal ? 'noopener noreferrer' : undefined}
                                style={{ textDecoration: 'none' }}
                            >
                                {buttonContent}
                            </a>
                        );
                    }

                    // リンクなし or 旧形式のlink
                    if (overlay.link) {
                        return (
                            <Link
                                key={overlay.id}
                                href={overlay.link}
                                target={overlay.link.startsWith('http') ? '_blank' : undefined}
                                rel={overlay.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                            >
                                {buttonContent}
                            </Link>
                        );
                    }

                    return <div key={overlay.id}>{buttonContent}</div>;
                }

                return null;
            })}
        </>
    );
}
