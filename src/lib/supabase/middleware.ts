import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// ユーザーステータスをチェックする関数
interface UserStatus {
    isBanned: boolean;
}

async function checkUserStatus(userId: string): Promise<UserStatus> {
    // Supabaseの直接クエリを使用（Prismaはエッジランタイムで使えない）
    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
        .from('UserSettings')
        .select('isBanned')
        .eq('userId', userId)
        .single();

    if (error || !data) {
        // UserSettingsが存在しない場合は未BAN
        return { isBanned: false };
    }

    return {
        isBanned: data.isBanned === true,
    };
}

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                },
            },
        }
    );

    // セッションを更新（重要: auth.getUser()を使用）
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
        console.error('Auth Error:', error.message);
    }

    const pathname = request.nextUrl.pathname;

    // 認証不要のパブリックルート
    const publicRoutes = ['/', '/auth/callback', '/terms', '/privacy'];
    const isPublicRoute = publicRoutes.includes(pathname)
        || pathname.startsWith('/p/')
        || pathname.startsWith('/api/auth/');

    // 特殊ページ
    const isBannedPage = pathname === '/banned';

    // 未認証ユーザーがプライベートルートにアクセスした場合、ログインページへリダイレクト
    if (!user && !isPublicRoute) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // 認証済みユーザーの場合
    if (user) {
        // ユーザーステータスをチェック
        const status = await checkUserStatus(user.id);

        // BANされている場合は常にBANページへ
        if (status.isBanned && !isBannedPage) {
            return NextResponse.redirect(new URL('/banned', request.url));
        }

        // BANページにいるが、BANされていない場合はリダイレクト
        if (isBannedPage && !status.isBanned) {
            return NextResponse.redirect(new URL('/admin', request.url));
        }

        // ログインページにアクセスしている場合は管理画面へ
        if (pathname === '/') {
            if (status.isBanned) {
                return NextResponse.redirect(new URL('/banned', request.url));
            }
            return NextResponse.redirect(new URL('/admin', request.url));
        }
    }

    return response;
}
