# Deployment Guide - Render & GitHub Actions

Renderへの自動デプロイ設定ガイド

## 📋 目次

1. [Renderの初期設定](#renderの初期設定)
2. [GitHub Actionsの設定](#github-actionsの設定)
3. [手動デプロイ方法](#手動デプロイ方法)
4. [トラブルシューティング](#トラブルシューティング)

---

## 🚀 Renderの初期設定

⚠️ **重要**: 初回デプロイは必ずRender Dashboard（GUI）から手動で行います。GitHub Actionsや自動デプロイは、初回セットアップ完了後に有効化します。

### 1. Renderアカウント作成

1. [Render.com](https://render.com) でアカウント作成
2. GitHubアカウントと連携

### 2. 新規Webサービス作成（初回は必ずGUIから）

#### ダッシュボードから:
1. **New +** → **Web Service** をクリック
2. GitHubリポジトリ `kazujp225/wordpressdemo` を選択
3. 以下の設定を入力:

```yaml
Name: lp-builder (または任意の名前)
Region: Singapore (推奨) または Tokyo
Branch: main
Runtime: Node
Build Command: npm install && npx prisma generate && npm run build
Start Command: npm run start
Plan: Free (または Starter)
```

### 3. 環境変数の設定（Render Dashboard GUIで設定）

サービス作成後、**Render Dashboard → あなたのサービス → Environment** タブで以下を**手動で**設定します:

⚠️ **注意**: これらはアプリケーションが実行時に使用する環境変数です。GitHub ActionsやデプロイAPIとは無関係です。

#### 必須の環境変数

```bash
# Node環境
NODE_ENV=production

# データベース (Supabase Postgres)
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
DIRECT_URL=postgresql://postgres:[password]@[host]:5432/postgres

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Gemini API
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key

# Anthropic Claude API
ANTHROPIC_API_KEY=your_anthropic_api_key

# アプリURL
NEXT_PUBLIC_APP_URL=https://your-app.onrender.com
NEXT_PUBLIC_BASE_URL=https://your-app.onrender.com

# 認証
INVITE_PASSWORD=your_secure_password

# セキュリティ（必須）
ENCRYPTION_KEY=your_64_char_hex_string
```

#### ENCRYPTION_KEYの生成方法

```bash
openssl rand -hex 32
```

このコマンドで生成された64文字の文字列を `ENCRYPTION_KEY` に設定してください。これはAPIキーの暗号化に使用される重要な値です。

### 4. 初回デプロイの実行

環境変数を全て設定したら、Render Dashboardから **Manual Deploy** → **Deploy latest commit** をクリックして初回デプロイを実行します。

✅ デプロイが成功したら、アプリが正常に起動することを確認してください。

### 5. Service IDの取得（GitHub Actions用）

初回デプロイ成功後、GitHub Actionsを設定する場合は Service ID を取得します：

1. Render Dashboard でサービスを開く
2. ブラウザのURLバーを確認: `https://dashboard.render.com/web/srv-xxxxxxxxx`
3. `srv-xxxxxxxxx` 部分が **Service ID** です
4. この値を後でGitHub Secretsに設定します

### 6. 自動デプロイ設定（オプション）

Render標準の自動デプロイを有効化する場合（GitHub Actions不要）:

Render Dashboard → Settings → Build & Deploy:

- **Auto-Deploy**: `Yes`
- **Branch**: `main`

これで `main` ブランチへのpush時に自動デプロイされます。

⚠️ **注意**: Render Auto-DeployとGitHub Actionsの両方を有効にすると二重デプロイになります。どちらか一方のみを使用してください。

---

## 🤖 GitHub Actionsの設定（上級者向け）

⚠️ **前提条件**: Renderでの初回セットアップ（上記）が完了していること

より高度な制御（ビルド検証など）が必要な場合、GitHub Actionsを使用します。

### 1. Render API Keyの取得

GitHub ActionsからRenderにデプロイをトリガーするため、API Keyが必要です：

1. Render Dashboard → **Account Settings** → **API Keys**
2. **Create API Key** をクリック
3. 名前を入力（例: `GitHub Actions Deploy`）
4. 生成されたキーをコピー（`rnd_` で始まる文字列）
5. ⚠️ このキーは一度しか表示されないので安全に保管

### 2. GitHub Secretsの設定

1. GitHubリポジトリ → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** で以下を追加:

| Secret名 | 説明 | 取得方法 |
|---------|------|---------|
| `RENDER_API_KEY` | Render APIキー | 上記手順で取得 |
| `RENDER_SERVICE_ID` | サービスID | RenderのサービスURLから取得（`srv-xxx`） |
| `DATABASE_URL` | Supabase接続文字列 | Supabaseダッシュボードから |
| `DIRECT_URL` | Supabase直接接続 | Supabaseダッシュボードから |
| `NEXT_PUBLIC_APP_URL` | アプリURL | `https://your-app.onrender.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | Supabaseダッシュボードから |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | Supabaseダッシュボードから |

⚠️ **注意**: これらの値はRenderの環境変数と同じ値を設定してください（ビルド検証のため）。

### 3. Render Auto-Deployの無効化

GitHub Actionsを使う場合、二重デプロイを防ぐためRender側の自動デプロイを無効化：

Render Dashboard → Settings → Build & Deploy:
- **Auto-Deploy**: `No`

### 4. GitHub Actionsワークフローの有効化

ワークフローファイルは既に作成済み: `.github/workflows/deploy-to-render.yml`

**自動トリガー:**
- `main` ブランチへのpushで自動実行

**手動トリガー:**
1. GitHub → Actions タブ
2. "Deploy to Render" を選択
3. "Run workflow" をクリック

### 5. デプロイフロー

設定完了後、以下のフローで自動デプロイされます：

```
git push origin main
    ↓
GitHub Actions実行
    ↓
ビルド検証 (npm ci, prisma generate, npm run build)
    ↓
✅ ビルド成功 → Render API呼び出し
    ↓
Renderでデプロイ開始
    ↓
完了通知
```

❌ ビルドが失敗した場合、Renderへのデプロイはトリガーされません。

---

## 🛠️ 手動デプロイ方法（緊急時・テスト用）

⚠️ **前提条件**: Renderでサービスが既に作成されていること

### ローカルからの手動デプロイ

#### 環境変数を設定
```bash
export RENDER_API_KEY=your_api_key
export RENDER_SERVICE_ID=srv-xxxxxxxxx
```

#### デプロイコマンド
```bash
npm run deploy:render
```

#### 出力例
```
🚀 Triggering deployment to Render...
   Service ID: srv-xxxxxxxxx

📊 Fetching service information...
   Name: lp-builder
   Type: web
   Region: singapore
   Branch: main

✅ Deployment triggered successfully!
   Deploy ID: dep-xxxxxxxxx
   Service: lp-builder
   Status: pending

🔗 View deployment: https://dashboard.render.com/web/srv-xxxxxxxxx
```

### Render Dashboardからの手動デプロイ

1. Render Dashboard → サービス選択
2. **Manual Deploy** → **Deploy latest commit**
3. デプロイログをリアルタイムで確認

---

## 🐛 トラブルシューティング

### デプロイが失敗する

#### 1. ビルドエラー
```bash
# ローカルでビルドをテスト
npm ci
npx prisma generate
npm run build
```

エラーが出る場合:
- `prisma/schema.prisma` の確認
- 環境変数の確認
- `package.json` の依存関係を確認

#### 2. データベース接続エラー
```
Error: Can't reach database server
```

対処法:
- `DATABASE_URL` と `DIRECT_URL` が正しいか確認
- Supabaseのデータベースが起動しているか確認
- Renderの IP アドレスがSupabase側で許可されているか確認

#### 3. API Key エラー
```
Error: GOOGLE_GENERATIVE_AI_API_KEY not configured
```

対処法:
- Render Dashboard → Environment で環境変数を確認
- 値にスペースや改行が入っていないか確認
- API Keyが有効か確認

### GitHub Actionsが失敗する

#### Secretsの確認
```bash
# GitHub Secrets が正しく設定されているか確認
cat .github/workflows/deploy-to-render.yml
```

以下のSecretsが必要:
- `RENDER_API_KEY`
- `RENDER_SERVICE_ID`
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### ワークフローログの確認
1. GitHub → Actions タブ
2. 失敗したワークフローをクリック
3. エラーメッセージを確認

### デプロイは成功するがアプリが動かない

#### ヘルスチェック失敗
```
Service health check failed
```

対処法:
1. Renderの Logs タブでエラーを確認
2. `healthCheckPath: /` が正常に応答するか確認
3. `npm run start` がローカルで動作するか確認

#### ランタイムエラー
```bash
# Renderのログを確認
# Render Dashboard → Logs タブ
```

よくある原因:
- 環境変数の不足
- データベース接続の問題
- 外部APIの認証エラー

---

## 📊 デプロイ方式の比較

| 方式 | 自動化 | ビルド検証 | 初回セットアップ | 使用ケース |
|------|--------|------------|------------------|------------|
| **初回デプロイ（GUI）** | ❌ 手動 | ❌ なし | 必須 | 新規ユーザー・サービス作成時 |
| **Render Auto-Deploy** | ✅ 完全自動 | ❌ なし | 初回後 | 本番環境・最もシンプル |
| **GitHub Actions** | ✅ 完全自動 | ✅ あり | 初回後 | 品質管理が必要な場合 |
| **手動CLIデプロイ** | ❌ 手動 | ❌ なし | 初回後 | 緊急時・テスト環境 |

### 推奨構成

**新規プロジェクト:**
1. 初回: Render GUI で手動デプロイ（環境変数設定）
2. 以降: Render Auto-Deploy または GitHub Actions

**本番環境:**
- GitHub Actions（ビルド検証 + 自動デプロイ）
- Render Auto-Deployは無効化

**開発環境:**
- develop ブランチで Render Auto-Deploy
- または手動CLIデプロイ

---

## 🔒 セキュリティのベストプラクティス

1. **API Keyの管理**
   - 絶対にコードにハードコードしない
   - 環境変数またはSecrets Managerを使用
   - 定期的にローテーション

2. **Render API Key**
   - Read/Write権限を最小限に
   - チームメンバーごとに個別のKeyを発行

3. **環境変数**
   - 本番とステージングで異なる値を使用
   - `.env` ファイルは `.gitignore` に追加

4. **GitHub Secrets**
   - Organization Secretsの利用を検討
   - 不要なSecretは削除

---

## 🎯 まとめ

### 初回セットアップの正しい手順（新規ユーザー向け）

#### Step 1: Renderで初回デプロイ（GUI必須）
1. ✅ Render.comでアカウント作成
2. ✅ GitHubリポジトリを連携
3. ✅ New Web Service → リポジトリ選択
4. ✅ **環境変数を全てGUIで手動設定**（DATABASE_URL、ENCRYPTION_KEY等）
5. ✅ **Manual Deploy** で初回デプロイ実行
6. ✅ アプリが正常起動することを確認

#### Step 2: 自動デプロイの設定（どちらか選択）

**オプションA: Render Auto-Deploy（シンプル）**
1. ✅ Render Dashboard → Settings → Auto-Deploy: `Yes`
2. ✅ 完了！以降 `git push` で自動デプロイ

**オプションB: GitHub Actions（ビルド検証付き）**
1. ✅ Render API Keyを取得
2. ✅ Service IDを取得（サービスURLから）
3. ✅ GitHub Secretsに設定（RENDER_API_KEY、RENDER_SERVICE_ID等）
4. ✅ Render Auto-Deployを無効化（二重デプロイ防止）
5. ✅ 完了！以降 `git push` で自動デプロイ（ビルド検証→Renderトリガー）

### よくある誤解

❌ **間違い**: 最初からGitHub Actionsで全自動デプロイできる
✅ **正解**: 初回は必ずRender GUIで手動セットアップが必要

❌ **間違い**: RENDER_API_KEYをRenderの環境変数に設定
✅ **正解**: RENDER_API_KEYはGitHub Secretsに設定（デプロイをトリガーする側）

❌ **間違い**: render.yamlがあれば環境変数は不要
✅ **正解**: render.yamlは環境変数の**キー名のリスト**のみ。値はGUIで手動設定が必要

### サポート

問題が解決しない場合:
- [Render Docs](https://render.com/docs)
- [GitHub Actions Docs](https://docs.github.com/actions)
- プロジェクトのREADME.mdを参照
