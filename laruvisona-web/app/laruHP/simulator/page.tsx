import type { Metadata } from 'next';
import { laruhpOgImage } from '@/lib/laruhp-seo';
import { jsonForScript } from '@/lib/safe-markup';
import SimulatorClient from './simulator-client';

/**
 * 「うちの場合、いくら？」を1画面で終わらせるページ。
 *
 * 料金ページは5プランを横に並べているだけで、自分がどれに当たるかは読む側が判断する。
 * 実際にいちばん多い止まり方が「結局いくらか分からない」なので、そこを潰す。
 * 判定と金額は lib/plan-advice.ts に置き、テストで固定している。
 */

const TITLE = 'ホームページの料金を見積る｜やりたいことを選ぶだけ - LARU HP';
const DESCRIPTION =
  'やりたいことを選ぶと、合うプランと1年目に支払う合計が出ます。登録は不要です。初月無料・最低利用期間・独自ドメイン費が別であることまで含めて、そのまま表示します。';
const URL = 'https://laruhp.com/simulator';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    type: 'website',
    images: [laruhpOgImage('うちの場合、いくら？', 'やりたいことを選ぶだけの料金見積り')],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [laruhpOgImage('うちの場合、いくら？', 'やりたいことを選ぶだけの料金見積り').url],
  },
};

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'LARU HP', item: 'https://laruhp.com/' },
    { '@type': 'ListItem', position: 2, name: '料金の見積り', item: URL },
  ],
};

export default function SimulatorPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(breadcrumb) }} />
      <SimulatorClient />
    </>
  );
}
