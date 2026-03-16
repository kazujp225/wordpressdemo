/**
 * セキュリティユーティリティ
 * SSRF防御、入力サニタイズ、BANチェックなど
 */

import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

// ========================================
// SSRF防御: URL検証
// ========================================

// プライベートIPレンジ（SSRF攻撃防止）
const PRIVATE_IP_RANGES = [
  /^127\./,                          // Loopback
  /^10\./,                           // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./,     // Class B private
  /^192\.168\./,                     // Class C private
  /^169\.254\./,                     // Link-local (AWS metadata等)
  /^0\./,                            // Current network
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)/,// Carrier-grade NAT
  /^198\.18\./,                      // Benchmarking
  /^::1$/,                           // IPv6 loopback
  /^fc00:/i,                         // IPv6 unique local
  /^fe80:/i,                         // IPv6 link-local
  /^fd/i,                            // IPv6 private
];

// 危険なプロトコル
const BLOCKED_PROTOCOLS = ['file:', 'ftp:', 'gopher:', 'data:', 'javascript:', 'vbscript:'];

// 内部サービスのホスト名パターン
const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
  'metadata.google',
  '169.254.169.254',          // AWS/GCP metadata
  '169.254.170.2',            // AWS ECS metadata
  'metadata.internal',
  'kubernetes.default',
  'kubernetes.default.svc',
];

/**
 * URLがSSRF攻撃に使われないか検証
 * @returns エラーメッセージ（安全な場合はnull）
 */
export function validateUrlForSSRF(urlString: string): string | null {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return '無効なURL形式です';
  }

  // プロトコルチェック（http/httpsのみ許可）
  if (!['http:', 'https:'].includes(url.protocol)) {
    return `許可されていないプロトコルです: ${url.protocol}`;
  }

  if (BLOCKED_PROTOCOLS.includes(url.protocol)) {
    return 'このプロトコルは許可されていません';
  }

  // ホスト名チェック
  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return 'このホストへのアクセスは許可されていません';
  }

  // IPv6角括弧形式のチェック（[::1] → ::1 に正規化してチェック）
  const normalizedHostname = hostname.replace(/^\[|\]$/g, '');

  // IPアドレスの直接指定チェック
  for (const range of PRIVATE_IP_RANGES) {
    if (range.test(hostname) || range.test(normalizedHostname)) {
      return 'プライベートIPアドレスへのアクセスは許可されていません';
    }
  }

  // 0.0.0.0 / [::] ブロック
  if (hostname === '0.0.0.0' || normalizedHostname === '::' || normalizedHostname === '0000::') {
    return 'プライベートIPアドレスへのアクセスは許可されていません';
  }

  // 10進数/8進数/16進数 IP表現のブロック（DNS rebinding対策）
  // 例: 0x7f000001 (127.0.0.1), 2130706433 (127.0.0.1), 0177.0.0.1
  if (/^0x[0-9a-f]+$/i.test(hostname) || /^\d{8,}$/.test(hostname) || /^0\d+\./.test(hostname)) {
    return 'IPアドレスの特殊表現は許可されていません';
  }

  // 空のホスト名
  if (!hostname || hostname === '') {
    return 'ホスト名が指定されていません';
  }

  // ポート番号チェック（80, 443以外の一般的でないポートを警告）
  const port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);
  const allowedPorts = [80, 443];
  if (!allowedPorts.includes(port)) {
    return `ポート ${port} へのアクセスは許可されていません`;
  }

  // URLにユーザー情報が含まれていないかチェック（http://user:pass@host形式）
  if (url.username || url.password) {
    return 'URLにユーザー情報を含めることはできません';
  }

  return null; // 安全
}

// ========================================
// ファイルアップロード検証
// ========================================

// 許可するMIMEタイプ
const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
  'image/heic',
  'image/heif',
];

const ALLOWED_VIDEO_MIMES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
];

// マジックバイト（ファイルヘッダー）でファイルタイプを検証
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
  'video/mp4': [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]], // ftyp
};

