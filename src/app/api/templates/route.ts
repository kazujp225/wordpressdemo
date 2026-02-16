import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

// GET: 公開テンプレート一覧（認証ユーザーのみ）
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const templates = await prisma.lpTemplate.findMany({
            where: { isPublished: true },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                title: true,
                description: true,
                category: true,
                thumbnailUrl: true,
                updatedAt: true,
            }
        });

        return NextResponse.json(templates);
    } catch (error: any) {
        console.error('Failed to fetch public templates:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
