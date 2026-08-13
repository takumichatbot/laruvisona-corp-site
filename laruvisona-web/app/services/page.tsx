import type { Metadata } from 'next';
import Link from 'next/link';
import LarubotContactForm from '@/components/LarubotContactForm';

export const metadata: Metadata = {
  title: '受託開発サービスと料金 | 株式会社LaruVisona',
  description:
    'AIシステムの安全点検、サイト・システムの修理、ホームページ制作、AI組み込み・システム開発、保守。Python・JavaScript・AI連携で「つくる・直す・組み込む」をワンストップで。まずは無料でご相談ください。',
  alternates: { canonical: 'https://laruvisona.jp/services' },
  openGraph: {
    title: '受託開発サービスと料金 | 株式会社LaruVisona',
    description: 'つくる・直す・組み込む。AIとモダンWeb技術の受託開発。まずは無料でご相談ください。',
    url: 'https://laruvisona.jp/services',
    siteName: '株式会社LaruVisona',
    type: 'website',
    locale: 'ja_JP',
  },
};

// サービスと料金。金額はすべて「〜」で幅を持たせた参考価格（確定金額ではない）。
const SERVICES: {
  no: string;
  title: string;
  price: string;
  note?: string;
  desc: string;
  points: string[];
  highlight?: boolean;
}[] = [
  {
    no: '01',
    title: 'AIシステム 安全点検',
    price: '¥150,000〜',
    note: '期間 1〜2週間／修正作業は別途お見積もり',
    desc: '社内で作ったAIツールやシステムを点検し、危ない箇所と直し方を報告書でお渡しします。',
    points: [
      '権限の設定に抜けがないか',
      '他社・他ユーザーのデータが見えていないか',
      '認証情報（パスワード・APIキー等）の管理',
      '止まったときに原因を追える状態か',
    ],
    highlight: true,
  },
  {
    no: '02',
    title: 'サイト・システムの修理',
    price: '¥50,000〜',
    note: '原因調査のみは ¥30,000（修理に進む場合は調査費を差し引きます）',
    desc: 'フォームが送れない、メールが届かない、表示が崩れる。原因を調べて直します。',
    points: [
      'まず原因を特定してご報告',
      'そのまま修理まで対応可能',
      '再発しないよう原因からの修正',
    ],
  },
  {
    no: '03',
    title: 'ホームページ制作',
    price: '¥300,000〜',
    note: '5ページ程度／公開作業まで',
    desc: '企業・店舗の顔になるホームページを制作します。',
    points: [
      '5ページ程度の構成',
      'スマートフォン対応',
      'お問い合わせフォーム',
      '公開作業まで一括対応',
    ],
  },
  {
    no: '04',
    title: 'AI組み込み・システム開発',
    price: '¥500,000〜',
    note: 'ご要望を伺ってお見積もりします',
    desc: '既存システムへのAI導入、業務ツールの新規開発を行います。',
    points: [
      '既存システムへのAI導入',
      '業務ツールの新規開発',
      '要件のヒアリングからご一緒に',
    ],
  },
  {
    no: '05',
    title: '保守',
    price: '月額 ¥30,000〜',
    note: '公開後の継続サポート（任意）',
    desc: '公開後も安心してお使いいただけるよう、継続的にサポートします。',
    points: [
      '公開後の更新対応',
      '障害発生時の対応',
      'バックアップの確認',
    ],
  },
];

// 「困りごと」の言葉で並べた、実際に手を動かしている領域。
const TROUBLES = [
  '問い合わせフォームが動かない・メールが届かない',
  '表示が崩れる・スマホでレイアウトが崩れる',
  '社内で作ったツールを、社外の人にも安全に使わせたい',
  '既存のシステムにAIを組み込みたい',
  'サイトを作り直したい',
  'システムが時々止まる・原因が追えない',
];

const SCOPE = ['Python', 'JavaScript', 'データベース', 'AI連携', 'サーバー構築', '既存システムの改修'];

const PROCESS = [
  { step: 'STEP 1', title: 'ご相談', note: '無料', desc: '困りごと・やりたいことをお聞かせください。' },
  { step: 'STEP 2', title: 'お見積もり', note: '', desc: '内容を整理し、費用と期間をご提示します。' },
  { step: 'STEP 3', title: '着手', note: '', desc: 'ご合意のうえ開発・作業を開始します。' },
  { step: 'STEP 4', title: '納品', note: '', desc: '動作を確認いただき、お引き渡しします。' },
  { step: 'STEP 5', title: '保守', note: '任意', desc: '公開後の更新・障害対応を継続サポート。' },
];

