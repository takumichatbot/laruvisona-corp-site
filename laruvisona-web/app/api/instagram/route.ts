import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
  const res = await fetch(
    `https://graph.instagram.com/me/media?fields=${fields}&limit=12&access_token=${token}`
  );

  if (!res.ok) {
    const err = await res.json();
    if (err?.error?.code === 190) {
      // Token expired — clear it
      await supabase.from('profiles').update({ instagram_access_token: null }).eq('id', user.id);
      return NextResponse.json({ connected: false, expired: true, media: [] });
    }
    return NextResponse.json({ error: 'Instagram API error', media: [] }, { status: 500 });
  }

  const data = await res.json() as { data: IgMedia[] };
  const media = (data.data || []).filter(m => m.media_type !== 'VIDEO' || m.thumbnail_url);

  return NextResponse.json({ connected: true, media });
}

// POST /api/instagram — save access token
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { access_token } = await req.json();
  if (!access_token) return NextResponse.json({ error: 'access_token required' }, { status: 400 });

  // Verify token is valid before saving
  const verify = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${access_token}`);
  if (!verify.ok) return NextResponse.json({ error: 'Invalid access token' }, { status: 400 });

  const igUser = await verify.json() as { id: string; username: string };

  const { error } = await supabase
    .from('profiles')
    .update({
      instagram_access_token: access_token,
      instagram_username: igUser.username,
    })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, username: igUser.username });
}

// DELETE /api/instagram — disconnect
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await supabase.from('profiles').update({ instagram_access_token: null, instagram_username: null }).eq('id', user.id);
  return NextResponse.json({ ok: true });
}
