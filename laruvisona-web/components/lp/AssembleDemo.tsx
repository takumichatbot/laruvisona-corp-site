'use client';
/**
 * 「部品が分かれている状態 → 1枚のサイトに組み上がる」を見せる仕掛け。
 *
 * 動画ではなく、実物で見せている。中に出ているのは、公開ページを作るのと
 * 同じ関数（exportToHTML）が作った本物のHTMLで、写真も基準作品のものを使う。
 * 分解して見えているのは、公開ページの「節」そのもの。
 *
 * 使っているのはCSSの3D変形だけ。WebGLは使わない。
 * 端末が「動きを減らす」設定なら、最初から組み上がった状態で出す。
 * ボタン・文字・リンクは本物のHTMLで、指でも押せる。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { exportToHTML } from '@/lib/html-export';
import { DESIGN_PRESETS } from '@/lib/site-design';
import type { Block, SEOSettings } from '@/types/laruHP';

const SEO: SEOSettings = {
  title: '結い庵', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '',
};

/** 見せる節。実際の作品から、画面に収まる4つを取っている */
const DEMO_BLOCKS: Block[] = [
  {
    id: 'd-hero', type: 'hero',
    data: {
      heading: '朝、鏡の前で\nうまくいく髪を。',
      subheading: '結い庵｜国立・大学通りの予約制ヘアサロン',
      ctaText: 'ご予約フォームへ', ctaLink: '#d-booking',
      bgColor: '#faf7f2', textColor: '#3a2e25',
      bgImage: '/salon/hero-1600.jpg', bgImageWidth: 1600, bgImageHeight: 1195,
      bgImageAlt: '自然光の入る店内。左官壁と木の鏡台、革張りの椅子',
      bgImageSizes: '(max-width: 768px) 100vw, 62vw',
      bgImageSources: [
        { type: 'image/avif', srcset: '/salon/hero-800.avif 800w, /salon/hero-1200.avif 1200w, /salon/hero-1600.avif 1600w' },
        { type: 'image/webp', srcset: '/salon/hero-800.webp 800w, /salon/hero-1200.webp 1200w, /salon/hero-1600.webp 1600w' },
        { srcset: '/salon/hero-800.jpg 800w, /salon/hero-1200.jpg 1200w, /salon/hero-1600.jpg 1600w' },
      ],
    },
  },
  {
    id: 'd-price', type: 'price-table',
    data: {
      heading: 'メニューと料金', subtext: 'すべてシャンプー・ブロー込み。表示は税込です。',
      plans: [
        { name: 'カット', price: '6,600', period: '円', description: 'カウンセリング20分＋カット＋仕上げ', features: ['骨格と生えぐせを見て設計'], highlighted: false, buttonText: 'このメニューで予約する', buttonLink: '#d-booking' },
        { name: 'カラー＋カット', price: '13,200', period: '円〜', description: '髪と頭皮の状態に合わせて薬剤を調整', features: ['白髪ぼかしも同料金'], highlighted: true, buttonText: 'このメニューで予約する', buttonLink: '#d-booking' },
        { name: '髪質改善トリートメント', price: '8,800', period: '円', description: '広がり・うねりが気になる方へ', features: ['4回で扱いやすさが変わります'], highlighted: false, buttonText: 'このメニューで予約する', buttonLink: '#d-booking' },
      ],
    },
  },
  {
    id: 'd-booking', type: 'booking',
    data: {
      mode: 'simple', heading: 'ご予約',
      subtext: 'ご希望の日時を選んで送ってください。折り返し、空いているお時間をご連絡します。',
      serviceTypes: ['カット', 'カラー＋カット', '髪質改善トリートメント'],
      timeSlots: ['10:00', '11:00', '13:00', '14:00', '15:00'],
      buttonText: 'この内容で予約を申し込む', buttonColor: '#8a6a43', bgColor: '#f7f4ef',
      stickyCta: false,
    },
  },
];

