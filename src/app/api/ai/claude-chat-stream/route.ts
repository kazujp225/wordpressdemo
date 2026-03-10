import { NextRequest, NextResponse } from 'next/server';
import { getClaudeClient } from '@/lib/claude';
import { createClient } from '@/lib/supabase/server';
import { checkGenerationLimit, recordApiUsage } from '@/lib/usage';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import { estimateClaudeCost } from '@/lib/ai-costs';
import type { DesignContext } from '@/lib/claude-templates';

const MODEL_NAME = 'claude-haiku-4-5-20251001';

function buildSystemPrompt(options: {
  mode: 'generate' | 'edit' | 'diagnose';
  layoutMode: 'desktop' | 'responsive';
  designContext?: DesignContext | null;
  templateType?: string;
}): string {
  const { mode, layoutMode, designContext, templateType } = options;

  // 診断モード: ページを読んでCV導線を分析
  if (mode === 'diagnose') {
    return `あなたは画像ベースLP専用のCV導線オペレーターです。
ページのHTMLを分析し、コンバージョン導線の改善点を診断してください。

【あなたの役割】
- LPを「作る」のではなく「読んで導線を改善する」エージェント
- 既存のデザインやクリエイティブは資産として活かす
- 追加すべきは最小限のUIパーツのみ

【診断項目】
1. ファーストビュー内のCTA導線の有無と視認性
2. 電話・LINE等の即時連絡導線の有無
3. 問い合わせフォーム/導線の位置と数
4. ヘッダーの固定有無（スクロール時の導線消失リスク）
5. スマホでのタップ操作性・視認性
6. ページ下部のCTA不足
7. 信頼要素（実績・お客様の声等）の有無
8. 長尺LPでの中間CTA不足

【出力フォーマット（厳守）】
まず2-3文でページの全体的な印象を述べてください。

次に検出された課題を重要度順に列挙してください:
🔴 [重大な課題]
🟡 [改善推奨]
🟢 [あると良い]

最後に推奨アクションを以下の形式で出力してください（最大4つ）:
[RECOMMEND]アクション名|実行プロンプト|理由（1文）[/RECOMMEND]

例:
[RECOMMEND]追従CTAボタンを追加|右下に追従するCTAボタンを追加してください。背景色はページのメインカラーに合わせ、「お問い合わせ」テキスト、ホバーで浮き上がるエフェクト付き。スマホでは幅100%の下部固定バーにしてください。|スクロール中にCTA導線が消失し、離脱リスクが高い[/RECOMMEND]

【重要ルール】
- HTMLコードは絶対に出力しないでください
- 診断と提案のみ行ってください
- 推奨アクションの「実行プロンプト」は、そのまま実行できる具体的な指示にしてください
- 既存のデザインを壊す提案はしないでください
- 画像ベースLPであることを前提にしてください`;
  }

  // 編集・生成モード: CV導線改善エージェント
  let prompt = `あなたは画像ベースLP専用のCV導線オペレーターです。
ランディングページのHTML/CSSに最適なUIパーツを追加・修正します。

【あなたの役割】
- 既存のデザインやクリエイティブを資産として最大限活かす
- 追加するのは最小限のUIパーツ（CTA、フォーム、ヘッダー等）のみ
- ページ全体を作り直すのではなく、CV導線を改善する

【基本ルール】
- 完全なHTMLファイルとして出力（<!DOCTYPE html>から</html>まで）
- CSS・JSはインライン埋め込み（外部依存なし、Googleフォントは例外的にOK）
- HTMLコードは必ず \`\`\`html ... \`\`\` で囲んで出力
- 全てのテキストは日本語で記述
- smooth scrollを有効にする（scroll-behavior: smooth）

【LP改善のベストプラクティス】
- 追加パーツは既存デザインの色調・フォントに馴染ませる
- CTAボタンは目立つが品のあるデザイン（ホバーエフェクト付き）
- 追従ボタンはposition:fixedで右下配置、スマホはbottom:0の全幅バー
- お問い合わせフォームは必須マーク付き、送信ボタンは目立つ色
- ヘッダーはposition:sticky、半透明背景でスクロール時も機能する
- 中間CTAは背景色を変えてセクション区切りを明確にする
`;

  if (layoutMode === 'desktop') {
    prompt += `\n【レイアウト: デスクトップ専用】
- 想定画面幅: 1024px〜1440px
- モバイル用メディアクエリは追加しない\n`;
  } else {
    prompt += `\n【レイアウト: レスポンシブ対応必須】
- モバイルファースト設計
- @media (max-width: 768px) でモバイル対応
- モバイル: タップしやすいボタン（min-height: 44px）、フォントサイズ16px以上
- 画像は max-width: 100%\n`;
  }

  if (designContext) {
    prompt += `\n【デザインシステム】\n`;
    if (designContext.colorPalette) {
      const cp = designContext.colorPalette;
      prompt += `カラー: Primary: ${cp.primary}, Secondary: ${cp.secondary}, Accent: ${cp.accent}, Background: ${cp.background}\n`;
    }
    if (designContext.vibe) {
      prompt += `雰囲気: ${designContext.vibe}\n`;
    }
  }

  if (templateType) {
    prompt += `\n【テンプレートタイプ: ${templateType}】\n`;
  }

  prompt += `\n【修正時の注意】
- 既存のコード構造・画像・スタイルをできるだけ維持
- 指示されたパーツのみ追加・修正
- 元のデザインの雰囲気を壊さない
- パーツ追加後、なぜその変更をしたかを1-2文で説明する

【対話ルール】
ユーザーの指示が曖昧な場合は、すぐにコードを生成せずに質問してください。
ただし以下の場合はすぐにコードを生成してOK:
- 具体的な指示（色、サイズ、テキスト内容が明確）
- 質問に回答した後の2回目以降
- 「おまかせ」と判断を委ねた場合

質問する時はHTMLコードブロックを出力しないでください。\n`;

  return prompt;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { messages, currentHtml, layoutMode, designContext, templateType, mode } = body as {
    messages: ChatMessage[];
    currentHtml?: string;
    layoutMode?: 'desktop' | 'responsive';
    designContext?: DesignContext | null;
    templateType?: string;
    mode: 'generate' | 'edit' | 'diagnose';
  };

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'messages are required' }, { status: 400 });
  }

  // Credit check
  const limitCheck = await checkGenerationLimit(user.id);
  if (!limitCheck.allowed) {
    return NextResponse.json({
      error: limitCheck.needApiKey ? 'API_KEY_REQUIRED' :
             limitCheck.needPurchase ? 'CREDIT_INSUFFICIENT' :
             'USAGE_LIMIT_EXCEEDED',
      message: limitCheck.reason,
      needApiKey: limitCheck.needApiKey,
      needPurchase: limitCheck.needPurchase,
    }, { status: limitCheck.needApiKey ? 402 : 429 });
  }

  const startTime = createTimer();
  const lastUserMessage = messages[messages.length - 1]?.content || '';

  try {
    const claude = getClaudeClient();

    const systemPrompt = buildSystemPrompt({
      mode,
      layoutMode: layoutMode || 'responsive',
      designContext: designContext || null,
      templateType,
    });

    const apiMessages = messages.map((msg, i) => {
      if (i === 0 && msg.role === 'user' && currentHtml) {
        return {
          role: msg.role as 'user' | 'assistant',
          content: `【現在のHTMLコード】\n\`\`\`html\n${currentHtml}\n\`\`\`\n\n【指示】\n${msg.content}`,
        };
      }
      return { role: msg.role as 'user' | 'assistant', content: msg.content };
    });

    // ストリーミングレスポンス
    const stream = claude.messages.stream({
      model: MODEL_NAME,
      max_tokens: 8192,
      system: systemPrompt,
      messages: apiMessages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullText = '';

        stream.on('text', (text) => {
          fullText += text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', text })}\n\n`));
        });

        stream.on('end', async () => {
          const finalMessage = await stream.finalMessage();
          const inputTokens = finalMessage.usage.input_tokens;
          const outputTokens = finalMessage.usage.output_tokens;
          const estimatedCost = estimateClaudeCost(MODEL_NAME, inputTokens, outputTokens);

          // HTML抽出（diagnoseモードではHTMLなし）
          let html: string | null = null;
          if (mode !== 'diagnose') {
            const htmlMatch = fullText.match(/```html\s*([\s\S]*?)```/);
            if (htmlMatch) {
              html = htmlMatch[1].trim();
            } else if (fullText.trim().startsWith('<!DOCTYPE') || fullText.trim().startsWith('<html')) {
              html = fullText.trim();
            }
          }

          // 説明文抽出
          let message = fullText;
          if (html) {
            message = fullText.replace(/```html\s*[\s\S]*?```/g, '').trim();
          }

          // 推奨アクション抽出（diagnoseモード用）
          let recommendations: { title: string; prompt: string; reason: string }[] = [];
          if (mode === 'diagnose') {
            const recMatches = fullText.matchAll(/\[RECOMMEND\]([\s\S]*?)\[\/RECOMMEND\]/g);
            for (const match of recMatches) {
              const parts = match[1].split('|');
              if (parts.length >= 3) {
                recommendations.push({
                  title: parts[0].trim(),
                  prompt: parts[1].trim(),
                  reason: parts[2].trim(),
                });
              }
            }
            // [RECOMMEND]タグを表示テキストから除去
            message = fullText.replace(/\[RECOMMEND\][\s\S]*?\[\/RECOMMEND\]/g, '').trim();
          }

          // ログ記録
          const logResult = await logGeneration({
            userId: user.id,
            type: 'claude-chat',
            endpoint: '/api/ai/claude-chat-stream',
            model: MODEL_NAME,
            inputPrompt: lastUserMessage,
            outputResult: (html || fullText).slice(0, 5000),
            status: 'succeeded',
            startTime,
          });

          if (logResult && !limitCheck.skipCreditConsumption) {
            await recordApiUsage(user.id, logResult.id, estimatedCost, {
              model: MODEL_NAME,
              inputTokens,
              outputTokens,
            });
          }

          // 最終データを送信
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            html,
            message,
            recommendations: recommendations.length > 0 ? recommendations : undefined,
            usage: { inputTokens, outputTokens },
            estimatedCost,
          })}\n\n`));

          controller.close();
        });

        stream.on('error', async (error: Error) => {
          await logGeneration({
            userId: user.id,
            type: 'claude-chat',
            endpoint: '/api/ai/claude-chat-stream',
            model: MODEL_NAME,
            inputPrompt: lastUserMessage,
            status: 'failed',
            errorMessage: error.message,
            startTime,
          });

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: error.message,
          })}\n\n`));
          controller.close();
        });
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Claude Chat Stream Error:', error);

    await logGeneration({
      userId: user.id,
      type: 'claude-chat',
      endpoint: '/api/ai/claude-chat-stream',
      model: MODEL_NAME,
      inputPrompt: lastUserMessage,
      status: 'failed',
      errorMessage: error.message,
      startTime,
    });

    return NextResponse.json(
      { error: 'Claude Chat failed', message: error.message },
      { status: 500 }
    );
  }
}
