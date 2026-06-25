'use client';
import { Clock, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';

export interface TaskItem {
  id: string;
  input: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  output?: string;
  ts: number;
  durationMs?: number;
}

interface Props {
  tasks: TaskItem[];
  onClear: () => void;
}

const C = {
  bg: '#F8F7F4',
  surface: '#FFFFFF',
  sky: '#0EA5E9',
  skyLight: '#E0F2FE',
  skyMid: '#38BDF8',
  beige: '#F5EFE6',
  beigeAlt: '#EDE8DC',
  text: '#1E293B',
  textSub: '#64748B',
  textMuted: '#94A3B8',
  border: '#E8E3DC',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

function formatDuration(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60000) return `${Math.floor(d / 1000)}秒前`;
  if (d < 3600000) return `${Math.floor(d / 60000)}分前`;
  return `${Math.floor(d / 3600000)}時間前`;
}

const STATUS_CONFIG = {
  pending: {
    label: '待機中',
    bg: C.beigeAlt,
    border: C.border,
    textColor: C.textSub,
    icon: <Clock size={13} style={{ color: C.textMuted }} />,
  },
  running: {
    label: '実行中',
    bg: C.skyLight,
    border: C.skyMid,
    textColor: '#0369A1',
    icon: <Loader2 size={13} style={{ color: C.sky, animation: 'spin 1s linear infinite' }} />,
  },
  done: {
    label: '完了',
    bg: '#F0FDF4',
    border: '#86EFAC',
    textColor: C.success,
    icon: <CheckCircle2 size={13} style={{ color: C.success }} />,
  },
  failed: {
    label: '失敗',
    bg: '#FFF1F2',
    border: '#FECDD3',
    textColor: C.error,
    icon: <XCircle size={13} style={{ color: C.error }} />,
  },
};

function TaskCard({ task }: { task: TaskItem }) {
  const cfg = STATUS_CONFIG[task.status];

  return (
    <div
      className="rounded-2xl p-4 space-y-2"
      style={{
        background: task.status === 'running' ? C.skyLight : C.surface,
        border: `1px solid ${task.status === 'running' ? C.skyMid : C.border}`,
        boxShadow: task.status === 'running'
          ? '0 4px 16px rgba(14,165,233,0.1)'
          : '0 2px 8px rgba(0,0,0,0.04)',
        animation: 'fadeSlideUp 0.25s cubic-bezier(0.16,1,0.3,1) both',
      }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {cfg.icon}
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: cfg.bg, color: cfg.textColor, border: `1px solid ${cfg.border}` }}>
            {cfg.label}
          </span>
          {task.status === 'running' && (
            <span className="flex gap-1">
              {[0, 0.15, 0.3].map((d, i) => (
                <span key={i} className="w-1 h-1 rounded-full inline-block"
                  style={{ background: C.sky, animation: `bounce 1s ease ${d}s infinite` }} />
              ))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {task.durationMs !== undefined && (
            <span className="text-[10px] font-mono" style={{ color: C.textMuted }}>
              {formatDuration(task.durationMs)}
            </span>
          )}
          <span className="text-[10px]" style={{ color: C.textMuted }}>{timeAgo(task.ts)}</span>
        </div>
      </div>

      {/* Input preview */}
      <p className="text-sm truncate" style={{ color: C.text }}>
        {task.input}
      </p>

      {/* Output preview (done/failed only) */}
      {task.output && (task.status === 'done' || task.status === 'failed') && (
        <div className="rounded-xl px-3 py-2 mt-1"
          style={{
            background: task.status === 'done' ? '#F0FDF4' : '#FFF1F2',
            border: `1px solid ${task.status === 'done' ? '#BBF7D0' : '#FECDD3'}`,
          }}>
          <p className="text-xs font-mono leading-relaxed line-clamp-3"
            style={{ color: task.status === 'done' ? C.success : C.error }}>
            {task.output.trim().slice(0, 200)}
          </p>
        </div>
      )}
    </div>
  );
}

export default function TaskQueue({ tasks, onClear }: Props) {
  const pending = tasks.filter(t => t.status === 'pending').length;
  const running = tasks.filter(t => t.status === 'running').length;
  const done = tasks.filter(t => t.status === 'done').length;
  const failed = tasks.filter(t => t.status === 'failed').length;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ background: C.bg, scrollbarWidth: 'none' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold" style={{ color: C.text }}>タスクキュー</h2>
          <p className="text-xs mt-0.5" style={{ color: C.textMuted }}>
            待機 {pending} / 実行中 {running} / 完了 {done} / 失敗 {failed}
          </p>
        </div>
        {tasks.length > 0 && (
          <button onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium active:scale-95 transition-all"
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.textSub }}>
            <Trash2 size={12} />全クリア
          </button>
        )}
      </div>

      {/* Summary pills */}
      {tasks.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {[
            { label: `待機 ${pending}`, bg: C.beigeAlt, color: C.textSub, show: pending > 0 },
            { label: `実行中 ${running}`, bg: C.skyLight, color: '#0369A1', show: running > 0 },
            { label: `完了 ${done}`, bg: '#F0FDF4', color: C.success, show: done > 0 },
            { label: `失敗 ${failed}`, bg: '#FFF1F2', color: C.error, show: failed > 0 },
          ].filter(p => p.show).map((p, i) => (
            <span key={i} className="flex-shrink-0 text-xs px-3 py-1 rounded-full font-medium"
              style={{ background: p.bg, color: p.color }}>
              {p.label}
            </span>
          ))}
        </div>
      )}

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: C.skyLight, border: `1px solid rgba(56,189,248,0.4)` }}>
            <Clock size={26} style={{ color: C.sky }} />
          </div>
          <p className="text-sm" style={{ color: C.textSub }}>タスクキューは空です</p>
          <p className="text-xs" style={{ color: C.textMuted }}>コードモードで送信するとここに表示されます</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Running first */}
          {tasks.filter(t => t.status === 'running').map(t => <TaskCard key={t.id} task={t} />)}
          {/* Then pending */}
          {tasks.filter(t => t.status === 'pending').map(t => <TaskCard key={t.id} task={t} />)}
          {/* Then done/failed in reverse order */}
          {tasks.filter(t => t.status === 'done' || t.status === 'failed').reverse().map(t => <TaskCard key={t.id} task={t} />)}
        </div>
      )}

      <div className="h-4" />

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%,100% { transform: scaleY(1); }
          50% { transform: scaleY(1.6); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
