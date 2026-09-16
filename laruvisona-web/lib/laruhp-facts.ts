// LARU HP について、案内ページに書いてよい事実。
//
// 価格・契約条件・プラン内容の「正」はここ。案内ページ・料金ページ・
// 新LPプレビューは、すべてここから読む。数字を画面側に直接書かない。
//
// ここに無いもの（導入社数・満足度・第三者の推薦・効果の数値・他の顧客が
// どれを選んだかという主張）は、裏が取れていないので載せない。

export const PLANS = [
  {
    id: 'hp',
    name: 'HP単体',
    monthly: 999,
    annualPerMonth: 833,
    lead: 'ホームページを作って公開する',
    includes: [
      'ホームページの作成・公開',
      'AIによる文章と画像の生成',
      'マウスだけで直せる編集画面',
      'SEOの自動設定（メタタグ・構造化データ）',
      'サーバー・SSL・laruvisona.jp のサブドメイン',
      'お問い合わせフォーム',
      '空き枠・担当者・設備の予約管理',
      'Google Analytics 連携',
      'メールサポート',
    ],
    excludes: ['LARUbot Lite（AIチャットボット）', 'LARUSEO（AIブログ）'],
    badge: null as string | null,
    highlight: false,
    landing: true,
  },
  {
    id: 'lite',
    name: 'Lite',
    monthly: 2980,
    annualPerMonth: 2483,
    lead: 'ホームページに、小さくAIを足してみる',
    includes: [
      'HP単体プランのすべて',
      'LARUbot Lite（AIチャットボット）',
      'メールシーケンス（3件まで）',
    ],
    excludes: ['LARUSEO（AIブログ）'],
    badge: null,
    highlight: false,
    landing: false,
  },
  {
    id: 'hp-bot',
    name: 'HP + Bot',
    monthly: 4980,
    annualPerMonth: 4150,
    lead: 'ホームページに、問い合わせ対応のAIを足す',
    includes: [
      'HP単体プランのすべて',
      'LARUbot Lite（AIチャットボット）',
      'チャットサポート',
    ],
    excludes: ['LARUSEO（AIブログ）'],
    // 「よく選ばれています」等、他の顧客の行動についての主張は書かない。
    // 販売者としての推奨であることが分かる言い方にする。
    badge: 'おすすめ',
    highlight: true,
    landing: true,
  },
  {
    id: 'hp-bot-seo',
    name: 'HP + Bot + SEO',
    monthly: 9800,
    annualPerMonth: 8166,
    lead: 'さらに、検索から人を集める記事も自動で書く',
    includes: [
      'HP + Bot プランのすべて',
      'LARUSEO（AIブログ）',
      '優先サポート',
    ],
    excludes: [],
    badge: null,
    highlight: false,
    landing: true,
  },
  {
    id: 'agency',
    name: 'エージェンシー',
    monthly: 19800,
    annualPerMonth: 16500,
    lead: '複数のクライアントサイトを、1つのアカウントで持つ',
    includes: [
      'HP + Bot + SEO プランのすべて',
      'クライアントサイトを1アカウントで管理（999サイトまで）',
      'クライアント別のダッシュボード',
      '優先サポート',
    ],
    excludes: [],
    badge: null,
    highlight: false,
    landing: false,
  },
] as const;

/** 契約条件。特商法・FAQと矛盾しないようにここで一元管理する */
export const TERMS = {
  firstMonthFree: '月払いは初月無料（2ヶ月目から課金）',
  minimumMonths: 6,
  cancel: '7ヶ月目からは月単位でいつでも解約できます',
  cancelNote: '最低利用期間（6ヶ月）の途中では解約できません',
  annualNote: '年払いは実質2ヶ月分無料。一括請求で、途中解約時の返金はありません',
  taxNote: '表示はすべて税別です',
  payment: 'クレジットカード決済',
  domainNote: '独自ドメインの取得・更新費はLARU HPの月額料金とは別です。料金と更新申込期間は登録事業者・ドメインごとに異なります',
} as const;

/** テンプレートのある業種（app/laruHP/page.tsx の INDUSTRIES と同じ） */
export const INDUSTRIES = [
  { id: 'restaurant', name: '飲食店・カフェ' },
  { id: 'beauty', name: '美容室・サロン' },
  { id: 'clinic', name: '整体・クリニック' },
  { id: 'legal', name: '士業・コンサル' },
  { id: 'construction', name: '建設・工務店' },
  { id: 'realestate', name: '不動産' },
  { id: 'retail', name: '小売・EC' },
  { id: 'fitness', name: 'フィットネス' },
  { id: 'hotel', name: 'ホテル・旅館' },
  { id: 'education', name: '教育・スクール' },
  { id: 'wedding', name: 'ウェディング' },
  { id: 'pet', name: 'ペットサロン' },
  { id: 'dental', name: '歯科クリニック' },
  { id: 'photo', name: 'フォトスタジオ' },
  { id: 'accounting', name: '税理士・会計士' },
] as const;

