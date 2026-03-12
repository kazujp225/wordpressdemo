import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Database health check
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'healthy',
    });
  } catch {
    return NextResponse.json(
      { status: 'unhealthy' },
      { status: 503 }
    );
  }
}
