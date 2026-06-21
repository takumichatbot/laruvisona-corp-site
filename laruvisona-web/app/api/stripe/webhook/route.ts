import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import type Stripe from 'stripe';

const PLAN_LABEL: Record<string, string> = {
  hp: 'HP単体 (¥999/月)',
  'hp-bot': 'HP + LARUbot (¥4,980/月)',
  'hp-bot-seo': 'HP + Bot + SEO (¥9,800/月)',
  agency: 'エージェンシー (¥19,800/月)',
  lite: 'HP + LARUbot Lite (¥2,480/月)',
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: 'LARU HP <noreply@laruvisona.jp>', to, subject, html });
  } catch { /* non-fatal */ }
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') break;

      const meta = (session.metadata || {}) as Record<string, string>;
      const userId = meta.supabase_user_id;
      const siteId = meta.site_id;
      const plan = meta.plan;
      if (!userId) break;

      // Adminはサブスク管理をスキップ（課金なしで全機能利用）
      const { data: { user: adminCheck } } = await supabase.auth.admin.getUserById(userId);
      if (adminCheck?.email === process.env.ADMIN_EMAIL) break;

      const contractStart = new Date();
      const contractEnd = new Date();
      contractEnd.setMonth(contractEnd.getMonth() + 6);

      const profileUpdates: Record<string, unknown> = {
        stripe_subscription_id: session.subscription as string,
        subscription_status: 'active',
        plan: plan || 'hp',
        contract_starts_at: contractStart.toISOString(),
        contract_ends_at: contractEnd.toISOString(),
      };
      // Save customer ID if session has one (e.g. guest checkout)
      if (session.customer) profileUpdates['stripe_customer_id'] = session.customer as string;

      await supabase.from('profiles').update(profileUpdates).eq('id', userId);

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
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">ご不明な点は <a href="mailto:support@laruvisona.jp" style="color:#0ea5e9;text-decoration:none">support@laruvisona.jp</a> までどうぞ</p>
    </div>
  </div>
</body></html>`);
      }

      // Auto-create LARUbot account for bundle/lite plans
      if ((plan === 'lite' || plan === 'hp-bot' || plan === 'hp-bot-seo' || plan === 'agency') && process.env.LARU_HP_API_SECRET) {
        try {
          const { data: { user } } = await supabase.auth.admin.getUserById(userId);
          let siteName = '';
          if (siteId) {
            const { data: site } = await supabase
              .from('sites')
              .select('name')
              .eq('id', siteId)
              .single();
            siteName = site?.name || '';
          }

          const larubotPlan = plan === 'agency' ? 'hp-bot' : plan; // lite はそのまま送る
          const larubot_base = process.env.LARUBOT_API_URL || 'https://larubot.tokyo';
          await fetch(`${larubot_base}/api/hp/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-laru-secret': process.env.LARU_HP_API_SECRET,
            },
            body: JSON.stringify({
              email: user?.email,
              plan: larubotPlan,
              site_name: siteName,
              user_id: userId,
              site_id: siteId || '',
            }),
          });
        } catch (err) {
          console.error('[LARUbot register] failed:', err);
          // Non-fatal: LARUbot will retry or callback handles public_id later
        }
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const inv = event.data.object as unknown as Record<string, unknown>;
      const subId = (typeof inv['subscription'] === 'string' ? inv['subscription'] : (inv['subscription'] as { id?: string } | null)?.id) ?? (inv['subscription_id'] as string | null);
      if (!subId) break;

      await supabase.from('profiles')
        .update({ subscription_status: 'active' })
        .eq('stripe_subscription_id', subId);
      break;
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as unknown as Record<string, unknown>;
      const subId = (typeof inv['subscription'] === 'string' ? inv['subscription'] : (inv['subscription'] as { id?: string } | null)?.id) ?? (inv['subscription_id'] as string | null);
      if (!subId) break;

      await supabase.from('profiles')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_subscription_id', subId);

      // 支払い失敗メール
      const { data: failedProfile } = await supabase.from('profiles').select('id').eq('stripe_subscription_id', subId).single();
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
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">ご不明な点は <a href="mailto:support@laruvisona.jp" style="color:#0ea5e9;text-decoration:none">support@laruvisona.jp</a> までどうぞ</p>
    </div>
  </div>
</body></html>`);
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
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
      await supabase.from('profiles').update(updates).eq('stripe_subscription_id', sub.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      // stripe_customer_id は変わらないので先に取得
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      const { data: canceledProfile } = customerId
        ? await supabase.from('profiles').select('id').eq('stripe_customer_id', customerId).single()
        : { data: null };

      await supabase.from('profiles')
        .update({ subscription_status: 'canceled', stripe_subscription_id: null, plan: null })
        .eq('stripe_subscription_id', sub.id);

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
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">またのご利用をお待ちしております。<br><a href="mailto:support@laruvisona.jp" style="color:#0ea5e9;text-decoration:none">support@laruvisona.jp</a></p>
    </div>
  </div>
</body></html>`);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
