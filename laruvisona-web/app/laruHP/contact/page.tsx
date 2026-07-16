import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'お問い合わせ | LARU HP',
  description: 'LARU HP（AIホームページビルダー）に関するご質問・ご相談はこちらのフォームからお気軽にお問い合わせください。',
  alternates: {
    canonical: 'https://laruvisona.jp/laruHP/contact',
  },
};

const FORM_URL = 'https://larubot.tokyo/f/d51f2628-df7a-4776-8e58-67c9a453957f';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-sky-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/laruHP" className="flex items-center gap-3">
            <Image src="/laruhp_logo.png" alt="LARU HP" height={32} width={160} className="h-8 w-auto" />
          </Link>
          <Link href="/laruHP/onboarding" className="bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-sky-500 transition-all">
            無料で始める →
          </Link>
        </div>
      </header>

      <main className="pt-28 pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-sky-100 text-sky-600 text-xs font-bold px-4 py-1.5 rounded-full mb-4 tracking-wider">CONTACT</span>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">お問い合わせ</h1>
            <p className="text-slate-600 text-sm md:text-base leading-relaxed">
              サービス内容・料金・導入のご相談など、お気軽にお問い合わせください。<br className="hidden md:block" />
              通常2営業日以内にご返信いたします。
            </p>
          </div>

          {/* LARUbot 埋め込みフォーム */}
          <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
            <iframe
              src={FORM_URL}
              title="LARU HP お問い合わせフォーム"
              className="w-full"
              style={{ height: '760px', border: '0' }}
              loading="lazy"
            />
          </div>

          {/* フォールバック連絡先 */}
          <div className="mt-8 text-center text-sm text-slate-600">
            <p>
              フォームがうまく表示されない場合は{' '}
              <a href={FORM_URL} target="_blank" rel="noopener noreferrer" className="text-sky-700 font-semibold underline underline-offset-2 hover:text-sky-800">
                こちらのページ
              </a>{' '}
              からご入力いただくか、{' '}
              <a href="mailto:info@laruvisona.jp" className="text-sky-700 font-semibold underline underline-offset-2 hover:text-sky-800">
                info@laruvisona.jp
              </a>{' '}
              までメールでご連絡ください。
            </p>
          </div>

          <div className="mt-10 text-center">
            <Link href="/laruHP" className="text-sky-700 hover:text-sky-800 text-sm transition-colors">← LARU HP トップに戻る</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
