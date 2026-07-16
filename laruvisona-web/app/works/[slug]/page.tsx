import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { WORKS, getWork, ACCENT_STYLES } from '@/lib/works-data';

export async function generateStaticParams() {
  return WORKS.map(w => ({ slug: w.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const work = getWork(slug);
  if (!work) return {};
  return {
    title: `${work.name} | 開発実績 | LaruVisona`,
    description: work.overview,
  };
}

export default async function WorkDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = getWork(slug);
  if (!work) notFound();
  const accent = ACCENT_STYLES[work.accent];

  return (
    <div className="min-h-screen bg-[#030712] text-white selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <header className="fixed w-full z-50 p-4 md:p-6">
        <div className="container mx-auto max-w-5xl flex justify-between items-center bg-[#030712]/60 backdrop-blur-xl rounded-2xl p-3 pl-5 border border-white/10 shadow-2xl">
          <Link href="/" className="flex items-center group">
            <img src="/images/logo_dark.png" alt="LaruVisona" className="h-9 w-auto transition-transform duration-300 group-hover:scale-105" />
          </Link>
          <Link href="/#contact" className="bg-white text-black px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all">
            お問い合わせ
          </Link>
        </div>
      </header>

      <main className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-4xl">
          {/* Breadcrumb */}
          <Link href="/#works" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 text-xs font-bold tracking-widest transition-colors mb-10">
            ← WORKS 一覧へ戻る
          </Link>

          {/* Hero */}
          <div className="mb-14">
            <div className={`inline-flex items-center border text-[10px] font-bold px-3 py-1 rounded-full tracking-widest mb-6 ${accent.chip}`}>
              {work.category}
            </div>
            {work.placeholder && (
              <span className="ml-2 inline-flex items-center bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full tracking-widest mb-6">
                詳細準備中
              </span>
            )}
            <h1 className="text-5xl md:text-7xl font-black font-en tracking-tight mb-4">{work.name}</h1>
            <p className={`text-lg md:text-xl font-bold ${accent.text}`}>{work.tagline}</p>
          </div>

          {/* Overview */}
          <section className="mb-12">
            <h2 className="flex items-center gap-4 text-xs font-bold tracking-[0.3em] text-blue-500 mb-5">
              <span className="h-[1px] w-10 bg-blue-500" />プロダクト概要
            </h2>
            <p className="text-slate-300 leading-relaxed text-base md:text-lg">{work.overview}</p>
          </section>

          {/* Tech stack */}
          <section className="mb-12">
            <h2 className="flex items-center gap-4 text-xs font-bold tracking-[0.3em] text-blue-500 mb-5">
              <span className="h-[1px] w-10 bg-blue-500" />技術スタック
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {work.tech.map(t => (
                <span key={t} className="bg-white/5 border border-white/10 text-slate-300 text-xs font-bold px-4 py-2 rounded-full font-en">
                  {t}
                </span>
              ))}
            </div>
          </section>

          {/* Highlights */}
          <section className="mb-12">
            <h2 className="flex items-center gap-4 text-xs font-bold tracking-[0.3em] text-blue-500 mb-5">
              <span className="h-[1px] w-10 bg-blue-500" />ハイライト
            </h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {work.highlights.map(h => (
                <li key={h} className="flex items-start gap-3 bg-white/5 border border-white/5 rounded-xl px-5 py-4 text-sm text-slate-300">
                  <span className={`font-bold ${accent.text}`}>✓</span>{h}
                </li>
              ))}
            </ul>
          </section>

          {/* Development structure */}
          <section className="mb-12">
            <h2 className="flex items-center gap-4 text-xs font-bold tracking-[0.3em] text-blue-500 mb-5">
              <span className="h-[1px] w-10 bg-blue-500" />開発体制
            </h2>
            <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-2xl p-6 md:p-8">
              <p className="text-white font-bold text-lg mb-2">企画・設計・開発・運用まで、1名でフルスタック開発</p>
              <p className="text-slate-400 text-sm leading-relaxed">
                要件定義からUI/UX設計、フロントエンド・バックエンド実装、インフラ構築、リリース後の運用改善までを一気通貫で担当。
                コミュニケーションコストを最小化し、スピーディな意思決定と開発を実現しています。
              </p>
            </div>
          </section>

          {/* Screenshots (placeholder) */}
          <section className="mb-14">
            <h2 className="flex items-center gap-4 text-xs font-bold tracking-[0.3em] text-blue-500 mb-5">
              <span className="h-[1px] w-10 bg-blue-500" />スクリーンショット
            </h2>
            <div className={`grid gap-4 ${work.screenshots.portrait ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {Array.from({ length: work.screenshots.count }, (_, i) => (
                <div
                  key={i}
                  className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/15 rounded-2xl bg-white/[0.03] text-center p-4 ${work.screenshots.portrait ? 'aspect-[9/19.5]' : 'aspect-[16/10]'}`}
                >
                  <span className="text-2xl opacity-40">🖼</span>
                  <span className="text-slate-500 text-[11px] leading-relaxed">
                    スクリーンショット {i + 1}<br />
                    推奨 {work.screenshots.recommended}<br />
                    <span className="font-mono text-[10px] text-slate-600">/images/works/{work.slug}-{i + 1}.png</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* External link */}
          {work.link && (
            <div className="mb-16">
              {work.link.external ? (
                <a href={work.link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white/5 border border-white/15 hover:border-white/35 text-white font-bold px-7 py-3.5 rounded-full text-sm transition-all">
                  {work.link.label} <i className="fas fa-external-link-alt text-xs" />
                </a>
              ) : (
                <Link href={work.link.url} className="inline-flex items-center gap-2 bg-white/5 border border-white/15 hover:border-white/35 text-white font-bold px-7 py-3.5 rounded-full text-sm transition-all">
                  {work.link.label} →
                </Link>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-transparent border border-blue-500/20 rounded-[2rem] p-10 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">同様のシステム開発のご相談はこちら</h2>
            <p className="text-slate-400 text-sm mb-8">AI SaaS・Webアプリ・モバイルアプリの受託開発を、企画から運用まで一気通貫でお手伝いします。</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/#contact" className="bg-white text-black font-bold py-4 px-10 rounded-full hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.15)] inline-flex items-center justify-center gap-2">
                無料で相談する →
              </Link>
              <Link href="/#estimator" className="border border-white/20 text-slate-300 hover:text-white hover:border-white/40 font-bold py-4 px-10 rounded-full transition-all inline-flex items-center justify-center">
                概算見積もりを試す
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-black text-slate-500 py-10 border-t border-white/5 text-center">
        <p className="text-xs font-mono text-slate-600">&copy; 2026 株式会社LaruVisona All Rights Reserved.</p>
      </footer>
    </div>
  );
}
