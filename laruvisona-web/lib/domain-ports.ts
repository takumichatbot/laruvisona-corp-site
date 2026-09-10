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

/**
 * 到達確認のポート。
 *
 * 2つだけ差し替えられるようにしてある。既定は本番の値で、本番のコードは
 * どちらも渡さない（下の probePort がそれ）。差し替えるのは、実際に
 * ソケットを開く回帰テスト（tests/domain-probe-adapter.test.ts）で
 * ループバックの検証用サーバへ繋ぐときだけ。
 *   fetchUrl … 既定 safeFetch。SSRF検査とリダイレクト制御はこの中にある
 *   originOf … 既定 `https://<host>`。検証用サーバは平文HTTPなので差し替える
 */
export function makeProbePort(deps: {
  fetchUrl?: typeof safeFetch;
  originOf?: (host: string) => string;
} = {}): ProbePort {
  const fetchUrl = deps.fetchUrl ?? safeFetch;
  const originOf = deps.originOf ?? ((host: string) => `https://${host}`);

  return {
    async reachesService(host) {
      // 固定の応答を返すだけの確認は、別のサーバーで真似できる。
      // 毎回の nonce と期限に対して、共有鍵でしか作れない署名が返るかで見る。
      const secret = probeSecret();
      if (!secret) return { result: 'unavailable' };

      const c = createChallenge(secret, host);
      const qs = new URLSearchParams({ host: c.host, nonce: c.nonce, exp: String(c.exp), sig: c.sig });
      const origin = originOf(host);
      try {
        // リダイレクトは追わない。転送先の応答で「届いた」と判断しないため。
        // redirect:'manual' なので 3xx はそのまま返ってくる（例外にならない）。
        // 転送先へは1回も接続しない。Location のホスト名だけを持ち帰る。
        const res = await fetchUrl(
          `${origin}/api/domain-probe?${qs.toString()}`,
          { method: 'GET', headers: { accept: 'application/json' } },
          { timeoutMs: 8000, redirect: 'manual' },
        );
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location');
          try { await res.arrayBuffer(); } catch { /* noop */ }
          let redirectHost: string | null = null;
          if (loc) {
            try { redirectHost = new URL(loc, origin).hostname.toLowerCase(); } catch { /* noop */ }
          }
          return { result: 'redirected', redirectHost };
        }
        if (res.status !== 200) { try { await res.arrayBuffer(); } catch { /* noop */ } return { result: 'not_reached' }; }
        const body = await readCapped(res, 4096);
        const json = JSON.parse(body) as { ok?: boolean; proof?: string };
        if (!json.ok || !json.proof) return { result: 'not_reached' };
        return { result: verifyProof(secret, c, json.proof) ? 'reached' : 'not_reached' };
      } catch {
        // 接続できない・TLSが張れない・時間切れ。
        // ここで「転送されている」と推測しない（Locationが取れていないため）。
        return { result: 'not_reached' };
      }
    },
  };
}

export const probePort: ProbePort = makeProbePort();
