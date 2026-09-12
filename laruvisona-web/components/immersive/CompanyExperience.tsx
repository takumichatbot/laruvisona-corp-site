"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MotionProvider, useMotion } from "@/components/company/motion";
import WaterScene from "./WaterScene";
import "./company.css";

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={diagonal ? "lv-arrow-diagonal" : ""}
    >
      <path d="M4 12h15M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function Logo() {
  return (
    <Link className="lv-logo" href="/" aria-label="LaruVisona ホーム">
      <Image src="/images/laruvisona_mark.svg" width={34} height={38} alt="" />
      <span>
        LaruVisona<span className="lv-logo-dot">.</span>
      </span>
    </Link>
  );
}
const products = [
  {
    id: "hp",
    name: "LARU HP",
    label: "ホームページをつくる",
    role: "自社プロダクト",
    title: (
      <>
        あなたの商いに、
        <br />
        あなたのホームページ。
      </>
    ),
    text: "写真と言葉から、事業の顔をつくる。制作から公開、その後の更新までを支えるホームページ作成サービス。",
    tags: ["ホームページ制作", "編集・公開"],
    href: "/laruHP",
    link: "LARU HPを見る",
  },
  {
    id: "bot",
    name: "LARUbot",
    label: "対話を、次の行動へ",
    role: "自社プロダクト",
    title: (
      <>
        ひとつの対話から、
        <br />
        ビジネスが動き出す。
      </>
    ),
    text: "問い合わせへの応答を、次のアクションへ。AIチャットボットを中心に、お客様との接点を支えるサービス。",
    tags: ["AIチャットボット", "問い合わせ対応"],
    href: "https://larubot.tokyo",
    link: "LARUbotを見る",
  },
  {
    id: "seo",
    name: "LARUSEO",
    label: "見つけてもらう",
    role: "開発プロダクト",
    title: (
      <>
        伝える言葉を、
        <br />
        見つかるきっかけに。
      </>
    ),
    text: "AIを活用した記事づくりで、事業の魅力を届ける。ホームページをつくった後の、情報発信と集客を支えます。",
    tags: ["AI記事制作", "情報発信"],
    href: "/contact",
    link: "LARUSEOについて相談する",
  },
  {
    id: "flastal",
    name: "FLASTAL",
    label: "想いを、花にする",
    role: "クライアントのサービス開発",
    title: (
      <>
        応援する気持ちを、
        <br />
        みんなでひとつの花に。
      </>
    ),
    text: "フラワースタンドを贈るためのクラウドファンディング。人の想いが集まるサービスの開発に取り組んでいます。",
    tags: ["クラウドファンディング", "Webサービス"],
    href: "https://www.flastal.com",
    link: "FLASTALを見る",
  },
] as const;

