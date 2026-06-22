import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

type Competitor = 'jimdo' | 'wix' | 'canva' | 'studio';

interface CompetitorData {
  name: string;
  tagline: string;
  description: string;
  price: string;
  pros: string[];
  cons: string[];
}

const COMPETITORS: Record<Competitor, CompetitorData> = {
  jimdo: {
    name: 'Jimdo',
    tagline: 'ドイツ製の老舗HPビルダー',
    description: 'シンプルで使いやすいが、AIはテキスト生成のみで機能が限定的。月額費用も高め。',
    price: '月額990円〜',
    pros: ['操作がシンプル', '歴史が長く安定'],
    cons: ['AI機能が弱い', 'デザインが古め', 'チャットボット非対応', 'SEO自動化なし', 'CRM・予約管理なし'],
  },
  wix: {
    name: 'Wix',
    tagline: '世界最大手のHPビルダー',
    description: '機能は豊富だが月額費用が高く、覚えることが多い。日本語サポートも限定的。',
    price: '月額1,700円〜',
    pros: ['テンプレートが豊富', 'アプリが多い'],
    cons: ['価格が高い', '操作が複雑', '日本語サポート弱い', 'AIは補助的', 'モバイル最適化が難しい'],
  },
  canva: {
    name: 'Canva',
    tagline: 'デザインツールのHP機能',
    description: 'デザイン制作には優れるが、HPとしては機能が不十分。フォームやSEO、CRMは別途必要。',
    price: '月額1,800円〜',
    pros: ['デザインが綺麗', '使いやすい'],
    cons: ['SEO機能なし', '問い合わせ管理なし', 'AIコンテンツ生成なし', 'チャットボット非対応', '予約管理なし'],
  },
  studio: {
    name: 'STUDIO',
    tagline: '日本製ノーコードツール',
    description: 'デザイン自由度は高いが上級者向け。AI機能・CRM・予約管理は別途用意が必要。',
    price: '月額無料〜2,000円',
    pros: ['デザイン自由度が高い', '日本製'],
    cons: ['初心者には難しい', 'AI生成なし', 'CRM非対応', '予約・チャット非対応', 'SEO自動化なし'],
  },
};

const COMPARISON_ROWS = [
  { label: 'AI コンテンツ自動生成', laru: true, others: false },
  { label: 'AIチャットボット',      laru: true, others: false },
  { label: 'SEO自動最適化',         laru: true, others: false },
  { label: '問い合わせ管理(CRM)',   laru: true, others: false },
  { label: '予約管理',              laru: true, others: false },
  { label: '独自ドメイン',          laru: true, others: true  },
  { label: 'スマホ最適化',          laru: true, others: true  },
  { label: 'SSL無料',               laru: true, others: true  },
  { label: '日本語サポート',        laru: true, others: false },
  { label: '月額費用（最安）',      laru: null, others: null  },
];

export async function generateStaticParams() {
  return Object.keys(COMPETITORS).map(c => ({ competitor: c }));
}

export async function generateMetadata({ params }: { params: Promise<{ competitor: string }> }): Promise<Metadata> {
  const { competitor } = await params;
  const data = COMPETITORS[competitor as Competitor];
  if (!data) return {};
  return {
    title: `LARU HP vs ${data.name} 徹底比較 | どちらが中小店舗に向いている？`,
    description: `LARU HP と ${data.name} を料金・機能・使いやすさで比較。AIチャットボット・CRM・予約管理まで完備したLARU HPが月額999円〜。`,
  };
}

