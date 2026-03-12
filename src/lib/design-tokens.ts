/**
 * デザイントークン生成・管理モジュール
 *
 * セグメント間のデザイン一貫性を保証するため、
 * 最初にデザイントークンを生成し、各セグメント処理で使用する
 */

import { DesignTokens, DesignTokensGenerationResult } from '@/types';
import { googleAIUrl, googleAIHeaders } from '@/lib/google-ai';

// ========================================
// デフォルトトークン定義（スタイル別）
// ========================================

export const DEFAULT_TOKENS: Record<string, DesignTokens> = {
    sampling: {
        colors: {
            primary: '#3B82F6',
            secondary: '#1E40AF',
            accent: '#60A5FA',
            background: '#FFFFFF',
            text: '#1F2937',
            muted: '#6B7280',
        },
        typography: {
            headingStyle: 'gothic',
            bodyStyle: 'gothic',
            headingWeight: 'bold',
            lineHeight: 'normal',
        },
        spacing: {
            density: 'normal',
            sectionPadding: 'medium',
        },
        components: {
            buttonStyle: 'rounded',
            buttonRadius: '8px',
            shadowDepth: 'subtle',
            borderStyle: 'none',
        },
        effects: {
            gradients: false,
            animations: false,
            glassmorphism: false,
        },
    },
    professional: {
        colors: {
            primary: '#1E3A5F',
            secondary: '#2C5282',
            accent: '#4299E1',
            background: '#FFFFFF',
            text: '#1A202C',
            muted: '#718096',
        },
        typography: {
            headingStyle: 'gothic',
            bodyStyle: 'gothic',
            headingWeight: 'bold',
            lineHeight: 'relaxed',
        },
        spacing: {
            density: 'normal',
            sectionPadding: 'large',
        },
        components: {
            buttonStyle: 'rounded',
            buttonRadius: '6px',
            shadowDepth: 'subtle',
            borderStyle: 'subtle',
        },
        effects: {
            gradients: false,
            animations: false,
            glassmorphism: false,
        },
    },
    pops: {
        colors: {
            primary: '#EC4899',
            secondary: '#F97316',
            accent: '#8B5CF6',
            background: '#FEFCE8',
            text: '#1F2937',
            muted: '#6B7280',
        },
        typography: {
            headingStyle: 'rounded',
            bodyStyle: 'gothic',
            headingWeight: 'extrabold',
            lineHeight: 'normal',
        },
        spacing: {
            density: 'normal',
            sectionPadding: 'medium',
        },
        components: {
            buttonStyle: 'pill',
            buttonRadius: '9999px',
            shadowDepth: 'medium',
            borderStyle: 'none',
        },
        effects: {
            gradients: true,
            animations: true,
            glassmorphism: false,
        },
    },
    luxury: {
        colors: {
            primary: '#000000',
            secondary: '#1F2937',
            accent: '#D4AF37',
            background: '#FAFAFA',
            text: '#111827',
            muted: '#4B5563',
        },
        typography: {
            headingStyle: 'mincho',
            bodyStyle: 'gothic',
            headingWeight: 'normal',
            lineHeight: 'relaxed',
        },
        spacing: {
            density: 'spacious',
            sectionPadding: 'large',
        },
        components: {
            buttonStyle: 'square',
            buttonRadius: '0px',
            shadowDepth: 'none',
            borderStyle: 'prominent',
        },
        effects: {
            gradients: false,
            animations: false,
            glassmorphism: false,
        },
    },
    minimal: {
        colors: {
            primary: '#111827',
            secondary: '#374151',
            accent: '#3B82F6',
            background: '#FFFFFF',
            text: '#111827',
            muted: '#9CA3AF',
        },
        typography: {
            headingStyle: 'gothic',
            bodyStyle: 'gothic',
            headingWeight: 'medium',
            lineHeight: 'relaxed',
        },
        spacing: {
            density: 'spacious',
            sectionPadding: 'large',
        },
        components: {
            buttonStyle: 'square',
            buttonRadius: '4px',
            shadowDepth: 'none',
            borderStyle: 'subtle',
        },
        effects: {
            gradients: false,
            animations: false,
            glassmorphism: false,
        },
    },
    emotional: {
        colors: {
            primary: '#C41E3A',
            secondary: '#991B1B',
            accent: '#F97316',
            background: '#FFFBEB',
            text: '#1F2937',
            muted: '#6B7280',
        },
        typography: {
            headingStyle: 'gothic',
            bodyStyle: 'gothic',
            headingWeight: 'extrabold',
            lineHeight: 'tight',
        },
        spacing: {
            density: 'compact',
            sectionPadding: 'medium',
        },
        components: {
            buttonStyle: 'rounded',
            buttonRadius: '12px',
            shadowDepth: 'strong',
            borderStyle: 'none',
        },
        effects: {
            gradients: true,
            animations: true,
            glassmorphism: false,
        },
    },
};

