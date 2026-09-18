/*
  契約と売上の「正」は Stripe 本番にある。profiles はその写し。

  2026-09-18 に起きたこと:
  管理画面は profiles の `subscription_status = 'active'` を数え、
  コード内の固定価格表を掛けて MRR を出していた。**Stripeを一度も見ていない。**
  結果、Stripeのサンドボックスから入り込んだ1行のせいで、
  実売上0円のまま「稼働中1件 / MRR ¥999」と表示され続けた。

  ここは Stripe から実際の契約を1回だけ取ってきて、
  「Stripeで確かめられた契約」だけを数えられるようにする。

  ⚠️ 取れなかったときに、DBの数字を正しい数字として出してはいけない。
     それをやると、また同じ嘘が静かに戻る。呼ぶ側は `ok` を見ること。
*/
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';

export interface LiveSubscription {
  id: string;
  status: string;
  /** 月額に直した金額（円）。年額は12で割る。 */
  monthlyAmount: number;
  customerId: string | null;
}

export interface StripeTruth {
  /** Stripe に聞けたかどうか。false のときは中身を数字として使わない。 */
  ok: boolean;
  /** 課金が生きている契約（active / trialing）だけ */
  billable: Map<string, LiveSubscription>;
  /** 生きていないものも含めた全件（照合用） */
  all: Map<string, LiveSubscription>;
  reason?: string;
}

const BILLABLE = new Set(['active', 'trialing']);

/** 請求間隔を月額に均す。年払いは12で割る（端数は四捨五入）。 */
export function monthlyAmountOf(sub: Stripe.Subscription): number {
  let total = 0;
  for (const item of sub.items?.data ?? []) {
    const price = item.price;
    const unit = price?.unit_amount ?? 0;
    const qty = item.quantity ?? 1;
    const interval = price?.recurring?.interval;
    const count = price?.recurring?.interval_count || 1;
    let months = 1;
    if (interval === 'year') months = 12 * count;
    else if (interval === 'month') months = count;
    else if (interval === 'week') months = count / 4.345;
    else if (interval === 'day') months = count / 30.44;
    if (months <= 0) months = 1;
    total += (unit * qty) / months;
  }
  return Math.round(total);
}

/**
 * Stripe から契約を取ってくる。**1回の呼び出しで完結する。**
 *
 * ⚠️ 上限を付ける。件数が増えたときに管理画面が固まるのを避ける。
 *    上限に達したら ok を false にする。半分だけ数えた数字は、嘘になる。
 */
export async function fetchStripeTruth(limit = 1000): Promise<StripeTruth> {
  const all = new Map<string, LiveSubscription>();
  const billable = new Map<string, LiveSubscription>();
  try {
    const list = await stripe.subscriptions.list({ status: 'all', limit: 100 })
      .autoPagingToArray({ limit });
    if (list.length >= limit) {
      return { ok: false, billable, all, reason: 'too_many' };
    }
    for (const sub of list) {
      const row: LiveSubscription = {
        id: sub.id,
        status: sub.status,
        monthlyAmount: monthlyAmountOf(sub),
        customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
      };
      all.set(sub.id, row);
      if (BILLABLE.has(sub.status)) billable.set(sub.id, row);
    }
    return { ok: true, billable, all };
  } catch (error) {
    return {
      ok: false, billable, all,
      reason: error instanceof Error ? error.name : 'unknown',
    };
  }
}
