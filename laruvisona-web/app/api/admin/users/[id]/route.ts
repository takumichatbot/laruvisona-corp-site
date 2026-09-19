import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/adminAuth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { Resend } from 'resend';
import { readContactBody } from '@/lib/contact-contract';
import { billingAppOrigin } from '@/lib/billing-url';
import { claimPublicRate } from '@/lib/public-rate-limit';
import { provisionLarubotOnPlan } from '@/lib/larubot-provision';
import { alertLarubotFailure } from '@/lib/larubot-alert';

const PLAN_LABEL: Record<string, string> = {
  hp: 'HP単体 (¥999/月)',
  lite: 'HP + LARUbot Lite (¥2,980/月)',  // 正は lib/laruhp-facts.ts MONTHLY.lite
  'hp-bot': 'HP + Bot Standard (¥4,980/月)',
  'hp-bot-seo': 'HP + Bot + SEO (¥9,800/月)',
  agency: 'エージェンシー (¥19,800/月)',
};

async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  return isAdminEmail(user.email);
}

const PLAN_PRICE_MAP: Record<string, string | undefined> = {
  hp: process.env.STRIPE_PRICE_ID,
  'hp-bot': process.env.STRIPE_BUNDLE_BOT_PRICE_ID,
  'hp-bot-seo': process.env.STRIPE_BUNDLE_FULL_PRICE_ID,
  agency: process.env.STRIPE_AGENCY_PRICE_ID,
  lite: process.env.STRIPE_LITE_PRICE_ID,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  if (!await isAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  let body: Record<string, unknown>;
  try { body = await readContactBody(req, 64_000); }
  catch { return NextResponse.json({ error: '入力を確認してください' }, { status: 400 }); }
  const allowedKeys = new Set(['plan', 'force_cancel', 'features', 'is_suspended', 'admin_notes']);
  if (Object.keys(body).some(key => !allowedKeys.has(key))) {
    return NextResponse.json({ error: '入力を確認してください' }, { status: 400 });
  }
  const billingActions = Number(body.plan !== undefined) + Number(body.force_cancel === true);
  if (billingActions > 1 || (body.force_cancel !== undefined && body.force_cancel !== true)) {
    return NextResponse.json({ error: '契約操作を1つ選んでください' }, { status: 400 });
  }
  const service = await createServiceClient();

  // プラン変更
  if (body.plan !== undefined) {
    if (typeof body.plan !== 'string') return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    const priceId = PLAN_PRICE_MAP[body.plan];
    if (!priceId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    const rate = await claimPublicRate(service, 'admin-plan-billing', id, 1, 60);
    if (rate !== 'allowed') return NextResponse.json({ error: rate === 'limited' ? '少し待ってからお試しください' : '決済受付を確認できません' }, { status: rate === 'limited' ? 429 : 503 });

    const profileResult = await service.from('profiles')
      .select('stripe_subscription_id,stripe_customer_id,plan')
      .eq('id', id)
      .maybeSingle();
    if (profileResult.error) {
      return NextResponse.json({ error: '契約状態を確認できませんでした' }, { status: 503 });
    }
    const subscriptionId = profileResult.data?.stripe_subscription_id;
    if (!profileResult.data) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!subscriptionId) {
      return NextResponse.json({ error: 'Stripe契約がないためプランを変更できません' }, { status: 409 });
    }

    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const itemId = sub.items.data[0]?.id;
      if (!itemId || sub.items.data.length !== 1 || ['canceled', 'incomplete_expired'].includes(sub.status)) {
        return NextResponse.json({ error: 'Stripe契約の内容を確認してください' }, { status: 409 });
      }
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const expectedCustomer = profileResult.data.stripe_customer_id;
      if (!expectedCustomer || customerId !== expectedCustomer) {
        return NextResponse.json({ error: 'Stripe契約の所有者を確認できません' }, { status: 409 });
      }
      const currentPrice = sub.items.data[0].price.id;
      if (currentPrice === priceId) return NextResponse.json({ error: '既にこのプランです' }, { status: 400 });
      await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: 'create_prorations',
        metadata: { ...(sub.metadata || {}), plan: body.plan },
      }, { idempotencyKey: `laruhp-admin-upgrade-${subscriptionId}-${currentPrice}-${priceId}` });
    } catch (err) {
      console.error('[admin/plan] stripe error:', err instanceof Error ? err.message : 'unknown');
      return NextResponse.json({ error: 'Stripeのプラン変更を確定できませんでした' }, { status: 502 });
    }

    const saved = await service.from('profiles')
      .update({ plan: body.plan })
      .eq('id', id)
      .eq('stripe_subscription_id', subscriptionId)
      .select('id');
    if (saved.error || saved.data?.length !== 1) {
      return NextResponse.json({ error: '決済変更後の契約状態を保存できませんでした' }, { status: 503 });
    }

    /*
      LARUbot にも伝える。

      ここは profiles.plan を書き換えるだけで、**LARUbot の登録を呼んでいなかった。**
      手でプランを付けた相手は、あちらに登録されないままになる。
      決済経路（checkout / webhook / upgrade）には前からあるのに、
      管理画面から付けたときだけ抜けていた。

      LARUbot の register は email 単位で冪等なので、既に登録済みの人へ
      叩き直しても public_id は変わらず、記事もキーワードも壊れない
      （LARUbot 側の回答 2026-09-18）。

      失敗しても管理操作そのものは止めない。ただし黙らない。
    */
    try {
      const { data: { user: planUser } } = await service.auth.admin.getUserById(id);
      await provisionLarubotOnPlan({
        userId: id,
        email: planUser?.email,
        plan: body.plan,
        prevPlan: profileResult.data?.plan ?? null,
      });
    } catch (err) {
      await alertLarubotFailure({
        kind: 'register', userId: id, plan: body.plan,
        reason: err instanceof Error ? err.message : 'unknown',
      });
    }

    // プラン変更メール
    if (process.env.RESEND_API_KEY) {
      try {
        const { data: { user: targetUser } } = await service.auth.admin.getUserById(id);
        if (targetUser?.email) {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const appUrl = billingAppOrigin();
          // Resend は拒否されても throw せず error を返す。戻り値を捨てると、
          // 送ったのか送っていないのかを、あとから調べる手段が無くなる。
          const notice = await resend.emails.send({
            from: 'LARU HP <noreply@laruvisona.jp>',
            to: targetUser.email,
            subject: '【LARU HP】プランが変更されました',
            html: `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);padding:36px 40px">
      <div style="font-size:16px;font-weight:900;color:white;margin-bottom:16px">LARU<span style="font-weight:300">HP</span></div>
      <h1 style="color:white;font-size:22px;font-weight:800;margin:0">プランが変更されました</h1>
    </div>
    <div style="padding:36px 40px">
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px 24px;margin-bottom:28px">
        <div style="color:#0369a1;font-size:13px;font-weight:600;margin-bottom:4px">新しいプラン</div>
        <div style="color:#0f172a;font-size:18px;font-weight:800">${PLAN_LABEL[body.plan] || body.plan}</div>
      </div>
      <a href="${appUrl}/laruHP/dashboard" style="display:block;text-align:center;background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;font-weight:800;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px">ダッシュボードを確認する →</a>
    </div>
  </div>
</body></html>`,
          });
          if (notice.error) console.error('[admin] plan-change mail not accepted:', id, notice.error.message);
        }
      } catch (e) { console.error('[admin] plan-change mail failed:', id, (e as Error)?.message); }
    }
    return NextResponse.json({ ok: true });
  }

  // 強制解約
  if (body.force_cancel) {
    const rate = await claimPublicRate(service, 'admin-plan-billing', id, 1, 60);
    if (rate !== 'allowed') return NextResponse.json({ error: rate === 'limited' ? '少し待ってからお試しください' : '決済受付を確認できません' }, { status: rate === 'limited' ? 429 : 503 });
    const profileResult = await service.from('profiles')
      .select('stripe_subscription_id,stripe_customer_id,subscription_status,plan')
      .eq('id', id)
      .maybeSingle();
    if (profileResult.error) {
      return NextResponse.json({ error: '契約状態を確認できませんでした' }, { status: 503 });
    }
    if (!profileResult.data) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const subscriptionId = profileResult.data.stripe_subscription_id;
    if (!subscriptionId) {
      if (profileResult.data.subscription_status === 'canceled' && !profileResult.data.plan) {
        return NextResponse.json({ ok: true, unchanged: true });
      }
      return NextResponse.json({ error: 'Stripe契約を特定できないため解約できません' }, { status: 409 });
    }
    /*
      ⚠️ **Stripeに無い契約を、消せないままにしない。**

      2026-09-18: Stripeのサンドボックスから紛れ込んだ契約が profiles に
      残っていた。ここは retrieve の失敗をすべて 502 で返していたので、
      「Stripeに存在しない契約」を運営が消す手段が無かった。
      DBを手で書き換えるしかない状態になっていて、それは記録も残らない。

      Stripeが「そんな契約は無い」と言った場合だけ、Stripe側へは何もせず
      こちら側の記録を片付ける。それ以外の失敗（通信不良など）は今までどおり
      502 で止める。消してよいのかが分からないまま消さない。
    */
    let missingInStripe = false;
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      if (!profileResult.data.stripe_customer_id || customerId !== profileResult.data.stripe_customer_id) {
        return NextResponse.json({ error: 'Stripe契約の所有者を確認できません' }, { status: 409 });
      }
      if (sub.status !== 'canceled') {
        await stripe.subscriptions.cancel(subscriptionId, {}, { idempotencyKey: `laruhp-admin-cancel-${subscriptionId}` });
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const status = (err as { statusCode?: number })?.statusCode;
      if (code === 'resource_missing' || status === 404) {
        missingInStripe = true;
        console.error('[admin/cancel] Stripeに存在しない契約を片付けます', id);
      } else {
        console.error('[admin/cancel] stripe error:', err instanceof Error ? err.message : 'unknown');
        return NextResponse.json({ error: 'Stripeの解約を確定できませんでした' }, { status: 502 });
      }
    }
    /*
      契約期間も一緒に消す。残しておくと、契約が無いのに
      ダッシュボードが「最低契約期間: 〜◯月◯日」を出し続ける。
    */
    const canceled = await service.from('profiles').update({
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      plan: null,
      contract_starts_at: null,
      contract_ends_at: null,
    }).eq('id', id).eq('stripe_subscription_id', subscriptionId).select('id');
    if (canceled.error || canceled.data?.length !== 1) {
      return NextResponse.json({ error: '解約後の契約状態を保存できませんでした' }, { status: 503 });
    }
    return NextResponse.json({ ok: true, ...(missingInStripe ? { missingInStripe: true } : {}) });
  }

  // 通常の更新（features / is_suspended / admin_notes）
  const updates: Record<string, unknown> = {};
  if (body.features !== undefined) {
    if (!body.features || typeof body.features !== 'object' || Array.isArray(body.features)) return NextResponse.json({ error: '機能設定を確認してください' }, { status: 400 });
    updates.features = body.features;
  }
  if (body.is_suspended !== undefined) {
    if (typeof body.is_suspended !== 'boolean') return NextResponse.json({ error: '停止状態を確認してください' }, { status: 400 });
    updates.is_suspended = body.is_suspended;
  }
  if (body.admin_notes !== undefined) {
    if (body.admin_notes !== null && (typeof body.admin_notes !== 'string' || body.admin_notes.length > 10_000)) return NextResponse.json({ error: '管理メモを確認してください' }, { status: 400 });
    updates.admin_notes = body.admin_notes;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '更新項目がありません' }, { status: 400 });
  }
  const saved = await service.from('profiles').update(updates).eq('id', id).select('id');
  if (saved.error || saved.data?.length !== 1) {
    return NextResponse.json({ error: '利用者情報を更新できませんでした' }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
