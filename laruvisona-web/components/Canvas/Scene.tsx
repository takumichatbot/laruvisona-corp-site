'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MeshDistortMaterial, Environment, Float } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ─────────────────────────────────────────────────────────────────────────────
// 球体スクロールストーリー
//
// 構成: fixed z-0 の単一canvas。各セクションの背景半透明化とセットで、
// 1つの球体がページ全体を旅する。
//   Scene1 誕生   … イントロ後、パーティクルが収束して球体を形成（スクロール非依存）
//   Scene2 分裂   … #services で3小球に分裂し各カードの真上へ吸着（hoverで回転加速）
//   Scene3 金額   … #estimator 右側に定位、概算金額を CanvasTexture→emissiveMap で表面に流す
//   Scene4 収納   … #product のLARU HPカード内ミニモックへ縮小しながら吸い込まれ、モック内ドットが脈動
//   Scene5 着地   … #voice で再浮上し音声コア背面へ → #contact で中央背面に着地（input focusで脈動加速）
//
// 設計上の要点:
//   - マスタータイムライン（scrub 0.8）は「経路座標(fx,fy)・scale・ブレンド係数」だけを持つ。
//     カード/モック等のDOM追従座標はスクロールで画面上を動くため、毎フレーム
//     getBoundingClientRect から合成する（タイムラインに焼くと必ず破綻する）。
//   - prefers-reduced-motion: ストーリー無効、中央に静的表示。
//   - モバイル(<768px): パーティクル5,000、分裂は省略（縮小移動のみ）。
// ─────────────────────────────────────────────────────────────────────────────

gsap.registerPlugin(ScrollTrigger);

interface Story {
  fx: number;      // 画面内の目標位置（-0.5〜0.5、ビューポート幅/高さに対する割合）
  fy: number;
  scale: number;
  birth: number;   // 0→1 パーティクル収束
  formed: number;  // 0→1 パーティクル→メッシュのクロスフェード
  split: number;   // 0→1 3小球への分裂
  ticker: number;  // 0→1 金額表示の強度
  absorb: number;  // 0→1 モックへの吸い込み
  land: number;    // 0→1 お問い合わせでの着地（脈動の重み）
}

const CARD_COLORS = ['#3b82f6', '#818cf8', '#a855f7'];

function domPointToWorld(px: number, py: number, viewport: { width: number; height: number }): [number, number] {
  return [
    (px / window.innerWidth - 0.5) * viewport.width,
    (0.5 - py / window.innerHeight) * viewport.height,
  ];
}

