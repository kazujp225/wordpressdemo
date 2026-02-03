import { z } from 'zod';

// ========================================
// Validation Schemas
// ========================================

// Business Info Schema (LP Generation)
export const businessInfoSchema = z.object({
    businessName: z.string().min(1, '会社名は必須です'),
    industry: z.string().optional(),
    service: z.string().min(10, 'サービス概要は10文字以上で入力してください'),
    target: z.string().min(5, 'ターゲット顧客は5文字以上で入力してください'),
    strengths: z.string().min(5, '強み・特徴は5文字以上で入力してください'),
    differentiators: z.string().optional(),
    priceRange: z.string().optional(),
    tone: z.enum(['professional', 'friendly', 'luxury', 'energetic']).optional(),
});

export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;

// Page Schema
export const pageSchema = z.object({
    title: z.string().min(1, 'タイトルは必須です'),
    slug: z.string().min(1, 'スラッグは必須です').regex(/^[a-z0-9-]+$/, 'スラッグは英小文字、数字、ハイフンのみ使用可能です'),
    status: z.enum(['draft', 'published']).default('draft'),
});

export type PageInput = z.infer<typeof pageSchema>;

// Section Schema
export const sectionSchema = z.object({
    id: z.string(),
    type: z.enum(['hero', 'features', 'pricing', 'faq', 'cta', 'testimonials', 'problem', 'solution', 'benefits', 'process', 'guarantee', 'offer', 'custom']),
    name: z.string(),
    role: z.string(),
    order: z.number().int().min(0),
    imageId: z.number().nullable().optional(),
    config: z.object({
        title: z.string().optional(),
        subtitle: z.string().optional(),
        description: z.string().optional(),
        text: z.string().optional(),
        backgroundColor: z.string().optional(),
        textColor: z.string().optional(),
    }).nullable().optional(),
});

export type SectionInput = z.infer<typeof sectionSchema>;

// Header Config Schema
export const headerConfigSchema = z.object({
    logoText: z.string().min(1, 'ロゴテキストは必須です'),
    sticky: z.boolean().default(true),
    ctaText: z.string().default('お問い合わせ'),
    ctaLink: z.string().default('#contact'),
    navItems: z.array(z.object({
        id: z.string(),
        label: z.string(),
        href: z.string(),
    })).default([]),
});

export type HeaderConfigInput = z.infer<typeof headerConfigSchema>;

// Image Generation Schema
export const imageGenerationSchema = z.object({
    prompt: z.string().min(5, 'プロンプトは5文字以上で入力してください'),
    taste: z.string().optional(),
    brandInfo: z.string().optional(),
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).optional(),
});

export type ImageGenerationInput = z.infer<typeof imageGenerationSchema>;

// カスタムセクション境界のスキーマ
const customSectionSchema = z.object({
    index: z.number(),
    startY: z.number(),
    endY: z.number(),
    height: z.number(),
    label: z.string(),
    confidence: z.number().optional(),
});

// Import URL Schema
export const importUrlSchema = z.object({
    url: z.string().url('有効なURLを入力してください'),
    device: z.enum(['desktop', 'mobile']).default('desktop'),
    importMode: z.enum(['faithful', 'light', 'heavy']).default('faithful'),
    style: z.enum(['sampling', 'professional', 'pops', 'luxury', 'minimal', 'emotional']).optional(),
    colorScheme: z.enum(['original', 'blue', 'green', 'purple', 'orange', 'monochrome']).optional(),
    layoutOption: z.enum(['keep', 'modernize', 'compact']).optional(),
    customPrompt: z.string().max(500, 'カスタムプロンプトは500文字以内で入力してください').optional(),
    customSections: z.array(customSectionSchema).optional(), // ユーザーが調整したセクション境界
    startFrom: z.number().int().min(0).optional(), // 続きを取得用：開始セクション番号
});

export type ImportUrlInput = z.infer<typeof importUrlSchema>;

// User Settings Schema
export const userSettingsSchema = z.object({
    googleApiKey: z.string().optional(),
    plan: z.enum(['normal', 'premium']).optional(),
});

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;

// Page Update Schema (for PATCH requests)
export const pageUpdateSchema = z.object({
    title: z.string().min(1, 'タイトルは必須です').optional(),
    slug: z.string().regex(/^[a-z0-9-]+$/, 'スラッグは英小文字、数字、ハイフンのみ使用可能です').optional(),
    status: z.enum(['draft', 'published']).optional(),
    isFavorite: z.boolean().optional(),
});

export type PageUpdateInput = z.infer<typeof pageUpdateSchema>;

