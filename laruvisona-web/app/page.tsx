'use client';
/**
 * 株式会社LaruVisona の会社トップ。
 *
 * 構成は「期待 → 実物 → 何を作れるか → 支える仕組み → 相談」。
 *   ① 冒頭：一滴が正式ロゴの粒へ整い、透明な面がひらく（components/company/OpeningStage）
 *   ② 実物：公開ページを作るのと同じ処理で今つくったサイトを、その場で触れる
 *   ③ 目的から、事業とサービスへ
 *   ④ 支える仕組み（デザイン → 保存 → 公開 → 運用）
 *   ⑤ 会社のこと、相談
 *
 * 書かないもの: 架空の導入実績、顧客ロゴ、成果の数値、未実装の機能。
 * 見せているデモは「見本」と書く。実際に動く製品へは実画面で繋ぐ。
 * 生成画像はブランド表現。事業の説明は、実サービスへの導線と具体的な文章で行う。
 */
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import BrandFonts from '@/components/BrandFonts';
import LiveDemo from '@/components/company/LiveDemo';
import { MotionProvider } from '@/components/company/motion';
import SiteHeader from '@/components/company/SiteHeader';
import OpeningStage from '@/components/company/OpeningStage';
import PurposePicker from '@/components/company/PurposePicker';
import ClosingMark from '@/components/company/ClosingMark';

const REASONS = [
  {
    title: '作っている人間が、そのまま話す',
    body: '窓口と開発が分かれていません。困りごとを聞いた人間がそのまま設計して作ります。',
  },
  {
    title: '動くものを見ながら決める',
    body: '仕様書の文章だけで進めません。早い段階で実際に触れる画面をお出しして、ずれを潰します。',
  },
  {
    title: '渡したあとに、自分で直せる形にする',
    body: '直すたびに費用が要る作りにしません。運用する人が自分で触れるところまでを納品に含めます。',
  },
];

const STRUCTURE = [
  {
    n: '01',
    title: 'つくる',
    body: '業種のひな形と見せ方の組み合わせから、写真も文章も入ったサイトを組み立てます。見た目の設定は一つの体系にまとめてあり、公開ページと編集画面で同じものを使います。',
  },
  {
    n: '02',
    title: 'のこす',
    body: '編集は下書きとして手元にも残ります。ログインが切れても、書いていたものを失わずに戻れます。保存するのは、そのサイトとアカウントの組み合わせに限ります。',
  },
  {
    n: '03',
    title: 'ひらく',
    body: '公開のたびにHTMLを書き出し、版を記録します。独自ドメイン・SSL・問い合わせの通知先まで、公開前に確認する項目を用意しています。',
  },
  {
    n: '04',
    title: 'つづける',
    body: '公開後も同じ画面から直せます。改善や機能追加も続けて承ります。作って終わりにしません。',
  },
];

const PROCESS = [
  { n: '01', title: '相談', span: '即日〜3日', body: 'フォームから困りごとをお送りください。要件と優先順位を一緒に整理します。ここまで費用はかかりません。' },
  { n: '02', title: '提案・見積もり', span: '〜1週間', body: '実現方法・費用・期間を書いたご提案をお出しします。納得いただけるまで調整します。' },
  { n: '03', title: '開発', span: '2週間〜', body: '週ごとに進み具合をご報告します。動く画面を確かめながら進めます。' },
  { n: '04', title: '確認・公開', span: '約1週間', body: '実際の環境でご確認いただき、直したうえで公開・納品します。' },
  { n: '05', title: '運用', span: '継続', body: '公開後の改善や機能追加も続けて承ります。' },
];

const COMPANY: Array<[string, React.ReactNode]> = [
  ['会社名', '株式会社LaruVisona'],
  ['代表取締役', '齋藤匠'],
  ['設立', '2026年4月6日'],
  ['本店所在地', <>〒174-0072<br />東京都板橋区南常盤台1丁目11-6-101号室</>],
  ['オフィス', <>〒170-0005<br />東京都豊島区南大塚1丁目22-3 CASA南大塚101号室</>],
  ['事業内容', <>Webシステム・AIアプリケーションの受託開発<br />自社サービスの企画・運営（LARUbot / LARU HP）</>],
];

