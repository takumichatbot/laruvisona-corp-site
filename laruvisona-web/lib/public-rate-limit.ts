import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PublicRateResult = 'allowed' | 'limited' | 'unavailable';

export async function claimPublicRate(
  db: SupabaseClient,
  scope: string,
  identity: string,
  limit: number,
): Promise<PublicRateResult> {
  const secret = process.env.PUBLIC_RATE_LIMIT_SECRET || process.env.ADMIN_SECRET || '';
  if (!secret || !/^[a-z0-9-]{1,40}$/.test(scope) || !identity || limit < 1 || limit > 1000) {
    return 'unavailable';
  }
  const keyHash = createHmac('sha256', secret).update(`${scope}\0${identity}`).digest('hex');
  const result = await db.rpc('laruhp_public_claim_rate', {
    p_key_hash: keyHash,
    p_scope: scope,
    p_limit: limit,
  });
  if (result.error || typeof result.data !== 'boolean') return 'unavailable';
  return result.data ? 'allowed' : 'limited';
}
