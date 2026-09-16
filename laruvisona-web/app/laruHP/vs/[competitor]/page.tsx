import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { PLANS, TERMS } from '@/lib/laruhp-facts';
import { laruhpOgImage } from '@/lib/laruhp-seo';
import PublicFooter from '@/components/laruhp/PublicFooter';

/**
 * 他社と比べるページ。
 *
 * 書き方の方針（2026-09-17 に全面的に書き直した）:
 *   - **他社の機能の有無や価格を、こちらが断定しない。** 以前は他社の欠点（機能が無い・
 *     サポートが弱い等）を表の×として並べていた。裏付けの日付も出典も無く、相手の製品は
 *     更新される。比較広告は、客観的で確かめられる事実にもとづく必要がある。
 *   - 代わりに「**何を見て決めるか**」を並べ、その項目について**LARU HPがどうか**だけを書く。
 *     これはこちらが責任を持てる事実で、テストでも固定できる。
 *   - 相手の最新は、相手の公式ページで確かめてもらう。リンクだけ置く。
 */

type Competitor = 'jimdo' | 'wix' | 'canva' | 'studio';

interface CompetitorData {
  name: string;
  /** その道具の得意なところ。事実として広く知られている範囲にとどめる。 */
  strength: string;
  /** 料金・機能の最新を確かめる先（公式） */
  officialUrl: string;
  officialLabel: string;
  /** こういう人はそちらのほうが向いている、という正直な線引き */
  betterFor: string;
}

const COMPETITORS: Record<Competitor, CompetitorData> = {
  jimdo: {
    name: 'Jimdo',
    strength: '長く使われているホームページ作成サービスで、画面が簡素です。',
    officialUrl: 'https://www.jimdo.com/jp/pricing/',
    officialLabel: 'Jimdo の料金ページ',
    betterFor: 'ページを1枚置いておければ十分で、問い合わせや予約をサイトで受ける予定がない方。',
  },
  wix: {
    name: 'Wix',
    strength: 'テンプレートと追加機能（アプリ）の数が多く、作り込みの幅があります。',
    officialUrl: 'https://ja.wix.com/plans',
    officialLabel: 'Wix の料金ページ',
    betterFor: '自分で細かく作り込みたい方、時間をかけて機能を組み合わせたい方。',
  },
  canva: {
    name: 'Canva',
    strength: 'デザインを作る道具として強く、チラシやSNS画像と同じ感覚でページを作れます。',
    officialUrl: 'https://www.canva.com/ja_jp/pricing/',
    officialLabel: 'Canva の料金ページ',
    betterFor: '見た目を自分で作りたい方、すでにCanvaで素材を作っている方。',
  },
  studio: {
    name: 'STUDIO',
    strength: '日本製のノーコードツールで、デザインの自由度が高いのが特長です。',
    officialUrl: 'https://studio.design/ja/pricing',
    officialLabel: 'STUDIO の料金ページ',
    betterFor: 'デザインにこだわりがあり、レイアウトを自分で組める方。',
  },
};

/**
 * 比べるときの見る点と、LARU HP の答え。
 * 答えはすべて、このリポジトリの実装・料金定義で裏が取れるものだけを書く。
 */
