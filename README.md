# LP Automatic Builder

AI駆動のランディングページ自動生成ツール。Next.js 14、Tailwind CSS、Supabase、Google Gemini AIを活用した、プロフェッショナルなLP制作プラットフォームです。

## 主な機能

### 🚀 AI LP自動生成

#### **画像ベース作成モード**
- **デザインリファレンス機能**: 参照画像をアップロードすると、そのデザインスタイル（色、雰囲気、レイアウト）を解析して反映
- **v3画像生成技術**: Style Anchor + Seam Reference方式で、セクション間の視覚的な連続性を実現
- **セクション別最適化**: Hero、Features、Pricing、Testimonials、FAQ、CTAなど各セクションに最適な画像を自動生成

#### **テキストベース作成モード** ⚡NEW
- **6ステップの詳細フォーム**: ビジネス情報、商品詳細、ターゲット、価値提案、コンバージョン目標、デザイン設定
- **AI提案機能**: メリット、USP、社会的証明、保証内容をAIが自動提案
- **具体的なプロンプト生成**: フォーム入力から詳細なコンテキストを構築し、高品質な画像・テキストを生成
- **15項目のフィールド活用**:
  - 商品・サービス情報（名称、説明、カテゴリ、価格、提供方法）
  - ターゲット情報（年齢、性別、職業、収入層、課題、理想状態）
  - 訴求内容（メリット、USP、実績、保証）
  - デザイン（トーン、色、画像スタイル）
  - CTA（目標、テキスト、緊急性要素）

#### **複数のトーン対応**
Professional、Friendly、Luxury、Energetic、Minimal、Playful など

### 🎨 AI画像編集機能

- **インペインティング（部分編集）**: 画像の一部を選択してAIで編集・修正
- **複数領域同時選択**: 複数箇所を一度に編集可能
- **編集履歴**: 過去の編集履歴を参照・復元

### 🖱️ クリッカブルエリア設定

- **画像上ボタン配置**: 画像の任意の位置にクリッカブルなボタンを設置
- **複数アクションタイプ対応**:
  - URLリンク
  - メールアドレス (mailto:)
  - 電話番号 (tel:)
  - セクションスクロール
  - **フォーム入力モーダル**: 画像上に直接お問い合わせフォームを表示
- **ドラッグ&リサイズ**: ボタン領域を直感的に調整

### ✍️ AIコピーライティング

- **チャット形式編集**: 「もっと明るく」「専門的に」などの指示でテキストを自動修正
- **コンテキスト理解**: セクションの役割（共感、教育、CTA等）を考慮した最適な文章生成
- **プロンプトコパイロット**: 画像生成プロンプトの最適化提案

### 🔧 ドラッグ&ドロップエディター

- **セクション並び替え**: dnd-kitによるスムーズなドラッグ&ドロップ
- **リアルタイムプレビュー**: 編集内容を即座に確認
- **レスポンシブ対応**: PC/スマホ両方のプレビュー

### 📊 管理機能

- **ページ管理**: 作成したLPの一覧表示、お気に入り、下書き/公開ステータス
- **メディアライブラリ**: アップロード・生成した画像の管理
- **API使用量ダッシュボード**: 日別/モデル別/タイプ別のAI API使用状況とコスト確認
- **ナビゲーション設定**: グローバルナビゲーションのカスタマイズ
- **ヘルスチェック**: `/api/health` エンドポイントでシステム稼働状況を監視

### 📧 メール通知（Resend連携）

- **フォーム送信通知**: 公開ページのお問い合わせフォームから送信があると、設定したメールアドレスに通知
- **Resend統合**: Resend APIを利用した信頼性の高いメール配信
- **DB自動保存**: メール設定の有無に関わらず、全てのフォーム送信はDBに保存
- **独自ドメイン対応**: Resendでドメイン認証すれば独自アドレスから送信可能
- **非ブロッキング設計**: メール送信に失敗してもフォーム送信自体は成功扱い

### 🔒 セキュリティ

- **APIキー暗号化**: ユーザー設定のAPIキー（Google、Render、GitHub、Resend）をAES-256-GCMで暗号化して保存
- **認証**: Supabase Authによる安全なユーザー認証
- **環境変数検証**: 必須の暗号化キーが未設定の場合は起動時に警告

