# 10年運用体制監査 - Production Readiness

**Date:** 2026-01-27
**Test Type:** 長期保守性・拡張性・運用体制の評価
**Method:** コード規約、命名、責務分離、移行戦略、監視、権限、シークレット管理の分析

---

## Executive Summary

| 観点 | 評価 | 問題数 | 優先度 |
|------|------|--------|--------|
| 命名規約一貫性 | ✓ Good | 0 | - |
| 責務分離 | ✓ Excellent | 0 | - |
| Migration運用 | ✓ Good | 0 | - |
| ログ/監視 | ⚠️ Partial | 2 | P2 |
| 権限管理 | ✓ Good | 0 | - |
| シークレット管理 | ⚠️ Needs Review | 2 | P1 |
| テスト資産 | 🔴 Missing | 1 | P1 |
| ドキュメント | ⚠️ Partial | 1 | P2 |

**Overall Result:** ⚠️ **PASS with Important Recommendations**

コードベースは構造的に健全だが、運用面（監視・テスト・シークレット管理）の強化が必要。

---

## 1. 命名規約一貫性

### ✓ EXCELLENT: 統一された命名パターン

#### API Routes命名 (REST標準準拠)
```
/api/pages              GET (list), POST (create)
/api/pages/[id]         GET (detail), PUT (full update), PATCH (partial), DELETE
/api/admin/users        GET (list), POST (approve), PATCH (plan), PUT (ban)
```

- ✓ RESTful設計に準拠
- ✓ CRUD操作が標準HTTPメソッドに対応
- ✓ 階層構造が明確 (`/admin/*`, `/ai/*`)

#### Database命名 (一貫性)
```prisma
// テーブル: PascalCase (単数形)
model Page { }
model UserSettings { }
model CreditTransaction { }

// カラム: camelCase
userId, createdAt, isApproved

// リレーション: camelCase (複数形/単数形を意味に応じて)
sections PageSection[]  // 1対多 → 複数形
page Page              // 多対1 → 単数形
```

- ✓ Prisma規約に完全準拠
- ✓ 10年後も理解しやすい命名

#### 関数命名
```typescript
// CRUD操作: 動詞 + 名詞
getUserUsage(userId)
checkCreditBalance(userId, cost)
consumeCredit(userId, cost, runId, details)

// Boolean返却: is/has/can
async function isAdmin(userId): Promise<boolean>
canSetApiKey, hasPermission

// 認証ヘルパー
async function authenticateAndAuthorize(pageId)
```

- ✓ 意図が明確
- ✓ TypeScript型で戻り値が自明

---

### ⚪ Minor: 日本語コメントの扱い

**現状:** コード内に日本語コメントが混在
```typescript
// 管理者かどうかをチェック（DBのroleフィールドで判定）
async function isAdmin(userId: string): Promise<boolean> { }

// セクションごとのimageId確認
if (sections && sections.length > 0) { }
```

**評価:** ⚪ **Acceptable for Japanese team**
- ✓ 日本人開発者には理解しやすい
- ⚠️ 国際チーム拡大時は英語化が必要

**Recommendation (P3):**
- 現状維持でOK（日本市場向けSaaS）
- 海外展開時に英語化を計画

---

## 2. 責務分離

### ✓ EXCELLENT: 明確なレイヤー構造

```
src/
├── app/
│   ├── api/                # API Routes (薄いコントローラー層)
│   └── (pages)/            # Pages (UI層)
├── components/             # UI Components
├── lib/                    # Business Logic & Utilities
│   ├── credits.ts          # クレジット管理ロジック
│   ├── usage.ts            # 使用量チェックロジック
│   ├── plans.ts            # プラン定義
│   ├── db.ts               # Prisma Client
│   ├── supabase/           # Supabase Auth
│   ├── apiKeys.ts          # APIキー管理
│   └── encryption.ts       # 暗号化ユーティリティ
└── prisma/
    └── schema.prisma       # Database Schema
```

#### レイヤー責務

