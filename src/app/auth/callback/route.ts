import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    const next = searchParams.get('next') ?? '/admin';

    // パスワードリセット（recovery）の場合
    if (type === 'recovery' && token) {
        // トークンを使ってパスワード変更ページへリダイレクト
        // Supabaseがトークンを処理してセッションを作成する
        return NextResponse.redirect(`${origin}/reset-password/confirm?token=${token}&type=${type}`);
    }

    // 通常の認証コールバック（code使用）
    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // エラーの場合はログインページへ
    return NextResponse.redirect(`${origin}/?error=auth_callback_failed`);
}
