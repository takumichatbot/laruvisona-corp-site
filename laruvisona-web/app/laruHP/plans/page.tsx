'use client';
import { useState, useEffect, Suspense, createContext, useContext } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { track } from '@/lib/analytics';

// ログイン中ユーザーの現契約。既存契約者はボタンを「このプランに変更／ご利用中」に切り替える。
const CurrentPlanContext = createContext<{ plan: string | null; subscribed: boolean }>({ plan: null, subscribed: false });

type Availability = 'yes' | 'no' | 'limited' | (string & {});

interface FeatureRow {
  label: string;
  hp: Availability;
  lite: Availability;
  hpBot: Availability;
  hpBotSeo: Availability;
}

const FEATURE_ROWS: FeatureRow[] = [
  { label: 'HP作成・公開',            hp: 'yes', lite: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'AIコンテンツ生成',        hp: 'yes', lite: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'ビジュアルエディタ',      hp: 'yes', lite: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'SEO自動最適化',           hp: 'yes', lite: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'LARUbot Lite AIチャットボット', hp: 'no',  lite: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: '　└ Q&A 登録数',          hp: 'no',  lite: '15件', hpBot: '30件', hpBotSeo: '30件' },
  { label: '　└ 設置ボット数',        hp: 'no',  lite: '2体',  hpBot: '3体',  hpBotSeo: '3体' },
  { label: '　└ 質問例',              hp: 'no',  lite: '3件',  hpBot: '5件',  hpBotSeo: '5件' },
  { label: '　└ メールシーケンス',    hp: 'no',  lite: '3件',  hpBot: '5件',  hpBotSeo: '5件' },
  { label: 'LARUSEO AIブログ',        hp: 'no',  lite: 'no',  hpBot: 'no',  hpBotSeo: 'yes' },
  { label: '独自ドメイン対応',        hp: 'yes', lite: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'SSL・サーバー費用込み',   hp: 'yes', lite: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'Google Analytics連携',    hp: 'yes', lite: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'お問い合わせフォーム',    hp: 'yes', lite: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
  { label: 'サポート',                hp: 'yes', lite: 'yes', hpBot: 'yes', hpBotSeo: 'yes' },
];

function Cell({ value }: { value: Availability }) {
  if (value === 'yes') {
    return <div className="flex justify-center"><span className="text-emerald-500 font-bold text-base">✓</span></div>;
  }
  if (value === 'limited') {
    return <div className="flex justify-center"><span className="text-amber-500 font-bold text-xs">制限あり</span></div>;
  }
  if (value === 'no') {
    return <div className="flex justify-center"><span className="text-gray-300 text-base">−</span></div>;
  }
  // 具体的な数値（Q&A数・ボット数など）
  return <div className="flex justify-center"><span className="text-gray-700 font-semibold text-xs">{value}</span></div>;
}

const MONTHLY = { hp: 999, lite: 2980, hpBot: 4980, hpBotSeo: 9800, agency: 19800 } as const;
const ANNUAL  = { hp: 833, lite: 2483, hpBot: 4150, hpBotSeo: 8166, agency: 16500 } as const;
const ANNUAL_TOTAL = { hp: 9990, lite: 29800, hpBot: 49800, hpBotSeo: 98000, agency: 198000 } as const;

// 決済セッションを開始する共通処理。
// 未ログイン(401)の場合は、選択中のプラン・課金区分を redirectTo に含めてログインへ誘導し、
// ログイン後にこの /laruHP/plans に戻って自動的に決済を再開できるようにする。
// 戻り値: エラーメッセージ（画面遷移する場合は null）
async function startCheckout(plan: string, billing: 'monthly' | 'annual'): Promise<string | null> {
  track('begin_checkout', { plan, billing });
  try {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, billing }),
    });
    if (res.status === 401) {
      const back = `/laruHP/plans?checkout=${plan}&billing=${billing}`;
      window.location.href = `/laruHP/auth/login?redirectTo=${encodeURIComponent(back)}`;
      return null;
    }
    if (res.status === 402) return '支払い情報に問題があります。設定からご確認ください。';
    if (res.status === 429) return 'しばらく待ってからもう一度お試しください。';
    const data = await res.json().catch(() => ({}));
    // 既存契約者はサーバー側でプランを差し替え済み（新規サブスクは作らない＝二重課金なし）
    if (data.upgraded) {
      window.location.href = '/laruHP/dashboard?upgraded=1';
      return null;
    }
    if (data.url) {
      window.location.href = data.url;
      return null;
    }
    return data.error || 'エラーが発生しました。もう一度お試しください。';
  } catch {
    return '接続エラーが発生しました。通信状況をご確認ください。';
  }
}

