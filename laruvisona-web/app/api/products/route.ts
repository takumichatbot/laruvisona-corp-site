import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  stock: number | null;
  active: boolean;
  category: string;
  createdAt: string;
}

async function getProducts(siteId: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<Product[]> {
  const { data } = await supabase.from('sites').select('settings_json').eq('id', siteId).single();
  const settings = (data?.settings_json as Record<string, unknown>) || {};
  return (settings.products as Product[]) || [];
}

async function saveProducts(siteId: string, products: Product[], supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: current } = await supabase.from('sites').select('settings_json').eq('id', siteId).single();
  const merged = { ...(current?.settings_json as Record<string, unknown> || {}), products };
  await supabase.from('sites').update({ settings_json: merged }).eq('id', siteId);
}

// GET /api/products?siteId=xxx
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const products = await getProducts(siteId, supabase);
  return NextResponse.json({ products });
}

// POST /api/products — create product
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId, name, description, price, images, stock, category } = await req.json() as {
    siteId: string; name: string; description: string; price: number;
    images?: string[]; stock?: number | null; category?: string;
  };

  if (!siteId || !name || price == null) return NextResponse.json({ error: 'siteId, name, price required' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const products = await getProducts(siteId, supabase);
  const newProduct: Product = {
    id: Date.now().toString(),
    name,
    description: description || '',
    price,
    images: images || [],
    stock: stock ?? null,
    active: true,
    category: category || 'その他',
    createdAt: new Date().toISOString(),
  };
  products.push(newProduct);
  await saveProducts(siteId, products, supabase);
  return NextResponse.json({ product: newProduct });
}

// PATCH /api/products?productId=xxx&siteId=xxx
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId');
  const siteId = searchParams.get('siteId');
  if (!productId || !siteId) return NextResponse.json({ error: 'productId and siteId required' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updates = await req.json() as Partial<Product>;
  const products = await getProducts(siteId, supabase);
  const idx = products.findIndex(p => p.id === productId);
  if (idx === -1) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  products[idx] = { ...products[idx], ...updates, id: productId };
  await saveProducts(siteId, products, supabase);
  return NextResponse.json({ product: products[idx] });
}

// DELETE /api/products?productId=xxx&siteId=xxx
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId');
  const siteId = searchParams.get('siteId');
  if (!productId || !siteId) return NextResponse.json({ error: 'productId and siteId required' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const products = await getProducts(siteId, supabase);
  const filtered = products.filter(p => p.id !== productId);
  await saveProducts(siteId, filtered, supabase);
  return NextResponse.json({ ok: true });
}
