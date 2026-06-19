'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

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
    q: '初月1円とはどういう意味ですか？',
    a: '最初の月のご利用料金が1円（税別）となります。2ヶ月目からは通常の月額999円（税別）となります。最低ご利用期間は6ヶ月となりますので、7ヶ月目からは月単位でいつでも解約可能です。',
  },
  {
    q: 'サーバー費用は別途かかりますか？',
    a: '月額999円の中にサーバー利用料・laruvisona.comサブドメイン・SSL証明書がすべて含まれています。独自ドメインをご希望の場合は別途ドメイン取得費用（年間約1,000〜2,000円）が必要です。',
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
];

const COLOR_MAP: Record<string, string> = {
  blue: 'border-blue-500/20 bg-blue-500/[0.06]',
  purple: 'border-purple-500/20 bg-purple-500/[0.06]',
  green: 'border-green-500/20 bg-green-500/[0.06]',
  indigo: 'border-indigo-500/20 bg-indigo-500/[0.06]',
  emerald: 'border-emerald-500/20 bg-emerald-500/[0.06]',
  cyan: 'border-cyan-500/20 bg-cyan-500/[0.06]',
};

const COLOR_NUM: Record<string, string> = {
  blue: 'text-blue-500/40', purple: 'text-purple-500/40', green: 'text-green-500/40',
  indigo: 'text-indigo-500/40', emerald: 'text-emerald-500/40', cyan: 'text-cyan-500/40',
};

