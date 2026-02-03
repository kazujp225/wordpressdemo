'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Mail, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email.includes('@')) {
        setError('有効なメールアドレスを入力してください');
        setLoading(false);
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password/confirm`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded-sm" />
            <span className="text-xl font-bold tracking-tight">AI画像編集くん</span>
          </div>
        </div>
      </header>

      <main className="flex items-center justify-center min-h-[calc(100vh-73px)] px-4">
        <div className="w-full max-w-md space-y-8">
          {success ? (
            /* 送信完了 */
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center h-16 w-16 bg-green-100 rounded-full mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">メールを送信しました</h2>
                <p className="text-muted-foreground">
                  {email} 宛にパスワード再設定用のメールを送信しました。
                  メール内のリンクをクリックして、新しいパスワードを設定してください。
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                メールが届かない場合は、迷惑メールフォルダをご確認ください。
              </p>
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                ログインページに戻る
              </button>
            </div>
          ) : (
            /* 入力フォーム */
            <>
              <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight">パスワードを再設定</h2>
                <p className="mt-2 text-muted-foreground">
                  登録したメールアドレスを入力してください
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-bold">
                    メールアドレス
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="email@example.com"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 px-6 rounded-lg font-bold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    '再設定メールを送信'
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    ログインページに戻る
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
