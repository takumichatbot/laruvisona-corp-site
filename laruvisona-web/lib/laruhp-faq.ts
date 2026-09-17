import { MONTHLY, ANNUAL, ANNUAL_TOTAL, TERMS } from './laruhp-facts';

/**
 * よくある質問を、1問1ページにしたもの。
 *
 * なぜ分けるか。
 * LPの中に折りたたんで並べていると、次の2つが同時に起きる。
 *   1. 「ホームページ 月額 だけ」「独自ドメイン 引っ越し メール 止まる」のような、
 *      答えを1つだけ探している検索に対して、開く手間のある長いLPしか返せない。
 *   2. その質問に外からリンクを貼りたい人（掲示板・SNS・社内共有）が、貼る先を持てない。
 *
 * 書き方の決まり。
 *   - **答えは、このリポジトリの実装・料金定義で裏が取れることだけ**。
 *     数字は lib/laruhp-facts.ts から持ってくる（手で書き写さない）。
 *   - 中身の薄いページは作らない。結論のあとに、判断に要る材料を必ず置く。
 *   - 記事（/articles）と話題が重ならないようにする。こちらは「LARU HP の条件」、
 *     記事は「ホームページ制作そのもの」。
 */

export interface FaqSection {
  heading: string;
  body: string[];
}

export interface FaqPage {
  slug: string;
  /** 見出し・title・FAQPageのname に使う */
  question: string;
  /** 検索結果に出る一文。結論だけを書く */
  short: string;
  sections: FaqSection[];
  related: { label: string; href: string }[];
}

const yen = (n: number) => n.toLocaleString('ja-JP');

