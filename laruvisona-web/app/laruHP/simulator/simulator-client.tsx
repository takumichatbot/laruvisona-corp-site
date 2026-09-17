'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { advisePlan, type Billing, type DomainChoice, type PlanNeeds } from '@/lib/plan-advice';
import { LARUHP_APP_ORIGIN } from '@/lib/laruhp-host';
import PublicFooter from '@/components/laruhp/PublicFooter';

const WANTS: { key: keyof PlanNeeds; label: string; note: string }[] = [
  { key: 'chat', label: '来た人の質問に、チャットで応対したい', note: 'LARUbot Lite' },
  { key: 'blog', label: '検索向けの記事を、自動で増やしたい', note: 'LARUSEO' },
  { key: 'multilingual', label: '公開ページを、多言語でも出したい', note: '英語・中国語など' },
  { key: 'twoOrMoreSites', label: 'サイトを2つ以上、持ちたい', note: '店舗別・事業別など' },
  { key: 'multiClient', label: '制作会社として、複数のクライアントを管理したい', note: 'エージェンシー' },
];

const DOMAINS: { value: DomainChoice; label: string; note: string }[] = [
  { value: 'none', label: 'いらない', note: 'laruvisona.jp のURLで公開する' },
  { value: 'new', label: 'これから取る', note: '取得・更新費は登録事業者へ別途' },
  { value: 'have', label: 'もう持っている', note: '移管せずに接続する' },
];

const yen = (n: number) => n.toLocaleString('ja-JP');

export default function SimulatorClient() {
  const [wants, setWants] = useState<Record<string, boolean>>({});
  const [domain, setDomain] = useState<DomainChoice>('none');
  const [billing, setBilling] = useState<Billing>('monthly');

  const needs: PlanNeeds = useMemo(
    () => ({
      multiClient: !!wants.multiClient,
      blog: !!wants.blog,
      multilingual: !!wants.multilingual,
      chat: !!wants.chat,
      twoOrMoreSites: !!wants.twoOrMoreSites,
      billing,
      domain,
    }),
    [wants, billing, domain],
  );

  const advice = useMemo(() => advisePlan(needs), [needs]);

  return (
    <div className="min-h-screen bg-sky-50">
      <header className="fixed top-0 z-50 w-full border-b border-sky-100 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="https://laruhp.com/" className="flex items-center gap-3">
            <Image src="/laruhp_logo.png" alt="LARU HP" height={32} width={160} className="h-8 w-auto" />
          </Link>
          <Link href="https://laruhp.com/plans" className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-sky-500">
            料金表を見る
          </Link>
        </div>
      </header>

      <main className="px-6 pt-28 pb-20">
        <div className="mx-auto max-w-3xl">
          <nav className="mb-6 flex items-center gap-2 text-xs text-gray-400">
            <Link href="https://laruhp.com/" className="hover:text-gray-600">LARU HP</Link>
            <span>/</span>
            <span className="text-gray-600">料金の見積り</span>
          </nav>

          <h1 className="mb-4 text-3xl font-black text-gray-900 md:text-4xl">
            うちの場合、いくら？
          </h1>
          <p className="mb-10 text-sm leading-[1.95] text-gray-500">
            やりたいことを選ぶと、合うプランと1年目の合計を出します。登録は要りません。
            金額は実際の料金定義から計算しています。
          </p>

          <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-1 text-sm font-bold text-gray-900">1. やりたいこと（当てはまるものすべて）</h2>
            <p className="mb-5 text-xs text-gray-400">何も選ばなければ「ホームページを作って公開するだけ」として計算します。</p>
            <div className="space-y-2">
              {WANTS.map(want => {
                const on = !!wants[want.key];
                return (
                  <button
                    key={want.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWants(prev => ({ ...prev, [want.key]: !prev[want.key] }))}
                    className={`flex w-full items-center justify-between gap-4 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      on ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span className="text-sm font-semibold text-gray-800">{want.label}</span>
                    <span className="flex items-center gap-3">
                      <span className="hidden text-xs text-gray-400 sm:inline">{want.note}</span>
                      <span
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          on ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-300'
                        }`}
                      >
                        ✓
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-5 text-sm font-bold text-gray-900">2. 独自ドメイン</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {DOMAINS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={domain === option.value}
                  onClick={() => setDomain(option.value)}
                  className={`rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    domain === option.value ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-bold text-gray-800">{option.label}</div>
                  <div className="mt-1 text-xs leading-snug text-gray-400">{option.note}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="mb-10 rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-5 text-sm font-bold text-gray-900">3. 支払い方法</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { value: 'monthly' as const, label: '月払い', note: '初月0円・最低6ヶ月' },
                { value: 'annual' as const, label: '年払い', note: '10ヶ月分・途中返金なし' },
              ]).map(option => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={billing === option.value}
                  onClick={() => setBilling(option.value)}
                  className={`rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    billing === option.value ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-bold text-gray-800">{option.label}</div>
                  <div className="mt-1 text-xs text-gray-400">{option.note}</div>
                </button>
              ))}
            </div>
          </section>

          <section aria-live="polite" className="rounded-2xl border-2 border-sky-300 bg-white p-7">
            <span className="text-[10px] font-bold tracking-[0.3em] text-sky-600">あなたの場合</span>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="text-2xl font-black text-gray-900">{advice.planName}</h2>
              <span className="text-sm text-gray-500">月額 {yen(advice.monthly)}円（税別）</span>
            </div>
            <p className="mt-2 text-sm leading-[1.95] text-gray-600">{advice.reason}。</p>

            <div className="mt-6 rounded-xl bg-sky-50 p-5">
              <div className="text-xs font-bold text-gray-500">1年目に支払う合計（税別）</div>
              <div className="mt-1 text-3xl font-black text-sky-700">{yen(advice.firstYearTotal)}円</div>
              <ul className="mt-4 space-y-1.5">
                {advice.breakdown.map(line => (
                  <li key={line} className="text-xs leading-relaxed text-gray-600">・{line}</li>
                ))}
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="mb-2 text-xs font-bold text-gray-900">申し込む前に</h3>
              <ul className="space-y-1.5">
                {advice.cautions.map(line => (
                  <li key={line} className="text-xs leading-relaxed text-gray-500">・{line}</li>
                ))}
              </ul>
            </div>

            {advice.alsoConsider && (
              <div className="mt-6 rounded-xl border border-gray-200 p-4">
                <h3 className="text-xs font-bold text-gray-900">迷うとすれば {advice.alsoConsider.planName}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{advice.alsoConsider.why}</p>
              </div>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`${LARUHP_APP_ORIGIN}/laruHP/auth/signup?ref=sim`}
                className="rounded-xl bg-sky-600 px-6 py-3.5 text-center text-sm font-bold text-white transition-all hover:bg-sky-500"
              >
                このプランで始める
              </Link>
              <Link
                href="https://laruhp.com/demo"
                className="rounded-xl border border-gray-300 px-6 py-3.5 text-center text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
              >
                先に見本を見る
              </Link>
            </div>
          </section>

          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link href="https://laruhp.com/plans" className="text-sky-700 underline underline-offset-4 hover:text-sky-500">
              5つのプランを並べて見る
            </Link>
            <Link href="https://laruhp.com/faq" className="text-sky-700 underline underline-offset-4 hover:text-sky-500">
              よくある質問
            </Link>
            <Link href="https://laruhp.com/contact" className="text-sky-700 underline underline-offset-4 hover:text-sky-500">
              ここに無いことを聞く
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
