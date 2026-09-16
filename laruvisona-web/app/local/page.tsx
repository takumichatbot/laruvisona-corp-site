import Link from 'next/link';
import CompanyFooter from '@/components/company/CompanyFooter';
import type { Metadata } from 'next';
import { TROUBLES } from '@/lib/trouble-data';
import { organizationWithAreaLd, AREAS_SERVED } from '@/lib/organization-ld';

export const dynamic = 'force-static';

/**
 * 地域ページは1本だけにする。
 *
 * 全国の市区町村ぶんを量産すると、Googleのスパムポリシーが名指しで挙げている
 * 「特定の地域や都市をターゲットとする複数のページを用意し、ユーザーを1つの
 * ページに誘導する」形そのものになる。罰はそのページに留まらず、サイト全体の
 * 評価が下がる。困りごとページまで道連れになる。
 *
 * 地域ページが効くのは、そこにしか書けないことがあるときだけ。
 * ここに書けるのは、本店が板橋にあること、導入先が板橋の会社であること、
 * 会いに行ける距離であること。全部このページにしか書けない。
 */
export const metadata: Metadata = {
  title: '板橋・足立の中小企業のみなさまへ｜株式会社LaruVisona',
  description:
    '東京都板橋区の株式会社LaruVisona。ホームページ制作・改修、サイトやシステムの修理、業務の仕組みづくりを、代表が直接お受けします。板橋区・足立区・豊島区・北区・練馬区は、直接お伺いできます。',
  alternates: { canonical: 'https://laruvisona.jp/local' },
};

// 対応地域は lib/organization-ld.ts と共有する（画面と構造化データを食い違わせない）
const AREAS = AREAS_SERVED;

const orgLd = organizationWithAreaLd();

export default function LocalPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />

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
            <span className="text-blue-400 font-bold text-xs tracking-[0.3em]">板橋区・足立区とその周辺</span>
          </div>
          <h1 className="text-3xl md:text-[2.6rem] font-bold tracking-tight leading-[1.35] mb-6">
            近いので、会いに行けます。
          </h1>
          <p className="text-slate-300 text-sm md:text-base leading-[2] mb-14">
            株式会社LaruVisonaは、東京都板橋区の会社です。
            ホームページやシステムの相談は、電話とメールだけでも進められますが、
            一度お会いしたほうが早いことが多い。何に困っているかは、
            画面を一緒に見ながら聞くのが一番正確だからです。
            近隣の区であれば、お伺いします。
          </p>

          <section className="mb-14">
            <h2 className="text-2xl font-bold tracking-tight mb-7">この地域の会社と、実際に仕事をしています</h2>
            <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-7">
              <span className="inline-block text-blue-400 text-[10px] font-bold tracking-[0.2em] border border-blue-400/30 rounded-full px-3 py-1 mb-4">
                LARUbot
              </span>
              <h3 className="text-xl font-bold mb-2">日本エンドレス株式会社</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-4">
                東京都板橋区・創業50年以上／業務用マット・モップのレンタル、衛生用品の販売
              </p>
              <p className="text-slate-300 text-sm leading-[1.95]">
                営業案件の管理にお使いいただいています。案件ボードで商談がどの段階にあるかを追い、
                保留にした案件には理由と次回の確認予定日を残す。しばらく動いていない案件は通知で拾い上げる。
                運用しながらご要望をうかがい、機能を足しています。
              </p>
            </div>
            <p className="text-slate-400 text-sm leading-[1.95] mt-6">
              板橋区の会社が、板橋区の会社の仕事を受けている。
              何かあったときに顔が見える相手であることは、
              ホームページやシステムを任せるうえで、そこそこ大きな条件だと思っています。
            </p>
          </section>

          <section className="mb-14">
            <h2 className="text-2xl font-bold tracking-tight mb-4">お伺いできる範囲</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              下の地域であれば、ご相談の段階から直接お伺いします。費用はいただきません。
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              {AREAS.map(a => (
                <span key={a} className="bg-[#0f172a] border border-white/10 text-slate-200 text-sm px-4 py-2 rounded-lg">
                  {a}
                </span>
              ))}
            </div>
            <p className="text-slate-400 text-sm leading-[1.95]">
              これ以外の地域からのご依頼も、オンラインで進められるものはお受けしています。
              ただ「近くの会社に頼みたい」というご要望であれば、
              無理にこちらでお受けするより、お近くの会社を探されたほうがよい場合もあります。
              そのあたりは正直にお伝えします。
            </p>
          </section>

          <section className="mb-14">
            <h2 className="text-2xl font-bold tracking-tight mb-7">よくご相談いただくこと</h2>
            <div className="space-y-3">
              {TROUBLES.slice(0, 4).map(t => (
                <Link
                  key={t.slug}
                  href={`/trouble/${t.slug}`}
                  className="block bg-[#0f172a] border border-white/5 rounded-xl px-6 py-5 hover:border-blue-400/30 transition-colors"
                >
                  <span className="font-bold text-sm">{t.h1}</span>
                </Link>
              ))}
            </div>
            <Link href="/trouble" className="inline-block mt-5 text-blue-400 text-sm font-bold hover:text-blue-300 transition-colors">
              ほかの困りごとも見る →
            </Link>
          </section>

          <section className="mb-14 bg-gradient-to-br from-blue-900/30 to-[#0f172a] border border-blue-500/25 rounded-2xl p-7 md:p-9">
            <h2 className="text-xl md:text-2xl font-bold mb-4">まず、話だけ聞かせてください</h2>
            <p className="text-slate-300 text-sm leading-[1.95] mb-7">
              何を頼めばいいか決まっていない段階で構いません。
              相談とお見積もりまでは費用をいただきません。
              お話をうかがって、うちより他を当たったほうがよいと思えば、そう申し上げます。
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/services#contact" className="bg-white text-black px-7 py-3.5 rounded-xl font-bold text-sm text-center hover:bg-blue-50 transition-all">
                相談する（無料）
              </Link>
              <Link href="/services" className="border border-white/20 text-white px-7 py-3.5 rounded-xl font-bold text-sm text-center hover:bg-white/5 transition-all">
                サービスと料金を見る
              </Link>
            </div>
          </section>

          <section className="border-t border-white/5 pt-8">
            <h2 className="text-xs font-bold tracking-[0.3em] text-blue-400 mb-5">会社情報</h2>
            <dl className="text-sm space-y-3">
              <div className="flex gap-6">
                <dt className="text-slate-500 w-24 flex-shrink-0">会社名</dt>
                <dd className="text-slate-200">株式会社LaruVisona</dd>
              </div>
              <div className="flex gap-6">
                <dt className="text-slate-500 w-24 flex-shrink-0">所在地</dt>
                <dd className="text-slate-200">〒174-0072 東京都板橋区南常盤台1丁目11-6-101号室</dd>
              </div>
              <div className="flex gap-6">
                <dt className="text-slate-500 w-24 flex-shrink-0">代表</dt>
                <dd className="text-slate-200">代表取締役 齋藤 匠</dd>
              </div>
              <div className="flex gap-6">
                <dt className="text-slate-500 w-24 flex-shrink-0">事業内容</dt>
                <dd className="text-slate-200">Web制作・システム開発・AI導入支援</dd>
              </div>
            </dl>
          </section>
        </div>
      </main>

      <CompanyFooter />
    </div>
  );
}
