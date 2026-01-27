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

【入力情報 - 基本】
- ビジネス名: {{businessName}}
- 業種: {{industry}}
- ビジネスモデル: {{businessType}}
- サービス/製品: {{service}}
- ターゲット顧客: {{target}}
- 主な強み: {{strengths}}
- 競合との差別化: {{differentiators}}
- 価格帯: {{priceRange}}
- トーン: {{tone}}
- コンバージョン目標: {{conversionGoal}}

【入力情報 - 詳細コンテキスト】
- ターゲットの悩み・課題: {{painPoints}}
- よくある懸念・不安: {{concerns}}
- 契約・購入プロセス: {{process}}
- 主な機能・特徴: {{mainFeatures}}
- 特別オファー: {{offer}}
- 緊急性を促すメッセージ: {{urgency}}
- 保証内容: {{guarantee}}
- 期待される成果: {{results}}

【セクション別生成指示】

■ Hero（ヒーロー）
- headlineは感情に訴えかける（AIDMAのAttention）
- subheadlineで具体的なベネフィットを伝える
- ctaTextは「今すぐ〜」「無料で〜」など行動を促す

■ Features（特徴）
- 必ず3つの特徴を生成
- 各特徴はターゲットの悩み({{painPoints}})を解決することを示す
- 具体的な数字があれば活用する

■ Testimonials（お客様の声）
- 3つの体験談を生成
- 具体的な数字（〇%アップ、〇日で等）を含める
- {{results}}に基づいた成果を記載

■ Pricing（料金）
- 3つのプランを生成
- 真ん中のプランをhighlighted: trueにする（アンカリング効果）
- {{priceRange}}を参考に現実的な価格設定

■ FAQ（よくある質問）
- 4〜6個の質問を生成
- {{concerns}}に基づいた購入障壁を取り除く質問を優先
- 回答は安心感を与える内容に

■ CTA（行動喚起）
- コンバージョン目標（{{conversionGoal}}）に最適化したCTA設計
- {{urgency}}で緊急性を表現
- {{guarantee}}でリスクリバーサルを明示
- CTAは具体的な行動を示す（目標に応じて「お問い合わせ」「購入」「登録」「ダウンロード」等を使い分ける）

【出力JSON形式】
{
  "colorScheme": {
    "primary": "#HEX（メインカラー）",
    "secondary": "#HEX（サブカラー）",
    "accent": "#HEX（アクセント）",
    "background": "#HEX（背景色）",
    "text": "#HEX（テキスト色）"
  },
  "sections": [
    {
      "type": "hero",
      "data": {
        "headline": "メインキャッチコピー",
        "subheadline": "サブコピー",
        "ctaText": "CTAボタンテキスト",
        "ctaLink": "#contact",
        "backgroundColor": "#HEX",
        "textColor": "#HEX"
      }
    },
    {
      "type": "features",
      "data": {
        "title": "セクションタイトル",
        "subtitle": "サブタイトル",
        "features": [
          { "icon": "絵文字", "title": "特徴1", "description": "説明" },
          { "icon": "絵文字", "title": "特徴2", "description": "説明" },
          { "icon": "絵文字", "title": "特徴3", "description": "説明" }
        ],
        "backgroundColor": "#HEX"
      }
    },
    {
      "type": "testimonials",
      "data": {
        "title": "お客様の声",
        "subtitle": "サブタイトル",
        "testimonials": [
          { "name": "名前", "company": "会社名", "role": "役職", "quote": "体験談", "rating": 5 }
        ],
        "backgroundColor": "#HEX"
      }
    },
    {
      "type": "pricing",
      "data": {
        "title": "料金プラン",
        "subtitle": "サブタイトル",
        "plans": [
          { "name": "プラン名", "price": "¥X,XXX", "period": "/月", "description": "説明", "features": ["機能1"], "highlighted": false, "ctaText": "CTAテキスト" }
        ],
        "backgroundColor": "#HEX"
      }
    },
    {
      "type": "faq",
      "data": {
        "title": "よくあるご質問",
        "subtitle": "サブタイトル",
        "items": [
          { "question": "質問", "answer": "回答" }
        ],
        "backgroundColor": "#HEX"
      }
    },
    {
      "type": "cta",
      "data": {
        "headline": "アクションを促す見出し",
        "description": "説明文（緊急性・保証を含む）",
        "ctaText": "メインCTA",
        "ctaLink": "#contact",
        "secondaryCtaText": "サブCTA",
        "secondaryCtaLink": "#features",
        "backgroundColor": "#HEX",
        "textColor": "#HEX"
      }
    }
  ]
}

【重要ポイント】
- カラースキームは業種({{industry}})とトーン({{tone}})に最適化
- セクション順序はコンバージョン最適化を考慮（Hero → Features → Testimonials → Pricing → FAQ → CTA）
- 全体で一貫したメッセージングを維持
- JSON以外の出力は不要
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

