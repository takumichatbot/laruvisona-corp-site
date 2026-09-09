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

export type FindResult =
  | { ok: true; domain: RenderDomain | null }
  | { ok: false; message: string };

export async function findDomain(cfg: RenderConfig, host: string): Promise<FindResult> {
  let res: Response;
  try {
    res = await call(cfg, `/services/${cfg.serviceId}/custom-domains?limit=100`);
  } catch {
    return { ok: false, message: 'Renderに接続できませんでした' };
  }
  if (!res.ok) return { ok: false, message: `Renderエラー (${res.status})` };
  const list = await res.json().catch(() => null) as Array<{ customDomain?: RenderDomain }> | null;
  if (!Array.isArray(list)) return { ok: true, domain: null };
  const found = list
    .map(x => x.customDomain)
    .find(d => d && d.name.toLowerCase() === host.toLowerCase());
  return { ok: true, domain: found ?? null };
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
