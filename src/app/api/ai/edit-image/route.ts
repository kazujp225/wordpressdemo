import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { prisma } from '@/lib/db';

const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

export async function POST(request: NextRequest) {
    try {
        const { imageBase64, imageUrl, prompt, productInfo } = await request.json();

        if (!prompt && !productInfo) {
            return NextResponse.json({ error: 'Prompt or productInfo is required' }, { status: 400 });
        }

        if (!GOOGLE_API_KEY) {
            return NextResponse.json({ error: 'Google API key is not configured' }, { status: 500 });
        }

        // Get image data - either from base64 or fetch from URL
        let base64Data: string;
        let mimeType = 'image/png';

        if (imageBase64) {
            // Remove data URL prefix if present
            base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        } else if (imageUrl) {
            // Fetch image from URL
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error('Failed to fetch image from URL');
            }
            const arrayBuffer = await imageResponse.arrayBuffer();
            base64Data = Buffer.from(arrayBuffer).toString('base64');
            mimeType = imageResponse.headers.get('content-type') || 'image/png';
        } else {
            return NextResponse.json({ error: 'Either imageBase64 or imageUrl is required' }, { status: 400 });
        }

        // Build the editing prompt
        const editPrompt = productInfo
            ? `この画像のレイアウトと構成を維持しながら、以下の商材/サービス用にリブランディングしてください:

${productInfo}

指示:
- 元のデザインレイアウトを維持
- テキスト部分を新しい商材に合わせて変更
- 色味やスタイルは新商材に適したものに調整
- プロフェッショナルなLP画像として仕上げてください

${prompt ? `追加指示: ${prompt}` : ''}`
            : prompt;

        // Call Gemini 3 Pro Image (Nano Banana Pro) for image editing - 最新モデルで日本語性能が高い
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: editPrompt },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Data
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ["TEXT", "IMAGE"]
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini 3 Pro Image API error:', errorText);

            // Try fallback model (Gemini 2.5 Flash Image / Nano Banana)
            console.log('Trying fallback model: gemini-2.5-flash-preview-image-generation');
            const fallbackResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-image-generation:generateContent?key=${GOOGLE_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: editPrompt },
                                {
                                    inlineData: {
                                        mimeType: mimeType,
                                        data: base64Data
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            responseModalities: ["TEXT", "IMAGE"]
                        }
                    })
                }
            );

            if (!fallbackResponse.ok) {
                const fallbackError = await fallbackResponse.text();
                console.error('Fallback model error:', fallbackError);
                throw new Error(`Image editing failed: ${response.status} - ${errorText}`);
            }

            const fallbackData = await fallbackResponse.json();
            return processImageResponse(fallbackData);
        }

        const data = await response.json();
        return processImageResponse(data);

    } catch (error: any) {
        console.error('Image Edit Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

async function processImageResponse(data: any) {
    // Extract image from response
    const parts = data.candidates?.[0]?.content?.parts || [];
    let editedImageBase64: string | null = null;
    let textResponse: string | null = null;

    for (const part of parts) {
        if (part.inlineData?.data) {
            editedImageBase64 = part.inlineData.data;
        }
        if (part.text) {
            textResponse = part.text;
        }
    }

    if (!editedImageBase64) {
        // If no image was generated, return just the text analysis
        return NextResponse.json({
            success: false,
            message: 'Image editing not available for this request. Model returned text only.',
            textResponse
        });
    }

    // Upload edited image to Supabase
    const buffer = Buffer.from(editedImageBase64, 'base64');
    const filename = `edited-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;

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
        throw new Error('Failed to upload edited image to storage');
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
        .storage
        .from('images')
        .getPublicUrl(filename);

    // Create DB record
    const media = await prisma.mediaImage.create({
        data: {
            filePath: publicUrl,
            mime: 'image/png',
            width: 1024,
            height: 1024,
        },
    });

    return NextResponse.json({
        success: true,
        media,
        textResponse
    });
}
