import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hashPassword, signMemberToken } from '@/lib/member-auth';
import { clientIp } from '@/lib/rate-limit';
import { claimPublicRate } from '@/lib/public-rate-limit';
import { parseHpMemberSignup, readHpMemberBody } from '@/lib/hp-member-contract';

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: Request) {
  let input;
  try { input = parseHpMemberSignup(await readHpMemberBody(req)); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  if (input.honeypot) return NextResponse.json({ ok: true });
  const { siteId, email, password, name } = input;

  // 大量の会員アカウント作成でDBを埋められないように
  const supabase = admin();
  const rate = await claimPublicRate(supabase, 'member-signup', `${siteId}:${clientIp(req)}`, 5);
  if (rate === 'limited') {
    return NextResponse.json(
      { error: '登録の試行が多すぎます。しばらくしてからお試しください。' },
      { status: 429 },
    );
  }
  if (rate === 'unavailable') return NextResponse.json({ error: '登録受付を確認できませんでした' }, { status: 503 });
  const { data: site, error: siteError } = await supabase.from('sites').select('id').eq('id', siteId).eq('published', true).maybeSingle();
  if (siteError) return NextResponse.json({ error: 'サイトを確認できませんでした' }, { status: 500 });
  if (!site) return NextResponse.json({ error: 'サイトが見つかりません' }, { status: 404 });

  const emailNorm = email;
  const { data: existing, error: existingError } = await supabase.from('hp_members').select('id').eq('site_id', siteId).eq('email', emailNorm).maybeSingle();
  if (existingError) return NextResponse.json({ error: '登録状態を確認できませんでした' }, { status: 500 });
  if (existing) return NextResponse.json({ error: 'このメールは既に登録されています' }, { status: 409 });

  const { data: member, error } = await supabase.from('hp_members').insert({
    site_id: siteId,
    email: emailNorm,
    password_hash: hashPassword(password),
    name: name || null,
    plan: 'free',
    status: 'active',
  }).select('id, email, name, plan, status').single();

  if (error || !member) {
    if ((error as { code?: string })?.code === '23505') return NextResponse.json({ error: 'このメールは既に登録されています' }, { status: 409 });
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 });
  }

  const token = signMemberToken({ id: member.id, siteId, email: emailNorm });
  return NextResponse.json({ token, member: { name: member.name, plan: member.plan, status: member.status } });
}
