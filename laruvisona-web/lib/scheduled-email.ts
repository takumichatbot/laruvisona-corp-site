import type { SupabaseClient } from '@supabase/supabase-js';
import { verifySharedSecret } from './shared-secret';

export function requireBearer(req: Request, value: string | undefined) {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return verifySharedSecret(bearer, value);
}

export function escapeEmailHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]!);
}

export function jstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function isoWeekKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const y = Number(parts.find(p => p.type === 'year')?.value);
  const m = Number(parts.find(p => p.type === 'month')?.value);
  const d = Number(parts.find(p => p.type === 'day')?.value);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function claimScheduledEmail(service: SupabaseClient, profileId: string, kind: string, periodKey: string) {
  const claim = await service.rpc('hp_claim_scheduled_email', {
    p_profile_id: profileId, p_kind: kind, p_period_key: periodKey,
  });
  if (claim.error) throw new Error(`delivery claim failed: ${claim.error.message}`);
  return claim.data?.[0] as { delivery_id: string; claim_token: string; attempts: number } | undefined;
}

export async function finishScheduledEmail(
  service: SupabaseClient,
  claim: { delivery_id: string; claim_token: string },
  success: boolean,
  providerId?: string,
  error?: string,
) {
  const finished = await service.rpc('hp_finish_scheduled_email', {
    p_delivery_id: claim.delivery_id,
    p_claim_token: claim.claim_token,
    p_success: success,
    p_provider_id: providerId || null,
    p_error: error || null,
  });
  if (finished.error || finished.data !== true) throw new Error('delivery finish failed');
}
