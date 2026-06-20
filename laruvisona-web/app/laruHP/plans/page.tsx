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
    return <div className="flex justify-center"><span className="text-emerald-500 font-bold text-base">✓</span></div>;
  }
  return <div className="flex justify-center"><span className="text-gray-300 text-base">−</span></div>;
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
    <div className="min-h-screen bg-sky-50 text-gray-900 overflow-x-hidden">

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/laruHP" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sky-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">L</div>
            <span className="text-gray-900 font-semibold tracking-tight text-lg">LARU<span className="text-sky-500 font-light">HP</span></span>
          </Link>
          <div className="flex items-center gap-2.5">
            <Link href="/laruHP/auth/login" className="hidden md:block text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-4 py-2 rounded-xl text-sm transition-all">
              ログイン
            </Link>
            <Link href="/laruHP/onboarding" className="bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-sky-500 transition-all whitespace-nowrap">
              無料で始める →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-36 pb-16 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.10),transparent_65%)]" />
        </div>
        <div className="max-w-3xl mx-auto relative">
          <Link href="/laruHP#pricing" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-600 text-sm mb-8 transition-colors">
            ← 料金ページに戻る
          </Link>
          <div className="block">
            <span className="text-sky-600 font-bold text-xs tracking-[0.2em] uppercase">PLAN COMPARISON</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-4 text-gray-900">プラン比較</h1>
          <p className="text-gray-500 text-base font-normal">全プラン 初月無料・最低6ヶ月契約・7ヶ月目からいつでも解約可</p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-8 md:py-16 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">

          {/* Plan header row */}
          <div className="grid grid-cols-4 gap-0 mb-0">
            <div className="p-4" />

            {/* HP単体 */}
            <div className="p-5 text-center border-t border-l border-r border-gray-200 bg-white rounded-tl-2xl rounded-tr-none">
              <div className="text-xs font-medium text-gray-500 tracking-widest uppercase mb-2">hp</div>
              <div className="text-lg font-semibold mb-1 text-gray-900">HP単体</div>
              <div className="text-gray-500 text-xs mb-3">¥</div>
              <div className="text-4xl font-bold leading-none mb-1 text-gray-900">999</div>
              <div className="text-gray-600 text-xs mb-3">/ 月（税別）</div>
              <div className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-medium px-2.5 py-0.5 rounded-full mb-4">
                初月無料
              </div>
              <CheckoutButton
                plan="hp"
                className="block w-full bg-gray-50 border border-gray-200 text-gray-900 font-semibold py-2.5 rounded-xl text-sm hover:bg-sky-50 transition-all"
              >
                このプランで始める →
              </CheckoutButton>
            </div>

            {/* HP + LARUbot */}
            <div className="p-5 text-center border-2 border-sky-500 bg-white shadow-[0_0_40px_rgba(14,165,233,0.12)] relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="bg-sky-600 text-white text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
                  おすすめ
                </span>
              </div>
              <div className="text-xs font-medium text-sky-600 tracking-widest uppercase mb-2">hp-bot</div>
              <div className="text-lg font-semibold mb-1 text-gray-900">HP + LARUbot</div>
              <div className="text-gray-500 text-xs mb-3">¥</div>
              <div className="text-4xl font-bold leading-none mb-1 text-gray-900">4,980</div>
              <div className="text-gray-600 text-xs mb-3">/ 月（税別）</div>
              <div className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-medium px-2.5 py-0.5 rounded-full mb-4">
                初月無料
              </div>
              <CheckoutButton
                plan="hp-bot"
                className="block w-full bg-sky-600 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-sky-500 transition-all shadow-sm"
              >
                このプランで始める →
              </CheckoutButton>
            </div>

            {/* HP + Bot + SEO */}
            <div className="p-5 text-center border border-gray-200 bg-white rounded-tr-2xl rounded-tl-none relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="bg-amber-500 text-black text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
                  半年間限定
                </span>
              </div>
              <div className="text-xs font-medium text-gray-500 tracking-widest uppercase mb-2">hp-bot-seo</div>
              <div className="text-lg font-semibold mb-1 text-gray-900">HP + Bot + SEO</div>
              <div className="text-gray-500 text-xs mb-3">¥</div>
              <div className="text-4xl font-bold leading-none mb-1 text-gray-900">9,800</div>
              <div className="text-gray-600 text-xs mb-3">/ 月（税別）</div>
              <div className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-medium px-2.5 py-0.5 rounded-full mb-4">
                初月無料
              </div>
              <CheckoutButton
                plan="hp-bot-seo"
                className="block w-full bg-gray-50 border border-gray-200 text-gray-900 font-semibold py-2.5 rounded-xl text-sm hover:bg-sky-50 transition-all"
              >
                このプランで始める →
              </CheckoutButton>
            </div>
          </div>

          {/* Feature rows */}
          <div className="border border-gray-200 rounded-bl-2xl rounded-br-2xl overflow-hidden">
            {FEATURE_ROWS.map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-4 border-b border-gray-200 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
              >
                <div className="p-4 text-sm text-gray-600 font-medium">{row.label}</div>
                <div className="p-4 border-l border-gray-200"><Cell value={row.hp} /></div>
                <div className="p-4 border-l border-sky-100 bg-sky-50/30"><Cell value={row.hpBot} /></div>
                <div className="p-4 border-l border-gray-200"><Cell value={row.hpBotSeo} /></div>
              </div>
            ))}
          </div>

          <p className="text-center text-gray-500 text-xs mt-6">
            全プラン 初月無料 / 最低6ヶ月契約 / 7ヶ月目からいつでも解約可 / クレジットカード決済（Stripe）
          </p>

          {/* Agency Plan */}
          <div id="agency" className="mt-14 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-8 scroll-mt-24">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1">
                <span className="inline-block bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full mb-3 tracking-widest uppercase">Agency Plan</span>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">エージェンシープラン</h3>
                <p className="text-gray-500 text-sm mb-4">Web制作会社・フリーランス向け。複数クライアントのサイトを1アカウントで一元管理。</p>
                <ul className="space-y-2">
                  {[
                    'クライアント数無制限',
                    '全機能（HP + LARUbot + LARUSEO）込み',
                    'クライアント別ダッシュボード・管理画面',
                    'PV・問い合わせを全サイトまとめて確認',
                    'クライアント連絡先・メモの一元管理',
                  ].map(item => (
                    <li key={item} className="flex items-center gap-2 text-gray-600 text-sm">
                      <span className="text-emerald-500 font-bold text-base flex-shrink-0">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="md:text-right flex-shrink-0">
                <div className="flex items-baseline gap-1 md:justify-end mb-1">
                  <span className="text-purple-600 text-sm">¥</span>
                  <span className="text-5xl font-bold text-gray-900">19,800</span>
                  <span className="text-gray-500 text-sm">/ 月（税別）</span>
                </div>
                <div className="text-purple-600 text-xs font-medium mb-5">クライアント数無制限</div>
                <CheckoutButton
                  plan="agency"
                  className="block w-full md:w-auto bg-purple-600 text-white font-bold py-3 px-8 rounded-xl text-sm hover:bg-purple-500 transition-all shadow-sm"
                >
                  このプランで始める →
                </CheckoutButton>
                <div className="text-gray-400 text-xs mt-2">初月無料 · 7ヶ月目から解約可</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-16 md:py-24 px-6 border-t border-gray-200 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">まずは初月無料で試す</h2>
          <p className="text-gray-500 text-sm mb-8">プランはあとからいつでも変更できます。まずは気軽にスタート。</p>
          <CheckoutButton
            plan="hp"
            className="inline-flex items-center gap-2 bg-sky-600 text-white font-bold text-base px-10 py-4 rounded-2xl hover:bg-sky-500 transition-all shadow-md"
          >
            まずはHPプランで始める（初月無料） →
          </CheckoutButton>
          <div className="mt-8">
            <Link href="/laruHP#pricing" className="text-sky-600 hover:text-sky-500 text-sm transition-colors">
              ← 料金ページに戻る
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 text-gray-500 text-sm">
        <div className="max-w-6xl mx-auto px-6 text-center text-xs">
          © 2026 株式会社LARUVisona. All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}
