import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

// POST /api/sequences/execute — cron: send pending sequence emails
// Authorization: Bearer <RETENTION_SECRET>
// Sequence state stored in contacts.extra_fields as _seq_id, _seq_step, _seq_next
export async function POST(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.RETENTION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 503 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const service = await createServiceClient();
  const now = new Date();

  // Find contacts enrolled in sequences via extra_fields._seq_id
  // We fetch recently created contacts and filter in-memory since JSONB filtering varies
  const { data: contacts } = await service
    .from('contacts')
    .select('id, name, email, site_id, extra_fields, created_at')
    .not('extra_fields', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (!contacts?.length) return NextResponse.json({ sent: 0 });

  // Filter: must have _seq_id and _seq_next <= now
  const enrolled = contacts.filter(c => {
    const ef = c.extra_fields as Record<string, string> | null;
    if (!ef?._seq_id || !ef?._seq_next) return false;
    return new Date(ef._seq_next) <= now;
  });

  if (!enrolled.length) return NextResponse.json({ sent: 0, checked: contacts.length });

  let sent = 0;
  const errors: string[] = [];

  for (const contact of enrolled) {
    const ef = contact.extra_fields as Record<string, string>;
    const seqId = ef._seq_id;
    const stepIndex = parseInt(ef._seq_step || '0', 10);

    if (!contact.email || !contact.site_id || !seqId) continue;

    // Fetch sequence config
    const { data: site } = await service.from('sites').select('name, settings_json').eq('id', contact.site_id).single();
    if (!site) continue;

    const settings = (site.settings_json as Record<string, unknown>) || {};
    const sequences = (settings.sequences as Array<{
      id: string;
      name: string;
      active: boolean;
      steps: Array<{ delay: number; subject: string; body: string }>;
    }>) || [];

    const sequence = sequences.find(s => s.id === seqId);
    if (!sequence || !sequence.active) {
      // Deactivated — unenroll
      const newEf = { ...ef };
      delete newEf._seq_id;
      delete newEf._seq_step;
      delete newEf._seq_next;
      await service.from('contacts').update({ extra_fields: newEf }).eq('id', contact.id);
      continue;
    }

    const step = sequence.steps[stepIndex];
    if (!step) {
      // Completed all steps — unenroll
      const newEf = { ...ef };
      delete newEf._seq_id;
      delete newEf._seq_step;
      delete newEf._seq_next;
      await service.from('contacts').update({ extra_fields: newEf }).eq('id', contact.id);
      continue;
    }

    // Personalise body
    const body = step.body.replace(/\{\{name\}\}/g, contact.name || 'お客様');

    const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px 36px;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(0,0,0,0.05)">
    <p style="color:#0369a1;font-size:12px;font-weight:700;margin:0 0 20px;text-transform:uppercase;letter-spacing:0.05em">${site.name}</p>
    <div style="font-size:14px;color:#374151;line-height:1.8;white-space:pre-wrap">${body}</div>
    <hr style="border:none;border-top:1px solid #f1f5f9;margin:28px 0">
    <p style="font-size:11px;color:#9ca3af;margin:0">このメールは${site.name}からお送りしています</p>
  </div>
</body>
</html>`;

    const { error } = await resend.emails.send({
      from: `${site.name} <noreply@laruvisona.jp>`,
      to: contact.email,
      subject: step.subject,
      html,
    });

    if (error) {
      errors.push(`${contact.email}: ${error.message}`);
      continue;
    }

    // Advance to next step or unenroll
    const nextStep = stepIndex + 1;
    if (nextStep < sequence.steps.length) {
      const nextDelay = sequence.steps[nextStep].delay;
      const nextSendAt = new Date(now.getTime() + nextDelay * 3_600_000).toISOString();
      await service.from('contacts').update({
        extra_fields: { ...ef, _seq_step: String(nextStep), _seq_next: nextSendAt },
      }).eq('id', contact.id);
    } else {
      const newEf = { ...ef };
      delete newEf._seq_id;
      delete newEf._seq_step;
      delete newEf._seq_next;
      await service.from('contacts').update({ extra_fields: newEf }).eq('id', contact.id);
    }

    sent++;
  }

  return NextResponse.json({ sent, errors, checked: contacts.length, enrolled: enrolled.length });
}
