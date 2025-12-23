'use client';

import React, { useState } from 'react';

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface FAQData {
  heading: string;
  subheading: string;
  items: FAQItem[];
  backgroundColor: string;
}

interface FAQSectionProps {
  data?: FAQData;
  onChange?: (data: FAQData) => void;
  onImageClick?: () => void;
}

const defaultData: FAQData = {
  heading: 'よくある質問',
  subheading: 'お客様からよく寄せられる質問にお答えします',
  backgroundColor: '#ffffff',
  items: [
    {
      id: '1',
      question: '無料トライアルはありますか?',
      answer: 'はい、14日間の無料トライアルをご用意しております。クレジットカードの登録も不要です。すべての機能を自由にお試しいただけます。',
    },
    {
      id: '2',
      question: 'いつでもプランを変更できますか?',
      answer: 'もちろんです。プランはいつでもアップグレード、ダウングレード可能です。変更は即座に反映され、料金は日割り計算されます。',
    },
    {
      id: '3',
      question: 'データのセキュリティは大丈夫ですか?',
      answer: '最高レベルのセキュリティを提供しています。すべてのデータは暗号化され、定期的にバックアップされます。ISO 27001認証も取得しています。',
    },
    {
      id: '4',
      question: 'サポート体制について教えてください',
      answer: 'メールサポートは全プランで利用可能です。ビジネスプラン以上では優先サポート、エンタープライズプランでは専任担当者がつきます。',
    },
    {
      id: '5',
      question: '解約はいつでもできますか?',
      answer: 'はい、いつでも解約できます。違約金も一切ありません。解約後もデータは30日間保持されますので、安心してお試しください。',
    },
    {
      id: '6',
      question: '他のツールと連携できますか?',
      answer: '主要なツールとの連携に対応しています。Slack、Google Workspace、Microsoft 365などと簡単に連携できます。',
    },
  ],
};

export function FAQSection({
  data = defaultData,
  onChange,
}: FAQSectionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(['1']));

  const toggleItem = (id: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  const handleTextChange = (field: keyof FAQData, value: string) => {
    if (onChange) {
      onChange({ ...data, [field]: value });
    }
  };

  const handleItemChange = (itemId: string, field: keyof FAQItem, value: string) => {
    if (onChange) {
      const updatedItems = data.items.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      );
      onChange({ ...data, items: updatedItems });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>, field: keyof FAQData) => {
    const value = e.currentTarget.textContent || '';
    handleTextChange(field, value);
  };

  const handleItemBlur = (
    e: React.FocusEvent<HTMLElement>,
    itemId: string,
    field: keyof FAQItem
  ) => {
    const value = e.currentTarget.textContent || '';
    handleItemChange(itemId, field, value);
  };

  return (
    <section
      className="py-20 px-6"
      style={{ backgroundColor: data.backgroundColor }}
    >
      <div className="max-w-4xl mx-auto">
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

        {/* FAQ Items */}
        <div className="space-y-4">
          {data.items.map((item) => {
            const isOpen = openItems.has(item.id);
            return (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden"
              >
                {/* Question */}
                <button
                  onClick={() => toggleItem(item.id)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <h3
                    contentEditable={!!onChange}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      e.stopPropagation();
                      handleItemBlur(e, item.id, 'question');
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-lg font-semibold text-gray-900 pr-4 outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 flex-1"
                  >
                    {item.question}
                  </h3>
                  <svg
                    className={`w-6 h-6 text-blue-600 flex-shrink-0 transition-transform ${
                      isOpen ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Answer */}
                <div
                  className={`transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 pb-5 pt-2 border-t border-gray-100">
                    <p
                      contentEditable={!!onChange}
                      suppressContentEditableWarning
                      onBlur={(e) => handleItemBlur(e, item.id, 'answer')}
                      className="text-gray-700 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                    >
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">他に質問がありますか?</p>
          <a
            href="#contact"
            className="inline-block bg-blue-600 text-white hover:bg-blue-700 px-8 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            お問い合わせはこちら
          </a>
        </div>
      </div>
    </section>
  );
}
