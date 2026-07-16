import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';

export const alt = 'LaruVisona | 「想像」を「実装」する';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  const logoData = fs.readFileSync(path.join(process.cwd(), 'public/images/logo_light.png'));
  const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #030712 0%, #0f172a 55%, #1e1b4b 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }} />
        {/* Glow — top right indigo */}
        <div style={{
          position: 'absolute', top: -160, right: -120,
          width: 520, height: 520, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
        }} />
        {/* Glow — bottom left sky */}
        <div style={{
          position: 'absolute', bottom: -100, left: -80,
          width: 420, height: 420, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.18) 0%, transparent 70%)',
        }} />

        <div style={{
          display: 'flex', flexDirection: 'column',
          padding: '60px 72px', height: '100%', position: 'relative',
        }}>
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} style={{ height: 70, width: 'auto', marginBottom: 'auto', objectFit: 'contain' }} alt="LaruVisona" />

          {/* Headline */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 36 }}>
            <div style={{
              fontSize: 66, fontWeight: 900, color: 'white',
              letterSpacing: '-2px', lineHeight: 1.1, marginBottom: 18,
            }}>
              「想像」を、「実装」する
            </div>
            <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.55)', letterSpacing: '-0.3px' }}>
              AI × モダンWeb技術を駆使するテクノロジーパートナー
            </div>
          </div>

          {/* Service pills */}
          <div style={{ display: 'flex', gap: 12 }}>
            {['AIエージェント開発', 'Webアプリ開発', 'LARU HP'].map((s) => (
              <div
                key={s}
                style={{
                  display: 'flex',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.13)',
                  borderRadius: 100,
                  padding: '9px 22px',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 17,
                  fontWeight: 500,
                }}
              >
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
