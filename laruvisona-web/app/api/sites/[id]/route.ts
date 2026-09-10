import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/sites/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ site: data });
}

// PUT /api/sites/[id]
//
// settings_json は「丸ごと置き換え」と「一部だけ更新」の2つを受ける。
//
//   settings_json        …… 送った内容でそのまま置き換える（従来どおり）
//   settings_json_patch  …… 送った項目だけを、いま保存されている設定に重ねる
//
// 編集画面は後者を使う。前者だと、画面を開いたときの設定を丸ごと送り返すため、
//   ・別の画面で変えた通知先が、古い値へ戻る
//   ・取り消したプレビュー用URLが、また有効になる
//   ・編集画面が知らない設定（連携・商品・配信の予約）が消える
// といったことが、保存のたびに起きる。
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, blocks_json, seo_json, settings_json, settings_json_patch } = body;

  if (settings_json !== undefined && settings_json_patch !== undefined) {
    return NextResponse.json(
      { error: 'settings_json と settings_json_patch は同時に送れません' },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (blocks_json !== undefined) update.blocks_json = blocks_json;
  if (seo_json !== undefined) update.seo_json = seo_json;

  if (settings_json_patch !== undefined) {
    if (settings_json_patch === null || typeof settings_json_patch !== 'object' || Array.isArray(settings_json_patch)) {
      return NextResponse.json({ error: 'settings_json_patch はオブジェクトで送ってください' }, { status: 400 });
    }
    // 保存されている設定を読んでから重ねる。読めなければ保存しない
    const { data: current } = await supabase
      .from('sites').select('settings_json').eq('id', id).eq('user_id', user.id).single();
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    update.settings_json = {
      ...(current.settings_json as Record<string, unknown> || {}),
      ...(settings_json_patch as Record<string, unknown>),
    };
  } else if (settings_json !== undefined) {
    update.settings_json = settings_json;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: '更新する内容がありません' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('sites')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: data });
}

// PATCH /api/sites/[id] — partial update: slug or settings_patch
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // settings_patch: merge into existing settings_json
  if (body.settings_patch !== undefined) {
    const { data: current } = await supabase.from('sites').select('settings_json').eq('id', id).eq('user_id', user.id).single();
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const merged = { ...(current.settings_json as Record<string, unknown> || {}), ...body.settings_patch };
    const { data, error } = await supabase.from('sites').update({ settings_json: merged }).eq('id', id).eq('user_id', user.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ site: data });
  }

  // custom_domain はここでは扱わない。
  //
  // 以前はこの経路でも custom_domain を書き換えられた。所有確認もRenderへの
  // 登録も通らないため、/api/sites/[id]/domain 側の検証をまるごと迂回できた。
  // 配信先（proxy.ts）と決済の戻り先許可リスト（lib/site-origin.ts）は
  // sites.custom_domain を信頼しているので、ここを開けたままにはできない。
  if ('custom_domain' in body) {
    return NextResponse.json(
      { error: '独自ドメインは /api/sites/[id]/domain から設定してください' },
      { status: 400 },
    );
  }

  const { slug } = body;
  if (!slug || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) || slug.length < 3 || slug.length > 60 || /--/.test(slug)) {
    return NextResponse.json({ error: 'slugは3〜60文字・英数字とハイフン（先頭末尾・連続ハイフン不可）' }, { status: 400 });
  }

  const { data: existing } = await supabase.from('sites').select('id').eq('slug', slug).neq('id', id).limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'このURLは既に使われています' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('sites')
    .update({ slug })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: data });
}

// DELETE /api/sites/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase
    .from('sites')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
