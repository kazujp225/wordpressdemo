import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables from .env.local
function loadEnv() {
    const envPath = path.join(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex);
                const value = trimmed.substring(eqIndex + 1).replace(/^["']|["']$/g, '');
                process.env[key] = value;
            }
        }
    }
}

loadEnv();

console.log('Database URL loaded:', process.env.DATABASE_URL ? 'Yes' : 'No');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});

const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

// LP content for Claude Code Academy
const lpSections = [
    {
        type: "hero",
        data: {
            headline: "Claude Codeを使いこなせるAIエンジニアへ",
            subheadline: "未経験から3ヶ月でAI開発の即戦力に。Claude Code Academyで未来を切り開け！",
            description: "AIエンジニアの需要が急増する今、Claude Codeをマスターすることは、市場価値を高める絶好のチャンスです。日本初のClaude Code特化スクールで、AIエンジニアとしてのキャリアをスタートさせませんか？"
        }
    },
    {
        type: "problem",
        data: {
            headline: "AIツールを使いこなせていない…そんな悩みを抱えていませんか？",
            subheadline: "AIエンジニアを目指すあなたへ。こんな課題はありませんか？",
            description: "多くのエンジニアが、AIツールの進化の速さに追いつけず、以下のような課題に直面しています。\n\n- AIツールを使いこなせない\n- 独学の限界を感じている\n- 差別化できるスキルがない"
        }
    },
    {
        type: "solution",
        data: {
            headline: "Claude Code Academyが、その悩みを解決します！",
            subheadline: "日本初のClaude Code特化スクールで、最先端のAIエンジニアへ。",
            description: "Claude Code Academyは、Claude Codeを使いこなせるAIエンジニアを育成するオンラインスクールです。現役AIエンジニアによる実践的な指導と、Claude Code公式ドキュメント準拠のカリキュラムで、未経験からでも3ヶ月でAI開発の即戦力人材へ成長できます。"
        }
    },
    {
        type: "benefits",
        data: {
            headline: "Claude Code Academyで得られる未来",
            subheadline: "スキルアップ、キャリアアップ、年収アップ。理想の未来を手に入れよう。",
            description: "Claude Code Academyの受講で、あなたは以下の未来を手に入れることができます。\n\n- Claude Codeを自在に操れるスキル\n- 市場価値の高いAIエンジニア\n- 年収アップ・転職成功（転職成功率95%）"
        }
    },
    {
        type: "features",
        data: {
            headline: "Claude Code Academyの3つの強み",
            subheadline: "未経験からでも、着実にスキルアップできる理由があります。",
            items: [
                { title: "現役AIエンジニアによる実践指導", content: "経験豊富な現役AIエンジニアが、実務で役立つ知識とスキルを丁寧に指導します。" },
                { title: "Claude Code公式ドキュメント準拠", content: "公式ドキュメントに準拠した体系的なカリキュラムで、基礎から応用までしっかりと学べます。" },
                { title: "転職サポート付き", content: "専任のキャリアアドバイザーが、あなたの転職活動を徹底的にサポートします。" }
            ]
        }
    },
    {
        type: "testimonials",
        data: {
            headline: "受講生の声",
            subheadline: "受講生の満足度4.8！多くの受講生が夢を叶えています。",
            items: [
                { name: "Aさん（28歳・プログラマー）", comment: "未経験でしたが、3ヶ月でClaude Codeを使いこなせるようになりました。転職も成功し、年収が150万円アップしました！" },
                { name: "Bさん（35歳・エンジニア）", comment: "実践的なカリキュラムで、すぐに業務に役立つスキルを習得できました。" },
                { name: "Cさん（25歳・学生）", comment: "講師の方々のサポートが手厚く、挫折せずに学習を続けられました。" }
            ]
        }
    },
    {
        type: "process",
        data: {
            headline: "受講の流れ",
            subheadline: "簡単3ステップで、AIエンジニアへの第一歩を踏み出しましょう。",
            items: [
                { step: "1", title: "無料カウンセリング", description: "まずは無料カウンセリングを予約" },
                { step: "2", title: "学習プラン提案", description: "レベルに合わせた最適な学習プランをご提案" },
                { step: "3", title: "受講開始", description: "オンライン講座を受講開始。現役AIエンジニアが丁寧に指導" }
            ]
        }
    },
    {
        type: "guarantee",
        data: {
            headline: "安心の保証制度",
            subheadline: "万が一の場合も安心。あなたの挑戦を全力でサポートします。",
            description: "- 14日間返金保証：受講開始後14日以内であれば全額返金\n- 転職保証：転職に成功しなかった場合、受講料を全額返金"
        }
    },
    {
        type: "pricing",
        data: {
            headline: "料金",
            subheadline: "選べる料金プランで、あなたに合った学習スタイルを。",
            description: "月額5万円〜（3ヶ月コース15万円）\n詳細な料金プランは、無料カウンセリングにてご説明いたします。",
            items: [
                { name: "月額プラン", price: "月額5万円", features: ["ライブ授業参加", "質問し放題", "教材アクセス"] },
                { name: "3ヶ月集中コース", price: "15万円", features: ["全カリキュラム受講", "転職サポート", "返金保証付き"] }
            ]
        }
    },
    {
        type: "faq",
        data: {
            headline: "よくある質問",
            subheadline: "皆様からよくいただく質問にお答えします。",
            items: [
                { question: "プログラミング未経験でも受講できますか？", answer: "はい、未経験の方でも安心して受講できます。基礎から丁寧に指導いたします。" },
                { question: "受講期間はどのくらいですか？", answer: "3ヶ月です。集中的に学習することで、短期間でスキルを習得できます。" },
                { question: "質問はいつでもできますか？", answer: "はい、いつでも質問できます。講師が丁寧に回答いたします。" }
            ]
        }
    },
    {
        type: "cta",
        data: {
            headline: "今すぐ、無料カウンセリングを予約しよう！",
            subheadline: "AIエンジニアへの第一歩を踏み出すチャンスです。",
            description: "今月末まで入会金0円！この機会をお見逃しなく。",
            cta_text: "無料カウンセリングを予約する"
        }
    }
];

