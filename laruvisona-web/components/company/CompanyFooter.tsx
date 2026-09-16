import Link from 'next/link';

/**
 * 会社サイト（laruvisona.jp）の共通フッター。
 *
 * 案内サイト側（laruhp.com）には PublicFooter があって全ページから回遊できるのに、
 * 会社サイト側は同じ整理がされていなかった。困りごと12本から /works にも /contact にも
 * 行けず、読んで終わりになっていた。検索から来る人は、たいていトップではなく
 * 下層ページに着く。着いた場所から、次に見るものへ行けるようにしておく。
 */

const LINKS: { label: string; href: string }[] = [
  { label: 'トップ', href: '/' },
  { label: '受託開発と料金', href: '/services' },
  { label: '開発実績', href: '/works' },
  { label: 'よくある困りごと', href: '/trouble' },
  { label: '対応地域', href: '/local' },
  { label: '会社概要', href: '/#company' },
  { label: 'お問い合わせ', href: '/contact' },
  { label: 'プライバシーポリシー', href: '/privacy' },
  { label: '利用規約', href: '/terms' },
];

export default function CompanyFooter() {
  return (
    <footer className="border-t border-white/10 bg-black px-6 py-12 text-slate-400">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <nav aria-label="サイト内の案内" className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
          {LINKS.map(link => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="text-xs leading-6 text-slate-500">
          <p>株式会社LaruVisona（東京都板橋区南常盤台1丁目11-6-101号室）</p>
          <p>
            お問い合わせ:{' '}
            <a href="mailto:info@laruvisona.jp" className="underline underline-offset-4 hover:text-slate-300">
              info@laruvisona.jp
            </a>
          </p>
          <p className="mt-2">© {new Date().getFullYear()} 株式会社LaruVisona</p>
        </div>
      </div>
    </footer>
  );
}
