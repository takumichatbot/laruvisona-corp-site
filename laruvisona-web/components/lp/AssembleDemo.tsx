'use client';
/**
 * 「完成例を見る → 見せ方を一つ選ぶ → その選択のまま組み上がる → 予約まで試す」
 * を、一続きで体験してもらうための仕掛け。
 *
 * 動画ではない。中に出ているのは、公開ページを作るのと同じ関数（exportToHTML）が
 * 作ったページそのもの。見せ方の3択も、制作画面の「雰囲気を選び直す」と同じ
 * DESIGN_PRESETS をそのまま使っている（デモ専用の設定体系は作らない）。
 *
 * 流れ:
 *   1. 最初から**組み上がった完成例**が出ている（到達できる品質が先に分かる）
 *   2. 見せ方を1つ選ぶ。操作はこの3択だけ
 *   3. 写真・文章・料金はそのまま、見た目だけが入れ替わり、その場で組み上がる
 *   4. 「予約フォームまで試す」を開くと、選んだ見せ方のままフォームを操作できる
 *
 * 決めごと:
 *   ・選び直しのあいだも、前の画面を消さない。新しい方を裏で作り、
 *     描き終わってから入れ替える（白い画面を挟まない）
 *   ・連続で選び直しても、**古い方の描き終わりが最後の選択を上書きしない**。
 *     作るたびに世代番号を振り、いま最後に押されたものだけを採用する
 *   ・選択はこの画面の中だけの状態。顧客データの保存APIは呼ばない
 *   ・使うのはCSSの3D変形だけ。WebGLは使わない
 *   ・端末が「動きを減らす」設定なら、演出を省いて完成状態を直接出す
 *   ・中身は別の入れ物（sandbox）に置く。中で何かが動いても、この画面には届かない
 */
import { useHydrated } from '@/lib/use-hydrated';
import { useCallback, useEffect, useRef, useState } from 'react';
import { exportToHTML } from '@/lib/html-export';
import Link from 'next/link';
import { saveDesignChoice } from '@/lib/design-handoff';
import { DESIGN_PRESETS } from '@/lib/site-design';
import type { Block, SEOSettings } from '@/types/laruHP';

const SEO: SEOSettings = {
  title: '結い庵', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '',
};

/* 見せ方の3択。
   5つ全部を並べると、どれを押せばよいのか分からなくなる。ここは
   「選ぶと何が起きるか」を伝える場所なので、同じ写真・同じ文章でも
   はっきり違って見える3つに絞る。最初に出すのは、見本の作品で採用した
   「上質」（明朝・広い余白・角のない形）。 */
const CHOICE_IDS = ['refined', 'calm', 'warm'] as const;

const FONT_LABEL: Record<string, string> = {
  mincho: '明朝', noto: 'ゴシック', rounded: '丸ゴシック',
  zen: '太めのゴシック', biz: '読みやすいゴシック', kaisei: '明朝',
};
const SPACE_LABEL: Record<string, string> = {
  tight: '余白しまり', normal: '余白ふつう', roomy: '余白ひろめ', airy: '余白たっぷり',
};
const SHAPE_LABEL: Record<string, string> = {
  square: 'ボタンは角のまま', soft: 'ボタンはすこし丸い', pill: 'ボタンはまるい',
};

const CHOICES = CHOICE_IDS.map(id => {
  const p = DESIGN_PRESETS.find(x => x.id === id) || DESIGN_PRESETS[0];
  return {
    id: p.id,
    name: p.name,
    note: p.note,
    preset: p,
    /** 何が変わるのかを、設定そのものから書き出す（言葉を別に持たない） */
    detail: `${FONT_LABEL[p.fontFamily] ?? 'ゴシック'}／${SPACE_LABEL[p.design.space]}／${SHAPE_LABEL[p.design.buttonShape]}`,
  };
});
const DEFAULT_CHOICE = CHOICES[0].id;

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

