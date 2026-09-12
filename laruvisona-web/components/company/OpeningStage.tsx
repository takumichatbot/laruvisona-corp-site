'use client';
/**
 * 会社トップの冒頭。一続きの体験の前半。
 *
 *   ① 深い紺の空間に、透明な一滴。
 *   ② スクロールに合わせて一滴が分かれ、正式ロゴの粒の配置へ整う。
 *   ③ 透明な面がひらき、その向こうから実物（操作できるLARU HP）が現れる。
 *
 * 守っていること:
 *  ・ページのスクロールはふつうのまま。ホイールの横取り・強制移動・待機はしない。
 *  ・最初の表示はHTMLと静止画だけで成立する。JavaScriptが動かなくても読める。
 *  ・粒の位置は public/images/laruvisona_mark.svg の座標そのもの。目測で置かない。
 *    仕上がりは同じ座標・同じ配色の円へ重ねて渡すので、ずれようがない。
 *  ・文字は透明度と少しの移動だけ。ぼかしたり歪めたりして読みにくくしない。
 *  ・止めているときは、完成した状態を出す。
 *
 * ここにあるのは水と光の演出であって、流体の物理計算ではない。
 * 背景の静止画は生成画像、粒と光の動きはコード、文字はHTML。
 */
import Image from 'next/image';
import { useCallback, useEffect, useRef } from 'react';
import { useMotion } from './motion';
import { useStageProgress, span, ease, easeOut, mix } from './useStageProgress';
import { MARK, MARK_VIEWBOX, BRAND_GRADIENT } from './mark';

/** 一滴だったときの中心と大きさ（viewBox の座標） */
const DROP = { x: 468, y: 495, r: 270 };
/**
 * 粒が出ていく順番。0番は「元の一滴」で、最後まで残って最後に落ち着く。
 * 他の粒は、そのときの一滴の位置から生まれて、それぞれの席へ向かう。
 */
const PARENT = 0;
const ORDER = [5, 6, 1, 2, 3, 4, 7, 8, 9, 0];

