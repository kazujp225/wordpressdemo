# LP Automatic Builder

AI駆動のランディングページ自動生成ツール。Next.js 14、Tailwind CSS、Supabase、Google Gemini AIを活用した、プロフェッショナルなLP制作プラットフォームです。

## 主な機能

### AI LP自動生成
- **ワンクリックLP生成**: ビジネス情報を入力するだけで、完全なLPを自動生成
- **セクション別画像生成**: Hero、Features、Pricing、Testimonials、FAQ、CTAなど各セクションに最適な画像をAIが生成
- **デザインリファレンス機能**: 参照画像をアップロードすると、そのデザインスタイル（色、雰囲気、レイアウト）を解析して反映
- **複数のトーン対応**: Professional、Friendly、Luxury、Energetic など

### AI画像編集機能
- **インペインティング（部分編集）**: 画像の一部を選択してAIで編集・修正
- **複数領域同時選択**: 複数箇所を一度に編集可能
- **編集履歴**: 過去の編集履歴を参照・復元

### クリッカブルエリア設定
- **画像上ボタン配置**: 画像の任意の位置にクリッカブルなボタンを設置
- **複数アクションタイプ対応**:
  - URLリンク
  - メールアドレス (mailto:)
  - 電話番号 (tel:)
  - セクションスクロール
  - **フォーム入力モーダル**: 画像上に直接お問い合わせフォームを表示
- **ドラッグ&リサイズ**: ボタン領域を直感的に調整

### AIコピーライティング
- **チャット形式編集**: 「もっと明るく」「専門的に」などの指示でテキストを自動修正
- **コンテキスト理解**: セクションの役割（共感、教育、CTA等）を考慮した最適な文章生成
- **プロンプトコパイロット**: 画像生成プロンプトの最適化提案

### ドラッグ&ドロップエディター
- **セクション並び替え**: dnd-kitによるスムーズなドラッグ&ドロップ
- **リアルタイムプレビュー**: 編集内容を即座に確認
- **レスポンシブ対応**: PC/スマホ両方のプレビュー

### 管理機能
- **ページ管理**: 作成したLPの一覧表示、お気に入り、下書き/公開ステータス
- **メディアライブラリ**: アップロード・生成した画像の管理
- **API使用量ダッシュボード**: 日別/モデル別/タイプ別のAI API使用状況とコスト確認
- **ナビゲーション設定**: グローバルナビゲーションのカスタマイズ

### メール通知（Resend連携）
- **フォーム送信通知**: 公開ページのお問い合わせフォームから送信があると、設定したメールアドレスに通知
- **Resend統合**: Resend APIを利用した信頼性の高いメール配信
- **DB自動保存**: メール設定の有無に関わらず、全てのフォーム送信はDBに保存
- **独自ドメイン対応**: Resendでドメイン認証すれば独自アドレスから送信可能
- **非ブロッキング設計**: メール送信に失敗してもフォーム送信自体は成功扱い

## 技術スタック

### フロントエンド
- **Next.js 14** (App Router)
- **React 18**
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
- **Google Gemini 3 Pro Image** - 画像生成（メイン）
- **Google Gemini 2.5 Flash** - 画像生成（フォールバック）
- **Google Gemini 1.5/2.0 Flash** - テキスト生成

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env` ファイルを作成:

```env
# Database
DATABASE_URL="postgresql://..."

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# JWT Secret (認証用)
JWT_SECRET="your-jwt-secret"

# Public URL
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Google API Key (デフォルト/管理者用、ユーザーは個別設定可)
GOOGLE_API_KEY="your-google-api-key"
```

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
│   │   ├── ai/
│   │   │   ├── generate-image/    # 画像生成API
│   │   │   ├── inpaint/           # インペインティングAPI
│   │   │   ├── analyze-design/    # デザイン解析API
│   │   │   ├── chat-edit/         # チャット編集API
│   │   │   ├── generate-copy/     # コピー生成API
│   │   │   └── prompt-copilot/    # プロンプト最適化API
│   │   ├── lp-builder/
│   │   │   └── generate/          # LP一括生成API
│   │   ├── pages/                 # ページCRUD
│   │   └── upload/                # ファイルアップロード
│   ├── p/[slug]/           # 公開ページ
│   └── lp-builder/         # LPビルダー画面
├── components/
│   ├── lp-builder/
│   │   ├── GeminiGeneratorModal.tsx  # AI生成モーダル
│   │   ├── ImageInpaintEditor.tsx    # 画像編集エディタ
│   │   ├── BusinessInfoForm.tsx      # ビジネス情報入力
│   │   ├── PropertiesPanel.tsx       # プロパティパネル
│   │   └── sections/                 # セクションコンポーネント
│   ├── admin/
│   │   ├── PagesList.tsx
│   │   ├── Editor.tsx
│   │   └── dashboard/               # ダッシュボードチャート
│   └── public/
│       ├── ContactForm.tsx
│       ├── FormInputModal.tsx       # フォーム入力モーダル
│       └── InteractiveAreaOverlay.tsx
├── lib/
│   ├── supabase/           # Supabaseクライアント
│   ├── db.ts               # Prismaクライアント
│   ├── auth.ts             # 認証ユーティリティ
│   ├── email.ts            # Resendメール送信ユーティリティ
│   ├── encryption.ts       # APIキー暗号化
│   ├── apiKeys.ts          # APIキー管理
│   ├── ai-costs.ts         # AIコスト計算
│   ├── gemini-prompts.ts   # プロンプトテンプレート
│   └── generation-logger.ts # 生成ログ
└── types/
    └── index.ts            # 型定義
```