/** 3Dワールド本体（Canvas内） */
function StoryWorld({
  story,
  tickerText,
  hoverCard,
  focusBoost,
  isMobile,
}: {
  story: React.RefObject<Story>;
  tickerText: React.RefObject<string>;
  hoverCard: React.RefObject<number>;
  focusBoost: React.RefObject<boolean>;
  isMobile: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matRef = useRef<any>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const pointsMatRef = useRef<THREE.PointsMaterial>(null);
  const miniRefs = useRef<(THREE.Mesh | null)[]>([null, null, null]);
  const viewport = useThree(s => s.viewport);
  const setFrameloop = useThree(s => s.setFrameloop);

  // マウス慣性（視差ではなく遅れ追従、回転にのみ適用）
  const mouse = useRef({ tx: 0, ty: 0, cx: 0, cy: 0 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // タブ非表示時はレンダリング停止
  useEffect(() => {
    const onVis = () => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__lvVisEvents = ((window as any).__lvVisEvents || []).concat(document.hidden);
      }
      setFrameloop(document.hidden ? 'never' : 'always');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [setFrameloop]);

  // 誕生パーティクル: 散開位置 → 球面位置
  const PARTICLE_COUNT = isMobile ? 5000 : 15000;
  const { scatter, target, positions } = useMemo(() => {
    const scatter = new Float32Array(PARTICLE_COUNT * 3);
    const target = new Float32Array(PARTICLE_COUNT * 3);
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // 目標: 球面上のランダム点（半径1）
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(2 * Math.random() - 1);
      target[i * 3] = Math.sin(v) * Math.cos(u);
      target[i * 3 + 1] = Math.sin(v) * Math.sin(u);
      target[i * 3 + 2] = Math.cos(v);
      // 開始: 画面全体に散開（目標から逆算した放射方向 × ランダム距離）
      const d = 4 + Math.random() * 9;
      scatter[i * 3] = target[i * 3] * d + (Math.random() - 0.5) * 5;
      scatter[i * 3 + 1] = target[i * 3 + 1] * d + (Math.random() - 0.5) * 5;
      scatter[i * 3 + 2] = target[i * 3 + 2] * (d * 0.4);
      positions[i * 3] = scatter[i * 3];
      positions[i * 3 + 1] = scatter[i * 3 + 1];
      positions[i * 3 + 2] = scatter[i * 3 + 2];
    }
    return { scatter, target, positions };
  }, [PARTICLE_COUNT]);

  // Scene3: 金額ティッカー用 CanvasTexture（emissiveMap 差し替え方式）
  const { tickerTexture, tickerCanvas } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(2, 1);
    return { tickerTexture: tex, tickerCanvas: c };
  }, []);
  const lastDrawn = useRef('');
  // 初期状態でも emissive の発光を殺さないよう、マウント時に一度描画しておく
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { drawTicker(tickerText.current || '¥90万〜'); }, []);
  const drawTicker = (text: string) => {
    const ctx = tickerCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 512, 256);
    ctx.fillStyle = '#0a1a3a';
    ctx.fillRect(0, 0, 512, 256);
    ctx.font = 'bold 84px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#bfdbfe';
    ctx.fillText(text, 256, 128);
    tickerTexture.needsUpdate = true;
    lastDrawn.current = text;
  };

  // DOM追従ターゲットのキャッシュ（毎フレームquerySelectorしない）
  const domRefs = useRef<{ cards: (Element | null)[]; mock: Element | null; dot: Element | null }>({ cards: [], mock: null, dot: null });
  useEffect(() => {
    domRefs.current = {
      cards: [0, 1, 2].map(i => document.querySelector(`[data-lv-card="${i}"]`)),
      mock: document.querySelector('[data-lv-mock]'),
      dot: document.querySelector('[data-lv-dot]'),
    };
  }, []);

  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__lvFrames = ((window as any).__lvFrames || 0) + 1; // 検証用フレームカウンタ
    const p = story.current;
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;

    // ── 基本位置: 経路座標(fx,fy) → ワールド座標
    tmpA.set(p.fx * viewport.width, p.fy * viewport.height, 0);

    // ── Scene4: モックへの吸い込み（DOM座標と毎フレーム合成）
    let opacity = 1;
    if (p.absorb > 0.001) {
      const mock = domRefs.current.mock;
      if (mock) {
        const r = mock.getBoundingClientRect();
        const [wx, wy] = domPointToWorld(r.left + r.width / 2, r.top + r.height * 0.3, viewport);
        tmpB.set(wx, wy, 0);
        const k = gsap.parseEase('power2.inOut')(p.absorb);
        tmpA.lerp(tmpB, k);
      }
      // 吸い込み末端でフェードアウト（吸い込まれた感）
      opacity = p.absorb > 0.75 ? Math.max(0, 1 - (p.absorb - 0.75) / 0.25) : 1;
      // モック内の残留ドット（本体フェードと入れ替わりで点灯）
      const dot = domRefs.current.dot;
      if (dot) (dot as HTMLElement).style.opacity = p.absorb > 0.8 ? '1' : '0';
    }

    // ── 脈動（Scene4残留ドットの間は本体停止、Scene5着地で復活・focusで加速）
    const pulseSpeed = focusBoost.current ? 5.2 : 2.4;
    const pulse = 1 + Math.sin(t * pulseSpeed) * 0.03 * Math.max(p.land, p.absorb > 0.5 ? 0 : 0.35);

    // ── 分裂中は本体を縮めて消す（3小球へクロスフェード）
    const mainVisible = (1 - p.split) * (0.95 + 0.05 * p.formed);
    const s = Math.max(0.0001, p.scale * mainVisible * pulse);

    mesh.position.copy(tmpA);
    mesh.scale.setScalar(s);
    mesh.visible = p.formed > 0.01 && p.split < 0.999 && opacity > 0.01;

    // ── 回転: 自転 + マウス慣性遅れ
    const m = mouse.current;
    m.cx += (m.tx - m.cx) * 0.08;
    m.cy += (m.ty - m.cy) * 0.08;
    mesh.rotation.y = t * 0.25 + m.cx * 0.5;
    mesh.rotation.x = t * 0.15 + m.cy * 0.35;

    if (matRef.current) {
      matRef.current.opacity = opacity;
      matRef.current.transparent = true;
      // Scene3: ティッカー表示強度 + テクスチャを流す
      matRef.current.emissiveIntensity = 0.25 + p.ticker * 1.3;
      if (p.ticker > 0.01) {
        tickerTexture.offset.x -= delta * 0.18;
        if (tickerText.current !== lastDrawn.current) drawTicker(tickerText.current);
      }
    }

    // ── Scene1: パーティクル収束
    const pts = pointsRef.current;
    if (pts) {
      pts.visible = p.formed < 0.999;
      if (pts.visible) {
        const k = gsap.parseEase('power3.inOut')(p.birth);
        const arr = (pts.geometry.getAttribute('position') as THREE.BufferAttribute);
        const a = arr.array as Float32Array;
        for (let i = 0; i < a.length; i++) {
          a[i] = scatter[i] + (target[i] - scatter[i]) * k;
        }
        arr.needsUpdate = true;
        pts.position.copy(tmpA);
        pts.scale.setScalar(Math.max(0.0001, p.scale));
        pts.rotation.y = t * 0.1;
        if (pointsMatRef.current) pointsMatRef.current.opacity = (1 - p.formed) * (0.35 + 0.65 * p.birth);
      }
    }

    // ── Scene2: 3小球（各サービスカードの真上に吸着）
    for (let i = 0; i < 3; i++) {
      const mini = miniRefs.current[i];
      if (!mini) continue;
      const visible = p.split > 0.01;
      mini.visible = visible;
      if (!visible) continue;
      const card = domRefs.current.cards[i];
      if (card) {
        const r = card.getBoundingClientRect();
        const [wx, wy] = domPointToWorld(r.left + r.width / 2, r.top - 36, viewport);
        tmpB.set(wx, wy, 0);
      } else {
        tmpB.copy(tmpA);
      }
      const k = gsap.parseEase('power2.out')(p.split);
      mini.position.copy(tmpA).lerp(tmpB, k);
      mini.scale.setScalar(Math.max(0.0001, p.scale * 0.33 * p.split));
      const spin = hoverCard.current === i ? 2.2 : 0.5; // hoverで回転加速（連動感）
      mini.rotation.y += delta * spin;
      mini.rotation.x += delta * spin * 0.6;
    }
  });

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial
          ref={matRef}
          color="#3b82f6"
          emissive="#1e3a8a"
          emissiveMap={tickerTexture}
          envMapIntensity={1}
          clearcoat={0.8}
          clearcoatRoughness={0.1}
          metalness={0.9}
          roughness={0.1}
          distort={0.3}
          speed={2}
          transparent
        />
      </mesh>

      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial ref={pointsMatRef} size={0.016} color="#93c5fd" transparent depthWrite={false} />
      </points>

      {CARD_COLORS.map((c, i) => (
        <mesh key={c} ref={el => { miniRefs.current[i] = el; }} visible={false}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshPhysicalMaterial color={c} emissive="#1e3a8a" metalness={0.9} roughness={0.15} clearcoat={0.8} />
        </mesh>
      ))}
    </>
  );
}