function CheckoutButton({
  plan,
  annual = false,
  className,
  children,
}: {
  plan: string;
  annual?: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { plan: currentPlan, subscribed } = useContext(CurrentPlanContext);

  const isCurrent = subscribed && currentPlan === plan;

  const handleClick = async () => {
    setLoading(true);
    setError('');
    const err = await startCheckout(plan, annual ? 'annual' : 'monthly');
    if (err) {
      setError(err);
      setLoading(false);
    }
    // 成功時は画面遷移するため loading を保持したままにする
  };

  // 既にこのプランを契約中なら押せないようにする（同一プランの重複決済防止）
  if (isCurrent) {
    return (
      <div>
        <div className={`${className} !bg-gray-100 !text-gray-400 !border-gray-200 cursor-default text-center`}>
          ご利用中
        </div>
      </div>
    );
  }

  // 別プラン契約中なら「変更」文言に（新規登録者はデフォルトの children のまま）
  const label = subscribed ? 'このプランに変更 →' : children;

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className={`${className} disabled:opacity-60 disabled:cursor-not-allowed`}>
        {loading ? '処理中...' : label}
      </button>
      {error && <p className="text-red-400 text-[10px] mt-1 text-center">{error}</p>}
    </div>
  );
}

// ログイン後に ?checkout=<plan>&billing=<...> が付いて戻ってきたら、選んだプランで自動的に決済を再開する
function CheckoutResume() {
  const searchParams = useSearchParams();
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const plan = searchParams.get('checkout');
    if (!plan) return;
    const billing = searchParams.get('billing') === 'annual' ? 'annual' : 'monthly';
    setResuming(true);
    startCheckout(plan, billing).then(err => {
      if (err) { setError(err); setResuming(false); }
    });
  }, [searchParams]);

  if (!resuming && !error) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-sm flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        {error ? (
          <>
            <p className="text-red-600 text-sm mb-2">{error}</p>
            <p className="text-gray-500 text-sm mb-6">下のプランからもう一度お選びください。</p>
            <button
              onClick={() => setError('')}
              className="bg-sky-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-sky-500 transition-all"
            >
              プランを見る
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 mx-auto mb-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
            <p className="text-gray-700 text-sm font-semibold">決済ページへ移動しています…</p>
            <p className="text-gray-400 text-xs mt-1">選択されたプランで手続きを再開しています</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function PlansPage() {
  const [annual, setAnnual] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const P = annual ? ANNUAL : MONTHLY;

  // ログイン中なら現契約を取得（既存契約者のボタン文言・重複決済防止に使う）。
  // これは進歩的強化であり、失敗しても購入ページ本体は必ず表示する（try/catchで隔離）。
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('profiles').select('plan, subscription_status').eq('id', user.id).single();
        if (data) {
          setSubscribed(data.subscription_status === 'active');
          setCurrentPlan(data.subscription_status === 'active' ? data.plan : null);
        }
      } catch { /* Supabase 未設定・未ログイン等でも購入導線は生かす */ }
    })();
  }, []);

  return (
    <CurrentPlanContext.Provider value={{ plan: currentPlan, subscribed }}>
    <div className="min-h-screen bg-sky-50 text-gray-900 overflow-x-hidden">

      {/* ログイン後にプラン選択を保持して決済を自動再開 */}
      <Suspense fallback={null}>
        <CheckoutResume />
      </Suspense>

      {/* 既存契約者向けの案内 */}
      {subscribed && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-sky-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
          契約中のため、プラン変更は日割りで即時反映されます（新規契約にはなりません）
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/laruHP" className="flex items-center gap-3">
            <Image src="/laruhp_logo.png" alt="LARU HP" height={32} width={160} className="h-8 w-auto" />
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
          <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-6 text-gray-900">プラン比較</h1>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-2 py-2 shadow-sm mb-4">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${!annual ? 'bg-sky-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              月払い
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${annual ? 'bg-sky-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              年払い
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${annual ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                2ヶ月無料
              </span>
            </button>
          </div>
          {annual && (
            <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs text-emerald-700 space-y-0.5">
              <div className="font-semibold">年払いの節約額（プラン例）</div>
              <div className="text-emerald-600">HP単体: 月払い¥11,988 → 年払い¥9,990 <span className="font-bold text-emerald-700">（¥1,998 節約 ≈ 約2ヶ月無料）</span></div>
              <div className="text-emerald-600">HP+Bot: 月払い¥59,760 → 年払い¥49,800 <span className="font-bold text-emerald-700">（¥9,960 節約 ≈ 約2ヶ月無料）</span></div>
              <p className="text-emerald-500 mt-1">※ 月額 × 12ヶ月との比較。年払いは一括請求、途中解約の場合の日割り返金はありません。</p>
            </div>
          )}

          <p className="text-gray-500 text-base font-normal mt-3">全プラン 初月無料・最低6ヶ月契約・7ヶ月目からいつでも解約可</p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-8 md:py-16 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">

          {/* Plan header row */}
          <div className="grid grid-cols-5 gap-0 mb-0">
            <div className="p-4" />

            {/* HP単体 */}
            <div className="p-4 text-center border-t border-l border-r border-gray-200 bg-white rounded-tl-2xl rounded-tr-none">
              <div className="text-xs font-medium text-gray-500 tracking-widest uppercase mb-2">hp</div>
              <div className="text-base font-semibold mb-1 text-gray-900">HP単体</div>
              <div className="flex items-baseline justify-center gap-0.5 mb-1">
                <span className="text-gray-500 text-xs">¥</span>
                <span className="text-3xl font-bold leading-none text-gray-900">{P.hp.toLocaleString()}</span>
              </div>
              <div className="text-gray-600 text-xs mb-1">/ 月（税別）</div>
              {annual && <div className="text-gray-400 text-[10px] mb-2">年間 ¥{ANNUAL_TOTAL.hp.toLocaleString()}</div>}
              <div className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-medium px-2 py-0.5 rounded-full mb-3">
                初月無料
              </div>
              <CheckoutButton
                plan="hp"
                annual={annual}
                className="block w-full bg-gray-50 border border-gray-200 text-gray-900 font-semibold py-2 rounded-xl text-xs hover:bg-sky-50 transition-all"
              >
                始める →
              </CheckoutButton>
            </div>

            {/* HP + LARUbot Lite */}
            <div className="p-4 text-center border-t border-l border-r border-gray-200 bg-white relative">
              <div className="text-xs font-medium text-indigo-500 tracking-widest uppercase mb-2">lite</div>
              <div className="text-base font-semibold mb-1 text-gray-900">HP + Bot Lite</div>
              <div className="flex items-baseline justify-center gap-0.5 mb-1">
                <span className="text-gray-500 text-xs">¥</span>
                <span className="text-3xl font-bold leading-none text-gray-900">{P.lite.toLocaleString()}</span>
              </div>
              <div className="text-gray-600 text-xs mb-1">/ 月（税別）</div>
              {annual && <div className="text-gray-400 text-[10px] mb-2">年間 ¥{ANNUAL_TOTAL.lite.toLocaleString()}</div>}
              <div className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-medium px-2 py-0.5 rounded-full mb-3">
                初月無料
              </div>
              <CheckoutButton
                plan="lite"
                annual={annual}
                className="block w-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold py-2 rounded-xl text-xs hover:bg-indigo-100 transition-all"
              >
                始める →
              </CheckoutButton>
            </div>

            {/* HP + Bot Standard */}
            <div className="p-4 text-center border-2 border-sky-500 bg-white shadow-[0_0_40px_rgba(14,165,233,0.12)] relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="bg-sky-600 text-white text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
                  おすすめ
                </span>
              </div>
              <div className="text-xs font-medium text-sky-600 tracking-widest uppercase mb-2">hp-bot</div>
              <div className="text-base font-semibold mb-1 text-gray-900">HP + Bot Standard</div>
              <div className="flex items-baseline justify-center gap-0.5 mb-1">
                <span className="text-gray-500 text-xs">¥</span>
                <span className="text-3xl font-bold leading-none text-gray-900">{P.hpBot.toLocaleString()}</span>
              </div>
              <div className="text-gray-600 text-xs mb-1">/ 月（税別）</div>
              {annual && <div className="text-gray-400 text-[10px] mb-2">年間 ¥{ANNUAL_TOTAL.hpBot.toLocaleString()}</div>}
              <div className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-medium px-2 py-0.5 rounded-full mb-3">
                初月無料
              </div>
              <CheckoutButton
                plan="hp-bot"
                annual={annual}
                className="block w-full bg-sky-600 text-white font-semibold py-2 rounded-xl text-xs hover:bg-sky-500 transition-all shadow-sm"
              >
                始める →
              </CheckoutButton>
            </div>

            {/* HP + Bot + SEO */}
            <div className="p-4 text-center border border-gray-200 bg-white rounded-tr-2xl rounded-tl-none relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="bg-amber-500 text-black text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
                  半年間限定
                </span>
              </div>
              <div className="text-xs font-medium text-gray-500 tracking-widest uppercase mb-2">hp-bot-seo</div>
              <div className="text-base font-semibold mb-1 text-gray-900">HP + Bot + SEO</div>
              <div className="flex items-baseline justify-center gap-0.5 mb-1">
                <span className="text-gray-500 text-xs">¥</span>
                <span className="text-3xl font-bold leading-none text-gray-900">{P.hpBotSeo.toLocaleString()}</span>
              </div>
              <div className="text-gray-600 text-xs mb-1">/ 月（税別）</div>
              {annual && <div className="text-gray-400 text-[10px] mb-2">年間 ¥{ANNUAL_TOTAL.hpBotSeo.toLocaleString()}</div>}
              <div className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-medium px-2 py-0.5 rounded-full mb-3">
                初月無料
              </div>
              <CheckoutButton
                plan="hp-bot-seo"
                annual={annual}
                className="block w-full bg-gray-50 border border-gray-200 text-gray-900 font-semibold py-2 rounded-xl text-xs hover:bg-sky-50 transition-all"
              >
                始める →
              </CheckoutButton>
            </div>
          </div>

          {/* Feature rows */}
          <div className="border border-gray-200 rounded-bl-2xl rounded-br-2xl overflow-hidden">
            {FEATURE_ROWS.map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-5 border-b border-gray-200 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
              >
                <div className="p-3 text-sm text-gray-600 font-medium">{row.label}</div>
                <div className="p-3 border-l border-gray-200"><Cell value={row.hp} /></div>
                <div className="p-3 border-l border-indigo-100 bg-indigo-50/20"><Cell value={row.lite} /></div>
                <div className="p-3 border-l border-sky-100 bg-sky-50/30"><Cell value={row.hpBot} /></div>
                <div className="p-3 border-l border-gray-200"><Cell value={row.hpBotSeo} /></div>
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
                    '全機能（HP + LARUbot Lite + LARUSEO）込み',
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
                  <span className="text-5xl font-bold text-gray-900">{P.agency.toLocaleString()}</span>
                  <span className="text-gray-500 text-sm">/ 月（税別）</span>
                </div>
                {annual && <div className="text-gray-400 text-xs md:text-right mb-1">年間 ¥{ANNUAL_TOTAL.agency.toLocaleString()}</div>}
                <div className="text-purple-600 text-xs font-medium mb-5">クライアント数無制限</div>
                <CheckoutButton
                  plan="agency"
                  annual={annual}
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
          © 2026 株式会社LaruVisona. All Rights Reserved.
        </div>
      </footer>
    </div>
    </CurrentPlanContext.Provider>
  );
}