/* 中の入れ物で動かすもの。
   ・組み上がる／ばらける（親から言われて動く）
   ・高さを親に知らせる（親はその高さで場所を空ける）
   ・「描き終わった」を親に知らせる（親はそれを見てから表に出す）
   ・ページ内の移動は、親のページを動かして見せる（中は縮めて置いてあるので、
     中だけで動かしても見えない）
   ・送信はどこへも送らない。その場で「受け付けました」を出すだけ

   知らせには必ず世代番号（GEN）を入れる。親は、いま最後に押された世代の
   知らせだけを採る。これが無いと、続けて押したときに古い方の描き終わりが
   あとから届いて、最後の選択を上書きしてしまう。 */
const DEMO_BRIDGE = `<script data-lhp-demo-bridge="">
(function(){
  var GEN = __GEN__;
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

  var send = function(m){ try { parent.postMessage(Object.assign({source:'lhp-demo', gen:GEN}, m), '*'); } catch(e){} };
  var OFFSETS = __OFFSETS__;

  /* 文字と写真がそろってから「描き終わった」と言う。
     ここで待たずに入れ替えると、書体の入れ替わりが見えてしまう。
     ただし待ちきりにはしない（外部の書体が届かない環境がある）。 */
  var settled = false;
  var settle = function(){
    if (settled) return; settled = true;
    send({ type: 'painted' });
  };
  var waitPaint = function(){
    var waits = [];
    try { if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready); } catch (e) {}
    var imgs = [].slice.call(document.images).slice(0, 3);
    for (var i = 0; i < imgs.length; i++) {
      (function(im){
        if (im.complete) return;
        waits.push(new Promise(function(r){
          im.addEventListener('load', r); im.addEventListener('error', r);
        }));
      })(imgs[i]);
    }
    setTimeout(settle, 1100);
    if (waits.length) {
      Promise.all(waits).then(function(){
        requestAnimationFrame(function(){ requestAnimationFrame(settle); });
      });
    } else {
      requestAnimationFrame(function(){ requestAnimationFrame(settle); });
    }
  };

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
      /* 外のページが動きを止めているあいだは、この中の動きも全部止める。
         止めた瞬間に走っている途中のものは、下の処理でその場で終わらせる。 */
      'html[data-motion="off"] *{transition:none!important;animation:none!important;scroll-behavior:auto!important}',
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
      /* 見出しが枠のどこから始まるかも知らせる。
         見せ方によって最初の画面の余白が変わるので（「上質」は広い）、
         固定の値で上へずらすと、別の見せ方では見出しが枠の外へ出る。 */
      var h1 = document.querySelector('.lhp-hero h1');
      send({
        type: 'height',
        h: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        heroTop: h1 ? Math.round(h1.getBoundingClientRect().top + window.scrollY) : null,
      });
    };
    report();
    window.addEventListener('load', report);
    setTimeout(report, 600);
    setTimeout(report, 1600);
    send({ type: 'ready' });
    waitPaint();
  };

  window.addEventListener('message', function(e){
    if (e.source !== parent) return;
    var d = e.data;
    if (!d || d.source !== 'lhp-demo-host') return;
    if (d.type === 'explode') {
      var de = document.documentElement;
      /* 先に「止める」を反映してから形を変える。
         順番が逆だと、止める前に始まった動きが残ってしまう。 */
      if (d.motion) de.setAttribute('data-motion', d.motion);
      de.setAttribute('data-e', d.e ? '1' : '0');
      de.style.setProperty('--e', d.e ? '1' : '0');
      de.setAttribute('data-locked', d.e ? '1' : '0');
      if (d.motion === 'off') {
        /* すでに走っているものを、その場で終わらせる。
           入れ物は作り直さないので、入力した内容は消えない。 */
        try {
          var running = document.getAnimations ? document.getAnimations() : [];
          for (var i = 0; i < running.length; i++) {
            try { running[i].finish(); } catch (e1) { try { running[i].cancel(); } catch (e2) {} }
          }
        } catch (e0) {}
      }
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
</script>`;

