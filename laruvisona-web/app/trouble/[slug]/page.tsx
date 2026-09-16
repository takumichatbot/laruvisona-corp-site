import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TROUBLES, getTrouble } from '@/lib/trouble-data';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return TROUBLES.map(t => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = getTrouble(slug);
  if (!t) return {};
  const url = `https://laruvisona.jp/trouble/${t.slug}`;
  return {
    title: t.title,
    description: t.description,
    alternates: { canonical: url },
    openGraph: { title: t.title, description: t.description, url, type: 'article' },
  };
}

function Num({ n }: { n: number }) {
  return (
    <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-400/25 text-blue-300 text-xs font-bold grid place-items-center font-en">
      {n}
    </span>
  );
}

export default async function TroublePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getTrouble(slug);
  if (!t) notFound();
  // 全部並べると選べなくなる。隣の3本だけ見せる。
  const others = TROUBLES.filter(o => o.slug !== t.slug).slice(0, 3);

  // 検索結果にそのまま出る形。読む前に答えが見えるほうが、読む人の得になる。
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.faq.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <header className="sticky top-0 z-50 bg-[#030712]/85 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo_dark.png" alt="株式会社LaruVisona" className="h-7 w-auto object-contain" />
          </Link>
          <Link href="/services#contact" className="bg-white text-black px-4 py-2 rounded-xl font-bold text-xs sm:text-sm hover:bg-blue-50 transition-all">
            無料で相談する
          </Link>
        </div>
      </header>

      <main className="px-6 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <Link href="/trouble" className="inline-block text-slate-500 hover:text-slate-300 text-xs font-bold tracking-widest mb-8 transition-colors">
            ← よくある困りごと
          </Link>

          <h1 className="text-3xl md:text-[2.6rem] font-bold tracking-tight leading-[1.35] mb-6">{t.h1}</h1>
          <p className="text-slate-300 leading-[2] text-sm md:text-base mb-12">{t.lead}</p>

          <section className="mb-14 bg-[#0f172a] border border-white/5 rounded-2xl p-7">
            <h2 className="text-base font-bold mb-5">こんな状態ではありませんか</h2>
            <ul className="space-y-3">
              {t.symptoms.map(s => (
                <li key={s} className="text-slate-300 text-sm leading-relaxed flex gap-3">
                  <span className="text-blue-400 flex-shrink-0">・</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-14">
            <h2 className="text-2xl font-bold tracking-tight mb-3">自分で確認できること</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              上から順に見てください。ここで分かってしまえば、それで構いません。
            </p>
            <ol className="space-y-6">
              {t.checks.map((c, i) => (
                <li key={c.title} className="flex gap-4">
                  <Num n={i + 1} />
                  <div className="min-w-0">
                    <h3 className="font-bold mb-2 leading-snug">{c.title}</h3>
                    <p className="text-slate-300 text-sm leading-[1.95]">{c.how}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mb-14">
            <h2 className="text-2xl font-bold tracking-tight mb-8">よくある原因</h2>
            <div className="space-y-5">
              {t.causes.map(c => (
                <div key={c.title} className="border-l-2 border-blue-500/30 pl-5">
                  <h3 className="font-bold mb-2 leading-snug">{c.title}</h3>
                  <p className="text-slate-300 text-sm leading-[1.95]">{c.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-14 bg-gradient-to-br from-blue-900/30 to-[#0f172a] border border-blue-500/25 rounded-2xl p-7 md:p-9">
            <span className="text-blue-400 font-bold text-[10px] tracking-[0.3em]">それでも直らないとき</span>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mt-4 mb-4">
              <h2 className="text-xl md:text-2xl font-bold">{t.offer.title}</h2>
              <span className="text-2xl font-bold text-blue-300 whitespace-nowrap">{t.offer.price}</span>
            </div>
            <p className="text-slate-300 text-sm leading-[1.95] mb-7">{t.offer.body}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/services#contact" className="bg-white text-black px-7 py-3.5 rounded-xl font-bold text-sm text-center hover:bg-blue-50 transition-all">
                相談する（無料）
              </Link>
              <Link href="/services" className="border border-white/20 text-white px-7 py-3.5 rounded-xl font-bold text-sm text-center hover:bg-white/5 transition-all">
                料金を見る
              </Link>
            </div>
          </section>

          <section className="mb-14">
            <h2 className="text-2xl font-bold tracking-tight mb-8">よくある質問</h2>
            <div className="space-y-4">
              {t.faq.map(f => (
                <details key={f.q} className="bg-[#0f172a] border border-white/5 rounded-xl p-5 group">
                  <summary className="font-bold text-sm cursor-pointer list-none flex justify-between gap-4">
                    {f.q}
                    <span className="text-blue-400 flex-shrink-0 group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="text-slate-300 text-sm leading-[1.95] mt-4">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {others.length > 0 && (
            <section className="border-t border-white/5 pt-10">
              <h2 className="text-xs font-bold tracking-[0.3em] text-blue-400 mb-6">ほかの困りごと</h2>
              <div className="space-y-3">
                {others.map(o => (
                  <Link key={o.slug} href={`/trouble/${o.slug}`} className="block bg-[#0f172a] border border-white/5 rounded-xl px-6 py-5 hover:border-blue-400/30 transition-colors">
                    <span className="font-bold text-sm">{o.h1}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <p className="text-slate-600 text-xs mt-12">最終更新 {t.updated}｜株式会社LaruVisona</p>
        </div>
      </main>
    </div>
  );
}
