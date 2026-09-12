'use client';
/**
 * 会社トップの冒頭。実物へつながるまでの前半。
 *
 * 場面は3つ。**一画面の主役は一つ**にする。
 *
 *   1. ことば     … 主役は見出し。水と光は空気として後ろにいる（粒はまだ出さない）
 *   2. かたち     … 見出しが引き、一滴が主役になる。分かれて正式ロゴの配置へ整う
 *   3. わたし     … ロゴが退き、画面が静かになる。そこへ実物（#live）が上がってくる
 *
 * 場面と場面は必ず「片方が引いてから、もう片方が出る」。重ねて競わせない。
 *
 * 守っていること:
 *  ・ページのスクロールはふつうのまま。横取り・強制移動・待機はしない
 *  ・最初の表示はHTMLと静止画だけで成立する
 *  ・粒の行き先は public/images/laruvisona_mark.svg の座標そのもの（components/company/mark.ts）
 *  ・文字は透明度と少しの移動だけ。ぼかさない、歪めない
 *  ・スマホは縮小版にしない。ことばは上、かたちは下から上がってくる縦の構図
 *  ・止めているときは、完成した姿を出す
 *
 * ここにあるのは水と光の演出で、流体の物理計算ではない。
 * 背景の静止画は生成画像、粒と光はコード、文字はHTML。
 */
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMotion } from './motion';
import { useStageProgress, span, ease, easeOut, mix } from './useStageProgress';
import { MARK, MARK_VIEWBOX, BRAND_GRADIENT } from './mark';

/** 一滴だったときの中心と大きさ（ロゴと同じ座標系） */
const DROP = { x: 468, y: 495, r: 268 };
/**
 * 粒が出ていく順番。0番は「元の一滴」で、最後まで残って最後に落ち着く。
 * 他の粒は、そのときの一滴の位置から生まれて、それぞれの席へ向かう。
 */
const PARENT = 0;
const ORDER = [5, 6, 1, 2, 3, 4, 7, 8, 9, 0];

/* 場面の切れ目。ここだけ見れば流れが分かるようにまとめておく */
const WORD_OUT = [0.10, 0.24] as const;  // 見出しが引く
const FORM_IN = [0.16, 0.30] as const;   // 一滴が出る
const GATHER = [0.24, 0.62] as const;    // 分かれて整う
const SETTLE = [0.58, 0.68] as const;    // 正式ロゴの塗りへ渡す
const AWAY = [0.70, 0.94] as const;      // 退く

