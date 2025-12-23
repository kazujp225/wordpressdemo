import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    // ユーザー認証
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = file.name.replace(/[^a-zA-Z0-9.]/g, '_'); // Sanitize
    const finalFilename = `${uniqueSuffix}-${filename}`;

    const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('images')
        .upload(finalFilename, buffer, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    // Get Public URL
    const { data: { publicUrl } } = supabase
        .storage
        .from('images')
        .getPublicUrl(finalFilename);

    // Create DB Record
    const media = await prisma.mediaImage.create({
        data: {
            userId: user?.id || null,
            filePath: publicUrl,
            mime: file.type,
            width: 0,
            height: 0,
        },
    });

    return NextResponse.json(media);
}
