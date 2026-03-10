import { NextRequest, NextResponse } from 'next/server';
import { getClaudeClient } from '@/lib/claude';
import { createClient } from '@/lib/supabase/server';
import { checkGenerationLimit, recordApiUsage } from '@/lib/usage';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { getTemplate, TEMPLATES, buildSystemPrompt } from '@/lib/claude-templates';
import type { FormField, DesignContext } from '@/lib/claude-templates';
import { estimateClaudeCost } from '@/lib/ai-costs';

const MODEL_NAME = 'claude-haiku-4-5-20251001';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { templateId, prompt, layoutMode, designContext, formFields, enableFormSubmission } = body as {
    templateId: string;
    prompt: string;
    layoutMode?: 'desktop' | 'responsive';
    designContext?: DesignContext | null;
    formFields?: FormField[];
    enableFormSubmission?: boolean;
  };

  if (!templateId || !prompt) {
    return NextResponse.json(
      { error: 'templateId and prompt are required' },
      { status: 400 }
    );
  }

  const template = getTemplate(templateId);
  if (!template) {
    return NextResponse.json(
      { error: 'Invalid template', validTemplates: TEMPLATES.map(t => t.id) },
      { status: 400 }
    );
  }

  // Build dynamic system prompt
  const systemPrompt = buildSystemPrompt({
    templateId,
    layoutMode: layoutMode || 'responsive',
    designContext: designContext || null,
    formFields: formFields,
    enableFormSubmission: enableFormSubmission,
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
    const claude = getClaudeClient();

    const response = await claude.messages.create({
      model: MODEL_NAME,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `【ユーザーからの指示】\n${prompt}` },
      ],
    });

    // テキスト抽出
    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('\n');

    // Extract HTML from response (handle markdown code blocks)
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

    // 正確なトークン使用量（Anthropic APIが返す）
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const estimatedCost = estimateClaudeCost(MODEL_NAME, inputTokens, outputTokens);

    // Log generation
    const logResult = await logGeneration({
      userId: user.id,
      type: 'claude-generate',
      endpoint: '/api/ai/claude-generate',
      model: MODEL_NAME,
      inputPrompt: prompt,
      outputResult: html.slice(0, 5000),
      status: 'succeeded',
      startTime,
    });

    // Record usage
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
      templateId,
      estimatedCost,
      usage: {
        inputTokens,
        outputTokens,
      },
    });
  } catch (error: any) {
    await logGeneration({
      userId: user.id,
      type: 'claude-generate',
      endpoint: '/api/ai/claude-generate',
      model: MODEL_NAME,
      inputPrompt: prompt,
      status: 'failed',
      errorMessage: error.message,
      startTime,
    });

    return NextResponse.json(
      { error: 'Generation failed', message: error.message },
      { status: 500 }
    );
  }
}
