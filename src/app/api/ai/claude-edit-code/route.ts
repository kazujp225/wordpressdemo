import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';
import { checkGenerationLimit, recordApiUsage } from '@/lib/usage';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { getGoogleApiKey } from '@/lib/apiKeys';
import type { DesignContext } from '@/lib/claude-templates';
import { GEMINI_PRICING } from '@/lib/ai-costs';

const MODEL_NAME = 'gemini-2.0-flash';

function buildEditSystemPrompt(options: {
  layoutMode: 'desktop' | 'responsive';
  designContext?: DesignContext | null;
  templateType?: string;
}): string {
  const { layoutMode, designContext, templateType } = options;

  let prompt = `あなたは優秀なWebデザイナー兼フロントエンドエンジニアです。
ユーザーから既存のHTMLコードと修正指示を受け取り、指示通りにコードを修正してください。

【基本ルール】
- 既存のコード構造やスタイルをできるだけ維持しながら、指示された部分のみ修正する
- 完全なHTMLファイルとして出力（<!DOCTYPE html>から</html>まで）
- CSS・JSはインライン埋め込み（外部依存なし）
- 出力はHTMLコードのみ（説明文・コメント不要）
- 全てのテキストは日本語で記述
- 元のデザインの雰囲気を壊さないように注意

【修正のベストプラクティス】
- テキスト変更の場合: 該当テキストのみ変更し、HTMLタグやスタイルは維持
- 色変更の場合: CSS変数を使用している場合は変数を、直接指定の場合は該当箇所を修正
- レイアウト変更の場合: 既存のCSS構造を尊重しつつ必要最小限の変更
- 追加の場合: 既存のスタイルパターンに合わせて追加\n\n`;

  // Layout mode
  if (layoutMode === 'desktop') {
    prompt += `【レイアウト: デスクトップ専用】
- 想定画面幅: 1024px〜1440px
- モバイル用メディアクエリは追加しない\n\n`;
  } else {
    prompt += `【レイアウト: レスポンシブ対応必須】
- 必ずモバイル（〜768px）とデスクトップ（769px〜）の両方に対応すること
- モバイルファースト設計: 基本スタイルはモバイル用、@media (min-width: 769px) でデスクトップ用を追加
- モバイルでは: 1カラムレイアウト、タップしやすいボタンサイズ（min-height: 44px）、適切なフォントサイズ（16px以上）
- フレックスボックスやグリッドは flex-wrap: wrap や適切な grid-template-columns で対応
- 画像は max-width: 100% で親要素に収まるように\n\n`;
  }

  // Design context
  if (designContext) {
    prompt += `【デザインシステム（維持すること）】\n`;
    if (designContext.colorPalette) {
      const cp = designContext.colorPalette;
      prompt += `カラー:
  Primary: ${cp.primary}
  Secondary: ${cp.secondary}
  Accent: ${cp.accent}
  Background: ${cp.background}\n`;
    }
    if (designContext.vibe) {
      prompt += `雰囲気: ${designContext.vibe}\n`;
    }
    prompt += '\n';
  }

  if (templateType) {
    prompt += `【元のテンプレート: ${templateType}】\n\n`;
  }

  return prompt;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { currentHtml, editPrompt, layoutMode, designContext, templateType } = body as {
    currentHtml: string;
    editPrompt: string;
    layoutMode?: 'desktop' | 'responsive';
    designContext?: DesignContext | null;
    templateType?: string;
  };

  if (!currentHtml || !editPrompt) {
    return NextResponse.json(
      { error: 'currentHtml and editPrompt are required' },
      { status: 400 }
    );
  }

  // Build system prompt
  const systemPrompt = buildEditSystemPrompt({
    layoutMode: layoutMode || 'responsive',
    designContext: designContext || null,
    templateType,
  });

  // Credit check
  const limitCheck = await checkGenerationLimit(user.id);
  if (!limitCheck.allowed) {
    return NextResponse.json({
      error: limitCheck.needApiKey ? 'API_KEY_REQUIRED' :
             limitCheck.needPurchase ? 'CREDIT_INSUFFICIENT' : 'USAGE_LIMIT_EXCEEDED',
      message: limitCheck.reason,
      needApiKey: limitCheck.needApiKey,
      needPurchase: limitCheck.needPurchase,
    }, { status: limitCheck.needApiKey ? 402 : 429 });
  }

  const startTime = createTimer();

  try {
    const apiKey = await getGoogleApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'Google API key is not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // メインの指示テキスト
    const fullPrompt = `${systemPrompt}

---

以下のHTMLコードを修正してください。

【現在のHTMLコード】
\`\`\`html
${currentHtml}
\`\`\`

【修正指示】
${editPrompt}

修正後の完全なHTMLコードを出力してください。`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const textContent = response.text();

    // Extract HTML from response
    let html = textContent;
    const htmlMatch = textContent.match(/```html\s*([\s\S]*?)```/);
    if (htmlMatch) {
      html = htmlMatch[1].trim();
    } else if (!textContent.trim().startsWith('<!DOCTYPE') && !textContent.trim().startsWith('<html')) {
      const docTypeMatch = textContent.match(/(<!DOCTYPE[\s\S]*<\/html>)/i);
      if (docTypeMatch) {
        html = docTypeMatch[1];
      }
    }

    // Estimate cost (Gemini 2.0 Flash pricing)
    const pricing = GEMINI_PRICING[MODEL_NAME] || { input: 0.075, output: 0.30 };
    const inputTokens = fullPrompt.length / 4; // rough estimate
    const outputTokens = textContent.length / 4;
    const estimatedCost = (inputTokens / 1000000 * pricing.input) + (outputTokens / 1000000 * pricing.output);

    const logResult = await logGeneration({
      userId: user.id,
      type: 'gemini-edit-code',
      endpoint: '/api/ai/claude-edit-code',
      model: MODEL_NAME,
      inputPrompt: editPrompt,
      outputResult: html.slice(0, 5000),
      status: 'succeeded',
      startTime,
    });

    // Record usage
    if (logResult && !limitCheck.skipCreditConsumption) {
      await recordApiUsage(user.id, logResult.id, estimatedCost, {
        model: MODEL_NAME,
        inputTokens: Math.round(inputTokens),
        outputTokens: Math.round(outputTokens),
      });
    }

    return NextResponse.json({
      success: true,
      html,
      estimatedCost,
      usage: {
        inputTokens: Math.round(inputTokens),
        outputTokens: Math.round(outputTokens),
      },
    });
  } catch (error: any) {
    await logGeneration({
      userId: user.id,
      type: 'gemini-edit-code',
      endpoint: '/api/ai/claude-edit-code',
      model: MODEL_NAME,
      inputPrompt: editPrompt,
      status: 'failed',
      errorMessage: error.message,
      startTime,
    });

    return NextResponse.json(
      { error: 'Edit failed', message: error.message },
      { status: 500 }
    );
  }
}