export const FAQ_PAGES: FaqPage[] = [
  {
    slug: 'getsugaku-nomi',
    question: `本当に月額${yen(MONTHLY.hp)}円だけですか？`,
    short: `サーバー・SSL・標準URLは月額${yen(MONTHLY.hp)}円（税別）に含まれます。別にかかるのは、独自ドメインを使う場合のドメイン費だけです。`,
    sections: [
      {
        heading: '月額に含まれるもの',
        body: [
          `サーバーの利用料、常時SSL（https）の証明書、laruvisona.jp のサブドメインでの公開、編集画面の利用、問い合わせフォーム、タイトルや説明文などの検索向け基本設定。これらは月額${yen(MONTHLY.hp)}円（税別）に含まれます。ページ数や、表示された回数による追加の請求はありません。`,
          '初期費用・制作費という名目の請求もありません。申し込みの時点でかかるのは、月額料金だけです。',
        ],
      },
      {
        heading: '別にかかるもの',
        body: [
          TERMS.domainNote + '。独自ドメインを使わず、標準のURLのまま運用する場合は、月額料金以外の支払いはありません。',
          '上位プランを選んだ場合は、その月額になります。LARUbot（チャット応対）やLARUSEO（記事の自動生成）を使うかどうかで、プランが変わります。',
        ],
      },
      {
        heading: '税と支払い方法',
        body: [
          `${TERMS.taxNote}。支払いは${TERMS.payment}です。`,
          `年払いを選ぶと、HP単体プランで年${yen(ANNUAL_TOTAL.hp)}円（月${yen(ANNUAL.hp)}円換算）になります。${TERMS.annualNote}。`,
        ],
      },
    ],
    related: [
      { label: '料金プランを見る', href: 'https://laruhp.com/plans' },
      { label: '独自ドメインの扱い', href: 'https://laruhp.com/domains' },
      { label: 'ホームページ制作の費用相場', href: 'https://laruhp.com/articles/hp-sakusei-cost' },
    ],
  },
  {
    slug: 'domain-nashi-de-hajimeru',
    question: '独自ドメインを持っていなくても始められますか？',
    short: '始められます。追加料金のない標準URLでまず公開し、必要になった時点で独自ドメインへ切り替えられます。',
    sections: [
      {
        heading: 'まずは標準URLで公開できる',
        body: [
          '申し込むと laruvisona.jp のサブドメイン（例: laruvisona.jp/hp/あなたの屋号）が割り当てられます。ここで公開したページは、常時SSL付きで、そのまま検索エンジンにも読まれます。ドメインを買う前に、中身を先に用意できます。',
          '名刺やチラシに載せる前に独自ドメインへ切り替えたい、という順番でも問題ありません。',
        ],
      },
      {
        heading: 'あとから切り替えたときのURL',
        body: [
          '独自ドメインを追加すると、標準URLで公開していたページは、独自ドメイン側の同じ経路へ転送されます。先に配った標準URLが、切り替えた日から急に開けなくなることはありません。',
          '検索エンジンに対しても、正規のURLは独自ドメイン側だと伝わります。',
        ],
      },
      {
        heading: 'ドメインは誰の名義で取るか',
        body: [
          '取得する場合は、お客様ご自身の名義とアカウントで管理する方法をおすすめしています。制作側の名義で取ると、業者を変えるときにドメインごと動かせなくなることがあるためです。',
          TERMS.domainNote + '。',
        ],
      },
    ],
    related: [
      { label: '独自ドメインの取得から接続まで', href: 'https://laruhp.com/domains' },
      { label: '料金プランを見る', href: 'https://laruhp.com/plans' },
    ],
  },
  {
    slug: 'domain-mochikomi',
    question: 'すでに持っているドメインも使えますか？メールは止まりませんか？',
    short: '使えます。移管は不要で、DNSレコードを足すだけです。メール用のMXやTXTを残したまま接続するので、メールは止まりません。',
    sections: [
      {
        heading: '移管しなくていい',
        body: [
          'いま契約している登録事業者（お名前.com、ムームードメイン、Google Domains から移った先、など）はそのままで構いません。LARU HP の設定画面にドメインを追加すると、登録すべきDNSレコードが表示されるので、それを登録事業者の管理画面で足します。',
          'ドメインの所有権も、更新の支払い先も、これまでどおりお客様のままです。',
        ],
      },
      {
        heading: 'メールを止めないために触らないもの',
        body: [
          'そのドメインでメールを使っている場合、MXレコードと、SPF・DKIM・DMARC などのメール認証用TXTレコードは、消さずにそのまま残します。LARU HP が使うのはウェブ表示用のレコードだけです。',
          '「ネームサーバーごと差し替える」やり方だと、MXの設定も一緒に引っ越すことになり、ここでメールが止まる事故が起きます。LARU HP はネームサーバーの変更を必須にしていません。',
        ],
      },
      {
        heading: '切り替わるまでの時間',
        body: [
          'DNSの変更が世界中に行き渡るまでには時間がかかります。数分で切り替わることもあれば、半日ほど見ておいたほうがよいこともあります。切り替わるまでの間も、古い側の表示は生きています。',
          '設定画面では、レコードが正しく引けているか、証明書の発行が終わったかを確認できます。',
        ],
      },
    ],
    related: [
      { label: '独自ドメインの取得から接続まで', href: 'https://laruhp.com/domains' },
      { label: '「サイトが保護されていません」と出るとき', href: 'https://laruvisona.jp/trouble/ssl-warning' },
    ],
  },
  {
    slug: 'shogetsu-muryou-to-6kagetsu',
    question: '初月無料と6ヶ月の最低利用期間は、どういう関係ですか？',
    short: `月払いは1ヶ月目が0円、2ヶ月目から課金です。最低利用期間は6ヶ月で、${TERMS.cancel}。`,
    sections: [
      {
        heading: '実際に支払う金額',
        body: [
          `HP単体プラン（月額${yen(MONTHLY.hp)}円・税別）で月払いにした場合、1ヶ月目は0円、2ヶ月目から6ヶ月目までの5ヶ月間で ${yen(MONTHLY.hp)}円 × 5 = ${yen(MONTHLY.hp * 5)}円（税別）です。これが、最低利用期間を通して必ず発生する金額になります。`,
          `7ヶ月目以降も続ける場合は、月額${yen(MONTHLY.hp)}円（税別）が毎月かかります。`,
        ],
      },
      {
        heading: '途中で解約できない期間',
        body: [
          `${TERMS.cancelNote}。申し込みの前に、6ヶ月ぶんを支払う前提で見てください。`,
          `${TERMS.cancel}。手続きの方法は、解約のページにまとめています。`,
        ],
      },
      {
        heading: '年払いを選んだ場合',
        body: [
          `年払いは割引のかわりに一括で支払う方式です。HP単体プランで年${yen(ANNUAL_TOTAL.hp)}円（月${yen(ANNUAL.hp)}円換算・税別）。${TERMS.annualNote}。`,
          '年払いは初月無料クーポンの対象外です。「初月無料」と「年払いの割引」は、どちらか一方になります。',
        ],
      },
    ],
    related: [
      { label: '料金プランを見る', href: 'https://laruhp.com/plans' },
      { label: '解約のしかた', href: 'https://laruhp.com/faq/kaiyaku' },
      { label: '特定商取引法に基づく表記', href: 'https://laruhp.com/tokusho' },
    ],
  },
  {
    slug: 'kaiyaku',
    question: '解約はどうやってしますか？',
    short: `7ヶ月目以降、管理画面のサブスクリプション管理から手続きできます。メール（info@laruvisona.jp）でも受け付けています。`,
    sections: [
      {
        heading: '手続きの場所',
        body: [
          '管理画面にログインし、サブスクリプション管理から手続きできます。電話でのみ受け付ける、といった制限はありません。',
          'メール（info@laruvisona.jp）でも受け付けています。返信をもって受付とします。',
        ],
      },
      {
        heading: 'いつまでに申し込めば、いつ止まるか',
        body: [
          '翌月末までにお申し込みいただければ、翌月から課金を止めます。',
          `${TERMS.cancelNote}。${TERMS.cancel}。`,
          `年払いの場合は${TERMS.annualNote}。`,
        ],
      },
      {
        heading: '解約したあと、作ったページはどうなるか',
        body: [
          '公開は止まりますが、作った内容は、契約が切れたあとでもHTMLとして書き出せます。書き出したファイルは、別のサーバーにそのまま置けます。文章と写真はお客様のものなので、解約を理由に持ち出しを止めることはしません。',
          '独自ドメインはお客様の名義のままなので、他社へ向け直すだけで使い続けられます。',
        ],
      },
    ],
    related: [
      { label: '利用規約', href: 'https://laruhp.com/terms' },
      { label: '特定商取引法に基づく表記', href: 'https://laruhp.com/tokusho' },
      { label: 'お問い合わせ', href: 'https://laruhp.com/contact' },
    ],
  },
  {
    slug: 'chishiki-fuyou',
    question: 'HTMLやCSSの知識は要りますか？',
    short: '要りません。文字はクリックして書き換え、画像はアップロードするだけです。ブロックの追加や削除もマウス操作で終わります。',
    sections: [
      {
        heading: '編集のしかた',
        body: [
          '公開後の見た目そのままの画面で編集します。直したい文字をクリックして打ち直し、写真は選んで差し替えます。編集用の別画面と、公開後の見た目がずれることはありません。',
          '見出し・サービス紹介・料金表・問い合わせフォームなどは、まとまり（ブロック）単位で足したり消したり並べ替えたりできます。',
        ],
      },
      {
        heading: 'つまずきやすいのは、技術より文章',
        body: [
          '実際に公開まで行かずに止まる理由で多いのは、操作の難しさではなく「何を書けばいいか分からない」ことです。LARU HP は業種と屋号から下書きを作るので、白紙から書き始めずに済みます。',
          '写真がない場合も、写真を前提としない構成に切り替えられます。',
        ],
      },
      {
        heading: '触る前に見ておきたいとき',
        body: [
          '登録しなくても、業種ごとにどんな構成になるかを見られる見本を用意しています。自分の業種に近いものを見てから決められます。',
          '見本では、見出し・サービスと料金の並び・問い合わせの位置がどうなるかを、実際の画面の形で確かめられます。ここで「この形なら書けそうだ」と思えるかどうかが、公開まで行けるかの分かれ目になります。',
          'それでも自分で触るのは気が進まない、という場合は、受託として当社がお引き受けすることもできます。ご相談ください。',
        ],
      },
    ],
    related: [
      { label: '業種別の見本を見る（登録不要）', href: 'https://laruhp.com/demo' },
      { label: 'ホームページの文章が書けないとき', href: 'https://laruhp.com/articles/hp-bunshou-kakenai' },
      { label: '載せる写真がないとき', href: 'https://laruhp.com/articles/hp-shashin-nai' },
    ],
  },
  {
    slug: 'kensaku-de-mitsukaru',
    question: '作ったサイトは、検索で見つけてもらえますか？',
    short: '検索エンジンが内容を理解するための基本設定は最初から入ります。ただし、順位を保証するものではありません。',
    sections: [
      {
        heading: '最初から入っているもの',
        body: [
          'ページごとのタイトルと説明文、業種に合わせた構造化データ（JSON-LD）、パンくず、sitemap.xml、robots.txt、SNSに貼ったときの画像（OGP）。これらは公開の時点で自動的に付きます。',
          '説明文を空のまま公開した場合は、本文から自動で作ります。文の途中で切れないようにしています。',
        ],
      },
      {
        heading: '保証しないこと',
        body: [
          '検索順位は検索エンジン側が決めるもので、上がることをこちらから約束することはできません。「1位にします」と言う業者がいたら、その根拠を確かめてください。',
          '土台が整っていることと、実際に見つけてもらえることは別です。見つけてもらうには、その業種・地域で実際に検索されている言い方が本文に入っている必要があります。',
        ],
      },
      {
        heading: '公開したあとにやること',
        body: [
          'Google Search Console に登録し、どの言葉で表示されたかを見ます。表示はされているのに押されていない言葉が見つかったら、その言葉に合わせてタイトルと説明文を直します。ここが、最初にいちばん効きます。',
          '地域名を入れた言い方で探される業種（飲食・整体・工務店など）は、Googleビジネスプロフィールもあわせて整えてください。',
        ],
      },
    ],
    related: [
      { label: '地域で見つけてもらう（MEO）', href: 'https://laruhp.com/articles/seo-chiiki-meo' },
      { label: 'Googleに載らないとき', href: 'https://laruvisona.jp/trouble/not-in-google' },
      { label: '料金プランを見る', href: 'https://laruhp.com/plans' },
    ],
  },
  {
    slug: 'nenbarai',
    question: '年払いはありますか？',
    short: `あります。実質2ヶ月分が無料になり、HP単体プランなら年${yen(ANNUAL_TOTAL.hp)}円（月${yen(ANNUAL.hp)}円換算・税別）です。`,
    sections: [
      {
        heading: '金額',
        body: [
          `HP単体は年${yen(ANNUAL_TOTAL.hp)}円、ライトは年${yen(ANNUAL_TOTAL.lite)}円、HP＋Botは年${yen(ANNUAL_TOTAL.hpBot)}円、HP＋Bot＋SEOは年${yen(ANNUAL_TOTAL.hpBotSeo)}円、エージェンシーは年${yen(ANNUAL_TOTAL.agency)}円（いずれも税別）。月額の10ヶ月分にあたります。`,
          `${TERMS.taxNote}。`,
        ],
      },
      {
        heading: '月払いとどちらを選ぶか',
        body: [
          `1年以上続ける見込みがあるなら年払いのほうが安くなります。続けるか決めきれない段階なら、初月無料のある月払いから始めて、あとから年払いに変えることもできます。`,
          '年払いは初月無料クーポンの対象外です。両方を同時には使えません。',
        ],
      },
      {
        heading: '途中でやめた場合',
        body: [
          `${TERMS.annualNote}。ここは月払いと違う点なので、申し込む前に確認してください。`,
          '月払いには6ヶ月の最低利用期間があり、年払いには返金がありません。どちらも「少し使ってすぐやめる」には向いていない条件です。試してから決めたい場合は、登録の要らない見本で構成を確かめ、料金ページで含まれるものを見比べてから申し込んでください。',
          '支払い方法の変更（月払いから年払い、またはその逆）は、管理画面のサブスクリプション管理から手続きできます。次の更新のタイミングで切り替わります。',
        ],
      },
    ],
    related: [
      { label: '料金プランを見る', href: 'https://laruhp.com/plans' },
      { label: '初月無料と6ヶ月の関係', href: 'https://laruhp.com/faq/shogetsu-muryou-to-6kagetsu' },
    ],
  },
  {
    slug: 'seisakugaisha-matomete',
    question: '制作会社ですが、複数のクライアントをまとめて管理できますか？',
    short: `エージェンシープラン（月額${yen(MONTHLY.agency)}円・税別）で、複数のクライアントサイトを1つのアカウントから管理できます。`,
    sections: [
      {
        heading: 'できること',
        body: [
          '1つのアカウントから、クライアントごとのサイトを作り、公開し、更新できます。クライアントを追加するたびに契約を増やす必要はありません。',
          `料金は月額${yen(MONTHLY.agency)}円（税別）、年払いなら年${yen(ANNUAL_TOTAL.agency)}円（月${yen(ANNUAL.agency)}円換算）です。`,
          'エージェンシープランは全機能込みです。ホームページ、チャット応対（LARUbot Lite）、記事の自動生成（LARUSEO）を、クライアントごとに使い分けられます。',
        ],
      },
      {
        heading: '請求とドメインの持ち主',
        body: [
          'LARU HP からの請求先は、エージェンシー契約をしている制作会社です。クライアントへの請求は、制作会社側で自由に決められます。',
          '独自ドメインは、クライアント自身の名義で取っておくことをおすすめします。あとから担当を離れるときに、もめる原因になりやすいところです。',
        ],
      },
      {
        heading: '引き渡すとき',
        body: [
          '作ったページはHTMLとして書き出せます。クライアントが自社で持ちたいと言ったときに、そのまま渡せます。書き出したファイルは、別のサーバーへ置くだけで表示できる形です。',
          '「解約したら中身ごと消える」という作りにはしていません。持ち出せることを前提に提案できるので、クライアントへの説明がしやすくなります。',
        ],
      },
    ],
    related: [
      { label: '料金プランを見る', href: 'https://laruhp.com/plans' },
      { label: 'お問い合わせ', href: 'https://laruhp.com/contact' },
    ],
  },
];

export const FAQ_SLUGS = FAQ_PAGES.map(page => page.slug);

export function faqPage(slug: string): FaqPage | undefined {
  return FAQ_PAGES.find(page => page.slug === slug);
}
