/*
  いまの鍵が本番（live）なのかテスト（test）なのかを、1か所で決める。

  2026-09-18 に起きたこと:
  Stripeの**サンドボックス（テスト環境）の契約**が、本番の profiles に
  「有効な契約」として入っていた。管理画面は実売上0円のまま
  「稼働中1件 / MRR ¥999」と出していた。

  webhook は署名を確かめたあと、**そのイベントが本番のものか
  テストのものかを一度も見ていなかった。**

  ⚠️ 鍵の値そのものは、返り値にもログにも絶対に出さない。
     ここが見るのは先頭の種別だけ。
*/

export type StripeMode = 'live' | 'test' | 'unknown';

/**
 * 設定されている鍵の環境。
 *
 * Stripeの秘密鍵は `sk_live_` / `sk_test_`、制限付きは `rk_live_` / `rk_test_`。
 * どれでもない（未設定・別形式）ときは 'unknown' を返す。
 */
export function configuredStripeMode(key: string | undefined = process.env.STRIPE_SECRET_KEY): StripeMode {
  const k = (key || '').trim();
  if (/^(sk|rk)_live_/.test(k)) return 'live';
  if (/^(sk|rk)_test_/.test(k)) return 'test';
  return 'unknown';
}

/**
 * そのイベントを、いまの環境で処理してよいか。
 *
 * ⚠️ 判断できないとき（'unknown'）は **通さない**。
 *   ここで通してしまうと、確かめられないまま本番の契約状態を書き換える。
 *   それがまさに今回の事故なので、迷ったら書かない側に倒す。
 */
export function eventMatchesConfiguredMode(
  eventLivemode: boolean,
  mode: StripeMode = configuredStripeMode(),
): boolean {
  if (mode === 'live') return eventLivemode === true;
  if (mode === 'test') return eventLivemode === false;
  return false;
}
