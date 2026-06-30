import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

function fmtJst(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${jst.getUTCFullYear()}/${p(jst.getUTCMonth() + 1)}/${p(jst.getUTCDate())}(${days[jst.getUTCDay()]}) ${p(jst.getUTCHours())}:${p(jst.getUTCMinutes())}`;
}

// 予約のメールリマインダー（日次cronから呼ぶ）。
// 翌日（〜36h以内）の確定予約で未送信のものにメールを送る。
export async function POST(req: Request) {
  if (!process.env.RETENTION_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.RETENTION_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: true, skipped: 'no RESEND_API_KEY' });

  const supabase = admin();
  const now = Date.now();
  const until = new Date(now + 36 * 3600 * 1000).toISOString();

  const { data: rows } = await supabase
    .from('hp_reservations')
    .select('id, site_id, name, email, service, slot_datetime, reminded')
    .eq('status', 'confirmed')
    .eq('reminded', false)
    .gt('slot_datetime', new Date(now).toISOString())
    .lt('slot_datetime', until);

  if (!rows || rows.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const siteNameCache = new Map<string, string>();
  let sent = 0;

  for (const r of rows) {
    if (!r.email) continue;
    let siteName = siteNameCache.get(r.site_id) || '';
    if (!siteName) {
      const { data: s } = await supabase.from('sites').select('name').eq('id', r.site_id).single();
      siteName = (s?.name as string) || 'ご予約';
      siteNameCache.set(r.site_id, siteName);
    }
    try {
      await resend.emails.send({
        from: `${siteName} <noreply@laruvisona.jp>`,
        to: r.email,
        subject: `【${siteName}】ご予約リマインダー`,
        html: `<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#0f172a;font-size:18px">ご予約のリマインダー</h2>
          <p style="color:#475569;font-size:14px;line-height:1.7">${r.name} 様<br>まもなくご予約のお時間です。お間違いのないようお願いいたします。</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:16px 0">
            ${r.service ? `<p style="margin:0 0 6px;font-size:14px;color:#1e293b"><b>メニュー:</b> ${r.service}</p>` : ''}
            <p style="margin:0;font-size:14px;color:#1e293b"><b>日時:</b> ${fmtJst(r.slot_datetime)}</p>
          </div>
          <p style="color:#94a3b8;font-size:12px">ご変更・キャンセルはお早めにご連絡ください。</p>
        </div>`,
      });
      await supabase.from('hp_reservations').update({ reminded: true }).eq('id', r.id);
      sent++;
    } catch (e) {
      console.error('[booking/reminders] failed for', r.id, (e as Error)?.message);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
