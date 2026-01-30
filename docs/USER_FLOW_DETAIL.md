# LP Builder - 利用フロー詳細ドキュメント

このドキュメントでは、LP Builderの全利用フローを精密に記述します。

---

## 目次

1. [新規ユーザー登録〜利用開始フロー](#1-新規ユーザー登録利用開始フロー)
2. [既存ユーザーのログインフロー](#2-既存ユーザーのログインフロー)
3. [パスワードリセットフロー](#3-パスワードリセットフロー)
4. [クレジット購入フロー](#4-クレジット購入フロー)
5. [月次サブスク更新フロー](#5-月次サブスク更新フロー)
6. [LP作成〜公開フロー](#6-lp作成公開フロー)
7. [APIエンドポイント一覧](#7-apiエンドポイント一覧)
8. [データベーステーブル一覧](#8-データベーステーブル一覧)
9. [クレジットシステム詳細](#9-クレジットシステム詳細)

---

## 1. 新規ユーザー登録〜利用開始フロー

### 1-1. ホームページでプラン選択

| 項目 | 内容 |
|------|------|
| URL | `GET /` |
| ファイル | `/src/app/page.tsx` |
| 認証 | 不要 |

**表示される画面:**
- ロゴ: "LP Builder"
- ログイン/新規登録の切り替え
- プラン選択UI（Pro / Business / Enterprise）
- 「決済に進む」ボタン

**ユーザー操作:**
1. プランを選択（例: Business）
2. 「決済に進む」ボタンをクリック

---

### 1-2. Stripe Checkout Session作成

| 項目 | 内容 |
|------|------|
| URL | `POST /api/billing/checkout` |
| ファイル | `/src/app/api/billing/checkout/route.ts` |
| 認証 | 不要（未認証ユーザー向け） |

**リクエスト:**
```json
{
  "planId": "business"
}
```

**処理内容:**
1. プランID検証（free以外のみ許可）
2. ランダムパスワード生成（12文字、英数字）
3. Stripe Checkout Session作成

**Stripe Session設定:**
```javascript
{
  mode: 'subscription',
  line_items: [{ price: 'price_xxx', quantity: 1 }],
  success_url: 'https://xxx/welcome?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://xxx/?canceled=true',
  metadata: {
    planId: 'business',
    tempPassword: 'aB3dEfGhIjK9'  // 自動生成
  },
  billing_address_collection: 'required',
  payment_method_types: ['card'],
  locale: 'ja'
}
```

**レスポンス:**
```json
{
  "url": "https://checkout.stripe.com/pay/cs_test_xxx..."
}
```

**ブラウザ動作:**
- Stripe Checkout画面へリダイレクト

---

### 1-3. Stripe Checkout画面

| 項目 | 内容 |
|------|------|
| URL | `https://checkout.stripe.com/...` |
| 運営 | Stripe |

**ユーザー入力:**
- メールアドレス（例: `user@example.com`）
- クレジットカード情報
- 請求先住所

**決済完了後:**
- `success_url`へリダイレクト
- Stripe Webhook発火

---

### 1-4. Stripe Webhook処理

| 項目 | 内容 |
|------|------|
| URL | `POST /api/webhooks/stripe` |
| ファイル | `/src/app/api/webhooks/stripe/route.ts` |
| 認証 | Stripe署名検証 |

**Webhookイベント:** `checkout.session.completed`

**処理フロー:**

#### Step 1: 冪等性チェック
```sql
-- WebhookEventテーブルで重複確認
SELECT * FROM webhook_events WHERE event_id = 'evt_xxx';
```

#### Step 2: ユーザー検索・作成
```javascript
// メールアドレスで既存ユーザー検索（ページング対応）
const existingUser = await findUserByEmail(email);

if (!existingUser) {
  // Supabase Auth で新規ユーザー作成
  const newUser = await supabaseAdmin.auth.admin.createUser({
    email: 'user@example.com',
    password: 'aB3dEfGhIjK9',  // metadataから取得
    email_confirm: true
  });
}
```

#### Step 3: Stripe Customer更新
```javascript
await stripe.customers.update(customerId, {
  metadata: {
    userId: 'uuid-xxx',
    tempPassword: 'aB3dEfGhIjK9',
    passwordSet: 'true'
  }
});
```

#### Step 4: サブスクリプション保存
```sql
INSERT INTO subscriptions (
  user_id, stripe_customer_id, stripe_subscription_id,
  stripe_price_id, plan, status, current_period_start, current_period_end
) VALUES (...);
```

#### Step 5: UserSettings作成/更新
```sql
INSERT INTO user_settings (user_id, plan, email)
VALUES ('uuid-xxx', 'business', 'user@example.com')
ON CONFLICT (user_id) DO UPDATE SET plan = 'business', email = 'user@example.com';
```

#### Step 6: 初回クレジット付与
```sql
-- CreditBalance
INSERT INTO credit_balances (user_id, balance_usd)
VALUES ('uuid-xxx', 66.67)
ON CONFLICT (user_id) DO UPDATE SET balance_usd = balance_usd + 66.67;

-- CreditTransaction（履歴）
INSERT INTO credit_transactions (user_id, type, amount_usd, description)
VALUES ('uuid-xxx', 'plan_grant', 66.67, 'Businessプラン月間クレジット付与');
```

#### Step 7: ウェルカムメール送信
```javascript
await sendWelcomeEmail({
  to: 'user@example.com',
  password: 'aB3dEfGhIjK9',
  planName: 'Business'
});
```

**送信されるメール:**

| 項目 | 内容 |
|------|------|
| From | `noreply@lpbuilder.app` (Resend API) |
| To | `user@example.com` |
| Subject | 【LP Builder】ご登録完了 - ログイン情報のお知らせ |

**メール本文:**
```
ご登録ありがとうございます！

ログインID（メールアドレス）: user@example.com
パスワード: aB3dEfGhIjK9

※セキュリティのため、初回ログイン後にパスワードを変更することをお勧めします。

[ログインする] ← ボタン（リンク先: https://xn--lp-xv5crjy08r.com）
```

---

### 1-5. ウェルカムページ

| 項目 | 内容 |
|------|------|
| URL | `GET /welcome?session_id=cs_xxx` |
| ファイル | `/src/app/welcome/page.tsx` |
| 認証 | 不要 |

**API呼び出し:**
```
GET /api/billing/checkout/complete?session_id=cs_xxx
```

**レスポンス:**
```json
{
  "email": "user@example.com",
  "planName": "Business",
  "isNewUser": true
}
```

**表示される画面:**
- チェックマークアイコン
- 「ご登録ありがとうございます！」
- 「ログイン情報をメールで送信しました」
- メールアドレス表示: `user@example.com`
- 「メールが届かない場合は迷惑メールフォルダをご確認ください」
- 「ログインページへ進む」ボタン

---

### 1-6. ログイン

| 項目 | 内容 |
|------|------|
| URL | `GET /` |
| ファイル | `/src/app/page.tsx` |
| 認証 | 不要 |

**ユーザー入力:**
- メールアドレス: `user@example.com`
- パスワード: `aB3dEfGhIjK9`（メールから取得）

**処理:**
```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'aB3dEfGhIjK9'
});

if (data.user) {
  router.push('/admin');
}
```

**Supabase処理:**
- パスワード検証
- JWTトークン生成
- セッション確立（ブラウザのローカルストレージ/Cookie）

---

### 1-7. ダッシュボードアクセス

| 項目 | 内容 |
|------|------|
| URL | `GET /admin` → リダイレクト → `GET /admin/pages` |
| ファイル | `/src/app/admin/pages/page.tsx` |
| 認証 | JWT必須 |

**Middleware処理** (`/src/middleware.ts`):
1. JWTトークン検証
2. セッション有効期限確認
3. ユーザーステータスチェック（BAN確認）
4. サブスクリプション有効性確認

**表示される画面:**
- サイドバー（LP一覧）
- 「新規作成」ボタン
- ページリスト（タイトル、更新日、ステータス）
- クレジット残高表示

---

## 2. 既存ユーザーのログインフロー

### 2-1. ログインページアクセス

| 項目 | 内容 |
|------|------|
| URL | `GET /` |
| ファイル | `/src/app/page.tsx` |

**表示:**
- メールアドレス入力フィールド
- パスワード入力フィールド
- 「ログイン」ボタン
- 「パスワードを忘れた方」リンク

### 2-2. 認証処理

**処理:**
```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});
```

**エラーケース:**
- `Invalid login credentials` → 「メールアドレスまたはパスワードが違います」
- `Email not confirmed` → 「メールアドレスが確認されていません」

### 2-3. リダイレクト

**成功時:**
```javascript
router.push('/admin');
router.refresh();
```

---

## 3. パスワードリセットフロー

### 3-1. リセット申請

| 項目 | 内容 |
|------|------|
| URL | `GET /reset-password` |
| ファイル | `/src/app/reset-password/page.tsx` |

**ユーザー入力:**
- メールアドレス

**処理:**
```javascript
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${origin}/reset-password/confirm`
});
```

**表示:**
- 「パスワードリセットメールを送信しました」

### 3-2. メール受信

| 項目 | 内容 |
|------|------|
| From | Supabase (noreply@mail.supabase.io) |
| Subject | Reset your password |

**メール内容:**
```
Click the link below to reset your password:
https://xn--lp-xv5crjy08r.com/reset-password/confirm?code=xxxx&type=recovery
```

### 3-3. 新パスワード設定

| 項目 | 内容 |
|------|------|
| URL | `GET /reset-password/confirm?code=xxx&type=recovery` |
| ファイル | `/src/app/reset-password/confirm/page.tsx` |

**処理フロー:**
1. URLのcodeパラメータからセッション交換
2. 新パスワード入力フォーム表示
3. パスワード更新実行

```javascript
// セッション確立
await supabase.auth.exchangeCodeForSession(code);

// パスワード更新
await supabase.auth.updateUser({
  password: newPassword
});
```

**完了後:**
- 「パスワードを更新しました」表示
- 「ログインページへ」ボタン

---

## 4. クレジット購入フロー

### 4-1. 購入画面

| 項目 | 内容 |
|------|------|
| URL | `GET /admin/settings` |
| ファイル | `/src/app/admin/settings/page.tsx` |
| 認証 | JWT必須 |

**表示:**
- 現在のプラン
- クレジット残高
- 追加クレジットパッケージ

**パッケージ一覧:**
| パッケージ | 価格 | クレジット |
|-----------|------|-----------|
| 50,000トークン | ¥5,000 | $33.33相当 |
| 100,000トークン | ¥10,000 | $66.67相当 |
| 250,000トークン | ¥25,000 | $166.67相当 |

### 4-2. Checkout Session作成

| 項目 | 内容 |
|------|------|
| URL | `POST /api/billing/credits/purchase` |
| ファイル | `/src/app/api/billing/credits/purchase/route.ts` |
| 認証 | JWT必須 |

**リクエスト:**
```json
{
  "packageId": 2
}
```

**Stripe Session設定:**
```javascript
{
  mode: 'payment',  // 単発購入
  customer: stripeCustomerId,
  line_items: [{
    price_data: {
      currency: 'jpy',
      product_data: {
        name: 'APIクレジット購入 (100,000トークン)'
      },
      unit_amount: 10000
    },
    quantity: 1
  }],
  success_url: '/admin/settings?credit=success',
  metadata: {
    userId: 'uuid-xxx',
    packageId: '2',
    creditUsd: '66.67',
    packageName: '100,000トークン'
  }
}
```

### 4-3. 決済完了・クレジット付与

**Webhookイベント:** `checkout.session.completed` (mode: payment)

**処理:**
```javascript
if (session.mode === 'payment') {
  const creditUsd = parseFloat(metadata.creditUsd);
  await addPurchasedCredit(userId, creditUsd, paymentIntentId, packageName);
}
```

**DB更新:**
```sql
-- CreditBalance
UPDATE credit_balances SET balance_usd = balance_usd + 66.67 WHERE user_id = 'uuid-xxx';

-- CreditTransaction
INSERT INTO credit_transactions (user_id, type, amount_usd, description, stripe_payment_id)
VALUES ('uuid-xxx', 'purchase', 66.67, 'クレジット購入: 100,000トークン', 'pi_xxx');
```

---

## 5. 月次サブスク更新フロー

### 5-1. 自動課金（Stripe側）

**タイミング:** `subscription.current_period_end` 日時

**Stripe処理:**
1. 登録カードへ課金
2. Invoice生成
3. Webhook発火

### 5-2. Webhook処理

**Webhookイベント:** `invoice.paid`

**処理:**
```javascript
async function handleInvoicePaid(invoice) {
  // 初回請求はスキップ（checkout.session.completedで処理済み）
  if (invoice.billing_reason === 'subscription_create') return;

  // 月次更新の場合のみ処理
  if (invoice.billing_reason !== 'subscription_cycle') return;

  // ユーザー特定
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: invoice.subscription }
  });

  // クレジット付与
  await grantPlanCredit(subscription.userId, plan.includedCreditUsd, plan.name);

  // 期間更新
  await updateSubscription(subscription.userId, {
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });
}
```

**DB更新:**
```sql
-- CreditBalance
UPDATE credit_balances SET balance_usd = balance_usd + 66.67 WHERE user_id = 'uuid-xxx';

-- CreditTransaction
INSERT INTO credit_transactions (user_id, type, amount_usd, description)
VALUES ('uuid-xxx', 'plan_grant', 66.67, 'Businessプラン月間クレジット付与');

-- Subscription
UPDATE subscriptions SET current_period_start = NOW(), current_period_end = NOW() + INTERVAL '30 days'
WHERE user_id = 'uuid-xxx';
```

---

## 6. LP作成〜公開フロー

### 6-1. LP新規作成

| 項目 | 内容 |
|------|------|
| URL | `POST /api/pages` |
| ファイル | `/src/app/api/pages/route.ts` |
| 認証 | JWT必須 |

**リクエスト:**
```json
{
  "title": "新規LP",
  "slug": "page-1706612345678"
}
```

**処理:**
1. ページ数制限チェック
2. Pageレコード作成
3. 初期PageSection作成

**DB書き込み:**
```sql
INSERT INTO pages (user_id, title, slug, status) VALUES ('uuid-xxx', '新規LP', 'page-xxx', 'draft');
INSERT INTO page_sections (page_id, role, "order", config) VALUES (1, 'hero', 0, '{}');
```

### 6-2. セクション画像生成

| 項目 | 内容 |
|------|------|
| URL | `POST /api/sections/generate` |
| ファイル | `/src/app/api/sections/generate/route.ts` |
| 認証 | JWT必須 |

**リクエスト:**
```json
{
  "prompt": "パーソナルジムの入会促進バナー",
  "width": 750,
  "height": 400
}
```

**処理フロー:**
1. クレジット残高チェック
2. Google Gemini APIで画像生成
3. Supabase Storageに画像保存
4. MediaImageレコード作成
5. クレジット消費記録
6. GenerationRun記録

**DB書き込み:**
```sql
-- MediaImage
INSERT INTO media_images (user_id, file_path, width, height, prompt, source_type)
VALUES ('uuid-xxx', 'images/xxx/123.png', 750, 400, 'パーソナルジム...', 'generated');

-- CreditBalance
UPDATE credit_balances SET balance_usd = balance_usd - 0.134 WHERE user_id = 'uuid-xxx';

-- CreditTransaction
INSERT INTO credit_transactions (user_id, type, amount_usd, generation_run_id)
VALUES ('uuid-xxx', 'api_usage', -0.134, 'run-xxx');

-- GenerationRun
INSERT INTO generation_runs (user_id, type, model, input_prompt, estimated_cost, status)
VALUES ('uuid-xxx', 'section_generate', 'gemini-3-pro-image', '...', 0.134, 'succeeded');
```

### 6-3. セクション設定保存

| 項目 | 内容 |
|------|------|
| URL | `PUT /api/pages/[id]` |
| ファイル | `/src/app/api/pages/[id]/route.ts` |
| 認証 | JWT必須 + ページ所有権確認 |

**リクエスト:**
```json
{
  "sections": [{
    "id": "1",
    "role": "hero",
    "order": 0,
    "imageId": 123,
    "config": {
      "text": "理想のボディを手に入れる",
      "textColor": "#FFFFFF",
      "position": "center"
    }
  }],
  "status": "draft"
}
```

### 6-4. LP公開

| 項目 | 内容 |
|------|------|
| URL | `PUT /api/pages/[id]` |
| 変更点 | `status: 'published'` |

**DB更新:**
```sql
UPDATE pages SET status = 'published', updated_at = NOW() WHERE id = 1;
```

### 6-5. 公開ページ表示

| 項目 | 内容 |
|------|------|
| URL | `GET /p/[slug]` |
| ファイル | `/src/app/p/[slug]/page.tsx` |
| 認証 | 不要（公開ページ） |

**処理:**
```javascript
const page = await prisma.page.findFirst({
  where: { slug, status: 'published' }
});

const sections = await prisma.pageSection.findMany({
  where: { pageId: page.id },
  include: { image: true }
});
```

**SEOメタデータ:**
```javascript
export async function generateMetadata({ params }) {
  return {
    title: page.seoData?.title || page.title,
    description: page.seoData?.description,
    openGraph: { ... }
  };
}
```

---

## 7. APIエンドポイント一覧

### 認証不要

| メソッド | エンドポイント | 用途 |
|---------|---------------|------|
| POST | `/api/billing/checkout` | 未認証ユーザーのCheckout Session作成 |
| GET | `/api/billing/checkout/complete` | Checkout完了情報取得 |
| POST | `/api/webhooks/stripe` | Stripe Webhook処理 |
| GET | `/p/[slug]` | 公開LP表示 |
| POST | `/api/form-submissions` | お問い合わせフォーム送信 |

### 認証必須

| メソッド | エンドポイント | 用途 |
|---------|---------------|------|
| GET/POST | `/api/pages` | ページ一覧取得/作成 |
| GET/PUT/DELETE | `/api/pages/[id]` | ページ詳細/更新/削除 |
| POST | `/api/sections/generate` | セクション画像生成 |
| POST | `/api/sections/[id]/regenerate` | セクション再生成 |
| POST | `/api/ai/analyze-design` | デザイン解析 |
| POST | `/api/ai/inpaint` | 画像編集 |
| GET | `/api/user/settings` | ユーザー設定取得 |
| GET | `/api/user/usage` | 使用状況取得 |
| POST | `/api/billing/subscription/create` | サブスク開始（既存ユーザー） |
| POST | `/api/billing/credits/purchase` | クレジット購入 |

### 管理者専用

| メソッド | エンドポイント | 用途 |
|---------|---------------|------|
| GET | `/api/admin/users` | ユーザー一覧 |
| POST | `/api/admin/credits` | クレジット付与/調整 |
| GET | `/api/admin/stats` | 統計情報 |

---

## 8. データベーステーブル一覧

### Supabase Auth（管理外）
- `auth.users` - ユーザー認証情報

### Prisma管理テーブル

| テーブル | 用途 |
|---------|------|
| `user_settings` | ユーザー設定（プラン、APIキー等） |
| `subscriptions` | サブスクリプション情報 |
| `credit_balances` | クレジット残高 |
| `credit_transactions` | クレジット取引履歴 |
| `pages` | LPページ情報 |
| `page_sections` | LPセクション情報 |
| `media_images` | 画像メタデータ |
| `generation_runs` | AI生成ログ |
| `webhook_events` | Webhookイベント履歴（冪等性用） |
| `form_submissions` | フォーム送信データ |

---

## 9. クレジットシステム詳細

### 変換レート

```
1円 = 10トークン
1 USD = 150円 = 1,500トークン
```

### プラン別月間クレジット

| プラン | 月額 | トークン | USD換算 |
|--------|------|----------|---------|
| Pro | ¥9,800 | 50,000 | $33.33 |
| Business | ¥19,800 | 100,000 | $66.67 |
| Enterprise | ¥49,800 | 250,000 | $166.67 |

### API消費目安

| 操作 | 消費トークン |
|------|-------------|
| 画像生成（1枚） | 約1,300 |
| テキスト生成 | 約100〜500 |
| デザイン解析 | 約500 |
| 動画生成（1秒） | 約3,500 |

### CreditTransaction.type

| type | 説明 |
|------|------|
| `plan_grant` | プラン月間クレジット付与 |
| `purchase` | クレジット購入 |
| `api_usage` | API使用による消費 |
| `refund` | 返金 |
| `admin_adjustment` | 管理者による調整 |

---

## フローチャート

```
┌─────────────────────────────────────────────────────────┐
│                    ホームページ                          │
│                   プラン選択                             │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              POST /api/billing/checkout                  │
│              パスワード生成 + Stripe Session             │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│               Stripe Checkout画面                        │
│           メール・カード情報入力 → 決済                   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│           POST /api/webhooks/stripe                      │
│  ユーザー作成 → クレジット付与 → メール送信              │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  ウェルカムページ                        │
│              「メールを確認してください」                 │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   メール受信                             │
│         ログインID + パスワード記載                      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   ログイン                               │
│            メール + パスワード入力                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  ダッシュボード                          │
│              LP一覧 / 新規作成                           │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  LPエディター                            │
│           セクション編集 / 画像生成                      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    LP公開                                │
│              /p/[slug] で閲覧可能                        │
└─────────────────────────────────────────────────────────┘
```

---

## セキュリティ機構

1. **JWT認証** - Supabase JWTトークンによる認証
2. **Webhook署名検証** - Stripe HMAC署名確認
3. **冪等性チェック** - WebhookEvent テーブルで重複処理防止
4. **CSRF保護** - Originヘッダー検証
5. **RLS** - Supabase Row Level Security
6. **レート制限** - API別のリクエスト制限
7. **ページ所有権確認** - userIdによるアクセス制御

---

*最終更新: 2026-01-30*