**API Routes層 (app/api/\*\*/route.ts)**
- ✓ 認証チェックのみ
- ✓ バリデーション（Zodスキーマ via `validations.ts`）
- ✓ Business Logic呼び出し
- ✓ HTTPレスポンス生成

**Business Logic層 (lib/\*.ts)**
- ✓ `credits.ts`: クレジット操作（transaction内部で完結）
- ✓ `usage.ts`: 使用量チェック（複数ソースから集約）
- ✓ `plans.ts`: プラン定義とルール
- ✓ 再利用可能な純粋関数

**Data Access層 (lib/db.ts, Prisma)**
- ✓ Prisma Client singleton
- ✓ SQL抽象化
- ✓ Type-safe queries

---

### 責務分離の例: Credit Consumption

**Bad (すべてAPI Routeに書く):**
```typescript
// ❌ 悪い例
export async function POST(request: NextRequest) {
  const user = await getUser();
  const balance = await prisma.creditBalance.findUnique({ where: { userId: user.id }});
  if (balance.balanceUsd < cost) {
    return NextResponse.json({ error: 'Insufficient' }, { status: 400 });
  }
  await prisma.creditBalance.update({
    where: { userId: user.id },
    data: { balanceUsd: balance.balanceUsd - cost }
  });
  await prisma.creditTransaction.create({ /* ... */ });
  return NextResponse.json({ success: true });
}
```

**Good (責務分離):**
```typescript
// ✓ 良い例
// API Route
export async function POST(request: NextRequest) {
  const user = await getUser();
  const check = await checkCreditBalance(user.id, cost);  // lib/credits.ts
  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }
  await consumeCredit(user.id, cost, runId, details);  // lib/credits.ts
  return NextResponse.json({ success: true });
}

// lib/credits.ts
export async function consumeCredit(...) {
  await prisma.$transaction(async (tx) => {
    // トランザクション内でbalance更新 + transaction記録
  });
}
```

**Benefits:**
- ✓ テスト可能（`consumeCredit`を単独テスト）
- ✓ 再利用可能（複数API Routeから呼び出し）
- ✓ トランザクション保証が一箇所に集約

---

## 3. Migration運用

### ✓ GOOD: Prisma Migrate使用

**現在のMigration履歴:**
```
prisma/migrations/
├── 20250123_add_deployment_model/
│   └── migration.sql
└── 20250124_add_resend_settings/
    └── migration.sql
```

**評価:**
- ✓ 日付ベースの命名（YYYYMMDD_description）
- ✓ 説明的な名前（`add_deployment_model`, `add_resend_settings`）
- ✓ Incremental migrations（段階的追加）
- ✓ Breaking changeなし（ADD COLUMN only）

---

### Migration Best Practices (現在の遵守状況)

| Practice | Status | 説明 |
|----------|--------|------|
| Forward-only migrations | ✓ YES | DOWN migrationなし（Prismaデフォルト） |
| Incremental changes | ✓ YES | 小さな変更単位 |
| Non-breaking changes | ✓ YES | 既存カラム削除なし |
| Descriptive naming | ✓ YES | 意図が明確 |
| Tested locally | ⚠️ Unknown | 本番適用前のテストプロセス不明 |

---

### 🟡 P2: Migration Rollback Plan未文書化

**現状:** DOWN migration scriptなし（Prismaはrollback非対応）

**問題シナリオ:**
```
1. Migration適用: ADD COLUMN "newFeature" to Page
2. アプリケーションデプロイ: newFeatureを使う新コード
3. バグ発見: newFeatureに致命的問題
4. Rollback必要: アプリを旧バージョンに戻したい
5. ❌ 問題: 新カラムが存在するためアプリが動かない
```

**Recommendation:**
```sql
-- File: prisma/migrations/20250124_add_resend_settings/ROLLBACK.sql
-- Manual rollback instructions (not auto-executed)

ALTER TABLE "UserSettings" DROP COLUMN "resendApiKey";
ALTER TABLE "UserSettings" DROP COLUMN "notificationEmail";
ALTER TABLE "UserSettings" DROP COLUMN "resendFromDomain";

-- ⚠️ WARNING: This will delete user data in these columns
-- Always backup before rollback!
```

