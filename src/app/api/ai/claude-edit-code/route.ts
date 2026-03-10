import { NextRequest, NextResponse } from 'next/server';
import { getClaudeClient } from '@/lib/claude';
import { createClient } from '@/lib/supabase/server';
import { checkGenerationLimit, recordApiUsage } from '@/lib/usage';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import type { DesignContext } from '@/lib/claude-templates';
import { estimateClaudeCost } from '@/lib/ai-costs';

const MODEL_NAME = 'claude-haiku-4-5-20251001';

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
             limitCheck.needPurchase ? 'CREDIT_INSUFFICIENT' :
             'USAGE_LIMIT_EXCEEDED',
      message: limitCheck.reason,
      needApiKey: limitCheck.needApiKey,
      needPurchase: limitCheck.needPurchase,
    }, { status: limitCheck.needApiKey ? 402 : 429 });
  }

  const startTime = createTimer();

  try {
    const claude = getClaudeClient();

    const userContent = `以下のHTMLコードを修正してください。

【現在のHTMLコード】
\`\`\`html
${currentHtml}
\`\`\`

【修正指示】
${editPrompt}

修正後の完全なHTMLコードを出力してください。`;

    const response = await claude.messages.create({
      model: MODEL_NAME,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userContent },
      ],
    });

    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('\n');

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

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const estimatedCost = estimateClaudeCost(MODEL_NAME, inputTokens, outputTokens);

    const logResult = await logGeneration({
      userId: user.id,
      type: 'claude-edit-code',
      endpoint: '/api/ai/claude-edit-code',
      model: MODEL_NAME,
      inputPrompt: editPrompt,
      outputResult: html.slice(0, 5000),
      status: 'succeeded',
      startTime,
    });

    if (logResult && !limitCheck.skipCreditConsumption) {
      await recordApiUsage(user.id, logResult.id, estimatedCost, {
        model: MODEL_NAME,
        inputTokens,
        outputTokens,
      });
    }

    return NextResponse.json({
      success: true,
      html,
      estimatedCost,
      usage: {
        inputTokens,
        outputTokens,
      },
    });
  } catch (error: any) {
    await logGeneration({
      userId: user.id,
      type: 'claude-edit-code',
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
