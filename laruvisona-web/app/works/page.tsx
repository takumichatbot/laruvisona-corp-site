import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { WORKS, ACCENT_STYLES } from '@/lib/works-data';

// ここは以前 `/#works` への転送だった。
// ところが会社トップに #works という目印は無く、転送先ではただトップが
// 開くだけだった。しかも /works/<slug> の3ページは、どこからも
// リンクされておらず sitemap にも入っていなかった。
// 書いてあるのに誰にも読まれない状態だったので、一覧を実体として置く。
export const metadata: Metadata = {
  title: '開発実績 | 株式会社LaruVisona',
  description:
    '株式会社LaruVisonaが企画・設計・開発・運用まで手がけたサービスの記録。LARUbot、LARU HP、FLASTAL の3件を、使った技術と実際の画面つきで掲載しています。',
  alternates: { canonical: 'https://laruvisona.jp/works' },
};

export default function WorksIndexPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white selection:bg-blue-500 selection:text-white">
      <header className="fixed w-full z-50 p-4 md:p-6">
        <div className="container mx-auto max-w-5xl flex justify-between items-center bg-[#030712]/60 backdrop-blur-xl rounded-2xl p-3 pl-5 border border-white/10 shadow-2xl">
          <Link href="/" className="flex items-center group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo_dark.png" alt="LaruVisona" className="h-9 w-auto transition-transform duration-300 group-hover:scale-105" />
          </Link>
          <Link href="/contact" className="bg-white text-black px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all">
            お問い合わせ
          </Link>
        </div>
      </header>

      <main className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-4xl">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 text-xs font-bold tracking-widest transition-colors mb-10">
            ← トップへ戻る
          </Link>

          <div className="mb-14">
            <h1 className="text-5xl md:text-7xl font-black font-en tracking-tight mb-5">WORKS</h1>
            <p className="text-slate-300 leading-relaxed text-base md:text-lg">
              企画から設計、実装、公開後の運用まで、一貫して手がけたものだけを載せています。
              <br className="hidden md:block" />
              数字の実績は、確かめられるものだけを書いています。
            </p>
          </div>

          <ul className="grid gap-6 list-none p-0 m-0">
            {WORKS.map(work => {
              const accent = ACCENT_STYLES[work.accent];
              const cover = work.shots[0];
              return (
                <li key={work.slug}>
                  <Link
                    href={`/works/${work.slug}`}
                    className={`group block overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition-all ${accent.border}`}
                  >
                    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-stretch">
                      <div className="p-7 md:p-9">
                        <span className={`inline-flex items-center border text-[10px] font-bold px-3 py-1 rounded-full tracking-widest ${accent.chip}`}>
                          {work.category}
                        </span>
                        <h2 className="text-3xl md:text-4xl font-black font-en tracking-tight mt-5 mb-2">{work.name}</h2>
                        <p className={`text-sm font-bold mb-4 ${accent.text}`}>{work.tagline}</p>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">{work.overview}</p>
                        <div className="flex flex-wrap gap-2">
                          {work.tech.slice(0, 4).map(t => (
                            <span key={t} className="bg-white/5 border border-white/10 text-slate-400 text-[11px] font-bold px-3 py-1.5 rounded-full font-en">
                              {t}
                            </span>
                          ))}
                        </div>
                        <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-slate-300 mt-7 group-hover:text-white transition-colors">
                          詳しく見る →
                        </span>
                      </div>
                      {cover && (
                        <div className="relative min-h-[180px] md:min-h-full bg-white/[0.02] border-t md:border-t-0 md:border-l border-white/5">
                          <Image
                            src={cover.src}
                            alt={cover.alt}
                            width={cover.w}
                            height={cover.h}
                            className="w-full h-full object-cover object-left-top"
                            sizes="(max-width: 768px) 100vw, 50vw"
                          />
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-16 rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-transparent p-7 md:p-9">
            <p className="text-white font-bold text-lg mb-2">つくるものが、まだ形になっていなくても。</p>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              新しくつくることも、いま動いているものを直すことも承っています。
              費用の目安は料金のページに書いてあります。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact" className="inline-flex items-center gap-2 bg-white text-black font-bold px-7 py-3.5 rounded-full text-sm hover:bg-blue-50 transition-all">
                相談してみる
              </Link>
              <Link href="/services" className="inline-flex items-center gap-2 bg-white/5 border border-white/15 hover:border-white/35 text-white font-bold px-7 py-3.5 rounded-full text-sm transition-all">
                料金を見る
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
