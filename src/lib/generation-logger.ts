import { prisma } from '@/lib/db';
import { estimateTextCost, estimateImageCost, estimateTokens, estimateClaudeCost } from './ai-costs';

export type GenerationType =
  | 'copy'
  | 'image'
  | 'inpaint'
  | 'edit-image'
  | 'prompt-copilot'
  | 'review'
  | 'image-to-prompt'
  | 'generate-nav'
  | 'chat-edit'
  | 'lp-generate'
  | 'lp-generate-text-based'
  | 'import-arrange'
  | 'design-analysis'
  | 'boundary-connector'
  | 'boundary-design'
  | '4k-upscale'
  | 'section-generate'
  | 'design-unify'
  | 'background-unify'
  | 'ocr'
  | 'text-fix'
  | 'upscale'
  | 'video-generate'
  | 'claude-generate'
  | 'claude-edit-code'
  | 'gemini-generate'
  | 'gemini-edit-code'
  | 'seo-analysis'
  | 'llmo-analysis'
  | 'seo-llmo-combined'
  | 'suggest-benefits'
  | 'extract-background-color'
  | 'outpaint'
  | 'banner-generate';

export interface LogGenerationParams {
  userId?: string | null;
  type: GenerationType;
  endpoint: string;
  model: string;
  inputPrompt: string;
  outputResult?: string | null;
  imageCount?: number;
  status: 'succeeded' | 'failed';
  errorMessage?: string | null;
  startTime?: number; // Date.now() at start
}

// Color log helper for console
const log = {
  info: (msg: string) => console.log(`\x1b[36m[GENERATION-LOG]\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m[GENERATION-LOG]\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`\x1b[31m[GENERATION-LOG]\x1b[0m ${msg}`),
};

export interface LogGenerationResult {
  id: number;
  estimatedCost: number;
  inputTokens: number;
  outputTokens: number;
}

export async function logGeneration(params: LogGenerationParams): Promise<LogGenerationResult | null> {
  const {
    userId,
    type,
    endpoint,
    model,
    inputPrompt,
    outputResult,
    imageCount = 0,
    status,
    errorMessage,
    startTime
  } = params;

  // Estimate tokens for text-based models
  const inputTokens = estimateTokens(inputPrompt);
  const outputTokens = outputResult ? estimateTokens(outputResult) : 0;

  // Calculate cost based on model type
  let estimatedCost = 0;
  if (imageCount > 0) {
    estimatedCost = estimateImageCost(model, imageCount);
  } else if (model.startsWith('claude-')) {
    estimatedCost = estimateClaudeCost(model, inputTokens, outputTokens);
  } else {
    estimatedCost = estimateTextCost(model, inputTokens, outputTokens);
  }

  // Calculate duration
  const durationMs = startTime ? Date.now() - startTime : null;

  try {
    const generationRun = await prisma.generationRun.create({
      data: {
        userId: userId || null,
        type,
        endpoint,
        model,
        inputPrompt: inputPrompt.slice(0, 10000), // Limit prompt length
        outputResult: outputResult?.slice(0, 10000) || null,
        inputTokens,
        outputTokens,
        imageCount: imageCount || null,
        estimatedCost,
        status,
        errorMessage: errorMessage || null,
        durationMs
      }
    });

    if (status === 'succeeded') {
      log.success(`Logged: ${type} | ${model} | $${estimatedCost.toFixed(6)} | ${durationMs}ms`);
    } else {
      log.error(`Logged (failed): ${type} | ${model} | Error: ${errorMessage}`);
    }

    return {
      id: generationRun.id,
      estimatedCost,
      inputTokens,
      outputTokens,
    };
  } catch (error) {
    log.error(`Failed to log generation: ${error}`);
    return null;
  }
}

// Helper to create a timer
export function createTimer(): number {
  return Date.now();
}
