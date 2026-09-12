'use client';
/**
 * ページ全体の「動き」を一箇所で預かる。
 *
 * 2つの状態を**別のもの**として扱う。
 *
 *   ・端末の「動きを減らす」設定（still）
 *       最初から動かさない。冒頭は1画面にたたみ、完成した姿を直接出す。
 *       たたむのは app/globals.css のメディアクエリ（JSではない）。
 *       設定を無視して動かす手段は出さない。出しても戻せないため。
 *
 *   ・読んでいる途中の手動停止（stopped）
 *       **いま見ている場面とページの高さをそのまま保って**止める。
 *       高さも配置も変えない。押せば同じ場面から再開する。
 *
 * 止めても、リンク・入力・スクロールの邪魔はしない。
 */
import {
  createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore,
} from 'react';

interface MotionState {
  /** 動きを出さない（端末の設定 or 手動停止） */
  paused: boolean;
  /** 端末の設定で、最初から止めている。完成した姿を出す側 */
  still: boolean;
  /** 手で止め直せるか。端末の設定で止まっているときは false */
  canToggle: boolean;
  toggle: () => void;
}

const Ctx = createContext<MotionState>({ paused: true, still: false, canToggle: false, toggle: () => {} });

export const useMotion = () => useContext(Ctx);

const QUERY = '(prefers-reduced-motion: reduce)';
const subscribe = (fn: () => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', fn);
  return () => mq.removeEventListener('change', fn);
};
const readReduced = () => window.matchMedia(QUERY).matches;
/** サーバでは false、端末では true。最初の描き直しの後だけ操作を出すために使う */
const mounted = (fn: () => void) => { void fn; return () => {}; };

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reduced = useSyncExternalStore(subscribe, readReduced, () => false);
  const ready = useSyncExternalStore(mounted, () => true, () => false);
  const [stopped, setStopped] = useState(false);

  const toggle = useCallback(() => setStopped(v => !v), []);
  const paused = reduced || stopped;

  const value = useMemo(
    () => ({ paused, still: reduced, canToggle: !reduced, toggle }),
    [paused, reduced, toggle],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {ready && <MotionControl />}
    </Ctx.Provider>
  );
}

/**
 * 画面の隅に置く操作。
 *
 * 置き場所は**左下**。右下は LARUbot のチャットが出る場所なので空けておく。
 * 端末の設定で止まっているときは、押しても再開できないのでボタンを出さない
 * （押せないボタンを出すと、表示と実際の動きが食い違う）。
 */
function MotionControl() {
  const { paused, canToggle, toggle } = useMotion();
  const base = 'fixed z-50 left-3 bottom-3 md:left-5 md:bottom-5 min-h-[40px] px-3.5 rounded-full '
    + 'border border-white/20 bg-[#040a14]/85 backdrop-blur text-[11px] md:text-[12px] font-bold '
    + 'inline-flex items-center';

  if (!canToggle) {
    return (
      <p id="page-motion-note" role="status" className={`${base} text-white/60`}>
        端末の設定で動きを止めています
      </p>
    );
  }
  return (
    <button
      type="button"
      id="page-motion"
      onClick={toggle}
      aria-pressed={paused}
      className={`${base} text-white/75 hover:text-white hover:border-white/45
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400`}
    >
      {paused ? '動きを再開' : '動きを止める'}
    </button>
  );
}
