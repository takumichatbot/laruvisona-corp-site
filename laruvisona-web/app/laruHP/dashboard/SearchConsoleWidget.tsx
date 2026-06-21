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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch('/api/search-console/data')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl px-5 py-4 mb-6 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-40 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-60" />
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

          {/* Top queries */}
          {topQueries.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">検索クエリ TOP {topQueries.length}</p>
              <div className="space-y-1.5">
                {topQueries.map((q, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-[10px] text-gray-400 font-mono w-4 flex-shrink-0">{i + 1}</span>
                    <span className="text-xs text-gray-700 flex-1 truncate">{q.query}</span>
                    <span className="text-[10px] text-green-600 font-semibold flex-shrink-0">{q.clicks}クリック</span>
                    <span className="text-[10px] text-orange-500 flex-shrink-0">{q.position}位</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
