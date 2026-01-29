# APIフロー表（ページ別）

## 1. ログイン/登録ページ `/`

### 主要操作
| 操作 | API/クエリ | テーブル/カラム | 認可 | レスポンス |
|------|-----------|----------------|------|-----------|
| ログイン | supabase.auth.signInWithPassword | Supabase Auth | なし（認証前） | session/error |
| 新規登録 | POST /api/auth/verify-invite | GlobalConfig (INVITE_PASSWORD env) | なし | {valid:bool} |
| 新規登録 | supabase.auth.signUp | Supabase Auth | 招待パスワード検証後 | user/session |
| メール確認 | /auth/callback | Supabase Auth | メールリンク | リダイレクト |

### ミドルウェア検証
- 認証後 → UserSettings.isApproved/isBannedをチェック
- isBanned=true → /banned へリダイレクト
- isApproved=false → /pending-approval へリダイレクト
- isApproved=true → /admin へリダイレクト

---

## 2. 管理ホーム `/admin`

### 主要操作
| 操作 | API/クエリ | テーブル/カラム | 認可 | レスポンス |
|------|-----------|----------------|------|-----------|
| リダイレクト | なし | なし | middleware | /admin/pages へ自動リダイレクト |

---

## 3. ページ一覧 `/admin/pages`

### 主要操作
| 操作 | API/クエリ | テーブル/カラム | 認可 | レスポンス |
|------|-----------|----------------|------|-----------|
| 表示 | prisma.page.findMany | Page (where: userId) | middleware + userId | PageListItem[] |
| 削除 | DELETE /api/pages/[id] | Page, PageSection (cascade) | authenticateAndAuthorize | {success:bool} |
| 公開 | PATCH /api/pages/[id] | Page.status | authenticateAndAuthorize | {success, page} |
| お気に入り | PATCH /api/pages/[id] | Page.isFavorite | authenticateAndAuthorize | {success, page} |

### Prismaクエリ
```sql
SELECT * FROM "Page" WHERE "userId" = $1
ORDER BY "isFavorite" DESC, "updatedAt" DESC
```

---

## 4. ページ編集 `/admin/pages/[id]`

### 主要操作
| 操作 | API/クエリ | テーブル/カラム | 認可 | レスポンス |
|------|-----------|----------------|------|-----------|
| 取得 | GET /api/pages/[id] | Page, PageSection, MediaImage | userId所有者チェック | PageData |
| 更新 | PUT /api/pages/[id] | Page, PageSection | userId所有者チェック | {success, sections} |
| セクション画像更新 | POST /api/sections/[id]/regenerate | PageSection, MediaImage | セクション所有ページのuserId | 新画像データ |

---

## 5. LPビルダー `/admin/lp-builder`

### 主要操作
| 操作 | API/クエリ | テーブル/カラム | 認可 | レスポンス |
|------|-----------|----------------|------|-----------|
| ページ一覧取得 | GET /api/lp-builder | Page (where: userId) | supabase.auth | {pages} |
| 保存 | POST /api/lp-builder | Page, PageSection | supabase.auth | {success, pageId} |
| AI生成（参考サイト） | POST /api/screenshot/dual | 外部API | supabase.auth | スクリーンショットデータ |
| AI生成（テキスト） | POST /api/lp-builder/generate | Page, PageSection, MediaImage | supabase.auth + クレジット | 生成結果 |
| SEO最適化 | POST /api/ai/seo-llmo-optimize | Page.seoData | supabase.auth | SEOデータ |

---

## 6. ユーザー管理 `/admin/users` (Admin専用)

### 主要操作
| 操作 | API/クエリ | テーブル/カラム | 認可 | レスポンス |
|------|-----------|----------------|------|-----------|
| 一覧取得 | GET /api/admin/users | Supabase Auth + UserSettings | isAdmin(userId) | User[] |
| 承認/却下 | POST /api/admin/users | UserSettings.isApproved | isAdmin | {success} |
| プラン変更 | PATCH /api/admin/users | UserSettings.plan | isAdmin | {success} |
| BAN/解除 | PUT /api/admin/users | UserSettings.isBanned | isAdmin | {success} |
| クレジット付与 | POST /api/admin/credits | CreditBalance, CreditTransaction | isAdmin | {success} |

### 認可フロー
```
Request → supabase.auth.getUser() → isAdmin(userId) → Prisma Query
```

---

## 7. 設定 `/admin/settings`

