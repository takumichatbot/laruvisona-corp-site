'use client';
import { Component, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Layers3 } from 'lucide-react';
import { LP_SHOWCASE } from '@/lib/lp-showcase';
import { useHeroMotion } from './hero-motion';
const Sculpture = dynamic(() => import('./SiteSculpture'), { ssr: false });
class SceneBoundary extends Component<
  { children: React.ReactNode; onFail: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
/** The 3D planes carry a capture of the actual exported site; they do not imitate an editor. */
export default function Showcase() {
  const [active, setActive] = useState(0),
    [spread, setSpread] = useState(false),
    [readyImage, setReadyImage] = useState(''),
    [available, setAvailable] = useState(false),
    [failed, setFailed] = useState(false);
  const { paused, reduced, visible } = useHeroMotion();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]),
    stage = useRef<HTMLDivElement>(null);
  const current = LP_SHOWCASE[active];
  const onReady = useCallback(
      () => setReadyImage(current.image),
      [current.image],
    ),
    onFail = useCallback(() => setFailed(true), []);
  useEffect(() => {
    if (reduced) return;
    const canvas = document.createElement('canvas'),
      gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      const timer = setTimeout(() => setAvailable(true), 180);
      return () => clearTimeout(timer);
    }
  }, [reduced]);
  useEffect(() => {
    if (paused) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const el = stage.current;
      if (!el) return;
      const b = el.getBoundingClientRect();
      setSpread(b.top < -b.height * 0.08);
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener('scroll', scroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', scroll);
      cancelAnimationFrame(frame);
    };
  }, [paused]);
  const live = available && !failed && !reduced;
  return (
    <div className="lp-showcase" id="works">
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
                next = (i + 1) % LP_SHOWCASE.length;
              else if (['ArrowLeft', 'ArrowUp'].includes(e.key))
                next = (i + LP_SHOWCASE.length - 1) % LP_SHOWCASE.length;
              else if (e.key === 'Home') next = 0;
              else if (e.key === 'End') next = LP_SHOWCASE.length - 1;
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
      <div
        ref={stage}
        className="lp-showcase-stage lp-sculpture"
        data-ready={live && readyImage === current.image}
        data-spread={spread}
        aria-label={`${current.label}の公開イメージを立体で表示`}
      >
        <div className="lp-scene-halo" aria-hidden="true" />
        <div className="lp-main-window">
          <Image
            src={current.image}
            alt={`${current.name}の作例。${current.label}の架空のホームページ`}
            width={1100}
            height={830}
            sizes="(max-width:760px) 90vw, 640px"
            loading="eager"
            fetchPriority={active === 0 ? 'high' : 'auto'}
          />
        </div>
        {live && (
          <div className="lp-webgl" onContextMenu={(e) => e.preventDefault()}>
            <SceneBoundary onFail={onFail}>
              <Sculpture
                image={current.image}
                spread={spread}
                paused={paused}
                visible={visible}
                onReady={onReady}
                onFail={onFail}
              />
            </SceneBoundary>
          </div>
        )}
        <div className="lp-scene-rule" aria-hidden="true">
          <span>写真</span>
          <i />
          <span>言葉</span>
          <i />
          <span>構成</span>
        </div>
      </div>
      <div className="lp-scene-actions">
        {live && !paused && (
          <button
            type="button"
            aria-pressed={spread}
            onClick={() => setSpread((v) => !v)}
          >
            <Layers3 size={15} />
            {spread ? '一枚に組み上げる' : '立体で分解して見る'}
          </button>
        )}
        <span>あなたがつくれる、完成の一例。</span>
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
