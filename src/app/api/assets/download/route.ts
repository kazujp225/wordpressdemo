import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { url, type, title } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // 素材をダウンロード
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch asset');
        }

        const contentType = response.headers.get('content-type') || 'image/png';
        const buffer = Buffer.from(await response.arrayBuffer());

        // ファイル名生成
        let extension = 'png';
        if (contentType.includes('svg')) extension = 'svg';
        else if (contentType.includes('json')) extension = 'json';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';
        else if (contentType.includes('gif')) extension = 'gif';
        else if (contentType.includes('webp')) extension = 'webp';

        const filename = `asset-${Date.now()}-${Math.round(Math.random() * 1E9)}.${extension}`;

        // Supabaseにアップロード
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('images')
            .upload(filename, buffer, {
                contentType,
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError);
            throw new Error('Failed to upload asset');
        }

        // Public URLを取得
        const { data: { publicUrl } } = supabase
            .storage
            .from('images')
            .getPublicUrl(filename);

        return NextResponse.json({
            success: true,
            url: publicUrl,
            type,
            title,
            filename
        });

    } catch (error: any) {
        console.error('Asset download error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
