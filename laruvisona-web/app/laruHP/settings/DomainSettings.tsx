'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * 独自ドメインの設定画面。
 *
 * 画面の目的は「いま何が終わっていて、次に何をすればいいか」を1画面で示すこと。
 * 以前は保存すると「保存しました。次にDNSを設定してください」とだけ出て、
 * 所有確認・DNSの反映・SSLの発行が終わったのかは分からなかった。
 */

type Status = 'pending_ownership' | 'pending_dns' | 'ssl_pending' | 'connected' | 'failed' | 'legacy' | 'release_pending';

interface DnsRecord {
  purpose: string;
  type: 'TXT' | 'CNAME' | 'A';
  name: string;
  value: string;
  recommended?: boolean;
  group?: string;
  note?: string;
}

interface DomainEntry {
  host: string;
  status: Status;
  label: string;
  next: string;
  /** いまこのサイトの正規URLとして配信されているか */
  isPrimary: boolean;
  /** 接続は確認できているが、まだ正規URLではない（切替できる） */
  canBePrimary: boolean;
  lastError: string | null;
  lastCheckedAt: string | null;
  records: DnsRecord[];
}

interface SiteEntry {
  id: string;
  name: string;
  liveDomain: string | null;
  domains: DomainEntry[];
  notes: string[];
}

const STATUS_STYLE: Record<Status, string> = {
  pending_ownership: 'bg-amber-100 text-amber-800',
  pending_dns: 'bg-amber-100 text-amber-800',
  ssl_pending: 'bg-sky-100 text-sky-800',
  connected: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  legacy: 'bg-slate-200 text-slate-700',
  release_pending: 'bg-orange-100 text-orange-800',
};

/** 進み方を4段階で示す。どこで止まっているかが分かるようにする */
const STEPS: { key: string; label: string }[] = [
  { key: 'own', label: '所有確認' },
  { key: 'dns', label: 'DNS接続' },
  { key: 'ssl', label: 'SSL' },
  { key: 'live', label: '公開' },
];

function stepIndex(status: Status): number {
  switch (status) {
    case 'pending_ownership': return 0;
    case 'pending_dns': return 1;
    case 'ssl_pending': return 2;
    case 'connected': return 4;
    case 'legacy': return 4;
    case 'failed': return 0;
    case 'release_pending': return 0;
  }
}

