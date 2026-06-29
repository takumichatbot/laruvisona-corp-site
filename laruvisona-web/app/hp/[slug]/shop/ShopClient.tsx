'use client';
import { useState, useEffect, useCallback } from 'react';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  stock: number | null;
  active: boolean;
  category: string;
}

const categoryEmoji: Record<string, string> = {
  'サービス': '⚙️',
  'コース・講座': '📚',
  'チケット': '🎟️',
  'デジタルコンテンツ': '💾',
  'その他': '📦',
};

export default function ShopClient({ products, siteId, shopUrl }: { products: Product[]; siteId: string; shopUrl: string }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const storeKey = `laru_cart_${siteId}`;

  useEffect(() => {
    try { const s = localStorage.getItem(storeKey); if (s) setCart(JSON.parse(s)); } catch {}
  }, [storeKey]);

  const persist = useCallback((next: Record<string, number>) => {
    setCart(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch {}
  }, [storeKey]);

  const stockOf = (p: Product) => (p.stock === null ? Infinity : p.stock);

  const add = (p: Product) => {
    const cur = cart[p.id] || 0;
    if (cur + 1 > stockOf(p)) return;
    persist({ ...cart, [p.id]: cur + 1 });
    setOpen(true);
  };
  const setQty = (p: Product, q: number) => {
    const clamped = Math.max(0, Math.min(q, stockOf(p)));
    const next = { ...cart };
    if (clamped <= 0) delete next[p.id]; else next[p.id] = clamped;
    persist(next);
  };

  const items = Object.entries(cart)
    .map(([id, q]) => ({ product: products.find(p => p.id === id), q }))
    .filter((x): x is { product: Product; q: number } => !!x.product && x.q > 0);
  const totalQty = items.reduce((s, x) => s + x.q, 0);
  const totalPrice = items.reduce((s, x) => s + x.product.price * x.q, 0);

  const checkout = async () => {
    if (!items.length) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          items: items.map(x => ({ productId: x.product.id, quantity: x.q })),
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
      {/* Product grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {products.map(product => {
          const inCart = cart[product.id] || 0;
          const soldOut = product.stock !== null && product.stock <= 0;
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: '#0369a1' }}>¥{product.price.toLocaleString()}</span>
                  {product.stock !== null && <span style={{ fontSize: 12, color: product.stock <= 5 ? '#dc2626' : '#64748b', fontWeight: 600 }}>残り{product.stock}件</span>}
                </div>
                {soldOut ? (
                  <button disabled style={{ width: '100%', background: '#e2e8f0', color: '#94a3b8', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14 }}>売り切れ</button>
                ) : inCart > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                    <button onClick={() => setQty(product, inCart - 1)} style={qtyBtn}>−</button>
                    <span style={{ fontWeight: 800, fontSize: 18, minWidth: 24, textAlign: 'center' }}>{inCart}</span>
                    <button onClick={() => setQty(product, inCart + 1)} disabled={inCart >= stockOf(product)} style={qtyBtn}>＋</button>
                  </div>
                ) : (
                  <button onClick={() => add(product)} style={{ width: '100%', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>カートに追加</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart bar */}
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
                <div key={x.product.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                  <span style={{ flex: 1, fontSize: 14, color: '#334155' }}>{x.product.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => setQty(x.product, x.q - 1)} style={qtyBtnSm}>−</button>
                    <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{x.q}</span>
                    <button onClick={() => setQty(x.product, x.q + 1)} disabled={x.q >= stockOf(x.product)} style={qtyBtnSm}>＋</button>
                  </div>
                  <span style={{ minWidth: 90, textAlign: 'right', fontWeight: 700, color: '#0369a1' }}>¥{(x.product.price * x.q).toLocaleString()}</span>
                  <button onClick={() => setQty(x.product, 0)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 16 }}>✕</button>
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
