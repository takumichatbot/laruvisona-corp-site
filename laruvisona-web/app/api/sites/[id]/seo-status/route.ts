import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchLarubotStatus, seoDisplayState, SEO_STATE_LABEL } from '@/lib/larubot-seo';

/**
 * そのサイトの LARUSEO の様子を返す。
 *
 * ⚠️ **数えているのはこちらではない。** 記事数も未使用キーワードも枠も、
 * すべて LARUbot の `GET /api/hp/status?public_id=…` が返す値をそのまま渡す。
 * こちらに独自のSEO用テーブルも監視も持たない（2026-09-18 の取り決め）。
 *
 * 呼ぶのは管理画面を開いたときと、登録の直後だけ。ポーリングしない。
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 自分のサイトだけ。他人のサイトの状態は返さない。
  const { data: site, error } = await supabase.from('sites')
    .select('settings_json').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: '状態を確認できませんでした' }, { status: 503 });
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const settings = (site.settings_json ?? {}) as Record<string, unknown>;
  const publicId = typeof settings.laruseoPublicId === 'string' ? settings.laruseoPublicId
    : typeof settings.larubotPublicId === 'string' ? settings.larubotPublicId : '';
  if (!publicId) {
    return NextResponse.json({ linked: false, state: 'unknown', label: SEO_STATE_LABEL.unknown });
  }

  const body = await fetchLarubotStatus(publicId);
  if (!body) {
    // 届かなかったことを、届いて0件だったことと混ぜない。
    return NextResponse.json({ linked: true, state: 'unknown', label: '確認できませんでした', reachable: false }, { status: 200 });
  }
  const seo = (body.seo ?? null) as Record<string, unknown> | null;
  const state = seoDisplayState(seo);
  return NextResponse.json({ linked: true, reachable: true, state, label: SEO_STATE_LABEL[state], seo });
}
