import { NextResponse } from 'next/server';
import { POST as sendDigest } from '@/app/api/digest/send/route';
import { requireBearer } from '@/lib/scheduled-email';

// Compatibility endpoint for an existing external weekly cron. Delivery is delegated
// to the same ledger-backed digest worker, so two schedulers cannot send twice.
export async function GET(req: Request) {
  if (!requireBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.RETENTION_SECRET) {
    return NextResponse.json({ error: 'RETENTION_SECRET not configured' }, { status: 503 });
  }
  return sendDigest(new Request(req.url, {
    method: 'POST', headers: { authorization: `Bearer ${process.env.RETENTION_SECRET}` },
  }));
}
