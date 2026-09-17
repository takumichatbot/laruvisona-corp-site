import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { FAQ_PAGES } from '@/lib/laruhp-faq';
import { jsonForScript } from '@/lib/safe-markup';
import { laruhpOgImage } from '@/lib/laruhp-seo';
import PublicFooter from '@/components/laruhp/PublicFooter';

const TITLE = 'よくある質問｜料金・契約・独自ドメイン - LARU HP';
const DESCRIPTION =
  'LARU HP の料金に含まれるもの、初月無料と最低利用期間の関係、解約の手続き、いま使っているドメインの持ち込み、解約後にページを持ち出せるか。申し込む前に確かめておきたいことを、1問ずつ答えています。';
const URL = 'https://laruhp.com/faq';

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
    images: [laruhpOgImage('よくある質問', '料金・契約・独自ドメイン')],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [laruhpOgImage('よくある質問', '料金・契約・独自ドメイン').url],
  },
};

export default function FaqIndexPage() {
  const jsonLd = jsonForScript([
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'LARU HP', item: 'https://laruhp.com/' },
        { '@type': 'ListItem', position: 2, name: 'よくある質問', item: URL },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_PAGES.map(page => ({
        '@type': 'Question',
        name: page.question,
        acceptedAnswer: { '@type': 'Answer', text: page.short },
        url: `https://laruhp.com/faq/${page.slug}`,
      })),
    },
  ]);

  return (
    <div className="min-h-screen bg-sky-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-sky-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="https://laruhp.com/" className="flex items-center gap-3">
            <Image src="/laruhp_logo.png" alt="LARU HP" height={32} width={160} className="h-8 w-auto" />
          </Link>
          <Link href="https://laruhp.com/plans" className="bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-sky-500 transition-all">
            料金を見る
          </Link>
        </div>
      </header>

      <main className="pt-28 pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          <nav className="flex items-center gap-2 text-xs text-gray-400 mb-6">
            <Link href="https://laruhp.com/" className="hover:text-gray-600">LARU HP</Link>
            <span>/</span>
            <span className="text-gray-600">よくある質問</span>
          </nav>

          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">よくある質問</h1>
          <p className="text-gray-500 text-sm leading-[1.95] mb-10">
            申し込む前に確かめておきたいことを、1問ずつ答えています。
            答えの根拠になる金額や条件は、実際の料金定義から出しています。
          </p>

          <ul className="space-y-3">
            {FAQ_PAGES.map(page => (
              <li key={page.slug}>
                <Link
                  href={`https://laruhp.com/faq/${page.slug}`}
                  className="block rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:border-sky-300 hover:shadow-sm"
                >
                  <h2 className="font-bold text-gray-900 leading-snug mb-2">{page.question}</h2>
                  <p className="text-sm text-gray-500 leading-[1.9]">{page.short}</p>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-2xl border border-sky-200 bg-sky-50 p-6">
            <p className="text-sm text-gray-600 leading-[1.95]">
              ここに無いことは、メールでお答えします。返信は通常2営業日以内です。
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="https://laruhp.com/contact" className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-sky-500">
                問い合わせる
              </Link>
              <Link href="https://laruhp.com/demo" className="rounded-xl border border-sky-300 px-5 py-2.5 text-sm font-bold text-sky-700 transition-all hover:bg-white">
                業種別の見本を見る（登録不要）
              </Link>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