export default function LaruHPLandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeIndustry, setActiveIndustry] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndustry(prev => (prev + 1) % INDUSTRIES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-x-hidden">

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#030712]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white text-black rounded-lg flex items-center justify-center font-black text-sm">L</div>
            <span className="font-semibold tracking-tight text-base">LARU<span className="text-blue-400 font-light">HP</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">機能</a>
            <a href="#templates" className="hover:text-white transition-colors">テンプレート</a>
            <a href="#pricing" className="hover:text-white transition-colors">料金</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link href="/laruHP/auth/login" className="hidden md:block text-slate-400 hover:text-white border border-white/10 hover:border-white/30 px-4 py-2 rounded-xl text-sm transition-all">
              ログイン
            </Link>
            <Link href="/laruHP/onboarding" className="bg-white text-black px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-all whitespace-nowrap">
              初月1円で始める →
            </Link>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-white w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl border border-white/10">
              {isMenuOpen ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <line x1="2" y1="2" x2="14" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="14" y1="2" x2="2" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
                  <line x1="0" y1="1" x2="18" y2="1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="0" y1="6" x2="18" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="0" y1="11" x2="14" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-[#030712]/98 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex flex-col gap-1">
            <a href="#features" onClick={() => setIsMenuOpen(false)} className="text-slate-300 hover:text-white py-3 border-b border-white/5">機能</a>
            <a href="#templates" onClick={() => setIsMenuOpen(false)} className="text-slate-300 hover:text-white py-3 border-b border-white/5">テンプレート</a>
            <a href="#pricing" onClick={() => setIsMenuOpen(false)} className="text-slate-300 hover:text-white py-3 border-b border-white/5">料金</a>
            <a href="#faq" onClick={() => setIsMenuOpen(false)} className="text-slate-300 hover:text-white py-3 border-b border-white/5">FAQ</a>
            <div className="flex gap-3 pt-4">
              <Link href="/laruHP/auth/login" onClick={() => setIsMenuOpen(false)} className="flex-1 text-center border border-white/20 text-white py-3 rounded-xl text-sm font-medium">
                ログイン
              </Link>
              <Link href="/laruHP/onboarding" onClick={() => setIsMenuOpen(false)} className="flex-1 text-center bg-white text-black py-3 rounded-xl text-sm font-semibold">
                初月1円で始める
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="pt-28 md:pt-36 pb-16 md:pb-28 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.12),transparent_65%)]" />
          <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full bg-blue-600/5 blur-3xl" />
          <div className="absolute top-32 right-1/4 w-56 h-56 rounded-full bg-cyan-500/5 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '80px 80px' }} />
        </div>

        <div className="max-w-5xl mx-auto relative">
          <div className="inline-flex items-center gap-2.5 bg-blue-500/10 border border-blue-500/25 px-5 py-2.5 rounded-full text-blue-400 text-xs font-medium tracking-widest mb-10 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            新登場 — AI搭載 HPビルダー 2026
          </div>

          <h1 className="text-[2.8rem] sm:text-6xl md:text-[6.5rem] font-bold tracking-tighter mb-6 leading-[1.05] md:leading-[1.02]">
            <span className="block text-white">最高のHPを、</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400">
              最短5分で。
            </span>
          </h1>

          <p className="text-slate-400 text-base md:text-xl mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed font-normal">
            業種情報を入力するだけ。AIが<strong className="text-white font-semibold">5分以内</strong>にプロ品質のホームページを自動生成。<br className="hidden md:block" />
            SEO・LARUbot連携・ビジュアル編集がすべて月額<strong className="text-white font-semibold">999円</strong>。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
            <Link href="/laruHP/onboarding"
              className="relative bg-white text-black px-9 py-4 rounded-2xl font-bold text-base hover:scale-105 transition-transform shadow-[0_0_50px_rgba(255,255,255,0.15)] flex items-center gap-3 w-full sm:w-auto justify-center overflow-hidden group">
              <span className="absolute inset-0 bg-gradient-to-r from-blue-100 to-cyan-100 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative">無料で始める（初月1円）</span>
              <span className="relative text-blue-600 font-bold">→</span>
            </Link>
            <Link href="/laruHP/builder"
              className="text-slate-300 hover:text-white px-9 py-4 rounded-2xl font-medium text-base border border-white/10 hover:border-white/30 transition-all flex items-center gap-2.5 w-full sm:w-auto justify-center backdrop-blur-sm">
              <span className="text-blue-400">▶</span> デモを体験
            </Link>
          </div>
          <p className="text-slate-600 text-xs">初月1円 → 月額999円（税別）/ 最低6ヶ月 / クレジットカード決済</p>
          <p className="text-slate-600 text-xs mt-2">
            既にアカウントをお持ちの方は{' '}
            <Link href="/laruHP/auth/login" className="text-blue-500 hover:text-blue-400 underline underline-offset-2">ログイン</Link>
          </p>

          <div className="hidden md:flex justify-center gap-3 mt-8 flex-wrap">
            {['AI コンテンツ生成', 'SEO 自動最適化', 'LARUbot 連携', 'モバイル完全対応', 'SSL 込み'].map((tag, i) => (
              <span key={i} className="bg-white/5 border border-white/10 text-slate-500 text-xs px-3 py-1.5 rounded-full hover:border-white/20 hover:text-slate-300 transition-all">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="max-w-3xl mx-auto mt-10 md:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { num: '5分', label: 'でサイト完成', sub: 'AI自動生成', color: 'from-blue-500/20 to-transparent' },
            { num: '12+', label: '業種テンプレート', sub: '随時追加中', color: 'from-purple-500/20 to-transparent' },
            { num: '¥999〜', label: '/月（初月1円）', sub: '税別', color: 'from-cyan-500/20 to-transparent' },
            { num: '100%', label: 'SEO自動化', sub: 'AI最適化', color: 'from-emerald-500/20 to-transparent' },
          ].map((stat, i) => (
            <div key={i} className={`relative bg-gradient-to-br ${stat.color} border border-white/10 rounded-2xl p-5 text-center backdrop-blur-sm hover:border-white/20 hover:-translate-y-1 transition-all duration-300 overflow-hidden`}>
              <div className="text-2xl md:text-3xl font-bold text-white">{stat.num}</div>
              <div className="text-xs text-white/70 font-medium mt-1">{stat.label}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 md:py-24 px-6 border-t border-white/5 bg-gradient-to-b from-[#0a1628]/60 to-transparent">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-blue-400/90 font-medium text-xs tracking-[0.2em]">使い方</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3">3ステップで完成</h2>
            <p className="text-slate-400 text-sm">業種情報を入力するだけ。5分でプロ品質のHPが完成します</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-12 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-[1px] bg-gradient-to-r from-blue-500/40 via-blue-500/20 to-blue-500/40" />
            {[
              { step: '01', title: '情報を入力',    desc: '業種・店舗名・住所・サービス内容などを入力。AIが残りを全部やってくれます。',                                       tag: '約2分' },
              { step: '02', title: 'AIが自動生成',  desc: '業種に最適化されたテンプレートにビジネス情報を組み込み、コンテンツを自動作成。',                                   tag: '約1分' },
              { step: '03', title: 'エディタで仕上げ', desc: 'ビジュアルエディタで微調整。画像変更・テキスト編集・ブロック追加削除が直感的に。',                             tag: '約2分' },
            ].map((step, i) => (
              <div key={i} className="relative bg-white/[0.06] border border-white/[0.12] rounded-2xl p-8 hover:border-blue-400/30 hover:bg-white/[0.09] hover:-translate-y-1 transition-all duration-300 backdrop-blur-sm">
                <div className="absolute top-4 right-4 bg-blue-500/15 text-blue-300 text-[10px] font-medium px-2 py-1 rounded-full">{step.tag}</div>
                <div className={`text-5xl font-bold mb-4 leading-none font-mono ${COLOR_NUM['blue']}`}>{step.step}</div>
                <div className="text-blue-400/70 font-medium text-[10px] tracking-[0.2em] mb-2">ステップ {step.step}</div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-24 px-6 border-t border-white/5 bg-white/[0.015]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-blue-500/70 font-medium text-xs tracking-[0.2em]">機能一覧</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3">すべてが揃っている</h2>
            <p className="text-slate-500">プロのエージェンシーが使う機能を、月額<span className="text-slate-300">999円</span>で。</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i} className={`border rounded-2xl p-6 hover:-translate-y-0.5 transition-all duration-300 ${COLOR_MAP[f.color]}`}>
                <div className={`text-xs font-medium font-mono mb-3 ${COLOR_NUM[f.color]}`}>{f.num}</div>
                <h3 className="text-base font-semibold mb-2 text-white/90">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Editor preview mock */}
          <div className="mt-16 bg-white/[0.03] border border-white/[0.07] rounded-3xl overflow-hidden">
            <div className="bg-white/5 border-b border-white/10 px-4 py-3 flex items-center gap-3">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
              </div>
              <div className="flex-1 bg-white/10 rounded-lg px-3 py-1 text-xs text-slate-400 font-mono truncate">your-shop.laruvisona.com</div>
              <div className="flex gap-2 flex-shrink-0">
                <button className="hidden sm:block text-xs bg-white/10 px-3 py-1 rounded-lg text-slate-400">プレビュー</button>
                <button className="text-xs bg-blue-500 px-3 py-1 rounded-lg text-white font-medium whitespace-nowrap">公開する</button>
              </div>
            </div>
            <div className="flex min-h-[300px]">
              <div className="hidden md:flex w-44 bg-white/[0.02] border-r border-white/10 p-3 flex-col gap-1 text-xs text-slate-400 flex-shrink-0">
                <div className="text-[10px] font-medium text-slate-500 mb-2 uppercase tracking-wider">ブロックを追加</div>
                {['ヒーロー', 'テキスト', '画像', 'サービス', 'お問合せ', 'マップ', 'FAQ', '営業時間', 'お客様の声', '区切り線', '2カラム', '3カラム'].map((b, i) => (
                  <div key={i} className="px-2 py-1.5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors text-slate-500">{b}</div>
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
              <div className="hidden md:block w-44 bg-white/[0.02] border-l border-white/10 p-3 text-xs text-slate-500 flex-shrink-0">
                <div className="text-[10px] font-medium text-slate-500 mb-2 uppercase tracking-wider">ブロック設定</div>
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] text-slate-600 mb-1">見出し</div>
                    <div className="bg-white/10 rounded px-2 py-1 text-slate-400">当院について</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-600 mb-1">配置</div>
                    <div className="flex gap-1">
                      {['◀', '▌', '▶'].map((a, i) => <button key={i} className={`flex-1 py-1 rounded text-[10px] ${i===1 ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-500'}`}>{a}</button>)}
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <div className="text-[10px] font-medium text-slate-500 mb-2 uppercase tracking-wider">SEO設定</div>
                    <div className="bg-white/10 rounded px-2 py-1 mb-1 text-slate-400">SEOスコア: 87/100</div>
                    <div className="text-[10px] text-emerald-400">LARUbot オン</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="py-16 md:py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-blue-500/70 font-medium text-xs tracking-[0.2em]">テンプレート</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3">業種別テンプレート</h2>
            <p className="text-slate-500">各業種のベストプラクティスを詰め込んだプロテンプレート。SEO設定・構造化データ付き。</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {INDUSTRIES.map((ind, i) => (
              <Link
                key={i}
                href={`/laruHP/onboarding?industry=${ind.id}`}
                className={`rounded-2xl p-5 text-center border transition-all cursor-pointer group ${activeIndustry === i ? 'bg-blue-500/15 border-blue-500/40 scale-105 shadow-[0_0_20px_rgba(59,130,246,0.15)]' : 'bg-white/[0.03] border-white/[0.07] hover:border-blue-500/20 hover:bg-white/[0.06]'}`}
              >
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${ind.color} flex items-center justify-center mx-auto mb-3 text-sm font-semibold text-white/60 group-hover:scale-105 transition-transform`}>
                  {ind.name[0]}
                </div>
                <div className="text-xs font-normal text-slate-400 leading-tight">{ind.name}</div>
              </Link>
            ))}
          </div>
          <p className="text-center text-slate-600 text-xs mt-8">クリックするとそのテンプレートでオンボーディングを開始</p>
        </div>
      </section>

      {/* Showcase — demo site examples */}
      <section id="showcase" className="py-16 md:py-24 px-6 border-t border-white/5 bg-white/[0.015]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-emerald-500/70 font-medium text-xs tracking-[0.2em]">デモ・実例</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3">こんなサイトが作れます</h2>
            <p className="text-slate-500">AIが3分で生成。あとはクリックして好みに調整するだけ。</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Beauty salon demo */}
            <div className="group rounded-2xl overflow-hidden border border-white/10 hover:border-pink-500/30 transition-all shadow-lg hover:shadow-[0_0_40px_rgba(236,72,153,0.08)] bg-white/[0.02]">
              <div className="bg-[#1a1a2e] px-3 py-2 flex items-center gap-2 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-red-500/60 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-yellow-500/60 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-green-500/60 rounded-full" />
                </div>
                <div className="flex-1 bg-white/5 rounded text-[10px] text-slate-500 px-2 py-0.5 text-center">hair-salon-an.laruHP.com</div>
              </div>
              <div className="overflow-hidden" style={{ height: 220 }}>
                {/* Simulated hero */}
                <div className="bg-gradient-to-br from-rose-900 to-pink-950 px-5 py-6 relative" style={{ height: 110 }}>
                  <div className="flex gap-1 mb-3">
                    <div className="h-1.5 w-12 bg-white/20 rounded-full" />
                    <div className="h-1.5 w-8 bg-white/10 rounded-full" />
                    <div className="h-1.5 w-10 bg-white/10 rounded-full" />
                  </div>
                  <div className="h-4 w-40 bg-white/90 rounded mb-2" />
                  <div className="h-2.5 w-56 bg-white/40 rounded mb-1.5" />
                  <div className="h-2.5 w-44 bg-white/30 rounded mb-4" />
                  <div className="inline-flex h-7 w-24 bg-rose-400 rounded-lg items-center justify-center">
                    <div className="h-2 w-14 bg-white/80 rounded-full" />
                  </div>
                </div>
                {/* Simulated 3-col */}
                <div className="bg-white px-4 py-3 grid grid-cols-3 gap-3">
                  {[0,1,2].map(i => (
                    <div key={i} className="text-center">
                      <div className="w-8 h-8 bg-rose-100 rounded-xl mx-auto mb-1.5" />
                      <div className="h-2 w-12 bg-gray-200 rounded mx-auto mb-1" />
                      <div className="h-1.5 w-16 bg-gray-100 rounded mx-auto" />
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50 px-4 py-2.5 flex gap-2">
                  <div className="flex-1 h-14 bg-rose-50 rounded-lg border border-rose-100" />
                  <div className="flex-1 h-14 bg-rose-50 rounded-lg border border-rose-100" />
                </div>
              </div>
              <div className="p-4 border-t border-white/5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold text-white">美容室・サロン</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Hair Salon AN（東京・渋谷区）</div>
                  </div>
                  <Link href="/laruHP/onboarding?industry=beauty" className="text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-lg hover:bg-rose-500/20 transition-all whitespace-nowrap flex-shrink-0">
                    このテンプレで作る →
                  </Link>
                </div>
              </div>
            </div>

            {/* Clinic demo */}
            <div className="group rounded-2xl overflow-hidden border border-white/10 hover:border-emerald-500/30 transition-all shadow-lg hover:shadow-[0_0_40px_rgba(16,185,129,0.08)] bg-white/[0.02]">
              <div className="bg-[#1a1a2e] px-3 py-2 flex items-center gap-2 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-red-500/60 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-yellow-500/60 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-green-500/60 rounded-full" />
                </div>
                <div className="flex-1 bg-white/5 rounded text-[10px] text-slate-500 px-2 py-0.5 text-center">midori-sekkotsu.laruHP.com</div>
              </div>
              <div className="overflow-hidden" style={{ height: 220 }}>
                <div className="bg-gradient-to-br from-emerald-900 to-teal-950 px-5 py-6" style={{ height: 110 }}>
                  <div className="flex gap-1 mb-3">
                    <div className="h-1.5 w-12 bg-white/20 rounded-full" />
                    <div className="h-1.5 w-8 bg-white/10 rounded-full" />
                    <div className="h-1.5 w-10 bg-white/10 rounded-full" />
                  </div>
                  <div className="h-4 w-48 bg-white/90 rounded mb-2" />
                  <div className="h-2.5 w-56 bg-white/40 rounded mb-1.5" />
                  <div className="h-2.5 w-40 bg-white/30 rounded mb-4" />
                  <div className="inline-flex h-7 w-28 bg-emerald-400 rounded-lg items-center justify-center">
                    <div className="h-2 w-18 bg-white/80 rounded-full" />
                  </div>
                </div>
                <div className="bg-white px-4 py-3 grid grid-cols-3 gap-3">
                  {[0,1,2].map(i => (
                    <div key={i} className="text-center">
                      <div className="w-8 h-8 bg-emerald-100 rounded-xl mx-auto mb-1.5" />
                      <div className="h-2 w-14 bg-gray-200 rounded mx-auto mb-1" />
                      <div className="h-1.5 w-16 bg-gray-100 rounded mx-auto" />
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50 px-4 py-2.5">
                  <div className="h-3 w-32 bg-gray-200 rounded mb-2" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-8 bg-emerald-50 rounded border border-emerald-100" />
                    <div className="h-8 bg-emerald-50 rounded border border-emerald-100" />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-white/5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold text-white">整体・クリニック</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">みどり接骨院（大阪・梅田）</div>
                  </div>
                  <Link href="/laruHP/onboarding?industry=clinic" className="text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-all whitespace-nowrap flex-shrink-0">
                    このテンプレで作る →
                  </Link>
                </div>
              </div>
            </div>

            {/* Restaurant demo */}
            <div className="group rounded-2xl overflow-hidden border border-white/10 hover:border-amber-500/30 transition-all shadow-lg hover:shadow-[0_0_40px_rgba(245,158,11,0.08)] bg-white/[0.02]">
              <div className="bg-[#1a1a2e] px-3 py-2 flex items-center gap-2 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-red-500/60 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-yellow-500/60 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-green-500/60 rounded-full" />
                </div>
                <div className="flex-1 bg-white/5 rounded text-[10px] text-slate-500 px-2 py-0.5 text-center">bistro-nakano.laruHP.com</div>
              </div>
              <div className="overflow-hidden" style={{ height: 220 }}>
                <div className="bg-gradient-to-br from-orange-900 to-amber-950 px-5 py-6" style={{ height: 110 }}>
                  <div className="flex gap-1 mb-3">
                    <div className="h-1.5 w-12 bg-white/20 rounded-full" />
                    <div className="h-1.5 w-8 bg-white/10 rounded-full" />
                    <div className="h-1.5 w-10 bg-white/10 rounded-full" />
                  </div>
                  <div className="h-4 w-44 bg-white/90 rounded mb-2" />
                  <div className="h-2.5 w-52 bg-white/40 rounded mb-1.5" />
                  <div className="h-2.5 w-36 bg-white/30 rounded mb-4" />
                  <div className="inline-flex h-7 w-24 bg-amber-400 rounded-lg items-center justify-center">
                    <div className="h-2 w-14 bg-white/80 rounded-full" />
                  </div>
                </div>
                <div className="bg-white px-4 py-3">
                  <div className="h-3 w-28 bg-gray-200 rounded mb-2" />
                  <div className="grid grid-cols-3 gap-1.5">
                    {[0,1,2].map(i => (
                      <div key={i} className="h-16 bg-amber-50 rounded-lg border border-amber-100" />
                    ))}
                  </div>
                </div>
                <div className="bg-orange-950/40 px-4 py-2">
                  <div className="h-2 w-40 bg-white/20 rounded mb-1" />
                  <div className="h-1.5 w-48 bg-white/10 rounded" />
                </div>
              </div>
              <div className="p-4 border-t border-white/5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold text-white">飲食店・カフェ</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Bistro Nakano（東京・中野区）</div>
                  </div>
                  <Link href="/laruHP/onboarding?industry=restaurant" className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-all whitespace-nowrap flex-shrink-0">
                    このテンプレで作る →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Second row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Law firm demo */}
            <div className="group rounded-2xl overflow-hidden border border-white/10 hover:border-slate-400/30 transition-all shadow-lg hover:shadow-[0_0_40px_rgba(148,163,184,0.08)] bg-white/[0.02]">
              <div className="bg-[#1a1a2e] px-3 py-2 flex items-center gap-2 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-red-500/60 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-yellow-500/60 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-green-500/60 rounded-full" />
                </div>
                <div className="flex-1 bg-white/5 rounded text-[10px] text-slate-500 px-2 py-0.5 text-center">yamamoto-law.laruHP.com</div>
              </div>
              <div className="overflow-hidden" style={{ height: 220 }}>
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 py-5" style={{ height: 110 }}>
                  <div className="flex gap-1 mb-3">
                    <div className="h-1.5 w-12 bg-white/20 rounded-none" />
                    <div className="h-1.5 w-8 bg-white/10 rounded-none" />
                    <div className="h-1.5 w-10 bg-white/10 rounded-none" />
                  </div>
                  <div className="h-4 w-44 bg-white/90 rounded-none mb-2" />
                  <div className="h-2.5 w-52 bg-white/40 rounded-none mb-1.5" />
                  <div className="h-2.5 w-36 bg-white/30 rounded-none mb-4" />
                  <div className="inline-flex h-7 w-24 bg-yellow-600 items-center justify-center">
                    <div className="h-2 w-14 bg-white/80 rounded-none" />
                  </div>
                </div>
                <div className="bg-slate-50 px-4 py-3 grid grid-cols-3 gap-3">
                  {[0,1,2].map(i => (
                    <div key={i} className="text-center">
                      <div className="w-8 h-8 bg-slate-200 rounded-none mx-auto mb-1.5 flex items-center justify-center">
                        <div className="w-4 h-4 bg-slate-400 rounded-none" />
                      </div>
                      <div className="h-2 w-12 bg-slate-300 rounded-none mx-auto mb-1" />
                      <div className="h-1.5 w-16 bg-slate-200 rounded-none mx-auto" />
                    </div>
                  ))}
                </div>
                <div className="bg-slate-100 px-4 py-2.5 flex gap-2">
                  <div className="flex-1 h-12 bg-white border border-slate-200 rounded-none p-2">
                    <div className="h-1.5 w-16 bg-slate-300 rounded-none mb-1" />
                    <div className="h-1.5 w-20 bg-slate-200 rounded-none" />
                  </div>
                  <div className="flex-1 h-12 bg-white border border-slate-200 rounded-none p-2">
                    <div className="h-1.5 w-14 bg-slate-300 rounded-none mb-1" />
                    <div className="h-1.5 w-18 bg-slate-200 rounded-none" />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-white/5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold text-white">法律事務所・士業</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">山本法律事務所（東京・丸の内）</div>
                  </div>
                  <Link href="/laruHP/onboarding?industry=legal" className="text-[11px] bg-slate-500/10 text-slate-300 border border-slate-500/20 px-3 py-1.5 rounded-lg hover:bg-slate-500/20 transition-all whitespace-nowrap flex-shrink-0">
                    このテンプレで作る →
                  </Link>
                </div>
              </div>
            </div>

            {/* Fitness gym demo */}
            <div className="group rounded-2xl overflow-hidden border border-white/10 hover:border-red-500/30 transition-all shadow-lg hover:shadow-[0_0_40px_rgba(239,68,68,0.08)] bg-white/[0.02]">
              <div className="bg-[#1a1a2e] px-3 py-2 flex items-center gap-2 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-red-500/60 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-yellow-500/60 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-green-500/60 rounded-full" />
                </div>
                <div className="flex-1 bg-white/5 rounded text-[10px] text-slate-500 px-2 py-0.5 text-center">ironbody-gym.laruHP.com</div>
              </div>
              <div className="overflow-hidden" style={{ height: 220 }}>
                <div className="bg-gradient-to-br from-red-950 to-orange-950 px-5 py-5 relative" style={{ height: 110 }}>
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)', backgroundSize: '8px 8px' }} />
                  <div className="relative flex gap-1 mb-3">
                    <div className="h-1.5 w-12 bg-white/20 rounded-full" />
                    <div className="h-1.5 w-8 bg-white/10 rounded-full" />
                    <div className="h-1.5 w-10 bg-white/10 rounded-full" />
                  </div>
                  <div className="relative h-5 w-48 bg-white/90 rounded mb-2" />
                  <div className="relative h-2.5 w-44 bg-white/40 rounded mb-4" />
                  <div className="relative inline-flex h-7 w-28 bg-red-500 rounded items-center justify-center">
                    <div className="h-2 w-18 bg-white/90 rounded-full" />
                  </div>
                </div>
                <div className="bg-zinc-900 px-4 py-3 grid grid-cols-3 gap-2">
                  {['胸・腹', '背・肩', '脚・臀'].map((_t, i) => (
                    <div key={i} className="bg-zinc-800 rounded-lg p-2 text-center border border-zinc-700">
                      <div className="h-6 w-6 bg-red-500/30 rounded mx-auto mb-1" />
                      <div className="h-1.5 w-10 bg-zinc-600 rounded mx-auto" />
                    </div>
                  ))}
                </div>
                <div className="bg-zinc-900 px-4 py-2 flex items-center justify-between border-t border-zinc-800">
                  <div>
                    <div className="h-2 w-20 bg-red-400/50 rounded mb-1" />
                    <div className="h-1.5 w-28 bg-zinc-600 rounded" />
                  </div>
                  <div className="h-7 w-16 bg-red-600 rounded flex items-center justify-center">
                    <div className="h-1.5 w-10 bg-white/70 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-white/5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold text-white">フィットネス・ジム</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">IRON BODY GYM（大阪・難波）</div>
                  </div>
                  <Link href="/laruHP/onboarding?industry=fitness" className="text-[11px] bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-all whitespace-nowrap flex-shrink-0">
                    このテンプレで作る →
                  </Link>
                </div>
              </div>
            </div>

            {/* Hotel/bridal demo */}
            <div className="group rounded-2xl overflow-hidden border border-white/10 hover:border-sky-500/30 transition-all shadow-lg hover:shadow-[0_0_40px_rgba(14,165,233,0.08)] bg-white/[0.02]">
              <div className="bg-[#1a1a2e] px-3 py-2 flex items-center gap-2 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-red-500/60 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-yellow-500/60 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-green-500/60 rounded-full" />
                </div>
                <div className="flex-1 bg-white/5 rounded text-[10px] text-slate-500 px-2 py-0.5 text-center">hotel-seabreeze.laruHP.com</div>
              </div>
              <div className="overflow-hidden" style={{ height: 220 }}>
                <div className="bg-gradient-to-br from-sky-900 to-blue-950 px-5 py-5" style={{ height: 110 }}>
                  <div className="flex gap-1 mb-3">
                    <div className="h-1.5 w-12 bg-white/20 rounded-full" />
                    <div className="h-1.5 w-8 bg-white/10 rounded-full" />
                    <div className="h-1.5 w-10 bg-white/10 rounded-full" />
                  </div>
                  <div className="h-4 w-52 bg-white/90 rounded mb-2" />
                  <div className="h-2.5 w-48 bg-white/40 rounded mb-1.5" />
                  <div className="h-2.5 w-36 bg-white/25 rounded mb-4" />
                  <div className="inline-flex h-7 w-24 bg-sky-400 rounded-full items-center justify-center">
                    <div className="h-2 w-14 bg-white/90 rounded-full" />
                  </div>
                </div>
                <div className="bg-white px-4 py-2.5 grid grid-cols-3 gap-1.5">
                  {[0,1,2].map(i => (
                    <div key={i} className="h-16 bg-sky-50 rounded-lg border border-sky-100 flex flex-col justify-end p-1.5">
                      <div className="h-1.5 w-10 bg-sky-200 rounded-full mx-auto" />
                    </div>
                  ))}
                </div>
                <div className="bg-sky-50 px-4 py-2 flex items-center gap-2">
                  <div className="flex-1 bg-white rounded-lg border border-sky-100 h-8 flex items-center px-2">
                    <div className="h-1.5 w-14 bg-sky-200 rounded-full" />
                  </div>
                  <div className="h-8 w-16 bg-sky-500 rounded-full flex items-center justify-center">
                    <div className="h-1.5 w-10 bg-white/80 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-white/5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold text-white">ホテル・旅館・民泊</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">SEABREEZE HOTEL（沖縄・那覇）</div>
                  </div>
                  <Link href="/laruHP/onboarding?industry=hotel" className="text-[11px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-3 py-1.5 rounded-lg hover:bg-sky-500/20 transition-all whitespace-nowrap flex-shrink-0">
                    このテンプレで作る →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-10">
            <Link href="/laruHP/onboarding" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors border border-white/10 hover:border-white/20 px-5 py-2.5 rounded-xl">
              全テンプレートを見る →
            </Link>
          </div>
        </div>
      </section>

      {/* LARUbot + LARUSEO Integration */}
      <section className="py-16 md:py-24 px-6 border-t border-white/5 bg-white/[0.015]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-blue-500/70 font-medium text-xs tracking-[0.2em]">連携機能</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3">強力な連携機能</h2>
            <p className="text-slate-500">AIチャットボット・SEOツールとシームレスに連携。集客を自動化します。</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-3xl p-8 hover:border-indigo-500/35 transition-all">
              <div className="inline-block bg-indigo-500/15 text-indigo-400 text-xs font-medium px-3 py-1 rounded-full mb-4">LARUbot 連携</div>
              <h3 className="text-xl font-semibold mb-3">AIチャットボットを即導入</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                LARUVisonaのAIチャットボット「LARUbot」をワンクリックで埋め込み。24時間365日、問い合わせ対応・予約受付・FAQ対応を自動化します。
              </p>
              <div className="bg-white/[0.04] rounded-2xl p-4 text-sm text-slate-400 font-mono space-y-1.5">
                <div className="text-slate-500">① エディタ → 連携設定</div>
                <div className="text-slate-500">② LARUbotアカウントを接続</div>
                <div className="text-slate-400">③ ウィジェットをオン → 完了</div>
              </div>
              <a href="https://larubot.tokyo" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-indigo-400/80 hover:text-indigo-300 text-sm mt-4 transition-colors">
                LARUbot公式サイト →
              </a>
            </div>
            <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-3xl p-8 hover:border-emerald-500/35 transition-all">
              <div className="inline-block bg-emerald-500/15 text-emerald-400 text-xs font-medium px-3 py-1 rounded-full mb-4">LARUSEO 連携</div>
              <h3 className="text-xl font-semibold mb-3">SEO分析をリアルタイムで</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                SEO分析ツール「LARUSEO」と連携してSEOスコアをリアルタイム表示。キーワード分析・競合比較・改善提案をエディタ内で確認できます。
              </p>
              <div className="bg-white/[0.04] rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">SEOスコア</span>
                  <span className="text-emerald-400 font-semibold">87 / 100</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div className="bg-emerald-400/70 h-1.5 rounded-full" style={{ width: '87%' }} />
                </div>
                <div className="text-xs text-slate-600">メタタグ ✓ 構造化データ ✓ 画像alt ✓ ページ速度 ✓</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agency section */}
      <section className="py-16 md:py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-purple-400/70 font-medium text-xs tracking-[0.2em]">代理店・制作会社向け</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">Web制作会社・フリーランス向け</h2>
              <p className="text-slate-400 text-base leading-relaxed mb-6">
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
                  <li key={i} className="flex items-center gap-3 text-slate-400 text-sm">
                    <span className="text-lg flex-shrink-0">{item.icon}</span>
                    {item.text}
                  </li>
                ))}
              </ul>
              <Link href="/laruHP/onboarding"
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all">
                エージェンシープランで始める →
              </Link>
            </div>
            <div className="bg-[#1e293b] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-white/5 border-b border-white/10 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                </div>
                <span className="text-slate-500 text-xs">エージェンシー管理画面</span>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { name: '山田商店', domain: 'yamada-store.com', pv: '1,240', status: '公開中', contacts: 3, color: 'green' },
                  { name: '田中整体院', domain: 'tanaka-sekkotsu.com', pv: '3,891', status: '公開中', contacts: 7, color: 'green' },
                  { name: 'カフェ・ノア', domain: '（設定中）', pv: '0', status: '下書き', contacts: 0, color: 'slate' },
                ].map((site, i) => (
                  <div key={i} className="bg-white/5 border border-white/[0.07] rounded-xl p-3 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${site.color === 'green' ? 'bg-green-400' : 'bg-slate-600'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-semibold">{site.name}</div>
                      <div className="text-slate-600 text-[11px]">{site.domain}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-slate-400 text-xs">{site.pv} PV</div>
                      {site.contacts > 0 && <div className="text-blue-400 text-[11px]">✉ {site.contacts}件</div>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${site.color === 'green' ? 'bg-green-900/30 text-green-400 border-green-500/30' : 'bg-white/5 text-slate-500 border-white/10'}`}>
                      {site.status}
                    </span>
                  </div>
                ))}
                <div className="text-center">
                  <button className="text-xs text-slate-600 hover:text-slate-400 py-1">+ 新規クライアントサイト</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 md:py-24 px-6 bg-slate-50 border-t border-gray-200">
        <div className="max-w-5xl mx-auto text-center">
          <span className="text-blue-600 font-medium text-xs tracking-[0.2em]">料金プラン</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3 text-gray-900">料金プラン</h2>
          <p className="text-gray-500 mb-2">全プラン 初月1円・最低6ヶ月契約。7ヶ月目からいつでも解約可。</p>
          <p className="text-gray-400 text-xs mb-12">クレジットカード決済 / Stripe安全決済</p>

          <div className="grid md:grid-cols-3 gap-5 mb-8">
            {PLANS.map((plan) => (
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

                <div className="mb-1">
                  <span className="text-gray-400 text-base">¥</span>
                  <span className="text-4xl font-bold text-gray-900">{plan.price.toLocaleString()}</span>
                </div>
                <div className="text-gray-400 text-xs mb-1">/ 月（税別）</div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-medium px-3 py-1 rounded-full mb-6 self-start">
                  初月1円
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
                  初月1円で始める →
                </Link>
              </div>
            ))}
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

      {/* Testimonials */}
      <section className="py-16 md:py-24 px-6 bg-slate-50 border-t border-gray-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-blue-600 font-medium text-xs tracking-[0.2em]">お客様の声</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3 text-gray-900">導入オーナーの声</h2>
            <p className="text-gray-500 text-sm">全国の小規模ビジネスオーナーにご利用いただいています</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                name: '田中 恵美', role: '美容室オーナー', location: '東京都渋谷区', stars: 5,
                text: '以前はWeb制作会社に頼んで30万円かかっていました。LARUHPなら月999円で同じクオリティのサイトが持てて、内容も自分で更新できます。集客のお問い合わせが月に15件以上増えました。',
                icon: '✂️',
              },
              {
                name: '鈴木 健一', role: '整体院院長', location: '大阪府梅田', stars: 5,
                text: 'AIが業種に合わせたコピーを自動生成してくれるのが驚きでした。「地域名 + 整体」の検索で3ページ目から1ページ目に上がり、新規患者が月10名以上増えています。',
                icon: '🏥',
              },
              {
                name: '佐藤 陽子', role: '飲食店オーナー', location: '福岡県博多区', stars: 5,
                text: 'スマホだけで操作できて、写真の差し替えもメニューの更新も5分でできます。LARUbotを追加してから電話対応が半分に減って、調理に集中できるようになりました。',
                icon: '🍽️',
              },
            ].map((t, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-4 hover:border-blue-200 hover:shadow-md transition-all shadow-sm">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }, (_, j) => (
                    <span key={j} className="text-amber-400 text-sm">★</span>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed flex-1">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 border border-gray-200 flex items-center justify-center text-base flex-shrink-0">
                    {t.icon}
                  </div>
                  <div>
                    <div className="text-gray-900 text-sm font-semibold">{t.name}</div>
                    <div className="text-gray-400 text-xs">{t.role} · {t.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-center gap-8 text-center">
            {[['2,400+', '導入サイト数'], ['4.9 / 5.0', '平均評価'], ['87%', '6ヶ月継続率']].map(([val, label]) => (
              <div key={label}>
                <div className="text-2xl font-bold text-gray-900">{val}</div>
                <div className="text-gray-400 text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 md:py-24 px-6 border-t border-white/5 bg-white/[0.015]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-blue-500/70 font-medium text-xs tracking-[0.2em]">よくある質問</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3">よくある質問</h2>
          </div>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-white/15 transition-all">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full text-left p-5 flex justify-between items-start gap-4">
                  <span className="font-medium text-sm leading-relaxed text-slate-200">{item.q}</span>
                  <span className="text-slate-500 text-lg mt-0.5 flex-shrink-0">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-slate-500 text-sm leading-relaxed border-t border-white/5 pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32 px-6 border-t border-white/5 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse,rgba(59,130,246,0.06),transparent_70%)]" />
        </div>
        <div className="max-w-3xl mx-auto relative">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full text-blue-400/80 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
            初月1円キャンペーン実施中
          </div>
          <h2 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
            あなたのビジネスを、<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">今日から変える。</span>
          </h2>
          <p className="text-slate-500 text-base mb-10 max-w-xl mx-auto">業種情報を入力するだけ。5分後にはプロ品質のHPが完成しています。</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/laruHP/onboarding"
              className="bg-white text-black px-10 py-4 rounded-2xl font-bold text-base hover:scale-105 transition-transform shadow-[0_0_50px_rgba(255,255,255,0.12)] inline-flex items-center gap-3 justify-center">
              無料で始める（初月1円） <span className="text-blue-600">→</span>
            </Link>
            <Link href="/laruHP/builder"
              className="border border-white/15 text-slate-300 hover:text-white px-10 py-4 rounded-2xl font-medium text-base hover:border-white/30 transition-all inline-flex items-center gap-2 justify-center">
              ▶ まずデモを見る
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-5 text-xs text-slate-600">
            <span>✓ クレジットカード決済</span>
            <span>✓ 初月1円</span>
            <span>✓ 最短5分で完成</span>
            <span>✓ SSL・サーバー込み</span>
            <span>✓ 7ヶ月目から解約可</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 text-slate-600 text-sm">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
            <div className="flex-shrink-0">
              <div className="text-white font-semibold text-base mb-2">LARU<span className="text-slate-600 font-light">HP</span></div>
              <p className="text-slate-500 text-xs max-w-xs leading-relaxed">AIで最高のホームページを最短で。株式会社LARUVisonaが提供するHP作成SaaSサービスです。</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-6 text-xs w-full md:w-auto">
              <div>
                <div className="text-slate-500 font-medium mb-2">サービス</div>
                <div className="space-y-1.5">
                  <div><a href="#features" className="hover:text-slate-300 transition-colors">機能一覧</a></div>
                  <div><a href="#templates" className="hover:text-slate-300 transition-colors">テンプレート</a></div>
                  <div><a href="#pricing" className="hover:text-slate-300 transition-colors">料金</a></div>
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-medium mb-2">LARUVisona</div>
                <div className="space-y-1.5">
                  <div><Link href="/" className="hover:text-slate-300 transition-colors">会社サイト</Link></div>
                  <div><a href="https://larubot.tokyo" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">LARUbot</a></div>
                  <div><Link href="/#contact" className="hover:text-slate-300 transition-colors">お問い合わせ</Link></div>
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-medium mb-2">アカウント</div>
                <div className="space-y-1.5">
                  <div><Link href="/laruHP/auth/login" className="hover:text-slate-300 transition-colors">ログイン</Link></div>
                  <div><Link href="/laruHP/auth/signup" className="hover:text-slate-300 transition-colors">新規登録</Link></div>
                  <div><Link href="/laruHP/dashboard" className="hover:text-slate-300 transition-colors">ダッシュボード</Link></div>
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-medium mb-2">法的情報</div>
                <div className="space-y-1.5">
                  <div><Link href="/laruHP/terms" className="hover:text-slate-300 transition-colors">利用規約</Link></div>
                  <div><Link href="/laruHP/privacy" className="hover:text-slate-300 transition-colors">プライバシー</Link></div>
                  <div><Link href="/laruHP/tokusho" className="hover:text-slate-300 transition-colors">特定商取引法</Link></div>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 text-center text-xs">
            © 2026 株式会社LARUVisona. All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
