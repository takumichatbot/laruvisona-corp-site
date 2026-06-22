import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const alt = 'ホームページ';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Pastel gradient sets (bg top, bg bottom, accent)
const GRADIENTS = [
  ['#0c1a3a', '#0e2a6e', '#38bdf8'],   // blue
  ['#1a0c3a', '#2e0e6e', '#a78bfa'],   // purple
  ['#0c3a1a', '#0e6e2a', '#34d399'],   // green
  ['#3a1a0c', '#6e2e0e', '#fb923c'],   // orange
  ['#0c2a3a', '#0e4a6e', '#22d3ee'],   // cyan
  ['#2a0c3a', '#4a0e6e', '#e879f9'],   // pink-purple
];

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getServiceClient();

  const { data } = await supabase
    .from('sites')
    .select('name, seo_json, settings_json')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  const siteName = data?.name || slug;
  const seo = (data?.seo_json ?? {}) as { title?: string; description?: string };
  const description = seo.description || '';

  // Deterministic gradient from slug
  const gradientIndex = slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTS.length;
  const [topColor, bottomColor, accentColor] = GRADIENTS[gradientIndex];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: `linear-gradient(135deg, ${topColor} 0%, ${bottomColor} 100%)`,
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
          backgroundSize: '48px 48px',
        }} />

        {/* Glow orb */}
        <div style={{
          position: 'absolute', top: -120, right: -120,
          width: 560, height: 560, borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}33 0%, transparent 70%)`,
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -80,
          width: 400, height: 400, borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}1a 0%, transparent 70%)`,
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', padding: '64px 80px', height: '100%', position: 'relative' }}>
          {/* Top badge */}
          <div style={{ display: 'flex', marginBottom: 'auto' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 100, padding: '8px 20px',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor }} />
              <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Powered by LARU HP</span>
            </div>
          </div>

          {/* Site name */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 32 }}>
            <div style={{
              fontSize: siteName.length > 12 ? 64 : 80,
              fontWeight: 900,
              color: 'white',
              lineHeight: 1.05,
              letterSpacing: '-2px',
              marginBottom: 24,
            }}>
              {siteName}
            </div>
            {description && (
              <div style={{
                fontSize: 26,
                color: 'rgba(255,255,255,0.65)',
                lineHeight: 1.5,
                maxWidth: 900,
              }}>
                {description.length > 80 ? description.slice(0, 80) + '...' : description}
              </div>
            )}
          </div>

          {/* Bottom accent line */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ height: 3, width: 60, background: accentColor, borderRadius: 2 }} />
            <div style={{ height: 3, width: 30, background: `${accentColor}66`, borderRadius: 2 }} />
            <div style={{ height: 3, width: 15, background: `${accentColor}33`, borderRadius: 2 }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
