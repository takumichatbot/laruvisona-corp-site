// Render のカスタムドメインAPIの薄いラッパー。
//
// 方針:
//   - 所有確認が取れる前には呼ばない（呼び出し側の責務）。
//   - 失敗を握りつぶして ok を返さない。必ず結果を返し、呼び出し側が状態に反映する。
//   - すでに登録済み（重複）は失敗ではなく「登録済み」として扱う。再試行で
//     壊れないようにするため。
//   - タイムアウトを必ず付ける。Render が遅いときにリクエストが張り付かない。

const BASE = 'https://api.render.com/v1';
const TIMEOUT_MS = 8000;

export interface RenderConfig {
  apiKey: string;
  serviceId: string;
}

export function renderConfig(): RenderConfig | null {
  const apiKey = process.env.RENDER_API_KEY;
  const serviceId = process.env.RENDER_SERVICE_ID;
  if (!apiKey || !serviceId) return null;
  return { apiKey, serviceId };
}

export type RegisterResult =
  | { ok: true; domainId: string | null; alreadyExisted: boolean }
  | { ok: false; code: 'conflict_other_account' | 'rate_limited' | 'unreachable' | 'error'; message: string };

async function call(cfg: RenderConfig, path: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

export async function registerDomain(cfg: RenderConfig, host: string): Promise<RegisterResult> {
  let res: Response;
  try {
    res = await call(cfg, `/services/${cfg.serviceId}/custom-domains`, {
      method: 'POST',
      body: JSON.stringify({ name: host }),
    });
  } catch {
    return { ok: false, code: 'unreachable', message: 'Renderに接続できませんでした' };
  }

  if (res.ok) {
    const body = await res.json().catch(() => null) as { id?: string } | Array<{ id?: string }> | null;
    const id = Array.isArray(body) ? (body[0]?.id ?? null) : (body?.id ?? null);
    return { ok: true, domainId: id, alreadyExisted: false };
  }

  // すでに登録済みは成功として扱う（再試行で壊れないように）
  if (res.status === 409) {
    const existing = await findDomain(cfg, host);
    if (existing.ok && existing.domain) {
      return { ok: true, domainId: existing.domain.id ?? null, alreadyExisted: true };
    }
    // 自分のサービスに無いのに409 = 他アカウントが押さえている
    return { ok: false, code: 'conflict_other_account', message: 'このドメインは別のアカウントで使用中です' };
  }
  if (res.status === 429) return { ok: false, code: 'rate_limited', message: '混み合っています。しばらくしてからお試しください' };

  const body = await res.json().catch(() => null) as { message?: string } | null;
  return { ok: false, code: 'error', message: body?.message || `Renderエラー (${res.status})` };
}

export interface RenderDomain {
  id?: string;
  name: string;
  verificationStatus?: string;
}

/**
 * 照会の結果。
 *
 *   { ok: true, domain }        … 対象が見つかった（IDあり）
 *   { ok: true, domain: null }  … 最後まで見て、確かに存在しない
 *   { ok: false, ... }          … 確認できなかった
 *
 * 「1ページ目に無かった」を「存在しない」にしてはいけない。
 * 外部IDを保存していない解除では、これを不存在と扱うと
 * 外部登録を残したままDBの行を消すことになる。
 */
export type FindResult =
  | { ok: true; domain: RenderDomain | null }
  | { ok: false; reason: 'api_error' | 'malformed' | 'incomplete'; message: string };

interface ListPage {
  customDomain?: RenderDomain;
  cursor?: string;
}

/** 1ページ分の取得。形が違えば「確認できなかった」として返す */
async function listPage(
  cfg: RenderConfig,
  params: Record<string, string>,
): Promise<{ ok: true; items: ListPage[] } | { ok: false; reason: 'api_error' | 'malformed'; message: string }> {
  const qs = new URLSearchParams(params).toString();
  let res: Response;
  try {
    res = await call(cfg, `/services/${cfg.serviceId}/custom-domains?${qs}`);
  } catch {
    return { ok: false, reason: 'api_error', message: 'Renderに接続できませんでした' };
  }
  if (!res.ok) return { ok: false, reason: 'api_error', message: `Renderエラー (${res.status})` };

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: 'malformed', message: 'Renderの応答を解釈できませんでした' };
  }
  if (!Array.isArray(body)) {
    return { ok: false, reason: 'malformed', message: 'Renderの応答の形式が想定と違います' };
  }
  return { ok: true, items: body as ListPage[] };
}

function pick(items: ListPage[], host: string): RenderDomain | null {
  const want = host.toLowerCase();
  for (const it of items) {
    const d = it?.customDomain;
    if (d && typeof d.name === 'string' && d.name.toLowerCase() === want) return d;
  }
  return null;
}

const MAX_PAGES = 40;
const PAGE_SIZE = 100;

/**
 * ホスト名で、このサービスの登録を確認する。
 *
 * 以前は limit=100 の1ページだけを見て、見つからなければ null を返していた。
 * 登録が101件以上あると2ページ目以降が見えず、「存在しない」と誤判定した。
 *
 * まず name フィルタで引き、それで確定できなければ cursor で最後まで辿る。
 */
export async function findDomain(cfg: RenderConfig, host: string): Promise<FindResult> {
  // 1. 名前で絞って引く
  const byName = await listPage(cfg, { name: host, limit: '20' });
  if (!byName.ok) return byName;
  const hit = pick(byName.items, host);
  if (hit) {
    if (!hit.id) {
      // 見つかったがIDが無い。削除対象にできないので「存在しない」とは別にする。
      return { ok: false, reason: 'incomplete', message: '登録は見つかりましたがIDを取得できませんでした' };
    }
    return { ok: true, domain: hit };
  }

  // 2. name フィルタが効かない場合に備えて、全ページ辿って確かめる。
  //    「見つからなかった」を返してよいのは、最後まで見たときだけ。
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params: Record<string, string> = { limit: String(PAGE_SIZE) };
    if (cursor) params.cursor = cursor;
    const r = await listPage(cfg, params);
    if (!r.ok) return r;

    const found = pick(r.items, host);
    if (found) {
      if (!found.id) {
        return { ok: false, reason: 'incomplete', message: '登録は見つかりましたがIDを取得できませんでした' };
      }
      return { ok: true, domain: found };
    }

    if (r.items.length < PAGE_SIZE) {
      // 最後のページまで見て、存在しないことを確認できた
      return { ok: true, domain: null };
    }
    const last = r.items[r.items.length - 1];
    if (!last?.cursor) {
      // まだ続きがあるはずなのに、次を辿る手がかりが無い
      return { ok: false, reason: 'incomplete', message: 'Renderの一覧を最後まで確認できませんでした' };
    }
    cursor = last.cursor;
  }
  return { ok: false, reason: 'incomplete', message: 'Renderの一覧が想定より多く、確認を打ち切りました' };
}

/**
 * Render からの解除。
 * 新ドメインへの切り替えが失敗したときに旧ドメインを消してしまわないよう、
 * 呼び出すのは「利用者が明示的に解除したとき」だけにする。
 */
export async function unregisterDomain(cfg: RenderConfig, domainId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await call(cfg, `/services/${cfg.serviceId}/custom-domains/${domainId}`, { method: 'DELETE' });
    if (res.ok || res.status === 404) return { ok: true };
    return { ok: false, message: `Renderエラー (${res.status})` };
  } catch {
    return { ok: false, message: 'Renderに接続できませんでした' };
  }
}
