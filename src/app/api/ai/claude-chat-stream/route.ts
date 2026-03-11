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
  let prompt = `あなたはプロのLP制作エージェントです。
コンバージョンに最適化された、プロ品質のランディングページを生成・編集します。

【あなたの役割】
- 既存のデザインやクリエイティブを資産として最大限活かす
- 新規作成時は完全なプロ品質のLPを構築する
- CV導線（ヘッダー、CTA、フォーム等）を最適化する

【基本ルール】
- 完全なHTMLファイルとして出力（<!DOCTYPE html>から</html>まで）
- CSS・JSはインライン埋め込み（外部依存なし、Googleフォントは例外的にOK）
- HTMLコードは必ず \`\`\`html ... \`\`\` で囲んで出力
- 全てのテキストは日本語で記述
- smooth scrollを有効にする（scroll-behavior: smooth）

【★ レイアウトの絶対ルール ★】
- bodyにはmargin:0, padding:0を必ず設定
- すべてのセクションは幅100%（width:100vw または width:100%）にする
- ヒーロー/ファーストビューの画像は必ず全幅表示（width:100%, object-fit:cover）
- max-widthで制限するのはテキストコンテンツだけ（画像・背景は全幅）
- 左右の余白は画像の外側に作らない。画像は端から端まで表示する
- セクション間の余白はpadding（内側）で制御。margin（外側）で隙間を空けない

【LP品質基準】
- ファーストビュー: 画面全幅のヒーロー画像/背景 + 太字キャッチコピー + CTA
- ヘッダー: position:sticky、会社名/サービス名 + CTAボタン、半透明背景
- CTAボタン: 大きく目立つ（min-height:52px）、ホバーエフェクト付き、影つき
- セクション: 全幅背景色 + 内側max-width:1200pxでコンテンツ整列
- お問い合わせフォーム: 必須マーク付き、大きな送信ボタン
- 追従CTA: position:fixedで右下配置、スマホはbottom:0の全幅バー
- フッター: ダークカラー背景、コピーライト、リンク
- 全体的に余白を十分に取り、プロフェッショナルな印象を与える

【色・デザインの原則】
- メインカラーを決め、CTA・ヘッダー・リンクに統一的に適用
- 画像とUIパーツの色味を合わせる
- 白背景のセクションと色付き背景のセクションを交互に配置してリズムを作る
- フォントサイズのメリハリ: 見出しは大きく太く、本文は読みやすいサイズ
`;

  if (layoutMode === 'desktop') {
    prompt += `\n【レイアウト: デスクトップ専用】
- 想定画面幅: 1024px〜1440px
- 画像・背景は100vwで全幅表示
- テキストコンテンツはmax-width:1200pxで中央配置
- モバイル用メディアクエリは追加しない\n`;
  } else {
    prompt += `\n【レイアウト: レスポンシブ対応必須】
- PC: 画像・背景は100%全幅、テキストはmax-width:1200pxで中央配置
- @media (max-width: 768px) でモバイル対応
- 画像は width:100%, display:block で全幅表示（max-widthで縮めない）
- img要素にはdisplay:blockを追加して余計な隙間を防ぐ

【★ モバイル表示の絶対ルール ★】
- モバイルでは余白(padding/margin)を最小限にし、画面幅いっぱいに表示
- 画像: width:100vw, margin-left:calc(-50vw + 50%) で親の制約を無視して全幅表示
- ヒーロー/ファーストビュー: 画面全体を使う（height:100svhまたはmin-height:80vh）
- ボタン: width:100%, min-height:52px, font-size:16px以上
- フォーム入力欄: width:100%, font-size:16px（iOS拡大防止）, min-height:48px
- ヘッダー: モバイルでもstickyを維持、CTAボタンはコンパクトに
- セクション: padding:24px 16px（左右16pxで画面ギリギリまで使う）
- テキスト: 見出しはfont-size:24px以上で太字、本文は14-16px
- 追従CTA: 画面下部にfixed、width:100%、高さ60px以上の目立つバー
- カード/グリッド: PCで横並びのものはモバイルで縦1列（flex-direction:column）
- テーブル: モバイルでは横スクロールまたはカード形式に変換\n`;
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
- 画像のwidth/max-widthを縮小しない。常にコンテナ全幅で表示する

【対話ルール】
ユーザーの指示が曖昧な場合でも、プロとして最善の判断でコードを生成してください。
質問が必要な場合のみ質問しますが、基本的にはすぐに実行してください。
特に「ヘッダー」「フォーム」「CTA」など一般的な要素は質問せずにプロ品質で生成してください。

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
