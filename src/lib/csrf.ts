/**
 * CSRF対策ユーティリティ
 *
 * Next.js App RouterのAPIルートでは、以下の方法でCSRF対策を行う:
 * 1. Originヘッダーの検証
 * 2. Content-Typeの検証（JSON APIの場合）
 * 3. カスタムヘッダーの要求（オプション）
 */

import { NextRequest } from 'next/server';

// 許可されたオリジン
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_BASE_URL,
  'https://lpnavix.com',
  'https://www.lpnavix.com',
].filter(Boolean) as string[];

// 開発環境の場合はlocalhostも許可
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000');
  ALLOWED_ORIGINS.push('http://127.0.0.1:3000');
}

export interface CSRFCheckResult {
  valid: boolean;
  reason?: string;
}

/**
 * リクエストのCSRF検証を行う
 *
 * 検証内容:
 * 1. Originヘッダーが許可リストに含まれているか
 * 2. POSTリクエストの場合、Content-Typeがapplication/jsonか
 */
export function validateCSRF(request: NextRequest): CSRFCheckResult {
  // GETリクエストはCSRF対策不要（状態変更しない前提）
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return { valid: true };
  }

  // Webhookエンドポイントはスキップ（署名検証で保護）
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/webhooks/')) {
    return { valid: true };
  }

  // フォーム送信APIはスキップ（公開エンドポイント）
  if (pathname === '/api/form-submissions') {
    return { valid: true };
  }

  // Originヘッダーの検証
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // Originがある場合は厳密にチェック
  if (origin) {
    const isAllowedOrigin = ALLOWED_ORIGINS.some(allowed =>
      origin === allowed || origin.startsWith(allowed)
    );

    if (!isAllowedOrigin) {
      return {
        valid: false,
        reason: `Invalid origin: ${origin}`,
      };
    }
  } else if (referer) {
    // Originがない場合はRefererをチェック
    const isAllowedReferer = ALLOWED_ORIGINS.some(allowed =>
      referer.startsWith(allowed)
    );

    if (!isAllowedReferer) {
      return {
        valid: false,
        reason: `Invalid referer: ${referer}`,
      };
    }
  }
  // OriginもRefererもない場合は、同一オリジンからのリクエストとみなす
  // （一部のブラウザやプロキシでヘッダーが削除される場合がある）

  // Content-Typeの検証（JSONを期待するエンドポイントの場合）
  const contentType = request.headers.get('content-type');
  if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
    // text/plainやapplication/x-www-form-urlencodedは拒否
    // （ただしファイルアップロードは許可）
    if (contentType.includes('text/plain') || contentType.includes('application/x-www-form-urlencoded')) {
      return {
        valid: false,
        reason: `Invalid content-type: ${contentType}`,
      };
    }
  }

  return { valid: true };
}

/**
 * CSRF検証を行い、失敗した場合はエラーレスポンスを返すヘルパー
 */
export function csrfCheck(request: NextRequest): CSRFCheckResult {
  return validateCSRF(request);
}
