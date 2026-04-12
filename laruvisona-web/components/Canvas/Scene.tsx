'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Environment, ContactShadows } from '@react-three/drei';
import { useRef, useState } from 'react';
import * as THREE from 'three';

function AICore() {
  const sphereRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);
  
  // 🌟 状態管理：ホバーとクリック
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  useFrame((state) => {
    if (sphereRef.current && materialRef.current) {
      // 基本の回転
      sphereRef.current.rotation.x = state.clock.elapsedTime * 0.2;
      sphereRef.current.rotation.y = state.clock.elapsedTime * 0.3;
      
      // パララックス（マウス追従）
      const targetX = (state.mouse.x * Math.PI) / 5;
      const targetY = (state.mouse.y * Math.PI) / 5;
      sphereRef.current.rotation.y += 0.05 * (targetX - sphereRef.current.rotation.y);
      sphereRef.current.rotation.x += 0.05 * (targetY - sphereRef.current.rotation.x);

      // 🌟 アニメーションのなめらかな補間（Lerp）
      // クリック時は大きく歪み、ホバー時は少し歪み、通常時は穏やかに
      const targetDistort = clicked ? 0.8 : hovered ? 0.6 : 0.3;
      const targetSpeed = clicked ? 5 : hovered ? 4 : 2;
      const targetScale = clicked ? 2.2 : hovered ? 2.0 : 1.8;

      materialRef.current.distort = THREE.MathUtils.lerp(materialRef.current.distort, targetDistort, 0.1);
      materialRef.current.speed = THREE.MathUtils.lerp(materialRef.current.speed, targetSpeed, 0.1);
      sphereRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <mesh 
        ref={sphereRef}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'none'; setClicked(false); }}
        onPointerDown={() => setClicked(true)}
        onPointerUp={() => setClicked(false)}
      >
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial 
          ref={materialRef}
          color="#3b82f6" 
          emissive="#1e3a8a"
          envMapIntensity={1} 
          clearcoat={0.8} 
          clearcoatRoughness={0.1} 
          metalness={0.9} 
          roughness={0.1}
          distort={0.3} 
          speed={2}     
        />
      </mesh>
    </Float>
  );
}

export default function Scene() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-auto">
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={2} color="#60a5fa" />
        <directionalLight position={[-10, -10, -5]} intensity={1} color="#f43f5e" />
        <AICore />
        <Environment preset="city" />
        <ContactShadows position={[0, -2.5, 0]} opacity={0.5} scale={10} blur={2} far={4} />
      </Canvas>
    </div>
  );
}