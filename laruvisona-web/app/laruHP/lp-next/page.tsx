import type { Metadata } from 'next';
import Link from 'next/link';
import { PLANS, TERMS, INDUSTRIES, PRIMARY_CTA, SECONDARY_CTA } from './facts';
import DemoVideo from './DemoVideo';
import Faq from './Faq';

// 新LPの比較用プレビュー。既存の /laruHP には一切触れない。
//
// - robots: 検索対象から外す。プレビューが本物のLPと競合しないように。
// - alternates.canonical: 親レイアウト（app/laruHP/layout.tsx）が
//   canonical を https://laruvisona.jp/laruHP に固定しているため、
//   何もしないとこのプレビューが本番LPを正規URLだと主張してしまう。
//   自分自身を指すように必ず上書きする。
export const metadata: Metadata = {
  title: '【プレビュー】LARU HP',
  description: '新しいランディングページの比較用プレビューです。',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: 'https://laruvisona.jp/laruHP/lp-next' },
  openGraph: { url: 'https://laruvisona.jp/laruHP/lp-next' },
};

// このページはログイン状態も顧客データも読まない純粋な表示だけのページなので、
// 静的に配ってよい。共有キャッシュに個人のデータが入る余地がない。
// （親レイアウトが force-dynamic を指定しているため、実際に静的になるかは
//   本番のレスポンスヘッダで確認する。結果は報告に載せる。）
export const dynamic = 'force-static';

const yen = (n: number) => n.toLocaleString('ja-JP');

/** 主CTA。目的は1つに統一し、長いページなので必要な位置に何度も置く */
function PrimaryCta({ id, note = true }: { id: string; note?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <Link
        id={id}
        href={PRIMARY_CTA.href}
        className="inline-flex items-center justify-center gap-2 w-full max-w-sm min-h-[56px] px-8 rounded-2xl bg-sky-600 text-white text-[17px] font-bold shadow-[0_6px_20px_rgba(2,132,199,0.25)] active:scale-[0.99] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
      >
        {PRIMARY_CTA.label}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
      {note && <p className="text-[13px] text-slate-500">{PRIMARY_CTA.sub}</p>}
    </div>
  );
}

function SectionHead({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="mb-8 md:mb-12">
      <p className="text-sky-700 text-xs font-bold tracking-[0.18em]">{eyebrow}</p>
      <h2 className="mt-2 text-[26px] md:text-4xl font-bold text-slate-900 text-balance-jp leading-[1.35]">
        {title}
      </h2>
      {lead && <p className="mt-3 text-[15px] md:text-base text-slate-600 leading-[1.9]">{lead}</p>}
    </div>
  );
}

