'use client';

import React from 'react';

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar?: string;
  text: string;
  rating: number;
}

export interface TestimonialsData {
  heading: string;
  subheading: string;
  testimonials: Testimonial[];
  backgroundColor: string;
}

interface TestimonialsSectionProps {
  data?: TestimonialsData;
  onChange?: (data: TestimonialsData) => void;
  onImageClick?: (testimonialId: string) => void;
}

const defaultData: TestimonialsData = {
  heading: 'お客様の声',
  subheading: '多くの企業に選ばれている理由',
  backgroundColor: '#f9fafb',
  testimonials: [
    {
      id: '1',
      name: '山田 太郎',
      role: 'CEO',
      company: '株式会社テックスタート',
      text: 'このサービスを導入してから、業務効率が3倍になりました。特にチーム全体での情報共有がスムーズになり、プロジェクトの進行が格段に早くなりました。サポート体制も素晴らしく、安心して使い続けられます。',
      rating: 5,
    },
    {
      id: '2',
      name: '佐藤 花子',
      role: 'マーケティング部長',
      company: 'デジタルマーケティング株式会社',
      text: '直感的なUIで、チームメンバー全員がすぐに使いこなせました。以前使っていたツールと比べて、コストも半分以下に抑えられています。ROIも十分に達成できており、大満足です。',
      rating: 5,
    },
    {
      id: '3',
      name: '鈴木 一郎',
      role: 'プロダクトマネージャー',
      company: 'イノベーション株式会社',
      text: 'カスタマイズ性の高さが決め手でした。自社の業務フローに完璧にフィットするよう調整でき、他のツールとの連携も簡単です。導入後、顧客満足度が20%向上しました。',
      rating: 5,
    },
    {
      id: '4',
      name: '田中 美咲',
      role: '事業部長',
      company: 'グローバルソリューションズ',
      text: 'グローバル展開している当社にとって、多言語対応とセキュリティは必須でした。このサービスは両方を完璧に満たしており、世界中の拠点で安心して使用できています。',
      rating: 5,
    },
    {
      id: '5',
      name: '高橋 健太',
      role: 'スタートアップファウンダー',
      company: 'ベンチャーテック株式会社',
      text: '少人数のスタートアップでも手が届く価格設定が助かります。機能は大企業向けのツールに引けを取らず、成長に合わせてスケールできる点も魅力的です。',
      rating: 5,
    },
    {
      id: '6',
      name: '伊藤 智子',
      role: 'プロジェクトリーダー',
      company: 'コンサルティング株式会社',
      text: 'クライアントとの情報共有に活用しています。セキュアな環境で、リアルタイムにコラボレーションできるため、プロジェクトの透明性が大幅に向上しました。',
      rating: 5,
    },
  ],
};

export function TestimonialsSection({
  data = defaultData,
  onChange,
  onImageClick
}: TestimonialsSectionProps) {
  const handleTextChange = (field: keyof TestimonialsData, value: string) => {
    if (onChange) {
      onChange({ ...data, [field]: value });
    }
  };

  const handleTestimonialChange = (
    testimonialId: string,
    field: keyof Testimonial,
    value: string | number
  ) => {
    if (onChange) {
      const updatedTestimonials = data.testimonials.map(t =>
        t.id === testimonialId ? { ...t, [field]: value } : t
      );
      onChange({ ...data, testimonials: updatedTestimonials });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>, field: keyof TestimonialsData) => {
    const value = e.currentTarget.textContent || '';
    handleTextChange(field, value);
  };

  const handleTestimonialBlur = (
    e: React.FocusEvent<HTMLElement>,
    testimonialId: string,
    field: keyof Testimonial
  ) => {
    const value = e.currentTarget.textContent || '';
    handleTestimonialChange(testimonialId, field, value);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <svg
            key={i}
            className={`w-5 h-5 ${
              i < rating ? 'text-yellow-400' : 'text-gray-300'
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
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

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {data.testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              {/* Rating */}
              <div className="mb-4">{renderStars(testimonial.rating)}</div>

              {/* Testimonial Text */}
              <p
                contentEditable={!!onChange}
                suppressContentEditableWarning
                onBlur={(e) => handleTestimonialBlur(e, testimonial.id, 'text')}
                className="text-gray-700 leading-relaxed mb-6 outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 transition-all"
              >
                {testimonial.text}
              </p>

              {/* Author Info */}
              <div className="flex items-center gap-4 pt-6 border-t border-gray-100">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {testimonial.avatar ? (
                    <button
                      onClick={() => onImageClick?.(testimonial.id)}
                      className="w-12 h-12 rounded-full overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
                    >
                      <img
                        src={testimonial.avatar}
                        alt={testimonial.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <button
                      onClick={() => onImageClick?.(testimonial.id)}
                      className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold hover:ring-2 hover:ring-blue-500 transition-all"
                    >
                      {testimonial.name.charAt(0)}
                    </button>
                  )}
                </div>

                {/* Name and Role */}
                <div className="flex-1 min-w-0">
                  <h4
                    contentEditable={!!onChange}
                    suppressContentEditableWarning
                    onBlur={(e) => handleTestimonialBlur(e, testimonial.id, 'name')}
                    className="font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                  >
                    {testimonial.name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    <span
                      contentEditable={!!onChange}
                      suppressContentEditableWarning
                      onBlur={(e) => handleTestimonialBlur(e, testimonial.id, 'role')}
                      className="outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                    >
                      {testimonial.role}
                    </span>
                    {' / '}
                    <span
                      contentEditable={!!onChange}
                      suppressContentEditableWarning
                      onBlur={(e) => handleTestimonialBlur(e, testimonial.id, 'company')}
                      className="outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                    >
                      {testimonial.company}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Badge */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-4">10,000社以上の企業に選ばれています</p>
          <div className="flex flex-wrap justify-center gap-8 items-center opacity-60">
            <div className="text-2xl font-bold text-gray-400">Company A</div>
            <div className="text-2xl font-bold text-gray-400">Company B</div>
            <div className="text-2xl font-bold text-gray-400">Company C</div>
            <div className="text-2xl font-bold text-gray-400">Company D</div>
          </div>
        </div>
      </div>
    </section>
  );
}
