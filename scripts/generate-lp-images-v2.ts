import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
    const envPath = path.join(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex);
                const value = trimmed.substring(eqIndex + 1).replace(/^["']|["']$/g, '');
                process.env[key] = value;
            }
        }
    }
}

loadEnv();

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
const PAGE_ID = 49;

// ============================================
// v2: 高品質プロンプト設計
// ============================================

const MASTER_STYLE_PROMPT = `
You are a world-class visual designer specializing in premium landing pages.
Create a stunning, conversion-optimized landing page section image.

【DESIGN PHILOSOPHY】
- Apple-level minimalism meets Stripe's clarity
- Every pixel has purpose
- White space is a design element
- Typography as art

【VISUAL QUALITY STANDARDS】
- 8K render quality
- Cinematic lighting with soft gradients
- Depth through subtle shadows and layering
- Glass morphism effects where appropriate
- Premium texture: subtle grain, soft focus backgrounds

【COLOR SYSTEM】
Primary: #0066FF (Electric Blue)
Secondary: #00D4FF (Cyan accent)
Dark: #0A1628 (Deep navy)
Light: #F8FAFF (Soft white)
Accent: #FF6B35 (CTA Orange)

【TYPOGRAPHY RULES】
- Headlines: Bold, high contrast, max 8 words
- Subheadlines: Medium weight, supporting context
- NO paragraphs of text - this is visual design
- Japanese text must be crisp and readable

【LAYOUT PRINCIPLES】
- Golden ratio composition
- Clear visual hierarchy
- Breathing room around text
- Bottom 15% transitions smoothly to next section

【ABSOLUTE PROHIBITIONS】
- No generic stock photo people
- No clip art or cheap graphics
- No cluttered backgrounds
- No random floating code snippets
- No text longer than 2 lines per element
`;

