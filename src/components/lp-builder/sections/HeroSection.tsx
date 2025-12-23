'use client';

import React from 'react';

export interface HeroData {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaLink: string;
  backgroundImage?: string;
  backgroundColor: string;
}

interface HeroSectionProps {
  data?: HeroData;
  onChange?: (data: HeroData) => void;
  onImageClick?: (type: 'background') => void;
}

const defaultData: HeroData = {
  headline: 'あなたのビジネスを次のレベルへ',
  subheadline: '革新的なソリューションで、成長を加速させましょう。今すぐ始めて、競合に差をつけましょう。',
  ctaText: '無料で始める',
  ctaLink: '#',
  backgroundColor: '#1e40af',
};

export function HeroSection({
  data = defaultData,
  onChange,
  onImageClick
}: HeroSectionProps) {
  const handleTextChange = (field: keyof HeroData, value: string) => {
    if (onChange) {
      onChange({ ...data, [field]: value });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>, field: keyof HeroData) => {
    const value = e.currentTarget.textContent || '';
    handleTextChange(field, value);
  };

  return (
    <section
      className="relative min-h-[600px] flex items-center justify-center overflow-hidden"
      style={{
        backgroundColor: data.backgroundColor,
        backgroundImage: data.backgroundImage ? `url(${data.backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Background Image Click Area */}
      {onImageClick && (
        <button
          onClick={() => onImageClick('background')}
          className="absolute top-4 right-4 z-10 bg-white/90 hover:bg-white px-4 py-2 rounded-lg shadow-lg transition-all text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          背景画像を変更
        </button>
      )}

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <h1
          contentEditable={!!onChange}
          suppressContentEditableWarning
          onBlur={(e) => handleBlur(e, 'headline')}
          className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight outline-none focus:ring-2 focus:ring-white/50 rounded px-4 py-2 transition-all"
        >
          {data.headline}
        </h1>

        <p
          contentEditable={!!onChange}
          suppressContentEditableWarning
          onBlur={(e) => handleBlur(e, 'subheadline')}
          className="text-xl md:text-2xl text-white/90 mb-10 max-w-2xl mx-auto outline-none focus:ring-2 focus:ring-white/50 rounded px-4 py-2 transition-all"
        >
          {data.subheadline}
        </p>

        <div className="inline-block">
          <a
            href={data.ctaLink}
            className="group inline-block bg-white text-blue-700 hover:bg-blue-50 px-8 py-4 rounded-full text-lg font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all"
          >
            <span
              contentEditable={!!onChange}
              suppressContentEditableWarning
              onBlur={(e) => handleBlur(e, 'ctaText')}
              className="outline-none"
            >
              {data.ctaText}
            </span>
            <span className="ml-2 inline-block group-hover:translate-x-1 transition-transform">→</span>
          </a>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/20 to-transparent" />
    </section>
  );
}
