import type { Metadata } from 'next';
import Link from 'next/link';
import LarubotContactForm from '@/components/LarubotContactForm';
import { jsonForScript } from '@/lib/safe-markup';
import { serviceOffersLd, breadcrumbLd } from '@/lib/organization-ld';

export const metadata: Metadata = {
  title: '受託開発サービスと料金 | 株式会社LaruVisona',
  description:
    '自社サービスを作って、課金して、毎日運用している会社が受託も請けています。だから納品後に何が起きるかを知っています。安全点検・修理・ホームページ制作・業務の仕組みづくり・サービス開発・保守。料金の目安つき。',
  alternates: { canonical: 'https://laruvisona.jp/services' },
  openGraph: {
    title: '受託開発サービスと料金 | 株式会社LaruVisona',
    description: '自社サービスを作って、課金して、運用している会社の受託開発。納品して終わりにしません。',
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
    note: '期間 1〜2週間／報告書でお渡しします。修正作業は別途お見積もり',
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
    desc: 'フォームが送れない、メールが届かない、表示が崩れる。原因を調べて直します。小さな困りごとでも構いません。',
    points: [
      'まず原因を特定してご報告',
      'そのまま修理まで対応可能',
      '他社が作ったシステムでも対応します',
      '再発しないよう原因からの修正',
    ],
  },
  {
    no: '03',
    title: 'ホームページ制作・改修',
    price: '¥300,000〜',
    note: '5ページ程度／公開作業まで。既存サイトの改修は内容によりこれ以下でも承ります',
    desc: '企業・店舗の顔になるホームページを、新規でも作り直しでも。今のサイトを活かした部分改修もできます。',
    points: [
      '新規制作と、既存サイトの作り直しの両方',
      '一部だけの改修・ページ追加も可',
      'スマートフォン対応・お問い合わせフォーム',
      '公開作業まで一括対応',
    ],
  },
  {
    no: '04',
    title: '業務の仕組みづくり',
    price: '¥500,000〜',
    note: 'まずは1画面・2週間から。動くものを見てから広げられます',
    desc: '見積・受注・案件の進捗・請求・日報。紙やエクセルで回している仕事を、画面の上で回るようにします。',
    points: [
      '今のやり方を崩さずに、一部から置き換え',
      '案件の進み具合が一覧で見える',
      '放置されている案件を拾い上げる通知',
      '既存システムへのAI組み込みも',
    ],
  },
  {
    no: '05',
    title: 'Webサービスの開発',
    price: '¥1,500,000〜',
    note: 'まずは1画面・2週間 ¥250,000〜 から。既存サイトへの決済追加のみなら、これより小さく収まることもあります',
    desc: '新しいサービスを、企画の整理から開発・公開・運用まで。クレジットカード決済を含むサービスの実績があります。',
    points: [
      '構想の整理からご一緒に',
      '決済・会員登録・通知などの仕組み',
      '公開後の運用・改善まで',
      '話を聞いた本人が、そのまま作ります',
    ],
  },
  {
    no: '06',
    title: '保守・運用',
    price: '月額 ¥30,000〜',
    note: '納品物には標準でお付けしています（ご不要であれば外せます）',
    desc: '公開して終わりにしません。動き続けるところまでを、ひとつの仕事と考えています。',
    points: [
      '公開後の更新対応',
      '障害発生時の対応',
      'バックアップの確認',
      '小さな相談は、この中で対応します',
    ],
  },
];

// 「困りごと」の言葉で並べた、実際に手を動かしている領域。
const TROUBLES = [
  '問い合わせフォームが動かない・メールが届かない',
  '表示が崩れる・スマホでレイアウトが崩れる',
  '社内で作ったツールを、社外の人にも安全に使わせたい',
  '既存のシステムにAIを組み込みたい',
  'サイトを作り直したい・古いまま止まっている',
  '紙やエクセルで回している業務を、仕組みにしたい',
  '新しいサービスを始めたいが、作れる人がいない',
  'サイトでクレジットカード決済を受け取りたい',
  '前に頼んだ会社と連絡が取れなくなった',
  'システムが時々止まる・原因が追えない',
];