/** reduced-motion 用の静的表示（従来相当） */
function StaticCore() {
  return (
    <Float speed={2} rotationIntensity={0.6} floatIntensity={1.2}>
      <mesh scale={1.8}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial color="#3b82f6" emissive="#1e3a8a" envMapIntensity={1} clearcoat={0.8} clearcoatRoughness={0.1} metalness={0.9} roughness={0.1} distort={0.3} speed={2} />
      </mesh>
    </Float>
  );
}

export default function Scene({ introDone = true }: { introDone?: boolean }) {
  const story = useRef<Story>({ fx: 0, fy: 0, scale: 1.8, birth: 0, formed: 0, split: 0, ticker: 0, absorb: 0, land: 0 });
  const tickerText = useRef('¥90万〜');
  const hoverCard = useRef(-1);
  const focusBoost = useRef(false);
  const [reduced, setReduced] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setIsMobile(window.innerWidth < 768);
    setReady(true);
    // デバッグ/検証用フック（コスト無視できるため常時公開）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__lvStory = story.current;
  }, []);

  // ── Scene1: 誕生（イントロ終了と同時。ページ中腹からのリロード時はスキップ）
  const birthDone = useRef(false);
  useEffect(() => {
    if (!ready || reduced || !introDone || birthDone.current) return;
    birthDone.current = true;
    if (window.scrollY > window.innerHeight * 0.4) {
      story.current.birth = 1;
      story.current.formed = 1;
      return;
    }
    const tl = gsap.timeline();
    tl.to(story.current, { birth: 1, duration: 2.0, ease: 'power3.inOut' })
      .to(story.current, { formed: 1, duration: 0.5, ease: 'power2.out' }, '-=0.25');
    return () => { tl.kill(); };
  }, [ready, reduced, introDone]);

  // ── マスタータイムライン（scrub 0.8・1本に集約。リサイズで再構築）
  useEffect(() => {
    if (!ready || reduced) return;
    let tl: gsap.core.Timeline | null = null;

    const build = () => {
      tl?.scrollTrigger?.kill();
      tl?.kill();
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      // セクション先頭がビューポートの anchor 位置に来るスクロール割合
      const at = (sel: string, anchor = 0.6) => {
        const el = document.querySelector(sel);
        if (!el) return 0;
        const top = el.getBoundingClientRect().top + window.scrollY;
        return Math.min(1, Math.max(0, (top - window.innerHeight * anchor) / maxScroll));
      };

      const sAbout = at('#about');
      const sServices = at('#services');
      const sEstimator = at('#estimator');
      const sProduct = at('#product');
      const sVoice = at('#voice');
      const sContact = at('#contact', 0.75);

      tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: document.body, start: 0, end: 'max', scrub: 0.8, invalidateOnRefresh: false },
      });
      const T = tl;
      const seg = (from: number, to: number) => Math.max(0.001, to - from);

      // hero → about: 中央からゆるやかに右へ（aboutは左テキスト・右テーブル）
      T.to(story.current, { fx: 0.27, fy: 0.04, scale: 1.15, duration: seg(0, sAbout) }, 0);
      // about → services: 中央上部へ戻りつつ分裂準備
      T.to(story.current, { fx: 0, fy: 0.1, scale: 1.0, duration: seg(sAbout, sServices) }, sAbout);
      // services: 分裂 → カード上に吸着（モバイルは分裂省略で縮小移動のみ）
      const splitEnd = sServices + seg(sServices, sEstimator) * 0.55;
      if (!isMobile) {
        T.to(story.current, { split: 1, duration: seg(sServices, splitEnd) }, sServices);
        T.to(story.current, { split: 0, duration: seg(splitEnd, sEstimator) }, splitEnd); // 抜けるとき再結合
      } else {
        T.to(story.current, { scale: 0.6, fx: 0.3, duration: seg(sServices, splitEnd) }, sServices);
      }
      // estimator: 右側（ESTIMATED COSTカードの背後）に定位 + 金額ティッカー
      const estMid = sEstimator + seg(sEstimator, sProduct) * 0.3;
      T.to(story.current, { fx: isMobile ? 0.25 : 0.31, fy: 0, scale: 1.2, duration: seg(sEstimator, estMid) }, sEstimator);
      T.to(story.current, { ticker: 1, duration: seg(sEstimator, estMid) }, sEstimator);
      T.to(story.current, { ticker: 0, duration: seg(estMid, sProduct) * 0.6 }, sProduct - seg(estMid, sProduct) * 0.3);
      // product: LARU HPカードのミニモックへ吸い込まれる（実座標は useFrame でDOM合成）。
      // 前半で吸い込みを完了させ、voiceまで absorb=1 を保持する帯を作る
      // （ここが短いと scrub でドット表示閾値まで到達しない）
      const absorbEnd = sProduct + seg(sProduct, sVoice) * 0.35;
      T.to(story.current, { absorb: 1, scale: 0.15, duration: seg(sProduct, absorbEnd) }, sProduct);
      // voice: 再浮上して音声UIコアの背面に重なる
      T.to(story.current, { absorb: 0, fx: 0, fy: -0.22, scale: 0.72, duration: seg(sVoice, sContact) * 0.5 }, sVoice);
      // contact: 中央背面へ着地
      T.to(story.current, { scale: 1.6, fx: 0, fy: -0.03, land: 1, duration: seg(sContact, 1) }, sContact);
    };

    build();
    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 300); };
    window.addEventListener('resize', onResize);
    // フォント/画像ロード後にレイアウトが変わるため一度だけ再構築
    const onLoad = () => build();
    window.addEventListener('load', onLoad);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('load', onLoad);
      tl?.scrollTrigger?.kill();
      tl?.kill();
    };
  }, [ready, reduced, isMobile]);

  // ── Scene3: 見積もり金額イベント / Scene2: カードhover / Scene5: フォームfocus
  useEffect(() => {
    if (!ready || reduced) return;
    const onEstimate = (e: Event) => {
      const total = (e as CustomEvent<number>).detail;
      if (typeof total === 'number') tickerText.current = `¥${total}万〜`;
    };
    window.addEventListener('lv-estimate', onEstimate);

    const cards = [0, 1, 2].map(i => document.querySelector(`[data-lv-card="${i}"]`));
    const enters = [0, 1, 2].map(i => () => { hoverCard.current = i; });
    const leave = () => { hoverCard.current = -1; };
    cards.forEach((c, i) => {
      c?.addEventListener('pointerenter', enters[i]);
      c?.addEventListener('pointerleave', leave);
    });

    const contact = document.querySelector('#contact');
    const onFocusIn = () => { focusBoost.current = true; };
    const onFocusOut = () => { focusBoost.current = false; };
    contact?.addEventListener('focusin', onFocusIn);
    contact?.addEventListener('focusout', onFocusOut);

    return () => {
      window.removeEventListener('lv-estimate', onEstimate);
      cards.forEach((c, i) => {
        c?.removeEventListener('pointerenter', enters[i]);
        c?.removeEventListener('pointerleave', leave);
      });
      contact?.removeEventListener('focusin', onFocusIn);
      contact?.removeEventListener('focusout', onFocusOut);
    };
  }, [ready, reduced]);

  if (!ready) return <div className="fixed inset-0 z-0" aria-hidden="true" />;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          // コンテキストロスト時に preventDefault しておくとブラウザが復旧を試み、
          // three が webglcontextrestored で描画を自動再開できる（iOS Safari等のメモリ圧対策）
          gl.domElement.addEventListener('webglcontextlost', e => e.preventDefault(), false);
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={2} color="#60a5fa" />
        <directionalLight position={[-10, -10, -5]} intensity={1} color="#f43f5e" />
        {reduced
          ? <StaticCore />
          : <StoryWorld story={story} tickerText={tickerText} hoverCard={hoverCard} focusBoost={focusBoost} isMobile={isMobile} />}
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
