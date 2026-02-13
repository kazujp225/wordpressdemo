import type React from 'react';

// CTA Button Template definitions
// Shared between admin editor and public rendering
// future: industry-specific templates
// future: A/B testing support

export interface CTATemplate {
    name: string;
    label: string;
    background: string;
    color: string;
    borderRadius: string;
    fontWeight: string;
    padding: string;
    fontSize: number;
    animation: 'none' | 'pulse';
    border?: string;
    icon?: 'line';
    positionMode?: 'absolute' | 'fixed_bottom';
}

export const CTA_TEMPLATES: Record<string, CTATemplate> = {
    basic_solid: {
        name: 'ベーシック',
        label: '今すぐ申し込む',
        background: '#2563eb',
        color: '#ffffff',
        borderRadius: '8px',
        fontWeight: 'bold',
        padding: '14px 32px',
        fontSize: 16,
        animation: 'none',
    },
    pill_soft: {
        name: 'やわらかピル',
        label: 'お問い合わせ',
        background: '#f59e0b',
        color: '#ffffff',
        borderRadius: '999px',
        fontWeight: 'bold',
        padding: '12px 36px',
        fontSize: 15,
        animation: 'none',
    },
    gradient_strong: {
        name: 'グラデーション',
        label: '無料で始める',
        background: 'linear-gradient(135deg, #ef4444, #f97316)',
        color: '#ffffff',
        borderRadius: '12px',
        fontWeight: 'bold',
        padding: '16px 40px',
        fontSize: 17,
        animation: 'none',
    },
    gradient_pulse: {
        name: 'パルスグラデ',
        label: '期間限定！申し込む',
        background: 'linear-gradient(90deg, #4f46e5, #9333ea)',
        color: '#ffffff',
        borderRadius: '999px',
        fontWeight: 'bold',
        padding: '14px 36px',
        fontSize: 16,
        animation: 'pulse',
    },
    outline_simple: {
        name: 'アウトライン',
        label: '詳しく見る',
        background: 'transparent',
        color: '#1f2937',
        borderRadius: '8px',
        fontWeight: '600',
        padding: '12px 28px',
        fontSize: 15,
        border: '2px solid #1f2937',
        animation: 'none',
    },
    line_green: {
        name: 'LINE風',
        label: 'LINEで相談する',
        background: '#06C755',
        color: '#ffffff',
        borderRadius: '999px',
        fontWeight: 'bold',
        padding: '14px 32px',
        fontSize: 15,
        icon: 'line',
        animation: 'none',
    },
    icon_arrow: {
        name: '矢印付き',
        label: '今すぐチェック →',
        background: '#111827',
        color: '#ffffff',
        borderRadius: '8px',
        fontWeight: 'bold',
        padding: '14px 32px',
        fontSize: 15,
        animation: 'none',
    },
    fixed_bottom_bar: {
        name: '固定バー',
        label: 'お申し込みはこちら',
        background: '#dc2626',
        color: '#ffffff',
        borderRadius: '0px',
        fontWeight: 'bold',
        padding: '16px 40px',
        fontSize: 16,
        animation: 'none',
        positionMode: 'fixed_bottom',
    },
};

// Helper: get CSS style object from template
export function getTemplateStyle(templateId: string): React.CSSProperties {
    const t = CTA_TEMPLATES[templateId];
    if (!t) return {};

    const isGradient = t.background.includes('gradient');

    return {
        background: isGradient ? t.background : undefined,
        backgroundColor: isGradient ? undefined : t.background,
        color: t.color,
        borderRadius: t.borderRadius,
        fontWeight: t.fontWeight,
        padding: t.padding,
        fontSize: `${t.fontSize}px`,
        border: t.border || 'none',
        boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
        cursor: 'pointer',
        display: 'inline-block',
        textAlign: 'center' as const,
        textDecoration: 'none',
        whiteSpace: 'nowrap' as const,
    };
}
