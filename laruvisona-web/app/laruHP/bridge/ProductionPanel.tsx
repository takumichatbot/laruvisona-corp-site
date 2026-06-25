'use client';
import { useState, useEffect } from 'react';
import { Activity, Play, Square, AlertTriangle, CheckCircle, Clock, Zap, RefreshCw } from 'lucide-react';

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
    onSend({ type: 'production_monitor_start', url: url.trim(), interval: interval, auto_fix: autoFix });
  };

  const stopMonitor = () => onSend({ type: 'production_monitor_stop' });

  const avgMs = statusHistory.length > 0
    ? Math.round(statusHistory.reduce((s, e) => s + e.ms, 0) / statusHistory.length)
    : null;
  const uptime = statusHistory.length > 0
    ? Math.round(statusHistory.filter(e => e.ok).length / statusHistory.length * 100)
    : null;

  const statusColor = !latestEntry ? '#4b5563'
    : latestEntry.ok ? '#34d399'
    : '#f87171';

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

      {/* Status card */}
      {latestEntry ? (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: latestEntry.ok ? 'rgba(52,211,153,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${statusColor}30` }}>
          <div className="flex items-center gap-2">
            {latestEntry.ok
              ? <CheckCircle size={16} className="text-emerald-400" />
              : <AlertTriangle size={16} className="text-red-400" />}
            <p className="font-bold text-sm" style={{ color: statusColor }}>
              {latestEntry.ok ? 'オンライン' : `エラー — HTTP ${latestEntry.status || 'タイムアウト'}`}
            </p>
            <span className="ml-auto text-xs text-gray-600">{new Date(latestEntry.ts).toLocaleTimeString('ja-JP')}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-white font-bold text-sm">{latestEntry.ms}ms</p>
              <p className="text-gray-600 text-xs">レスポンス</p>
            </div>
            <div className="rounded-xl py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="font-bold text-sm" style={{ color: (uptime ?? 100) >= 99 ? '#34d399' : '#fbbf24' }}>{uptime}%</p>
              <p className="text-gray-600 text-xs">稼働率</p>
            </div>
            <div className="rounded-xl py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-white font-bold text-sm">{avgMs}ms</p>
              <p className="text-gray-600 text-xs">平均応答</p>
            </div>
          </div>
          {/* Mini sparkline */}
          {statusHistory.length > 1 && (
            <div className="flex items-end gap-0.5 h-8">
              {statusHistory.slice(-20).map((e, i) => (
                <div key={i} className="flex-1 rounded-sm transition-all"
                  style={{
                    height: `${Math.min(100, Math.max(10, 100 - (e.ms / 2000 * 80)))}%`,
                    background: e.ok ? '#34d399' : '#f87171',
                    opacity: 0.7,
                  }} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Clock size={20} className="text-gray-600 mx-auto mb-2" />
          <p className="text-gray-600 text-sm">監視未開始</p>
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
          <p className="text-gray-700 text-xs px-1">インシデント履歴</p>
          {incidentLog.map((inc, i) => (
            <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={11} className="text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-xs font-semibold truncate">{inc.error}</p>
                <span className="text-gray-700 text-xs flex-shrink-0 ml-auto">{new Date(inc.ts).toLocaleTimeString('ja-JP')}</span>
              </div>
              {inc.fixOutput && (
                <div className="mt-1.5 rounded-lg p-2" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    {inc.fixDone ? <CheckCircle size={9} className="text-emerald-400" /> : <div className="w-2 h-2 border border-indigo-400 border-t-transparent rounded-full animate-spin" />}
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
