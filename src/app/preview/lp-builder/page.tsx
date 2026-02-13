"use client";

import React, { useState, useEffect } from 'react';
import type { LPSection, ClickableArea } from '@/types';

interface HeaderConfig {
    logoText: string;
    navItems: { label: string; href: string }[];
    ctaText: string;
    ctaLink: string;
    sticky: boolean;
}

export default function LPPreviewPage() {
    const [sections, setSections] = useState<LPSection[]>([]);
    const [headerConfig, setHeaderConfig] = useState<HeaderConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Get preview data from localStorage
        const previewData = localStorage.getItem('lp-builder-preview');
        if (previewData) {
            try {
                const parsed = JSON.parse(previewData);
                setSections(parsed.sections || []);
                setHeaderConfig(parsed.headerConfig || null);
            } catch (e) {
                console.error('Failed to parse preview data:', e);
            }
        }
        setIsLoading(false);
    }, []);

    if (isLoading) {
        return (
            <>
                <style>{`body, html { margin: 0 !important; padding: 0 !important; overflow-x: hidden; }`}</style>
                <div className="fixed inset-0 flex items-center justify-center bg-white">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
            </>
        );
    }

    if (sections.length === 0) {
        return (
            <>
                <style>{`body, html { margin: 0 !important; padding: 0 !important; overflow-x: hidden; }`}</style>
                <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">No Preview Data</h1>
                        <p className="text-gray-500">Please open preview from OTASUKE！なんでもしゅうせいくん.</p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <style>{`
                body, html {
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow-x: hidden;
                    width: 100%;
                }
                img {
                    display: block;
                    max-width: 100%;
                }
            `}</style>
            <div style={{ margin: 0, padding: 0, width: '100%' }}>
                {/* Header */}
                {headerConfig && (
                    <header
                        className={`${headerConfig.sticky ? 'sticky top-0' : 'relative'} z-50 flex h-16 items-center justify-between bg-white/90 px-4 shadow-sm backdrop-blur-md md:px-8`}
                    >
                        <div className="text-xl font-bold text-gray-900">{headerConfig.logoText}</div>
                        <nav className="hidden md:flex gap-6">
                            {headerConfig.navItems && headerConfig.navItems.length > 0 ? (
                                headerConfig.navItems.map((item, idx) => (
                                    <a
                                        key={idx}
                                        href={item.href}
                                        className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                                    >
                                        {item.label}
                                    </a>
                                ))
                            ) : (
                                <>
                                    <a href="#hero" className="text-sm font-medium text-gray-700 hover:text-blue-600">トップ</a>
                                    <a href="#contact" className="text-sm font-medium text-gray-700 hover:text-blue-600">お問い合わせ</a>
                                </>
                            )}
                        </nav>
                        <a
                            href={headerConfig.ctaLink || '#contact'}
                            className="rounded-full bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                        >
                            {headerConfig.ctaText || 'お問い合わせ'}
                        </a>
                    </header>
                )}

                {sections.map((section) => {
                    const clickableAreas = (section.properties.clickableAreas as ClickableArea[] | undefined) || [];
                    return (
                        <div
                            key={section.id}
                            className="relative"
                            style={{
                                backgroundColor: section.properties.backgroundColor as string,
                                color: section.properties.textColor as string,
                                margin: 0,
                                padding: 0,
                            }}
                        >
                            {section.properties.image ? (
                                <div className="relative" style={{ margin: 0, padding: 0, lineHeight: 0 }}>
                                    <img
                                        src={section.properties.image as string}
                                        alt={section.properties.title as string || 'Section'}
                                        style={{
                                            width: '100%',
                                            height: 'auto',
                                            display: 'block',
                                            margin: 0,
                                            padding: 0,
                                        }}
                                    />
                                    {/* Clickable Areas */}
                                    {clickableAreas.map((area, idx) => {
                                        const getHref = () => {
                                            switch (area.actionType) {
                                                case 'url': return area.actionValue || '#';
                                                case 'email': return `mailto:${area.actionValue}`;
                                                case 'phone': return `tel:${area.actionValue}`;
                                                case 'scroll': return `#${area.actionValue}`;
                                                default: return '#';
                                            }
                                        };
                                        const isExternal = area.actionType === 'url' && area.actionValue?.startsWith('http');
                                        return (
                                            <a
                                                key={area.id}
                                                href={getHref()}
                                                target={isExternal ? '_blank' : '_self'}
                                                rel={isExternal ? 'noopener noreferrer' : undefined}
                                                className="absolute cursor-pointer hover:bg-black/5 transition-colors"
                                                style={{
                                                    left: `${area.x * 100}%`,
                                                    top: `${area.y * 100}%`,
                                                    width: `${area.width * 100}%`,
                                                    height: `${area.height * 100}%`,
                                                }}
                                                title={area.label || `Button ${idx + 1}`}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="px-6 py-20 lg:px-20 text-center">
                                    <div className="max-w-4xl mx-auto">
                                        <h2 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight">
                                            {section.properties.title}
                                        </h2>
                                        <p className="text-xl opacity-80 mb-8 font-light">
                                            {section.properties.subtitle}
                                        </p>
                                        <p className="max-w-2xl mx-auto leading-relaxed opacity-90">
                                            {section.properties.description}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );
}
