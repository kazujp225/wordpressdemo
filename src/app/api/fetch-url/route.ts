import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateUrlForSSRF, checkBanStatus } from '@/lib/security';

// レスポンスボディの最大サイズ（10MB）
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // BANチェック
  const banResponse = await checkBanStatus(user.id);
  if (banResponse) return banResponse;

  const { url } = await request.json();
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  // SSRF防御: URLを検証
  const ssrfError = validateUrlForSSRF(url);
  if (ssrfError) {
    return NextResponse.json({ error: ssrfError }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15秒タイムアウト

    const MAX_REDIRECTS = 5;
    let currentUrl = url;

    let response: Response | null = null;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      response = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en;q=0.9',
        },
        cache: 'no-store',
        redirect: 'manual',
        signal: controller.signal,
      });

      // リダイレクトの場合、リダイレクト先をSSRF検証してから追従
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          return NextResponse.json({ error: 'リダイレクト先が不明です' }, { status: 502 });
        }
        // プロトコル相対URL・相対URLの安全な解決
        let redirectUrl: string;
        try {
          const resolved = new URL(location, currentUrl);
          // http/httpsのみ許可（プロトコル相対URLやdata:等を防止）
          if (!['http:', 'https:'].includes(resolved.protocol)) {
            return NextResponse.json({ error: 'リダイレクト先のプロトコルが許可されていません' }, { status: 400 });
          }
          redirectUrl = resolved.toString();
        } catch {
          return NextResponse.json({ error: 'リダイレクト先URLが不正です' }, { status: 400 });
        }
        const redirectSsrfError = validateUrlForSSRF(redirectUrl);
        if (redirectSsrfError) {
          return NextResponse.json({ error: `リダイレクト先が安全ではありません: ${redirectSsrfError}` }, { status: 400 });
        }
        currentUrl = redirectUrl;
        continue;
      }
      break;
    }

    clearTimeout(timeout);

    if (!response || !response.ok) {
      return NextResponse.json({ error: `取得失敗: ステータス ${response?.status}` }, { status: 502 });
    }

    // Content-Typeチェック（HTMLのみ許可、大文字小文字を区別しない）
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!['text/html', 'application/xhtml+xml'].includes(contentType)) {
      return NextResponse.json({ error: 'HTMLコンテンツのみ取得可能です' }, { status: 400 });
    }

    // レスポンスサイズチェック
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      return NextResponse.json({ error: 'レスポンスが大きすぎます（上限10MB）' }, { status: 400 });
    }

    const html = await response.text();

    // サイズ再チェック（Content-Lengthがない場合用）
    if (html.length > MAX_RESPONSE_SIZE) {
      return NextResponse.json({ error: 'レスポンスが大きすぎます（上限10MB）' }, { status: 400 });
    }

    return NextResponse.json({ html });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'リクエストがタイムアウトしました' }, { status: 504 });
    }
    return NextResponse.json({ error: 'URLの取得に失敗しました' }, { status: 502 });
  }
}
