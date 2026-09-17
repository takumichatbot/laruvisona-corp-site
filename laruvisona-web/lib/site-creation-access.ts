import { getSiteLimit } from './plan-limits';
import { hasServiceAccess } from './subscription-access';

/**
 * サイトを作れる数を決める。**作ること自体は、誰でもできる。**
 *
 * ── なぜ変えたか ────────────────────────────────────────────
 *
 * 以前は契約が無い人に 403（no_plan）を返していた。つまり登録した直後の人は、
 * **サイトを1つも作れなかった。**
 *
 * ところが、こちらが売り文句として書いていたのは:
 *   登録画面 「アカウントを作るところまでは無料です。決済は、公開するときで構いません。」
 *   登録画面 「まず作ってみて、気に入ってから決めてください。」
 *   一覧画面 「クレジットカード不要・今すぐ無料で試せます」
 *   一覧画面 「4つの質問から作りはじめる」
 *
 * 書いてあることと、動きが正反対だった。4つの質問に答えて「保存」を押した
 * その瞬間に「サブスクリプションが必要です」と出る。
 *
 * 本番の跡: 外部から登録した6人のうち**5人が、サイトを1つも作っていない。**
 * 6人全員が登録した当日に消えている。
 *
 * ── 止めるのは公開のとき ──────────────────────────────────
 *
 * 公開は app/api/sites/[id]/publish/route.ts が別に契約を見ている。
 * だから作らせても、契約なしで世に出ることはない。ただ触れるだけ。
 *
 * lib/subscription-access.ts にこう書いてある:
 *   「作らせておいて最後で止めるのが一番悪い」
 * その逆、**始める前に止めるのは、もっと悪い。** 何も触らずに帰ってしまう。
 *
 * 無料で触れるのは1つまで。増やしたい人は契約する。
 */

/** 契約していない人が作れるサイトの数。触って確かめるための1つ。 */
export const FREE_SITE_LIMIT = 1;

/** Call with auth.getUser()'s email and server configuration, never request-body roles. */
export function siteCreationAccess(
  email: string | undefined,
  plan: string | null,
  status: string | null,
  adminConfiguration: Array<string | undefined>,
) {
  const admins = adminConfiguration.filter(Boolean).join(',').split(',')
    .map(value => value.trim().toLowerCase()).filter(Boolean);
  // Same trusted allowlist as the existing publish route. Does not change billing records.
  const admin = !!email && admins.includes(email.trim().toLowerCase());
  const subscribed = !!(plan && (!status || hasServiceAccess(status)));
  return {
    /** 契約している（または管理者）か。上限と、画面に出す言葉が変わる。 */
    paying: admin || subscribed,
    limit: admin ? getSiteLimit('agency') : (subscribed ? getSiteLimit(plan) : FREE_SITE_LIMIT),
  };
}
