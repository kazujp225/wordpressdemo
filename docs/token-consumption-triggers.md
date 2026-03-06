# トークン消費トリガー一覧

このドキュメントでは、どのアクションがトークン消費のトリガーになるかを説明します。

## 概要

- **1円 = 10トークン**
- **1 USD = 1,500トークン**（1 USD = 150円で換算）
- 自分のAPIキーを設定している場合はトークン消費をスキップ

---

## 画像生成系（高コスト）

| エンドポイント | トリガーとなるアクション | 使用モデル | 推定コスト |
|--------------|----------------------|-----------|----------|
| `/api/ai/generate-image` | 新規画像生成 | gemini-3.1-flash-image-preview | $0.151(4K) / 約227トークン |
| `/api/ai/edit-image` | 画像編集・リブランディング | gemini-3.1-flash-image-preview | $0.067(1K) / 約101トークン |
| `/api/ai/inpaint` | 画像の部分修正（インペイント） | gemini-3.1-flash-image-preview | $0.067(1K) / 約101トークン |
| `/api/ai/text-fix` | 画像内テキストの文字化け修正 | gemini-3.1-flash-image-preview | $0.151(4K) / 約227トークン |
| `/api/ai/background-unify` | 背景色の統一 | gemini-3.1-flash-image-preview | $0.067〜0.151 / 解像度依存 |
| `/api/ai/design-unify` | デザインスタイルの統一 | gemini-3.1-flash-image-preview | $0.067(1K) / 約101トークン |
| `/api/ai/image-transform` | サムネイル変換・資料化 | gemini-3.1-flash-image-preview | $0.067(1K) / 約101トークン |
| `/api/ai/upscale` | 画像の高解像度化（AI超解像） | real-esrgan | $0.02 / 30トークン |

---

## テキスト生成系（低〜中コスト）

| エンドポイント | トリガーとなるアクション | 使用モデル | 推定コスト |
|--------------|----------------------|-----------|----------|
| `/api/ai/generate-copy` | LPセクションのコピー生成 | gemini-2.0-flash | $0.001 / 1.5トークン |
| `/api/ai/generate-nav` | ナビゲーション構成の生成 | gemini-2.0-flash | $0.001 / 1.5トークン |
| `/api/ai/review` | コピーのレビュー・改善提案 | gemini-2.0-flash | $0.001 / 1.5トークン |
| `/api/ai/suggest-benefits` | メリット・USP・保証の提案 | gemini-2.0-flash | $0.001 / 1.5トークン |
| `/api/ai/prompt-copilot` | プロンプト作成支援チャット | gemini-2.0-flash | $0.0005 / 0.75トークン |
| `/api/ai/ocr` | 画像からテキスト抽出（OCR） | gemini-2.0-flash | $0.001 / 1.5トークン |
| `/api/ai/analyze-design` | デザイン解析（色・スタイル抽出） | gemini-2.0-flash | $0.001 / 1.5トークン |
| `/api/ai/image-to-prompt` | 画像からプロンプト生成 | gemini-2.0-flash | $0.001 / 1.5トークン |
| `/api/ai/extract-background-color` | 背景色の自動検出 | gemini-2.0-flash | $0.0005 / 0.75トークン |

---

## コード生成系（中コスト）

| エンドポイント | トリガーとなるアクション | 使用モデル | 推定コスト |
|--------------|----------------------|-----------|----------|
| `/api/ai/claude-generate` | HTMLコード生成 | gemini-2.0-flash | $0.002 / 3トークン |
| `/api/ai/claude-edit-code` | HTMLコード編集 | gemini-2.0-flash | $0.002 / 3トークン |

---

## SEO/LLMO分析系（高コスト）

| エンドポイント | トリガーとなるアクション | 使用モデル | 推定コスト |
|--------------|----------------------|-----------|----------|
| `/api/ai/seo-llmo-optimize` | SEO/LLMO最適化分析 | claude-sonnet-4 | $0.01 / 15トークン |

---

## 動画生成系（非常に高コスト）

| エンドポイント | トリガーとなるアクション | 使用モデル | 推定コスト |
|--------------|----------------------|-----------|----------|
| `/api/ai/generate-video` | AI動画生成 | veo-2.0 | $0.35/秒 / 525トークン/秒 |

※ 動画生成はEnterpriseプラン限定機能

---

## トークン消費されないケース

以下の場合はトークンが消費されません：

1. **自分のAPIキーを設定している場合**
   - 設定 > APIキー設定で自分のGoogle APIキーを登録している場合
   - `skipCreditConsumption: true` となり消費をスキップ

2. **API呼び出しが失敗した場合**
   - エラーが発生した場合はトークンは消費されない
   - ログには失敗として記録される

3. **AIを使用しない操作**
   - `/api/ai/structure` - ファイル名からの役割推定（ヒューリスティック）
   - `/api/ai/inpaint-history` - 履歴の取得（DB操作のみ）
   - `/api/ai/upscale` でSharpのみ使用時 - AIモデル不使用

---

## UI上でのトリガーポイント

### エディター画面
- 「AIコピー生成」ボタン → `generate-copy`
- 「画像生成」ボタン → `generate-image`
- 「画像編集」ボタン → `edit-image`
- 「インペイント」機能 → `inpaint`
- 「文字化け修正」機能 → `text-fix`
- 「背景色統一」機能 → `background-unify`
- 「デザイン統一」機能 → `design-unify`
- 「高解像度化」ボタン → `upscale`
- 「OCR」機能 → `ocr`

### 設定画面
- 「SEO/LLMO最適化」機能 → `seo-llmo-optimize`

### コード生成モーダル
- 「生成」ボタン → `claude-generate`
- 「編集」ボタン → `claude-edit-code`

### その他
- 「ナビ生成」機能 → `generate-nav`
- 「レビュー」機能 → `review`
- 「メリット提案」機能 → `suggest-benefits`
- 「プロンプトコパイロット」チャット → `prompt-copilot`
- 「デザイン解析」機能 → `analyze-design`
- 「画像→プロンプト」機能 → `image-to-prompt`
- 「背景色検出」機能 → `extract-background-color`

---

## 技術的な実装詳細

### トークン消費の流れ

```
1. ユーザーがアクションを実行
    ↓
2. checkTextGenerationLimit() または checkImageGenerationLimit() でクレジット残高をチェック
    ↓
3. 残高不足の場合 → 402エラーを返す
    ↓
4. 残高十分の場合 → AI APIを呼び出し
    ↓
5. 成功時 → logGeneration() でログ記録
    ↓
6. recordApiUsage() でクレジット消費（skipCreditConsumption=falseの場合のみ）
```

### 関連ファイル
- `src/lib/usage.ts` - クレジットチェック・消費ロジック
- `src/lib/generation-logger.ts` - 生成ログ記録
- `src/lib/ai-costs.ts` - AIモデルごとのコスト定義
- `src/lib/plans.ts` - トークン変換レート定義
