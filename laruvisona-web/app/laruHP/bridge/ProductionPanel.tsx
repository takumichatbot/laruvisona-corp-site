'use client';
import { useState, useEffect } from 'react';
import { Activity, Play, Square, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';

interface StatusEntry { ts: string; status: number; ms: number; ok: boolean; error?: string; }

interface Props {
  projectName: string;
  macOnline: boolean;
  onSend: (msg: Record<string, unknown>) => void;
  monitorActive: boolean;
  statusHistory: StatusEntry[];
  latestEntry: StatusEntry | null;
  incidentLog: { ts: string; error: string; fixOutput: string; fixDone: boolean }[];
}

const DEFAULT_URLS: Record<string, string> = {
  laruvisona: 'https://laruvisona.jp',
  larubot: 'https://larubot.jp',
  flastal: 'https://flastal.com',
};

// ── SVG Charts ────────────────────────────────────────────────────────────────

function DonutRing({ percent, color }: { percent: number; color: string }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="9"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        <text x="40" y="44" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="sans-serif">{percent}%</text>
      </svg>
      <p className="text-gray-600 text-xs">稼働率</p>
    </div>
  );
}

function ResponseAreaChart({ entries }: { entries: StatusEntry[] }) {
  const W = 260, H = 56;
  const slice = entries.slice(-40);
  if (slice.length < 2) return null;
  const msValues = slice.map(e => e.ms);
  const maxMs = Math.max(...msValues, 200);
  const minMs = Math.min(...msValues);
  const pts = slice.map((e, i) => ({
    x: (i / (slice.length - 1)) * W,
    y: H - ((e.ms - 0) / (maxMs * 1.1)) * (H - 6) - 3,
    ok: e.ok,
  }));
  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L${W},${H} L0,${H} Z`;
  return (
    <div className="space-y-1">
      <div className="flex justify-between px-0.5">
        <span className="text-gray-700 text-xs">{minMs}ms min</span>
        <span className="text-gray-700 text-xs">{maxMs}ms max</span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="prodAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#prodAreaGrad)" />
        <path d={lineD} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinejoin="round" />
        {pts.map((p, i) => !slice[i].ok ? (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#f87171" />
        ) : null)}
        {/* Latest dot */}
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="4" fill={pts[pts.length - 1].ok ? '#34d399' : '#f87171'} />
      </svg>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductionPanel({ projectName, macOnline, onSend, monitorActive, statusHistory, latestEntry, incidentLog }: Props) {
  const [url, setUrl] = useState('');
  const [interval, setInterval2] = useState(60);
  const [autoFix, setAutoFix] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`prod_url_${projectName}`);
    if (saved) setUrl(saved);
    else {
      const def = DEFAULT_URLS[projectName.toLowerCase().split(' ')[0]] || '';
      setUrl(def);
    }
  }, [projectName]);

  const startMonitor = () => {
    if (!url.trim() || !macOnline) return;
    localStorage.setItem(`prod_url_${projectName}`, url);
    onSend({ type: 'production_monitor_start', url: url.trim(), interval, auto_fix: autoFix });
  };

  const stopMonitor = () => onSend({ type: 'production_monitor_stop' });

  const avgMs = statusHistory.length > 0
    ? Math.round(statusHistory.reduce((s, e) => s + e.ms, 0) / statusHistory.length)
    : null;
  const uptime = statusHistory.length > 0
    ? Math.round(statusHistory.filter(e => e.ok).length / statusHistory.length * 100)
    : null;
  const uptimeColor = uptime === null ? '#4b5563' : uptime >= 99 ? '#34d399' : uptime >= 95 ? '#fbbf24' : '#f87171';

  const statusColor = !latestEntry ? '#4b5563' : latestEntry.ok ? '#34d399' : '#f87171';

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="text-center pb-1">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #0284c7 100%)', boxShadow: `0 0 30px ${statusColor}55` }}>
          <Activity size={24} className="text-white" />
        </div>
        <p className="text-white font-bold text-base">Production AI</p>
        <p className="text-gray-500 text-xs mt-1">{projectName} · 本番監視・自動インシデント対応</p>
      </div>

      {/* Status dashboard */}
      {latestEntry ? (
        <div className="rounded-2xl p-4 space-y-4" style={{ background: latestEntry.ok ? 'rgba(52,211,153,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${statusColor}25` }}>
          {/* Top: status + uptime donut */}
          <div className="flex items-center gap-4">
            <DonutRing percent={uptime ?? 100} color={uptimeColor} />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                {latestEntry.ok
                  ? <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                  : <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />}
                <p className="font-bold text-sm truncate" style={{ color: statusColor }}>
                  {latestEntry.ok ? 'オンライン' : `エラー — HTTP ${latestEntry.status || 'タイムアウト'}`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl px-3 py-2 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-white font-bold text-base">{latestEntry.ms}<span className="text-gray-600 text-xs font-normal">ms</span></p>
                  <p className="text-gray-600 text-xs">現在</p>
                </div>
                <div className="rounded-xl px-3 py-2 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-white font-bold text-base">{avgMs}<span className="text-gray-600 text-xs font-normal">ms</span></p>
                  <p className="text-gray-600 text-xs">平均</p>
                </div>
              </div>
            </div>
          </div>

          {/* Response time area chart */}
          {statusHistory.length > 1 && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-gray-600 text-xs">レスポンスタイム</p>
                <p className="text-gray-700 text-xs">{statusHistory.length}件</p>
              </div>
              <ResponseAreaChart entries={statusHistory} />
            </div>
          )}

          <p className="text-gray-700 text-xs text-right">{new Date(latestEntry.ts).toLocaleString('ja-JP')}</p>
        </div>
      ) : (
        <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Clock size={22} className="text-gray-600 mx-auto mb-2" />
          <p className="text-gray-600 text-sm">監視未開始</p>
          <p className="text-gray-700 text-xs mt-1">URLを設定して監視を開始してください</p>
        </div>
      )}

      {/* Config */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-gray-500 text-xs">監視設定</p>
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://your-production-url.com"
          className="w-full h-10 px-3 rounded-xl text-sm text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
        <div className="flex gap-2">
          <div className="flex-1">
            <p className="text-gray-600 text-xs mb-1">チェック間隔</p>
            <select value={interval} onChange={e => setInterval2(Number(e.target.value))}
              className="w-full h-9 px-2 rounded-xl text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
              <option value={30} style={{ background: '#111' }}>30秒</option>
              <option value={60} style={{ background: '#111' }}>1分</option>
              <option value={300} style={{ background: '#111' }}>5分</option>
            </select>
          </div>
          <div className="flex-1">
            <p className="text-gray-600 text-xs mb-1">エラー時の自動修正</p>
            <button onClick={() => setAutoFix(v => !v)}
              className="w-full h-9 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{ background: autoFix ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)', border: autoFix ? '1px solid rgba(239,68,68,0.3)' : 'none', color: autoFix ? '#fca5a5' : '#6b7280' }}>
              {autoFix ? '✅ 自動修正 ON' : '自動修正 OFF'}
            </button>
          </div>
        </div>
        {!monitorActive ? (
          <button onClick={startMonitor} disabled={!url.trim() || !macOnline}
            className="w-full py-3 rounded-xl text-sm font-bold text-white active:scale-98 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #059669, #0284c7)', boxShadow: '0 0 20px rgba(5,150,105,0.25)' }}>
            <Play size={13} fill="white" />監視開始
          </button>
        ) : (
          <button onClick={stopMonitor}
            className="w-full py-3 rounded-xl text-sm font-semibold active:scale-98 flex items-center justify-center gap-2"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
            <Square size={11} fill="currentColor" />監視停止
          </button>
        )}
      </div>

      {/* Incident log */}
      {incidentLog.length > 0 && (
        <div className="space-y-2">
          <p className="text-gray-700 text-xs px-1">インシデント履歴 ({incidentLog.length}件)</p>
          {incidentLog.slice().reverse().map((inc, i) => (
            <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={11} className="text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-xs font-semibold truncate">{inc.error}</p>
                <span className="text-gray-700 text-xs flex-shrink-0 ml-auto">{new Date(inc.ts).toLocaleTimeString('ja-JP')}</span>
              </div>
              {inc.fixOutput && (
                <div className="mt-1.5 rounded-lg p-2" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    {inc.fixDone
                      ? <CheckCircle size={9} className="text-emerald-400" />
                      : <RefreshCw size={9} className="text-indigo-400 animate-spin" />}
                    自動修正 {inc.fixDone ? '完了' : '実行中...'}
                  </p>
                  <pre className="text-gray-500 text-xs font-mono whitespace-pre-wrap break-words line-clamp-3">{inc.fixOutput.slice(-300)}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
