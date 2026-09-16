import { TERMS } from './laruhp-facts';

/**
 * 契約管理ポータルを、支払方法の変更だけに絞るかどうか。
 *
 * 最低利用期間（6ヶ月）の途中は解約できない、という約束があるので、
 * その間だけ解約の導線を閉じる。期間が明けたら通常のポータルを開く。
 *
 * ここを contract_ends_at で判定してはいけない。あの列は「今の請求期間の
 * 終わり」で、支払いのたびに翌月末へ更新される（webhookのinvoice処理）。
 * つまり契約中はいつ見ても未来なので、最低利用期間を過ぎても永久に
 * 解約できない状態になる。利用規約と特商法には「7ヶ月目からは月単位で
 * いつでも解約できます」と書いてあるため、約束を守れていなかった。
 *
 * 最低利用期間の終わりは、始まり（contract_starts_at）から数える。
 */
export function minimumTermEndsAt(startsAt: string | null | undefined): Date | null {
  if (!startsAt) return null;
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  // 月をまたぐ日付の丸めは Date に任せる（1/31 + 1ヶ月 → 3/2 等）。
  // 利用者に不利な方向へ伸ばさないため、繰り上がりはそのまま受ける。
  end.setMonth(end.getMonth() + TERMS.minimumMonths);
  return end;
}

export function billingPortalMode(
  profile: { contract_starts_at?: string | null; subscription_status?: string | null },
  now: Date = new Date(),
): { paymentMethodOnly: boolean; cancelableFrom: string | null } {
  const end = minimumTermEndsAt(profile.contract_starts_at);
  const inMinimumTerm =
    profile.subscription_status === 'active' && !!end && end > now;
  return {
    paymentMethodOnly: inMinimumTerm,
    cancelableFrom: inMinimumTerm && end ? end.toISOString() : null,
  };
}
