import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  normalizeDomain,
  isReservedHost,
  generateVerificationToken,
  dnsInstructions,
  statusLabel,
  type DomainStatus,
} from '@/lib/domain';
import { renderConfig, unregisterDomain } from '@/lib/render-domains';
import { logError, safeErrorMessage } from '@/lib/api-error';

// 独自ドメインの登録・照会・解除。
//
// 【以前の実装から変えた点】
// 1. 先にサイトの所有者を確認してから、副作用を起こす。
//    以前は「DBを更新 → Renderに登録」の順で、更新対象が0件（他人のサイトID、
//    存在しないID）でも dbError が無ければ Render への登録まで進んでいた。
// 2. 保存＝接続にしない。ここで書くのは public.site_domains の候補行だけで、
//    実際に配信される sites.custom_domain は所有確認とHTTPS応答が取れるまで
//    書き換えない。未確認のドメインが proxy.ts の配信先や
//    lib/site-origin.ts の決済戻り先許可リストに載らないようにするため。
// 3. Renderへの登録は所有確認のあと（verify エンドポイント）に移した。

export const dynamic = 'force-dynamic';

interface SiteDomainRow {
  id: string;
  host: string;
  status: DomainStatus;
  verification_token: string;
  last_error: string | null;
  last_checked_at: string | null;
  render_domain_id: string | null;
}

function expected() {
  const slug = process.env.RENDER_SERVICE_SLUG || process.env.RENDER_SERVICE_ID || '';
  return {
    expectedTarget: slug ? `${slug}.onrender.com` : '',
    expectedApexIp: process.env.RENDER_APEX_IP || '216.24.57.1',
  };
}

/** サイトの所有者確認。副作用の前に必ず通す */
async function ownedSite(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data } = await supabase
    .from('sites')
    .select('id, slug, custom_domain')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  return data as { id: string; slug: string | null; custom_domain: string | null } | null;
}

// GET — 状態と、利用者が追加すべきDNSレコードを返す
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const site = await ownedSite(supabase, id, user.id);
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: rows, error: rowsErr } = await supabase
    .from('site_domains')
    .select('id, host, status, verification_token, last_error, last_checked_at, render_domain_id')
    .eq('site_id', id)
    .order('created_at', { ascending: true });

  const e = expected();

  // supabase/site_domains.sql をまだ適用していない環境では、この表が無い。
  // その場合でも既存の接続済みドメインは画面から見えるようにしておく
  // （デプロイとSQL適用の順番がどちらでも、既存顧客の画面が壊れないため）。
  if (rowsErr) {
    return NextResponse.json({
      liveDomain: site.custom_domain,
      migrationPending: true,
      domains: site.custom_domain
        ? [{
            host: site.custom_domain,
            status: 'legacy' as DomainStatus,
            ...statusLabel('legacy'),
            isLive: true,
            lastError: null,
            lastCheckedAt: null,
            records: [],
          }]
        : [],
      expectedTarget: e.expectedTarget,
      expectedApexIp: e.expectedApexIp,
    });
  }
  const domains = ((rows || []) as SiteDomainRow[]).map(r => ({
    host: r.host,
    status: r.status,
    ...statusLabel(r.status),
    isLive: site.custom_domain === r.host,
    lastError: r.last_error,
    lastCheckedAt: r.last_checked_at,
    records: dnsInstructions(r.host, r.verification_token, e),
  }));

  return NextResponse.json({
    liveDomain: site.custom_domain,
    domains,
    expectedTarget: e.expectedTarget,
    expectedApexIp: e.expectedApexIp,
  });
}

// PUT — ドメインを候補として登録する（この時点では配信も外部登録もしない）
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // 副作用の前に所有者を確認する
  const site = await ownedSite(supabase, id, user.id);
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const norm = normalizeDomain((body as { customDomain?: unknown }).customDomain);
  if (!norm.ok) return NextResponse.json({ error: norm.error }, { status: 400 });
  const host = norm.value.host;

  if (isReservedHost(host, process.env.NEXT_PUBLIC_APP_URL)) {
    return NextResponse.json({ error: 'このドメインは使用できません' }, { status: 400 });
  }

  // 別サイトが先に押さえていないか。競合はDBのunique制約でも押さえている。
  const { data: dup } = await supabase
    .from('site_domains')
    .select('site_id')
    .eq('host', host)
    .maybeSingle();
  if (dup && (dup as { site_id: string }).site_id !== id) {
    return NextResponse.json({ error: 'このドメインはすでに別のサイトに設定されています' }, { status: 409 });
  }

  if (dup) {
    // 同じサイトでの再登録は、状態を壊さずそのまま返す
    const { data: existing } = await supabase
      .from('site_domains')
      .select('id, host, status, verification_token')
      .eq('host', host)
      .single();
    const row = existing as Pick<SiteDomainRow, 'host' | 'status' | 'verification_token'>;
    return NextResponse.json({
      ok: true,
      host: row.host,
      status: row.status,
      ...statusLabel(row.status),
      records: dnsInstructions(row.host, row.verification_token, expected()),
    });
  }

  const token = generateVerificationToken();
  const { error: insErr } = await supabase.from('site_domains').insert({
    site_id: id,
    host,
    status: 'pending_ownership',
    verification_token: token,
  });

  if (insErr) {
    // unique制約に当たった＝同時に別サイトが登録した
    if ((insErr as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'このドメインはすでに別のサイトに設定されています' }, { status: 409 });
    }
    logError('domain.put', insErr);
    return NextResponse.json({ error: safeErrorMessage(insErr) }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    host,
    status: 'pending_ownership' as DomainStatus,
    ...statusLabel('pending_ownership'),
    records: dnsInstructions(host, token, expected()),
  });
}

// DELETE — 候補または接続済みドメインの解除
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const site = await ownedSite(supabase, id, user.id);
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const raw = new URL(req.url).searchParams.get('host');
  const norm = normalizeDomain(raw);
  if (!norm.ok) return NextResponse.json({ error: norm.error }, { status: 400 });
  const host = norm.value.host;

  const { data: row } = await supabase
    .from('site_domains')
    .select('id, host, status, render_domain_id')
    .eq('site_id', id)
    .eq('host', host)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const r = row as Pick<SiteDomainRow, 'id' | 'host' | 'status' | 'render_domain_id'>;

  // 配信中のドメインを外す場合は、先に配信ポインタを落としてから解除する。
  // 逆順だと、Renderから消えているのにこちらは配信し続ける時間が生まれる。
  if (site.custom_domain === host) {
    const { error } = await supabase
      .from('sites')
      .update({ custom_domain: null })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) {
      logError('domain.delete.clear', error);
      return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
    }
  }

  const cfg = renderConfig();
  let renderNote: string | null = null;
  if (cfg && r.render_domain_id) {
    const res = await unregisterDomain(cfg, r.render_domain_id);
    if (!res.ok) renderNote = res.message ?? 'Render側の解除に失敗しました';
  }

  await supabase.from('site_domains').delete().eq('id', r.id);

  return NextResponse.json({ ok: true, host, renderNote });
}
