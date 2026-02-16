import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

async function isAdmin(userId: string): Promise<boolean> {
    const userSettings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { role: true }
    });
    return userSettings?.role === 'admin';
}

// GET: テンプレート詳細（管理者のみ）
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    try {
        const { id } = await params;
        const template = await prisma.lpTemplate.findUnique({
            where: { id: parseInt(id) },
            include: {
                sections: {
                    orderBy: { order: 'asc' },
                    include: { image: true, mobileImage: true }
                }
            }
        });

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        return NextResponse.json(template);
    } catch (error: any) {
        console.error('Failed to fetch template:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: テンプレート更新（管理者のみ）
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    try {
        const { id } = await params;
        const body = await request.json();
        const { title, description, category, isPublished } = body;

        const template = await prisma.lpTemplate.update({
            where: { id: parseInt(id) },
            data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(category !== undefined && { category }),
                ...(isPublished !== undefined && { isPublished }),
            }
        });

        return NextResponse.json(template);
    } catch (error: any) {
        console.error('Failed to update template:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: テンプレート削除（管理者のみ）
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    try {
        const { id } = await params;
        await prisma.lpTemplate.delete({
            where: { id: parseInt(id) }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Failed to delete template:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
