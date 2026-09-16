import Link from 'next/link';
import { LARUHP_INDUSTRIES } from '@/lib/laruhp-public';

/**
 * LARU HP の公開ページ共通のフッター。
 *
 * ここを作った理由。
 * 28ページのうち、まともなフッターがあるのはトップ1ページだけだった。
 *   /plans /contact /domains /tokusho /terms /privacy /articles …
 *     自分自身へのリンクしか無い（フッターが無い）
 *   15の業種ページ
 *     料金・ガイド・問い合わせ・プライバシーの4つだけ。
 *     利用規約も、特定商取引法に基づく表記も、運営会社も無い
 *
 * これが3つの損を同時に出していた。
 *   1. 回遊できない。料金を見た人が、そこから規約にも特商法にも行けない。
 *      いちばん買う直前のページに、出口が無かった。
 *   2. 運営者が見えない。カードを入れるか決める材料が、28ページ中1ページにしかない。
 *   3. クロールが行き渡らない。内部リンクの無いページには評価も伝わらない。
 *      会社サイトの /works が「参照元ページ: 検出されませんでした」だったのと同じ形である。
 */

const INDUSTRY_LABEL: Record<string, string> = {
  restaurant: '飲食店', beauty: '美容室', clinic: '整体・治療院', legal: '士業',
  construction: '工務店', realestate: '不動産', retail: '小売店', fitness: 'フィットネス',
  hotel: 'ホテル・旅館', education: '教室・スクール', wedding: 'ウェディング', pet: 'ペットサロン',
  dental: '歯科', photo: 'フォトスタジオ', accounting: '税理士',
};

const COLUMNS = [
  {
    title: 'サービス',
    links: [
      { href: 'https://laruhp.com/', label: 'LARU HP について' },
      { href: 'https://laruhp.com/plans', label: '料金プラン' },
      { href: 'https://laruhp.com/domains', label: '独自ドメイン' },
      { href: 'https://laruhp.com/articles', label: 'ホームページ作成ガイド' },
      { href: 'https://laruhp.com/contact', label: 'お問い合わせ' },
    ],
  },
  {
    title: '規約・表記',
    links: [
      { href: 'https://laruhp.com/terms', label: '利用規約' },
      { href: 'https://laruhp.com/privacy', label: 'プライバシーポリシー' },
      // 申し込みの手前にあるべき表記。以前は業種ページから辿れなかった。
      { href: 'https://laruhp.com/tokusho', label: '特定商取引法に基づく表記' },
    ],
  },
  {
    title: '運営',
    links: [
      { href: 'https://laruvisona.jp/', label: '株式会社LaruVisona' },
      { href: 'https://laruvisona.jp/works', label: '開発実績' },
      { href: 'https://laruvisona.jp/services', label: '受託開発' },
    ],
  },
];

export default function PublicFooter({ dark = false }: { dark?: boolean }) {
  const shell = dark
    ? 'bg-slate-950 text-slate-400 border-t border-white/10'
    : 'bg-white text-slate-500 border-t border-slate-200';
  const head = dark ? 'text-slate-200' : 'text-slate-900';
  const link = dark ? 'hover:text-white' : 'hover:text-slate-900';

  return (
    <footer className={`px-5 py-14 text-sm ${shell}`}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="https://laruhp.com/" className={`text-lg font-black tracking-[-0.05em] ${head}`}>
              LARU <span className="text-sky-600">HP</span>
            </Link>
            <p className="mt-3 text-xs leading-6">その仕事に、ふさわしいホームページを。</p>
          </div>
          {COLUMNS.map(col => (
            <nav key={col.title} aria-label={col.title}>
              <p className={`text-xs font-bold ${head}`}>{col.title}</p>
              <ul className="mt-4 space-y-2.5 list-none p-0">
                {col.links.map(l => (
                  <li key={l.href}>
                    <Link href={l.href} className={`text-xs leading-6 ${link}`}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <nav aria-label="業種から探す" className={`mt-12 border-t pt-8 ${dark ? 'border-white/10' : 'border-slate-200'}`}>
          <p className={`text-xs font-bold ${head}`}>業種から探す</p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2.5 list-none p-0">
            {LARUHP_INDUSTRIES.map(id => (
              <li key={id}>
                <Link href={`https://laruhp.com/${id}`} className={`text-xs ${link}`}>
                  {INDUSTRY_LABEL[id] ?? id}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="mt-10 text-xs">© {new Date().getFullYear()} 株式会社LaruVisona</p>
      </div>
    </footer>
  );
}
