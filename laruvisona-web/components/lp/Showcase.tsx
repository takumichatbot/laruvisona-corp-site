'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Check, MousePointer2 } from 'lucide-react';
import { LP_SHOWCASE } from '@/lib/lp-showcase';

/** 作例は公開用HTMLの画面写真。操作する実物のデモとは分けて表示する。 */
export default function Showcase() {
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const current = LP_SHOWCASE[active];
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const paint = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      const progress = mq.matches
        ? 0
        : Math.max(0, Math.min(1, -box.top / Math.max(1, box.height)));
      el.style.setProperty('--depart', String(progress));
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener('scroll', scroll, { passive: true });
    mq.addEventListener('change', scroll);
    paint();
    return () => {
      window.removeEventListener('scroll', scroll);
      mq.removeEventListener('change', scroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="lp-showcase" ref={root} id="works">
      <div
        className="lp-industry-tabs"
        role="radiogroup"
        aria-label="作例の業種"
      >
        {LP_SHOWCASE.map((item, i) => (
          <button
            key={item.id}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active === i}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              let next = i;
              if (['ArrowRight', 'ArrowDown'].includes(e.key))
                next = (i + 1) % 4;
              else if (['ArrowLeft', 'ArrowUp'].includes(e.key))
                next = (i + 3) % 4;
              else if (e.key === 'Home') next = 0;
              else if (e.key === 'End') next = 3;
              else return;
              e.preventDefault();
              setActive(next);
              buttons.current[next]?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="lp-showcase-stage" aria-label={`${current.label}の作例`}>
        <div className="lp-stage-orbit" aria-hidden="true" />
        <div className="lp-side-window lp-side-left" aria-hidden="true">
          <div className="lp-window-top">
            <i />
            <i />
            <i />
          </div>
          <Image
            src={LP_SHOWCASE[(active + 3) % 4].image}
            alt=""
            width={1100}
            height={830}
            sizes="280px"
          />
        </div>
        <div className="lp-side-window lp-side-right" aria-hidden="true">
          <div className="lp-window-top">
            <i />
            <i />
            <i />
          </div>
          <Image
            src={LP_SHOWCASE[(active + 1) % 4].image}
            alt=""
            width={1100}
            height={830}
            sizes="280px"
          />
        </div>
        <div
          className="lp-main-window"
          style={{ borderColor: current.tone }}
          key={current.id}
        >
          <div className="lp-window-top">
            <span className="lp-window-dots">
              <i />
              <i />
              <i />
            </span>
            <span>{current.name}</span>
            <span className="lp-window-status">
              <Check size={11} />
              公開イメージ
            </span>
          </div>
          <Image
            src={current.image}
            alt={`${current.name}の作例。${current.label}の架空のホームページ`}
            width={1100}
            height={830}
            sizes="(max-width: 760px) 88vw, 720px"
            loading="eager"
            fetchPriority={active === 0 ? 'high' : 'auto'}
          />
        </div>
        <span className="lp-stage-label" aria-hidden="true">
          <MousePointer2 size={15} />
          <span>あなたの「らしさ」を。</span>
        </span>
      </div>
      <div className="lp-showcase-caption">
        <p aria-live="polite">
          <span>{current.label}</span>
          {current.copy}
        </p>
        <Link href={`/laruHP/studio?industry=${current.id}`}>
          この業種で作る
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <p className="lp-example-note">
        架空のお店・会社の作例です。写真は生成した素材を使用しています。
      </p>
    </div>
  );
}
