import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '利用規約 | LARUVisona' };

const SECTIONS = [
  {
    title: '第1条（適用）',
    content: `本利用規約（以下「本規約」）は、株式会社LARUVisona（以下「当社」）が提供するWebサービス・SaaS・その他デジタルサービス（以下「本サービス」）の利用条件を定めるものです。ユーザーは本規約に同意の上、本サービスをご利用ください。`,
  },
  {
    title: '第2条（利用登録）',
    content: `本サービスへの登録は、利用希望者が本規約に同意の上、当社の定める方法で申請し、当社が承認することで完了します。当社は、以下の場合に登録を拒否することがあります。\n・虚偽の情報を提供した場合\n・過去に規約違反等で利用停止になった場合\n・その他当社が不適切と判断した場合`,
  },
  {
    title: '第3条（禁止事項）',
    content: `ユーザーは以下の行為を行ってはなりません。\n・法令または公序良俗に違反する行為\n・犯罪行為に関連する行為\n・当社または第三者の知的財産権、プライバシー権、名誉を侵害する行為\n・当社サーバーへの過度な負荷をかける行為\n・スパム、フィッシング、マルウェア配布等の行為\n・その他当社が不適切と判断する行為`,
  },
  {
    title: '第4条（知的財産権）',
    content: `本サービスのシステム・デザイン・コンテンツに関する知的財産権は当社に帰属します。`,
  },
  {
    title: '第5条（サービスの停止・変更）',
    content: `当社は、以下の場合に事前通知なく本サービスの全部または一部を停止できます。\n・システムのメンテナンス・障害対応\n・天災・事変等の不可抗力\n・その他当社が必要と判断した場合\nまた、当社は本サービスの内容を予告なく変更する場合があります。`,
  },
  {
    title: '第6条（免責事項）',
    content: `当社は本サービスの完全性・正確性・有用性について保証しません。本サービスを通じてユーザーに生じた損害について、当社の故意または重大な過失による場合を除き、当社は責任を負いません。`,
  },
  {
    title: '第7条（個人情報）',
    content: `当社は、ユーザーの個人情報を当社の「プライバシーポリシー」に従い適切に取り扱います。`,
  },
  {
    title: '第8条（規約の変更）',
    content: `当社は必要と判断した場合、ユーザーへの通知（メールまたはサービス内通知）をもって本規約を変更できます。変更後も本サービスの利用を継続した場合、変更後の規約に同意したものとみなします。`,
  },
  {
    title: '第9条（準拠法・管轄）',
    content: `本規約の解釈は日本法に準拠します。本サービスに関して紛争が生じた場合、東京地方裁判所を第一審の専属的合意管轄裁判所とします。`,
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <header className="border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/">
            <img src="/images/logo_dark.png" alt="LARUVisona" className="h-8 w-auto" />
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400 text-sm">利用規約</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-black mb-2">利用規約</h1>
        <p className="text-slate-500 text-sm mb-12">最終更新日: 2026年6月19日</p>

        <div className="space-y-8">
          {SECTIONS.map((section, i) => (
            <div key={i}>
              <h2 className="text-lg font-bold text-white mb-3">{section.title}</h2>
              <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-line">{section.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 p-6 bg-white/5 border border-white/10 rounded-2xl text-sm text-slate-400">
          制定日: 2026年6月19日<br />
          株式会社LARUVisona
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">← トップに戻る</Link>
        </div>
      </main>
    </div>
  );
}
