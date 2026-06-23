'use client';
import { useState, useEffect, useId } from 'react';
import Link from 'next/link';

interface GscSummary {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscDateRow {
  date: string;
  clicks: number;
  impressions: number;
}

interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

interface GscData {
  connected: boolean;
  revoked?: boolean;
  siteUrl?: string | null;
  summary?: GscSummary;
  dates?: GscDateRow[];
  topQueries?: GscQueryRow[];
}

function ClicksChart({ data }: { data: GscDateRow[] }) {
  const uid = useId();
  const maxClicks = Math.max(...data.map(d => d.clicks), 1);
  const W = 300; const H = 48;
  const padX = 2; const padY = 4;

  const pts = data.map((d, i) => ({
    x: padX + (data.length > 1 ? i / (data.length - 1) : 0.5) * (W - 2 * padX),
    y: padY + (1 - d.clicks / maxClicks) * (H - 2 * padY),
  }));

  const line = pts.length < 2 ? '' : pts.map((p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const prev = pts[i - 1];
    const cx1 = prev.x + (p.x - prev.x) / 3;
    const cx2 = p.x - (p.x - prev.x) / 3;
    return `C${cx1},${prev.y} ${cx2},${p.y} ${p.x},${p.y}`;
  }).join(' ');

  const area = line ? `${line} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z` : '';
  const gradId = `gsc${uid.replace(/:/g, '')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="48" className="block">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#${gradId})`} />}
      {line && <path d={line} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />}
      {pts.length > 0 && (
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill="#10b981" />
      )}
    </svg>
  );
}

export default function SearchConsoleWidget() {
  const [data, setData] = useState<GscData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch('/api/search-console/data')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setFetchError(true); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl px-5 py-4 mb-6 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-40 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-60" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="bg-white border border-red-100 rounded-xl px-5 py-4 mb-6 flex items-center gap-3 text-sm text-red-500">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
          <line x1="8" y1="4.5" x2="8" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="8" cy="11" r="0.75" fill="currentColor"/>
        </svg>
        Search Console データの取得に失敗しました。しばらくしてから再読み込みしてください。
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl px-5 py-4 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Google Search Console</p>
            <p className="text-xs text-gray-500">連携すると検索クリック数・順位が確認できます</p>
          </div>
        </div>
        <Link
          href="/laruHP/settings#gsc"
          className="text-xs bg-white border border-gray-200 hover:border-orange-200 hover:text-orange-600 text-gray-600 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex-shrink-0"
        >
          Googleと連携 →
        </Link>
      </div>
    );
  }

  if (!data.siteUrl) {
    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl px-5 py-4 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0 text-green-600 font-bold text-[10px]">GSC</div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Google Search Console <span className="text-green-600 text-xs font-normal ml-1">連携済み</span></p>
            <p className="text-xs text-gray-500">設定からプロパティを選択してください</p>
          </div>
        </div>
        <Link href="/laruHP/settings#gsc" className="text-xs text-sky-600 hover:text-sky-500 transition-colors whitespace-nowrap flex-shrink-0">
          プロパティを設定 →
        </Link>
      </div>
    );
  }

  const { summary, dates = [], topQueries = [] } = data;
  const s = summary!;

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl mb-6 overflow-hidden">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0 text-green-600 font-bold text-[10px]">GSC</div>
          <div>
            <p className="text-sm font-semibold text-gray-900">検索パフォーマンス <span className="text-gray-400 font-normal text-xs ml-1">過去28日</span></p>
            <p className="text-[11px] text-gray-400 truncate max-w-[240px]">{data.siteUrl}</p>
          </div>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-gray-400 flex-shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {/* Summary metrics */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { label: 'クリック', value: s.clicks.toLocaleString(), sub: '回', color: 'text-green-600' },
              { label: '表示回数', value: s.impressions.toLocaleString(), sub: '回', color: 'text-blue-600' },
              { label: 'CTR', value: `${s.ctr}`, sub: '%', color: 'text-purple-600' },
              { label: '平均順位', value: `${s.position}`, sub: '位', color: 'text-orange-500' },
            ].map(m => (
              <div key={m.label} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 text-center">
                <p className={`text-lg font-bold ${m.color}`}>{m.value}<span className="text-[10px] font-normal text-gray-400 ml-0.5">{m.sub}</span></p>
                <p className="text-[10px] text-gray-500 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Clicks chart */}
          {dates.length > 1 && (
            <div className="mt-4 bg-green-50 border border-green-100 rounded-lg px-3 pt-2.5 pb-2">
              <p className="text-[10px] text-gray-500 mb-1.5">クリック推移</p>
              <ClicksChart data={dates} />
              <div className="flex justify-between mt-0.5">
                <span className="text-[8px] text-gray-400">{dates[0]?.date.slice(5)}</span>
                <span className="text-[8px] text-gray-400">{dates[dates.length - 1]?.date.slice(5)}</span>
              </div>
            </div>
          )}

          {/* Keyword ranking */}
          {topQueries.length > 0 && (() => {
            const maxImpr = Math.max(...topQueries.map(q => q.impressions), 1);
            return (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">キーワードランキング TOP {topQueries.length}</p>
                  <div className="flex items-center gap-3 text-[9px] text-gray-400">
                    <span>クリック</span><span>表示</span><span>CTR</span><span className="w-8 text-right">順位</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {topQueries.map((q, i) => {
                    const ctr = q.impressions > 0 ? ((q.clicks / q.impressions) * 100).toFixed(1) : '0.0';
                    const pos = q.position;
                    const posColor = pos <= 3 ? 'text-green-600 bg-green-50 border-green-200' : pos <= 10 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-500 bg-red-50 border-red-200';
                    const barPct = (q.impressions / maxImpr) * 100;
                    return (
                      <div key={i} className="relative bg-gray-50 rounded-lg px-3 py-2 overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 bg-sky-100/60 rounded-lg transition-all" style={{ width: `${barPct}%` }} />
                        <div className="relative flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 font-mono w-4 flex-shrink-0">{i + 1}</span>
                          <span className="text-xs text-gray-700 flex-1 truncate">{q.query}</span>
                          <span className="text-[10px] text-green-600 font-bold flex-shrink-0 w-12 text-right">{q.clicks.toLocaleString()}</span>
                          <span className="text-[10px] text-blue-500 flex-shrink-0 w-12 text-right">{q.impressions.toLocaleString()}</span>
                          <span className="text-[10px] text-purple-500 flex-shrink-0 w-10 text-right">{ctr}%</span>
                          <span className={`text-[10px] font-bold flex-shrink-0 w-10 text-right px-1.5 py-0.5 rounded border ${posColor}`}>{pos}位</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[9px] text-gray-300 mt-2 text-center">バーの長さ = 表示回数の相対量</p>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