**Priority:** P2 - 本番インシデント時の復旧手順として必要

---

### 🟡 P2: Migration Test Procedureの文書化

**Recommendation:** `MIGRATIONS.md`ファイル作成
```markdown
# Migration Workflow

## Local Development
1. `npx prisma migrate dev --name description`
2. Test locally with real data
3. Verify app still works

## Staging Deployment
1. `npx prisma migrate deploy` on staging
2. Run integration tests
3. Verify UI flows

## Production Deployment
1. Backup database: `pg_dump ...`
2. Run migration: `npx prisma migrate deploy`
3. If failure: rollback app + run ROLLBACK.sql
4. Monitor logs for 1 hour
```

**Priority:** P2 - 運用手順の標準化

---

## 4. ログ/監視

### ⚠️ PARTIAL: Console.logに依存

**現状分析:**
- 217箇所の`console.log/error/warn`（63ファイル）
- 構造化ログなし
- ログレベル管理なし
- ログ集約なし

**Example locations:**
```typescript
// src/app/api/admin/users/route.ts:84
console.error('Failed to fetch users:', error);

// src/app/api/pages/route.ts:51-89
log.info(`========== Creating New Page ==========`);
log.success(`Page created with ID: ${page.id}`);
log.warn(`Section ${idx}: imageId=NULL`);
```

---

### 🔴 P1: 構造化ログの欠如

**問題:**
- ログ検索困難（"Failed to"で検索しても文脈不明）
- ユーザーID紐付けなし（誰のエラーか不明）
- トレース不可能（リクエストIDなし）
- ログレベル統一なし（`console.log` vs `console.error`）

**Recommendation:** Structured Logging導入

```typescript
// lib/logger.ts (新規作成)
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Usage
logger.info({ userId, pageId, action: 'create_page' }, 'Page created successfully');
logger.error({ userId, error: error.message, stack: error.stack }, 'Failed to fetch users');
```

**Benefits:**
- ✓ JSON format → 検索可能
- ✓ 構造化データ（userId, pageId, action）
- ✓ ログレベル制御（環境変数で変更可能）
- ✓ Cloud Loggingと統合可能（GCP/AWS CloudWatch）

**Priority:** P1 - 本番運用に必須

---

### 🟡 P2: APM/モニタリングツール未導入

**現状:** パフォーマンス監視なし
- レスポンス時間不明
- エラー率不明
- スローク エリ検出不可

**Recommendation:** 以下のいずれかを導入

**Option 1: Vercel Analytics（簡単）**
```typescript
// vercel.json
{
  "analytics": {
    "enable": true
  }
}
```
- ✓ Zero config
- ✓ ページビュー、Web Vitals自動収集
- ⚠️ API詳細トレースなし

**Option 2: Sentry（推奨）**
```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,  // 10%のリクエストをトレース
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Integrations.Prisma({ client: prisma }),
  ],
});
```
- ✓ エラートラッキング
- ✓ パフォーマンス監視
- ✓ Prismaクエリ可視化
- ✓ ユーザーセッション再生

**Option 3: DataDog/New Relic（エンタープライズ）**
- ✓ Full APM
- ✓ Database query analysis
- ✓ Distributed tracing
- ⚠️ 高コスト

**Priority:** P2 - ユーザー増加時（100+ concurrent users）に必須

---

### ⚪ Missing: Health Check Endpoint

**現状:** `/api/health`エンドポイントなし

**Recommendation:**
```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Database health check
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
        // storage: 'up',  // Check Supabase Storage if needed
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message
    }, { status: 503 });
  }
}
```

**Usage:**
- Vercel/Render: Health check URL設定
- Uptime monitoring (UptimeRobot, Pingdom)
- Kubernetes liveness/readiness probe（将来）

**Priority:** P2 - 本番運用の基礎

---

## 5. 権限管理の拡張性

### ✓ EXCELLENT: Role-Based Access Control (RBAC)

