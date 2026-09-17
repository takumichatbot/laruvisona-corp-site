import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';

const EVENT_MAP: Record<string, string> = {
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.delivery_delayed': 'delayed',
};

/**
 * 問い合わせの通知メールが、実際にどうなったか。
 *
 * 2026-09-17: 店主あての通知が2回とも届かなかったのに、記録は「成功」だった。
 * 送った側が持っているのは「配信会社が受け付けた」までで、
 * **届いたかどうかは、あとから知らせてもらう以外に知る方法が無い。**
 * 知らせが来ない＝届いていない、が誰にも見えないのがいちばん困る。
 */
const CONTACT_EVENT: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

/** 控え番号から問い合わせを引き当て、その通知の状態を書き換える。 */
async function recordContactDelivery(
  service: ReturnType<typeof createServiceClient>,
  emailId: string,
  state: string,
): Promise<'recorded' | 'not-a-contact' | 'write-failed'> {
  for (const channel of ['owner_email', 'customer_email'] as const) {
    const { data } = await service
      .from('contacts')
      .select('id, extra_fields')
      .eq(`extra_fields->>${channel}_id`, emailId)
      .limit(1)
      .maybeSingle();
    if (!data) continue;
    const extra = (data.extra_fields || {}) as Record<string, unknown>;
    /*
      書けたかを確かめる。

      以前は結果を見ずに true を返していた。書けていなくても 200 を返すので
      Resend は再送しない。問い合わせ一覧は「送信を受け付けました（到着は未確認）」
      のまま**永久に止まる。**

      いちばん困るのは bounced（宛先から戻ってきた）のとき。
      店主は「まだ返事が来ないだけ」と思って待ち続ける。
      実際にはメールが一通も届いていない。
    */
    const saved = await service.from('contacts').update({
      extra_fields: { ...extra, [`${channel}_status`]: state },
    }).eq('id', data.id);
    if (saved.error) {
      console.error('[Resend webhook] status not recorded:', data.id, channel, state, saved.error.message);
      return 'write-failed';
    }
    return 'recorded';
  }
  /*
    「この受付ではなかった」と「書けなかった」を、同じ値で返さない。

    同じにすると、書けなかったときに次の処理（ニュースレター側）へ流れ、
    そこで 200 を返してしまう。Resend は再送しない。
    **書けなかったことが、どこにも残らない。**
  */
  return 'not-a-contact';
}

export async function POST(req: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 });
  if (Number(req.headers.get('content-length')) > 100_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  const payload = await req.text();
  if (Buffer.byteLength(payload) > 100_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });

  let event;
  try {
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload,
      headers: {
        id: req.headers.get('svix-id') || '',
        timestamp: req.headers.get('svix-timestamp') || '',
        signature: req.headers.get('svix-signature') || '',
      },
      webhookSecret,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (!('email_id' in event.data) || !event.data.email_id) return NextResponse.json({ ok: true });
  const emailId = event.data.email_id;
  const service = createServiceClient();

  // 問い合わせの通知メールなら、そこへ書いて終わり。
  const contactState = CONTACT_EVENT[event.type];
  if (contactState) {
    const result = await recordContactDelivery(service, emailId, contactState);
    if (result === 'recorded') return NextResponse.json({ ok: true });
    // 書けなかったときは 500。Resend が再送してくれるので、次で入る。
    if (result === 'write-failed') {
      return NextResponse.json({ error: 'Delivery status could not be recorded' }, { status: 500 });
    }
    // not-a-contact のときだけ、ニュースレター側へ進む
  }

  const eventType = EVENT_MAP[event.type];
  if (!eventType) return NextResponse.json({ ok: true });
  const { data: sent, error: sentError } = await service.from('newsletter_email_events')
    .select('campaign_id,recipient_email').eq('resend_email_id', emailId).eq('event_type', 'sent').single();
  if (sentError?.code === 'PGRST116') return NextResponse.json({ ok: true });
  if (sentError) return NextResponse.json({ error: 'Delivery could not be located' }, { status: 500 });
  if (!sent) return NextResponse.json({ ok: true });

  const { error: eventError } = await service.from('newsletter_email_events').upsert({
    campaign_id: sent.campaign_id,
    resend_email_id: emailId,
    recipient_email: sent.recipient_email,
    event_type: eventType,
  }, { onConflict: 'resend_email_id,event_type', ignoreDuplicates: true });
  if (eventError) return NextResponse.json({ error: 'Event could not be recorded' }, { status: 500 });

  if (eventType === 'opened' || eventType === 'clicked') {
    const column = eventType === 'opened' ? 'open_count' : 'click_count';
    const { count, error: countError } = await service.from('newsletter_email_events')
      .select('*', { count: 'exact', head: true }).eq('campaign_id', sent.campaign_id).eq('event_type', eventType);
    if (countError) return NextResponse.json({ error: 'Aggregate could not be counted' }, { status: 500 });
    const { data: updated, error: updateError } = await service.from('newsletter_campaigns')
      .update({ [column]: count ?? 0 }).eq('id', sent.campaign_id).select('id');
    if (updateError || updated?.length !== 1) return NextResponse.json({ error: 'Aggregate could not be updated' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
