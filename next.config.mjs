/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Production builds will ignore ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Production builds will still check types
    ignoreBuildErrors: false,
  },
  // セキュリティヘッダー
  async headers() {
    return [
      {
        // すべてのルートに適用
        source: '/:path*',
        headers: [
          // XSS対策
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // クリックジャッキング対策
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          // MIMEタイプスニッフィング対策
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // リファラーポリシー
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // HTTPSの強制（HSTS）
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // Permissions-Policy（旧Feature-Policy）
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // スクリプト: self + インラインスクリプト（Next.jsが必要） + 外部サービス
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://challenges.cloudflare.com",
              // スタイル: self + インラインスタイル（Tailwind等が必要）
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // フォント
              "font-src 'self' https://fonts.gstatic.com data:",
              // 画像: self + Supabase Storage + data URI + blob
              "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.com https://replicate.delivery https://pbxt.replicate.delivery",
              // 接続先: self + Supabase + Stripe + AI APIs
              "connect-src 'self' https://*.supabase.co https://*.supabase.com https://api.stripe.com https://generativelanguage.googleapis.com https://api.anthropic.com https://api.replicate.com wss://*.supabase.co",
              // フレーム: Stripeの決済画面用
              "frame-src 'self' https://js.stripe.com https://challenges.cloudflare.com",
              // メディア
              "media-src 'self' blob: https://*.supabase.co https://*.supabase.com",
              // オブジェクト
              "object-src 'none'",
              // ベースURI
              "base-uri 'self'",
              // フォーム送信先
              "form-action 'self'",
              // frame-ancestors（クリックジャッキング対策）
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