**現在の実装:**
```typescript
// UserSettings.role: 'user' | 'admin'

async function isAdmin(userId: string): Promise<boolean> {
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { role: true }
  });
  return userSettings?.role === 'admin';
}
```

**Usage:**
- 管理者専用API: `/api/admin/*`
- 全APIで使用: `if (!await isAdmin(user.id)) return 403;`

---

### ✓ GOOD: 将来の拡張性

**現在（2 roles）:**
```
user   → 一般ユーザー
admin  → 全権限
```

**将来の拡張例（10年後）:**
```prisma
enum UserRole {
  user          // 一般ユーザー
  editor        // ページ編集のみ
  moderator     // コンテンツ承認
  billing_admin // 請求管理のみ
  admin         // 全権限
  super_admin   // システム設定
}

model UserSettings {
  role UserRole @default(user)
  permissions String[]  // ['pages:write', 'users:read']
}
```

**Migration Path:**
```sql
-- Step 1: Add new roles
ALTER TYPE "UserRole" ADD VALUE 'editor';
ALTER TYPE "UserRole" ADD VALUE 'moderator';

-- Step 2: Migrate existing users
UPDATE "UserSettings" SET role = 'admin' WHERE role = 'admin';
UPDATE "UserSettings" SET role = 'user' WHERE role != 'admin';
```

**評価:** ✓ **Extensible** - 現在のString型から将来Enum型への移行が可能

---

### ⚪ Missing: Permission Helper Functions

**現状:** 各API Routeで個別にチェック
```typescript
const admin = await isAdmin(user.id);
if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
```

**Recommendation:** 共通ヘルパー作成
```typescript
// lib/permissions.ts (新規)
export async function requireAdmin(userId: string) {
  if (!await isAdmin(userId)) {
    throw new UnauthorizedError('Admin role required');
  }
}

export async function requirePermission(userId: string, permission: string) {
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { role: true, permissions: true }
  });

  if (!hasPermission(userSettings, permission)) {
    throw new ForbiddenError(`Permission '${permission}' required`);
  }
}

// API Route
export async function GET() {
  const user = await getUser();
  await requireAdmin(user.id);  // ✓ シンプル！
  // ...
}
```

**Priority:** P3 - リファクタリング（現状でも動作OK）

---

## 6. 環境変数/シークレット管理

### 🔴 P1: ENCRYPTION_KEY Fallback Risk

**File:** `src/lib/encryption.ts:8`

```typescript
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key-change-me';
  return crypto.createHash('sha256').update(key).digest();
}
```

**🚨 Critical Issue:**
- `'default-key-change-me'` hardcoded fallback
- 本番環境で`ENCRYPTION_KEY`未設定の場合、**全員同じキーで暗号化**
- セキュリティ侵害リスク

**Recommendation:**
```typescript
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters');
  }

  return crypto.createHash('sha256').update(key).digest();
}
```

**Benefits:**
- ✓ Fail fast（起動時にエラー）
- ✓ 本番で誤った設定を検出
- ✓ 最小キー長を強制

**Priority:** 🔴 **P0 (Critical)** - セキュリティ上の脆弱性

---

### 🟡 P1: .env.example未作成

**現状:** `.env.local`のみ（gitignore済み）

**問題:**
- 新規開発者が必要な環境変数を知らない
- 本番デプロイ時に設定漏れ

**Recommendation:** `.env.example`作成
```bash
# .env.example (Git管理下に含める)

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
DIRECT_URL="postgresql://user:password@localhost:5432/dbname"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbG..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."

# Google AI
GOOGLE_GENERATIVE_AI_API_KEY="AIza..."

# Encryption (REQUIRED - Generate with: openssl rand -hex 32)
ENCRYPTION_KEY="your-32-char-minimum-secret-key-here"

# Stripe (Optional)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Render.com (Optional)
RENDER_API_KEY="rnd_..."

# GitHub (Optional)
GITHUB_TOKEN="ghp_..."
```

**Usage:**
```bash
# 新規開発者のセットアップ
cp .env.example .env.local
# 各値を実際の値に置き換え
```

