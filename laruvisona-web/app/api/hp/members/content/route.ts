import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyMemberToken } from '@/lib/member-auth';
import { renderMarkdown } from '@/lib/markdown';
import { findBlock } from '@/lib/site-blocks';

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: Request) {
  const { siteId, blockId, token } = await req.json().catch(() => ({}));
  if (!siteId || !blockId || !token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const payload = verifyMemberToken(token);
  if (!payload || payload.sid !== siteId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  const supabase = admin();
  const { data: member } = await supabase
    .from('hp_members')
    .select('id, plan, status')
    .eq('id', payload.mid)
    .eq('site_id', siteId)
    .maybeSingle();
  if (!member || member.status !== 'active') return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  const { data: site } = await supabase.from('sites').select('blocks_json').eq('id', siteId).single();
  const block = site ? findBlock(site.blocks_json, blockId, 'member-gate') : null;
  if (!block) return NextResponse.json({ error: 'コンテンツが見つかりません' }, { status: 404 });

  const data = block.data || {};
  const requirePaid = !!data.requirePaid;
  if (requirePaid && member.plan !== 'paid') {
    return NextResponse.json({ error: 'paid_required', needsUpgrade: true }, { status: 403 });
  }

  return NextResponse.json({ html: renderMarkdown(String(data.content || '')), plan: member.plan });
}
