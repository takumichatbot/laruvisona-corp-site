import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/sites/[id]/preview-token — generate or refresh a preview token
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: site } = await supabase
    .from('sites')
    .select('id, settings_json')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const token = crypto.randomUUID();
  const updatedSettings = { ...(site.settings_json || {}), previewToken: token };

  const { error } = await supabase
    .from('sites')
    .update({ settings_json: updatedSettings })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ token });
}

// DELETE /api/sites/[id]/preview-token — revoke token
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: site } = await supabase
    .from('sites')
    .select('id, settings_json')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updatedSettings = { ...(site.settings_json || {}) };
  delete updatedSettings.previewToken;

  const { error } = await supabase
    .from('sites')
    .update({ settings_json: updatedSettings })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
