import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = searchParams.get('title') || 'LARU HP';
  const desc = searchParams.get('desc') || 'AIで作る、プロ品質のホームページ';
  const industry = searchParams.get('industry') || '';

  const INDUSTRY_EMOJI: Record<string, string> = {
    restaurant: '🍽️', beauty: '💄', clinic: '🏥', legal: '⚖️',
    construction: '🔨', realestate: '🏠', retail: '🛍️',
    fitness: '💪', hotel: '🏨', education: '📚', wedding: '💍', pet: '🐾',
  };
  const emoji = INDUSTRY_EMOJI[industry] || '🌐';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)',
          backgroundSize: '40px 40px',
          display: 'flex',
        }} />

        {/* Glow */}
        <div style={{
          position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)',
          width: '800px', height: '600px',
          background: 'radial-gradient(ellipse, rgba(59,130,246,0.3) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: '72px 80px', height: '100%' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'auto' }}>
            <div style={{
              width: '44px', height: '44px', background: '#fff', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 900, color: '#0f172a',
            }}>L</div>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '18px', fontWeight: 600 }}>LARU HP</span>
          </div>

          {/* Main content */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '72px', marginBottom: '16px', display: 'flex' }}>{emoji}</div>
            <div style={{
              fontSize: title.length > 20 ? '48px' : '60px',
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1.1,
              marginBottom: '20px',
              display: 'flex',
              maxWidth: '900px',
            }}>{title}</div>
            {desc && (
              <div style={{
                fontSize: '26px',
                color: 'rgba(255,255,255,0.55)',
                fontWeight: 400,
                lineHeight: 1.4,
                display: 'flex',
                maxWidth: '800px',
              }}>{desc}</div>
            )}
          </div>

          {/* Footer badge */}
          <div style={{
            marginTop: '48px', display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{
              background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)',
              borderRadius: '999px', padding: '6px 18px',
              color: '#93c5fd', fontSize: '16px', fontWeight: 600,
              display: 'flex',
            }}>
              Powered by LARU HP
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
