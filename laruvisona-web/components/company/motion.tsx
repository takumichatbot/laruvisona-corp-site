'use client';
/**
 * ページ全体の「動き」を一箇所で預かる。
 *
 * ここで決めていること:
 *  ・端末の「動きを減らす」設定は、最初の描画から反映する（後から止めない）。
 *  ・止めているあいだは、演出は完成した状態を出す。読むものは全部見える。
 *  ・スクロールの読み取りは passive、描き換えは requestAnimationFrame に一本化。
 *  ・画面外・タブ非表示のときは計算そのものを止める。
 *
 * 演出を止めても、リンク・入力・スクロールの邪魔をしない。
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore,
} from 'react';

interface MotionState {
  /** 演出を止めているか（端末の設定 or 本人の操作） */
  paused: boolean;
  /** 本人が押して止めたか。端末の設定と区別して表示に使う */
  toggle: () => void;
  /** 端末が「動きを減らす」設定か */
  reduced: boolean;
}

const Ctx = createContext<MotionState>({ paused: true, toggle: () => {}, reduced: false });

export const useMotion = () => useContext(Ctx);

/* 端末の「動きを減らす」設定を、描き直しを重ねずに読む */
const QUERY = '(prefers-reduced-motion: reduce)';
const subscribe = (fn: () => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', fn);
  return () => mq.removeEventListener('change', fn);
};
const readReduced = () => window.matchMedia(QUERY).matches;

export function MotionProvider({ children }: { children: React.ReactNode }) {
  // サーバ側では false（＝動く前提のHTMLを配る）。端末では最初の描画から実際の設定で描く
  const reduced = useSyncExternalStore(subscribe, readReduced, () => false);
  const [stopped, setStopped] = useState(false);

  const toggle = useCallback(() => setStopped(v => !v), []);
  const paused = reduced || stopped;

  const value = useMemo(() => ({ paused, toggle, reduced }), [paused, toggle, reduced]);

  useEffect(() => {
    document.documentElement.dataset.motion = paused ? 'paused' : 'running';
    return () => { delete document.documentElement.dataset.motion; };
  }, [paused]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <MotionButton />
    </Ctx.Provider>
  );
}

/**
 * 画面の隅に置く停止ボタン。
 *
 * 置き場所は**左下**。右下は LARUbot のチャットが出る場所なので空けておく。
 * （スマホでチャット・停止ボタン・相談の導線が重ならないこと）
 */
function MotionButton() {
  const { paused, toggle, reduced } = useMotion();
  return (
    <button
      type="button"
      id="page-motion"
      onClick={toggle}
      aria-pressed={paused}
      className="fixed z-50 left-3 bottom-3 md:left-5 md:bottom-5 min-h-[40px] px-3.5
        rounded-full border border-white/20 bg-[#040a14]/85 backdrop-blur
        text-[11px] md:text-[12px] font-bold text-white/75 hover:text-white hover:border-white/45
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
    >
      {paused ? '動きを再開' : '動きを止める'}
      {reduced && paused && <span className="sr-only">（端末の設定で動きを減らしています）</span>}
    </button>
  );
}
