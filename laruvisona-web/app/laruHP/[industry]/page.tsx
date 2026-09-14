import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight, Check, Globe2, LayoutTemplate, MessageSquare, Search } from 'lucide-react';
import { jsonForScript } from '@/lib/safe-markup';
import { PLANS, TERMS } from '@/lib/laruhp-facts';
import { LARUHP_OG_IMAGE } from '@/lib/laruhp-seo';

const INDUSTRY_DATA = {
  restaurant: {
    name: '飲食店・カフェ', keyword: '飲食店 ホームページ作成',
    lead: '料理と空間の魅力を、来店前から伝える。',
    intro: 'メニュー、営業時間、席や予約方法を一つにまとめ、初めてのお客様が迷わず来店を決められる構成を作ります。',
    sections: ['料理・ドリンクのメニュー', '営業時間とアクセス', '予約・問い合わせ', '店内と料理の写真'],
    checks: ['価格と提供時間を最新に保つ', 'アレルギーや予約条件を明記する', '地図と入口の写真を載せる'],
  },
  beauty: {
    name: '美容室・サロン', keyword: '美容室 ホームページ作成',
    lead: '技術と空気感が伝わる、指名につながる入口へ。',
    intro: 'スタイル写真、メニュー、スタッフ、予約方法を同じ世界観で整えます。写真が主役になる余白とスマートフォンでの見え方を選べます。',
    sections: ['スタイルギャラリー', '施術メニューと料金', 'スタッフ紹介', '予約希望フォーム'],
    checks: ['生成画像は実績と区別する', '料金の条件を具体的に書く', '予約確定か希望受付かを明記する'],
  },
  clinic: {
    name: '整体・クリニック', keyword: '整体院 クリニック ホームページ作成',
    lead: '不安を減らし、受診前に必要な情報を届ける。',
    intro: '対応する悩み、施術や診療の流れ、費用、アクセスを読みやすく整理します。医療広告に関わる表現は事業者自身が確認して公開します。',
    sections: ['対応内容と方針', '担当者・院内紹介', '費用と受付時間', '予約希望・問い合わせ'],
    checks: ['効果を保証する表現を使わない', '資格と提供主体を正確に示す', '緊急時の窓口と区別する'],
  },
  legal: {
    name: '士業・コンサルタント', keyword: '士業 ホームページ作成',
    lead: '専門性を、初めて相談する人にも分かる言葉で。',
    intro: '取扱分野、相談の流れ、費用の考え方、担当者情報を整理し、相談前の不安を減らすページを作ります。',
    sections: ['取扱分野', '相談から依頼までの流れ', '費用の考え方', '担当者と事務所情報'],
    checks: ['資格と対応地域を正確に示す', '実績は確認できる範囲で載せる', '守秘と個人情報の扱いを示す'],
  },
  construction: {
    name: '建設・工務店', keyword: '工務店 ホームページ作成',
    lead: '施工の質と人柄を、写真と工程で伝える。',
    intro: '施工事例、対応工事、地域、見積もりの流れを整理します。完成写真だけでなく、考え方や仕事の進め方も伝えられます。',
    sections: ['施工事例', '対応する工事', '見積もりと工程', '会社・職人紹介'],
    checks: ['施工事例の許可を確認する', '価格は条件と範囲を添える', '対応地域と保証内容を明記する'],
  },
  realestate: {
    name: '不動産会社', keyword: '不動産会社 ホームページ作成',
    lead: '物件だけでなく、相談できる理由まで見せる。',
    intro: '売買、賃貸、管理などの取扱内容と地域情報を整理し、相談先としての強みが伝わる構成を作ります。',
    sections: ['取扱サービス', '地域と物件の情報', '担当者紹介', '査定・相談フォーム'],
    checks: ['物件情報の更新日を示す', '免許番号と事業者情報を載せる', '誇大な査定表現を避ける'],
  },
  retail: {
    name: '小売店・実店舗', keyword: '小売店 ホームページ作成',
    lead: '商品の背景まで伝え、来店と購入へつなぐ。',
    intro: '商品、店舗、入荷情報を写真中心にまとめます。必要に応じてショップとStripe決済を組み合わせられます。',
    sections: ['商品とカテゴリー', '店舗情報・アクセス', '新着のお知らせ', 'ショップ・問い合わせ'],
    checks: ['在庫と価格を最新に保つ', '送料や返品条件を明記する', '特定商取引法の表示を確認する'],
  },
  fitness: {
    name: 'フィットネス・スクール', keyword: 'フィットネス ホームページ作成',
    lead: '通う前の疑問を解き、体験への一歩を近くする。',
    intro: 'プログラム、料金、設備、担当者、体験方法を順番に説明し、自分に合うか判断しやすいサイトを作ります。',
    sections: ['プログラム', '料金と利用条件', '設備・担当者', '体験希望フォーム'],
    checks: ['成果を保証する表現を避ける', '休会・解約条件を明記する', '持ち物と利用上の注意を載せる'],
  },
  hotel: {
    name: 'ホテル・旅館', keyword: 'ホテル 旅館 ホームページ作成',
    lead: '滞在の時間を、予約前から想像できるサイトへ。',
    intro: '客室、食事、館内、アクセス、予約方法を写真とともに整理します。空室のリアルタイム管理が必要な場合は外部予約システムとの役割を分けます。',
    sections: ['客室と館内', '食事・過ごし方', 'プランと料金', 'アクセス・予約案内'],
    checks: ['空室表示の更新方法を決める', '料金に含まれる内容を示す', 'キャンセル条件を明記する'],
  },
  education: {
    name: '教育・習い事', keyword: 'スクール 教室 ホームページ作成',
    lead: '学び方と先生の人柄を、通う前に伝える。',
    intro: '対象、授業内容、日程、料金、体験方法を整理し、本人や保護者が比較しやすいサイトを作ります。',
    sections: ['コースと対象', '講師紹介', '日程と料金', '体験・資料請求'],
    checks: ['対象年齢と必要条件を示す', '実績の集計条件を明記する', '未成年者の個人情報を守る'],
  },
  wedding: {
    name: 'ウェディング', keyword: '結婚式場 ホームページ作成',
    lead: '一日の情景と選べる内容を、丁寧に案内する。',
    intro: '会場、料理、衣装、プラン、見学の流れを統一した写真と文章で伝えます。見本画像と実際の会場写真は明確に区別します。',
    sections: ['会場と挙式スタイル', '料理・衣装', 'プランと費用', '見学・相談フォーム'],
    checks: ['実際に選べる内容を掲載する', '見積もり条件を具体的にする', '写真の利用許諾を確認する'],
  },
  pet: {
    name: 'ペットサロン', keyword: 'ペットサロン ホームページ作成',
    lead: '大切な家族を任せられる安心を、先に届ける。',
    intro: '対応犬種、メニュー、料金、担当者、預かり条件を整理し、予約前に確認できる情報を揃えます。',
    sections: ['メニューと料金', 'スタッフ・設備', '利用条件と持ち物', '予約希望フォーム'],
    checks: ['対応できない状態を明記する', '追加料金の条件を示す', '写真掲載の同意を確認する'],
  },
  dental: {
    name: '歯科クリニック', keyword: '歯科医院 ホームページ作成',
    lead: '診療内容と通院の流れを、落ち着いて読める形に。',
    intro: '診療科目、担当医、設備、費用、受付方法を整理します。公開前に医療広告ガイドラインと各種表示を事業者自身で確認します。',
    sections: ['診療内容', '医師・スタッフ', '院内設備とアクセス', '受付・問い合わせ'],
    checks: ['自由診療の費用とリスクを示す', '比較優良表現を避ける', '緊急対応の範囲を明記する'],
  },
  photo: {
    name: 'フォトスタジオ', keyword: 'フォトスタジオ ホームページ作成',
    lead: '写真の世界観を守りながら、依頼方法を分かりやすく。',
    intro: '作品、撮影プラン、担当者、納品までの流れを写真中心に構成します。縦横の作品をスマートフォンでも見やすく整えられます。',
    sections: ['作品・撮影例', '撮影プラン', '撮影から納品まで', '相談・予約希望'],
    checks: ['被写体の掲載許可を確認する', '納品形式と期間を示す', 'キャンセル条件を明記する'],
  },
  accounting: {
    name: '税理士・会計士', keyword: '税理士 ホームページ作成',
    lead: '依頼できる仕事と相談の流れを、明快に伝える。',
    intro: '対応業務、対象、料金の考え方、担当者、相談方法を整理し、初めて依頼する事業者にも分かりやすいサイトを作ります。',
    sections: ['対応業務', '対象となる事業者', '料金と契約の流れ', '事務所・担当者紹介'],
    checks: ['資格と登録情報を載せる', '料金の前提条件を明記する', '機密情報の送信方法を案内する'],
  },
} as const;

