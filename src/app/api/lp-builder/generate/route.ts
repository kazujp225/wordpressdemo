import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    SYSTEM_PROMPT,
    FULL_LP_PROMPT,
    fillPromptTemplate,
    // parseGeminiResponse (This might not be exported yet, I need to check or implement it here/there)
} from '@/lib/gemini-prompts';

// Initialize Gemini Client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { businessInfo } = body;

        if (!businessInfo) {
            return NextResponse.json({ error: 'Business info is required' }, { status: 400 });
        }

        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            console.error("GOOGLE_GEMINI_API_KEY is not set");
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // Prepare Prompt
        const prompt = fillPromptTemplate(FULL_LP_PROMPT, {
            businessName: businessInfo.businessName,
            industry: businessInfo.industry,
            service: businessInfo.service,
            target: businessInfo.target,
            strengths: businessInfo.strengths,
            differentiators: businessInfo.differentiators || '特になし',
            priceRange: businessInfo.priceRange || '相談に応相談',
            tone: businessInfo.tone,
        });

        // Call Gemini API
        const result = await model.generateContent([
            { text: SYSTEM_PROMPT },
            { text: prompt }
        ]);
        const response = await result.response;
        const text = response.text();

        console.log("Gemini Response:", text.substring(0, 200) + "...");

        // Parse Response
        // Attempt to extract JSON from the text
        let jsonString = text;
        // Remove markdown code blocks if present
        jsonString = jsonString.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

        let generatedData;
        try {
            generatedData = JSON.parse(jsonString);
        } catch (e) {
            console.error("JSON Parse Error:", e);
            console.error("Raw Text:", text);
            return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: generatedData });

    } catch (error: any) {
        console.error('Generation API Error:', error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error'
        }, { status: 500 });
    }
}
