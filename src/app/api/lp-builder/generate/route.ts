import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import {
    SYSTEM_PROMPT,
    FULL_LP_PROMPT,
    fillPromptTemplate,
} from '@/lib/gemini-prompts';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { businessInfoSchema, enhancedContextSchema, designDefinitionSchema, validateRequest } from '@/lib/validations';

// ============================================
// モデル定数（停止・名称変更に対応しやすくする）
// ============================================
const MODELS = {
    // テキスト生成
    TEXT: 'gemini-2.5-flash',
    // 画像生成: Gemini 3 Pro Image (Nano Banana Pro) - 高品質・日本語指示に強い
    IMAGE: 'gemini-3-pro-image-preview',
} as const;

// 9:16の解像度（gemini-3-pro-image-preview）
const IMAGE_DIMENSIONS = {
    width: 768,
    height: 1376,
} as const;

// ビジネス情報から不足している変数を自動生成
function enrichBusinessInfo(info: any, enhancedContext?: any): Record<string, string> {
    const toneDescriptions: Record<string, { urgency: string; guarantee: string }> = {
        professional: {
            urgency: '今なら無料相談実施中',
            guarantee: '安心の返金保証付き',
        },
        friendly: {
            urgency: 'お気軽にお問い合わせください',
            guarantee: '初回無料でお試しいただけます',
        },
        luxury: {
            urgency: '限定のプレミアムオファー',
            guarantee: '品質保証・アフターサポート完備',
        },
        energetic: {
            urgency: '今すぐ始めよう！期間限定キャンペーン中',
            guarantee: '結果が出なければ全額返金',
        },
        minimal: {
            urgency: 'まずはお試しください',
            guarantee: 'シンプルな料金体系・いつでも解約可能',
        },
        playful: {
            urgency: 'ワクワクする体験を今すぐ！',
            guarantee: '楽しくなければ全額返金',
        },
    };

    // 安全なデフォルト値を設定
    const businessName = info.businessName || '当社';
    const industry = info.industry || 'サービス業';
    const service = info.service || 'サービス';
    const target = info.target || 'お客様';
    const strengths = info.strengths || '高品質なサービス';
    const tone = info.tone || 'professional';

    const toneConfig = toneDescriptions[tone] || toneDescriptions.professional;

    // Base enriched info
    const enriched: Record<string, string> = {
        businessName,
        industry,
        businessType: info.businessType || '',
        service,
        target,
        strengths,
        differentiators: info.differentiators || strengths,
        priceRange: info.priceRange || '詳細はお問い合わせください',
        tone,
        conversionGoal: 'お問い合わせ獲得',
        // 自動生成される変数（安全に文字列を構築）
        painPoints: `${target}が抱える課題（${service}に関する悩み）`,
        concerns: `${service}の導入・利用に関する不安や疑問`,
        process: `${industry}における一般的な契約・購入プロセス`,
        planCount: '3',
        mainFeatures: strengths,
        offer: `${service}の特別オファー`,
        urgency: toneConfig.urgency,
        guarantee: toneConfig.guarantee,
        results: `${strengths}による具体的な成果・効果`,
    };

    // Merge enhancedContext if available (overrides generic defaults)
    if (enhancedContext && typeof enhancedContext === 'object') {
        // Product/Service details
        if (enhancedContext.productName) {
            enriched.service = enhancedContext.productName;
        }
        if (enhancedContext.productCategory) {
            enriched.industry = enhancedContext.productCategory;
        }
        if (enhancedContext.businessType) {
            enriched.businessType = enhancedContext.businessType;
        }

        // Target audience refinement
        const targetParts: string[] = [];
        if (enhancedContext.targetAge) targetParts.push(enhancedContext.targetAge);
        if (enhancedContext.targetGender && enhancedContext.targetGender !== '指定なし') {
            targetParts.push(enhancedContext.targetGender);
        }
        if (enhancedContext.targetOccupation) targetParts.push(enhancedContext.targetOccupation);

        if (targetParts.length > 0) {
            enriched.target = targetParts.join('の');
        } else if (enhancedContext.targetAudience) {
            // Fallback: If no specific attributes, use general targetAudience field
            enriched.target = enhancedContext.targetAudience;
        }

        // Product description
        if (enhancedContext.productDescription) {
            enriched.service = `${enriched.service}（${enhancedContext.productDescription}）`;
        }

        // Delivery method
        if (enhancedContext.deliveryMethod) {
            enriched.process = enhancedContext.deliveryMethod;
        }

        // Price info
        if (enhancedContext.priceInfo) {
            enriched.priceRange = enhancedContext.priceInfo;
        }

        // Core messaging (most important for image generation)
        if (enhancedContext.painPoints) {
            enriched.painPoints = enhancedContext.painPoints;
        }
        if (enhancedContext.desiredOutcome) {
            enriched.results = enhancedContext.desiredOutcome;
        }

        // Main benefits
        if (enhancedContext.mainBenefits) {
            enriched.mainFeatures = enhancedContext.mainBenefits;
        }

        // USP / Unique Selling Points (CRITICAL FIX)
        if (enhancedContext.uniqueSellingPoints) {
            enriched.strengths = enhancedContext.uniqueSellingPoints;
            // If mainBenefits wasn't provided, use USP for mainFeatures too
            if (!enhancedContext.mainBenefits) {
                enriched.mainFeatures = enhancedContext.uniqueSellingPoints;
            }
            enriched.differentiators = enhancedContext.uniqueSellingPoints;
        }

        if (enhancedContext.socialProof) {
            enriched.results += ` | 実績: ${enhancedContext.socialProof}`;
        }
        if (enhancedContext.guarantees) {
            enriched.guarantee = enhancedContext.guarantees;
        }

        // Conversion goal
        if (enhancedContext.conversionGoal) {
            const goalLabels: Record<string, string> = {
                inquiry: 'お問い合わせ獲得',
                purchase: '商品購入',
                signup: '会員登録',
                download: '資料ダウンロード',
                consultation: '無料相談予約',
                trial: '無料体験申込',
            };
            enriched.conversionGoal = goalLabels[enhancedContext.conversionGoal] || enhancedContext.conversionGoal;
        }

        // CTA and urgency
        if (enhancedContext.ctaText) {
            enriched.offer = enhancedContext.ctaText;
        }
        if (enhancedContext.urgencyElement) {
            enriched.urgency = enhancedContext.urgencyElement;
        }
    }

    return enriched;
}

// カラーログ用のヘルパー
const log = {
    info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ✓ ${msg}`),
    warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ⚠ ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[ERROR]\x1b[0m ✗ ${msg}`),
    progress: (msg: string) => console.log(`\x1b[35m[PROGRESS]\x1b[0m → ${msg}`),
};

// ============================================
// v3: 画像生成プロンプトテンプレート（LP特化・リード獲得重視）
// ============================================

