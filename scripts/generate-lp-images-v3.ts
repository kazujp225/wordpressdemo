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
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
                process.env[trimmed.substring(0, eqIndex)] = trimmed.substring(eqIndex + 1).replace(/^["']|["']$/g, '');
            }
        }
    }
}
loadEnv();

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
const PAGE_ID = 49;

// ============================================
// v3: 超高品質プロンプト
// ============================================

const MASTER_PROMPT = `
You are an elite creative director at a top-tier design agency (Pentagram/IDEO level).
Create a breathtaking landing page section that would win design awards.

【ABSOLUTE QUALITY STANDARDS】
- Dribbble "Popular" level quality
- Behance featured project level
- Apple keynote presentation quality
- Every detail is intentional and polished

【DESIGN LANGUAGE】
Style: Premium tech SaaS (like Linear, Vercel, Stripe)
- Deep, rich gradients with subtle noise texture
- Floating 3D elements with realistic lighting
- Soft shadows and ambient occlusion
- Glassmorphism with frosted blur effects
- Cinematic depth of field

【COLOR PALETTE - STRICT】
Background: Deep navy #0A1628 to midnight #050A14
Primary accent: Electric blue #0066FF with glow
Secondary: Cyan #00D4FF for highlights
Warm accent: Coral #FF6B4A for CTAs only
Text: Pure white #FFFFFF with subtle text-shadow

【TYPOGRAPHY EXCELLENCE】
- Headlines: Bold, clean sans-serif (like Inter or SF Pro)
- Perfect letter-spacing and line-height
- Text must be SHARP and CRISP
- Japanese characters must be perfectly rendered
- NO blurry or distorted text

【COMPOSITION RULES】
- Rule of thirds for focal points
- Clear visual hierarchy
- Generous padding and margins
- Bottom 10% must fade smoothly for section transitions

【CRITICAL PROHIBITIONS】
❌ NO generic stock imagery
❌ NO clipart or cartoon characters
❌ NO cheap-looking 3D renders
❌ NO busy or cluttered backgrounds
❌ NO duplicate UI elements
❌ NO text overflow or truncation
`;

