# トラブルシューティング: クレジット不足エラーが常に表示される

## 発生日
2026-02-10

## 報告内容
Enterpriseプラン（110,000クレジット）のユーザー（renrenfujiwara）が、設定画面ではクレジット残高が正しく表示されているにも関わらず、インペイント（AI画像編集）画面で常に「クレジット不足」と表示され、ボタンが無効化されていた。

## 原因

### `/api/user/status` が `creditBalanceUsd` を返していなかった

**該当ファイル:** `src/app/api/user/status/route.ts`

フロントエンド（`ImageInpaintEditor.tsx`）はクレジット残高チェックのために `/api/user/status` を呼び出し、レスポンスの `creditBalanceUsd` を参照していた。

```typescript
// ImageInpaintEditor.tsx:198
setCreditBalance(data.creditBalanceUsd || 0);
```

しかし、APIのレスポンスにはこのフィールドが含まれていなかった。

```typescript
// 修正前のレスポンス
{
  userId, isBanned, banReason, plan, hasActiveSubscription
  // creditBalanceUsd が無い
}
```

### 結果として起きた判定

```
data.creditBalanceUsd → undefined
undefined || 0 → 0（残高0と判定）
0 < 0.134（INPAINT_COST_USD）→ true
→ hasInsufficientCredit = true → 「クレジット不足」表示
```

実際にはDBに残高があっても、APIが返さないため常に残高0として扱われていた。

## 修正内容

**ファイル:** `src/app/api/user/status/route.ts`

`CreditBalance` テーブルから `balanceUsd` を取得し、レスポンスに `creditBalanceUsd` フィールドを追加。

```typescript
// 修正後: UserSettingsとCreditBalanceを並列取得
const [settings, creditBalance] = await Promise.all([
  prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { isBanned: true, banReason: true, plan: true },
  }),
  prisma.creditBalance.findUnique({
    where: { userId: user.id },
    select: { balanceUsd: true },
  }),
]);

// レスポンスに追加
return NextResponse.json({
  userId: user.id,
  isBanned,
  banReason: isBanned ? settings?.banReason : null,
  plan,
  hasActiveSubscription,
  creditBalanceUsd: creditBalance?.balanceUsd ? Number(creditBalance.balanceUsd) : 0,
});
```

## 影響範囲

- `src/app/api/user/status/route.ts` — APIレスポンスにフィールド追加
- 影響を受けていたUI: `src/components/lp-builder/ImageInpaintEditor.tsx` のインペイントボタン

## 関連するデータの流れ

```
設定画面（正常に表示）   インペイント画面（バグ）
       │                        │
  /api/billing等 ──→ OK    /api/user/status ──→ creditBalanceUsd が無い
       │                        │
  DB: CreditBalance         レスポンスに含まれず
  balanceUsd = 7.33         → 0 と判定
  (= 110,000クレジット)     → 「クレジット不足」
```

## 教訓

- フロントエンドが参照するAPIフィールドは、バックエンド側で確実に返すこと
- クレジット残高のような重要なデータは、実際のユーザーで動作確認すること