// 共通プロンプト：LP広告クリエイティブの専門家として
const COMMON_IMAGE_PROMPT = `
【役割】
あなたは高CVR（コンバージョン率）を実現するLP広告専門のビジュアルディレクターです。
リード獲得・売上最大化を目的とした、感情に訴えかける広告ビジュアルを制作してください。

【LP広告クリエイティブの鉄則】
1. 感情トリガー: 見た瞬間に「欲しい」「解決したい」「変わりたい」と感じさせる
2. ビジュアルヒエラルキー: 視線誘導を意識した構図（上→中央→下へ自然に流れる）
3. 信頼性演出: プロフェッショナルで高品質な仕上がり
4. 余白の戦略的活用: テキストオーバーレイ領域を確保しつつ、視覚的インパクトを両立

【スタイル統一（最優先）】
- 参照画像（Style Anchor）の色相・彩度・明度を厳密に踏襲
- グラデーションの方向性と質感（マット/グロス/粒状感）を統一
- 光源方向・コントラスト・シャドウの特性を維持
- 新しいアクセントカラーの追加は禁止（参照画像の色域内で表現）

【セクション間の連続性（超重要）】
- 各セクションは1枚の長いLPとして縦に並ぶことを前提に設計
- 画像の「上端」と「下端」は次セクションとの接続点
- 上端20%: 前セクションの下端と自然に繋がる色調・グラデーション
- 下端20%: 次セクションへ自然に移行できる「余韻」を残す
- 急激な色変化・明度ジャンプ・パターンの断絶を避ける

【禁止事項（絶対厳守）】
- 文字、英数字、記号、ロゴ、UI要素、透かし、看板、ラベル、字幕は一切入れない
- 文字に見える模様も禁止（標識・ポスター・紙・画面・パッケージ類）
- 既存ブランド・商標を想起させる要素は禁止
- チープ・素人っぽい表現は禁止（プロクオリティを維持）

【出力クオリティ】
- 高解像度、シャープ、ノイズレス
- 広告代理店レベルのプロフェッショナル仕上がり
- スマートフォン表示でも映えるコントラストと視認性
`;

// 境界接続用プロンプト（Seam Reference使用時）- v3強化版
const SEAM_REFERENCE_PROMPT = `
【境界接続（最重要 - LP全体の一体感を決める）】
添付の2枚目画像は「直前セクションの下端ストリップ」です。
生成画像はこの直前セクションの「真下」に配置されます。

★ 接続の鉄則:
1. 上端20%は前セクションと完全に連続させる
   - 色調のグラデーションを途切れさせない
   - 明度・彩度の急変を避ける
   - パターンや質感の流れを継承

2. 視覚的な「継ぎ目」を感じさせない
   - 横一線のエッジや境界線が発生しないこと
   - 色の段差・ジャンプが発生しないこと
   - 2枚を縦に並べた時に1枚の画像に見えるレベルを目指す

3. 自然なトランジション表現
   - グラデーションで柔らかく移行
   - 抽象的なシェイプで視線を下へ誘導
   - 「流れ」を感じさせる構図
`;

