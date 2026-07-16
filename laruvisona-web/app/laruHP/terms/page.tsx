import Link from 'next/link';
import Image from 'next/image';

export const metadata = { title: '利用規約 | LARU HP' };

const SECTIONS = [
  {
    title: '第1条（適用）',
    content: `本利用規約（以下「本規約」）は、株式会社LaruVisona（以下「当社」）が提供するホームページ作成SaaSサービス「LARU HP」（以下「本サービス」）の利用条件を定めるものです。ユーザーは本規約に同意の上、本サービスをご利用ください。`,
  },
  {
    title: '第2条（利用登録）',
    content: `本サービスへの登録は、利用希望者が本規約に同意の上、当社の定める方法で申請し、当社が承認することで完了します。当社は、以下の場合に登録を拒否することがあります。\n・虚偽の情報を提供した場合\n・過去に規約違反等で利用停止になった場合\n・その他当社が不適切と判断した場合`,
  },
  {
    title: '第3条（料金・支払い）',
    content: `本サービスの利用料金は、初月0円（無料）、2ヶ月目以降は月額999円（税別）です。支払いはクレジットカードによる自動更新（月次）とし、Stripe, Inc. が決済処理を行います。最低利用期間は6ヶ月とし、期間中の中途解約・返金は原則として行いません。`,
  },
  {
    title: '第4条（解約）',
    content: `最低利用期間（6ヶ月）経過後、翌月末までに解約申請いただいた場合、翌月より課金を停止します。解約申請はダッシュボード内の「サブスクリプション管理」または、メール（info@laruvisona.jp）にて承ります。`,
  },
  {
    title: '第5条（禁止事項）',
    content: `ユーザーは以下の行為を行ってはなりません。\n・法令または公序良俗に違反する行為\n・犯罪行為に関連する行為\n・当社または第三者の知的財産権、プライバシー権、名誉を侵害する行為\n・当社サーバーへの過度な負荷をかける行為\n・スパム、フィッシング、マルウェア配布等の行為\n・本サービスを第三者に再販・転貸する行為\n・その他当社が不適切と判断する行為`,
  },
  {
    title: '第6条（知的財産権）',
    content: `本サービスのシステム・デザイン・コンテンツに関する知的財産権は当社に帰属します。ユーザーが本サービスを通じて作成したサイトコンテンツの権利はユーザーに帰属します。`,
  },
  {
    title: '第7条（サービスの停止・変更）',
    content: `当社は、以下の場合に事前通知なく本サービスの全部または一部を停止できます。\n・システムのメンテナンス・障害対応\n・天災・事変等の不可抗力\n・その他当社が必要と判断した場合\nまた、当社は本サービスの内容を予告なく変更する場合があります。`,
  },
  {
    title: '第8条（免責事項）',
    content: `当社は本サービスの完全性・正確性・有用性について保証しません。本サービスを通じてユーザーに生じた損害について、当社の故意または重大な過失による場合を除き、当社は責任を負いません。当社が賠償責任を負う場合、賠償額は当該月の利用料金を上限とします。`,
  },
  {
    title: '第9条（個人情報）',
    content: `当社は、ユーザーの個人情報を当社の「プライバシーポリシー」に従い適切に取り扱います。`,
  },
  {
    title: '第10条（規約の変更）',
    content: `当社は必要と判断した場合、ユーザーへの通知（メールまたはサービス内通知）をもって本規約を変更できます。変更後も本サービスの利用を継続した場合、変更後の規約に同意したものとみなします。`,
  },
  {
    title: '第11条（準拠法・管轄）',
    content: `本規約の解釈は日本法に準拠します。本サービスに関して紛争が生じた場合、東京地方裁判所を第一審の専属的合意管轄裁判所とします。`,
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <header className="border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/laruHP" className="flex items-center gap-2">
            <Image src="/laruhp_logo.png" alt="LARU HP" height={28} width={160} className="h-7 w-auto brightness-0 invert" />
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400 text-sm">利用規約</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-black mb-2">利用規約</h1>
        <p className="text-slate-500 text-sm mb-12">最終更新日: 2026年6月17日</p>

        <div className="space-y-8">
          {SECTIONS.map((section, i) => (
            <div key={i}>
              <h2 className="text-lg font-bold text-white mb-3">{section.title}</h2>
              <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-line">{section.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 p-6 bg-white/5 border border-white/10 rounded-2xl text-sm text-slate-400">
          制定日: 2026年6月17日<br />
          株式会社LaruVisona
        </div>

        <div className="mt-8 text-center">
          <Link href="/laruHP" className="text-blue-400 hover:text-blue-300 text-sm">← LARU HP トップに戻る</Link>
        </div>
      </main>
    </div>
  );
}
