import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkTextGenerationLimit, recordApiUsage } from '@/lib/usage';

// Type definitions for the design structure
export interface DesignDefinition {
    colorPalette: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
    };
    typography: {
        style: string;
        mood: string;
    };
    layout: {
        density: string;
        style: string;
    };
    vibe: string;
    description: string;
}

export async function POST(request: NextRequest) {
    const startTime = createTimer();
    let prompt = '';

    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // クレジット残高チェック
    const limitCheck = await checkTextGenerationLimit(user.id, 'gemini-2.0-flash', 1000, 2000);
    if (!limitCheck.allowed) {
        if (limitCheck.needApiKey) {
            return NextResponse.json({ error: 'API_KEY_REQUIRED', message: limitCheck.reason }, { status: 402 });
        }
        if (limitCheck.needSubscription) {
            return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED', message: limitCheck.reason }, { status: 402 });
        }
        return NextResponse.json({ error: 'INSUFFICIENT_CREDIT', message: limitCheck.reason, needPurchase: true }, { status: 402 });
    }
    const skipCreditConsumption = limitCheck.skipCreditConsumption || false;

    try {
        const { imageUrl } = await request.json();

        if (!imageUrl) {
            return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
        }

        const apiKey = await getGoogleApiKeyForUser(user.id);
        if (!apiKey) {
            return NextResponse.json({ error: 'Google API key is not configured. 設定画面でAPIキーを設定してください。' }, { status: 500 });
        }
        const genAI = new GoogleGenerativeAI(apiKey);

        // Handle image data - either base64 data URL or regular URL
        let base64Content: string;

        if (imageUrl.startsWith('data:')) {
            // Already a base64 data URL - extract the base64 part
            const matches = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
            if (!matches) {
                throw new Error('Invalid base64 data URL format');
            }
            base64Content = matches[1];
        } else {
            // Regular URL - fetch the image
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`;

            const imgRes = await fetch(fullUrl);
            if (!imgRes.ok) {
                throw new Error(`Failed to fetch image: ${imgRes.statusText}`);
            }
            const buffer = await imgRes.arrayBuffer();
            base64Content = Buffer.from(buffer).toString('base64');
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        prompt = `
            You are an expert Creative Director and UI/UX Designer.
            Analyze the provided image (which is a reference website design) and extract its "Design Definition".
            
            Focus on capturing the "Soul" and "Vibe" of the design so it can be replicated.
            
            Return ONLY a JSON object with this structure:
            {
                "colorPalette": {
                    "primary": "dominant color code or name",
                    "secondary": "secondary color",
                    "accent": "highlight/action color",
                    "background": "main background color"
                },
                "typography": {
                    "style": "e.g., Sans-Serif / Serif / Monospace / Handwritten",
                    "mood": "e.g., Modern / Classic / Bold / Elegant / Playful"
                },
                "layout": {
                    "density": "e.g., High (cluttered) / Medium / Low (spacious)",
                    "style": "e.g., Grid / Hero-focused / Minimal / Broken Grid / Card-based"
                },
                "vibe": "3-5 keywords describing the aesthetic (e.g., Luxury, Dark Mode, Corporate, Pop)",
                "description": "A concise 2-sentence summary of the design language for a developer."
            }
        `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Content,
                    mimeType: "image/jpeg"
                }
            }
        ]);

        const resText = result.response.text();

        // Extract JSON
        const jsonMatch = resText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("Raw AI Response:", resText);
            throw new Error('Failed to parse AI response as JSON');
        }

        const designDefinition = JSON.parse(jsonMatch[0]);

        // Log success
        const logResult = await logGeneration({
            userId: user.id,
            type: 'design-analysis',
            endpoint: '/api/ai/analyze-design',
            model: 'gemini-2.0-flash',
            inputPrompt: 'Analyze Design Vibe',
            outputResult: JSON.stringify(designDefinition),
            status: 'succeeded',
            startTime
        });

        // クレジット消費
        if (logResult && !skipCreditConsumption) {
            await recordApiUsage(user.id, logResult.id, logResult.estimatedCost, { model: 'gemini-2.0-flash' });
        }

        return NextResponse.json(designDefinition);

    } catch (error: any) {
        console.error('Design Analysis Error:', error);

        await logGeneration({
            userId: user.id,
            type: 'design-analysis',
            endpoint: '/api/ai/analyze-design',
            model: 'gemini-2.0-flash',
            inputPrompt: prompt || 'Error pre-prompt',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        return NextResponse.json({
            error: 'Design Analysis Failed',
            details: error.message
        }, { status: 500 });
    }
}
