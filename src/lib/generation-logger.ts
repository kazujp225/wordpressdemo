import { prisma } from '@/lib/db';
import { estimateTextCost, estimateImageCost, estimateTokens } from './ai-costs';

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
  | 'video-generate';

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

export async function logGeneration(params: LogGenerationParams): Promise<void> {
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
  } else {
    estimatedCost = estimateTextCost(model, inputTokens, outputTokens);
  }

  // Calculate duration
  const durationMs = startTime ? Date.now() - startTime : null;

  try {
    await prisma.generationRun.create({
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
  } catch (error) {
    log.error(`Failed to log generation: ${error}`);
  }
}

// Helper to create a timer
export function createTimer(): number {
  return Date.now();
}
