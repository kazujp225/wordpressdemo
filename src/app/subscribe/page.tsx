'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Check, Zap, Building2, Crown, LogOut, FlaskConical } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PLANS } from '@/lib/plans';

type PaidPlanType = 'pro' | 'business' | 'enterprise' | 'test';

const PAID_PLANS: { id: PaidPlanType; icon: React.ReactNode; popular?: boolean }[] = [
  { id: 'test', icon: <FlaskConical className="h-5 w-5" /> },
  { id: 'pro', icon: <Zap className="h-5 w-5" /> },
  { id: 'business', icon: <Building2 className="h-5 w-5" />, popular: true },
  { id: 'enterprise', icon: <Crown className="h-5 w-5" /> },
];

export default function SubscribePage() {
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanType>('business');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // 現在のユーザーのメールを取得
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email);
      }
    });
  }, [supabase]);

  const handleCheckout = async () => {
    setError('');
    setLoading(true);

    try {
      // 既存ユーザー向けのCheckout APIを呼び出し
      const res = await fetch('/api/billing/subscription/create', {
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded-sm" />
            <span className="text-xl font-bold tracking-tight">AI画像編集くん</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            プランを選択してください
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            サービスをご利用いただくにはプランの契約が必要です。
          </p>
          {userEmail && (
            <p className="text-sm text-muted-foreground mt-2">
              ログイン中: {userEmail}
            </p>
          )}
        </div>

        {/* Plan Selection */}
        <div className="mb-8">
          <div className="grid md:grid-cols-4 gap-4">
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
          <div className="max-w-md mx-auto p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100 mb-6">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="max-w-md mx-auto">
          <button
            onClick={handleCheckout}
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
        </div>

        {/* Trust Badges */}
        <div className="mt-12 pt-8 border-t border-gray-100">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>安全なStripe決済</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>いつでもキャンセル可能</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
