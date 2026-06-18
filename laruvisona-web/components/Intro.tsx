'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function Intro({ onComplete }: { onComplete: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();

    // グロー
    tl.to(glowRef.current, { opacity: 1, scale: 1.4, duration: 1.2, ease: 'power2.out' }, 0)
    // ロゴ出現
      .to(logoRef.current, { opacity: 1, scale: 1, rotate: 0, duration: 0.8, ease: 'back.out(1.4)' }, 0.2)
    // タグライン
      .to(taglineRef.current, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.8)
    // ポーズ
      .to({}, { duration: 0.5 }, 1.3)
    // オーバーレイをスライドアップで退場
      .to(overlayRef.current, {
        yPercent: -100,
        duration: 1.0,
        ease: 'power4.inOut',
        onComplete,
      }, 1.8);

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
      <div className="relative flex flex-col items-center select-none px-6">
        {/* ロゴ */}
        <div
          ref={logoRef}
          className="flex-shrink-0 drop-shadow-[0_0_40px_rgba(255,255,255,0.2)]"
          style={{ opacity: 0, scale: 0.6, transform: 'scale(0.6) rotate(-15deg)' }}
        >
          <img src="/images/logo_dark.png" alt="LARUVisona" className="w-40 sm:w-52 h-auto" />
        </div>

        {/* タグライン */}
        <div
          ref={taglineRef}
          className="mt-6 sm:mt-8 text-slate-500 text-xs sm:text-sm font-bold tracking-[0.3em] sm:tracking-[0.4em] uppercase text-center"
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
