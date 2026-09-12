'use client';
import { useCallback, useReducer } from 'react';
import { reduceHistory, startHistory, type HistoryAction, type StudioHistory } from '@/lib/studio-history';
export function useStudioHistory<T>(initial: () => T) {
  const [history, dispatch] = useReducer((state: StudioHistory<T>, action: HistoryAction<T>) => reduceHistory(state, action), null, () => startHistory(initial()));
  const set = useCallback((value: T | ((previous: T) => T), group?: string) => dispatch({ type: 'edit', value, group, at: Date.now() }), []);
  const reset = useCallback((value: T) => dispatch({ type: 'reset', value }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const breakGroup = useCallback(() => dispatch({ type: 'break' }), []);
  return { site: history.present, setSite: set, resetSite: reset, undo, redo, breakGroup, canUndo: !!history.past.length, canRedo: !!history.future.length };
}
