// Gemini API Pricing (per 1M tokens / per image)
// Source: https://ai.google.dev/pricing

export const AI_COSTS = {
  'veo-2.0-generate-001': {
    perSecond: 0.35,
  },
};

export const GEMINI_PRICING = {
  // Text Models (per 1M tokens)
  'gemini-2.0-flash': {
    input: 0.075,   // $0.075 per 1M input tokens
    output: 0.30,   // $0.30 per 1M output tokens
    type: 'text' as const
  },
  'gemini-1.5-flash': {
    input: 0.075,
    output: 0.30,
    type: 'text' as const
  },
  'gemini-1.5-flash-latest': {
    input: 0.075,
    output: 0.30,
    type: 'text' as const
  },
  // Image Models (per image)
  'gemini-3-pro-image-preview': {
    perImage: 0.134, // $0.134 per 1K/2K image (768x1376 = 9:16 aspect ratio)
    type: 'image' as const
  },
  // Video Models (per second)
  'veo-2.0-generate-001': {
    perSecond: 0.35, // $0.35 per second of video
    type: 'video' as const
  }
} as const;

// Claude API Pricing (per 1M tokens)
// Source: https://docs.anthropic.com/en/docs/about-claude/pricing
export const CLAUDE_PRICING = {
  'claude-sonnet-4-20250514': {
    input: 3.0,    // $3.00 per 1M input tokens
    output: 15.0,  // $15.00 per 1M output tokens
    type: 'text' as const,
  },
} as const;

export function estimateClaudeCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = CLAUDE_PRICING[model as keyof typeof CLAUDE_PRICING];
  if (!pricing) return 0;

  return (inputTokens / 1_000_000) * pricing.input +
         (outputTokens / 1_000_000) * pricing.output;
}

export type ModelName = keyof typeof GEMINI_PRICING;

export function estimateTextCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = GEMINI_PRICING[model as ModelName];
  if (!pricing || pricing.type !== 'text') return 0;

  return (inputTokens / 1_000_000) * pricing.input +
         (outputTokens / 1_000_000) * pricing.output;
}

export function estimateImageCost(model: string, imageCount: number): number {
  const pricing = GEMINI_PRICING[model as ModelName];
  if (!pricing || pricing.type !== 'image') return 0;

  return imageCount * pricing.perImage;
}

export function estimateVideoCost(model: string, durationSeconds: number): number {
  const pricing = GEMINI_PRICING[model as ModelName];
  if (!pricing || pricing.type !== 'video') return 0;

  return durationSeconds * pricing.perSecond;
}

// Rough token estimation (4 chars = 1 token for English, 2 chars = 1 token for Japanese)
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const japaneseChars = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || []).length;
  const otherChars = text.length - japaneseChars;
  return Math.ceil(japaneseChars / 2 + otherChars / 4);
}

// Get model display name
export function getModelDisplayName(model: string): string {
  const displayNames: Record<string, string> = {
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'gemini-1.5-flash': 'Gemini 1.5 Flash',
    'gemini-1.5-flash-latest': 'Gemini 1.5 Flash',
    'gemini-3-pro-image-preview': 'Gemini 3 Pro Image (Nano Banana Pro)',
    'veo-2.0-generate-001': 'Veo 2 Video',
    'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  };
  return displayNames[model] || model;
}