const CRITERIA: { point: string; why: string; laru: string }[] = [
  {
    point: '毎月いくら、いつまで払うのか',
    why: '月額だけを見ると差が小さく見えます。最低利用期間と、やめられる時期まで含めた総額で比べてください。',
    laru: `HP単体プランは月額${PLANS[0].monthly.toLocaleString('ja-JP')}円（税別）から。${TERMS.firstMonthFree}、最低利用期間は${TERMS.minimumMonths}ヶ月、${TERMS.cancel}。`,
  },
  {
    point: '作りはじめの手間',
    why: '白紙から作るのか、業種に合ったたたき台が出るのかで、公開までの時間が変わります。',
    laru: '業種と屋号を入れると、その業種で必要な節（メニュー・料金・アクセス・問い合わせなど）が入ったたたき台が出ます。15業種ぶん用意しています。',
  },
  {
    point: '公開したあと、自分で直せるか',
    why: '直すたびに依頼が必要だと、更新が止まります。止まったサイトは読まれません。',
    laru: '文章も写真も、完成した見た目を見ながらその場で直せます。スマートフォンからも直せます。',
  },
  {
    point: '問い合わせと予約を、サイトで受けられるか',
    why: '電話とSNSだけだと、営業時間外の相談を取りこぼします。',
    laru: '問い合わせフォームは標準。予約は「空き枠を出してその場で確定する」形と「希望日時を受けて折り返す」形を、設定で切り替えられます。担当者や設備の重複も見ます。',
  },
  {
    point: '検索に出るための設定が、自動で入るか',
    why: 'タイトル・説明文・構造化データを自分で書くのは、慣れていないと難しいところです。',
    laru: 'ページの説明文は、書かなければ本文から作ります。業種に合わせた構造化データとサイトマップも自動で入ります。',
  },
  {
    point: 'やめるとき、中身を持ち出せるか',
    why: '文章と写真は自分のものです。持ち出せないと、次の選択肢が狭くなります。',
    laru: '設定画面から、公開しているページを1枚のHTMLファイルとして書き出せます。契約が終わったあとでも取り出せます。',
  },
  {
    point: '独自ドメインを自分名義のまま使えるか',
    why: 'サービス側の名義になっていると、移すときに手間がかかります。',
    laru: '自分で取得したドメインを、移管せずに接続できます。DNSの設定値は画面に出します。取得・更新費は登録事業者へのお支払いです。',
  },
  {
    point: '困ったときに日本語で聞けるか',
    why: '手が止まる場所は、たいてい小さなことです。聞ける相手がいるかどうかで進みが変わります。',
    laru: 'メールでお受けしています（info@laruvisona.jp）。作っているのは日本の会社です。',
  },
];

export async function generateStaticParams() {
  return Object.keys(COMPETITORS).map(c => ({ competitor: c }));
}

export async function generateMetadata({ params }: { params: Promise<{ competitor: string }> }): Promise<Metadata> {
  const { competitor } = await params;
  const data = COMPETITORS[competitor as Competitor];
  if (!data) return {};
  const title = `LARU HP と ${data.name} を比べるとき｜見る点と、LARU HPの答え`;
  const description = `${data.name} と LARU HP のどちらにするか迷っている方へ。料金の総額・作りはじめ・公開後の更新・予約・SEO・持ち出しなど、比べるときに見る点を並べ、それぞれLARU HPがどうかを書いています。`;
  return {
    title,
    description,
    alternates: { canonical: `https://laruhp.com/vs/${competitor}` },
    robots: { index: true, follow: true },
    openGraph: { title, description, url: `https://laruhp.com/vs/${competitor}`, type: 'article', images: [laruhpOgImage(title, `${data.name} と比べるときに見る点`)] },
    twitter: { card: 'summary_large_image', title, description, images: [laruhpOgImage(title, `${data.name} と比べるときに見る点`)] },
  };
}

