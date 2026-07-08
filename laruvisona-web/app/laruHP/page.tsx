'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const LaruHPScene = dynamic(() => import('@/components/Canvas/LaruHPScene'), { ssr: false });

// ショーケースのモックに、業種画像ライブラリ(AI生成)の実写を敷くための公開URL。
// 管理者が /api/admin/generate-image-library を実行するとプールされる。
// 未生成の間は画像が404し、下地のグラデーションがそのまま見える（＝グレースフル）。
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const libHero = (industry: string) =>
  SUPA_URL ? `${SUPA_URL}/storage/v1/object/public/site-images/library/${industry}/hero/0.webp` : '';
const libGallery = (industry: string, n: number) =>
  SUPA_URL ? `${SUPA_URL}/storage/v1/object/public/site-images/library/${industry}/gallery/${n}.webp` : '';
// 画像が404(ライブラリ未生成)なら消して下地グラデを見せる
const hideOnError = (e: { currentTarget: HTMLImageElement }) => { e.currentTarget.style.display = 'none'; };

const INDUSTRIES = [
  { color: 'from-orange-900/60 to-red-900/60',   name: '飲食店・カフェ', id: 'restaurant' },
  { color: 'from-pink-900/60 to-purple-900/60',  name: '美容室・サロン', id: 'beauty' },
  { color: 'from-blue-900/60 to-teal-900/60',    name: '整体・クリニック', id: 'clinic' },
  { color: 'from-slate-800/80 to-slate-900',     name: '士業・コンサル', id: 'legal' },
  { color: 'from-amber-900/60 to-yellow-900/60', name: '建設・工務店', id: 'construction' },
  { color: 'from-emerald-900/60 to-green-900/60',name: '不動産', id: 'realestate' },
  { color: 'from-violet-900/60 to-purple-900/60',name: '小売・EC', id: 'retail' },
  { color: 'from-red-900/60 to-orange-900/60',   name: 'フィットネス', id: 'fitness' },
  { color: 'from-sky-900/60 to-blue-900/60',     name: 'ホテル・旅館', id: 'hotel' },
  { color: 'from-indigo-900/60 to-blue-900/60',  name: '教育・スクール', id: 'education' },
  { color: 'from-rose-900/60 to-pink-900/60',    name: 'ウェディング', id: 'wedding' },
  { color: 'from-amber-900/60 to-stone-900/60',  name: 'ペットサロン', id: 'pet' },
  { color: 'from-sky-900/60 to-cyan-900/60',     name: '歯科クリニック', id: 'dental' },
  { color: 'from-stone-800/80 to-gray-900',      name: 'フォトスタジオ', id: 'photo' },
  { color: 'from-blue-900/60 to-slate-900/60',   name: '税理士・会計士', id: 'accounting' },
];

const FEATURES = [
  { num: '01', title: 'AI自動コンテンツ生成',       desc: '業種と情報を入力するだけ。AIが魅力的なコピーと最適なレイアウトを自動生成します。',                                                           color: 'blue' },
  { num: '02', title: '直感的なビジュアルエディタ', desc: 'プログラミング不要。ブロックを追加・編集するだけでプロ品質のサイトに。画像・テキスト・カラム何でも対応。',                             color: 'purple' },
  { num: '03', title: 'SEO最大化エンジン',           desc: 'メタタグ・構造化データ・ページ速度最適化を自動設定。業種別JSON-LDスキーマで検索上位表示を狙います。',                                        color: 'green' },
  { num: '04', title: 'LARUbot ワンクリック連携',    desc: 'AIチャットボット「LARUbot」をエディタからワンクリックで埋め込み。24時間問い合わせ対応を自動化。',                                             color: 'indigo' },
  { num: '05', title: 'CRM パイプライン管理',         desc: '問い合わせをカンバン方式で管理。「未対応→対応中→成約→NG」のステータスでリード漏れをゼロに。',                                              color: 'emerald' },
  { num: '06', title: '予約枠カレンダー管理',         desc: '空き枠を管理者が設定。訪問者がカレンダーから予約→管理画面で一元管理。自動メール通知付き。',                                               color: 'cyan' },
  { num: '07', title: 'エージェンシーモード',          desc: '複数クライアントサイトを1アカウントで管理。PV・問い合わせ・公開状況をまとめて確認。',                                                    color: 'blue' },
  { num: '08', title: 'マルチページ対応',             desc: '「トップ」「会社概要」「アクセス」など複数ページを作成可能。ナビゲーションバーも自動生成。',                                                   color: 'purple' },
];

const PLAN_ANNUAL_PRICE: Record<string, number> = { hp: 833, 'hp-bot': 4150, 'hp-bot-seo': 8166 };

const PLANS = [
  {
    id: 'hp',
    name: 'HP単体',
    price: 999,
    sub: 'ホームページ作成・公開',
    badge: null,
    highlight: false,
    features: [
      'HP作成・公開',
      'AIコンテンツ生成',
      'ビジュアルエディタ',
      'SEO自動最適化',
      '独自ドメイン対応',
      'SSL・サーバー費用込み',
      'Google Analytics連携',
      'お問い合わせフォーム',
      'メールサポート',
    ],
    missing: [
      'LARUbot AIチャットボット',
      'LARUSEO AIブログ',
    ],
  },
  {
    id: 'hp-bot',
    name: 'HP + LARUbot',
    price: 4980,
    sub: 'HP + AIチャットボット',
    badge: 'おすすめ',
    highlight: true,
    features: [
      'HP作成・公開',
      'AIコンテンツ生成',
      'ビジュアルエディタ',
      'SEO自動最適化',
      'LARUbot AIチャットボット',
      '独自ドメイン対応',
      'SSL・サーバー費用込み',
      'Google Analytics連携',
      'お問い合わせフォーム',
      'チャットサポート',
    ],
    missing: [
      'LARUSEO AIブログ',
    ],
  },
  {
    id: 'hp-bot-seo',
    name: 'HP + Bot + SEO',
    price: 9800,
    sub: 'HP + Bot + AIブログSEO',
    badge: '半年間限定',
    highlight: false,
    features: [
      'HP作成・公開',
      'AIコンテンツ生成',
      'ビジュアルエディタ',
      'SEO自動最適化',
      'LARUbot AIチャットボット',
      'LARUSEO AIブログ',
      '独自ドメイン対応',
      'SSL・サーバー費用込み',
      'Google Analytics連携',
      'お問い合わせフォーム',
      '優先サポート',
    ],
    missing: [],
  },
];

const FAQ_ITEMS = [
  {
    q: '初月無料とはどういう意味ですか？',
    a: '最初の月のご利用料金が0円（無料）となります。2ヶ月目からは通常の月額999円（税別）となります。最低ご利用期間は6ヶ月となりますので、7ヶ月目からは月単位でいつでも解約可能です。',
  },
  {
    q: 'サーバー費用は別途かかりますか？',
    a: '月額999円の中にサーバー利用料・laruvisona.jpサブドメイン・SSL証明書がすべて含まれています。独自ドメインをご希望の場合は別途ドメイン取得費用（年間約1,000〜2,000円）が必要です。',
  },
  {
    q: 'HTMLやCSSの知識が必要ですか？',
    a: '一切不要です。ビジュアルエディタで直感的に編集できます。テキストのクリック編集、画像のアップロード、ブロックの追加・削除など、すべてマウス操作で完結します。',
  },
  {
    q: 'LARUbotとはどうやって連携しますか？',
    a: 'エディタ内の「連携設定」からLARUbotアカウントと接続するだけです。わずか3クリックでAIチャットボットがあなたのサイトに導入されます。',
  },
  {
    q: '作成したサイトのSEO効果は？',
    a: '業種別の構造化データ（JSON-LD）、最適化されたメタタグ、Core Web Vitals対応のページ構成が自動で設定されます。LARUSEO連携でキーワード分析やSEOスコアの確認・改善もできます。',
  },
  {
    q: '6ヶ月の最低契約期間中に解約したい場合は？',
    a: '6ヶ月の最低契約期間中は解約できません。7ヶ月目以降は翌月末までに解約申請いただければ、翌月から課金が停止されます。',
  },
  {
    q: '年払いプランはありますか？',
    a: '料金プランページで月払い/年払いを選択できます。年払いは実質2ヶ月分無料でお得です（例：HPプランは年払いで月833円換算）。年払いは一括請求となり、途中解約時の返金はありません。',
  },
];

const COLOR_MAP: Record<string, string> = {
  blue: 'border-blue-200 bg-blue-50',
  purple: 'border-purple-200 bg-purple-50',
  green: 'border-green-200 bg-green-50',
  indigo: 'border-indigo-200 bg-indigo-50',
  emerald: 'border-emerald-200 bg-emerald-50',
  cyan: 'border-cyan-200 bg-cyan-50',
};

const COLOR_NUM: Record<string, string> = {
  blue: 'text-blue-400', purple: 'text-purple-400', green: 'text-green-400',
  indigo: 'text-indigo-400', emerald: 'text-emerald-400', cyan: 'text-cyan-400',
};