export default function OpeningStage() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const glassWrap = useRef<HTMLDivElement>(null);
  const glassL = useRef<HTMLDivElement>(null);
  const glassR = useRef<HTMLDivElement>(null);
  const svgWrap = useRef<HTMLDivElement>(null);
  const drops = useRef<Array<SVGGElement | null>>([]);
  const flats = useRef<Array<SVGCircleElement | null>>([]);
  const glassLayer = useRef<SVGGElement>(null);
  const markLayer = useRef<SVGGElement>(null);
  const copy1 = useRef<HTMLDivElement>(null);
  const copy2 = useRef<HTMLDivElement>(null);
  const copy3 = useRef<HTMLDivElement>(null);
  const { paused } = useMotion();
  /** 止めているときの姿。完成した配置と、主コピーをそのまま出す */
  const still = useCallback(() => {
    const el = stage.current;
    if (!el) return;
    el.dataset.act = 'still';
    if (art.current) { art.current.style.transform = 'scale(1.08)'; art.current.style.opacity = '0.5'; }
    for (let i = 0; i < MARK.length; i++) {
      const [x, y, r] = MARK[i];
      drops.current[i]?.setAttribute('transform', `translate(${x} ${y}) scale(${r})`);
      const f = flats.current[i];
      if (f) { f.setAttribute('cx', String(x)); f.setAttribute('cy', String(y)); f.setAttribute('r', String(r)); }
    }
    if (glassLayer.current) glassLayer.current.style.opacity = '0';
    if (markLayer.current) markLayer.current.style.opacity = '1';
    if (glassWrap.current) glassWrap.current.style.opacity = '0';
    if (svgWrap.current) { svgWrap.current.style.transform = 'none'; svgWrap.current.style.opacity = '1'; }
    for (const [e, o] of [[copy1.current, 1], [copy2.current, 0], [copy3.current, 0]] as const) {
      if (!e) continue;
      e.style.opacity = String(o);
      e.style.transform = 'none';
      e.style.pointerEvents = o ? 'auto' : 'none';
      e.setAttribute('aria-hidden', o ? 'false' : 'true');
    }
  }, []);

  const apply = useCallback((p: number) => {
    const el = stage.current;
    if (!el) return;
    if (paused) { still(); return; }
    el.dataset.act = p < 0.3 ? '1' : p < 0.66 ? '2' : '3';

    /* ── 背景。ゆっくり寄って、暗くなる ── */
    if (art.current) {
      const a = easeOut(span(p, 0, 0.75));
      art.current.style.transform = `scale(${mix(1.06, 1.16, a)}) translate3d(0,${mix(0, -2.5, a)}%,0)`;
      art.current.style.opacity = String(mix(1, 0.26, easeOut(span(p, 0.25, 0.78))));
    }

    /* ── 粒。一滴 → 正式ロゴの配置 ── */
    const gather = ease(span(p, 0.16, 0.62));
    const at = (i: number) => {
      const seat = ORDER.indexOf(i);
      const delay = (seat / MARK.length) * 0.5;
      return ease(Math.min(1, Math.max(0, (gather - delay) / (1 - 0.5))));
    };
    // 元の一滴。ここから他の粒が生まれるので、先に位置を出しておく
    const pt = at(PARENT);
    const [px0, py0, pr0] = MARK[PARENT];
    const parentX = mix(DROP.x, px0, pt);
    const parentY = mix(DROP.y, py0, pt);
    const parentR = mix(DROP.r, pr0, pt);

    for (let i = 0; i < MARK.length; i++) {
      const t = i === PARENT ? pt : at(i);
      const [tx, ty, tr] = MARK[i];
      // まっすぐ動かさず、少しふくらませる。水が分かれて散る感じに寄せる
      const swell = i === PARENT ? 0 : Math.sin(t * Math.PI) * (i >= 7 ? 90 : 46) * (i % 2 ? 1 : -1);
      const x = (i === PARENT ? parentX : mix(parentX, tx, t)) + swell * 0.35;
      const y = (i === PARENT ? parentY : mix(parentY, ty, t)) - swell * 0.5;
      // 生まれたばかりの粒は小さい。同じ大きさの輪が入れ子に見えないように
      const r = i === PARENT ? parentR : mix(0, tr, easeOut(Math.min(1, t * 1.35)));
      drops.current[i]?.setAttribute('transform', `translate(${x} ${y}) scale(${Math.max(r, 0.001)})`);
      const f = flats.current[i];
      if (f) { f.setAttribute('cx', String(x)); f.setAttribute('cy', String(y)); f.setAttribute('r', String(Math.max(r, 0))); }
    }
    // 水の見え方から、正式ロゴの塗りへ渡す（同じ座標なので継ぎ目が出ない）
    const settle = span(p, 0.55, 0.66);
    if (glassLayer.current) glassLayer.current.style.opacity = String(1 - settle);
    if (markLayer.current) markLayer.current.style.opacity = String(settle);

    /* ── ロゴが画面の隅へ収まり、透明な面がひらく ── */
    if (svgWrap.current) {
      const away = easeOut(span(p, 0.66, 0.94));
      svgWrap.current.style.transform =
        `translate3d(${away * -12}%, ${away * -26}%, 0) scale(${mix(1, 0.34, away)})`;
      svgWrap.current.style.opacity = String(1 - span(p, 0.78, 0.96));
    }
    const open = easeOut(span(p, 0.6, 1));
    if (glassWrap.current) glassWrap.current.style.opacity = String(span(p, 0.46, 0.62) * (1 - span(p, 0.9, 1)));
    if (glassL.current) glassL.current.style.transform = `translate3d(${open * -102}%,0,0)`;
    if (glassR.current) glassR.current.style.transform = `translate3d(${open * 102}%,0,0)`;

    /* ── 文字。一度に1つだけ。読みやすさを落とさない ── */
    const show = (e: HTMLDivElement | null, o: number, dy: number) => {
      if (!e) return;
      e.style.opacity = String(o);
      e.style.transform = `translate3d(0,${dy}px,0)`;
      e.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
      e.setAttribute('aria-hidden', o < 0.05 ? 'true' : 'false');
    };
    const o1 = 1 - span(p, 0.2, 0.34);
    const o2 = Math.min(span(p, 0.3, 0.44), 1 - span(p, 0.6, 0.72));
    const o3 = Math.min(span(p, 0.68, 0.8), 1);
    show(copy1.current, o1, (1 - o1) * -26);
    show(copy2.current, o2, (1 - Math.min(o2 + span(p, 0.6, 0.72), 1)) * 22);
    show(copy3.current, o3, (1 - o3) * 22);
  }, [paused, still]);

  useStageProgress(section, apply, { paused, pausedProgress: 1 });

  // 止めているあいだ、粒は完成した配置のまま置く
  useEffect(() => { if (paused) still(); }, [paused, still]);

  return (
    <section
      ref={section}
      id="opening"
      aria-label="株式会社LaruVisona"
      className="relative z-0 h-[320svh] data-[still=yes]:h-[100svh]"
      data-still={paused ? 'yes' : 'no'}
    >
      <div
        ref={stage}
        data-act="1"
        className="sticky top-0 h-[100svh] overflow-hidden bg-[#04080f]"
      >
        {/* 背景の生成画像。読み上げには出さない飾り */}
        <div ref={art} className="absolute inset-0 will-change-transform" aria-hidden="true">
          <Image
            src="/brand/water/water-1.webp" alt="" fill priority
            sizes="100vw" className="object-cover object-[68%_50%]"
          />
        </div>
        {/* 空気。文字を読ませるための覆いでもある */}
        <div aria-hidden="true" className="absolute inset-0
          bg-[radial-gradient(120%_90%_at_78%_38%,rgba(10,44,80,.35),transparent_62%)]" />
        <div aria-hidden="true" className="absolute inset-0
          bg-[linear-gradient(180deg,rgba(4,8,15,.86)_0%,rgba(4,8,15,.32)_26%,rgba(4,8,15,.38)_58%,rgba(4,8,15,.95)_100%)]
          lg:bg-[linear-gradient(96deg,rgba(4,8,15,.94)_0%,rgba(4,8,15,.72)_36%,rgba(4,8,15,.1)_62%,rgba(4,8,15,.55)_100%)]" />

        {/* 粒。位置は正式ロゴの座標そのもの */}
        <div
          ref={svgWrap}
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center lg:justify-end lg:pr-[8%]
            -translate-y-[3%] lg:translate-y-0 will-change-transform"
        >
          <svg
            viewBox={MARK_VIEWBOX}
            className="h-[48svh] max-h-[560px] w-auto lg:h-[74svh] lg:max-h-[760px] overflow-visible"
          >
            <defs>
              {/* 水の粒。中は透けていて、ふちで光る。塗りつぶした玉にしない */}
              <radialGradient id="lv-drop" cx="34%" cy="27%" r="78%">
                <stop offset="0" stopColor="#ffffff" stopOpacity=".10" />
                <stop offset=".42" stopColor="#bfe9ff" stopOpacity=".05" />
                <stop offset=".74" stopColor="#04202f" stopOpacity=".20" />
                <stop offset=".90" stopColor="#a9e2ff" stopOpacity=".48" />
                <stop offset=".975" stopColor="#eaf9ff" stopOpacity=".76" />
                <stop offset="1" stopColor="#ffffff" stopOpacity=".25" />
              </radialGradient>
              <radialGradient id="lv-spec" cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="lv-brand" gradientUnits="userSpaceOnUse"
                x1={BRAND_GRADIENT.x1} y1={BRAND_GRADIENT.y1} x2={BRAND_GRADIENT.x2} y2={BRAND_GRADIENT.y2}>
                <stop offset="0" stopColor={BRAND_GRADIENT.from} />
                <stop offset="1" stopColor={BRAND_GRADIENT.to} />
              </linearGradient>
            </defs>

            <g ref={glassLayer}>
              {MARK.map((_, i) => (
                <g key={i} ref={el => { drops.current[i] = el; }}>
                  <circle r="1" fill="url(#lv-drop)" />
                  <circle r="1" fill="none" stroke="#dff4ff" strokeOpacity=".26" strokeWidth=".024" />
                  <ellipse cx="-.34" cy="-.46" rx=".26" ry=".15" fill="url(#lv-spec)" opacity=".8" transform="rotate(-22)" />
                  <ellipse cx=".36" cy=".42" rx=".2" ry=".085" fill="url(#lv-spec)" opacity=".3" transform="rotate(-18)" />
                </g>
              ))}
            </g>
            <g ref={markLayer} style={{ opacity: 0 }}>
              {MARK.map(([cx, cy, r], i) => (
                <circle key={i} ref={el => { flats.current[i] = el; }} cx={cx} cy={cy} r={r} fill="url(#lv-brand)" />
              ))}
            </g>
          </svg>
        </div>

        {/* 透明な面。ひらいた向こうから実物が出てくる */}
        <div ref={glassWrap} aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ opacity: 0 }}>
          <div ref={glassL} className="absolute inset-y-0 left-0 w-1/2 will-change-transform
            bg-[linear-gradient(100deg,rgba(160,214,240,.04),rgba(228,247,255,.12)_62%,rgba(226,246,255,.22))]" />
          <div ref={glassR} className="absolute inset-y-0 right-0 w-1/2 will-change-transform
            bg-[linear-gradient(260deg,rgba(160,214,240,.04),rgba(228,247,255,.12)_62%,rgba(226,246,255,.22))]" />
        </div>

        {/* 文字はHTML。ここが読むところ */}
        <div className="relative h-full max-w-6xl mx-auto px-5 md:px-8 flex flex-col justify-center">
          <div ref={copy1} className="max-w-[30rem] lg:max-w-[34rem] will-change-[opacity,transform]">
            <p className="flex items-center gap-2.5 text-[10px] md:text-[11px] font-bold tracking-[0.22em] text-sky-100/85 mb-6
              [text-shadow:0_1px_14px_rgba(4,8,15,.95)]">
              <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400" />
              発想と技術で、事業の可能性を広げる
            </p>
            <h1 className="text-[34px] leading-[1.34] sm:text-[48px] md:text-[58px] lg:text-[64px] font-bold
              tracking-[-0.015em] [text-shadow:0_2px_30px_rgba(4,8,15,.95)]">
              <span className="block whitespace-nowrap">まだないものを、</span>
              <span className="block whitespace-nowrap">使えるものへ。</span>
            </h1>
            <p className="mt-6 text-[15px] md:text-[17px] leading-[2] text-slate-200/90
              [text-shadow:0_1px_20px_rgba(4,8,15,.95)]">
              AI・ウェブ・システムを、構想から実装まで。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#live"
                className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-xl bg-white text-[#04101c] font-bold
                  hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                実物を見る
              </a>
              <a href="#contact"
                className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-xl border border-white/25
                  bg-[#04080f]/40 font-bold hover:border-white/60
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                相談する
              </a>
            </div>
          </div>

          <div ref={copy2} style={{ opacity: 0 }}
            className="absolute left-5 md:left-8 bottom-[16svh] max-w-[26rem] will-change-[opacity,transform]">
            <p className="text-[13px] md:text-[15px] leading-[2] text-slate-200/85">
              一滴が集まって、かたちになる。
              <br />
              株式会社LaruVisona のしるしは、そこから来ています。
            </p>
          </div>

          <div ref={copy3} style={{ opacity: 0 }}
            className="absolute left-5 md:left-8 bottom-[16svh] max-w-[28rem] will-change-[opacity,transform]">
            <p className="text-[11px] font-bold tracking-[0.2em] text-sky-200/70 mb-3">この先は、実物です</p>
            <p className="text-[15px] md:text-[18px] leading-[1.9] font-bold">
              LARU HP で作ったサイトを、
              <br />
              その場で変えられます。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
