'use client';

import React from 'react';

export interface CTAData {
  heading: string;
  subheading: string;
  primaryCtaText: string;
  primaryCtaLink: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  backgroundImage?: string;
  backgroundColor: string;
}

interface CTASectionProps {
  data?: CTAData;
  onChange?: (data: CTAData) => void;
  onImageClick?: (type: 'background') => void;
}

const defaultData: CTAData = {
  heading: '今すぐ始めましょう',
  subheading: '14日間の無料トライアルで、すべての機能をお試しください。クレジットカード不要、いつでもキャンセル可能です。',
  primaryCtaText: '無料で始める',
  primaryCtaLink: '#',
  secondaryCtaText: 'デモを見る',
  secondaryCtaLink: '#',
  backgroundColor: '#1e3a8a',
};

export function CTASection({
  data = defaultData,
  onChange,
  onImageClick
}: CTASectionProps) {
  const handleTextChange = (field: keyof CTAData, value: string) => {
    if (onChange) {
      onChange({ ...data, [field]: value });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>, field: keyof CTAData) => {
    const value = e.currentTarget.textContent || '';
    handleTextChange(field, value);
  };

  return (
    <section
      className="relative py-20 px-6 overflow-hidden"
      style={{
        backgroundColor: data.backgroundColor,
        backgroundImage: data.backgroundImage ? `url(${data.backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 to-purple-900/90" />

      {/* Background Image Click Area */}
      {onImageClick && (
        <button
          onClick={() => onImageClick('background')}
          className="absolute top-4 right-4 z-10 bg-white/90 hover:bg-white px-4 py-2 rounded-lg shadow-lg transition-all text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          背景画像を変更
        </button>
      )}

      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <h2
          contentEditable={!!onChange}
          suppressContentEditableWarning
          onBlur={(e) => handleBlur(e, 'heading')}
          className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight outline-none focus:ring-2 focus:ring-white/50 rounded px-4 py-2 inline-block transition-all"
        >
          {data.heading}
        </h2>

        <p
          contentEditable={!!onChange}
          suppressContentEditableWarning
          onBlur={(e) => handleBlur(e, 'subheading')}
          className="text-xl text-white/90 mb-10 max-w-2xl mx-auto leading-relaxed outline-none focus:ring-2 focus:ring-white/50 rounded px-4 py-2 transition-all"
        >
          {data.subheading}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href={data.primaryCtaLink}
            className="group inline-block bg-white text-blue-700 hover:bg-blue-50 px-8 py-4 rounded-full text-lg font-semibold shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all"
          >
            <span
              contentEditable={!!onChange}
              suppressContentEditableWarning
              onBlur={(e) => handleBlur(e, 'primaryCtaText')}
              className="outline-none"
            >
              {data.primaryCtaText}
            </span>
            <span className="ml-2 inline-block group-hover:translate-x-1 transition-transform">
              →
            </span>
          </a>

          {data.secondaryCtaText && (
            <a
              href={data.secondaryCtaLink}
              className="inline-block bg-transparent text-white hover:bg-white/10 border-2 border-white px-8 py-4 rounded-full text-lg font-semibold transform hover:scale-105 transition-all"
            >
              <span
                contentEditable={!!onChange}
                suppressContentEditableWarning
                onBlur={(e) => handleBlur(e, 'secondaryCtaText')}
                className="outline-none"
              >
                {data.secondaryCtaText}
              </span>
            </a>
          )}
        </div>

        {/* Trust Indicators */}
        <div className="mt-12 flex flex-wrap justify-center gap-8 text-white/80">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm">クレジットカード不要</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm">14日間無料</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm">いつでもキャンセル可</span>
          </div>
        </div>
      </div>
    </section>
  );
}
