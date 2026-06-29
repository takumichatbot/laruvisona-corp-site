import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

// POST /api/shop/checkout — カート（複数商品・数量）対応の Stripe Checkout
// 公開エンドポイント（公開ショップから購入）。単品(productId)も後方互換で受け付ける。
interface VariantRow { id: string; name: string; priceDelta: number; stock?: number | null }
interface ProductRow {
  id: string; name: string; description: string; price: number;
  images: string[]; active: boolean; stock?: number | null;
  variantLabel?: string; variants?: VariantRow[];
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    siteId?: string;
    productId?: string;
    items?: Array<{ productId: string; variantId?: string; quantity: number }>;
    successUrl?: string;
    cancelUrl?: string;
  };
  const { siteId, productId, successUrl, cancelUrl } = body;

  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  // 単品 → items 形式に正規化
  const reqItems = (body.items && body.items.length > 0)
    ? body.items
    : (productId ? [{ productId, quantity: 1 }] : []);
  if (reqItems.length === 0) return NextResponse.json({ error: '商品が指定されていません' }, { status: 400 });

  const service = await createServiceClient();
  const { data: site } = await service.from('sites').select('name, settings_json').eq('id', siteId).single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const products = (((site.settings_json as Record<string, unknown>) || {}).products as ProductRow[]) || [];

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const cart: Array<{ id: string; v?: string; q: number }> = [];
  for (const it of reqItems) {
    const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
    const product = products.find(p => p.id === it.productId && p.active);
    if (!product) return NextResponse.json({ error: '販売中でない商品が含まれています' }, { status: 404 });

    // バリエーションあり商品は選択必須
    let variant: VariantRow | undefined;
    if (product.variants?.length) {
      variant = product.variants.find(v => v.id === it.variantId);
      if (!variant) return NextResponse.json({ error: `「${product.name}」の${product.variantLabel || 'オプション'}を選択してください` }, { status: 400 });
    }

    const stock = variant ? variant.stock : product.stock;
    if (stock !== null && stock !== undefined && qty > stock) {
      const label = variant ? `${product.name}（${variant.name}）` : product.name;
      return NextResponse.json({ error: `「${label}」の在庫が不足しています（残り${stock}件）` }, { status: 409 });
    }

    const unitAmount = product.price + (variant?.priceDelta || 0);
    const displayName = variant ? `${product.name}（${variant.name}）` : product.name;
    lineItems.push({
      price_data: {
        currency: 'jpy',
        product_data: {
          name: displayName,
          ...(product.description ? { description: product.description } : {}),
          ...(product.images?.length ? { images: product.images.slice(0, 8) } : {}),
        },
        unit_amount: unitAmount,
      },
      quantity: qty,
    });
    cart.push({ id: product.id, ...(variant ? { v: variant.id } : {}), q: qty });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  try {
    const cartJson = JSON.stringify(cart);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/?payment=success`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/`,
      locale: 'ja',
      metadata: {
        kind: 'shop',
        laru_site_id: siteId,
        // 在庫減算用。Stripeのmetadata上限(500字)を超える場合は省略
        ...(cartJson.length <= 480 ? { laru_cart: cartJson } : {}),
        ...(cart.length === 1 ? { laru_product_id: cart[0].id } : {}),
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error('[shop/checkout] stripe error:', (err as { message?: string })?.message);
    return NextResponse.json({ error: '決済の開始に失敗しました' }, { status: 500 });
  }
}
