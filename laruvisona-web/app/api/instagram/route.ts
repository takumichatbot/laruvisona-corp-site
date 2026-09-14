import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readContactBody } from '@/lib/contact-contract';

interface IgMedia {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  timestamp: string;
}

// GET /api/instagram — return latest posts for the authenticated user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('instagram_access_token')
    .eq('id', user.id)
    .single();

  const token = (profile as { instagram_access_token?: string } | null)?.instagram_access_token;
  if (!token) return NextResponse.json({ connected: false, media: [] });

  const fields = 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp';
  let res: Response;
  try {
    res = await fetch(
      `https://graph.instagram.com/me/media?fields=${fields}&limit=12&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(12_000) },
    );
  } catch {
    return NextResponse.json({ error: 'Instagram API unavailable', media: [] }, { status: 503 });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    if (err?.error?.code === 190) {
      // Token expired — clear it
      await supabase.from('profiles').update({ instagram_access_token: null }).eq('id', user.id);
      return NextResponse.json({ connected: false, expired: true, media: [] });
    }
    return NextResponse.json({ error: 'Instagram API error', media: [] }, { status: 500 });
  }

  const data = await res.json().catch(() => null) as { data?: IgMedia[] } | null;
  if (!data || !Array.isArray(data.data)) {
    return NextResponse.json({ error: 'Instagram API response invalid', media: [] }, { status: 502 });
  }
  const media = data.data.filter(m => m && typeof m === 'object' && (m.media_type !== 'VIDEO' || m.thumbnail_url));

  return NextResponse.json({ connected: true, media });
}

// POST /api/instagram — save access token
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await readContactBody(req, 8_000).catch(() => null);
  const access_token = typeof body?.access_token === 'string' ? body.access_token.trim() : '';
  if (access_token.length < 16 || access_token.length > 4096 || /[\u0000-\u001f\u007f]/.test(access_token)) {
    return NextResponse.json({ error: 'access_token required' }, { status: 400 });
  }

  // Verify token is valid before saving
  let verify: Response;
  try {
    verify = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(access_token)}`,
      { signal: AbortSignal.timeout(12_000) },
    );
  } catch {
    return NextResponse.json({ error: 'Instagram API unavailable' }, { status: 503 });
  }
  if (!verify.ok) return NextResponse.json({ error: 'Invalid access token' }, { status: 400 });

  const igUser = await verify.json().catch(() => null) as { id?: unknown; username?: unknown } | null;
  if (!igUser || typeof igUser.id !== 'string' || typeof igUser.username !== 'string' || igUser.username.length > 100) {
    return NextResponse.json({ error: 'Instagram API response invalid' }, { status: 502 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      instagram_access_token: access_token,
      instagram_username: igUser.username,
    })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: 'Instagram設定を保存できませんでした' }, { status: 503 });
  return NextResponse.json({ ok: true, username: igUser.username });
}

// DELETE /api/instagram — disconnect
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase.from('profiles').update({ instagram_access_token: null, instagram_username: null }).eq('id', user.id);
  if (error) return NextResponse.json({ error: 'Instagram設定を保存できませんでした' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
