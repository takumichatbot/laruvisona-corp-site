'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const INDUSTRIES = [
  { emoji: '🍜', name: '飲食店・カフェ', id: 'restaurant' },
  { emoji: '💇', name: '美容室・サロン', id: 'beauty' },
  { emoji: '💊', name: '整体・クリニック', id: 'clinic' },
  { emoji: '⚖️', name: '士業・コンサル', id: 'legal' },
  { emoji: '🏗️', name: '建設・工務店', id: 'construction' },
  { emoji: '🏠', name: '不動産', id: 'realestate' },
  { emoji: '🛍️', name: '小売・EC', id: 'retail' },
  { emoji: '💪', name: 'フィットネス', id: 'fitness' },
  { emoji: '🏨', name: 'ホテル・旅館', id: 'hotel' },
  { emoji: '📚', name: '教育・スクール', id: 'education' },
];

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI自動コンテンツ生成',
    desc: '業種と情報を入力するだけ。AIが魅力的なコピーと最適なレイアウトを自動生成します。',
    color: 'blue',
  },
  {
    icon: '🎨',
    title: '直感的なビジュアルエディタ',
    desc: 'プログラミング不要。ブロックを追加・編集するだけでプロ品質のサイトに。画像・テキスト・カラム・ライン何でも対応。',
    color: 'purple',
  },
  {
    icon: '📈',
    title: 'SEO最大化エンジン',
    desc: 'メタタグ・構造化データ・ページ速度最適化を自動設定。業種別JSON-LDスキーマで検索上位表示を狙います。',
    color: 'green',
  },
  {
    icon: '🤝',
    title: 'LARUbot ワンクリック連携',
    desc: 'AIチャットボット「LARUbot」をエディタからワンクリックで埋め込み。24時間問い合わせ対応を自動化。',
    color: 'indigo',
  },
  {
    icon: '📊',
    title: 'LARUSEO 連携',
    desc: 'SEO分析ツール「LARUSEO」でリアルタイムSEOスコア確認。キーワード分析・改善提案も自動で。',
    color: 'emerald',
  },
  {
    icon: '📱',
    title: '完全レスポンシブ',
    desc: 'PC・スマホ・タブレットで完璧に表示。モバイルファーストなデザインで機会損失をゼロに。',
    color: 'cyan',
  },
];

