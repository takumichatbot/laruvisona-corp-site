import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 公開ショップブロックが商品を取得する。公開・キャッシュ無効。
export const dynamic = 'force-dynamic';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface Variant { id: string; name: string; priceDelta: number; stock: number | null }
interface Product {
  id: string; name: string; description: string; price: number;
  images: string[]; stock: number | null; active: boolean; category: string;
  variantLabel?: string; variants?: Variant[];
}

export async function GET(req: Request) {
  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'missing siteId' }, { status: 400 });

  const supabase = admin();
  const { data: site } = await supabase
    .from('sites')
    .select('settings_json')
    .eq('id', siteId)
    .eq('published', true)
    .single();
  if (!site) return NextResponse.json({ products: [] });

  const all = (((site.settings_json as Record<string, unknown>) || {}).products as Product[]) || [];
  const products = all
    .filter(p => p.active)
    .map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      price: p.price,
      images: p.images || [],
      stock: p.stock ?? null,
      category: p.category || 'その他',
      variantLabel: p.variantLabel || '',
      variants: (p.variants || []).map(v => ({ id: v.id, name: v.name, priceDelta: v.priceDelta || 0, stock: v.stock ?? null })),
    }));

  return NextResponse.json({ products });
}
