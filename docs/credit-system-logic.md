# クレジットシステム ロジック仕様書（最新版）

## 1. 基本計算式

```
月間クレジット(USD) = 月額料金(JPY) × 25% ÷ 150(JPY/USD)
月間クレジット(内部単位) = 月額料金(JPY) × 25% ÷ 100(JPY) × 1,000
```

### 換算レート
- **1 USD = 150 JPY**（固定レート）
- **内部管理単位: USD**（CreditBalance.balanceUsd）

---

## 2. プラン別クレジット一覧

| プラン | 月額(税別) | 原価(25%) | クレジット(USD) | クレジット(内部表示) |
|--------|-----------|----------|-----------------|-------------------|
| Free | ¥0 | ¥0 | $0 | 0 |
| Starter | ¥10,000 | ¥2,500 | $16.67 | 25,000 |
| Pro | ¥30,000 | ¥7,500 | $50.00 | 75,000 |
| Business | ¥50,000 | ¥12,500 | $83.33 | 125,000 |
| Enterprise | ¥100,000 | ¥25,000 | $166.67 | 250,000 |
| Unlimited | ¥500,000 | ¥125,000 | $833.33 | 1,250,000 |

### 5万円(Business)課金の場合
```
¥50,000 × 25% = ¥12,500（原価相当額）
¥12,500 ÷ 150 = $83.33（USDクレジット）
内部表示: 125,000クレジット
```

---

## 3. クレジット付与フロー

### 3.1 初回付与（サブスクリプション開始時）
```
Stripe checkout.session.completed
  → handleCheckoutCompleted()
  → grantPlanCredit(userId, plan.includedCreditUsd, plan.name)
```

### 3.2 月次更新（毎月自動付与）
```
Stripe invoice.paid (billing_reason === 'subscription_cycle')
  → handleInvoicePaid()
  → grantPlanCredit(userId, plan.includedCreditUsd, plan.name)
```

**注意**: `billing_reason === 'subscription_create'` の場合はスキップ（checkout.session.completedで処理済み）

### 3.3 付与処理の詳細（grantPlanCredit）
```typescript
// CreditBalanceテーブルに加算（upsert）
balanceUsd += creditUsd

// CreditTransactionに記録
type: 'plan_grant'
description: '${planName}プラン月間クレジット付与'
```
- クレジットは**繰り越し**される（前月の残高にプラスされる）
- 付与時に `lastRefreshedAt` が更新される

---

## 4. クレジット消費

### 4.1 API利用コスト

#### 画像生成・編集（Gemini） — 解像度別料金
| モデル | 解像度 | トークン数 | コスト |
|--------|--------|-----------|--------|
| gemini-3-pro-image-preview | 1K/2K (〜2048px) | 1,120 | **$0.134/画像** |
| gemini-3-pro-image-preview | 4K (〜4096px) | 2,000 | **$0.24/画像** |

**解像度別適用ルート:**
| APIルート | 出力解像度 | 適用コスト |
|-----------|-----------|-----------|
| `/api/ai/generate-image` | 4K（ハードコード） | $0.24 |
| `/api/ai/text-fix` | 4K（ハードコード） | $0.24 |
| `/api/ai/background-unify` | ユーザー指定(1K/2K/4K) | 解像度に応じて変動 |
| `/api/ai/inpaint` | デフォルト(1K) | $0.134 |
| `/api/ai/upscale` | デフォルト(1K) | $0.134 |
| `/api/ai/generate-banner` | デフォルト(1K) | $0.134 |
| `/api/ai/edit-image` | デフォルト(1K) | $0.134 |
| `/api/ai/outpaint` | デフォルト(1K) | $0.134 |

#### テキスト生成（Gemini）
| モデル | 入力(1Mトークン) | 出力(1Mトークン) |
|--------|-------------------|-------------------|
| gemini-2.0-flash | $0.075 | $0.30 |
| gemini-1.5-flash | $0.075 | $0.30 |

#### テキスト生成（Claude）
| モデル | 入力(1Mトークン) | 出力(1Mトークン) |
|--------|-------------------|-------------------|
| claude-sonnet-4 | $3.00 | $15.00 |

#### 動画生成（Veo）
| モデル | コスト |
|--------|--------|
| veo-2.0-generate-001 | **$0.35/秒** |

