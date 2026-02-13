'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock, Check, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function ResetPasswordConfirmContent() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const hasChecked = useRef(false);

  useEffect(() => {
    // 二重実行を防止
    if (hasChecked.current) return;
    hasChecked.current = true;

    const checkSession = async () => {
      console.log('Checking session...');
      console.log('URL hash:', window.location.hash);
      console.log('URL search:', window.location.search);

      // Supabaseの認証状態変更をリッスン
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);

        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
          setSessionValid(true);
          setChecking(false);
        }
      });

      // まず既存セッションを確認
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session?.user?.email);

      if (session) {
        setSessionValid(true);
        setChecking(false);
        return;
      }

      // URLのハッシュフラグメントからトークンを検出（Supabase PKCEフロー）
      // Supabase JS clientは自動的にハッシュを処理してセッションを確立する
      const hash = window.location.hash;
      if (hash && hash.includes('type=recovery')) {
        console.log('Found recovery token in hash, waiting for Supabase to process...');

        // Supabaseがハッシュを処理するまで待機
        // クライアントが自動的にハッシュを読み取りセッションを確立する
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data: { session: newSession } } = await supabase.auth.getSession();
        console.log('Session after hash processing:', newSession?.user?.email);

        if (newSession) {
          setSessionValid(true);
          setChecking(false);
          // ハッシュをURLから削除（見た目のクリーンアップ）
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }
      }

      // URLにcodeがある場合（PKCEフロー - code exchange）
      const code = searchParams.get('code');
      if (code) {
        console.log('Found code parameter, exchanging for session...');
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        console.log('Code exchange result:', data?.session?.user?.email, error);

        if (!error && data.session) {
          setSessionValid(true);
          setChecking(false);
          return;
        }
      }

      // URLにtokenがある場合（token_hash方式）
      const token = searchParams.get('token');
      const type = searchParams.get('type');

      if (token && type === 'recovery') {
        console.log('Found token parameter, verifying OTP...');
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'recovery',
        });
        console.log('OTP verification result:', data?.session?.user?.email, error);

        if (!error && data.session) {
          setSessionValid(true);
          setChecking(false);
          return;
        }
      }

      // 最終確認 - 少し待ってからもう一度セッションをチェック
      await new Promise(resolve => setTimeout(resolve, 1500));
      const { data: { session: finalSession } } = await supabase.auth.getSession();
      console.log('Final session check:', finalSession?.user?.email);

      if (finalSession) {
        setSessionValid(true);
      }
      setChecking(false);
    };

    checkSession();
  }, [supabase, searchParams]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">確認中...</p>
        </div>
      </div>
    );
  }

  if (!sessionValid) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-primary rounded-sm" />
              <span className="text-xl font-bold tracking-tight">OTASUKE！なんでもしゅうせいくん</span>
            </div>
          </div>
        </header>

        <main className="flex items-center justify-center min-h-[calc(100vh-73px)] px-4">
          <div className="w-full max-w-md text-center space-y-6">
            <div className="inline-flex items-center justify-center h-16 w-16 bg-red-100 rounded-full mx-auto">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">リンクが無効です</h2>
              <p className="text-muted-foreground">
                パスワード再設定リンクの有効期限が切れているか、無効なリンクです。
                もう一度パスワード再設定をお試しください。
              </p>
            </div>
            <button
              onClick={() => router.push('/reset-password')}
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 px-6 rounded-lg font-bold hover:bg-primary/90 transition-colors"
            >
              パスワード再設定ページへ
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded-sm" />
            <span className="text-xl font-bold tracking-tight">OTASUKE！なんでもしゅうせいくん</span>
          </div>
        </div>
      </header>

      <main className="flex items-center justify-center min-h-[calc(100vh-73px)] px-4">
        <div className="w-full max-w-md space-y-8">
          {success ? (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center h-16 w-16 bg-green-100 rounded-full mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">パスワードを更新しました</h2>
                <p className="text-muted-foreground">
                  新しいパスワードでログインできます。
                </p>
              </div>
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 px-6 rounded-lg font-bold hover:bg-primary/90 transition-colors"
              >
                ログインページへ
              </button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight">新しいパスワードを設定</h2>
                <p className="mt-2 text-muted-foreground">
                  6文字以上のパスワードを入力してください
                </p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-bold">
                    新しいパスワード
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="6文字以上"
                      required
                      minLength={6}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-bold">
                    パスワード確認
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="もう一度入力"
                      required
                      minLength={6}
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
                    'パスワードを更新'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">読み込み中...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordConfirmContent />
    </Suspense>
  );
}
