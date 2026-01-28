export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'date' | 'time' | 'checkbox' | 'radio';
  required: boolean;
  placeholder?: string;
  options?: string[]; // for select/radio
  halfWidth?: boolean; // 横幅50%で配置（desktop時に2列表示用）
}

export interface DesignContext {
  colorPalette?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  typography?: {
    style: string;
    mood: string;
  };
  layout?: {
    density: string;
    style: string;
  };
  vibe?: string;
  description?: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  hasFormFields: boolean;
  templatePrompt: string;
  defaultUserPrompt: string;
  defaultFields?: FormField[];
}

const BASE_DESIGN_RULES = `【最重要】デザインに関する絶対的ルール:
あなたは「AIが作った」と一目で分かるような安っぽいデザインを絶対に生成してはいけません。
以下は全て禁止です:
- 過度なグラデーション背景（特にパープル→ブルー系の安直なもの）
- 角丸が大きすぎるカード（border-radius: 20px以上）
- 無意味なアニメーション・ホバーエフェクトの乱用
- 白背景に薄い影のカードレイアウト（コーポレートテンプレ感）
- 左右対称すぎる配置
- アイコンの多用やイラスト風装飾
- 「AIが作りました」感のあるジェネリックなカラーパレット
- Bootstrapやテンプレートそのままの見た目
- ストック写真的なヒーロー画像の配置パターン
- 全てのinputにborder-radius: 8px以上を付けること
- boxShadowの多用

代わりに以下を守ること:
- 人間のデザイナーが時間をかけて作ったような有機的なレイアウト
- 余白の使い方に意図がある（均等ではなくリズムがある）
- フォントサイズに強弱がある（大胆な見出しと繊細な本文）
- 色使いは最小限、2-3色まで。差し色は1色のみ
- 実在するデザイン事務所やブランドサイトのような質感
- テクスチャや微妙な色むらで機械的に見えないこと
- 行間・字間にこだわり、テキストが読みやすいこと
- 装飾ではなくコンテンツで魅せるレイアウト
- 日本のデザインに合う端正さ（過度な装飾を避け、引き算の美学）
- フォームのinputは角丸0〜4px、ボーダーは1pxのみで控えめに
- ボタンは角丸0〜6px、font-weight: 600以上、十分なpadding
- フォーカス時はbox-shadowではなくborder-colorの変化で表現`;

