import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge Middleware - 認証のみ処理
 *
 * セキュリティ方針:
 * - Edge Runtimeではservice_roleキーを使用しない（漏洩リスク回避）
 * - BAN/planチェックは各APIルート（Node.js Runtime）で実施
 * - ここでは認証状態の確認とセッション更新のみ行う
 */

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
            global: {
                fetch: (url: RequestInfo | URL, init?: RequestInit) => {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);
                    return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
                },
            },
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
    let user = null;
    let authNetworkError = false;
    try {
        const { data, error } = await supabase.auth.getUser();
        user = data?.user ?? null;
        if (error) {
            // fetch失敗（タイムアウト含む）はネットワークエラーとして扱う
            if (error.message === 'fetch failed' || error.message?.includes('abort')) {
                console.error('Auth Network Error (timeout):', error.message);
                authNetworkError = true;
            } else {
                console.error('Auth Error:', error.message);
            }
        }
    } catch (e: any) {
        console.error('Auth Exception:', e?.message);
        authNetworkError = true;
    }

    const pathname = request.nextUrl.pathname;

    // 認証不要のパブリックルート
    const publicRoutes = ['/', '/auth/callback', '/terms', '/privacy', '/welcome', '/banned'];
    const isPublicRoute = publicRoutes.includes(pathname)
        || pathname.startsWith('/p/')
        || pathname.startsWith('/api/auth/')
        || pathname.startsWith('/api/billing/')
        || pathname.startsWith('/api/webhooks/')
        || pathname.startsWith('/api/user/status')  // BAN/planチェック用API
        || pathname.startsWith('/api/inquiries/password-reset')  // パスワードリセット依頼
        || pathname.startsWith('/reset-password');

    // ネットワークエラー時はリダイレクトせずリクエストを通す（認証失敗ではなく接続障害）
    if (!user && authNetworkError && !isPublicRoute) {
        return response;
    }

    // 未認証ユーザーがプライベートルートにアクセスした場合、ログインページへリダイレクト
    if (!user && !isPublicRoute) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // 認証済みユーザーがトップページにアクセスした場合、/adminへリダイレクト
    // （BAN/planチェックは/admin側のクライアントコードまたはAPIで行う）
    if (user && pathname === '/') {
        return NextResponse.redirect(new URL('/admin', request.url));
    }

    return response;
}