function buildSectionPrompt(role: string, headline: string, subheadline: string, items: any[] = []): string {
    const prompts: Record<string, string> = {
        hero: `
【HERO SECTION】
The most important section - must stop the scroll instantly.

EXACT TEXT TO RENDER (render every character perfectly):
HEADLINE: "${headline}"
SUBHEADLINE: "${subheadline}"

VISUAL DESIGN:
- Deep space background with subtle star field
- Large frosted glass card (glassmorphism) containing the text
- 3D abstract crystalline shapes floating below the card
- Volumetric light rays from top-right corner
- Subtle particle effects
- The headline should be LARGE (takes up 60% of card width)
- Subheadline below in lighter weight

LAYOUT:
- Text card in upper 45% of image
- Abstract 3D visuals in lower 55%
- Smooth gradient fade at very bottom
`,

        problem: `
【PROBLEM SECTION】
Empathize with the user's pain points.

EXACT TEXT TO RENDER:
HEADLINE: "${headline}"
SUBHEADLINE: "${subheadline}"

VISUAL DESIGN:
- Darker, moodier atmosphere (but still premium)
- Abstract tangled/fragmented geometric shapes
- Gradient from deep purple-blue to navy
- Subtle red/orange accent hints suggesting frustration
- Text on semi-transparent dark overlay
- Feeling of complexity that needs solving

LAYOUT:
- Centered text composition
- Abstract visuals surrounding text
- Top edge connects with previous section's colors
`,

        solution: `
【SOLUTION SECTION】
The turning point - from problem to hope.

EXACT TEXT TO RENDER:
HEADLINE: "${headline}"
SUBHEADLINE: "${subheadline}"

VISUAL DESIGN:
- Dramatic lighting breakthrough effect
- Dawn/sunrise color temperature emerging
- Fragments coming together, order from chaos
- Bright blue light source from center
- Glass prism light refraction effects
- Feeling of clarity and breakthrough

LAYOUT:
- Text prominently centered
- Light emanating from behind text
- Smooth transition from darker top to brighter bottom
`,

        benefits: `
【BENEFITS SECTION】
Show the transformed future state.

EXACT TEXT TO RENDER:
HEADLINE: "${headline}"
SUBHEADLINE: "${subheadline}"

VISUAL DESIGN:
- Bright, optimistic atmosphere
- Upward-flowing abstract elements (particles rising)
- Clean gradient from deep blue to lighter sky blue
- Floating achievement icons/badges (abstract, not literal)
- Sense of growth and ascension
- Premium, aspirational feeling

LAYOUT:
- Text in upper third
- Upward visual flow in lower two-thirds
`,

        features: `
【FEATURES SECTION】
Showcase the product's key features.

EXACT TEXT TO RENDER:
HEADLINE: "${headline}"
${items.length > 0 ? `
FEATURE 1: "${items[0]?.title || ''}"
FEATURE 2: "${items[1]?.title || ''}"
FEATURE 3: "${items[2]?.title || ''}"
` : ''}

VISUAL DESIGN:
- Three premium glassmorphism cards arranged in a row
- Each card has subtle gradient border (blue to cyan)
- Cards contain feature titles with small icons above
- Connecting light beams between cards
- Clean, organized, Stripe-like aesthetic
- Deep blue background with subtle grid pattern

LAYOUT:
- Main headline at top (20%)
- Three feature cards in middle (60%)
- Clean space at bottom for transition (20%)
`,

        testimonials: `
【TESTIMONIALS SECTION】
Build trust through social proof.

EXACT TEXT TO RENDER:
HEADLINE: "${headline}"
SUBHEADLINE: "${subheadline}"

VISUAL DESIGN:
- Warm, trustworthy atmosphere
- Soft gradient (blue to subtle purple)
- Abstract quote mark shapes (「」style for Japanese)
- 2-3 testimonial card placeholders with frosted glass effect
- Human warmth without using actual human photos
- Gentle, approachable color temperature

LAYOUT:
- Headline at top
- Testimonial cards in center
- Plenty of breathing room
`,

        process: `
【PROCESS SECTION】
Show the clear path forward.

EXACT TEXT TO RENDER:
HEADLINE: "${headline}"
STEP 1: "${items[0]?.title || items[0]?.description || '無料カウンセリング'}"
STEP 2: "${items[1]?.title || items[1]?.description || '学習プラン提案'}"
STEP 3: "${items[2]?.title || items[2]?.description || '受講開始'}"

VISUAL DESIGN:
- Clean timeline/journey visualization
- Three numbered circles (1, 2, 3) connected by glowing line
- Each step has a small glassmorphism card with step name
- Progress/forward motion feeling
- Light flows from left to right
- Infographic-quality design

LAYOUT:
- Headline at top
- Horizontal process flow in center
- Numbers should be prominent and beautiful
`,

        guarantee: `
【GUARANTEE SECTION】
Provide reassurance and reduce risk.

EXACT TEXT TO RENDER:
HEADLINE: "${headline}"
SUBHEADLINE: "${subheadline}"

VISUAL DESIGN:
- Solid, stable, trustworthy design
- Abstract shield or checkmark integrated subtly
- Deep navy blue conveying security
- Subtle gold/bronze accent for premium feel
- Bank-level security aesthetic
- Clean and reassuring

LAYOUT:
- Centered, symmetrical composition
- Text prominent
- Shield element as subtle background
`,

        pricing: `
【PRICING SECTION】
Present value clearly and attractively.

EXACT TEXT TO RENDER:
HEADLINE: "${headline}"
SUBHEADLINE: "${subheadline}"

VISUAL DESIGN:
- Clean, uncluttered background
- Subtle pricing card placeholder (glassmorphism)
- Premium but not intimidating
- Soft gradient background
- Hint of gold accent for value perception
- Professional and clear

LAYOUT:
- Headline at top
- Large central space for pricing display
- Very clean composition
`,

        faq: `
【FAQ SECTION】
Make answers easily accessible.

EXACT TEXT TO RENDER:
HEADLINE: "${headline}"

VISUAL DESIGN:
- Light, airy, helpful atmosphere
- Soft blue to white gradient
- Abstract question/answer visual elements
- Accordion-style card placeholders
- Friendly and approachable
- Minimal and clean

LAYOUT:
- Simple headline at top
- Clean space for FAQ items
- Very light background
`,

        cta: `
【CTA SECTION - CRITICAL】
The final push to action. ONE clear button only.

EXACT TEXT TO RENDER:
HEADLINE: "${headline}"
BUTTON TEXT: "無料カウンセリングを予約する"

VISUAL DESIGN:
- Dynamic, energetic composition
- ONE prominent CTA button (rounded rectangle, coral/orange #FF6B4A)
- Button has subtle glow effect and shadow
- Light rays emanating FROM the button
- Exciting but not overwhelming
- Celebratory particle effects around button
- Deep blue background contrasting with orange button

⚠️ CRITICAL: Only ONE button. Do NOT duplicate the button.

LAYOUT:
- Headline in upper 30%
- Single CTA button centered in middle 40%
- Energy effects in remaining space
- This is the finale - make it irresistible
`,
    };

    return MASTER_PROMPT + (prompts[role] || prompts.features);
}

