import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'プラン比較 | LARU HP | 月額999円〜',
  description: 'LARU HP の料金プラン比較。HP単体は月額999円から、HP+LARUbot・SEO・代理店向けエージェンシープランまで。全プラン初月無料・最低6ヶ月契約。',
  alternates: {
    canonical: 'https://laruvisona.jp/laruHP/plans',
  },
};

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
