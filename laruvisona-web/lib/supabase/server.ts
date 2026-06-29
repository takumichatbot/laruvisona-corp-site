import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// Service role クライアント（RLSをバイパス）。Stripe webhook 等の cookie が無い
// サーバー処理用。cookie版(ssr)だとユーザーセッションが混ざり service role として
// 効かず、RLS が UPDATE をブロックして「200なのにprofiles未更新」になるため、
// 必ず supabase-js の createClient を使う。
// 注: 同期関数だが、既存の `await createServiceClient()` 呼び出しはそのまま有効。
export function createServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
