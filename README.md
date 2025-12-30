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
- **UserSettings**: ユーザー設定（プラン、APIキー等）
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
