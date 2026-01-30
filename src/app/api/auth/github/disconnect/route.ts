import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

// Disconnect GitHub OAuth
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.userSettings.update({
      where: { userId: user.id },
      data: {
        githubToken: null,
        githubDeployOwner: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('GitHub disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
