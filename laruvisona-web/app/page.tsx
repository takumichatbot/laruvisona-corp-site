'use client';
/**
 * 株式会社LaruVisona の会社トップ。
 *
 * 最初の画面で「何を提供していて、誰のどの困りごとを引き受ける会社か」が
 * 分かることを最優先にした。以前は演出と抽象的な言い回しが先に来ていて、
 * 何をしている会社かが下までスクロールしないと分からなかった。
 *
 * 書かないもの: 架空の導入実績、顧客ロゴ、成果の数値、未実装の機能。
 * 実在するのは、動いている製品と、公開できる会社情報だけ。
 */
import Image from 'next/image';
import Link from 'next/link';
import BrandFonts from '@/components/BrandFonts';
import BrandVisual, { BRAND_VISUAL } from '@/components/BrandVisual';
import { WORKS } from '@/lib/works-data';

const PROBLEMS = [
  {
    who: 'お店・小さな会社',
    trouble: 'ホームページが無い。あっても古く、自分で直せない。',
    answer: 'LARU HP',
    href: '/laruHP',
  },
  {
    who: '問い合わせに追われている現場',
    trouble: '同じ質問への返信で手が止まる。営業時間外の連絡を取りこぼす。',
    answer: 'LARUbot',
    href: 'https://larubot.tokyo',
  },
  {
    who: '既存の業務・システム',
    trouble: '手作業が多い。既存のツールに合う仕組みが見つからない。',
    answer: '受託開発',
    href: '#contact',
  },
];

const SERVICES = [
  {
    name: 'LARU HP',
    lead: 'ホームページを作って、自分で直しつづける',
    body:
      '4つの質問に答えるとたたき台ができ、出来上がった画面を見ながら直して公開できます。'
      + '公開後も同じ画面から自分で直せます。予約・問い合わせフォーム、独自ドメイン、SSLを含みます。',
    price: '月額 999円（税別）から',
    cta: { label: 'LARU HP を見る', href: '/laruHP', external: false },
  },
  {
    name: 'LARUbot',
    lead: '問い合わせの一次対応を、24時間ひきうける',
    body:
      'サイトに置くAIチャットボットです。よくある質問に答え、必要なものだけ人へ渡します。'
      + '顧客管理・メール配信・Web予約・決済まで含む構成もあります。',
    price: '月額 27,500円から（LARU HP のプランに含まれる Lite 版もあります）',
    cta: { label: 'larubot.tokyo を見る', href: 'https://larubot.tokyo', external: true },
  },
  {
    name: '受託開発',
    lead: '合う道具が無いところを、つくる',
    body:
      'Webシステム・AIを使ったアプリケーションの開発を承ります。'
      + 'まず困りごとを伺い、実現の仕方・費用・期間をお出しします。相談の段階では費用はかかりません。',
    price: '内容を伺ってお見積もり',
    cta: { label: '相談する', href: '#contact', external: false },
  },
];

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