## 技術スタック

### フロントエンド
- **Next.js 14** (App Router)
- **React 18**
- **TypeScript**
- **Tailwind CSS 3**
- **Framer Motion** - アニメーション
- **dnd-kit** - ドラッグ&ドロップ
- **Recharts** - チャート/グラフ
- **Lucide React** - アイコン
- **React Hook Form + Zod** - フォームバリデーション
- **SWR** - データフェッチング

### バックエンド
- **Prisma ORM** - データベースアクセス
- **PostgreSQL** (Supabase経由)
- **Supabase Auth** - ユーザー認証
- **Supabase Storage** - 画像ストレージ

### AI/ML
- **Google Gemini 2.5 Flash** - テキスト生成・編集
- **Google Gemini 3 Pro Image** (Nano Banana Pro) - 画像生成（高品質・日本語指示に強い）

### セキュリティ
- **crypto (Node.js)** - AES-256-GCM暗号化

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env` ファイルを作成（`.env.example` を参考）:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?pgbouncer=true"
DIRECT_URL="postgresql://user:password@localhost:5432/dbname"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbG..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."

# Google AI
GOOGLE_GENERATIVE_AI_API_KEY="AIza..."  # オプション、ユーザー設定優先

# Encryption (REQUIRED - Generate with: openssl rand -hex 32)
ENCRYPTION_KEY="your-64-char-hex-string-here"

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

# Monitoring (Optional - for production)
NEXT_PUBLIC_SENTRY_DSN=""
SENTRY_AUTH_TOKEN=""
```

#### 🔑 暗号化キーの生成方法

```bash
openssl rand -hex 32
```

このコマンドで生成された64文字の文字列を `ENCRYPTION_KEY` に設定してください。

### 3. データベースマイグレーション

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. 開発サーバー起動

```bash
npm run dev
```