/** スマホの枠に、AIが実際に生成した業種別の画像を入れて見せる */
function PhoneMock({ industry, label, priority = false }: { industry: string; label: string; priority?: boolean }) {
  return (
    <figure className="shrink-0 w-[172px]">
      <div className="rounded-[22px] border-[6px] border-slate-800 bg-slate-800 shadow-xl overflow-hidden">
        <div className="relative bg-white" style={{ aspectRatio: '9 / 16' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/library-image?industry=${industry}&kind=hero&n=0`}
            alt={`${label}のホームページの作例`}
            width={172}
            height={306}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className="absolute inset-0 w-full h-[58%] object-cover"
          />
          <div className="absolute left-0 right-0 top-[58%] p-2.5 space-y-1.5">
            <div className="h-2.5 w-2/3 rounded bg-slate-800/85" />
            <div className="h-1.5 w-full rounded bg-slate-200" />
            <div className="h-1.5 w-5/6 rounded bg-slate-200" />
            <div className="mt-2 h-5 w-24 rounded-md bg-sky-600" />
            <div className="grid grid-cols-2 gap-1.5 pt-1.5">
              <div className="h-8 rounded bg-slate-100" />
              <div className="h-8 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-[13px] text-slate-600">{label}</figcaption>
    </figure>
  );
}

export default function LpNextPage() {
  const hp = PLANS[0];

  return (
    <main className="font-system-jp bg-white text-slate-900 antialiased">
      {/* プレビューであることを明示する帯（差し替え時に消す） */}
      <div className="bg-amber-100 text-amber-900 text-[13px] px-4 py-2 text-center">
        これは新しいLPのプレビューです。検索には出ません。
        <Link href="/laruHP" className="underline ml-2 font-medium">今のLPを見る</Link>
      </div>

      {/* ───────── ファーストビュー ─────────
          スマホ1画面で「誰の・何が・いくらで・次に何をするか」が分かることだけを狙う。
          背景動画も3Dも置かない。 */}
      <section className="px-5 pt-10 pb-12 md:pt-20 md:pb-20 bg-gradient-to-b from-sky-50 to-white">
        <div className="max-w-5xl mx-auto md:grid md:grid-cols-[1.05fr_0.95fr] md:gap-12 md:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white border border-sky-200 px-3.5 py-1.5 text-[12px] font-medium text-sky-800">
              個人商店・小さな会社のための
            </p>

            <h1 className="mt-4 text-[34px] leading-[1.28] md:text-[54px] md:leading-[1.15] font-bold tracking-tight text-balance-jp">
              お店のホームページを、<br />
              <span className="text-sky-600">月{yen(hp.monthly)}円</span>で持つ。
            </h1>

            <p className="mt-4 text-[16px] md:text-lg leading-[1.9] text-slate-700">
              業種を選んで、お店の情報を入れるだけ。
              文章も写真もAIが用意して、そのまま公開できます。
              サーバーもSSLも料金に含まれています。
            </p>

            <ul className="mt-5 space-y-2 text-[15px] text-slate-700">
              {[TERMS.firstMonthFree, `最低${TERMS.minimumMonths}ヶ月・${TERMS.cancel}`, TERMS.payment].map(t => (
                <li key={t} className="flex items-start gap-2.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7">
              <PrimaryCta id="cta-hero" />
            </div>
            <p className="mt-3 text-center md:text-left text-[13px]">
              <Link href={SECONDARY_CTA.href} className="text-sky-700 underline underline-offset-4">
                {SECONDARY_CTA.label}
              </Link>
            </p>
            <p className="mt-4 text-[12px] text-slate-500">{TERMS.taxNote}</p>
          </div>

          {/* 主役の視覚要素は「実際に作れるサイト」。装飾ではなく証拠を置く */}
          <div className="mt-10 md:mt-0 flex justify-center gap-3">
            <div className="pt-8"><PhoneMock industry="beauty" label="美容室" /></div>
            <PhoneMock industry="restaurant" label="飲食店" priority />
          </div>
        </div>
      </section>

      {/* ───────── 3ステップ ───────── */}
      <section className="px-5 py-14 md:py-20 border-t border-slate-100">
        <div className="max-w-4xl mx-auto">
          <SectionHead
            eyebrow="つかいかた"
            title="やることは3つだけ"
            lead="パソコンが苦手でも大丈夫です。文字を打つ以外の作業はありません。"
          />
          <ol className="grid gap-4 md:grid-cols-3">
            {[
              { n: '1', t: '業種を選ぶ', d: '飲食店、美容室、工務店など。選んだ業種に合わせて、構成とデザインが決まります。' },
              { n: '2', t: 'お店の情報を入れる', d: '店名・住所・営業時間・メニュー。入力した内容から、AIが紹介文を書きます。' },
              { n: '3', t: '確認して公開', d: '直したいところはクリックして書き換え。そのまま公開できます。' },
            ].map(s => (
              <li key={s.n} className="rounded-2xl border border-slate-200 p-5">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-sky-600 text-white font-bold text-[15px]">{s.n}</span>
                <h3 className="mt-3 font-bold text-[17px]">{s.t}</h3>
                <p className="mt-1.5 text-[15px] leading-[1.9] text-slate-600">{s.d}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10">
            <PrimaryCta id="cta-steps" />
          </div>
        </div>
      </section>

      {/* ───────── 操作イメージ（押したときだけ読み込む） ───────── */}
      <section className="px-5 py-14 md:py-20 bg-slate-50 border-t border-slate-100">
        <div className="max-w-3xl mx-auto">
          <SectionHead
            eyebrow="うごき"
            title="編集画面はこんな感じです"
            lead="ブロックを並べていくと、そのままページになります。再生を押すまで映像は読み込みません。"
          />
          <DemoVideo />
        </div>
      </section>

      {/* ───────── 作例 ───────── */}
      <section id="works" className="px-5 py-14 md:py-20 border-t border-slate-100 scroll-mt-4">
        <div className="max-w-5xl mx-auto">
          <SectionHead
            eyebrow="さくれい"
            title="こんなサイトが作れます"
            lead="どれもAIが生成した作例です。写真も文章も、この仕組みで用意しています。"
          />
        </div>
        <div className="max-w-5xl mx-auto -mx-5 px-5 overflow-x-auto">
          <div className="flex gap-4 pb-2 w-max">
            {(['restaurant', 'beauty', 'clinic', 'construction', 'hotel', 'retail'] as const).map(id => (
              <PhoneMock key={id} industry={id} label={INDUSTRIES.find(i => i.id === id)!.name} />
            ))}
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-8">
          <p className="text-[15px] text-slate-600 leading-[1.9]">
            テンプレートは{INDUSTRIES.length}業種ぶん用意しています。
            {INDUSTRIES.map(i => i.name).join('、')}。
          </p>
          <div className="mt-8">
            <PrimaryCta id="cta-works" />
          </div>
        </div>
      </section>

      {/* ───────── 料金 ───────── */}
      <section id="pricing" className="px-5 py-14 md:py-20 bg-slate-50 border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <SectionHead
            eyebrow="りょうきん"
            title="料金"
            lead={`${TERMS.taxNote}。${TERMS.firstMonthFree}。`}
          />

          <div className="grid gap-4 md:grid-cols-3">
            {PLANS.map(p => (
              <div
                key={p.id}
                className={`rounded-2xl border bg-white p-6 ${p.highlight ? 'border-sky-500 ring-2 ring-sky-100' : 'border-slate-200'}`}
              >
                {p.badge && (
                  <span className="inline-block mb-3 rounded-full bg-sky-100 text-sky-800 text-[12px] font-bold px-3 py-1">
                    {p.badge}
                  </span>
                )}
                <h3 className="font-bold text-[19px]">{p.name}</h3>
                <p className="mt-1 text-[14px] text-slate-600">{p.lead}</p>
                <p className="mt-4">
                  <span className="text-[34px] font-bold tracking-tight">{yen(p.monthly)}</span>
                  <span className="text-slate-600 text-[15px]"> 円/月</span>
                </p>
                <p className="text-[13px] text-slate-500">年払いなら月{yen(p.annualPerMonth)}円換算</p>

                <ul className="mt-5 space-y-2 text-[14px] leading-relaxed">
                  {p.includes.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                      <span className="text-slate-700">{f}</span>
                    </li>
                  ))}
                  {p.excludes.map(f => (
                    <li key={f} className="flex items-start gap-2 text-slate-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="mt-1 shrink-0" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-[14px] leading-[1.9] text-slate-600">
            <p className="font-bold text-slate-900 mb-2">契約の条件</p>
            <ul className="space-y-1.5 list-disc pl-5">
              <li>{TERMS.firstMonthFree}</li>
              <li>最低利用期間は{TERMS.minimumMonths}ヶ月です。{TERMS.cancelNote}</li>
              <li>{TERMS.cancel}</li>
              <li>{TERMS.annualNote}</li>
              <li>{TERMS.domainNote}</li>
              <li>{TERMS.payment}・{TERMS.taxNote}</li>
            </ul>
            <p className="mt-3">
              制作会社・フリーランスの方は、複数のクライアントを1アカウントで管理できる
              エージェンシープラン（月額19,800円）があります。
            </p>
          </div>

          <div className="mt-10">
            <PrimaryCta id="cta-pricing" />
          </div>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section className="px-5 py-14 md:py-20 border-t border-slate-100">
        <div className="max-w-3xl mx-auto">
          <SectionHead eyebrow="しつもん" title="よくある質問" />
          <Faq />
        </div>
      </section>

      {/* ───────── 最後のCTA ───────── */}
      <section className="px-5 py-16 md:py-24 bg-sky-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-[26px] md:text-4xl font-bold leading-[1.35] text-balance-jp">
            今日、お店のホームページを持てます。
          </h2>
          <p className="mt-4 text-[16px] leading-[1.9] text-sky-50">
            初月は無料です。合わなければ、6ヶ月を過ぎたらいつでもやめられます。
          </p>
          <div className="mt-8 flex flex-col items-center gap-2.5">
            <Link
              href={PRIMARY_CTA.href}
              id="cta-final"
              className="inline-flex items-center justify-center w-full max-w-sm min-h-[56px] px-8 rounded-2xl bg-white text-sky-700 text-[17px] font-bold shadow-lg active:scale-[0.99] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {PRIMARY_CTA.label}
            </Link>
            <p className="text-[13px] text-sky-100">{PRIMARY_CTA.sub}</p>
          </div>
        </div>
      </section>

      <footer className="px-5 py-10 text-center text-[13px] text-slate-500 border-t border-slate-100">
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link href="/laruHP/plans" className="underline underline-offset-4">料金プラン</Link>
          <Link href="/laruHP/terms" className="underline underline-offset-4">利用規約</Link>
          <Link href="/laruHP/privacy" className="underline underline-offset-4">プライバシーポリシー</Link>
          <Link href="/laruHP/tokusho" className="underline underline-offset-4">特定商取引法に基づく表記</Link>
          <Link href="/laruHP/contact" className="underline underline-offset-4">お問い合わせ</Link>
        </nav>
        <p className="mt-5">株式会社LaruVisona</p>
      </footer>
    </main>
  );
}
