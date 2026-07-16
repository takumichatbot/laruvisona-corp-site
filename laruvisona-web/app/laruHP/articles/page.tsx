import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { ARTICLES } from './articles-data';

export const metadata: Metadata = {
  title: 'ホームページ作成・HP運用ガイド | LARU HP',
  description: '中小企業・個人事業主向けホームページ作成のノウハウ、SEO・集客・AI活用術を発信するブログです。',
};

const CATEGORY_COLORS: Record<string, string> = {
  'HP作成ガイド': 'bg-sky-100 text-sky-700',
  'HP活用術': 'bg-emerald-100 text-emerald-700',
  'LARU HP紹介': 'bg-indigo-100 text-indigo-700',
  'SEO・集客': 'bg-amber-100 text-amber-700',
  'AI活用術': 'bg-purple-100 text-purple-700',
};

function formatDate(s: string) {
  const d = new Date(s);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function ArticlesPage() {
  const featured = ARTICLES[0];
  const rest = ARTICLES.slice(1);

  return (
    <div className="min-h-screen bg-sky-50">
      <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-sky-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/laruHP" className="flex items-center gap-3">
            <Image src="/laruhp_logo.png" alt="LARU HP" height={32} width={160} className="h-8 w-auto" />
          </Link>
          <Link href="/laruHP/onboarding" className="bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-sky-500 transition-all">
            無料で始める →
          </Link>
        </div>
      </header>

      <main className="pt-28 pb-20 px-6">
        <div className="max-w-4xl mx-auto">

          <div className="text-center mb-12">
            <span className="inline-block bg-sky-100 text-sky-600 text-xs font-bold px-4 py-1.5 rounded-full mb-4 tracking-wider">BLOG</span>
            <h1 className="text-4xl font-black text-gray-900 mb-3">HP作成・集客ガイド</h1>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">中小企業・個人事業主向けのHP作成ノウハウ・SEO・AI活用術</p>
          </div>

          {/* Featured */}
          <Link href={`/laruHP/articles/${featured.slug}`} className="block mb-10 group">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-sky-200 hover:shadow-md transition-all">
              <div className="bg-gradient-to-br from-sky-500 to-indigo-600 h-44 flex items-center justify-center px-10">
                <h2 className="text-white text-xl font-black leading-snug text-center">{featured.title}</h2>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[featured.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {featured.category}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(featured.publishedAt)}</span>
                  <span className="text-xs text-gray-400">約{featured.readingTime}分</span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">{featured.description}</p>
                <span className="text-sky-600 text-sm font-bold group-hover:underline">続きを読む →</span>
              </div>
            </div>
          </Link>

          {/* Article grid */}
          <div className="grid sm:grid-cols-2 gap-5">
            {rest.map(article => (
              <Link key={article.slug} href={`/laruHP/articles/${article.slug}`} className="group block">
                <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-sky-200 hover:shadow-md transition-all h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[article.category] ?? 'bg-gray-100 text-gray-600'}`}>
                      {article.category}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(article.publishedAt)}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm leading-snug mb-2 flex-1">{article.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 mb-3">{article.description}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex gap-1.5 flex-wrap">
                      {article.tags.slice(0, 2).map(t => (
                        <span key={t} className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">約{article.readingTime}分</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-8 text-center text-xs text-gray-400">
        © 2026 株式会社LaruVisona. All Rights Reserved. ·{' '}
        <Link href="/laruHP" className="hover:text-gray-600">LARU HP トップ</Link>
      </footer>
    </div>
  );
}