**Priority:** P1 - オンボーディングとデプロイの安全性

---

### ✓ GOOD: API Key Management

**File:** `src/lib/apiKeys.ts`

**評価:**
- ✓ ユーザーごとのAPIキー保存（暗号化前提）
- ✓ Freeプラン: 自分のAPIキー使用
- ✓ 有料プラン: システムAPIキー使用
- ✓ Fallback logic（環境変数 → DB）

**⚠️ Concern:** APIキーの暗号化実装確認

**Current Flow:**
```typescript
// src/lib/apiKeys.ts:36-39
if (userSettings?.googleApiKey) {
    return {
        apiKey: userSettings.googleApiKey,  // ← 暗号化されている？
        isUserOwnKey: true
    };
}
```

**Verification Needed:**
```typescript
// ✓ 正しい実装例
import { decrypt } from '@/lib/encryption';

if (userSettings?.googleApiKey) {
    return {
        apiKey: decrypt(userSettings.googleApiKey),  // 復号化！
        isUserOwnKey: true
    };
}
```

**Recommendation:** 暗号化/復号化の実装確認（別途Issue化）

**Priority:** P1 - セキュリティ上重要

---

### ⚪ Secret Rotation Strategy未定義

**現状:** シークレットローテーション手順なし

**Recommendation:** ローテーション手順文書化
```markdown
# Secret Rotation Procedure

## ENCRYPTION_KEY Rotation
1. Generate new key: `openssl rand -hex 32`
2. Add ENCRYPTION_KEY_NEW to environment
3. Update code to support dual-key decryption
4. Re-encrypt all data with new key
5. Remove old key after verification

## Database Password Rotation
1. Create new user in Postgres
2. Grant same permissions
3. Update DATABASE_URL in Vercel
4. Restart all instances
5. Drop old user after 24h
```

**Priority:** P2 - 年1回のローテーションを推奨

---

## 7. テスト資産

### 🔴 P1: テストファイル0件

**現状:**
```bash
$ find src -name "*.test.ts" -o -name "*.spec.ts" | wc -l
0
```

**問題:**
- リグレッション検出不可
- リファクタリングリスク高
- 新機能追加時の影響範囲不明

---

### Recommendation: 最小限のテストカバレッジ

**Priority 1: Critical Business Logic (P1)**
```typescript
// src/lib/__tests__/credits.test.ts
import { consumeCredit, checkCreditBalance } from '../credits';
import { prisma } from '../db';

describe('Credit System', () => {
  test('consumeCredit should decrement balance', async () => {
    const userId = 'test-user-123';
    await consumeCredit(userId, 1.0, 1, { model: 'gemini-2.0-flash' });
    const balance = await prisma.creditBalance.findUnique({ where: { userId }});
    expect(balance.balanceUsd).toBe(9.0);  // Started with 10.0
  });

  test('checkCreditBalance should reject insufficient balance', async () => {
    const userId = 'test-user-456';
    const result = await checkCreditBalance(userId, 100.0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('不足');
  });
});
```

**Priority 2: Authentication (P1)**
```typescript
// src/lib/__tests__/permissions.test.ts
import { isAdmin } from '../permissions';

test('isAdmin returns true for admin users', async () => {
  const result = await isAdmin('admin-user-id');
  expect(result).toBe(true);
});

test('isAdmin returns false for regular users', async () => {
  const result = await isAdmin('regular-user-id');
  expect(result).toBe(false);
});
```

**Priority 3: API Integration Tests (P2)**
```typescript
// src/app/api/pages/__tests__/route.test.ts
import { POST } from '../route';
import { NextRequest } from 'next/server';

test('POST /api/pages creates new page', async () => {
  const request = new NextRequest('http://localhost/api/pages', {
    method: 'POST',
    body: JSON.stringify({ title: 'Test Page', sections: [] })
  });

  const response = await POST(request);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.id).toBeDefined();
});
```

---

### Test Infrastructure Setup

