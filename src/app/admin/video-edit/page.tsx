import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { hasBetaAccess } from '@/lib/beta-features';
import VideoEditPage from '@/components/admin/VideoEditPage';

export default async function VideoEditRoute() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/');
    }

    // ベータアクセスチェック
    if (!hasBetaAccess(user.email, 'videoEdit')) {
        redirect('/admin/pages');
    }

    return <VideoEditPage />;
}