function ProductVisual({ id }: { id: string }) {
  if (id === "hp")
    return (
      <div className="lv-product-art lv-hp-art">
        <span className="lv-art-word" aria-hidden="true">
          つくる。
        </span>
        <div className="lv-browser">
          <div className="lv-browser-bar">
            <i />
            <i />
            <i />
            <span>LARU HP ／ 制作画面</span>
          </div>
          <Image
            src="/lp/studio-edit.jpg"
            alt="LARU HPの制作画面"
            width={1440}
            height={900}
            sizes="(max-width: 760px) 90vw, 55vw"
          />
        </div>
        <span className="lv-art-note">実際の制作画面</span>
      </div>
    );
  if (id === "bot")
    return (
      <div className="lv-product-art lv-bot-art">
        <div className="lv-dialog-orbit" aria-hidden="true" />
        <div className="lv-dialog">
          <div className="lv-dialog-head">
            <span className="lv-bot-icon">L</span>
            <span>
              LARUbot<small>あなたのビジネスを、対話で支える。</small>
            </span>
          </div>
          <p className="lv-bubble user">サービスについて知りたいです。</p>
          <p className="lv-bubble bot">
            どのようなことをお考えですか？
            <br />
            ご希望に合わせてご案内します。
          </p>
          <div className="lv-dialog-options">
            <span>サービスについて</span>
            <span>相談したい</span>
          </div>
        </div>
        <span className="lv-art-note">
          機能の紹介イメージ・実際のチャットは画面右下から
        </span>
      </div>
    );
  if (id === "seo")
    return (
      <div className="lv-product-art lv-seo-art">
        <span className="lv-art-word" aria-hidden="true">
          とどく。
        </span>
        <div className="lv-paper lv-paper-back" aria-hidden="true" />
        <div className="lv-paper">
          <span className="lv-paper-kicker">事業の言葉を、読みものに。</span>
          <h4>
            知ってほしいことが、
            <br />
            きっと、誰かの
            <br />
            <em>知りたいこと。</em>
          </h4>
          <div className="lv-text-lines" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <span className="lv-paper-footer">LARUSEO</span>
        </div>
        <span className="lv-art-note">記事制作の紹介イメージ</span>
      </div>
    );
  return (
    <div className="lv-product-art lv-flower-art">
      <svg viewBox="0 0 600 400" aria-hidden="true" className="lv-flower">
        <defs>
          <radialGradient id="lv-petal">
            <stop stopColor="#fff8ed" />
            <stop offset="1" stopColor="#e99ca5" />
          </radialGradient>
        </defs>
        {Array.from({ length: 13 }, (_, i) => {
          const x = 300 + Math.cos(i * 2.4) * Math.sqrt(i) * 39;
          const y = 175 + Math.sin(i * 2.4) * Math.sqrt(i) * 28;
          return (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path
                d={`M0 0 Q${(300 - x) * 0.5} 120 ${300 - x} ${370 - y}`}
                stroke="#71846b"
                fill="none"
                strokeWidth="2"
              />
              {Array.from({ length: 7 }, (_, j) => (
                <ellipse
                  key={j}
                  cy="-17"
                  rx="13"
                  ry="24"
                  transform={`rotate(${(j * 360) / 7})`}
                  fill="url(#lv-petal)"
                  opacity=".94"
                />
              ))}
              <circle r="8" fill="#d9b97b" />
            </g>
          );
        })}
      </svg>
      <div className="lv-flower-title">
        想いを束ねて、
        <br />
        ステージへ。
      </div>
      <span className="lv-art-note">プロダクトの紹介イメージ</span>
    </div>
  );
}
function Products({
  index,
  setIndex,
}: {
  index: number;
  setIndex: (index: number) => void;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const p = products[index];
  return (
    <section
      className="lv-products lv-solid"
      id="products"
      aria-labelledby="products-title"
    >
      <div className="lv-section-top">
        <span className="lv-index">01 — 私たちがつくるもの</span>
        <span className="lv-small-note">構想を、実際のサービスへ。</span>
      </div>
      <div className="lv-section-heading">
        <h2 id="products-title">
          アイデアで終わらない。
          <br />
          <span>動いている、その先へ。</span>
        </h2>
        <p>
          自らつくり、育てる。
          <br />
          その経験が、次の開発の力になる。
        </p>
      </div>
      <div
        className="lv-product-tabs"
        role="tablist"
        aria-label="開発プロダクト"
      >
        {products.map((p, i) => (
          <button
            key={p.id}
            ref={(e) => {
              tabs.current[i] = e;
            }}
            type="button"
            role="tab"
            id={`tab-${p.id}`}
            aria-controls={`panel-${p.id}`}
            aria-selected={i === index}
            tabIndex={i === index ? 0 : -1}
            onClick={() => setIndex(i)}
            onKeyDown={(e) => {
              let n = i;
              if (e.key === "ArrowRight") n = (i + 1) % 4;
              else if (e.key === "ArrowLeft") n = (i + 3) % 4;
              else if (e.key === "Home") n = 0;
              else if (e.key === "End") n = 3;
              else return;
              e.preventDefault();
              setIndex(n);
              tabs.current[n]?.focus();
            }}
          >
            <span className="lv-tab-number">0{i + 1}</span>
            <strong>{p.name}</strong>
            <span className="lv-tab-label">{p.label}</span>
            <span className="lv-tab-plus" aria-hidden="true">
              {i === index ? "−" : "+"}
            </span>
          </button>
        ))}
      </div>
      <div
        className="lv-product-panel"
        role="tabpanel"
        id={`panel-${p.id}`}
        aria-labelledby={`tab-${p.id}`}
        tabIndex={0}
        data-product={p.id}
      >
        <ProductVisual id={p.id} />
        <div className="lv-product-copy">
          <span className="lv-pill">{p.role}</span>
          <h3>{p.title}</h3>
          <p>{p.text}</p>
          <div className="lv-tags">
            {p.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <a href={p.href} className="lv-text-link">
            {p.link}
            <Arrow />
          </a>
        </div>
      </div>
    </section>
  );
}

const concepts = [
  {
    id: "architecture",
    label: "建築・不動産",
    brand: "凪 建築設計",
    headline: (
      <>
        風景と、
        <br />
        暮らす。
      </>
    ),
    sub: "光と余白から考える、これからの住まい。",
    description:
      "空間の美しさを、その会社の魅力へ。写真・施工例・相談までを、ひとつの体験に。",
    types: "ブランドサイト ／ 施工事例 ／ 相談導線",
  },
  {
    id: "retreat",
    label: "宿泊・観光",
    brand: "水庭の宿",
    headline: (
      <>
        何もしない、
        <br />
        という贅沢。
      </>
    ),
    sub: "森の呼吸に、こころをほどく。",
    description:
      "泊まる前から、旅が始まる。滞在の空気を伝え、施設の紹介から予約へつなぐ。",
    types: "施設サイト ／ 客室紹介 ／ 予約導線",
  },
  {
    id: "ceramics",
    label: "製造業・法人向け",
    brand: "透和ファインセラミックス",
    headline: (
      <>
        見えない精度が、
        <br />
        未来を変える。
      </>
    ),
    sub: "素材の可能性を、ひとつ先の技術へ。",
    description:
      "専門性を、伝わる強みに。製品・技術情報を整理し、必要とする企業との接点をつくる。",
    types: "企業サイト ／ 製品検索 ／ 見積もり導線",
  },
] as const;
function Concepts() {
  const [index, setIndex] = useState(0);
  const c = concepts[index];
  return (
    <section
      className="lv-concepts lv-solid"
      id="possibilities"
      aria-labelledby="concept-title"
    >
      <div className="lv-section-top">
        <span className="lv-index">02 — オーダーメイドの可能性</span>
        <span className="lv-small-note">
          あなたの事業なら、どんな姿になるだろう。
        </span>
      </div>
      <div className="lv-concept-heading">
        <h2 id="concept-title">
          事業の数だけ、
          <br />
          <span>正解は違う。</span>
        </h2>
        <div className="lv-concept-picker" aria-label="制作イメージの業種">
          {concepts.map((c, i) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            >
              <span>0{i + 1}</span>
              {c.label}
              <Arrow />
            </button>
          ))}
        </div>
      </div>
      <div className="lv-concept-frame" data-concept={c.id}>
        <Image
          src={`/company/concepts/${c.id}.webp`}
          alt={`${c.label}の架空の制作イメージに使用した生成写真`}
          width={1440}
          height={960}
          sizes="(max-width: 760px) 100vw, 90vw"
          className="lv-concept-photo"
        />
        <div className="lv-concept-scrim" />
        <div className="lv-concept-nav">
          <span>{c.brand}</span>
          <span>制作イメージ</span>
        </div>
        <div className="lv-concept-title">
          <h3>{c.headline}</h3>
          <p>{c.sub}</p>
        </div>
        <span className="lv-concept-bottom">
          {c.label}
          <span>その事業らしさを、細部まで。</span>
        </span>
      </div>
      <div className="lv-concept-caption">
        <div>
          <p>{c.description}</p>
          <span>{c.types}</span>
        </div>
        <Link href="/contact" className="lv-text-link">
          こんなサイトを相談する
          <Arrow />
        </Link>
      </div>
      <p className="lv-disclosure">
        上記は架空のブランドによる制作イメージです。生成写真を使用しており、納品実績ではありません。
      </p>
    </section>
  );
}

const services = [
  {
    n: "01",
    title: "オーダーメイドWeb制作",
    en: "魅力が伝わる。相談につながる。",
    body: "企業・店舗・ブランドの「らしさ」を、情報設計からデザイン、実装まで。目的に合わせて、一つずつつくります。",
    tags: ["コーポレートサイト", "ブランドサイト", "予約・問い合わせ"],
  },
  {
    n: "02",
    title: "Webサービス・システム開発",
    en: "アイデアを、使えるサービスに。",
    body: "新しいサービスの立ち上げから、日々の業務を支える仕組みまで。画面の使いやすさと、裏側の設計を一緒に考えます。",
    tags: ["SaaS", "プラットフォーム", "業務システム"],
  },
  {
    n: "03",
    title: "AI導入・業務の自動化",
    en: "人が向き合う時間を、もっと。",
    body: "問い合わせ対応、情報の整理、繰り返しの作業。今の仕事の流れを聞くところから、AIの活かし方を設計します。",
    tags: ["AIチャットボット", "情報活用", "外部サービス連携"],
  },
];
function Services() {
  return (
    <section
      className="lv-services lv-solid"
      id="services"
      aria-labelledby="services-title"
    >
      <div className="lv-section-top">
        <span className="lv-index">03 — あなたと、つくる</span>
        <span className="lv-small-note">デザインも、その奥の仕組みも。</span>
      </div>
      <div className="lv-section-heading">
        <h2 id="services-title">
          既製品では届かない、
          <br />
          <span>その先をつくる。</span>
        </h2>
        <p>
          自らサービスを開発する技術で、
          <br />
          あなたの構想を、事業の力に。
        </p>
      </div>
      <div className="lv-service-list">
        {services.map((s) => (
          <details key={s.n} className="lv-service">
            <summary>
              <span className="lv-service-number">{s.n}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.en}</p>
              </div>
              <span className="lv-service-plus" aria-hidden="true">
                +
              </span>
            </summary>
            <div className="lv-service-body">
              <p>{s.body}</p>
              <div className="lv-tags">
                {s.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <Link href="/services" className="lv-text-link">
                サービスと料金を見る
                <Arrow />
              </Link>
            </div>
          </details>
        ))}
      </div>
      <div className="lv-partnership">
        <span className="lv-partnership-mark" aria-hidden="true">
          ↗
        </span>
        <h3>
          話す人と、つくる人が、
          <br />
          同じであること。
        </h3>
        <div>
          <p>
            構想を聞いた開発者が、そのまま設計・実装へ。動くものを一緒に見ながら、必要なものを見極めていきます。
          </p>
          <span>
            相談・整理 <i>→</i> 設計・試作 <i>→</i> 開発・公開 <i>→</i> 改善
          </span>
        </div>
      </div>
    </section>
  );
}

function Experience() {
  const { paused, still } = useMotion();
  const root = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const [product, setProduct] = useState(0);
  useEffect(() => {
    try {
      sessionStorage.setItem("lv_intro_seen", "1");
    } catch {}
    window.dispatchEvent(new Event("lv:intro-done"));
    const reveal = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.setAttribute("data-entered", "true");
        }),
      { threshold: 0.08 },
    );
    root.current
      ?.querySelectorAll(
        ".lv-section-heading,.lv-concept-heading,.lv-partnership",
      )
      .forEach((e) => reveal.observe(e));
    return () => reveal.disconnect();
  }, []);
  useEffect(() => {
    if (paused || !root.current) return;
    const element = root.current;
    const frames = Array.from(
      element.querySelectorAll<HTMLElement>(
        ".lv-concept-frame,.lv-product-panel",
      ),
    );
    let raf = 0;
    const update = () => {
      raf = 0;
      for (const frame of frames) {
        const r = frame.getBoundingClientRect();
        if (r.top > innerHeight || r.bottom < 0) continue;
        const progress = Math.max(
          -1,
          Math.min(
            1,
            (r.top + r.height * 0.5 - innerHeight * 0.5) / innerHeight,
          ),
        );
        frame.style.setProperty("--lv-depth", String(progress));
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [paused]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menu]);
  return (
    <div
      ref={root}
      className="lv-experience"
      data-lenis-prevent
      data-paused={paused ? "true" : "false"}
    >
      <a className="lv-skip" href="#main-content">
        本文へ移動
      </a>
      <WaterScene paused={paused} reduced={still} />
      <header className="lv-header">
        <Logo />
        <nav aria-label="メインナビゲーション" className="lv-desktop-nav">
          <a href="#products">プロダクト</a>
          <a href="#services">制作・開発</a>
          <a href="#company">会社について</a>
        </nav>
        <Link className="lv-header-contact" href="/contact">
          相談する
          <Arrow diagonal />
        </Link>
        <button
          ref={menuButton}
          className="lv-menu-toggle"
          aria-label={menu ? "メニューを閉じる" : "メニューを開く"}
          aria-expanded={menu}
          aria-controls="lv-mobile-nav"
          onClick={() => setMenu(!menu)}
        >
          <span />
          <span />
        </button>
        {menu && (
          <nav
            className="lv-mobile-nav"
            id="lv-mobile-nav"
            aria-label="スマホナビゲーション"
          >
            {[
              ["#products", "プロダクト"],
              ["#possibilities", "つくれるもの"],
              ["#services", "制作・開発"],
              ["#company", "会社について"],
            ].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenu(false)}>
                {label}
                <Arrow />
              </a>
            ))}
          </nav>
        )}
      </header>
      <main id="main-content">
        <section
          className="lv-hero"
          id="lv-opening"
          aria-labelledby="hero-title"
        >
          <div className="lv-hero-glow" aria-hidden="true" />
          <div className="lv-hero-rings" aria-hidden="true" />
          <div className="lv-hero-copy">
            <p className="lv-eyebrow">
              <span />
              構想から、デザインと実装へ。
            </p>
            <h1 id="hero-title">
              想像に、
              <br />
              <span>輪郭を。</span>
            </h1>
            <p className="lv-hero-description">
              まだない価値を、使えるかたちに。
              <br />
              自らサービスをつくる私たちが、
              <br className="lv-mobile-only" />
              あなたの事業も、ともにつくる。
            </p>
            <div className="lv-hero-actions">
              <Link href="/contact" className="lv-button">
                制作・開発を相談する
                <Arrow diagonal />
              </Link>
              <a href="#products" className="lv-hero-secondary">
                私たちがつくるもの<span>↓</span>
              </a>
            </div>
          </div>
          <div className="lv-hero-side" aria-hidden="true">
            <span>株式会社LaruVisona</span>
            <i />
            <span>想像を、実装する。</span>
          </div>
          <div className="lv-hero-foot">
            <span>Web制作・AI・システム開発</span>
            <a href="#products">
              下へスクロール<span>↓</span>
            </a>
            <span>東京から、その先へ。</span>
          </div>
        </section>
        <div className="lv-product-ribbon lv-solid">
          <p>
            私たちが開発する
            <br />
            <strong>4つのプロダクト</strong>
          </p>
          {products.map((p, i) => (
            <a key={p.id} href="#products" onClick={() => setProduct(i)}>
              <sup>0{i + 1}</sup>
              {p.name}
            </a>
          ))}
        </div>
        <Products index={product} setIndex={setProduct} />
        <Concepts />
        <Services />
        <section
          className="lv-contact"
          id="lv-contact"
          aria-labelledby="contact-title"
        >
          <div className="lv-contact-glow" aria-hidden="true" />
          <div className="lv-contact-copy">
            <span className="lv-index">04 — 次は、あなたの構想を。</span>
            <h2 id="contact-title">
              まだ、
              <br />
              言葉にならない
              <br />
              <span>ところから。</span>
            </h2>
            <p>
              こんなこと、できるだろうか。
              <br />
              そのひと言が、始まりです。
            </p>
            <Link href="/contact" className="lv-button">
              制作・開発を相談する
              <Arrow diagonal />
            </Link>
            <Link className="lv-contact-sub" href="/services">
              サービス・料金の目安を見る
              <Arrow />
            </Link>
          </div>
        </section>
        <section className="lv-company lv-solid" id="company">
          <div>
            <Logo />
            <p>想像を、実装する。</p>
          </div>
          <dl>
            <div>
              <dt>会社名</dt>
              <dd>株式会社LaruVisona</dd>
            </div>
            <div>
              <dt>代表</dt>
              <dd>齋藤 匠</dd>
            </div>
            <div>
              <dt>事業</dt>
              <dd>
                Web制作・AI／システム開発
                <br />
                プロダクトの企画・開発
              </dd>
            </div>
            <div>
              <dt>本店</dt>
              <dd>東京都板橋区南常盤台1丁目11-6-101号室</dd>
            </div>
          </dl>
        </section>
      </main>
      <footer className="lv-footer lv-solid">
        <span>© {new Date().getFullYear()} LaruVisona Inc.</span>
        <nav aria-label="フッターナビゲーション">
          <Link href="/privacy">プライバシーポリシー</Link>
          <Link href="/contact">お問い合わせ</Link>
          <Link href="/brand">ロゴについて</Link>
        </nav>
        <a href="#lv-opening" className="lv-to-top" aria-label="ページの先頭へ">
          ↑
        </a>
      </footer>
    </div>
  );
}
export default function CompanyExperience() {
  return (
    <MotionProvider>
      <Experience />
    </MotionProvider>
  );
}
