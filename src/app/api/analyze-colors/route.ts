import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';

/**
 * 画像からカラーパレットを抽出するAPI
 * 一括再生成時の色の一貫性を担保するために使用
 */
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
        return Response.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    try {
        const googleApiKey = await getGoogleApiKeyForUser(user.id);
        if (!googleApiKey) {
            return Response.json({ error: 'Google API key is not configured' }, { status: 400 });
        }

        // 画像をダウンロード
        const imageResponse = await fetch(imageUrl);
        const imageArrayBuffer = await imageResponse.arrayBuffer();
        const imageBuffer = Buffer.from(imageArrayBuffer);
        const base64Data = imageBuffer.toString('base64');

        // Gemini APIでカラー抽出
        const prompt = `この画像のWebデザインから、主要なカラーパレットを抽出してください。

以下の形式でJSONのみを出力してください（説明文は不要）：
{
  "primary": "#XXXXXX",
  "secondary": "#XXXXXX",
  "accent": "#XXXXXX",
  "background": "#XXXXXX"
}

- primary: メインカラー（ボタン、見出し、CTAなどの主要要素の色）
- secondary: サブカラー（背景のアクセント、装飾的要素の色）
- accent: アクセントカラー（アイコン、リンク、強調の色）
- background: 主な背景色

色は実際に画像で使われている色を正確に抽出してください。`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: 'image/png', data: base64Data } },
                            { text: prompt }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 256,
                    },
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[AnalyzeColors] API error:', errorText);
            return Response.json({ error: 'Failed to analyze colors' }, { status: 500 });
        }

        const data = await response.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textContent) {
            return Response.json({ error: 'No response from AI' }, { status: 500 });
        }

        // JSONを抽出してパース
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('[AnalyzeColors] Failed to parse JSON:', textContent);
            return Response.json({ error: 'Failed to parse colors' }, { status: 500 });
        }

        const colors = JSON.parse(jsonMatch[0]);

        // バリデーション
        if (!colors.primary || !colors.secondary || !colors.accent || !colors.background) {
            return Response.json({ error: 'Invalid color structure' }, { status: 500 });
        }

        console.log('[AnalyzeColors] Extracted colors:', colors);

        return Response.json({ colors });

    } catch (error: any) {
        console.error('[AnalyzeColors] Error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
