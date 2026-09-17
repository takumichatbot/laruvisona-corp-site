import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { FAQ_PAGES, faqPage } from '@/lib/laruhp-faq';
import { jsonForScript } from '@/lib/safe-markup';
import { laruhpOgImage } from '@/lib/laruhp-seo';
import PublicFooter from '@/components/laruhp/PublicFooter';

export async function generateStaticParams() {
  return FAQ_PAGES.map(page => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = faqPage(slug);
  if (!page) return {};
  const url = `https://laruhp.com/faq/${page.slug}`;
  const title = `${page.question} | LARU HP`;
  return {
    title,
    description: page.short,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title: page.question,
      description: page.short,
      url,
      type: 'article',
      siteName: 'LARU HP',
      images: [laruhpOgImage(page.question, 'よくある質問')],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.question,
      description: page.short,
      images: [laruhpOgImage(page.question, 'よくある質問').url],
    },
  };
}

export default async function FaqDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = faqPage(slug);
  if (!page) notFound();

  const url = `https://laruhp.com/faq/${page.slug}`;
  const others = FAQ_PAGES.filter(p => p.slug !== page.slug).slice(0, 4);

  const jsonLd = jsonForScript([
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'LARU HP', item: 'https://laruhp.com/' },
        { '@type': 'ListItem', position: 2, name: 'よくある質問', item: 'https://laruhp.com/faq' },
        { '@type': 'ListItem', position: 3, name: page.question, item: url },
      ],
    },
    {
      // 1ページ1問なので、この形が正しい（一覧側のFAQPageとは別物）。
      '@context': 'https://schema.org',
      '@type': 'QAPage',
      mainEntity: {
        '@type': 'Question',
        name: page.question,
        text: page.question,
        answerCount: 1,
        acceptedAnswer: {
          '@type': 'Answer',
          text: [page.short, ...page.sections.flatMap(s => s.body)].join('\n\n'),
          url,
        },
      },
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
        <article className="max-w-2xl mx-auto">
          <nav className="flex items-center gap-2 text-xs text-gray-400 mb-6">
            <Link href="https://laruhp.com/" className="hover:text-gray-600">LARU HP</Link>
            <span>/</span>
            <Link href="https://laruhp.com/faq" className="hover:text-gray-600">よくある質問</Link>
            <span>/</span>
            <span className="text-gray-600 truncate max-w-xs">{page.question}</span>
          </nav>

          <h1 className="text-2xl md:text-3xl font-black text-gray-900 leading-snug mb-5">{page.question}</h1>

          <p className="rounded-2xl border border-sky-200 bg-white p-5 text-[15px] font-bold leading-[1.95] text-gray-800">
            {page.short}
          </p>

          {page.sections.map(section => (
            <section key={section.heading}>
              <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-100">{section.heading}</h2>
              {section.body.map((paragraph, i) => (
                <p key={i} className="text-[15px] leading-[1.95] text-gray-700 mb-4">{paragraph}</p>
              ))}
            </section>
          ))}

          <div className="mt-12 rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">あわせて読む</h2>
            <ul className="space-y-2">
              {page.related.map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-sky-700 underline underline-offset-4 hover:text-sky-500">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-bold text-gray-900 mb-4">ほかの質問</h2>
            <ul className="space-y-2">
              {others.map(other => (
                <li key={other.slug}>
                  <Link
                    href={`https://laruhp.com/faq/${other.slug}`}
                    className="block rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 transition-colors hover:border-sky-300"
                  >
                    {other.question}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="https://laruhp.com/contact" className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-sky-500">
              ここに無いことを聞く
            </Link>
            <Link href="https://laruhp.com/faq" className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-700 transition-all hover:bg-white">
              質問の一覧へ
            </Link>
          </div>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
