export interface ShopCartItem {
  id: string;
  v?: string;
  q: number;
}

export interface ShopOrderItem {
  name: string;
  variant: null;
  quantity: number;
  /** 1個あたり。割引が入ると割り切れないので、見せる用の丸めた値 */
  unit: number;
  /** その明細で実際に決済された額。照合はこちらを使う */
  lineTotal: number;
}

const ITEM_ID = /^[a-zA-Z0-9_-]{1,80}$/;

export function normalizeShopCart(value: unknown): ShopCartItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new Error('商品は1回に20種類まで購入できます');
  }
  const merged = new Map<string, ShopCartItem>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('商品を確認してください');
    const item = raw as Record<string, unknown>;
    const id = typeof item.productId === 'string' ? item.productId : typeof item.id === 'string' ? item.id : '';
    const variant = typeof item.variantId === 'string' ? item.variantId : typeof item.v === 'string' ? item.v : undefined;
    const quantity = Number(item.quantity ?? item.q);
    if (!ITEM_ID.test(id) || (variant !== undefined && !ITEM_ID.test(variant))) throw new Error('商品を確認してください');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('数量は1〜99で指定してください');
    const key = `${id}\u0000${variant || ''}`;
    const current = merged.get(key);
    const total = (current?.q || 0) + quantity;
    if (total > 99) throw new Error('同じ商品の数量は合計99までです');
    merged.set(key, { id, ...(variant ? { v: variant } : {}), q: total });
  }
  return [...merged.values()];
}

export function cartMetadata(cart: ShopCartItem[]): Record<string, string> {
  const encoded = JSON.stringify(cart);
  const chunks = encoded.match(/[\s\S]{1,450}/g) || [];
  if (!chunks.length || chunks.length > 10) throw new Error('カートの内容が大きすぎます');
  return Object.fromEntries([
    ['laru_cart_parts', String(chunks.length)],
    ...chunks.map((chunk, index) => [`laru_cart_${index}`, chunk]),
  ]);
}

export function cartFromMetadata(metadata: Record<string, string>): ShopCartItem[] {
  let encoded = metadata.laru_cart || '';
  if (metadata.laru_cart_parts) {
    const parts = Number(metadata.laru_cart_parts);
    if (!Number.isInteger(parts) || parts < 1 || parts > 10) throw new Error('カート情報を確認できません');
    encoded = Array.from({ length: parts }, (_, index) => metadata[`laru_cart_${index}`] || '').join('');
  }
  if (!encoded && metadata.laru_product_id) encoded = JSON.stringify([{ id: metadata.laru_product_id, q: 1 }]);
  let parsed: unknown;
  try { parsed = JSON.parse(encoded); } catch { throw new Error('カート情報を確認できません'); }
  return normalizeShopCart(parsed);
}

export function snapshotStripeItems(
  cart: ShopCartItem[],
  lines: Array<{ description?: string | null; quantity?: number | null; amount_total?: number | null }>,
): ShopOrderItem[] {
  if (lines.length !== cart.length) throw new Error('決済明細とカートが一致しません');
  return lines.map((line, index) => {
    const quantity = Number(line.quantity);
    const total = Number(line.amount_total);
    if (!Number.isInteger(quantity) || quantity !== cart[index].q || quantity < 1) throw new Error('決済数量を確認できません');
    /*
      割り切れることを求めてはいけない。

      決済画面はクーポンの入力を受け付けている
      （app/api/shop/checkout/route.ts の allow_promotion_codes: true）。
      2個以上の商品に割引が入ると、その明細の合計は数量で割り切れない。
      例: 1,000円×3個に500円オフ → 2,500円。2,500 ÷ 3 は割り切れない。

      以前はここで例外を投げていた。投げると commitShopCheckout ごと失敗し、

        ・お客様には決済完了の画面が出て、**カードには請求される**
        ・hp_orders に注文が**1件も作られない**
        ・お店への通知も飛ばず、在庫も減らない
        ・Stripeの再送は毎回同じ理由で失敗し続ける

      お店には「無い注文」として何も現れない。お客様は届くのを待つ。

      1個あたりの値段は、見せるための丸めた値にする。
      お金の照合には、実際に決済された明細の合計（lineTotal）を使う。
    */
    if (!Number.isInteger(total) || total < 0) throw new Error('決済金額を確認できません');
    const name = (line.description || '').trim().slice(0, 200);
    if (!name) throw new Error('決済商品を確認できません');
    return { name, variant: null, quantity, unit: Math.round(total / quantity), lineTotal: total };
  });
}
