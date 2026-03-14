/**
 * Google Generative AI API ヘルパー
 * APIキーをURLクエリパラメータではなくヘッダーで送信する
 */

export function googleAIUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

export function googleAIHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  };
}