## データベーススキーマ

### 主要テーブル

- **Page**: LPページ情報
- **PageSection**: セクション情報（画像、コンフィグ、並び順）
- **MediaImage**: 画像メタデータ（生成プロンプト、ソース等）
- **GenerationRun**: AI API呼び出しログ（コスト、トークン数等）
- **InpaintHistory**: インペインティング履歴
- **UserSettings**: ユーザー設定（プラン、APIキー、Resend設定等）
- **FormSubmission**: フォーム送信データ（問い合わせ内容、通知状態等）
- **GlobalConfig**: グローバル設定

## API エンドポイント

### AI系
| エンドポイント | 説明 |
|---|---|
| `POST /api/ai/generate-image` | 単一画像生成 |
| `POST /api/ai/inpaint` | 画像部分編集 |
| `POST /api/ai/analyze-design` | デザインスタイル解析 |
| `POST /api/ai/chat-edit` | チャット形式テキスト編集 |
| `POST /api/ai/generate-copy` | コピーライティング生成 |
| `POST /api/ai/prompt-copilot` | プロンプト最適化 |
| `POST /api/lp-builder/generate` | LP一括生成 |

### 管理系
| エンドポイント | 説明 |
|---|---|
| `GET/POST /api/pages` | ページ一覧/作成 |
| `GET/PUT/DELETE /api/pages/[id]` | ページ詳細/更新/削除 |
| `POST /api/pages/[id]/restyle` | スタイル一括変更 |
| `POST /api/upload` | ファイルアップロード |
| `GET /api/media` | メディア一覧 |
| `GET /api/admin/stats` | API使用統計 |
| `POST /api/form-submissions` | フォーム送信（DB保存+メール通知） |
| `GET/POST /api/user/settings` | ユーザー設定（Resend含む） |

## 本番デプロイ (Render/Vercel)

### ビルドコマンド
```bash
npm install && npx prisma migrate deploy && npm run build
```

### スタートコマンド
```bash
npm start
```

### 環境変数（必須）
- `DATABASE_URL` - PostgreSQL接続文字列
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anon Key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key
- `JWT_SECRET` - JWT署名用シークレット
- `NEXT_PUBLIC_BASE_URL` - 公開URL
- `GOOGLE_API_KEY` - Google AI API Key（オプション、ユーザー設定優先）

## メール通知の使い方（Resend）

公開ページのお問い合わせフォームから送信があった際に、メールで通知を受け取る機能です。

### Step 1: Resendアカウント作成

[resend.com](https://resend.com) で無料アカウントを作成します（100通/日まで無料）。

### Step 2: APIキーの取得

Resendダッシュボードの「API Keys」ページで「Create API Key」をクリックし、キーをコピーします。

![Resend APIキー作成](docs/images/resend-api-key.png)

### Step 3: 設定画面で入力

管理画面 → 設定 →「デプロイ」タブを開き、「メール通知（Resend）」セクションで以下を入力：

1. **Resend APIキー** - `re_` で始まるキーを貼り付け
2. **通知先メールアドレス** - 通知を受け取りたいアドレス
3. **送信ドメイン（オプション）** - 独自ドメインを設定する場合

![設定画面 - Resendセクション](docs/images/settings-resend-section.png)

### Step 4: 保存して完了

ページ下部の「変更を保存」ボタンをクリックすれば設定完了です。

### Step 5: 動作確認

公開ページ（`/p/your-page-slug`）のお問い合わせフォームから送信すると：
- DBに `FormSubmission` レコードが作成される
- 設定したメールアドレスに通知メールが届く

![お問い合わせフォーム](docs/images/contact-form.png)

![通知メール例](docs/images/notification-email.png)

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
| gemini-3-pro-image-preview | 画像生成（メイン） | ~$0.04/枚 |
| gemini-2.5-flash-preview-image-generation | 画像生成（フォールバック） | ~$0.02/枚 |
| gemini-1.5-flash | テキスト生成 | ~$0.00001/1K tokens |
| gemini-2.0-flash | テキスト編集/解析 | ~$0.00001/1K tokens |

## ライセンス

MIT

## コントリビューション

Issue、Pull Requestを歓迎します。
