import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export async function POST(request: NextRequest) {
    try {
        const { message, currentText, role, dsl } = await request.json();

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            あなたはLP専門の敏腕ディレクターです。
            ユーザーからの「修正リクエスト」に基づき、現在のコピーを改善してください。

            【現在の状態】
            セクション役割: ${role}
            現在のコピー: "${currentText}"
            設計意図(DSL): ${JSON.stringify(dsl)}

            【ユーザーからの修正リクエスト】
            "${message}"

            【指示】
            1. リクエストの内容を最大限に反映しつつ、LPとしての成約率（CVR）を高める表現を提案してください。
            2. 出力は「修正後のコピー」と、なぜそのように修正したかの「ディレクターの意図（解説）」をJSONで返してください。

            出力形式（JSONのみ）:
            {
              "revisedText": "修正後のコピー全文",
              "reason": "修正のポイント（例：よりベネフィットが伝わるよう、具体的な数字を盛り込みました）"
            }
        `;

        const result = await model.generateContent(prompt);
        const resText = result.response.text();

        const jsonMatch = resText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('JSON生成失敗');

        return NextResponse.json(JSON.parse(jsonMatch[0]));
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
