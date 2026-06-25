export interface TaskRecord {
  id: string;
  projectName: string;
  type: 'code' | 'chat' | 'team' | 'brain' | 'git' | 'other';
  input: string;
  outputPreview: string;
  status: 'success' | 'failed';
  ts: number;
  durationMs: number;
  taskCount?: number;
}

const KEY = 'bridge_task_history_v2';
const MAX = 500;

function load(): TaskRecord[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function save(r: TaskRecord[]) {
  try { localStorage.setItem(KEY, JSON.stringify(r.slice(-MAX))); } catch {}
}

export function addRecord(rec: Omit<TaskRecord, 'id'>): TaskRecord {
  const r: TaskRecord = { ...rec, id: `${Date.now()}_${Math.random().toString(36).slice(2)}` };
  const all = load(); all.push(r); save(all); return r;
}

export function getRecords(projectName?: string, limit = 100): TaskRecord[] {
  const all = load();
  return (projectName ? all.filter(r => r.projectName === projectName) : all).slice(-limit).reverse();
}

export function getStats(projectName?: string) {
  const all = load();
  const recs = projectName ? all.filter(r => r.projectName === projectName) : all;
  const today = Date.now() - 86400000;
  const todayRecs = recs.filter(r => r.ts > today);
  const succeeded = recs.filter(r => r.status === 'success');
  const durations = succeeded.filter(r => r.durationMs > 0);
  return {
    total: recs.length,
    todayCount: todayRecs.length,
    todaySuccess: todayRecs.filter(r => r.status === 'success').length,
    successRate: recs.length ? Math.round(succeeded.length / recs.length * 100) : 0,
    avgDurationSec: durations.length
      ? Math.round(durations.reduce((s, r) => s + r.durationMs, 0) / durations.length / 1000)
      : 0,
    recent: recs.slice(-8).reverse(),
  };
}

export function clearHistory(projectName?: string) {
  if (!projectName) { try { localStorage.removeItem(KEY); } catch {} return; }
  save(load().filter(r => r.projectName !== projectName));
}