**package.json additions:**
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.5.0",
    "jest-environment-node": "^29.5.0",
    "ts-jest": "^29.1.0"
  }
}
```

**jest.config.js:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
```

**jest.setup.js:**
```javascript
// Mock Prisma for tests
jest.mock('@/lib/db', () => ({
  prisma: {
    // Mock implementations
  }
}));
```

**Priority:** 🔴 **P1** - 本番運用前に最低限のテスト追加

**Estimated Effort:** 2-3日（Critical paths only）

---

## 8. ドキュメント

### ⚪ PARTIAL: README不足

**現状:** プロジェクト固有のREADMEなし（デフォルトのNext.js README?）

**Recommendation:** 以下の構成でREADME整備

```markdown
# Project Name

## Architecture
- Next.js 14 (App Router)
- Prisma + Supabase (Postgres)
- Stripe (Billing)
- Gemini AI (Content Generation)

## Prerequisites
- Node.js 18+
- PostgreSQL 14+

## Setup
1. `cp .env.example .env.local`
2. Fill in all environment variables
3. `npm install`
4. `npx prisma migrate dev`
5. `npm run dev`

## Project Structure
\`\`\`
src/
├── app/api/          # API Routes
├── lib/              # Business Logic
└── components/       # UI Components
\`\`\`

## Key Concepts
### Credit System
- Users have USD balance in \`CreditBalance\`
- Each API call consumes credits
- Transactions logged in \`CreditTransaction\`

### Authentication
- Supabase Auth for user management
- Application-level auth checks (RLS bypassed)
- Admin role stored in \`UserSettings.role\`

## Deployment
See [DEPLOYMENT.md](./DEPLOYMENT.md)

## Migration Guide
See [MIGRATIONS.md](./MIGRATIONS.md)
```

**Priority:** P2 - 新規メンバーのオンボーディング

---

### ⚪ API Documentation未作成

**現状:** API仕様書なし

**Recommendation:** OpenAPI/Swagger導入

**Option 1: Manual OpenAPI spec**
```yaml
# openapi.yaml
openapi: 3.0.0
info:
  title: Project API
  version: 1.0.0
paths:
  /api/pages:
    get:
      summary: List user pages
      security:
        - bearerAuth: []
      responses:
        200:
          description: Array of pages
```

**Option 2: Auto-generated (tRPC風)**
```typescript
// Use Zod schemas from validations.ts
import { pageUpdateSchema } from '@/lib/validations';

// Generate OpenAPI from Zod
import { generateSchema } from '@anatine/zod-openapi';
const openApiSchema = generateSchema(pageUpdateSchema);
```

**Priority:** P3 - Nice to have（現状はコードが仕様）

---

## 9. 10年後の技術的負債リスク

### ✓ LOW RISK: Framework Dependencies

**Current Stack:**
```json
{
  "next": "^14.x",
  "react": "^18.x",
  "prisma": "^5.x",
  "@supabase/supabase-js": "^2.x"
}
```

**Assessment:**
- ✓ Next.js: 活発な開発、大企業採用、10年安泰
- ✓ Prisma: TypeScript ORM標準、移行コストも低い
- ✓ Supabase: PostgreSQL基盤、worst caseはself-host可能

**Migration Path (if needed):**
```
Next.js → Remix/Astro (同じReactベース)
Prisma → Drizzle/TypeORM (SQL互換)
Supabase → Self-hosted Postgres + Auth0
```

**評価:** ✓ **Excellent** - 技術選定は堅実

---

### ⚪ Medium Risk: AIモデル依存

**Current:** Gemini API (`@google/generative-ai`)

**Risk:**
- ⚠️ Google AI Studioのポリシー変更
- ⚠️ 価格変動
- ⚠️ モデル廃止（GPT-3 → GPT-4のように）

**Mitigation:**
- ✓ `lib/ai-costs.ts`でコスト定義を一元化
- ✓ モデル名を定数化（ハードコードなし）
- ⚪ 抽象化層が薄い（Gemini SDKを直接使用）

