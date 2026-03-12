import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUsageReport } from '@/lib/usage';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const report = await getUsageReport(user.id);
        return NextResponse.json(report);
    } catch (error: any) {
        console.error('Failed to get usage report:', error);
        return NextResponse.json({ error: process.env.NODE_ENV === 'production' ? '利用状況の取得に失敗しました' : error.message }, { status: 500 });
    }
}
