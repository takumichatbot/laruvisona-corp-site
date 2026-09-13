import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseNewProduct, readStoredProducts, validProductId, type StoredProduct } from '@/lib/product-contract';
import { validOrderId } from '@/lib/order-contract';
import { readContactBody } from '@/lib/contact-contract';

const databaseError = () => NextResponse.json(
  { error: '商品情報を保存できませんでした', code: 'database_error' },
  { status: 503 },
);

type Client = Awaited<ReturnType<typeof createClient>>;

async function ownedSite(supabase: Client, siteId: string, userId: string) {
  return supabase.from('sites').select('id,settings_json,updated_at').eq('id', siteId).eq('user_id', userId).maybeSingle();
}

async function changeProducts(
  supabase: Client,
  siteId: string,
  userId: string,
  change: (products: StoredProduct[]) => StoredProduct[] | null,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await ownedSite(supabase, siteId, userId);
    if (current.error) return databaseError();
    if (!current.data) return NextResponse.json({ error: 'サイトが見つかりません' }, { status: 404 });
    let products: StoredProduct[];
    try { products = readStoredProducts((current.data.settings_json as Record<string, unknown> | null)?.products); }
    catch { return databaseError(); }
    const next = change(products);
    if (!next) return NextResponse.json({ error: '商品が見つかりません' }, { status: 404 });
    const settings = { ...((current.data.settings_json as Record<string, unknown>) || {}), products: next };
    const saved = await supabase
      .from('sites')
      .update({ settings_json: settings })
      .eq('id', siteId)
      .eq('user_id', userId)
      .eq('updated_at', current.data.updated_at)
      .select('id')
      .maybeSingle();
    if (saved.error) return databaseError();
    if (saved.data) return NextResponse.json({ products: next });
  }
  return NextResponse.json({ error: '別の画面で商品が変更されています。読み直してください' }, { status: 409 });
}

async function authenticated() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(req: Request) {
  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!validOrderId(siteId)) return NextResponse.json({ error: 'サイトを確認してください' }, { status: 400 });
  const current = await ownedSite(supabase, siteId, user.id);
  if (current.error) return databaseError();
  if (!current.data) return NextResponse.json({ error: 'サイトが見つかりません' }, { status: 404 });
  try {
    const settings = (current.data.settings_json as Record<string, unknown>) || {};
    return NextResponse.json({ products: readStoredProducts(settings.products), collectShipping: settings.shopCollectShipping === true });
  } catch { return databaseError(); }
}

export async function POST(req: Request) {
  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let input: Record<string, unknown>;
  let product: StoredProduct;
  try {
    input = await readContactBody(req);
    if (!validOrderId(input.siteId)) throw new Error('サイトを確認してください');
    product = { id: crypto.randomUUID(), ...parseNewProduct(input), createdAt: new Date().toISOString() };
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  const response = await changeProducts(supabase, input.siteId as string, user.id, products => {
    if (products.length >= 500) throw new Error('商品は500件までです');
    return [product, ...products];
  }).catch(error => NextResponse.json({ error: (error as Error).message }, { status: 400 }));
  if (!response.ok) return response;
  return NextResponse.json({ product });
}

export async function PATCH(req: Request) {
  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const siteId = url.searchParams.get('siteId');
  const productId = url.searchParams.get('productId');
  let active: boolean;
  try {
    const body = await readContactBody(req, 10_000);
    if (!validOrderId(siteId) || !validProductId(productId) || typeof body.active !== 'boolean') throw new Error('商品を確認してください');
    active = body.active;
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  const response = await changeProducts(supabase, siteId, user.id, products => {
    const index = products.findIndex(product => product.id === productId);
    if (index < 0) return null;
    const next = [...products];
    next[index] = { ...next[index], active };
    return next;
  });
  if (!response.ok) return response;
  return NextResponse.json({ product: { id: productId, active } });
}

export async function DELETE(req: Request) {
  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const siteId = url.searchParams.get('siteId');
  const productId = url.searchParams.get('productId');
  if (!validOrderId(siteId) || !validProductId(productId)) return NextResponse.json({ error: '商品を確認してください' }, { status: 400 });
  const response = await changeProducts(supabase, siteId, user.id, products => {
    const next = products.filter(product => product.id !== productId);
    return next.length === products.length ? null : next;
  });
  if (!response.ok) return response;
  return NextResponse.json({ ok: true });
}
