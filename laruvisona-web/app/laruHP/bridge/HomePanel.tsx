'use client';
import { useState, useEffect, useRef } from 'react';
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

const C = {
  bg: '#F8F7F4',
  surface: '#FFFFFF',
  sky: '#0EA5E9',
  skyLight: '#E0F2FE',
  skyMid: '#38BDF8',
  beige: '#F5EFE6',
  beigeAlt: '#EDE8DC',
  beigeStrong: '#D4CAB8',
  text: '#1E293B',
  textSub: '#64748B',
  textMuted: '#94A3B8',
  border: '#E8E3DC',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

const TYPE_COLOR: Record<string, string> = {
  code: C.sky, chat: C.warning, team: '#818CF8', brain: '#C084FC', git: C.success, other: C.textMuted,
};
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
      style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <Icon size={15} style={{ color }} />
      <p className="font-bold text-[22px] leading-none mt-1" style={{ color: C.text }}>{value}</p>
      <p className="text-[10px] leading-tight" style={{ color: C.textSub }}>{label}</p>
      <p className="text-[10px]" style={{ color: C.textMuted }}>{sub}</p>
    </div>
  );
}

/* 3D Project Card */
function ProjectCard3D({ project, isActive, stats, onClick }: {
  project: Project;
  isActive: boolean;
  stats: ReturnType<typeof getStats>;
  onClick: () => void;
}) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onMove = (clientX: number, clientY: number) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    setTilt({ x: (y - 0.5) * 10, y: (x - 0.5) * -10 });
  };

  const barColor = stats.successRate >= 80 ? C.success : stats.successRate >= 50 ? C.warning : C.error;

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      onMouseMove={e => onMove(e.clientX, e.clientY)}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      onTouchMove={e => onMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={() => setTilt({ x: 0, y: 0 })}
      className="text-left rounded-2xl p-3.5 active:scale-95"
      style={{
        background: isActive ? C.skyLight : C.surface,
        border: `1px solid ${isActive ? C.skyMid : C.border}`,
        transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: 'transform 0.15s ease, box-shadow 0.2s ease',
        boxShadow: isActive ? `0 4px 16px rgba(14,165,233,0.15)` : '0 2px 12px rgba(0,0,0,0.06)',
      }}>
      <div className="flex items-center justify-between mb-2.5">
        <p className="font-semibold text-sm truncate" style={{ color: C.text }}>{project.name}</p>
        {isActive && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.sky }} />}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold tabular-nums" style={{ color: barColor }}>{stats.successRate}%</span>
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: C.beigeAlt }}>
          <div className="h-full rounded-full" style={{ width: `${stats.successRate}%`, background: barColor, transition: 'width 0.6s ease' }} />
        </div>
      </div>
      <p className="text-[10px] mt-1.5" style={{ color: C.textMuted }}>
        {stats.todayCount > 0 ? `今日 ${stats.todayCount}件` : stats.total > 0 ? `全 ${stats.total}件` : '未実行'}
      </p>
    </button>
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
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5" style={{ scrollbarWidth: 'none', background: C.bg }}>

      {/* Floating orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '8%', right: '-10%', width: 200, height: 200,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)',
          animation: 'orbFloat 8s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', top: '35%', left: '-8%', width: 160, height: 160,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,239,230,0.6) 0%, transparent 70%)',
          animation: 'orbFloat 11s ease-in-out infinite reverse',
        }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Greeting + status */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs" style={{ color: C.textMuted }}>{today}</p>
            <h1 className="text-xl font-bold mt-0.5" style={{ color: C.text }}>{greeting()}</h1>
          </div>
          <button onClick={() => onNavigate('code')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-all"
            style={{
              background: macOnline ? 'rgba(16,185,129,0.08)' : C.beigeAlt,
              border: `1px solid ${macOnline ? 'rgba(16,185,129,0.25)' : C.border}`,
            }}>
            <span className="w-1.5 h-1.5 rounded-full"
              style={{ background: macOnline ? C.success : C.textMuted, boxShadow: macOnline ? `0 0 6px ${C.success}` : 'none' }} />
            <span style={{ color: macOnline ? C.success : C.textMuted }}>
              {macOnline ? `Mac${macCount > 1 ? ` ×${macCount}` : ''}` : 'オフライン'}
            </span>
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <StatCard label="今日" value={stats.todayCount} sub={`${stats.todaySuccess}件成功`} color={C.sky} icon={Zap} />
          <StatCard label="成功率" value={`${stats.successRate}%`} sub={`全${stats.total}件`} color={C.success} icon={TrendingUp} />
          <StatCard label="平均時間" value={stats.avgDurationSec > 0 ? `${stats.avgDurationSec}s` : '—'} sub="実行時間" color={C.warning} icon={Clock} />
        </div>

        {/* 前回の続き */}
        {(onContinueLast || recent.length > 0) && (
          <div className="space-y-2 mb-5">
            {onContinueLast && lastInput && (
              <button onClick={onContinueLast}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left active:scale-[0.98] transition-all"
                style={{ background: C.skyLight, border: `1px solid rgba(56,189,248,0.4)`, boxShadow: '0 2px 8px rgba(14,165,233,0.1)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: C.sky }}>
                  <ChevronRight size={16} color="white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-0.5" style={{ color: '#0369A1' }}>前回の続き ({lastMode})</p>
                  <p className="text-xs truncate" style={{ color: C.textSub }}>{lastInput}</p>
                </div>
              </button>
            )}
            {recent.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {[...new Set(recent.map(r => r.input))].slice(0, 5).map((inp, i) => (
                  <button key={i}
                    onClick={() => onRunPrompt(inp, 'code')}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs active:scale-95 transition-all whitespace-nowrap"
                    style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.textSub }}>
                    {inp.length > 22 ? inp.slice(0, 22) + '…' : inp}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Running banner */}
        {(orchestrateRunning || orchestrateComplete) && (
          <button onClick={() => onNavigate('team')} className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 active:scale-[0.98] transition-all mb-5"
            style={orchestrateRunning
              ? { background: C.skyLight, border: `1px solid rgba(56,189,248,0.5)` }
              : { background: 'rgba(16,185,129,0.06)', border: `1px solid rgba(16,185,129,0.2)` }}>
            {orchestrateRunning
              ? <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.sky }} />
              : <CheckCircle2 size={15} style={{ color: C.success }} />
            }
            <p className="text-sm font-medium flex-1 text-left"
              style={{ color: orchestrateRunning ? '#0369A1' : C.success }}>
              {orchestrateRunning ? 'AI Team 実行中...' : '最新タスクが完了しました'}
            </p>
            <ChevronRight size={14} style={{ color: orchestrateRunning ? C.sky : C.success }} />
          </button>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <div className="mb-5">
            <p className="text-[11px] font-semibold tracking-widest uppercase mb-3" style={{ color: C.textMuted }}>プロジェクト</p>
            <div className="grid grid-cols-2 gap-2.5">
              {projects.map(p => (
                <ProjectCard3D
                  key={p.id}
                  project={p}
                  isActive={currentProject?.name === p.name}
                  stats={getStats(p.name)}
                  onClick={() => onSelectProject(p)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: C.textMuted }}>クイックアクション</p>
            <button onClick={() => onNavigate('prompts')}
              className="flex items-center gap-1 text-xs active:opacity-60"
              style={{ color: C.sky }}>
              <Plus size={12} />管理
            </button>
          </div>
          {prompts.length > 0 ? (
            <div className="space-y-2">
              {prompts.slice(0, 4).map(qp => (
                <button key={qp.id}
                  onClick={() => { incrementUse(qp.id); onRunPrompt(qp.prompt, qp.mode === 'team' ? 'code' : qp.mode); }}
                  className="w-full text-left px-3.5 py-3 rounded-xl flex items-center gap-3 active:scale-[0.98] transition-all"
                  style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <Star size={13} style={{ color: C.warning, flexShrink: 0 }} />
                  <p className="text-sm flex-1 truncate" style={{ color: C.text }}>{qp.label || qp.prompt}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md shrink-0"
                    style={{ background: C.beigeAlt, color: C.textSub }}>{qp.mode}</span>
                </button>
              ))}
            </div>
          ) : (
            <button onClick={() => onNavigate('prompts')}
              className="w-full px-4 py-3 rounded-xl flex items-center gap-2 text-sm active:scale-95 transition-all"
              style={{ background: C.surface, border: `1px dashed ${C.border}`, color: C.textMuted }}>
              <Star size={14} />よく使うプロンプトをお気に入り登録
            </button>
          )}
        </div>

        {/* Activity feed */}
        {recent.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: C.textMuted }}>最近のアクティビティ</p>
              <button onClick={() => onNavigate('history')} className="text-xs active:opacity-60" style={{ color: C.sky }}>全件 →</button>
            </div>
            <div className="space-y-1.5">
              {recent.slice(0, 6).map(rec => {
                const MIcon = TYPE_ICON[rec.type] ?? Activity;
                const color = TYPE_COLOR[rec.type] ?? C.textMuted;
                return (
                  <div key={rec.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                    style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    {rec.status === 'success'
                      ? <CheckCircle2 size={13} style={{ color: C.success, flexShrink: 0 }} />
                      : <XCircle size={13} style={{ color: C.error, flexShrink: 0 }} />
                    }
                    <MIcon size={11} style={{ color, flexShrink: 0 }} />
                    <p className="text-xs flex-1 truncate" style={{ color: C.textSub }}>{rec.input}</p>
                    <p className="text-[10px] shrink-0" style={{ color: C.textMuted }}>{timeAgo(rec.ts)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
              style={{ background: C.skyLight, border: `1px solid rgba(56,189,248,0.4)` }}>
              <Zap size={30} style={{ color: C.sky }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-base mb-1" style={{ color: C.text }}>Bridge へようこそ</p>
              <p className="text-sm leading-relaxed" style={{ color: C.textSub }}>プロジェクトを選択して<br />Claude Code を使い始めましょう</p>
            </div>
            <button onClick={() => onNavigate('code')}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white active:scale-95 transition-all"
              style={{ background: `linear-gradient(135deg, ${C.sky}, #0284C7)` }}>
              コードを書く
            </button>
          </div>
        )}

      </div>

      <div className="h-4" />

      <style>{`
        @keyframes orbFloat {
          0%,100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