// ========================================
// カラースキーム適用
// ========================================

export function applyColorScheme(
    tokens: DesignTokens,
    colorScheme: string
): DesignTokens {
    const colorOverrides: Record<string, Partial<DesignTokens['colors']>> = {
        original: {},
        blue: {
            primary: '#3B82F6',
            secondary: '#1E40AF',
            accent: '#60A5FA',
            background: '#F0F9FF',
        },
        green: {
            primary: '#22C55E',
            secondary: '#15803D',
            accent: '#86EFAC',
            background: '#F0FDF4',
        },
        purple: {
            primary: '#A855F7',
            secondary: '#7C3AED',
            accent: '#C4B5FD',
            background: '#FAF5FF',
        },
        orange: {
            primary: '#F97316',
            secondary: '#EA580C',
            accent: '#FDBA74',
            background: '#FFF7ED',
        },
        monochrome: {
            primary: '#000000',
            secondary: '#374151',
            accent: '#6B7280',
            background: '#FFFFFF',
            text: '#000000',
            muted: '#9CA3AF',
        },
    };

    const override = colorOverrides[colorScheme] || {};

    return {
        ...tokens,
        colors: {
            ...tokens.colors,
            ...override,
        },
    };
}

// ========================================
// レイアウトオプション適用
// ========================================

export function applyLayoutOption(
    tokens: DesignTokens,
    layoutOption: string
): DesignTokens {
    switch (layoutOption) {
        case 'modernize':
            return {
                ...tokens,
                spacing: {
                    density: 'spacious',
                    sectionPadding: 'large',
                },
            };
        case 'compact':
            return {
                ...tokens,
                spacing: {
                    density: 'compact',
                    sectionPadding: 'small',
                },
            };
        default:
            return tokens;
    }
}

// ========================================
// AI によるデザイントークン抽出
// ========================================

const DESIGN_TOKEN_EXTRACTION_PROMPT = `あなたはWebデザインの専門家です。
与えられた画像（Webページのスクリーンショット）を分析し、デザインシステムのトークンを抽出してください。

【抽出するトークン】
1. colors: 使用されている主要な色（HEXコード）
   - primary: メインカラー
   - secondary: サブカラー
   - accent: アクセントカラー
   - background: 主な背景色
   - text: 主なテキスト色
   - muted: 薄いテキスト色

2. typography: タイポグラフィ設定
   - headingStyle: 見出しフォント（gothic/mincho/rounded）
   - bodyStyle: 本文フォント（gothic/mincho/rounded）
   - headingWeight: 見出しの太さ（normal/medium/bold/extrabold）
   - lineHeight: 行間（tight/normal/relaxed）

3. spacing: 余白設定
   - density: 余白の密度（compact/normal/spacious）
   - sectionPadding: セクション間の余白（small/medium/large）

4. components: コンポーネント設定
   - buttonStyle: ボタン形状（rounded/pill/square）
   - buttonRadius: 具体的な角丸（例: 8px）
   - shadowDepth: シャドウの深さ（none/subtle/medium/strong）
   - borderStyle: ボーダースタイル（none/subtle/prominent）

5. effects: 視覚効果
   - gradients: グラデーション使用（true/false）
   - animations: アニメーション効果（true/false）
   - glassmorphism: ガラス効果（true/false）

【出力形式】
必ず以下のJSON形式で出力してください：
{
  "colors": { "primary": "#...", "secondary": "#...", "accent": "#...", "background": "#...", "text": "#...", "muted": "#..." },
  "typography": { "headingStyle": "...", "bodyStyle": "...", "headingWeight": "...", "lineHeight": "..." },
  "spacing": { "density": "...", "sectionPadding": "..." },
  "components": { "buttonStyle": "...", "buttonRadius": "...", "shadowDepth": "...", "borderStyle": "..." },
  "effects": { "gradients": false, "animations": false, "glassmorphism": false }
}`;

/**
 * 画像からデザイントークンを抽出する
 */
