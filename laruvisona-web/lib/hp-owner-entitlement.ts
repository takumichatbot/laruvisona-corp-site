import type { SupabaseClient } from '@supabase/supabase-js';
import { laruEntitlement, type LaruEntitlement } from '@/lib/laru-entitlement';
import { isAdminEmail } from '@/lib/adminAuth';

/**
 * 公開サイトの持ち主の今の契約から、LARUbot（チャット）と LARU SEO（記事）を出してよいかを決める。
 * 公開ページ（app/hp/[slug]/page.tsx）・記事ページ・サイトマップが同じ判定を使う
 * （以前は公開ページの中にだけあった。判定を増やさず、ここへ移しただけ）。
 * 運営のアカウント（契約なしで公開を許している）は確認用に両方出す。
 */
export async function ownerLaruEntitlement(supabase: SupabaseClient, userId: string | null): Promise<LaruEntitlement> {
  if (!userId) return { bot: false, seo: false };
  try {
    const { data: profile, error } = await supabase
      .from('profiles').select('plan, subscription_status').eq('id', userId).maybeSingle();
    if (error) {
      console.error('[hp] 持ち主の契約を読めないため、LARUbot / LARU SEO を出しません:', userId);
      return { bot: false, seo: false };
    }
    const byPlan = laruEntitlement(profile?.plan ?? null, profile?.subscription_status ?? null);
    if (byPlan.bot && byPlan.seo) return byPlan;
    const { data } = await supabase.auth.admin.getUserById(userId);
    return isAdminEmail(data?.user?.email) ? laruEntitlement(null, null, true) : byPlan;
  } catch {
    return { bot: false, seo: false };
  }
}
