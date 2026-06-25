'use client';
import { useState, useEffect } from 'react';
import { Brain, Search, RefreshCw, CheckCircle, Clock, FileText, Zap } from 'lucide-react';

interface BrainStatus { exists: boolean; count?: number; indexed_at?: string; }
interface SearchResult { path: string; score: number; lines: number; preview: string; }

interface Props {
  projectName: string;
  macOnline: boolean;
  onSend: (msg: Record<string, unknown>) => void;
  brainStatus: BrainStatus | null;
  brainSearchResults: SearchResult[];
  brainIndexing: boolean;
  brainProgress: { count: number; total: number } | null;
}

export default function BrainPanel({ projectName, macOnline, onSend, brainStatus, brainSearchResults, brainIndexing, brainProgress }: Props) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [autoInject, setAutoInject] = useState(true);

  useEffect(() => {
    if (!macOnline) return;
    onSend({ type: 'brain_status' });
  }, [macOnline]);

  useEffect(() => {
    if (brainSearchResults.length > 0) setSearching(false);
  }, [brainSearchResults]);

  useEffect(() => {
    const saved = localStorage.getItem('brain_auto_inject');
    if (saved !== null) setAutoInject(saved === '1');
  }, []);

  const handleSearch = () => {
    if (!query.trim() || !macOnline) return;
    setSearching(true);
    onSend({ type: 'brain_search', query: query.trim() });
  };

  const toggleAutoInject = () => {
    const next = !autoInject;
    setAutoInject(next);
    localStorage.setItem('brain_auto_inject', next ? '1' : '0');
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="text-center pb-1">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', boxShadow: '0 0 30px rgba(99,102,241,0.35)' }}>
          <Brain size={24} className="text-white" />
        </div>
        <p className="text-white font-bold text-base">Codebase Brain</p>
        <p className="text-gray-500 text-xs mt-1">{projectName} · コードベースを記憶して AI に自動注入</p>
      </div>

      {/* Status card */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {brainStatus?.exists ? (
              <CheckCircle size={14} className="text-emerald-400" />
            ) : (
              <Clock size={14} className="text-gray-600" />
            )}
            <p className="text-white text-sm font-semibold">
              {brainStatus?.exists ? `${brainStatus.count} ファイルをインデックス済み` : 'インデックス未作成'}
            </p>
          </div>
          <button onClick={() => macOnline && onSend({ type: 'brain_index' })} disabled={!macOnline || brainIndexing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold active:scale-95 disabled:opacity-40 transition-all"
            style={{ background: brainIndexing ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
            <RefreshCw size={11} className={brainIndexing ? 'animate-spin' : ''} />
            {brainIndexing ? '解析中...' : brainStatus?.exists ? '再インデックス' : 'インデックス作成'}
          </button>
        </div>

        {brainIndexing && brainProgress && (
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-500 text-xs">解析中...</span>
              <span className="text-indigo-400 text-xs">{brainProgress.count}/{brainProgress.total}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${brainProgress.total > 0 ? brainProgress.count / brainProgress.total * 100 : 0}%`, background: 'linear-gradient(90deg,#6366f1,#a855f7)' }} />
            </div>
          </div>
        )}

        {brainStatus?.indexed_at && (
          <p className="text-gray-700 text-xs">最終インデックス: {new Date(brainStatus.indexed_at).toLocaleString('ja-JP')}</p>
        )}
      </div>

      {/* Auto-inject toggle */}
      <button onClick={toggleAutoInject}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all active:scale-98"
        style={{ background: autoInject ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)', border: autoInject ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3">
          <Zap size={15} className={autoInject ? 'text-indigo-400' : 'text-gray-600'} />
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: autoInject ? '#a5b4fc' : '#6b7280' }}>AI Team 自動コンテキスト注入</p>
            <p className="text-xs text-gray-600 mt-0.5">タスク実行時に関連ファイルを自動的に指示に追加</p>
          </div>
        </div>
        <div className="w-11 h-6 rounded-full transition-all flex-shrink-0" style={{ background: autoInject ? '#6366f1' : 'rgba(255,255,255,0.1)' }}>
          <div className="w-5 h-5 rounded-full bg-white mt-0.5 transition-all shadow" style={{ marginLeft: autoInject ? '22px' : '2px' }} />
        </div>
      </button>

      {/* Search */}
      <div className="space-y-2">
        <p className="text-gray-700 text-xs px-1">コードベース検索</p>
        <div className="flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="関数名・ファイル名・キーワード..."
            className="flex-1 h-10 px-3 rounded-xl text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
          <button onClick={handleSearch} disabled={!query.trim() || !macOnline || !brainStatus?.exists || searching}
            className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 disabled:opacity-40"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
            {searching ? <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> : <Search size={15} className="text-indigo-400" />}
          </button>
        </div>

        {brainSearchResults.length > 0 && (
          <div className="space-y-1.5">
            {brainSearchResults.map((r, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={11} className="text-indigo-400 flex-shrink-0" />
                  <p className="text-indigo-300 text-xs font-mono truncate flex-1">{r.path}</p>
                  <span className="text-gray-700 text-xs flex-shrink-0">{r.lines}行</span>
                </div>
                {r.preview && (
                  <pre className="text-gray-600 text-xs font-mono truncate">{r.preview.split('\n')[0]}</pre>
                )}
              </div>
            ))}
          </div>
        )}

        {!brainStatus?.exists && !brainIndexing && (
          <p className="text-center text-gray-700 text-xs py-4">インデックスを作成すると検索と自動注入が使えます</p>
        )}
      </div>
    </div>
  );
}
