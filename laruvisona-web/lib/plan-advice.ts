import { PLANS, MONTHLY, ANNUAL_TOTAL, TERMS } from './laruhp-facts';

/**
 * 「うちの場合、どのプランで、いくらか」を出す。
 *
 * なぜ作るか。
 * 料金ページは5プランを横に並べているだけで、読む側は自分がどれに当たるかを
 * 自分で判断しないといけない。実際にいちばん多い止まり方は
 * 「結局いくらかかるのか分からない」なので、そこを1画面で終わらせる。
 *
 * 決まり。
 *   - 判定は**ここだけ**で行う。画面側に条件分岐を書かない（テストで固定できなくなる）。
 *   - 金額は laruhp-facts.ts から取る。書き写さない。
 *   - **裏の取れないことは足さない。** 独自ドメインの費用は登録事業者ごとに違うので、
 *     こちらの合計には入れず、別途かかるものとして言葉で出す。
 */

export type Billing = 'monthly' | 'annual';
export type DomainChoice = 'none' | 'new' | 'have';

export interface PlanNeeds {
  /** 複数のクライアントサイトを1アカウントで持ちたい（制作会社） */
  multiClient: boolean;
  /** 検索向けの記事を自動で増やしたい（LARUSEO） */
  blog: boolean;
  /** 公開ページを多言語で出したい */
  multilingual: boolean;
  /** 来訪者の質問にチャットで応対したい（LARUbot Lite） */
  chat: boolean;
  /** サイトを2つ以上持ちたい */
  twoOrMoreSites: boolean;
  billing: Billing;
  domain: DomainChoice;
}

export interface PlanAdvice {
  planId: string;
  planName: string;
  monthly: number;
  /** なぜそのプランになったか。選んだ条件をそのまま返す */
  reason: string;
  /** 1年目に支払う合計（税別・ドメイン費を含まない） */
  firstYearTotal: number;
  /** 合計の内訳。読んで検算できる形にする */
  breakdown: string[];
  /** 申し込む前に知っておくべきこと */
  cautions: string[];
  /** 迷う相手がいるとき */
  alsoConsider: { planName: string; why: string } | null;
}

const yen = (n: number) => n.toLocaleString('ja-JP');

const MONTHLY_BY_ID: Record<string, number> = {
  hp: MONTHLY.hp,
  lite: MONTHLY.lite,
  'hp-bot': MONTHLY.hpBot,
  'hp-bot-seo': MONTHLY.hpBotSeo,
  agency: MONTHLY.agency,
};

const ANNUAL_TOTAL_BY_ID: Record<string, number> = {
  hp: ANNUAL_TOTAL.hp,
  lite: ANNUAL_TOTAL.lite,
  'hp-bot': ANNUAL_TOTAL.hpBot,
  'hp-bot-seo': ANNUAL_TOTAL.hpBotSeo,
  agency: ANNUAL_TOTAL.agency,
};

/** 1年目に支払う合計（税別）。月払いは初月0円なので11ヶ月ぶん。 */
export function firstYearTotal(planId: string, billing: Billing): number {
  if (billing === 'annual') return ANNUAL_TOTAL_BY_ID[planId];
  return MONTHLY_BY_ID[planId] * 11;
}

function pickPlan(needs: PlanNeeds): { id: string; reason: string } {
  if (needs.multiClient) {
    return { id: 'agency', reason: '複数のクライアントサイトを1つのアカウントで持つため' };
  }
  if (needs.blog && needs.multilingual) {
    return { id: 'hp-bot-seo', reason: '記事の自動生成と多言語表示が、どちらもこのプランから使えるため' };
  }
  if (needs.blog) {
    return { id: 'hp-bot-seo', reason: '検索向けの記事を自動で増やす機能が、このプランから使えるため' };
  }
  if (needs.multilingual) {
    return { id: 'hp-bot-seo', reason: '公開ページの多言語表示が、このプランから使えるため' };
  }
  if (needs.chat && needs.twoOrMoreSites) {
    return { id: 'hp-bot', reason: 'チャット応対を使い、サイトを2つ持てるため' };
  }
  if (needs.chat) {
    return { id: 'lite', reason: 'チャット応対がいちばん安く付くプランのため' };
  }
  if (needs.twoOrMoreSites) {
    return { id: 'hp-bot', reason: 'サイトを2つ持てるいちばん安いプランのため' };
  }
  return { id: 'hp', reason: 'ホームページを作って公開するだけなら、これで足りるため' };
}

export function advisePlan(needs: PlanNeeds): PlanAdvice {
  const picked = pickPlan(needs);
  const plan = PLANS.find(p => p.id === picked.id)!;
  const monthly = MONTHLY_BY_ID[picked.id];
  const total = firstYearTotal(picked.id, needs.billing);

  const breakdown: string[] =
    needs.billing === 'annual'
      ? [
          `年払い（${plan.name}）: ${yen(ANNUAL_TOTAL_BY_ID[picked.id])}円（税別）を一括`,
          `月額に直すと ${yen(plan.annualPerMonth)}円。月払いの10ヶ月分にあたります`,
        ]
      : [
          '1ヶ月目: 0円（初月無料）',
          `2〜12ヶ月目: ${yen(monthly)}円 × 11ヶ月 = ${yen(monthly * 11)}円（税別）`,
        ];

  const cautions: string[] = [];
  if (needs.billing === 'monthly') {
    cautions.push(
      `${TERMS.cancelNote}。最低でも ${yen(monthly * (TERMS.minimumMonths - 1))}円（税別）は発生します（初月0円 + ${TERMS.minimumMonths - 1}ヶ月分）。`,
    );
    cautions.push(`${TERMS.cancel}。`);
  } else {
    cautions.push(`${TERMS.annualNote}。`);
    cautions.push('年払いは初月無料クーポンの対象外です。');
  }
  if (needs.domain === 'new') {
    cautions.push(`この合計に独自ドメインの費用は入っていません。${TERMS.domainNote}。`);
  }
  if (needs.domain === 'none') {
    cautions.push('独自ドメインを使わない場合、laruvisona.jp のサブドメインで公開します。追加の費用はかかりません。');
  }
  if (needs.domain === 'have') {
    cautions.push('いま使っているドメインは移管せずに接続できます。メール用のMX・TXTは残したままにします。');
  }
  cautions.push(`${TERMS.taxNote}。支払いは${TERMS.payment}です。`);

  let alsoConsider: PlanAdvice['alsoConsider'] = null;
  if (picked.id === 'lite') {
    const hpBot = PLANS.find(p => p.id === 'hp-bot')!;
    alsoConsider = {
      planName: hpBot.name,
      why: `月額${yen(MONTHLY.hpBot)}円。サイトを2つ持ちたくなったときや、メールの自動送信をより多く使いたいときは、こちらになります。`,
    };
  } else if (picked.id === 'hp') {
    const lite = PLANS.find(p => p.id === 'lite')!;
    alsoConsider = {
      planName: lite.name,
      why: `月額${yen(MONTHLY.lite)}円。あとからチャット応対を足したくなったら、このプランへ変更できます。`,
    };
  } else if (picked.id === 'hp-bot') {
    const seo = PLANS.find(p => p.id === 'hp-bot-seo')!;
    alsoConsider = {
      planName: seo.name,
      why: `月額${yen(MONTHLY.hpBotSeo)}円。記事を自動で増やしたい、多言語で出したいときは、こちらになります。`,
    };
  }

  return {
    planId: picked.id,
    planName: plan.name,
    monthly,
    reason: picked.reason,
    firstYearTotal: total,
    breakdown,
    cautions,
    alsoConsider,
  };
}
