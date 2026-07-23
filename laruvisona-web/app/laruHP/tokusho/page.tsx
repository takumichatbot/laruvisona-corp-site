import Link from 'next/link';
import Image from 'next/image';

export const metadata = { title: '特定商取引法に基づく表記 | LARU HP' };

export default function TokushoPage() {
  const items = [
    { label: '販売業者', value: '株式会社LaruVisona' },
    { label: '代表責任者', value: '齋藤 匠' },
    { label: '所在地', value: '東京都豊島区南大塚1丁目22-3 CASA南大塚101号室' },
    { label: '電話番号', value: 'ご請求があれば遅滞なく開示いたします。お問い合わせは下記メールアドレスにて承っております。' },
    { label: 'メールアドレス', value: 'info@laruvisona.jp' },
    { label: 'サービス名', value: 'LARU HP（ホームページ作成SaaS）' },
    { label: '販売価格', value: '初月0円（無料）、2ヶ月目以降 月額999円（税別）\n※消費税は別途申し受けます' },
    { label: '支払方法', value: 'クレジットカード（Visa・Mastercard・American Express・JCB）\nStripe, Inc. による安全な決済処理' },
    { label: '支払時期', value: 'ご契約開始時に初月分を決済。以降は毎月同日に自動更新' },
    { label: 'サービス提供時期', value: '決済完了後、即時ご利用いただけます' },
    { label: '最低利用期間', value: '6ヶ月（初回契約日から起算）' },
    { label: 'キャンセル・解約', value: '最低利用期間（6ヶ月）経過後、翌月末までに解約申請いただくことで、翌月より課金を停止します。最低利用期間中の解約・返金はできません。\n解約はダッシュボードのサブスクリプション管理画面、またはメールにてお申し込みください。' },
    { label: '動作環境', value: 'Google Chrome・Mozilla Firefox・Apple Safari の最新版を推奨します。Internet Explorerは非対応です。' },
    { label: '個人情報の取扱い', value: '当社の「プライバシーポリシー」に従い適切に管理いたします。' },
  ];

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <header className="border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/laruHP" className="flex items-center gap-2">
            <Image src="/laruhp_logo.png" alt="LARU HP" height={28} width={160} className="h-7 w-auto brightness-0 invert" />
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400 text-sm">特定商取引法に基づく表記</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-black mb-2">特定商取引法に基づく表記</h1>
        <p className="text-slate-500 text-sm mb-12">最終更新日: 2026年6月17日</p>

        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {items.map((item, i) => (
            <div key={i} className={`flex flex-col sm:flex-row border-b border-white/5 last:border-0 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
              <div className="w-full sm:w-48 flex-shrink-0 px-6 py-4 text-slate-400 text-sm font-bold border-b sm:border-b-0 sm:border-r border-white/5">
                {item.label}
              </div>
              <div className="px-6 py-4 text-slate-200 text-sm leading-relaxed whitespace-pre-line">
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/laruHP" className="text-blue-400 hover:text-blue-300 text-sm">← LARU HP トップに戻る</Link>
        </div>
      </main>
    </div>
  );
}
