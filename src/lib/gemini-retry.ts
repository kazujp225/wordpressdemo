/**
 * Gemini API用のリトライ付きfetch関数
 * 503/429エラー時に自動リトライ（指数バックオフ）
 */

interface GeminiRetryOptions {
    maxRetries?: number;
    initialDelayMs?: number;
}

export async function fetchWithRetry(
    url: string,
    options: RequestInit,
    { maxRetries = 3, initialDelayMs = 2000 }: GeminiRetryOptions = {}
): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[GEMINI] Attempt ${attempt}/${maxRetries}...`);
            const response = await fetch(url, options);

            if (response.ok) {
                console.log(`[GEMINI] Success on attempt ${attempt}`);
                return response;
            }

            // 503/429エラーの場合はリトライ
            if (response.status === 503 || response.status === 429) {
                const errorText = await response.text();
                console.error(`[GEMINI] Attempt ${attempt} failed with ${response.status}:`, errorText);
                lastError = new Error(`Gemini API error: ${response.status}`);

                if (attempt < maxRetries) {
                    // 指数バックオフで待機
                    const waitTime = initialDelayMs * Math.pow(2, attempt - 1);
                    console.log(`[GEMINI] Retrying in ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
            } else {
                // その他のエラーは即座に失敗
                const errorText = await response.text();
                console.error('[GEMINI] API error:', errorText);
                throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
            }
        } catch (fetchError: any) {
            if (fetchError.message?.includes('Gemini API error:')) {
                throw fetchError;
            }
            console.error(`[GEMINI] Attempt ${attempt} fetch error:`, fetchError.message);
            lastError = fetchError;
            if (attempt < maxRetries) {
                const waitTime = initialDelayMs * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
        }
    }

    throw lastError || new Error('Gemini API request failed after retries');
}