export default function LaruHPLandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeIndustry, setActiveIndustry] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [annualPricing, setAnnualPricing] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndustry(prev => (prev + 1) % INDUSTRIES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    // Hero entrance
    const tl = gsap.timeline({ delay: 0.1 });
    tl.fromTo('.lp-hero-badge',
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' })
     .fromTo('.lp-hero-h1 span',
      { y: 56, opacity: 0, skewY: 4 },
      { y: 0, opacity: 1, skewY: 0, duration: 0.85, stagger: 0.15, ease: 'power4.out' }, '-=0.35')
     .fromTo('.lp-hero-sub',
      { y: 28, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.65, ease: 'power3.out' }, '-=0.4')
     .fromTo('.lp-hero-cta',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power3.out' }, '-=0.35')
     .fromTo('.lp-hero-tags span',
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, stagger: 0.07, ease: 'power2.out' }, '-=0.2');

    // Scroll fade-up
    gsap.utils.toArray<Element>('.lp-fade-up').forEach(el => {
      gsap.fromTo(el,
        { y: 64, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.85, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 87%', toggleActions: 'play none none none' } });
    });

    // Stagger children
    gsap.utils.toArray<Element>('.lp-stagger').forEach(parent => {
      gsap.fromTo(parent.querySelectorAll(':scope > *'),
        { y: 44, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, stagger: 0.12, ease: 'power3.out',
          scrollTrigger: { trigger: parent, start: 'top 82%', toggleActions: 'play none none none' } });
    });

    // Stats count-up
    gsap.utils.toArray<HTMLElement>('.lp-stat-num').forEach(el => {
      const target = el.textContent ?? '';
      ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: () => { el.style.opacity = '1'; gsap.fromTo(el, { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.7)' }); },
      });
    });

    return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, []);

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900 overflow-x-hidden">

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-sky-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/laruhp_logo.png" alt="LARU HP" height={32} width={160} className="h-8 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-gray-500">
            <a href="#features" className="hover:text-gray-900 transition-colors">機能</a>
            <a href="#templates" className="hover:text-gray-900 transition-colors">テンプレート</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">料金</a>
            <a href="#faq" className="hover:text-gray-900 transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link href="/laruHP/auth/login" className="hidden md:block text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-sky-300 px-4 py-2 rounded-xl text-sm transition-all">
              ログイン
            </Link>
            <Link href="/laruHP/onboarding" className="bg-sky-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-sky-500 transition-all whitespace-nowrap">
              初月無料で始める →
            </Link>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`md:hidden flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-xl border transition-all active:scale-95 ${isMenuOpen ? 'bg-sky-600 border-sky-500 text-white' : 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100'}`}
              aria-label={isMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-nav"
            >
              <div className="relative w-5 h-4 flex flex-col justify-between" aria-hidden="true">
                <span className={`block h-[2px] rounded-full bg-current transition-all duration-300 origin-center ${isMenuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} style={{ width: '100%' }} />
                <span className={`block h-[2px] rounded-full bg-current transition-all duration-300 ${isMenuOpen ? 'opacity-0 scale-x-0' : ''}`} style={{ width: '100%' }} />
                <span className={`block h-[2px] rounded-full bg-current transition-all duration-300 origin-center ${isMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} style={{ width: isMenuOpen ? '100%' : '70%' }} />
              </div>
              <span className="text-[9px] font-bold tracking-widest leading-none">
                {isMenuOpen ? 'CLOSE' : 'MENU'}
              </span>
            </button>
          </div>
        </div>
        {isMenuOpen && (
          <div id="mobile-nav" className="md:hidden absolute top-full left-0 w-full bg-white border-b border-sky-100 shadow-lg px-6 py-4 flex flex-col gap-1">
            <a href="#features" onClick={() => setIsMenuOpen(false)} className="text-gray-600 hover:text-sky-700 py-3 border-b border-gray-100">機能</a>
            <a href="#templates" onClick={() => setIsMenuOpen(false)} className="text-gray-600 hover:text-sky-700 py-3 border-b border-gray-100">テンプレート</a>
            <a href="#pricing" onClick={() => setIsMenuOpen(false)} className="text-gray-600 hover:text-sky-700 py-3 border-b border-gray-100">料金</a>
            <a href="#faq" onClick={() => setIsMenuOpen(false)} className="text-gray-600 hover:text-sky-700 py-3 border-b border-gray-100">FAQ</a>
            <div className="flex gap-3 pt-4">
              <Link href="/laruHP/auth/login" onClick={() => setIsMenuOpen(false)} className="flex-1 text-center border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium">
                ログイン
              </Link>
              <Link href="/laruHP/onboarding" onClick={() => setIsMenuOpen(false)} className="flex-1 text-center bg-sky-600 text-white py-3 rounded-xl text-sm font-semibold">
                初月無料で始める
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section ref={heroRef} className="pt-28 md:pt-36 pb-16 md:pb-28 px-6 text-center relative overflow-hidden">
        {/* 3D scene background */}
        <LaruHPScene />

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.12),transparent_65%)]" />
          <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full bg-sky-400/8 blur-3xl" />
          <div className="absolute top-32 right-1/4 w-56 h-56 rounded-full bg-sky-300/8 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(#0284c7 1px,transparent 1px),linear-gradient(90deg,#0284c7 1px,transparent 1px)', backgroundSize: '80px 80px' }} />
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="lp-hero-badge inline-flex items-center gap-2.5 bg-sky-100/90 backdrop-blur-sm border border-sky-300 px-5 py-2.5 rounded-full text-sky-700 text-xs font-medium tracking-widest mb-10 shadow-[0_0_30px_rgba(14,165,233,0.15)]" style={{ opacity: 0 }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-500/75 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-600" />
            </span>
            新登場 — AI搭載 HPビルダー 2026
          </div>

          <h1 className="lp-hero-h1 text-[2.8rem] sm:text-6xl md:text-[6.5rem] font-bold tracking-tighter mb-6 leading-[1.05] md:leading-[1.02]">
            <span className="block text-gray-900" style={{ opacity: 0 }}>最高のHPを、</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" style={{ opacity: 0 }}>
              最短5分で。
            </span>
          </h1>

          <p className="lp-hero-sub text-slate-700 text-base md:text-xl mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed font-normal" style={{ opacity: 0 }}>
            業種情報を入力するだけ。AIが<strong className="text-sky-700 font-semibold">5分以内</strong>にプロ品質のホームページを自動生成。<br className="hidden md:block" />
            SEO・LARUbot連携・ビジュアル編集がすべて月額<strong className="text-sky-700 font-semibold">999円</strong>。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
            <Link href="/laruHP/onboarding"
              className="lp-hero-cta relative bg-sky-600 text-white px-9 py-4 rounded-2xl font-bold text-base hover:scale-105 transition-transform shadow-[0_4px_20px_rgba(2,132,199,0.3)] flex items-center gap-3 w-full sm:w-auto justify-center overflow-hidden group"
              style={{ opacity: 0 }}>
              <span className="absolute inset-0 bg-gradient-to-r from-sky-500 to-sky-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative">無料で始める（初月無料）</span>
              <span className="relative text-white font-bold">→</span>
            </Link>
            <Link href="/laruHP/demo"
              className="lp-hero-cta text-sky-700 hover:text-sky-800 px-9 py-4 rounded-2xl font-bold text-base border-2 border-sky-600 bg-white hover:bg-sky-50 transition-all flex items-center gap-2.5 w-full sm:w-auto justify-center"
              style={{ opacity: 0 }}>
              <span className="text-sky-600">▶</span> デモを体験
            </Link>
          </div>
          <p className="text-slate-600 text-xs">初月無料 → 月額999円（税別）/ 最低6ヶ月 / クレジットカード決済</p>
          <p className="text-slate-600 text-xs mt-2">
            既にアカウントをお持ちの方は{' '}
            <Link href="/laruHP/auth/login" className="text-blue-500 hover:text-blue-400 underline underline-offset-2">ログイン</Link>
          </p>

          <div className="lp-hero-tags hidden md:flex justify-center gap-3 mt-8 flex-wrap">
            {['AI コンテンツ生成', 'SEO 自動最適化', 'LARUbot 連携', 'モバイル完全対応', 'SSL 込み'].map((tag, i) => (
              <span key={i} className="bg-white/80 backdrop-blur-sm border border-sky-100 text-gray-500 text-xs px-3 py-1.5 rounded-full hover:border-sky-200 hover:text-gray-700 transition-all" style={{ opacity: 0 }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="max-w-3xl mx-auto mt-10 md:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { num: '5分', label: 'でサイト完成', sub: 'AI自動生成' },
            { num: '15', label: '業種テンプレート', sub: '全業種対応' },
            { num: '¥999〜', label: '/月（初月無料）', sub: '税別' },
            { num: '100%', label: 'SEO自動化', sub: 'AI最適化' },
          ].map((stat, i) => (
            <div key={i} className="lp-stat-num relative bg-white border border-sky-100 rounded-2xl p-5 text-center shadow-sm hover:border-sky-200 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
              <div className="text-2xl md:text-3xl font-bold text-sky-700">{stat.num}</div>
              <div className="text-xs text-gray-600 font-medium mt-1">{stat.label}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 md:py-24 px-6 border-t border-sky-100 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="lp-fade-up text-center mb-16">
            <span className="text-sky-600 font-medium text-xs tracking-[0.2em]">使い方</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3 text-gray-900">3ステップで完成</h2>
            <p className="text-gray-500 text-sm">業種情報を入力するだけ。5分でプロ品質のHPが完成します</p>
          </div>
          <div className="lp-stagger grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-12 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-[1px] bg-gradient-to-r from-sky-300/40 via-sky-300/20 to-sky-300/40" />
            {[
              { step: '01', title: '情報を入力',    desc: '業種・店舗名・住所・サービス内容などを入力。AIが残りを全部やってくれます。',                                       tag: '約2分' },
              { step: '02', title: 'AIが自動生成',  desc: '業種に最適化されたテンプレートにビジネス情報を組み込み、コンテンツを自動作成。',                                   tag: '約1分' },
              { step: '03', title: 'エディタで仕上げ', desc: 'ビジュアルエディタで微調整。画像変更・テキスト編集・ブロック追加削除が直感的に。',                             tag: '約2分' },
            ].map((step, i) => (
              <div key={i} className="relative bg-sky-50 border border-sky-100 rounded-2xl p-8 hover:border-sky-300 hover:bg-white hover:-translate-y-1 transition-all duration-300 shadow-sm">
                <div className="absolute top-4 right-4 bg-sky-100 text-sky-600 text-[10px] font-medium px-2 py-1 rounded-full">{step.tag}</div>
                <div className="text-5xl font-bold mb-4 leading-none font-mono text-sky-300">{step.step}</div>
                <div className="text-sky-500 font-medium text-[10px] tracking-[0.2em] mb-2">ステップ {step.step}</div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before / After comparison */}
      <section className="py-16 md:py-24 px-6 border-t border-sky-100 bg-gradient-to-b from-sky-50 to-white">
        <div className="max-w-5xl mx-auto">
          <div className="lp-fade-up text-center mb-12">
            <span className="text-sky-600 font-medium text-xs tracking-[0.2em]">比較</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3 text-gray-900">従来のHP制作 vs LARU HP</h2>
            <p className="text-gray-500 text-sm">なぜ今、個人事業主・中小企業が LARU HP を選ぶのか</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Before */}
            <div className="bg-white border border-red-200 rounded-3xl p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-orange-400 rounded-t-3xl" />
              <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-bold px-3 py-1.5 rounded-full mb-6">
                <span>✕</span> 従来の制作会社・独自構築
              </div>
              <ul className="space-y-4">
                {[
                  { icon: '💸', label: '制作費', value: '20〜80万円', sub: '初期費用だけで大きな出費' },
                  { icon: '⏳', label: '完成まで', value: '1〜3ヶ月', sub: 'その間ビジネスは止まる' },
                  { icon: '🔧', label: '更新作業', value: '業者に都度依頼', sub: '1回1〜3万円が積み重なる' },
                  { icon: '📉', label: 'SEO設定', value: '知識が必要 or 別途費用', sub: 'プラグイン・コンサル費が追加' },
                  { icon: '💰', label: '維持費', value: '月1〜2万円〜', sub: 'サーバー・SSL・保守を個別で' },
                  { icon: '📵', label: 'AI機能', value: 'なし', sub: '24時間自動対応は夢のまま' },
                ].map((row, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{row.icon}</span>
                    <div>
                      <div className="text-xs text-gray-400 font-semibold mb-0.5">{row.label}</div>
                      <div className="text-sm font-bold text-red-600">{row.value}</div>
                      <div className="text-xs text-gray-400">{row.sub}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* After */}
            <div className="bg-sky-600 rounded-3xl p-8 relative overflow-hidden text-white">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-sky-300 rounded-t-3xl" />
              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white, transparent 50%)' }} />
              <div className="inline-flex items-center gap-2 bg-white/15 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-6 relative">
                <span>✓</span> LARU HP
              </div>
              <ul className="space-y-4 relative">
                {[
                  { icon: '🎉', label: '制作費', value: '0円', sub: '初月無料・設定費なし' },
                  { icon: '⚡', label: '完成まで', value: '最短5分', sub: 'AIが自動生成。今日から公開OK' },
                  { icon: '✏️', label: '更新作業', value: '自分でいつでも', sub: 'ビジュアルエディタで即反映' },
                  { icon: '🚀', label: 'SEO設定', value: '完全自動化', sub: 'JSON-LD・メタタグをAIが設定' },
                  { icon: '💎', label: '維持費', value: '月額999円〜', sub: 'サーバー・SSL・AI全込み' },
                  { icon: '🤖', label: 'AI機能', value: 'LARUbot連携', sub: '24時間365日、自動で問い合わせ対応' },
                ].map((row, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{row.icon}</span>
                    <div>
                      <div className="text-xs text-white/60 font-semibold mb-0.5">{row.label}</div>
                      <div className="text-sm font-bold text-white">{row.value}</div>
                      <div className="text-xs text-sky-200">{row.sub}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-6 border-t border-white/20 relative">
                <Link
                  href="/laruHP/onboarding"
                  className="w-full block text-center bg-white text-sky-700 font-bold py-3.5 rounded-2xl text-sm hover:bg-sky-50 transition-colors"
                >
                  初月無料で今すぐ試す →
                </Link>
              </div>
            </div>
          </div>

          {/* Summary callout */}
          <div className="mt-8 bg-white border border-sky-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
            <div className="text-4xl">💡</div>
            <div>
              <p className="font-bold text-gray-900 mb-1">初年度の節約額: 最大 <span className="text-sky-600">79万円以上</span></p>
              <p className="text-sm text-gray-500">制作費80万円 + 維持費12万円（年間） − LARU HP年間費用 = 大幅節約。しかもAI機能つき。</p>
            </div>
            <Link href="/laruHP/onboarding" className="flex-shrink-0 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors whitespace-nowrap">
              始める →
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-24 px-6 border-t border-sky-100 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="lp-fade-up text-center mb-16">
            <span className="text-sky-600 font-medium text-xs tracking-[0.2em]">機能一覧</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3 text-gray-900">すべてが揃っている</h2>
            <p className="text-gray-500">プロのエージェンシーが使う機能を、個人は月額<span className="text-gray-700">999円</span>から。</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i} className={`border rounded-2xl p-6 hover:-translate-y-0.5 transition-all duration-300 ${COLOR_MAP[f.color]}`}>
                <div className={`text-xs font-medium font-mono mb-3 ${COLOR_NUM[f.color]}`}>{f.num}</div>
                <h3 className="text-base font-semibold mb-2 text-gray-900">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Editor preview mock */}
          <div className="mt-16 bg-sky-50 border border-sky-100 rounded-3xl overflow-hidden">
            <div className="bg-sky-100 border-b border-sky-200 px-4 py-3 flex items-center gap-3">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
              </div>
              <div className="flex-1 bg-white rounded-lg px-3 py-1 text-xs text-gray-400 font-mono truncate border border-gray-200">your-shop.laruvisona.jp</div>
              <div className="flex gap-2 flex-shrink-0">
                <button className="hidden sm:block text-xs bg-white border border-sky-200 px-3 py-1 rounded-lg text-gray-500">プレビュー</button>
                <button className="text-xs bg-blue-500 px-3 py-1 rounded-lg text-white font-medium whitespace-nowrap">公開する</button>
              </div>
            </div>
            <div className="flex min-h-[300px]">
              <div className="hidden md:flex w-44 bg-white border-r border-sky-100 p-3 flex-col gap-1 text-xs text-gray-500 flex-shrink-0">
                <div className="text-[10px] font-medium text-gray-500 mb-2 uppercase tracking-wider">ブロックを追加</div>
                {['ヒーロー', 'テキスト', '画像', 'サービス', 'お問合せ', 'マップ', 'FAQ', '営業時間', 'お客様の声', '区切り線', '2カラム', '3カラム'].map((b, i) => (
                  <div key={i} className="px-2 py-1.5 hover:bg-sky-100 rounded-lg cursor-pointer transition-colors text-gray-500">{b}</div>
                ))}
              </div>
              <div className="flex-1 bg-white p-4 flex flex-col gap-3 min-w-0">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 sm:p-8 text-white text-center">
                  <div className="text-base sm:text-lg font-bold mb-1">〇〇整体院</div>
                  <div className="text-xs opacity-70 font-normal">地域No.1の施術技術で、あなたの痛みを根本から解決します</div>
                  <button className="mt-3 bg-white text-blue-600 text-xs px-4 py-1.5 rounded-full font-medium">無料相談はこちら</button>
                </div>
                <div className="border-2 border-blue-500 rounded-xl relative">
                  <div className="absolute -top-3 left-2 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded font-medium">選択中</div>
                  <div className="p-4 text-center">
                    <div className="text-sm font-semibold text-gray-800 mb-1">当院について</div>
                    <div className="text-xs text-gray-400 font-normal">2010年創業。延べ10,000人以上の施術実績...</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['首・肩', '腰痛', '膝'].map(s => (
                    <div key={s} className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-xs font-medium text-gray-600">{s}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hidden md:block w-44 bg-white border-l border-sky-100 p-3 text-xs text-gray-500 flex-shrink-0">
                <div className="text-[10px] font-medium text-gray-500 mb-2 uppercase tracking-wider">ブロック設定</div>
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">見出し</div>
                    <div className="bg-gray-100 rounded px-2 py-1 text-gray-500">当院について</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">配置</div>
                    <div className="flex gap-1">
                      {['◀', '▌', '▶'].map((a, i) => <button key={i} className={`flex-1 py-1 rounded text-[10px] ${i===1 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{a}</button>)}
                    </div>
                  </div>
                  <div className="border-t border-sky-100 pt-3">
                    <div className="text-[10px] font-medium text-gray-500 mb-2 uppercase tracking-wider">SEO設定</div>
                    <div className="bg-gray-100 rounded px-2 py-1 mb-1 text-gray-500">SEOスコア: 87/100</div>
                    <div className="text-[10px] text-emerald-600">LARUbot オン</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="py-16 md:py-24 px-6 border-t border-sky-100 bg-sky-50">
        <div className="max-w-6xl mx-auto">
          <div className="lp-fade-up text-center mb-16">
            <span className="text-sky-600 font-medium text-xs tracking-[0.2em]">テンプレート</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3 text-gray-900">業種別テンプレート</h2>
            <p className="text-gray-500">各業種のベストプラクティスを詰め込んだプロテンプレート。SEO設定・構造化データ付き。</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {INDUSTRIES.map((ind, i) => (
              <Link
                key={i}
                href={`/laruHP/onboarding?industry=${ind.id}`}
                className={`rounded-2xl p-5 text-center border transition-all cursor-pointer group ${activeIndustry === i ? 'bg-sky-100 border-sky-400 scale-105 shadow-[0_0_20px_rgba(14,165,233,0.15)]' : 'bg-white border border-gray-200 hover:border-sky-300 hover:bg-sky-50'}`}
              >
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${ind.color} flex items-center justify-center mx-auto mb-3 text-sm font-semibold text-white group-hover:scale-105 transition-transform`}>
                  {ind.name[0]}
                </div>
                <div className="text-xs font-normal text-gray-600 leading-tight">{ind.name}</div>
              </Link>
            ))}
          </div>
          <p className="text-center text-gray-400 text-xs mt-8">クリックするとそのテンプレートでオンボーディングを開始</p>
        </div>
      </section>

      {/* Showcase — demo site examples */}
      <section id="showcase" className="py-16 md:py-24 px-6 border-t border-sky-100 bg-sky-50">
        <div className="max-w-6xl mx-auto">
          <div className="lp-fade-up text-center mb-14">
            <span className="text-sky-600 font-medium text-xs tracking-[0.2em]">完成イメージ</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3 text-gray-900">こんなサイトが作れます</h2>
            <p className="text-gray-500">AIが業種に最適化したレイアウト・写真・コピーを自動生成。5分でここまで仕上がります。</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* ── 美容室 ── */}
            <div className="group rounded-2xl overflow-hidden border border-gray-200 hover:border-rose-300 transition-all shadow-md hover:shadow-xl bg-white">
              <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
                <div className="flex gap-1.5"><div className="w-2.5 h-2.5 bg-red-400 rounded-full"/><div className="w-2.5 h-2.5 bg-yellow-400 rounded-full"/><div className="w-2.5 h-2.5 bg-green-400 rounded-full"/></div>
                <div className="flex-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-[9px] text-gray-400 text-center truncate">🔒 salon-an.laruvisona.jp</div>
              </div>
              {/* Hero photo area */}
              <div className="relative overflow-hidden" style={{height:180}}>
                <div className="absolute inset-0 bg-gradient-to-br from-rose-900 via-pink-900 to-rose-950" />
                {libHero('beauty') && <div className="absolute inset-0 z-[1] bg-cover bg-center" style={{ backgroundImage: `url(${libHero('beauty')})` }} />}
                <div className="absolute inset-0 z-[2] bg-gradient-to-br from-black/75 via-black/35 to-black/10" />
                {/* Decorative SVG shapes simulating salon interior */}
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 300 180" preserveAspectRatio="xMidYMid slice">
                  <ellipse cx="240" cy="40" rx="80" ry="60" fill="rgba(255,200,200,0.4)"/>
                  <ellipse cx="60" cy="150" rx="70" ry="50" fill="rgba(255,150,180,0.3)"/>
                  <rect x="100" y="60" width="2" height="80" fill="rgba(255,255,255,0.15)" rx="1"/>
                  <rect x="180" y="40" width="2" height="100" fill="rgba(255,255,255,0.1)" rx="1"/>
                  <circle cx="150" cy="20" r="40" fill="none" stroke="rgba(255,200,210,0.2)" strokeWidth="1"/>
                </svg>
                <div className="relative z-10 px-5 pt-5 pb-4">
                  <div className="text-[8px] text-rose-300 tracking-[0.2em] mb-2">HAIR SALON · SINCE 2015</div>
                  <div className="text-[15px] font-bold text-white leading-tight mb-2">美しさを、<br/>もっと自由に。</div>
                  <div className="text-[8px] text-rose-200 mb-3">カット ¥4,400〜 / カラー ¥8,800〜</div>
                  <span className="inline-block text-[8px] bg-rose-400 text-white px-3 py-1 rounded-full font-bold">今すぐ予約する →</span>
                </div>
                {/* Photo grid overlay at bottom */}
                <div className="absolute bottom-0 right-0 flex gap-1 p-2 opacity-70">
                  <div className="w-12 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-rose-300 to-pink-200 flex items-end justify-center">
                    <div className="text-[18px] mb-1">✂️</div>
                  </div>
                  <div className="w-12 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-pink-200 to-rose-300 flex items-end justify-center">
                    <div className="text-[18px] mb-1">💇</div>
                  </div>
                  <div className="w-12 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-rose-200 to-pink-300 flex items-end justify-center">
                    <div className="text-[18px] mb-1">🌸</div>
                  </div>
                </div>
              </div>
              {/* Nav */}
              <div className="bg-rose-950 px-3 py-1.5 flex items-center justify-between">
                <span className="text-[7px] font-bold text-white">✨ SALON AN</span>
                <div className="flex gap-2">{['カット','カラー','パーマ','予約'].map(t=><span key={t} className="text-[6px] text-rose-300">{t}</span>)}</div>
              </div>
              {/* Services */}
              <div className="bg-white px-3 py-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {[{icon:'✂️',name:'カット',price:'¥4,400'},{icon:'🎨',name:'カラー',price:'¥8,800'},{icon:'💆',name:'トリート',price:'¥3,300'}].map(s=>(
                    <div key={s.name} className="bg-rose-50 rounded-xl p-2 text-center border border-rose-100">
                      <div className="text-[14px] mb-0.5">{s.icon}</div>
                      <div className="text-[7px] font-semibold text-gray-700">{s.name}</div>
                      <div className="text-[7px] text-rose-500 font-bold">{s.price}〜</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-3 pb-3">
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-2">
                  <div className="text-[6px] text-yellow-500 mb-0.5">★★★★★</div>
                  <div className="text-[6px] text-gray-600">"カラーが得意なサロン。毎回満足しています！"</div>
                  <div className="text-[5px] text-gray-400 mt-0.5">— 田中様（30代・OL）</div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                <div><div className="text-sm font-semibold text-gray-900">美容室・サロン</div><div className="text-[11px] text-gray-500">Hair Salon AN（東京・渋谷）</div></div>
                <Link href="/laruHP/onboarding?industry=beauty" className="text-[11px] bg-rose-50 text-rose-600 border border-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition-all whitespace-nowrap">このテンプレで →</Link>
              </div>
            </div>

            {/* ── 整体院 ── */}
            <div className="group rounded-2xl overflow-hidden border border-gray-200 hover:border-emerald-300 transition-all shadow-md hover:shadow-xl bg-white">
              <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
                <div className="flex gap-1.5"><div className="w-2.5 h-2.5 bg-red-400 rounded-full"/><div className="w-2.5 h-2.5 bg-yellow-400 rounded-full"/><div className="w-2.5 h-2.5 bg-green-400 rounded-full"/></div>
                <div className="flex-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-[9px] text-gray-400 text-center truncate">🔒 midori-sekkotsu.laruvisona.jp</div>
              </div>
              <div className="relative overflow-hidden" style={{height:180}}>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-teal-800 to-emerald-950" />
                {libHero('clinic') && <div className="absolute inset-0 z-[1] bg-cover bg-center" style={{ backgroundImage: `url(${libHero('clinic')})` }} />}
                <div className="absolute inset-0 z-[2] bg-gradient-to-br from-black/75 via-black/35 to-black/10" />
                <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 300 180" preserveAspectRatio="xMidYMid slice">
                  <circle cx="260" cy="30" r="70" fill="rgba(110,231,183,0.4)"/>
                  <circle cx="40" cy="160" r="60" fill="rgba(52,211,153,0.3)"/>
                  <line x1="0" y1="90" x2="300" y2="90" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
                  <rect x="120" y="50" width="60" height="80" rx="4" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
                </svg>
                <div className="relative z-10 px-5 pt-5 pb-4">
                  <div className="inline-block text-[7px] bg-white/20 text-emerald-100 px-2 py-0.5 rounded-full mb-2">累計施術実績 10,000人以上</div>
                  <div className="text-[15px] font-bold text-white leading-tight mb-2">痛みのない<br/>毎日を取り戻す。</div>
                  <div className="text-[8px] text-emerald-200 mb-3">整体・骨盤矯正・鍼灸 / 初回 ¥1,500</div>
                  <span className="inline-block text-[8px] bg-white text-emerald-700 px-3 py-1 rounded font-bold">初回限定で予約 →</span>
                </div>
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-60">
                  <div className="w-11 h-13 rounded-lg bg-gradient-to-b from-emerald-300 to-teal-200 flex items-end justify-center pb-1"><div className="text-[16px]">💆</div></div>
                  <div className="w-11 h-13 rounded-lg bg-gradient-to-b from-teal-200 to-emerald-300 flex items-end justify-center pb-1"><div className="text-[16px]">🌿</div></div>
                </div>
              </div>
              <div className="bg-white border-b border-emerald-50 px-3 py-1.5 flex items-center justify-between">
                <span className="text-[7px] font-bold text-emerald-800">🍃 みどり接骨院</span>
                <div className="flex gap-2">{['施術案内','料金','アクセス'].map(t=><span key={t} className="text-[6px] text-gray-500">{t}</span>)}</div>
                <span className="text-[6px] bg-emerald-600 text-white px-2 py-0.5 rounded font-medium">予約</span>
              </div>
              <div className="bg-white px-3 py-2.5">
                <div className="text-[7px] text-gray-500 mb-1.5 font-medium">対応症状</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[{icon:'💆',label:'肩こり・首こり'},{icon:'🦴',label:'腰痛・ぎっくり'},{icon:'🦵',label:'ひざ・股関節'}].map(s=>(
                    <div key={s.label} className="bg-emerald-50 border border-emerald-100 rounded-lg p-1.5 text-center">
                      <div className="text-[12px] mb-0.5">{s.icon}</div>
                      <div className="text-[6px] text-emerald-700 font-medium leading-tight">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-emerald-50 mx-3 mb-3 rounded-xl p-2">
                <div className="text-[6px] text-yellow-500 mb-0.5">★★★★★</div>
                <div className="text-[6px] text-gray-600">"3回の施術で長年の腰痛がほぼ解消！先生の説明も丁寧です。"</div>
                <div className="text-[5px] text-gray-400 mt-0.5">— 鈴木様（40代・会社員）</div>
              </div>
              <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                <div><div className="text-sm font-semibold text-gray-900">整体・接骨院</div><div className="text-[11px] text-gray-500">みどり接骨院（大阪・梅田）</div></div>
                <Link href="/laruHP/onboarding?industry=clinic" className="text-[11px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-all whitespace-nowrap">このテンプレで →</Link>
              </div>
            </div>

            {/* ── 飲食店 ── */}
            <div className="group rounded-2xl overflow-hidden border border-gray-200 hover:border-amber-300 transition-all shadow-md hover:shadow-xl bg-white">
              <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
                <div className="flex gap-1.5"><div className="w-2.5 h-2.5 bg-red-400 rounded-full"/><div className="w-2.5 h-2.5 bg-yellow-400 rounded-full"/><div className="w-2.5 h-2.5 bg-green-400 rounded-full"/></div>
                <div className="flex-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-[9px] text-gray-400 text-center truncate">🔒 bistro-nakano.laruvisona.jp</div>
              </div>
              <div className="relative overflow-hidden" style={{height:180}}>
                <div className="absolute inset-0 bg-gradient-to-br from-orange-900 via-amber-900 to-orange-950" />
                {libHero('restaurant') && <div className="absolute inset-0 z-[1] bg-cover bg-center" style={{ backgroundImage: `url(${libHero('restaurant')})` }} />}
                <div className="absolute inset-0 z-[2] bg-gradient-to-br from-black/75 via-black/35 to-black/10" />
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 300 180" preserveAspectRatio="xMidYMid slice">
                  <circle cx="250" cy="50" r="60" fill="rgba(251,191,36,0.3)"/>
                  <circle cx="50" cy="140" r="50" fill="rgba(245,158,11,0.2)"/>
                  <ellipse cx="150" cy="90" rx="30" ry="40" fill="none" stroke="rgba(255,220,150,0.2)" strokeWidth="0.5"/>
                  <circle cx="200" cy="80" r="20" fill="rgba(255,200,100,0.15)"/>
                </svg>
                <div className="relative z-10 px-5 pt-5 pb-4">
                  <div className="text-[7px] text-amber-300 mb-2 tracking-[0.2em] uppercase">French Cuisine · Tokyo</div>
                  <div className="text-[15px] font-bold text-white leading-tight mb-2">気軽に、<br/>本格フレンチを。</div>
                  <div className="text-[8px] text-amber-200 mb-3">ランチ ¥1,500〜 / ディナー ¥4,800〜</div>
                  <span className="inline-block text-[8px] bg-amber-500 text-white px-3 py-1 rounded font-bold">席を予約する →</span>
                </div>
                <div className="absolute bottom-2 right-2 grid grid-cols-3 gap-1 opacity-60">
                  {[{bg:'from-orange-200 to-amber-200',icon:'🍽'},{bg:'from-amber-200 to-yellow-200',icon:'🥂'},{bg:'from-yellow-200 to-orange-200',icon:'🥩'}].map((m,i)=>(
                    <div key={i} className={`w-11 h-12 rounded-lg bg-gradient-to-br ${m.bg} flex items-end justify-center pb-1`}><div className="text-[16px]">{m.icon}</div></div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-900 px-3 py-1.5 flex items-center justify-between">
                <span className="text-[8px] font-bold text-amber-400 tracking-widest">BISTRO NAKANO</span>
                <div className="flex gap-2">{['ランチ','ディナー','ワイン','予約'].map(t=><span key={t} className="text-[6px] text-gray-400">{t}</span>)}</div>
                <span className="text-[6px] border border-amber-400 text-amber-400 px-2 py-0.5 rounded font-medium">予約</span>
              </div>
              <div className="bg-white px-3 py-2">
                <div className="text-[7px] text-gray-500 mb-1.5 font-medium">🍽 人気メニュー</div>
                <div className="grid grid-cols-3 gap-1">
                  {[{bg:'from-orange-100 to-amber-100',name:'フォアグラのテリーヌ',price:'¥1,980'},{bg:'from-amber-100 to-yellow-100',name:'ブイヤベース',price:'¥2,280'},{bg:'from-yellow-100 to-orange-100',name:'シャトーブリアン',price:'¥4,980'}].map((m,i)=>(
                    <div key={m.name} className="rounded-lg overflow-hidden border border-amber-100">
                      <div className={`relative h-8 bg-gradient-to-br ${m.bg} flex items-center justify-center text-[16px]`}>
                        🍴
                        {libGallery('restaurant',i+1) && <img src={libGallery('restaurant',i+1)} alt="" onError={hideOnError} className="absolute inset-0 w-full h-full object-cover" />}
                      </div>
                      <div className="bg-white p-1"><div className="text-[5.5px] font-medium text-gray-700 leading-tight">{m.name}</div><div className="text-[6px] text-amber-600 font-bold">{m.price}</div></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-900 mx-3 mb-3 rounded-xl px-3 py-2 flex items-center justify-between">
                <div className="text-[6px] text-gray-400"><div>📍 東京都中野区中野5-1-1</div><div className="mt-0.5">🕐 月〜土 11:30〜14:00 / 17:00〜22:00</div></div>
                <span className="text-[6px] bg-amber-500 text-white px-2 py-0.5 rounded">📞 電話予約</span>
              </div>
              <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                <div><div className="text-sm font-semibold text-gray-900">飲食店・カフェ</div><div className="text-[11px] text-gray-500">Bistro Nakano（東京・中野区）</div></div>
                <Link href="/laruHP/onboarding?industry=restaurant" className="text-[11px] bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-all whitespace-nowrap">このテンプレで →</Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ── 法律事務所 ── */}
            <div className="group rounded-2xl overflow-hidden border border-gray-200 hover:border-slate-400 transition-all shadow-md hover:shadow-xl bg-white">
              <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
                <div className="flex gap-1.5"><div className="w-2.5 h-2.5 bg-red-400 rounded-full"/><div className="w-2.5 h-2.5 bg-yellow-400 rounded-full"/><div className="w-2.5 h-2.5 bg-green-400 rounded-full"/></div>
                <div className="flex-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-[9px] text-gray-400 text-center truncate">🔒 yamamoto-law.laruvisona.jp</div>
              </div>
              <div className="relative overflow-hidden" style={{height:180}}>
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
                {libHero('legal') && <div className="absolute inset-0 z-[1] bg-cover bg-center" style={{ backgroundImage: `url(${libHero('legal')})` }} />}
                <div className="absolute inset-0 z-[2] bg-gradient-to-br from-black/78 via-black/40 to-black/15" />
                <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 300 180" preserveAspectRatio="xMidYMid slice">
                  <rect x="0" y="0" width="300" height="180" fill="none" stroke="rgba(200,200,220,0.3)" strokeWidth="0.3"/>
                  {[0,30,60,90,120,150,180].map(y=><line key={y} x1="0" y1={y} x2="300" y2={y} stroke="rgba(200,210,230,0.08)" strokeWidth="0.5"/>)}
                  <circle cx="250" cy="30" r="50" fill="rgba(245,200,50,0.08)"/>
                  <rect x="20" y="40" width="8" height="100" rx="2" fill="rgba(255,255,255,0.06)"/>
                  <rect x="35" y="50" width="8" height="90" rx="2" fill="rgba(255,255,255,0.04)"/>
                  <rect x="50" y="30" width="8" height="110" rx="2" fill="rgba(255,255,255,0.06)"/>
                </svg>
                <div className="relative z-10 px-5 pt-5">
                  <div className="text-[7px] text-slate-400 mb-2 tracking-[0.15em]">YAMAMOTO LAW FIRM — 設立30年</div>
                  <div className="text-[15px] font-bold text-white leading-tight mb-2">難しい問題こそ、<br/>ご相談を。</div>
                  <div className="text-[8px] text-slate-300 mb-3">遺産相続・企業法務・不動産 / 初回無料相談</div>
                  <span className="inline-block text-[8px] bg-yellow-600 text-white px-3 py-1 font-bold">無料相談を予約する →</span>
                </div>
                <div className="absolute bottom-3 right-4 text-[40px] opacity-10">⚖️</div>
              </div>
              <div className="bg-slate-900 px-3 py-1.5 flex items-center justify-between">
                <span className="text-[7px] font-bold text-white">山本法律事務所</span>
                <div className="flex gap-2">{['業務案内','費用','弁護士'].map(t=><span key={t} className="text-[6px] text-slate-400">{t}</span>)}</div>
                <span className="text-[6px] border border-yellow-600 text-yellow-600 px-2 py-0.5 font-medium">無料相談</span>
              </div>
              <div className="bg-slate-50 px-3 py-2.5">
                <div className="text-[7px] text-gray-500 mb-1.5 font-medium">専門分野</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[{icon:'📜',label:'相続・遺言'},{icon:'💼',label:'企業法務'},{icon:'🏠',label:'不動産法務'}].map(a=>(
                    <div key={a.label} className="bg-white border border-slate-200 p-2 text-center shadow-sm">
                      <div className="text-[12px] mb-0.5">{a.icon}</div>
                      <div className="text-[6px] text-slate-600 font-medium">{a.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white border-t border-slate-100 px-3 py-2 flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex-shrink-0 flex items-center justify-center text-[14px]">👨‍⚖️</div>
                <div><div className="text-[7px] font-bold text-gray-800">山本 太郎 弁護士</div><div className="text-[6px] text-gray-500">東京弁護士会 · 解決実績500件以上</div></div>
              </div>
              <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                <div><div className="text-sm font-semibold text-gray-900">士業・法律事務所</div><div className="text-[11px] text-gray-500">山本法律事務所（東京・新宿）</div></div>
                <Link href="/laruHP/onboarding?industry=legal" className="text-[11px] bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-all whitespace-nowrap">このテンプレで →</Link>
              </div>
            </div>

            {/* ── フィットネス ── */}
            <div className="group rounded-2xl overflow-hidden border border-gray-200 hover:border-red-300 transition-all shadow-md hover:shadow-xl bg-white">
              <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
                <div className="flex gap-1.5"><div className="w-2.5 h-2.5 bg-red-400 rounded-full"/><div className="w-2.5 h-2.5 bg-yellow-400 rounded-full"/><div className="w-2.5 h-2.5 bg-green-400 rounded-full"/></div>
                <div className="flex-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-[9px] text-gray-400 text-center truncate">🔒 studio-iron.laruvisona.jp</div>
              </div>
              <div className="relative overflow-hidden" style={{height:180}}>
                <div className="absolute inset-0 bg-gradient-to-br from-red-900 via-orange-900 to-red-950" />
                {libHero('fitness') && <div className="absolute inset-0 z-[1] bg-cover bg-center" style={{ backgroundImage: `url(${libHero('fitness')})` }} />}
                <div className="absolute inset-0 z-[2] bg-gradient-to-br from-black/75 via-black/35 to-black/10" />
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 300 180" preserveAspectRatio="xMidYMid slice">
                  <circle cx="150" cy="90" r="80" fill="none" stroke="rgba(255,100,50,0.3)" strokeWidth="1"/>
                  <circle cx="150" cy="90" r="55" fill="none" stroke="rgba(255,120,60,0.2)" strokeWidth="0.5"/>
                  <rect x="70" y="85" width="160" height="5" rx="2.5" fill="rgba(255,150,100,0.2)"/>
                  <rect x="60" y="80" width="15" height="15" rx="7.5" fill="rgba(255,180,100,0.3)"/>
                  <rect x="225" y="80" width="15" height="15" rx="7.5" fill="rgba(255,180,100,0.3)"/>
                </svg>
                <div className="relative z-10 px-5 pt-5">
                  <div className="text-[7px] text-red-300 mb-2 tracking-[0.2em]">PERSONAL GYM IRON</div>
                  <div className="text-[15px] font-bold text-white leading-tight mb-2">限界を超える、<br/>一歩先へ。</div>
                  <div className="text-[8px] text-red-200 mb-3">パーソナルトレーニング / 月額 ¥8,800〜</div>
                  <span className="inline-block text-[8px] bg-red-500 text-white px-3 py-1 rounded font-bold">無料体験を予約 →</span>
                </div>
                <div className="absolute bottom-3 right-4 text-[36px] opacity-15">💪</div>
              </div>
              <div className="bg-gray-900 px-3 py-1.5 flex items-center justify-between">
                <span className="text-[8px] font-bold text-red-400">STUDIO IRON</span>
                <div className="flex gap-2">{['プログラム','料金','トレーナー'].map(t=><span key={t} className="text-[6px] text-gray-400">{t}</span>)}</div>
                <span className="text-[6px] bg-red-500 text-white px-2 py-0.5 rounded font-medium">無料体験</span>
              </div>
              <div className="bg-white px-3 py-2.5">
                <div className="text-[7px] text-gray-500 mb-1.5 font-medium">プログラム</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[{icon:'🏋️',label:'筋力UP',price:'¥8,800'},{icon:'🏃',label:'ダイエット',price:'¥9,800'},{icon:'🧘',label:'体質改善',price:'¥7,800'}].map(s=>(
                    <div key={s.label} className="bg-red-50 border border-red-100 rounded-lg p-2 text-center">
                      <div className="text-[12px] mb-0.5">{s.icon}</div>
                      <div className="text-[6px] font-bold text-gray-700">{s.label}</div>
                      <div className="text-[6px] text-red-500 font-bold">{s.price}〜</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-red-900 mx-3 mb-3 rounded-xl px-3 py-2 flex items-center justify-between">
                <div><div className="text-[7px] text-white font-bold">🎯 今月の空き枠残り3名</div><div className="text-[6px] text-red-300">初回体験 ¥0 / 当日OK</div></div>
                <span className="text-[6px] bg-white text-red-700 px-2 py-0.5 rounded font-bold">申込む</span>
              </div>
              <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                <div><div className="text-sm font-semibold text-gray-900">フィットネス・ジム</div><div className="text-[11px] text-gray-500">Studio IRON（名古屋・栄）</div></div>
                <Link href="/laruHP/onboarding?industry=fitness" className="text-[11px] bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-all whitespace-nowrap">このテンプレで →</Link>
              </div>
            </div>

            {/* ── 工務店 ── */}
            <div className="group rounded-2xl overflow-hidden border border-gray-200 hover:border-amber-400 transition-all shadow-md hover:shadow-xl bg-white">
              <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
                <div className="flex gap-1.5"><div className="w-2.5 h-2.5 bg-red-400 rounded-full"/><div className="w-2.5 h-2.5 bg-yellow-400 rounded-full"/><div className="w-2.5 h-2.5 bg-green-400 rounded-full"/></div>
                <div className="flex-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-[9px] text-gray-400 text-center truncate">🔒 takumi-koumuten.laruvisona.jp</div>
              </div>
              <div className="relative overflow-hidden" style={{height:180}}>
                <div className="absolute inset-0 bg-gradient-to-br from-amber-800 via-yellow-900 to-amber-950" />
                {libHero('construction') && <div className="absolute inset-0 z-[1] bg-cover bg-center" style={{ backgroundImage: `url(${libHero('construction')})` }} />}
                <div className="absolute inset-0 z-[2] bg-gradient-to-br from-black/75 via-black/35 to-black/10" />
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 300 180" preserveAspectRatio="xMidYMid slice">
                  {/* House silhouette */}
                  <polygon points="150,20 240,80 60,80" fill="none" stroke="rgba(255,220,100,0.4)" strokeWidth="1.5"/>
                  <rect x="85" y="80" width="130" height="80" fill="none" stroke="rgba(255,200,80,0.3)" strokeWidth="1"/>
                  <rect x="130" y="110" width="40" height="50" fill="rgba(255,200,80,0.1)"/>
                  <rect x="95" y="90" width="30" height="30" fill="rgba(255,200,80,0.1)"/>
                  <rect x="175" y="90" width="30" height="30" fill="rgba(255,200,80,0.1)"/>
                </svg>
                <div className="relative z-10 px-5 pt-5">
                  <div className="text-[7px] text-amber-300 mb-2">地域密着 · 創業35年</div>
                  <div className="text-[15px] font-bold text-white leading-tight mb-2">地元の技術と<br/>信頼で建てる。</div>
                  <div className="text-[8px] text-amber-200 mb-3">新築・リフォーム・外構 / 見積もり無料</div>
                  <span className="inline-block text-[8px] bg-amber-600 text-white px-3 py-1 rounded font-bold">無料見積もりを依頼 →</span>
                </div>
              </div>
              <div className="bg-amber-900 px-3 py-1.5 flex items-center justify-between">
                <span className="text-[7px] font-bold text-white">🏗 匠工務店</span>
                <div className="flex gap-2">{['施工事例','サービス','料金','見積り'].map(t=><span key={t} className="text-[6px] text-amber-300">{t}</span>)}</div>
              </div>
              <div className="bg-white px-3 py-2.5">
                <div className="text-[7px] text-gray-500 mb-1.5 font-medium">施工事例</div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    {bg:'from-amber-100 to-yellow-100',label:'新築住宅',icon:'🏠'},
                    {bg:'from-orange-100 to-amber-100',label:'キッチンリフォーム',icon:'🍳'},
                    {bg:'from-yellow-100 to-orange-100',label:'外壁塗装',icon:'🎨'},
                  ].map((m,i)=>(
                    <div key={m.label} className="rounded-lg overflow-hidden border border-amber-100">
                      <div className={`relative h-9 bg-gradient-to-br ${m.bg} flex items-center justify-center text-[18px]`}>
                        {m.icon}
                        {libGallery('construction',i+1) && <img src={libGallery('construction',i+1)} alt="" onError={hideOnError} className="absolute inset-0 w-full h-full object-cover" />}
                      </div>
                      <div className="bg-white p-1 text-center"><div className="text-[5.5px] font-medium text-gray-600">{m.label}</div></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-amber-50 border-t border-amber-100 mx-3 mb-3 rounded-xl px-3 py-2">
                <div className="text-[6px] text-yellow-500 mb-0.5">★★★★★</div>
                <div className="text-[6px] text-gray-600">"親切丁寧な対応と高品質な仕上がりで大満足！"</div>
                <div className="text-[5px] text-gray-400 mt-0.5">— 佐藤様（50代・自営業）</div>
              </div>
              <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                <div><div className="text-sm font-semibold text-gray-900">建設・工務店</div><div className="text-[11px] text-gray-500">匠工務店（埼玉・さいたま市）</div></div>
                <Link href="/laruHP/onboarding?industry=construction" className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-all whitespace-nowrap">このテンプレで →</Link>
              </div>
            </div>
          </div>

          {/* Industry links */}
          <div className="mt-10 text-center">
            <p className="text-gray-500 text-sm mb-5">他の業種も同じクオリティで作れます →</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                {id:'realestate',label:'不動産'},
                {id:'hotel',label:'ホテル・旅館'},
                {id:'education',label:'教育・スクール'},
                {id:'dental',label:'歯科クリニック'},
                {id:'wedding',label:'ウェディング'},
                {id:'pet',label:'ペットサロン'},
                {id:'photo',label:'フォトスタジオ'},
                {id:'accounting',label:'税理士・会計士'},
                {id:'retail',label:'小売・ショップ'},
              ].map(ind=>(
                <Link key={ind.id} href={`/laruHP/${ind.id}`}
                  className="text-sm text-gray-600 hover:text-sky-600 border border-gray-200 hover:border-sky-300 px-4 py-2 rounded-full bg-white hover:bg-sky-50 transition-all">
                  {ind.label} →
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-24 px-6 border-t border-sky-100 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="lp-fade-up text-center mb-12">
            <span className="text-sky-600 font-medium text-xs tracking-[0.2em]">導入事例</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3 text-gray-900">お客様の声</h2>
            <p className="text-gray-500">実際にLARU HPを使ったオーナーから届いたリアルな声</p>
          </div>
          <div className="lp-stagger grid md:grid-cols-3 gap-6">
            {[
              {
                name: '田中 美里',
                role: '美容室オーナー（東京・新宿）',
                avatar: '💇',
                stars: 5,
                quote: '以前はWordPressで毎月8,000円払っていましたが、LARU HPに移行したら月999円で全機能が使えるようになりました。AIでコンテンツを作ってくれるので更新も楽になり、お問い合わせも月30件から55件に増えました。',
                highlight: 'お問い合わせが1.8倍に',
              },
              {
                name: '中村 大輔',
                role: '整体院院長（大阪・天王寺）',
                avatar: '💆',
                stars: 5,
                quote: 'ホームページを持っていなかったので、Instagramだけで集客していました。LARU HPで自社HPを持って3ヶ月で月20件以上の新規予約がネット経由で入るようになりました。費用対効果が素晴らしい。',
                highlight: '月20件以上の新規予約',
              },
              {
                name: '渡辺 健太',
                role: '個人事業主・税理士（名古屋）',
                avatar: '📊',
                stars: 5,
                quote: 'SEOの知識がなくても、AIが全部やってくれるのが助かります。「名古屋 税理士 相続」で検索1ページ目に表示されるようになり、問い合わせが月5件程度から安定して入るようになりました。',
                highlight: 'Google検索1ページ目へ',
              },
            ].map((t, i) => (
              <div key={i} className="bg-sky-50 border border-sky-100 rounded-3xl p-7 flex flex-col hover:border-sky-300 hover:shadow-md transition-all">
                <div className="flex gap-0.5 mb-4">
                  {Array(t.stars).fill(0).map((_, j) => (
                    <span key={j} className="text-amber-400 text-sm">★</span>
                  ))}
                </div>
                <div className="bg-sky-100 border border-sky-200 text-sky-700 text-xs font-semibold px-3 py-1 rounded-full self-start mb-4">{t.highlight}</div>
                <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3 border-t border-sky-100 pt-4">
                  <div className="w-10 h-10 bg-sky-200 rounded-full flex items-center justify-center text-[18px] flex-shrink-0">{t.avatar}</div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LARUbot + LARUSEO Integration */}
      <section className="py-16 md:py-24 px-6 border-t border-sky-100 bg-sky-50">
        <div className="max-w-5xl mx-auto">
          <div className="lp-fade-up text-center mb-12">
            <span className="text-sky-600 font-medium text-xs tracking-[0.2em]">連携機能</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3 text-gray-900">強力な連携機能</h2>
            <p className="text-gray-500">AIチャットボット・SEOツールとシームレスに連携。集客を自動化します。</p>
          </div>
          <div className="lp-stagger grid md:grid-cols-2 gap-8">
            <div className="bg-indigo-50 border border-indigo-200 rounded-3xl p-8 hover:border-indigo-300 transition-all">
              <div className="inline-block bg-indigo-100 text-indigo-600 text-xs font-medium px-3 py-1 rounded-full mb-4">LARUbot 連携</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">AIチャットボットを即導入</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                LARUVisonaのAIチャットボット「LARUbot」をワンクリックで埋め込み。24時間365日、問い合わせ対応・予約受付・FAQ対応を自動化します。
              </p>
              <div className="bg-white rounded-2xl p-4 text-sm text-gray-600 font-mono space-y-1.5">
                <div className="text-gray-600">① エディタ → 連携設定</div>
                <div className="text-gray-600">② LARUbotアカウントを接続</div>
                <div className="text-gray-600">③ ウィジェットをオン → 完了</div>
              </div>
              <a href="https://larubot.tokyo" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-500 text-sm mt-4 transition-colors">
                LARUbot公式サイト →
              </a>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 hover:border-emerald-300 transition-all">
              <div className="inline-block bg-emerald-100 text-emerald-600 text-xs font-medium px-3 py-1 rounded-full mb-4">LARUSEO 連携</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">SEO分析をリアルタイムで</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                SEO分析ツール「LARUSEO」と連携してSEOスコアをリアルタイム表示。キーワード分析・競合比較・改善提案をエディタ内で確認できます。
              </p>
              <div className="bg-white rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">SEOスコア</span>
                  <span className="text-emerald-600 font-semibold">87 / 100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="bg-emerald-500/70 h-1.5 rounded-full" style={{ width: '87%' }} />
                </div>
                <div className="text-xs text-gray-500">メタタグ ✓ 構造化データ ✓ 画像alt ✓ ページ速度 ✓</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agency section */}
      <section className="py-16 md:py-24 px-6 border-t border-sky-100 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-purple-600 font-medium text-xs tracking-[0.2em]">代理店・制作会社向け</span>
              <h2 className="text-2xl md:text-3xl font-bold mt-3 mb-4 text-gray-900 md:whitespace-nowrap">Web制作会社・フリーランス向け</h2>
              <p className="text-gray-500 text-base leading-relaxed mb-6">
                複数クライアントのサイトを1アカウントで一元管理。エージェンシーモードで全クライアントの状況をひと目で把握。
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  { icon: '👥', text: 'クライアント別サイト管理ダッシュボード' },
                  { icon: '📊', text: 'PV・問い合わせ数を全サイトまとめて確認' },
                  { icon: '✉️', text: 'クライアント連絡先・メモを一元管理' },
                  { icon: '🔗', text: '独自ドメイン設定をクライアントごとに設定' },
                  { icon: '⚡', text: 'AIで素早くドラフト作成 → 修正・公開' },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-600 text-sm">
                    <span className="text-lg flex-shrink-0">{item.icon}</span>
                    {item.text}
                  </li>
                ))}
              </ul>
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-6">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-purple-600 text-xs">¥</span>
                  <span className="text-3xl font-bold text-gray-900">19,800</span>
                  <span className="text-gray-500 text-sm">/ 月（税別）</span>
                </div>
                <div className="text-purple-600 text-xs font-medium">クライアント数無制限 · 全機能込み</div>
              </div>
              <Link href="/laruHP/plans#agency"
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all">
                エージェンシープランで始める →
              </Link>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-md">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                </div>
                <span className="text-gray-500 text-xs">エージェンシー管理画面</span>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { name: '山田商店', domain: 'yamada-store.com', pv: '1,240', status: '公開中', contacts: 3, color: 'green' },
                  { name: '田中整体院', domain: 'tanaka-sekkotsu.com', pv: '3,891', status: '公開中', contacts: 7, color: 'green' },
                  { name: 'カフェ・ノア', domain: '（設定中）', pv: '0', status: '下書き', contacts: 0, color: 'slate' },
                ].map((site, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${site.color === 'green' ? 'bg-green-400' : 'bg-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-900 text-sm font-semibold">{site.name}</div>
                      <div className="text-gray-400 text-[11px]">{site.domain}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-gray-500 text-xs">{site.pv} PV</div>
                      {site.contacts > 0 && <div className="text-blue-600 text-[11px]">✉ {site.contacts}件</div>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${site.color === 'green' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {site.status}
                    </span>
                  </div>
                ))}
                <div className="text-center">
                  <button className="text-xs text-gray-400 hover:text-gray-600 py-1">+ 新規クライアントサイト</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 md:py-24 px-6 bg-slate-50 border-t border-gray-200">
        <div className="max-w-5xl mx-auto text-center">
          <span className="text-blue-600 font-medium text-xs tracking-[0.2em]">PRICING</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3 text-gray-900">料金プラン</h2>
          <p className="text-gray-500 mb-2">全プラン 初月無料・最低6ヶ月契約。7ヶ月目からいつでも解約可。</p>
          <p className="text-gray-400 text-xs mb-8">クレジットカード決済 / Stripe安全決済</p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-1.5 mb-10 shadow-sm">
            <button
              onClick={() => setAnnualPricing(false)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${!annualPricing ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              月払い
            </button>
            <button
              onClick={() => setAnnualPricing(true)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${annualPricing ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              年払い
              <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">2ヶ月無料</span>
            </button>
          </div>

          <div className="lp-stagger grid md:grid-cols-3 gap-5 mb-8">
            {PLANS.map((plan) => {
              const displayPrice = annualPricing ? (PLAN_ANNUAL_PRICE[plan.id] ?? plan.price) : plan.price;
              const saving = annualPricing ? plan.price - displayPrice : 0;
              return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-8 flex flex-col text-left transition-all duration-300 hover:-translate-y-1 shadow-sm ${
                  plan.highlight
                    ? 'border-2 border-blue-500 bg-white shadow-[0_0_40px_rgba(59,130,246,0.12)]'
                    : 'border border-gray-200 bg-white'
                }`}
              >
                {plan.badge && (
                  <div className={`absolute top-5 right-5 text-xs font-medium px-3 py-1 rounded-full ${
                    plan.badge === 'おすすめ'
                      ? 'bg-blue-600 text-white'
                      : 'bg-amber-500 text-black'
                  }`}>
                    {plan.badge}
                  </div>
                )}

                <div className="text-[10px] font-medium text-gray-400 tracking-widest mb-3">プラン {PLANS.indexOf(plan) + 1}</div>
                <h3 className="text-lg font-semibold mb-1 text-gray-900">{plan.name}</h3>
                <p className="text-gray-500 text-xs mb-4">{plan.sub}</p>

                <div className="mb-1 flex items-baseline gap-2">
                  <div>
                    <span className="text-gray-400 text-base">¥</span>
                    <span className="text-4xl font-bold text-gray-900">{displayPrice.toLocaleString()}</span>
                  </div>
                  {annualPricing && (
                    <span className="text-sm text-gray-400 line-through">¥{plan.price.toLocaleString()}</span>
                  )}
                </div>
                <div className="text-gray-400 text-xs mb-1">/ 月（税別）{annualPricing ? ' · 年払い一括' : ''}</div>
                <div className="flex gap-2 mb-6 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-medium px-3 py-1 rounded-full self-start">
                    初月無料
                  </div>
                  {annualPricing && saving > 0 && (
                    <div className="inline-flex items-center gap-1 bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold px-3 py-1 rounded-full self-start">
                      年間¥{(saving * 12).toLocaleString()}お得
                    </div>
                  )}
                </div>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2.5">
                      <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                  {plan.missing.map((f, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2.5">
                      <span className="mt-0.5 flex-shrink-0">−</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/laruHP/onboarding"
                  className={`text-center font-semibold py-3.5 rounded-2xl text-sm transition-all hover:scale-105 ${
                    plan.highlight
                      ? 'bg-blue-600 text-white shadow-[0_4px_20px_rgba(59,130,246,0.3)] hover:bg-blue-500'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  初月無料で始める →
                </Link>
              </div>
            ); })}
          </div>

          <Link href="/laruHP/plans" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-500 text-sm font-normal transition-colors mb-12">
            プランを詳しく比較する →
          </Link>

          {/* Competitor comparison */}
          <div className="mt-4 overflow-x-auto rounded-2xl">
            <div className="min-w-[480px] bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-4 text-xs border-b border-gray-100">
                <div className="p-3 text-gray-400">サービス</div>
                <div className="p-3 text-gray-400 text-center">月額</div>
                <div className="p-3 text-gray-400 text-center">AI機能</div>
                <div className="p-3 text-gray-400 text-center">SEO自動化</div>
              </div>
              {[
                { name: 'LARU HP', price: '999円〜', ai: '◎ フル搭載', seo: '◎ 完全自動', highlight: true },
                { name: 'Wix', price: '2,000円〜', ai: '△ 限定的', seo: '△ 手動設定' },
                { name: 'STUDIO', price: '2,000円〜', ai: '− なし', seo: '△ 手動設定' },
                { name: 'WordPress.com', price: '1,100円〜', ai: '− なし', seo: '△ プラグイン必要' },
              ].map((row, i) => (
                <div key={i} className={`grid grid-cols-4 text-xs border-b border-gray-100 last:border-0 ${row.highlight ? 'bg-blue-50 text-blue-900' : 'text-gray-500'}`}>
                  <div className={`p-3 ${row.highlight ? 'font-semibold text-blue-700' : 'font-normal'}`}>{row.name}</div>
                  <div className="p-3 text-center">{row.price}</div>
                  <div className="p-3 text-center">{row.ai}</div>
                  <div className="p-3 text-center">{row.seo}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust / Guarantee section */}
      <section className="py-16 md:py-20 px-6 border-t border-sky-100 bg-sky-600 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-sky-200 font-medium text-xs tracking-[0.2em]">安心保証</span>
            <h2 className="text-2xl md:text-3xl font-bold mt-3 text-white">リスクゼロで始められる理由</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                icon: '🆓',
                title: '初月完全無料',
                desc: '最初の1ヶ月は一切費用なし。クレジットカードの請求は翌月から。',
              },
              {
                icon: '📅',
                title: '7ヶ月目から解約自由',
                desc: '6ヶ月後からは月単位でいつでも解約できます。長期縛りなし。',
              },
              {
                icon: '💾',
                title: 'データは保持',
                desc: '解約後もサイトデータはしばらく保持。再契約時にすぐ再開可能。',
              },
              {
                icon: '🔒',
                title: 'Stripe決済で安全',
                desc: 'カード情報はStripeが管理。当社サーバーにカード情報は一切保存しません。',
              },
            ].map((item, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 text-center hover:bg-white/15 transition-colors">
                <div className="text-3xl mb-3">{item.icon}</div>
                <div className="font-bold text-white text-sm mb-2">{item.title}</div>
                <div className="text-sky-100 text-xs leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/laruHP/onboarding"
              className="inline-flex items-center gap-3 bg-white text-sky-700 font-bold px-10 py-4 rounded-2xl text-base hover:bg-sky-50 transition-colors shadow-lg"
            >
              初月無料で試してみる → <span className="text-xs font-normal text-sky-500">7ヶ月目から解約可能</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 md:py-24 px-6 border-t border-sky-100 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="lp-fade-up text-center mb-12">
            <span className="text-sky-600 font-medium text-xs tracking-[0.2em]">FAQ</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 text-gray-900">よくある質問</h2>
          </div>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="bg-sky-50 border border-sky-100 rounded-2xl overflow-hidden hover:border-sky-300 transition-all">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full text-left p-5 flex justify-between items-start gap-4">
                  <span className="font-medium text-sm leading-relaxed text-gray-800">{item.q}</span>
                  <span className="text-gray-400 text-lg mt-0.5 flex-shrink-0">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-gray-600 text-sm leading-relaxed border-t border-sky-100 pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32 px-6 border-t border-sky-100 bg-sky-50 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse,rgba(14,165,233,0.08),transparent_70%)]" />
        </div>
        <div className="max-w-3xl mx-auto relative">
          <div className="inline-flex items-center gap-2 bg-sky-100 border border-sky-300 px-4 py-2 rounded-full text-sky-700 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse inline-block" />
            初月無料キャンペーン実施中
          </div>
          <h2 className="text-4xl md:text-6xl font-bold mb-4 leading-tight text-gray-900">
            あなたのビジネスを、<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-cyan-400">今日から変える。</span>
          </h2>
          <p className="text-gray-600 text-base mb-10 max-w-xl mx-auto">業種情報を入力するだけ。5分後にはプロ品質のHPが完成しています。</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/laruHP/onboarding"
              className="bg-sky-600 text-white px-10 py-4 rounded-2xl font-bold text-base hover:scale-105 transition-transform shadow-[0_4px_20px_rgba(2,132,199,0.25)] inline-flex items-center gap-3 justify-center hover:bg-sky-500">
              無料で始める（初月無料） <span className="text-white">→</span>
            </Link>
            <Link href="/laruHP/builder"
              className="border border-sky-200 text-gray-600 hover:text-gray-900 px-10 py-4 rounded-2xl font-medium text-base hover:border-sky-400 transition-all inline-flex items-center gap-2 justify-center">
              <span className="text-sky-600">▶</span> まずデモを見る
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-5 text-xs text-gray-500">
            <span>✓ クレジットカード決済（Stripe）</span>
            <span>✓ 初月完全無料</span>
            <span>✓ 最短5分で完成</span>
            <span>✓ SSL・サーバー込み</span>
            <span>✓ 7ヶ月目から解約可</span>
            <span>✓ カード情報は当社保存なし</span>
          </div>

          {/* Urgency nudge */}
          <div className="mt-8 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-4 py-2.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
            現在、初月無料キャンペーン実施中 — いつ終了するか未定
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-sky-100 bg-white py-12 text-gray-500 text-sm">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
            <div className="flex-shrink-0">
              <Image src="/laruhp_logo.png" alt="LARU HP" height={28} width={160} className="h-7 w-auto mb-2" />
              <p className="text-gray-500 text-xs max-w-xs leading-relaxed">AIで最高のホームページを最短で。株式会社LARUVisonaが提供するHP作成SaaSサービスです。</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-6 text-xs w-full md:w-auto">
              <div>
                <div className="text-gray-600 font-medium mb-2">サービス</div>
                <div className="space-y-1.5">
                  <div><a href="#features" className="hover:text-gray-800 transition-colors">機能一覧</a></div>
                  <div><a href="#templates" className="hover:text-gray-800 transition-colors">テンプレート</a></div>
                  <div><a href="#pricing" className="hover:text-gray-800 transition-colors">料金</a></div>
                </div>
              </div>
              <div>
                <div className="text-gray-600 font-medium mb-2">LARUVisona</div>
                <div className="space-y-1.5">
                  <div><Link href="/" className="hover:text-gray-800 transition-colors">会社サイト</Link></div>
                  <div><a href="https://larubot.tokyo" target="_blank" rel="noopener noreferrer" className="hover:text-gray-800 transition-colors">LARUbot</a></div>
                  <div><Link href="/laruHP/contact" className="hover:text-gray-800 transition-colors">お問い合わせ</Link></div>
                </div>
              </div>
              <div>
                <div className="text-gray-600 font-medium mb-2">アカウント</div>
                <div className="space-y-1.5">
                  <div><Link href="/laruHP/auth/login" className="hover:text-gray-800 transition-colors">ログイン</Link></div>
                  <div><Link href="/laruHP/auth/signup" className="hover:text-gray-800 transition-colors">新規登録</Link></div>
                  <div><Link href="/laruHP/dashboard" className="hover:text-gray-800 transition-colors">ダッシュボード</Link></div>
                </div>
              </div>
              <div>
                <div className="text-gray-600 font-medium mb-2">法的情報</div>
                <div className="space-y-1.5">
                  <div><Link href="/laruHP/terms" className="hover:text-gray-800 transition-colors">利用規約</Link></div>
                  <div><Link href="/laruHP/privacy" className="hover:text-gray-800 transition-colors">プライバシー</Link></div>
                  <div><Link href="/laruHP/tokusho" className="hover:text-gray-800 transition-colors">特定商取引法</Link></div>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-sky-100 pt-6 text-center text-xs text-gray-400">
            © 2026 株式会社LARUVisona. All Rights Reserved.
          </div>
        </div>
      </footer>

      {/* Mobile sticky CTA bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-sky-100 px-4 py-3 flex items-center gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex-1 min-w-0">
          <div className="text-gray-900 font-bold text-sm leading-tight">初月完全無料で始める</div>
          <div className="text-gray-400 text-[11px]">月額¥999〜 · AI自動生成</div>
        </div>
        <Link
          href="/laruHP/onboarding"
          className="flex-shrink-0 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all active:scale-95"
        >
          無料で始める →
        </Link>
      </div>
      {/* Bottom padding to prevent content being hidden by sticky bar on mobile */}
      <div className="md:hidden h-20" />
    </div>
  );
}
