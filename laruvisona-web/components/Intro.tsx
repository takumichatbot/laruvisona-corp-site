'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function Intro({ onComplete }: { onComplete: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();

    // グロー
    tl.to(glowRef.current, { opacity: 1, scale: 1.4, duration: 1.2, ease: 'power2.out' }, 0)
    // ロゴ出現
      .to(logoRef.current, { opacity: 1, scale: 1, rotate: 0, duration: 0.7, ease: 'back.out(1.7)' }, 0.2)
    // ライン伸びる
      .to(lineRef.current, { scaleX: 1, duration: 0.5, ease: 'power3.out' }, 0.7)
    // テキスト
      .to(textRef.current, { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out' }, 0.8)
    // タグライン
      .to(taglineRef.current, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 1.1)
    // ポーズ
      .to({}, { duration: 0.5 }, 1.6)
    // オーバーレイをスライドアップで退場
      .to(overlayRef.current, {
        yPercent: -100,
        duration: 1.0,
        ease: 'power4.inOut',
        onComplete,
      }, 2.1);

    return () => { tl.kill(); };
  }, [onComplete]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[99999] bg-[#030712] flex items-center justify-center overflow-hidden"
    >
      {/* グリッドライン */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '60px 60px' }}
      />

      {/* グロー */}
      <div
        ref={glowRef}
        className="absolute w-[600px] h-[600px] rounded-full opacity-0"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)' }}
      />

      {/* コンテンツ */}
      <div className="relative flex flex-col items-center select-none">
        {/* ロゴ + テキスト */}
        <div className="flex items-center gap-5">
          <div
            ref={logoRef}
            className="w-20 h-20 bg-white text-black rounded-[1.5rem] flex items-center justify-center font-black text-4xl shadow-[0_0_60px_rgba(255,255,255,0.3)]"
            style={{ opacity: 0, scale: 0.6, transform: 'scale(0.6) rotate(-15deg)' }}
          >
            L
          </div>

          {/* ライン */}
          <div
            ref={lineRef}
            className="h-[1px] w-16 bg-white/30 origin-left"
            style={{ transform: 'scaleX(0)', transformOrigin: 'left' }}
          />

          {/* テキスト */}
          <div
            ref={textRef}
            className="text-5xl font-black tracking-tight text-white"
            style={{ opacity: 0, x: 20 }}
          >
            LARU<span className="font-light text-slate-400">Visona</span>
          </div>
        </div>

        {/* タグライン */}
        <div
          ref={taglineRef}
          className="mt-8 text-slate-500 text-sm font-bold tracking-[0.4em] uppercase"
          style={{ opacity: 0, y: 10 }}
        >
          Imagine · Implement · Innovate
        </div>
      </div>

      {/* コーナーデコ */}
      <div className="absolute top-8 left-8 text-white/10 text-xs font-mono">EST. 2026 TOKYO</div>
      <div className="absolute bottom-8 right-8 text-white/10 text-xs font-mono">AI × WEB TECHNOLOGY</div>
    </div>
  );
}
