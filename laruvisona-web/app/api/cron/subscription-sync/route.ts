import { NextResponse } from 'next/server';
import { requireBearer } from '@/lib/scheduled-email';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { readContactBody } from '@/lib/contact-contract';
import {
  reconcileSubscription,
  isPlanSubscription,
  customerIdOf,
  isTerminal,
  isOrphanedActiveProfile,
  ACTIVE_PROFILE_STATUSES,
  type StripeSubscriptionLike,
  type ProfileBilling,
} from '@/lib/subscription-reconcile';

export const dynamic = 'force-dynamic';

const PAGE = 100;
const MAX_PAGES = 10;

/**
 * Stripeとprofilesを突き合わせて直す定期処理。
 *
 * webhookが1回落ちただけで「課金されているのに使えない人」が永久に
 * 残るのを防ぐ。Stripeを正とし、DBを合わせる。
 *
 * 呼び方は2つ。
 *
 *   1. 定期実行（Render の Cron Job など）
 *        POST /api/cron/subscription-sync
 *        Authorization: Bearer <CRON_SECRET または ADMIN_SECRET>
 *        本文 {"dryRun":true} で、書かずに差分だけ見る
 *
 *   2. 管理者がブラウザで確かめる
 *        GET /api/cron/subscription-sync   … 管理者でログインしていれば開ける
 *        こちらは必ず空打ち（読むだけ）。鍵を手で扱わずに中身を見るための口。
 *
 * 鍵を画面やログへ写さずに済むよう、この2つ目を用意してある。
 */
async function allowed(req: Request): Promise<boolean> {
  if (requireBearer(req, process.env.CRON_SECRET) || requireBearer(req, process.env.ADMIN_SECRET)) return true;
  // 管理者本人のログイン。共有の鍵を持ち出さずに確かめられるようにする。
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const admin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    return !!admin && (user?.email || '').trim().toLowerCase() === admin;
  } catch { return false; }
}

/** 管理者がブラウザで開いたとき。書かない。 */
export async function GET(req: Request) {
  if (!await allowed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run(true);
}

export async function POST(req: Request) {
  if (!await allowed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let dryRun = false;
  try {
    const body = await readContactBody(req, 1_000);
    dryRun = body?.dryRun === true;
  } catch { /* 本文なしは通常実行 */ }
  return run(dryRun);
}

async function run(dryRun: boolean) {

  const db = createServiceClient();

  // 1) Stripeの契約を全部読む
  const subs: StripeSubscriptionLike[] = [];
  let complete = false;
  try {
    let startingAfter: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await stripe.subscriptions.list({
        status: 'all', limit: PAGE, ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      subs.push(...(res.data as unknown as StripeSubscriptionLike[]));
      if (!res.has_more) { complete = true; break; }
      startingAfter = res.data[res.data.length - 1]?.id;
      if (!startingAfter) { complete = true; break; }
    }
  } catch (err) {
    console.error('[cron/subscription-sync] stripe list failed:', (err as Error)?.message);
    return NextResponse.json({ error: 'Stripeの契約を読み取れませんでした' }, { status: 503 });
  }

  const planSubs = subs.filter(isPlanSubscription);

  // 2) 対応するprofileをまとめて引く
  const customerIds = [...new Set(planSubs.map(customerIdOf).filter((v): v is string => !!v))];
  const profilesByCustomer = new Map<string, ProfileBilling>();
  for (let i = 0; i < customerIds.length; i += PAGE) {
    const chunk = customerIds.slice(i, i + PAGE);
    const { data, error } = await db
      .from('profiles')
      .select('id, stripe_customer_id, stripe_subscription_id, subscription_status, plan, contract_starts_at, contract_ends_at')
      .in('stripe_customer_id', chunk);
    if (error) return NextResponse.json({ error: '契約情報を読み取れませんでした' }, { status: 503 });
    for (const row of (data || []) as ProfileBilling[]) {
      if (row.stripe_customer_id) profilesByCustomer.set(row.stripe_customer_id, row);
    }
  }

  const fixed: { profileId: string; changed: string[] }[] = [];
  const conflicts: { subscriptionId: string; reason: string }[] = [];
  const unlinked: string[] = [];
  let inSync = 0;

  for (const sub of planSubs) {
    const customerId = customerIdOf(sub);
    const profile = customerId ? profilesByCustomer.get(customerId) : undefined;
    if (!profile) {
      // Stripeに顧客が居るのにDBに紐づく人が居ない。自動で作れる話ではない。
      if (!isTerminal(sub.status)) unlinked.push(sub.id);
      continue;
    }

    const outcome = reconcileSubscription(profile, sub);
    if (outcome.action === 'in-sync' || outcome.action === 'ignore') { inSync++; continue; }
    if (outcome.action === 'conflict') { conflicts.push({ subscriptionId: sub.id, reason: outcome.reason }); continue; }

    if (dryRun) { fixed.push({ profileId: profile.id, changed: outcome.changed }); continue; }
    const saved = await db.from('profiles').update(outcome.updates).eq('id', profile.id).select('id');
    if (saved.error || saved.data?.length !== 1) {
      return NextResponse.json({ error: '契約状態を保存できませんでした', fixed, conflicts }, { status: 503 });
    }
    fixed.push({ profileId: profile.id, changed: outcome.changed });
  }

  // 3) 逆向き: DBだけが有効だと思っている人を止める
  //    Stripeを全部読み切れたときだけ行う（読み残しを解約と誤認しない）。
  const stopped: string[] = [];
  if (complete) {
    const liveIds = new Set(planSubs.filter(s => !isTerminal(s.status)).map(s => s.id));
    const { data, error } = await db
      .from('profiles')
      .select('id, stripe_customer_id, stripe_subscription_id, subscription_status, plan, contract_starts_at, contract_ends_at')
      .in('subscription_status', ACTIVE_PROFILE_STATUSES)
      .limit(1000);
    if (error) return NextResponse.json({ error: '契約情報を読み取れませんでした', fixed }, { status: 503 });
    for (const profile of (data || []) as ProfileBilling[]) {
      if (!isOrphanedActiveProfile(profile, liveIds)) continue;
      if (dryRun) { stopped.push(profile.id); continue; }
      const saved = await db.from('profiles')
        .update({ subscription_status: 'canceled', stripe_subscription_id: null })
        .eq('id', profile.id).select('id');
      if (saved.error || saved.data?.length !== 1) {
        return NextResponse.json({ error: '契約状態を保存できませんでした', fixed, stopped }, { status: 503 });
      }
      stopped.push(profile.id);
    }
  }

  const needsAttention = conflicts.length > 0 || unlinked.length > 0;
  if (needsAttention) {
    console.error('[cron/subscription-sync] needs attention', { conflicts, unlinked });
  }

  return NextResponse.json({
    dryRun, scanned: planSubs.length, complete, inSync,
    fixed, stopped, conflicts, unlinked,
  });
}
