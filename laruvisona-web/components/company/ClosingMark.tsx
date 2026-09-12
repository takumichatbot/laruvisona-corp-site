'use client';
/**
 * ページの終わり。散った粒が、もう一度ロゴへ戻って静かになる。
 * 冒頭と同じ座標（components/company/mark.ts）を使う。別の形は作らない。
 */
import { useCallback, useRef } from 'react';
import { useMotion } from './motion';
import { useStageProgress, span, easeOut, mix } from './useStageProgress';
import { MARK, MARK_VIEWBOX, BRAND_GRADIENT } from './mark';

export default function ClosingMark() {
  const box = useRef<HTMLDivElement>(null);
  const circles = useRef<Array<SVGCircleElement | null>>([]);
  const { paused, still } = useMotion();

  const apply = useCallback((p: number) => {
    const t = easeOut(span(p, 0, 0.9));
    for (let i = 0; i < MARK.length; i++) {
      const c = circles.current[i];
      if (!c) continue;
      const [x, y, r] = MARK[i];
      // 散らばった位置は、粒ごとに決め打ち（乱数を使わない＝毎回同じ動き）
      const away = ((i * 137) % 360) * (Math.PI / 180);
      const d = 220 + (i % 3) * 90;
      c.setAttribute('cx', String(mix(x + Math.cos(away) * d, x, t)));
      c.setAttribute('cy', String(mix(y + Math.sin(away) * d, y, t)));
      c.setAttribute('r', String(mix(r * 0.5, r, t)));
      c.setAttribute('opacity', String(mix(0.25, 1, t)));
    }
  }, []);

  useStageProgress(box, apply, { paused, applyOnPause: still ? 1 : null });

  return (
    <div ref={box} className="relative h-[34svh] min-h-[210px] flex items-center justify-center" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_60%,rgba(14,115,190,.2),transparent_70%)]" />
      <svg viewBox={MARK_VIEWBOX} className="relative h-[26svh] max-h-[220px] w-auto overflow-visible">
        <defs>
          <linearGradient id="lv-closing" gradientUnits="userSpaceOnUse"
            x1={BRAND_GRADIENT.x1} y1={BRAND_GRADIENT.y1} x2={BRAND_GRADIENT.x2} y2={BRAND_GRADIENT.y2}>
            <stop offset="0" stopColor={BRAND_GRADIENT.from} />
            <stop offset="1" stopColor={BRAND_GRADIENT.to} />
          </linearGradient>
        </defs>
        {MARK.map(([cx, cy, r], i) => (
          <circle key={i} ref={el => { circles.current[i] = el; }} cx={cx} cy={cy} r={r} fill="url(#lv-closing)" />
        ))}
      </svg>
    </div>
  );
}