// 開発・運用してきたもの（実績の代わりに「自社で作ったもの」を提示）。
const BUILT: {
  name: string;
  role: string;
  desc: string;
  tags: string[];
  link?: { href: string; label: string; external: boolean };
}[] = [
  {
    name: 'LARUbot',
    role: '自社プロダクト（企画・開発・運用）',
    desc: 'AIが問い合わせに応対し、顧客情報と案件を記録する法人向けサービス。企画・開発・運用まですべて自社で行っています。外部サービス（決済・メール・カレンダー・チャット）との連携にも対応。',
    tags: ['Python', 'Flask', 'PostgreSQL', 'AI連携', 'マルチテナント構成'],
    link: { href: 'https://larubot.tokyo', label: 'larubot.tokyo を見る', external: true },
  },
  {
    name: 'LARU HP',
    role: '自社プロダクト（企画・開発・運用）',
    desc: '業種情報を入力するだけで、AIがホームページを自動生成する自社SaaS。ビジュアルエディタ・SEO自動最適化まで自社開発しています。',
    tags: ['Next.js', 'React', 'TypeScript', '生成AI連携'],
    link: { href: '/laruHP', label: 'LARU HP を見る', external: false },
  },
  {
    name: 'FLASTAL',
    role: 'iOSネイティブアプリの開発',
    desc: 'Webアプリをネイティブアプリ化し、App Store配信に対応させました。',
    tags: ['Capacitor', 'iOS', 'App Store'],
  },
];