export default function DomainSettings() {
  const [sites, setSites] = useState<SiteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, { text: string; type: 'success' | 'error' | 'info' }>>({});

  const loadOne = useCallback(async (id: string, name: string): Promise<SiteEntry> => {
    try {
      const res = await fetch(`/api/sites/${id}/domain`);
      const d = await res.json() as { liveDomain?: string | null; domains?: DomainEntry[]; notes?: string[] };
      return { id, name, liveDomain: d.liveDomain ?? null, domains: d.domains ?? [], notes: d.notes ?? [] };
    } catch {
      return { id, name, liveDomain: null, domains: [], notes: [] };
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sites');
      const d = await res.json() as { sites?: { id: string; name: string }[] };
      const list = d.sites ?? [];
      const filled = await Promise.all(list.map(s => loadOne(s.id, s.name)));
      setSites(filled);
    } finally {
      setLoading(false);
    }
  }, [loadOne]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const refreshSite = async (id: string, name: string) => {
    const next = await loadOne(id, name);
    setSites(prev => prev.map(s => (s.id === id ? next : s)));
  };

  const handleAdd = async (site: SiteEntry) => {
    const value = (input[site.id] || '').trim();
    if (!value) return;
    setBusy(site.id);
    setMsg(p => ({ ...p, [site.id]: { text: '', type: 'info' } }));
    try {
      const res = await fetch(`/api/sites/${site.id}/domain`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customDomain: value }),
      });
      const d = await res.json() as { error?: string; host?: string };
      if (!res.ok) {
        setMsg(p => ({ ...p, [site.id]: { text: d.error || '登録に失敗しました', type: 'error' } }));
      } else {
        setInput(p => ({ ...p, [site.id]: '' }));
        setMsg(p => ({ ...p, [site.id]: { text: `${d.host} を追加しました。下のDNSレコードを設定してから「確認する」を押してください。`, type: 'success' } }));
        await refreshSite(site.id, site.name);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleVerify = async (site: SiteEntry, host: string) => {
    // 解除待ちの行では、確認ではなく解除の再試行を行う
    const entry = site.domains.find(x => x.host === host);
    if (entry?.status === 'release_pending') { await handleRemove(site, host); return; }
    setBusy(`${site.id}:${host}`);
    setMsg(p => ({ ...p, [site.id]: { text: '確認しています…', type: 'info' } }));
    try {
      const res = await fetch(`/api/sites/${site.id}/domain/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host }),
      });
      const d = await res.json() as { error?: string; label?: string; next?: string; switched?: boolean };
      if (!res.ok) {
        setMsg(p => ({ ...p, [site.id]: { text: d.error || '確認に失敗しました', type: 'error' } }));
      } else {
        const done = d.switched ? '独自ドメインでの公開に切り替えました。' : '';
        setMsg(p => ({ ...p, [site.id]: { text: `${d.label}：${d.next}${done}`, type: d.label === '接続済み' ? 'success' : 'info' } }));
      }
      await refreshSite(site.id, site.name);
    } finally {
      setBusy(null);
    }
  };

  // DNSの値は手で書き写すと間違えるのでコピーできるようにする。
  // クリップボードが使えない環境（HTTP・古い端末）でも、値は画面に出したままにする。
  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(c => (c === key ? null : c)), 1500);
    } catch {
      setCopied(null);
    }
  };

  const handleMakePrimary = async (site: SiteEntry, host: string) => {
    setBusy(`${site.id}:${host}`);
    try {
      const res = await fetch(`/api/sites/${site.id}/domain/primary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host }),
      });
      const d = await res.json() as { error?: string };
      setMsg(p => ({
        ...p,
        [site.id]: res.ok
          ? { text: `${host} を主な公開URLにしました。旧ドメインは接続したまま残っています。`, type: 'success' }
          : { text: d.error || '切り替えに失敗しました', type: 'error' },
      }));
      await refreshSite(site.id, site.name);
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (site: SiteEntry, host: string) => {
    setBusy(`${site.id}:${host}`);
    try {
      const res = await fetch(`/api/sites/${site.id}/domain?host=${encodeURIComponent(host)}`, { method: 'DELETE' });
      const d = await res.json() as { error?: string; released?: boolean; message?: string | null };
      setMsg(p => ({
        ...p,
        [site.id]: !res.ok
          ? { text: d.error || '解除に失敗しました', type: 'error' }
          : d.released
            ? { text: `${host} を解除しました`, type: 'success' }
            : { text: d.message || `${host} の配信は停止しましたが、外部側の解除が残っています`, type: 'info' },
      }));
      await refreshSite(site.id, site.name);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="text-xs text-gray-500">読み込み中…</p>;
  }

  if (sites.length === 0) {
    return <p className="text-xs text-gray-500">サイトを作成すると、独自ドメインを設定できます。</p>;
  }

  return (
    <section className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
      <h2 className="font-bold text-sm text-gray-900 mb-1">独自ドメイン設定</h2>
      <p className="text-xs text-gray-500 mb-5">
        お持ちのドメインを、このサイトの公開URLにします。ドメインを追加すると設定すべきDNSレコードが表示されます。
      </p>

      <div className="space-y-8">
        {sites.map(site => (
          <div key={site.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800">{site.name}</span>
              {site.liveDomain && (
                <span className="text-[10px] text-gray-500">主な公開URL: {site.liveDomain}</span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                inputMode="url"
                autoComplete="off"
                value={input[site.id] ?? ''}
                onChange={e => setInput(p => ({ ...p, [site.id]: e.target.value }))}
                placeholder="example.com"
                aria-label={`${site.name} に追加するドメイン`}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-sky-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => handleAdd(site)}
                disabled={busy === site.id || !(input[site.id] || '').trim()}
                className="flex-shrink-0 text-sm bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-4 min-h-[44px] rounded-lg transition-all"
              >
                {busy === site.id ? '…' : '追加'}
              </button>
            </div>

            {msg[site.id]?.text && (
              <p className={`text-[11px] font-semibold ${msg[site.id].type === 'error' ? 'text-red-600' : msg[site.id].type === 'success' ? 'text-green-600' : 'text-sky-700'}`}>
                {msg[site.id].text}
              </p>
            )}

            {site.domains.map(d => {
              const at = stepIndex(d.status);
              return (
                <div key={d.host} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-gray-900">{d.host}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_STYLE[d.status]}`}>{d.label}</span>
                    {d.isPrimary && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-sky-600 text-white">主な公開URL</span>}
                  </div>

                  {/* どこまで進んだか */}
                  <ol className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    {STEPS.map((s, i) => (
                      <li key={s.key} className={`px-2 py-0.5 rounded-full ${i < at ? 'bg-green-100 text-green-700 font-bold' : i === at ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-gray-100 text-gray-400'}`}>
                        {s.label}
                      </li>
                    ))}
                  </ol>

                  <p className="text-[11px] text-gray-600">{d.next}</p>
                  {d.lastError && <p className="text-[11px] text-red-600">前回の確認: {d.lastError}</p>}

                  {d.status !== 'connected' && d.records.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                      <p className="text-[11px] font-bold text-gray-700">お使いのDNSに、次のレコードを追加してください</p>
                      <ul className="space-y-2.5">
                        {d.records.map((r, i) => (
                          <li key={`${r.type}:${r.name}`} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                            <p className="text-[11px] font-bold text-gray-800">
                              {i + 1}. {r.purpose}
                              <span className="ml-2 font-mono font-normal text-gray-500">種類: {r.type}</span>
                              {r.group && (
                                <span className={`ml-2 font-normal ${r.recommended ? 'text-sky-700' : 'text-gray-400'}`}>
                                  {r.recommended ? '← こちらの可能性が高い' : '（どちらか一方でかまいません）'}
                                </span>
                              )}
                            </p>
                            {([['名前', r.name], ['値', r.value]] as const).map(([labelText, val]) => (
                              <div key={labelText} className="flex items-start gap-2">
                                <span className="w-9 shrink-0 text-[10px] text-gray-500 pt-2">{labelText}</span>
                                <code className="flex-1 min-w-0 block bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-[11px] text-gray-900 break-all">
                                  {val}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => copy(`${d.host}:${r.type}:${labelText}`, val)}
                                  aria-label={`${r.purpose}の${labelText}をコピー`}
                                  className="shrink-0 text-[10px] border border-gray-200 text-gray-600 hover:border-sky-300 hover:text-sky-700 px-2 min-h-[44px] rounded-lg transition-colors"
                                >
                                  {copied === `${d.host}:${r.type}:${labelText}` ? '完了' : 'コピー'}
                                </button>
                              </div>
                            ))}
                          </li>
                        ))}
                      </ul>
                      {d.records.filter(r => r.note).map(r => (
                        <p key={r.name} className="text-[10px] text-gray-500">{r.note}</p>
                      ))}
                      {site.notes.map(n => (
                        <p key={n} className="text-[10px] text-gray-500">{n}</p>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleVerify(site, d.host)}
                      disabled={busy === `${site.id}:${d.host}`}
                      className="text-xs border border-sky-300 text-sky-700 hover:bg-sky-50 px-3 min-h-[44px] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy === `${site.id}:${d.host}`
                        ? '確認中…'
                        : d.status === 'release_pending' ? '解除を再試行' : '確認する'}
                    </button>
                    {d.canBePrimary && (
                      <button
                        type="button"
                        onClick={() => handleMakePrimary(site, d.host)}
                        disabled={busy === `${site.id}:${d.host}`}
                        className="text-xs bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 min-h-[44px] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        主な公開URLにする
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(site, d.host)}
                      disabled={busy === `${site.id}:${d.host}`}
                      className="text-xs border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 px-3 min-h-[44px] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {d.status === 'release_pending' ? '記録を削除' : '解除'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
