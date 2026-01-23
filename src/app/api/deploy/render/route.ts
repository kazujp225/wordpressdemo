import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { createDeployRepo } from '@/lib/github-deploy';
import { createWebService } from '@/lib/render-api';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { html, serviceName, templateType, prompt, pageId } = body;

  if (!html || !serviceName) {
    return NextResponse.json(
      { error: 'html and serviceName are required' },
      { status: 400 }
    );
  }

  // Sanitize service name for use as repo name
  const repoName = `lp-${serviceName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()}-${Date.now()}`;

  try {
    // 1. Create GitHub repository with the generated HTML
    const { repoUrl, htmlUrl } = await createDeployRepo(repoName, html);

    // 2. Create Render web service pointing to the GitHub repo
    const renderService = await createWebService({
      name: serviceName,
      repoUrl,
    });

    // 3. Save deployment record
    const deployment = await prisma.deployment.create({
      data: {
        userId: user.id,
        pageId: pageId || null,
        serviceName,
        renderServiceId: renderService.id,
        status: 'building',
        generatedHtml: html,
        templateType: templateType || null,
        prompt: prompt || null,
        githubRepoUrl: htmlUrl,
      },
    });

    return NextResponse.json({
      success: true,
      deployment: {
        id: deployment.id,
        serviceName: deployment.serviceName,
        status: deployment.status,
        githubRepoUrl: htmlUrl,
        renderServiceId: renderService.id,
      },
    });
  } catch (error: any) {
    // Save failed deployment
    await prisma.deployment.create({
      data: {
        userId: user.id,
        pageId: pageId || null,
        serviceName,
        status: 'failed',
        generatedHtml: html,
        templateType: templateType || null,
        prompt: prompt || null,
        errorMessage: error.message,
      },
    });

    return NextResponse.json(
      { error: 'Deployment failed', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const deployments = await prisma.deployment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      serviceName: true,
      status: true,
      siteUrl: true,
      templateType: true,
      githubRepoUrl: true,
      createdAt: true,
      errorMessage: true,
    },
  });

  return NextResponse.json({ deployments });
}