function getHighQualityPrompt(role: string, headline: string, subheadline: string): string {
    // 短縮されたヘッドライン（最大20文字）
    const shortHeadline = headline.length > 20 ? headline.substring(0, 20) + '...' : headline;
    const shortSub = subheadline.length > 30 ? subheadline.substring(0, 30) + '...' : subheadline;

    const sectionStyles: Record<string, string> = {
        hero: `
【HERO SECTION - First Impression】
Create a breathtaking hero image that stops scrolling instantly.

VISUAL CONCEPT:
- Abstract 3D geometric shapes floating in deep blue space
- Subtle light rays emanating from center
- Glassmorphism card element in upper third (for headline placement)
- Futuristic, premium tech aesthetic
- NO human figures, NO generic AI robots

TEXT TO RENDER:
"${shortHeadline}"
(Large, bold, white text with subtle glow)

"${shortSub}"
(Smaller, lighter weight below)

COMPOSITION:
- Text in upper 40% of image
- Abstract visuals in lower 60%
- Gradient fade at bottom edge for seamless transition
`,

        problem: `
【PROBLEM SECTION - Empathy & Pain Points】
Create a sophisticated visual that represents challenges without being negative.

VISUAL CONCEPT:
- Abstract maze or tangled lines gradually becoming clearer
- Moody but not dark - sophisticated gradient (navy to deep purple)
- Geometric fragments or scattered elements suggesting complexity
- Light source emerging from one direction (hope)

TEXT TO RENDER:
"${shortHeadline}"
(Bold white text, centered)

"${shortSub}"
(Muted white/gray below)

COMPOSITION:
- Text in center
- Abstract elements frame the text
- Smooth gradient transition at top (from previous section) and bottom
`,

        solution: `
【SOLUTION SECTION - Hope & Clarity】
Create an uplifting visual transition from problem to solution.

VISUAL CONCEPT:
- Light breaking through - dawn/sunrise aesthetic
- Clean geometric shapes coming together (puzzle completing)
- Gradient from darker top to bright bottom
- Crystal/prism light refraction effects
- Feeling of breakthrough and clarity

TEXT TO RENDER:
"${shortHeadline}"
(Bold text, gradient from white to light blue)

"${shortSub}"
(Clean, readable)

COMPOSITION:
- Top connects with darker problem section
- Middle has the headline
- Bottom radiates light and hope
`,

        benefits: `
【BENEFITS SECTION - Future Vision】
Create an aspirational visual showing the transformed future.

VISUAL CONCEPT:
- Bright, open composition with depth
- Floating abstract UI elements suggesting success/growth
- Upward momentum - rising shapes, ascending gradients
- Premium blue to white gradient
- Sparkles or light particles suggesting achievement

TEXT TO RENDER:
"${shortHeadline}"
(Bold, confident typography)

"${shortSub}"
(Supporting text)

COMPOSITION:
- Expansive feel, lots of breathing room
- Text in upper portion
- Visual elements suggest upward growth
`,

        features: `
【FEATURES SECTION - Product Showcase】
Create a clean, organized visual for feature presentation.

VISUAL CONCEPT:
- Minimalist grid-inspired background
- 3 floating glassmorphism cards (empty, for feature content overlay)
- Subtle connecting lines between cards
- Clean, Stripe-like aesthetic
- Soft shadows for depth

TEXT TO RENDER:
"${shortHeadline}"
(Centered at top, bold)

COMPOSITION:
- Headline at top 20%
- Three card areas in middle 60%
- Clean fade at bottom
`,

        testimonials: `
【TESTIMONIALS SECTION - Social Proof】
Create a warm, trustworthy visual for customer stories.

VISUAL CONCEPT:
- Soft, warm gradient (light blue to soft lavender)
- Abstract speech bubble or quote shapes
- Gentle, approachable aesthetic
- NO generic avatar icons
- Subtle pattern or texture for warmth

TEXT TO RENDER:
"${shortHeadline}"
(Friendly but professional)

COMPOSITION:
- Headline at top
- Space for 2-3 testimonial cards (abstract placeholders)
- Warm, inviting color palette
`,

        process: `
【PROCESS SECTION - Journey Map】
Create a clear visual showing the path forward.

VISUAL CONCEPT:
- Horizontal or curved path/timeline visualization
- 3 milestone points with subtle glow
- Clean, infographic-style aesthetic
- Numbered steps (1, 2, 3) as design elements
- Progress/forward motion feeling

TEXT TO RENDER:
"${shortHeadline}"
(Clean, instructional tone)

COMPOSITION:
- Headline at top
- Visual journey path in middle
- Each step clearly marked
`,

        guarantee: `
【GUARANTEE SECTION - Trust & Security】
Create a reassuring visual for risk reversal.

VISUAL CONCEPT:
- Shield or protective abstract shape
- Solid, stable composition
- Deep blue conveying trust
- Checkmark or completion symbol integrated subtly
- Premium, bank-level security aesthetic

TEXT TO RENDER:
"${shortHeadline}"
(Confident, reassuring)

COMPOSITION:
- Centered, balanced layout
- Text prominent
- Visual elements support without overwhelming
`,

        pricing: `
【PRICING SECTION - Value Presentation】
Create a clean visual for pricing display.

VISUAL CONCEPT:
- Minimalist, clean background
- Space for pricing card(s)
- Subtle premium touches (gold accent possible)
- Clear, no-nonsense aesthetic
- Professional and trustworthy

TEXT TO RENDER:
"${shortHeadline}"
(Direct, clear)

COMPOSITION:
- Headline at top
- Large central space for pricing cards
- Clean, uncluttered
`,

        faq: `
【FAQ SECTION - Helpful Clarity】
Create a clean, approachable visual for questions.

VISUAL CONCEPT:
- Light, airy composition
- Abstract question mark or speech elements (subtle)
- Friendly gradient (soft blue to white)
- Organized, calm aesthetic
- Easy on the eyes

TEXT TO RENDER:
"${shortHeadline}"
(Helpful, approachable)

COMPOSITION:
- Simple headline at top
- Clean space for Q&A content
- Very light, minimal background
`,

        cta: `
【CTA SECTION - Final Action】
Create an energizing visual that drives action.

VISUAL CONCEPT:
- Dynamic, energetic composition
- Bright accent color burst (orange/coral)
- Prominent button area (rounded rectangle, glowing)
- Sense of urgency and opportunity
- Celebratory, positive energy

TEXT TO RENDER:
"${shortHeadline}"
(Action-oriented, bold)

BUTTON TEXT:
"無料カウンセリングを予約"
(Large orange button with white text, rounded, with glow effect)

COMPOSITION:
- Headline in upper third
- CTA button prominently in center
- Energy radiating from button
- This is the finale - make it compelling
`,
    };

    return MASTER_STYLE_PROMPT + (sectionStyles[role] || sectionStyles.features);
}

