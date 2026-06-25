export interface SavedPrompt {
  id: string;
  label: string;
  prompt: string;
  mode: 'code' | 'chat' | 'team';
  starred: boolean;
  useCount: number;
  ts: number;
}

const KEY = 'bridge_prompt_library_v1';

function load(): SavedPrompt[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function save(p: SavedPrompt[]) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

export function getPrompts(filter?: { starred?: boolean; mode?: string }): SavedPrompt[] {
  let all = load();
  if (filter?.starred) all = all.filter(p => p.starred);
  if (filter?.mode) all = all.filter(p => p.mode === filter.mode);
  return all.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0) || b.useCount - a.useCount || b.ts - a.ts);
}

export function addPrompt(p: Omit<SavedPrompt, 'id' | 'ts' | 'useCount'>): SavedPrompt {
  const rec: SavedPrompt = { ...p, id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, ts: Date.now(), useCount: 0 };
  const all = load(); all.push(rec); save(all); return rec;
}

export function deletePrompt(id: string) { save(load().filter(p => p.id !== id)); }

export function toggleStar(id: string) {
  const all = load();
  const idx = all.findIndex(p => p.id === id);
  if (idx >= 0) { all[idx].starred = !all[idx].starred; save(all); }
  return load();
}

export function incrementUse(id: string) {
  const all = load();
  const idx = all.findIndex(p => p.id === id);
  if (idx >= 0) { all[idx].useCount++; save(all); }
}
