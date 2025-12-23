# LP Builder - Gemini AI生成機能 設計書

## 1. 機能概要

### 目的
ユーザーがビジネス情報を入力するだけで、Gemini AIがコンバージョン率の高いLP（ランディングページ）のコンテンツを自動生成する。

### 対象ユーザー
- 非デザイナーの事業者
- 素早くLPを作成したいマーケター
- コピーライティングに自信がないユーザー

---

## 2. UI/UXフロー

```
┌─────────────────────────────────────────────────────────────┐
│  LP Builder ページ                                           │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │ 左サイドバー │  │   キャンバス      │  │ プロパティ      │ │
│  │             │  │                  │  │                 │ │
│  │ [セクション] │  │  ドラッグ&ドロップ │  │  編集パネル     │ │
│  │             │  │                  │  │                 │ │
│  │ ─────────── │  │                  │  │                 │ │
│  │ AI生成      │  │                  │  │                 │ │
│  │ [Geminiで   │  │                  │  │                 │ │
│  │  生成] ←クリック                   │  │                 │ │
│  └─────────────┘  └──────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  AI生成モーダル (フルスクリーン or 大型モーダル)              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ステップ1: ビジネス情報入力                              ││
│  │ ┌─────────────────────────────────────────────────────┐ ││
│  │ │ ビジネス名 *        [                              ] │ ││
│  │ │ 業種 *              [SaaS ▼                        ] │ ││
│  │ │ サービス概要 *      [                              ] │ ││
│  │ │ ターゲット顧客 *    [                              ] │ ││
│  │ │ 主な強み *          [                              ] │ ││
│  │ │ 差別化ポイント      [                              ] │ ││
│  │ │ 価格帯              [                              ] │ ││
│  │ │ トーン *            ○ プロフェッショナル             │ ││
│  │ │                     ○ フレンドリー                   │ ││
│  │ │                     ○ ラグジュアリー                 │ ││
│  │ │                     ○ エネルギッシュ                 │ ││
│  │ └─────────────────────────────────────────────────────┘ ││
│  │                                                         ││
│  │         [キャンセル]  [✨ AIでLP全体を生成]              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  ステップ2: 生成中 (ローディング)                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │              ✨ 🔄                                       ││
│  │         AIがLPを生成中...                                ││
│  │                                                         ││
│  │    [Hero] ━━━━━━━━━━━━━━━━━━━━━━━━ ✓                     ││
│  │    [Features] ━━━━━━━━━━━━━━━━━━━━ ✓                     ││
│  │    [Testimonials] ━━━━━━━━━━━━━━━ ✓                      ││
│  │    [Pricing] ━━━━━━━━━━━━━━━━━━━━━ 生成中...             ││
│  │    [FAQ] ━━━━━━━━━━━━━━━━━━━━━━━━━ 待機中                ││
│  │    [CTA] ━━━━━━━━━━━━━━━━━━━━━━━━━ 待機中                ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  ステップ3: プレビュー & 確認                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  [Desktop] [Tablet] [Mobile]                  [編集モード]││
│  │ ┌─────────────────────────────────────────────────────┐ ││
│  │ │                                                     │ ││
│  │ │  ┌─────────────────────────────────────────────┐    │ ││
│  │ │  │ HERO: あなたのビジネスを次のレベルへ         │    │ ││
│  │ │  │ [無料で始める]                              │    │ ││
│  │ │  └─────────────────────────────────────────────┘    │ ││
│  │ │                                                     │ ││
│  │ │  ┌─────────────────────────────────────────────┐    │ ││
│  │ │  │ FEATURES: 選ばれる3つの理由                 │    │ ││
│  │ │  │ 🚀 スピード  💎 品質  🤝 サポート            │    │ ││
│  │ │  └─────────────────────────────────────────────┘    │ ││
│  │ │                                                     │ ││
│  │ │  ... (スクロール可能)                               │ ││
│  │ │                                                     │ ││
│  │ └─────────────────────────────────────────────────────┘ ││
│  │                                                         ││
│  │     [やり直す]  [一部を再生成]  [✓ このLPを使用]         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 3. コンポーネント構成

```
src/
├── app/
│   ├── admin/
│   │   └── lp-builder/
│   │       └── page.tsx              # メインページ (既存)
│   └── api/
│       └── lp-builder/
│           ├── route.ts              # 保存API (既存)
│           └── generate/
│               └── route.ts          # 🆕 Gemini生成API
│
├── components/
│   └── lp-builder/
│       ├── GeminiGeneratorModal.tsx  # 🆕 AI生成モーダル
│       ├── BusinessInfoForm.tsx      # 🆕 ビジネス情報入力フォーム
│       ├── GenerationProgress.tsx    # 🆕 生成進捗表示
│       ├── GeneratedPreview.tsx      # 🆕 生成結果プレビュー
│       ├── sections/                 # セクションコンポーネント (既存)
│       │   ├── HeroSection.tsx
│       │   ├── FeaturesSection.tsx
│       │   ├── PricingSection.tsx
│       │   ├── FAQSection.tsx
│       │   ├── CTASection.tsx
│       │   └── TestimonialsSection.tsx
│       └── defaultData.ts            # デフォルトデータ (既存)
│
└── lib/
    └── gemini-prompts.ts             # Geminiプロンプト集 (既存)