/** 主CTA。目的は1つ（無料で始める）に統一し、ページ内で何度も出す */
export const PRIMARY_CTA = {
  label: '初月無料で始める',
  href: '/laruHP/auth/signup',
  sub: 'クレジットカード決済・最低6ヶ月',
} as const;

// 飛び先はページに実在する id を指すこと。2026-09-17 まで '#works' を指していたが
// LARU HP のLPに id="works" の節は無く、押しても何も起きなかった。
export const SECONDARY_CTA = {
  label: '作れるサイトを見る',
  href: '#experience',
} as const;

export const FAQ = [
  {
    q: '本当に月額999円だけですか？',
    a: 'サーバー利用料・SSL証明書・laruvisona.jp のサブドメインは月額999円（税別）に含まれています。独自ドメインを使う場合は、取得・更新費を登録事業者へ別途支払います。料金は登録事業者とドメインの種類によって異なります。',
  },
  {
    q: '独自ドメインを持っていなくても始められますか？',
    a: '始められます。まず追加料金のない標準URLで公開し、必要になった時点で独自ドメインを取得して切り替えられます。取得する場合は、お客様自身の名義とアカウントで管理する方法を推奨しています。',
  },
  {
    q: 'すでに持っているドメインも使えますか？',
    a: '使えます。現在の登録事業者から移管する必要はありません。LARU HPの設定画面にドメインを追加し、表示されたDNSレコードを登録します。メールを利用中の場合はMXやメール認証用TXTを残したまま接続します。',
  },
  {
    q: '初月無料と6ヶ月契約の関係は？',
    a: '月払いは最初の1ヶ月が0円、2ヶ月目から月額999円（税別）です。最低利用期間は6ヶ月で、その間の解約はできません。7ヶ月目からは月単位でいつでも解約できます。年払いは約10ヶ月分を一括で支払う割引プランで、初月無料クーポンの対象外です。',
  },
  {
    q: '解約はどうやってしますか？',
    a: '7ヶ月目以降、管理画面のサブスクリプション管理から手続きできます。メール（info@laruvisona.jp）でも受け付けています。翌月末までにお申し込みいただければ、翌月から課金を止めます。',
  },
  {
    q: 'HTMLやCSSの知識は要りますか？',
    a: '要りません。文字はクリックして直接書き換え、画像はアップロードするだけです。ブロックの追加や削除もマウス操作で完結します。',
  },
  {
    q: '作ったサイトは検索で見つけてもらえますか？',
    a: '業種別の構造化データ（JSON-LD）、メタタグ、ページ構成が自動で設定されます。順位を保証するものではありませんが、検索エンジンが内容を理解するための土台は最初から整った状態で公開されます。',
  },
  {
    q: 'LARUbot Lite とフル版の違いは？',
    a: 'LARU HPの予約管理は、すべてのHPプランで利用できます。HP + Bot以上に含まれるLite版は、ホームページ上の質問対応に機能を絞ったLARUbotです。複数ボットの運用、顧客管理、メール配信などを含むフル版LARUbot（月額27,500円〜）は別サービスです。',
  },
  {
    q: '年払いはありますか？',
    a: 'あります。実質2ヶ月分が無料になり、HP単体プランなら月833円換算です。一括請求で、途中解約時の返金はありません。',
  },
  {
    q: '制作会社ですが、複数のクライアントをまとめて管理できますか？',
    a: 'エージェンシープラン（月額19,800円）で、複数のクライアントサイトを1つのアカウントから管理できます。',
  },
] as const;

/* 料金ページが使う月額・年額。PLANS と同じ数字を1か所で持つ。
   以前は料金ページが自前の定数を持っていて、案内ページと食い違い得た。 */
export const MONTHLY = { hp: 999, lite: 2980, hpBot: 4980, hpBotSeo: 9800, agency: 19800 } as const;
export const ANNUAL = { hp: 833, lite: 2483, hpBot: 4150, hpBotSeo: 8166, agency: 16500 } as const;
export const ANNUAL_TOTAL = { hp: 9990, lite: 29800, hpBot: 49800, hpBotSeo: 98000, agency: 198000 } as const;
