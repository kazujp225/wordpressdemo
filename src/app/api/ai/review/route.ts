import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export async function POST(request: NextRequest) {
    try {
        const { text, role, dsl } = await request.json();

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            あなたは広告代理店のシニアディレクター兼、法務チェック担当者です。
            以下のLPセクションのコピーを「品質」と「法務リスク」の観点で厳しくレビューしてください。

            【対象コピー】
            セクション役割: ${role}
            コピー内容: "${text}"
            設計意図(DSL): ${JSON.stringify(dsl)}

            【チェック項目】
            1. 法務リスク: 断定的表現（世界一、最高、絶対など）、薬機法抵触（効果の保証）がないか。
            2. CVR/UX: ターゲットに刺さる言葉か、具体的か、行動を促せているか。
            3. 整合性: 設定されたトーンと乖離していないか。

            出力形式（JSONのみ）:
            {
              "status": "danger" | "safe",
              "count": 検出された問題数,
              "messages": ["具体的な指摘内容1（改善案含む）", "指摘2..."]
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const resText = response.text();

        const jsonMatch = resText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('JSON生成失敗');

        return NextResponse.json(JSON.parse(jsonMatch[0]));
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
