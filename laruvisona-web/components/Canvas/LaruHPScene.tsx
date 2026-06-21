'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, MeshWobbleMaterial, Torus, Icosahedron, RoundedBox } from '@react-three/drei';
import { useRef, useState } from 'react';
import * as THREE from 'three';

function FloatingShape({
  position,
  color,
  emissive,
  shape,
  speed,
  distort,
  wobble,
  rotSpeed,
}: {
  position: [number, number, number];
  color: string;
  emissive: string;
  shape: 'sphere' | 'torus' | 'ico' | 'box';
  speed: number;
  distort?: number;
  wobble?: number;
  rotSpeed?: [number, number, number];
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const r = rotSpeed ?? [0.2, 0.3, 0.1];
    ref.current.rotation.x += r[0] * 0.01;
    ref.current.rotation.y += r[1] * 0.01;
    ref.current.rotation.z += r[2] * 0.01;
    // subtle mouse parallax
    ref.current.position.x = position[0] + state.mouse.x * 0.15;
    ref.current.position.y = position[1] + state.mouse.y * 0.12;
  });

  const mat = distort != null ? (
    <MeshDistortMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={0.4}
      metalness={0.8}
      roughness={0.15}
      clearcoat={1}
      clearcoatRoughness={0.1}
      distort={distort}
      speed={speed}
      transparent
      opacity={0.85}
    />
  ) : (
    <MeshWobbleMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={0.3}
      metalness={0.7}
      roughness={0.2}
      factor={wobble ?? 0.3}
      speed={speed}
      transparent
      opacity={0.8}
    />
  );

  return (
    <Float speed={speed * 0.6} rotationIntensity={0.6} floatIntensity={1.2}>
      <mesh ref={ref} position={position}>
        {shape === 'sphere'  && <sphereGeometry args={[1, 48, 48]} />}
        {shape === 'torus'   && <torusGeometry args={[0.7, 0.28, 24, 64]} />}
        {shape === 'ico'     && <icosahedronGeometry args={[0.9, 1]} />}
        {shape === 'box'     && <boxGeometry args={[1.2, 1.2, 1.2]} />}
        {mat}
      </mesh>
    </Float>
  );
}

function RingAccent({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = state.clock.elapsedTime * 0.4;
    ref.current.rotation.y = state.clock.elapsedTime * 0.25;
  });
  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[1.4, 0.04, 16, 80]} />
      <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.6} metalness={1} roughness={0} transparent opacity={0.5} />
    </mesh>
  );
}

export default function LaruHPScene() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden>
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[8, 8, 4]} intensity={2.5} color="#bae6fd" />
        <directionalLight position={[-6, -4, -3]} intensity={1.2} color="#818cf8" />
        <pointLight position={[0, 0, 3]} intensity={1} color="#38bdf8" />

        {/* Left large sphere */}
        <FloatingShape
          position={[-4.2, 0.5, -1]}
          color="#0ea5e9"
          emissive="#0369a1"
          shape="sphere"
          speed={1.8}
          distort={0.35}
        />

        {/* Right icosahedron */}
        <FloatingShape
          position={[4.0, -0.3, -1.5]}
          color="#6366f1"
          emissive="#4338ca"
          shape="ico"
          speed={2.2}
          wobble={0.4}
          rotSpeed={[0.3, 0.5, 0.2]}
        />

        {/* Top-right small torus */}
        <FloatingShape
          position={[3.2, 2.4, -2]}
          color="#38bdf8"
          emissive="#0284c7"
          shape="torus"
          speed={2.8}
          wobble={0.25}
          rotSpeed={[0.5, 0.2, 0.4]}
        />

        {/* Bottom-left box */}
        <FloatingShape
          position={[-3.6, -2.2, -2]}
          color="#818cf8"
          emissive="#4f46e5"
          shape="box"
          speed={1.5}
          distort={0.2}
          rotSpeed={[0.15, 0.4, 0.25]}
        />

        {/* Center-top small sphere */}
        <FloatingShape
          position={[0.8, 3.0, -3]}
          color="#7dd3fc"
          emissive="#0369a1"
          shape="sphere"
          speed={3.0}
          distort={0.5}
        />

        {/* Decorative rings */}
        <RingAccent position={[-4.2, 0.5, -1]} />
        <RingAccent position={[4.0, -0.3, -1.5]} />
      </Canvas>
    </div>
  );
}
