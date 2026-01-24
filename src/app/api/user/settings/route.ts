import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { getPlan, isFreePlan } from '@/lib/plans';

// ユーザー設定を取得（なければ自動作成）
async function getOrCreateUserSettings(userId: string, email: string | null) {
    let settings = await prisma.userSettings.findUnique({
        where: { userId }
    });

    if (!settings) {
        // 新規ユーザー: デフォルトプランで作成
        settings = await prisma.userSettings.create({
            data: {
                userId,
                email,
                plan: 'free'
            }
        });
    }

    return settings;
}

// ユーザー設定を取得
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getOrCreateUserSettings(user.id, user.email || null);
    const plan = getPlan(settings.plan);

    return NextResponse.json({
        plan: settings.plan,
        role: settings.role,
        hasApiKey: !!settings.googleApiKey,
        canSetApiKey: plan.limits.canSetApiKey, // Freeプランのみtrue
        userId: user.id,
        // Deploy settings
        hasRenderApiKey: !!settings.renderApiKey,
        hasGithubToken: !!settings.githubToken,
        githubDeployOwner: settings.githubDeployOwner || '',
    });
}

// ユーザー設定を保存
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { googleApiKey, renderApiKey, githubToken, githubDeployOwner } = body;

    // プランを確認してAPIキー設定が許可されているかチェック
    const currentSettings = await prisma.userSettings.findUnique({
        where: { userId: user.id }
    });
    const planId = currentSettings?.plan || 'free';

    // Freeプラン以外はgoogle APIキー設定を拒否
    if (!isFreePlan(planId) && googleApiKey) {
        return NextResponse.json({
            error: '有料プランではAPIキーの設定はできません。自社のAPIを使用します。'
        }, { status: 403 });
    }

    // Build update data
    const updateData: any = {};
    const createData: any = {
        userId: user.id,
        email: user.email || null,
        plan: 'free',
    };

    if (googleApiKey !== undefined) {
        updateData.googleApiKey = googleApiKey || null;
        createData.googleApiKey = googleApiKey || null;
    }
    if (renderApiKey !== undefined) {
        updateData.renderApiKey = renderApiKey || null;
        createData.renderApiKey = renderApiKey || null;
    }
    if (githubToken !== undefined) {
        updateData.githubToken = githubToken || null;
        createData.githubToken = githubToken || null;
    }
    if (githubDeployOwner !== undefined) {
        updateData.githubDeployOwner = githubDeployOwner || null;
        createData.githubDeployOwner = githubDeployOwner || null;
    }

    await prisma.userSettings.upsert({
        where: { userId: user.id },
        update: updateData,
        create: createData,
    });

    return NextResponse.json({ success: true });
}