**Recommendation:** AI Provider Abstraction Layer
```typescript
// lib/ai/provider.ts
interface AIProvider {
  generateText(prompt: string, model: string): Promise<string>;
  generateImage(prompt: string): Promise<string>;
}

class GeminiProvider implements AIProvider { }
class OpenAIProvider implements AIProvider { }

// 環境変数で切り替え
const provider = process.env.AI_PROVIDER === 'openai'
  ? new OpenAIProvider()
  : new GeminiProvider();
```

**Priority:** P3 - 将来の保険（現状は問題なし）

---

## 10. スケーラビリティ（10年後の想定）

### 現在の設計容量

| メトリクス | 現在 | 推定上限 | 10年後想定 |
|-----------|------|----------|-----------|
| ユーザー数 | <100 | ~10,000 | 50,000+ |
| 同時接続 | <10 | ~100 | 500+ |
| DB Row数 | <10,000 | ~1M | 10M+ |
| Storage | <1GB | ~100GB | 1TB+ |

---

### ボトルネック予測

#### 1. Database Connection Pool (P2)

**現状:** Prisma default (10 connections)

**10年後の問題:**
- 500 concurrent users → 10 connections では不足
- Connection timeout頻発

**Solution:**
```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  connection_limit = 50  // スケールに応じて調整
}
```

または

**Connection Pooler導入 (Supabase Pooler / PgBouncer)**
```
App (500 connections) → PgBouncer (10 connections) → Postgres
```

**Priority:** P2 - ユーザー1000人到達時に実施

---

#### 2. GenerationRun Table Growth (P2)

**現状:** インデックスあり、パーティショニングなし

**10年後の問題:**
- 1日1000 generation × 365日 × 10年 = 3.65M rows
- クエリ速度低下

**Solution:**
```sql
-- Partition by month
CREATE TABLE "GenerationRun_2026_01" PARTITION OF "GenerationRun"
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Auto-create partitions (pg_partman)
SELECT create_parent('public.GenerationRun', 'createdAt', 'native', 'monthly');
```

**Priority:** P2 - 100万行到達時に実施

---

#### 3. Credit Transaction Table (P2)

**同様にパーティショニング推奨**

**Alternative:** 古いトランザクションをアーカイブ
```sql
-- 1年以上前のトランザクションを別テーブルに移動
CREATE TABLE "CreditTransactionArchive" AS
SELECT * FROM "CreditTransaction"
WHERE "createdAt" < NOW() - INTERVAL '1 year';

DELETE FROM "CreditTransaction"
WHERE "createdAt" < NOW() - INTERVAL '1 year';
```

**Priority:** P3 - 監査要件次第

---

## まとめ

### ✓ Strengths (10年耐久性)

1. **責務分離:** Business LogicがAPI Routeから分離
2. **型安全性:** Prisma + TypeScriptで型チェック完璧
3. **トランザクション:** Credit systemで適切に使用
4. **命名規約:** 一貫性あり、理解しやすい
5. **Migration管理:** Prismaで適切に管理
6. **権限拡張性:** String型roleから将来Enum化可能

### ⚠️ Critical Issues (P0-P1)

| Issue | Priority | Impact | Effort |
|-------|----------|--------|--------|
| ENCRYPTION_KEY fallback | 🔴 P0 | Security | 5 min |
| .env.example未作成 | 🔴 P1 | Onboarding | 10 min |
| APIキー暗号化確認 | 🔴 P1 | Security | 30 min |
| 構造化ログ欠如 | 🔴 P1 | Operations | 1 day |
| テストファイル0件 | 🔴 P1 | Quality | 2-3 days |

### 🟡 Recommendations (P2)

1. Migration rollback手順文書化
2. Health check endpoint追加
3. APM/Sentry導入
4. Composite indexes追加（既出）
5. README/ドキュメント整備

### ⚪ Future Enhancements (P3)

1. AI Provider抽象化層
2. Permission helper functions
3. API Documentation (OpenAPI)
4. テーブルパーティショニング（100万行到達時）

---

## 次のアクション

**Task #7へ:** 全Issue (P0/P1/P2) をリスト化し、優先度順に修正

