// DomainStore の実装。
//
// 読み取りは利用者のセッション（RLSが効く）、状態の書き換えは service role で
// security definer の関数を呼ぶ。関数は service_role にしか実行権限が無いので、
// 利用者の資格情報でPostgRESTから直接叩くことはできない。
//
// 所有者の確認は、書き込みの前に必ず利用者のセッション側で行う
// （service role は RLS を素通りするため、ここを飛ばすと他人のサイトを触れる）。

import { createClient, createServiceClient } from '@/lib/supabase/server';
import type {
  DomainStore, DomainRecord, OwnedSite, ApplyCheckInput, ApplyCheckResult,
} from '@/lib/domain-service';
import type { DomainStatus } from '@/lib/domain';

const COLS = 'id, site_id, host, status, verification_token, render_domain_id, last_error, last_checked_at';

type Rpc = { ok?: boolean; reason?: string; switched?: boolean; row?: DomainRecord };

export async function createDomainStore(): Promise<DomainStore> {
  const user = await createClient();
  const admin = createServiceClient();

  async function rpc(name: string, args: Record<string, unknown>): Promise<{ data: Rpc | null; error: string | null }> {
    const { data, error } = await admin.rpc(name, args);
    if (error) return { data: null, error: error.message };
    return { data: (data ?? null) as Rpc | null, error: null };
  }

  return {
    async getOwnedSite(siteId, userId): Promise<OwnedSite | null> {
      const { data } = await user
        .from('sites')
        .select('id, custom_domain')
        .eq('id', siteId)
        .eq('user_id', userId)
        .maybeSingle();
      return (data as OwnedSite | null) ?? null;
    },

    async listDomains(siteId): Promise<DomainRecord[]> {
      const { data } = await user
        .from('site_domains')
        .select(COLS)
        .eq('site_id', siteId)
        .order('created_at', { ascending: true });
      return (data ?? []) as DomainRecord[];
    },

    async getDomain(siteId, host): Promise<DomainRecord | null> {
      const { data } = await user
        .from('site_domains')
        .select(COLS)
        .eq('site_id', siteId)
        .eq('host', host)
        .maybeSingle();
      return (data as DomainRecord | null) ?? null;
    },

    async addDomain(siteId, host, token) {
      const { data, error } = await admin
        .from('site_domains')
        .insert({ site_id: siteId, host, status: 'pending_ownership' as DomainStatus, verification_token: token })
        .select(COLS)
        .single();
      if (error) {
        // 23505 = unique違反。別サイトが先に押さえている（同時登録もここに来る）
        if ((error as { code?: string }).code === '23505') return { ok: false as const, reason: 'taken' as const };
        return { ok: false as const, reason: 'error' as const, message: error.message };
      }
      return { ok: true as const, row: data as DomainRecord };
    },

    async applyCheck(input: ApplyCheckInput): Promise<ApplyCheckResult> {
      const { data, error } = await rpc('laruhp_domain_apply_check', {
        p_site_id: input.siteId,
        p_host: input.host,
        p_fencing_token: input.fencingToken,
        p_status: input.status,
        p_render_domain_id: input.renderDomainId,
        p_last_error: input.lastError,
        p_make_primary: input.makePrimary,
      });
      if (error) return { ok: false, reason: 'error', message: error };
      if (!data?.ok) return { ok: false, reason: data?.reason === 'gone' ? 'gone' : 'error' };
      return { ok: true, switched: !!data.switched };
    },

    async setPrimary(siteId, host, fencingToken) {
      const { data, error } = await rpc('laruhp_domain_set_primary', {
        p_site_id: siteId, p_host: host, p_fencing_token: fencingToken,
      });
      if (error) return { ok: false as const, reason: 'error' as const, message: error };
      if (!data?.ok) {
        const reason = data?.reason === 'not_connected' ? 'not_connected' as const
          : data?.reason === 'gone' ? 'gone' as const : 'error' as const;
        return { ok: false as const, reason };
      }
      return { ok: true as const };
    },

    async beginRelease(siteId, host) {
      const { data, error } = await rpc('laruhp_domain_begin_release', { p_site_id: siteId, p_host: host });
      if (error) return { ok: false as const, reason: 'error' as const, message: error };
      if (!data?.ok || !data.row) {
        return { ok: false as const, reason: data?.reason === 'gone' ? 'gone' as const : 'error' as const };
      }
      return { ok: true as const, row: data.row };
    },

    async finishRelease(siteId, host, fencingToken) {
      const { data, error } = await rpc('laruhp_domain_finish_release', {
        p_site_id: siteId, p_host: host, p_fencing_token: fencingToken,
      });
      if (error) return { ok: false, message: error };
      if (!data?.ok) return { ok: false, message: data?.reason ?? 'unknown' };
      return { ok: true };
    },

    async markReleaseFailed(siteId, host, message) {
      await rpc('laruhp_domain_mark_release_failed', { p_site_id: siteId, p_host: host, p_message: message });
    },
  };
}
