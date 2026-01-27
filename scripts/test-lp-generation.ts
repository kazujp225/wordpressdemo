import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
function loadEnv() {
    const envPath = path.join(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            process.env[key] = value;
        }
    }
}

loadEnv();

const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.error('GOOGLE_API_KEY not found in environment');
    process.exit(1);
}

console.log('API Key found');

// Business info for Claude Code Academy
const businessInfo = {
    businessName: 'Claude Code Academy',
    industry: 'IT・テクノロジー',
    service: 'Claude Codeを使いこなせるAIエンジニアを育成するオンラインスクール。実践的なカリキュラムで、未経験からでも3ヶ月でAI開発の即戦力人材へ。',
    target: 'AIエンジニアを目指すプログラマー、キャリアアップを目指すエンジニア',
    strengths: '現役AIエンジニアによる実践指導、Claude Code公式ドキュメント準拠、転職サポート付き',
    differentiators: '日本初のClaude Code特化スクール、転職成功率95%',
    priceRange: '月額5万円〜',
    tone: 'professional',
};

const enhancedContext = {
    businessType: 'B2C',
    productName: 'Claude Code Master Course',
    productCategory: 'オンライン講座',
    painPoints: 'AIツールを使いこなせない、独学では限界、差別化スキルがない',
    desiredOutcome: 'Claude Codeを自在に操り、年収アップ・転職成功を実現',
    socialProof: '受講者500名、転職成功率95%、満足度4.8',
    guarantees: '14日間返金保証、転職保証',
    conversionGoal: 'consultation',
    ctaText: '無料カウンセリングを予約する',
    urgencyElement: '今月末まで入会金0円',
    colorPreference: 'ブルー系',
    imageStyle: 'photo',
};

const SYSTEM_PROMPT = `あなたは高CVRを実現するLP（ランディングページ）のコピーライティング専門家です。
PASONA法則（Problem, Agitation, Solution, Narrowing, Action）に基づいて、
ターゲットの心理に訴えかける説得力のあるLPを設計してください。

出力は必ず以下のJSON形式で返してください：
{
  "sections": [
    {
      "type": "hero" | "problem" | "solution" | "benefits" | "features" | "testimonials" | "process" | "guarantee" | "pricing" | "faq" | "cta",
      "data": {
        "headline": "メインの見出し",
        "subheadline": "サブ見出し",
        "description": "説明文",
        "items": []
      }
    }
  ]
}`;

async function generateLP() {
    console.log('\n🚀 Starting LP Generation for Claude Code Academy...\n');

    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
【ビジネス情報】
- 会社/サービス名: ${businessInfo.businessName}
- 業種: ${businessInfo.industry}
- サービス概要: ${businessInfo.service}
- ターゲット: ${businessInfo.target}
- 強み: ${businessInfo.strengths}
- 差別化ポイント: ${businessInfo.differentiators}
- 価格帯: ${businessInfo.priceRange}
- トーン: ${businessInfo.tone}

【追加コンテキスト】
- ビジネスモデル: ${enhancedContext.businessType}
- 商品名: ${enhancedContext.productName}
- カテゴリ: ${enhancedContext.productCategory}
- ターゲットの課題: ${enhancedContext.painPoints}
- 理想の状態: ${enhancedContext.desiredOutcome}
- 社会的証明: ${enhancedContext.socialProof}
- 保証: ${enhancedContext.guarantees}
- コンバージョン目標: 無料カウンセリング予約
- CTAテキスト: ${enhancedContext.ctaText}
- 緊急性要素: ${enhancedContext.urgencyElement}

上記の情報を元に、高CVRを実現するLPの構成を設計してください。
以下のセクションを含めてください：
1. Hero（ファーストビュー）
2. Problem（課題提起）
3. Solution（解決策）
4. Benefits（得られる未来）
5. Features（特徴・カリキュラム）
6. Testimonials（受講生の声）
7. Process（受講の流れ）
8. Guarantee（保証）
9. Pricing（料金）
10. FAQ（よくある質問）
11. CTA（行動喚起）

各セクションには具体的で説得力のあるコピーを含めてください。
`;

    try {
        console.log('📝 Generating LP structure and copy...\n');

        const result = await model.generateContent([
            { text: SYSTEM_PROMPT },
            { text: prompt }
        ]);

        const response = await result.response;
        const text = response.text();

        // Parse JSON from response
        let jsonString = text.trim();
        const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonString = jsonMatch[1];
        } else {
            const codeMatch = jsonString.match(/```\s*([\s\S]*?)\s*```/);
            if (codeMatch) {
                jsonString = codeMatch[1];
            }
        }

        const jsonObjMatch = jsonString.match(/\{[\s\S]*\}/);
        if (jsonObjMatch) {
            jsonString = jsonObjMatch[0];
        }

        const generatedData = JSON.parse(jsonString);

        console.log('✅ LP Structure Generated!\n');
        console.log('='.repeat(60));
        console.log('📋 GENERATED LP SECTIONS');
        console.log('='.repeat(60));

        for (const section of generatedData.sections) {
            const sectionType = section.type.toUpperCase();
            console.log('\n【' + sectionType + '】');
            if (section.data.headline) {
                console.log('  📌 Headline: ' + section.data.headline);
            }
            if (section.data.subheadline) {
                console.log('  📝 Subheadline: ' + section.data.subheadline);
            }
            if (section.data.description) {
                const desc = section.data.description.length > 100
                    ? section.data.description.substring(0, 100) + '...'
                    : section.data.description;
                console.log('  💬 Description: ' + desc);
            }
            if (section.data.items && section.data.items.length > 0) {
                console.log('  📋 Items: ' + section.data.items.length + ' items');
                for (const item of section.data.items.slice(0, 3)) {
                    if (typeof item === 'string') {
                        console.log('    - ' + item);
                    } else if (item.title) {
                        console.log('    - ' + item.title);
                    }
                }
                if (section.data.items.length > 3) {
                    console.log('    ... and ' + (section.data.items.length - 3) + ' more');
                }
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Total sections: ' + generatedData.sections.length);
        console.log('='.repeat(60));

        // Save full output
        fs.writeFileSync('/tmp/generated-lp.json', JSON.stringify(generatedData, null, 2));
        console.log('\n📁 Full output saved to /tmp/generated-lp.json');

        return generatedData;

    } catch (error: any) {
        console.error('❌ Generation failed:', error.message);
        throw error;
    }
}

generateLP().catch(console.error);
