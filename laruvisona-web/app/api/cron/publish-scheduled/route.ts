import { NextResponse } from 'next/server';
import { requireBearer } from '@/lib/scheduled-email';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 予約した時刻を過ぎた記事を公開する。
//
// 予約は scheduled_at にだけ入れる。published_at は下書きにも入っている
// （default now()）ので、そちらで判断すると出すつもりのない下書きまで公開してしまう。
//
// 列がまだ無い環境（supabase/news_posts_scheduled.sql を流す前）でも落ちないようにする。
// 「予約できたように見えて、実は何も起きない」を避けるため、状態は必ず応答に出す。
export async function POST(req: Request) {
  if (!requireBearer(req, process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('news_posts')
    .select('id, site_id, title, scheduled_at')
    .eq('published', false)
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', now)
    .limit(100);

  if (error) {
    // 42703 = undefined_column（SQL未適用）
    const missing = (error as { code?: string }).code === '42703' || /scheduled_at/.test(error.message || '');
    return NextResponse.json(
      {
        error: missing ? 'scheduled_at の列がありません（supabase/news_posts_scheduled.sql を実行してください）' : '予約投稿を読み込めませんでした',
        setupRequired: missing,
      },
      { status: 503 },
    );
  }

  const rows = data || [];
  const published: string[] = [];
  const failed: string[] = [];
  for (const row of rows) {
    const { error: updateError } = await db
      .from('news_posts')
      .update({ published: true, published_at: row.scheduled_at, scheduled_at: null, updated_at: now })
      .eq('id', row.id)
      .eq('published', false); // 途中で人が公開していたら触らない
    if (updateError) failed.push(row.id);
    else published.push(row.id);
  }

  if (failed.length) console.error('[cron/publish-scheduled] 公開できなかった記事', failed);
  return NextResponse.json({ ok: failed.length === 0, checked: rows.length, published: published.length, failed: failed.length });
}