/**
 * ファイルのMIMEタイプとマジックバイトを検証
 */
export function validateFileUpload(
  file: File,
  buffer: Buffer,
  type: 'image' | 'video' = 'image'
): string | null {
  const allowedMimes = type === 'image' ? ALLOWED_IMAGE_MIMES : ALLOWED_VIDEO_MIMES;

  // MIMEタイプチェック
  if (!allowedMimes.includes(file.type)) {
    return `許可されていないファイル形式です: ${file.type}。許可: ${allowedMimes.join(', ')}`;
  }

  // マジックバイト検証（画像・動画の厳密な検証）
  if (buffer.length >= 4) {
    const signatures = MAGIC_BYTES[file.type];
    if (signatures) {
      const matches = signatures.some(sig =>
        sig.every((byte, i) => buffer[i] === byte)
      );
      if (!matches) {
        return 'ファイルの内容がMIMEタイプと一致しません（改ざんの可能性）';
      }
    }
  }

  // ファイル名に危険な文字がないか（ディレクトリトラバーサル防止）
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return '不正なファイル名です';
  }

  // 二重拡張子チェック（例: image.php.jpg）
  const DANGEROUS_EXTENSIONS = ['.php', '.phtml', '.php3', '.php4', '.php5', '.phar', '.asp', '.aspx', '.jsp', '.jspx', '.cgi', '.exe', '.bat', '.sh', '.py', '.pl', '.rb', '.cmd', '.com', '.htaccess', '.shtml'];
  const nameLower = file.name.toLowerCase();
  for (const ext of DANGEROUS_EXTENSIONS) {
    if (nameLower.includes(ext + '.') || nameLower.endsWith(ext)) {
      return '危険なファイル拡張子が含まれています';
    }
  }

  // SVGの場合、XSS検証
  if (file.type === 'image/svg+xml') {
    const content = buffer.toString('utf8');
    // HTMLエンティティをデコードしてからチェック（エンコーディングによるバイパス防止）
    const decoded = content
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
    const checkTargets = [content, decoded];
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /on\w+\s*=/i,  // onload=, onclick= etc.
      /<iframe/i,
      /<embed/i,
      /<object/i,
      /<foreignObject/i,
      /xlink:href\s*=\s*["'](?!#)/i, // External xlink references
      /href\s*=\s*["'](?!#)/i, // <use href="..."> external references
      /@import/i,        // CSS import（外部リソース読み込み防止）
      /expression\s*\(/i, // CSS expression
      /url\s*\(\s*["']?\s*javascript:/i, // CSS url(javascript:)
      /<set\b/i,         // SVG animation set element
      /<animate\b[^>]*\battributeName\s*=\s*["'](?:href|xlink:href)/i, // Animated href changes
    ];
    for (const target of checkTargets) {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(target)) {
          return 'SVGファイルに危険なコンテンツが含まれています';
        }
      }
    }
  }

  return null; // 安全
}

// ========================================
// BANチェック
// ========================================

/**
 * ユーザーがBANされているかチェック
 * @returns BANされている場合はNextResponse、そうでなければnull
 */
export async function checkBanStatus(userId: string): Promise<NextResponse | null> {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { isBanned: true },
    });

    if (settings?.isBanned) {
      return NextResponse.json(
        { error: 'アカウントが停止されています。サポートにお問い合わせください。' },
        { status: 403 }
      );
    }
  } catch (error) {
    // DBエラーをログに記録（セキュリティイベントの監視用）
    console.error(`[SECURITY] BAN check failed for user ${userId}:`, error);
    // DBエラー時は通過させる（可用性優先）
  }

  return null;
}

// ========================================
// エラーレスポンス安全化
// ========================================

/**
 * 内部エラーメッセージを安全な形に変換
 * 本番環境では内部エラーの詳細を隠す
 */
