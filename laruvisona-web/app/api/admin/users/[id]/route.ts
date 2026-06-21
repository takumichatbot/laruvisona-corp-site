import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { Resend } from 'resend';

const PLAN_LABEL: Record<string, string> = {
  hp: 'HP単体 (¥999/月)',
  lite: 'HP + LARUbot Lite (¥2,480/月)',
  'hp-bot': 'HP + LARUbot (¥4,980/月)',
  'hp-bot-seo': 'HP + Bot + SEO (¥9,800/月)',
  agency: 'エージェンシー (¥19,800/月)',
};

async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  return user.email === process.env.ADMIN_EMAIL;
}

const PLAN_PRICE_MAP: Record<string, string | undefined> = {
  hp: process.env.STRIPE_PRICE_ID,
  'hp-bot': process.env.STRIPE_BUNDLE_BOT_PRICE_ID,
  'hp-bot-seo': process.env.STRIPE_BUNDLE_FULL_PRICE_ID,
  agency: process.env.STRIPE_AGENCY_PRICE_ID,
  lite: process.env.STRIPE_LITE_PRICE_ID,
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  if (!await isAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const service = await createServiceClient();

  // プラン変更
  if (body.plan !== undefined) {
    const priceId = PLAN_PRICE_MAP[body.plan];
    if (!priceId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

    const { data: profile } = await service.from('profiles').select('stripe_subscription_id').eq('id', id).single();
    if (profile?.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        const itemId = sub.items.data[0]?.id;
        if (itemId) {
          await stripe.subscriptions.update(profile.stripe_subscription_id, {
            items: [{ id: itemId, price: priceId }],
            proration_behavior: 'create_prorations',
            metadata: { plan: body.plan },
          });
        }
      } catch (err) {
        console.error('[admin/plan] stripe error:', err);
      }
    }
    await service.from('profiles').update({ plan: body.plan }).eq('id', id);

    // プラン変更メール
    if (process.env.RESEND_API_KEY) {
      try {
        const { data: { user: targetUser } } = await service.auth.admin.getUserById(id);
        if (targetUser?.email) {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
          await resend.emails.send({
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
        }
      } catch { /* non-fatal */ }
    }
    return NextResponse.json({ ok: true });
  }

  // 強制解約
  if (body.force_cancel) {
    const { data: profile } = await service.from('profiles').select('stripe_subscription_id').eq('id', id).single();
    if (profile?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      } catch (err) {
        console.error('[admin/cancel] stripe error:', err);
      }
    }
    await service.from('profiles').update({
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      plan: null,
    }).eq('id', id);
    return NextResponse.json({ ok: true });
  }

  // 通常の更新（features / is_suspended / admin_notes）
  const updates: Record<string, unknown> = {};
  if (body.features !== undefined) updates.features = body.features;
  if (body.is_suspended !== undefined) updates.is_suspended = body.is_suspended;
  if (body.admin_notes !== undefined) updates.admin_notes = body.admin_notes;

  const { error } = await service.from('profiles').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
