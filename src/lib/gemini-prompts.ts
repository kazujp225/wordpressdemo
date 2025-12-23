/**
 * Gemini LP デザイン生成用プロンプト集
 *
 * 使用方法:
 * 1. ユーザーからビジネス情報（業種、ターゲット、トーン）を収集
 * 2. 適切なプロンプトを選択してGeminiに送信
 * 3. レスポンスをパースしてLP Builderのセクションに適用
 */

// ===== 基本システムプロンプト =====
export const SYSTEM_PROMPT = `あなたはランディングページ（LP）デザインの専門家です。
与えられたビジネス情報に基づいて、コンバージョン率の高いLPセクションのコンテンツを生成してください。

【生成ルール】
- 日本語で生成
- コピーライティングはAIDMAの法則に従う
- 見出しは短く、インパクトがあること
- CTAは具体的で行動を促すこと
- 数字を効果的に使用すること（例：「3つの理由」「98%の満足度」）
- 専門用語は避け、分かりやすい表現を使う

【出力形式】
必ずJSON形式で出力してください。`;

// ===== セクション別プロンプト =====

export const HERO_SECTION_PROMPT = `
【タスク】ヒーローセクションのコンテンツを生成

【入力情報】
- ビジネス名: {{businessName}}
- 業種: {{industry}}
- ターゲット顧客: {{target}}
- 主な強み: {{strengths}}
- トーン: {{tone}} (professional/friendly/luxury/energetic)

【出力JSON形式】
{
  "headline": "メインキャッチコピー（改行含め2行以内）",
  "subheadline": "サブコピー（1〜2文）",
  "ctaText": "CTAボタンテキスト（5〜8文字）",
  "ctaLink": "#contact",
  "backgroundColor": "#HEXカラー（ブランドに合う色）",
  "textColor": "#ffffff または #000000"
}

【ポイント】
- headlineは感情に訴えかける
- subheadlineで具体的なベネフィットを伝える
- ctaTextは「今すぐ〜」「無料で〜」など行動を促す
`;

export const FEATURES_SECTION_PROMPT = `
【タスク】特徴セクションのコンテンツを生成

【入力情報】
- ビジネス名: {{businessName}}
- サービス/製品: {{service}}
- 競合との差別化ポイント: {{differentiators}}
- ターゲットの悩み: {{painPoints}}

【出力JSON形式】
{
  "title": "セクションタイトル（例：選ばれる3つの理由）",
  "subtitle": "サブタイトル",
  "features": [
    {
      "icon": "絵文字1つ",
      "title": "特徴タイトル（10文字以内）",
      "description": "説明文（30〜50文字）"
    },
    // 3つ生成
  ],
  "backgroundColor": "#ffffff"
}

【ポイント】
- 特徴は必ず3つ
- 各特徴はターゲットの悩みを解決することを示す
- 具体的な数字があれば活用する
`;

export const PRICING_SECTION_PROMPT = `
【タスク】料金セクションのコンテンツを生成

【入力情報】
- ビジネス名: {{businessName}}
- 価格帯: {{priceRange}}
- プラン数: {{planCount}}
- 主な機能: {{mainFeatures}}

【出力JSON形式】
{
  "title": "料金プラン",
  "subtitle": "サブタイトル",
  "plans": [
    {
      "name": "プラン名",
      "price": "¥X,XXX",
      "period": "/月",
      "description": "プラン説明（1文）",
      "features": ["機能1", "機能2", "機能3"],
      "highlighted": false,
      "ctaText": "このプランを選ぶ"
    }
  ],
  "backgroundColor": "#f8fafc"
}

【ポイント】
- 真ん中のプランをhighlighted: trueにする（アンカリング効果）
- 上位プランほど機能が多い
- CTAは各プランで異なる表現にする
`;

export const FAQ_SECTION_PROMPT = `
【タスク】FAQセクションのコンテンツを生成

【入力情報】
- ビジネス名: {{businessName}}
- サービス内容: {{service}}
- よくある懸念: {{concerns}}
- 契約/購入プロセス: {{process}}

【出力JSON形式】
{
  "title": "よくあるご質問",
  "subtitle": "お客様からよく寄せられる質問にお答えします",
  "items": [
    {
      "question": "質問文",
      "answer": "回答文（2〜3文）"
    }
  ],
  "backgroundColor": "#ffffff"
}

【ポイント】
- 4〜6個の質問を生成
- 購入障壁を取り除く質問を優先
- 回答は安心感を与える内容に
`;

export const CTA_SECTION_PROMPT = `
【タスク】CTAセクションのコンテンツを生成

【入力情報】
- ビジネス名: {{businessName}}
- オファー: {{offer}}
- 緊急性: {{urgency}}
- 保証: {{guarantee}}

【出力JSON形式】
{
  "headline": "アクションを促す見出し",
  "description": "行動を促す説明文（緊急性・保証を含む）",
  "ctaText": "メインCTA",
  "ctaLink": "#contact",
  "secondaryCtaText": "サブCTA（任意）",
  "secondaryCtaLink": "#features",
  "backgroundColor": "#1e40af",
  "textColor": "#ffffff"
}

【ポイント】
- 緊急性を感じさせる（期間限定、残りわずか等）
- リスクリバーサル（返金保証等）を明示
- CTAは具体的な行動を示す
`;

