import { MONTHLY } from '@/lib/laruhp-facts';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: true, follow: true },
  // 「ホームページ 月額 料金」で探す人に、何の料金かが題で分かるように（2026-10-06）
  title: `料金プラン｜ホームページ作成 月額${MONTHLY.hp.toLocaleString('ja-JP')}円〜・初月無料 | LARU HP`,
  description: `LARU HP の料金プラン比較。HP単体は月額${MONTHLY.hp.toLocaleString('ja-JP')}円（税別）から、HP+Bot Standard・SEO・代理店向けエージェンシープランまで。月払いは初月無料・最低6ヶ月契約。独自ドメイン費は別です。`,
  alternates: {
    canonical: 'https://laruhp.com/plans',
  },
};

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
