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
              // スクリプト: self + インラインスクリプト（Next.jsが必要） + Stripe + hCaptcha
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com https://hcaptcha.com https://*.hcaptcha.com https://challenges.cloudflare.com",
              // スタイル: self + インラインスタイル（Tailwind等が必要）
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // フォント
              "font-src 'self' https://fonts.gstatic.com data:",
              // 画像: self + Supabase Storage + data URI + blob + Stripe
              "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.com https://replicate.delivery https://pbxt.replicate.delivery https://*.stripe.com https://q.stripe.com https://img.youtube.com",
              // 接続先: self + Supabase + Stripe（すべてのサブドメイン） + AI APIs + hCaptcha
              "connect-src 'self' https://*.supabase.co https://*.supabase.com https://api.stripe.com https://*.stripe.com https://r.stripe.com https://q.stripe.com https://errors.stripe.com https://hcaptcha.com https://*.hcaptcha.com https://api.hcaptcha.com https://generativelanguage.googleapis.com https://api.anthropic.com https://api.replicate.com wss://*.supabase.co",
              // フレーム: Stripe決済 + hCaptcha
              "frame-src 'self' https://js.stripe.com https://*.stripe.com https://hcaptcha.com https://*.hcaptcha.com https://challenges.cloudflare.com https://www.youtube.com https://youtube.com",
              // メディア
              "media-src 'self' blob: https://*.supabase.co https://*.supabase.com",
              // オブジェクト
              "object-src 'none'",
              // ベースURI
              "base-uri 'self'",
              // フォーム送信先
              "form-action 'self' https://*.stripe.com",
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
