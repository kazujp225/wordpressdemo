'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Mail, Lock, UserPlus, Key } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // メールアドレス形式チェック
      if (!identifier.includes('@')) {
        setError('メールアドレスを入力してください');
        setLoading(false);
        return;
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: identifier,
        password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('メールアドレスまたはパスワードが正しくありません');
        } else if (authError.message.includes('Email not confirmed')) {
          setError('メールアドレスが確認されていません。メールを確認してください。');
        } else {
          setError(authError.message);
        }
        return;
      }

      if (data.user) {
        router.push('/admin');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || '認証に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // メールアドレス形式チェック
    if (!identifier.includes('@')) {
      setError('メールアドレスを入力してください');
      return;
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    if (!invitePassword) {
      setError('招待パスワードを入力してください');
      return;
    }

    setLoading(true);

    try {
      // サーバーサイドで招待パスワードを検証
      const verifyRes = await fetch('/api/auth/verify-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: invitePassword }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.valid) {
        setError(verifyData.error || '招待パスワードが正しくありません');
        setLoading(false);
        return;
      }
    } catch (err) {
      setError('招待パスワードの検証に失敗しました');
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: identifier,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('このメールアドレスは既に登録されています');
        } else {
          setError(authError.message);
        }
        return;
      }

      if (data.user) {
        // Check if email confirmation is required
        if (data.user.identities?.length === 0) {
          setError('このメールアドレスは既に登録されています');
        } else if (!data.session) {
          setSuccess('確認メールを送信しました。メールのリンクをクリックして登録を完了してください。');
          setIdentifier('');
          setPassword('');
          setConfirmPassword('');
          setInvitePassword('');
        } else {
          // Auto-confirmed (development mode or specific settings)
          router.push('/admin');
          router.refresh();
        }
      }
    } catch (err: any) {
      setError(err.message || '登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: Branding/Visual */}
      <div className="hidden lg:flex flex-col justify-between bg-surface-50 border-r border-border p-12">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="h-8 w-8 bg-primary rounded-sm" />
            <span className="text-xl font-bold tracking-tight">LP Builder</span>
          </div>
          <h1 className="text-5xl font-bold tracking-tighter leading-tight max-w-lg mb-6 text-foreground">
            洗練されたランディングページを、<br />
            極めるために。
          </h1>
          <p className="text-xl text-muted-foreground max-w-md">
            美学とパフォーマンスを追求するプロフェッショナルのための、次世代ページビルダー。
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <div className="h-2 w-2 rounded-full bg-primary/20" />
            <div className="h-2 w-2 rounded-full bg-primary/20" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            © 2024 ZettAI Inc. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center gap-2">
              <span className="text-lg font-black tracking-tighter">LP Builder</span>
            </div>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {mode === 'login' ? 'おかえりなさい' : '新規登録'}
            </h2>
            <p className="text-muted-foreground">
              {mode === 'login'
                ? 'メールアドレスとパスワードでログイン'
                : 'メールアドレスで新規アカウントを作成'}
            </p>
          </div>

          {/* Tab Switch */}
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setSuccess('');
                setInvitePassword('');
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${mode === 'login'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              ログイン
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
                setSuccess('');
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${mode === 'register'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              新規登録
            </button>
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="identifier" className="text-sm font-bold text-foreground">
                メールアドレス
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="identifier"
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-md text-base md:text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="email@example.com"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-bold text-foreground">
                パスワード
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-md text-base md:text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="6文字以上"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {mode === 'register' && (
              <>
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-bold text-foreground">
                    パスワード確認
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-md text-base md:text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="パスワードを再入力"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="invitePassword" className="text-sm font-bold text-foreground">
                    招待パスワード
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      id="invitePassword"
                      type="password"
                      value={invitePassword}
                      onChange={(e) => setInvitePassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-md text-base md:text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="招待パスワードを入力"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ※ 新規登録には招待パスワードが必要です
                  </p>
                </div>
              </>
            )}

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-md border border-red-100 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 text-green-600 text-sm font-medium rounded-md border border-green-100 dark:bg-green-950/30 dark:border-green-900 dark:text-green-400">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 px-6 rounded-md font-bold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-none"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === 'login' ? (
                <>
                  ログイン
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  アカウント作成
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