// セクションタイプ別の画像生成プロンプト（v3: LP特化・リード獲得重視）
const SECTION_IMAGE_PROMPTS: Record<string, (info: any) => string> = {
    hero: (info) => `【HERO - ファーストビュー（LP最重要セクション）】
■ 目的: 3秒以内に「自分ごと化」させ、スクロールを促す
■ 心理効果: 期待感・興味喚起・「もっと知りたい」

構図要件:
- 画面中央〜上部に大きな余白（キャッチコピー配置用）
- 下部1/3に視覚的フォーカスポイント（モチーフ/人物/プロダクト）
- 視線が自然に下方向へ流れる構図
- 下端は次セクションへの「橋渡し」として穏やかに収束

ビジュアル方向性:
- ビジネス: ${info.industry} / ${info.service}
- ターゲット: ${info.target}
- ターゲットの課題: ${info.painPoints}
- 得られる理想の状態: ${info.results}
- トーン: ${info.tone === 'luxury' ? '洗練された高級感・エレガンス' : info.tone === 'friendly' ? '温かみ・親しみやすさ・明るさ' : info.tone === 'energetic' ? 'ダイナミック・情熱・活気' : info.tone === 'minimal' ? 'クリーン・シンプル・余白美' : 'プロフェッショナル・信頼・安心'}
- 人物やプロダクトを含める場合は高品質で魅力的に

リード獲得のポイント:
- 「変化」「成功」「理想の状態」を暗示するビジュアル
- ターゲットが「自分もこうなりたい」と感じる演出
- ${info.painPoints}から${info.results}への変化を視覚的に示唆`,

    features: (info) => `【FEATURES - 特徴・メリット紹介セクション】
■ 目的: 商品/サービスの価値を視覚的に伝え、理解を深める
■ 心理効果: 納得感・論理的な説得・「なるほど」

構図要件:
- 上端は前セクション（通常Hero）と自然に接続
- 中央に適度な余白（特徴リスト・アイコン配置用）
- 背景として機能しつつ、視覚的な面白みを維持
- 下端は次セクションへ穏やかにトランジション

ビジュアル方向性:
- 主な特徴・メリット: ${info.mainFeatures}
- 差別化ポイント: ${info.differentiators}
- ${info.strengths}を抽象的に表現するビジュアル要素
- 信頼性・専門性を感じさせるプロフェッショナルな質感
- アイコンや図形が映えるニュートラルな領域を確保
- 複雑すぎず、シンプルで洗練された表現

リード獲得のポイント:
- 「これなら解決できそう」という期待感を醸成
- 競合との差別化（${info.differentiators}）を暗示する独自性のあるビジュアル`,

    pricing: (info) => `【PRICING - 料金・プランセクション】
■ 目的: 価格への心理的ハードルを下げ、お得感を演出
■ 心理効果: 安心感・納得感・「この価格なら」

構図要件:
- 上端は前セクションと自然に接続
- 価格表・プランカードを配置する広い中央余白
- 落ち着いた背景で数字の視認性を最優先
- 下端は次セクション（通常FAQ/CTA）へ穏やかに移行

ビジュアル方向性:
- 価格帯: ${info.priceRange}
- 保証: ${info.guarantee}
- ${info.tone === 'luxury' ? 'プレミアム感のある上質な背景（ゴールドアクセントOK）' : 'クリーンで信頼感のある背景'}
- コントラストは控えめ（テキストの可読性優先）
- 均一な色面積を多めに確保
- プロフェッショナルで安心感のある印象

リード獲得のポイント:
- 「高すぎない」「納得できる」という心理を後押し
- 投資対効果の良さを暗示するビジュアル
- ${info.guarantee}で安心感を視覚的に強化`,

    testimonials: (info) => `【TESTIMONIALS - お客様の声・実績セクション】
■ 目的: 社会的証明で信頼性を高め、不安を払拭
■ 心理効果: 安心感・共感・「この人も成功している」

構図要件:
- 上端は前セクションと自然に接続
- 顔写真・コメントカードを配置する余白を確保
- 人間味・温かみを感じさせる背景
- 下端は次セクションへ信頼感を継続しつつ移行

ビジュアル方向性:
- ${info.target}層が共感できる温かみのある雰囲気
- 実績・成果: ${info.results}
- 人物のシルエットや抽象的な「つながり」「コミュニティ」表現
- 信頼・実績・成功を暗示する視覚要素
- 柔らかい光、穏やかなグラデーション

リード獲得のポイント:
- 「自分も同じ結果（${info.results}）を得られる」という期待感
- 不安や懸念を払拭する安心感の演出`,

    faq: (info) => `【FAQ - よくある質問セクション】
■ 目的: 購入前の不安・疑問を解消し、最後の背中を押す
■ 心理効果: 安心・解決・「疑問が晴れた」

構図要件:
- 上端は前セクションと自然に接続
- Q&Aリストを配置する広くクリーンな余白
- 落ち着いた、安心感のある背景
- 下端はCTAセクションへの期待感を持たせつつ移行

ビジュアル方向性:
- 想定される不安・疑問: ${info.concerns}
- 穏やか・安心・明るいトーン
- 複雑な要素を排除したシンプルな背景
- サポート・解決・安心を連想させる視覚要素
- 視覚的ノイズを最小限に

リード獲得のポイント:
- 「疑問が解消された」という満足感
- 次のアクション（CTA）への心理的準備`,

    cta: (info) => `【CTA - 行動喚起セクション（LP最終目標）】
■ 目的: 今すぐアクションを起こさせる、最後の一押し
■ 心理効果: 緊急性・決断・「今やらなきゃ」

構図要件:
- 上端は前セクションと自然に接続
- CTAボタンが映える中央〜下部の構図
- 視線を自然にCTA領域へ誘導するビジュアルフロー
- インパクトがありつつ、押しつけがましくない

ビジュアル方向性:
- オファー: ${info.offer}
- 緊急性要素: ${info.urgency}
- ${info.tone === 'energetic' ? 'エネルギッシュ・ダイナミック・情熱的' : info.tone === 'luxury' ? '洗練・高級感・特別感' : info.tone === 'friendly' ? '温かみ・安心・親しみ' : '力強さ・信頼・決断を後押し'}
- 参照色の範囲内でコントラストを高め、注目を集める
- 「変化」「成功」「理想の未来」を暗示
- アクションを促す視覚的エネルギー

リード獲得のポイント:
- 「${info.urgency}」という緊急性の演出
- 「${info.offer}」を視覚的に魅力的に表現
- アクションを起こす「最後の一押し」となるインパクト
- ポジティブな未来へのワクワク感`,

    // 追加セクション: 課題提起（PASONAのP - Problem）
    problem: (info) => `【PROBLEM - 課題・悩み提起セクション】
■ 目的: ターゲットの課題・悩みを言語化し、共感を得る
■ 心理効果: 共感・「わかってくれている」・課題の顕在化

構図要件:
- 上端は前セクション（通常Hero）と自然に接続
- 課題リストを配置する余白を中央に確保
- 課題を象徴するが重すぎない表現
- 下端は解決策セクションへの期待を持たせる

ビジュアル方向性:
- ターゲット: ${info.target}
- 具体的な課題・悩み: ${info.painPoints}
- ${info.target}が抱える課題（${info.painPoints}）を暗示
- 暗すぎず、しかし「現状の問題」を感じさせる
- 灰色やくすんだトーンを控えめに使用
- 「このままではいけない」という危機感を適度に演出

リード獲得のポイント:
- ターゲットが「${info.painPoints}は自分のことだ」と感じる共感の醸成
- 課題解決への意欲を高める`,

    // 追加セクション: 解決策提示（PASONAのS - Solution）
    solution: (info) => `【SOLUTION - 解決策提示セクション】
■ 目的: 課題に対する解決策として商品/サービスを提示
■ 心理効果: 希望・期待・「これで解決できる」

構図要件:
- 上端は課題セクションから希望へと転換するトランジション
- 中央に解決策の説明を配置する余白
- 明るく前向きなトーンへの変化
- 下端は特徴/メリットセクションへ自然に接続

ビジュアル方向性:
- 解決策: ${info.service}
- もたらされる結果: ${info.results}
- ${info.service}が解決策であることを暗示
- 暗から明へのグラデーション的な変化
- 希望・光・解放感を感じさせるビジュアル
- プロダクト/サービスの価値を象徴する要素

リード獲得のポイント:
- 課題（${info.painPoints}）から解決（${info.results}）への「変化」を視覚的に表現
- 商品/サービスへの期待感を最大化`,

    // 追加セクション: ベネフィット（得られる未来）
    benefits: (info) => `【BENEFITS - ベネフィット・得られる未来セクション】
■ 目的: 商品利用後の理想の状態・得られるメリットを描写
■ 心理効果: ワクワク・期待・「こうなりたい」

構図要件:
- 上端は前セクションと自然に接続
- ベネフィットリストを配置する余白を確保
- 成功・達成・理想を感じさせる明るいトーン
- 下端は次セクションへポジティブな流れを維持

ビジュアル方向性:
- ターゲット: ${info.target}
- 得られる結果: ${info.results}
- 主なメリット: ${info.mainFeatures}
- ${info.target}の理想の状態（${info.results}）を暗示
- 成功・達成・満足・幸福を連想させるビジュアル
- 明るく、希望に満ちた表現
- ${info.strengths}がもたらす価値を象徴

リード獲得のポイント:
- ターゲットが「自分も${info.results}を得られる」と想像させる
- 購入後の理想の未来へのワクワク感`,

    // 追加セクション: 導入の流れ・ステップ
    process: (info) => `【PROCESS - 導入の流れ・ステップセクション】
■ 目的: 購入/申込のハードルを下げ、シンプルさを伝える
■ 心理効果: 安心・「簡単そう」・行動への後押し

構図要件:
- 上端は前セクションと自然に接続
- ステップ図・フロー図を配置する広い余白
- クリーンでシンプルな背景
- 下端は次セクションへスムーズに移行

導入プロセス:
- ${info.process}

ビジュアル方向性:
- シンプル・クリーン・整理された印象
- 複雑さを感じさせない明るい背景
- フロー・進行・ステップを暗示する視覚要素
- プロフェッショナルで信頼感のある仕上がり

リード獲得のポイント:
- 「これなら簡単にできそう」という心理
- 行動へのハードルを下げる`,

    // 追加セクション: 保証・安心要素
    guarantee: (info) => `【GUARANTEE - 保証・安心セクション】
■ 目的: 購入への不安を払拭し、最後の後押しをする
■ 心理効果: 安心・信頼・「リスクがない」

構図要件:
- 上端は前セクションと自然に接続
- 保証内容を配置する余白を確保
- 信頼感・安心感を感じさせる背景
- 下端はCTAセクションへの期待を高める

ビジュアル方向性:
- 信頼・安心・保護を連想させるビジュアル
- シールド・チェックマーク的な要素（抽象的に）
- 落ち着いた、安定感のあるトーン
- プロフェッショナルで誠実な印象

リード獲得のポイント:
- 購入への不安を完全に払拭
- 「リスクなく試せる」という安心感`,

    // 追加セクション: 限定オファー・緊急性
    offer: (info) => `【OFFER - 限定オファー・特典セクション】
■ 目的: 緊急性・希少性で今すぐの行動を促す
■ 心理効果: 緊急性・FOMO・「今しかない」

構図要件:
- 上端は前セクションと自然に接続
- オファー内容が目立つ構図
- インパクトがありつつ品を保つ
- 下端はCTAへ直結するエネルギー

ビジュアル方向性:
- ${info.tone === 'luxury' ? '特別感・プレミアム・限定' : info.tone === 'energetic' ? 'エネルギッシュ・緊急・アクション' : '特別・限定・チャンス'}
- 参照色の範囲内でアクセントを効かせる
- 「今だけ」「特別」を暗示するビジュアル
- 行動を促すダイナミックな要素

リード獲得のポイント:
- 「今行動しないと損」という心理
- 限定性・希少性による行動促進`,
};

// リトライ時の追加プロンプト（色ズレ・接続ズレ対策強化）
const RETRY_COLOR_FIX_PROMPT = `
【リトライ時の厳密指示】
前回の生成に問題があった可能性があります。以下を100%遵守してください：

1. 色の厳密固定:
   - 参照画像から外れる色相変化は絶対禁止
   - 背景色のベースを変更しない
   - 新しいアクセントカラーの追加禁止
   - 彩度・明度も参照画像に厳密に合わせる

2. 境界接続の厳密化:
   - 上端20%は前セクションの下端と完全に一致させる
   - 色の段差・ジャンプを絶対に発生させない
   - 2枚を並べた時に「1枚の画像」に見えるレベルを実現
   - グラデーションの方向・流れを継承

前回の生成で失敗した箇所を修正し、完璧な連続性を実現してください。
`;