// 相見積もりで比べられる前に、比べる軸を置く。
// ここに書くのは、自社サービスで実際に起きて直したことだけ。
// 一般論や、起きていないことは書かない（書いた瞬間に他社と同じになる）。
const OPERATIONS: { title: string; body: string }[] = [
  {
    title: '決済の通知が1回落ちると、課金されているのに使えない人ができる',
    body: '契約状態を決済サービスからの通知だけで書いていると、通知が1回届かなかった人は、お金を払っているのに機能が開きません。しかも契約し直そうとすると「既存の契約があります」で弾かれ、本人には直しようがない。定期的に決済側と突き合わせて直す処理が要ります。',
  },
  {
    title: '画面に出している金額と、実際に請求される額がずれる',
    body: '料金は画面の文言と決済サービスの設定の2か所にあり、片方だけ直すとずれます。1円のずれでも、広告と違う額を請求したことになります。人が目で照らし合わせる運用では必ず抜けるので、決済を作る直前に機械が突き合わせる形にしています。',
  },
  {
    title: '「最低6ヶ月」の契約が、7ヶ月目以降も解約できなくなる',
    body: '最低利用期間の判定に「いまの請求期間の終わり」を使うと、支払うたびに日付が未来へ動きます。契約中はいつ見ても未来なので、規約で約束した期日を過ぎても解約画面が開きません。買う前に規約を読む人は、守られていない約束を見つけます。',
  },
  {
    title: '書いたページが、誰からも辿れない場所に置かれている',
    body: '公開したつもりのページが、サイトのどこからもリンクされておらず、サイトマップにも入っていない。開けば表示されるので、気づく機会がありません。書いた本人だけが「ある」と思っている状態になります。',
  },
  {
    title: 'アクセス計測の設定ひとつで、公開サイトが全部落ちる',
    body: '計測用の署名鍵が短いだけで例外が投げられ、顧客の公開ページがまるごとエラーになる作りでした。止めるべきは計測だけで、顧客のサイトではありません。付帯機能の失敗が本体を巻き込まない設計が要ります。',
  },
  {
    title: '自動更新の契約者に、毎月「もうすぐ終わります」と通知していた',
    body: '契約終了日として請求期間の終わりを見ていたため、自動更新される人が毎月、更新日の2週間前から終了予告を受け取っていました。動いてはいるが、嘘をついている。この種の不具合は、テストでは落ちません。',
  },
];

const SCOPE = ['Python', 'JavaScript', 'データベース', 'AI連携', 'サーバー構築', '既存システムの改修'];

const PROCESS = [
  { step: 'STEP 1', title: 'ご相談', note: '無料', desc: '困りごと・やりたいことをお聞かせください。' },
  { step: 'STEP 2', title: 'お見積もり', note: '', desc: '内容を整理し、費用と期間をご提示します。' },
  { step: 'STEP 3', title: '着手', note: '', desc: 'ご合意のうえ開発・作業を開始します。' },
  { step: 'STEP 4', title: '納品', note: '', desc: '動作を確認いただき、お引き渡しします。' },
  { step: 'STEP 5', title: '保守', note: '標準', desc: '公開後の更新・障害対応を継続サポート。ご不要であれば外せます。' },
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
    link: { href: 'https://laruhp.com/', label: 'LARU HP を見る', external: true },
  },
  {
    // iOSアプリはまだ出していない。出していないものを実績に書かない。
    name: 'FLASTAL',
    role: 'クライアントのサービス開発',
    desc: 'フラワースタンドを贈るためのクラウドファンディングサービス。画面の実装から決済、公開後の運用まで担当しています。',
    tags: ['Next.js', 'Stripe決済', 'PostgreSQL'],
    link: { href: 'https://www.flastal.com', label: 'FLASTAL を見る', external: true },
  },
];

