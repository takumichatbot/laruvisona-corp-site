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
    abTestStartedAt?: string;
    abTestAutoEndDays?: number;
    abVariantANote?: string;
    abVariantBNote?: string;
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
  const [variantNotes, setVariantNotes] = useState<Record<string, { a: string; b: string }>>({});
  const [effectSize, setEffectSize] = useState(20); // percent lift
  const [archiveExpanded, setArchiveExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/laruHP/auth/login'); return; }

        const res = await fetch('/api/sites');
        if (!res.ok) throw new Error('サイト一覧の取得に失敗しました');
        const d = await res.json();
        const loadedSites = (d.sites || []) as Site[];
        setSites(loadedSites);
        setVariantNotes(Object.fromEntries(loadedSites.map(s => [s.id, { a: s.settings_json?.abVariantANote || '', b: s.settings_json?.abVariantBNote || '' }])));
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
        body: JSON.stringify({ settings_patch: { abStats: null, abWinner: null, abTestStartedAt: null } }),
      });
      if (!res.ok) throw new Error('リセットに失敗しました');
      setSites(prev => prev.map(s => s.id === siteId
        ? { ...s, settings_json: { ...(s.settings_json || {}), abStats: undefined, abWinner: undefined, abTestStartedAt: undefined } }
        : s
      ));
      showMsg('統計をリセットしました');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'リセットに失敗しました', 'error');
    }
    setResetLoading(null);
  };

  const handleSaveVariantNotes = async (siteId: string, noteA: string, noteB: string) => {
    await fetch(`/api/sites/${siteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings_patch: { abVariantANote: noteA, abVariantBNote: noteB } }),
    });
    setSites(prev => prev.map(s => s.id === siteId
      ? { ...s, settings_json: { ...(s.settings_json || {}), abVariantANote: noteA, abVariantBNote: noteB } }
      : s
    ));
    showMsg('メモを保存しました');
  };

  const handleSetTestStart = async (siteId: string, autoEndDays: number) => {
    const now = new Date().toISOString();
    await fetch(`/api/sites/${siteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings_patch: { abTestStartedAt: now, abTestAutoEndDays: autoEndDays } }),
    });
    setSites(prev => prev.map(s => s.id === siteId
      ? { ...s, settings_json: { ...(s.settings_json || {}), abTestStartedAt: now, abTestAutoEndDays: autoEndDays } }
      : s
    ));
  };

  // Chi-square test for statistical significance (df=1)
  function chiSquareSignificance(a: number, b: number): { chi2: number; significant: boolean; confidence: string; winner: 'a' | 'b' | null } {
    const total = a + b;
    if (total < 50) return { chi2: 0, significant: false, confidence: 'サンプル不足', winner: null };
    const expected = total / 2;
    const chi2 = Math.pow(a - expected, 2) / expected + Math.pow(b - expected, 2) / expected;
    const significant = chi2 > 3.841; // p < 0.05
    const confidence = chi2 > 10.828 ? '99.9%信頼度' : chi2 > 6.635 ? '99%信頼度' : chi2 > 3.841 ? '95%信頼度' : '信頼度不足';
    const winner = significant ? (a > b ? 'a' : 'b') : null;
    return { chi2, significant, confidence, winner };
  }

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
        <Link href="/laruHP/dashboard" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          ダッシュボード
        </Link>
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
                    const testStartedAt = site.settings_json?.abTestStartedAt;
                    const autoEndDays = site.settings_json?.abTestAutoEndDays ?? 14;
                    const daysRunning = testStartedAt ? Math.floor((Date.now() - new Date(testStartedAt).getTime()) / 86400000) : null;
                    const isOverdue = daysRunning !== null && daysRunning >= autoEndDays;
                    const earlyWinner = total >= 50 && !isOverdue && winnerHint && Math.abs(pctA - pctB) >= 20;

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
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">実施中</span>
                            {daysRunning !== null && (() => {
                              const daysLeft = autoEndDays - daysRunning;
                              return (
                                <span className={`text-[10px] font-semibold ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                                  {isOverdue ? `⏰ ${autoEndDays}日超過` : `${daysRunning}日目 / ${autoEndDays}日（あと${daysLeft}日）`}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Early winner detection */}
                        {earlyWinner && (
                          <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-yellow-800">⚡ 早期リード検出 — バリアント{winnerHint}が{Math.abs(pctA - pctB)}%の差でリード中</p>
                              <p className="text-[10px] text-yellow-700 mt-0.5">サンプル{total}件で差異が大きい場合、テストを早期終了する選択肢があります</p>
                            </div>
                          </div>
                        )}

                        {/* Period tracker */}
                        {isOverdue && (() => {
                          const sig = chiSquareSignificance(aCount, bCount);
                          if (sig.significant && sig.winner) {
                            return (
                              <div className="bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-300 rounded-xl px-4 py-3 mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-bold text-amber-800">🏁 テスト終了 — バリアント{sig.winner.toUpperCase()}の採用を推奨</p>
                                  <p className="text-[10px] text-amber-700 mt-0.5">{autoEndDays}日間のテスト完了・{sig.confidence}で有意差あり</p>
                                </div>
                                <button
                                  onClick={() => handleWinner(site.id, sig.winner!)}
                                  disabled={winnerLoading === site.id}
                                  className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg disabled:opacity-50 transition-all flex-shrink-0"
                                >
                                  {sig.winner.toUpperCase()} を採用
                                </button>
                              </div>
                            );
                          }
                          return (
                            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-3 text-xs text-red-700 font-semibold flex items-center gap-2">
                              ⏰ テスト期間（{autoEndDays}日）が終了しました。勝者を確定してください。
                            </div>
                          );
                        })()}
                        {!testStartedAt && total > 0 && (
                          <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-sky-800">期間計測が開始されていません</p>
                              <p className="text-[10px] text-sky-600 mt-0.5">計測開始日を設定すると、終了日と残り日数が表示されます</p>
                            </div>
                            <button
                              onClick={() => handleSetTestStart(site.id, autoEndDays)}
                              className="text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 px-3 py-1.5 rounded-lg flex-shrink-0 transition-all"
                            >
                              今日から{autoEndDays}日計測開始
                            </button>
                          </div>
                        )}

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

                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-gray-400">合計: {total.toLocaleString()}サンプル</span>
                          <span
                            className="text-[11px] text-gray-500 cursor-help border-b border-dotted border-gray-300"
                            title="サンプル数が100件未満は統計的に不安定です。500件以上で高い信頼性が得られます。"
                          >{confidenceNote} ℹ</span>
                        </div>
                        {total < 500 && (
                          <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 mb-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-semibold text-gray-600">必要サンプル数（95%信頼度）</span>
                              <span className="text-[10px] text-gray-500">効果量: <span className="font-bold text-gray-700">{effectSize}%</span></span>
                            </div>
                            <input type="range" min={5} max={50} step={1} value={effectSize} onChange={e => setEffectSize(Number(e.target.value))}
                              className="w-full h-1.5 rounded-full accent-sky-500 mb-1.5" />
                            <div className="flex justify-between text-[9px] text-gray-400 mb-2"><span>5%</span><span>10%</span><span>20%</span><span>30%</span><span>50%</span></div>
                            {(() => {
                              const p1 = 0.5;
                              const p2 = p1 * (1 + effectSize / 100);
                              const pooled = (p1 + p2) / 2;
                              const needed = Math.ceil(2 * 1.96 * 1.96 * pooled * (1 - pooled) / Math.pow(p2 - p1, 2));
                              const remaining = Math.max(0, needed - Math.min(aCount, bCount));
                              const progress = Math.min(100, (Math.min(aCount, bCount) / needed) * 100);
                              return (
                                <>
                                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-1.5">
                                    <div
                                      className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-amber-400' : 'bg-sky-400'}`}
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                  <p className="text-[10px] text-gray-500 leading-relaxed">
                                    各バリアント約<span className="font-bold text-gray-700">{needed}件</span>（合計{needed * 2}件）が推奨 ·
                                    現在 A:{aCount} / B:{bCount}{remaining > 0 ? ` — あと約${remaining}件` : ' — ✓ 十分なサンプル'}
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                        )}

                        {/* Variant notes */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {(['a', 'b'] as const).map(v => (
                            <div key={v}>
                              <div className="flex items-center justify-between mb-1">
                                <label className={`text-[10px] font-bold ${v === 'a' ? 'text-sky-600' : 'text-purple-600'}`}>
                                  バリアント{v.toUpperCase()} メモ（仮説・変更内容）
                                </label>
                                <span className={`text-[9px] font-semibold ${(variantNotes[site.id]?.[v] || '').length > 180 ? 'text-red-500' : (variantNotes[site.id]?.[v] || '').length > 100 ? 'text-amber-500' : 'text-gray-400'}`}>
                                  {(variantNotes[site.id]?.[v] || '').length} / 200字
                                </span>
                              </div>
                              <textarea
                                value={variantNotes[site.id]?.[v] || ''}
                                onChange={e => setVariantNotes(prev => ({
                                  ...prev,
                                  [site.id]: { ...(prev[site.id] || { a: '', b: '' }), [v]: e.target.value.slice(0, 200) },
                                }))}
                                onBlur={() => {
                                  const notes = variantNotes[site.id];
                                  if (notes) handleSaveVariantNotes(site.id, notes.a, notes.b);
                                }}
                                rows={2}
                                placeholder={v === 'a' ? '例: 元のCTAボタン「詳しく見る」' : '例: 新CTAボタン「今すぐ無料相談」'}
                                className={`w-full text-[11px] border rounded-lg px-2 py-1.5 resize-none outline-none focus:ring-1 ${v === 'a' ? 'border-sky-200 focus:ring-sky-400' : 'border-purple-200 focus:ring-purple-400'}`}
                              />
                            </div>
                          ))}
                        </div>

                        {/* Statistical significance */}
                        {(() => {
                          const sig = chiSquareSignificance(aCount, bCount);
                          if (isOverdue && sig.significant && sig.winner) return null;
                          return sig.significant && sig.winner ? (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between gap-3">
                              <div>
                                <span
                                  className="text-xs font-bold text-emerald-700 cursor-help"
                                  title={`χ²値: ${sig.chi2.toFixed(2)} — ${sig.confidence === '99.9%信頼度' ? 'p < 0.001（非常に強い有意差）' : sig.confidence === '99%信頼度' ? 'p < 0.01（強い有意差）' : 'p < 0.05（有意差あり）'}`}
                                >統計的に有意な差があります（{sig.confidence}）</span>
                                <span className="text-xs text-emerald-600 ml-2">バリアント{sig.winner.toUpperCase()}が優勢です</span>
                              </div>
                              <button
                                onClick={() => handleWinner(site.id, sig.winner!)}
                                disabled={winnerLoading === site.id}
                                className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg disabled:opacity-50 transition-all flex-shrink-0"
                              >
                                {sig.winner.toUpperCase()} を自動採用
                              </button>
                            </div>
                          ) : total >= 50 ? (
                            <div className="text-xs text-gray-400 mb-3" title={`χ²統計量: ${sig.chi2.toFixed(2)}。有意差判定には χ² > 3.841（p < 0.05）が必要です。`}>χ²={sig.chi2.toFixed(2)} — {sig.confidence}（有意差なし）</div>
                          ) : null;
                        })()}

                        {/* Actions */}
                        <div className="border-t border-gray-100 pt-4 flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500 flex-1 min-w-[100px]">手動で確定:</span>
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

            {/* Completed A/B tests (collapsible archive) */}
            {completedSites.length > 0 && (
              <section>
                <button
                  onClick={() => setArchiveExpanded(v => !v)}
                  className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 hover:text-gray-600 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform duration-200 ${archiveExpanded ? 'rotate-90' : ''}`}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  アーカイブ — 終了したA/Bテスト ({completedSites.length}件)
                </button>
                {archiveExpanded && (
                  <div className="space-y-3">
                    {completedSites.map(site => {
                      const winner = site.settings_json?.abWinner;
                      return (
                        <div key={site.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-5 flex items-center gap-4 opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300">
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
                )}
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
