'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface AbStats {
  a?: number;
  b?: number;
}

interface Site {
  id: string;
  name: string;
  slug: string | null;
  published: boolean;
  settings_json: {
    abStats?: AbStats;
    abWinner?: 'a' | 'b';
    abEnabled?: boolean;
  } | null;
}

export default function AbTestPage() {
  const supabase = createClient();
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [winnerLoading, setWinnerLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' }>({ text: '', type: 'success' });
  const [resetLoading, setResetLoading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/laruHP/auth/login'); return; }

        const res = await fetch('/api/sites');
        if (!res.ok) throw new Error('サイト一覧の取得に失敗しました');
        const d = await res.json();
        setSites((d.sites || []) as Site[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'success' }), 4000);
  };

  const handleWinner = async (siteId: string, winner: 'a' | 'b') => {
    const label = winner.toUpperCase();
    if (!confirm(`バリアント${label}を勝者として確定し、A/Bテストを終了しますか？`)) return;
    setWinnerLoading(siteId);
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings_patch: { abStats: null, abWinner: winner } }),
      });
      if (!res.ok) throw new Error('確定に失敗しました');
      setSites(prev => prev.map(s => s.id === siteId
        ? { ...s, settings_json: { ...(s.settings_json || {}), abStats: undefined, abWinner: winner } }
        : s
      ));
      showMsg(`バリアント${label}を確定しました。A/Bテストを終了しました。`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '確定に失敗しました', 'error');
    }
    setWinnerLoading(null);
  };

  const handleReset = async (siteId: string) => {
    if (!confirm('A/Bテストの統計をリセットしますか？')) return;
    setResetLoading(siteId);
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings_patch: { abStats: null, abWinner: null } }),
      });
      if (!res.ok) throw new Error('リセットに失敗しました');
      setSites(prev => prev.map(s => s.id === siteId
        ? { ...s, settings_json: { ...(s.settings_json || {}), abStats: undefined, abWinner: undefined } }
        : s
      ));
      showMsg('統計をリセットしました');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'リセットに失敗しました', 'error');
    }
    setResetLoading(null);
  };

  const activeSites = sites.filter(s => {
    const stats = s.settings_json?.abStats;
    return stats && ((stats.a || 0) + (stats.b || 0) > 0);
  });

  const completedSites = sites.filter(s => s.settings_json?.abWinner);

  const sitesWithNoTest = sites.filter(s => {
    const stats = s.settings_json?.abStats;
    const noData = !stats || ((stats.a || 0) + (stats.b || 0) === 0);
    return noData && !s.settings_json?.abWinner;
  });

  if (error) {
    return (
      <div className="min-h-screen bg-sky-50 flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 font-semibold">{error}</p>
        <button onClick={() => location.reload()} className="text-sm text-sky-600 border border-sky-200 px-4 py-2 rounded-lg">再読み込み</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <header className="border-b border-sky-100 bg-white/90 backdrop-blur-xl shadow-sm px-6 py-4 flex items-center gap-4">
        <Link href="/laruHP/dashboard" className="text-gray-500 hover:text-gray-700 text-sm transition-colors">← ダッシュボード</Link>
        <h1 className="text-sm font-bold text-gray-900 mx-auto">A/Bテスト結果</h1>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">

        {/* Global message */}
        {msg.text && (
          <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${msg.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl p-6 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
                <div className="h-8 bg-gray-100 rounded mb-2" />
                <div className="h-8 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Active A/B tests */}
            {activeSites.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">実施中のA/Bテスト</h2>
                <div className="space-y-4">
                  {activeSites.map(site => {
                    const stats = site.settings_json?.abStats!;
                    const aCount = stats.a || 0;
                    const bCount = stats.b || 0;
                    const total = aCount + bCount;
                    const pctA = total > 0 ? Math.round(aCount / total * 100) : 50;
                    const pctB = 100 - pctA;
                    const winnerHint = pctA > pctB + 5 ? 'A' : pctB > pctA + 5 ? 'B' : null;
                    const confidenceNote = total < 100 ? 'サンプル数が少ないため、まだ判断は早いです' : total < 500 ? '統計的信頼性が高まりつつあります' : '十分なサンプル数です';

                    return (
                      <div key={site.id} className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <h3 className="font-bold text-sm text-gray-900">{site.name}</h3>
                            {site.slug && (
                              <a
                                href={`/hp/${site.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-sky-500 hover:underline"
                              >
                                /hp/{site.slug}
                              </a>
                            )}
                          </div>
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex-shrink-0">実施中</span>
                        </div>

                        {/* Stats bars */}
                        <div className="space-y-3 mb-4">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-sky-700">バリアント A</span>
                              <span className="text-xs text-gray-500">{aCount.toLocaleString()}PV — {pctA}%{winnerHint === 'A' ? ' 👑 リード中' : ''}</span>
                            </div>
                            <div className="h-5 bg-sky-50 border border-sky-100 rounded-lg overflow-hidden">
                              <div
                                className="h-full bg-sky-400 rounded-lg transition-all duration-700"
                                style={{ width: `${pctA}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-purple-700">バリアント B</span>
                              <span className="text-xs text-gray-500">{bCount.toLocaleString()}PV — {pctB}%{winnerHint === 'B' ? ' 👑 リード中' : ''}</span>
                            </div>
                            <div className="h-5 bg-purple-50 border border-purple-100 rounded-lg overflow-hidden">
                              <div
                                className="h-full bg-purple-400 rounded-lg transition-all duration-700"
                                style={{ width: `${pctB}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[11px] text-gray-400">合計: {total.toLocaleString()}サンプル</span>
                          <span className="text-[11px] text-gray-500">{confidenceNote}</span>
                        </div>

                        {/* Actions */}
                        <div className="border-t border-gray-100 pt-4 flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500 flex-1 min-w-[100px]">勝者を確定:</span>
                          <button
                            onClick={() => handleWinner(site.id, 'a')}
                            disabled={winnerLoading === site.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-sky-100 text-sky-700 hover:bg-sky-200 font-bold disabled:opacity-50 transition-all"
                          >
                            A に決定
                          </button>
                          <button
                            onClick={() => handleWinner(site.id, 'b')}
                            disabled={winnerLoading === site.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 font-bold disabled:opacity-50 transition-all"
                          >
                            B に決定
                          </button>
                          <button
                            onClick={() => handleReset(site.id)}
                            disabled={resetLoading === site.id}
                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-all ml-auto"
                          >
                            {resetLoading === site.id ? '...' : 'リセット'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Completed A/B tests */}
            {completedSites.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">終了したA/Bテスト</h2>
                <div className="space-y-3">
                  {completedSites.map(site => {
                    const winner = site.settings_json?.abWinner;
                    return (
                      <div key={site.id} className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0 ${winner === 'a' ? 'bg-sky-100 text-sky-700' : 'bg-purple-100 text-purple-700'}`}>
                          {winner?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-gray-900">{site.name}</div>
                          <div className="text-xs text-gray-500">バリアント{winner?.toUpperCase()}が採用されました</div>
                        </div>
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold flex-shrink-0">完了</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* No test running */}
            {activeSites.length === 0 && completedSites.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
                <div className="text-4xl mb-4">🧪</div>
                <p className="font-bold text-gray-700 mb-1">A/Bテストを実施していません</p>
                <p className="text-xs text-gray-500 mb-5">ビルダーでバリアントBのHTMLを設定し、A/Bテストを開始できます。</p>
                <Link
                  href="/laruHP/builder"
                  className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
                >
                  ビルダーを開く
                </Link>
              </div>
            )}

            {/* Sites with no test data (info) */}
            {sitesWithNoTest.length > 0 && activeSites.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">テストなし</h2>
                <div className="flex flex-wrap gap-2">
                  {sitesWithNoTest.map(site => (
                    <span key={site.id} className="text-[11px] bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full">
                      {site.name}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