// 導入事例。社名掲載の許可をいただいた、社外のお客様だけを置く。
// 身内・関係会社はここに入れない。読む人には見分けがつかず、
// あとで分かったときに、他の記載まで疑われるため。
// 効果の数値はまだ計測していないため、書けるのは「何に使われているか」まで。
// 数字が取れた時点で metrics を足す。取れていない数字は書かない。
const CASE_STUDIES: {
  company: string;
  product: string;
  field: string;
  area: string;
  body: string;
}[] = [
  {
    company: '日本エンドレス株式会社',
    product: 'LARUbot',
    field: '業務用マット・モップのレンタル／衛生用品の販売',
    area: '東京都板橋区・創業50年以上',
    body:
      '営業案件の管理にお使いいただいています。案件ボードで商談がどの段階にあるかを追い、保留にした案件には理由と次回の確認予定日を残す。しばらく動いていない案件は通知で拾い上げる。運用しながらご要望をうかがい、機能を足しています。',
  },
];

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function ServicesPage() {
  // 料金は画面の SERVICES から取り出す。書き写すと、料金表を直したときに
  // 構造化データだけ古い額が残る。
  const ld = [
    serviceOffersLd(SERVICES),
    breadcrumbLd([
      { name: 'ホーム', path: '/' },
      { name: '受託開発サービスと料金', path: '/services' },
    ]),
  ];

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(ld) }} />
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
              つくって、売って、<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">運用している。</span>
            </h1>
            <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-10">
              受託開発の会社の多くは、自社のサービスを持っていません。納品して終わりだからです。<br className="hidden md:block" />
              私たちは自分で作ったサービスに自分で課金し、毎日動かしています。<br className="hidden md:block" />
              だから、公開したあとに何が起きるかを知っています。
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

        {/* 運用していないと気づけないこと。
            相見積もりで比べられる前に、比べる軸を置いておくための節。
            ここに書いてあるのは、すべて自社サービスで実際に起きて直したことである。
            起きていないことは書かない。 */}
        <section className="px-6 py-16 md:py-24 border-t border-white/5 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-5">
                <div className="h-[1px] w-10 bg-blue-500" />
                <span className="text-blue-400 font-bold text-xs tracking-[0.3em]">作るだけでは終わらない</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                運用していないと、<br className="md:hidden" />気づけないこと。
              </h2>
              <p className="text-slate-400 text-sm mt-4 max-w-2xl leading-relaxed">
                以下はすべて、自社サービスで実際に起きて、直したことです。
                作って納めるだけの体制では、そもそも見つかりません。
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              {OPERATIONS.map(o => (
                <div key={o.title} className="bg-[#0f172a] border border-white/5 rounded-2xl p-7">
                  <h3 className="text-base font-bold leading-7 mb-3">{o.title}</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">{o.body}</p>
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-xs mt-8 max-w-2xl leading-relaxed">
              どれも、公開した時点では誰にも見えません。使われはじめて、しばらく経ってから出てきます。
              自分のサービスで一度踏んでいるかどうかは、設計の段階から差が出ます。
            </p>
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
            <div className="grid sm:grid-cols-2 gap-3 mb-8">
              {TROUBLES.map(t => (
                <div key={t} className="flex items-start gap-3 bg-[#0f172a] border border-white/5 rounded-xl px-5 py-4">
                  <span className="text-blue-400 mt-0.5"><Check /></span>
                  <span className="text-slate-200 text-sm leading-relaxed">{t}</span>
                </div>
              ))}
            </div>
            {/* 頼む前に自分で切り分けたい人の行き先。ここで解決してくれて構わない。 */}
            <div className="mb-12 bg-[#0f172a] border border-white/5 rounded-2xl p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
              <div>
                <h3 className="font-bold mb-2">まず、自分で確かめてみたい方へ</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  よくある不調は、原因の当たりが付いています。確認する手順をまとめました。
                </p>
              </div>
              <Link href="/trouble" className="flex-shrink-0 border border-white/20 text-white px-6 py-3 rounded-xl font-bold text-sm text-center hover:bg-white/5 transition-all">
                よくある困りごと →
              </Link>
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

        {/* 導入事例（社名掲載の許可をいただいた分のみ） */}
        {CASE_STUDIES.length > 0 && (
          <section className="px-6 py-16 md:py-24 border-t border-white/5 bg-white/[0.02]">
            <div className="max-w-6xl mx-auto">
              <div className="mb-12">
                <div className="flex items-center gap-4 mb-5">
                  <div className="h-[1px] w-10 bg-blue-500" />
                  <span className="text-blue-400 font-bold text-xs tracking-[0.3em]">導入事例</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">使っていただいています</h2>
                <p className="mt-4 text-slate-400 text-sm leading-relaxed">社名の掲載について、ご本人の許可をいただいています。</p>
              </div>
              <div className={`grid gap-5 ${CASE_STUDIES.length > 1 ? 'md:grid-cols-2' : ''}`}>
                {CASE_STUDIES.map(c => (
                  <div key={c.company} className="bg-[#0f172a] border border-white/5 rounded-2xl p-7 flex flex-col">
                    <span className="self-start text-blue-400 text-[10px] font-bold tracking-[0.2em] border border-blue-400/30 rounded-full px-3 py-1 mb-4">
                      {c.product}
                    </span>
                    <h3 className="text-xl font-bold mb-2">{c.company}</h3>
                    <p className="text-slate-400 text-xs leading-relaxed mb-4">{c.field}</p>
                    <p className="text-slate-300 text-sm leading-relaxed">{c.body}</p>
                    <span className="mt-auto pt-5 text-slate-500 text-[11px]">{c.area}</span>
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
