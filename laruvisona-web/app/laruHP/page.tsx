'use client';
/**
 * LARU HP の案内ページ。
 *
 * 主役は「写真・文章・料金・予約が組み上がって、1枚のサイトになる」ところ。
 * そのため、作れるもの（実際の作品）と、実際に動く制作画面を先に見せる。
 *
 * 守っていること:
 *  - 画面写真は、隔離環境で実際に動かして撮ったもの。作り絵ではない。
 *  - 組み上がるデモは、公開ページと同じ仕組みが出力した本物のHTML。
 *  - ボタン・文字・リンクはすべて本物のHTML。動画の中に描いた絵ではない。
 *  - 料金と無料期間は、決済で使っている定義から持ってくる。
 *  - 未実装の機能、架空の利用者数、作った口コミは載せない。
 */
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import BrandFonts from '@/components/BrandFonts';
import AssembleDemo from '@/components/lp/AssembleDemo';
import { PLANS, TERMS, PRIMARY_CTA, FAQ as FACT_FAQ } from '@/lib/laruhp-facts';

const STEPS = [
  {
    n: '1', title: 'きく', lead: '4つの質問に答える',
    body: '何のお店か、どこにあるか、どんな人に来てほしいか、来た人にまずしてほしいこと。答えると、その業種に合った並びでたたき台ができます。',
    shot: '/lp/studio-intake.jpg', alt: '4つの質問だけが並んだ、はじめの画面',
  },
  {
    n: '2', title: 'えらぶ', lead: '雰囲気を選ぶ',
    body: '見本は静止画ではなく、実際に出来上がる見た目そのものです。選んだあとで「思っていたのと違う」が起きません。何度でも変えられます。',
    shot: '/lp/studio-mood.jpg', alt: '雰囲気の見本が5つ並んだ画面',
  },
  {
    n: '3', title: 'ととのえる', lead: '本物を見ながら直す',
    body: '真ん中に出ているのは、公開したときとまったく同じ画面です。直したい場所を押すと、その場所の設定だけが右に出ます。CSSは書きません。',
    shot: '/lp/studio-edit.jpg', alt: '中央に大きなプレビュー、右に設定が並ぶ制作画面',
  },
];

const AFTER = [
  { title: '自分で直せる', body: '文章も写真も料金も、同じ画面から直して公開し直せます。直すたびに業者へ頼む必要はありません。' },
  { title: '予約と問い合わせを受け取る', body: '予約フォームと問い合わせフォームが最初から入っています。届いた内容はメールで受け取れます。' },
  { title: 'スマホで見たときも崩れない', body: 'パソコンとスマホを切り替えて確かめられます。スマホでは画面の下に予約ボタンを出せます。' },
  { title: '独自ドメインをつなげる', body: 'お持ちのドメインを設定できます。SSL証明書とサーバー費用は月額に含まれます。' },
  { title: '検索に出る形にしておく', body: '説明文・構造化データ・サイトマップを自動で用意します。' },
  { title: 'お知らせを載せる', body: '休業やキャンペーンのお知らせを、サイトに出せます。' },
];

// よくある質問は、契約や料金にかかわるものを一次情報から読む。
// 作り方についての質問だけ、この画面の説明として足す。
const HOW_FAQ = [
  {
    q: 'ホームページを作ったことがなくても大丈夫ですか',
    a: '4つの質問に答えるところから始まります。CSSやHTMLは書きません。色や余白は用意した選択肢から選ぶ形で、選んだ結果はその場で画面に出ます。',
  },
  {
    q: '作ったあと、自分で直せますか',
    a: '直せます。制作画面をもう一度開いて、直したい場所を押して、保存して公開し直すだけです。回数の制限はありません。',
  },
  {
    q: '写真がありません',
    a: '写真が無い場所は、あとから差し替えられる形にしておけます。差し替えても余白や切り取りが崩れないように作ってあります。',
  },
];
const FAQ = [...HOW_FAQ, ...FACT_FAQ.slice(0, 5)];

