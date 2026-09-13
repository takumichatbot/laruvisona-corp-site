import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const profile = await admin.from('profiles').select('stripe_customer_id, stripe_subscription_id').eq('id', user.id).maybeSingle();
  if (profile.error) return NextResponse.json({ error: '契約状態を確認できませんでした' }, { status: 503 });
  if (profile.data?.stripe_customer_id || profile.data?.stripe_subscription_id) {
    try {
      const subscriptions = profile.data.stripe_customer_id
        ? (await stripe.subscriptions.list({ customer: profile.data.stripe_customer_id, status: 'all', limit: 100 })).data
        : [await stripe.subscriptions.retrieve(profile.data.stripe_subscription_id!)];
      if (subscriptions.some(subscription => !['canceled', 'incomplete_expired'].includes(subscription.status))) {
        return NextResponse.json({ error: 'active_subscription', message: '先に契約の解約を完了してください' }, { status: 409 });
      }
    } catch {
      return NextResponse.json({ error: '契約状態を確認できませんでした' }, { status: 503 });
    }
  }

  // auth.users の削除から外部キーの cascade でプロフィールとサイトを消す。
  const deleted = await admin.auth.admin.deleteUser(user.id);
  if (deleted.error) return NextResponse.json({ error: 'アカウントを削除できませんでした' }, { status: 503 });

  return NextResponse.json({ ok: true });
}
