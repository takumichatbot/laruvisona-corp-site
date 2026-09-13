import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Layers3,
  MousePointer2,
  Image as ImageIcon,
  RotateCcw,
  Smartphone,
  Globe2,
  MessageSquare,
  Search,
  Plus,
} from 'lucide-react';
import BrandFonts from '@/components/BrandFonts';
import CreationLab from '@/components/lp/CreationLab';
import HeroExperience from '@/components/lp/HeroExperience';
import { PLANS, TERMS, PRIMARY_CTA, FAQ as FACT_FAQ } from '@/lib/laruhp-facts';
import './landing.css';

export const metadata: Metadata = {
  title: 'LARU HP｜その仕事に、ふさわしいホームページを。',
  description:
    '写真と言葉から、お店や会社にふさわしいホームページへ。実際の完成像を見ながら構成・書体・写真・動きを選んで作る、LARU HP。',
  openGraph: {
    title: 'LARU HP｜その仕事に、ふさわしいホームページを。',
    description:
      '写真と言葉を選んで、完成を見ながら整える。お店にも、会社にも。',
    url: 'https://laruvisona.jp/laruHP',
    images: [{ url: '/laruHP/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    title: 'LARU HP｜その仕事に、ふさわしいホームページを。',
    description: '写真と言葉から、あなたの仕事が伝わるサイトへ。',
  },
};
const HOW_FAQ = [
  {
    q: '初めてでも作れますか？',
    a: '店名と業種、サイトで叶えたいことを入れるところから始めます。写真や文章は完成イメージを見ながら編集できます。HTMLやCSSの知識は必要ありません。',
  },
  {
    q: 'あとから、写真や文章を変えられますか？',
    a: '制作スタジオで編集し、保存して公開し直せます。変更を取り消したり、残した案と見比べたりしながら整えられます。',
  },
  {
    q: 'スマホだけでも編集できますか？',
    a: 'スマホ用の制作画面で、節の選択、写真の差し替え、文章や配色の編集、保存・公開を行えます。完成像と編集欄を切り替えて使います。',
  },
];
const features = [
  {
    icon: ImageIcon,
    title: '写真が主役になる。',
    body: '写真を入れて、いちばん見せたい位置へ。スマホとパソコン、それぞれの切り抜きまで整えられます。',
  },
  {
    icon: RotateCcw,
    title: '迷える。だから、試せる。',
    body: '色も書体も、思い切って。変更を取り消したり、残した案と並べて選んだりできます。',
  },
  {
    icon: Smartphone,
    title: 'スマホでも、手の中で。',
    body: '写真を変える。お知らせを直す。出先でも完成像を確かめて、そのまま保存・公開できます。',
  },
];

export default function LaruHPLandingPage() {
  return (
    <div className="lhp-landing">
      <BrandFonts />
      <a className="lp-skip" href="#lp-main">
        本文へ移動
      </a>
      <header className="lp-header">
        <Link
          className="lp-wordmark"
          href="/laruHP"
          aria-label="LARU HP ホーム"
        >
          LARU<span>HP</span>
          <i aria-hidden="true" />
        </Link>
        <nav aria-label="ページの案内">
          <a href="#works">作れるサイト</a>
          <a href="#experience">作り心地</a>
          <a href="#price">料金</a>
        </nav>
        <div className="lp-header-actions">
          <Link className="lp-login" href="/laruHP/auth/login">
            ログイン
          </Link>
          <Link className="lp-button lp-button-small" href="/laruHP/studio">
            作りはじめる
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      <main id="lp-main">
        <HeroExperience>
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">
              <span />
              お店にも、会社にも。自分でつくるホームページ。
            </p>
            <h1>
              <span className="lp-hero-first">その仕事に、</span>
              <span className="lp-hero-rest">
                ふさわしい
                <br />
                ホームページを。
              </span>
            </h1>
            <p className="lp-hero-lead">
              写真を選ぶ。言葉を整える。
              <br />
              あなたの仕事が伝わるサイトを、ここで。
            </p>
            <div className="lp-hero-actions">
              <Link href="/laruHP/studio" className="lp-button">
                完成を見ながら、つくる
                <ArrowUpRight size={20} />
              </Link>
              <a href="#experience" className="lp-text-link">
                まずは、触ってみる
                <ArrowRight size={18} />
              </a>
            </div>
            <p className="lp-price-hint">
              月額 <b>{PLANS[0].monthly.toLocaleString('ja-JP')}</b>{' '}
              円〜（税別）
              <span>初月無料・最低利用期間{TERMS.minimumMonths}ヶ月</span>
            </p>
          </div>
        </HeroExperience>

        <section className="lp-introduction lp-container">
          <p className="lp-section-label">
            <span>01</span>つくることを、もっと自由に。
          </p>
          <div className="lp-introduction-grid">
            <h2>
              写真も、言葉も、
              <br />
              あなたの仕事の顔になる。
            </h2>
            <p>
              色だけでなく、構成から選べます。
              <br />
              写真を大きく。説明を丁寧に。内容を選びやすく。
              <br />
              LARU HPは、完成を眺めながら
              <br className="lp-desktop-break" />
              手を動かせる制作スタジオです。
            </p>
          </div>
          <div className="lp-process-line">
            <span>
              <b>01</b>お店のことを入れる
            </span>
            <ArrowRight size={20} />
            <span>
              <b>02</b>見せ方を選ぶ
            </span>
            <ArrowRight size={20} />
            <span>
              <b>03</b>整えて、公開する
            </span>
          </div>
        </section>

        <section className="lp-experience" id="experience">
          <div className="lp-container lp-experience-grid">
            <div className="lp-experience-copy">
              <p className="lp-section-label">
                <span>02</span>まずは、触れてみて。
              </p>
              <h2>
                ひとつ選ぶ。
                <br />
                空気が、<em>変わる。</em>
              </h2>
              <p>
                書体、色、余白。
                <br />
                写真と言葉を、あなたの事業へ。
                <br />
                ここでつくった一案から、制作を続けられます。
              </p>
              <div className="lp-demo-note">
                <MousePointer2 size={19} />
                <span>
                  業種を選んで、写真と言葉を変える。
                  <br />
                  同じ内容のまま、制作スタジオへ。
                </span>
              </div>
              <a href="#studio" className="lp-text-link">
                制作スタジオも見てみる
                <ArrowRight size={17} />
              </a>
            </div>
            <div className="lp-demo-surface">
              <CreationLab />
            </div>
          </div>
        </section>

        <section id="studio" className="lp-studio-section lp-container">
          <div className="lp-section-heading">
            <div>
              <p className="lp-section-label">
                <span>03</span>思いどおりに、近づける。
              </p>
              <h2>
                完成を見ながら。
                <br />
                <em>直したい、その場所から。</em>
              </h2>
            </div>
            <p>
              写真を押したら、写真の編集へ。
              <br />
              文章を押したら、言葉の編集へ。
              <br />
              操作のたびに、あなたのサイトになっていく。
            </p>
          </div>
          <div className="lp-studio-display">
            <div className="lp-studio-top">
              <span>
                <Layers3 size={16} />
                制作スタジオ
              </span>
              <span>
                <i />
                完成像を見ながら編集
              </span>
            </div>
            <Image
              src="/lp/studio-live.webp"
              width={1200}
              height={780}
              alt="完成像と設定を並べて編集する、LARU HPの制作スタジオ"
              sizes="(max-width: 760px) 94vw, 1120px"
            />
          </div>
          <div className="lp-features">
            {features.map(({ icon: Icon, title, body }) => (
              <article key={title}>
                <Icon size={25} strokeWidth={1.5} />
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <Link className="lp-text-link" href="/laruHP/studio">
            あなたのお店で試してみる
            <ArrowUpRight size={18} />
          </Link>
        </section>

        <section className="lp-after">
          <div className="lp-container">
            <p className="lp-section-label">
              <span>04</span>公開してからも、育てていく。
            </p>
            <div className="lp-section-heading">
              <h2>
                きれいで終わらない。
                <br />
                お店の、<em>頼れる入口に。</em>
              </h2>
              <p>
                知ってもらう。相談してもらう。足を運んでもらう。
                <br />
                その先の行動につながる機能も、一緒に。
              </p>
            </div>
            <div className="lp-after-grid">
              <article>
                <MessageSquare size={24} />
                <h3>予約・問い合わせ</h3>
                <p>
                  希望日時や相談をフォームで受け付け。確認して折り返す、お店との接点をつくれます。
                </p>
                <span>予約確定型ではなく、希望受付のフォームです</span>
              </article>
              <article>
                <Globe2 size={24} />
                <h3>あなたのアドレスで</h3>
                <p>
                  サーバーとSSLは月額に含まれます。独自ドメインの接続にも対応しています。
                </p>
                <span>ドメイン取得費は別途必要です</span>
              </article>
              <article>
                <Search size={24} />
                <h3>見つけてもらう準備</h3>
                <p>
                  検索結果の説明文やサイトマップを用意。必要に応じて、AIチャットやブログも組み合わせられます。
                </p>
                <span>AIチャット・ブログは対応プランで利用できます</span>
              </article>
            </div>
          </div>
        </section>

        <section id="price" className="lp-pricing lp-container">
          <div className="lp-section-heading">
            <div>
              <p className="lp-section-label">
                <span>05</span>必要なものから、はじめよう。
              </p>
              <h2>
                あなたに合った
                <br />
                <em>ひとつのプランを。</em>
              </h2>
            </div>
            <p>
              {TERMS.firstMonthFree}。<br />
              {TERMS.taxNote}。
            </p>
          </div>
          <div className="lp-plan-grid">
            {PLANS.map((p) => (
              <article
                key={p.id}
                className={`lp-plan ${p.highlight ? 'lp-plan-featured' : ''}`}
              >
                <div className="lp-plan-heading">
                  <h3>{p.name}</h3>
                  {p.badge && <span>{p.badge}</span>}
                </div>
                <p className="lp-plan-lead">{p.lead}</p>
                <div className="lp-plan-price">
                  <strong>{p.monthly.toLocaleString('ja-JP')}</strong>
                  <span>円 / 月（税別）</span>
                </div>
                <p className="lp-plan-annual">
                  年払いなら月 {p.annualPerMonth.toLocaleString('ja-JP')} 円換算
                </p>
                <Link
                  className={`lp-button ${p.highlight ? '' : 'lp-button-outline'}`}
                  href={PRIMARY_CTA.href}
                >
                  {PRIMARY_CTA.label}
                  <ArrowUpRight size={17} />
                </Link>
                <ul>
                  {p.includes.map((f) => (
                    <li key={f}>
                      <Check size={15} />
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <div className="lp-contract">
            <p>
              {TERMS.cancelNote}。{TERMS.cancel}。
            </p>
            <p>
              {TERMS.annualNote}。{TERMS.domainNote}。{TERMS.payment}。
            </p>
            <Link href="/laruHP/plans">
              プランの詳しい内容を見る
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>

        <section className="lp-faq lp-container">
          <div>
            <p className="lp-section-label">
              <span>06</span>気になることを、先に。
            </p>
            <h2>よくある質問</h2>
            <p>
              迷ったら、お気軽に。
              <br />
              <Link href="/contact" className="lp-text-link">
                相談する
                <ArrowUpRight size={16} />
              </Link>
            </p>
          </div>
          <div>
            {[...HOW_FAQ, ...FACT_FAQ.slice(0, 3)].map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <Plus size={20} />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-final-lines" aria-hidden="true" />
          <p className="lp-section-label">あなたらしい一枚は、ここから。</p>
          <h2>
            次は、
            <br className="lp-mobile-break" />
            あなたのサイトを。
          </h2>
          <p>
            まだ、言葉になりきっていなくても。
            <br />
            作りながら、見つけていきましょう。
          </p>
          <Link className="lp-button" href="/laruHP/studio">
            自分のサイトをつくる
            <ArrowUpRight size={20} />
          </Link>
          <span className="lp-final-note">
            試作はログイン前から。保存・公開にはご契約が必要です。
          </span>
        </section>
      </main>
      <footer className="lp-footer lp-container">
        <div>
          <Link className="lp-wordmark" href="/laruHP">
            LARU<span>HP</span>
            <i aria-hidden="true" />
          </Link>
          <p>その仕事に、ふさわしいホームページを。</p>
        </div>
        <nav aria-label="フッター">
          <Link href="/">運営会社</Link>
          <Link href="/contact">お問い合わせ</Link>
          <Link href="/laruHP/terms">利用規約</Link>
          <Link href="/laruHP/privacy">プライバシー</Link>
          <Link href="/laruHP/tokusho">特定商取引法</Link>
        </nav>
        <small>© LaruVisona Inc.</small>
      </footer>
    </div>
  );
}
