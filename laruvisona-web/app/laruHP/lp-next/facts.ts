// 新LPで使ってよい事実。すべてリポジトリ内の一次情報から取っている。
//
// 出どころ:
//   価格・プラン内容   … app/laruHP/page.tsx の PLANS / PLAN_ANNUAL_PRICE
//   契約条件           … app/laruHP/page.tsx の FAQ_ITEMS（初月無料・最低6ヶ月・7ヶ月目から解約可）
//   含まれるもの       … 同 FAQ（サーバー・SSL・laruvisona.jpサブドメイン込み、独自ドメインは別途）
//   LARUbot Lite の位置づけ … 同 FAQ（フル版は別サービス・月額27,500円〜）
//   業種テンプレート   … app/laruHP/page.tsx の INDUSTRIES
//
// ここに無いもの（導入社数・満足度・第三者の推薦・効果の数値）は
// 裏が取れていないので、LPに書かない。

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
      'Google Analytics 連携',
      'メールサポート',
    ],
    excludes: ['LARUbot Lite（AIチャットボット）', 'LARUSEO（AIブログ）'],
    badge: null as string | null,
    highlight: false,
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
  },
] as const;

/** 契約条件。特商法・FAQと矛盾しないようにここで一元管理する */
export const TERMS = {
  firstMonthFree: '初月無料（2ヶ月目から課金）',
  minimumMonths: 6,
  cancel: '7ヶ月目からは月単位でいつでも解約できます',
  cancelNote: '最低利用期間（6ヶ月）の途中では解約できません',
  annualNote: '年払いは実質2ヶ月分無料。一括請求で、途中解約時の返金はありません',
  taxNote: '表示はすべて税別です',
  payment: 'クレジットカード決済',
  domainNote: '独自ドメインを使う場合は、ドメイン取得費（年 約1,000〜2,000円）が別途かかります',
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

export const SECONDARY_CTA = {
  label: '作れるサイトを見る',
  href: '#works',
} as const;

export const FAQ = [
  {
    q: '本当に月額999円だけですか？',
    a: 'サーバー利用料・SSL証明書・laruvisona.jp のサブドメインは月額999円（税別）に含まれています。独自ドメインを使う場合だけ、ドメイン取得費（年 約1,000〜2,000円）が別途かかります。',
  },
  {
    q: '初月無料と6ヶ月契約の関係は？',
    a: '最初の1ヶ月は0円、2ヶ月目から月額999円（税別）です。最低利用期間は6ヶ月で、その間の解約はできません。7ヶ月目からは月単位でいつでも解約できます。',
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
    a: 'プランに含まれるのはホームページ用に機能を絞った Lite 版で、Q&Aの登録数と設置できるボット数に上限があります。顧客管理・メール配信・Web予約・決済まで含むフル版 LARUbot（月額27,500円〜）は別サービスです。Lite から始めて後から移ることもできます。',
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