async function extractSeam(base64: string): Promise<string> {
    try {
        const buf = Buffer.from(base64, 'base64');
        const meta = await sharp(buf).metadata();
        if (!meta.width || !meta.height) return base64;
        const h = Math.floor(meta.height * 0.12);
        return (await sharp(buf).extract({ left: 0, top: meta.height - h, width: meta.width, height: h }).png().toBuffer()).toString('base64');
    } catch { return base64; }
}

async function generateImage(prompt: string, anchor?: string, seam?: string): Promise<string | null> {
    const parts: any[] = [];

    if (anchor) {
        parts.push({ inlineData: { mimeType: 'image/png', data: anchor } });
        parts.push({ text: '【STYLE ANCHOR】Match this exact visual style, color palette, and quality level. Maintain consistency.' });
    }
    if (seam) {
        parts.push({ inlineData: { mimeType: 'image/png', data: seam } });
        parts.push({ text: '【SEAMLESS TOP EDGE】Your image TOP must seamlessly blend with this reference BOTTOM. Match colors exactly at the join point.' });
    }
    parts.push({ text: prompt });

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } }
            })
        });
        if (!res.ok) { console.error(`API ${res.status}`); return null; }
        const data = await res.json();
        for (const p of data.candidates?.[0]?.content?.parts || []) {
            if (p.inlineData?.data) return p.inlineData.data;
        }
    } catch (e: any) { console.error(e.message); }
    return null;
}

async function upload(base64: string, role: string): Promise<number | null> {
    try {
        const filename = `lp-v3-${role}-${Date.now()}.png`;
        await supabase.storage.from('images').upload(filename, Buffer.from(base64, 'base64'), { contentType: 'image/png' });
        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filename);
        const media = await prisma.mediaImage.create({
            data: { userId: '17b4e0d7-f5fc-4561-aeb7-518a8d9b8427', filePath: publicUrl, mime: 'image/png', width: 768, height: 1376 }
        });
        return media.id;
    } catch (e: any) { console.error(e.message); return null; }
}

async function main() {
    console.log('🎨 LP Generation v3 - Premium Quality\n' + '='.repeat(50));

    const sections = await prisma.pageSection.findMany({ where: { pageId: PAGE_ID }, orderBy: { order: 'asc' } });
    console.log(`\n${sections.length} sections to generate\n`);

    let anchor: string | null = null;
    let prev: string | null = null;

    for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        const cfg = typeof s.config === 'string' ? JSON.parse(s.config) : s.config || {};

        console.log(`[${i+1}/${sections.length}] ${s.role}`);

        const prompt = buildSectionPrompt(s.role, cfg.headline || '', cfg.subheadline || '', cfg.items || []);
        const seam = prev ? await extractSeam(prev) : undefined;
        const img = await generateImage(prompt, anchor || undefined, seam);

        if (!img) { console.log('    ❌ Failed\n'); continue; }

        if (!anchor) { anchor = img; console.log('    → Anchor set'); }
        prev = img;

        const id = await upload(img, s.role);
        if (!id) { console.log('    ❌ Upload failed\n'); continue; }

        await prisma.pageSection.update({ where: { id: s.id }, data: { imageId: id } });
        console.log(`    ✓ ID: ${id}\n`);

        await new Promise(r => setTimeout(r, 2500));
    }

    console.log('='.repeat(50) + '\n✅ Done!\nhttp://localhost:3000/preview/page/' + PAGE_ID);
    await prisma.$disconnect();
}

main().catch(console.error);
