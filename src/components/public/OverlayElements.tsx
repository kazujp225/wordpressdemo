"use client";

import { useEffect, useRef, useState } from 'react';
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
    positionMode?: 'absolute' | 'fixed_bottom' | 'fixed_right' | 'fixed_left';
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
    /** Editor画面でのレンダリング基準幅（px）。省略時はスケーリングなし */
    editorBaseWidth?: number;
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

export function OverlayElements({ overlays, editorBaseWidth }: OverlayElementsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        if (!editorBaseWidth || !containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const w = entry.contentRect.width;
                if (w > 0) setScale(w / editorBaseWidth);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [editorBaseWidth]);

    // ピクセル値をスケーリングするヘルパー
    const scalePx = (val: number | undefined, fallback: number) => {
        const v = val ?? fallback;
        return `${Math.round(v * scale)}px`;
    };
    const scalePadding = (padding: string | undefined, fallback: string) => {
        const p = padding || fallback;
        return p.replace(/(\d+)px/g, (_, n) => `${Math.round(parseInt(n) * scale)}px`);
    };

    return (
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
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
                        fontSize: scalePx(overlay.fontSize, 16),
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
                    const posMode = overlay.positionMode || template?.positionMode || 'absolute';
                    const isFixed = posMode.startsWith('fixed_');
                    const animClass = template?.animation === 'pulse' ? 'animate-pulse'
                        : template?.animation === 'bounce' ? 'animate-bounce' : undefined;

                    // テンプレートベースのスタイルを取得
                    const tplStyle = template ? getTemplateStyle(overlay.template!) : null;
                    // フォントサイズ/パディング/角丸をスケーリング（固定配置はスケーリングしない）
                    const btnFontSize = overlay.style?.fontSize ?? (tplStyle ? parseInt(String(tplStyle.fontSize)) : 16);
                    const btnPadding = overlay.style?.padding ?? (tplStyle ? String(tplStyle.padding) : '12px 24px');
                    const btnBorderRadius = overlay.style?.borderRadius ?? (template ? parseInt(template.borderRadius) : 8);

                    // 固定配置用のスタイル
                    const fixedPositionStyles: Record<string, React.CSSProperties> = {
                        fixed_bottom: { position: 'fixed', bottom: 0, left: 0, right: 0, width: '100%', zIndex: 50, borderRadius: 0, textAlign: 'center' as const },
                        fixed_right: { position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)', writingMode: 'vertical-rl', zIndex: 50, textAlign: 'center' as const },
                        fixed_left: { position: 'fixed', left: 0, top: '50%', transform: 'translateY(-50%)', writingMode: 'vertical-rl', zIndex: 50, textAlign: 'center' as const },
                    };

                    // テンプレートスタイル or カスタムスタイル（スケーリング対応）
                    const buttonStyle: React.CSSProperties = template
                        ? {
                            ...tplStyle,
                            fontSize: isFixed ? `${btnFontSize}px` : scalePx(btnFontSize, 16),
                            borderRadius: isFixed ? tplStyle?.borderRadius : scalePx(btnBorderRadius, 8),
                            padding: isFixed ? btnPadding : scalePadding(btnPadding, '12px 24px'),
                            ...(isFixed
                                ? fixedPositionStyles[posMode]
                                : { ...style, width: 'auto' }
                            ),
                        }
                        : {
                            ...(isFixed
                                ? fixedPositionStyles[posMode]
                                : { ...style, width: 'auto' }
                            ),
                            backgroundColor: overlay.style?.backgroundColor || '#6366f1',
                            color: overlay.style?.textColor || '#ffffff',
                            borderRadius: isFixed ? `${btnBorderRadius}px` : scalePx(btnBorderRadius, 8),
                            fontSize: isFixed ? `${btnFontSize}px` : scalePx(btnFontSize, 16),
                            fontWeight: overlay.style?.fontWeight,
                            padding: isFixed ? btnPadding : scalePadding(btnPadding, '12px 24px'),
                            border: overlay.style?.border,
                            boxShadow: overlay.style?.boxShadow || '0 4px 12px rgba(0,0,0,0.15)',
                            whiteSpace: 'nowrap' as const,
                        };

                    const label = overlay.content || overlay.text || 'Button';

                    // Icon SVGs
                    const iconStyle = { height: '1em', width: '1em', marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' };
                    const templateIcon = template?.icon === 'line' ? (
                        <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle}>
                            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                        </svg>
                    ) : template?.icon === 'phone' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
                            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                        </svg>
                    ) : template?.icon === 'mail' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/>
                        </svg>
                    ) : null;

                    const buttonContent = (
                        <div
                            style={buttonStyle}
                            className={animClass}
                        >
                            {templateIcon}{label}
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
        </div>
    );
}