export default function OpeningStage() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const svgWrap = useRef<HTMLDivElement>(null);
  const drops = useRef<Array<SVGGElement | null>>([]);
  const flats = useRef<Array<SVGCircleElement | null>>([]);
  const glassLayer = useRef<SVGGElement>(null);
  const markLayer = useRef<SVGGElement>(null);
  const copy1 = useRef<HTMLDivElement>(null);
  const copy3 = useRef<HTMLDivElement>(null);
  const { paused } = useMotion();

  /* スマホとパソコンで構図が違う。縮小版にしないので、退き方も変える */
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  /** 文字の出し入れ。読みにくくしないので、透明度と少しの移動だけ */
  const show = (e: HTMLDivElement | null, o: number, dy: number) => {
    if (!e) return;
    e.style.opacity = String(o);
    e.style.transform = o >= 1 ? 'none' : `translate3d(0,${dy}px,0)`;
    e.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
    e.setAttribute('aria-hidden', o < 0.05 ? 'true' : 'false');
  };

  /** 止めているときの姿。完成した配置と、見出しをそのまま出す */
  const still = useCallback(() => {
    const el = stage.current;
    if (!el) return;
    el.dataset.act = 'still';
    if (art.current) { art.current.style.transform = 'scale(1.06)'; art.current.style.opacity = '0.42'; }
    for (let i = 0; i < MARK.length; i++) {
      const [x, y, r] = MARK[i];
      drops.current[i]?.setAttribute('transform', `translate(${x} ${y}) scale(${r})`);
      const f = flats.current[i];
      if (f) { f.setAttribute('cx', String(x)); f.setAttribute('cy', String(y)); f.setAttribute('r', String(r)); }
    }
    if (glassLayer.current) glassLayer.current.style.opacity = '0';
    if (markLayer.current) markLayer.current.style.opacity = '1';
    if (svgWrap.current) { svgWrap.current.style.transform = 'none'; svgWrap.current.style.opacity = '1'; }
    show(copy1.current, 1, 0);
    show(copy3.current, 0, 0);
  }, []);

  const apply = useCallback((p: number) => {
    const el = stage.current;
    if (!el) return;
    if (paused) { still(); return; }
    el.dataset.act = p < FORM_IN[0] ? '1' : p < AWAY[0] ? '2' : '3';

    /* 背景は空気。手前の主役より先に出ない。ゆっくり寄って、静かに引く */
    if (art.current) {
      const a = easeOut(span(p, 0, 0.8));
      art.current.style.transform = `scale(${mix(1.04, 1.13, a)}) translate3d(0,${mix(0, -2, a)}%,0)`;
      art.current.style.opacity = String(mix(0.95, 0.12, easeOut(span(p, 0.18, 0.76))));
    }

    /* 1 → 2 の受け渡し。見出しが引いてから、一滴が出る */
    const formIn = easeOut(span(p, FORM_IN[0], FORM_IN[1]));

    /* 粒。一滴 → 正式ロゴの配置 */
    const gather = ease(span(p, GATHER[0], GATHER[1]));
    const at = (i: number) => {
      const seat = ORDER.indexOf(i);
      const delay = (seat / MARK.length) * 0.5;
      return ease(Math.min(1, Math.max(0, (gather - delay) / (1 - 0.5))));
    };
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
    const settled = span(p, SETTLE[0], SETTLE[1]);
    if (glassLayer.current) glassLayer.current.style.opacity = String(1 - settled);
    if (markLayer.current) markLayer.current.style.opacity = String(settled);

    /* 2 → 3 の受け渡し。ロゴが退いて、画面を実物へ明け渡す。
       退く向きは構図に合わせる（パソコンは奥へ、スマホは下へ戻す） */
    if (svgWrap.current) {
      const away = easeOut(span(p, AWAY[0], AWAY[1]));
      // スマホは下から上がってきて、画面の真ん中に落ち着く（縦の構図）
      const rise = narrow ? mix(20, 0, formIn) : 0;
      const scale = mix(0.9, 1, formIn) * mix(1, narrow ? 0.5 : 0.42, away);
      const dx = narrow ? 0 : away * -10;
      const dy = rise + (narrow ? away * 16 : away * -20);
      svgWrap.current.style.transform = `translate3d(${dx}%, ${dy}%, 0) scale(${scale})`;
      svgWrap.current.style.opacity = String(formIn * (1 - span(p, 0.82, 0.97)));
    }

    /* 文字。いちどに1つだけ出す。
       場面2（かたち）には文字を置かない。主役は粒ひとつにする
       （しるしの由来は /brand に分けた） */
    const o1 = 1 - span(p, WORD_OUT[0], WORD_OUT[1]);
    const o3 = Math.min(span(p, 0.74, 0.84), 1);
    show(copy1.current, o1, (1 - o1) * -22);
    show(copy3.current, o3, (1 - o3) * 16);
  }, [narrow, paused, still]);

  useStageProgress(section, apply, { paused, pausedProgress: 1 });
  useEffect(() => { if (paused) still(); }, [paused, still]);

  return (
    <section
      ref={section}
      id="opening"
      aria-label="株式会社LaruVisona"
      className="relative z-0 h-[320svh] data-[still=yes]:h-[100svh]"
      data-still={paused ? 'yes' : 'no'}
    >
      <div ref={stage} data-act="1" className="sticky top-0 h-[100svh] overflow-hidden bg-[#04080f]">
        {/* 背景の生成画像。ブランドの空気であって、説明を覆うものではない */}
        <div ref={art} className="absolute inset-0 will-change-transform" aria-hidden="true">
          <Image
            src="/brand/water/water-1.webp" alt="" fill priority
            sizes="100vw" className="object-cover object-[72%_46%] lg:object-[68%_50%]"
          />
        </div>
        <div aria-hidden="true" className="absolute inset-0
          bg-[radial-gradient(120%_86%_at_78%_40%,rgba(10,44,80,.3),transparent_62%)]" />
        {/* 文字を読ませるための覆い。スマホは上、パソコンは左を落とす */}
        <div aria-hidden="true" className="absolute inset-0
          bg-[linear-gradient(180deg,rgba(4,8,15,.92)_0%,rgba(4,8,15,.72)_34%,rgba(4,8,15,.2)_62%,rgba(4,8,15,.7)_100%)]
          lg:bg-[linear-gradient(96deg,rgba(4,8,15,.94)_0%,rgba(4,8,15,.76)_36%,rgba(4,8,15,.12)_64%,rgba(4,8,15,.5)_100%)]" />

        {/* かたち。スマホは下から、パソコンは右から */}
        <div
          ref={svgWrap}
          aria-hidden="true"
          style={{ opacity: 0 }}
          className="absolute inset-0 flex items-center justify-center
            lg:justify-end lg:pr-[7%] will-change-transform"
        >
          <svg viewBox={MARK_VIEWBOX}
            className="h-[46svh] max-h-[390px] w-auto lg:h-[74svh] lg:max-h-[720px] overflow-visible">
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

        {/* ことば。ここが読むところ */}
        <div className="relative h-full max-w-6xl mx-auto px-5 md:px-8
          flex flex-col justify-start pt-[19svh] lg:justify-center lg:pt-0">
          <div ref={copy1} className="max-w-[22rem] sm:max-w-[30rem] lg:max-w-[36rem] will-change-[opacity,transform]">
            <p className="flex items-center gap-2.5 text-[10px] md:text-[11px] font-bold tracking-[0.22em] text-sky-100/80 mb-5 md:mb-6
              [text-shadow:0_1px_14px_rgba(4,8,15,.95)]">
              <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400" />
              発想と技術で、事業の可能性を広げる
            </p>
            <h1 className="text-[clamp(30px,8.6vw,40px)] leading-[1.36] lg:text-[clamp(46px,4.4vw,64px)] lg:leading-[1.3]
              font-bold tracking-[-0.02em] [text-shadow:0_2px_30px_rgba(4,8,15,.95)]">
              <span className="block whitespace-nowrap">まだないものを、</span>
              <span className="block whitespace-nowrap">使えるものへ。</span>
            </h1>
            <p className="mt-5 md:mt-6 max-w-[22em] text-[14px] md:text-[16px] leading-[1.95] text-slate-200/90 [word-break:auto-phrase]
              [text-shadow:0_1px_20px_rgba(4,8,15,.95)]">
              AI・ウェブ・システムを、構想から実装まで。
            </p>
            <div className="mt-7 md:mt-9 flex flex-wrap gap-3">
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

          {/* 場面3の一行。スマホは上（かたちは下にいる）、パソコンは左下 */}
          <div ref={copy3} style={{ opacity: 0 }}
            className="absolute left-5 md:left-8 top-[19svh] max-w-[19em]
              lg:top-auto lg:bottom-[15svh] lg:max-w-[24em] will-change-[opacity,transform]">
            <p className="text-[10px] md:text-[11px] font-bold tracking-[0.22em] text-sky-200/70 mb-3">この先は、実物です</p>
            <p className="text-[17px] md:text-[20px] leading-[1.8] font-bold [word-break:auto-phrase]
              [text-shadow:0_1px_20px_rgba(4,8,15,.95)]">
              LARU HP で作ったサイトを、その場で変えられます。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
