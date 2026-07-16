'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

const SEEN_KEY = 'lv_intro_seen';

export default function Intro({ onComplete }: { onComplete: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [showSkip, setShowSkip] = useState(false);

  // onComplete を ref に保持（毎レンダーでeffectが再実行＝アニメ再スタートするのを防ぐ）
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // スキップ操作用: 現在のタイムラインを ref で持つ
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch {}
    onCompleteRef.current();
  };

  const skip = () => {
    if (doneRef.current) return;
    tlRef.current?.kill();
    gsap.to(overlayRef.current, { yPercent: -100, duration: 0.4, ease: 'power2.inOut', onComplete: finish });
  };

  useEffect(() => {
    // リピーター（同一セッション）と motion 配慮設定の人はイントロを流さない
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch {}
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (seen || reducedMotion) {
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.25, onComplete: finish });
      return;
    }

    const tl = gsap.timeline();
    tlRef.current = tl;
    tl.to(glowRef.current, { opacity: 1, scale: 1.4, duration: 0.8, ease: 'power2.out' }, 0)
      .to(logoRef.current, { opacity: 1, scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(1.4)' }, 0.1)
      .to(taglineRef.current, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.6)
      .to(overlayRef.current, {
        yPercent: -100,
        duration: 0.8,
        ease: 'power4.inOut',
        onComplete: finish,
      }, 1.2);

    const skipTimer = setTimeout(() => setShowSkip(true), 600);
    // 保険: GSAPが完了しなくても必ずイントロを閉じる（オーバーレイ残留を防止）
    const fallback = setTimeout(finish, 3000);

    return () => { tl.kill(); clearTimeout(fallback); clearTimeout(skipTimer); };
    // 一度だけ実行（onComplete は ref 経由で参照）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <img src="/images/logo_dark.png" alt="LaruVisona" className="w-40 sm:w-52 h-auto" />
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

      {/* スキップ */}
      {showSkip && (
        <button
          onClick={skip}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 hover:text-white/80 text-xs font-bold tracking-[0.2em] uppercase transition-colors px-4 py-2"
          aria-label="イントロをスキップ"
        >
          Skip →
        </button>
      )}

      {/* コーナーデコ */}
      <div className="absolute top-8 left-8 text-white/10 text-xs font-mono">EST. 2026 TOKYO</div>
      <div className="absolute bottom-8 right-8 text-white/10 text-xs font-mono">AI × WEB TECHNOLOGY</div>
    </div>
  );
}
