import { NextRequest, NextResponse } from 'next/server';
import { getClaudeClient } from '@/lib/claude';
import { createClient } from '@/lib/supabase/server';
import { checkGenerationLimit, recordApiUsage, incrementFreeAICodeGenCount } from '@/lib/usage';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { estimateClaudeCost } from '@/lib/ai-costs';
import type { DesignContext } from '@/lib/claude-templates';

const MODEL_NAME = 'claude-haiku-4-5-20251001';

function buildSystemPrompt(options: {
  mode: 'generate' | 'edit';
  layoutMode: 'desktop' | 'responsive';
  designContext?: DesignContext | null;
  templateType?: string;
}): string {
  const { mode, layoutMode, designContext, templateType } = options;

  let prompt = `あなたは優秀なWebデザイナー兼フロントエンドエンジニアです。
ランディングページ（LP）のHTML/CSSセクションを${mode === 'generate' ? '生成' : '修正'}してください。

【基本ルール】
- 完全なHTMLファイルとして出力（<!DOCTYPE html>から</html>まで）
- CSS・JSはインライン埋め込み（外部依存なし、Googleフォントは例外的にOK）
- HTMLコードは必ず \`\`\`html ... \`\`\` で囲んで出力
- HTMLコードの前後に簡潔な説明を日本語で付ける
- 全てのテキストは日本語で記述
- モダンで洗練されたデザインにする
- smooth scrollを有効にする（scroll-behavior: smooth）

【LP用HTML/CSSのベストプラクティス】
- セクションの区切りを明確にする（背景色の交互切替など）
- CTAボタンは目立つグラデーションで、ホバーエフェクト付き
- テーブルは見やすくストライプ表示
- Q&Aはアコーディオン（純CSS or 最小限のJS）
- お問い合わせフォームはdl/dt/ddで構成、必須マーク付き
- フッターはシンプルにコピーライトとリンク
- max-width: 1000pxで中央揃え（.sec_inner パターン）
`;

  if (layoutMode === 'desktop') {
    prompt += `\n【レイアウト: デスクトップ専用】
- 想定画面幅: 1024px〜1440px
- モバイル用メディアクエリは追加しない\n`;
  } else {
    prompt += `\n【レイアウト: レスポンシブ対応必須】
- モバイルファースト設計
- @media (max-width: 768px) でモバイル対応
- モバイル: 1カラム、タップしやすいボタン（min-height: 44px）、フォントサイズ16px以上
- 画像は max-width: 100%\n`;
  }

  if (designContext) {
    prompt += `\n【デザインシステム】\n`;
    if (designContext.colorPalette) {
      const cp = designContext.colorPalette;
      prompt += `カラー: Primary: ${cp.primary}, Secondary: ${cp.secondary}, Accent: ${cp.accent}, Background: ${cp.background}\n`;
    }
    if (designContext.vibe) {
      prompt += `雰囲気: ${designContext.vibe}\n`;
    }
  }

  if (templateType) {
    prompt += `\n【テンプレートタイプ: ${templateType}】\n`;
  }

  if (mode === 'edit') {
    prompt += `\n【修正時の注意】
- 既存のコード構造やスタイルをできるだけ維持
- 指示された部分のみ修正
- 元のデザインの雰囲気を壊さない\n`;
  }

  return prompt;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { messages, currentHtml, layoutMode, designContext, templateType, mode } = body as {
    messages: ChatMessage[];
    currentHtml?: string;
    layoutMode?: 'desktop' | 'responsive';
    designContext?: DesignContext | null;
    templateType?: string;
    mode: 'generate' | 'edit';
  };

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'messages are required' }, { status: 400 });
  }

  // Credit check
  const limitCheck = await checkGenerationLimit(user.id, undefined, { isAICodeGen: true });
  if (!limitCheck.allowed) {
    return NextResponse.json({
      error: limitCheck.needApiKey ? 'API_KEY_REQUIRED' :
             limitCheck.needPurchase ? 'CREDIT_INSUFFICIENT' :
             limitCheck.needSubscription ? 'UPGRADE_REQUIRED' : 'USAGE_LIMIT_EXCEEDED',
      message: limitCheck.reason,
      needApiKey: limitCheck.needApiKey,
      needPurchase: limitCheck.needPurchase,
    }, { status: limitCheck.needApiKey ? 402 : 429 });
  }

  const startTime = createTimer();
  const lastUserMessage = messages[messages.length - 1]?.content || '';

  try {
    const claude = getClaudeClient();

    const systemPrompt = buildSystemPrompt({
      mode,
      layoutMode: layoutMode || 'responsive',
      designContext: designContext || null,
      templateType,
    });

    // 現在のHTMLがある場合、最初のユーザーメッセージにコンテキストとして追加
    const apiMessages = messages.map((msg, i) => {
      if (i === 0 && msg.role === 'user' && currentHtml) {
        return {
          role: msg.role as 'user' | 'assistant',
          content: `【現在のHTMLコード】\n\`\`\`html\n${currentHtml}\n\`\`\`\n\n【指示】\n${msg.content}`,
        };
      }
      return { role: msg.role as 'user' | 'assistant', content: msg.content };
    });

    const response = await claude.messages.create({
      model: MODEL_NAME,
      max_tokens: 8192,
      system: systemPrompt,
      messages: apiMessages,
    });

    // レスポンスからテキストを抽出
    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('\n');

    // HTMLコードを抽出
    let html: string | null = null;
    const htmlMatch = textContent.match(/```html\s*([\s\S]*?)```/);
    if (htmlMatch) {
      html = htmlMatch[1].trim();
    } else if (textContent.trim().startsWith('<!DOCTYPE') || textContent.trim().startsWith('<html')) {
      html = textContent.trim();
    }

    // HTMLコード以外のテキスト（説明文）を抽出
    let message = textContent;
    if (htmlMatch) {
      message = textContent
        .replace(/```html\s*[\s\S]*?```/g, '')
        .trim();
    }

    // 正確なトークン使用量（Anthropic APIが返す）
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const estimatedCost = estimateClaudeCost(MODEL_NAME, inputTokens, outputTokens);

    // ログ記録
    const logResult = await logGeneration({
      userId: user.id,
      type: 'claude-chat',
      endpoint: '/api/ai/claude-chat',
      model: MODEL_NAME,
      inputPrompt: lastUserMessage,
      outputResult: (html || textContent).slice(0, 5000),
      status: 'succeeded',
      startTime,
    });

    // クレジット消費
    if (logResult && !limitCheck.skipCreditConsumption) {
      await recordApiUsage(user.id, logResult.id, estimatedCost, {
        model: MODEL_NAME,
        inputTokens,
        outputTokens,
      });
    }

    // Freeプラン無料枠カウンターインクリメント
    if (limitCheck.isFreeAICodeGen) {
      await incrementFreeAICodeGenCount(user.id);
    }

    return NextResponse.json({
      success: true,
      html,
      message,
      usage: { inputTokens, outputTokens },
      estimatedCost,
    });
  } catch (error: any) {
    console.error('Claude Chat Error:', error);

    await logGeneration({
      userId: user.id,
      type: 'claude-chat',
      endpoint: '/api/ai/claude-chat',
      model: MODEL_NAME,
      inputPrompt: lastUserMessage,
      status: 'failed',
      errorMessage: error.message,
      startTime,
    });

    return NextResponse.json(
      { error: 'Claude Chat failed', message: error.message },
      { status: 500 }
    );
  }
}
