import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkGenerationLimit, recordApiUsage } from '@/lib/usage';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { getClaudeClient } from '@/lib/claude';
import { getTemplate, TEMPLATES, buildSystemPrompt } from '@/lib/claude-templates';
import type { FormField, DesignContext } from '@/lib/claude-templates';
import { estimateClaudeCost } from '@/lib/ai-costs';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { templateId, prompt, layoutMode, designContext, formFields } = body as {
    templateId: string;
    prompt: string;
    layoutMode?: 'desktop' | 'responsive';
    designContext?: DesignContext | null;
    formFields?: FormField[];
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
    const client = getClaudeClient();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text content
    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('');

    // Extract HTML from response (handle markdown code blocks)
    let html = textContent;
    const htmlMatch = textContent.match(/```html\s*([\s\S]*?)```/);
    if (htmlMatch) {
      html = htmlMatch[1].trim();
    } else if (!textContent.trim().startsWith('<!DOCTYPE') && !textContent.trim().startsWith('<html')) {
      // Try to find HTML content between tags
      const docTypeMatch = textContent.match(/(<!DOCTYPE[\s\S]*<\/html>)/i);
      if (docTypeMatch) {
        html = docTypeMatch[1];
      }
    }

    // Log generation
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const estimatedCost = estimateClaudeCost('claude-sonnet-4-20250514', inputTokens, outputTokens);

    const logResult = await logGeneration({
      userId: user.id,
      type: 'claude-generate',
      endpoint: '/api/ai/claude-generate',
      model: 'claude-sonnet-4-20250514',
      inputPrompt: prompt,
      outputResult: html.slice(0, 5000),
      status: 'succeeded',
      startTime,
    });

    // Record usage
    if (logResult && !limitCheck.skipCreditConsumption) {
      await recordApiUsage(user.id, logResult.id, estimatedCost, {
        model: 'claude-sonnet-4-20250514',
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
      model: 'claude-sonnet-4-20250514',
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