// Seam extraction
async function extractSeamStrip(base64Image: string): Promise<string> {
    try {
        const buffer = Buffer.from(base64Image, 'base64');
        const metadata = await sharp(buffer).metadata();
        if (!metadata.width || !metadata.height) return base64Image;

        const stripHeight = Math.floor(metadata.height * 0.15);
        const seamBuffer = await sharp(buffer)
            .extract({
                left: 0,
                top: metadata.height - stripHeight,
                width: metadata.width,
                height: stripHeight
            })
            .png()
            .toBuffer();

        return seamBuffer.toString('base64');
    } catch {
        return base64Image;
    }
}

async function generateImage(prompt: string, styleAnchor?: string, seamRef?: string): Promise<string | null> {
    const parts: any[] = [];

    if (styleAnchor) {
        parts.push({ inlineData: { mimeType: 'image/png', data: styleAnchor } });
        parts.push({ text: '【STYLE REFERENCE】Match this image\'s color palette, lighting, and quality level exactly.' });
    }

    if (seamRef) {
        parts.push({ inlineData: { mimeType: 'image/png', data: seamRef } });
        parts.push({ text: '【SEAMLESS CONNECTION】The TOP of your generated image must seamlessly connect with the BOTTOM of this reference. Match colors and gradients precisely.' });
    }

    parts.push({ text: prompt });

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: {
                        responseModalities: ["IMAGE"],
                        imageConfig: { aspectRatio: "9:16" }
                    }
                })
            }
        );

        if (!response.ok) {
            console.error(`API Error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const imgParts = data.candidates?.[0]?.content?.parts || [];
        for (const part of imgParts) {
            if (part.inlineData?.data) return part.inlineData.data;
        }
        return null;
    } catch (e: any) {
        console.error(`Error: ${e.message}`);
        return null;
    }
}

async function uploadImage(base64: string, role: string): Promise<number | null> {
    try {
        const buffer = Buffer.from(base64, 'base64');
        const filename = `lp-v2-${role}-${Date.now()}.png`;

        await supabase.storage.from('images').upload(filename, buffer, {
            contentType: 'image/png',
            cacheControl: '3600',
            upsert: false
        });

        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filename);

        const media = await prisma.mediaImage.create({
            data: {
                userId: '17b4e0d7-f5fc-4561-aeb7-518a8d9b8427',
                filePath: publicUrl,
                mime: 'image/png',
                width: 768,
                height: 1376
            }
        });

        return media.id;
    } catch (e: any) {
        console.error(`Upload error: ${e.message}`);
        return null;
    }
}

async function main() {
    console.log('🎨 LP Image Generation v2 - High Quality Mode');
    console.log('=' .repeat(50));

    const sections = await prisma.pageSection.findMany({
        where: { pageId: PAGE_ID },
        orderBy: { order: 'asc' }
    });

    console.log(`\nGenerating ${sections.length} sections...\n`);

    let styleAnchor: string | null = null;
    let prevImage: string | null = null;

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        let config: any = {};
        try {
            config = typeof section.config === 'string' ? JSON.parse(section.config) : section.config || {};
        } catch {}

        const headline = config.headline || '';
        const subheadline = config.subheadline || '';

        console.log(`[${i + 1}/${sections.length}] ${section.role}`);
        console.log(`    "${headline.substring(0, 30)}..."`);

        const prompt = getHighQualityPrompt(section.role, headline, subheadline);
        const seamRef = prevImage ? await extractSeamStrip(prevImage) : undefined;

        const base64 = await generateImage(prompt, styleAnchor || undefined, seamRef);

        if (!base64) {
            console.log(`    ❌ Failed\n`);
            continue;
        }

        if (!styleAnchor) {
            styleAnchor = base64;
            console.log(`    → Style Anchor set`);
        }
        prevImage = base64;

        const imageId = await uploadImage(base64, section.role);
        if (!imageId) {
            console.log(`    ❌ Upload failed\n`);
            continue;
        }

        await prisma.pageSection.update({
            where: { id: section.id },
            data: { imageId }
        });

        console.log(`    ✓ Done (ID: ${imageId})\n`);
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('=' .repeat(50));
    console.log('✅ Complete!');
    console.log(`View: http://localhost:3000/preview/page/${PAGE_ID}`);

    await prisma.$disconnect();
}

main().catch(console.error);