### 4.2 消費処理フロー
```
1. checkGenerationLimit() — クレジット残高の事前チェック
2. API呼び出し実行
3. logGeneration() — GenerationRunに記録・コスト計算
4. deductCreditAtomic() — 原子的なクレジット減算
   または
   consumeCredit() — トランザクション内でのクレジット消費
```

### 4.3 原子的減算（deductCreditAtomic）
```sql
-- PostgreSQLの行ロックにより同時実行を防ぐ
UPDATE "CreditBalance"
SET "balanceUsd" = "balanceUsd" - costUsd
WHERE "userId" = userId
  AND "balanceUsd" >= costUsd  -- 残高チェック付き
```
- `requestId` による冪等性保証（重複リクエスト防止）
- 更新件数0 = 残高不足としてエラー返却

---

## 5. 返金処理（refundCredit）

API呼び出し失敗時にクレジットを返金:
```typescript
type: 'refund'
requestId: 'refund_${originalRequestId}'  // 重複返金防止
```

---

## 6. 追加クレジット購入（addPurchasedCredit）

Stripeでの追加購入時:
```typescript
type: 'purchase'
description: 'クレジット購入: ${packageName}'
```

---

## 7. 管理者クレジット調整（adjustCredit）

管理者がサービスクレジットを手動付与/減算:
```typescript
type: 'adjustment'
description: 管理者が指定
adminId: 操作した管理者のID
```

---

## 8. 特殊ルール

### 8.1 Freeプラン
- AI機能は原則**使用不可**
- バナーAI編集のみ**5回無料**（`freeBannerEditLimit: 5`）
- 無料枠はクレジット消費なし（`skipCreditConsumption: true`）

### 8.2 自分のAPIキー使用
- 有料プランユーザーが自分のGoogle APIキーを設定済みの場合
- クレジット消費をスキップ（`skipCreditConsumption: true`）
- APIコストはユーザー自身のGoogle Cloud請求

### 8.3 開発者アカウント
- `DEVELOPER_EMAILS` リストに登録されたメール
- クレジット無制限（`skipCreditConsumption: true`）
- 現在は本番環境では無効化

---

## 9. トランザクション種別一覧

| type | 説明 | amountUsd |
|------|------|-----------|
| `plan_grant` | プラン月間クレジット付与 | +（正の値） |
| `api_usage` | API利用消費 | -（負の値） |
| `refund` | API失敗時の返金 | +（正の値） |
| `purchase` | 追加クレジット購入 | +（正の値） |
| `adjustment` | 管理者による調整 | ±（正負どちらも） |

---

## 10. 利用回数の目安（Businessプラン: $83.33/月）

| 操作 | 単価 | 月間回数目安 |
|------|------|-------------|
| 画像生成 1K/2K (Gemini) | $0.134 | 約622回 |
| 画像生成 4K (Gemini) | $0.24 | 約347回 |
| テキスト生成 (Gemini Flash) | 約$0.0004/1K tokens | 約208,000回(1Kトークン) |
| テキスト生成 (Claude Sonnet) | 約$0.018/1K tokens | 約4,600回(1Kトークン) |
| 動画生成 (5秒) | $1.75 | 約47回 |

---

## 11. データモデル

### CreditBalance
```
userId: String (PK)
balanceUsd: Decimal    — 現在の残高(USD)
lastRefreshedAt: DateTime — 最後の付与日時
```

### CreditTransaction
```
id: Int (PK)
userId: String
type: String           — plan_grant | api_usage | refund | purchase | adjustment
amountUsd: Decimal     — 金額(USD) 正=増加, 負=減少
balanceAfter: Decimal  — 取引後の残高
description: String    — 説明文
requestId: String?     — 冪等性キー(ユニーク)
stripePaymentId: String? — Stripe決済ID
generationRunId: Int?  — GenerationRunへの参照
model: String?         — 使用モデル
inputTokens: Int?      — 入力トークン数
outputTokens: Int?     — 出力トークン数
imageCount: Int?       — 生成画像数
adminId: String?       — 管理者ID(調整時)
createdAt: DateTime
```

---

*最終更新: 2026-02-16（解像度別料金対応済み）*
*ソースコード: `src/lib/plans.ts`, `src/lib/credits.ts`, `src/lib/ai-costs.ts`, `src/lib/usage.ts`*
