'use client';
/**
 * 会社トップの主役ビジュアル。
 *
 * 素材（静止画・短い動画）が届くまでのあいだも、レイアウトと動きが成立するように
 * している。届いたら BRAND_VISUAL の値を差し替えるだけで入れ替わる。
 *
 * 決めごと:
 *  - 静止画が先。動画は後から重ねる。読み込みで見出しやボタンを待たせない。
 *  - 音は出さない。画面の中で再生する。止める手段を出す。
 *  - 端末が「動きを減らす」設定なら、動画は取りに行かない。
 *  - 素材が無いときは、この場で描く図形で成立させる。製品画面の偽物は置かない。
 */
import { useEffect, useRef, useState } from 'react';

export interface BrandVisualProps {
  /** 静止画（先に出る）。未納品なら空 */
  poster?: string;
  /** 動画。未納品なら空 */
  video?: string;
  /** 読み上げ用の説明。装飾なら空にする */
  alt?: string;
}

export default function BrandVisual({ poster = '', video = '', alt = '' }: BrandVisualProps) {
  const [reduced, setReduced] = useState(true);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mountVideo, setMountVideo] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // 画面に入ってから読む。開いた瞬間に動画を取りに行かない
  useEffect(() => {
    if (reduced || !video) return;
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver !== 'function') {
      // 監視できない環境では、少し待ってから読む（描画を先に済ませる）
      const t = window.setTimeout(() => setMountVideo(true), 300);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { setMountVideo(true); io.disconnect(); } });
    }, { rootMargin: '150px' });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, video]);

  const showVideo = mountVideo && !!video && !failed && !reduced;

  return (
    <div ref={boxRef}
      className="relative w-full aspect-[4/3] md:aspect-[16/10] rounded-2xl overflow-hidden bg-[#0b1524]">
      {/* 素材が届くまでの下地。抽象的な図形だけで、製品画面の偽物は置かない */}
      {!poster && (
        <div aria-hidden="true" className="absolute inset-0">
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(120% 90% at 15% 10%, #16304e 0%, #0b1524 55%, #070e18 100%)' }} />
          <div className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(125,211,252,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,.18) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(70% 60% at 30% 30%, #000 0%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(70% 60% at 30% 30%, #000 0%, transparent 75%)',
            }} />
          <div className="absolute right-[8%] bottom-[10%] w-[46%] aspect-square rounded-full blur-3xl opacity-40"
            style={{ background: 'conic-gradient(from 210deg, #0e7490, #1d4ed8, #0b1524)' }} />
        </div>
      )}

      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt={alt} className="absolute inset-0 w-full h-full object-cover"
          width={1600} height={1000} decoding="async" fetchPriority="high" />
      )}

      {showVideo && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          poster={poster || undefined}
          muted loop playsInline autoPlay preload="none"
          aria-hidden="true"
          onError={() => setFailed(true)}
        >
          <source src={video} type="video/mp4" />
        </video>
      )}

      {showVideo && (
        <button type="button"
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            if (v.paused) { v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
          }}
          aria-label={paused ? '背景の動きを再生する' : '背景の動きを止める'}
          className="absolute right-3 bottom-3 min-h-[44px] min-w-[44px] px-3 rounded-full bg-black/55 text-white text-xs hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">
          {paused ? '再生' : '停止'}
        </button>
      )}
    </div>
  );
}

/** 素材が届いたら、ここだけ差し替える */
export const BRAND_VISUAL = {
  poster: '',   // 例: '/brand/hero.jpg'
  video: '',    // 例: '/brand/hero.mp4'
  alt: '',      // 装飾として置くなら空のまま
};
