import { MONTHLY } from '@/lib/laruhp-facts';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: true, follow: true },
  title: `プラン比較 | LARU HP | 月額${MONTHLY.hp.toLocaleString('ja-JP')}円〜`,
  description: `LARU HP の料金プラン比較。HP単体は月額${MONTHLY.hp.toLocaleString('ja-JP')}円から、HP+Bot Standard・SEO・代理店向けエージェンシープランまで。月払いは初月無料・最低6ヶ月契約。`,
  alternates: {
    canonical: 'https://laruhp.com/plans',
  },
};

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
