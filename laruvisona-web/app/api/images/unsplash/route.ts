import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || 'business';
  const page = searchParams.get('page') || '1';

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    // Fallback: return curated placeholder photos by topic
    const fallback = [
      'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80',
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80',
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80',
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80',
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80',
      'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=800&q=80',
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',
      'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80',
    ].map((url, i) => ({ id: String(i), url, thumb: url.replace('w=800', 'w=400'), alt: `Photo ${i + 1}`, credit: 'Unsplash' }));
    return NextResponse.json({ photos: fallback });
  }

  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20&page=${page}&orientation=landscape`,
    { headers: { Authorization: `Client-ID ${accessKey}` }, next: { revalidate: 300 } },
  );
  if (!res.ok) return NextResponse.json({ error: 'Unsplash API error' }, { status: 502 });
  const data = await res.json();

  const photos = (data.results || []).map((p: { id: string; urls: { regular: string; thumb: string }; alt_description: string; user: { name: string } }) => ({
    id: p.id,
    url: p.urls.regular,
    thumb: p.urls.thumb,
    alt: p.alt_description || query,
    credit: p.user.name,
  }));

  return NextResponse.json({ photos });
}
