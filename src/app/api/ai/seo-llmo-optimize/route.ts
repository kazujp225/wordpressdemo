import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGoogleApiKey } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import {
  SEO_ANALYSIS_PROMPT,
  LLMO_ANALYSIS_PROMPT,
  SEO_LLMO_COMBINED_PROMPT
} from '@/lib/gemini-prompts';

// SEO分析結果の型定義
export interface SEOAnalysisResult {
  businessAnalysis: {
    industry: string;
    service: string;
    targetAudience: string;
    uniqueValue: string;
  };
  keywords: {
    primary: string;
    secondary: string[];
    longTail: string[];
    lsi: string[];
  };
  metadata: {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
  };
  structuredData: {
    type: string;
    suggestedSchema: string;
  };
  contentRecommendations: {
    h1: string;
    h2Suggestions: string[];
    altTexts: string[];
    internalLinkAnchors: string[];
  };
  technicalSEO: {
    urlSlug: string;
    canonicalStrategy: string;
    priorityPages: string[];
  };
}

// LLMO分析結果の型定義
export interface LLMOAnalysisResult {
  llmoAnalysis: {
    contentClarity: number;
    structureScore: number;
    citability: number;
    improvements: string[];
  };
  answerBoxOptimization: {
    targetQuestions: string[];
    directAnswers: {
      whatIs: string;
      howTo: string;
      whyChoose: string;
    };
  };
  structuredContent: {
    faqSchema: Array<{ question: string; answer: string }>;
    howToSteps: Array<{ step: number; name: string; description: string }>;
    comparisonTable: {
      headers: string[];
      rows: string[][];
    };
  };
  entityOptimization: {
    brandEntity: string;
    relatedEntities: string[];
    entityRelationships: string;
  };
  citationStrategy: {
    authoritySignals: string[];
    trustIndicators: string[];
    expertiseProof: string[];
  };
  contentEnhancements: {
    summaryParagraph: string;
    keyTakeaways: string[];
    statisticsToAdd: string[];
    definitionsNeeded: string[];
  };
  technicalLLMO: {
    speakableContent: string;
    snippetOptimization: string;
    knowledgeGraphData: {
      name: string;
      description: string;
      sameAs: string[];
    };
  };
}

// 統合分析結果の型定義
export interface CombinedOptimizationResult {
  imageAnalysis: {
    detectedText: string[];
    visualElements: string[];
    estimatedIndustry: string;
    estimatedTarget: string;
    brandTone: string;
  };
  seo: {
    primaryKeyword: string;
    secondaryKeywords: string[];
    longTailKeywords: string[];
    title: string;
    description: string;
    h1: string;
    urlSlug: string;
  };
  llmo: {
    targetQuestions: string[];
    directAnswers: {
      primary: string;
      secondary: string;
    };
    summaryForAI: string;
    keyFacts: string[];
    faqItems: Array<{ q: string; a: string }>;
  };
  structuredData: {
    schemaType: string;
    jsonLd: Record<string, unknown>;
  };
  contentStrategy: {
    headlines: {
      h1: string;
      h2s: string[];
    };
    callToActions: string[];
    trustSignals: string[];
    urgencyElements: string[];
  };
  implementation: {
    priority: string;
    quickWins: string[];
    longTermActions: string[];
  };
}

type AnalysisMode = 'seo' | 'llmo' | 'combined';

/**
 * 画像をBase64に変換
 */
async function getImageBase64(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:')) {
    const matches = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 data URL format');
    }
    return matches[1];
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`;

  const imgRes = await fetch(fullUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch image: ${imgRes.statusText}`);
  }
  const buffer = await imgRes.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

/**
 * プロンプトを選択
 */
function getPromptByMode(mode: AnalysisMode): string {
  switch (mode) {
    case 'seo':
      return SEO_ANALYSIS_PROMPT;
    case 'llmo':
      return LLMO_ANALYSIS_PROMPT;
    case 'combined':
    default:
      return SEO_LLMO_COMBINED_PROMPT;
  }
}

/**
 * LP全体のテキストコンテンツを抽出
 */
