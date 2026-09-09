// DomainService に渡す本番用のポート実装。
// ここだけが node:dns・Render API・外向きHTTPSに触れる。

import dns from 'node:dns/promises';
import { safeFetch, readCapped } from '@/lib/safe-fetch';
import { renderConfig, registerDomain, findDomain, unregisterDomain } from '@/lib/render-domains';
import type { DnsPort, RenderPort, ProbePort } from '@/lib/domain-service';
import { probeSecret, createChallenge, verifyProof } from '@/lib/domain-probe-proof';

export const dnsPort: DnsPort = {
  async txt(name) {
    try {
      const recs = await dns.resolveTxt(name);
      return recs.map(chunks => chunks.join(''));
    } catch { return []; }
  },
  async cname(host) {
    try { return await dns.resolveCname(host); } catch { return []; }
  },
  async a(host) {
    try { return await dns.resolve4(host); } catch { return []; }
  },
};

export const renderPort: RenderPort = {
  configured() { return renderConfig() !== null; },

  async register(host) {
    const cfg = renderConfig();
    if (!cfg) return { ok: false, message: 'Renderが未設定です' };
    const r = await registerDomain(cfg, host);
    return r.ok ? { ok: true, domainId: r.domainId } : { ok: false, message: r.message };
  },

  async find(host) {
    const cfg = renderConfig();
    if (!cfg) return { ok: false, message: 'Renderが未設定です' };
    const r = await findDomain(cfg, host);
    return r.ok ? { ok: true, domain: r.domain } : { ok: false, message: r.message };
  },

  async unregisterByHost(host) {
    const cfg = renderConfig();
    if (!cfg) return { ok: false, message: 'Renderが未設定です' };
    // 保存済みのIDは信用しない。必ずこのサービスの登録一覧をホスト名で引き直し、
    // 名前が完全に一致したものだけを消す。
    // （行の render_domain_id を書き換えて他人のドメインを消させないため）
    const found = await findDomain(cfg, host);
    if (!found.ok) return { ok: false, message: found.message };
    if (!found.domain) return { ok: true, removed: false };
    if (found.domain.name.toLowerCase() !== host.toLowerCase()) {
      return { ok: false, message: '解除対象のホスト名が一致しません' };
    }
    if (!found.domain.id) return { ok: false, message: '解除対象のIDが取得できません' };
    const res = await unregisterDomain(cfg, found.domain.id);
    return res.ok ? { ok: true, removed: true } : { ok: false, message: res.message || '解除に失敗しました' };
  },
};

export const probePort: ProbePort = {
  async reachesService(host) {
    // 固定の応答を返すだけの確認は、別のサーバーで真似できる。
    // 毎回の nonce と期限に対して、共有鍵でしか作れない署名が返るかで見る。
    const secret = probeSecret();
    if (!secret) return 'unavailable';

    const c = createChallenge(secret, host);
    const qs = new URLSearchParams({ host: c.host, nonce: c.nonce, exp: String(c.exp), sig: c.sig });
    try {
      // リダイレクトは追わない。別ホストへ飛ばされた先の応答で判断しないため。
      const res = await safeFetch(
        `https://${host}/api/domain-probe?${qs.toString()}`,
        { method: 'GET', headers: { accept: 'application/json' } },
        { timeoutMs: 8000, maxRedirects: 0 },
      );
      if (res.status !== 200) { try { await res.arrayBuffer(); } catch { /* noop */ } return 'not_reached'; }
      const body = await readCapped(res, 4096);
      const json = JSON.parse(body) as { ok?: boolean; proof?: string };
      if (!json.ok || !json.proof) return 'not_reached';
      return verifyProof(secret, c, json.proof) ? 'reached' : 'not_reached';
    } catch {
      return 'not_reached';
    }
  },
};