export default async function VsPage({ params }: { params: Promise<{ competitor: string }> }) {
  const { competitor } = await params;
  const data = COMPETITORS[competitor as Competitor];
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-sky-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/laruHP" className="flex items-center gap-3">
            <Image src="/laruhp_logo.png" alt="LARU HP" height={32} width={160} className="h-8 w-auto" style={{ width: 'auto' }} />
          </Link>
          <Link href="/laruHP/onboarding" className="bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-sky-500 transition-all">
            無料で始める →
          </Link>
        </div>
      </header>

      <main className="pt-28 pb-20 px-6">
        <div className="max-w-4xl mx-auto">

          {/* Hero */}
          <div className="text-center mb-16">
            <span className="inline-block text-sky-600 font-bold text-xs tracking-[0.2em] uppercase mb-4">比較</span>
            <h1 className="text-4xl md:text-5xl font-black mb-4 text-gray-900 leading-tight">
              LARU HP <span className="text-gray-400">vs</span> {data.name}
            </h1>
            <p className="text-gray-500 text-base max-w-2xl mx-auto leading-relaxed">{data.description}</p>
          </div>

          {/* Score cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-14">
            {/* LARU HP */}
            <div className="bg-white border-2 border-sky-500 rounded-2xl p-7 shadow-[0_0_40px_rgba(14,165,233,0.1)] relative">
              <span className="absolute top-4 right-4 bg-sky-600 text-white text-xs font-bold px-3 py-1 rounded-full">おすすめ</span>
              <Image src="/laruhp_logo.png" alt="LARU HP" height={32} width={160} className="h-8 w-auto mb-4" style={{ width: 'auto' }} />
              <div className="text-3xl font-black text-gray-900 mb-1">¥999<span className="text-base font-normal text-gray-500">/月〜</span></div>
              <p className="text-gray-500 text-xs mb-5">AIで最高のHPを最短で。全機能込み</p>
              <ul className="space-y-2">
                {['AI完全自動生成', 'チャットボット搭載', 'SEO自動最適化', 'CRM・予約管理', '初月無料'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-emerald-500 font-bold">✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Competitor */}
            <div className="bg-white border border-gray-200 rounded-2xl p-7">
              <div className="text-xl font-bold text-gray-900 mb-1">{data.name}</div>
              <div className="text-gray-400 text-xs mb-2">{data.tagline}</div>
              <div className="text-2xl font-black text-gray-700 mb-1">{data.price}</div>
              <p className="text-gray-500 text-xs mb-5"> </p>
              <div className="mb-3">
                <div className="text-xs font-bold text-gray-600 mb-2">良い点</div>
                {data.pros.map(p => (
                  <div key={p} className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <span className="text-emerald-400">✓</span>{p}
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs font-bold text-gray-600 mb-2">不足する点</div>
                {data.cons.map(c => (
                  <div key={c} className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <span className="text-red-400">✗</span>{c}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Comparison table */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-14 shadow-sm">
            <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <div className="p-4">機能</div>
              <div className="p-4 text-center text-sky-600">LARU HP</div>
              <div className="p-4 text-center">{data.name}</div>
            </div>
            {COMPARISON_ROWS.map((row, i) => (
              <div key={i} className={`grid grid-cols-3 border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                <div className="p-4 text-sm text-gray-700 font-medium">{row.label}</div>
                <div className="p-4 text-center">
                  {row.label === '月額費用（最安）' ? (
                    <span className="text-sky-600 font-bold text-sm">¥999〜</span>
                  ) : row.laru ? (
                    <span className="text-emerald-500 font-bold">✓</span>
                  ) : (
                    <span className="text-gray-300">−</span>
                  )}
                </div>
                <div className="p-4 text-center">
                  {row.label === '月額費用（最安）' ? (
                    <span className="text-gray-500 text-sm">{data.price}</span>
                  ) : row.others ? (
                    <span className="text-emerald-400 font-bold">✓</span>
                  ) : (
                    <span className="text-red-300 font-bold">✗</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-br from-sky-600 to-indigo-600 rounded-2xl p-10 text-center text-white">
            <h2 className="text-2xl md:text-3xl font-black mb-3">まずは初月無料で試す</h2>
            <p className="text-sky-100 text-sm mb-8">クレジットカード登録のみ。初月は完全無料。いつでも解約可。</p>
            <Link
              href="/laruHP/onboarding"
              className="inline-block bg-white text-sky-600 font-black text-base px-10 py-4 rounded-2xl hover:bg-sky-50 transition-colors shadow-lg"
            >
              無料でサイトを作る →
            </Link>
            <div className="mt-5 text-sky-200 text-xs">
              15業種テンプレート · AIコンテンツ自動生成 · チャットボット搭載
            </div>
          </div>

          {/* Other comparisons */}
          <div className="mt-10 text-center">
            <p className="text-gray-400 text-sm mb-4">他のサービスとも比較する</p>
            <div className="flex justify-center gap-3 flex-wrap">
              {(Object.keys(COMPETITORS) as Competitor[]).filter(c => c !== competitor).map(c => (
                <Link
                  key={c}
                  href={`/laruHP/vs/${c}`}
                  className="border border-gray-200 text-gray-600 hover:border-sky-300 hover:text-sky-600 px-4 py-2 rounded-xl text-sm transition-all"
                >
                  vs {COMPETITORS[c].name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-8 text-center text-xs text-gray-400">
        © 2026 株式会社LARUVisona. All Rights Reserved. ·{' '}
        <Link href="/laruHP" className="hover:text-gray-600">LARU HP トップ</Link>
      </footer>
    </div>
  );
}
