'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Check, Loader2, ArrowRight, AlertCircle, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

interface WelcomeData {
  email: string;
  planName: string;
  isNewUser: boolean;
  tempPassword: string | null;
}

function WelcomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');
  const isPasswordSetup = searchParams.get('setup') === 'true';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<WelcomeData | null>(null);

  // パスワード設定用の状態
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Supabaseクライアント
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // パスワード設定モードの場合
    if (isPasswordSetup) {
      // Supabaseがリカバリーリンクを処理してセッションを設定するのを待つ
      const checkSession = async () => {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setError('セッションの取得に失敗しました');
        } else if (!session) {
          // リカバリーリンクがまだ処理中の可能性があるので少し待つ
          setTimeout(async () => {
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (!retrySession) {
              setError('パスワード設定リンクが無効か、有効期限が切れています。ログイン画面から「パスワードを忘れた方」をお試しください。');
            }
            setLoading(false);
          }, 1000);
          return;
        }
        setLoading(false);
      };
      checkSession();
      return;
    }

    // 通常のウェルカムページ（決済完了後）
    if (!sessionId) {
      setError('セッションIDが見つかりません');
      setLoading(false);
      return;
    }

    // Checkout Session情報を取得
    fetch(`/api/billing/checkout/complete?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.error) {
          setError(result.error);
        } else {
          setData(result);
        }
      })
      .catch((err) => {
        setError('情報の取得に失敗しました');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId, isPasswordSetup, supabase.auth]);

  // パスワード設定処理
  const handleSetPassword = async () => {
    setPasswordError('');

    if (password.length < 8) {
      setPasswordError('パスワードは8文字以上で設定してください');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('パスワードが一致しません');
      return;
    }

    setSettingPassword(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setPasswordError(updateError.message);
        return;
      }

      setPasswordSet(true);
    } catch (err: any) {
      setPasswordError(err.message || 'パスワードの設定に失敗しました');
    } finally {
      setSettingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  // パスワード設定完了後
  if (passwordSet) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-primary rounded-sm" />
              <span className="text-xl font-bold tracking-tight">AI画像編集くん</span>
            </div>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center h-16 w-16 bg-green-100 rounded-full mb-6">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              パスワードを設定しました
            </h1>
            <p className="text-muted-foreground">
              これでログインできるようになりました
            </p>
          </div>

          <button
            onClick={() => router.push('/admin')}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 px-6 rounded-lg font-bold text-lg hover:bg-primary/90 transition-colors"
          >
            ダッシュボードへ進む
            <ArrowRight className="h-5 w-5" />
          </button>
        </main>
      </div>
    );
  }

  // パスワード設定モード
  if (isPasswordSetup && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-primary rounded-sm" />
              <span className="text-xl font-bold tracking-tight">AI画像編集くん</span>
            </div>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 bg-blue-100 rounded-full mb-4">
              <Lock className="h-7 w-7 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              パスワードを設定
            </h1>
            <p className="text-muted-foreground">
              ログイン用のパスワードを設定してください
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary pr-12"
                    placeholder="8文字以上"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード（確認）
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="もう一度入力"
                />
              </div>

              {passwordError && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {passwordError}
                </div>
              )}

              <button
                onClick={handleSetPassword}
                disabled={settingPassword || !password || !confirmPassword}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 px-6 rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settingPassword ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    設定中...
                  </>
                ) : (
                  <>
                    パスワードを設定
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || (!data && !isPasswordSetup)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-50 border border-red-100 rounded-xl p-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-red-600 mb-2">エラーが発生しました</h1>
            <p className="text-red-600/80 mb-6">{error || '情報の取得に失敗しました'}</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
            >
              トップに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 決済完了後のウェルカム画面
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

      <main className="max-w-xl mx-auto px-4 py-12">
        {/* Success Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 bg-green-100 rounded-full mb-6">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            ご登録ありがとうございます！
          </h1>
          <p className="text-muted-foreground">
            {data?.planName}プランのお申し込みが完了しました
          </p>
        </div>

        {/* Account Info Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="bg-green-50 px-6 py-6 text-center">
            <Lock className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="font-bold text-xl text-green-800 mb-2">
              アカウントが作成されました
            </h2>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">ログインID（メールアドレス）</p>
              <p className="font-mono font-bold text-lg text-gray-900 bg-gray-50 px-3 py-2 rounded">
                {data?.email}
              </p>
            </div>

            {data?.tempPassword && (
              <div>
                <p className="text-sm text-gray-500 mb-1">初期パスワード</p>
                <p className="font-mono font-bold text-lg text-gray-900 bg-gray-50 px-3 py-2 rounded select-all">
                  {data.tempPassword}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Note */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800">パスワードについて</p>
              <p className="text-sm text-amber-700 mt-1">
                この画面に表示されているパスワードをメモしてください。<br />
                ログイン後、設定画面からパスワードを変更できます。<br />
                パスワードを忘れた場合は、ログイン画面の「パスワードを忘れた方」から再設定できます。
              </p>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => router.push('/')}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 px-6 rounded-lg font-bold text-lg hover:bg-primary/90 transition-colors"
        >
          ログインページへ進む
          <ArrowRight className="h-5 w-5" />
        </button>

        <p className="text-center text-sm text-muted-foreground mt-4">
          上記のメールアドレスとパスワードでログインしてください
        </p>
      </main>
    </div>
  );
}

export default function WelcomePage() {
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
      <WelcomeContent />
    </Suspense>
  );
}
