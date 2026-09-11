import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { EXPORT_VERSION } from '@/lib/html-export';
import { sha256 } from '@/lib/content-hash';
import { redact, logError } from '@/lib/api-error';

// 公開HTMLの控えを取る／書き戻す。
//
// 一括再生成（/api/admin/republish-all）は、データベースの published_html を
// 上書きする。コードを戻しても、この生成物は残ったままなので表示は戻らない。
// 戻せるようにするには、上書きする前の中身をどこかに持っておくしかない。
//
//   GET  … いまの published_html を全件返す（読むための控え）
//   POST … 指定した行だけを、指定した中身へ書き戻す
//
// ■ 全件の控えを、そのまま流し込んではいけない
//
// 「全件の控えを取る → 一部だけ再生成する → 控えを全件POSTして戻す」をやると、
// **再生成していないサイトが、その後に公開した内容まで巻き戻る**。
// 控えを取ったあとに利用者が公開し直していても、無条件に上書きするため。
//
// そこで POST は、1件ごとに `expected_sha256`（いま置かれているはずの中身の指紋）を
// 必ず要求する。いまの中身がそれと違えば competing として止め、書かない。
//   ・再生成の応答に付く `undo` が、そのまま POST の入力になる
//     （前の中身＋その回が書いた中身の指紋が、対で入っている）
//   ・指紋が無い入力は受け取らない。全件を無条件に流し込む道は塞いである
//   ・どうしても中身を問わず上書きする必要があるときだけ force:true を使う
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
    // 読むための控え。戻すときは、再生成の応答に付く undo を使う
    note: 'この控えをそのまま POST しても戻りません（1件ごとに expected_sha256 が要ります）。戻すには再生成の応答の undo を送ってください。',
    sites: (data ?? []).map(s => ({
      id: s.id, slug: s.slug, name: s.name, updated_at: s.updated_at,
      published_html: s.published_html ?? '',
      sha256: sha256(String(s.published_html ?? '')),
    })),
  });
}

type RestoreEntry = {
  id: string;
  slug?: string | null;
  published_html: string;
  /** いま置かれているはずの中身の指紋。違えば書かない */
  expected_sha256?: string;
};

type RestoreResult = {
  id: string;
  slug: string | null;
  /** restored=戻した / conflict=そのあと公開し直されていた / not_found=その行が無い
      / failed=書き込みに失敗 / needs_expected=指紋が付いていない */
  status: 'restored' | 'conflict' | 'not_found' | 'failed' | 'needs_expected';
  detail?: string;
};

export async function POST(req: Request) {
  const denied = await assertAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as
    | { sites?: RestoreEntry[]; undo?: { sites?: RestoreEntry[] }; dryRun?: boolean; force?: boolean }
    | null;

  // 再生成の応答（undo を含む形）を、そのまま送り返せるようにする
  const sites = body?.undo?.sites ?? body?.sites;
  if (!Array.isArray(sites) || sites.length === 0) {
    return NextResponse.json({ error: '戻す対象（sites）が必要です。再生成の応答に付く undo をそのまま送れます' }, { status: 400 });
  }
  if (sites.length > 500) {
    return NextResponse.json({ error: '一度に戻せるのは500件までです。分けて送ってください' }, { status: 400 });
  }
  for (const s of sites) {
    if (!s || typeof s.id !== 'string' || typeof s.published_html !== 'string') {
      return NextResponse.json({ error: 'sites の形が違います（id と published_html が要ります）' }, { status: 400 });
    }
  }

  const service = await createServiceClient();
  const ids = [...new Set(sites.map(s => s.id))];
  const { data: current, error: readError } = await service
    .from('sites').select('id, slug, published_html, updated_at').in('id', ids);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  const now = new Map((current ?? []).map(r => [
    r.id as string,
    { slug: (r.slug as string | null) ?? null, html: String(r.published_html ?? ''), updated_at: r.updated_at as string },
  ]));

  /** 1件ずつ、いま何が起きるかを決める */
  const plan = sites.map((s): { entry: RestoreEntry; result: RestoreResult } => {
    const row = now.get(s.id);
    const slug = s.slug ?? row?.slug ?? null;
    if (!row) return { entry: s, result: { id: s.id, slug, status: 'not_found', detail: 'その行がありません（消されたか、idが違います）' } };
    if (body?.force) return { entry: s, result: { id: s.id, slug, status: 'restored', detail: '指紋を確かめずに書きます（force）' } };
    if (typeof s.expected_sha256 !== 'string' || s.expected_sha256.length !== 64) {
      return { entry: s, result: { id: s.id, slug, status: 'needs_expected', detail: 'expected_sha256 がありません。控えをそのまま流し込むことはできません' } };
    }
    const currentHash = sha256(row.html);
    if (currentHash !== s.expected_sha256) {
      return { entry: s, result: { id: s.id, slug, status: 'conflict', detail: 'そのあと公開し直されています。戻すとその内容が消えるので、書きませんでした' } };
    }
    return { entry: s, result: { id: s.id, slug, status: 'restored' } };
  });

  if (body?.dryRun) {
    const counts = countBy(plan.map(p => p.result.status));
    return NextResponse.json({ dryRun: true, total: plan.length, counts, results: plan.map(p => p.result) });
  }

  const results: RestoreResult[] = [];
  for (const { entry, result } of plan) {
    if (result.status !== 'restored') { results.push(result); continue; }
    const row = now.get(entry.id)!;
    try {
      /* 読んだときのままの行にだけ書く。
         確かめてから書くまでのあいだに公開されても、上書きしない。 */
      let q = service.from('sites').update({ published_html: entry.published_html }).eq('id', entry.id);
      if (!body?.force) q = q.eq('updated_at', row.updated_at);
      const { data: updated, error } = await q.select('id');
      if (error) throw new Error(error.message);
      /* 「errorが無い」だけでは成功と言えない。
         条件に合う行が無ければ0件のまま、errorにはならない。 */
      if (!updated || updated.length !== 1) {
        results.push({ id: entry.id, slug: result.slug, status: 'conflict', detail: '書く直前に更新されました。もう一度確かめてください' });
        continue;
      }
      if (result.slug) revalidatePath(`/hp/${result.slug}`);
      results.push(result);
    } catch (e) {
      logError('admin/published-html-backup', e);
      results.push({
        id: entry.id, slug: result.slug, status: 'failed',
        detail: redact(e instanceof Error ? e.message : String(e)).slice(0, 300),
      });
    }
  }

  const counts = countBy(results.map(r => r.status));
  return NextResponse.json({
    total: results.length,
    restored: counts.restored ?? 0,
    counts,
    results,
    // 戻せなかったものだけを、そのまま読めるように出す
    notRestored: results.filter(r => r.status !== 'restored'),
  });
}

function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}