async function extractPageText(pageId: number): Promise<string> {
  try {
    const { prisma } = await import('@/lib/db');
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      include: {
        sections: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!page) return '';

    const textParts: string[] = [];

    // ページタイトル
    textParts.push(`【ページタイトル】${page.title}`);

    // 各セクションのテキストを抽出
    for (const section of page.sections) {
      if (section.config) {
        try {
          const config = JSON.parse(section.config);

          // 見出し
          if (config.heading || config.headline) {
            textParts.push(`【見出し】${config.heading || config.headline}`);
          }

          // サブタイトル
          if (config.subheading || config.subtitle) {
            textParts.push(`【サブタイトル】${config.subheading || config.subtitle}`);
          }

          // 本文
          if (config.body || config.description || config.text) {
            textParts.push(`【本文】${config.body || config.description || config.text}`);
          }

          // リスト項目
          if (config.items && Array.isArray(config.items)) {
            config.items.forEach((item: any) => {
              if (typeof item === 'string') {
                textParts.push(`- ${item}`);
              } else if (item.title || item.text) {
                textParts.push(`- ${item.title || item.text}`);
              }
            });
          }

          // CTA
          if (config.ctaText || config.buttonText) {
            textParts.push(`【CTA】${config.ctaText || config.buttonText}`);
          }
        } catch (e) {
          // JSON parse error - skip
        }
      }
    }

    return textParts.join('\n');
  } catch (error) {
    console.error('Text extraction error:', error);
    return '';
  }
}

export async function POST(request: NextRequest) {
  const startTime = createTimer();
  let prompt = '';

  try {
    const body = await request.json();
    const {
      imageUrl,
      pageId,
      mode = 'combined',
      additionalContext
    }: {
      imageUrl: string;
      pageId?: number;
      mode?: AnalysisMode;
      additionalContext?: string;
    } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    const apiKey = await getGoogleApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google API Key not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 画像をBase64に変換
    const base64Content = await getImageBase64(imageUrl);

    // LP全体のテキストを抽出（pageIdがあれば）
    let pageText = '';
    if (pageId) {
      pageText = await extractPageText(pageId);
    }

    // プロンプトを構築
    prompt = getPromptByMode(mode);

    // テキストコンテンツを追加
    if (pageText) {
      prompt += `\n\n【LPのテキストコンテンツ】\n${pageText}`;
    }

    if (additionalContext) {
      prompt += `\n\n【追加コンテキスト】\n${additionalContext}`;
    }

    prompt += `\n\n【重要】必ずJSON形式のみで出力してください。説明文は不要です。`;

    // Gemini APIで分析実行
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Content,
          mimeType: "image/jpeg"
        }
      }
    ]);

    const resText = result.response.text();

    // JSONを抽出
    const jsonMatch = resText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Raw AI Response:", resText);
      throw new Error('Failed to parse AI response as JSON');
    }

    const analysisResult = JSON.parse(jsonMatch[0]);

    // 成功ログ
    const logType = mode === 'seo' ? 'seo-analysis' : mode === 'llmo' ? 'llmo-analysis' : 'seo-llmo-combined';
    await logGeneration({
      userId: null,
      type: logType,
      endpoint: '/api/ai/seo-llmo-optimize',
      model: 'gemini-2.0-flash',
      inputPrompt: `SEO/LLMO Analysis (${mode})`,
      outputResult: JSON.stringify(analysisResult),
      status: 'succeeded',
      startTime
    });

    return NextResponse.json({
      success: true,
      mode,
      data: analysisResult
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('SEO/LLMO Analysis Error:', error);

    await logGeneration({
      userId: null,
      type: 'seo-llmo-combined',
      endpoint: '/api/ai/seo-llmo-optimize',
      model: 'gemini-2.0-flash',
      inputPrompt: prompt || 'Error pre-prompt',
      status: 'failed',
      errorMessage,
      startTime
    });

    return NextResponse.json({
      success: false,
      error: 'SEO/LLMO Analysis Failed',
      details: errorMessage
    }, { status: 500 });
  }
}

/**
 * GET: 利用可能なモードと説明を返す
 */
export async function GET() {
  return NextResponse.json({
    availableModes: [
      {
        mode: 'seo',
        name: 'SEO Analysis',
        description: 'Google検索向けの最適化分析。キーワード、メタデータ、構造化データを生成'
      },
      {
        mode: 'llmo',
        name: 'LLMO Analysis',
        description: 'LLM検索エンジン（ChatGPT、Claude、Perplexity等）向けの最適化分析'
      },
      {
        mode: 'combined',
        name: 'Combined Analysis',
        description: 'SEOとLLMO両方を統合した包括的な最適化戦略を生成'
      }
    ],
    usage: {
      method: 'POST',
      body: {
        imageUrl: 'required - LP画像のURLまたはBase64データ',
        mode: 'optional - "seo" | "llmo" | "combined" (default: combined)',
        additionalContext: 'optional - 追加のビジネスコンテキスト情報'
      }
    }
  });
}
