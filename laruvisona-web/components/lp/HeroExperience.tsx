'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pause, Play } from 'lucide-react';
import Showcase from './Showcase';
import { HeroMotion } from './hero-motion';
import './hero-experience.css';

const subscribe = (fn: () => void) => {
  const q = matchMedia('(prefers-reduced-motion: reduce)');
  q.addEventListener('change', fn);
  return () => q.removeEventListener('change', fn);
};
const motionQuery = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches;
const mounted = () => () => {};

/** A real video backdrop and independently rendered, controllable website geometry. */
export default function HeroExperience({
  children,
}: {
  children: React.ReactNode;
}) {
  const reduced = useSyncExternalStore(subscribe, motionQuery, () => true);
  const hydrated = useSyncExternalStore(
    mounted,
    () => true,
    () => false,
  );
  const [stopped, setStopped] = useState(false),
    [visible, setVisible] = useState(true),
    [playing, setPlaying] = useState(false),
    [failed, setFailed] = useState(false);
  const root = useRef<HTMLElement>(null),
    video = useRef<HTMLVideoElement>(null);
  const paused = reduced || stopped;
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: '80px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const sync = () => {
      if (paused || !visible || document.hidden) {
        el.pause();
        return;
      }
      // Do not fetch video on reduced-motion or save-data devices. Poster remains useful.
      const saveData = (
        navigator as Navigator & { connection?: { saveData?: boolean } }
      ).connection?.saveData;
      if (saveData) return;
      if (!el.getAttribute('src')) {
        el.src = matchMedia('(max-width:700px)').matches
          ? '/lp/film/flow-mobile.mp4'
          : '/lp/film/flow-desktop.mp4';
        el.load();
      }
      void el.play().catch(() => setPlaying(false));
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      el.pause();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [paused, visible]);
  return (
    <HeroMotion.Provider value={{ paused, reduced, visible }}>
      <section
        ref={root}
        className="lp-hero lp-cinema"
        data-motion={paused ? 'off' : 'on'}
        data-video={playing ? 'playing' : failed ? 'fallback' : 'poster'}
      >
        <div className="lp-film" aria-hidden="true">
          <video
            ref={video}
            muted
            playsInline
            loop
            preload="none"
            poster="/lp/film/flow-poster.webp"
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => {
              setFailed(true);
              setPlaying(false);
            }}
          />
          <div className="lp-film-shade" />
        </div>
        <div className="lp-cinema-inner">
          {children}
          <Showcase />
        </div>
        <div className="lp-cinema-footer">
          <span>写真から。言葉から。あなたの一枚へ。</span>
          {hydrated &&
            (reduced ? (
              <span className="lp-motion-note">動きを減らす設定で表示中</span>
            ) : (
              <button
                type="button"
                className="lp-film-control"
                aria-pressed={stopped}
                onClick={() => setStopped((v) => !v)}
              >
                {stopped ? <Play size={14} /> : <Pause size={14} />}
                <span>{stopped ? '動きを再開' : '動きを止める'}</span>
              </button>
            ))}
        </div>
      </section>
    </HeroMotion.Provider>
  );
}
