import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { ARTICLES, getArticle } from '../articles-data';

export async function generateStaticParams() {
  return ARTICLES.map(a => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  return {
    title: `${article.title} | LARU HP`,
    description: article.description,
    openGraph: { title: article.title, description: article.description },
  };
}

function formatDate(s: string) {
  const d = new Date(s);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function renderMarkdown(md: string) {
  const lines = md.trim().split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-100">{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-bold text-gray-800 mt-6 mb-2">{line.slice(4)}</h3>);
    } else if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-1.5 my-3 text-sm text-gray-700 leading-relaxed">
          {items.map((item, j) => <li key={j} dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />)}
        </ul>
      );
      continue;
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1.5 my-3 text-sm text-gray-700 leading-relaxed">
          {items.map((item, j) => <li key={j} dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />)}
        </ol>
      );
      continue;
    } else if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^[\|\s\-:]+$/.test(lines[i])) {
          rows.push(lines[i].split('|').filter(Boolean).map(c => c.trim()));
        }
        i++;
      }
      elements.push(
        <div key={`tbl-${i}`} className="overflow-x-auto my-5">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-sky-50">
                {rows[0]?.map((cell, j) => <th key={j} className="border border-gray-200 px-4 py-2 text-left text-xs font-bold text-gray-700">{cell}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, ri) => (
                <tr key={ri} className={ri % 2 === 1 ? 'bg-gray-50' : ''}>
                  {row.map((cell, ci) => <td key={ci} className="border border-gray-200 px-4 py-2 text-gray-700" dangerouslySetInnerHTML={{ __html: cell.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    } else if (line.trim() === '') {
      // skip blank lines
    } else {
      const html = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-[13px] font-mono">$1</code>');
      elements.push(<p key={i} className="text-sm text-gray-700 leading-relaxed my-2" dangerouslySetInnerHTML={{ __html: html }} />);
    }
    i++;
  }
  return elements;
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const related = ARTICLES.filter(a => a.slug !== slug && a.tags.some(t => article.tags.includes(t))).slice(0, 3);

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
        <div className="max-w-2xl mx-auto">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-gray-400 mb-6">
            <Link href="/laruHP" className="hover:text-gray-600">LARU HP</Link>
            <span>/</span>
            <Link href="/laruHP/articles" className="hover:text-gray-600">ブログ</Link>
            <span>/</span>
            <span className="text-gray-600 truncate max-w-xs">{article.title}</span>
          </nav>

          {/* Hero */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700">{article.category}</span>
              <span className="text-xs text-gray-400">{formatDate(article.publishedAt)}</span>
              <span className="text-xs text-gray-400">約{article.readingTime}分で読める</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight mb-4">{article.title}</h1>
            <p className="text-gray-600 text-sm leading-relaxed bg-white border border-gray-200 rounded-xl p-4">{article.description}</p>
          </div>

          {/* Article body */}
          <div className="bg-white rounded-2xl border border-gray-200 p-7 mb-10 shadow-sm">
            {renderMarkdown(article.body)}
          </div>

          {/* Tags */}
          <div className="flex gap-2 flex-wrap mb-10">
            {article.tags.map(t => (
              <span key={t} className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">#{t}</span>
            ))}
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-br from-sky-600 to-indigo-600 rounded-2xl p-8 text-center text-white mb-10">
            <div className="text-lg font-black mb-2">LARU HPで無料お試し</div>
            <p className="text-sky-100 text-xs mb-6">初月完全無料 · 最短5分で公開 · AIコンテンツ自動生成</p>
            <Link
              href="/laruHP/onboarding"
              className="inline-block bg-white text-sky-600 font-black text-sm px-8 py-3 rounded-xl hover:bg-sky-50 transition-colors shadow"
            >
              無料でサイトを作る →
            </Link>
          </div>

          {/* Related articles */}
          {related.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-700 mb-4">関連記事</h2>
              <div className="space-y-3">
                {related.map(a => (
                  <Link key={a.slug} href={`/laruHP/articles/${a.slug}`} className="block group">
                    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-sky-200 transition-all flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-sky-600 mb-0.5">{a.category}</div>
                        <div className="text-sm font-bold text-gray-900 truncate group-hover:text-sky-700 transition-colors">{a.title}</div>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400 flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link href="/laruHP/articles" className="text-sm text-sky-600 hover:underline">← 記事一覧に戻る</Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-8 text-center text-xs text-gray-400">
        © 2026 株式会社LARUVisona. All Rights Reserved. ·{' '}
        <Link href="/laruHP" className="hover:text-gray-600">LARU HP トップ</Link>
      </footer>
    </div>
  );
}