const PLAN_FEATURES = [
  '独自ドメイン対応（サブドメイン無料）',
  'AI自動コンテンツ生成（無制限）',
  'ビジュアルエディタ（全ブロック）',
  '業種別テンプレート 全種類',
  'SEO自動最適化（メタタグ・構造化データ）',
  'LARUbot連携（AIチャットボット）',
  'LARUSEO連携（SEO分析ツール）',
  'SSL証明書・サーバー費用込み',
  'モバイル完全対応',
  'Google Analytics連携',
  '画像・動画アップロード 5GB',
  'お問い合わせフォーム自動設置',
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
  blue: 'border-blue-500/30 bg-blue-500/10',
  purple: 'border-purple-500/30 bg-purple-500/10',
  green: 'border-green-500/30 bg-green-500/10',
  indigo: 'border-indigo-500/30 bg-indigo-500/10',
  emerald: 'border-emerald-500/30 bg-emerald-500/10',
  cyan: 'border-cyan-500/30 bg-cyan-500/10',
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
            <span className="font-bold tracking-tight text-lg">LARU<span className="text-blue-400 font-light">HP</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">機能</a>
            <a href="#templates" className="hover:text-white transition-colors">テンプレート</a>
            <a href="#pricing" className="hover:text-white transition-colors">料金</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <Link href="/" className="hover:text-white transition-colors">← 会社サイトへ</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/laruHP/builder" className="hidden md:block text-slate-400 hover:text-white border border-white/10 hover:border-white/30 px-4 py-2 rounded-xl text-sm transition-all">
              デモを見る
            </Link>
            <Link href="/laruHP/onboarding" className="bg-white text-black px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all">
              今すぐ始める →
            </Link>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-white w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl border border-white/10">
              <i className={`fas ${isMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
            </button>
          </div>
        </div>
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-[#030712]/95 backdrop-blur-xl border-b border-white/5 p-6 flex flex-col gap-4">
            <a href="#features" onClick={() => setIsMenuOpen(false)} className="text-slate-300 hover:text-white py-2">機能</a>
            <a href="#templates" onClick={() => setIsMenuOpen(false)} className="text-slate-300 hover:text-white py-2">テンプレート</a>
            <a href="#pricing" onClick={() => setIsMenuOpen(false)} className="text-slate-300 hover:text-white py-2">料金</a>
            <a href="#faq" onClick={() => setIsMenuOpen(false)} className="text-slate-300 hover:text-white py-2">FAQ</a>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="pt-36 pb-28 px-6 text-center relative overflow-hidden">
        {/* 背景グラデーション群 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.12),transparent_65%)]" />
          <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full bg-blue-600/5 blur-3xl" />
          <div className="absolute top-32 right-1/4 w-56 h-56 rounded-full bg-cyan-500/5 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '80px 80px' }} />
        </div>

        <div className="max-w-5xl mx-auto relative">
          {/* バッジ */}
          <div className="inline-flex items-center gap-2.5 bg-blue-500/10 border border-blue-500/25 px-5 py-2.5 rounded-full text-blue-400 text-xs font-bold tracking-widest mb-10 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            NEW — AI搭載 HPビルダー 2026
          </div>

          {/* メインタイトル */}
          <h1 className="text-6xl md:text-[6.5rem] font-black tracking-tighter mb-6 leading-[1.02]">
            <span className="block text-white">最高のHPを、</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 animate-[gradient_4s_ease_infinite]">
              最短5分で。
            </span>
          </h1>

          <p className="text-slate-400 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            業種情報を入力するだけ。AIが<strong className="text-white">5分以内</strong>にプロ品質のホームページを自動生成。<br className="hidden md:block" />
            SEO・LARUbot連携・ビジュアル編集がすべて月額<strong className="text-white">999円</strong>。
          </p>

          {/* CTA ボタン */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
            <Link href="/laruHP/onboarding"
              className="relative bg-white text-black px-9 py-4 rounded-2xl font-black text-lg hover:scale-105 transition-transform shadow-[0_0_50px_rgba(255,255,255,0.15)] flex items-center gap-3 w-full sm:w-auto justify-center overflow-hidden group">
              <span className="absolute inset-0 bg-gradient-to-r from-blue-100 to-cyan-100 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative">無料で始める（初月1円）</span>
              <span className="relative text-blue-600 font-black">→</span>
            </Link>
            <Link href="/laruHP/builder"
              className="text-slate-300 hover:text-white px-9 py-4 rounded-2xl font-bold text-lg border border-white/10 hover:border-white/30 transition-all flex items-center gap-2.5 w-full sm:w-auto justify-center backdrop-blur-sm">
              <span className="text-blue-400">▶</span> デモを体験
            </Link>
          </div>
          <p className="text-slate-600 text-xs">初月1円 → 月額999円（税別）/ 最低6ヶ月 / クレジットカード決済</p>

          {/* フローティングバッジ */}
          <div className="hidden md:flex justify-center gap-3 mt-8 flex-wrap">
            {['🤖 AIコンテンツ生成', '📈 SEO自動最適化', '🤝 LARUbot連携', '📱 モバイル完全対応', '🔒 SSL込み'].map((tag, i) => (
              <span key={i} className="bg-white/5 border border-white/10 text-slate-400 text-xs px-3 py-1.5 rounded-full hover:border-white/20 hover:text-slate-200 transition-all">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="max-w-3xl mx-auto mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { num: '5分', label: 'でサイト完成', sub: 'AI自動生成', color: 'from-blue-500/20 to-transparent' },
            { num: '10+', label: '業種テンプレート', sub: '随時追加中', color: 'from-purple-500/20 to-transparent' },
            { num: '999円', label: '/月（初月1円）', sub: '税別', color: 'from-cyan-500/20 to-transparent' },
            { num: '100%', label: 'SEO自動化', sub: 'AI最適化', color: 'from-emerald-500/20 to-transparent' },
          ].map((stat, i) => (
            <div key={i} className={`relative bg-gradient-to-br ${stat.color} border border-white/10 rounded-2xl p-5 text-center backdrop-blur-sm hover:border-white/20 hover:-translate-y-1 transition-all duration-300 overflow-hidden`}>
              <div className="text-2xl md:text-3xl font-black text-white">{stat.num}</div>
              <div className="text-xs text-white/80 font-bold mt-1">{stat.label}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-blue-500 font-bold text-xs tracking-[0.2em] uppercase">HOW IT WORKS</span>
            <h2 className="text-3xl md:text-5xl font-black mt-4 mb-4">3ステップで完成</h2>
            <p className="text-slate-400">5分でプロ品質のHPが完成します</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-12 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-[1px] bg-gradient-to-r from-blue-500/40 via-blue-500/20 to-blue-500/40" />
            {[
              { step: '01', title: '情報を入力', desc: '業種・店舗名・住所・サービス内容などを入力。AIが残りを全部やってくれます。', icon: '📝', tag: '約2分' },
              { step: '02', title: 'AIが自動生成', desc: '業種に最適化されたテンプレートにビジネス情報を組み込み、コンテンツを自動作成。', icon: '🤖', tag: '約1分' },
              { step: '03', title: 'エディタで仕上げ', desc: 'ビジュアルエディタで微調整。画像変更・テキスト編集・ブロック追加削除が直感的に。', icon: '🎨', tag: '約2分' },
            ].map((step, i) => (
              <div key={i} className="relative bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-blue-500/30 hover:-translate-y-1 transition-all duration-300">
                <div className="absolute top-4 right-4 bg-blue-500/20 text-blue-400 text-xs font-bold px-2 py-1 rounded-full">{step.tag}</div>
                <div className="text-4xl mb-4">{step.icon}</div>
                <div className="text-blue-500 font-black text-xs tracking-[0.2em] mb-2 font-mono">STEP {step.step}</div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 border-t border-white/5 bg-white/[0.015]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-blue-500 font-bold text-xs tracking-[0.2em] uppercase">FEATURES</span>
            <h2 className="text-3xl md:text-5xl font-black mt-4 mb-4">すべてが揃っている</h2>
            <p className="text-slate-400 text-lg">プロのエージェンシーが使う機能を、月額<strong className="text-white">999円</strong>で。</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className={`border rounded-2xl p-6 hover:-translate-y-1 transition-all duration-300 ${COLOR_MAP[f.color]}`}>
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Editor preview mock */}
          <div className="mt-16 bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <div className="bg-white/5 border-b border-white/10 px-4 py-3 flex items-center gap-3">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
              </div>
              <div className="flex-1 bg-white/10 rounded-lg px-3 py-1 text-xs text-slate-400 font-mono">your-shop.laruvisona.com</div>
              <div className="flex gap-2">
                <button className="text-xs bg-white/10 px-3 py-1 rounded-lg text-slate-300">👁 プレビュー</button>
                <button className="text-xs bg-blue-500 px-3 py-1 rounded-lg text-white font-bold">公開する</button>
              </div>
            </div>
            <div className="flex min-h-[300px]">
              {/* Left sidebar mock */}
              <div className="w-48 bg-white/3 border-r border-white/10 p-3 flex flex-col gap-1 text-xs text-slate-400">
                <div className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">ブロックを追加</div>
                {['🦸 ヒーロー', '📝 テキスト', '🖼 画像', '⚡ サービス', '📞 お問合せ', '📍 マップ', '❓ FAQ', '🕐 営業時間', '⭐ お客様の声', '➖ 区切り線', '📋 2カラム', '🏗 3カラム'].map((b, i) => (
                  <div key={i} className="px-2 py-1.5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors">{b}</div>
                ))}
              </div>
              {/* Canvas mock */}
              <div className="flex-1 bg-white p-4 flex flex-col gap-3">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 text-white text-center">
                  <div className="text-lg font-black mb-1">〇〇整体院</div>
                  <div className="text-xs opacity-80">地域No.1の施術技術で、あなたの痛みを根本から解決します</div>
                  <button className="mt-3 bg-white text-blue-600 text-xs px-4 py-1.5 rounded-full font-bold">無料相談はこちら</button>
                </div>
                <div className="border-2 border-blue-500 rounded-xl relative">
                  <div className="absolute -top-3 left-2 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded font-bold">選択中</div>
                  <div className="p-4 text-center">
                    <div className="text-sm font-bold text-gray-800 mb-1">当院について</div>
                    <div className="text-xs text-gray-500">2010年創業。延べ10,000人以上の施術実績...</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['首・肩', '腰痛', '膝'].map(s => (
                    <div key={s} className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-lg">💆</div>
                      <div className="text-xs font-bold text-gray-700">{s}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Right panel mock */}
              <div className="w-48 bg-white/3 border-l border-white/10 p-3 text-xs text-slate-400">
                <div className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">ブロック設定</div>
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">見出し</div>
                    <div className="bg-white/10 rounded px-2 py-1">当院について</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">配置</div>
                    <div className="flex gap-1">
                      {['◀', '▌', '▶'].map((a, i) => <button key={i} className={`flex-1 py-1 rounded text-[10px] ${i===1 ? 'bg-blue-500 text-white' : 'bg-white/10'}`}>{a}</button>)}
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <div className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">SEO設定</div>
                    <div className="bg-white/10 rounded px-2 py-1 mb-1">SEOスコア: 87/100</div>
                    <div className="text-[10px] text-emerald-400">✅ LARUbotオン</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-blue-500 font-bold text-xs tracking-[0.2em] uppercase">TEMPLATES</span>
            <h2 className="text-3xl md:text-5xl font-black mt-4 mb-4">業種別テンプレート</h2>
            <p className="text-slate-400 text-lg">各業種のベストプラクティスを詰め込んだプロテンプレート。SEO設定・構造化データ付き。</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {INDUSTRIES.map((ind, i) => (
              <Link
                key={i}
                href={`/laruHP/onboarding?industry=${ind.id}`}
                className={`rounded-2xl p-5 text-center border transition-all cursor-pointer group ${activeIndustry === i ? 'bg-blue-500/20 border-blue-500/50 scale-105 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'bg-white/5 border-white/10 hover:border-blue-500/30 hover:bg-white/10'}`}
              >
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{ind.emoji}</div>
                <div className="text-sm font-medium text-slate-300 leading-tight">{ind.name}</div>
              </Link>
            ))}
          </div>
          <p className="text-center text-slate-500 text-sm mt-8">クリックするとそのテンプレートでオンボーディングを開始</p>
        </div>
      </section>

      {/* LARUbot + LARUSEO Integration */}
      <section className="py-24 px-6 border-t border-white/5 bg-white/[0.015]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-blue-500 font-bold text-xs tracking-[0.2em] uppercase">INTEGRATIONS</span>
            <h2 className="text-3xl md:text-5xl font-black mt-4 mb-4">強力な連携機能</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-3xl p-8 hover:border-indigo-500/50 transition-all">
              <div className="text-4xl mb-4">🤖</div>
              <div className="inline-block bg-indigo-500/20 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full mb-3">LARUbot 連携</div>
              <h3 className="text-2xl font-black mb-4">AIチャットボットを即導入</h3>
              <p className="text-slate-400 leading-relaxed mb-6">
                LARUVisonaのAIチャットボット「LARUbot」をワンクリックで埋め込み。24時間365日、問い合わせ対応・予約受付・FAQ対応を自動化します。
              </p>
              <div className="bg-white/5 rounded-2xl p-4 text-sm text-slate-300 font-mono space-y-1">
                <div>① エディタ → 連携設定</div>
                <div>② LARUbotアカウントを接続</div>
                <div>③ ウィジェットをオン → 完了 ✅</div>
              </div>
              <a href="https://larubot.tokyo" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm mt-4">
                LARUbot公式サイト →
              </a>
            </div>
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-3xl p-8 hover:border-emerald-500/50 transition-all">
              <div className="text-4xl mb-4">📊</div>
              <div className="inline-block bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full mb-3">LARUSEO 連携</div>
              <h3 className="text-2xl font-black mb-4">SEO分析をリアルタイムで</h3>
              <p className="text-slate-400 leading-relaxed mb-6">
                SEO分析ツール「LARUSEO」と連携してSEOスコアをリアルタイム表示。キーワード分析・競合比較・改善提案をエディタ内で確認できます。
              </p>
              <div className="bg-white/5 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">SEOスコア</span>
                  <span className="text-emerald-400 font-bold">87 / 100</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div className="bg-emerald-400 h-2 rounded-full" style={{ width: '87%' }} />
                </div>
                <div className="text-xs text-slate-500">メタタグ ✅ 構造化データ ✅ 画像alt ✅ ページ速度 ✅</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-blue-500 font-bold text-xs tracking-[0.2em] uppercase">PRICING</span>
          <h2 className="text-3xl md:text-5xl font-black mt-4 mb-4">シンプルな料金</h2>
          <p className="text-slate-400 text-lg mb-12">すべての機能が使えるプラン1つだけ。隠れたコストゼロ。</p>

          <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent border border-blue-500/30 rounded-3xl p-10 relative overflow-hidden">
            <div className="absolute top-5 right-5 bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
              🎁 初月1円
            </div>

            <div className="mb-2">
              <span className="text-slate-500 text-2xl">¥</span>
              <span className="text-7xl font-black">999</span>
            </div>
            <div className="text-slate-400 mb-2">/ 月（税別）</div>
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm text-slate-300 mb-10">
              <span>最低契約期間 6ヶ月</span>
              <span className="text-slate-600">|</span>
              <span>7ヶ月目〜いつでも解約可</span>
            </div>

            <ul className="text-left space-y-3 mb-10 max-w-md mx-auto">
              {PLAN_FEATURES.map((item, i) => (
                <li key={i} className="text-sm text-slate-300 flex items-center gap-3">
                  <span className="text-emerald-400 text-base">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <Link href="/laruHP/onboarding" className="bg-white text-black font-black text-lg px-12 py-4 rounded-2xl hover:scale-105 transition-transform inline-block shadow-[0_0_40px_rgba(255,255,255,0.15)]">
              初月1円で始める →
            </Link>
            <p className="text-slate-600 text-xs mt-4">クレジットカード決済 / Stripe安全決済 / 自動更新（7ヶ月目〜）</p>
          </div>

          {/* Competitor comparison */}
          <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 text-xs border-b border-white/10">
              <div className="p-3 text-slate-500">サービス</div>
              <div className="p-3 text-slate-500 text-center">月額</div>
              <div className="p-3 text-slate-500 text-center">AI機能</div>
              <div className="p-3 text-slate-500 text-center">SEO自動化</div>
            </div>
            {[
              { name: 'LARU HP', price: '999円〜', ai: '✅ フル搭載', seo: '✅ 完全自動', highlight: true },
              { name: 'Wix', price: '2,000円〜', ai: '△ 限定的', seo: '△ 手動設定' },
              { name: 'STUDIO', price: '2,000円〜', ai: '❌ なし', seo: '△ 手動設定' },
              { name: 'WordPress.com', price: '1,100円〜', ai: '❌ なし', seo: '△ プラグイン必要' },
            ].map((row, i) => (
              <div key={i} className={`grid grid-cols-4 text-xs border-b border-white/5 last:border-0 ${row.highlight ? 'bg-blue-500/10 text-white font-bold' : 'text-slate-400'}`}>
                <div className="p-3">{row.name}</div>
                <div className="p-3 text-center">{row.price}</div>
                <div className="p-3 text-center">{row.ai}</div>
                <div className="p-3 text-center">{row.seo}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 border-t border-white/5 bg-white/[0.015]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-blue-500 font-bold text-xs tracking-[0.2em] uppercase">FAQ</span>
            <h2 className="text-3xl md:text-5xl font-black mt-4">よくある質問</h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full text-left p-6 flex justify-between items-start gap-4">
                  <span className="font-bold leading-tight">{item.q}</span>
                  <span className="text-slate-400 text-xl mt-0.5 flex-shrink-0">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-slate-400 text-sm leading-relaxed border-t border-white/5 pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 border-t border-white/5 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse,rgba(59,130,246,0.08),transparent_70%)]" />
        </div>
        <div className="max-w-3xl mx-auto relative">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full text-blue-400 text-xs font-bold mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
            初月1円キャンペーン実施中
          </div>
          <h2 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            あなたのビジネスを、<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">今日から変える。</span>
          </h2>
          <p className="text-slate-400 text-lg mb-12 max-w-xl mx-auto">業種情報を入力するだけ。5分後にはプロ品質のHPが完成しています。</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/laruHP/onboarding"
              className="bg-white text-black px-12 py-5 rounded-2xl font-black text-xl hover:scale-105 transition-transform shadow-[0_0_60px_rgba(255,255,255,0.15)] inline-flex items-center gap-3 justify-center">
              無料で始める（初月1円） <span className="text-blue-600">→</span>
            </Link>
            <Link href="/laruHP/builder"
              className="border border-white/20 text-white px-10 py-5 rounded-2xl font-bold text-lg hover:border-white/40 transition-all inline-flex items-center gap-2 justify-center">
              ▶ まずデモを見る
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-slate-500">
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
            <div>
              <div className="text-white font-black text-xl mb-2">LARU<span className="text-slate-600 font-light">HP</span></div>
              <p className="text-slate-500 text-xs max-w-xs">AIで最高のホームページを最短で。株式会社LARUVisonaが提供するHP作成SaaSサービスです。</p>
            </div>
            <div className="flex gap-8 text-xs">
              <div>
                <div className="text-slate-400 font-bold mb-2">サービス</div>
                <div className="space-y-1">
                  <div><a href="#features" className="hover:text-white">機能一覧</a></div>
                  <div><a href="#templates" className="hover:text-white">テンプレート</a></div>
                  <div><a href="#pricing" className="hover:text-white">料金</a></div>
                </div>
              </div>
              <div>
                <div className="text-slate-400 font-bold mb-2">LARUVisona</div>
                <div className="space-y-1">
                  <div><Link href="/" className="hover:text-white">会社サイト</Link></div>
                  <div><a href="https://larubot.tokyo" target="_blank" rel="noopener noreferrer" className="hover:text-white">LARUbot</a></div>
                  <div><Link href="/#contact" className="hover:text-white">お問い合わせ</Link></div>
                </div>
              </div>
              <div>
                <div className="text-slate-400 font-bold mb-2">法的情報</div>
                <div className="space-y-1">
                  <div><a href="#" className="hover:text-white">利用規約</a></div>
                  <div><a href="#" className="hover:text-white">プライバシー</a></div>
                  <div><a href="#" className="hover:text-white">特定商取引法</a></div>
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
