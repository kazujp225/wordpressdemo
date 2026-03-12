import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkBanStatus } from '@/lib/security';

export async function POST(request: NextRequest) {
    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // BANチェック
    const banResponse = await checkBanStatus(user.id);
    if (banResponse) return banResponse;

    // Mock AI response
    // Input: { images: [{filename: '...', width: ...}] }
    const body = await request.json();

    // Simple heuristic or random for MVP demo
    const structure = body.images.map((img: any, index: number) => {
        let role = 'solution';
        const lower = img.filename?.toLowerCase() || '';
        if (index === 0) role = 'hero';
        else if (lower.includes('problem')) role = 'problem';
        else if (lower.includes('price')) role = 'pricing';
        else if (lower.includes('faq')) role = 'faq';

        return { ...img, role };
    });

    return NextResponse.json({ structure });
}