// ===== SEO対策プロンプト =====
export const SEO_ANALYSIS_PROMPT = `
【タスク】LPの画像を分析し、SEO最適化のためのキーワードとメタデータを生成

【あなたの役割】
あなたはSEO専門家であり、Googleの検索アルゴリズムを熟知しています。
LPの画像から内容を読み取り、検索上位表示に必要な要素を抽出・生成してください。

【分析対象】
1. ビジュアル要素: ロゴ、画像、アイコン、色使い
2. テキスト要素: 見出し、本文、CTA、キャッチコピー
3. 構造要素: セクション構成、情報の階層
4. ブランド要素: トーン、ターゲット層の推定

【SEO分析の観点】
- 検索意図（Informational / Navigational / Transactional）
- ターゲットキーワードの推定
- ロングテールキーワードの候補
- LSIキーワード（関連語）の特定
- E-E-A-T要素の評価

【出力JSON形式】
{
  "businessAnalysis": {
    "industry": "推定業種",
    "service": "提供サービス/製品",
    "targetAudience": "ターゲット層",
    "uniqueValue": "独自の価値提案"
  },
  "keywords": {
    "primary": "メインキーワード（1つ）",
    "secondary": ["サブキーワード1", "サブキーワード2", "サブキーワード3"],
    "longTail": ["ロングテールKW1", "ロングテールKW2", "ロングテールKW3", "ロングテールKW4", "ロングテールKW5"],
    "lsi": ["LSI1", "LSI2", "LSI3", "LSI4", "LSI5"]
  },
  "metadata": {
    "title": "SEO最適化されたtitleタグ（30〜60文字）",
    "description": "SEO最適化されたmeta description（120〜160文字）",
    "ogTitle": "OGPタイトル",
    "ogDescription": "OGP説明文"
  },
  "structuredData": {
    "type": "Organization / LocalBusiness / Product / Service",
    "suggestedSchema": "推奨するJSON-LDスキーマタイプ"
  },
  "contentRecommendations": {
    "h1": "推奨H1タグ（キーワード含む）",
    "h2Suggestions": ["H2候補1", "H2候補2", "H2候補3"],
    "altTexts": ["画像1のalt候補", "画像2のalt候補"],
    "internalLinkAnchors": ["アンカーテキスト候補1", "アンカーテキスト候補2"]
  },
  "technicalSEO": {
    "urlSlug": "推奨URLスラッグ",
    "canonicalStrategy": "canonical設定の推奨",
    "priorityPages": ["優先的にリンクすべきページ1", "ページ2"]
  }
}

【重要ポイント】
- キーワードは日本語検索を意識
- 競合が多いキーワードとニッチキーワードのバランス
- 検索ボリュームを意識した選定
- モバイルファーストを考慮
`;