export function buildSystemPrompt(options: {
  templateId: string;
  layoutMode: 'desktop' | 'responsive';
  designContext?: DesignContext | null;
  formFields?: FormField[];
  enableFormSubmission?: boolean;
}): string {
  const { templateId, layoutMode, designContext, formFields, enableFormSubmission } = options;
  const template = getTemplate(templateId);
  if (!template) return '';

  let prompt = `あなたは日本のトップクラスのWebデザイナー兼フロントエンドエンジニアです。
クライアントのLPに埋め込むための、完成度の高いHTML/CSS/JSコンポーネントを生成してください。

【基本要件】
- 完全なHTMLファイル1つで完結（CSS・JSはインライン埋め込み、外部依存なし）
- モダンCSS: CSS変数、flexbox/grid、clamp()、論理プロパティ
- font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif
- セマンティックHTML5、WAI-ARIA属性、スクリーンリーダー対応
- 出力はHTMLコードのみ（説明文・コメント不要）
- <!DOCTYPE html>から始まる完全なHTMLを出力
- 全てのテキストは日本語で記述すること\n\n`;

  // Layout mode - more detailed
  if (layoutMode === 'desktop') {
    prompt += `【レイアウト: デスクトップ専用設計】
- 想定画面幅: 1024px〜1440px
- max-width: 720px でセンタリング（フォームの場合）
- モバイル用メディアクエリは一切不要
- 横幅を活かし、関連フィールドは2列グリッドで配置
- 入力フィールドの高さ: 48px〜52px（操作しやすいサイズ）
- ラベルとフィールドの間隔: 6px〜8px
- フィールド間の間隔: 20px〜28px
- セクション見出しの下マージン: 32px〜40px\n\n`;
  } else {
    prompt += `【レイアウト: レスポンシブ設計（モバイルファースト）】
- ベース幅: 375px（iPhone SE）
- ブレイクポイント:
  - 768px: タブレット（2列グリッド開始）
  - 1024px: デスクトップ（max-width: 720px でセンタリング）
- モバイル: 全フィールド100%幅、パディング16px〜20px
- タブレット以上: 関連フィールドを2列配置可
- タッチターゲット最小: 44px x 44px
- モバイルでのfont-size: 16px以上（iOS拡大防止）
- フィールド間の間隔: モバイル16px / デスクトップ24px\n\n`;
  }

  // Design context - much more detailed
  if (designContext) {
    prompt += `【デザインシステム定義（既存LPとの統一感を最優先）】\n`;
    if (designContext.colorPalette) {
      const cp = designContext.colorPalette;
      prompt += `カラートークン:
  --color-primary: ${cp.primary}（CTAボタン、アクティブ状態、リンク）
  --color-secondary: ${cp.secondary}（サブ見出し、補助テキスト）
  --color-accent: ${cp.accent}（差し色、必須マーク、エラー状態のベース）
  --color-bg: ${cp.background}（全体背景）
  --color-surface: フォーム領域の背景（--color-bgより少し浮かせる）
  --color-border: ${cp.primary}の10%不透明度（通常のボーダー）
  --color-border-focus: ${cp.primary}（フォーカス時のボーダー）
  --color-text: ${cp.background}のコントラスト色
  --color-text-muted: テキスト色の60%不透明度（placeholder等）
  --color-error: #dc2626 or ${cp.accent}に近い赤系\n`;
    }
    if (designContext.typography) {
      prompt += `タイポグラフィ:
  スタイル: ${designContext.typography.style}
  ムード: ${designContext.typography.mood}
  → 見出しはこのムードに合ったfont-weight/letter-spacingを選択
  → 本文は読みやすさ優先（line-height: 1.7〜1.8）\n`;
    }
    if (designContext.layout) {
      prompt += `レイアウト特性:
  密度: ${designContext.layout.density}（${designContext.layout.density === 'compact' ? '余白控えめ' : designContext.layout.density === 'spacious' ? '余白たっぷり' : '標準的な余白'}）
  スタイル: ${designContext.layout.style}\n`;
    }
    if (designContext.vibe) {
      prompt += `全体の雰囲気: ${designContext.vibe}\n`;
    }
    if (designContext.description) {
      prompt += `デザイン詳細: ${designContext.description}\n`;
    }
    prompt += `
【統一感の実現方法】
- CSSカスタムプロパティで上記カラートークンを定義し、全要素で参照
- ボタンのスタイル: 背景色=primary、テキスト色=primaryのコントラスト色、hover時はprimaryの90%
- inputのborder: 1px solid var(--color-border)、focus時: var(--color-border-focus)
- 全体のborder-radiusは統一（0〜4px推奨、既存LPの雰囲気に合わせる）
- letterSpacing、lineHeight、fontWeightをLPのムードに合わせること\n\n`;
  }

  // Design rules
  prompt += BASE_DESIGN_RULES + '\n\n';

  // Template-specific prompt
  if (template.templatePrompt) {
    prompt += template.templatePrompt + '\n';
  }

  // Form fields - very detailed UX specs
  if (formFields && formFields.length > 0 && template.hasFormFields) {
    prompt += `\n【フォームフィールド定義】\n`;
    prompt += `以下のフィールドを、この順番でこの通りに実装すること:\n\n`;

    const halfWidthFields: string[] = [];
    formFields.forEach((field, i) => {
      let fieldDesc = `${i + 1}. "${field.label}"`;
      fieldDesc += `\n   type: <input type="${field.type === 'textarea' ? '" → <textarea' : field.type === 'select' ? '" → <select' : field.type === 'radio' ? '" → radio group' : field.type === 'checkbox' ? 'checkbox"' : field.type + '"'}${field.type === 'textarea' ? '>' : field.type === 'select' ? '>' : ''}`;
      fieldDesc += `\n   required: ${field.required ? 'YES（必須バリデーション）' : 'NO（任意）'}`;
      if (field.placeholder) fieldDesc += `\n   placeholder: "${field.placeholder}"`;
      if (field.options && field.options.length > 0) {
        fieldDesc += `\n   options: ["${field.options.join('", "')}"]`;
      }
      if (field.halfWidth) {
        fieldDesc += `\n   layout: half-width（隣のフィールドと2列表示）`;
        halfWidthFields.push(field.id);
      }
      prompt += fieldDesc + '\n\n';
    });

    prompt += `【フォームUX仕様（必ず実装すること）】

■ バリデーション
- 必須フィールド: blurイベントで即座にチェック、エラー時はフィールド枠を赤く、直下にエラーメッセージ
- メール: RFC準拠の正規表現チェック（@と.の存在確認で十分）
- 電話番号: 数字とハイフンのみ許可、10〜11桁チェック
- エラーメッセージのスタイル: font-size: 12px, color: var(--color-error), margin-top: 4px
- エラー状態のinput: border-color: var(--color-error)
- 入力修正後: リアルタイムでエラー解除（inputイベントで再チェック）

■ フォームフロー（3ステップ）
1. 入力画面: フォームフィールドと送信ボタン
2. 確認画面: 入力内容を一覧表示 + 「戻る」「送信する」ボタン
   - 各項目を dl/dt/dd または table で表示
   - 修正ボタンを押すと入力画面に戻る（入力値は保持）
3. 完了画面: 「送信が完了しました」メッセージ + 完了アイコン（CSSのみで作成）

■ 送信ボタン
- disabled状態: opacity: 0.4, cursor: not-allowed（未入力時）
- hover: background-colorを少し暗く（filter: brightness(0.92)）
- クリック時: テキストを「送信中...」に変更 + ボタン内にCSSスピナー表示
- 送信完了後: ボタンを非表示にし、完了画面へ遷移

■ インタラクション
- 全てのtransition: 150ms ease（色変化、ボーダー変化）
- ラベルクリックでフォーカス（for属性とid紐付け）
- フォーカス時: border-colorをprimaryに、outline: none
- placeholder: color: var(--color-text-muted)
- select: appearance: noneでカスタムスタイル、右端に▼アイコン（CSS擬似要素）
- radio/checkbox: カスタムスタイル（accent-color: var(--color-primary)）
- textarea: resize: vertical, min-height: 120px

■ アクセシビリティ
- 必須フィールド: aria-required="true"、ラベルに「*」マーク（color: var(--color-error)）
- エラー時: aria-invalid="true", aria-describedby でエラーメッセージとリンク
- フォーム全体: role="form", aria-label="お問い合わせフォーム"
- 確認画面: role="alert" で読み上げ対応
- 完了画面: role="status"
- TabIndex: 自然な順序（DOMの順番通り）

■ プログレスインジケーター
- 画面上部に3ステップのプログレスバーを配置
- ステップ: 「入力」→「確認」→「完了」
- 現在のステップを視覚的に強調（primary色 + font-weight: bold）
- ステップ間のライン: 完了したステップは primary色、未完了はborder色\n`;

    // フォーム送信API連携の指示
    if (enableFormSubmission) {
      prompt += `
■ フォーム送信API連携（必須実装）
確認画面の「送信する」ボタン押下時に、以下のAPIにデータを送信すること:

【API仕様】
- URL: /api/form-submissions
- Method: POST
- Content-Type: application/json
- Body形式:
  {
    "pageSlug": window.location.pathname.split('/').pop() || "unknown",
    "formTitle": "お問い合わせ",
    "formFields": [
      { "fieldName": "フィールドのname属性", "fieldLabel": "表示ラベル", "value": "入力値" },
      ...各フィールド分
    ]
  }

【実装例】
async function submitForm(formData) {
  const response = await fetch('/api/form-submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pageSlug: window.location.pathname.split('/').pop() || 'unknown',
      formTitle: 'お問い合わせ',
      formFields: Object.entries(formData).map(([key, value]) => ({
        fieldName: key,
        fieldLabel: document.querySelector(\`label[for="\${key}"]\`)?.textContent?.replace('*', '').trim() || key,
        value: String(value)
      }))
    })
  });
  return response.json();
}

【送信処理フロー】
1. 送信ボタンをdisabledにし、「送信中...」表示
2. fetch APIでPOSTリクエスト
3. 成功時（response.ok）: 完了画面へ遷移
4. 失敗時: エラーメッセージを表示し、再送信可能に
5. ネットワークエラー: try-catchで捕捉し、ユーザーにリトライを促す\n`;
    }
  }

  return prompt;
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'contact-form',
    name: 'お問い合わせフォーム',
    description: 'カスタムフィールド対応 / 確認画面付き',
    icon: 'FORM',
    hasFormFields: true,
    templatePrompt: `【テンプレート: お問い合わせフォーム】
- ページ上部にシンプルな見出し（h1: "お問い合わせ"程度）
- 見出し下にリード文（1行: "下記フォームよりお気軽にお問い合わせください"）
- フォームエリアは余白たっぷりで、詰まった印象を与えないこと
- 送信後の完了画面には「2営業日以内にご連絡いたします」のようなメッセージを含める
- フッターやヘッダーは不要（LPの一部として埋め込まれるため）
- body直下のpadding: 40px〜60px`,
    defaultUserPrompt: 'お問い合わせフォームを作成してください。定義されたフィールドで構成し、入力→確認→完了の3ステップフローにしてください。',
    defaultFields: [
      { id: 'company', label: '会社名', type: 'text', required: false, placeholder: '株式会社〇〇', halfWidth: true },
      { id: 'name', label: 'お名前', type: 'text', required: true, placeholder: '山田 太郎', halfWidth: true },
      { id: 'email', label: 'メールアドレス', type: 'email', required: true, placeholder: 'example@company.co.jp' },
      { id: 'phone', label: '電話番号', type: 'tel', required: false, placeholder: '03-0000-0000' },
      { id: 'subject', label: 'お問い合わせ種別', type: 'select', required: true, options: ['サービスについて', 'お見積もり依頼', '採用について', 'その他'] },
      { id: 'message', label: 'お問い合わせ内容', type: 'textarea', required: true, placeholder: 'お問い合わせ内容をご記入ください' },
      { id: 'remarks', label: '備考・ご要望（任意）', type: 'textarea', required: false, placeholder: '納期のご希望や参考URLなど、何でもご自由にご記入ください' },
    ],
  },
  {
    id: 'booking-form',
    name: '予約フォーム',
    description: '日時選択 / メニュー選択 / 確認画面付き',
    icon: 'BOOK',
    hasFormFields: true,
    templatePrompt: `【テンプレート: 予約フォーム】
- ページ上部にシンプルな見出し（h1: "ご予約"）
- 見出し下にリード文（"ご希望の日時とメニューをお選びください"）
- 日付選択はinput[type=date]を使用（min属性で今日以降のみ選択可）
- 時間選択はinput[type=time]を使用（step=1800 で30分刻み、09:00〜20:00）
- メニュー選択にはそれぞれの所要時間を併記するのが望ましい
- 確認画面では選択日時を読みやすいフォーマットで表示（例: 2025年1月15日(水) 14:00〜）
- 完了画面には「ご予約を受け付けました。確認メールをお送りしました。」的メッセージ
- フッターやヘッダーは不要
- body直下のpadding: 40px〜60px`,
    defaultUserPrompt: '予約フォームを作成してください。日時選択、メニュー選択、お客様情報入力を含め、確認→完了の流れにしてください。',
    defaultFields: [
      { id: 'name', label: 'お名前', type: 'text', required: true, placeholder: '山田 太郎', halfWidth: true },
      { id: 'phone', label: '電話番号', type: 'tel', required: true, placeholder: '090-0000-0000', halfWidth: true },
      { id: 'email', label: 'メールアドレス', type: 'email', required: true, placeholder: 'example@mail.com' },
      { id: 'date', label: 'ご希望日', type: 'date', required: true, halfWidth: true },
      { id: 'time', label: 'ご希望時間', type: 'time', required: true, halfWidth: true },
      { id: 'menu', label: 'メニュー', type: 'select', required: true, options: ['カット（60分）', 'カット+カラー（120分）', 'パーマ（90分）', 'トリートメント（45分）', 'ヘッドスパ（30分）'] },
      { id: 'requests', label: '人数', type: 'select', required: false, options: ['1名', '2名', '3名', '4名以上'] },
      { id: 'remarks', label: 'ご要望・備考', type: 'textarea', required: false, placeholder: 'アレルギー、ご希望のスタイル、初めてのご来店かどうか等、お気軽にご記入ください' },
    ],
  },
  {
    id: 'landing-page',
    name: 'ランディングページ',
    description: 'コンバージョン重視のLP',
    icon: 'LP',
    hasFormFields: false,
    templatePrompt: `【テンプレート: ランディングページ】
- ヒーローセクション: 大きなキャッチコピー（2行以内） + サブコピー + CTAボタン
- 特徴セクション: 3〜4項目、アイコンは使わずテキストと数字で表現
- 実績/お客様の声: 具体的な数字や短い引用文
- CTAセクション: ヒーローとは違うアプローチのCTA
- フッター: 最小限（コピーライトのみ）
- 各セクション間に十分な余白（80px〜120px）
- スクロールで自然に読み進められる構成`,
    defaultUserPrompt: 'プログラミングスクールのランディングページを作成してください。「3ヶ月で転職を実現」のようなキャッチコピー、具体的な数字を使った特徴紹介（受講生数、転職率等）、受講生の声2〜3件、申込ボタンを含めてください。',
  },
  {
    id: 'portfolio',
    name: 'ポートフォリオ',
    description: '作品紹介サイト',
    icon: 'PORT',
    hasFormFields: false,
    templatePrompt: `【テンプレート: ポートフォリオ】
- ヘッダー: 名前のみ大きく表示、ナビゲーション控えめ
- 自己紹介: 3〜4行の簡潔なテキスト
- 作品一覧: グリッドレイアウト（2〜3列）、各作品はplaceholder画像 + タイトル + 説明1行
- hover: 控えめなスケールまたはopacity変化のみ
- スキルセクション: バー表示ではなくテキストリスト（技術名: 経験年数）のシンプル表記
- コンタクト: メールアドレスまたはSNSリンクをテキストで`,
    defaultUserPrompt: 'Webデザイナーのポートフォリオサイトを作成してください。プロフィール、作品6件分のグリッド（placeholder画像使用）、スキル一覧、コンタクト情報を含めてください。',
  },
  {
    id: 'custom',
    name: 'カスタム',
    description: '自由にプロンプト入力',
    icon: 'FREE',
    hasFormFields: false,
    templatePrompt: '',
    defaultUserPrompt: '',
  },
];

export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find(t => t.id === id);
}
