import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get('placeId');
  if (!placeId) return NextResponse.json({ error: 'placeId required' }, { status: 400 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,rating,user_ratings_total,reviews&language=ja&key=${apiKey}`
  );

  if (!res.ok) return NextResponse.json({ error: 'Places API error' }, { status: 500 });

  const data = await res.json() as {
    result?: {
      name?: string;
      rating?: number;
      user_ratings_total?: number;
      reviews?: Array<{ author_name: string; rating: number; text: string; relative_time_description: string; profile_photo_url?: string }>;
    };
    status: string;
  };

  if (data.status !== 'OK') {
    return NextResponse.json({ error: `Places API: ${data.status}` }, { status: 400 });
  }

  return NextResponse.json({
    name: data.result?.name,
    rating: data.result?.rating,
    totalRatings: data.result?.user_ratings_total,
    reviews: (data.result?.reviews || []).slice(0, 5),
  });
}