// ===== LLMO（LLM Optimization）対策プロンプト =====
export const LLMO_ANALYSIS_PROMPT = `
【タスク】LPの画像を分析し、LLM検索エンジン（ChatGPT、Claude、Perplexity、Gemini等）での表示最適化を行う

【あなたの役割】
あなたはLLMO（Large Language Model Optimization）の専門家です。
AIアシスタントが情報を引用・推薦する際に選ばれやすいコンテンツ構造を設計してください。

【LLMOの重要性】
従来のSEOに加え、以下のAI検索での可視性が重要:
- ChatGPT（Bing連携）
- Claude（Web検索）
- Perplexity AI
- Google AI Overview
- Microsoft Copilot

【LLMが好むコンテンツ特性】
1. 明確な構造化: 箇条書き、番号付きリスト、表形式
2. 直接的な回答: 質問に対する明確なアンサー
3. 信頼性の証明: 出典、数字、専門性の提示
4. 最新性: 日付、バージョン情報
5. 包括性: トピックの網羅的カバー

【出力JSON形式】
{
  "llmoAnalysis": {
    "contentClarity": "コンテンツの明確さ評価（1-10）",
    "structureScore": "構造化スコア（1-10）",
    "citability": "引用されやすさ（1-10）",
    "improvements": ["改善点1", "改善点2", "改善点3"]
  },
  "answerBoxOptimization": {
    "targetQuestions": [
      "〇〇とは？",
      "〇〇の選び方は？",
      "〇〇のメリットは？",
      "〇〇と△△の違いは？",
      "〇〇の料金は？"
    ],
    "directAnswers": {
      "whatIs": "「〇〇とは」への直接回答（50文字以内）",
      "howTo": "「〇〇の方法」への直接回答",
      "whyChoose": "「なぜ〇〇を選ぶべきか」への回答"
    }
  },
  "structuredContent": {
    "faqSchema": [
      {"question": "よくある質問1", "answer": "回答1"},
      {"question": "よくある質問2", "answer": "回答2"},
      {"question": "よくある質問3", "answer": "回答3"},
      {"question": "よくある質問4", "answer": "回答4"},
      {"question": "よくある質問5", "answer": "回答5"}
    ],
    "howToSteps": [
      {"step": 1, "name": "ステップ名", "description": "説明"},
      {"step": 2, "name": "ステップ名", "description": "説明"},
      {"step": 3, "name": "ステップ名", "description": "説明"}
    ],
    "comparisonTable": {
      "headers": ["項目", "自社", "競合A", "競合B"],
      "rows": [
        ["機能1", "○", "△", "×"],
        ["機能2", "○", "○", "△"]
      ]
    }
  },
  "entityOptimization": {
    "brandEntity": "ブランド名のエンティティ定義",
    "relatedEntities": ["関連エンティティ1", "関連エンティティ2"],
    "entityRelationships": "エンティティ間の関係性説明"
  },
  "citationStrategy": {
    "authoritySignals": ["権威性シグナル1", "権威性シグナル2"],
    "trustIndicators": ["信頼性指標1", "信頼性指標2"],
    "expertiseProof": ["専門性の証明1", "専門性の証明2"]
  },
  "contentEnhancements": {
    "summaryParagraph": "LLMが引用しやすい要約パラグラフ（100文字以内）",
    "keyTakeaways": ["重要ポイント1", "重要ポイント2", "重要ポイント3"],
    "statisticsToAdd": ["追加すべき統計データ1", "統計データ2"],
    "definitionsNeeded": ["定義が必要な用語1", "用語2"]
  },
  "technicalLLMO": {
    "speakableContent": "音声検索で読み上げられるべきコンテンツ",
    "snippetOptimization": "フィーチャードスニペット向け最適化テキスト",
    "knowledgeGraphData": {
      "name": "エンティティ名",
      "description": "説明",
      "sameAs": ["関連URL候補"]
    }
  }
}

【重要ポイント】
- LLMは「質問→回答」形式を好む
- 数字・統計は具体的に
- 専門用語には説明を付与
- 最新情報であることを示す
- 比較・対照情報を含める
`;

// ===== SEO + LLMO 統合最適化プロンプト =====
export const SEO_LLMO_COMBINED_PROMPT = `
【タスク】LPの画像を分析し、SEOとLLMO両方に最適化されたコンテンツ戦略を生成

【入力情報（画像から抽出）】
- ビジネス種別
- 提供価値
- ターゲット層
- デザイントーン

【出力JSON形式】
{
  "imageAnalysis": {
    "detectedText": ["画像から検出したテキスト要素"],
    "visualElements": ["視覚的要素の説明"],
    "estimatedIndustry": "推定業種",
    "estimatedTarget": "推定ターゲット",
    "brandTone": "ブランドトーン"
  },
  "seo": {
    "primaryKeyword": "メインキーワード",
    "secondaryKeywords": ["サブKW1", "サブKW2", "サブKW3"],
    "longTailKeywords": ["ロングテール1", "ロングテール2", "ロングテール3"],
    "title": "titleタグ（60文字以内）",
    "description": "meta description（160文字以内）",
    "h1": "H1タグ",
    "urlSlug": "url-slug-recommendation"
  },
  "llmo": {
    "targetQuestions": ["質問1？", "質問2？", "質問3？", "質問4？", "質問5？"],
    "directAnswers": {
      "primary": "メイン質問への直接回答",
      "secondary": "サブ質問への直接回答"
    },
    "summaryForAI": "AIが引用しやすい100文字要約",
    "keyFacts": ["事実1", "事実2", "事実3"],
    "faqItems": [
      {"q": "質問1", "a": "回答1"},
      {"q": "質問2", "a": "回答2"},
      {"q": "質問3", "a": "回答3"}
    ]
  },
  "structuredData": {
    "schemaType": "推奨スキーマタイプ",
    "jsonLd": {
      "@context": "https://schema.org",
      "@type": "Organization または適切なタイプ",
      "name": "ビジネス名",
      "description": "説明"
    }
  },
  "contentStrategy": {
    "headlines": {
      "h1": "メイン見出し",
      "h2s": ["セクション見出し1", "セクション見出し2", "セクション見出し3"]
    },
    "callToActions": ["CTA1", "CTA2"],
    "trustSignals": ["信頼シグナル1", "信頼シグナル2"],
    "urgencyElements": ["緊急性要素1", "緊急性要素2"]
  },
  "implementation": {
    "priority": "high/medium/low",
    "quickWins": ["すぐ実装できる改善1", "改善2"],
    "longTermActions": ["長期的な改善1", "改善2"]
  }
}

【最適化の優先順位】
1. タイトル・H1のキーワード最適化
2. FAQ構造化データの追加
3. 直接回答形式のコンテンツ追加
4. 権威性・信頼性シグナルの強化
5. 内部リンク構造の最適化
`;

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