### 主要操作
| 操作 | API/クエリ | テーブル/カラム | 認可 | レスポンス |
|------|-----------|----------------|------|-----------|
| 取得 | GET /api/user/settings | UserSettings | supabase.auth | UserSettings |
| 更新 | POST /api/user/settings | UserSettings | supabase.auth + upsert | {success} |
| ログアウト | POST /api/auth/logout | Supabase Auth | supabase.auth | リダイレクト |

---

## 8. API使用量 `/admin/api-usage`

### 主要操作
| 操作 | API/クエリ | テーブル/カラム | 認可 | レスポンス |
|------|-----------|----------------|------|-----------|
| 使用量取得 | GET /api/user/usage | GenerationRun, MediaImage, Page | supabase.auth | UsageStats |
| クレジット残高 | GET /api/user/credits | CreditBalance | supabase.auth | {balanceUsd} |

---

## 9. メディアライブラリ `/admin/media`

### 主要操作
| 操作 | API/クエリ | テーブル/カラム | 認可 | レスポンス |
|------|-----------|----------------|------|-----------|
| 一覧取得 | GET /api/media | MediaImage (where: userId) | supabase.auth | MediaImage[] |
| アップロード | POST /api/upload | MediaImage, Supabase Storage | supabase.auth | {filePath, id} |
| 動画アップロード | POST /api/upload/video | MediaVideo, Supabase Storage | supabase.auth | {filePath, id} |

---

## 10. 待機室管理 `/admin/waitingroom` (Admin専用)

### 主要操作
| 操作 | API/クエリ | テーブル/カラム | 認可 | レスポンス |
|------|-----------|----------------|------|-----------|
| 一覧取得 | GET /api/admin/waitingroom | WaitingRoomEntry, WaitingRoomReply | isAdmin | Entry[] |
| ステータス更新 | POST /api/admin/waitingroom | WaitingRoomEntry | isAdmin | {success} |
| 返信 | POST /api/admin/waitingroom | WaitingRoomReply | isAdmin | {success} |

---

## 11. 公開LP `/p/[slug]`

### 主要操作
| 操作 | API/クエリ | テーブル/カラム | 認可 | レスポンス |
|------|-----------|----------------|------|-----------|
| 表示 | prisma.page.findFirst | Page, PageSection, MediaImage | なし（公開） | HTMLレンダリング |
| メタデータ生成 | prisma.page.findUnique | Page.seoData | なし | Metadata |
| フォーム送信 | POST /api/form-submissions | FormSubmission | なし（公開フォーム） | {success} |

### 注意点
- 公開ページはRLSなしでDBに直接アクセス
- slug または id でクエリ可能（レガシー対応）

---

## 12. 待機室申込 `/waitingroom`

### 主要操作
| 操作 | API/クエリ | テーブル/カラム | 認可 | レスポンス |
|------|-----------|----------------|------|-----------|
| 申込送信 | POST /api/waitingroom | WaitingRoomEntry | なし（公開フォーム） | {success, entryId} |

---

## 13. プレビュー `/preview/lp-builder`

### 主要操作
| 操作 | API/クエリ | テーブル/カラム | 認可 | レスポンス |
|------|-----------|----------------|------|-----------|
| 表示 | なし（localStorage） | なし | なし | HTMLレンダリング |

---

## 14. ページプレビュー `/preview/page/[id]`

### 主要操作
| 操作 | API/クエリ | テーブル/カラム | 認可 | レスポンス |
|------|-----------|----------------|------|-----------|
| 表示 | prisma.page.findUnique | Page, PageSection, MediaImage | なし（プレビュー用） | HTMLレンダリング |

### 注意点
- プレビューなので認可なし（URLを知っていれば閲覧可能）
- 本番では認可追加検討

---

## RLS/認可パターンまとめ

### パターン1: Supabase Auth + userId フィルタ
```typescript
const { data: { user } } = await supabase.auth.getUser();
await prisma.page.findMany({ where: { userId: user.id } });
```
適用: /api/pages, /api/lp-builder, /api/media

### パターン2: Supabase Auth + 所有者確認
```typescript
const page = await prisma.page.findUnique({ where: { id } });
if (page.userId !== user.id) return 403;
```
適用: /api/pages/[id], /api/sections/[id]/*

### パターン3: Admin専用
```typescript
const settings = await prisma.userSettings.findUnique({ where: { userId } });
if (settings?.role !== 'admin') return 403;
```
適用: /api/admin/*

### パターン4: 公開（認可なし）
適用: /p/[slug], /api/waitingroom (POST), /api/form-submissions

