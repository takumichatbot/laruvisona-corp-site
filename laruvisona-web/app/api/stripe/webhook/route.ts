import { NextResponse } from 'next/server';
import { invoiceSubscriptionId, subscriptionPeriodEnd, subscriptionStartedAt } from '@/lib/stripe-shape';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { finalizeBooking } from '@/lib/booking-finalize';
import { provisionLarubotOnPlan, LarubotRegisterError } from '@/lib/larubot-provision';
import { alertLarubotFailure } from '@/lib/larubot-alert';
import { Resend } from 'resend';
import type Stripe from 'stripe';
import { readRequestText } from '@/lib/contact-contract';
import { commitShopCheckout } from '@/lib/shop-webhook';
import { syncShopRefund } from '@/lib/shop-refunds';
import type { SupabaseClient } from '@supabase/supabase-js';

const PLAN_LABEL: Record<string, string> = {
  hp: 'HP単体 (¥999/月)',
  'hp-bot': 'HP + Bot Standard (¥4,980/月)',
  'hp-bot-seo': 'HP + Bot + SEO (¥9,800/月)',
  agency: 'エージェンシー (¥19,800/月)',
  lite: 'HP + LARUbot Lite (¥2,980/月)',
};

async function sendEmail(to: string, subject: string, html: string, idempotencyKey: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[stripe/webhook] transactional email is not configured', { idempotencyKey });
    return false;
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send(
      { from: 'LARU HP <noreply@laruvisona.jp>', to, subject, html },
      { idempotencyKey },
    );
    if (result.error) {
      console.error('[stripe/webhook] transactional email rejected', { idempotencyKey, name: result.error.name });
      return false;
    }
    return true;
  } catch (error) {
    console.error('[stripe/webhook] transactional email failed', {
      idempotencyKey,
      name: error instanceof Error ? error.name : 'unknown',
    });
    return false;
  }
}

async function syncMemberSubscription(sub: Stripe.Subscription, supabase: SupabaseClient): Promise<boolean> {
  const meta = (sub.metadata || {}) as Record<string, string>;
  if (meta.kind !== 'member') return false;
  if (!meta.member_id || !meta.site_id) throw Error('member subscription metadata missing');
  const paid = sub.status === 'active' || sub.status === 'trialing';
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  const { data, error } = await supabase.from('hp_members').update({
    plan: paid ? 'paid' : 'free',
    status: 'active',
    stripe_customer_id: customerId || null,
    stripe_subscription_id: sub.status === 'canceled' ? null : sub.id,
  }).eq('id', meta.member_id).eq('site_id', meta.site_id).select('id');
  if (error || data?.length !== 1) throw Error('member subscription could not be synchronized');
  return true;
}

/**
 * 「書けなかった」と「その契約は元からうちに無い」を、分けて扱う。
 *
 * これまで、更新した行数が1でなければ全部 500 を返していた。
 * ところが profiles に居ない契約がある。
 *   ・管理者の契約（164行目で意図的に紐付けをスキップしている）
 *   ・Stripe の管理画面から直接作った契約
 *
 * その契約のイベントは、**何度再送されても永遠に500**になる。
 * 失敗が積み上がると Stripe がこのエンドポイントごと無効にするので、
 * **他の全お客様の契約同期（解約・支払い失敗・プラン変更）まで一緒に止まる。**
 *
 * しかも失敗は Stripe 側のイベントログにしか出ない。
 * こちらの画面にもログにも「同期が止まった」ことは現れない。
 *
 * 分け方:
 *   書けなかった（error あり） → 500。再送で直るので、直してもらう
 *   1件も当たらない            → 200。再送しても永久に当たらない
 */
type WriteOutcome = { ok: true } | { ok: false; retry: boolean; reason: string };

function outcome(
  result: { error: { message: string } | null; data: unknown[] | null },
  what: string,
): WriteOutcome {
  if (result.error) return { ok: false, retry: true, reason: `${what}: ${result.error.message}` };
  if ((result.data?.length ?? 0) === 1) return { ok: true };
  return { ok: false, retry: false, reason: `${what}: 対象の契約がこちらに登録されていません` };
}

