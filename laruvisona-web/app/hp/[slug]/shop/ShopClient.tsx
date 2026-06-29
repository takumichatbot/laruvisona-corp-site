'use client';
import { useState, useEffect, useCallback } from 'react';

export interface Variant {
  id: string;
  name: string;
  priceDelta: number;
  stock: number | null;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  stock: number | null;
  active: boolean;
  category: string;
  variantLabel?: string;
  variants?: Variant[];
}

const categoryEmoji: Record<string, string> = {
  'サービス': '⚙️',
  'コース・講座': '📚',
  'チケット': '🎟️',
  'デジタルコンテンツ': '💾',
  'その他': '📦',
};

const keyOf = (pid: string, vid?: string) => (vid ? `${pid}::${vid}` : pid);
const parseKey = (k: string) => { const [pid, vid] = k.split('::'); return { pid, vid }; };

export default function ShopClient({ products, siteId, shopUrl }: { products: Product[]; siteId: string; shopUrl: string }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [chosen, setChosen] = useState<Record<string, string>>({}); // productId -> variantId
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const storeKey = `laru_cart_${siteId}`;

  useEffect(() => {
    try { const s = localStorage.getItem(storeKey); if (s) setCart(JSON.parse(s)); } catch {}
    // バリエーション初期選択（各商品の先頭）
    const init: Record<string, string> = {};
    products.forEach(p => { if (p.variants?.length) init[p.id] = p.variants[0].id; });
    setChosen(init);
  }, [storeKey, products]);

  const persist = useCallback((next: Record<string, number>) => {
    setCart(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch {}
  }, [storeKey]);

  const variantOf = (p: Product, vid?: string) => p.variants?.find(v => v.id === vid);
  const priceOf = (p: Product, v?: Variant) => p.price + (v?.priceDelta || 0);
  const stockOf = (p: Product, v?: Variant) => {
    const s = v ? v.stock : p.stock;
    return s === null || s === undefined ? Infinity : s;
  };

  const add = (p: Product) => {
    const vid = p.variants?.length ? chosen[p.id] : undefined;
    const v = variantOf(p, vid);
    const k = keyOf(p.id, vid);
    const cur = cart[k] || 0;
    if (cur + 1 > stockOf(p, v)) return;
    persist({ ...cart, [k]: cur + 1 });
    setOpen(true);
  };
  const setQtyKey = (k: string, q: number, max: number) => {
    const clamped = Math.max(0, Math.min(q, max));
    const next = { ...cart };
    if (clamped <= 0) delete next[k]; else next[k] = clamped;
    persist(next);
  };

  const items = Object.entries(cart)
    .map(([k, q]) => {
      const { pid, vid } = parseKey(k);
      const product = products.find(p => p.id === pid);
      if (!product) return null;
      const v = variantOf(product, vid);
      return { k, product, variant: v, q, unit: priceOf(product, v), max: stockOf(product, v) };
    })
    .filter((x): x is { k: string; product: Product; variant: Variant | undefined; q: number; unit: number; max: number } => !!x);
  const totalQty = items.reduce((s, x) => s + x.q, 0);
  const totalPrice = items.reduce((s, x) => s + x.unit * x.q, 0);

  const checkout = async () => {
    if (!items.length) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          items: items.map(x => ({ productId: x.product.id, variantId: x.variant?.id, quantity: x.q })),
          successUrl: `${shopUrl}?payment=success`,
          cancelUrl: shopUrl,
        }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) { try { localStorage.removeItem(storeKey); } catch {} window.location.href = data.url; }
      else { setError(data.error || '決済の開始に失敗しました'); setLoading(false); }
    } catch { setError('ネットワークエラーが発生しました'); setLoading(false); }
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {products.map(product => {
          const hasVariants = !!product.variants?.length;
          const vid = hasVariants ? chosen[product.id] : undefined;
          const v = variantOf(product, vid);
          const price = priceOf(product, v);
          const stock = stockOf(product, v);
          const inCart = cart[keyOf(product.id, vid)] || 0;
          const soldOut = stock <= 0;
          return (
            <div key={product.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)', height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, overflow: 'hidden' }}>
                {product.images?.[0]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={product.images[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (categoryEmoji[product.category] ?? '📦')}
              </div>
              <div style={{ padding: '20px 20px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 11, background: '#f0f9ff', color: '#0369a1', padding: '3px 10px', borderRadius: 100, fontWeight: 700, border: '1px solid #bae6fd', display: 'inline-block', marginBottom: 10, alignSelf: 'flex-start' }}>{product.category}</span>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 8px', lineHeight: 1.4 }}>{product.name}</h2>
                {product.description && <p style={{ fontSize: 13, color: '#475569', margin: '0 0 16px', lineHeight: 1.6, flex: 1 }}>{product.description}</p>}

                {hasVariants && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', margin: '0 0 6px' }}>{product.variantLabel}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {product.variants!.map(opt => {
                        const optSoldOut = (opt.stock !== null && opt.stock !== undefined && opt.stock <= 0);
                        const sel = vid === opt.id;
                        return (
                          <button key={opt.id} disabled={optSoldOut}
                            onClick={() => setChosen(c => ({ ...c, [product.id]: opt.id }))}
                            style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: optSoldOut ? 'not-allowed' : 'pointer',
                              border: sel ? '2px solid #0369a1' : '1px solid #cbd5e1', background: optSoldOut ? '#f1f5f9' : sel ? '#eff6ff' : '#fff',
                              color: optSoldOut ? '#cbd5e1' : sel ? '#0369a1' : '#334155', textDecoration: optSoldOut ? 'line-through' : 'none' }}>
                            {opt.name}{opt.priceDelta ? `（${opt.priceDelta > 0 ? '+' : ''}¥${opt.priceDelta.toLocaleString()}）` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: '#0369a1' }}>¥{price.toLocaleString()}</span>
                  {stock !== Infinity && <span style={{ fontSize: 12, color: stock <= 5 ? '#dc2626' : '#64748b', fontWeight: 600 }}>残り{stock}件</span>}
                </div>

                {soldOut ? (
                  <button disabled style={{ width: '100%', background: '#e2e8f0', color: '#94a3b8', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14 }}>売り切れ</button>
                ) : inCart > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                    <button onClick={() => setQtyKey(keyOf(product.id, vid), inCart - 1, stock)} style={qtyBtn}>−</button>
                    <span style={{ fontWeight: 800, fontSize: 18, minWidth: 24, textAlign: 'center' }}>{inCart}</span>
                    <button onClick={() => setQtyKey(keyOf(product.id, vid), inCart + 1, stock)} disabled={inCart >= stock} style={qtyBtn}>＋</button>
                  </div>
                ) : (
                  <button onClick={() => add(product)} style={{ width: '100%', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>カートに追加</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalQty > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #e2e8f0', boxShadow: '0 -2px 12px rgba(0,0,0,0.08)', padding: '12px 24px', zIndex: 20 }}>
          <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
              🛒 カート（{totalQty}点）{open ? ' ▼' : ' ▲'}
            </button>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#0369a1', marginLeft: 'auto' }}>¥{totalPrice.toLocaleString()}</span>
            <button onClick={checkout} disabled={loading} style={{ background: loading ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? '処理中...' : 'レジに進む（Stripe決済）'}
            </button>
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: 12, textAlign: 'center', margin: '8px 0 0' }}>{error}</p>}
          {open && (
            <div style={{ maxWidth: 960, margin: '12px auto 0', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
              {items.map(x => (
                <div key={x.k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                  <span style={{ flex: 1, fontSize: 14, color: '#334155' }}>{x.product.name}{x.variant ? `（${x.variant.name}）` : ''}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => setQtyKey(x.k, x.q - 1, x.max)} style={qtyBtnSm}>−</button>
                    <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{x.q}</span>
                    <button onClick={() => setQtyKey(x.k, x.q + 1, x.max)} disabled={x.q >= x.max} style={qtyBtnSm}>＋</button>
                  </div>
                  <span style={{ minWidth: 90, textAlign: 'right', fontWeight: 700, color: '#0369a1' }}>¥{(x.unit * x.q).toLocaleString()}</span>
                  <button onClick={() => setQtyKey(x.k, 0, x.max)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

const qtyBtn: React.CSSProperties = { width: 40, height: 40, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: '#0f172a' };
const qtyBtnSm: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', color: '#0f172a' };