type IndustryId = keyof typeof INDUSTRY_DATA;
const VALID_IDS = Object.keys(INDUSTRY_DATA) as IndustryId[];

export async function generateStaticParams() {
  return VALID_IDS.map(industry => ({ industry }));
}

export async function generateMetadata({ params }: { params: Promise<{ industry: string }> }): Promise<Metadata> {
  const { industry } = await params;
  const d = INDUSTRY_DATA[industry as IndustryId];
  if (!d) return { title: 'LARU HP' };
  const title = `${d.name}のホームページ作成｜LARU HP`;
  const description = `${d.name}に必要なページ構成と公開前の確認事項を解説。完成像を見ながら写真・文章・配色を整え、問い合わせや予約の入口まで作れます。`;
  return {
    robots: { index: true, follow: true },
    title,
    description,
    keywords: [d.keyword, `${d.name} HP制作`, 'LARU HP'],
    alternates: { canonical: `https://laruhp.com/${industry}` },
    openGraph: { title, description, url: `https://laruhp.com/${industry}`, type: 'website', siteName: 'LARU HP', images: [LARUHP_OG_IMAGE] },
  };
}

export default async function IndustryPage({ params }: { params: Promise<{ industry: string }> }) {
  const { industry } = await params;
  const d = INDUSTRY_DATA[industry as IndustryId];
  if (!d) notFound();
  const canonical = `https://laruhp.com/${industry}`;
  const jsonLd = jsonForScript({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${d.name}向けホームページ作成`,
    serviceType: 'ホームページ作成サービス',
    provider: { '@type': 'Organization', name: '株式会社LaruVisona', url: 'https://laruvisona.jp/' },
    url: canonical,
    areaServed: 'JP',
  });

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="https://laruhp.com/" className="text-lg font-black tracking-[-0.05em]">LARU <span className="text-sky-600">HP</span></Link>
          <Link href={`https://laruvisona.jp/laruHP/studio?industry=${industry}`} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white">この業種で試す</Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-slate-950 px-5 py-24 text-white md:py-32">
          <div className="absolute inset-0 opacity-40" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 80% 10%, #0284c7 0, transparent 34%), radial-gradient(circle at 8% 90%, #334155 0, transparent 30%)' }} />
          <div className="relative mx-auto max-w-6xl">
            <p className="mb-7 text-xs font-bold tracking-[0.18em] text-sky-300">{d.name}向けの設計</p>
            <h1 className="max-w-4xl text-4xl font-black leading-[1.25] tracking-[-0.055em] md:text-7xl">{d.lead}</h1>
            <p className="mt-8 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">{d.intro}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href={`https://laruvisona.jp/laruHP/studio?industry=${industry}`} className="inline-flex items-center gap-3 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-slate-950">完成像を作ってみる <ArrowUpRight size={17} /></Link>
              <Link href="https://laruhp.com/plans" className="inline-flex items-center rounded-full border border-white/30 px-6 py-3.5 text-sm font-bold text-white">料金を見る</Link>
            </div>
            <p className="mt-5 text-xs text-slate-400">試作はログイン前から。保存・公開にはご契約が必要です。</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-sky-700">載せる内容</p>
              <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.04em] md:text-5xl">必要な情報を、<br />迷わない順番へ。</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {d.sections.map((section, index) => (
                <article key={section} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,.06)]">
                  <span className="text-xs font-bold text-sky-700">0{index + 1}</span>
                  <h3 className="mt-8 text-lg font-bold">{section}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-20 md:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-sky-700">公開前の確認</p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] md:text-5xl">きれいなだけで、<br />公開しない。</h2>
              <p className="mt-6 max-w-lg leading-7 text-slate-600">AIが作るのは下書きです。事業の事実、法令、掲載許可を確認し、見本の文章や数字を自分の内容へ置き換えてから公開します。</p>
            </div>
            <ul className="space-y-4">
              {d.checks.map(check => <li key={check} className="flex gap-4 rounded-2xl bg-slate-50 p-5 font-medium"><Check className="mt-0.5 shrink-0 text-sky-700" size={20} />{check}</li>)}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { Icon: LayoutTemplate, title: '構成と見せ方', text: '業種と目的から下書きを作り、写真、文章、配色、余白を編集できます。' },
              { Icon: MessageSquare, title: '問い合わせ・予約', text: '相談や予約希望を受け取るフォームを、公開ページへ組み込めます。' },
              { Icon: Globe2, title: '独自ドメイン', text: '取得済みのドメインを接続し、SSL付きの主な公開URLとして設定できます。' },
              { Icon: Search, title: '検索の基本設定', text: 'ページごとの説明、構造化データ、サイトマップを公開内容に合わせて生成します。' },
            ].map(({ Icon, title, text }) => (
              <article key={title} className="rounded-3xl bg-slate-950 p-7 text-white">
                <Icon size={24} className="text-sky-300" />
                <h3 className="mt-10 text-lg font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-sky-700 px-5 py-20 text-white">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-bold text-sky-100">HP単体プラン 月額 {PLANS[0].monthly.toLocaleString('ja-JP')}円（税別）から</p>
            <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] md:text-5xl">{d.name}の完成像を、<br />その場で確かめる。</h2>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-sky-100">{TERMS.firstMonthFree}。{TERMS.cancelNote}。料金と契約条件を確認してから申し込めます。</p>
            <Link href={`https://laruvisona.jp/laruHP/studio?industry=${industry}`} className="mt-9 inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 font-bold text-sky-800">制作スタジオを開く <ArrowUpRight size={18} /></Link>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 px-5 py-10 text-sm text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 sm:flex-row">
          <p>© 株式会社LaruVisona</p>
          <nav className="flex flex-wrap gap-5" aria-label="フッター">
            <Link href="https://laruhp.com/articles">HP作成ガイド</Link><Link href="https://laruhp.com/plans">料金</Link><Link href="https://laruhp.com/contact">お問い合わせ</Link><Link href="https://laruhp.com/privacy">プライバシー</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
