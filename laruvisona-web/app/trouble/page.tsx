import Link from 'next/link';
import CompanyFooter from '@/components/company/CompanyFooter';
import type { Metadata } from 'next';
import { TROUBLES } from '@/lib/trouble-data';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'よくある困りごと｜株式会社LaruVisona',
  description:
    'サイトやシステムのよくある困りごとと、自分で確認できる手順。問い合わせフォームが届かない、社内で作ったAIツールが危なくないか、制作会社と連絡が取れない。',
  alternates: { canonical: 'https://laruvisona.jp/trouble' },
};

export default function TroubleIndexPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
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

      <main className="px-6 py-14 md:py-20">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-5">
            <div className="h-[1px] w-10 bg-blue-500" />
            <span className="text-blue-400 font-bold text-xs tracking-[0.3em]">よくある困りごと</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">
            まず、自分で確かめてみてください。
          </h1>
          <p className="text-slate-300 text-sm md:text-base leading-[2] mb-12">
            サイトやシステムの不調には、原因の当たりが付いているものがあります。
            ここに書いた手順で分かってしまえば、それで構いません。
            切り分けられなかったときだけ、声をかけてください。
          </p>

          <div className="mb-8 bg-[#0f172a] border border-white/5 rounded-2xl px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-slate-300 text-sm">板橋区・足立区とその周辺の方へは、直接お伺いできます。</p>
            <Link href="/local" className="flex-shrink-0 text-blue-400 text-sm font-bold hover:text-blue-300 transition-colors">
              お伺いできる範囲 →
            </Link>
          </div>

          <div className="space-y-4">
            {TROUBLES.map(t => (
              <Link
                key={t.slug}
                href={`/trouble/${t.slug}`}
                className="block bg-[#0f172a] border border-white/5 rounded-2xl p-7 hover:border-blue-400/30 transition-colors"
              >
                <h2 className="text-lg md:text-xl font-bold mb-3 leading-snug">{t.h1}</h2>
                <p className="text-slate-400 text-sm leading-relaxed line-clamp-3">{t.lead}</p>
                <span className="inline-block mt-4 text-blue-400 text-xs font-bold">確認する手順を見る →</span>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <CompanyFooter />
    </div>
  );
}
