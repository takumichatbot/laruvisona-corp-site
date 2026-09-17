import { NextResponse } from 'next/server';
import { makeSiteSlug } from '@/lib/site-slug';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { siteCreationAccess } from '@/lib/site-creation-access';
import { readSiteCreate } from '@/lib/site-write-contract';

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

  if (error) return NextResponse.json({ error: 'サイトを読み込めませんでした' }, { status: 503 });
  return NextResponse.json({ sites: data });
}

// POST /api/sites — create new site
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Plan limit check
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, subscription_status')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'ご契約を確認できませんでした' }, { status: 503 });
  }

  const plan = profile?.plan as string | null;
  const subStatus = profile?.subscription_status as string | null;

  const access = siteCreationAccess(user.email, plan, subStatus,
    [process.env.ADMIN_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]);
  if (!access.allowed) {
    return NextResponse.json(
      { error: 'サブスクリプションが必要です。プランを選択してください。', code: 'no_plan' },
      { status: 403 }
    );
  }

  let input;
  try { input = await readSiteCreate(req); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }

  // 公開URLに入る値。決まりは lib/site-slug.ts にだけ置く。
  // ここで独自に組むと、直す側（PATCH）の決まりと食い違い、
  // 「生まれた時点で、直す側では通らない値」ができる。実際そうなっていた。
  const slug = makeSiteSlug(input.name);

  const result = await createServiceClient().rpc('laruhp_create_site', {
    p_user: user.id,
    p_limit: access.limit,
    p_name: input.name,
    p_slug: slug,
    p_industry: input.industry,
    p_blocks: input.blocks,
    p_seo: input.seo,
    p_settings: input.settings,
  });
  if (result.error || !result.data || typeof result.data !== 'object') {
    return NextResponse.json({ error: 'サイトを作成できませんでした' }, { status: 503 });
  }
  const outcome = result.data as { ok?: boolean; reason?: string; site?: unknown; count?: number; limit?: number };
  if (!outcome.ok && outcome.reason === 'site_limit') {
    return NextResponse.json({
      error: `現在のプラン（${plan}）ではサイトを${access.limit}件まで作成できます。プランをアップグレードしてください。`,
      code: 'site_limit', limit: access.limit, current: outcome.count,
    }, { status: 403 });
  }
  if (!outcome.ok || !outcome.site) return NextResponse.json({ error: 'サイトを作成できませんでした' }, { status: 503 });

  /*
    契約のときに預かった LARUbot / LARUSEO の識別子を、このサイトへ移す。

    料金ページから契約した人は、契約の時点でまだサイトが無い。
    そのとき発行された public_id は、以前は**どこにも残らず消えていた**
    （lib/larubot-provision.ts に経緯を書いた）。識別子が無いと埋め込みタグが
    出ないので、「毎週AIがSEO記事を自動公開」が契約した日から動かない。

    移せなくてもサイトの作成は成功として返す。サイトはもう出来ているので、
    ここで失敗を返すと「作れなかった」と思わせるほうの混乱になる。
    ただし**黙らない。**
  */
  const created = outcome.site as { id?: string };
  if (created.id) {
    try {
      const svc = createServiceClient();
      const held = await svc.from('profiles')
        .select('pending_larubot_public_id, pending_laruseo_public_id').eq('id', user.id).maybeSingle();
      /*
        列がまだ無いと、PostgREST はこの問い合わせを**丸ごと**失敗させる。
        例外ではなく error が返るので、見ないと黙って「預けた分は無い」に
        なってしまう。まさに直している型の失敗なので、ここで見る。
        （supabase/profiles_pending_larubot.sql を実行する）
      */
      if (held.error) {
        console.error('[larubot] held public ids could not be read:', user.id, held.error.message);
      }
      const bot = held.data?.pending_larubot_public_id as string | null | undefined;
      const seoId = held.data?.pending_laruseo_public_id as string | null | undefined;
      if (bot || seoId) {
        await svc.from('sites').update({
          settings_json: {
            ...(input.settings as Record<string, unknown>),
            ...(bot ? { larubotPublicId: bot, larubot: true } : {}),
            ...(seoId ? { laruseoPublicId: seoId, laruseo: true } : {}),
          },
        }).eq('id', created.id).eq('user_id', user.id);
        // 移したら空にする。残すと2件目のサイトにも同じ識別子が入る。
        await svc.from('profiles')
          .update({ pending_larubot_public_id: null, pending_laruseo_public_id: null })
          .eq('id', user.id);
      }
    } catch (e) {
      // 列がまだ無い場合もここに来る（supabase/profiles_pending_larubot.sql を実行する）
      console.error('[larubot] held public ids not applied to new site:', created.id, (e as Error)?.message);
    }
  }

  return NextResponse.json({ site: outcome.site }, { status: 201 });
}
