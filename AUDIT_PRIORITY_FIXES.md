# 修正優先度リスト - Production Readiness Audit

**Date:** 2026-01-27
**Status:** 修正対象の問題を優先度別に整理

---

## P0 - Critical (即時修正必須)

### P0-1: ENCRYPTION_KEY Fallback Risk 🔴

**File:** `src/lib/encryption.ts:8`

**Problem:**
```typescript
const key = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key-change-me';
```
Hardcoded fallback allows production deployment without proper encryption key.

**Impact:** 🔴 Security vulnerability - All encrypted data uses same weak key

**Fix:**
```typescript
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters');
  }

  return crypto.createHash('sha256').update(key).digest();
}
```

**Verification:** アプリ起動時に環境変数チェック → エラーで停止

**Status:** ⚠️ NOT FIXED (要修正)

---

## P1 - High (本番前に修正推奨)

### P1-1: Missing try-catch in POST /api/pages

**File:** `src/app/api/pages/route.ts:39-92`

**Problem:** Prisma エラーがスタックトレース付きで返る

**Impact:** 🟡 Information disclosure, poor UX

**Fix:**
```typescript
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { sections, headerConfig, ...rest } = body;

        // ... existing logging ...

        const page = await prisma.page.create({
            data: {
                userId: user.id,
                title: rest.title || 'New Page ' + new Date().toLocaleDateString(),
                slug: rest.slug || 'page-' + Date.now(),
                status: 'draft',
                headerConfig: headerConfig ? JSON.stringify(headerConfig) : '{}',
                formConfig: '{}',
                sections: {
                    create: sections.map((sec: any, index: number) => ({
                        role: sec.role || 'other',
                        order: index,
                        imageId: sec.imageId || null,
                        mobileImageId: sec.mobileImageId || null,
                        config: sec.config ? JSON.stringify(sec.config) : null,
                        boundaryOffsetTop: sec.boundaryOffsetTop || 0,
                        boundaryOffsetBottom: sec.boundaryOffsetBottom || 0,
                    })),
                },
            },
        });

        log.success(`Page created with ID: ${page.id}`);
        log.info(`========== Page Creation Complete ==========`);

        return NextResponse.json(page);
    } catch (error: any) {
        console.error('Failed to create page:', error);
        return NextResponse.json(
            { error: 'Failed to create page' },
            { status: 500 }
        );
    }
}
```

**Status:** ⚠️ NOT FIXED (要修正)

---

### P1-2: .env.example Missing

**Problem:** 新規開発者が必要な環境変数を知らない

**Impact:** 🟡 Poor onboarding, deployment errors

**Fix:** Create `.env.example`:

```bash
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

# Logging (Optional)
LOG_LEVEL="info"  # debug | info | warn | error

# Monitoring (Optional)
NEXT_PUBLIC_SENTRY_DSN=""
SENTRY_AUTH_TOKEN=""
```

**Status:** ⚠️ NOT FIXED (要修正)

---

### P1-3: API Key Encryption Verification

**File:** `src/lib/apiKeys.ts:36-39`

**Problem:** 不明：APIキーが暗号化されて保存/復号化されているか？

**Current Code:**
```typescript
if (userSettings?.googleApiKey) {
    return {
        apiKey: userSettings.googleApiKey,  // ← Encrypted or plain?
        isUserOwnKey: true
    };
}
```

**Required Investigation:**
1. `UserSettings.googleApiKey`保存時に暗号化されている？
2. 取得時に復号化が必要？

**Expected Fix (if not encrypted):**
```typescript
import { decrypt } from '@/lib/encryption';

if (userSettings?.googleApiKey) {
    return {
        apiKey: decrypt(userSettings.googleApiKey),  // Decrypt!
        isUserOwnKey: true
    };
}
```

**Status:** ⚠️ NEEDS VERIFICATION (コード調査必要)

---

### P1-4: Structured Logging Missing

**Problem:** 217箇所の`console.log`、検索困難、ユーザーID紐付けなし

**Impact:** 🟡 本番デバッグ困難、監視不可

**Fix:** Install `pino`:
```bash
npm install pino pino-pretty
```

**Create `src/lib/logger.ts`:**
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  }),
});

// Convenience exports
export const log = {
  info: (data: object, msg: string) => logger.info(data, msg),
  error: (data: object, msg: string) => logger.error(data, msg),
  warn: (data: object, msg: string) => logger.warn(data, msg),
  debug: (data: object, msg: string) => logger.debug(data, msg),
};
```

**Migration Example:**
```typescript
// Before
console.error('Failed to fetch users:', error);

