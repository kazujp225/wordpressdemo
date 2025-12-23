"use client";

import React, { useState } from 'react';
import {
  Trash2,
  Sparkles,
  Plus,
  X,
  Upload,
  Image as ImageIcon,
  Type,
  Link as LinkIcon,
  Grid3x3,
  DollarSign,
  MessageSquare,
  Quote,
  Star,
  Palette
} from 'lucide-react';

interface Section {
  id: string;
  type: string;
  data: any;
}

interface Props {
  section: Section;
  onChange: (data: any) => void;
  onDelete: () => void;
  onAIGenerate: (field: string) => void;
}

export default function PropertiesPanel({ section, onChange, onDelete, onAIGenerate }: Props) {
  const [activeTab, setActiveTab] = useState<'content' | 'style'>('content');

  const updateData = (updates: any) => {
    onChange({ ...section.data, ...updates });
  };

  const updateStyleData = (updates: any) => {
    onChange({
      ...section.data,
      style: { ...section.data.style, ...updates }
    });
  };

  // Common style controls
  const renderStyleControls = () => (
    <div className="space-y-6">
      {/* Background Color */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
          背景色
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={section.data.style?.backgroundColor || '#ffffff'}
            onChange={(e) => updateStyleData({ backgroundColor: e.target.value })}
            className="h-10 w-20 rounded-lg border border-gray-200 cursor-pointer"
          />
          <input
            type="text"
            value={section.data.style?.backgroundColor || '#ffffff'}
            onChange={(e) => updateStyleData({ backgroundColor: e.target.value })}
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
            placeholder="#ffffff"
          />
        </div>
      </div>

      {/* Background Image */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
          背景画像
        </label>
        <div className="space-y-3">
          {section.data.style?.backgroundImage && (
            <div className="relative rounded-lg overflow-hidden border border-gray-200">
              <img
                src={section.data.style.backgroundImage}
                alt="Background"
                className="w-full h-32 object-cover"
              />
              <button
                onClick={() => updateStyleData({ backgroundImage: null })}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <button
            onClick={() => {
              // Trigger file upload - implement your upload logic
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = (e: any) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    updateStyleData({ backgroundImage: e.target?.result });
                  };
                  reader.readAsDataURL(file);
                }
              };
              input.click();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all"
          >
            <Upload className="h-4 w-4" />
            画像をアップロード
          </button>
        </div>
      </div>

      {/* Padding */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
          パディング (内側の余白)
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-gray-400 mb-1 block">上下</span>
            <input
              type="number"
              value={section.data.style?.paddingY || 0}
              onChange={(e) => updateStyleData({ paddingY: parseInt(e.target.value) || 0 })}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
          <div>
            <span className="text-xs text-gray-400 mb-1 block">左右</span>
            <input
              type="number"
              value={section.data.style?.paddingX || 0}
              onChange={(e) => updateStyleData({ paddingX: parseInt(e.target.value) || 0 })}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Margin */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
          マージン (外側の余白)
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-gray-400 mb-1 block">上下</span>
            <input
              type="number"
              value={section.data.style?.marginY || 0}
              onChange={(e) => updateStyleData({ marginY: parseInt(e.target.value) || 0 })}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
          <div>
            <span className="text-xs text-gray-400 mb-1 block">左右</span>
            <input
              type="number"
              value={section.data.style?.marginX || 0}
              onChange={(e) => updateStyleData({ marginX: parseInt(e.target.value) || 0 })}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Type-specific content controls
  const renderContentControls = () => {
    switch (section.type) {
      case 'hero':
        return renderHeroControls();
      case 'features':
        return renderFeaturesControls();
      case 'pricing':
        return renderPricingControls();
      case 'faq':
        return renderFAQControls();
      case 'cta':
        return renderCTAControls();
      case 'testimonials':
        return renderTestimonialsControls();
      default:
        return <div className="text-sm text-gray-500">このセクションタイプには編集可能な設定がありません。</div>;
    }
  };

  const renderHeroControls = () => (
    <div className="space-y-6">
      {/* Headline */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
            見出し
          </label>
          <button
            onClick={() => onAIGenerate('headline')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-all"
          >
            <Sparkles className="h-3 w-3" />
            AIで生成
          </button>
        </div>
        <input
          type="text"
          value={section.data.headline || ''}
          onChange={(e) => updateData({ headline: e.target.value })}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
          placeholder="目を引く見出しを入力..."
        />
      </div>

      {/* Subheadline */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
            サブ見出し
          </label>
          <button
            onClick={() => onAIGenerate('subheadline')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-all"
          >
            <Sparkles className="h-3 w-3" />
            AIで生成
          </button>
        </div>
        <textarea
          value={section.data.subheadline || ''}
          onChange={(e) => updateData({ subheadline: e.target.value })}
          className="w-full min-h-[80px] rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="補足説明を入力..."
        />
      </div>

      {/* CTA Button */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
          CTAボタン
        </label>
        <input
          type="text"
          value={section.data.ctaText || ''}
          onChange={(e) => updateData({ ctaText: e.target.value })}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
          placeholder="ボタンのテキスト"
        />
        <input
          type="text"
          value={section.data.ctaLink || ''}
          onChange={(e) => updateData({ ctaLink: e.target.value })}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
          placeholder="リンク先URL"
        />
      </div>
    </div>
  );

  const renderFeaturesControls = () => {
    const features = section.data.features || [];

    return (
      <div className="space-y-6">
        {/* Column Count */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
            カラム数
          </label>
          <div className="flex gap-2">
            {[3, 4].map((count) => (
              <button
                key={count}
                onClick={() => updateData({ columnCount: count })}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                  section.data.columnCount === count || (!section.data.columnCount && count === 3)
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {count}列
              </button>
            ))}
          </div>
        </div>

        {/* Features List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
              機能一覧
            </label>
            <button
              onClick={() => {
                const newFeatures = [...features, { icon: '✨', title: '', description: '' }];
                updateData({ features: newFeatures });
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold transition-all"
            >
              <Plus className="h-3 w-3" />
              追加
            </button>
          </div>

          <div className="space-y-4">
            {features.map((feature: any, index: number) => (
              <div key={index} className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">機能 {index + 1}</span>
                  <button
                    onClick={() => {
                      const newFeatures = features.filter((_: any, i: number) => i !== index);
                      updateData({ features: newFeatures });
                    }}
                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">アイコン（絵文字）</label>
                  <input
                    type="text"
                    value={feature.icon || ''}
                    onChange={(e) => {
                      const newFeatures = [...features];
                      newFeatures[index].icon = e.target.value;
                      updateData({ features: newFeatures });
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="✨"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">タイトル</label>
                  <input
                    type="text"
                    value={feature.title || ''}
                    onChange={(e) => {
                      const newFeatures = [...features];
                      newFeatures[index].title = e.target.value;
                      updateData({ features: newFeatures });
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="機能名"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">説明</label>
                  <textarea
                    value={feature.description || ''}
                    onChange={(e) => {
                      const newFeatures = [...features];
                      newFeatures[index].description = e.target.value;
                      updateData({ features: newFeatures });
                    }}
                    className="w-full min-h-[60px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="機能の詳細説明"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPricingControls = () => {
    const plans = section.data.plans || [];

    return (
      <div className="space-y-6">
        {/* Plan Count */}
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
            プラン一覧
          </label>
          <button
            onClick={() => {
              const newPlans = [...plans, { name: '', price: '', features: [], highlighted: false }];
              updateData({ plans: newPlans });
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold transition-all"
          >
            <Plus className="h-3 w-3" />
            プラン追加
          </button>
        </div>

        <div className="space-y-4">
          {plans.map((plan: any, index: number) => (
            <div key={index} className={`p-4 rounded-lg border space-y-3 ${
              plan.highlighted
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400">プラン {index + 1}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newPlans = [...plans];
                      newPlans[index].highlighted = !newPlans[index].highlighted;
                      updateData({ plans: newPlans });
                    }}
                    className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                      plan.highlighted
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    <Star className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => {
                      const newPlans = plans.filter((_: any, i: number) => i !== index);
                      updateData({ plans: newPlans });
                    }}
                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">プラン名</label>
                <input
                  type="text"
                  value={plan.name || ''}
                  onChange={(e) => {
                    const newPlans = [...plans];
                    newPlans[index].name = e.target.value;
                    updateData({ plans: newPlans });
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ベーシック"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">価格</label>
                <input
                  type="text"
                  value={plan.price || ''}
                  onChange={(e) => {
                    const newPlans = [...plans];
                    newPlans[index].price = e.target.value;
                    updateData({ plans: newPlans });
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="¥1,000/月"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">機能リスト（1行1項目）</label>
                <textarea
                  value={plan.features?.join('\n') || ''}
                  onChange={(e) => {
                    const newPlans = [...plans];
                    newPlans[index].features = e.target.value.split('\n').filter(f => f.trim());
                    updateData({ plans: newPlans });
                  }}
                  className="w-full min-h-[100px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                  placeholder="機能1&#10;機能2&#10;機能3"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFAQControls = () => {
    const faqs = section.data.faqs || [];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
            よくある質問
          </label>
          <button
            onClick={() => {
              const newFaqs = [...faqs, { question: '', answer: '' }];
              updateData({ faqs: newFaqs });
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold transition-all"
          >
            <Plus className="h-3 w-3" />
            質問追加
          </button>
        </div>

        <div className="space-y-4">
          {faqs.map((faq: any, index: number) => (
            <div key={index} className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400">Q&A {index + 1}</span>
                <button
                  onClick={() => {
                    const newFaqs = faqs.filter((_: any, i: number) => i !== index);
                    updateData({ faqs: newFaqs });
                  }}
                  className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">質問</label>
                <input
                  type="text"
                  value={faq.question || ''}
                  onChange={(e) => {
                    const newFaqs = [...faqs];
                    newFaqs[index].question = e.target.value;
                    updateData({ faqs: newFaqs });
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="質問内容"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">回答</label>
                <textarea
                  value={faq.answer || ''}
                  onChange={(e) => {
                    const newFaqs = [...faqs];
                    newFaqs[index].answer = e.target.value;
                    updateData({ faqs: newFaqs });
                  }}
                  className="w-full min-h-[80px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="回答内容"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCTAControls = () => (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
            見出し
          </label>
          <button
            onClick={() => onAIGenerate('headline')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-all"
          >
            <Sparkles className="h-3 w-3" />
            AIで生成
          </button>
        </div>
        <input
          type="text"
          value={section.data.headline || ''}
          onChange={(e) => updateData({ headline: e.target.value })}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
          placeholder="行動を促す見出し"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
            説明文
          </label>
          <button
            onClick={() => onAIGenerate('description')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-all"
          >
            <Sparkles className="h-3 w-3" />
            AIで生成
          </button>
        </div>
        <textarea
          value={section.data.description || ''}
          onChange={(e) => updateData({ description: e.target.value })}
          className="w-full min-h-[80px] rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="詳細説明"
        />
      </div>

      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
          CTAボタン
        </label>
        <input
          type="text"
          value={section.data.buttonText || ''}
          onChange={(e) => updateData({ buttonText: e.target.value })}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
          placeholder="ボタンのテキスト"
        />
        <input
          type="text"
          value={section.data.buttonLink || ''}
          onChange={(e) => updateData({ buttonLink: e.target.value })}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
          placeholder="リンク先URL"
        />
      </div>
    </div>
  );

  const renderTestimonialsControls = () => {
    const testimonials = section.data.testimonials || [];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
            お客様の声
          </label>
          <button
            onClick={() => {
              const newTestimonials = [...testimonials, { avatar: '', name: '', company: '', quote: '' }];
              updateData({ testimonials: newTestimonials });
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold transition-all"
          >
            <Plus className="h-3 w-3" />
            追加
          </button>
        </div>

        <div className="space-y-4">
          {testimonials.map((testimonial: any, index: number) => (
            <div key={index} className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400">お客様 {index + 1}</span>
                <button
                  onClick={() => {
                    const newTestimonials = testimonials.filter((_: any, i: number) => i !== index);
                    updateData({ testimonials: newTestimonials });
                  }}
                  className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">アバター画像</label>
                {testimonial.avatar && (
                  <div className="mb-2 relative w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200">
                    <img src={testimonial.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        const newTestimonials = [...testimonials];
                        newTestimonials[index].avatar = '';
                        updateData({ testimonials: newTestimonials });
                      }}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          const newTestimonials = [...testimonials];
                          newTestimonials[index].avatar = e.target?.result as string;
                          updateData({ testimonials: newTestimonials });
                        };
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-all"
                >
                  <Upload className="h-3 w-3" />
                  アバターをアップロード
                </button>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">名前</label>
                <input
                  type="text"
                  value={testimonial.name || ''}
                  onChange={(e) => {
                    const newTestimonials = [...testimonials];
                    newTestimonials[index].name = e.target.value;
                    updateData({ testimonials: newTestimonials });
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="田中太郎"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">会社名・肩書き</label>
                <input
                  type="text"
                  value={testimonial.company || ''}
                  onChange={(e) => {
                    const newTestimonials = [...testimonials];
                    newTestimonials[index].company = e.target.value;
                    updateData({ testimonials: newTestimonials });
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="株式会社サンプル"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">コメント</label>
                <textarea
                  value={testimonial.quote || ''}
                  onChange={(e) => {
                    const newTestimonials = [...testimonials];
                    newTestimonials[index].quote = e.target.value;
                    updateData({ testimonials: newTestimonials });
                  }}
                  className="w-full min-h-[80px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="お客様の声をここに入力"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-100">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">セクション設定</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {section.type === 'hero' && 'ヒーローセクション'}
              {section.type === 'features' && '機能紹介セクション'}
              {section.type === 'pricing' && '料金プランセクション'}
              {section.type === 'faq' && 'FAQセクション'}
              {section.type === 'cta' && 'CTAセクション'}
              {section.type === 'testimonials' && 'お客様の声セクション'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('content')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'content'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Type className="h-3 w-3 inline-block mr-1" />
            コンテンツ
          </button>
          <button
            onClick={() => setActiveTab('style')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'style'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Palette className="h-3 w-3 inline-block mr-1" />
            スタイル
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'content' ? renderContentControls() : renderStyleControls()}
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-gray-100">
        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-red-200 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 hover:border-red-300 transition-all"
        >
          <Trash2 className="h-4 w-4" />
          このセクションを削除
        </button>
      </div>
    </div>
  );
}
