"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Monitor, Smartphone } from 'lucide-react';
import type { ClickableArea } from '@/types';

interface Section {
    id: string;
    role: string;
    image?: { filePath: string };
    mobileImage?: { filePath: string };
    config?: string | Record<string, unknown>;
}

interface PageData {
    sections: Section[];
}

export default function PagePreviewPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const pageId = params.id as string;

    const [pageData, setPageData] = useState<PageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>(
        (searchParams.get('mode') as 'desktop' | 'mobile') || 'desktop'
    );
    const [showControls, setShowControls] = useState(true);

    useEffect(() => {
        const fetchPage = async () => {
            try {
                const res = await fetch(`/api/pages/${pageId}`);
                if (res.ok) {
                    const data = await res.json();
                    setPageData(data);
                }
            } catch (e) {
                console.error('Failed to fetch page:', e);
            }
            setIsLoading(false);
        };
        fetchPage();
    }, [pageId]);

    // Auto-hide controls after 3 seconds
    useEffect(() => {
        if (showControls) {
            const timer = setTimeout(() => setShowControls(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showControls]);

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

    if (!pageData || pageData.sections.length === 0) {
        return (
            <>
                <style>{`body, html { margin: 0 !important; padding: 0 !important; overflow-x: hidden; }`}</style>
                <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">No Page Data</h1>
                        <p className="text-gray-500">Page not found or has no sections.</p>
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
                    background: ${viewMode === 'mobile' ? '#f3f4f6' : '#fff'};
                }
                img {
                    display: block;
                    max-width: 100%;
                }
            `}</style>

            {/* Floating Controls */}
            <div
                className={`fixed top-4 right-4 z-50 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
                onMouseEnter={() => setShowControls(true)}
            >
                <div className="flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
                    <button
                        onClick={() => setViewMode('desktop')}
                        className={`p-2 rounded-full transition-colors ${viewMode === 'desktop' ? 'bg-white text-black' : 'text-white hover:bg-white/20'}`}
                        title="Desktop"
                    >
                        <Monitor className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setViewMode('mobile')}
                        className={`p-2 rounded-full transition-colors ${viewMode === 'mobile' ? 'bg-white text-black' : 'text-white hover:bg-white/20'}`}
                        title="Mobile"
                    >
                        <Smartphone className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Preview Content */}
            <div
                className={`min-h-screen ${viewMode === 'mobile' ? 'flex justify-center py-8 bg-gray-100' : ''}`}
                onClick={() => setShowControls(true)}
            >
                <div
                    className={viewMode === 'mobile' ? 'w-[390px] bg-white shadow-2xl rounded-3xl overflow-hidden' : 'w-full'}
                    style={viewMode === 'mobile' ? { maxHeight: '844px' } : {}}
                >
                    {pageData.sections.map((section) => {
                        // Get the appropriate image based on view mode
                        const imagePath = viewMode === 'mobile' && section.mobileImage
                            ? section.mobileImage.filePath
                            : section.image?.filePath;

                        // Parse clickable areas from config (handle both string and object)
                        let clickableAreas: ClickableArea[] = [];
                        try {
                            if (section.config) {
                                // configが文字列の場合はパース、オブジェクトの場合はそのまま使用
                                const parsed = typeof section.config === 'string'
                                    ? JSON.parse(section.config)
                                    : section.config;
                                // LP Builderからの保存形式: properties.clickableAreas または clickableAreas
                                clickableAreas = parsed.properties?.clickableAreas || parsed.clickableAreas || [];
                                console.log(`[Preview] Section ${section.role} config:`, parsed, 'clickableAreas:', clickableAreas);
                            }
                        } catch (e) {
                            console.error(`[Preview] Failed to parse config for section ${section.role}:`, e);
                        }

                        if (!imagePath) {
                            return (
                                <div key={section.id} className="flex h-48 items-center justify-center bg-gray-100 text-gray-400">
                                    Section: {section.role} (No image)
                                </div>
                            );
                        }

                        return (
                            <div key={section.id} className="relative" style={{ margin: 0, padding: 0, lineHeight: 0 }}>
                                <img
                                    src={imagePath}
                                    alt={section.role}
                                    style={{
                                        width: '100%',
                                        height: 'auto',
                                        display: 'block',
                                        margin: 0,
                                        padding: 0,
                                    }}
                                />
                                {/* Clickable Areas (CTA) - 常に表示（デバッグ用に薄い枠線） */}
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
                                            key={area.id || idx}
                                            href={getHref()}
                                            target={isExternal ? '_blank' : '_self'}
                                            rel={isExternal ? 'noopener noreferrer' : undefined}
                                            className="absolute cursor-pointer bg-blue-500/5 hover:bg-blue-500/20 transition-colors border border-blue-400/50 hover:border-blue-500"
                                            style={{
                                                left: `${area.x * 100}%`,
                                                top: `${area.y * 100}%`,
                                                width: `${area.width * 100}%`,
                                                height: `${area.height * 100}%`,
                                            }}
                                            title={area.label || `Button ${idx + 1}`}
                                        >
                                            {/* ラベル表示 */}
                                            <span className="absolute bottom-full left-0 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-t whitespace-nowrap">
                                                {area.label || `CTA ${idx + 1}`}
                                            </span>
                                        </a>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
