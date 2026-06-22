'use client';
import { useState } from 'react';

interface Props {
  siteId: string;
  productId: string;
  successUrl: string;
  cancelUrl: string;
  label?: string;
  bgColor?: string;
  textColor?: string;
}

export default function ShopBuyButton({ siteId, productId, successUrl, cancelUrl, label = '購入する（Stripe決済）', bgColor = '#0369a1', textColor = '#fff' }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBuy = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, productId, successUrl, cancelUrl }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || '決済の開始に失敗しました');
        setLoading(false);
      }
    } catch {
      setError('ネットワークエラーが発生しました。もう一度お試しください。');
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleBuy}
        disabled={loading}
        style={{
          width: '100%',
          background: loading ? '#94a3b8' : bgColor,
          color: textColor,
          border: 'none',
          borderRadius: 12,
          padding: '14px',
          fontWeight: 700,
          fontSize: 14,
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'opacity 0.2s',
        }}
      >
        {loading ? '処理中...' : label}
      </button>
      {error && (
        <p style={{ color: '#dc2626', fontSize: 12, marginTop: 6, textAlign: 'center' }}>{error}</p>
      )}
    </div>
  );
}
