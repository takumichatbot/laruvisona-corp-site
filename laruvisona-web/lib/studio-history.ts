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
