import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createDomainStore } from '@/lib/domain-store-supabase';
import { dnsPort, renderPort, probePort } from '@/lib/domain-ports';
import { addDomain, releaseDomain, type Deps, type DomainRecord } from '@/lib/domain-service';
import {
  dnsInstructions, statusLabel, forwardTargetFor, DNS_SUPPORT_NOTES, type DomainStatus,
} from '@/lib/domain';

// 独自ドメインの一覧・追加・解除。処理の本体は lib/domain-service.ts にある。
// このファイルは認証と入出力の変換だけを行う。

export const dynamic = 'force-dynamic';

export function expectedTargets() {
  const slug = process.env.RENDER_SERVICE_SLUG || process.env.RENDER_SERVICE_ID || '';
  return {
    expectedTarget: slug ? `${slug}.onrender.com` : '',
    expectedApexIp: process.env.RENDER_APEX_IP || '216.24.57.1',
  };
}

export async function buildDeps(): Promise<Deps> {
  const e = expectedTargets();
  return {
    store: await createDomainStore(),
    dns: dnsPort,
    render: renderPort,
    probe: probePort,
    expectedTarget: e.expectedTarget,
    expectedApexIps: [e.expectedApexIp],
    mainHost: process.env.NEXT_PUBLIC_APP_URL,
  };
}

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET — 状態と、利用者が追加すべきDNSレコード
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const deps = await buildDeps();
  const site = await deps.store.getOwnedSite(id, user.id);
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const e = expectedTargets();

  let rows: DomainRecord[];
  let migrationPending = false;
  try {
    rows = await deps.store.listDomains(id);
  } catch {
    rows = [];
    migrationPending = true;
  }

  // supabase/site_domains.sql をまだ適用していない環境では表が無い。
  // その場合でも既存の接続済みドメインは画面から見えるようにしておく
  // （デプロイとSQL適用の順番がどちらでも、既存顧客の画面が壊れないため）。
  if (rows.length === 0 && site.custom_domain) {
    migrationPending = true;
    return NextResponse.json({
      liveDomain: site.custom_domain,
      migrationPending,
      domains: [{
        host: site.custom_domain,
        status: 'legacy' as DomainStatus,
        ...statusLabel('legacy'),
        isPrimary: true,
        canBePrimary: false,
        lastError: null,
        lastCheckedAt: null,
        records: [],
      }],
      notes: DNS_SUPPORT_NOTES,
      ...e,
    });
  }

  return NextResponse.json({
    liveDomain: site.custom_domain,
    migrationPending,
    domains: rows.map(r => ({
      host: r.host,
      status: r.status,
      ...statusLabel(r.status),
      isPrimary: site.custom_domain === r.host,
      // 「接続確認済み」と「主な公開URL」は別。切替できるかはここで示す。
      canBePrimary: (r.status === 'connected' || r.status === 'legacy') && site.custom_domain !== r.host,
      // 主な公開URLでないホストは、そこへ転送される。
      //   alias  … 外部（レジストラ・CDN）の転送設定を観測したホスト
      //   その他 … 確認が取れていて、こちらが308で転送するホスト
      forwardsTo: forwardTargetFor(r, site.custom_domain),
      lastError: r.last_error,
      lastCheckedAt: r.last_checked_at,
      records: dnsInstructions(r.host, r.verification_token, e),
    })),
    notes: DNS_SUPPORT_NOTES,
    ...e,
  });
}

// PUT — 候補として登録する（配信もRender登録もしない）
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const deps = await buildDeps();

  const res = await addDomain(deps, {
    siteId: id,
    userId: user.id,
    input: (body as { customDomain?: unknown }).customDomain,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  return NextResponse.json({
    ok: true,
    host: res.host,
    status: res.status,
    ...statusLabel(res.status),
  });
}

// DELETE — 解除。外部の解除が終わるまで記録は消さない。
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const host = new URL(req.url).searchParams.get('host');
  const deps = await buildDeps();

  const res = await releaseDomain(deps, { siteId: id, userId: user.id, host });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  return NextResponse.json({
    ok: true,
    host: res.host,
    released: res.released,
    message: res.message ?? null,
  });
}