```

---

## 4. API設計

### POST `/api/lp-builder/generate`

#### リクエスト
```typescript
interface GenerateRequest {
  businessInfo: {
    businessName: string;      // ビジネス名 (必須)
    industry: string;          // 業種 (必須)
    service: string;           // サービス概要 (必須)
    target: string;            // ターゲット顧客 (必須)
    strengths: string;         // 主な強み (必須)
    differentiators?: string;  // 差別化ポイント
    priceRange?: string;       // 価格帯
    tone: 'professional' | 'friendly' | 'luxury' | 'energetic';  // トーン (必須)
  };
  sectionsToGenerate?: string[];  // 生成するセクション (省略時は全セクション)
}
```

#### レスポンス
```typescript
interface GenerateResponse {
  success: boolean;
  data?: {
    colorScheme: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    sections: Array<{
      type: 'hero' | 'features' | 'pricing' | 'faq' | 'cta' | 'testimonials';
      name: string;
      properties: Record<string, any>;
    }>;
  };
  error?: string;
}
```

---

## 5. データフロー

```
┌──────────────────┐
│ ユーザー入力      │
│ (ビジネス情報)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ フロントエンド    │
│ GeminiGenerator  │
│ Modal.tsx        │
└────────┬─────────┘
         │ POST /api/lp-builder/generate
         ▼
┌──────────────────┐
│ APIルート        │
│ generate/        │
│ route.ts         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ gemini-prompts.ts│
│ プロンプト構築    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Gemini API       │
│ (Google AI)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ レスポンスパース  │
│ JSON抽出・検証   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ フロントエンド    │
│ セクション配列に  │
│ 変換して表示      │
└──────────────────┘
```

---

## 6. コンポーネント詳細設計

### 6.1 GeminiGeneratorModal.tsx

```tsx
interface GeminiGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (sections: Section[]) => void;
}

// 状態管理
type Step = 'input' | 'generating' | 'preview';

