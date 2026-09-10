import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { EXPORT_VERSION } from '@/lib/html-export';
import { redact, logError } from '@/lib/api-error';

// 公開HTMLの控えを取る／書き戻す。
//
// 一括再生成（/api/admin/republish-all）は、データベースの published_html を
// 上書きする。コードを戻しても、この生成物は残ったままなので表示は戻らない。
// 戻せるようにするには、上書きする前の中身をどこかに持っておくしかない。
//
//   GET  … いまの published_html を全件返す（これをファイルへ保存する）
//   POST … 保存したファイルの中身を送ると、その姿へ書き戻す
//
// 列は増やさない。控えは運用側のファイルとして持つ。
// 手順は docs/rebuild-migration-2026-09-11.md にある。

async function assertAdmin(req: Request) {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (process.env.ADMIN_SECRET && bearer === process.env.ADMIN_SECRET) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmails = [process.env.ADMIN_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]
    .filter(Boolean).join(',')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!user || !adminEmails.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET(req: Request) {
  const denied = await assertAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');

  const service = await createServiceClient();
  let query = service.from('sites').select('id, slug, name, updated_at, published_html').eq('published', true);
  if (slug) query = query.eq('slug', slug);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    takenAt: new Date().toISOString(),
    version: EXPORT_VERSION,
    count: (data ?? []).length,
    sites: (data ?? []).map(s => ({
      id: s.id, slug: s.slug, name: s.name, updated_at: s.updated_at,
      published_html: s.published_html ?? '',
    })),
  });
}

export async function POST(req: Request) {
  const denied = await assertAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as
    | { sites?: { id: string; slug?: string | null; published_html: string }[]; dryRun?: boolean }
    | null;
  const sites = body?.sites;
  if (!Array.isArray(sites) || sites.length === 0) {
    return NextResponse.json({ error: '控えの中身（sites）が必要です' }, { status: 400 });
  }
  for (const s of sites) {
    if (!s || typeof s.id !== 'string' || typeof s.published_html !== 'string') {
      return NextResponse.json({ error: 'sites の形が違います（id と published_html が要ります）' }, { status: 400 });
    }
  }
  if (body?.dryRun) {
    return NextResponse.json({ dryRun: true, count: sites.length, targets: sites.map(s => ({ id: s.id, slug: s.slug ?? null })) });
  }

  const service = await createServiceClient();
  const failed: { id: string; error: string }[] = [];
  let restored = 0;
  for (const s of sites) {
    try {
      const { error } = await service.from('sites').update({ published_html: s.published_html }).eq('id', s.id);
      if (error) throw new Error(error.message);
      if (s.slug) revalidatePath(`/hp/${s.slug}`);
      restored++;
    } catch (e) {
      logError('admin/published-html-backup', e);
      failed.push({ id: s.id, error: redact(e instanceof Error ? e.message : String(e)).slice(0, 300) });
    }
  }
  return NextResponse.json({ restored, total: sites.length, failed });
}
