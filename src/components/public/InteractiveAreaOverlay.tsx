"use client";

import React, { useState } from 'react';
import { FormInputModal } from './FormInputModal';
import type { ClickableArea } from '@/types';

interface InteractiveAreaOverlayProps {
    areas: ClickableArea[];
    pageSlug: string;
}

export function InteractiveAreaOverlay({ areas, pageSlug }: InteractiveAreaOverlayProps) {
    const [selectedFormArea, setSelectedFormArea] = useState<ClickableArea | null>(null);

    const buildHref = (area: ClickableArea): string => {
        switch (area.actionType) {
            case 'email':
                return `mailto:${area.actionValue}`;
            case 'phone':
                return `tel:${area.actionValue.replace(/[-\s]/g, '')}`;
            case 'scroll':
                return area.actionValue.startsWith('#') ? area.actionValue : `#${area.actionValue}`;
            case 'url':
            default:
                return area.actionValue;
        }
    };

    return (
        <>
            <div className="absolute inset-0 z-30">
                {areas.map((area) => {
                    // フォーム入力タイプの場合はボタンとして表示
                    if (area.actionType === 'form-input') {
                        return (
                            <button
                                key={area.id}
                                onClick={() => setSelectedFormArea(area)}
                                title={area.label || area.formTitle || 'フォームを開く'}
                                className="absolute block cursor-pointer transition-all duration-200 hover:bg-blue-500/20 hover:ring-2 hover:ring-blue-400/50 rounded-sm"
                                style={{
                                    left: `${area.x * 100}%`,
                                    top: `${area.y * 100}%`,
                                    width: `${area.width * 100}%`,
                                    height: `${area.height * 100}%`,
                                }}
                                aria-label={area.label || area.formTitle || 'Open form'}
                            />
                        );
                    }

                    // その他のタイプはリンクとして表示
                    // デバッグ用: 赤い枠線で可視化
                    console.log('Rendering CTA area:', area.id, area.actionValue, `${area.x * 100}%`, `${area.y * 100}%`);
                    return (
                        <a
                            key={area.id}
                            href={buildHref(area)}
                            target={area.actionType === 'url' && !area.actionValue.startsWith('#') && !area.actionValue.startsWith('/') ? '_blank' : undefined}
                            rel={area.actionType === 'url' && !area.actionValue.startsWith('#') && !area.actionValue.startsWith('/') ? 'noopener noreferrer' : undefined}
                            title={area.label}
                            className="absolute block cursor-pointer transition-all duration-200 hover:bg-blue-500/30 rounded-sm border-2 border-red-500 bg-red-500/20"
                            style={{
                                left: `${area.x * 100}%`,
                                top: `${area.y * 100}%`,
                                width: `${area.width * 100}%`,
                                height: `${area.height * 100}%`,
                            }}
                            aria-label={area.label || 'Interactive button'}
                        />
                    );
                })}
            </div>

            {/* Form Modal */}
            {selectedFormArea && (
                <FormInputModal
                    area={selectedFormArea}
                    pageSlug={pageSlug}
                    onClose={() => setSelectedFormArea(null)}
                />
            )}
        </>
    );
}
