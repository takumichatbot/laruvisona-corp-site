import type { Metadata } from 'next';
import { laruhpOgImage } from '@/lib/laruhp-seo';
import { jsonForScript } from '@/lib/safe-markup';
import DemoClient from './demo-client';

/**
 * 登録しないまま、業種ごとの構成を見られるページ。
 *
 * 2026-09-17 の点検で分かったこと。
 * この見本は前から作ってあったのに、
 *   ・laruhp.com からは開けない（公開パスに入っていなかった）
 *   ・どのページからもリンクされていない
 *   ・/laruHP 配下の既定で noindex になっていて、検索にも出ない
 * という状態で、誰の目にも触れていなかった。
 *
 * 「申し込む前に中身を見たい」は、いちばん多い止まり方である。
 * 見本があるのに見せていないのは、置いていないのと同じなので、
 * 公開パスに入れ、index を許可し、sitemap と各ページから入れるようにした。
 */

const TITLE = '業種別のホームページ見本｜登録なしで構成を見る - LARU HP';
const DESCRIPTION =
  '飲食店・美容室・整体・工務店・士業など15業種について、LARU HP で作るとどんな構成になるかを、登録なしで見られます。見出し・サービスと料金・問い合わせの並びを、実際の画面の形で確認できます。';
const URL = 'https://laruhp.com/demo';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  // 親レイアウトは /laruHP 配下をまとめて noindex にしている。
  // ここは公開ページなので、明示的に戻す。
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    type: 'website',
    images: [laruhpOgImage('業種別のホームページ見本', '登録なしで、15業種の構成を見る')],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [laruhpOgImage('業種別のホームページ見本', '登録なしで、15業種の構成を見る')],
  },
};

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'LARU HP', item: 'https://laruhp.com/' },
    { '@type': 'ListItem', position: 2, name: '業種別の見本', item: URL },
  ],
};

export default function DemoPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(breadcrumb) }} />
      <DemoClient />
    </>
  );
}
