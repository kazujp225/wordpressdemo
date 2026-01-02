// ========================================
// Core Types for LP Builder
// ========================================

// Section Types
export type SectionType = 'hero' | 'features' | 'pricing' | 'faq' | 'cta' | 'testimonials';

// Viewport Types (for dual desktop/mobile editing)
export type ViewportType = 'desktop' | 'mobile';

// Form Field Configuration (for form-input action type)
export interface FormFieldConfig {
    id: string;
    fieldName: string;      // Internal field name (e.g., 'name', 'email')
    fieldLabel: string;     // Display label (e.g., 'お名前', 'メールアドレス')
    fieldType: 'text' | 'email' | 'tel' | 'textarea';
    required: boolean;
    placeholder?: string;
}

// Clickable Area Types (for image hotspots/buttons/forms)
export interface ClickableArea {
    id: string;
    x: number;      // 0-1 relative coordinate (from left)
    y: number;      // 0-1 relative coordinate (from top)
    width: number;  // 0-1 relative width
    height: number; // 0-1 relative height
    actionType: 'url' | 'email' | 'phone' | 'scroll' | 'form-input';
    actionValue: string;  // URL, email address, phone number, or section ID
    label?: string;       // Hover text / button label
    // Form-input specific fields
    formTitle?: string;           // Form modal title
    formFields?: FormFieldConfig[]; // Form fields configuration
}

export interface SectionProperties {
    title?: string;
    subtitle?: string;
    description?: string;
    text?: string;
    backgroundColor?: string;
    textColor?: string;
    clickableAreas?: ClickableArea[];        // Desktop clickable areas
    mobileClickableAreas?: ClickableArea[];  // Mobile clickable areas
}

export interface SectionImage {
    id: number;
    filePath: string;
    width?: number | null;
    height?: number | null;
    mime: string;
    prompt?: string | null;
}

export interface Section {
    id: string;
    type: SectionType;
    name: string;
    role: string;
    order: number;
    // Desktop image (existing)
    imageId?: number | null;
    image?: SectionImage | null;
    // Mobile image (new)
    mobileImageId?: number | null;
    mobileImage?: SectionImage | null;
    config?: SectionProperties | null;
    properties?: SectionProperties;
}

// Page Types
export type PageStatus = 'draft' | 'published';

export interface Page {
    id: number;
    userId?: string | null;
    title: string;
    slug: string;
    status: PageStatus;
    templateId: string;
    isFavorite: boolean;
    createdAt: string;
    updatedAt: string;
    sections?: Section[];
}

export interface PageListItem {
    id: number;
    title: string;
    slug: string;
    status: PageStatus;
    isFavorite: boolean;
    updatedAt: string;
    sections?: Array<{
        image?: {
            filePath: string;
        } | null;
    }>;
}

// Header/Navigation Types
export interface NavItem {
    id: string;
    label: string;
    href: string;
}

export interface HeaderConfig {
    logoText: string;
    sticky: boolean;
    ctaText: string;
    ctaLink: string;
    navItems: NavItem[];
}

// Media Types
export interface MediaImage {
    id: number;
    userId?: string | null;
    filePath: string;
    width?: number | null;
    height?: number | null;
    mime: string;
    prompt?: string | null;
    hash?: string | null;
    sourceUrl?: string | null;
    sourceType?: 'import' | 'ai-generate' | 'upload' | null;
    createdAt: string;
}

// API Response Types
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

// Generation Types
export type GenerationType =
    | 'copy'
    | 'image'
    | 'inpaint'
    | 'edit-image'
    | 'prompt-copilot'
    | 'review'
    | 'image-to-prompt'
    | 'generate-nav'
    | 'chat-edit'
    | 'lp-generate'
    | 'import-arrange'
    | 'design-analysis'
    | 'boundary-connector'
    | 'boundary-design';

export interface GenerationRun {
    id: number;
    userId?: string | null;
    type: GenerationType;
    endpoint?: string | null;
    model: string;
    inputPrompt: string;
    outputResult?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    imageCount?: number | null;
    estimatedCost?: number | null;
    status: 'succeeded' | 'failed';
    errorMessage?: string | null;
    durationMs?: number | null;
    createdAt: string;
}

// User Types
export type UserPlan = 'normal' | 'premium';

export interface UserSettings {
    id: number;
    userId: string;
    email?: string | null;
    plan: UserPlan;
    googleApiKey?: string | null;
    createdAt: string;
    updatedAt: string;
}

// Business Info for LP Generation
export interface BusinessInfo {
    businessName: string;
    service: string;
    target: string;
    strength: string;
    price?: string;
    style: 'professional' | 'pops' | 'luxury' | 'minimal' | 'emotional';
}

// ========================================
// Design Token Types (for consistent styling across segments)
// ========================================

export interface DesignTokens {
    // Colors
    colors: {
        primary: string;      // メインカラー (例: #3B82F6)
        secondary: string;    // サブカラー (例: #1E40AF)
        accent: string;       // アクセントカラー (例: #60A5FA)
        background: string;   // 背景色 (例: #FFFFFF)
        text: string;         // テキスト色 (例: #1F2937)
        muted: string;        // 薄いテキスト色 (例: #6B7280)
    };
    // Typography
    typography: {
        headingStyle: 'gothic' | 'mincho' | 'rounded';  // 見出しフォントスタイル
        bodyStyle: 'gothic' | 'mincho' | 'rounded';     // 本文フォントスタイル
        headingWeight: 'normal' | 'medium' | 'bold' | 'extrabold';
        lineHeight: 'tight' | 'normal' | 'relaxed';
    };
    // Spacing & Layout
    spacing: {
        density: 'compact' | 'normal' | 'spacious';     // 余白の密度
        sectionPadding: 'small' | 'medium' | 'large';   // セクション間パディング
    };
    // Components
    components: {
        buttonStyle: 'rounded' | 'pill' | 'square';     // ボタン形状
        buttonRadius: string;                            // 具体的な角丸 (例: 8px)
        shadowDepth: 'none' | 'subtle' | 'medium' | 'strong';
        borderStyle: 'none' | 'subtle' | 'prominent';
    };
    // Effects
    effects: {
        gradients: boolean;           // グラデーション使用
        animations: boolean;          // アニメーション使用
        glassmorphism: boolean;       // ガラス効果
    };
}

export interface DesignTokensGenerationResult {
    success: boolean;
    tokens?: DesignTokens;
    error?: string;
}

// LP Builder Section (for editing)
export interface LPSection {
    id: string;
    type: string;
    name: string;
    properties: {
        title?: string;
        subtitle?: string;
        description?: string;
        image?: string;
        backgroundColor?: string;
        textColor?: string;
        [key: string]: unknown;
    };
    imageId?: number | null;
}

// Existing Page for Page Selector
export interface ExistingPage {
    id: number;
    title: string;
    slug: string;
    status: string;
    updatedAt: string;
    sections: unknown[];
}

// Stats Types
export interface UsageStats {
    period: {
        days: number;
        startDate: string;
        endDate: string;
    };
    summary: {
        totalCalls: number;
        totalCost: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalImages: number;
        avgDurationMs: number;
    };
    daily: Array<{
        date: string;
        count: number;
        cost: number;
        errors: number;
    }>;
    byModel: Array<{
        model: string;
        count: number;
        cost: number;
        images: number;
    }>;
    byType: Array<{
        type: string;
        count: number;
        cost: number;
        images: number;
    }>;
    errorRate: {
        total: number;
        failed: number;
        rate: number;
    };
}
