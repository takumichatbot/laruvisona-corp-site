'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Site {
  id: string;
  name: string;
  slug: string | null;
}

interface ClickPoint { x: number; y: number }
interface ScrollBar { depth: number; count: number; pct: number }

interface HeatmapData {
  type: 'click' | 'scroll';
  points?: ClickPoint[];
  grid?: Record<string, number>;
  total: number;
  histogram?: ScrollBar[];
}

export default function HeatmapPage() {
  const supabase = createClient();
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [viewType, setViewType] = useState<'click' | 'scroll'>('click');
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'mobile' | 'desktop'>('all');
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/laruHP/auth/login'); return; }
      const res = await fetch('/api/sites');
      const d = await res.json();
      const list = (d.sites || []) as Site[];
      setSites(list);
      if (list.length > 0) setSelectedSiteId(list[0].id);
      setSitesLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSiteId) return;
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId, viewType, deviceFilter]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch(`/api/heatmap?siteId=${selectedSiteId}&type=${viewType}&device=${deviceFilter}`);
      if (!res.ok) throw new Error('データの取得に失敗しました');
      const d = await res.json() as HeatmapData;
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    }
    setLoading(false);
  };

  // Draw heatmap on canvas after data loads
  useEffect(() => {
    if (viewType !== 'click' || !data?.points || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    if (data.points.length === 0) return;

    // Build density grid
    const density: Record<string, number> = {};
    let maxCount = 0;
    for (const p of data.points) {
      // p.x/p.y are percentages (0-100) from the API
      const gx = Math.floor((p.x / 100) * W / 8) * 8;
      const gy = Math.floor((p.y / 100) * H / 8) * 8;
      const key = `${gx},${gy}`;
      density[key] = (density[key] || 0) + 1;
      if (density[key] > maxCount) maxCount = density[key];
    }

    // Draw blobs
    for (const [key, count] of Object.entries(density)) {
      const [gx, gy] = key.split(',').map(Number);
      const intensity = count / maxCount;
      const radius = 16 + intensity * 20;

      const grad = ctx.createRadialGradient(gx + 4, gy + 4, 0, gx + 4, gy + 4, radius);
      // hot → cool colours
      if (intensity > 0.7) {
        grad.addColorStop(0, `rgba(255,50,50,${intensity * 0.9})`);
        grad.addColorStop(0.4, `rgba(255,160,0,${intensity * 0.6})`);
        grad.addColorStop(1, 'rgba(255,160,0,0)');
      } else if (intensity > 0.3) {
        grad.addColorStop(0, `rgba(255,220,0,${intensity * 0.8})`);
        grad.addColorStop(0.5, `rgba(0,200,120,${intensity * 0.4})`);
        grad.addColorStop(1, 'rgba(0,200,120,0)');
      } else {
        grad.addColorStop(0, `rgba(0,160,255,${intensity * 0.7})`);
        grad.addColorStop(1, 'rgba(0,160,255,0)');
      }

      ctx.beginPath();
      ctx.arc(gx + 4, gy + 4, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }, [data, viewType]);

  const selectedSite = sites.find(s => s.id === selectedSiteId);

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <header className="border-b border-sky-100 bg-white/90 backdrop-blur-xl shadow-sm px-6 py-4 flex items-center gap-4">
        <Link href="/laruHP/dashboard" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          ダッシュボード
        </Link>
        <h1 className="text-sm font-bold text-gray-900 mx-auto">ヒートマップ</h1>
        {selectedSite?.slug && (
          <a href={`/hp/${selectedSite.slug}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-500 border border-sky-200 px-3 py-1.5 rounded-lg transition-colors">
            サイトを開く
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        )}
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Controls */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">サイト</label>
            {sitesLoading ? (
              <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <select
                value={selectedSiteId}
                onChange={e => setSelectedSiteId(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-sky-500 transition-colors"
              >
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">種類</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['click', 'scroll'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setViewType(t)}
                  className={`px-4 py-2.5 text-xs font-bold transition-colors ${viewType === t ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {t === 'click' ? 'クリック' : 'スクロール'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">デバイス</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['all', 'mobile', 'desktop'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => { setDeviceFilter(d); }}
                  className={`px-3 py-2.5 text-xs font-bold transition-colors ${deviceFilter === d ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {d === 'all' ? '全部' : d === 'mobile' ? '📱' : '🖥'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={loading || !selectedSiteId}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg transition-colors flex-shrink-0"
          >
            {loading ? '読み込み中...' : '更新'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-3 rounded-xl">{error}</div>
        )}

        {/* Results */}
        {data && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                {viewType === 'click' ? 'クリック' : 'スクロール'}データ
              </span>
              <span className="text-xs text-gray-400">過去30日間 · {data.total.toLocaleString()}件</span>
            </div>

            {data.total === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
                <div className="text-5xl mb-4">📊</div>
                <p className="font-bold text-gray-600">データがまだありません</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">サイトが訪問されると自動的に計測されます</p>
                <Link href="/laruHP/builder" className="text-xs text-sky-600 hover:text-sky-500 border border-sky-200 px-4 py-2 rounded-lg transition-colors font-semibold">
                  サイトを確認・公開する →
                </Link>
              </div>
            ) : viewType === 'click' ? (
              /* Click heatmap canvas */
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">クリックヒートマップ <span className="text-gray-400 font-normal ml-1">（ビューポート比率で正規化）</span></p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>低</span>
                    <div className="w-20 h-2.5 rounded-full" style={{ background: 'linear-gradient(to right, #60a5fa, #fbbf24, #ef4444)' }} />
                    <span>高</span>
                  </div>
                </div>
                <div className="p-4 bg-slate-900 flex justify-center">
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={400}
                    className="rounded-lg w-full max-w-[640px]"
                  />
                </div>
                <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
                  <p className="text-[11px] text-gray-400">赤いほどクリックが集中しているエリアです。CTAや重要要素の配置に活用してください。</p>
                </div>
              </div>
            ) : (
              /* Scroll depth bars */
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs font-bold text-gray-700 mb-5">スクロール到達率</h3>
                <div className="space-y-4">
                  {(data.histogram || []).map(bar => (
                    <div key={bar.depth}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-gray-600">{bar.depth}% まで到達</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{bar.count.toLocaleString()}セッション</span>
                          <span className={`text-xs font-bold tabular-nums w-10 text-right ${
                            bar.pct >= 70 ? 'text-green-600' : bar.pct >= 40 ? 'text-amber-600' : 'text-red-500'
                          }`}>{bar.pct}%</span>
                        </div>
                      </div>
                      <div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className={`h-full rounded-lg transition-all duration-700 ${
                            bar.pct >= 70 ? 'bg-green-400' : bar.pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${bar.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 bg-blue-50 border border-blue-100 rounded-xl p-4">
                  {(() => {
                    const halfDepth = data.histogram?.find(b => b.depth === 50);
                    const pct50 = halfDepth?.pct ?? 0;
                    if (pct50 < 30) return (
                      <p className="text-xs text-blue-700"><span className="font-bold">改善ポイント:</span> ページの半分まで到達するユーザーが{pct50}%と少なめです。ファーストビューをより魅力的にすることで改善できます。</p>
                    );
                    if (pct50 < 60) return (
                      <p className="text-xs text-blue-700"><span className="font-bold">まあまあ:</span> 半分までのスクロール率は{pct50}%です。CTAをファーストビューに追加するとコンバージョンが上がる可能性があります。</p>
                    );
                    return (
                      <p className="text-xs text-blue-700"><span className="font-bold">良好:</span> {pct50}%のユーザーがページ半分まで到達しています。コンテンツへの関心が高い状態です。</p>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {!data && !loading && !error && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <div className="text-5xl mb-4">🔥</div>
            <p className="text-sm font-semibold text-gray-600">サイトを選択してデータを読み込んでください</p>
          </div>
        )}
      </div>
    </div>
  );
}
