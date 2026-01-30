import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { suggestBenefitsSchema, validateRequest } from '@/lib/validations';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkTextGenerationLimit, recordApiUsage } from '@/lib/usage';

const MODEL = 'gemini-2.0-flash';

export async function POST(req: NextRequest) {
    const startTime = createTimer();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // クレジット残高チェック
    const limitCheck = await checkTextGenerationLimit(user.id, MODEL, 1000, 3000);
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
        const body = await req.json();

        // Validate request body
        const validation = validateRequest(suggestBenefitsSchema, body);
        if (!validation.success) {
            const firstError = validation.details[0];
            return NextResponse.json({
                error: firstError.message || 'Validation failed',
                details: validation.details
            }, { status: 400 });
        }

        const {
            businessName,
            industry,
            businessType,
            productName,
            productDescription,
            productCategory,
            priceInfo,
            deliveryMethod,
            targetAudience,
            targetAge,
            targetGender,
            targetOccupation,
            painPoints,
            desiredOutcome,
            generateType,
        } = validation.data;

        const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user.id);
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({
                error: 'Google API key is not configured'
            }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL });

        // コンテキスト情報を構築
        const contextInfo = `
【ビジネス情報】
- 会社/サービス名: ${businessName}
- 業種: ${industry}
- ビジネスモデル: ${businessType}

【商品/サービス情報】
- 商品名: ${productName}
- カテゴリ: ${productCategory}
- 詳細説明: ${productDescription}
${priceInfo ? `- 価格帯: ${priceInfo}` : ''}
${deliveryMethod ? `- 提供方法: ${deliveryMethod}` : ''}

【ターゲット情報】
- ターゲット層: ${targetAudience}
${targetAge ? `- 年齢層: ${targetAge}` : ''}
${targetGender ? `- 性別: ${targetGender}` : ''}
${targetOccupation ? `- 職業: ${targetOccupation}` : ''}
- 抱えている課題: ${painPoints}
- 理想の状態: ${desiredOutcome}
`;

        let prompt = '';

        if (generateType === 'benefits' || generateType === 'all') {
            prompt += `
【タスク1: メリット・ベネフィットの提案】
上記の商材情報から、ターゲットが得られる具体的なメリット・ベネフィットを5つ提案してください。

ルール:
- 「〜できる」「〜になる」など、ターゲット視点の表現にする
- 具体的な数字や期間を入れられる場合は入れる（例: 30%削減、3日で届く）
- 課題解決と理想実現の両方の観点を含める
- 競合との差別化につながる独自性のあるメリットを含める

出力形式:
・メリット1
・メリット2
・メリット3
・メリット4
・メリット5

`;
        }

        if (generateType === 'usp' || generateType === 'all') {
            prompt += `
【タスク2: USP・差別化ポイントの提案】
上記の商材情報から、競合と差別化できる独自の強み（USP）を5つ提案してください。

ルール:
- 「業界初」「唯一の」「特許取得」など独自性を強調できる表現
- 具体的な実績や数字を想定して含める
- ターゲットが「ここにしかない」と感じるポイント
- 競合が真似できない/真似しにくい強み

出力形式:
・USP1
・USP2
・USP3
・USP4
・USP5

`;
        }

        if (generateType === 'socialProof' || generateType === 'all') {
            prompt += `
【タスク3: 社会的証明の提案】
上記の商材情報から、信頼性を高める社会的証明の例を5つ提案してください。

ルール:
- 導入企業数、利用者数、満足度などの数字
- メディア掲載、受賞歴、認定・資格
- 有名企業・著名人の利用実績（仮想例として）
- お客様の声の例文（仮想の具体的コメント）

出力形式:
・社会的証明1
・社会的証明2
・社会的証明3
・社会的証明4
・社会的証明5

`;
        }

        if (generateType === 'guarantees' || generateType === 'all') {
            prompt += `
【タスク4: 保証・安心要素の提案】
上記の商材情報から、購入のリスクを下げる保証・安心要素を5つ提案してください。

ルール:
- 返金保証、無料トライアル、お試し期間
- サポート体制（24時間、専任担当など）
- セキュリティ、プライバシー保護
- 実績・信頼性に基づく安心感
- 業界の一般的な保証慣行も参考に

出力形式:
・保証1
・保証2
・保証3
・保証4
・保証5

`;
        }

        const fullPrompt = `あなたはLP（ランディングページ）のコピーライティング専門家です。
高CVRを実現するための説得力のあるコピーを提案してください。

${contextInfo}

${prompt}

重要: 日本語で出力してください。箇条書きの「・」で始めてください。
`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        // ログ記録（成功）
        const logResult = await logGeneration({
            userId: user.id,
            type: 'suggest-benefits',
            endpoint: '/api/ai/suggest-benefits',
            model: MODEL,
            inputPrompt: fullPrompt,
            outputResult: text,
            status: 'succeeded',
            startTime
        });

        // クレジット消費
        if (logResult && !skipCreditConsumption) {
            await recordApiUsage(user.id, logResult.id, logResult.estimatedCost, { model: MODEL });
        }

        // テキストをパースして各セクションを抽出
        const sections: Record<string, string[]> = {
            benefits: [],
            usp: [],
            socialProof: [],
            guarantees: [],
        };

        if (generateType === 'all') {
            // 全てを生成する場合、セクションヘッダーで分割
            const benefitsMatch = text.match(/【タスク1[^】]*】([\s\S]*?)(?=【タスク2|$)/);
            const uspMatch = text.match(/【タスク2[^】]*】([\s\S]*?)(?=【タスク3|$)/);
            const socialMatch = text.match(/【タスク3[^】]*】([\s\S]*?)(?=【タスク4|$)/);
            const guaranteesMatch = text.match(/【タスク4[^】]*】([\s\S]*?)$/);

            if (benefitsMatch) {
                sections.benefits = benefitsMatch[1].split('\n').filter(l => l.trim().startsWith('・')).map(l => l.trim().replace(/^・\s*/, ''));
            }
            if (uspMatch) {
                sections.usp = uspMatch[1].split('\n').filter(l => l.trim().startsWith('・')).map(l => l.trim().replace(/^・\s*/, ''));
            }
            if (socialMatch) {
                sections.socialProof = socialMatch[1].split('\n').filter(l => l.trim().startsWith('・')).map(l => l.trim().replace(/^・\s*/, ''));
            }
            if (guaranteesMatch) {
                sections.guarantees = guaranteesMatch[1].split('\n').filter(l => l.trim().startsWith('・')).map(l => l.trim().replace(/^・\s*/, ''));
            }
        } else {
            // 単一セクションの場合
            const lines = text.split('\n').filter(line => line.trim().startsWith('・'));
            const items = lines.map(l => l.trim().replace(/^・\s*/, ''));
            sections[generateType] = items;
        }

        return NextResponse.json({
            success: true,
            suggestions: sections,
            raw: text,
        });

    } catch (error: any) {
        console.error('AI suggest error:', error);

        // ログ記録（エラー）
        await logGeneration({
            userId: user.id,
            type: 'suggest-benefits',
            endpoint: '/api/ai/suggest-benefits',
            model: MODEL,
            inputPrompt: 'Error before prompt',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        // ユーザーフレンドリーなエラーメッセージを生成
        let userMessage = 'AI提案の生成中にエラーが発生しました。';

        if (error.message?.includes('API key')) {
            userMessage = 'APIキーに問題があります。設定画面でAPIキーを確認してください。';
        } else if (error.message?.includes('quota') || error.message?.includes('limit') || error.message?.includes('429')) {
            userMessage = 'API利用上限に達しました。しばらく待ってから再試行してください。';
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            userMessage = 'ネットワークエラーが発生しました。接続を確認して再試行してください。';
        } else if (error.message?.includes('timeout')) {
            userMessage = '処理がタイムアウトしました。もう一度お試しください。';
        } else {
            userMessage = 'AI提案の生成中に予期せぬエラーが発生しました。入力内容を確認して再試行してください。';
        }

        return NextResponse.json({
            error: userMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
    }
}
