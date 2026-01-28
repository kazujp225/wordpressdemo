import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';
import { checkGenerationLimit, recordApiUsage } from '@/lib/usage';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { getGoogleApiKey } from '@/lib/apiKeys';
import { getTemplate, TEMPLATES, buildSystemPrompt } from '@/lib/claude-templates';
import type { FormField, DesignContext } from '@/lib/claude-templates';
import { GEMINI_PRICING } from '@/lib/ai-costs';

const MODEL_NAME = 'gemini-2.0-flash';

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
    const apiKey = await getGoogleApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'Google API key is not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // Combine system prompt and user prompt
    const fullPrompt = `${systemPrompt}\n\n---\n\n【ユーザーからの指示】\n${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const textContent = response.text();

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

    // Estimate cost (Gemini 2.0 Flash pricing)
    const pricing = GEMINI_PRICING[MODEL_NAME] || { input: 0.075, output: 0.30 };
    const inputTokens = fullPrompt.length / 4; // rough estimate
    const outputTokens = textContent.length / 4;
    const estimatedCost = (inputTokens / 1000000 * pricing.input) + (outputTokens / 1000000 * pricing.output);

    // Log generation
    const logResult = await logGeneration({
      userId: user.id,
      type: 'gemini-generate',
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
        inputTokens: Math.round(inputTokens),
        outputTokens: Math.round(outputTokens),
      });
    }

    return NextResponse.json({
      success: true,
      html,
      templateId,
      estimatedCost,
      usage: {
        inputTokens: Math.round(inputTokens),
        outputTokens: Math.round(outputTokens),
      },
    });
  } catch (error: any) {
    await logGeneration({
      userId: user.id,
      type: 'gemini-generate',
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
