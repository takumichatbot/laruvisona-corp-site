import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const adminEmail = process.env.ADMIN_EMAIL;
  return adminEmail ? user.email === adminEmail : false;
}

export async function GET() {
  const supabase = await createClient();
  if (!await isAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = await createServiceClient();

  const [
    { count: totalUsers },
    { count: activeUsers },
    { count: pastDueUsers },
    { count: totalSites },
    { count: publishedSites },
  ] = await Promise.all([
    service.from('profiles').select('*', { count: 'exact', head: true }),
    service.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    service.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'past_due'),
    service.from('sites').select('*', { count: 'exact', head: true }),
    service.from('sites').select('*', { count: 'exact', head: true }).eq('published', true),
  ]);

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    activeUsers: activeUsers ?? 0,
    pastDueUsers: pastDueUsers ?? 0,
    totalSites: totalSites ?? 0,
    publishedSites: publishedSites ?? 0,
    mrr: (activeUsers ?? 0) * 999,
  });
}
