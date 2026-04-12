'use client';

// 🌟 修正ポイント： { ReactLenis } ではなく、 {} を外して直接読み込む
import ReactLenis from '@studio-freight/react-lenis';

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis root options={{ lerp: 0.05, duration: 1.5, smoothWheel: true }}>
      {children}
    </ReactLenis>
  );
}