'use client';
/**
 * 「この区画を、いまどこまで通り過ぎたか」を 0〜1 で返す。
 *
 *  ・ページのスクロールはふつうのまま。横取り・強制移動・固定はしない。
 *  ・読み取りは passive、描き換えは requestAnimationFrame でまとめる。
 *  ・区画が画面の外にあるあいだ、タブが見えていないあいだは計算しない。
 *  ・止めているときは、完成した状態を一度だけ渡すか、いまの姿のまま凍らせる。
 *
 * 返り値ではなく渡した関数で受け取る。1フレームごとにReactを描き直さないため。
 */
import { useEffect, useRef } from 'react';

export function useStageProgress(
  ref: React.RefObject<HTMLElement | null>,
  apply: (p: number) => void,
  opts: { paused: boolean; applyOnPause?: number | null } = { paused: false },
) {
  const raf = useRef(0);
  /* applyOnPause が数値なら、その位置の姿を一度だけ出して止める。
     null なら**いま出ている姿のまま**凍らせる（読んでいる場面を失わない）。 */
  const { paused, applyOnPause = null } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (paused) {
      if (applyOnPause !== null) apply(applyOnPause);
      return;
    }

    const read = () => {
      raf.current = 0;
      if (document.hidden) return;
      const rect = el.getBoundingClientRect();
      /* 画面の外にあるあいだは計算しない。
         「外かどうか」は、そのとき測った位置で判断する。
         監視役（IntersectionObserver）の知らせだけを頼りにすると、
         戻ってきたのに知らせが届かないまま止まったままになることがある。 */
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
      const travel = el.offsetHeight - window.innerHeight;
      const p = travel > 0
        ? Math.min(1, Math.max(0, -rect.top / travel))
        : (rect.top < window.innerHeight * 0.5 ? 1 : 0);
      apply(p);
    };
    const schedule = () => { if (!raf.current) raf.current = requestAnimationFrame(read); };

    // 画面に入ってきたときに、読み直しのきっかけを作るだけ
    const io = new IntersectionObserver(() => schedule(), { rootMargin: '10% 0px' });
    io.observe(el);

    const onVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(raf.current); raf.current = 0; }
      else schedule();
    };

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    schedule();

    return () => {
      cancelAnimationFrame(raf.current); raf.current = 0;
      io.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ref, apply, paused, applyOnPause]);
}

/** 0〜1 のうち [a,b] の区間だけを 0〜1 に取り出す */
export const span = (p: number, a: number, b: number) =>
  Math.min(1, Math.max(0, (p - a) / (b - a)));

/** 行き過ぎ・戻りが自然に見える緩急 */
export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