// Page Sections Update Schema (for PUT requests)
export const pageSectionsUpdateSchema = z.object({
    sections: z.array(z.object({
        role: z.string(),
        imageId: z.union([z.number(), z.string()]).nullable().optional().transform(v => v ? Number(v) : null),
        mobileImageId: z.union([z.number(), z.string()]).nullable().optional().transform(v => v ? Number(v) : null),
        config: z.record(z.string(), z.unknown()).nullable().optional(),
        boundaryOffsetTop: z.number().optional(),
        boundaryOffsetBottom: z.number().optional(),
    }).passthrough()), // passthrough allows additional fields
    headerConfig: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(['draft', 'published']).optional(),
    designDefinition: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type PageSectionsUpdateInput = z.infer<typeof pageSectionsUpdateSchema>;

// Navigation Config Schema
export const navigationConfigSchema = z.object({
    logoText: z.string().min(1),
    sticky: z.boolean(),
    ctaText: z.string(),
    ctaLink: z.string(),
    navItems: z.array(z.object({
        id: z.string(),
        label: z.string(),
        href: z.string(),
    })),
});

export type NavigationConfigInput = z.infer<typeof navigationConfigSchema>;

// AI Suggest Benefits Request Schema
export const suggestBenefitsSchema = z.object({
    // 基本情報
    businessName: z.string().min(1, '会社名は必須です'),
    industry: z.string().min(1, '業種は必須です'),
    businessType: z.string().min(1, 'ビジネスモデルは必須です'),
    // 商品情報
    productName: z.string().min(1, '商品名は必須です'),
    productDescription: z.string().min(10, '商品説明は10文字以上で入力してください'),
    productCategory: z.string().min(1, 'カテゴリは必須です'),
    priceInfo: z.string().optional(),
    deliveryMethod: z.string().optional(),
    // ターゲット情報
    targetAudience: z.string().min(5, 'ターゲット層は5文字以上で入力してください'),
    targetAge: z.string().optional(),
    targetGender: z.string().optional(),
    targetOccupation: z.string().optional(),
    painPoints: z.string().min(10, '課題・悩みは10文字以上で入力してください'),
    desiredOutcome: z.string().min(10, '理想の状態は10文字以上で入力してください'),
    // 生成対象
    generateType: z.enum(['benefits', 'usp', 'socialProof', 'guarantees', 'all']),
});

export type SuggestBenefitsInput = z.infer<typeof suggestBenefitsSchema>;

// Enhanced Context Schema (Text-based LP Generation)
export const enhancedContextSchema = z.object({
    // Product/Service details
    productName: z.string().optional(),
    productDescription: z.string().optional(),
    productCategory: z.string().optional(),
    businessType: z.string().optional(),
    priceInfo: z.string().optional(),
    deliveryMethod: z.string().optional(),
    // Target audience
    targetAudience: z.string().optional(),
    targetAge: z.string().optional(),
    targetGender: z.string().optional(),
    targetOccupation: z.string().optional(),
    targetIncome: z.string().optional(),
    // Core messaging
    painPoints: z.string().optional(),
    desiredOutcome: z.string().optional(),
    mainBenefits: z.string().optional(),
    uniqueSellingPoints: z.string().optional(),
    socialProof: z.string().optional(),
    guarantees: z.string().optional(),
    // CTA and urgency
    conversionGoal: z.enum(['inquiry', 'purchase', 'signup', 'download', 'consultation', 'trial']).optional(),
    ctaText: z.string().optional(),
    urgencyElement: z.string().optional(),
    // Design preferences
    colorPreference: z.string().optional(),
    imageStyle: z.enum(['photo', 'illustration', 'abstract', 'minimal', 'dynamic']).optional(),
}).optional();

export type EnhancedContextInput = z.infer<typeof enhancedContextSchema>;

// Design Definition Schema
export const designDefinitionSchema = z.object({
    vibe: z.string().optional(),
    description: z.string().optional(),
    colorPalette: z.object({
        primary: z.string().optional(),
        secondary: z.string().optional(),
        accent: z.string().optional(),
        background: z.string().optional(),
    }).optional(),
    typography: z.object({
        style: z.string().optional(),
        mood: z.string().optional(),
    }).optional(),
    layout: z.object({
        style: z.string().optional(),
        density: z.string().optional(),
    }).optional(),
    imageStyle: z.enum(['photo', 'illustration', 'abstract', 'minimal', 'dynamic']).optional(),
    colorPreference: z.string().optional(),
}).optional();

export type DesignDefinitionInput = z.infer<typeof designDefinitionSchema>;

// ========================================
// Validation Helper
// ========================================

export function validateRequest<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; error: string; details: z.ZodIssue[] } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    return {
        success: false,
        error: 'Validation failed',
        details: result.error.issues,
    };
}