export default function LaruHPLandingPage() {
  const [device, setDevice] = useState<'pc' | 'sp'>('pc');

  return (
    <main className="bg-white text-slate-900">
      {/* ブランドを見せる画面なので、ここだけブランド書体を読む */}
      <BrandFonts />
      {/* ── 最初の画面 ───────────────────────────────────────────── */}
      <section className="px-5 pt-16 pb-10 md:pt-24 md:pb-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-[12px] font-bold tracking-widest text-sky-700 mb-4">LARU HP</p>
          <h1 className="text-[30px] leading-[1.45] md:text-[46px] md:leading-[1.4] font-bold tracking-[0.01em] mb-5">
            写真と、文章と、料金と、予約。
            <br />
            ばらばらの材料が、1枚のサイトになる。
          </h1>
          <p className="text-[15px] md:text-[17px] leading-[1.95] text-slate-600 max-w-[34em] mb-8">
            小さなお店のためのホームページです。4つの質問に答えるところから始まり、
            出来上がった画面を見ながら直して、そのまま公開できます。
            公開したあとも、同じ画面から自分で直せます。
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <Link href="/laruHP/studio"
              className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800">
              作りはじめる
            </Link>
            <a href="#work"
              className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-xl border border-slate-300 font-bold hover:border-slate-500">
              できあがりを見る
            </a>
            <span className="text-[12px] text-slate-500">{TERMS.firstMonthFree}・{TERMS.taxNote}</span>
          </div>
        </div>
      </section>

      {/* ── 何が作れるか（実際の作品）───────────────────────────── */}
      <section id="work" className="px-5 py-14 md:py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[22px] md:text-[28px] font-bold mb-2">できあがるもの</h2>
          <p className="text-[14px] text-slate-600 leading-[1.9] max-w-[34em] mb-6">
            LARU HP で作った見本です。ここに出ているのは、実際に公開されるページを
            そのまま撮ったものです。パソコンとスマホを切り替えて見られます。
          </p>

          <div className="flex gap-2 mb-5">
            {(['pc', 'sp'] as const).map(k => (
              <button key={k} type="button" onClick={() => setDevice(k)}
                aria-pressed={device === k}
                className={`px-4 py-2 rounded-full text-[13px] font-bold border ${device === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'}`}>
                {k === 'pc' ? 'パソコン' : 'スマホ'}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="max-h-[560px] overflow-y-auto">
              {device === 'pc' ? (
                <Image src="/lp/work-salon-pc.jpg" alt="美容室の見本サイト（パソコンでの表示）"
                  width={1100} height={1833} className="w-full h-auto" />
              ) : (
                <div className="py-6 flex justify-center bg-slate-100">
                  <Image src="/lp/work-salon-sp.jpg" alt="美容室の見本サイト（スマホでの表示）"
                    width={420} height={1830} className="w-[300px] h-auto rounded-[22px] border-[8px] border-slate-800 shadow-xl" />
                </div>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            見本の「結い庵」は架空のお店です。写真は生成した素材で、実在の店舗・施術実績ではありません。
          </p>
        </div>
      </section>

      {/* ── 組み上がるところ ────────────────────────────────────── */}
      <section className="px-5 py-14 md:py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[22px] md:text-[28px] font-bold mb-2">部品が、そろって、そろう</h2>
          <p className="text-[14px] text-slate-600 leading-[1.9] max-w-[34em] mb-6">
            サイトは「最初の画面」「メニューと料金」「写真」「予約」といった部品でできています。
            下は、その部品が組み上がるところです。雰囲気や書体のボタンを押すと、その場で作り直します。
          </p>
          <AssembleDemo />
        </div>
      </section>

      {/* ── 制作の流れ ─────────────────────────────────────────── */}
      <section className="px-5 py-14 md:py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[22px] md:text-[28px] font-bold mb-2">作るときの3つの画面</h2>
          <p className="text-[14px] text-slate-600 leading-[1.9] max-w-[34em] mb-8">
            下の画面写真は、実際に動かして撮ったものです。
          </p>
          <div className="space-y-10 md:space-y-14">
            {STEPS.map(s => (
              <div key={s.n} className="grid md:grid-cols-2 gap-6 md:gap-10 items-center">
                <div className={s.n === '2' ? 'md:order-2' : ''}>
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="text-[28px] font-bold text-sky-600 leading-none">{s.n}</span>
                    <span className="text-[20px] font-bold">{s.title}</span>
                    <span className="text-[13px] text-slate-500">{s.lead}</span>
                  </div>
                  <p className="text-[14px] leading-[1.95] text-slate-600 max-w-[30em]">{s.body}</p>
                </div>
                <div className={s.n === '2' ? 'md:order-1' : ''}>
                  <Image src={s.shot} alt={s.alt} width={1200} height={780}
                    className="w-full h-auto rounded-xl border border-slate-200 shadow-sm bg-white" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 公開後にできること ─────────────────────────────────── */}
      <section className="px-5 py-14 md:py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[22px] md:text-[28px] font-bold mb-2">公開したあと、できること</h2>
          <p className="text-[14px] text-slate-600 leading-[1.9] max-w-[34em] mb-8">
            いま動いている機能だけを書いています。
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {AFTER.map(a => (
              <div key={a.title} className="border border-slate-200 rounded-xl p-5">
                <div className="font-bold mb-2">{a.title}</div>
                <p className="text-[13px] leading-[1.9] text-slate-600">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 料金 ───────────────────────────────────────────────── */}
      <section id="price" className="px-5 py-14 md:py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[22px] md:text-[28px] font-bold mb-2">料金</h2>
          <p className="text-[14px] text-slate-600 leading-[1.9] mb-8">
            {TERMS.firstMonthFree}。{TERMS.taxNote}。
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {PLANS.map(p => (
              <div key={p.id}
                className={`rounded-2xl border p-6 bg-white ${p.highlight ? 'border-sky-500 shadow-[0_10px_40px_rgba(2,132,199,.12)]' : 'border-slate-200'}`}>
                {p.badge && (
                  <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 mb-3">{p.badge}</span>
                )}
                <div className="font-bold text-[17px]">{p.name}</div>
                <div className="text-[12px] text-slate-500 mb-3">{p.lead}</div>
                <div className="mb-1">
                  <span className="text-[30px] font-bold">{p.monthly.toLocaleString('ja-JP')}</span>
                  <span className="text-[13px] text-slate-500"> 円 / 月（税別）</span>
                </div>
                <div className="text-[12px] text-slate-500 mb-4">年払いなら月 {p.annualPerMonth.toLocaleString('ja-JP')} 円</div>
                <ul className="space-y-1.5">
                  {p.includes.map(f => (
                    <li key={f} className="text-[13px] text-slate-700 flex gap-2">
                      <span className="text-sky-600">✓</span>{f}
                    </li>
                  ))}
                  {p.excludes.map(f => (
                    <li key={f} className="text-[13px] text-slate-400 flex gap-2">
                      <span>−</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href={PRIMARY_CTA.href}
                  className={`mt-5 flex items-center justify-center min-h-[52px] rounded-xl font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${p.highlight ? 'bg-sky-600 text-white hover:bg-sky-700' : 'border border-slate-300 hover:border-slate-500'}`}>
                  {PRIMARY_CTA.label}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-slate-500 mt-5 leading-[1.9]">
            {TERMS.cancelNote}。{TERMS.cancel}。{TERMS.annualNote}。<br />{TERMS.domainNote}。{TERMS.payment}。
          </p>
        </div>
      </section>

      {/* ── よくある質問 ───────────────────────────────────────── */}
      <section className="px-5 py-14 md:py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-[22px] md:text-[28px] font-bold mb-6">よくある質問</h2>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {FAQ.map(f => (
              <details key={f.q} className="py-4 group">
                <summary className="font-bold cursor-pointer list-none flex justify-between gap-4 min-h-[52px] items-center">
                  {f.q}
                  <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <p className="text-[14px] leading-[1.95] text-slate-600 mt-3">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── はじめる ───────────────────────────────────────────── */}
      <section className="px-5 py-16 md:py-24 bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-[24px] md:text-[32px] font-bold leading-[1.5] mb-4">
            まずは、4つの質問から。
          </h2>
          <p className="text-[14px] leading-[1.95] text-slate-300 mb-8">
            答えるとたたき台ができます。気に入らなければ、そこでやめても構いません。
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/laruHP/studio"
              className="inline-flex items-center justify-center min-h-[52px] px-8 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-100">
              作りはじめる
            </Link>
            <Link href="/contact"
              className="inline-flex items-center justify-center min-h-[52px] px-8 rounded-xl border border-white/40 font-bold hover:border-white">
              相談する
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