export async function extractDesignTokensFromImage(
    imageBuffer: Buffer,
    apiKey: string
): Promise<DesignTokensGenerationResult> {
    try {
        const base64Data = imageBuffer.toString('base64');

        const response = await fetch(
            googleAIUrl('gemini-2.0-flash'),
            {
                method: 'POST',
                headers: googleAIHeaders(apiKey),
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: 'image/png', data: base64Data } },
                            { text: DESIGN_TOKEN_EXTRACTION_PROMPT }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,  // 低温度で一貫性のある出力
                        maxOutputTokens: 1024,
                    },
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[DesignTokens] API error:', errorText);
            return { success: false, error: `API error: ${response.status}` };
        }

        const data = await response.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textContent) {
            return { success: false, error: 'No response from AI' };
        }

        // JSONを抽出してパース
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { success: false, error: 'Failed to parse JSON from response' };
        }

        const tokens = JSON.parse(jsonMatch[0]) as DesignTokens;

        // バリデーション
        if (!tokens.colors || !tokens.typography || !tokens.spacing || !tokens.components || !tokens.effects) {
            return { success: false, error: 'Invalid token structure' };
        }

        console.log('[DesignTokens] Successfully extracted tokens:', tokens.colors);
        return { success: true, tokens };

    } catch (error: any) {
        console.error('[DesignTokens] Error:', error.message);
        return { success: false, error: error.message };
    }
}

// ========================================
// デザイントークンをプロンプトに変換
// ========================================

export function tokensToPromptDescription(tokens: DesignTokens): string {
    return `【デザイントークン - 全セグメントで統一してください】

■ カラーパレット（必ずこの色を使用）
- メインカラー: ${tokens.colors.primary}
- サブカラー: ${tokens.colors.secondary}
- アクセント: ${tokens.colors.accent}
- 背景色: ${tokens.colors.background}
- テキスト色: ${tokens.colors.text}
- 薄いテキスト: ${tokens.colors.muted}

■ タイポグラフィ
- 見出し: ${tokens.typography.headingStyle === 'mincho' ? '明朝体' : tokens.typography.headingStyle === 'rounded' ? '丸ゴシック' : 'ゴシック体'}、${tokens.typography.headingWeight === 'extrabold' ? '極太' : tokens.typography.headingWeight === 'bold' ? '太字' : tokens.typography.headingWeight === 'medium' ? '中太' : '標準'}
- 本文: ${tokens.typography.bodyStyle === 'mincho' ? '明朝体' : tokens.typography.bodyStyle === 'rounded' ? '丸ゴシック' : 'ゴシック体'}
- 行間: ${tokens.typography.lineHeight === 'tight' ? '詰め' : tokens.typography.lineHeight === 'relaxed' ? '広め' : '標準'}

■ 余白・レイアウト
- 密度: ${tokens.spacing.density === 'compact' ? 'コンパクト（余白少なめ）' : tokens.spacing.density === 'spacious' ? 'ゆったり（余白多め）' : '標準'}
- セクション間: ${tokens.spacing.sectionPadding === 'small' ? '狭め' : tokens.spacing.sectionPadding === 'large' ? '広め' : '標準'}

■ コンポーネント
- ボタン形状: ${tokens.components.buttonStyle === 'pill' ? '完全丸型(pill)' : tokens.components.buttonStyle === 'square' ? '四角' : '角丸'}、角丸=${tokens.components.buttonRadius}
- シャドウ: ${tokens.components.shadowDepth === 'none' ? 'なし' : tokens.components.shadowDepth === 'subtle' ? '薄い' : tokens.components.shadowDepth === 'strong' ? '強い' : '中程度'}
- ボーダー: ${tokens.components.borderStyle === 'none' ? 'なし' : tokens.components.borderStyle === 'prominent' ? '目立つ' : '薄い'}

■ エフェクト
- グラデーション: ${tokens.effects.gradients ? '使用する' : '使用しない'}
- アニメーション感: ${tokens.effects.animations ? 'あり' : 'なし'}
- ガラス効果: ${tokens.effects.glassmorphism ? '使用する' : '使用しない'}`;
}

// ========================================
// スタイルとオプションからトークン生成
// ========================================

export function generateDesignTokens(
    style: string,
    colorScheme?: string,
    layoutOption?: string
): DesignTokens {
    // ベーストークンを取得
    let tokens = DEFAULT_TOKENS[style] || DEFAULT_TOKENS.professional;

    // カラースキームを適用
    if (colorScheme && colorScheme !== 'original') {
        tokens = applyColorScheme(tokens, colorScheme);
    }

    // レイアウトオプションを適用
    if (layoutOption && layoutOption !== 'keep') {
        tokens = applyLayoutOption(tokens, layoutOption);
    }

    return tokens;
}