// ============================================
// v3: 画像生成関数（Style Anchor + Seam Reference + Design Guideline 方式）
// ============================================

// デザインガイドライン型定義
interface DesignGuideline {
    // カラーパレット
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    gradientDirection: 'top-to-bottom' | 'bottom-to-top' | 'left-to-right' | 'radial';
    // 境界処理
    seamStyle: 'gradient-fade' | 'soft-blur' | 'pattern-dissolve' | 'color-blend';
    seamColorTop: string;
    seamColorBottom: string;
    // 全体トーン
    brightness: 'light' | 'medium' | 'dark';
    saturation: 'vivid' | 'muted' | 'neutral';
    contrast: 'high' | 'medium' | 'low';
    // テクスチャ
    texture: 'smooth' | 'grainy' | 'glossy' | 'matte';
    // 視覚的フロー
    visualFlow: 'centered' | 'left-aligned' | 'right-aligned' | 'diagonal';
}

// デザインガイドラインを生成（Hero画像から抽出 or AIで事前生成）
async function generateDesignGuideline(
    businessInfo: any,
    apiKey: string,
    enhancedContext?: any
): Promise<DesignGuideline> {
    const tone = businessInfo.tone || 'professional';
    const imageStyle = enhancedContext?.imageStyle || 'photo';
    const colorPreference = enhancedContext?.colorPreference || '';

    // トーンに基づくデフォルトガイドライン
    const toneDefaults: Record<string, Partial<DesignGuideline>> = {
        professional: {
            primaryColor: '#1e3a5f',
            secondaryColor: '#3b82f6',
            accentColor: '#60a5fa',
            backgroundColor: '#f8fafc',
            brightness: 'light',
            saturation: 'muted',
            contrast: 'medium',
            texture: 'smooth',
        },
        friendly: {
            primaryColor: '#059669',
            secondaryColor: '#34d399',
            accentColor: '#fbbf24',
            backgroundColor: '#f0fdf4',
            brightness: 'light',
            saturation: 'vivid',
            contrast: 'medium',
            texture: 'smooth',
        },
        luxury: {
            primaryColor: '#1f2937',
            secondaryColor: '#b8860b',
            accentColor: '#d4af37',
            backgroundColor: '#0f0f0f',
            brightness: 'dark',
            saturation: 'muted',
            contrast: 'high',
            texture: 'glossy',
        },
        energetic: {
            primaryColor: '#dc2626',
            secondaryColor: '#f97316',
            accentColor: '#fbbf24',
            backgroundColor: '#fffbeb',
            brightness: 'light',
            saturation: 'vivid',
            contrast: 'high',
            texture: 'matte',
        },
        minimal: {
            primaryColor: '#374151',
            secondaryColor: '#9ca3af',
            accentColor: '#6b7280',
            backgroundColor: '#ffffff',
            brightness: 'light',
            saturation: 'neutral',
            contrast: 'low',
            texture: 'smooth',
        },
        playful: {
            primaryColor: '#7c3aed',
            secondaryColor: '#ec4899',
            accentColor: '#f59e0b',
            backgroundColor: '#fefce8',
            brightness: 'light',
            saturation: 'vivid',
            contrast: 'medium',
            texture: 'matte',
        },
    };

    const defaults = toneDefaults[tone] || toneDefaults.professional;

    // カラー指定がある場合は上書き
    let finalPrimaryColor = defaults.primaryColor!;
    if (colorPreference) {
        // 簡易的なカラー名→HEXマッピング
        const colorMap: Record<string, string> = {
            'ブルー': '#3b82f6', 'blue': '#3b82f6',
            'グリーン': '#10b981', 'green': '#10b981',
            'レッド': '#ef4444', 'red': '#ef4444',
            'パープル': '#8b5cf6', 'purple': '#8b5cf6',
            'オレンジ': '#f97316', 'orange': '#f97316',
            'ピンク': '#ec4899', 'pink': '#ec4899',
            'ゴールド': '#d4af37', 'gold': '#d4af37',
        };
        for (const [key, hex] of Object.entries(colorMap)) {
            if (colorPreference.toLowerCase().includes(key.toLowerCase())) {
                finalPrimaryColor = hex;
                break;
            }
        }
        // HEX直接指定の場合
        const hexMatch = colorPreference.match(/#[0-9A-Fa-f]{6}/);
        if (hexMatch) {
            finalPrimaryColor = hexMatch[0];
        }
    }

    return {
        primaryColor: finalPrimaryColor,
        secondaryColor: defaults.secondaryColor!,
        accentColor: defaults.accentColor!,
        backgroundColor: defaults.backgroundColor!,
        gradientDirection: 'top-to-bottom',
        seamStyle: 'gradient-fade',
        seamColorTop: defaults.backgroundColor!,
        seamColorBottom: defaults.backgroundColor!,
        brightness: defaults.brightness!,
        saturation: defaults.saturation!,
        contrast: defaults.contrast!,
        texture: defaults.texture!,
        visualFlow: 'centered',
    };
}

// デザインガイドラインをプロンプトに変換
function guidelineToPrompt(guideline: DesignGuideline): string {
    const brightnessJa = { light: '明るい', medium: '中間', dark: 'ダーク' };
    const saturationJa = { vivid: '鮮やか', muted: '落ち着いた', neutral: 'ニュートラル' };
    const contrastJa = { high: '高コントラスト', medium: '中コントラスト', low: '低コントラスト' };
    const textureJa = { smooth: 'スムース', grainy: '粒状感', glossy: '光沢', matte: 'マット' };
    const seamStyleJa = {
        'gradient-fade': 'グラデーションフェード',
        'soft-blur': 'ソフトブラー',
        'pattern-dissolve': 'パターンディゾルブ',
        'color-blend': 'カラーブレンド',
    };

    return `
【デザインガイドライン（全セクション共通・厳守）】
■ カラーパレット:
  - プライマリ: ${guideline.primaryColor}
  - セカンダリ: ${guideline.secondaryColor}
  - アクセント: ${guideline.accentColor}
  - 背景ベース: ${guideline.backgroundColor}
  ※ 上記4色とその中間トーンのみ使用可。新しい色相の追加は禁止。

■ トーン・質感:
  - 明度: ${brightnessJa[guideline.brightness]}
  - 彩度: ${saturationJa[guideline.saturation]}
  - コントラスト: ${contrastJa[guideline.contrast]}
  - テクスチャ: ${textureJa[guideline.texture]}

■ 境界接続スタイル:
  - 方式: ${seamStyleJa[guideline.seamStyle]}
  - グラデーション方向: 上から下へ
  - 上端は前セクションの下端色（${guideline.seamColorTop}系）に合わせる
  - 下端は次セクションへ繋がる色（${guideline.seamColorBottom}系）で終わる

■ 視覚的統一ルール:
  - 各セクションは単独で見ても美しく、縦に並べると1枚の絵に見える
  - 急激な明度ジャンプ・色相シフトは絶対禁止
  - パターンや装飾の密度は全セクションで統一
`;
}

// Base64文字列のバリデーション
function isValidBase64(str: string): boolean {
    if (!str || typeof str !== 'string') return false;

    // 最低限の長さチェック（画像なら数KB以上のはず）
    if (str.length < 100) return false;

    // Base64の基本的なパターンチェック（パディング考慮）
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) return false;

    // 長さが4の倍数であるべき（パディング後）
    if (str.length % 4 !== 0) {
        // パディングがない場合もあるので、パディング追加して再チェック
        const paddedLength = str.length + (4 - (str.length % 4));
        if (paddedLength % 4 !== 0) return false;
    }

    // 実際にデコードしてみる（try-catchで安全に）
    try {
        const decoded = Buffer.from(str, 'base64');
        // デコード後のサイズが妥当か（最低1KB以上）
        return decoded.length > 1024;
    } catch {
        return false;
    }
}

