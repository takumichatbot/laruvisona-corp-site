'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, ToggleLeft, ToggleRight, Play } from 'lucide-react';

export interface Schedule {
  id: string;
  projectId: string;
  projectName: string;
  instruction: string;
  time: string;   // "HH:MM"
  days: string;   // "daily" | "mon,tue,..."
  enabled: boolean;
  lastRun?: number;
}

interface Props {
  projects: { id: string; name: string }[];
  onExecute: (schedule: Schedule) => void;
}

const DAYS = [
  { id: 'mon', label: '月' },
  { id: 'tue', label: '火' },
  { id: 'wed', label: '水' },
  { id: 'thu', label: '木' },
  { id: 'fri', label: '金' },
  { id: 'sat', label: '土' },
  { id: 'sun', label: '日' },
];

const STORAGE_KEY = 'bridge_schedules';

function loadSchedules(): Schedule[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveSchedules(s: Schedule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export default function SchedulePanel({ projects, onExecute }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ projectId: '', instruction: '', time: '09:00', days: 'daily' });
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  useEffect(() => { setSchedules(loadSchedules()); }, []);

  // Scheduler: check every minute
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const dayMap: Record<number, string> = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 0: 'sun' };
      const today = dayMap[now.getDay()];

      setSchedules(prev => {
        const updated = prev.map(s => {
          if (!s.enabled || s.time !== hhmm) return s;
          // Check day
          const shouldRun = s.days === 'daily' || s.days.split(',').includes(today);
          if (!shouldRun) return s;
          // Check not already run this minute
          const lastRunMin = s.lastRun ? Math.floor(s.lastRun / 60000) : 0;
          const nowMin = Math.floor(Date.now() / 60000);
          if (lastRunMin >= nowMin) return s;
          onExecute(s);
          return { ...s, lastRun: Date.now() };
        });
        saveSchedules(updated);
        return updated;
      });
    };
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [onExecute]);

  const addSchedule = () => {
    const project = projects.find(p => p.id === form.projectId) || projects[0];
    if (!project || !form.instruction.trim()) return;
    const days = selectedDays.length > 0 ? selectedDays.join(',') : 'daily';
    const s: Schedule = {
      id: Date.now().toString(),
      projectId: project.id,
      projectName: project.name,
      instruction: form.instruction.trim(),
      time: form.time,
      days,
      enabled: true,
    };
    const next = [...schedules, s];
    setSchedules(next);
    saveSchedules(next);
    setAdding(false);
    setForm({ projectId: '', instruction: '', time: '09:00', days: 'daily' });
    setSelectedDays([]);
  };

  const toggleSchedule = (id: string) => {
    const next = schedules.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setSchedules(next); saveSchedules(next);
  };

  const deleteSchedule = (id: string) => {
    const next = schedules.filter(s => s.id !== id);
    setSchedules(next); saveSchedules(next);
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-gray-600 text-xs tracking-widest uppercase">スケジュール実行</p>
        <button onClick={() => setAdding(v => !v)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
          style={{ background: adding ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)' }}>
          <Plus size={14} className={adding ? 'text-emerald-400' : 'text-gray-500'} />
        </button>
      </div>

      {/* 追加フォーム */}
      {adding && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <select value={form.projectId || projects[0]?.id} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
            className="w-full h-9 px-3 rounded-lg text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e7eb' }}>
            {projects.map(p => <option key={p.id} value={p.id} style={{ background: '#111' }}>{p.name}</option>)}
          </select>
          <textarea value={form.instruction} onChange={e => setForm(f => ({ ...f, instruction: e.target.value }))}
            placeholder="実行する指示を入力..." rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-700 resize-none outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
          <div className="flex items-center gap-3">
            <Clock size={14} className="text-gray-600 flex-shrink-0" />
            <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
              className="flex-1 h-9 px-3 rounded-lg text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e7eb', colorScheme: 'dark' }} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setSelectedDays([])}
              className="px-2 py-1 rounded-lg text-xs transition-all"
              style={{ background: selectedDays.length === 0 ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)', color: selectedDays.length === 0 ? '#6ee7b7' : '#6b7280', border: `1px solid ${selectedDays.length === 0 ? 'rgba(52,211,153,0.3)' : 'transparent'}` }}>
              毎日
            </button>
            {DAYS.map(d => (
              <button key={d.id} onClick={() => toggleDay(d.id)}
                className="w-8 h-7 rounded-lg text-xs transition-all"
                style={{ background: selectedDays.includes(d.id) ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', color: selectedDays.includes(d.id) ? '#a5b4fc' : '#6b7280', border: `1px solid ${selectedDays.includes(d.id) ? 'rgba(99,102,241,0.4)' : 'transparent'}` }}>
                {d.label}
              </button>
            ))}
          </div>
          <button onClick={addSchedule}
            className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-all active:scale-98"
            style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}>
            追加
          </button>
        </div>
      )}

      {schedules.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Clock size={28} className="text-gray-700" />
          <p className="text-gray-600 text-sm">スケジュールなし</p>
          <p className="text-gray-700 text-xs">+ で追加してください</p>
        </div>
      )}

      {schedules.map(s => (
        <div key={s.id} className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${s.enabled ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-sky-400 mb-0.5">{s.projectName}</p>
              <p className="text-sm text-gray-300 truncate">{s.instruction}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={() => onExecute(s)} title="今すぐ実行"
                className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-all"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Play size={11} className="text-gray-500" />
              </button>
              <button onClick={() => toggleSchedule(s.id)}
                className="active:scale-90 transition-all">
                {s.enabled
                  ? <ToggleRight size={22} className="text-emerald-400" />
                  : <ToggleLeft size={22} className="text-gray-700" />}
              </button>
              <button onClick={() => deleteSchedule(s.id)}
                className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-all"
                style={{ background: 'rgba(239,68,68,0.08)' }}>
                <Trash2 size={11} className="text-red-500" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={10} className="text-gray-700" />
            <span className="text-gray-600 text-xs font-mono">{s.time}</span>
            <span className="text-gray-700 text-xs">
              {s.days === 'daily' ? '毎日' : s.days.split(',').map(d => DAYS.find(x => x.id === d)?.label).join('')}
            </span>
            {s.lastRun && <span className="text-gray-700 text-xs ml-auto">最終: {new Date(s.lastRun).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
