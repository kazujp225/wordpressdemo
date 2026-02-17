import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { checkTextGenerationLimit, recordApiUsage } from '@/lib/usage';

export async function POST(request: NextRequest) {
    const startTime = createTimer();
    let prompt = '';

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limitCheck = await checkTextGenerationLimit(user.id, 'gemini-2.0-flash', 1000, 4000);
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
        const { serviceName, style, color, ctaText, ctaLink, navItems } = await request.json();

        if (!serviceName) {
            return NextResponse.json({ error: 'サービス名は必須です' }, { status: 400 });
        }

        const apiKey = await getGoogleApiKeyForUser(user.id);
        if (!apiKey) {
            return NextResponse.json({ error: '設定画面でAPIキーを設定してください。' }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const navItemsHtml = navItems && navItems.length > 0
            ? navItems.map((item: { label: string; href: string }) => `<a href="${item.href}">${item.label}</a>`).join('')
            : '';

        const styleMap: Record<string, string> = {
            professional: 'プロフェッショナルで信頼感のある企業サイト風。落ち着いた色使い、シンプルで洗練されたデザイン。',
            casual: 'カジュアルで親しみやすい雰囲気。角丸、やわらかい色使い、フレンドリーな印象。',
            modern: 'モダンでスタイリッシュ。大胆なタイポグラフィ、コントラストの効いた配色。',
            minimal: 'ミニマルで余白を活かしたデザイン。シンプルで無駄のない構成。',
        };

        const styleDesc = styleMap[style] || styleMap.professional;

        prompt = `あなたは優秀なWebデザイナーです。LPのヘッダー（ナビゲーションバー）のHTML+CSSコードを生成してください。

【要件】
- サービス名: ${serviceName}
- デザインスタイル: ${styleDesc}
- メインカラー: ${color || '#2563eb'}
- CTAボタン: ${ctaText || 'お問い合わせ'}（リンク先: ${ctaLink || '#contact'}）
${navItemsHtml ? `- ナビ項目: ${navItems.map((n: any) => n.label).join('、')}` : '- ナビ項目: なし（ロゴとCTAのみ）'}

【ルール】
1. <header>タグ1つで完結すること（<style>タグをheader内の先頭に含める）
2. CSSはすべて<style>タグ内にスコープ付きで記述（.ai-header- プレフィックスを使う）
3. レスポンシブ対応必須（モバイル768px以下で適切にレイアウト調整）
4. モバイルではナビ項目を非表示にし、ロゴとCTAだけ表示
5. ヘッダーの高さは60px〜80px程度
6. CTAボタンは目立つデザインにする
7. フォントは system-ui を使用
8. 外部リソース（画像、フォント、CDN）は使用しない
9. 日本語テキストで出力
10. HTMLコードのみ出力（説明文不要）
11. <header>の直下に<style>タグを配置してからコンテンツを記述

出力例の構造:
<header class="ai-header">
  <style>
    .ai-header { ... }
    @media (max-width: 768px) { ... }
  </style>
  <div class="ai-header-inner">
    <div class="ai-header-logo">サービス名</div>
    <nav class="ai-header-nav">...</nav>
    <a href="#contact" class="ai-header-cta">お問い合わせ</a>
  </div>
</header>`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // HTMLを抽出（```html...```のコードブロックまたは<header>タグ）
        let headerHtml = '';
        const codeBlockMatch = text.match(/```html?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            headerHtml = codeBlockMatch[1].trim();
        } else {
            const headerMatch = text.match(/<header[\s\S]*<\/header>/);
            if (headerMatch) {
                headerHtml = headerMatch[0].trim();
            }
        }

        if (!headerHtml) {
            throw new Error('ヘッダーHTMLの生成に失敗しました');
        }

        const logResult = await logGeneration({
            userId: user.id,
            type: 'generate-nav',
            endpoint: '/api/ai/generate-header',
            model: 'gemini-2.0-flash',
            inputPrompt: prompt,
            outputResult: headerHtml,
            status: 'succeeded',
            startTime
        });

        if (logResult && !skipCreditConsumption) {
            await recordApiUsage(user.id, logResult.id, logResult.estimatedCost, { model: 'gemini-2.0-flash' });
        }

        return NextResponse.json({ headerHtml });
    } catch (error: any) {
        console.error('AI Header Generation Error:', error);

        await logGeneration({
            userId: user.id,
            type: 'generate-nav',
            endpoint: '/api/ai/generate-header',
            model: 'gemini-2.0-flash',
            inputPrompt: prompt || 'Error before prompt',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        return NextResponse.json({
            error: 'ヘッダー生成に失敗しました',
            details: error.message,
        }, { status: 500 });
    }
}
