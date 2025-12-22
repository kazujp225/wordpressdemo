import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { text, role, dsl } = await request.json();

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
            あなたは、数々のLPのコンバージョン率を改善してきた【超一流のLPセールスライター】です。
            提出されたコピーの「説得力」「ベネフィットの明確さ」「ターゲットへの刺さり」をプロの視点で評価し、改善案を提示してください。

            【対象の提出案】
            セクションの役割: ${role}
            提出コピー: "${text}"
            設計データ(DSL): ${JSON.stringify(dsl)}

            【レビュー基準（厳守）】
            1. 法務リスク: 薬機法、景表法への抵触がないか（「最高」「改善」「治療」等の断定的・誇大表現のチェック）。
            2. ブランド整合性: トーン＆マナーが ${dsl?.brand_guidelines || '一般的'} に守られているか。
            3. UX/CVR: ベネフィット（FAB）が伝わっているか。

            出力形式（JSONのみ）:
            {
              "score": { "legal": 0-100, "brand": 0-100, "marketing": 0-100 },
              "feedback": "改善ポイントの要約",
              "redline": "具体的などの箇所をどう変えるべきか（プロの赤入れ）",
              "revisedText": "最も効果が高いと思われる修正コピー案"
            }
        `;

    const result = await model.generateContent(prompt);
    const resText = result.response.text();

    const jsonMatch = resText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON生成失敗');

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (error: any) {
    console.error('AI Review Final Error:', error);
    return NextResponse.json({
      error: 'AI Review Failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
