import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// ユーザーステータスをチェックする関数
interface UserStatus {
    isBanned: boolean;
    hasActiveSubscription: boolean;
    plan: string | null;
}

async function checkUserStatus(userId: string): Promise<UserStatus> {
    // Supabaseの直接クエリを使用（Prismaはエッジランタイムで使えない）
    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // UserSettingsを取得
    const { data: settings } = await supabaseAdmin
        .from('UserSettings')
        .select('isBanned, plan')
        .eq('userId', userId)
        .single();

    // Subscriptionを取得
    const { data: subscription } = await supabaseAdmin
        .from('Subscription')
        .select('status, plan')
        .eq('userId', userId)
        .single();

    const isBanned = settings?.isBanned === true;

    // 有効なサブスクリプションがあるかチェック
    // active または past_due（支払い遅延中だがまだアクセス可能）の場合は有効
    const hasActiveSubscription =
        subscription?.status === 'active' ||
        subscription?.status === 'past_due';

    const plan = subscription?.plan || settings?.plan || null;

    return {
        isBanned,
        hasActiveSubscription,
        plan,
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
    const publicRoutes = ['/', '/auth/callback', '/terms', '/privacy', '/welcome'];
    const isPublicRoute = publicRoutes.includes(pathname)
        || pathname.startsWith('/p/')
        || pathname.startsWith('/api/auth/')
        || pathname.startsWith('/api/billing/checkout')
        || pathname.startsWith('/api/webhooks/');

    // 特殊ページ
    const isBannedPage = pathname === '/banned';
    const isSubscriptionRequiredPage = pathname === '/subscribe';
    const isAdminRoute = pathname.startsWith('/admin');

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

        // 有効なサブスクリプションがない場合（adminルートへのアクセス時のみ）
        if (isAdminRoute && !status.hasActiveSubscription) {
            // サブスク必要ページへリダイレクト
            return NextResponse.redirect(new URL('/subscribe', request.url));
        }

        // サブスク必要ページにいるが、すでにサブスクがある場合
        if (isSubscriptionRequiredPage && status.hasActiveSubscription) {
            return NextResponse.redirect(new URL('/admin', request.url));
        }

        // ログインページにアクセスしている場合
        if (pathname === '/') {
            if (status.isBanned) {
                return NextResponse.redirect(new URL('/banned', request.url));
            }
            if (!status.hasActiveSubscription) {
                return NextResponse.redirect(new URL('/subscribe', request.url));
            }
            return NextResponse.redirect(new URL('/admin', request.url));
        }
    }

    return response;
}