export default async function VsPage({ params }: { params: Promise<{ competitor: string }> }) {
  const { competitor } = await params;
  const data = COMPETITORS[competitor as Competitor];
  if (!data) notFound();

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'LARU HP', item: 'https://laruhp.com/' },
      { '@type': 'ListItem', position: 2, name: `${data.name} との比較`, item: `https://laruhp.com/vs/${competitor}` },
    ],
  };

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-sky-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="https://laruhp.com/" className="flex items-center gap-3">
            <Image src="/laruhp_logo.png" alt="LARU HP" height={32} width={160} className="h-8 w-auto" />
          </Link>
          <Link href="https://laruhp.com/plans" className="bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-sky-500 transition-all">
            料金を見る →
          </Link>
        </div>
      </header>

      <main className="pt-28 pb-20 px-6">
        <div className="max-w-3xl mx-auto">

          <nav className="text-xs text-gray-400 mb-6">
            <Link href="https://laruhp.com/" className="hover:text-gray-600">LARU HP</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-500">{data.name} との比較</span>
          </nav>

          <h1 className="text-3xl md:text-4xl font-black mb-5 leading-tight">
            LARU HP と {data.name} を<br className="hidden md:block" />比べるとき
          </h1>
          <p className="text-gray-600 leading-relaxed mb-4">
            {data.strength}
            どちらがよいかは、何をしたいかで変わります。ここでは、比べるときに見る点を並べ、
            それぞれ<strong>LARU HPがどうか</strong>を書いています。
          </p>
          <p className="text-gray-500 text-sm leading-relaxed mb-10">
            {data.name} の料金と機能は変わります。最新は
            <a href={data.officialUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline mx-1">{data.officialLabel}</a>
            でご確認ください。こちらのページでは、他社の機能の有無や金額をこちらから断定することはしていません。
          </p>

          <div className="space-y-4 mb-12">
            {CRITERIA.map((item, i) => (
              <section key={item.point} className="bg-white border border-gray-200 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-sky-100 text-sky-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <h2 className="font-bold text-gray-900 mb-1">{item.point}</h2>
                    <p className="text-gray-500 text-sm leading-relaxed mb-3">{item.why}</p>
                    <p className="text-gray-800 text-sm leading-relaxed bg-sky-50 border border-sky-100 rounded-xl p-3">
                      <span className="font-bold text-sky-700 mr-1">LARU HP:</span>
                      {item.laru}
                    </p>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <section className="bg-white border border-gray-200 rounded-2xl p-6 mb-12">
            <h2 className="font-bold text-gray-900 mb-2">{data.name} のほうが向いている場合</h2>
            <p className="text-gray-600 text-sm leading-relaxed">{data.betterFor}</p>
            <p className="text-gray-500 text-sm leading-relaxed mt-3">
              LARU HPが向いているのは、<strong>公開したあとに自分で育てたい</strong>方と、
              <strong>問い合わせや予約をサイトで受けたい</strong>方です。事業の整理から相談したい場合や、
              他社と明確に違う見た目が要る場合は、制作会社へ依頼したほうが結果が出ます。
            </p>
          </section>

          <div className="bg-gradient-to-br from-sky-600 to-indigo-600 rounded-2xl p-8 md:p-10 text-center text-white mb-10">
            <h2 className="text-2xl font-black mb-3">先に、できあがりを見てから決める</h2>
            <p className="text-sky-100 text-sm mb-7">
              業種と屋号を入れると、たたき台がその場で出ます。申し込みの前に見られます。
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="https://laruvisona.jp/laruHP/studio" className="inline-block bg-white text-sky-600 font-black text-sm px-8 py-3.5 rounded-2xl hover:bg-sky-50 transition-colors shadow-lg">
                たたき台を作ってみる
              </Link>
              <Link href="https://laruhp.com/contact" className="inline-block border border-white/50 text-white font-bold text-sm px-8 py-3.5 rounded-2xl hover:bg-white/10 transition-colors">
                先に相談する
              </Link>
            </div>
            <div className="mt-5 text-sky-200 text-xs">
              {TERMS.firstMonthFree}・最低利用期間{TERMS.minimumMonths}ヶ月・{TERMS.cancel}
            </div>
          </div>

          <div className="text-center">
            <p className="text-gray-400 text-sm mb-4">ほかの道具とも比べる</p>
            <div className="flex justify-center gap-3 flex-wrap">
              {(Object.keys(COMPETITORS) as Competitor[]).filter(c => c !== competitor).map(c => (
                <Link
                  key={c}
                  href={`https://laruhp.com/vs/${c}`}
                  className="border border-gray-200 bg-white text-gray-600 hover:border-sky-300 hover:text-sky-600 px-4 py-2 rounded-xl text-sm transition-all"
                >
                  {COMPETITORS[c].name} と比べる
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

export const VS_COMPETITORS = Object.keys(COMPETITORS);
