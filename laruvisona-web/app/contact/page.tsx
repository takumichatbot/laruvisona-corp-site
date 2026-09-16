import type { Metadata } from 'next';
import Link from 'next/link';
import LarubotContactForm from '@/components/LarubotContactForm';

export const metadata: Metadata = {
  title: 'お問い合わせ | LaruVisona',
  description: 'LaruVisona（AI・モダンWeb開発／LARU HP）へのご相談・ご質問はこちらのフォームからお気軽にお問い合わせください。',
  alternates: { canonical: 'https://laruvisona.jp/contact' },
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#030712] text-white flex flex-col">
      <header className="p-4 md:p-6">
        <div className="container mx-auto max-w-7xl">
          <Link href="/" className="inline-flex items-center">
            <img src="/images/logo_dark.png" alt="LaruVisona" className="h-9 w-auto" />
          </Link>
        </div>
      </header>

      <section className="flex-1 px-6 py-12 md:py-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-white/5 border border-white/10 text-blue-300 text-xs font-bold px-4 py-1.5 rounded-full mb-4 tracking-[0.2em]">CONTACT</span>
            <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tight">お問い合わせ</h1>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              サービス内容・料金・導入のご相談など、お気軽にお問い合わせください。<br className="hidden md:block" />
              通常2営業日以内にご返信いたします。
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
            <LarubotContactForm />
          </div>

          {/* フォームは外部サービスの読み込みに依存している。
              広告ブロッカーや障害で表示されないことがあるので、メールの宛先も必ず出す。 */}
          <p className="mt-6 text-center text-sm text-slate-400">
            フォームが表示されない場合は、
            <a href="mailto:info@laruvisona.jp" className="text-blue-300 underline underline-offset-4 mx-1">info@laruvisona.jp</a>
            へ直接お送りください。
          </p>

          <div className="mt-8 text-center">
            <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">← トップに戻る</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center">
        <p className="text-xs font-mono text-slate-600">&copy; 2026 株式会社LaruVisona All Rights Reserved.</p>
      </footer>
    </main>
  );
}
