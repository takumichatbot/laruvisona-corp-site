'use client';
import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Zap, Clock, TrendingUp, Terminal, MessageSquare, GitBranch, Users, Brain, Activity, Star, ChevronRight, Plus } from 'lucide-react';
import { getStats, getRecords, type TaskRecord } from './TaskHistoryStore';
import { getPrompts, incrementUse, type SavedPrompt } from './PromptStore';

interface Project { id: string; name: string; }
interface Props {
  projects: Project[];
  currentProject: Project | null;
  macOnline: boolean;
  macCount: number;
  orchestrateRunning: boolean;
  orchestrateComplete: boolean;
  lastMode?: 'code' | 'chat';
  lastInput?: string;
  onSelectProject: (p: Project) => void;
  onNavigate: (mode: string) => void;
  onRunPrompt: (prompt: string, mode: 'code' | 'chat') => void;
  onContinueLast?: () => void;
}

const TYPE_COLOR: Record<string, string> = { code: '#a5b4fc', chat: '#fcd34d', team: '#818cf8', brain: '#c084fc', git: '#6ee7b7', other: '#9ca3af' };
const TYPE_ICON: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  code: Terminal, chat: MessageSquare, team: Users, brain: Brain, git: GitBranch, other: Activity,
};

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60000) return `${Math.floor(d / 1000)}秒前`;
  if (d < 3600000) return `${Math.floor(d / 60000)}分前`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}時間前`;
  return `${Math.floor(d / 86400000)}日前`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'おはようございます';
  if (h < 18) return 'こんにちは';
  return 'こんばんは';
}

function StatCard({ label, value, sub, color, icon: Icon }: { label: string; value: string | number; sub: string; color: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }) {
  return (
    <div className="rounded-2xl p-3.5 flex flex-col gap-1"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <Icon size={15} style={{ color }} />
      <p className="text-white font-bold text-[22px] leading-none mt-1">{value}</p>
      <p className="text-gray-600 text-[10px] leading-tight">{label}</p>
      <p className="text-gray-700 text-[10px]">{sub}</p>
    </div>
  );
}

export default function HomePanel({ projects, currentProject, macOnline, macCount, orchestrateRunning, orchestrateComplete, lastMode, lastInput, onSelectProject, onNavigate, onRunPrompt, onContinueLast }: Props) {
  const [stats, setStats] = useState(() => getStats(currentProject?.name));
  const [recent, setRecent] = useState<TaskRecord[]>(() => getRecords(undefined, 8));
  const [prompts, setPrompts] = useState<SavedPrompt[]>(() => getPrompts({ starred: true }));

  useEffect(() => {
    setStats(getStats(currentProject?.name));
    setRecent(getRecords(undefined, 8));
    setPrompts(getPrompts({ starred: true }));
  }, [currentProject]);

  const today = new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5" style={{ scrollbarWidth: 'none' }}>

      {/* Greeting + status */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-xs">{today}</p>
          <h1 className="text-white text-xl font-bold mt-0.5">{greeting()}</h1>
        </div>
        <button onClick={() => onNavigate(macOnline ? 'code' : 'code')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-all"
          style={{ background: macOnline ? 'rgba(52,211,153,0.1)' : 'rgba(107,114,128,0.1)', border: `1px solid ${macOnline ? 'rgba(52,211,153,0.25)' : 'rgba(107,114,128,0.2)'}` }}>
          <span className="w-1.5 h-1.5 rounded-full"
            style={{ background: macOnline ? '#34d399' : '#6b7280', boxShadow: macOnline ? '0 0 6px #34d399' : 'none' }} />
          <span style={{ color: macOnline ? '#34d399' : '#9ca3af' }}>
            {macOnline ? `Mac${macCount > 1 ? ` ×${macCount}` : ''}` : 'オフライン'}
          </span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="今日" value={stats.todayCount} sub={`${stats.todaySuccess}件成功`} color="#a5b4fc" icon={Zap} />
        <StatCard label="成功率" value={`${stats.successRate}%`} sub={`全${stats.total}件`} color="#34d399" icon={TrendingUp} />
        <StatCard label="平均時間" value={stats.avgDurationSec > 0 ? `${stats.avgDurationSec}s` : '—'} sub="実行時間" color="#fcd34d" icon={Clock} />
      </div>

      {/* 前回の続き + 最近の入力チップ */}
      {(onContinueLast || recent.length > 0) && (
        <div className="space-y-2">
          {onContinueLast && lastInput && (
            <button onClick={onContinueLast}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left active:scale-[0.98] transition-all"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(99,102,241,0.2)' }}>
                <ChevronRight size={16} className="text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-indigo-300 text-xs font-semibold mb-0.5">前回の続き ({lastMode})</p>
                <p className="text-gray-400 text-xs truncate">{lastInput}</p>
              </div>
            </button>
          )}
          {recent.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {[...new Set(recent.map(r => r.input))].slice(0, 5).map((input, i) => (
                <button key={i}
                  onClick={() => onRunPrompt(input, 'code')}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs text-gray-400 active:scale-95 transition-all whitespace-nowrap"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
                  {input.length > 22 ? input.slice(0, 22) + '…' : input}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Running banner */}
      {(orchestrateRunning || orchestrateComplete) && (
        <button onClick={() => onNavigate('team')} className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 active:scale-[0.98] transition-all"
          style={orchestrateRunning
            ? { background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)' }
            : { background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
          {orchestrateRunning
            ? <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            : <CheckCircle2 size={15} className="text-emerald-400" />
          }
          <p className="text-sm font-medium flex-1 text-left"
            style={{ color: orchestrateRunning ? '#a5b4fc' : '#6ee7b7' }}>
            {orchestrateRunning ? 'AI Team 実行中...' : '最新タスクが完了しました'}
          </p>
          <ChevronRight size={14} style={{ color: orchestrateRunning ? '#818cf8' : '#34d399' }} />
        </button>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <div>
          <p className="text-gray-600 text-[11px] font-semibold tracking-widest uppercase mb-3">プロジェクト</p>
          <div className="grid grid-cols-2 gap-2.5">
            {projects.map(p => {
              const ps = getStats(p.name);
              const isActive = currentProject?.name === p.name;
              const barColor = ps.successRate >= 80 ? '#34d399' : ps.successRate >= 50 ? '#fcd34d' : '#f87171';
              return (
                <button key={p.id} onClick={() => onSelectProject(p)}
                  className="text-left rounded-2xl p-3.5 transition-all active:scale-95"
                  style={{
                    background: isActive ? 'rgba(129,140,248,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isActive ? 'rgba(129,140,248,0.28)' : 'rgba(255,255,255,0.07)'}`,
                  }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-white text-sm font-semibold truncate">{p.name}</p>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tabular-nums" style={{ color: barColor }}>{ps.successRate}%</span>
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full" style={{ width: `${ps.successRate}%`, background: barColor, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                  <p className="text-gray-600 text-[10px] mt-1.5">
                    {ps.todayCount > 0 ? `今日 ${ps.todayCount}件` : ps.total > 0 ? `全 ${ps.total}件` : '未実行'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions (starred prompts) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-gray-600 text-[11px] font-semibold tracking-widest uppercase">クイックアクション</p>
          <button onClick={() => onNavigate('prompts')}
            className="flex items-center gap-1 text-indigo-400 text-xs active:opacity-60">
            <Plus size={12} />管理
          </button>
        </div>
        {prompts.length > 0 ? (
          <div className="space-y-2">
            {prompts.slice(0, 4).map(qp => (
              <button key={qp.id}
                onClick={() => { incrementUse(qp.id); onRunPrompt(qp.prompt, qp.mode === 'team' ? 'code' : qp.mode); }}
                className="w-full text-left px-3.5 py-3 rounded-xl flex items-center gap-3 active:scale-[0.98] transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Star size={13} className="text-yellow-400 shrink-0" />
                <p className="text-gray-300 text-sm flex-1 truncate">{qp.label || qp.prompt}</p>
                <span className="text-gray-600 text-[10px] px-1.5 py-0.5 rounded-md shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>{qp.mode}</span>
              </button>
            ))}
          </div>
        ) : (
          <button onClick={() => onNavigate('prompts')}
            className="w-full px-4 py-3 rounded-xl flex items-center gap-2 text-gray-600 text-sm active:scale-95 transition-all"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.09)' }}>
            <Star size={14} />よく使うプロンプトをお気に入り登録
          </button>
        )}
      </div>

      {/* Activity feed */}
      {recent.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-600 text-[11px] font-semibold tracking-widest uppercase">最近のアクティビティ</p>
            <button onClick={() => onNavigate('history')} className="text-indigo-400 text-xs active:opacity-60">全件 →</button>
          </div>
          <div className="space-y-1.5">
            {recent.slice(0, 6).map(rec => {
              const MIcon = TYPE_ICON[rec.type] ?? Activity;
              const color = TYPE_COLOR[rec.type] ?? '#9ca3af';
              return (
                <div key={rec.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {rec.status === 'success'
                    ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                    : <XCircle size={13} className="text-red-400 shrink-0" />
                  }
                  <MIcon size={11} style={{ color, flexShrink: 0 }} />
                  <p className="text-gray-400 text-xs flex-1 truncate">{rec.input}</p>
                  <p className="text-gray-600 text-[10px] shrink-0">{timeAgo(rec.ts)}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
            style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.18)' }}>
            <Zap size={30} style={{ color: '#818cf8' }} />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-base mb-1">Bridge へようこそ</p>
            <p className="text-gray-500 text-sm leading-relaxed">プロジェクトを選択して<br />Claude Code を使い始めましょう</p>
          </div>
          <button onClick={() => onNavigate('code')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            コードを書く
          </button>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
