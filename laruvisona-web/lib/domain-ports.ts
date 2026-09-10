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

  async findByHost(host) {
    const cfg = renderConfig();
    if (!cfg) return { ok: false as const, message: 'Renderが未設定です' };
    const r = await findDomain(cfg, host);
    // 「確認できなかった」を「存在しない」に変換しない。
    // 1ページ目に無かった・応答が壊れていた・IDが取れなかった、はすべて失敗。
    if (!r.ok) return { ok: false as const, message: r.message };
    if (!r.domain) {
      // 最後まで見て存在しないことを確認できた場合だけ、ここに来る
      return { ok: true as const, domainId: null };
    }
    if (r.domain.name.toLowerCase() !== host.toLowerCase()) {
      return { ok: false as const, message: '解除対象のホスト名が一致しません' };
    }
    if (!r.domain.id) return { ok: false as const, message: '解除対象のIDを取得できませんでした' };
    return { ok: true as const, domainId: r.domain.id };
  },

  async unregisterById(domainId) {
    const cfg = renderConfig();
    if (!cfg) return { ok: false as const, message: 'Renderが未設定です' };
    // ここではホスト名から引き直さない。
    // 引き直すと、遅れて再開した古い解除が、別の処理で作り直された
    // 新しい登録のIDを取得して消してしまう。
    const res = await unregisterDomain(cfg, domainId);
    return res.ok ? { ok: true as const, removed: true } : { ok: false as const, message: res.message || '解除に失敗しました' };
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
