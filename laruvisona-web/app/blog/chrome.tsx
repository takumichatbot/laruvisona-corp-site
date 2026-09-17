import Link from 'next/link';

/**
 * ブログの上下。一覧と記事ページで同じものを使う。
 * 会社サイトの他のページと同じ見た目に揃えてある。
 */

export function BlogHeader() {
  return (
    <header className="sticky top-0 z-50 bg-[#030712]/85 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img src="/images/logo_dark.png" alt="株式会社LaruVisona" className="h-7 w-auto object-contain" />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-5 text-sm">
          <Link href="/services" className="hidden sm:inline text-slate-300 hover:text-white transition-colors">受託開発</Link>
          <Link href="/works" className="hidden sm:inline text-slate-300 hover:text-white transition-colors">実績</Link>
          <Link href="/contact" className="bg-white text-black px-4 py-2 rounded-xl font-bold text-xs sm:text-sm hover:bg-blue-50 transition-all">
            お問い合わせ
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function BlogFooter() {
  return (
    <footer className="bg-black text-slate-500 py-12 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6 flex flex-col items-center gap-6 text-center">
        <img src="/images/logo_dark.png" alt="株式会社LaruVisona" className="h-7 w-auto object-contain opacity-80" />
        <div className="flex flex-wrap justify-center gap-6 text-xs font-bold tracking-widest uppercase">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/services" className="hover:text-white transition-colors">Services</Link>
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
        </div>
        <p className="text-xs font-mono text-slate-600">&copy; 2026 株式会社LaruVisona All Rights Reserved.</p>
      </div>
    </footer>
  );
}

/** 記事が読めなかった / まだ無いときに出す面。白紙にはしない。 */
export function BlogNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
      <p className="text-white font-bold text-base mb-2">{title}</p>
      <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-line">{body}</p>
      <Link
        href="/services"
        className="inline-block mt-6 bg-white text-black px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all"
      >
        受託開発のご案内を見る
      </Link>
    </div>
  );
}

/** 記事の日付。日本語で、時刻は出さない。 */
export function formatDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
