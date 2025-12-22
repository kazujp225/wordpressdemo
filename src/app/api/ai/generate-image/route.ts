import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';

const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

export async function POST(request: NextRequest) {
    try {
        const { prompt } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        if (!GOOGLE_API_KEY) {
            return NextResponse.json({ error: 'Google API key is not configured' }, { status: 500 });
        }

        // 1. Generate Image using Google Imagen 3 (via Gemini API / Vertex AI compatible endpoint)
        // Note: Imagen 3 is the current state-of-the-art for Google.
        // We use the predict endpoint for Imagen models.
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: [{ prompt: `Professional high-quality landing page photography: ${prompt}. Cinematic lighting, 8k, modern aesthetic.` }],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: "1:1",
                        outputMimeType: "image/png"
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Imagen API error:', errorText);
            throw new Error(`Google Imagen 3 API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const base64Image = data.predictions?.[0]?.bytesBase64Encoded;

        if (!base64Image) {
            throw new Error('Googleからの画像データが空です。');
        }

        // 2. Convert base64 to buffer
        const buffer = Buffer.from(base64Image, 'base64');

        // 3. Upload to Supabase Storage
        const filename = `gemini-gen-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('images')
            .upload(filename, buffer, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError);
            throw new Error('Failed to upload generated image to storage');
        }

        // 4. Get Public URL
        const { data: { publicUrl } } = supabase
            .storage
            .from('images')
            .getPublicUrl(filename);

        // 5. Create DB Record
        const media = await prisma.mediaImage.create({
            data: {
                filePath: publicUrl,
                mime: 'image/png',
                width: 1024,
                height: 1024,
            },
        });

        return NextResponse.json(media);

    } catch (error: any) {
        console.error('Gemini Image Generation Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