// RGB配列をHEXカラーに変換
function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Seam Reference用：画像の下端を正確に切り出し、支配色も抽出（Sharp使用）
interface SeamStripResult {
    base64: string;
    dominantColor: string;
    width: number;
    height: number;
}

async function extractSeamStrip(
    base64Image: string,
    stripRatio: number = 0.15,
    defaultColor: string = '#f8fafc'
): Promise<SeamStripResult> {
    // Base64バリデーション
    if (!isValidBase64(base64Image)) {
        log.warn('Invalid base64 input for seam extraction');
        return { base64: base64Image, dominantColor: defaultColor, width: 0, height: 0 };
    }

    try {
        const buffer = Buffer.from(base64Image, 'base64');
        const metadata = await sharp(buffer).metadata();

        if (!metadata.width || !metadata.height) {
            log.warn('Could not get image metadata, returning full image');
            return { base64: base64Image, dominantColor: defaultColor, width: 0, height: 0 };
        }

        // 最小ストリップ高さを確保（50px以上）
        let stripHeight = Math.floor(metadata.height * stripRatio);
        if (stripHeight < 50) {
            stripHeight = Math.min(50, Math.floor(metadata.height * 0.25));
            log.info(`Seam strip too small, adjusted to ${stripHeight}px`);
        }

        // 下端ストリップを切り出し
        const seamImage = sharp(buffer).extract({
            left: 0,
            top: metadata.height - stripHeight,
            width: metadata.width,
            height: stripHeight
        });

        // 支配色を抽出（ストリップの平均色）
        const { channels } = await seamImage.clone().stats();
        let dominantColor = defaultColor;
        if (channels && channels.length >= 3) {
            // RGB平均値から色を算出
            const r = channels[0].mean;
            const g = channels[1].mean;
            const b = channels[2].mean;
            dominantColor = rgbToHex(r, g, b);
            log.info(`Extracted dominant color from seam: ${dominantColor}`);
        }

        // PNG形式で出力
        const seamBuffer = await seamImage.png({ quality: 90 }).toBuffer();

        log.info(`Extracted seam strip: ${metadata.width}x${stripHeight} from ${metadata.width}x${metadata.height}`);

        return {
            base64: seamBuffer.toString('base64'),
            dominantColor,
            width: metadata.width,
            height: stripHeight,
        };
    } catch (error: any) {
        log.warn(`Seam extraction failed: ${error.message}, returning fallback`);
        return { base64: base64Image, dominantColor: defaultColor, width: 0, height: 0 };
    }
}

