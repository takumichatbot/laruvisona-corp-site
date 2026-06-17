import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  return user.email === process.env.ADMIN_EMAIL;
}

export async function GET() {
  const supabase = await createClient();
  if (!await isAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = await createServiceClient();

  const [authUsers, profilesRes, sitesRes] = await Promise.all([
    service.auth.admin.listUsers({ perPage: 1000 }),
    service.from('profiles').select('*'),
    service.from('sites').select('user_id'),
  ]);

  const profileMap = new Map((profilesRes.data ?? []).map(p => [p.id, p]));
  const siteCountMap = new Map<string, number>();
  for (const s of sitesRes.data ?? []) {
    siteCountMap.set(s.user_id, (siteCountMap.get(s.user_id) ?? 0) + 1);
  }

  const users = (authUsers.data?.users ?? []).map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    ...profileMap.get(u.id),
    site_count: siteCountMap.get(u.id) ?? 0,
  }));

  return NextResponse.json({ users });
}
