'use client';

import React from 'react';

export interface Feature {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface FeaturesData {
  heading: string;
  subheading: string;
  features: Feature[];
  backgroundColor: string;
}

interface FeaturesSectionProps {
  data?: FeaturesData;
  onChange?: (data: FeaturesData) => void;
  onImageClick?: (featureId: string) => void;
}

const defaultData: FeaturesData = {
  heading: '選ばれる理由',
  subheading: '私たちのサービスが提供する、他にはない価値',
  backgroundColor: '#ffffff',
  features: [
    {
      id: '1',
      icon: '⚡',
      title: '高速パフォーマンス',
      description: '最新技術により、驚異的なスピードで動作します。待ち時間なく、スムーズな体験を提供します。',
    },
    {
      id: '2',
      icon: '🔒',
      title: '安全なセキュリティ',
      description: 'エンタープライズグレードのセキュリティで、お客様のデータを確実に保護します。',
    },
    {
      id: '3',
      icon: '🎯',
      title: '簡単な操作',
      description: '直感的なインターフェースで、誰でもすぐに使いこなせます。専門知識は不要です。',
    },
    {
      id: '4',
      icon: '📈',
      title: '成長をサポート',
      description: 'ビジネスの拡大に合わせて柔軟にスケール。将来を見据えた設計で安心です。',
    },
  ],
};

export function FeaturesSection({
  data = defaultData,
  onChange,
  onImageClick
}: FeaturesSectionProps) {
  const handleTextChange = (field: keyof FeaturesData, value: string) => {
    if (onChange) {
      onChange({ ...data, [field]: value });
    }
  };

  const handleFeatureChange = (featureId: string, field: keyof Feature, value: string) => {
    if (onChange) {
      const updatedFeatures = data.features.map(f =>
        f.id === featureId ? { ...f, [field]: value } : f
      );
      onChange({ ...data, features: updatedFeatures });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>, field: keyof FeaturesData) => {
    const value = e.currentTarget.textContent || '';
    handleTextChange(field, value);
  };

  const handleFeatureBlur = (
    e: React.FocusEvent<HTMLElement>,
    featureId: string,
    field: keyof Feature
  ) => {
    const value = e.currentTarget.textContent || '';
    handleFeatureChange(featureId, field, value);
  };

  return (
    <section
      className="py-20 px-6"
      style={{ backgroundColor: data.backgroundColor }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2
            contentEditable={!!onChange}
            suppressContentEditableWarning
            onBlur={(e) => handleBlur(e, 'heading')}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 outline-none focus:ring-2 focus:ring-blue-500 rounded px-4 py-2 inline-block transition-all"
          >
            {data.heading}
          </h2>
          <p
            contentEditable={!!onChange}
            suppressContentEditableWarning
            onBlur={(e) => handleBlur(e, 'subheading')}
            className="text-xl text-gray-600 max-w-2xl mx-auto outline-none focus:ring-2 focus:ring-blue-500 rounded px-4 py-2 transition-all"
          >
            {data.subheading}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {data.features.map((feature) => (
            <div
              key={feature.id}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              {/* Icon */}
              <div className="text-5xl mb-4 flex items-center justify-center h-20">
                {onImageClick ? (
                  <button
                    onClick={() => onImageClick(feature.id)}
                    className="hover:scale-110 transition-transform outline-none focus:ring-2 focus:ring-blue-500 rounded"
                  >
                    <span
                      contentEditable={!!onChange}
                      suppressContentEditableWarning
                      onBlur={(e) => handleFeatureBlur(e, feature.id, 'icon')}
                      className="outline-none"
                    >
                      {feature.icon}
                    </span>
                  </button>
                ) : (
                  <span
                    contentEditable={!!onChange}
                    suppressContentEditableWarning
                    onBlur={(e) => handleFeatureBlur(e, feature.id, 'icon')}
                    className="outline-none focus:ring-2 focus:ring-blue-500 rounded"
                  >
                    {feature.icon}
                  </span>
                )}
              </div>

              {/* Title */}
              <h3
                contentEditable={!!onChange}
                suppressContentEditableWarning
                onBlur={(e) => handleFeatureBlur(e, feature.id, 'title')}
                className="text-xl font-bold text-gray-900 mb-3 outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 transition-all"
              >
                {feature.title}
              </h3>

              {/* Description */}
              <p
                contentEditable={!!onChange}
                suppressContentEditableWarning
                onBlur={(e) => handleFeatureBlur(e, feature.id, 'description')}
                className="text-gray-600 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 transition-all"
              >
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
