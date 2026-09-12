import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import BrandFonts from '@/components/BrandFonts';
import { MARK, MARK_VIEWBOX, BRAND_GRADIENT } from '@/components/company/mark';

/**
 * ロゴについて。
 *
 * 会社トップから説明を外し、独立したページにした。
 *   ・トップの冒頭は「一画面の主役は一つ」。しるしの由来を並べると主役が二つになる
 *   ・ロゴの意味・配色・使い方を探している人は、それ自体を探して来る
 *
 * 書いているのは、実際の資産から読み取れることと、決めごとだけ。
 * 粒の数・並び・配色は public/images/laruvisona_mark.svg と同じ値を
 * components/company/mark.ts から読んでいる（文章と絵が食い違わないように）。
 */
export const metadata: Metadata = {
  title: 'ロゴについて | 株式会社LaruVisona',
  description:
    '株式会社LaruVisonaのロゴのかたち・配色・使い方。粒の並びと色の決まり、ロゴデータの配布、使うときの決めごとと、わたしたちがこの形に重ねている意味をまとめています。',
  alternates: { canonical: 'https://laruvisona.jp/brand' },
  openGraph: {
    title: 'ロゴについて | 株式会社LaruVisona',
    description: '株式会社LaruVisonaのロゴの意味と、かたち・配色・使い方。',
    url: 'https://laruvisona.jp/brand',
    siteName: 'LaruVisona',
    locale: 'ja_JP',
    type: 'article',
  },
};

/** 粒の並びを、資産の値から言葉にする（数え違いが起きないように） */
const COLUMN = MARK.filter(([x, , r]) => x === 280 && r === 62).length;
const BASE_ROW = MARK.filter(([, y, r]) => y === 850 && r === 62).length;
const TRAIL = MARK.filter(([, , r]) => r < 62).length;

const RULES: Array<{ title: string; body: string }> = [
  {
    title: '粒を足さない、減らさない',
    body: `粒は全部で${MARK.length}個です。数や並びを変えると、別のしるしになります。`,
  },
  {
    title: '色を置き換えない',
    body: '単色で使う必要があるときは、白か黒のどちらかにします。別の色には置き換えません。',
  },
  {
    title: '傾けない、伸ばさない',
    body: '回転・変形はしません。大きさを変えるときは縦横の比率を保ちます。',
  },
  {
    title: 'まわりを空ける',
    body: 'ロゴの上下左右に、いちばん大きな粒ひとつ分以上の余白をとります。文字や写真を寄せません。',
  },
  {
    title: '小さくしすぎない',
    body: 'マークだけなら高さ20px、社名と組み合わせた形なら高さ16pxを下限にします。',
  },
  {
    title: '社名を別の書体で書き足さない',
    body: '「LaruVisona」を並べるときは、配布している組み合わせの画像をそのまま使います。',
  },
];

const FILES = [
  { name: '暗い地の上で使う（ロゴ＋社名）', href: '/images/logo_dark.png', note: 'PNG / 1300×375' },
  { name: '明るい地の上で使う（ロゴ＋社名）', href: '/images/logo_light.png', note: 'PNG / 1300×375' },
  { name: 'マークだけ（拡大しても荒れない形式）', href: '/images/laruvisona_mark.svg', note: 'SVG' },
];

