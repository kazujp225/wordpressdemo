'use client';

import React from 'react';

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
  ctaText: string;
  ctaLink: string;
}

export interface PricingData {
  heading: string;
  subheading: string;
  plans: PricingPlan[];
  backgroundColor: string;
}

interface PricingSectionProps {
  data?: PricingData;
  onChange?: (data: PricingData) => void;
  onImageClick?: () => void;
}

const defaultData: PricingData = {
  heading: 'シンプルな料金プラン',
  subheading: 'あなたのビジネスに最適なプランを選びましょう',
  backgroundColor: '#f9fafb',
  plans: [
    {
      id: '1',
      name: 'スタータープラン',
      price: '¥9,800',
      period: '月',
      description: '個人や小規模チームに最適',
      features: [
        '基本機能すべて利用可能',
        'ユーザー数 5名まで',
        'ストレージ 10GB',
        'メールサポート',
      ],
      highlighted: false,
      ctaText: '無料で試す',
      ctaLink: '#',
    },
    {
      id: '2',
      name: 'ビジネスプラン',
      price: '¥29,800',
      period: '月',
      description: '成長企業に最適な選択',
      features: [
        'すべての機能が使い放題',
        'ユーザー数 無制限',
        'ストレージ 100GB',
        '優先サポート',
        'カスタムドメイン',
        '高度な分析機能',
      ],
      highlighted: true,
      ctaText: '今すぐ始める',
      ctaLink: '#',
    },
    {
      id: '3',
      name: 'エンタープライズ',
      price: 'お問い合わせ',
      period: '',
      description: '大企業向けカスタムソリューション',
      features: [
        'すべてのビジネスプラン機能',
        '無制限のストレージ',
        '専任サポート担当',
        'SLA保証',
        'カスタム統合',
        'セキュリティ監査',
      ],
      highlighted: false,
      ctaText: '相談する',
      ctaLink: '#',
    },
  ],
};

export function PricingSection({
  data = defaultData,
  onChange,
}: PricingSectionProps) {
  const handleTextChange = (field: keyof PricingData, value: string) => {
    if (onChange) {
      onChange({ ...data, [field]: value });
    }
  };

  const handlePlanChange = (planId: string, field: keyof PricingPlan, value: string) => {
    if (onChange) {
      const updatedPlans = data.plans.map(p =>
        p.id === planId ? { ...p, [field]: value } : p
      );
      onChange({ ...data, plans: updatedPlans });
    }
  };

  const handleFeatureChange = (planId: string, featureIndex: number, value: string) => {
    if (onChange) {
      const updatedPlans = data.plans.map(p => {
        if (p.id === planId) {
          const updatedFeatures = [...p.features];
          updatedFeatures[featureIndex] = value;
          return { ...p, features: updatedFeatures };
        }
        return p;
      });
      onChange({ ...data, plans: updatedPlans });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>, field: keyof PricingData) => {
    const value = e.currentTarget.textContent || '';
    handleTextChange(field, value);
  };

  const handlePlanBlur = (
    e: React.FocusEvent<HTMLElement>,
    planId: string,
    field: keyof PricingPlan
  ) => {
    const value = e.currentTarget.textContent || '';
    handlePlanChange(planId, field, value);
  };

  const handleFeatureBlur = (
    e: React.FocusEvent<HTMLElement>,
    planId: string,
    featureIndex: number
  ) => {
    const value = e.currentTarget.textContent || '';
    handleFeatureChange(planId, featureIndex, value);
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

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {data.plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl p-8 transition-all transform hover:-translate-y-2 ${
                plan.highlighted
                  ? 'bg-blue-600 text-white shadow-2xl scale-105 ring-4 ring-blue-300'
                  : 'bg-white text-gray-900 shadow-lg hover:shadow-xl'
              }`}
            >
              {/* Plan Name */}
              <h3
                contentEditable={!!onChange}
                suppressContentEditableWarning
                onBlur={(e) => handlePlanBlur(e, plan.id, 'name')}
                className={`text-2xl font-bold mb-2 outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 transition-all ${
                  plan.highlighted ? 'text-white' : 'text-gray-900'
                }`}
              >
                {plan.name}
              </h3>

              {/* Description */}
              <p
                contentEditable={!!onChange}
                suppressContentEditableWarning
                onBlur={(e) => handlePlanBlur(e, plan.id, 'description')}
                className={`mb-6 outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 transition-all ${
                  plan.highlighted ? 'text-blue-100' : 'text-gray-600'
                }`}
              >
                {plan.description}
              </p>

              {/* Price */}
              <div className="mb-8">
                <span
                  contentEditable={!!onChange}
                  suppressContentEditableWarning
                  onBlur={(e) => handlePlanBlur(e, plan.id, 'price')}
                  className="text-5xl font-bold outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                >
                  {plan.price}
                </span>
                {plan.period && (
                  <span
                    contentEditable={!!onChange}
                    suppressContentEditableWarning
                    onBlur={(e) => handlePlanBlur(e, plan.id, 'period')}
                    className={`ml-2 outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 ${
                      plan.highlighted ? 'text-blue-100' : 'text-gray-600'
                    }`}
                  >
                    / {plan.period}
                  </span>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <svg
                      className={`w-6 h-6 mr-3 flex-shrink-0 mt-0.5 ${
                        plan.highlighted ? 'text-blue-200' : 'text-green-500'
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span
                      contentEditable={!!onChange}
                      suppressContentEditableWarning
                      onBlur={(e) => handleFeatureBlur(e, plan.id, index)}
                      className="outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <a
                href={plan.ctaLink}
                className={`block w-full text-center px-6 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                  plan.highlighted
                    ? 'bg-white text-blue-600 hover:bg-blue-50 shadow-lg'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                }`}
              >
                <span
                  contentEditable={!!onChange}
                  suppressContentEditableWarning
                  onBlur={(e) => handlePlanBlur(e, plan.id, 'ctaText')}
                  className="outline-none"
                >
                  {plan.ctaText}
                </span>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