export function safeErrorResponse(
  error: unknown,
  fallbackMessage = '予期しないエラーが発生しました'
): { message: string; status: number } {
  if (process.env.NODE_ENV === 'development') {
    return {
      message: error instanceof Error ? error.message : fallbackMessage,
      status: 500,
    };
  }

  // 本番環境: 内部エラーの詳細を隠す
  return {
    message: fallbackMessage,
    status: 500,
  };
}

// ========================================
// パスワード強度検証
// ========================================

/**
 * パスワードの強度を検証
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'パスワードは8文字以上である必要があります';
  }
  if (password.length > 128) {
    return 'パスワードは128文字以下である必要があります';
  }
  if (!/[A-Z]/.test(password)) {
    return 'パスワードに大文字を含めてください';
  }
  if (!/[a-z]/.test(password)) {
    return 'パスワードに小文字を含めてください';
  }
  if (!/[0-9]/.test(password)) {
    return 'パスワードに数字を含めてください';
  }

  // よくある弱いパスワード
  const commonPasswords = [
    'password', 'Password1', '12345678', 'qwerty123',
    'admin123', 'letmein1', 'welcome1',
  ];
  if (commonPasswords.some(p => password.toLowerCase().includes(p.toLowerCase()))) {
    return 'より強いパスワードを設定してください';
  }

  return null;
}

// ========================================
// 入力サニタイズ
// ========================================

/**
 * HTMLタグを除去（XSS防止 - テキストコンテンツ用）
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * HTMLコンテンツからXSSベクトルを除去（HTML構造は保持）
 * ユーザー提供のHTMLを安全にレンダリングする場合に使用
 */
export function sanitizeHtmlContent(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/vbscript\s*:/gi, 'blocked:')
    .replace(/data\s*:\s*text\/html/gi, 'blocked:text/html');
}

/**
 * ログ出力用にセンシティブ情報をマスク
 */
export function maskSensitive(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars) return '***';
  return value.substring(0, visibleChars) + '***' + value.substring(value.length - 2);
}

// ========================================
// プロンプトインジェクション対策
// ========================================

/**
 * AIプロンプトに挿入するユーザー入力をサニタイズ
 * プロンプトインジェクション攻撃を緩和する
 */
export function sanitizePromptInput(input: string, maxLength = 5000): string {
  return input
    .slice(0, maxLength)
    // プロンプト区切り文字のエスケープ
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // 制御文字を除去（改行・タブは許可）
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

// ========================================
// 安全なURL fetch（SSRF防御付き）
// ========================================

const MAX_FETCH_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * SSRF検証付きのURL fetch
 * ユーザー提供のURLをfetchする際は必ずこの関数を使用する
 */
export async function safeFetch(
  urlString: string,
  options?: RequestInit & { maxSize?: number }
): Promise<Response> {
  const ssrfError = validateUrlForSSRF(urlString);
  if (ssrfError) {
    throw new Error(`URL検証エラー: ${ssrfError}`);
  }

  const maxSize = options?.maxSize ?? MAX_FETCH_SIZE;
  const { maxSize: _, ...fetchOptions } = options || {};

  const response = await fetch(urlString, {
    ...fetchOptions,
    signal: fetchOptions?.signal || AbortSignal.timeout(30000),
  });

  // Content-Lengthでのサイズチェック
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxSize) {
    throw new Error(`レスポンスサイズが上限(${Math.round(maxSize / 1024 / 1024)}MB)を超えています`);
  }

  return response;
}

/**
 * SSRF検証付きで画像URLを取得しBase64に変換
 */
export async function safeFetchImageAsBase64(
  imageUrl: string
): Promise<{ base64: string; mimeType: string }> {
  const response = await safeFetch(imageUrl, { maxSize: 50 * 1024 * 1024 });
  if (!response.ok) {
    throw new Error('画像の取得に失敗しました');
  }
  const arrayBuffer = await response.arrayBuffer();
  // 実際のサイズもチェック
  if (arrayBuffer.byteLength > 50 * 1024 * 1024) {
    throw new Error('画像サイズが上限(50MB)を超えています');
  }
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = response.headers.get('content-type') || 'image/png';
  return { base64, mimeType };
}