// After
import { log } from '@/lib/logger';
log.error({ error: error.message, stack: error.stack }, 'Failed to fetch users');
```

**Status:** ⚠️ NOT FIXED (大規模変更、段階的移行推奨)

---

### P1-5: Test Files Missing (0 tests)

**Problem:** テストなし → リグレッション検出不可

**Impact:** 🟡 品質保証なし、リファクタリングリスク高

**Fix:** Setup Jest + 最小限のテスト

**Step 1: Install dependencies**
```bash
npm install --save-dev jest @types/jest ts-jest jest-environment-node
```

**Step 2: Create `jest.config.js`**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    '!src/lib/**/*.d.ts',
  ],
};
```

**Step 3: Add test script to `package.json`**
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**Step 4: Create critical tests**

`src/lib/__tests__/credits.test.ts`:
```typescript
import { checkCreditBalance } from '../credits';
import { prisma } from '../db';

// Mock Prisma
jest.mock('../db', () => ({
  prisma: {
    creditBalance: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Credit System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('checkCreditBalance rejects insufficient balance', async () => {
    (prisma.creditBalance.findUnique as jest.Mock).mockResolvedValue({
      userId: 'test-user',
      balanceUsd: 1.0,
    });

    const result = await checkCreditBalance('test-user', 5.0);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('不足');
  });

  test('checkCreditBalance allows sufficient balance', async () => {
    (prisma.creditBalance.findUnique as jest.Mock).mockResolvedValue({
      userId: 'test-user',
      balanceUsd: 10.0,
    });

    const result = await checkCreditBalance('test-user', 5.0);

    expect(result.allowed).toBe(true);
  });
});
```

**Status:** ⚠️ NOT FIXED (2-3日の工数必要)

---

## P2 - Medium (運用改善推奨)

### P2-1: Composite Indexes Missing

**File:** `prisma/schema.prisma`

**Problem:** Stats queriesでN+1的な非効率

**Impact:** 🟡 1000+ generation runsで遅延

**Fix:**
```prisma
model GenerationRun {
  // ... existing fields

  @@index([userId])
  @@index([createdAt])
  @@index([type])
  @@index([userId, createdAt])  // ADD
  @@index([userId, status])     // ADD
}

model CreditTransaction {
  // ... existing fields

  @@index([userId])
  @@index([createdAt])
  @@index([type])
  @@index([userId, type, createdAt])  // ADD
}
```

**Migration:**
```bash
npx prisma migrate dev --name add_composite_indexes
```

**Status:** ⚠️ NOT FIXED (5分で完了)

---

### P2-2: Negative Balance Possible (Race Condition)

**File:** `src/lib/credits.ts:87-123`

**Problem:** 並行操作時に残高がマイナスになる可能性

**Impact:** 🟡 小額（単一操作分）のマイナス、自己修復

**Fix:** Add pessimistic locking:
```typescript
export async function consumeCredit(
  userId: string,
  costUsd: number,
  generationRunId: number,
  details: { model: string; inputTokens?: number; outputTokens?: number; imageCount?: number; }
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Lock the balance row (SELECT FOR UPDATE)
    const balance = await tx.$queryRaw<{ balanceUsd: number }[]>`
      SELECT "balanceUsd" FROM "CreditBalance"
      WHERE "userId" = ${userId}
      FOR UPDATE
    `;

    if (!balance[0] || balance[0].balanceUsd < costUsd) {
      throw new Error('Insufficient balance');
    }

    // Decrement balance
    const updatedBalance = await tx.creditBalance.update({
      where: { userId },
      data: { balanceUsd: { decrement: costUsd } },
    });

    // Record transaction
    await tx.creditTransaction.create({
      data: {
        userId,
        type: 'api_usage',
        amountUsd: new Decimal(-costUsd),
        balanceAfter: updatedBalance.balanceUsd,
        description: `API使用: ${details.model}`,
        generationRunId,
        model: details.model,
        inputTokens: details.inputTokens,
        outputTokens: details.outputTokens,
        imageCount: details.imageCount,
      },
    });
  });
}
```

**Status:** ⚠️ NOT FIXED (30分の工数)

---

### P2-3: getUserUsage N+1 Pattern

**File:** `src/lib/usage.ts:47-85`

**Problem:** Admin users listで N × 3 count queries

**Impact:** 🟡 100+ usersで遅延

