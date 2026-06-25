'use client';
import { useState, useEffect } from 'react';
import { X as XIcon, Play, Square, CheckCircle2, XCircle, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';

export interface DecomposeTask {
  id: string;
  title: string;
  prompt: string;
  deps: string[];
  estimatedMins: number;
}

export interface DecomposePlan {
  title: string;
  tasks: DecomposeTask[];
  parallelGroups: string[][];
}

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

interface Props {
  goal: string;
  plan: DecomposePlan;
  statuses: Record<string, TaskStatus>;
  outputs: Record<string, string>;
  running: boolean;
  onStart: () => void;
  onAbort: () => void;
  onClose: () => void;
}

const LC = {
  bg: '#F8F7F4', surface: '#FFFFFF', sky: '#0EA5E9', skyLight: '#E0F2FE', skyMid: '#38BDF8',
  beige: '#F5EFE6', beigeAlt: '#EDE8DC', beigeStrong: '#D4CAB8',
  text: '#1E293B', textSub: '#64748B', textMuted: '#94A3B8', border: '#E8E3DC',
  success: '#10B981', warning: '#F59E0B', error: '#EF4444',
};

function statusColor(s: TaskStatus) {
  if (s === 'running') return LC.sky;
  if (s === 'done') return LC.success;
  if (s === 'failed') return LC.error;
  return LC.beigeStrong;
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'done') return <CheckCircle2 size={14} style={{ color: LC.success }} />;
  if (status === 'failed') return <XCircle size={14} style={{ color: LC.error }} />;
  if (status === 'running') return (
    <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${LC.sky} transparent transparent transparent` }} />
  );
  return <Clock size={13} style={{ color: LC.textMuted }} />;
}

function TaskCard({ task, status, output }: { task: DecomposeTask; status: TaskStatus; output: string }) {
  const [expanded, setExpanded] = useState(false);
  const color = statusColor(status);

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: status === 'running' ? LC.skyLight : status === 'done' ? 'rgba(16,185,129,0.06)' : status === 'failed' ? 'rgba(239,68,68,0.06)' : LC.surface,
        border: `1px solid ${status === 'running' ? LC.skyMid : status === 'done' ? 'rgba(16,185,129,0.25)' : status === 'failed' ? 'rgba(239,68,68,0.25)' : LC.border}`,
        boxShadow: status === 'running' ? '0 0 16px rgba(14,165,233,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
        animation: status === 'running' ? 'taskPulse 2s ease-in-out infinite' : undefined,
      }}>
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <StatusIcon status={status} />
        <p className="flex-1 text-sm font-medium truncate" style={{ color: LC.text }}>{task.title}</p>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: color + '18', color }}>
          {status === 'pending' ? `~${task.estimatedMins}m` : status === 'running' ? '実行中' : status === 'done' ? '完了' : '失敗'}
        </span>
        {output && (
          <button onClick={() => setExpanded(v => !v)} className="active:scale-90" style={{ color: LC.textMuted }}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>
      {expanded && output && (
        <div className="px-3.5 pb-3 border-t" style={{ borderColor: LC.border }}>
          <pre className="text-[11px] font-mono mt-2 whitespace-pre-wrap overflow-hidden" style={{ color: LC.textSub, maxHeight: 120 }}>
            {output.slice(-600)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function GoalDecomposer({ goal, plan, statuses, outputs, running, onStart, onAbort, onClose }: Props) {
  const total = plan.tasks.length;
  const doneCount = plan.tasks.filter(t => statuses[t.id] === 'done').length;
  const failCount = plan.tasks.filter(t => statuses[t.id] === 'failed').length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const allDone = doneCount + failCount === total && total > 0;

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(30,41,59,0.5)', backdropFilter: 'blur(12px)' }}>
      <div className="flex-1 flex flex-col mt-10 rounded-t-3xl overflow-hidden"
        style={{ background: LC.bg, animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: LC.beigeStrong }} />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-2 pb-3" style={{ borderBottom: `1px solid ${LC.border}` }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${LC.sky}, #0284C7)` }}>
            <Zap size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: LC.text }}>{plan.title}</p>
            <p className="text-[11px] truncate" style={{ color: LC.textMuted }}>{goal.slice(0, 60)}{goal.length > 60 ? '…' : ''}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-90"
            style={{ background: LC.beigeAlt }}>
            <XIcon size={14} style={{ color: LC.textSub }} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${LC.border}` }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium" style={{ color: LC.textSub }}>
              {doneCount}/{total} 完了 · {plan.tasks.filter(t => statuses[t.id] === 'running').length} 実行中
            </span>
            <span className="text-xs" style={{ color: LC.textMuted }}>
              {running ? `${elapsed}s` : allDone ? (failCount > 0 ? `${failCount}件失敗` : '全完了') : ''}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: LC.beigeAlt }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: failCount > 0 ? LC.error : `linear-gradient(90deg, ${LC.sky}, ${LC.success})`,
              }} />
          </div>

          {/* Parallel groups visualization */}
          <div className="flex items-center gap-1 mt-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {plan.parallelGroups.map((group, gi) => (
              <div key={gi} className="flex items-center gap-1 flex-shrink-0">
                {gi > 0 && <span className="text-[10px]" style={{ color: LC.textMuted }}>→</span>}
                <div className="flex items-center gap-0.5">
                  {group.map(tid => {
                    const s = statuses[tid] || 'pending';
                    return (
                      <div key={tid} className="w-5 h-5 rounded-md flex items-center justify-center"
                        style={{ background: statusColor(s) + '20', border: `1px solid ${statusColor(s)}50` }}>
                        {s === 'running' ? (
                          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: LC.sky }} />
                        ) : s === 'done' ? (
                          <div className="w-2 h-2 rounded-full" style={{ background: LC.success }} />
                        ) : s === 'failed' ? (
                          <div className="w-2 h-2 rounded-full" style={{ background: LC.error }} />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: LC.beigeStrong }} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {group.length > 1 && (
                  <span className="text-[9px] px-1 rounded" style={{ background: LC.skyLight, color: '#0369A1' }}>
                    ×{group.length}並列
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ scrollbarWidth: 'none' }}>
          {plan.tasks.map(task => (
            <TaskCard key={task.id} task={task} status={statuses[task.id] || 'pending'} output={outputs[task.id] || ''} />
          ))}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 flex gap-2.5" style={{ borderTop: `1px solid ${LC.border}`, paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
          {!running && !allDone && (
            <button onClick={onStart}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white active:scale-95 transition-all"
              style={{ background: `linear-gradient(135deg, ${LC.sky}, #0284C7)`, boxShadow: '0 4px 20px rgba(14,165,233,0.3)' }}>
              <Play size={15} fill="currentColor" />
              実行開始
            </button>
          )}
          {running && (
            <button onClick={onAbort}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', boxShadow: '0 4px 20px rgba(239,68,68,0.25)' }}>
              <Square size={13} fill="currentColor" />
              中断
            </button>
          )}
          {allDone && (
            <button onClick={onClose}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white active:scale-95 transition-all"
              style={{ background: failCount > 0 ? LC.error : `linear-gradient(135deg, ${LC.success}, #059669)`, boxShadow: '0 4px 20px rgba(16,185,129,0.25)' }}>
              <CheckCircle2 size={15} />
              {failCount > 0 ? `${failCount}件失敗 — 閉じる` : '完了 — 閉じる'}
            </button>
          )}
          {!allDone && (
            <button onClick={onClose}
              className="px-4 py-3.5 rounded-2xl text-sm font-medium active:scale-95 transition-all"
              style={{ background: LC.beigeAlt, color: LC.textSub }}>
              閉じる
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes taskPulse {
          0%, 100% { box-shadow: 0 0 16px rgba(14,165,233,0.12); }
          50%       { box-shadow: 0 0 24px rgba(14,165,233,0.22); }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
