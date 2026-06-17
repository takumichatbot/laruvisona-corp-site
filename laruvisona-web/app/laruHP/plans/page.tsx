'use client';
import { useState } from 'react';
import Link from 'next/link';

type Availability = 'yes' | 'no';

interface FeatureRow {
  label: string;
  hp: Availability;
  hpBot: Availability;
  hpBotSeo: Availability;
}

const FEATURE_ROWS: FeatureRow[] = [
  { label: 'HP作成・公開',            hp: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'AIコンテンツ生成',        hp: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'ビジュアルエディタ',      hp: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'SEO自動最適化',           hp: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'LARUbot AIチャットボット', hp: 'no',  hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'LARUSEO AIブログ',        hp: 'no',  hpBot: 'no',  hpBotSeo: 'yes' },
  { label: '独自ドメイン対応',        hp: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'SSL・サーバー費用込み',   hp: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'Google Analytics連携',    hp: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'お問い合わせフォーム',    hp: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'サポート',                hp: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
];

function Cell({ value }: { value: Availability }) {
  if (value === 'yes') {
    return <div className="flex justify-center"><span className="text-emerald-400 font-bold text-base">✓</span></div>;
  }
  return <div className="flex justify-center"><span className="text-slate-600 text-base">−</span></div>;
}

function CheckoutButton({
  plan,
  className,
  children,
}: {
  plan: string;
  className: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        window.location.href = `/laruHP/auth/login?redirectTo=/laruHP/plans`;
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('エラーが発生しました。もう一度お試しください。');
        setLoading(false);
      }
    } catch {
      setError('接続エラーが発生しました。');
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className={`${className} disabled:opacity-60 disabled:cursor-not-allowed`}>
        {loading ? '処理中...' : children}
      </button>
      {error && <p className="text-red-400 text-[10px] mt-1 text-center">{error}</p>}
    </div>
  );
}

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-x-hidden">

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#030712]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/laruHP" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white text-black rounded-lg flex items-center justify-center font-black text-sm">L</div>
            <span className="font-bold tracking-tight text-lg">LARU<span className="text-blue-400 font-light">HP</span></span>
          </Link>
          <div className="flex items-center gap-2.5">
            <Link href="/laruHP/auth/login" className="hidden md:block text-slate-400 hover:text-white border border-white/10 hover:border-white/30 px-4 py-2 rounded-xl text-sm transition-all">
              ログイン
            </Link>
            <Link href="/laruHP/onboarding" className="bg-white text-black px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all whitespace-nowrap">
              無料で始める →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-36 pb-16 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.10),transparent_65%)]" />
        </div>
        <div className="max-w-3xl mx-auto relative">
          <Link href="/laruHP#pricing" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-8 transition-colors">
            ← 料金ページに戻る
          </Link>
          <div className="block">
            <span className="text-blue-500 font-bold text-xs tracking-[0.2em] uppercase">PLAN COMPARISON</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black mt-4 mb-4">プラン比較</h1>
          <p className="text-slate-400 text-lg">全プラン 初月1円・最低6ヶ月契約・7ヶ月目からいつでも解約可</p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-8 md:py-16 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">

          {/* Plan header row */}
          <div className="grid grid-cols-4 gap-0 mb-0">
            <div className="p-4" />

            {/* HP単体 */}
            <div className="p-5 text-center border-t border-l border-r border-white/10 bg-white/5 rounded-tl-2xl rounded-tr-none">
              <div className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-2">hp</div>
              <div className="text-lg font-black mb-1">HP単体</div>
              <div className="text-slate-500 text-xs mb-3">¥</div>
              <div className="text-4xl font-black leading-none mb-1">999</div>
              <div className="text-slate-400 text-xs mb-3">/ 月（税別）</div>
              <div className="inline-block bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded-full mb-4">
                初月1円
              </div>
              <CheckoutButton
                plan="hp"
                className="block w-full bg-white/10 border border-white/10 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-white/20 transition-all"
              >
                このプランで始める →
              </CheckoutButton>
            </div>

            {/* HP + LARUbot */}
            <div className="p-5 text-center border-t border-l border-r border-blue-500/50 bg-blue-500/5 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  おすすめ
                </span>
              </div>
              <div className="text-xs font-bold text-blue-500/60 tracking-widest uppercase mb-2">hp-bot</div>
              <div className="text-lg font-black mb-1">HP + LARUbot</div>
              <div className="text-slate-500 text-xs mb-3">¥</div>
              <div className="text-4xl font-black leading-none mb-1">4,980</div>
              <div className="text-slate-400 text-xs mb-3">/ 月（税別）</div>
              <div className="inline-block bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded-full mb-4">
                初月1円
              </div>
              <CheckoutButton
                plan="hp-bot"
                className="block w-full bg-white text-black font-bold py-2.5 rounded-xl text-sm hover:bg-blue-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                このプランで始める →
              </CheckoutButton>
            </div>

            {/* HP + Bot + SEO */}
            <div className="p-5 text-center border-t border-l border-r border-white/10 bg-white/5 rounded-tr-2xl rounded-tl-none relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  半年間限定
                </span>
              </div>
              <div className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-2">hp-bot-seo</div>
              <div className="text-lg font-black mb-1">HP + Bot + SEO</div>
              <div className="text-slate-500 text-xs mb-3">¥</div>
              <div className="text-4xl font-black leading-none mb-1">9,800</div>
              <div className="text-slate-400 text-xs mb-3">/ 月（税別）</div>
              <div className="inline-block bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded-full mb-4">
                初月1円
              </div>
              <CheckoutButton
                plan="hp-bot-seo"
                className="block w-full bg-white/10 border border-white/10 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-white/20 transition-all"
              >
                このプランで始める →
              </CheckoutButton>
            </div>
          </div>

          {/* Feature rows */}
          <div className="border border-white/10 rounded-bl-2xl rounded-br-2xl overflow-hidden">
            {FEATURE_ROWS.map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-4 border-b border-white/5 last:border-0 ${i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}`}
              >
                <div className="p-4 text-sm text-slate-400 font-medium">{row.label}</div>
                <div className="p-4 border-l border-white/5"><Cell value={row.hp} /></div>
                <div className="p-4 border-l border-blue-500/10 bg-blue-500/[0.03]"><Cell value={row.hpBot} /></div>
                <div className="p-4 border-l border-white/5"><Cell value={row.hpBotSeo} /></div>
              </div>
            ))}
          </div>

          <p className="text-center text-slate-600 text-xs mt-6">
            全プラン 初月1円 / 最低6ヶ月契約 / 7ヶ月目からいつでも解約可 / クレジットカード決済（Stripe）
          </p>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-16 md:py-24 px-6 border-t border-white/5 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black mb-4">まずは初月1円で試す</h2>
          <p className="text-slate-400 mb-8">プランはあとからいつでも変更できます。まずは気軽にスタート。</p>
          <CheckoutButton
            plan="hp"
            className="inline-flex items-center gap-2 bg-white text-black font-black text-lg px-10 py-4 rounded-2xl hover:scale-105 transition-transform shadow-[0_0_40px_rgba(255,255,255,0.15)]"
          >
            まずはHPプランで始める（初月1円） →
          </CheckoutButton>
          <div className="mt-8">
            <Link href="/laruHP#pricing" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
              ← 料金ページに戻る
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-slate-600 text-sm">
        <div className="max-w-6xl mx-auto px-6 text-center text-xs">
          © 2026 株式会社LARUVisona. All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}
