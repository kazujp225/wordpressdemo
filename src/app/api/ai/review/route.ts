import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkTextGenerationLimit, recordApiUsage } from '@/lib/usage';

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
    const { text, role, dsl } = await request.json();

    const apiKey = await getGoogleApiKeyForUser(user.id);
    if (!apiKey) {
      return NextResponse.json({ error: '設定画面でAPIキーを設定してください。' }, { status: 500 });
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    prompt = `
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

    const resultData = JSON.parse(jsonMatch[0]);

    // ログ記録（成功）
    const logResult = await logGeneration({
      userId: user.id,
      type: 'review',
      endpoint: '/api/ai/review',
      model: 'gemini-2.0-flash',
      inputPrompt: prompt,
      outputResult: JSON.stringify(resultData),
      status: 'succeeded',
      startTime
    });

    // クレジット消費
    if (logResult && !skipCreditConsumption) {
      await recordApiUsage(user.id, logResult.id, logResult.estimatedCost, { model: 'gemini-2.0-flash' });
    }

    return NextResponse.json(resultData);
  } catch (error: any) {
    console.error('AI Review Final Error:', error);

    // ログ記録（エラー）
    await logGeneration({
      userId: user.id,
      type: 'review',
      endpoint: '/api/ai/review',
      model: 'gemini-2.0-flash',
      inputPrompt: prompt || 'Error before prompt',
      status: 'failed',
      errorMessage: error.message,
      startTime
    });

    return NextResponse.json({
      error: 'AI Review Failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
