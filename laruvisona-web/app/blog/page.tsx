import type { Metadata } from 'next';
import Link from 'next/link';
import LaruSeoBlog from '@/components/LaruSeoBlog';

export const metadata: Metadata = {
  title: 'ブログ | 株式会社LaruVisona',
  description: 'AI・Web技術・受託開発に関するお役立ち記事をお届けします。株式会社LaruVisona のブログ。',
  alternates: { canonical: 'https://laruvisona.jp/blog' },
  openGraph: {
    title: 'ブログ | 株式会社LaruVisona',
    description: 'AI・Web技術・受託開発に関するお役立ち記事をお届けします。',
    url: 'https://laruvisona.jp/blog',
    siteName: '株式会社LaruVisona',
    type: 'website',
    locale: 'ja_JP',
  },
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#030712]/85 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/images/logo_dark.png" alt="株式会社LaruVisona" className="h-7 w-auto object-contain" />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-5 text-sm">
            <Link href="/services" className="hidden sm:inline text-slate-300 hover:text-white transition-colors">受託開発</Link>
            <Link href="/#works" className="hidden sm:inline text-slate-300 hover:text-white transition-colors">実績</Link>
            <Link href="/#contact" className="bg-white text-black px-4 py-2 rounded-xl font-bold text-xs sm:text-sm hover:bg-blue-50 transition-all">
              お問い合わせ
            </Link>
          </nav>
        </div>
      </header>

      <main className="px-6 pt-16 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-5">
              <div className="h-[1px] w-10 bg-blue-500" />
              <span className="text-blue-400 font-bold text-xs tracking-[0.3em]">BLOG</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">ブログ</h1>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-2xl">
              AI・Web技術・受託開発に関するお役立ち記事をお届けします。
            </p>
          </div>

          {/* LARU SEO 記事（Script版embed）。カードは白基調のため、明るいパネル内に表示する。 */}
          <div className="bg-white/95 rounded-2xl md:rounded-3xl border border-white/10 p-4 sm:p-6 md:p-8">
            <LaruSeoBlog />
          </div>

          <div className="mt-12">
            <Link href="/" className="text-sky-400 hover:text-sky-300 text-sm transition-colors">← トップに戻る</Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black text-slate-500 py-12 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 flex flex-col items-center gap-6 text-center">
          <img src="/images/logo_dark.png" alt="株式会社LaruVisona" className="h-7 w-auto object-contain opacity-80" />
          <div className="flex flex-wrap justify-center gap-6 text-xs font-bold tracking-widest uppercase">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/services" className="hover:text-white transition-colors">Services</Link>
            <Link href="/#contact" className="hover:text-white transition-colors">Contact</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
          <p className="text-xs font-mono text-slate-600">&copy; 2026 株式会社LaruVisona All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