**Fix:** Batch aggregation (大規模リファクタ)
```typescript
export async function getBatchUserUsage(userIds: string[]): Promise<Map<string, UsageStats>> {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [generations, uploads, pages] = await Promise.all([
    prisma.generationRun.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        createdAt: { gte: startOfMonth },
        status: 'succeeded',
      },
      _count: true,
    }),
    prisma.mediaImage.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        createdAt: { gte: startOfMonth },
        sourceType: 'upload',
      },
      _count: true,
    }),
    prisma.page.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _count: true,
    }),
  ]);

  const usageMap = new Map<string, UsageStats>();

  userIds.forEach(userId => {
    const genCount = generations.find(g => g.userId === userId)?._count || 0;
    const uploadCount = uploads.find(u => u.userId === userId)?._count || 0;
    const pageCount = pages.find(p => p.userId === userId)?._count || 0;

    usageMap.set(userId, {
      monthlyGenerations: genCount,
      monthlyUploads: uploadCount,
      totalPages: pageCount,
      totalStorageMB: Math.round((genCount + uploadCount) * 0.5),
    });
  });

  return usageMap;
}
```

**Status:** ⚠️ NOT FIXED (1時間の工数、100+ users時に実施)

---

### P2-4: Health Check Endpoint Missing

**Impact:** 🟡 Uptime監視不可

**Fix:** Create `src/app/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
```

**Status:** ⚠️ NOT FIXED (5分で完了)

---

### P2-5: Migration Rollback Procedures Undocumented

**Impact:** 🟡 本番インシデント時の復旧手順なし

**Fix:** Create rollback SQLs

`prisma/migrations/20250124_add_resend_settings/ROLLBACK.sql`:
```sql
-- ⚠️ WARNING: This will delete user data in these columns
-- Always backup before rollback!

ALTER TABLE "UserSettings" DROP COLUMN "resendApiKey";
ALTER TABLE "UserSettings" DROP COLUMN "notificationEmail";
ALTER TABLE "UserSettings" DROP COLUMN "resendFromDomain";
```

**Status:** ⚠️ NOT FIXED (各migrationに追加)

---

### P2-6: Lint Warnings (~30件)

**Impact:** 🟡 Code quality

**Categories:**
- Unused variables
- Explicit `any` types
- Missing alt props

**Fix:** Incrementally fix warnings:
```bash
npm run lint -- --fix
```

**Status:** ⚠️ NOT FIXED (段階的に修正)

---

### P2-7: APM/Monitoring Tool Missing

**Impact:** 🟡 パフォーマンス問題の検出不可

**Recommendation:** Sentry導入
```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

**Status:** ⚠️ NOT FIXED (1-2時間、ユーザー100+時に実施)

---

### P2-8: README/Documentation Incomplete

**Impact:** 🟡 Onboarding困難

**Fix:** Create comprehensive README (see Task #6)

**Status:** ⚠️ NOT FIXED (1時間)

---

## P3 - Low (Nice to Have)

### P3-1: No Database Enums

**Current:** String fields with app-level validation

**Fix:** Convert to Postgres enums (将来)
```prisma
enum UserRole {
  user
  admin
}

model UserSettings {
  role UserRole @default(user)
}
```

**Status:** Future enhancement

---

### P3-2: AI Provider Abstraction Layer

**Current:** Gemini SDK直接使用

**Fix:** Provider interface (see Task #6)

**Status:** Future enhancement

---

### P3-3: Permission Helper Functions

**Current:** 各APIでindividualにチェック

**Fix:** `requireAdmin()`, `requirePermission()` (see Task #6)

**Status:** Future enhancement

---

## 修正優先順位まとめ

### 即時修正 (P0)
1. ENCRYPTION_KEY fallback削除 (5分)

### 本番前に修正 (P1)
1. POST /api/pages try-catch追加 (5分)
2. .env.example作成 (10分)
3. APIキー暗号化確認 (30分)
4. Structured logging導入 (1日、段階的)
5. 最小限のテスト追加 (2-3日)

### 運用改善 (P2)
1. Composite indexes追加 (5分) ← **すぐできる**
2. Health check endpoint (5分) ← **すぐできる**
3. Negative balance fix (30分)
4. Migration rollback docs (30分)
5. README整備 (1時間)
6. Lint warnings fix (段階的)
7. getUserUsage N+1 fix (1時間、100+ users時)
8. APM導入 (1-2時間、100+ users時)

### 将来の改善 (P3)
- DB enums化
- AI provider抽象化
- Permission helpers

**Total P0-P1 Effort:** ~4-5日
**Immediate fixes (P0 + simple P1):** ~1時間

