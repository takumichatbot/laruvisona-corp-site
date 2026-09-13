'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, Suspense } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';

type Props = {
  image: string;
  spread: boolean;
  paused: boolean;
  visible: boolean;
  onReady: () => void;
  onFail: () => void;
};
function Panels({ image, spread, paused, visible, onReady }: Props) {
  const source = useLoader(THREE.TextureLoader, image);
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef<THREE.Group>(null),
    parts = useRef<(THREE.Group | null)[]>([]);
  const pose = useRef(0),
    last = useRef(0),
    intro = useRef(paused ? 1 : 0);
  const textures = useMemo(
    () =>
      [0, 1, 2].map((i) => {
        const t = source.clone();
        t.colorSpace = THREE.SRGBColorSpace;
        t.repeat.set(1, 1 / 3);
        t.offset.set(0, (2 - i) / 3);
        t.needsUpdate = true;
        return t;
      }),
    [source],
  );
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  useEffect(() => {
    onReady();
    invalidate();
  }, [onReady, invalidate, textures]);
  useEffect(() => {
    invalidate();
  }, [spread, paused, visible, invalidate]);
  useEffect(() => {
    const wake = () => invalidate();
    document.addEventListener('visibilitychange', wake);
    return () => document.removeEventListener('visibilitychange', wake);
  }, [invalidate]);
  useFrame((state, delta) => {
    if (!group.current) return;
    const canMove = !paused && visible && !document.hidden;
    if (canMove) {
      intro.current = Math.min(1, intro.current + Math.min(delta, 0.04) * 0.8);
      pose.current = THREE.MathUtils.damp(
        pose.current,
        spread ? 1 : 0,
        6,
        Math.min(delta, 0.04),
      );
      last.current += Math.min(delta, 0.04);
    }
    const opening = 1 - intro.current,
      s = pose.current + opening * 0.65;
    group.current.rotation.set(
      -0.08 + Math.sin(last.current * 0.5) * 0.018,
      -0.24,
      0.025,
    );
    parts.current.forEach((part, i) => {
      if (!part) return;
      part.position.set(
        (i - 1) * s * 0.45,
        (1 - i) * (0.93 + s * 0.36),
        s * (1 - i) * 0.5,
      );
      part.rotation.set(
        (i - 1) * s * 0.055,
        (i - 1) * s * 0.09,
        (i - 1) * s * 0.035,
      );
    });
    // Demand rendering stops outside the hero and when manually paused; no idle full-page loop.
    if (canMove) state.invalidate();
  });
  return (
    <group ref={group} position={[0, 0.02, 0]}>
      {textures.map((t, i) => (
        <group
          key={i}
          ref={(el) => {
            parts.current[i] = el;
          }}
        >
          <mesh position={[0, 0, -0.035]}>
            <boxGeometry args={[3.7, 0.932, 0.055]} />
            <meshStandardMaterial color="#e7eaf4" roughness={0.78} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[3.7, 0.932]} />
            <meshBasicMaterial map={t} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function ContextGuard({ onFail }: { onFail: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const lost = (e: Event) => {
      e.preventDefault();
      onFail();
    };
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => gl.domElement.removeEventListener('webglcontextlost', lost);
  }, [gl, onFail]);
  return null;
}
export default function SiteSculpture(props: Props) {
  return (
    <Canvas
      aria-hidden="true"
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5.8], fov: 40 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <ContextGuard onFail={props.onFail} />
      <ambientLight intensity={2} />
      <directionalLight position={[3, 5, 7]} intensity={3} />
      <Suspense fallback={null}>
        <Panels {...props} />
      </Suspense>
    </Canvas>
  );
}
