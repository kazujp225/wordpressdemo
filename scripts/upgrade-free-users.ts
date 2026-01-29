/**
 * 既存のfreeプランユーザーをproプランに格上げするスクリプト
 * UserSettingsとSubscriptionの両方を更新
 *
 * 実行方法:
 * npx tsx scripts/upgrade-free-users.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Free → Pro ユーザー格上げスクリプト ===\n');

  // freeプランのユーザーを検索
  const freeUsers = await prisma.userSettings.findMany({
    where: { plan: 'free' },
  });

  console.log(`freeプランユーザー数: ${freeUsers.length}`);

  if (freeUsers.length === 0) {
    console.log('格上げ対象のユーザーはいません');
    return;
  }

  let upgradedCount = 0;

  for (const user of freeUsers) {
    try {
      // UserSettingsのプランを更新
      await prisma.userSettings.update({
        where: { userId: user.userId },
        data: { plan: 'pro' },
      });

      // Subscriptionが存在しない場合は作成
      const existingSubscription = await prisma.subscription.findUnique({
        where: { userId: user.userId },
      });

      if (!existingSubscription) {
        // 管理者による手動付与のSubscriptionを作成
        // stripeCustomerIdは一意制約があるため、仮のIDを生成
        await prisma.subscription.create({
          data: {
            userId: user.userId,
            stripeCustomerId: `manual_upgrade_${user.userId}`,
            stripeSubscriptionId: null,
            stripePriceId: process.env.STRIPE_PRICE_PRO || 'price_pro',
            plan: 'pro',
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1年間有効
            cancelAtPeriodEnd: false,
          },
        });
        console.log(`  ✅ ${user.email || user.userId}: Subscription作成 + Pro格上げ`);
      } else {
        // 既存のSubscriptionを更新
        await prisma.subscription.update({
          where: { userId: user.userId },
          data: {
            plan: 'pro',
            status: 'active',
          },
        });
        console.log(`  ✅ ${user.email || user.userId}: Subscription更新 + Pro格上げ`);
      }

      upgradedCount++;
    } catch (error) {
      console.error(`  ❌ ${user.email || user.userId}: エラー`, error);
    }
  }

  console.log(`\n完了: ${upgradedCount}/${freeUsers.length}人をproプランに格上げしました`);
}

main()
  .catch((e) => {
    console.error('エラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