export default function BrandPage() {
  return (
    <main className="bg-[#04080f] text-slate-100 min-h-screen">
      <BrandFonts />

      <header className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-5 md:px-8 h-14 md:h-16 flex items-center justify-between gap-4">
          <Link href="/" aria-label="株式会社LaruVisona トップ" className="flex items-center shrink-0">
            <Image src="/images/logo_dark.png" alt="LaruVisona" width={1300} height={375} priority sizes="240px"
              className="h-6 md:h-7 w-auto" />
          </Link>
          <Link href="/#contact"
            className="inline-flex items-center min-h-[40px] px-4 rounded-full border border-white/25 text-[12px] md:text-[13px] font-bold
              hover:border-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            相談する
          </Link>
        </div>
      </header>

      {/* 意味 */}
      <section className="px-5 md:px-8 pt-16 md:pt-24 pb-14 md:pb-20">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-10 lg:gap-16 items-center">
          <div>
            <p className="text-[10px] md:text-[11px] font-bold tracking-[0.22em] text-sky-300/80 mb-5">
              LOGO / しるしについて
            </p>
            <h1 className="text-[clamp(28px,7vw,34px)] md:text-[clamp(34px,3.2vw,44px)] font-bold
              leading-[1.42] tracking-[-0.015em] mb-6">
              粒が集まって、
              <br />
              かたちになる。
            </h1>
            <p className="text-[15px] md:text-[17px] leading-[2] text-slate-300 max-w-[26em] [word-break:auto-phrase]">
              株式会社LaruVisona のしるしは、{MARK.length}個の粒でできています。
              積み上がった粒と、そこから立ち上がっていく粒。
              わたしたちはこの形に、<strong className="font-bold text-slate-100">小さなものを集めて、使えるものにしていく</strong>
              という仕事のしかたを重ねています。
            </p>
            <p className="mt-5 text-[13px] leading-[1.95] text-slate-400 max-w-[26em] [word-break:auto-phrase]">
              これは、わたしたちがこの形をどう受け取っているかという話です。
            </p>
          </div>

          {/* 実物のマーク。文章の隣に、同じ値から描いたものを置く */}
          <div className="relative rounded-3xl border border-white/10 bg-[#070e18] p-10 md:p-14 flex justify-center">
            <svg viewBox={MARK_VIEWBOX} role="img" aria-label="LaruVisona のマーク"
              className="h-[220px] md:h-[280px] w-auto">
              <defs>
                <linearGradient id="lv-brand-page" gradientUnits="userSpaceOnUse"
                  x1={BRAND_GRADIENT.x1} y1={BRAND_GRADIENT.y1} x2={BRAND_GRADIENT.x2} y2={BRAND_GRADIENT.y2}>
                  <stop offset="0" stopColor={BRAND_GRADIENT.from} />
                  <stop offset="1" stopColor={BRAND_GRADIENT.to} />
                </linearGradient>
              </defs>
              {MARK.map(([cx, cy, r], i) => (
                <circle key={i} cx={cx} cy={cy} r={r} fill="url(#lv-brand-page)" />
              ))}
            </svg>
          </div>
        </div>
      </section>

      {/* かたち */}
      <section className="px-5 md:px-8 py-14 md:py-20 border-t border-white/10 bg-[#070e18]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[26px] font-bold mb-3">かたち</h2>
          <p className="text-[15px] leading-[2] text-slate-300 max-w-[28em] mb-4 [word-break:auto-phrase]">
            粒は全部で{MARK.length}個。{COLUMN}つが縦に並び、その足元に{BASE_ROW}つ。
            そこから{TRAIL}つが、小さくなりながら右上へ立ち上がります。
          </p>
          <p className="text-[13px] leading-[1.95] text-slate-400 max-w-[28em] mb-10 [word-break:auto-phrase]">
            以下は、この並びにわたしたちが重ねている読み方です。
          </p>
          <dl className="grid sm:grid-cols-3 gap-8">
            <div>
              <dt className="text-[12px] font-bold text-sky-300/80 mb-2">縦の並び</dt>
              <dd className="text-[14px] leading-[1.95] text-slate-300">
                同じ大きさの粒が{COLUMN}つ。ここまで積み上げてきたものと読んでいます。
              </dd>
            </div>
            <div>
              <dt className="text-[12px] font-bold text-sky-300/80 mb-2">足元の並び</dt>
              <dd className="text-[14px] leading-[1.95] text-slate-300">
                横に{BASE_ROW}つ。全体を支える土台と読んでいます。
              </dd>
            </div>
            <div>
              <dt className="text-[12px] font-bold text-sky-300/80 mb-2">立ち上がる粒</dt>
              <dd className="text-[14px] leading-[1.95] text-slate-300">
                {TRAIL}つが小さくなりながら上へ。これから作るものと読んでいます。
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* 色 */}
      <section className="px-5 md:px-8 py-14 md:py-20 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[26px] font-bold mb-3">色</h2>
          <p className="text-[15px] leading-[2] text-slate-300 max-w-[28em] mb-10 [word-break:auto-phrase]">
            左下から右上へ、濃い青から淡い青へ移ります。水に光が入るところの色です。
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { label: '濃い青（起点）', code: BRAND_GRADIENT.from, ink: '#04080f' },
              { label: '淡い青（終点）', code: BRAND_GRADIENT.to, ink: '#04080f' },
              { label: '地の色（暗い）', code: '#04080f', ink: '#e2e8f0' },
              { label: '地の色（明るい）', code: '#F4F6F8', ink: '#04080f' },
            ].map(c => (
              <div key={c.code} className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="h-24" style={{ background: c.code }} />
                <div className="p-4">
                  <div className="text-[13px] font-bold mb-1">{c.label}</div>
                  <div className="text-[12px] text-slate-400 font-mono">{c.code}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 使うとき */}
      <section className="px-5 md:px-8 py-14 md:py-20 border-t border-white/10 bg-[#070e18]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[26px] font-bold mb-3">使うときの決めごと</h2>
          <p className="text-[15px] leading-[2] text-slate-300 max-w-[28em] mb-10 [word-break:auto-phrase]">
            どこで見ても同じしるしに見えるように、次のことをお願いしています。
          </p>
          <ul className="grid sm:grid-cols-2 gap-x-10 gap-y-7">
            {RULES.map((r, i) => (
              <li key={r.title} className="border-t border-white/15 pt-4">
                <div className="flex items-baseline gap-3 mb-1.5">
                  <span className="text-[12px] font-bold text-sky-300/80 tabular-nums">0{i + 1}</span>
                  <h3 className="text-[15px] md:text-[16px] font-bold">{r.title}</h3>
                </div>
                <p className="text-[14px] leading-[1.95] text-slate-300 [word-break:auto-phrase]">{r.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* データ */}
      <section className="px-5 md:px-8 py-14 md:py-20 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[20px] md:text-[26px] font-bold mb-3">ロゴデータ</h2>
          <p className="text-[15px] leading-[2] text-slate-300 max-w-[28em] mb-8 [word-break:auto-phrase]">
            紹介記事や資料に載せていただくときは、こちらをお使いください。
          </p>
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {FILES.map(f => (
              <li key={f.href}>
                <a href={f.href} target="_blank" rel="noopener"
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5 min-h-[56px]
                    hover:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                  <span className="text-[15px] font-bold">{f.name}</span>
                  <span className="text-[12px] text-slate-400">{f.note} を開く →</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[12px] leading-[1.9] text-slate-500 [word-break:auto-phrase]">
            ロゴは株式会社LaruVisonaのものです。当社・当社サービスを指す目的でお使いください。
            加工したものや、当社が関わっていると誤解される使い方はご遠慮ください。判断に迷うときはご相談ください。
          </p>
        </div>
      </section>

      {/* 戻り道 */}
      <section className="px-5 md:px-8 py-16 md:py-24 border-t border-white/10">
        <div className="max-w-5xl mx-auto flex flex-wrap gap-3">
          <Link href="/"
            className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-xl bg-white text-[#04101c] font-bold hover:bg-slate-200
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            会社のトップへ
          </Link>
          <Link href="/#company"
            className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-xl border border-white/25 font-bold hover:border-white/60
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            会社のことを見る
          </Link>
          <Link href="/contact"
            className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-xl border border-white/25 font-bold hover:border-white/60
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            お問い合わせ
          </Link>
        </div>
      </section>

      <footer className="px-5 md:px-8 py-10 text-center text-[12px] text-slate-500 border-t border-white/10">
        © 2026 株式会社LaruVisona
      </footer>
    </main>
  );
}
