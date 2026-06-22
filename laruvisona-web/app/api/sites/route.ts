import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSiteLimit } from '@/lib/plan-limits';

// GET /api/sites — list user's sites
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('sites')
    .select('id, name, slug, industry, published, created_at, updated_at, view_count, custom_domain, settings_json')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sites: data });
}

// POST /api/sites — create new site
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Plan limit check
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, subscription_status')
    .eq('id', user.id)
    .single();

  const plan = profile?.plan as string | null;
  const subStatus = profile?.subscription_status as string | null;

  if (!plan || (subStatus && subStatus !== 'active' && subStatus !== 'trialing')) {
    return NextResponse.json(
      { error: 'サブスクリプションが必要です。プランを選択してください。', code: 'no_plan' },
      { status: 403 }
    );
  }

  const limit = getSiteLimit(plan);
  const { count } = await supabase
    .from('sites')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      {
        error: `現在のプラン（${plan}）ではサイトを${limit}件まで作成できます。プランをアップグレードしてください。`,
        code: 'site_limit',
        limit,
        current: count,
      },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { name, industry, blocks_json, seo_json, settings_json } = body;

  // Generate unique slug from name
  const baseSlug = (name || 'my-site')
    .toLowerCase()
    .replace(/[^a-z0-9ぁ-ん一-龯]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const { data, error } = await supabase
    .from('sites')
    .insert({
      user_id: user.id,
      name: name || 'マイサイト',
      slug,
      industry: industry || null,
      blocks_json: blocks_json || [],
      seo_json: seo_json || { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '' },
      settings_json: settings_json || {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: data }, { status: 201 });
}