export async function POST(req: Request) {
  let body: string;
  try {
    body = await readRequestText(req, 1_000_000);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: (error as Error).message === 'too_large' ? 413 : 400 });
  }
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  if (['refund.created', 'refund.updated', 'refund.failed'].includes(event.type)) {
    try {
      if (await syncShopRefund(event.data.object as Stripe.Refund, null, supabase, stripe)) {
        return NextResponse.json({ received: true });
      }
    } catch {
      return NextResponse.json({ error: 'Shop refund could not be saved' }, { status: 500 });
    }
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      // 時間枠予約の事前決済（mode=payment）: 仮押さえ→確定＋通知
      const bmeta = (session.metadata || {}) as Record<string, string>;
      if (session.mode === 'payment' && bmeta.kind === 'booking') {
        const reservationId = bmeta.reservation_id;
        const siteId = bmeta.site_id;
        if (!reservationId || !siteId || session.payment_status !== 'paid') break;

        // 同じイベントの並行配送でも1本だけが pending → confirmed を獲得する。
        // Stripeセッションとサイトも結び、別の支払いで予約を確定させない。
        const claimed = await supabase.from('hp_reservations').update({ status: 'confirmed' })
          .eq('id', reservationId).eq('site_id', siteId).eq('stripe_session_id', session.id)
          .eq('status', 'pending').select('*').maybeSingle();
        if (claimed.error) return NextResponse.json({ error: 'Booking could not be synchronized' }, { status: 500 });
        const resv = claimed.data;
        if (!resv) break;

        const notified = await finalizeBooking({
          siteId: resv.site_id,
          name: resv.name,
          email: resv.email,
          phone: resv.phone,
          service: resv.service,
          slotId: resv.slot_id,
          slotDatetime: resv.slot_datetime,
          prepaid: true,
          amount: resv.amount,
        });
        if (!notified) {
          // 通知が届かなければ pending に戻して500を返し、Stripeの再送で回収する。
          // 条件付き更新なので、その間に別処理が状態を変えた予約は巻き戻さない。
          const released = await supabase.from('hp_reservations').update({ status: 'pending' })
            .eq('id', reservationId).eq('site_id', siteId).eq('stripe_session_id', session.id)
            .eq('status', 'confirmed').select('id');
          if (released.error || released.data?.length !== 1) {
            return NextResponse.json({ error: 'Booking notification recovery failed' }, { status: 500 });
          }
          return NextResponse.json({ error: 'Booking notification incomplete' }, { status: 500 });
        }
        break;
      }

      // ショップ購入（mode=payment, kind=shop）: 注文保存と在庫減算を同じ処理に閉じる
      if (session.mode === 'payment' && bmeta.kind === 'shop') {
        try { await commitShopCheckout(session, null, supabase, stripe); }
        catch { return NextResponse.json({ error: 'Shop order could not be saved' }, { status: 500 }); }
        break;
      }

      // 有料会員（mode=subscription, kind=member）: 会員を有料・有効化
      if (session.mode === 'subscription' && bmeta.kind === 'member') {
        const memberId = bmeta.member_id;
        const siteId = bmeta.site_id;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (!memberId || !siteId || !subscriptionId) return NextResponse.json({ error: 'Member checkout metadata missing' }, { status: 400 });
        const { data: updated, error } = await supabase.from('hp_members').update({
          plan: 'paid', status: 'active', stripe_customer_id: customerId || null, stripe_subscription_id: subscriptionId,
        }).eq('id', memberId).eq('site_id', siteId).eq('status', 'active').select('id');
        if (error || updated?.length !== 1) return NextResponse.json({ error: 'Member checkout could not be saved' }, { status: 500 });
        break;
      }

      if (session.mode !== 'subscription') break;

      const meta = (session.metadata || {}) as Record<string, string>;
      const userId = meta.supabase_user_id;
      const siteId = meta.site_id;
      const plan = meta.plan;
      if (!userId) break;

      // Adminはサブスク管理をスキップ（課金なしで全機能利用）
      const { data: { user: adminCheck } } = await supabase.auth.admin.getUserById(userId);
      if (adminCheck?.email === process.env.ADMIN_EMAIL) break;

      // Fetch subscription to get accurate period dates
      const subId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as Stripe.Subscription | null)?.id;
      let contractStart = new Date();
      let contractEnd = new Date();
      contractEnd.setMonth(contractEnd.getMonth() + 6);
      if (subId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subId);
          // 契約の始まりは start_date（契約が始まった日）で固定する。
          // 請求期間の始まりは請求のたびに翌月へ動くため、最低利用期間の
          // 判定（lib/billing-portal-mode.ts）が明けなくなる。定期同期
          // （app/api/cron/subscription-sync）も start_date を正としている。
          //
          // 期間の終わりは、この版では items の中にある。直に読むと undefined になり、
          // contract_ends_at が既定値（処理時刻＋6ヶ月）のまま入っていた。
          // ダッシュボードが見せている「最低契約期間: 〜◯月◯日」が、
          // Stripe の実際の契約と**無関係な数字**になっていた。
          const startedAt = subscriptionStartedAt(sub);
          if (startedAt) contractStart = new Date(startedAt * 1000);
          const periodEnd = subscriptionPeriodEnd(sub);
          if (periodEnd) contractEnd = new Date(periodEnd * 1000);
          else console.error('[Stripe webhook] period end not found for', subId);
        } catch { /* fall through to default */ }
      }

      const profileUpdates: Record<string, unknown> = {
        stripe_subscription_id: subId ?? (session.subscription as string),
        subscription_status: 'active',
        plan: plan || 'hp',
        contract_starts_at: contractStart.toISOString(),
        contract_ends_at: contractEnd.toISOString(),
      };
      // Save customer ID if session has one (e.g. guest checkout)
      if (session.customer) profileUpdates['stripe_customer_id'] = session.customer as string;

      const profileSaved = await supabase.from('profiles').update(profileUpdates).eq('id', userId).select('id');
      if (profileSaved.error || profileSaved.data?.length !== 1) {
        return NextResponse.json({ error: 'Subscription could not be synchronized' }, { status: 500 });
      }

      // サブスク開始メール
      if (adminCheck?.email) {
        const planLabel = PLAN_LABEL[plan || 'hp'] || plan || 'HP単体';
        await sendEmail(adminCheck.email, '【LARU HP】サブスクリプションを開始しました', `
<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);padding:36px 40px">
      <div style="font-size:16px;font-weight:900;color:white;letter-spacing:-0.5px;margin-bottom:16px">LARU<span style="font-weight:300">HP</span></div>
      <h1 style="color:white;font-size:22px;font-weight:800;margin:0">サブスクリプションを開始しました</h1>
    </div>
    <div style="padding:36px 40px">
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px">ご契約ありがとうございます！<br>以下のプランでご利用いただけます。</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px 24px;margin-bottom:28px">
        <div style="color:#0369a1;font-size:13px;font-weight:600;margin-bottom:4px">ご契約プラン</div>
        <div style="color:#0f172a;font-size:18px;font-weight:800">${planLabel}</div>
        <div style="color:#64748b;font-size:12px;margin-top:4px">初月無料 / 最低6ヶ月契約</div>
      </div>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp'}/laruHP/dashboard" style="display:block;text-align:center;background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;font-weight:800;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;margin-bottom:20px">ダッシュボードを開く →</a>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">ご不明な点は <a href="mailto:info@laruvisona.jp" style="color:#0ea5e9;text-decoration:none">info@laruvisona.jp</a> までどうぞ</p>
    </div>
  </div>
</body></html>`, `laruhp-subscription-start-${event.id}`);
      }

      // Auto-create LARUbot account for bundle/lite plans（新規契約なので prevPlan なし＝必ず登録）
      try {
        await provisionLarubotOnPlan({ userId, email: adminCheck?.email, plan: plan || 'hp', siteId });
      } catch (err) {
        /*
          決済は止めない（既存のとおり）。ただしログだけで終わらせない。
          ここで失敗すると、契約は通っているのにボットもSEOも付かない。
          お客様が気づいて連絡してくるまで、誰も知らないままだった。
        */
        await alertLarubotFailure({
          kind: 'register', userId, plan: plan || 'hp', siteId: siteId ?? null,
          reason: err instanceof LarubotRegisterError ? err.code : ((err as Error)?.message || 'unknown'),
          status: err instanceof LarubotRegisterError ? err.httpStatus : null,
        });
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const inv = event.data.object as unknown as Record<string, unknown>;
      // 契約IDの居場所は版で変わる。lib/stripe-shape.ts が両方を見る。
      const subId = invoiceSubscriptionId(inv);
      if (!subId) { console.error('[Stripe webhook] payment_succeeded: subscription id not found', inv['id']); break; }

      const { data: memberPaid, error: memberError } = await supabase.from('hp_members')
        .update({ plan: 'paid' }).eq('stripe_subscription_id', subId).eq('status', 'active').select('id');
      if (memberError) return NextResponse.json({ error: 'Member payment could not be synchronized' }, { status: 500 });
      if ((memberPaid?.length || 0) > 0) break;

      // Update contract_ends_at based on the latest invoice period_end
      const updates: Record<string, unknown> = { subscription_status: 'active' };
      const lines = inv['lines'] as { data?: Array<{ period?: { end?: number } }> } | undefined;
      if (lines?.data?.[0]?.period?.end) {
        updates.contract_ends_at = new Date(lines.data[0].period.end! * 1000).toISOString();
      }
      const renewed = outcome(
        await supabase.from('profiles').update(updates).eq('stripe_subscription_id', subId).select('id'),
        'invoice.payment_succeeded',
      );
      if (!renewed.ok) {
        console.error('[Stripe webhook]', renewed.reason);
        if (renewed.retry) return NextResponse.json({ error: 'Subscription payment could not be synchronized' }, { status: 500 });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as unknown as Record<string, unknown>;
      /*
        ここで契約IDが取れないと、**カードが落ちても何も起きない。**
        past_due にならず、サービスも止まらず、お知らせも届かない。
        Stripe が最後に契約を消すまで、無料で使われ続ける。
        黙って break していたので、Stripe 側からは「全部成功」に見えていた。
      */
      const subId = invoiceSubscriptionId(inv);
      if (!subId) { console.error('[Stripe webhook] payment_failed: subscription id not found', inv['id']); break; }

      const { data: memberPastDue, error: memberError } = await supabase.from('hp_members')
        .update({ plan: 'free' }).eq('stripe_subscription_id', subId).select('id');
      if (memberError) return NextResponse.json({ error: 'Member payment could not be synchronized' }, { status: 500 });
      if ((memberPastDue?.length || 0) > 0) break;

      const failedRaw = await supabase.from('profiles')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_subscription_id', subId).select('id');
      const failedUpdate = outcome(failedRaw, 'invoice.payment_failed');
      if (!failedUpdate.ok) {
        console.error('[Stripe webhook]', failedUpdate.reason);
        if (failedUpdate.retry) return NextResponse.json({ error: 'Subscription failure could not be synchronized' }, { status: 500 });
      }

      // 支払い失敗メール
      const failedProfile = failedRaw.data?.[0];
      if (failedProfile) {
        const { data: { user: failedUser } } = await supabase.auth.admin.getUserById(failedProfile.id);
        if (failedUser?.email) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
          await sendEmail(failedUser.email, '【LARU HP】お支払いに失敗しました', `
<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fff5f5;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:#dc2626;padding:36px 40px">
      <div style="font-size:16px;font-weight:900;color:white;letter-spacing:-0.5px;margin-bottom:16px">LARU<span style="font-weight:300">HP</span></div>
      <h1 style="color:white;font-size:22px;font-weight:800;margin:0">お支払いに失敗しました</h1>
    </div>
    <div style="padding:36px 40px">
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px">登録いただいているカードへの請求が失敗しました。<br>サービスの継続利用のため、お支払い情報をご確認ください。</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px 20px;margin-bottom:28px;color:#991b1b;font-size:13px;line-height:1.6">
        お支払いが解決されない場合、サービスが一時停止される場合があります。
      </div>
      <a href="${appUrl}/laruHP/settings" style="display:block;text-align:center;background:#dc2626;color:white;font-weight:800;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;margin-bottom:20px">支払い情報を更新する →</a>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">ご不明な点は <a href="mailto:info@laruvisona.jp" style="color:#0ea5e9;text-decoration:none">info@laruvisona.jp</a> までどうぞ</p>
    </div>
  </div>
</body></html>`, `laruhp-payment-failed-${event.id}`);
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      try { if (await syncMemberSubscription(sub, supabase)) break; }
      catch { return NextResponse.json({ error: 'Member subscription could not be synchronized' }, { status: 500 }); }
      const subMeta = (sub.metadata || {}) as Record<string, string>;
      const updatedPlan = subMeta['plan'];
      const statusMap: Record<string, string> = {
        active: 'active',
        past_due: 'past_due',
        canceled: 'canceled',
        unpaid: 'past_due',
        trialing: 'active',
      };
      const updates: Record<string, unknown> = {
        subscription_status: statusMap[sub.status] || sub.status,
      };
      if (updatedPlan) updates['plan'] = updatedPlan;
      const subscriptionUpdated = await supabase.from('profiles').update(updates).eq('stripe_subscription_id', sub.id).select('id');
      const updatedOutcome = outcome(subscriptionUpdated, 'customer.subscription.updated');
      if (!updatedOutcome.ok) {
        console.error('[Stripe webhook]', updatedOutcome.reason);
        if (updatedOutcome.retry) return NextResponse.json({ error: 'Subscription could not be synchronized' }, { status: 500 });
        break;   // うちに無い契約。再送しても当たらないので、ここで終える
      }

      // プラン変更確認メール (アクティブ時のみ)
      if (updatedPlan && (sub.status === 'active' || sub.status === 'trialing')) {
        const upgProfile = subscriptionUpdated.data?.[0];
        if (upgProfile) {
          const { data: { user: upgUser } } = await supabase.auth.admin.getUserById(upgProfile.id);
          if (upgUser?.email) {
            const planLabel = PLAN_LABEL[updatedPlan] || updatedPlan;
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
            await sendEmail(upgUser.email, '【LARU HP】プランを変更しました', `
<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#7c3aed,#0ea5e9);padding:36px 40px">
      <div style="font-size:16px;font-weight:900;color:white;letter-spacing:-0.5px;margin-bottom:16px">LARU<span style="font-weight:300">HP</span></div>
      <h1 style="color:white;font-size:22px;font-weight:800;margin:0">プランを変更しました</h1>
    </div>
    <div style="padding:36px 40px">
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px">プランの変更が完了しました。<br>新しいプランの機能をすぐにご利用いただけます。</p>
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:20px 24px;margin-bottom:28px">
        <div style="color:#7c3aed;font-size:13px;font-weight:600;margin-bottom:4px">変更後のプラン</div>
        <div style="color:#0f172a;font-size:18px;font-weight:800">${planLabel}</div>
      </div>
      <a href="${appUrl}/laruHP/dashboard" style="display:block;text-align:center;background:linear-gradient(135deg,#7c3aed,#0ea5e9);color:white;font-weight:800;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;margin-bottom:20px">ダッシュボードで確認 →</a>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">ご不明な点は <a href="mailto:info@laruvisona.jp" style="color:#0ea5e9;text-decoration:none">info@laruvisona.jp</a> までどうぞ</p>
    </div>
  </div>
</body></html>`, `laruhp-plan-changed-${event.id}`);
          }
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;

      // 有料会員の解約: 会員を無料に戻す
      if ((sub.metadata as Record<string, string> | null)?.kind === 'member') {
        try { await syncMemberSubscription(sub, supabase); }
        catch { return NextResponse.json({ error: 'Member subscription could not be synchronized' }, { status: 500 }); }
        break;
      }

      // stripe_customer_id は変わらないので先に取得
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      const canceledLookup = customerId
        ? await supabase.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle()
        : { data: null, error: null };
      if (canceledLookup.error) return NextResponse.json({ error: 'Subscription owner could not be read' }, { status: 500 });
      const canceledProfile = canceledLookup.data;

      const canceled = await supabase.from('profiles')
        .update({ subscription_status: 'canceled', stripe_subscription_id: null, plan: null })
        .eq('stripe_subscription_id', sub.id).select('id');
      if (canceled.error || canceled.data?.length !== 1) {
        return NextResponse.json({ error: 'Subscription cancellation could not be synchronized' }, { status: 500 });
      }

      // 解約メール
      if (canceledProfile) {
        const { data: { user: canceledUser } } = await supabase.auth.admin.getUserById(canceledProfile.id);
        if (canceledUser?.email) {
          await sendEmail(canceledUser.email, '【LARU HP】サブスクリプションを解約しました', `
<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:#334155;padding:36px 40px">
      <div style="font-size:16px;font-weight:900;color:white;letter-spacing:-0.5px;margin-bottom:16px">LARU<span style="font-weight:300">HP</span></div>
      <h1 style="color:white;font-size:22px;font-weight:800;margin:0">解約手続きが完了しました</h1>
    </div>
    <div style="padding:36px 40px">
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px">LARU HP のご利用ありがとうございました。<br>サブスクリプションの解約が完了しました。</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px 20px;margin-bottom:28px;color:#991b1b;font-size:13px;line-height:1.6">
        ご契約期間終了後、公開中のサイトは非公開となります。<br>
        データはしばらく保持されますので、再開される場合はお気軽にご連絡ください。
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">またのご利用をお待ちしております。<br><a href="mailto:info@laruvisona.jp" style="color:#0ea5e9;text-decoration:none">info@laruvisona.jp</a></p>
    </div>
  </div>
</body></html>`, `laruhp-subscription-canceled-${event.id}`);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
