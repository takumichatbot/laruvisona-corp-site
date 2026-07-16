import type { Metadata } from 'next';
import InquiryForm from '@/components/InquiryForm';

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
          <a href="/" className="inline-flex items-center">
            <img src="/images/logo_dark.png" alt="LaruVisona" className="h-9 w-auto" />
          </a>
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

          <div className="bg-[#0a0a0a]/80 backdrop-blur-xl p-6 sm:p-8 md:p-10 rounded-3xl border border-white/10 shadow-2xl">
            <InquiryForm dark />
          </div>

          <div className="mt-8 text-center">
            <a href="/" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">← トップに戻る</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center">
        <p className="text-xs font-mono text-slate-600">&copy; 2026 株式会社LaruVisona All Rights Reserved.</p>
      </footer>
    </main>
  );
}
