import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type Stripe from 'stripe';
import { clientIp } from '@/lib/rate-limit';
import { claimPublicRate } from '@/lib/public-rate-limit';
import { safeReturnUrl } from '@/lib/site-origin';
import { cartMetadata, normalizeShopCart } from '@/lib/shop-order';
import { readContactBody } from '@/lib/contact-contract';
import { validOrderId } from '@/lib/order-contract';
import { getStripe } from '@/lib/stripe';
import { stripeConnectAvailable } from '@/lib/scheduling/payments';

// POST /api/shop/checkout — カート（複数商品・数量）対応の Stripe Checkout
// 公開エンドポイント（公開ショップから購入）。単品(productId)も後方互換で受け付ける。
interface VariantRow { id: string; name: string; priceDelta: number; stock?: number | null }
interface ProductRow {
  id: string; name: string; description: string; price: number;
  images: string[]; active: boolean; stock?: number | null;
  variantLabel?: string; variants?: VariantRow[];
}

export async function POST(req: Request) {
  let body: {
    siteId?: string;
    productId?: string;
    items?: Array<{ productId: string; variantId?: string; quantity: number }>;
    successUrl?: string;
    cancelUrl?: string;
  };
  try {
    body = await readContactBody(req, 50_000) as typeof body;
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message === 'too_large' ? 'リクエストが大きすぎます' : 'リクエストを確認してください' },
      { status: (error as Error).message === 'too_large' ? 413 : 400 },
    );
  }
  const { siteId, productId, successUrl, cancelUrl } = body;

  if (!validOrderId(siteId)) return NextResponse.json({ error: 'サイトを確認してください' }, { status: 400 });

  // 決済セッションの大量生成でStripe側を荒らされないように
  const service = await createServiceClient();
  const rate = await claimPublicRate(service, 'shop-checkout', `${siteId}:${clientIp(req)}`, 20);
  if (rate === 'limited') {
    return NextResponse.json(
      { error: 'リクエストが多すぎます。しばらくしてからお試しください。' },
      { status: 429 },
    );
  }
  if (rate === 'unavailable') return NextResponse.json({ error: '購入受付を確認できません' }, { status: 503 });

  // 単品 → items 形式に正規化
  let reqItems;
  try {
    reqItems = normalizeShopCart((body.items && body.items.length > 0)
      ? body.items
      : (productId ? [{ productId, quantity: 1 }] : []));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  if (process.env.HP_SHOP_PAYMENTS_ENABLED !== '1' || !stripeConnectAvailable()) {
    return NextResponse.json({ error: 'オンライン決済は現在準備中です' }, { status: 503 });
  }
  const { data: site } = await service.from('sites').select('name, user_id, settings_json, slug, custom_domain').eq('id', siteId).eq('published', true).single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  const { data: merchant, error: merchantError } = await service.from('hp_payment_accounts')
    .select('account_id,livemode,charges_enabled,payouts_enabled')
    .eq('user_id', site.user_id).maybeSingle();
  const live = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') === true;
  if (merchantError || !merchant?.account_id || !merchant.charges_enabled || !merchant.payouts_enabled || merchant.livemode !== live) {
    return NextResponse.json({ error: 'このショップの入金先が準備できていません' }, { status: 503 });
  }

  const shopSettings = (site.settings_json as Record<string, unknown>) || {};
  const products = Array.isArray(shopSettings.products) ? shopSettings.products as ProductRow[] : [];
  const collectShipping = !!shopSettings.shopCollectShipping;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const cart: Array<{ id: string; v?: string; q: number }> = [];
  for (const it of reqItems) {
    const qty = it.q;
    const product = products.find(p => p.id === it.id && p.active);
    if (!product) return NextResponse.json({ error: '販売中でない商品が含まれています' }, { status: 404 });

    // バリエーションあり商品は選択必須
    let variant: VariantRow | undefined;
    if (product.variants?.length) {
      variant = product.variants.find(v => v.id === it.v);
      if (!variant) return NextResponse.json({ error: `「${product.name}」の${product.variantLabel || 'オプション'}を選択してください` }, { status: 400 });
    }

    const stock = variant ? variant.stock : product.stock;
    if (stock !== null && stock !== undefined && qty > stock) {
      const label = variant ? `${product.name}（${variant.name}）` : product.name;
      return NextResponse.json({ error: `「${label}」の在庫が不足しています（残り${stock}件）` }, { status: 409 });
    }

    const unitAmount = product.price + (variant?.priceDelta || 0);
    if (!Number.isSafeInteger(unitAmount) || unitAmount < 50 || unitAmount > 99_999_999) {
      return NextResponse.json({ error: '商品の価格を確認してください' }, { status: 409 });
    }
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

  const stripe = getStripe();
  try {
    const encodedCart = cartMetadata(cart);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      // 戻り先はクライアントの言い値をそのまま使わない。
      // そのサイトが正当に配信されているホストでなければ自サイトに落とす。
      success_url: `${safeReturnUrl(successUrl, req.headers.get('origin'), site)}?payment=success`,
      cancel_url: safeReturnUrl(cancelUrl, req.headers.get('origin'), site),
      locale: 'ja',
      allow_promotion_codes: true, // クーポン/プロモコード入力を許可（Stripeで作成したコード）
      phone_number_collection: { enabled: true },
      // 物販で配送先住所を集める設定の場合のみ収集（デジタル/サービスは不要）
      ...(collectShipping ? { shipping_address_collection: { allowed_countries: ['JP'] as const } } : {}),
      metadata: {
        kind: 'shop',
        laru_site_id: siteId,
        ...encodedCart,
        ...(cart.length === 1 ? { laru_product_id: cart[0].id } : {}),
      },
    }, { stripeAccount: merchant.account_id });
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error('[shop/checkout] stripe error:', (err as { message?: string })?.message);
    return NextResponse.json({ error: '決済の開始に失敗しました' }, { status: 500 });
  }
}