// 導入事例。許可が取れた時点で1件目をここに追加する。現時点では空＝非表示。
const CASE_STUDIES: { title: string; body: string }[] = [];

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#030712]/85 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/images/logo_dark.png" alt="株式会社LaruVisona" className="h-7 w-auto object-contain" />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-5 text-sm">
            <Link href="/#about" className="hidden sm:inline text-slate-300 hover:text-white transition-colors">会社概要</Link>
            <Link href="/#product" className="hidden sm:inline text-slate-300 hover:text-white transition-colors">プロダクト</Link>
            <a href="#contact" className="bg-white text-black px-4 py-2 rounded-xl font-bold text-xs sm:text-sm hover:bg-blue-50 transition-all">
              無料で相談する
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="px-6 pt-20 pb-16 md:pt-28 md:pb-20 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] max-w-full h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.18),transparent_65%)]" />
          </div>
          <div className="max-w-4xl mx-auto text-center relative">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="h-[1px] w-10 bg-blue-500" />
              <span className="text-blue-400 font-bold text-xs tracking-[0.3em]">受託開発</span>
              <div className="h-[1px] w-10 bg-blue-500" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.15] mb-6">
              つくる・直す・<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">組み込む。</span>
            </h1>
            <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-10">
              AIとモダンWeb技術で、御社の「困った」を解決します。<br className="hidden md:block" />
              点検・修理から、ホームページ制作・AI開発・保守まで。代表エンジニアが直接担当します。
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <a href="#contact" className="w-full sm:w-auto bg-white text-black px-8 py-4 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all">
                まずは無料で相談する →
              </a>
              <a href="#services" className="w-full sm:w-auto border border-white/20 text-white px-8 py-4 rounded-xl font-bold text-sm hover:bg-white/5 transition-all">
                サービスと料金を見る
              </a>
            </div>
          </div>
        </section>

        {/* サービスと料金 */}
        <section id="services" className="px-6 py-16 md:py-24 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-5">
                <div className="h-[1px] w-10 bg-blue-500" />
                <span className="text-blue-400 font-bold text-xs tracking-[0.3em]">サービスと料金</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">お手伝いできること</h2>
              <p className="text-slate-400 text-sm mt-4">
                料金はいずれも目安です。内容を伺ったうえで、正式なお見積もりをお出しします。
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {SERVICES.map(s => (
                <div
                  key={s.no}
                  className={`rounded-2xl p-7 border flex flex-col ${
                    s.highlight
                      ? 'bg-gradient-to-br from-blue-900/30 to-[#0f172a] border-blue-500/25'
                      : 'bg-[#0f172a] border-white/5'
                  }`}
                >
                  {/* スマホ幅では縦積み、sm以上で横並び。価格は縮まないため、狭い幅で横並びにすると
                      長いサービス名に押されてカード外へはみ出す（実測 375/320/390px）。縦積みで解消する。 */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-4 mb-4">
                    <div className="min-w-0">
                      <span className="text-slate-500 font-en font-bold text-xs tracking-widest">{s.no}</span>
                      <h3 className="text-xl font-bold mt-1 break-words">{s.title}</h3>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-2xl font-bold text-blue-300 whitespace-nowrap">{s.price}</div>
                    </div>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">{s.desc}</p>
                  <ul className="space-y-2 text-sm text-slate-300 mb-4 flex-grow">
                    {s.points.map(p => (
                      <li key={p} className="flex items-start gap-2.5">
                        <span className="text-blue-400"><Check /></span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  {s.note && (
                    <p className="text-slate-500 text-xs leading-relaxed border-t border-white/5 pt-3">{s.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* こんなときに（対応できること＝困りごと） */}
        <section className="px-6 py-16 md:py-24 border-t border-white/5 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-5">
                <div className="h-[1px] w-10 bg-blue-500" />
                <span className="text-blue-400 font-bold text-xs tracking-[0.3em]">こんなときに</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">対応できること</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-12">
              {TROUBLES.map(t => (
                <div key={t} className="flex items-start gap-3 bg-[#0f172a] border border-white/5 rounded-xl px-5 py-4">
                  <span className="text-blue-400 mt-0.5"><Check /></span>
                  <span className="text-slate-200 text-sm leading-relaxed">{t}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold tracking-widest mb-3">対応範囲</p>
              <div className="flex flex-wrap gap-2">
                {SCOPE.map(x => (
                  <span key={x} className="bg-white/5 border border-white/10 text-slate-300 text-xs font-bold px-3.5 py-1.5 rounded-full">
                    {x}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 開発してきたもの */}
        <section className="px-6 py-16 md:py-24 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-5">
                <div className="h-[1px] w-10 bg-blue-500" />
                <span className="text-blue-400 font-bold text-xs tracking-[0.3em]">私たちが作ったもの</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">開発してきたもの</h2>
              <p className="text-slate-400 text-sm mt-4">
                自社サービスの企画・開発・運用を通じて、設計から公開後の運用までを一貫して手がけています。
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {BUILT.map(b => (
                <div key={b.name} className="bg-[#0f172a] border border-white/5 rounded-2xl p-7 flex flex-col">
                  <h3 className="text-2xl font-bold font-en tracking-tight mb-1">{b.name}</h3>
                  <p className="text-blue-400 text-xs font-bold mb-4">{b.role}</p>
                  <p className="text-slate-300 text-sm leading-relaxed flex-grow mb-5">{b.desc}</p>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {b.tags.map(t => (
                      <span key={t} className="bg-white/5 text-slate-400 text-[10px] font-bold px-2.5 py-1 rounded-full font-en">{t}</span>
                    ))}
                  </div>
                  {b.link && (
                    b.link.external ? (
                      <a href={b.link.href} target="_blank" rel="noopener noreferrer" className="text-white font-bold text-sm inline-flex items-center gap-2 hover:gap-3 transition-all">
                        {b.link.label} →
                      </a>
                    ) : (
                      <Link href={b.link.href} className="text-white font-bold text-sm inline-flex items-center gap-2 hover:gap-3 transition-all">
                        {b.link.label} →
                      </Link>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 導入事例（許可取得後に1件目を掲載。現時点では非表示） */}
        {CASE_STUDIES.length > 0 && (
          <section className="px-6 py-16 md:py-24 border-t border-white/5 bg-white/[0.02]">
            <div className="max-w-6xl mx-auto">
              <div className="mb-12">
                <div className="flex items-center gap-4 mb-5">
                  <div className="h-[1px] w-10 bg-blue-500" />
                  <span className="text-blue-400 font-bold text-xs tracking-[0.3em]">導入事例</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">導入事例</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                {CASE_STUDIES.map(c => (
                  <div key={c.title} className="bg-[#0f172a] border border-white/5 rounded-2xl p-7">
                    <h3 className="text-xl font-bold mb-3">{c.title}</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">{c.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 進め方 */}
        <section className="px-6 py-16 md:py-24 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-5">
                <div className="h-[1px] w-10 bg-blue-500" />
                <span className="text-blue-400 font-bold text-xs tracking-[0.3em]">進め方</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">ご依頼の流れ</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {PROCESS.map(p => (
                <div key={p.step} className="bg-[#0f172a] border border-white/5 rounded-2xl p-6 flex flex-col">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                    <span className="text-blue-400 font-en font-bold text-sm tracking-widest">{p.step}</span>
                    {p.note && <span className="shrink-0 text-emerald-400 text-[10px] font-bold border border-emerald-400/30 rounded-full px-2 py-0.5">{p.note}</span>}
                  </div>
                  <h3 className="font-bold text-lg mb-2">{p.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* お問い合わせ */}
        <section id="contact" className="px-6 py-16 md:py-24 border-t border-white/5 bg-white/[0.02] scroll-mt-20">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-4 mb-5">
                <div className="h-[1px] w-10 bg-blue-500" />
                <span className="text-blue-400 font-bold text-xs tracking-[0.3em]">お問い合わせ</span>
                <div className="h-[1px] w-10 bg-blue-500" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">まずは無料でご相談ください</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                「これはお願いできる？」という段階でも構いません。<br className="hidden md:block" />
                内容を確認のうえ、通常2営業日以内にご返信いたします。
              </p>
            </div>
            <div className="bg-white border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden">
              <LarubotContactForm />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-black text-slate-500 py-12 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 flex flex-col items-center gap-6 text-center">
          <img src="/images/logo_dark.png" alt="株式会社LaruVisona" className="h-7 w-auto object-contain opacity-80" />
          <div className="flex flex-wrap justify-center gap-6 text-xs font-bold tracking-widest uppercase">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/#about" className="hover:text-white transition-colors">Company</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
          <p className="text-xs font-mono text-slate-600">&copy; 2026 株式会社LaruVisona All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
