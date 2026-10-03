/** Immutable, bounded session history. Loading a site establishes a new boundary. */
export interface StudioHistory<T> {
  present: T;
  past: T[];
  future: T[];
  group?: string;
  at: number;
}
export type HistoryAction<T> =
  | { type: 'edit'; value: T | ((previous: T) => T); group?: string; at: number }
  | { type: 'reset'; value: T }
  | { type: 'undo' } | { type: 'redo' } | { type: 'break' };
export const startHistory = <T>(present: T): StudioHistory<T> => ({ present, past: [], future: [], at: 0 });
export function reduceHistory<T>(state: StudioHistory<T>, action: HistoryAction<T>): StudioHistory<T> {
  if (action.type === 'reset') return startHistory(action.value);
  if (action.type === 'break') return { ...state, group: undefined };
  if (action.type === 'undo') {
    if (!state.past.length) return state;
    return { present: state.past.at(-1)!, past: state.past.slice(0, -1), future: [state.present, ...state.future], at: 0 };
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state;
    return { present: state.future[0], past: [...state.past, state.present], future: state.future.slice(1), at: 0 };
  }
  const value = typeof action.value === 'function' ? (action.value as (previous: T) => T)(state.present) : action.value;
  if (value === state.present) return state;
  const grouped = action.group && action.group === state.group && action.at - state.at < 900 && !state.future.length;
  return { present: value, past: grouped ? state.past : [...state.past, state.present].slice(-50), future: [], group: action.group, at: action.at };
}

/**
 * 繰り返し項目（サービス・流れ・質問など）の中の文字だけを直した変更なら、その場所の名前を返す（「2.description」など）。
 * 同じ欄に続けて打った文字を、見出しや本文と同じように1回の取り消しにまとめるため。
 * 件数が変わる・並びが変わる・文字以外が変わる変更は null（それぞれ1回ずつ取り消せるように、まとめない）。
 */
export function listTextEditKey(prev: unknown, next: unknown): string | null {
  if (!Array.isArray(prev) || !Array.isArray(next) || prev.length !== next.length) return null;
  const changed = next.map((v, i) => (v === prev[i] ? -1 : i)).filter((i) => i >= 0);
  if (changed.length !== 1) return null;
  const i = changed[0], a = prev[i], b = next[i];
  if (typeof a === 'string' && typeof b === 'string') return String(i);
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return null;
  const ao = a as Record<string, unknown>, bo = b as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(ao), ...Object.keys(bo)])].filter((k) => ao[k] !== bo[k]);
  if (keys.length !== 1) return null;
  const k = keys[0];
  return (typeof ao[k] === 'string' || ao[k] === undefined) && typeof bo[k] === 'string' ? `${i}.${k}` : null;
}
