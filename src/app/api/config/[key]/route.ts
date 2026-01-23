import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: { key: string } }) {
    try {
        const config = await prisma.globalConfig.findUnique({
            where: { key: params.key }
        }).catch(() => null);
        return NextResponse.json(config ? JSON.parse(config.value) : null);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: { key: string } }) {
    try {
        const body = await request.json();
        const config = await prisma.globalConfig.upsert({
            where: { key: params.key },
            update: { value: JSON.stringify(body) },
            create: { key: params.key, value: JSON.stringify(body) }
        });
        return NextResponse.json({ success: true, config });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }
}