async function createLPForUser() {
    try {
        // Find user from UserSettings (Supabase Auth users are stored there)
        console.log('Finding user renrenfujiwara...');
        const userSettings = await prisma.userSettings.findFirst({
            where: {
                OR: [
                    { email: { contains: 'renrenfujiwara' } },
                    { email: { contains: 'renren' } }
                ]
            }
        });

        if (!userSettings) {
            // List all userSettings to help find the right one
            const allUsers = await prisma.userSettings.findMany({
                select: { id: true, userId: true, email: true },
                take: 10
            });
            console.log('User not found. Available users:');
            console.log(JSON.stringify(allUsers, null, 2));
            process.exit(1);
        }

        const userId = userSettings.userId;
        console.log('Found user:', userId, userSettings.email);

        // Create page
        console.log('Creating page...');
        const headerConfig = {
            logoText: 'Claude Code Academy',
            sticky: true,
            ctaText: '無料カウンセリング',
            ctaLink: '#cta',
            navItems: [
                { id: '1', label: '特徴', href: '#features' },
                { id: '2', label: '料金', href: '#pricing' },
                { id: '3', label: 'よくある質問', href: '#faq' }
            ]
        };

        const formConfig = {
            enabled: true,
            fields: [
                { name: 'name', label: '名前', type: 'text', required: true },
                { name: 'email', label: 'メールアドレス', type: 'email', required: true }
            ]
        };

        const page = await prisma.page.create({
            data: {
                userId: userId,
                title: 'Claude Code Academy - AIエンジニア育成スクール',
                slug: 'claude-code-academy-' + Date.now(),
                status: 'draft',
                headerConfig: JSON.stringify(headerConfig),
                formConfig: JSON.stringify(formConfig)
            }
        });

        console.log('Page created:', page.id);

        // Create sections
        console.log('Creating sections...');
        for (let i = 0; i < lpSections.length; i++) {
            const section = lpSections[i];
            await prisma.pageSection.create({
                data: {
                    pageId: page.id,
                    role: section.type,
                    order: i,
                    config: JSON.stringify(section.data)
                }
            });
            console.log('  Created section:', section.type);
        }

        console.log('\n✅ LP created successfully!');
        console.log('Page ID:', page.id);
        console.log('Slug:', page.slug);
        console.log('\nView at:');
        console.log('  Edit: http://localhost:3000/admin/pages/' + page.id);
        console.log('  Preview: http://localhost:3000/preview/page/' + page.id);

    } catch (error: any) {
        console.error('Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

createLPForUser();