// 画像生成関数（v3: Style Anchor + Seam Reference + Design Guideline 対応）
async function generateSectionImage(
    sectionType: string,
    businessInfo: any,
    apiKey: string,
    userId: string | null,
    maxRetries: number = 3,
    styleAnchorBase64?: string,    // Style Anchor: 色・質感の基準（全セクション共通）
    seamReferenceBase64?: string,  // Seam Reference: 前画像の下端ストリップ（境界接続用）
    designDefinition?: any,        // デザイン定義（ユーザーアップロード画像から抽出）
    designGuideline?: DesignGuideline, // 事前生成されたデザインガイドライン
    sectionIndex?: number,         // 現在のセクションインデックス（0始まり）
    totalSections?: number         // 全セクション数
): Promise<{ imageId: number | null; base64: string | null; usedModel: string | null }> {
    const promptGenerator = SECTION_IMAGE_PROMPTS[sectionType];
    if (!promptGenerator) {
        log.warn(`No image prompt defined for section type: ${sectionType}`);
        return { imageId: null, base64: null, usedModel: null };
    }

    // セクション固有プロンプト
    const sectionPrompt = promptGenerator(businessInfo);

    // デザインガイドラインのプロンプト（最優先）
    let designInstruction = '';
    if (designGuideline) {
        designInstruction = guidelineToPrompt(designGuideline);

        // セクション位置に応じた追加指示
        if (sectionIndex !== undefined && totalSections !== undefined) {
            const isFirst = sectionIndex === 0;
            const isLast = sectionIndex === totalSections - 1;

            designInstruction += `
【セクション位置: ${sectionIndex + 1}/${totalSections}】
${isFirst ? '- これは最初のセクション。上端は自由だが、下端は次セクションへの接続を意識。' : ''}
${isLast ? '- これは最後のセクション。上端は前セクションと接続、下端は自然な終わりを意識。' : ''}
${!isFirst && !isLast ? '- 中間セクション。上端・下端ともに前後セクションとの接続を最優先。' : ''}
`;
        }
    }

    // 既存のデザイン定義からのスタイル指示（フォールバック）
    if (!designGuideline && designDefinition && designDefinition.colorPalette) {
        const vibe = designDefinition.vibe || 'Modern';
        const primaryColor = designDefinition.colorPalette?.primary || '#000000';
        const bgColor = designDefinition.colorPalette?.background || '#ffffff';
        const description = designDefinition.description || '';
        const mood = designDefinition.typography?.mood || 'Professional';

        designInstruction = `
【参照デザインからの指示】
- Vibe: ${vibe}
- Primary Color: ${primaryColor}
- Background Color: ${bgColor}
- Style: ${description}
- Mood: ${mood}
`;
    }

    // Image style from designDefinition (can include imageStyle from text-based mode)
    if (designDefinition?.imageStyle) {
        const styleInstructions: Record<string, string> = {
            photo: 'フォトリアルな写真風の表現。リアルな質感、自然な照明、写実的なディテール。',
            illustration: '親しみやすいイラスト風。ベクター風のクリーンなライン、フラットデザイン的要素。',
            abstract: '抽象的でアーティスティックな表現。グラデーション、シェイプ、パターンを活用。',
            minimal: 'ミニマルでシンプルな背景。余白を大切に、控えめな装飾。',
            dynamic: 'ダイナミックで躍動感のある表現。斜めのライン、動きのある構図、エネルギッシュ。',
        };

        if (styleInstructions[designDefinition.imageStyle]) {
            designInstruction += `
【画像スタイル指定】
${styleInstructions[designDefinition.imageStyle]}
`;
        }
    }

    // Color preference from designDefinition
    if (designDefinition?.colorPreference) {
        designInstruction += `
【カラー指定】
${designDefinition.colorPreference}を基調とした配色で生成してください。
`;
    }

    // リトライループ
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            log.progress(`Generating image for [${sectionType}] section... (attempt ${attempt}/${maxRetries})`);

            // プロンプト構築
            let fullPrompt = COMMON_IMAGE_PROMPT + sectionPrompt + designInstruction;

            // Seam Referenceがある場合は境界接続プロンプトを追加
            if (seamReferenceBase64) {
                fullPrompt += SEAM_REFERENCE_PROMPT;
            }

            // リトライ時は色ズレ対策を強化
            if (attempt > 1) {
                fullPrompt += RETRY_COLOR_FIX_PROMPT;
            }

            // リクエストのpartsを構築
            const requestParts: any[] = [];

            // 1. Style Anchor（色・質感の基準）
            if (styleAnchorBase64) {
                requestParts.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: styleAnchorBase64
                    }
                });
                requestParts.push({
                    text: '【Style Anchor】上記の画像は色・質感・照明の基準です。この画像のスタイルを厳密に踏襲してください。'
                });
            }

            // 2. Seam Reference（境界接続用：前画像の下端）
            if (seamReferenceBase64) {
                requestParts.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: seamReferenceBase64
                    }
                });
                requestParts.push({
                    text: '【Seam Reference】上記は前セクションの下端部分です。生成画像の上端がこれと自然に繋がるようにしてください。'
                });
            }

            // 3. メインプロンプト
            requestParts.push({ text: fullPrompt });

            // Primary Model: Gemini 3 Pro Image (Nano Banana Pro)
            let usedModel: string = MODELS.IMAGE;
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.IMAGE}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: requestParts
                        }],
                        generationConfig: {
                            // v2: IMAGEのみ（TEXTを含めない）
                            responseModalities: ["IMAGE"],
                            // v2: アスペクト比をAPI設定で明示（プロンプト頼みにしない）
                            imageConfig: {
                                aspectRatio: "9:16"
                            }
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                log.error(`Image generation failed (${response.status}): ${errorText.substring(0, 200)}`);

                // 429/RESOURCE_EXHAUSTED の場合は長めに待機してリトライ
                if (response.status === 429) {
                    const waitTime = Math.pow(2, attempt) * 5000; // 10s, 20s, 40s
                    log.info(`Rate limited. Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else if (attempt < maxRetries) {
                    const waitTime = Math.pow(2, attempt) * 2000; // 4s, 8s, 16s
                    log.info(`Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }

                if (attempt >= maxRetries) {
                    log.error(`[${sectionType}] 画像生成に失敗しました（${maxRetries}回リトライ後）`);
                    return { imageId: null, base64: null, usedModel: null };
                }
                continue;
            }

            const data = await response.json();

            // 画像データを抽出
            const parts = data.candidates?.[0]?.content?.parts || [];
            let base64Image: string | null = null;

            for (const part of parts) {
                if (part.inlineData?.data) {
                    base64Image = part.inlineData.data;
                    break;
                }
            }

            if (!base64Image) {
                log.error(`No image data in response for [${sectionType}]`);
                if (attempt < maxRetries) {
                    const waitTime = Math.pow(2, attempt) * 2000;
                    log.info(`Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                log.error(`[${sectionType}] 画像データが取得できませんでした`);
                return { imageId: null, base64: null, usedModel: null };
            }

            // 成功 - 画像をアップロード
            const buffer = Buffer.from(base64Image, 'base64');
            const filename = `lp-${sectionType}-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;

            const { error: uploadError } = await supabase
                .storage
                .from('images')
                .upload(filename, buffer, {
                    contentType: 'image/png',
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                log.error(`Upload error for [${sectionType}]: ${uploadError.message}`);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
                return { imageId: null, base64: null, usedModel: null };
            }

            const { data: { publicUrl } } = supabase
                .storage
                .from('images')
                .getPublicUrl(filename);

            // MediaImageレコード作成
            const media = await prisma.mediaImage.create({
                data: {
                    userId,
                    filePath: publicUrl,
                    mime: 'image/png',
                    width: IMAGE_DIMENSIONS.width,
                    height: IMAGE_DIMENSIONS.height,
                },
            });

            log.success(`Image generated for [${sectionType}] → ID: ${media.id} (model: ${usedModel})`);
            return { imageId: media.id, base64: base64Image, usedModel };

        } catch (error: any) {
            log.error(`Exception on attempt ${attempt} for [${sectionType}]: ${error.message || error}`);
            if (attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt) * 2000;
                log.info(`Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    log.error(`====== [${sectionType}] 画像生成に完全に失敗しました（${maxRetries}回リトライ後）======`);
    return { imageId: null, base64: null, usedModel: null };
}

export async function POST(req: NextRequest) {
    const startTime = createTimer();
    let prompt = '';
    let isTextBasedMode = false;

    // ユーザー認証を確認してAPIキーを取得
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { businessInfo, mode } = body;

        // Mode detection for logging and behavior adjustment
        isTextBasedMode = mode === 'text-based';
        if (isTextBasedMode) {
            log.info('=== Text-based LP Generation Mode ===');
        }

        if (!businessInfo) {
            return NextResponse.json({
                error: isTextBasedMode
                    ? '商品・サービス情報が入力されていません。Step 1-3で必要事項を入力してください。'
                    : 'ビジネス情報が入力されていません。フォームに必要事項を入力してください。'
            }, { status: 400 });
        }

        // Validate business info
        const validation = validateRequest(businessInfoSchema, businessInfo);
        if (!validation.success) {
            const firstError = validation.details[0];
            return NextResponse.json({
                error: firstError.message || 'Validation failed',
                details: validation.details
            }, { status: 400 });
        }

        // Validate enhanced context (for text-based mode)
        let enhancedContext = body.enhancedContext;
        if (enhancedContext) {
            const contextValidation = validateRequest(enhancedContextSchema, enhancedContext);
            if (!contextValidation.success) {
                log.warn('Enhanced context validation failed, using raw data as-is');
                // バリデーション失敗してもraw dataを維持（オプショナルフィールドのため）
            } else {
                enhancedContext = contextValidation.data;
            }
        }

        // Validate design definition
        let designDefinition = body.designDefinition;
        if (designDefinition) {
            const designValidation = validateRequest(designDefinitionSchema, designDefinition);
            if (!designValidation.success) {
                log.warn('Design definition validation failed, using raw data as-is');
                // バリデーション失敗してもraw dataを維持（オプショナルフィールドのため）
            } else {
                designDefinition = designValidation.data;
            }
        }

        const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user.id);
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({
                error: 'Google API key is not configured. 設定画面でAPIキーを設定してください。'
            }, { status: 500 });
        }

        // Prepare Prompt with enriched business info (merge enhancedContext)
        const enrichedInfo = enrichBusinessInfo(businessInfo, enhancedContext);
        if (enhancedContext) {
            log.success('EnhancedContext merged into enrichedInfo for image generation');
            log.info(`  - painPoints: ${enrichedInfo.painPoints?.substring(0, 50)}...`);
            log.info(`  - results: ${enrichedInfo.results?.substring(0, 50)}...`);
            log.info(`  - target: ${enrichedInfo.target}`);
        }
        prompt = fillPromptTemplate(FULL_LP_PROMPT, enrichedInfo);
        if (isTextBasedMode && enhancedContext && typeof enhancedContext === 'object') {
            log.info('Processing enhanced context from text-based mode...');
            const contextDetails = [];

            if (enhancedContext.businessType) {
                contextDetails.push(`- ビジネスモデル: ${enhancedContext.businessType}`);
            }
            if (enhancedContext.productName) {
                contextDetails.push(`- 商品・サービス名: ${enhancedContext.productName}`);
            }
            if (enhancedContext.productCategory) {
                contextDetails.push(`- カテゴリ: ${enhancedContext.productCategory}`);
            }
            if (enhancedContext.deliveryMethod) {
                contextDetails.push(`- 提供方法: ${enhancedContext.deliveryMethod}`);
            }
            if (enhancedContext.targetAge) {
                contextDetails.push(`- ターゲット年齢層: ${enhancedContext.targetAge}`);
            }
            if (enhancedContext.targetGender) {
                contextDetails.push(`- ターゲット性別: ${enhancedContext.targetGender}`);
            }
            if (enhancedContext.targetOccupation) {
                contextDetails.push(`- ターゲット職業: ${enhancedContext.targetOccupation}`);
            }
            if (enhancedContext.targetIncome) {
                contextDetails.push(`- ターゲット収入層: ${enhancedContext.targetIncome}`);
            }
            if (enhancedContext.painPoints) {
                contextDetails.push(`- ターゲットの課題・悩み: ${enhancedContext.painPoints}`);
            }
            if (enhancedContext.desiredOutcome) {
                contextDetails.push(`- ターゲットの理想状態: ${enhancedContext.desiredOutcome}`);
            }
            if (enhancedContext.socialProof) {
                contextDetails.push(`- 社会的証明・実績: ${enhancedContext.socialProof}`);
            }
            if (enhancedContext.guarantees) {
                contextDetails.push(`- 保証・安心要素: ${enhancedContext.guarantees}`);
            }
            if (enhancedContext.conversionGoal) {
                const goalLabels: Record<string, string> = {
                    inquiry: 'お問い合わせ獲得',
                    purchase: '商品購入',
                    signup: '会員登録',
                    download: '資料ダウンロード',
                    consultation: '無料相談予約',
                    trial: '無料体験申込',
                };
                contextDetails.push(`- コンバージョン目標: ${goalLabels[enhancedContext.conversionGoal] || enhancedContext.conversionGoal}`);
            }
            if (enhancedContext.ctaText) {
                contextDetails.push(`- CTAボタンテキスト: 「${enhancedContext.ctaText}」`);
            }
            if (enhancedContext.urgencyElement) {
                contextDetails.push(`- 緊急性要素: ${enhancedContext.urgencyElement}`);
            }
            if (enhancedContext.colorPreference) {
                contextDetails.push(`- カラー指定: ${enhancedContext.colorPreference}`);
            }
            if (enhancedContext.imageStyle) {
                const styleLabels: Record<string, string> = {
                    photo: 'フォトリアル（写真風）',
                    illustration: 'イラスト風',
                    abstract: '抽象的・アート',
                    minimal: 'ミニマル・シンプル',
                    dynamic: 'ダイナミック・躍動感',
                };
                contextDetails.push(`- 画像スタイル: ${styleLabels[enhancedContext.imageStyle] || enhancedContext.imageStyle}`);
            }

            if (contextDetails.length > 0) {
                prompt += `\n\n【追加コンテキスト（テキストベース作成モード）】
以下の詳細情報を活用して、よりターゲットに刺さるLPを生成してください：

${contextDetails.join('\n')}

特に以下を重視してください：
1. ターゲットの課題・悩みに寄り添ったコピー
2. 理想の状態への変化を具体的に描写
3. コンバージョン目標に最適化されたCTA設計
4. 緊急性要素がある場合は効果的に配置
`;
            }
        }

        // Design Definition Injection (already validated above)
        if (designDefinition && typeof designDefinition === 'object') {
            const vibe = designDefinition.vibe || 'Modern';
            const description = designDefinition.description || '';
            const primaryColor = designDefinition.colorPalette?.primary || '#3b82f6';
            const secondaryColor = designDefinition.colorPalette?.secondary || '#6366f1';
            const bgColor = designDefinition.colorPalette?.background || '#ffffff';
            const typographyStyle = designDefinition.typography?.style || 'Sans-Serif';
            const typographyMood = designDefinition.typography?.mood || 'Modern';
            const layoutStyle = designDefinition.layout?.style || 'Standard';
            const layoutDensity = designDefinition.layout?.density || 'Medium';

            prompt += `\n\n【IMPORTANT: DESIGN INSTRUCTION】
You MUST strictly follow the "Design Definition" below for the visual style, color palette, and component structure.
The user wants to REPLICATE the design style of a specific reference image.

<Design Definition>
- Vibe: ${vibe}
- Description: ${description}
- Color Palette: Primary=${primaryColor}, Secondary=${secondaryColor}, Background=${bgColor}
- Typography: ${typographyStyle} (${typographyMood})
- Layout: ${layoutStyle} (Density: ${layoutDensity})
</Design Definition>

Use these colors and styles in your Tailwind classes.
For example, if the background is dark, use 'bg-slate-900' or similar.
If the layout is 'Hero-focused', ensure the Hero section is dominant.
`;
        }


        // Call Gemini API for text content (using user's API key)
        // v2: gemini-1.5-flash は停止済み → gemini-2.5-flash に移行
        const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
        const textModel = genAI.getGenerativeModel({ model: MODELS.TEXT });

        const result = await textModel.generateContent([
            { text: SYSTEM_PROMPT },
            { text: prompt }
        ]);
        const response = await result.response;
        const text = response.text();

        log.info("Gemini text content generated successfully");

        // Parse Response - より堅牢なJSONパース
        let generatedData;
        try {
            let jsonString = text.trim();

            // マークダウンコードブロックを削除（複数パターン対応）
            // パターン1: ```json ... ```
            const jsonBlockMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonBlockMatch) {
                jsonString = jsonBlockMatch[1];
            } else {
                // パターン2: ``` ... ```
                const codeBlockMatch = jsonString.match(/```\s*([\s\S]*?)\s*```/);
                if (codeBlockMatch) {
                    jsonString = codeBlockMatch[1];
                } else {
                    // パターン3: 先頭/末尾の```を除去
                    jsonString = jsonString.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
                }
            }

            // JSONオブジェクトを抽出（先頭の{から最後の}まで）
            const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonString = jsonMatch[0];
            }

            generatedData = JSON.parse(jsonString);

            // 必須フィールドの検証
            if (!generatedData.sections || !Array.isArray(generatedData.sections)) {
                throw new Error('Invalid response structure: sections array is missing');
            }

            if (generatedData.sections.length === 0) {
                throw new Error('AI generated an empty LP structure. Please try again with more detailed information.');
            }

            // セクションの基本構造を検証・正規化
            for (const section of generatedData.sections) {
                if (!section.type || typeof section.type !== 'string') {
                    throw new Error(`Invalid section structure: missing or invalid 'type' field`);
                }
                // dataキーをpropertiesに正規化（AIレスポンスが data or properties を返す可能性）
                if (section.data && !section.properties) {
                    section.properties = section.data;
                }
            }
        } catch (e: any) {
            log.error("JSON Parse Error - AI response was not valid JSON");
            log.error(`Raw Text: ${text.substring(0, 500)}`);
            log.error(`Parse Error: ${e.message}`);
            return NextResponse.json({
                error: 'AIからの応答を処理できませんでした。もう一度お試しください。問題が続く場合は、入力内容を簡潔にしてみてください。'
            }, { status: 500 });
        }

        // ============================================
        // v3: Style Anchor + Seam Reference + Design Guideline 方式で画像生成
        // ============================================
        const sections = generatedData.sections || [];
        const sectionCount = sections.length;
        log.info(`========== Starting SEQUENTIAL image generation (v3: Anchor + Seam + Guideline) for ${sectionCount} sections ==========`);

        // Step 1: デザインガイドラインを事前生成（全セクション統一）
        log.progress('Generating design guideline for consistent styling...');
        const designGuideline = await generateDesignGuideline(
            enrichedInfo,  // Use enriched info with enhancedContext merged
            GOOGLE_API_KEY,
            enhancedContext
        );
        log.success(`Design guideline generated: Primary=${designGuideline.primaryColor}, BG=${designGuideline.backgroundColor}, Tone=${designGuideline.brightness}`);

        // Style Anchor: ユーザーがデザイン画像をアップロードしていればそれを使用
        // なければ最初のheroセクション生成後にheroをAnchorとして固定
        let styleAnchorBase64: string | null = null;

        // ユーザーアップロード画像からの参照（designDefinitionに含まれていれば）
        if (body.designImageBase64) {
            styleAnchorBase64 = body.designImageBase64;
            log.info('Using user-uploaded design image as Style Anchor');
        }

        // 順次生成：Style Anchor（固定）+ Seam Reference（前画像の下端）+ Design Guideline
        const sectionsWithImages: any[] = [];
        let previousImageBase64: string | null = null;
        let previousSeamColor: string = designGuideline.backgroundColor; // 境界色のトラッキング

        for (let index = 0; index < sections.length; index++) {
            const section = sections[index];
            log.progress(`Processing section ${index + 1}/${sections.length}: ${section.type}`);

            // Seam Reference: 前画像の下端ストリップを作成（sharpで正確に切り出し + 支配色抽出）
            let seamReferenceBase64: string | undefined;
            let extractedSeamColor: string = previousSeamColor;

            if (previousImageBase64) {
                const seamResult = await extractSeamStrip(
                    previousImageBase64,
                    0.15, // 15%の下端を切り出し
                    designGuideline.backgroundColor
                );
                seamReferenceBase64 = seamResult.base64;
                extractedSeamColor = seamResult.dominantColor;
                log.info(`Seam reference extracted: ${seamResult.width}x${seamResult.height}, color=${extractedSeamColor}`);
            }

            // ガイドラインの境界色を更新（実際に抽出した色を使用）
            const currentGuideline = {
                ...designGuideline,
                seamColorTop: extractedSeamColor,
                seamColorBottom: designGuideline.backgroundColor,
            };

            // Merge designDefinition with enhancedContext for text-based mode
            const mergedDesignDefinition = {
                ...body.designDefinition,
                ...(body.enhancedContext?.imageStyle && { imageStyle: body.enhancedContext.imageStyle }),
                ...(body.enhancedContext?.colorPreference && { colorPreference: body.enhancedContext.colorPreference }),
            };

            const result = await generateSectionImage(
                section.type,
                enrichedInfo,  // Use enriched info with enhancedContext merged
                GOOGLE_API_KEY,
                user.id,
                3, // maxRetries
                styleAnchorBase64 || undefined,  // Style Anchor（色・質感の基準）
                seamReferenceBase64,             // Seam Reference（境界接続用・sharpで切り出し）
                mergedDesignDefinition,          // デザイン定義（enhancedContextとマージ）
                currentGuideline,                // デザインガイドライン（統一ルール）
                index,                           // セクションインデックス
                sectionCount                     // 全セクション数
            );

            sectionsWithImages.push({
                ...section,
                imageId: result.imageId,
                properties: section.data || section.properties || {},
            });

            // 成功した場合の処理
            if (result.base64) {
                previousImageBase64 = result.base64;

                // 最初のセクション（hero）が成功したら、それをStyle Anchorとして固定
                // （ユーザーアップロード画像がない場合のみ）
                if (index === 0 && !styleAnchorBase64) {
                    styleAnchorBase64 = result.base64;
                    log.info('Hero section set as Style Anchor for remaining sections');
                }

                // 境界色をトラッキング（次セクションの抽出時に実際の色を使用）
                // extractedSeamColorは次のループで更新されるので、ここでは維持のみ
                previousSeamColor = extractedSeamColor;

                log.info(`Seam color tracked for next section: ${previousSeamColor}`);
            }

            // レート制限回避のため少し待機（previewモデルは制限が厳しめ）
            if (index < sections.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        // 結果サマリー
        const successCount = sectionsWithImages.filter(s => s.imageId).length;
        const failCount = sectionsWithImages.filter(s => !s.imageId).length;

        log.info(`========== Image generation complete ==========`);
        log.success(`Successfully generated: ${successCount}/${sectionsWithImages.length} sections (v3: Anchor + Seam + Guideline)`);
        if (failCount > 0) {
            log.warn(`Failed to generate: ${failCount} sections`);
        }

        // 全セクション失敗の場合はエラーを返す
        if (successCount === 0) {
            log.error('All image generation attempts failed');
            await logGeneration({
                userId: user.id,
                type: isTextBasedMode ? 'lp-generate-text-based' : 'lp-generate',
                endpoint: '/api/lp-builder/generate',
                model: MODELS.IMAGE,
                inputPrompt: 'Image generation failed for all sections',
                status: 'failed',
                errorMessage: 'All image generation attempts failed',
                startTime
            });

            return NextResponse.json({
                error: '画像生成に完全に失敗しました。API利用上限に達している可能性があります。しばらく待ってから再試行してください。',
                details: process.env.NODE_ENV === 'development' ? 'All image generation attempts failed' : undefined
            }, { status: 500 });
        }

        // ログ記録（テキスト生成）
        await logGeneration({
            userId: user.id,
            type: isTextBasedMode ? 'lp-generate-text-based' : 'lp-generate',
            endpoint: '/api/lp-builder/generate',
            model: MODELS.TEXT,
            inputPrompt: prompt,
            outputResult: JSON.stringify(generatedData),
            status: 'succeeded',
            startTime
        });

        // ログ記録（画像生成サマリー）
        if (successCount > 0) {
            await logGeneration({
                userId: user.id,
                type: isTextBasedMode ? 'lp-generate-text-based' : 'lp-generate',
                endpoint: '/api/lp-builder/generate',
                model: MODELS.IMAGE,
                inputPrompt: `LP image generation for ${sectionsWithImages.length} sections (v3: Anchor+Seam+Guideline)`,
                imageCount: successCount,
                status: 'succeeded',
                startTime
            });
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Cost Calculation (JPY Estimation - token-based, approximate)
        // Gemini 2.5 Flash (Text): ~0.015 JPY / 1k input tokens, ~0.06 JPY / 1k output tokens
        // Gemini 3 Pro Image: ~4.0 JPY per image (conservative estimate)
        // Note: chars ≈ tokens * 0.7 for Japanese, using chars as rough proxy

        const textInputCost = (prompt.length / 1000) * 0.015;
        const textOutputCost = (text.length / 1000) * 0.06;

        // Image usage: Gemini 3 Pro Image Preview
        const imageCost = successCount * 4.0;

        const totalCost = Math.ceil((textInputCost + textOutputCost + imageCost) * 100) / 100; // Round to 2 decimals

        return NextResponse.json({
            success: true,
            data: {
                ...generatedData,
                sections: sectionsWithImages
            },
            meta: {
                duration: duration,
                estimatedCost: totalCost,
                mode: isTextBasedMode ? 'text-based' : 'standard'
            }
        });

    } catch (error: any) {
        log.error(`Generation API Error (${isTextBasedMode ? 'text-based' : 'standard'} mode): ${error.message || error}`);

        // ログ記録（エラー）
        await logGeneration({
            userId: user.id,
            type: isTextBasedMode ? 'lp-generate-text-based' : 'lp-generate',
            endpoint: '/api/lp-builder/generate',
            model: MODELS.TEXT,
            inputPrompt: prompt || 'Error before prompt',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        // ユーザーフレンドリーなエラーメッセージを生成
        let userMessage = 'LP生成中にエラーが発生しました。';

        if (error.message?.includes('API key')) {
            userMessage = 'APIキーに問題があります。設定画面でAPIキーを確認してください。';
        } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
            userMessage = 'API利用上限に達しました。しばらく待ってから再試行してください。';
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            userMessage = 'ネットワークエラーが発生しました。接続を確認して再試行してください。';
        } else if (error.message?.includes('timeout')) {
            userMessage = '処理がタイムアウトしました。もう一度お試しください。';
        } else {
            userMessage = 'LP生成中に予期せぬエラーが発生しました。もう一度お試しください。問題が続く場合はサポートにご連絡ください。';
        }

        return NextResponse.json({
            error: userMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
    }
}
