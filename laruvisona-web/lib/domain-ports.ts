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
 * 応答の本文を「読まずに」解放する。
 *
 * arrayBuffer() は上限なく全部メモリに読む。転送や失敗の応答の中身は
 * 一切使わないので、読まずに捨てる。cancel() が使えない実装のときだけ、
 * 上限つきの読み取りにする（それでも全部は読まない）。
 */
async function releaseBody(res: Response): Promise<void> {
  try {
    if (res.body && !res.bodyUsed) { await res.body.cancel(); return; }
  } catch { /* noop */ }
  try { await readCapped(res, 1024); } catch { /* noop */ }
}

/**
 * Location を「転送先として使ってよいURL」かどうか検査して、ホスト名を返す。
 *
 * hostname だけを取り出すと、次のどれもが正常な転送先と同じ扱いになる:
 *   http://primary.example/            平文。所有や配信の根拠にならない
 *   https://primary.example:8443/      別ポート。同じホスト名でも別のサービス
 *   https://user:pass@primary.example/ 資格情報つき
 *   ftp://primary.example/             http/https ですらない
 *
 * 通すのは https・既定ポート（443）・資格情報なし・ホスト名ありのときだけ。
 * 通らなければ null を返し、呼び出し側は「転送先不明の転送」として扱う
 * （転送先不明では別名にならない）。
 * ここでは接続しない。文字列の検査だけ。
 */
export function redirectTargetHost(loc: string | null, base: string): string | null {
  if (!loc) return null;
  // スキームの直後の権限部が空（https:///path）。URLの解決では基点のホストを
  // 借りてしまい、転送先を書いていないのに「自分自身へ」に化ける。書式として弾く。
  if (/^[a-z][a-z0-9+.-]*:\/\/\//i.test(loc)) return null;
  let url: URL;
  try { url = new URL(loc, base); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== '443') return null;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname) return null;
  // IPアドレス直打ちや角括弧つきIPv6は、確認済みホストと一致しないので通さない
  if (hostname.startsWith('[')) return null;
  return hostname;
}

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
          await releaseBody(res);
          // https・既定443・資格情報なし・有効なホストのときだけ転送先として扱う
          return { result: 'redirected', redirectHost: redirectTargetHost(loc, origin) };
        }
        if (res.status !== 200) { await releaseBody(res); return { result: 'not_reached' }; }
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