アクセス: [http://localhost:3000](http://localhost:3000)

## プロジェクト構成

```
src/
├── app/
│   ├── admin/              # 管理画面
│   │   ├── pages/          # ページ管理
│   │   ├── media/          # メディアライブラリ
│   │   ├── api-usage/      # API使用量ダッシュボード
│   │   ├── settings/       # 設定
│   │   └── navigation/     # ナビ設定
│   ├── api/
│   │   ├── health/                 # ヘルスチェック
│   │   ├── ai/
│   │   │   ├── generate-image/    # 画像生成API
│   │   │   ├── inpaint/           # インペインティングAPI
│   │   │   ├── analyze-design/    # デザイン解析API
│   │   │   ├── chat-edit/         # チャット編集API
│   │   │   ├── generate-copy/     # コピー生成API
│   │   │   ├── prompt-copilot/    # プロンプト最適化API
│   │   │   └── suggest-benefits/  # AI提案API（NEW）
│   │   ├── lp-builder/
│   │   │   └── generate/          # LP一括生成API
│   │   ├── pages/                 # ページCRUD
│   │   └── upload/                # ファイルアップロード
│   ├── p/[slug]/           # 公開ページ
│   ├── preview/page/[id]/  # プレビュー
│   └── lp-builder/         # LPビルダー画面
├── components/
│   ├── lp-builder/
│   │   ├── GeminiGeneratorModal.tsx    # AI生成モーダル（画像ベース）
│   │   ├── TextBasedLPGenerator.tsx    # AI生成モーダル（テキストベース）⚡NEW
│   │   ├── ImageInpaintEditor.tsx      # 画像編集エディタ
│   │   ├── BusinessInfoForm.tsx        # ビジネス情報入力
│   │   ├── PropertiesPanel.tsx         # プロパティパネル
│   │   └── sections/                   # セクションコンポーネント
│   ├── admin/
│   │   ├── PagesList.tsx
│   │   ├── Editor.tsx
│   │   └── dashboard/                 # ダッシュボードチャート
│   └── public/
│       ├── ContactForm.tsx
│       ├── FormInputModal.tsx         # フォーム入力モーダル
│       └── InteractiveAreaOverlay.tsx
├── lib/
│   ├── supabase/           # Supabaseクライアント
│   ├── db.ts               # Prismaクライアント
│   ├── auth.ts             # 認証ユーティリティ
│   ├── email.ts            # Resendメール送信ユーティリティ
│   ├── encryption.ts       # APIキー暗号化（AES-256-GCM）
│   ├── apiKeys.ts          # APIキー管理
│   ├── ai-costs.ts         # AIコスト計算
│   ├── gemini-prompts.ts   # プロンプトテンプレート
│   ├── generation-logger.ts # 生成ログ
│   └── validations.ts      # スキーマバリデーション⚡NEW
└── types/
    └── index.ts            # 型定義
```

## データベーススキーマ

### 主要テーブル

- **Page**: LPページ情報（userId、title、slug、status、seoData等）
- **PageSection**: セクション情報（画像、config、並び順、境界オフセット）
- **MediaImage**: 画像メタデータ（生成プロンプト、ソース、ハッシュ等）
- **GenerationRun**: AI API呼び出しログ（コスト、トークン数、モデル、ステータス等）
- **InpaintHistory**: インペインティング履歴
- **SectionImageHistory**: セクション画像変更履歴
- **UserSettings**: ユーザー設定（プラン、暗号化されたAPIキー、Resend設定、承認状態等）
- **FormSubmission**: フォーム送信データ（問い合わせ内容、通知状態等）
- **GlobalConfig**: グローバル設定
- **CreditBalance**: クレジット残高管理
- **CreditTransaction**: クレジット取引履歴
- **Subscription**: Stripeサブスクリプション管理
- **Deployment**: デプロイ管理（Render.com等）
- **WaitingRoomEntry**: 待機室エントリー（承認制登録）

詳細は `prisma/schema.prisma` を参照してください。

## API エンドポイント

### ヘルスチェック
| エンドポイント | 説明 |
|---|---|
| `GET /api/health` | データベース接続を含むシステム稼働状況 |

### AI系
| エンドポイント | 説明 |
|---|---|
| `POST /api/ai/generate-image` | 単一画像生成 |
| `POST /api/ai/inpaint` | 画像部分編集 |
| `POST /api/ai/analyze-design` | デザインスタイル解析 |
| `POST /api/ai/chat-edit` | チャット形式テキスト編集 |
| `POST /api/ai/generate-copy` | コピーライティング生成 |
| `POST /api/ai/prompt-copilot` | プロンプト最適化 |
| `POST /api/ai/suggest-benefits` | AI提案（メリット、USP、実績、保証）⚡NEW |
| `POST /api/lp-builder/generate` | LP一括生成（画像/テキストベース対応） |

### 管理系
| エンドポイント | 説明 |
|---|---|
| `GET/POST /api/pages` | ページ一覧/作成 |
| `GET/PUT/DELETE /api/pages/[id]` | ページ詳細/更新/削除 |
| `POST /api/pages/[id]/restyle` | スタイル一括変更 |
| `POST /api/upload` | ファイルアップロード（Supabase Storage） |
| `GET /api/media` | メディア一覧 |
| `GET /api/admin/stats` | API使用統計 |
| `POST /api/form-submissions` | フォーム送信（DB保存+メール通知） |
| `GET/POST /api/user/settings` | ユーザー設定（Resend、APIキー等） |

## 本番デプロイ (Render/Vercel)

### ビルドコマンド
```bash
npm install && npx prisma migrate deploy && npx prisma generate && npm run build
```

### スタートコマンド
```bash
npm start
```

### 環境変数（必須）

**データベース**:
- `DATABASE_URL` - PostgreSQL接続文字列（pgbouncer対応）
- `DIRECT_URL` - PostgreSQL直接接続文字列（マイグレーション用）

**Supabase**:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anon Key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key

**セキュリティ**:
- `ENCRYPTION_KEY` - APIキー暗号化用の64文字hex文字列（必須）

**オプション**:
- `GOOGLE_GENERATIVE_AI_API_KEY` - Google AI API Key（ユーザー設定がない場合のフォールバック）
- `LOG_LEVEL` - ログレベル（debug/info/warn/error）

### デプロイ前チェックリスト

- [ ] `ENCRYPTION_KEY` を `openssl rand -hex 32` で生成して設定
- [ ] Supabase Storageのバケット作成（public: `lp-images`, `media-uploads`）
- [ ] データベースマイグレーション実行済み
- [ ] 環境変数を全て設定（特にENCRYPTION_KEY）
- [ ] ヘルスチェック（`/api/health`）が200を返すことを確認

## メール通知の使い方（Resend）

公開ページのお問い合わせフォームから送信があった際に、メールで通知を受け取る機能です。

### Step 1: Resendアカウント作成

[resend.com](https://resend.com) で無料アカウントを作成します（100通/日まで無料）。

### Step 2: APIキーの取得

Resendダッシュボードの「API Keys」ページで「Create API Key」をクリックし、キーをコピーします。

### Step 3: 設定画面で入力

管理画面 → 設定 →「デプロイ」タブを開き、「メール通知（Resend）」セクションで以下を入力：

1. **Resend APIキー** - `re_` で始まるキーを貼り付け（暗号化されて保存）
2. **通知先メールアドレス** - 通知を受け取りたいアドレス
3. **送信ドメイン（オプション）** - 独自ドメインを設定する場合

### Step 4: 保存して完了

ページ下部の「変更を保存」ボタンをクリックすれば設定完了です。

### Step 5: 動作確認

公開ページ（`/p/your-page-slug`）のお問い合わせフォームから送信すると：
- DBに `FormSubmission` レコードが作成される
- 設定したメールアドレスに通知メールが届く

### 独自ドメイン設定（オプション）

デフォルトでは `onboarding@resend.dev` から送信されます（自分宛のみ有効）。
独自ドメインを設定すると、`notifications@your-domain.com` から送信できます。

1. Resend Domainsページで「Add Domain」
2. 表示されるDNSレコード（MX, TXT, CNAME）をDNS設定に追加
3. 「Verify」をクリックして認証を確認
4. 設定画面の「送信ドメイン」欄に認証したドメインを入力

---

## 使用モデルとコスト目安

| モデル | 用途 | 概算コスト |
|---|---|---|
| gemini-3-pro-image-preview (Nano Banana Pro) | 画像生成（高品質・日本語指示に強い） | **$0.134/枚** |
| gemini-2.5-flash | テキスト生成・編集・解析 | ~$0.00001/1K tokens |

※ コストは目安です。最新の料金は[Google AI Pricing](https://ai.google.dev/pricing)をご確認ください。

## v3画像生成技術（Style Anchor + Seam Reference）

### 従来の課題
- セクション間で色や質感が不連続
- 継ぎ目が目立つ
- LP全体としての一体感がない

### v3の解決策
1. **Style Anchor（スタイル固定）**: 最初のセクション（またはユーザーアップロード画像）をスタイルの基準として固定
2. **Seam Reference（境界参照）**: 前セクションの下端15%を切り出し、次セクション生成時に参照させることで自然な接続を実現
3. **Design Guideline（デザインガイドライン）**: 色・トーン・明度を事前生成し、全セクションで統一

### 結果
- シームレスなセクション接続
- LP全体で統一感のあるデザイン
- プロフェッショナルな仕上がり

## 開発ガイド

### デバッグモード

```bash
LOG_LEVEL=debug npm run dev
```

### データベースリセット

```bash
npx prisma migrate reset
```

### Prismaスタジオ

```bash
npx prisma studio
```

## トラブルシューティング

### 画像生成が失敗する
- Google AI APIキーが正しく設定されているか確認
- API使用量ダッシュボードでクォータを確認
- ヘルスチェック（`/api/health`）でシステム状態を確認

### 暗号化キーエラー
```
[SECURITY WARNING] ENCRYPTION_KEY is not set
```
→ `.env` に `ENCRYPTION_KEY` を設定してください（`openssl rand -hex 32` で生成）

### データベース接続エラー
- `DATABASE_URL` と `DIRECT_URL` が正しく設定されているか確認
- PostgreSQLサーバーが起動しているか確認
- ヘルスチェック（`/api/health`）でデータベース状態を確認

## ライセンス

MIT

## コントリビューション

Issue、Pull Requestを歓迎します。

## サポート

質問や問題がある場合は、[GitHub Issues](https://github.com/your-repo/issues)で報告してください。
