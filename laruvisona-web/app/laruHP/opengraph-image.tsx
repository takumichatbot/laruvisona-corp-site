import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'LARU HP — AIで最高のHPを最短で';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0c1a3a 0%, #0e2a6e 60%, #1a3a8a 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }} />

        {/* Glow orb */}
        <div style={{
          position: 'absolute', top: -100, right: -100,
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, transparent 70%)',
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', padding: '64px 72px', height: '100%', position: 'relative' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 'auto' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 900, color: '#0c1a3a',
            }}>L</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>
              LARU<span style={{ color: '#38bdf8', fontWeight: 300 }}>HP</span>
            </div>
          </div>

          {/* Main headline */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 40 }}>
            <div style={{ fontSize: 62, fontWeight: 900, color: 'white', lineHeight: 1.1, letterSpacing: '-2px', marginBottom: 20 }}>
              AIで最高のHPを
              <br />
              <span style={{ color: '#38bdf8' }}>最短で。</span>
            </div>
            <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
              業種別テンプレート × AI自動生成 × ビジュアルエディタ
            </div>
          </div>

          {/* Plan pills */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 48 }}>
            {[
              { label: 'HP', price: '¥999/月', color: '#38bdf8' },
              { label: 'HP + LARUbot', price: '¥4,980/月', color: '#818cf8' },
              { label: 'エージェンシー', price: '¥19,800/月', color: '#c084fc' },
            ].map(p => (
              <div key={p.label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 100, padding: '8px 18px',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                <span style={{ color: 'white', fontSize: 16, fontWeight: 600 }}>{p.label}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{p.price}</span>
              </div>
            ))}
          </div>

          {/* Bottom badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)',
            borderRadius: 100, padding: '10px 24px', alignSelf: 'flex-start',
          }}>
            <span style={{ fontSize: 18, color: '#38bdf8', fontWeight: 700 }}>初月無料</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>·</span>
            <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)' }}>laruvisona.jp/laruHP</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
