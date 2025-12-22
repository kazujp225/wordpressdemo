import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export async function POST(request: NextRequest) {
    try {
        const { imageUrl } = await request.json();

        // 画像のBase64取得（絶対URLを想定）
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`;

        const imgRes = await fetch(fullUrl);
        const buffer = await imgRes.arrayBuffer();
        const base64Content = Buffer.from(buffer).toString('base64');

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
            あなたは画像生成AI（MidjourneyやDALL-E 3）のプロンプトエンジニアです。
            渡された画像を詳細に解析し、この画像の「魂（テイスト・構成）」を完全に再現するためのプロンプトを作成してください。

            【解析のポイント】
            1. 被写体: 何が写っているか（詳細に）
            2. 構図: カメラアングル、焦点距離、配置
            3. ライティング: 光の種類、影のつき方
            4. 色調: 配色、彩度、コントラスト
            5. テイスト: 写真風、イラスト風、3Dレンダリング、特定の画風など

            【指示】
            英語のプロンプトをメインとし、ユーザーが理解しやすいように日本語の解説も添えてください。

            出力形式（JSONのみ）:
            {
              "prompt": "英語での詳細な画像生成プロンプト",
              "explanation": "日本語によるこの画像の言語化・解説"
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
        const jsonMatch = resText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('解析結果の取得に失敗しました');

        return NextResponse.json(JSON.parse(jsonMatch[0]));
    } catch (error: any) {
        console.error('Image Analysis Final Error:', error);
        return NextResponse.json({
            error: 'Image Analysis Failed',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
