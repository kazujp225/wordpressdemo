import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { getServiceStatus, deleteService } from '@/lib/render-api';
import { decrypt } from '@/lib/encryption';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const deploymentId = parseInt(id, 10);

  if (isNaN(deploymentId)) {
    return NextResponse.json({ error: 'Invalid deployment ID' }, { status: 400 });
  }

  const deployment = await prisma.deployment.findFirst({
    where: { id: deploymentId, userId: user.id },
  });

  if (!deployment) {
    return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
  }

  // 確定済みステータスはキャッシュから返す
  if (deployment.status === 'live' || deployment.status === 'failed') {
    return NextResponse.json({
      id: deployment.id,
      status: deployment.status,
      siteUrl: deployment.siteUrl,
      serviceName: deployment.serviceName,
      githubRepoUrl: deployment.githubRepoUrl,
      errorMessage: deployment.errorMessage,
    });
  }

  // ポーリング用のRender APIキーを取得
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { renderApiKey: true },
  });

  if (!userSettings?.renderApiKey) {
    return NextResponse.json({
      id: deployment.id,
      status: deployment.status,
      serviceName: deployment.serviceName,
      errorMessage: 'Render APIキーが見つかりません',
    });
  }

  // Render APIで現在のステータスを確認
  if (deployment.renderServiceId) {
    try {
      const apiKey = decrypt(userSettings.renderApiKey);
      const { status, url } = await getServiceStatus(deployment.renderServiceId, apiKey);

      // ステータス変更時にDB更新
      if (status !== deployment.status || (url && !deployment.siteUrl)) {
        await prisma.deployment.update({
          where: { id: deploymentId },
          data: {
            status,
            siteUrl: url || deployment.siteUrl,
          },
        });
      }

      return NextResponse.json({
        id: deployment.id,
        status,
        siteUrl: url || deployment.siteUrl,
        serviceName: deployment.serviceName,
        githubRepoUrl: deployment.githubRepoUrl,
      });
    } catch (error: any) {
      return NextResponse.json({
        id: deployment.id,
        status: deployment.status,
        siteUrl: deployment.siteUrl,
        serviceName: deployment.serviceName,
        errorMessage: error.message,
      });
    }
  }

  return NextResponse.json({
    id: deployment.id,
    status: deployment.status,
    siteUrl: deployment.siteUrl,
    serviceName: deployment.serviceName,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const deploymentId = parseInt(id, 10);

  if (isNaN(deploymentId)) {
    return NextResponse.json({ error: 'Invalid deployment ID' }, { status: 400 });
  }

  const deployment = await prisma.deployment.findFirst({
    where: { id: deploymentId, userId: user.id },
  });

  if (!deployment) {
    return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
  }

  // 削除用のRender APIキーを取得
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { renderApiKey: true },
  });

  // Renderサービスを削除
  if (deployment.renderServiceId && userSettings?.renderApiKey) {
    try {
      const apiKey = decrypt(userSettings.renderApiKey);
      await deleteService(deployment.renderServiceId, apiKey);
    } catch (error) {
      console.error('Failed to delete Render service:', error);
    }
  }

  // DBから削除
  await prisma.deployment.delete({
    where: { id: deploymentId },
  });

  return NextResponse.json({ success: true });
}
