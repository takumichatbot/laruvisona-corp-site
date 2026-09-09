import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import dns from 'node:dns/promises';
import {
  normalizeDomain,
  checkOwnership,
  checkPointsHere,
  deriveStatus,
  statusLabel,
  dnsInstructions,
  type DomainStatus,
} from '@/lib/domain';
import { renderConfig, registerDomain, findDomain } from '@/lib/render-domains';
import { safeFetch } from '@/lib/safe-fetch';
import { logError } from '@/lib/api-error';

// POST /api/sites/[id]/domain/verify — 所有確認 → Render登録 → 接続確認
//
// 順番に意味がある:
//   1. サイトの所有者を確認する（ここを通らないと以降の副作用は起きない）
//   2. TXTレコードでドメインの所有を確認する
//      共有Aレコードへの一致は「我々の基盤を向いている」証拠にはなるが、
//      「このドメインを設定してよい人物である」証拠にはならないので分けている
//   3. 所有が取れて初めて Render に登録する
//   4. 向き先（CNAME厳密一致 / Aレコード）を確認する
//   5. 実際にHTTPSで応答するかを確認する（TLSの準備完了はここで判断する）
//   6. すべて揃ったときだけ sites.custom_domain を書き換える＝配信を切り替える
//
// 失敗しても sites.custom_domain には触らないので、旧ドメインの公開は続く。

export const dynamic = 'force-dynamic';

function expected() {
  const slug = process.env.RENDER_SERVICE_SLUG || process.env.RENDER_SERVICE_ID || '';
  return {
    expectedTarget: slug ? `${slug}.onrender.com` : '',
    expectedApexIp: process.env.RENDER_APEX_IP || '216.24.57.1',
  };
}

async function lookupTxt(host: string, name: string): Promise<string[]> {
  const out: string[] = [];
  for (const n of [name, host]) {
    try {
      const recs = await dns.resolveTxt(n);
      for (const chunks of recs) out.push(chunks.join(''));
    } catch { /* レコードが無いのは失敗ではない */ }
  }
  return out;
}

async function lookupCname(host: string): Promise<string[]> {
  try { return await dns.resolveCname(host); } catch { return []; }
}

async function lookupA(host: string): Promise<string[]> {
  try { return await dns.resolve4(host); } catch { return []; }
}

/**
 * 実際にHTTPSで応答するか。
 * 顧客が入力したドメインへサーバーから接続するので、必ず safeFetch を通す
 * （内部アドレスに解決されるドメインを入れられると社内へ到達できてしまう）。
 */
async function probeHttps(host: string): Promise<boolean> {
  try {
    const res = await safeFetch(`https://${host}/`, { method: 'GET' }, { timeoutMs: 8000, maxRedirects: 2 });
    try { await res.arrayBuffer(); } catch { /* noop */ }
    return res.status > 0 && res.status < 500;
  } catch {
    return false;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // 1. 所有者確認（副作用の前）
  const { data: siteRow } = await supabase
    .from('sites')
    .select('id, custom_domain')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!siteRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const site = siteRow as { id: string; custom_domain: string | null };

  const body = await req.json().catch(() => ({}));
  const norm = normalizeDomain((body as { host?: unknown }).host);
  if (!norm.ok) return NextResponse.json({ error: norm.error }, { status: 400 });
  const host = norm.value.host;

  const { data: rowData } = await supabase
    .from('site_domains')
    .select('id, host, status, verification_token, render_domain_id')
    .eq('site_id', id)
    .eq('host', host)
    .maybeSingle();
  if (!rowData) return NextResponse.json({ error: 'このドメインは登録されていません' }, { status: 404 });
  const row = rowData as {
    id: string; host: string; status: DomainStatus;
    verification_token: string; render_domain_id: string | null;
  };

  const e = expected();
  const now = new Date().toISOString();

  // 2. 所有確認
  const txt = await lookupTxt(host, `_laruhp-challenge.${host}`);
  const ownership = checkOwnership(txt, row.verification_token);

  let renderVerified: boolean | null = null;
  let renderDomainId = row.render_domain_id;
  let lastError: string | null = null;

  // 3. 所有が取れてから外部登録
  const cfg = renderConfig();
  if (ownership && cfg) {
    if (!renderDomainId) {
      const reg = await registerDomain(cfg, host);
      if (reg.ok) {
        renderDomainId = reg.domainId;
      } else {
        lastError = reg.message;
      }
    }
    const found = await findDomain(cfg, host);
    if (found.ok) {
      renderVerified = found.domain ? found.domain.verificationStatus === 'verified' : false;
      if (found.domain?.id && !renderDomainId) renderDomainId = found.domain.id;
    }
  }

  // 4. 向き先
  const [cname, a] = await Promise.all([lookupCname(host), lookupA(host)]);
  const points = checkPointsHere({ txt, cname, a }, {
    expectedTarget: e.expectedTarget,
    expectedApexIps: [e.expectedApexIp],
  });

  // 5. TLS（向き先が揃ってからでないと意味がないので、そこまで来たときだけ）
  let tlsReady: boolean | null = null;
  if (ownership && points.pointsHere) tlsReady = await probeHttps(host);

  const status = deriveStatus({
    ownership,
    pointsHere: points.pointsHere,
    renderVerified,
    tlsReady,
  });

  const patch: Record<string, unknown> = {
    status,
    last_checked_at: now,
    last_error: lastError,
    render_domain_id: renderDomainId,
  };
  if (ownership) patch.ownership_verified_at = now;
  if (points.pointsHere) patch.dns_verified_at = now;
  if (tlsReady) patch.ssl_ready_at = now;
  if (status === 'connected') patch.connected_at = now;
  if (renderDomainId && !row.render_domain_id) patch.render_registered_at = now;

  const { error: upErr } = await supabase.from('site_domains').update(patch).eq('id', row.id);
  if (upErr) logError('domain.verify.update', upErr);

  // 6. すべて揃ったときだけ配信を切り替える。
  //
  // すでに別のホストで公開できているなら、そちらを正のURLのまま残す。
  // apex と www の両方を接続したときに、あとから確認したほうへ
  // canonical が勝手に移らないようにするため（どちらを正にするかは
  // 利用者が選ぶべきもので、確認の順番で決まってよいものではない）。
  let liveIsHealthy = false;
  if (site.custom_domain && site.custom_domain !== host) {
    const { data: liveRow } = await supabase
      .from('site_domains')
      .select('status')
      .eq('site_id', id)
      .eq('host', site.custom_domain)
      .maybeSingle();
    const liveStatus = (liveRow as { status?: DomainStatus } | null)?.status;
    liveIsHealthy = liveStatus === 'connected' || liveStatus === 'legacy';
  }

  let switched = false;
  if (status === 'connected' && site.custom_domain !== host && !liveIsHealthy) {
    const { error } = await supabase
      .from('sites')
      .update({ custom_domain: host })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) {
      logError('domain.verify.switch', error);
    } else {
      switched = true;
    }
  }

  return NextResponse.json({
    host,
    status,
    ...statusLabel(status),
    switched,
    evidence: {
      ownership,
      pointsHere: points.pointsHere,
      pointedBy: points.how,
      renderVerified,
      tlsReady,
      seen: { cname, a, txtCount: txt.length },
    },
    expectedTarget: e.expectedTarget,
    expectedApexIp: e.expectedApexIp,
    records: dnsInstructions(host, row.verification_token, e),
    lastError,
  });
}

// 明示的に GET を塞ぐ（副作用のある処理をリンクやプリフェッチで踏ませない）
export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
