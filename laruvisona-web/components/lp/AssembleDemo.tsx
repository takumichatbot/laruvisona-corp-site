'use client';
/**
 * 「部品が分かれている状態 → 1枚のサイトに組み上がる」を見せる仕掛け。
 *
 * 動画ではない。中に出ているのは、公開ページを作るのと同じ関数（exportToHTML）が
 * 作ったページそのもので、写真も見本の作品のものを使っている。
 * 分かれて見えているのは、そのページの「節」そのもの。
 *
 * できること:
 *   ・雰囲気と書体を選ぶと、その場で作り直す
 *   ・組み上がったあとは、中のボタン・リンク・入力欄を実際に触れる
 *     「ご予約フォームへ」を押すと、その場所まで画面が動く
 *     予約の入力もでき、送信は**その場の見本**として受け付ける（どこへも送らない）
 *   ・キーボードだけでも同じことができる
 *
 * 決めごと:
 *   ・使うのはCSSの3D変形だけ。WebGLは使わない
 *   ・端末が「動きを減らす」設定なら、最初から組み上がった状態で出す
 *   ・画面の幅に合わせて作る。パソコンは1440px、スマホは390pxの組み方で見せる
 *   ・中身は別の入れ物（sandbox）に置く。中で何かが動いても、この画面には届かない
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { exportToHTML } from '@/lib/html-export';
import { DESIGN_PRESETS } from '@/lib/site-design';
import type { Block, SEOSettings } from '@/types/laruHP';

const SEO: SEOSettings = {
  title: '結い庵', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '',
};

/** 見せる節。実際の作品から3つ取っている */
const DEMO_BLOCKS: Block[] = [
  {
    id: 'd-hero', type: 'hero',
    data: {
      heading: '朝、鏡の前で\nうまくいく髪を。',
      subheading: '結い庵｜国立・大学通りの予約制ヘアサロン',
      ctaText: 'ご予約フォームへ', ctaLink: '#booking',
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
        { name: 'カット', price: '6,600', period: '円', description: 'カウンセリング20分＋カット＋仕上げ', features: ['骨格と生えぐせを見て設計'], highlighted: false, buttonText: 'このメニューで予約する', buttonLink: '#booking' },
        { name: 'カラー＋カット', price: '13,200', period: '円〜', description: '髪と頭皮の状態に合わせて薬剤を調整', features: ['白髪ぼかしも同料金'], highlighted: true, buttonText: 'このメニューで予約する', buttonLink: '#booking' },
        { name: '髪質改善トリートメント', price: '8,800', period: '円', description: '広がり・うねりが気になる方へ', features: ['4回で扱いやすさが変わります'], highlighted: false, buttonText: 'このメニューで予約する', buttonLink: '#booking' },
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
    大きな面なので、傾けすぎると文字が読めなくなる。控えめにする。 */
const OFFSETS = [
  { dx: -7, dy: -2.5, dz: 110, rx: 2.5, ry: -6 },
  { dx: 8, dy: 0, dz: 0, rx: -2, ry: 5 },
  { dx: -6.5, dy: 2.5, dz: -80, rx: 2.5, ry: -5 },
];

const FONTS = [
  { value: 'mincho', label: '明朝' },
  { value: 'noto', label: 'ゴシック' },
  { value: 'rounded', label: '丸ゴシック' },
];

/* 中の入れ物で動かすもの。
   ・組み上がる／ばらける（親から言われて動く）
   ・高さを親に知らせる（親はその高さで場所を空ける）
   ・ページ内の移動は、親のページを動かして見せる（中は縮めて置いてあるので、
     中だけで動かしても見えない）
   ・送信はどこへも送らない。その場で「受け付けました」を出すだけ */
const DEMO_BRIDGE = `<script data-lhp-demo-bridge="">
(function(){
  try { void window.localStorage.length; } catch (e) {
    var mem = function(){ var m = {}; return {
      getItem: function(k){ return Object.prototype.hasOwnProperty.call(m,k) ? m[k] : null; },
      setItem: function(k,v){ m[k] = String(v); }, removeItem: function(k){ delete m[k]; },
      clear: function(){ m = {}; }, key: function(i){ return Object.keys(m)[i] || null; },
      get length(){ return Object.keys(m).length; } }; };
    try { Object.defineProperty(window,'localStorage',{value:mem(),configurable:true}); } catch (e2) {}
    try { Object.defineProperty(window,'sessionStorage',{value:mem(),configurable:true}); } catch (e2) {}
  }

  /* 見本なので、どこへも送らない。実際の予約は入らない。 */
  window.fetch = function(){
    return Promise.resolve({
      ok: true, status: 200,
      json: function(){ return Promise.resolve({ success: true, demo: true }); },
      text: function(){ return Promise.resolve('{"success":true,"demo":true}'); },
    });
  };

  var send = function(m){ try { parent.postMessage(Object.assign({source:'lhp-demo'}, m), '*'); } catch(e){} };
  var OFFSETS = __OFFSETS__;

  var ready = function(){
    var st = document.createElement('style');
    st.setAttribute('data-explode','');
    st.textContent = [
      'html{--e:1}',
      /* ばらけているあいだは、部品が左右へ出る。少し引いて全部を入れる。
         この縮小は入れ物の中だけで起きるので、外のページは動かない。 */
      'body{perspective:1800px;background:#eceff4;transform:scale(calc(1 - .14 * var(--e)));transform-origin:top center;transition:transform .9s cubic-bezier(.2,.8,.2,1)}',
      '#lhp-cookie-banner{display:none!important}',
      '[data-lhp-block]{transform-style:preserve-3d;',
      /* 公開CSS側に transform:none!important があるので、同じ強さで上書きする */
      ' transform:translate3d(calc(var(--dx,0) * 1% * var(--e)),calc(var(--dy,0) * 1% * var(--e)),calc(var(--dz,0px) * var(--e)))',
      ' rotateX(calc(var(--rx,0deg) * var(--e))) rotateY(calc(var(--ry,0deg) * var(--e))) !important;',
      ' box-shadow:0 calc(28px * var(--e)) calc(56px * var(--e)) rgba(15,23,42,calc(.20 * var(--e)));',
      ' border-radius:calc(16px * var(--e));overflow:hidden;',
      ' transition:transform .9s cubic-bezier(.2,.8,.2,1),box-shadow .9s ease,border-radius .9s ease}',
      /* ばらけているあいだは触らせない（押せる場所が動いていて分かりにくい） */
      'html[data-locked="1"] [data-lhp-block]{pointer-events:none}',
      '#lhp-demo-sent{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99;',
      ' background:#0f172a;color:#fff;padding:14px 22px;border-radius:999px;font-size:15px;font-weight:700;',
      ' box-shadow:0 10px 30px rgba(15,23,42,.35)}',
    ].join('');
    (document.head || document.documentElement).appendChild(st);

    var blocks = document.querySelectorAll('[data-lhp-block]');
    for (var i = 0; i < blocks.length; i++) {
      var o = OFFSETS[i % OFFSETS.length];
      blocks[i].style.setProperty('--dx', o.dx);
      blocks[i].style.setProperty('--dy', o.dy);
      blocks[i].style.setProperty('--dz', o.dz + 'px');
      blocks[i].style.setProperty('--rx', o.rx + 'deg');
      blocks[i].style.setProperty('--ry', o.ry + 'deg');
    }

    /* ページ内の移動。中は縮めて置いてあるので、親のページを動かして見せる */
    document.addEventListener('click', function(e){
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href.charAt(0) === '#' && href.length > 1) {
        e.preventDefault();
        var id = href.slice(1);
        var t = document.getElementById(id);
        if (!t && /^[A-Za-z0-9_-]+$/.test(id)) {
          t = document.querySelector('[data-lhp-block=' + id + ']') || document.querySelector('[name=' + id + ']');
        }
        send({ type: 'goto', y: t ? t.getBoundingClientRect().top + window.scrollY : 0, found: !!t });
        return;
      }
      // 外へ出るリンクは、見本の中では動かさない
      e.preventDefault();
      send({ type: 'blocked-link' });
    }, true);

    document.addEventListener('submit', function(e){
      e.preventDefault();
      var box = document.getElementById('lhp-demo-sent');
      if (!box) {
        box = document.createElement('div');
        box.id = 'lhp-demo-sent';
        box.setAttribute('role', 'status');
        document.body.appendChild(box);
      }
      box.textContent = '見本です。実際の予約は送っていません。';
      send({ type: 'submitted' });
    }, true);

    /* 高さを親に知らせる。分解は transform なので、場所の取り方は変わらない
       （どちらの状態でも同じ高さになる）。 */
    var report = function(){
      send({ type: 'height', h: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) });
    };
    report();
    window.addEventListener('load', report);
    setTimeout(report, 600);
    setTimeout(report, 1600);
    send({ type: 'ready' });
  };

  window.addEventListener('message', function(e){
    if (e.source !== parent) return;
    var d = e.data;
    if (!d || d.source !== 'lhp-demo-host') return;
    if (d.type === 'explode') {
      document.documentElement.setAttribute('data-e', d.e ? '1' : '0');
      document.documentElement.style.setProperty('--e', d.e ? '1' : '0');
      document.documentElement.setAttribute('data-locked', d.e ? '1' : '0');
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
</script>`;

function withDemoBridge(html: string): string {
  const bridge = DEMO_BRIDGE.replace('__OFFSETS__', JSON.stringify(OFFSETS));
  const i = html.indexOf('<head>');
  return i === -1 ? bridge + html : html.slice(0, i + 6) + bridge + html.slice(i + 6);
}

type Device = 'pc' | 'sp';

/* 枠の大きさ。
   高さを実測してから広げると、写真が届くたびに場所がずれる（読んでいる
   途中で文字が動く）。この見本の中身はこちらで決めているので、実測した
   高さを定数にして、最初の描画から正しい場所を取る。
   縦横比はCSSで与える（JavaScript が動く前から高さが決まる）。 */
/* ページ全体の高さ（「予約まで試す」を開いたとき） */
const PC_H = 2400;
const SP_H = 2950;
/* 最初に出す高さ。
   いきなりページ全部を出すと、スマホでは架空サロンの料金と予約フォームが
   延々と続いてから、ようやく操作のボタンが来る。
   最初は「完成した見出し＋料金の頭」までにして、操作をすぐ下に置く。 */
const PC_PEEK = 980;
const SP_PEEK = 1120;
/* スマホの組み方は、最初の画面の上に大きな余白がある。
   そのまま出すと、枠の上半分が空白で埋まってしまう。少し上へずらして、
   見出しがすぐ目に入るようにする（閉じているあいだだけ）。 */
const SP_PEEK_TOP = 150;
const SWITCH_PX = 700;

export default function AssembleDemo({ initialDevice }: { initialDevice?: Device } = {}) {
  const [presetId, setPresetId] = useState('refined');
  const [font, setFont] = useState('mincho');
  const [assembled, setAssembled] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [device, setDevice] = useState<Device>(initialDevice ?? 'pc');
  const [autoDevice, setAutoDevice] = useState(true);
  /* 中身の高さは固定にする。
     測ってから広げると、写真が届くたびに場所がずれる（読んでいる途中で
     文字が動く）。この見本の中身はこちらで決めているので、実測した高さを
     そのまま定数にしてある。少し余らせて、下が切れないようにする。 */
  const [contentTall, setContentTall] = useState(false);
  /** 予約フォームまで開いた状態か。押されたときだけ開く */
  const [full, setFull] = useState(false);
  const [boxW, setBoxW] = useState(0);
  const [near, setNear] = useState(false);
  const [note, setNote] = useState('');

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const outerRef = useRef<HTMLDivElement | null>(null);

  const preset = DESIGN_PRESETS.find(p => p.id === presetId) || DESIGN_PRESETS[2];
  const frameW = device === 'sp' ? 390 : 1440;
  const fullH = (device === 'sp' ? SP_H : PC_H) + (contentTall ? 600 : 0);
  const contentH = full ? fullH : (device === 'sp' ? SP_PEEK : PC_PEEK);
  const peekTop = !full && device === 'sp' ? SP_PEEK_TOP : 0;
  const fit = boxW > 0 ? Math.min(1, boxW / frameW) : 0;
  const scale = fit;

  /* 幅を見る。狭いところではスマホの組み方に切り替える */
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const apply = () => {
      setBoxW(el.clientWidth);
      /* 切り替えの境目は、下の枠の縦横比を決めているCSSと同じ値にする。
         ここがずれると、読み込みの途中で高さが変わって画面がずれる。 */
      if (autoDevice) setDevice(window.matchMedia(`(min-width: ${SWITCH_PX}px)`).matches ? 'pc' : 'sp');
    };
    apply();
    if (typeof ResizeObserver !== 'function') {
      window.addEventListener('resize', apply);
      return () => window.removeEventListener('resize', apply);
    }
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoDevice]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => { setReduced(mq.matches); if (mq.matches) setAssembled(true); };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const html = useMemo(() => withDemoBridge(exportToHTML(
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
  )), [preset, font]);

  const post = useCallback((msg: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage({ source: 'lhp-demo-host', ...msg }, '*');
  }, []);

  /* 中からの知らせ。送り主がこの入れ物であることだけを見る（生成元は無い） */
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      const d = e.data as { source?: string; type?: string; h?: number; y?: number } | null;
      if (!d || d.source !== 'lhp-demo') return;
      if (d.type === 'ready') { post({ type: 'explode', e: assembled || reduced ? 0 : 1 }); return; }
      // 決めてある高さに収まらないときだけ広げる（ふだんは動かさない）
      if (d.type === 'height' && typeof d.h === 'number') { setContentTall(d.h > (device === 'sp' ? SP_H : PC_H)); return; }

      if (d.type === 'goto' && typeof d.y === 'number') {
        const stage = stageRef.current;
        if (!stage) return;
        /* 閉じているあいだは、その場所がまだ見えていない。
           先に開いてから動かす（押したのに何も起きない、をなくす）。 */
        setFull(true);
        const y = d.y;
        const go = () => {
          const top = stage.getBoundingClientRect().top + window.scrollY + y * scale;
          window.scrollTo({ top: Math.max(0, top - window.innerHeight * 0.18), behavior: 'smooth' });
        };
        window.setTimeout(go, 60);
        return;
      }
      if (d.type === 'submitted') { setNote('見本として受け付けました。実際の予約は送っていません。'); return; }
      if (d.type === 'blocked-link') { setNote('見本の中のリンクです。ここでは移動しません。'); return; }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [assembled, reduced, post, scale, device]);

  useEffect(() => { post({ type: 'explode', e: assembled || reduced ? 0 : 1 }); }, [assembled, reduced, html, post]);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(''), 4000); return () => clearTimeout(t); }, [note]);

  /* 近くまで来たら中身を作る（開いた瞬間に写真を取りに行かない） */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver !== 'function') {
      // 監視できない環境では、描画を先に済ませてから作る
      const t = window.setTimeout(() => setNear(true), 200);
      return () => window.clearTimeout(t);
    }
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
    let timer: number | undefined;
    const io = new IntersectionObserver(es => {
      es.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > 0.25 && timer === undefined) {
          timer = window.setTimeout(() => setAssembled(true), 700);
        }
      });
    }, { threshold: [0, 0.25, 0.6] });
    io.observe(el);
    return () => { io.disconnect(); if (timer !== undefined) window.clearTimeout(timer); };
  }, [reduced]);

  const pill = (on: boolean) =>
    `px-3 py-1.5 rounded-full text-[12px] font-bold border transition-colors min-h-[36px] ${on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'}`;

  return (
    /* スマホでは、先に完成した姿を出してから、触るところを下に置く。
       操作の並びを上に積むと、肝心の画面が折り返しより下へ行ってしまう。 */
    <div className="w-full flex flex-col" ref={outerRef}>
      <div className="order-2 sm:order-1 flex flex-wrap items-center gap-2 mt-3 sm:mt-0 mb-3">
        <span className="w-full sm:w-auto sm:mr-2 text-[11px] text-slate-400">見本：架空の美容室「結い庵」のサイト</span>
        <span className="text-[11px] font-bold text-slate-400 mr-1">雰囲気</span>
        {DESIGN_PRESETS.map(p => (
          <button key={p.id} type="button" onClick={() => setPresetId(p.id)} aria-pressed={presetId === p.id} className={pill(presetId === p.id)}>
            {p.name}
          </button>
        ))}
      </div>
      <div className="order-3 sm:order-2 flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[11px] font-bold text-slate-400 mr-1">書体</span>
        {FONTS.map(f => (
          <button key={f.value} type="button" onClick={() => setFont(f.value)} aria-pressed={font === f.value} className={pill(font === f.value)}>
            {f.label}
          </button>
        ))}
        <span className="text-[11px] font-bold text-slate-400 ml-3 mr-1">画面</span>
        {(['pc', 'sp'] as Device[]).map(d => (
          <button key={d} type="button" onClick={() => { setAutoDevice(false); setDevice(d); }} aria-pressed={device === d} className={pill(device === d)}>
            {d === 'pc' ? 'パソコン' : 'スマホ'}
          </button>
        ))}
        {/* 枠の上にも同じボタンがある。こちらは画面が広いときだけ出す */}
        <button type="button" onClick={() => setAssembled(v => !v)}
          className="hidden sm:inline-flex items-center justify-center ml-auto w-[128px] px-2 py-1.5 min-h-[36px] rounded-full text-[12px] font-bold bg-sky-600 text-white hover:bg-sky-700">
          {assembled ? 'もう一度ばらす' : '組み上げる'}
        </button>
      </div>

      <div ref={stageRef}
        /* 最初の高さは縦横比でCSSに決めさせる。JavaScript が動く前から高さが
           決まるので、読み込みの途中で下の内容が動かない。
           数値は PC_PEEK / SP_PEEK と、上下の余白ぶんに合わせてある。
           境目の 700px は SWITCH_PX と同じにすること。
           「予約まで試す」を押して開いたときだけ、実寸で高さを決める
           （押したあとの高さ変更なので、読んでいる途中でずれることはない）。 */
        className={`order-1 sm:order-3 relative rounded-2xl border border-slate-200 bg-[#eceff4] overflow-hidden${full ? '' : ' aspect-[390/1144] min-[700px]:aspect-[1440/1004]'}`}
        style={full ? { height: Math.round(contentH * fit) + 24 } : undefined}>
        {!near && (
          <div className="absolute inset-0 grid place-items-center text-[12px] text-slate-400">読み込んでいます…</div>
        )}
        <iframe
          ref={frameRef}
          title="お店のサイトの見本。組み上がったあとは中を触れます"
          sandbox="allow-scripts allow-forms"
          /* 幅を測る前は置かない。仮の倍率で置くと、測った瞬間にずれる */
          hidden={fit === 0}
          srcDoc={near && fit > 0 ? html : undefined}
          className="border-0"
          style={{
            width: frameW, height: contentH,
            transform: `scale(${scale})`, transformOrigin: 'top left',
            position: 'absolute', top: 12 - peekTop * scale,
            left: '50%', marginLeft: -(frameW * scale) / 2,
          }}
        />
        {!full && (
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#eceff4] to-transparent" />
        )}
        {/* 枠の上に重ねる操作。画面に枠が出ているあいだ、手が届くところにある */}
        {near && (
          <button type="button" onClick={() => setAssembled(v => !v)}
            className="absolute right-3 bottom-3 z-10 min-h-[40px] w-[124px] px-2 rounded-full text-[12px] font-bold bg-slate-900/85 text-white backdrop-blur hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
            {assembled ? 'もう一度ばらす' : '組み上げる'}
          </button>
        )}
      </div>

      {/* 予約まで試す。見本のサロンの予約であって、LARU HP の申し込みではない */}
      <div className="order-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        {!full ? (
          <>
            <button type="button" onClick={() => setFull(true)}
              className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full border border-slate-400 text-[13px] font-bold text-slate-800 hover:border-slate-700">
              このお店の予約フォームまで試す
            </button>
            <span className="text-[12px] text-slate-500">見本のお店の予約です。LARU HP のお申し込みではありません。</span>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setFull(false)}
              className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full border border-slate-300 text-[13px] font-bold text-slate-600 hover:border-slate-500">
              最初の画面だけに戻す
            </button>
            <span className="text-[12px] text-slate-500">入力して送れます。見本なので、どこへも送られません。</span>
          </>
        )}
      </div>

      <div className="order-5 mt-3 flex flex-wrap items-start gap-x-4 gap-y-1">
        <p className="text-[12px] text-slate-600 leading-relaxed flex-1 min-w-[240px]">
          {!assembled
            ? '部品が分かれた状態です。「組み上げる」を押すと1枚のサイトになります。'
            : full
              ? 'このまま触れます。中のボタンや入力欄が、公開したあとと同じように動きます。'
              : 'ここまでが最初の画面です。この下に、料金と予約が続きます。'}
        </p>
        {note && <p className="text-[12px] font-bold text-sky-700" role="status">{note}</p>}
      </div>
      <p className="order-6 text-[11px] text-slate-500 mt-2 leading-relaxed">
        雰囲気や書体を押すと、その場で作り直しています。送信は見本としての受け付けで、どこへも送られません。
        写真は見本用の生成素材で、結い庵は架空のお店です。
      </p>
    </div>
  );
}
