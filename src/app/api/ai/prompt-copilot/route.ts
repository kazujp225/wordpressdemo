import { NextRequest, NextResponse } from 'next/server';

// 管理者負担のAPIキー（環境変数から取得）
const ADMIN_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

const SYSTEM_PROMPT = `あなたはLP（ランディングページ）画像生成のプロンプト作成を支援するコパイロットです。

【あなたの役割】
- ユーザーの商材やサービスについてヒアリング
- 効果的なプロンプトの提案
- プロンプトの改善アドバイス
- ターゲット層に合わせた表現の提案

【プロンプト作成のポイント】
1. 商材/サービスの特徴を明確に
2. ターゲット層（年齢、性別、悩み）を具体的に
3. 訴求ポイント（価格、品質、限定感など）
4. トーン&マナー（高級感、親しみやすさ、信頼感など）
5. 色味やスタイルの方向性

【回答のルール】
- 簡潔に回答（3-5文程度）
- 具体的なプロンプト例を提示する時は【プロンプト例】として明示
- 質問がある場合は1つずつ聞く
- 日本語で回答`;

export async function POST(request: NextRequest) {
    try {
        const { messages } = await request.json();

        // 管理者負担のAPIキーを使用（ユーザー認証不要）
        if (!ADMIN_API_KEY) {
            return NextResponse.json({
                error: 'システムAPIキーが設定されていません。管理者に連絡してください。'
            }, { status: 500 });
        }

        // Gemini 1.5 Flash 8B（最も安いモデル）でAPI呼び出し
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${ADMIN_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: SYSTEM_PROMPT }]
                    },
                    contents: messages.map((m: any) => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    })),
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('Gemini API error:', error);
            throw new Error('AI応答の生成に失敗しました');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'すみません、応答を生成できませんでした。';

        return NextResponse.json({ message: text });

    } catch (error: any) {
        console.error('Prompt Copilot Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
