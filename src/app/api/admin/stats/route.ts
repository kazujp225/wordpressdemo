import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const days = parseInt(searchParams.get('days') || '30');
        const targetUserId = searchParams.get('userId') || user.id;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get aggregated stats for the user
        const [totalStats, byModel, byType, byStatus, recentRuns] = await Promise.all([
            // Total counts and costs
            prisma.generationRun.aggregate({
                where: {
                    userId: targetUserId,
                    createdAt: { gte: startDate }
                },
                _count: true,
                _sum: {
                    estimatedCost: true,
                    inputTokens: true,
                    outputTokens: true,
                    imageCount: true,
                    durationMs: true
                }
            }),

            // By model
            prisma.generationRun.groupBy({
                by: ['model'],
                where: {
                    userId: targetUserId,
                    createdAt: { gte: startDate }
                },
                _count: true,
                _sum: { estimatedCost: true, imageCount: true }
            }),

            // By type
            prisma.generationRun.groupBy({
                by: ['type'],
                where: {
                    userId: targetUserId,
                    createdAt: { gte: startDate }
                },
                _count: true,
                _sum: { estimatedCost: true, imageCount: true }
            }),

            // By status (for error rate)
            prisma.generationRun.groupBy({
                by: ['status'],
                where: {
                    userId: targetUserId,
                    createdAt: { gte: startDate }
                },
                _count: true
            }),

            // Recent runs for daily breakdown
            prisma.generationRun.findMany({
                where: {
                    userId: targetUserId,
                    createdAt: { gte: startDate }
                },
                select: {
                    createdAt: true,
                    estimatedCost: true,
                    status: true
                },
                orderBy: { createdAt: 'asc' }
            })
        ]);

        // Calculate daily breakdown
        const dailyMap = new Map<string, { count: number; cost: number; errors: number }>();

        recentRuns.forEach(run => {
            const dateKey = run.createdAt.toISOString().split('T')[0];
            const existing = dailyMap.get(dateKey) || { count: 0, cost: 0, errors: 0 };
            dailyMap.set(dateKey, {
                count: existing.count + 1,
                cost: existing.cost + (run.estimatedCost || 0),
                errors: existing.errors + (run.status === 'failed' ? 1 : 0)
            });
        });

        // Fill in missing dates
        const daily = [];
        const currentDate = new Date(startDate);
        const endDate = new Date();

        while (currentDate <= endDate) {
            const dateKey = currentDate.toISOString().split('T')[0];
            const dayData = dailyMap.get(dateKey) || { count: 0, cost: 0, errors: 0 };
            daily.push({
                date: dateKey,
                ...dayData
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Calculate error rate
        const totalCount = byStatus.reduce((sum, s) => sum + s._count, 0);
        const failedCount = byStatus.find(s => s.status === 'failed')?._count || 0;

        return NextResponse.json({
            period: {
                days,
                startDate: startDate.toISOString(),
                endDate: new Date().toISOString()
            },
            summary: {
                totalCalls: totalStats._count,
                totalCost: totalStats._sum.estimatedCost || 0,
                totalInputTokens: totalStats._sum.inputTokens || 0,
                totalOutputTokens: totalStats._sum.outputTokens || 0,
                totalImages: totalStats._sum.imageCount || 0,
                avgDurationMs: totalStats._count > 0
                    ? Math.round((totalStats._sum.durationMs || 0) / totalStats._count)
                    : 0
            },
            daily,
            byModel: byModel.map(m => ({
                model: m.model,
                count: m._count,
                cost: m._sum.estimatedCost || 0,
                images: m._sum.imageCount || 0
            })),
            byType: byType.map(t => ({
                type: t.type,
                count: t._count,
                cost: t._sum.estimatedCost || 0,
                images: t._sum.imageCount || 0
            })),
            errorRate: {
                total: totalCount,
                failed: failedCount,
                rate: totalCount > 0 ? (failedCount / totalCount) * 100 : 0
            }
        });
    } catch (error: any) {
        console.error('Stats API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