export default function Home() {
  /* 会社トップには、画面を止める導入演出（components/Intro）を置いていない。
     LARUbot のチャットは「導入演出が終わってから出す」作りなので、
     このページでは最初の描画が落ち着いた時点で終わりを知らせる。
     知らせないと、保険の待ち時間（6秒）ぶんチャットが出てこない。 */
  useEffect(() => {
    const t = setTimeout(() => {
      try { sessionStorage.setItem('lv_intro_seen', '1'); } catch { /* 端末が許さないときは無視 */ }
      window.dispatchEvent(new Event('lv:intro-done'));
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <MotionProvider>
      <BrandFonts />
      <SiteHeader />

      <main className="bg-[#04080f] text-slate-100">
        {/* ① 冒頭 ─ 一滴から、正式ロゴの粒へ。そして透明な面がひらく */}
        <OpeningStage />

        {/* ② 実物へ ─ ロゴが退いたあとの静かな画面に、この一行だけが残る。
            冒頭の迫力のあとに、読むための場面をひとつ置く。 */}
        <section
          id="live"
          className="relative z-10 -mt-[100svh] pt-[56svh] pb-[16svh] md:pb-[20svh] scroll-mt-[64px] md:scroll-mt-[72px]
            bg-[linear-gradient(180deg,transparent_0%,rgba(4,8,15,.55)_16%,#04080f_36%,#04080f_100%)]"
        >
          <div className="max-w-6xl mx-auto px-5 md:px-8">
            <p className="text-[10px] md:text-[11px] font-bold tracking-[0.22em] text-sky-300/80 mb-5">01 / 実物</p>
            <h2 className="text-[clamp(26px,6.6vw,34px)] md:text-[clamp(34px,3.2vw,44px)] font-bold
              leading-[1.42] tracking-[-0.015em] text-white mb-6 max-w-[14em] [word-break:auto-phrase]">
              ここから先は、映像ではありません。
            </h2>
            <p className="text-[15px] md:text-[17px] leading-[2] text-slate-300 max-w-[26em] [word-break:auto-phrase]">
              下に出てくるのは、お客さまのページを公開するのと同じ処理で、いま作ったサイトです。
              見せ方を選ぶと、写真も文章も料金もそのままで、見た目だけが作り直されます。
            </p>
          </div>
        </section>

        {/* 触る場面。ここからは柔らかな白。水も光も持ち込まない（操作画面を覆わない） */}
        <section
          className="relative z-10 text-slate-900
            bg-[linear-gradient(180deg,#04080f_0%,#0b1727_14%,#c9d2dd_46%,#eef1f5_62%,#f4f6f8_100%)]"
        >
          <div className="max-w-6xl mx-auto px-5 md:px-8 pt-[22svh] pb-16 md:pb-24">
            {/* 「実物を見る」の着地点は、説明の手前ではなく**触れる枠そのもの**。
                固定ヘッダーぶんだけ上に余白を取って、選ぶところから画面に入るようにする */}
            <div id="live-demo" className="scroll-mt-[72px] md:scroll-mt-[88px]
              rounded-3xl border border-slate-200 bg-white p-3 md:p-6 shadow-[0_40px_120px_-45px_rgba(2,10,24,.55)]">
              <LiveDemo />
            </div>
            <p className="mt-4 text-[12px] leading-[1.9] text-slate-500 [word-break:auto-phrase]">
              見本のお店（結い庵）は架空です。写真は見本用の生成素材で、送信はどこへも届きません。
            </p>
          </div>
        </section>

        {/* 迫力のある場面のあとに、静かに読む一行を置く。
            実物（触る）から、できること（読む）へ渡すところ */}
        <section aria-hidden="false" className="relative z-10 bg-[#f4f6f8] text-slate-900">
          <div className="max-w-5xl mx-auto px-5 md:px-8 py-20 md:py-32">
            <p className="text-[clamp(19px,4.8vw,22px)] md:text-[clamp(22px,2.2vw,28px)]
              leading-[1.85] font-bold tracking-[-0.01em] text-slate-800 max-w-[18em] [word-break:auto-phrase]">
              同じ作り方で、お店のサイトも、問い合わせの受け口も、その先の仕組みも。
            </p>
          </div>
        </section>

        {/* ③ 目的から ─ 静かに読む区画 */}
        <section id="purpose" className="relative z-10 bg-[#f4f6f8] text-slate-900 px-5 md:px-8 py-16 md:py-24 scroll-mt-[64px] md:scroll-mt-[72px]">
          <div className="max-w-5xl mx-auto">
            <p className="text-[11px] font-bold tracking-[0.2em] text-sky-700 mb-3">02 / できること</p>
            <h2 className="text-[clamp(24px,6.2vw,30px)] md:text-[clamp(30px,3vw,38px)] font-bold leading-[1.45] tracking-[-0.015em] mb-3">
              どこから始めますか。
            </h2>
            <p className="text-[15px] md:text-[16px] leading-[2] text-slate-600 mb-10 max-w-[28em] [word-break:auto-phrase]">
              小さな会社とお店のために、ホームページと問い合わせ対応の仕組みを作っています。
              合うものが無いときは、受託開発でつくります。
            </p>
            <PurposePicker />
          </div>
        </section>

        {/* 進め方 */}
        <section className="relative z-10 bg-[#eceff4] text-slate-900 px-5 md:px-8 py-16 md:py-24">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-[20px] md:text-[26px] font-bold mb-8">ご相談から公開までの進め方</h2>
            <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {PROCESS.map(s => (
                <li key={s.n} className="border-t-2 border-slate-300 pt-4">
                  <div className="text-[12px] font-bold text-sky-700">{s.n}</div>
                  <div className="text-[15px] font-bold mt-1">{s.title}</div>
                  <div className="text-[11px] text-slate-500 mt-1 mb-2">{s.span}</div>
                  <p className="text-[13px] leading-[1.95] text-slate-600 [word-break:auto-phrase]">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ④ 支える仕組み ─ ふたたび暗い空間へ。ここが二度目の見せ場 */}
        <section id="architecture" className="relative z-10 bg-[#04080f] overflow-hidden scroll-mt-[64px] md:scroll-mt-[72px]">
          <div className="relative">
            <div aria-hidden="true" className="absolute inset-0">
              <Image
                src="/brand/water/water-3.webp" alt="" fill sizes="100vw"
                className="object-cover object-center opacity-45"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#04080f_0%,rgba(4,8,15,.55)_28%,rgba(4,8,15,.78)_70%,#04080f_100%)]" />
            </div>
            <div className="relative max-w-5xl mx-auto px-5 md:px-8 py-20 md:py-32">
              <p className="text-[11px] font-bold tracking-[0.2em] text-sky-300 mb-3">03 / 支える仕組み</p>
              <h2 className="text-[clamp(26px,6.6vw,32px)] md:text-[clamp(32px,3.2vw,42px)] font-bold leading-[1.42] tracking-[-0.015em] mb-5 max-w-[14em]">
                表に見えるものの、
                <br />
                その奥まで作ります。
              </h2>
              <p className="text-[15px] md:text-[17px] leading-[2] text-slate-300 max-w-[27em] mb-12 [word-break:auto-phrase]">
                画面の見た目だけでは、公開したあとの毎日は回りません。
                作る・のこす・ひらく・つづける。この4つを一つの流れとして設計しています。
              </p>
              <ol className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
                {STRUCTURE.map(s => (
                  <li key={s.n} className="border-t border-white/15 pt-5">
                    <div className="flex items-baseline gap-3 mb-2">
                      <span className="text-[12px] font-bold text-sky-300 tabular-nums">{s.n}</span>
                      <h3 className="text-[17px] md:text-[19px] font-bold">{s.title}</h3>
                    </div>
                    <p className="text-[13px] md:text-[14px] leading-[2] text-slate-300 max-w-[26em] [word-break:auto-phrase]">{s.body}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-10 text-[11px] text-slate-500">
                背景はブランド表現の生成画像です。処理の様子を映したものではありません。
              </p>
            </div>
          </div>
        </section>

        {/* 選ばれ方 */}
        <section className="relative z-10 bg-[#070e18] px-5 md:px-8 py-16 md:py-24 border-t border-white/10">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-[20px] md:text-[26px] font-bold mb-8">お願いするときに、たしかめてほしいこと</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {REASONS.map(r => (
                <div key={r.title}>
                  <h3 className="text-[16px] font-bold mb-2 leading-[1.6]">{r.title}</h3>
                  <p className="text-[13px] leading-[2] text-slate-400 [word-break:auto-phrase]">{r.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ⑤ 会社のこと */}
        <section id="company" className="relative z-10 bg-[#070e18] px-5 md:px-8 py-14 md:py-20 scroll-mt-[64px] md:scroll-mt-[72px]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-[20px] md:text-[26px] font-bold mb-8">会社のこと</h2>
            <table className="w-full text-left">
              <tbody>
                {COMPANY.map(([k, v]) => (
                  <tr key={k} className="border-b border-white/10 align-top">
                    <th className="py-4 pr-6 text-[13px] font-normal text-slate-500 w-32">{k}</th>
                    <td className="py-4 text-[14px] leading-[1.9]">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-6">
              <Link href="/brand"
                className="inline-flex items-center min-h-[44px] text-[13px] font-bold text-sky-300 hover:text-sky-200">
                ロゴについて（しるしの意味と使い方）→
              </Link>
            </p>
          </div>
        </section>

        {/* 相談 */}
        <section id="contact" className="relative z-10 bg-[#04080f] px-5 md:px-8 py-20 md:py-28 border-t border-white/10 scroll-mt-[64px] md:scroll-mt-[72px]">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[11px] font-bold tracking-[0.2em] text-sky-300 mb-4">04 / ご相談</p>
            <h2 className="text-[clamp(26px,6.6vw,32px)] md:text-[clamp(32px,3.2vw,42px)] font-bold leading-[1.45] tracking-[-0.015em] mb-5">
              まだ、形になっていない話から。
            </h2>
            <p className="text-[15px] leading-[2] text-slate-300 mb-9 max-w-[26em] mx-auto [word-break:auto-phrase]">
              何を作るかが決まっていなくても構いません。
              伺ったうえで、そもそも作らないほうがよければ、そう申し上げます。
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/contact"
                className="inline-flex items-center justify-center min-h-[54px] px-8 rounded-xl bg-sky-500 text-[#04101c] font-bold hover:bg-sky-400
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                相談フォームへ
              </Link>
              <Link href="/laruHP"
                className="inline-flex items-center justify-center min-h-[54px] px-8 rounded-xl border border-white/25 font-bold hover:border-white/60
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                まずホームページから
              </Link>
            </div>
          </div>
          <ClosingMark />
        </section>

        <footer className="relative z-10 bg-[#04080f] px-5 md:px-8 pb-12 text-center text-[12px] text-slate-500">
          <Image src="/images/logo_dark.png" alt="LaruVisona" width={1300} height={375}
            className="h-5 w-auto mx-auto mb-5 opacity-80" />
          <div className="flex flex-wrap gap-4 justify-center mb-4">
            <Link href="/brand" className="hover:text-slate-300 min-h-[44px] inline-flex items-center">ロゴについて</Link>
            <Link href="/privacy" className="hover:text-slate-300 min-h-[44px] inline-flex items-center">プライバシーポリシー</Link>
            <Link href="/terms" className="hover:text-slate-300 min-h-[44px] inline-flex items-center">利用規約</Link>
            <Link href="/laruHP/tokusho" className="hover:text-slate-300 min-h-[44px] inline-flex items-center">特定商取引法に基づく表記</Link>
            <Link href="/contact" className="hover:text-slate-300 min-h-[44px] inline-flex items-center">お問い合わせ</Link>
          </div>
          © 2026 株式会社LaruVisona
        </footer>
      </main>
    </MotionProvider>
  );
}
