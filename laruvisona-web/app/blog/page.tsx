import type { Metadata } from 'next';
import Link from 'next/link';
import { listArticles } from '@/lib/laruseo-articles';
import { jsonForScript } from '@/lib/safe-markup';
import { BlogHeader, BlogFooter, BlogNotice, formatDate } from './chrome';

/**
 * ブログ一覧。**サーバー側で記事を取って、こちらのHTMLに文字を載せる。**
 *
 * これまでは向こうの script 札をブラウザで動かしていたので、
 * こちらが返すHTMLは 146文字（記事0文字）だった。検索側から見て中身が無い。
 *
 * 記事が0件のときは、無理に賑やかにしない。
 * 「まだありません」と書き、noindex を付ける。
 * 中身の無いページを検索側へ出すと、サイト全体の評価が下がる。
 */

const BASE = 'https://laruvisona.jp';
const TITLE = 'ブログ | 株式会社LaruVisona';
const DESC = 'AI・Web技術・受託開発に関するお役立ち記事をお届けします。株式会社LaruVisona のブログ。';

// 10分ごとに作り直す。記事の更新はそれほど速くない。
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const { articles } = await listArticles({ limit: 24 });
  const empty = articles.length === 0;
  return {
    title: TITLE,
    description: DESC,
    alternates: { canonical: `${BASE}/blog` },
    // 中身が無いあいだは、検索側に出さない。
    robots: empty ? { index: false, follow: true } : undefined,
    openGraph: {
      title: TITLE,
      description: DESC,
      url: `${BASE}/blog`,
      siteName: '株式会社LaruVisona',
      type: 'website',
      locale: 'ja_JP',
    },
  };
}

export default async function BlogPage() {
  const { articles, reason } = await listArticles({ limit: 24 });

  const itemList = articles.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: articles.map((a, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${BASE}/blog/${a.slug}`,
          name: a.title,
        })),
      }
    : null;

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <BlogHeader />

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

          {articles.length > 0 && (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
              {articles.map(a => (
                <li key={a.slug}>
                  <Link
                    href={`/blog/${a.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] hover:border-sky-400/40 hover:bg-white/[0.07] transition-colors"
                  >
                    {a.thumbnailUrl ? (
                      // 向こうのサーバーの絵。next/image を通すと、向こうが止まった日に
                      // こちらの画像最適化が待たされる。素の img で、遅延読み込みにする。
                      <img
                        src={a.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <div className="h-40 w-full bg-gradient-to-br from-sky-900/40 to-slate-900" />
                    )}
                    <div className="flex flex-1 flex-col gap-2 p-5">
                      {a.publishedAt && (
                        <time dateTime={a.publishedAt} className="text-[11px] font-mono text-slate-500">
                          {formatDate(a.publishedAt)}
                        </time>
                      )}
                      <h2 className="text-base font-bold leading-snug text-white group-hover:text-sky-300 transition-colors">
                        {a.title}
                      </h2>
                      {a.description && (
                        <p className="text-sm leading-relaxed text-slate-400 line-clamp-3">{a.description}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/*
            向こうが落ちている日だけ「時間をおいて」と書く。
            0件のときと、設置IDが入っていないときは、待っても記事は増えない。
            待てば出ると書くのは、嘘になる。
          */}
          {articles.length === 0 && (
            reason === 'unreachable' ? (
              <BlogNotice
                title="記事をいま読み込めませんでした"
                body={'しばらく経ってから、もう一度お試しください。'}
              />
            ) : (
              <BlogNotice
                title="記事はまだありません"
                body={'準備ができ次第、ここに掲載します。\nお急ぎのご相談は、お問い合わせからどうぞ。'}
              />
            )
          )}

          <div className="mt-12">
            <Link href="/" className="text-sky-400 hover:text-sky-300 text-sm transition-colors">← トップに戻る</Link>
          </div>
        </div>
      </main>

      {itemList && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonForScript(itemList) }}
        />
      )}

      <BlogFooter />
    </div>
  );
}