export const TESTIMONIALS_SECTION_PROMPT = `
【タスク】お客様の声セクションのコンテンツを生成

【入力情報】
- ビジネス名: {{businessName}}
- 業種: {{industry}}
- 主な成果: {{results}}
- ターゲット層: {{target}}

【出力JSON形式】
{
  "title": "お客様の声",
  "subtitle": "実際にご利用いただいているお客様からの声",
  "testimonials": [
    {
      "name": "名前（漢字フルネーム）",
      "company": "会社名",
      "role": "役職",
      "quote": "体験談（2〜3文、具体的な成果を含む）",
      "rating": 5
    }
  ],
  "backgroundColor": "#f8fafc"
}

【ポイント】
- 3つの体験談を生成
- 具体的な数字（〇%アップ、〇日で等）を含める
- 異なる業種・役職のバリエーション
`;

// ===== LP全体生成プロンプト =====
export const FULL_LP_PROMPT = `
【タスク】LP全体の構成とコンテンツを生成

【入力情報】
- ビジネス名: {{businessName}}
- 業種: {{industry}}
- サービス/製品: {{service}}
- ターゲット顧客: {{target}}
- 主な強み: {{strengths}}
- 競合との差別化: {{differentiators}}
- 価格帯: {{priceRange}}
- トーン: {{tone}}

【出力JSON形式】
{
  "colorScheme": {
    "primary": "#HEX",
    "secondary": "#HEX",
    "accent": "#HEX",
    "background": "#HEX",
    "text": "#HEX"
  },
  "sections": [
    {
      "type": "hero",
      "data": { /* heroセクションのデータ */ }
    },
    {
      "type": "features",
      "data": { /* featuresセクションのデータ */ }
    },
    {
      "type": "testimonials",
      "data": { /* testimonialsセクションのデータ */ }
    },
    {
      "type": "pricing",
      "data": { /* pricingセクションのデータ */ }
    },
    {
      "type": "faq",
      "data": { /* faqセクションのデータ */ }
    },
    {
      "type": "cta",
      "data": { /* ctaセクションのデータ */ }
    }
  ]
}

【ポイント】
- カラースキームは業種とトーンに合わせる
- セクション順序はコンバージョン最適化を考慮
- 全体で一貫したメッセージングを維持
`;

// ===== ユーティリティ関数 =====

/**
 * プロンプトのプレースホルダーを置換する
 */
export function fillPromptTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

/**
 * Gemini API用のリクエストボディを生成
 */
export function createGeminiRequest(
  sectionType: 'hero' | 'features' | 'pricing' | 'faq' | 'cta' | 'testimonials' | 'full',
  variables: Record<string, string>
) {
  const prompts: Record<string, string> = {
    hero: HERO_SECTION_PROMPT,
    features: FEATURES_SECTION_PROMPT,
    pricing: PRICING_SECTION_PROMPT,
    faq: FAQ_SECTION_PROMPT,
    cta: CTA_SECTION_PROMPT,
    testimonials: TESTIMONIALS_SECTION_PROMPT,
    full: FULL_LP_PROMPT,
  };

  const filledPrompt = fillPromptTemplate(prompts[sectionType], variables);

  return {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          { text: filledPrompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    }
  };
}

/**
 * Geminiレスポンスからセクションデータをパース
 */
export function parseGeminiResponse(response: string): any {
  try {
    // JSONブロックを抽出
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                      response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }

    // そのままパースを試行
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    return null;
  }
}

// ===== 入力フォーム用の質問項目 =====
export const BUSINESS_INFO_QUESTIONS = [
  {
    id: 'businessName',
    label: 'ビジネス名・サービス名',
    placeholder: '例: TechSolutions株式会社',
    required: true,
  },
  {
    id: 'industry',
    label: '業種',
    placeholder: '例: SaaS、飲食、美容、不動産など',
    required: true,
  },
  {
    id: 'service',
    label: 'サービス・製品の概要',
    placeholder: '例: 中小企業向けの顧客管理システム',
    required: true,
  },
  {
    id: 'target',
    label: 'ターゲット顧客',
    placeholder: '例: 従業員10〜50名の中小企業経営者',
    required: true,
  },
  {
    id: 'strengths',
    label: '主な強み・特徴',
    placeholder: '例: 導入が簡単、サポートが手厚い、価格が安い',
    required: true,
  },
  {
    id: 'differentiators',
    label: '競合との差別化ポイント',
    placeholder: '例: AIによる自動分析機能、業界最安値',
    required: false,
  },
  {
    id: 'priceRange',
    label: '価格帯',
    placeholder: '例: 月額9,800円〜29,800円',
    required: false,
  },
  {
    id: 'tone',
    label: 'トーン・雰囲気',
    type: 'select',
    options: [
      { value: 'professional', label: 'プロフェッショナル' },
      { value: 'friendly', label: 'フレンドリー' },
      { value: 'luxury', label: 'ラグジュアリー' },
      { value: 'energetic', label: 'エネルギッシュ' },
    ],
    required: true,
  },
];
