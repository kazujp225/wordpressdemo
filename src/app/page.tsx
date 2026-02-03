'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Mail, Lock, Check, Zap, Building2, Crown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PLANS } from '@/lib/plans';

type PaidPlanType = 'pro' | 'business' | 'enterprise';

const PAID_PLANS: { id: PaidPlanType; icon: React.ReactNode; popular?: boolean }[] = [
  { id: 'pro', icon: <Zap className="h-5 w-5" /> },
  { id: 'business', icon: <Building2 className="h-5 w-5" />, popular: true },
  { id: 'enterprise', icon: <Crown className="h-5 w-5" /> },
];

export default function LandingPage() {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanType>('business');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // プランIDのみでCheckout APIを呼び出し（メールアドレスはStripeで入力）
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlan }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '決済セッションの作成に失敗しました');
        return;
      }

      // Stripe Checkoutへリダイレクト
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email.includes('@')) {
        setError('メールアドレスを入力してください');
        setLoading(false);
        return;
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('メールアドレスまたはパスワードが正しくありません');
        } else if (authError.message.includes('Email not confirmed')) {
          setError('メールアドレスが確認されていません');
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded-sm" />
            <span className="text-xl font-bold tracking-tight">LP Builder</span>
          </div>
          <button
            onClick={() => {
              setMode(mode === 'signup' ? 'login' : 'signup');
              setError('');
            }}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === 'signup' ? 'ログインはこちら' : '新規登録はこちら'}
          </button>
        </div>
      </header>

      {mode === 'signup' ? (
        /* Signup Flow */
        <main className="max-w-4xl mx-auto px-4 py-12">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              洗練されたLPを、<br className="md:hidden" />極めるために。
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              AI画像生成で美しいランディングページを作成。
              プラン選択後すぐにご利用開始できます。
            </p>
          </div>

          <form onSubmit={handleCheckout} className="space-y-8">
            {/* Plan Selection */}
            <div>
              <h2 className="text-lg font-bold text-center mb-6">プランを選択</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {PAID_PLANS.map(({ id, icon, popular }) => {
                  const plan = PLANS[id];
                  const isSelected = selectedPlan === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedPlan(id)}
                      className={`relative p-6 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-lg'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {popular && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                          人気
                        </span>
                      )}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-gray-100'}`}>
                          {icon}
                        </div>
                        <div>
                          <h3 className="font-bold">{plan.name}</h3>
                          <p className="text-2xl font-bold">{plan.priceDisplay}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                      <ul className="space-y-2">
                        {plan.features.slice(0, 4).map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-gray-400'}`} />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {isSelected && (
                        <div className="absolute top-4 right-4">
                          <div className="h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="max-w-md mx-auto p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="max-w-md mx-auto">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 px-6 rounded-lg font-bold text-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    決済に進む
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
              <p className="text-xs text-center text-muted-foreground mt-3">
                決済完了後、入力したメールアドレスにログイン情報が送信されます
              </p>
            </div>
          </form>

          {/* Trust Badges */}
          <div className="mt-16 pt-8 border-t border-gray-100">
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>安全なStripe決済</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>いつでもキャンセル可能</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>即時利用開始</span>
              </div>
            </div>
          </div>
        </main>
      ) : (
        /* Login Flow */
        <main className="flex items-center justify-center min-h-[calc(100vh-73px)] px-4">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight">おかえりなさい</h2>
              <p className="mt-2 text-muted-foreground">
                メールアドレスとパスワードでログイン
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-bold">
                  メールアドレス
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    id="login-email"
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

              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-bold">
                  パスワード
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="パスワード"
                    required
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
                  <>
                    ログイン
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>

              <div className="text-center">
                <a
                  href="/reset-password"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  パスワードを忘れた方はこちら
                </a>
              </div>
            </form>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <p className="text-sm text-center text-muted-foreground">
            © 2024 AI画像編集くん All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
