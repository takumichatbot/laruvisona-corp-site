import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 公開サイトのページビューを訪問ごとに記録する軽量エンドポイント。
// ISRキャッシュの公開ページからクライアント側で叩くことで、正確にカウントする。
function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: Request) {
  try {
    const { slug, domain } = await req.json().catch(() => ({}));
    const db = service();
    if (slug) {
      await db.rpc('increment_view_count', { site_slug: String(slug) });
    } else if (domain) {
      await db.rpc('increment_view_count_by_domain', { site_domain: String(domain) });
    } else {
      return NextResponse.json({ error: 'slug or domain required' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