function withDemoBridge(html: string, gen: number): string {
  const bridge = DEMO_BRIDGE
    .replace('__OFFSETS__', JSON.stringify(OFFSETS))
    .replace('__GEN__', String(gen));
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
/* スマホの組み方は、最初の画面の上に余白がある。そのまま出すと枠の上が
   空白で埋まるので、上へずらして見出しからを見せる（閉じているあいだだけ）。
   ずらす量は固定にしない。見せ方によって余白の広さが違い（「上質」は広い）、
   固定にすると別の見せ方では見出しが枠の外へ出てしまう。
   見出しの手前にこれだけ残す。 */
const SP_PEEK_GAP = 24;
const SWITCH_PX = 700;
/* 最初に出す見せ方（上質）で、見出しが始まる位置。知らせが来るまでの見当。
   ここがずれていると、最初の一瞬だけ枠の中身が上下する。 */
const DEFAULT_HERO_TOP = 148;
/* 描き終わりの知らせが来ないときでも、ここまで待ったら表に出す。
   （中で例外が起きても、選べないままにしない） */
const SWAP_TIMEOUT = 2600;

type Slot = { gen: number; choiceId: string; html: string } | null;

export default function AssembleDemo(
  { initialDevice, startCta = false, motionPaused = false }:
  { initialDevice?: Device; startCta?: boolean;
    /** 置いているページ全体が動きを止めているか。止めているあいだは
     *  分解・組立をせず、選んだ見せ方へそのまま切り替える。
     *  渡さなければ今までどおり、端末の設定だけを見る（他ページの既定）。 */
    motionPaused?: boolean } = {},
) {
  const hydrated = useHydrated();
  /** いま画面に出ている見せ方 */
  const [shown, setShown] = useState<string>(DEFAULT_CHOICE);
  /** 最後に押された見せ方。押した瞬間にこちらが変わる */
  const [picked, setPicked] = useState<string>(DEFAULT_CHOICE);
  const [assembled, setAssembled] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [device, setDevice] = useState<Device>(initialDevice ?? 'pc');
  const [contentTall, setContentTall] = useState(false);
  /** 入れ物ごとの「見出しが始まる位置」。見せ方で変わる */
  const [heroTops, setHeroTops] = useState<[number, number]>([DEFAULT_HERO_TOP, DEFAULT_HERO_TOP]);
  /** 予約フォームまで開いた状態か。押されたときだけ開く */
  const [full, setFull] = useState(false);
  const [boxW, setBoxW] = useState(0);
  const [near, setNear] = useState(false);
  const [note, setNote] = useState('');
  const [announce, setAnnounce] = useState('');

  /* 入れ物は2つ。片方を見せているあいだに、もう片方で次の見せ方を作る。
     作り終わってから入れ替えるので、白い画面を挟まない。 */
  const [slots, setSlots] = useState<[Slot, Slot]>([null, null]);
  const [active, setActive] = useState<0 | 1>(0);
  /** 入れ替えを待っているあいだ true。押した手応えとして出す */
  const [busy, setBusy] = useState(false);

  /* いまどちらを見せているか／中身は何か。
     押した直後の判断は、描き直しを待たずに正しくないといけないので、
     状態と同じ値を ref にも持つ（古い値のまま入れ替えると、見せている方を
     消してしまう）。 */
  const activeRef = useRef<0 | 1>(0);
  const assembledRef = useRef(true);
  const slotsRef = useRef<[Slot, Slot]>([null, null]);
  const frames = useRef<Array<HTMLIFrameElement | null>>([null, null]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const outerRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);
  /** 世代番号。押すたびに増える。いちばん新しいものだけを採る */
  const genRef = useRef(0);
  /** いまの「動かさない」状態。押した直後の判断に使うので ref でも持つ */
  const motionOffRef = useRef(false);
  const swapTimer = useRef<number | undefined>(undefined);
  const assembleTimer = useRef<number | undefined>(undefined);
  /** exportToHTML は安くない。見せ方ごとに1回だけ作って使い回す */
  const htmlCache = useRef(new Map<string, string>());

  const frameW = device === 'sp' ? 390 : 1440;
  const fullH = (device === 'sp' ? SP_H : PC_H) + (contentTall ? 600 : 0);
  const contentH = full ? fullH : (device === 'sp' ? SP_PEEK : PC_PEEK);
  /* スマホは、最初の画面の上の余白を詰めて見出しから見せる。
     詰める量は、いま出ている見せ方が知らせてきた位置から決める。 */
  const peekTop = !full && device === 'sp' ? Math.max(0, (heroTops[active] || DEFAULT_HERO_TOP) - SP_PEEK_GAP) : 0;
  const fit = boxW > 0 ? Math.min(1, boxW / frameW) : 0;
  const scale = fit;

  const shownChoice = CHOICES.find(c => c.id === shown) || CHOICES[0];
  const pickedChoice = CHOICES.find(c => c.id === picked) || CHOICES[0];

  /** 見せ方から、公開ページと同じ作り方でHTMLを作る */
  const buildHtml = useCallback((choiceId: string, gen: number) => {
    let base = htmlCache.current.get(choiceId);
    if (!base) {
      const c = CHOICES.find(x => x.id === choiceId) || CHOICES[0];
      base = exportToHTML(
        [{ id: 'demo', name: 'デモ', path: '/', blocks: DEMO_BLOCKS, seo: SEO }],
        SEO,
        {
          colorScheme: 'professional-blue', style: 'clean',
          designStyle: c.preset.designStyle, fontFamily: c.preset.fontFamily,
          accentColor: c.preset.design.accent,
          heroLayout: 'split', headerStyle: 'solid', animLevel: 'none',
          larubot: false, laruseo: false,
          design: c.preset.design as unknown as Record<string, unknown>,
        } as never,
        '結い庵',
      );
      htmlCache.current.set(choiceId, base);
    }
    return withDemoBridge(base, gen);
  }, []);

  /** 端末の設定か、置いているページの停止。どちらかが立っていれば動かさない */
  const motionOff = reduced || motionPaused;
  /* 動かさないときは、途中でばらけた状態を見せない（組み上がったものとして扱う） */
  const shownAssembled = assembled || motionOff;

  /* 止めた瞬間に、中の状態も組み上がりへそろえる。
     そろえておかないと、止めているあいだの見た目は完成でも中身はばらけたままで、
     再開したときに、触っていないのに分解が始まってしまう。
     （描き直しの途中で直す書き方。効果の中で状態を変えると余分な描き直しを呼ぶ） */
  const [wasMotionOff, setWasMotionOff] = useState(false);
  if (motionOff !== wasMotionOff) {
    setWasMotionOff(motionOff);
    if (motionOff && !assembled) setAssembled(true);
  }

  const post = useCallback((idx: 0 | 1, msg: Record<string, unknown>) => {
    frames.current[idx]?.contentWindow?.postMessage({ source: 'lhp-demo-host', ...msg }, '*');
  }, []);

  /* 描き直しが終わるたび、ref を今の値にそろえる。
     押したときの判断（どちらの入れ物を使うか・どちらを外すか）は、
     次の描き直しを待てないので ref を見る。 */
  useEffect(() => {
    activeRef.current = active;
    slotsRef.current = slots;
    assembledRef.current = assembled;
    motionOffRef.current = motionOff;
  }, [active, slots, assembled, motionOff]);

  /* 幅を見る。狭いところではスマホの組み方に切り替える */
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const apply = () => {
      setBoxW(el.clientWidth);
      /* 切り替えの境目は、下の枠の縦横比を決めているCSSと同じ値にする。
         ここがずれると、読み込みの途中で高さが変わって画面がずれる。 */
      setDevice(window.matchMedia(`(min-width: ${SWITCH_PX}px)`).matches ? 'pc' : 'sp');
    };
    apply();
    if (typeof ResizeObserver !== 'function') {
      window.addEventListener('resize', apply);
      return () => window.removeEventListener('resize', apply);
    }
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => { setReduced(mq.matches); if (mq.matches) setAssembled(true); };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  /* 近くまで来たら最初の1枚を作る（開いた瞬間に写真を取りに行かない）。
     最初は**組み上がった完成例**。まず到達できる品質を見てもらう。 */
  useEffect(() => {
    const el = stageRef.current;
    const start = () => setNear(true);
    if (!el || typeof IntersectionObserver !== 'function') {
      const t = window.setTimeout(start, 200);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { start(); io.disconnect(); } });
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near || fit === 0) return;
    /* 描画の途中で作らない。1回描き終えてから最初の1枚を用意する
       （作る処理は軽くないので、最初の表示を遅らせないようにする） */
    const t = window.setTimeout(() => {
      setSlots(prev => (prev[0] || prev[1] ? prev : [{ gen: 0, choiceId: DEFAULT_CHOICE, html: buildHtml(DEFAULT_CHOICE, 0) }, null]));
    }, 0);
    return () => window.clearTimeout(t);
  }, [near, fit, buildHtml]);

  /** 裏で作った方を表に出す。いちばん新しい世代のときだけ */
  const promote = useCallback((idx: 0 | 1, gen: number, choiceId: string) => {
    if (genRef.current !== gen) return;      // もっと新しい選択がある。古い方は捨てる
    if (activeRef.current === idx) return;   // すでに表に出ている
    if (swapTimer.current !== undefined) { window.clearTimeout(swapTimer.current); swapTimer.current = undefined; }
    activeRef.current = idx;
    setActive(idx);
    setShown(choiceId);
    setBusy(false);
    const name = (CHOICES.find(c => c.id === choiceId) || CHOICES[0]).name;
    setAnnounce(`${name}に切り替えました。写真と文章と料金はそのままです。`);
    /* 裏で作った方は、ばらけた状態で用意してある。表に出してから組み上げる。
       「動きを減らす」設定では、そのまま組み上がった状態で出す。 */
    if (assembleTimer.current !== undefined) window.clearTimeout(assembleTimer.current);
    if (!motionOffRef.current) {
      setAssembled(false);
      assembleTimer.current = window.setTimeout(() => setAssembled(true), 160);
    } else {
      setAssembled(true);
    }
    /* 使い終わった方は外す。中のボタンや入力欄が残っていると、
       見えていないのにキーボードで入り込めてしまう。
       ただし、外すまでのあいだに次の選択がその場所を使っていたら外さない
       （見せている方や、用意し終えた方を消してしまう）。 */
    const old: 0 | 1 = idx === 0 ? 1 : 0;
    const oldGen = slotsRef.current[old]?.gen;
    window.setTimeout(() => {
      if (activeRef.current === old) return;
      if (slotsRef.current[old]?.gen !== oldGen) return;
      setSlots(prev => { const n: [Slot, Slot] = [prev[0], prev[1]]; n[old] = null; return n; });
    }, motionOffRef.current ? 0 : 320);
  }, []);

  /** 見せ方を選ぶ。ここではページの中の状態だけを変える（保存APIは呼ばない） */
  const choose = useCallback((id: string) => {
    if (id === picked && !busy) return;
    const gen = ++genRef.current;
    const target: 0 | 1 = activeRef.current === 0 ? 1 : 0;
    setPicked(id);
    setBusy(true);
    setAnnounce('');
    setSlots(prev => {
      const next: [Slot, Slot] = [prev[0], prev[1]];
      next[target] = { gen, choiceId: id, html: buildHtml(id, gen) };
      return next;
    });
    if (swapTimer.current !== undefined) window.clearTimeout(swapTimer.current);
    /* 知らせが来ないときの保険。押したのに何も起きない、を作らない */
    swapTimer.current = window.setTimeout(() => {
      if (genRef.current !== gen) return;
      promote(target, gen, id);
    }, SWAP_TIMEOUT);
  }, [picked, busy, buildHtml, promote]);

  /* 中からの知らせ。送り主がこの入れ物であることだけを見る（生成元は無い） */
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const idx = frames.current.findIndex(f => f && e.source === f.contentWindow);
      if (idx < 0) return;
      const d = e.data as { source?: string; type?: string; h?: number; y?: number; gen?: number; heroTop?: number | null } | null;
      if (!d || d.source !== 'lhp-demo') return;
      const slot = slotsRef.current[idx as 0 | 1];
      if (!slot || d.gen !== slot.gen) return;          // 古い入れ物からの知らせは捨てる
      const isActive = idx === activeRef.current;

      if (d.type === 'ready') {
        /* 表に出ている方は、いまの状態のまま。裏で用意している方は、
           ばらけた状態で待たせておく（出したあとに組み上げて見せる）。 */
        const e0 = isActive ? (assembledRef.current || motionOff ? 0 : 1) : (motionOff ? 0 : 1);
        post(idx as 0 | 1, { type: 'explode', e: e0, motion: motionOff ? 'off' : 'on' });
        return;
      }
      if (d.type === 'painted') {
        if (!isActive) promote(idx as 0 | 1, slot.gen, slot.choiceId);
        return;
      }
      // 決めてある高さに収まらないときだけ広げる（ふだんは動かさない）
      if (d.type === 'height' && typeof d.h === 'number') {
        setContentTall(d.h > (device === 'sp' ? SP_H : PC_H));
        if (typeof d.heroTop === 'number') {
          setHeroTops(prev => {
            if (prev[idx as 0 | 1] === d.heroTop) return prev;
            const n: [number, number] = [prev[0], prev[1]];
            n[idx as 0 | 1] = d.heroTop as number;
            return n;
          });
        }
        return;
      }
      if (!isActive) return;

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
  }, [motionOff, post, promote, scale, device]);

  /* 表に出ている方へ、組み上がり／ばらけを伝える */
  useEffect(() => {
    post(active, { type: 'explode', e: assembled || motionOff ? 0 : 1, motion: motionOff ? 'off' : 'on' });
  }, [assembled, motionOff, active, slots, post]);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(''), 4000); return () => clearTimeout(t); }, [note]);
  useEffect(() => () => {
    if (swapTimer.current !== undefined) window.clearTimeout(swapTimer.current);
    if (assembleTimer.current !== undefined) window.clearTimeout(assembleTimer.current);
  }, []);

  /* キーボードだけで選べるようにする。ラジオボタンと同じ動き方にそろえる */
  const onGroupKey = (e: React.KeyboardEvent) => {
    const i = CHOICES.findIndex(c => c.id === picked);
    let n = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % CHOICES.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + CHOICES.length) % CHOICES.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = CHOICES.length - 1;
    if (n < 0) return;
    e.preventDefault();
    choose(CHOICES[n].id);
    const el = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[n];
    el?.focus();
  };

  return (
    /* スマホでは、先に完成した姿を出してから、選ぶところを下に置く。
       操作の並びを上に積むと、肝心の画面が折り返しより下へ行ってしまう。 */
    <div className="w-full flex flex-col" ref={outerRef}
      data-lhp-demo="" data-lhp-demo-picked={picked} data-lhp-demo-shown={shown} data-lhp-demo-busy={busy ? '1' : '0'}
      data-lhp-demo-motion={motionOff ? 'off' : 'on'}>

      {/* ── 見せ方を選ぶ。操作はこれだけ ─────────────────────────
          置き場所は**見本のすぐ上**。スマホで見本の後ろに大きな札を縦に
          積んでいたときは、押した瞬間に見本の見出しと写真が画面の外へ出て、
          料金欄の下だけが残っていた。値は正しく変わっていても、
          「選ぶとその場で変わる」ところが見えない。
          スマホは短い3択にして高さを詰め、説明は選んでいる1案だけを1行で出す。
          画面を自動で動かして帳尻を合わせることはしない。 */}
      <div className="order-1 mb-2 sm:mb-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1.5 sm:mb-2">
          <span className="text-[12px] font-bold text-slate-700">このお店の見せ方を選ぶ</span>
          <span className="text-[11px] text-slate-500">
            <span className="sm:hidden">写真も文章もそのまま</span>
            <span className="hidden sm:inline">写真も文章も料金もそのまま。見た目だけが変わります</span>
          </span>
        </div>
        <div ref={groupRef} role="radiogroup" aria-label="このお店の見せ方" aria-busy={busy}
          onKeyDown={onGroupKey} className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
          {CHOICES.map(c => {
            const on = c.id === picked;
            const waiting = busy && on;
            return (
              <button key={c.id} disabled={!hydrated} type="button" role="radio" aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => choose(c.id)}
                className={`rounded-xl border px-1.5 py-2 min-h-[48px] transition-colors
                  sm:text-left sm:px-3.5 sm:py-2.5 sm:min-h-[56px]
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500
                  ${on ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500'}`}>
                <span className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-2">
                  {/* 押す前に、色の見当がつくようにする */}
                  <span aria-hidden="true" className="inline-flex rounded-full overflow-hidden border border-black/10 shrink-0">
                    {[c.preset.design.bg, c.preset.design.surface, c.preset.design.accent].map((col, k) => (
                      <span key={k} style={{ background: col }} className="block w-2 h-3 sm:w-2.5 sm:h-5" />
                    ))}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-[12px] sm:text-[13px] font-bold leading-none">{c.name}</span>
                    {on && !waiting && <span aria-hidden="true" className="text-[11px] sm:text-[12px] leading-none">✓</span>}
                    {waiting && <span aria-hidden="true" className="hidden sm:inline text-[11px] font-normal opacity-80">作り直しています…</span>}
                  </span>
                </span>
                {/* 札ごとの説明はパソコンだけ。スマホは下に1行だけ出す */}
                <span className={`hidden sm:block text-[11px] mt-0.5 ${on ? 'text-white/70' : 'text-slate-500'}`}>{c.detail}</span>
              </button>
            );
          })}
        </div>
        <p className="sm:hidden mt-1.5 text-[11px] leading-snug text-slate-500" aria-hidden="true">
          {busy ? `${pickedChoice.name}に切り替えています…` : `${pickedChoice.name}：${pickedChoice.detail}`}
        </p>
        <p className="sr-only" role="status">{busy ? `${pickedChoice.name}に切り替えています` : announce}</p>
      </div>

      <div ref={stageRef}
        /* 最初の高さは縦横比でCSSに決めさせる。JavaScript が動く前から高さが
           決まるので、読み込みの途中で下の内容が動かない。
           数値は PC_PEEK / SP_PEEK と、上下の余白ぶんに合わせてある。
           スマホは見出しの手前まで上へずらすので、その分だけ枠も低くする
           （そろえないと、枠の下に灰色の空きが残る）。
           境目の 700px は SWITCH_PX と同じにすること。
           「予約まで試す」を押して開いたときだけ、実寸で高さを決める
           （押したあとの高さ変更なので、読んでいる途中でずれることはない）。 */
        className={`order-2 relative rounded-2xl border border-slate-200 bg-[#eceff4] overflow-hidden${full ? '' : ' aspect-[390/994] min-[700px]:aspect-[1440/1004]'}`}
        style={full ? { height: Math.round(contentH * fit) + 24 } : undefined}>
        {!near && (
          <div className="absolute inset-0 grid place-items-center text-[12px] text-slate-400">読み込んでいます…</div>
        )}
        {/* 枠の中に出ているのが誰のサイトなのかを、枠から離さない。
            LARU HP の申し込みと、見本のお店の予約が混ざらないようにする。 */}
        {/* スマホでは枠を上へずらして見出しを見せているので、上に置くと
            見出しに重なる。下の隅なら、どちらの画面でも文字を隠さない。 */}
        <p className="pointer-events-none absolute left-2 bottom-3 z-20 rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-600 backdrop-blur">
          見本：架空の美容室のサイト
        </p>
        {([0, 1] as const).map(i => {
          const s = slots[i];
          const on = i === active;
          return (
            <iframe key={i}
              ref={el => { frames.current[i] = el; }}
              title={on ? 'お店のサイトの見本。組み上がったあとは中を触れます' : '次の見せ方を用意しています'}
              aria-hidden={on ? undefined : true}
              tabIndex={on ? undefined : -1}
              sandbox="allow-scripts allow-forms"
              /* 幅を測る前は置かない。仮の倍率で置くと、測った瞬間にずれる */
              srcDoc={s && fit > 0 ? s.html : undefined}
              className="border-0"
              style={{
                width: frameW, height: contentH,
                transform: `scale(${scale})`, transformOrigin: 'top left',
                position: 'absolute', top: 12 - peekTop * scale,
                left: '50%', marginLeft: -(frameW * scale) / 2,
                opacity: s && fit > 0 && on ? 1 : 0,
                pointerEvents: on ? 'auto' : 'none',
                zIndex: on ? 1 : 0,
                transition: motionOff ? 'none' : 'opacity .3s ease',
              }}
            />
          );
        })}
        {busy && (
          /* 更新中。押した手応えを、枠の側にも出す */
          <div className="absolute inset-x-0 top-0 z-20 h-[3px] bg-sky-500/25">
            <div className={`h-full w-1/3 bg-sky-600${motionOff ? '' : ' animate-pulse'}`} />
          </div>
        )}
        {!full && (
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#eceff4] to-transparent" />
        )}
        {/* 枠の上に重ねる操作。画面に枠が出ているあいだ、手が届くところにある。
            動きを止めているあいだは出さない。押しても何も起きない操作を置くと、
            効かなかったはずの操作が再開後に効いてしまう。 */}
        {near && !motionOff && (
          <button type="button" onClick={() => { if (motionOff) return; setAssembled(v => !v); }}
            className="absolute right-3 bottom-3 z-10 min-h-[40px] w-[124px] px-2 rounded-full text-[12px] font-bold bg-slate-900/85 text-white backdrop-blur hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
            {shownAssembled ? 'もう一度ばらす' : '組み上げる'}
          </button>
        )}
      </div>

      {/* 選んだ見せ方のまま、制作画面へ渡す。
          持っていくのは見せ方の名前だけ（lib/design-handoff.ts）。
          ログインを挟んでも消えないが、新しく作りはじめるときにしか使わない。 */}
      {startCta && (
        <div className="order-3 mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <a
            href={`/laruHP/studio?design=${encodeURIComponent(picked)}`}
            onClick={() => saveDesignChoice(picked)}
            className="inline-flex items-center justify-center min-h-[52px] px-6 rounded-xl bg-slate-900 text-white text-[14px] font-bold
              hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            この見せ方で作りはじめる
          </a>
          <span className="text-[12px] text-slate-600">
            「{shownChoice.name}」のまま制作画面へ進みます。4つの質問に答えると、たたき台ができます。
          </span>
        </div>
      )}

      {/* 予約まで試す。見本のサロンの予約であって、LARU HP の申し込みではない */}
      <div className="order-3 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
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
            <span className="text-[12px] text-slate-500">見本のお店の予約フォームです。入力して送れますが、どこへも送られません。</span>
          </>
        )}
      </div>

      <div className="order-4 mt-3 flex flex-wrap items-start gap-x-4 gap-y-1">
        <p className="text-[12px] text-slate-600 leading-relaxed flex-1 min-w-[240px]">
          {motionOff
            ? '動きを止めているあいだは、ばらす操作を使えません。見せ方の選び直しと、中の入力はそのまま使えます。'
            : !shownAssembled
            ? '部品が分かれた状態です。「組み上げる」を押すと1枚のサイトになります。'
            : full
              ? `いまは「${shownChoice.name}」で出しています。このまま触れます。中のボタンや入力欄が、公開したあとと同じように動きます。`
              : `いまは「${shownChoice.name}」で出しています。この下に、料金と予約が続きます。`}
        </p>
        {note && <p className="text-[12px] font-bold text-sky-700" role="status">{note}</p>}
      </div>
      {/* ここで選んだ見せ方を、そのまま制作画面へ持っていく。
          持っていくのは DESIGN_PRESETS の id ひとつだけ。制作画面では
          いちばん上に出るだけで、選び直しは妨げない。 */}
      {!startCta && <div className="order-5 mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex-1 min-w-[220px]">
          <p className="text-[13px] font-bold text-slate-800">この見せ方のまま、自分のお店で作れます</p>
          <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
            「{pickedChoice.name}」を選んだ状態で制作画面が開きます。写真と文章を入れ替えるところから始められます。
          </p>
        </div>
        <Link href={`/laruHP/studio?mood=${encodeURIComponent(picked)}`}
          className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl bg-slate-900 text-white text-[14px] font-bold hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500">
          この見せ方で作りはじめる
        </Link>
      </div>}

      <p className="order-6 text-[11px] text-slate-500 mt-2 leading-relaxed">
        この3つは、制作画面の「雰囲気を選び直す」と同じものです。選ぶたびに、公開ページを作るのと同じ処理で作り直しています。
        送信は見本としての受け付けで、どこへも送られません。写真は見本用の生成素材で、結い庵は架空のお店です。
      </p>
    </div>
  );
}