// モーダル内の3つのステップを管理
```

**UI要件:**
- フルスクリーンモーダル（背景ブラー）
- スムーズなステップ遷移アニメーション
- ESCキーで閉じる（生成中は確認ダイアログ）

### 6.2 BusinessInfoForm.tsx

```tsx
interface BusinessInfoFormProps {
  onSubmit: (data: BusinessInfo) => void;
  onCancel: () => void;
  isLoading: boolean;
}
```

**UI要件:**
- 必須フィールドの明示（*マーク）
- リアルタイムバリデーション
- 業種はドロップダウン（プリセット + カスタム入力可）
- トーンはラジオボタン + 説明文
- 送信ボタンは入力完了まで非活性

**業種プリセット:**
- SaaS / IT
- 飲食・フード
- 美容・サロン
- 不動産
- 教育・スクール
- コンサルティング
- EC・物販
- 医療・ヘルスケア
- その他（自由入力）

### 6.3 GenerationProgress.tsx

```tsx
interface GenerationProgressProps {
  sections: Array<{
    type: string;
    status: 'pending' | 'generating' | 'completed' | 'error';
  }>;
  currentSection?: string;
}
```

**UI要件:**
- 各セクションの進捗バー
- 完了したセクションにチェックマーク
- 現在生成中のセクションにスピナー
- エラー時は赤いアイコンと再試行ボタン

### 6.4 GeneratedPreview.tsx

```tsx
interface GeneratedPreviewProps {
  sections: Section[];
  colorScheme: ColorScheme;
  onRegenerate: () => void;
  onRegenerateSection: (sectionId: string) => void;
  onAccept: () => void;
}
```

**UI要件:**
- デスクトップ/タブレット/モバイルのプレビュー切り替え
- 各セクションにホバーで「再生成」ボタン表示
- スクロール可能なプレビューエリア
- 「このLPを使用」ボタンで確定

---

## 7. カラースキーム自動生成

トーンに基づいてGeminiがカラースキームを提案:

| トーン | Primary | Secondary | Accent | 例 |
|--------|---------|-----------|--------|-----|
| Professional | 紺・グレー系 | ホワイト | ブルー | #1e40af, #f8fafc, #3b82f6 |
| Friendly | オレンジ・緑系 | クリーム | イエロー | #ea580c, #fef3c7, #fbbf24 |
| Luxury | ゴールド・黒系 | ホワイト | ゴールド | #1c1917, #fafafa, #d4af37 |
| Energetic | 赤・ピンク系 | ホワイト | マゼンタ | #dc2626, #ffffff, #ec4899 |

---

## 8. エラーハンドリング

| エラー | 対応 |
|--------|------|
| Gemini API タイムアウト | 再試行ボタン表示、最大3回自動リトライ |
| JSONパースエラー | デフォルトデータでフォールバック + 警告 |
| API キー未設定 | 設定画面へのリンク表示 |
| レート制限 | 待機時間表示、カウントダウン |

---

## 9. 実装優先順位

### Phase 1 (MVP)
1. GeminiGeneratorModal の基本UI
2. BusinessInfoForm の実装
3. /api/lp-builder/generate API
4. 全セクション一括生成

### Phase 2 (改善)
1. GenerationProgress のアニメーション
2. セクション個別再生成
3. プレビューのレスポンシブ切り替え

### Phase 3 (拡張)
1. 生成履歴の保存
2. テンプレートとして保存
3. A/Bテスト用バリエーション生成

---

## 10. 技術スタック

- **フロントエンド**: React, Next.js 14, Tailwind CSS
- **状態管理**: React useState/useReducer
- **フォーム**: react-hook-form + zod
- **API**: Next.js Route Handlers
- **AI**: Google Gemini API (gemini-1.5-flash or gemini-pro)
- **アニメーション**: Tailwind CSS transitions, framer-motion (オプション)

---

## 11. 既存ファイル参照

### gemini-prompts.ts (既存)
- `SYSTEM_PROMPT` - 基本システムプロンプト
- `HERO_SECTION_PROMPT` - ヒーローセクション用
- `FEATURES_SECTION_PROMPT` - 特徴セクション用
- `PRICING_SECTION_PROMPT` - 料金セクション用
- `FAQ_SECTION_PROMPT` - FAQセクション用
- `CTA_SECTION_PROMPT` - CTAセクション用
- `TESTIMONIALS_SECTION_PROMPT` - お客様の声用
- `FULL_LP_PROMPT` - LP全体生成用
- `fillPromptTemplate()` - プレースホルダー置換
- `createGeminiRequest()` - APIリクエスト生成
- `parseGeminiResponse()` - レスポンスパース

### defaultData.ts (既存)
- 各セクションのデフォルトデータ定義
- `getDefaultDataForType()` - タイプ別デフォルト取得