const PROCESS = [
  { n: '01', title: '相談', span: '即日〜3日', body: 'フォームから困りごとをお送りください。要件と優先順位を一緒に整理します。ここまで費用はかかりません。' },
  { n: '02', title: '提案・見積もり', span: '〜1週間', body: '実現方法・費用・期間を書いたご提案をお出しします。納得いただけるまで調整します。' },
  { n: '03', title: '開発', span: '2週間〜', body: '週ごとに進み具合をご報告します。動く画面を確かめながら進めます。' },
  { n: '04', title: '確認・公開', span: '約1週間', body: '実際の環境でご確認いただき、直したうえで公開・納品します。' },
  { n: '05', title: '運用', span: '継続', body: '公開後の改善や機能追加も続けて承ります。作って終わりにしません。' },
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
  return (
    <main className="bg-[#070e18] text-slate-100">
      <BrandFonts />

      {/* ── 最初の画面 ─────────────────────────────────────────── */}
      <section className="px-5 pt-16 pb-14 md:pt-24 md:pb-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-10 lg:gap-14 items-center">
          <div>
            <p className="text-[12px] font-bold tracking-[0.2em] text-sky-300/80 mb-5">株式会社LaruVisona</p>
            <h1 className="text-[28px] leading-[1.5] md:text-[44px] md:leading-[1.4] font-bold mb-6">
              手が足りないところに、
              <br />
              仕組みを入れる。
            </h1>
            <p className="text-[15px] md:text-[16px] leading-[2] text-slate-300 max-w-[32em] mb-8">
              小さな会社とお店のために、ホームページと問い合わせ対応の仕組みを作っています。
              合うものが無いときは、受託開発でつくります。
              まず困りごとを伺うところから始めます。
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#contact"
                className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-xl bg-sky-500 text-[#06121f] font-bold hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                相談する
              </a>
              <a href="#services"
                className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-xl border border-white/25 font-bold hover:border-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                提供しているもの
              </a>
            </div>
          </div>
          <BrandVisual poster={BRAND_VISUAL.poster} sources={BRAND_VISUAL.sources}
            video={BRAND_VISUAL.video} alt={BRAND_VISUAL.alt} />
        </div>
      </section>

      {/* ── 誰の、どの困りごとか ─────────────────────────────────
          同じ形のカードを並べるのをやめ、番号を振った並びにする。
          この節は「読ませる」役で、下の「見せる」節と役割を分ける。 */}
      <section className="px-5 py-14 md:py-20 border-t border-white/10 bg-[#0a1220]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[26px] font-bold mb-8">こういうときに、お役に立てます</h2>
          <ul className="space-y-6 md:space-y-7">
            {PROBLEMS.map((p, i) => (
              <li key={p.who} className="grid md:grid-cols-[3rem_minmax(0,15rem)_minmax(0,1fr)_auto] gap-x-6 gap-y-2 items-baseline border-b border-white/10 pb-6 last:border-0">
                <span className="text-[13px] font-bold text-sky-300/70 tabular-nums">0{i + 1}</span>
                <span className="text-[15px] font-bold text-slate-100">{p.who}</span>
                <p className="text-[15px] leading-[1.95] text-slate-300">{p.trouble}</p>
                <a href={p.href}
                  className="inline-flex items-center gap-1 text-[13px] font-bold text-sky-300 hover:text-sky-200 min-h-[44px] whitespace-nowrap">
                  {p.answer} で応えます →
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 提供しているもの ─────────────────────────────────────
          3つを同じ大きさで並べない。いちばん見せられるもの（実際の画面がある
          LARU HP）を大きく出し、残りは役割の違う形で置く。 */}
      <section id="services" className="px-5 pt-14 md:pt-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[20px] md:text-[26px] font-bold mb-2">提供しているもの</h2>
          <p className="text-[14px] text-slate-400">いま動いている3つです。</p>
        </div>
      </section>

      {/* LARU HP — 実際の画面を大きく見せる */}
      <section className="px-5 py-10 md:py-14">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-8 lg:gap-12 items-center">
            <div>
              <div className="text-[12px] font-bold tracking-widest text-sky-300/80 mb-3">01　自社サービス</div>
              <h3 className="text-[26px] md:text-[34px] font-bold leading-[1.4] mb-4">
                ホームページを作って、
                <br />
                自分で直しつづける。
              </h3>
              <p className="text-[15px] leading-[2] text-slate-300 max-w-[32em] mb-5">
                4つの質問に答えるとたたき台ができ、出来上がった画面を見ながら直して公開できます。
                公開後も同じ画面から自分で直せます。予約・問い合わせフォーム、独自ドメイン、SSLを含みます。
              </p>
              <p className="text-[13px] text-slate-400 mb-6">{SERVICES[0].price}</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/laruHP"
                  className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-xl bg-sky-500 text-[#06121f] font-bold hover:bg-sky-400">
                  LARU HP を見る
                </Link>
                <Link href="/laruHP/studio"
                  className="inline-flex items-center justify-center min-h-[52px] px-6 rounded-xl border border-white/25 font-bold hover:border-white/60">
                  作りはじめる
                </Link>
              </div>
            </div>

            {/* 実際に動かして撮った画面。作り絵ではない */}
            <div className="relative">
              <div className="rounded-2xl overflow-hidden border border-white/15 bg-[#0b1524] shadow-2xl">
                <div className="flex gap-1.5 px-4 py-2.5 border-b border-white/10 bg-white/[0.04]">
                  <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                </div>
                <div className="max-h-[400px] overflow-hidden">
                  <Image src="/lp/work-salon-pc.jpg" alt="LARU HP で作った美容室のサイト（パソコンでの表示）"
                    width={1100} height={1833} className="w-full h-auto" />
                </div>
              </div>
              <div className="hidden md:block absolute -bottom-10 -left-6 w-[46%] rounded-xl overflow-hidden border border-white/15 shadow-2xl bg-[#0b1524]">
                <Image src="/lp/studio-edit.jpg" alt="LARU HP の制作画面。中央に出来上がりが出て、右に設定が並ぶ"
                  width={1200} height={780} className="w-full h-auto" />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-14 md:mt-16">
            上は、LARU HP で作った見本のサイトと、その制作画面を実際に動かして撮ったものです。
            見本の「結い庵」は架空のお店で、写真は生成した素材です。
          </p>
        </div>
      </section>

      {/* LARUbot と 受託開発 — 画面写真は出さない。役割の違う置き方にする */}
      <section className="px-5 py-10 md:py-14 border-t border-white/10">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-14">
          <div>
            <div className="text-[12px] font-bold tracking-widest text-sky-300/80 mb-3">02　自社サービス</div>
            <h3 className="text-[22px] md:text-[26px] font-bold leading-[1.45] mb-3">
              問い合わせの一次対応を、24時間ひきうける。
            </h3>
            <p className="text-[14px] leading-[2] text-slate-300 mb-4">{SERVICES[1].body}</p>
            <p className="text-[13px] text-slate-400 mb-5">{SERVICES[1].price}</p>
            <a href="https://larubot.tokyo" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center min-h-[44px] text-[14px] font-bold text-sky-300 hover:text-sky-200">
              larubot.tokyo を見る →
            </a>
          </div>
          <div className="md:border-l md:border-white/10 md:pl-12">
            <div className="text-[12px] font-bold tracking-widest text-sky-300/80 mb-3">03　受託開発</div>
            <h3 className="text-[22px] md:text-[26px] font-bold leading-[1.45] mb-3">
              合う道具が無いところを、つくる。
            </h3>
            <p className="text-[14px] leading-[2] text-slate-300 mb-4">{SERVICES[2].body}</p>
            <p className="text-[13px] text-slate-400 mb-5">{SERVICES[2].price}</p>
            <a href="#contact"
              className="inline-flex items-center min-h-[44px] text-[14px] font-bold text-sky-300 hover:text-sky-200">
              相談する →
            </a>
          </div>
        </div>
      </section>

      {/* ── 仕事の進め方 ───────────────────────────────────────
          カードをやめ、番号と横線だけの並びにする。 */}
      <section className="px-5 py-14 md:py-20 border-t border-white/10 bg-[#0a1220]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[26px] font-bold mb-8">仕事の進め方で、大事にしていること</h2>
          <div className="space-y-7">
            {REASONS.map((r, i) => (
              <div key={r.title} className="grid md:grid-cols-[3rem_minmax(0,18rem)_minmax(0,1fr)] gap-x-6 gap-y-1.5 items-baseline border-b border-white/10 pb-7 last:border-0">
                <span className="text-[13px] font-bold text-sky-300/70 tabular-nums">0{i + 1}</span>
                <div className="text-[16px] font-bold">{r.title}</div>
                <p className="text-[14px] leading-[1.95] text-slate-300">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 作ったもの ───────────────────────────────────────── */}
      <section id="works" className="px-5 py-14 md:py-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[20px] md:text-[26px] font-bold mb-2">作ったもの</h2>
          <p className="text-[14px] text-slate-400 mb-8">実際に動いているものだけを載せています。</p>
          <div className="grid md:grid-cols-2 gap-x-10 gap-y-8">
            {WORKS.filter(w => !w.placeholder).map(w => (
              <div key={w.slug} className="border-t border-white/15 pt-6">
                <div className="text-[12px] text-sky-300/90 mb-1">{w.category}</div>
                <div className="text-[20px] font-bold mb-1">{w.name}</div>
                <div className="text-[13px] text-slate-400 mb-3">{w.tagline}</div>
                <p className="text-[14px] leading-[1.95] text-slate-300 mb-4">{w.overview}</p>
                <div className="flex flex-wrap gap-4">
                  <Link href={`/works/${w.slug}`}
                    className="inline-flex items-center min-h-[44px] text-[13px] font-bold text-sky-300 hover:text-sky-200">
                    くわしく見る →
                  </Link>
                  {w.link && (
                    <a href={w.link.url} target={w.link.external ? '_blank' : undefined}
                      rel={w.link.external ? 'noopener noreferrer' : undefined}
                      className="inline-flex items-center min-h-[44px] text-[13px] text-slate-400 hover:text-slate-200">
                      {w.link.label}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 受託開発の進め方 ───────────────────────────────────
          横に並ぶ流れ。上の節とは形を変える。 */}
      <section className="px-5 py-14 md:py-20 border-t border-white/10 bg-[#0a1220]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[20px] md:text-[26px] font-bold mb-8">受託開発の進め方</h2>
          <ol className="grid md:grid-cols-5 gap-6 md:gap-4">
            {PROCESS.map(s => (
              <li key={s.n} className="md:border-t md:border-white/20 md:pt-4">
                <div className="flex md:block items-baseline gap-3">
                  <span className="text-[13px] font-bold text-sky-300/70 tabular-nums md:block md:mb-1">{s.n}</span>
                  <span className="text-[15px] font-bold">{s.title}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 mb-2">{s.span}</div>
                <p className="text-[13px] leading-[1.9] text-slate-300">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 会社のこと ─────────────────────────────────────────── */}
      <section className="px-5 py-14 md:py-24">
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
        </div>
      </section>

      {/* ── 相談 ───────────────────────────────────────────────── */}
      <section id="contact" className="px-5 py-16 md:py-24 border-t border-white/10 bg-[#0a1220]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-[22px] md:text-[30px] font-bold leading-[1.5] mb-4">
            困っていることから、聞かせてください。
          </h2>
          <p className="text-[14px] leading-[2] text-slate-300 mb-8">
            何を作るかが決まっていなくても構いません。
            伺ったうえで、そもそも作らないほうがよければ、そう申し上げます。
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/contact"
              className="inline-flex items-center justify-center min-h-[52px] px-8 rounded-xl bg-sky-500 text-[#06121f] font-bold hover:bg-sky-400">
              相談フォームへ
            </Link>
            <Link href="/laruHP"
              className="inline-flex items-center justify-center min-h-[52px] px-8 rounded-xl border border-white/25 font-bold hover:border-white/60">
              まずホームページから
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-5 py-10 text-center text-[12px] text-slate-500">
        <div className="flex flex-wrap gap-4 justify-center mb-4">
          <Link href="/privacy" className="hover:text-slate-300 min-h-[44px] inline-flex items-center">プライバシーポリシー</Link>
          <Link href="/terms" className="hover:text-slate-300 min-h-[44px] inline-flex items-center">利用規約</Link>
          <Link href="/laruHP/tokusho" className="hover:text-slate-300 min-h-[44px] inline-flex items-center">特定商取引法に基づく表記</Link>
          <Link href="/contact" className="hover:text-slate-300 min-h-[44px] inline-flex items-center">お問い合わせ</Link>
        </div>
        © 2026 株式会社LaruVisona
      </footer>
    </main>
  );
}
