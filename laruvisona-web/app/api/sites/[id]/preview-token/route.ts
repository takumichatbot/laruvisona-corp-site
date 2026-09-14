import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function changePreviewToken(supabase: Supabase, id: string, userId: string, mode: 'issue' | 'revoke') {
  const token = mode === 'issue' ? crypto.randomUUID() : null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, settings_json, updated_at')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (siteError && siteError.code !== 'PGRST116') {
      return NextResponse.json({ error: 'サイトを確認できませんでした' }, { status: 503 });
    }
    if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const settings = { ...(site.settings_json || {}) };
    if (token) settings.previewToken = token;
    else delete settings.previewToken;
    const { data: updated, error: updateError } = await supabase
      .from('sites')
      .update({ settings_json: settings })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('updated_at', site.updated_at)
      .select('id');
    if (updateError) return NextResponse.json({ error: 'プレビュー設定を保存できませんでした' }, { status: 503 });
    if (updated?.length === 1) return NextResponse.json(token ? { token } : { ok: true });
  }
  return NextResponse.json({ error: '別の更新と重なりました。もう一度お試しください' }, { status: 409 });
}

// POST /api/sites/[id]/preview-token — generate or refresh a preview token
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return changePreviewToken(supabase, (await params).id, user.id, 'issue');
}

// DELETE /api/sites/[id]/preview-token — revoke token
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return changePreviewToken(supabase, (await params).id, user.id, 'revoke');
}
