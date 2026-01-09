# Render デプロイ設定ガイド

このプロジェクトを [Render](https://render.com) にデプロイするための設定詳細です。

## 1. Web Service 設定

Render ダッシュボードで **New Web Service** を作成し、以下の設定を行ってください。

| 項目 | 設定値 |
|------|--------|
| **Runtime** | `Node` |
| **Build Command** | `npm install && npx prisma generate && npm run build` |
| **Start Command** | `npm run start` |

> **重要**: `npx prisma generate` が Build Command に含まれていることを確認してください。これがないとデータベースクライアントが生成されません。

## 2. 環境変数 (Environment Variables)

Render の Environment タブで以下の変数を設定してください。

### 必須変数

| 変数名 (Key) | 説明 / 設定値の例 |
|--------------|-------------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase "Transaction Pooler" 接続文字列 (ポート 6543) |
| `DIRECT_URL` | Supabase "Session" 接続文字列 (ポート 5432) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL (`https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Project API Key (`anon` / `public`) |
| `SUPABASE_URL` | Supabase Project URL (サーバーサイド用、`NEXT_PUBLIC_SUPABASE_URL`と同じ) |
| `SUPABASE_ANON_KEY` | Supabase API Key (サーバーサイド用、`NEXT_PUBLIC_SUPABASE_ANON_KEY`と同じ) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (`service_role`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio (Gemini) API Key |
| `GOOGLE_API_KEY` | Google API Key (`GOOGLE_GENERATIVE_AI_API_KEY`と同じ値) |
| `NEXT_PUBLIC_BASE_URL` | デプロイ後のURL (例: `https://your-app.onrender.com`) |

### 補足
- `DATABASE_URL` と `DIRECT_URL` は Supabase ダッシュボードの `Project Settings > Database > Connection pooler` で確認できます。
- **重要**: `DATABASE_URL`には`?pgbouncer=true`パラメータを付けてください（PgBouncer接続プーリング用）

## 3. Supabase Auth 設定

### 3.1 Authentication設定 (Supabase Dashboard)

1. **Supabase Dashboard > Authentication > Providers** で Email を有効化
2. **URL Configuration** (Authentication > URL Configuration):
   - Site URL: `https://your-app.onrender.com`
   - Redirect URLs: `https://your-app.onrender.com/auth/callback`

### 3.2 メール送信設定

本番環境では **Custom SMTP** の設定を推奨します:
1. **Authentication > Settings > SMTP Settings**
2. SendGrid, Mailgun, AWS SES などのSMTPプロバイダ情報を入力
3. 確認メール、パスワードリセットメールに使用されます

### 3.3 RLS (Row Level Security)

すべてのテーブルでRLSが有効になっていることを確認してください:
- `Page`: ユーザーは自分のページのみアクセス可能
- `MediaImage`: ユーザーは自分の画像のみアクセス可能
- その他のテーブルも同様

## 4. スケーラビリティ設定

多ユーザー対応のための設定ポイントです。

### 4.1 Supabase側

| 項目 | 推奨設定 |
|------|----------|
| **接続プーリング** | `DATABASE_URL`にTransaction Pooler (ポート6543)を使用 |
| **最大接続数** | Supabase Proプランで60〜100接続まで対応可能 |
| **ストレージバケット** | RLSを有効化、適切なポリシー設定 |

### 4.2 Render側

| 項目 | 推奨設定 |
|------|----------|
| **インスタンスタイプ** | 負荷に応じてスケールアップ (Standard以上推奨) |
| **Auto Deploy** | メインブランチへのプッシュで自動デプロイ |
| **Health Check Path** | `/api/health` (ある場合) |

### 4.3 パフォーマンス最適化

```prisma
// prisma/schema.prismaに追加推奨
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

## 5. トラブルシューティング

### 5.1 401 Unauthorized エラー

- Supabase環境変数が正しく設定されているか確認
- `NEXT_PUBLIC_SUPABASE_URL`と`NEXT_PUBLIC_SUPABASE_ANON_KEY`は必須
- ブラウザのCookieが有効になっているか確認

### 5.2 データベース接続エラー

- `DATABASE_URL`にTransaction Pooler URL (ポート6543)を使用
- `?pgbouncer=true`パラメータが含まれているか確認
- Supabaseのダッシュボードで接続数を確認

### 5.3 画像アップロードエラー

- `SUPABASE_SERVICE_ROLE_KEY`が正しいか確認
- Supabase Storage bucketの設定を確認
- RLSポリシーを確認

## 6. Render.yaml 自動検知について

リポジトリ直下に `render.yaml` が含まれているため、Render が自動的に Blueprint として検出する場合があります。Blueprint を使用しても問題ありませんが、環境変数のキー名は上記と一致しているか確認してください。
