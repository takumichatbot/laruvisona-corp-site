import Link from 'next/link';

export const metadata = { title: 'プライバシーポリシー | LARU HP' };

const SECTIONS = [
  {
    title: '1. 事業者情報',
    content: `株式会社LARUVisona（以下「当社」）は、個人情報の保護に関する法律（個人情報保護法）を遵守し、ユーザーの個人情報を適切に管理します。`,
  },
  {
    title: '2. 収集する個人情報',
    content: `当社は以下の情報を収集します。\n・氏名、メールアドレス（アカウント登録時）\n・クレジットカード情報（Stripe, Inc. が安全に管理。当社はカード番号を保持しません）\n・本サービスで作成されたWebサイトのコンテンツ\n・アクセスログ（IPアドレス、ブラウザ種別、利用日時等）\n・お問い合わせ内容`,
  },
  {
    title: '3. 個人情報の利用目的',
    content: `収集した個人情報は以下の目的で利用します。\n・本サービスの提供・運営\n・ユーザーへの連絡（重要なお知らせ、サポート等）\n・利用料金の請求・決済処理\n・サービスの改善・新機能開発\n・不正利用の防止\n・法令に基づく対応`,
  },
  {
    title: '4. 第三者提供',
    content: `当社は、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。\n・ユーザーの同意がある場合\n・法令に基づく場合（行政機関・裁判所等からの要請）\n・人の生命・身体・財産の保護のために必要な場合\n\n当社は業務委託先（Supabase、Stripe、Resend等）に個人情報を提供する場合があります。これらのサービスはそれぞれの適切なプライバシーポリシーのもとで情報を管理しています。`,
  },
  {
    title: '5. Cookieの使用',
    content: `本サービスはセッション管理のためCookieを使用します。Cookieはブラウザの設定から無効にできますが、一部機能が使えなくなる場合があります。`,
  },
  {
    title: '6. アクセス解析',
    content: `ユーザーがGoogle Analytics連携を設定した場合、当該サイトの訪問データがGoogleのサーバーに送信されます。詳細はGoogleのプライバシーポリシーをご参照ください。`,
  },
  {
    title: '7. 個人情報の管理・保護',
    content: `当社は個人情報への不正アクセス・紛失・破損・改ざん・漏洩を防ぐため、適切なセキュリティ対策を実施します。データはSupabase（PostgreSQL）に暗号化して保存されます。`,
  },
  {
    title: '8. 開示・訂正・削除',
    content: `ユーザーは自身の個人情報の開示・訂正・削除をリクエストできます。ご希望の場合は laruvisona@gmail.com までご連絡ください。本人確認の上、合理的な期間内に対応いたします。`,
  },
  {
    title: '9. 保存期間',
    content: `個人情報は、サービス利用目的の達成に必要な期間、または法令で定められた期間保存します。アカウント削除後は、法令上の保存義務がある情報を除き、速やかに削除します。`,
  },
  {
    title: '10. ポリシーの変更',
    content: `当社は本ポリシーを必要に応じて改定します。重要な変更がある場合はメールまたはサービス内通知でお知らせします。`,
  },
  {
    title: 'お問い合わせ窓口',
    content: `個人情報の取り扱いに関するお問い合わせは以下までご連絡ください。\n株式会社LARUVisona\nメール: laruvisona@gmail.com`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <header className="border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/laruHP" className="flex items-center gap-2">
            <img src="/laruhp_logo.png" alt="LARU HP" className="h-7 w-auto brightness-0 invert" />
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400 text-sm">プライバシーポリシー</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-black mb-2">プライバシーポリシー</h1>
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
          株式会社LARUVisona
        </div>

        <div className="mt-8 text-center">
          <Link href="/laruHP" className="text-blue-400 hover:text-blue-300 text-sm">← LARU HP トップに戻る</Link>
        </div>
      </main>
    </div>
  );
}
