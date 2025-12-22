import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const configs = await prisma.globalConfig.findMany();
        const configMap = configs.reduce((acc: any, curr) => {
            acc[curr.key] = JSON.parse(curr.value);
            return acc;
        }, {});
        return NextResponse.json(configMap);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const data = await request.json();

        const upserts = Object.entries(data).map(([key, value]) => {
            return prisma.globalConfig.upsert({
                where: { key },
                update: { value: JSON.stringify(value) },
                create: { key, value: JSON.stringify(value) }
            });
        });

        await Promise.all(upserts);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