/** 節ごとの「離れ方」。組み上がると全部 0 になる。
    大きな面なので、傾けすぎると文字が読めなくなる。控えめにして、
    上下に引き離すことで「別々の部品である」ことを見せる。 */
const OFFSETS = [
  { dx: '-120px', dy: '-90px', dz: '120px', rx: '3deg', ry: '-7deg' },
  { dx: '130px', dy: '0px', dz: '0px', rx: '-2deg', ry: '6deg' },
  { dx: '-110px', dy: '95px', dz: '-90px', rx: '3deg', ry: '-6deg' },
];

const FONTS = [
  { value: 'mincho', label: '明朝' },
  { value: 'noto', label: 'ゴシック' },
  { value: 'rounded', label: '丸ゴシック' },
];

export default function AssembleDemo() {
  const [presetId, setPresetId] = useState('refined');
  const [font, setFont] = useState('mincho');
  const [assembled, setAssembled] = useState(false);
  const [reduced, setReduced] = useState(false);
  /* この仕掛けはページのだいぶ下にある。開いた瞬間に中身を作ると、
     中の写真が「最優先」で落ちてきて、最初の画面の表示と取り合いになる。
     近くまで来てから作る。 */
  const [near, setNear] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const preset = DESIGN_PRESETS.find(p => p.id === presetId) || DESIGN_PRESETS[2];

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => { setReduced(mq.matches); if (mq.matches) setAssembled(true); };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const html = useMemo(() => exportToHTML(
    [{ id: 'demo', name: 'デモ', path: '/', blocks: DEMO_BLOCKS, seo: SEO }],
    SEO,
    {
      colorScheme: 'professional-blue', style: 'clean',
      designStyle: preset.designStyle, fontFamily: font,
      accentColor: preset.design.accent,
      heroLayout: 'split', headerStyle: 'solid', animLevel: 'none',
      larubot: false, laruseo: false,
      design: preset.design as unknown as Record<string, unknown>,
    } as never,
    '結い庵',
  ), [preset, font]);

  /** iframe の中へ、分解のためのCSSだけを足す（中身のHTMLは公開用のまま）。
   *
   *  何度呼ばれても1回しか入れない。srcdoc の読み込みは、React が onLoad を
   *  付ける前に終わっていることがあるので、読み込み後にも呼び直している。 */
  const decorate = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc || !doc.body) return;
    if (doc.querySelector('style[data-explode]')) return;
    const style = doc.createElement('style');
    style.setAttribute('data-explode', '');
    style.textContent = `
      html{--e:1}
      body{perspective:1500px;background:#eceff4}
      #lhp-cookie-banner{display:none!important}
      [data-lhp-block]{
        transform-style:preserve-3d;
        /* 動きなしの設定で出しているので、公開CSS側に transform:none!important がある。
           分解はこちらの都合なので、同じ強さで後から上書きする。 */
        transform:translate3d(calc(var(--dx,0px) * var(--e)),calc(var(--dy,0px) * var(--e)),calc(var(--dz,0px) * var(--e)))
                  rotateX(calc(var(--rx,0deg) * var(--e))) rotateY(calc(var(--ry,0deg) * var(--e))) !important;
        box-shadow:0 calc(28px * var(--e)) calc(56px * var(--e)) rgba(15,23,42,calc(.20 * var(--e)));
        border-radius:calc(16px * var(--e));
        overflow:hidden;
        transition:transform .9s cubic-bezier(.2,.8,.2,1),box-shadow .9s ease,border-radius .9s ease;
      }
      a,button,form{pointer-events:none}
    `;
    doc.head.appendChild(style);
    const blocks = doc.querySelectorAll<HTMLElement>('[data-lhp-block]');
    blocks.forEach((el, i) => {
      const o = OFFSETS[i % OFFSETS.length];
      el.style.setProperty('--dx', o.dx);
      el.style.setProperty('--dy', o.dy);
      el.style.setProperty('--dz', o.dz);
      el.style.setProperty('--rx', o.rx);
      el.style.setProperty('--ry', o.ry);
    });
    doc.documentElement.style.setProperty('--e', assembled || reduced ? '0' : '1');
  }, [assembled, reduced]);

  /* srcdoc の読み込みが React より先に終わっていることがある。
     onLoad だけに任せると、分解のCSSが入らないまま組み上がった絵になる。
     しばらく様子を見て、入っていなければ入れる。 */
  useEffect(() => {
    let tries = 0;
    const tick = () => {
      decorate();
      const doc = frameRef.current?.contentDocument;
      if (doc?.documentElement) doc.documentElement.style.setProperty('--e', assembled || reduced ? '0' : '1');
      if (++tries < 20 && !doc?.querySelector('style[data-explode]')) setTimeout(tick, 80);
    };
    tick();
  }, [assembled, reduced, html, decorate]);

  /* 近くまで来たら中身を作る */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver !== 'function') { setNear(true); return; }
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { setNear(true); io.disconnect(); } });
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* 画面に入ったら、ひとりでに組み上がる。押しても組み上がる。 */
  useEffect(() => {
    if (reduced) return;
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver !== 'function') return;
    // すぐ組み上げてしまうと、ばらけた状態を見る間がない。少し待ってから動かす
    let timer: number | undefined;
    const io = new IntersectionObserver(es => {
      es.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > 0.45 && timer === undefined) {
          timer = window.setTimeout(() => setAssembled(true), 700);
        }
      });
    }, { threshold: [0, 0.45, 0.8] });
    io.observe(el);
    return () => { io.disconnect(); if (timer !== undefined) window.clearTimeout(timer); };
  }, [reduced]);

  return (
    <div className="w-full">
      {/* 触れるところ。押すと本当に画面が変わる */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[11px] font-bold text-slate-400 mr-1">雰囲気</span>
        {DESIGN_PRESETS.map(p => (
          <button key={p.id} type="button" onClick={() => setPresetId(p.id)}
            aria-pressed={presetId === p.id}
            className={`px-3 py-1.5 rounded-full text-[12px] font-bold border transition-colors ${presetId === p.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'}`}>
            {p.name}
          </button>
        ))}
        <span className="text-[11px] font-bold text-slate-400 ml-3 mr-1">書体</span>
        {FONTS.map(f => (
          <button key={f.value} type="button" onClick={() => setFont(f.value)}
            aria-pressed={font === f.value}
            className={`px-3 py-1.5 rounded-full text-[12px] font-bold border transition-colors ${font === f.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'}`}>
            {f.label}
          </button>
        ))}
        <button type="button" onClick={() => setAssembled(v => !v)}
          className="ml-auto px-4 py-1.5 rounded-full text-[12px] font-bold bg-sky-600 text-white hover:bg-sky-700">
          {assembled ? 'もう一度ばらす' : '組み上げる'}
        </button>
      </div>

      <div ref={stageRef}
        className="relative rounded-2xl border border-slate-200 bg-[#eceff4] overflow-hidden"
        style={{ height: 'min(78vh, 700px)' }}>
        {!near && (
          <div className="absolute inset-0 grid place-items-center text-[12px] text-slate-400">
            読み込んでいます…
          </div>
        )}
        <iframe
          ref={frameRef}
          title="サイトの部品が組み上がるようす"
          srcDoc={near ? html : undefined}
          onLoad={decorate}
          className="border-0"
          /* 1440px の画面と同じ折り返しで見せたいので、その幅で作って縮める。
             幅を狭めると、見出しの折り返しが実際のパソコン表示と変わってしまう。 */
          style={{
            width: 1440, height: 2000,
            transform: 'scale(0.34)', transformOrigin: 'top left',
            position: 'absolute', top: 12, left: '50%', marginLeft: -245,
          }}
        />
      </div>

      <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
        中に出ているのは、公開ページを作るのと同じ仕組みが出力した本物のHTMLです。
        雰囲気や書体のボタンを押すと、その場で作り直しています。
        写真は見本用の生成素材で、結い庵は架空のお店です。
      </p>
    </div>
  );
}
