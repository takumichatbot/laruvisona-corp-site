import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { finalizeBooking } from '@/lib/booking-finalize';
import { Resend } from 'resend';
import type Stripe from 'stripe';

const PLAN_LABEL: Record<string, string> = {
  hp: 'HP単体 (¥999/月)',
  'hp-bot': 'HP + LARUbot (¥4,980/月)',
  'hp-bot-seo': 'HP + Bot + SEO (¥9,800/月)',
  agency: 'エージェンシー (¥19,800/月)',
  lite: 'HP + LARUbot Lite (¥4,980/月)',
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

      // 時間枠予約の事前決済（mode=payment）: 仮押さえ→確定＋通知
      const bmeta = (session.metadata || {}) as Record<string, string>;
      if (session.mode === 'payment' && bmeta.kind === 'booking') {
        const reservationId = bmeta.reservation_id;
        if (reservationId) {
          const { data: resv } = await supabase
            .from('hp_reservations')
            .select('*')
            .eq('id', reservationId)
            .single();
          if (resv && resv.status !== 'confirmed') {
            await supabase.from('hp_reservations').update({ status: 'confirmed' }).eq('id', reservationId);
            await finalizeBooking({
              baseUrl: process.env.NEXT_PUBLIC_APP_URL || '',
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
          }
        }
        break;
      }

      // ショップ購入（mode=payment, kind=shop）: 在庫を減算しオーナーへ注文通知
      if (session.mode === 'payment' && bmeta.kind === 'shop') {
        const shopSiteId = bmeta.laru_site_id;
        if (shopSiteId) {
          let cart: Array<{ id: string; v?: string; q: number }> = [];
          try { if (bmeta.laru_cart) cart = JSON.parse(bmeta.laru_cart); } catch {}
          if (!cart.length && bmeta.laru_product_id) cart = [{ id: bmeta.laru_product_id, q: 1 }];

          const { data: shopSite } = await supabase
            .from('sites')
            .select('name, user_id, settings_json')
            .eq('id', shopSiteId)
            .single();
          if (shopSite) {
            const settings = (shopSite.settings_json as Record<string, unknown>) || {};
            const products = (settings.products as Array<{ id: string; name: string; stock: number | null; variants?: Array<{ id: string; name: string; stock: number | null }> }>) || [];
            const orderLines: string[] = [];
            let changed = false;
            for (const c of cart) {
              const p = products.find(pp => pp.id === c.id);
              if (!p) continue;
              const variant = c.v ? p.variants?.find(vv => vv.id === c.v) : undefined;
              orderLines.push(`${p.name}${variant ? `（${variant.name}）` : ''} × ${c.q}`);
              if (variant) {
                if (variant.stock !== null && variant.stock !== undefined) { variant.stock = Math.max(0, variant.stock - c.q); changed = true; }
              } else if (p.stock !== null && p.stock !== undefined) {
                p.stock = Math.max(0, p.stock - c.q); changed = true;
              }
            }
            if (changed) {
              await supabase.from('sites').update({ settings_json: { ...settings, products } }).eq('id', shopSiteId);
            }
            const { data: { user: owner } } = await supabase.auth.admin.getUserById(shopSite.user_id);
            const toEmail = (settings.notifyEmail as string) || owner?.email;
            if (toEmail) {
              const amount = session.amount_total ? `¥${session.amount_total.toLocaleString()}` : '';
              await sendEmail(
                toEmail,
                `【ご注文】${shopSite.name} — 新しい注文が入りました`,
                `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px">
                  <h2 style="color:#0f172a">🛍️ 新しいご注文</h2>
                  <table style="width:100%;border-collapse:collapse;margin:16px 0">
                    ${orderLines.map(l => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${l}</td></tr>`).join('')}
                  </table>
                  <p style="font-size:18px;font-weight:700;color:#0369a1">合計: ${amount}</p>
                  <p style="color:#475569;font-size:14px">購入者メール: ${session.customer_details?.email || '—'}</p>
                </div>`
              );
            }
          }
        }
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
          const sub = await stripe.subscriptions.retrieve(subId) as unknown as { current_period_start: number; current_period_end: number };
          if (sub.current_period_start) contractStart = new Date(sub.current_period_start * 1000);
          if (sub.current_period_end) contractEnd = new Date(sub.current_period_end * 1000);
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
      const subRaw = inv['subscription'];
      const subId = typeof subRaw === 'string' ? subRaw : (subRaw as { id?: string } | null)?.id ?? (inv['subscription_id'] as string | null);
      if (!subId) break;

      // Update contract_ends_at based on the latest invoice period_end
      const updates: Record<string, unknown> = { subscription_status: 'active' };
      const lines = inv['lines'] as { data?: Array<{ period?: { end?: number } }> } | undefined;
      if (lines?.data?.[0]?.period?.end) {
        updates.contract_ends_at = new Date(lines.data[0].period.end! * 1000).toISOString();
      }
      await supabase.from('profiles').update(updates).eq('stripe_subscription_id', subId);
      break;
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as unknown as Record<string, unknown>;
      const subRaw2 = inv['subscription'];
      const subId = typeof subRaw2 === 'string' ? subRaw2 : (subRaw2 as { id?: string } | null)?.id ?? (inv['subscription_id'] as string | null);
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

      // プラン変更確認メール (アクティブ時のみ)
      if (updatedPlan && (sub.status === 'active' || sub.status === 'trialing')) {
        const { data: upgProfile } = await supabase.from('profiles').select('id').eq('stripe_subscription_id', sub.id).single();
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
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">ご不明な点は <a href="mailto:support@laruvisona.jp" style="color:#0ea5e9;text-decoration:none">support@laruvisona.jp</a> までどうぞ</p>
    </div>
  </div>
</body></html>`);
          }
        }
      }
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
