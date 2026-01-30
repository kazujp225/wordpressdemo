# セキュリティ概要レポート

このドキュメントは、セキュリティチェック用にアプリケーションの全体像をまとめたものです。

---

## 1. 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 14 (App Router) |
| 認証 | Supabase Auth |
| データベース | PostgreSQL (Supabase) |
| ORM | Prisma |
| 決済 | Stripe |
| AI/ML | Google Gemini, Anthropic Claude, Replicate |
| ストレージ | Supabase Storage |

---

## 2. 認証・認可システム

### 2.1 認証フロー

```
Client (Browser)
    ↓
Supabase Auth (anon key)
    ↓
Cookie-based Session
    ↓
Server-side Session Validation
```

### 2.2 クライアント側

```typescript
// src/lib/supabase/client.ts
createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### 2.3 サーバー側

```typescript
// src/lib/supabase/server.ts
createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get, set, remove } }
);
```

### 2.4 ミドルウェア認可

```typescript
// src/lib/supabase/middleware.ts
// 各リクエストでユーザーステータスをチェック
async function checkUserStatus(userId: string): Promise<UserStatus> {
    const { data: settings } = await supabaseAdmin
        .from('UserSettings')
        .select('isBanned, plan')
        .eq('userId', userId)
        .single();

    return {
        isBanned: settings?.isBanned === true,
        hasActiveSubscription: !!plan && plan !== 'free',
        plan
    };
}
```

### 2.5 ルートベース認可

| ルート種別 | パス例 | 認証 |
|-----------|--------|------|
| パブリック | `/`, `/auth/callback`, `/terms`, `/privacy`, `/p/[slug]` | 不要 |
| API (Webhook) | `/api/webhooks/*` | Stripe署名検証 |
| プライベート | `/dashboard`, `/editor/*` | 必須 |
| 管理者専用 | `/admin/*` | 必須 + role='admin' |

### 2.6 BAN機能

- DBの `isBanned` フラグでチェック
- ミドルウェアで全リクエストを検証
- BAN中は `/banned` へ強制リダイレクト

---

## 3. 課金システム

### 3.1 プラン構成

| プラン | 月額(税込) | 付与トークン | Stripe Price ID |
|--------|-----------|-------------|-----------------|
| Free | ¥0 | 0 | - |
| Pro | ¥20,000 | 50,000 | `price_1Sulwo...` |
| Business | ¥40,000 | 100,000 | `price_1Sulz6...` |
| Enterprise | ¥100,000 | 250,000 | `price_1Sum2w...` |

### 3.2 トークン計算

```typescript
// 1 USD = 150円
// 1円 = 10トークン
// → 1 USD = 1,500トークン

export function usdToTokens(usd: number): number {
    const jpy = usd * 150;
    return Math.round(jpy * 10);
}
```

### 3.3 Stripe連携フロー

```
1. ユーザーがプラン選択
    ↓
2. /api/billing/subscription/create でCheckoutセッション作成
    ↓
3. Stripe決済画面へリダイレクト
    ↓
4. 決済完了
    ↓
5. Webhook受信 (/api/webhooks/stripe)
    ↓
6. checkout.session.completed イベント処理
    ↓
7. ユーザー作成 or プラン更新
    ↓
8. クレジット付与
```

### 3.4 Webhook処理

```typescript
// src/app/api/webhooks/stripe/route.ts
export async function POST(request: NextRequest) {
    const body = await request.text();
    const signature = headersList.get('stripe-signature');

    // 署名検証（必須）
    let event: Stripe.Event;
    try {
        event = constructWebhookEvent(body, signature);
    } catch (error) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // イベント処理
    switch (event.type) {
        case 'checkout.session.completed':
            await handleCheckoutComplete(event.data.object);
            break;
        case 'invoice.paid':
            await handleInvoicePaid(event.data.object);
            break;
        case 'customer.subscription.updated':
            await handleSubscriptionUpdated(event.data.object);
            break;
        case 'customer.subscription.deleted':
            await handleSubscriptionDeleted(event.data.object);
            break;
    }
}
```

### 3.5 クレジット管理

```typescript
// API呼び出し前のチェック
const limitCheck = await checkTextGenerationLimit(userId, model, inputTokens, outputTokens);
if (!limitCheck.allowed) {
    return NextResponse.json({
        error: 'INSUFFICIENT_CREDIT',
        message: limitCheck.reason
    }, { status: 402 });
}

// API呼び出し成功後の消費
if (!skipCreditConsumption) {
    await recordApiUsage(userId, logResult.id, logResult.estimatedCost, { model });
}
```

---

## 4. データベーススキーマ（セキュリティ関連）

### 4.1 UserSettings

```prisma
model UserSettings {
  id                Int       @id @default(autoincrement())
  userId            String    @unique
  email             String?
  role              String    @default("user")  // 'user' | 'admin'
  plan              String    @default("free")
  googleApiKey      String?   // AES-256-GCM暗号化
  renderApiKey      String?   // AES-256-GCM暗号化
  githubToken       String?   // AES-256-GCM暗号化
  isBanned          Boolean   @default(false)
  bannedAt          DateTime?
  bannedBy          String?
  banReason         String?
}
```

### 4.2 CreditBalance

```prisma
model CreditBalance {
  id              Int       @id @default(autoincrement())
  userId          String    @unique
  balanceUsd      Decimal   @default(0) @db.Decimal(10, 6)
  lastRefreshedAt DateTime?
}
```

### 4.3 CreditTransaction

```prisma
model CreditTransaction {
  id              Int      @id @default(autoincrement())
  userId          String
  type            String   // 'plan_grant' | 'api_usage' | 'purchase' | 'refund' | 'adjustment'
  amountUsd       Decimal  @db.Decimal(10, 6)
  balanceAfter    Decimal  @db.Decimal(10, 6)
  generationRunId Int?
  model           String?
  stripePaymentId String?  @unique
}
```

### 4.4 Subscription

```prisma
model Subscription {
  id                   Int       @id @default(autoincrement())
  userId               String    @unique
  stripeCustomerId     String    @unique
  stripeSubscriptionId String?   @unique
  plan                 String    @default("pro")
  status               String    @default("active") // active | canceled | past_due | unpaid
  cancelAtPeriodEnd    Boolean   @default(false)
}
```

---

## 5. 暗号化

### 5.1 実装

```typescript
// src/lib/encryption.ts
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export function encrypt(text: string): string {
    const key = getEncryptionKey();  // SHA256ハッシュ化
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Format: iv:tag:encrypted
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}
```

### 5.2 暗号化対象

- ユーザーのGoogle APIキー
- ユーザーのGitHubトークン
- ユーザーのRender APIキー
- ユーザーのResend APIキー

---

## 6. 環境変数

### 6.1 シークレット（サーバーのみ）

| 変数名 | 用途 |
|--------|------|
| `DATABASE_URL` | PostgreSQL接続 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase管理者アクセス |
| `STRIPE_SECRET_KEY` | Stripe API（シークレット） |
| `STRIPE_WEBHOOK_SECRET` | Webhook署名検証 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API |
| `ANTHROPIC_API_KEY` | Claude API |
| `ENCRYPTION_KEY` | APIキー暗号化 |

### 6.2 パブリック（クライアント可）

| 変数名 | 用途 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe公開鍵 |
| `NEXT_PUBLIC_BASE_URL` | アプリURL |

---

## 7. API認証パターン

### 7.1 標準パターン

```typescript
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 処理
}
```

### 7.2 管理者チェック

```typescript
async function isAdmin(userId: string): Promise<boolean> {
    const userSettings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { role: true }
    });
    return userSettings?.role === 'admin';
}

export async function POST(request: NextRequest) {
    // ... 認証チェック ...

    if (!await isAdmin(user.id)) {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // 管理者処理
}
```

### 7.3 所有権チェック

```typescript
if (page?.userId !== user?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## 8. 外部API連携

### 8.1 使用サービス

| サービス | 用途 | 認証方式 |
|----------|------|----------|
| Google Gemini | テキスト/画像生成 | API Key |
| Anthropic Claude | テキスト生成 | API Key |
| Replicate | 画像アップスケール | API Key |
| Stripe | 決済 | Secret Key + Webhook署名 |
| Resend | メール送信 | API Key |

### 8.2 APIキー管理

```typescript
// Freeプラン: ユーザー自身のAPIキーを使用
// 有料プラン: 自社APIキーを使用（ユーザーのは無視）

export async function getGoogleApiKeyWithInfo(userId: string): Promise<ApiKeyResult> {
    const userSettings = await prisma.userSettings.findUnique({ where: { userId } });
    const planId = userSettings?.plan || 'free';

    if (isFreePlan(planId) && userSettings?.googleApiKey) {
        return { apiKey: userSettings.googleApiKey, isUserOwnKey: true };
    }

    return { apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY, isUserOwnKey: false };
}
```

---

## 9. RLS（Row Level Security）

### 9.1 概要

- Supabaseで有効化
- Prisma + service_role keyはRLSをバイパス
- API層で認可チェックを実装

### 9.2 ポリシー例

```sql
-- ユーザーは自分のページのみ閲覧可能
CREATE POLICY "Users can view their own pages"
ON "Page" FOR SELECT
USING (auth.uid()::text = "userId");

-- 公開ページは誰でも閲覧可能
CREATE POLICY "Anyone can view published pages"
ON "Page" FOR SELECT
USING ("status" = 'published');
```

---

## 10. セキュリティ上の考慮事項

### 10.1 実装済み

- [x] Supabase Auth による認証
- [x] Stripe Webhook署名検証
- [x] APIキーのAES-256-GCM暗号化
- [x] 管理者ロールベースアクセス制御
- [x] ページ所有権チェック
- [x] BAN機能（即時ブロック）
- [x] クレジット消費のトランザクション処理
- [x] RLSによるデータベースレベル保護
- [x] Webhook冪等性（WebhookEventテーブルで重複処理防止）
- [x] 全APIルートの認可チェック（IDOR対策完了）
- [x] 管理者専用エンドポイントのロールチェック
- [x] クレジット消費のレースコンディション対策（トランザクション内チェック）
- [x] APIエンドポイント別のレート制限（ミドルウェアで実装）
- [x] CSRF対策（Origin/Refererヘッダー検証）
- [x] Content Security Policy (CSP) ヘッダー
- [x] セキュリティヘッダー（X-Frame-Options, X-Content-Type-Options, HSTS等）

### 10.2 潜在的な改善点

- [ ] BAN チェックのキャッシュ化（パフォーマンス）
- [ ] 監査ログの詳細化（管理者操作）
- [ ] データベースのEncryption at Rest確認
- [ ] Redisベースのレート制限（スケール時）
- [ ] 暗号化キーのローテーション設計

---

## 11. CSP詳細設定

### 11.1 Content-Security-Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://challenges.cloudflare.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: blob: https://*.supabase.co https://*.supabase.com https://replicate.delivery https://pbxt.replicate.delivery;
connect-src 'self' https://*.supabase.co https://*.supabase.com https://api.stripe.com https://generativelanguage.googleapis.com https://api.anthropic.com https://api.replicate.com wss://*.supabase.co;
frame-src 'self' https://js.stripe.com https://challenges.cloudflare.com;
media-src 'self' blob: https://*.supabase.co https://*.supabase.com;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'self';
```

### 11.2 CSP設計方針

| ディレクティブ | 設定 | 理由 |
|--------------|------|------|
| `script-src 'unsafe-inline' 'unsafe-eval'` | 許可 | Next.js App Routerのhydration/HMRに必須 |
| `connect-src` | 限定的 | Supabase, Stripe, AI APIのみ許可 |
| `frame-src` | Stripeのみ | 決済フォーム埋め込み用 |
| `object-src 'none'` | 禁止 | Flash/Plugin無効化 |
| `frame-ancestors 'self'` | 自サイトのみ | クリックジャッキング対策 |

### 11.3 注意事項

- `unsafe-inline`/`unsafe-eval`はNext.jsの制約上必須
- nonceベースCSPは設定複雑度が高く現状未実装
- XSS対策は入力サニタイズとReactのエスケープに依存

---

## 12. Cookie/Session設定

### 12.1 Supabase Auth Cookie属性

| 属性 | 値 | 説明 |
|------|-----|------|
| `HttpOnly` | true | JavaScriptからアクセス不可 |
| `Secure` | true (本番) | HTTPS時のみ送信 |
| `SameSite` | Lax | CSRF対策（クロスサイトPOSTでは送信されない） |
| `Path` | / | 全パスで有効 |
| `Domain` | 未設定 | 現在のホストのみ |

### 12.2 セッション管理

- Supabase SSRライブラリがCookie管理を担当
- アクセストークンは自動リフレッシュ
- サーバーサイドで`getUser()`によるJWT検証

```typescript
// src/lib/supabase/server.ts
createServerClient(url, anonKey, {
    cookies: {
        get(name) { return cookieStore.get(name)?.value; },
        set(name, value, options) { cookieStore.set({ name, value, ...options }); },
        remove(name, options) { cookieStore.set({ name, value: '', ...options }); },
    },
});
```

---

## 13. service_role利用箇所

### 13.1 利用一覧

| ファイル | 目的 | 入力 | ログ方針 |
|---------|------|------|----------|
| `src/lib/supabase/middleware.ts` | UserSettings取得（BAN/plan確認） | userId (JWT由来) | なし |
| `src/lib/supabase.ts` | Storage操作（画像アップロード） | ファイルデータ | アップロードログあり |
| `src/app/api/webhooks/stripe/route.ts` | ユーザー作成 | Stripe metadata | Webhook処理ログあり |
| `src/app/api/admin/users/route.ts` | ユーザー一覧取得 | なし | 管理者操作 |

### 13.2 設計方針

- **最小権限**: service_roleは必要な操作のみに使用
- **フォールバック禁止**: anon keyへのフォールバックは廃止
- **入力検証**: 外部入力（Stripe metadata等）は署名検証後に使用
- **ログ**: 重要操作はGenerationRun/WebhookEventテーブルに記録

### 13.3 Edge Runtime注意事項

- `src/lib/supabase/middleware.ts`はEdge Runtimeで動作
- service_roleキーがEdge環境に露出するリスクあり
- 対策: 環境変数はVercel Edge Configで保護

---

## 14. 依存関係（セキュリティ関連）

```json
{
  "@supabase/ssr": "^0.8.0",
  "@supabase/supabase-js": "^2.89.0",
  "stripe": "^20.1.2",
  "@anthropic-ai/sdk": "^0.71.2",
  "@google/generative-ai": "^0.24.1",
  "@prisma/client": "^5.22.0",
  "jose": "^5.9.6"
}
```

---

## 15. 緊急時対応

### 12.1 ユーザーBAN

```sql
UPDATE "UserSettings"
SET "isBanned" = true, "bannedAt" = NOW(), "banReason" = '理由'
WHERE "userId" = 'xxx';
```

### 12.2 Stripe Webhook無効化

Stripeダッシュボード → Webhooks → エンドポイント無効化

### 12.3 APIキー無効化

- Google Cloud Console → 認証情報 → APIキー削除
- Stripe Dashboard → APIキー → ローテーション
