'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface PaymentLink {
  id: string;
  url: string;
  amount: number;
  description: string;
  buttonText: string;
  currency: string;
  createdAt: string;
}

interface Site {
  id: string;
  name: string;
}

export default function PaymentsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/laruHP/auth/login'); return; }

      const res = await fetch('/api/sites');
      const d = await res.json();
      const s: Site[] = (d.sites || []);
      setSites(s);
      if (s.length > 0) setSelectedSiteId(s[0].id);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSiteId) return;
    (async () => {
      const res = await fetch(`/api/stripe/payment-link?siteId=${selectedSiteId}`);
      const d = await res.json();
      setPaymentLinks(d.paymentLinks || []);
    })();
  }, [selectedSiteId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !selectedSiteId) return;
    setCreating(true);
    setMsg('');

    const res = await fetch('/api/stripe/payment-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: selectedSiteId,
        amount: parseInt(amount),
        description,
        buttonText: buttonText || undefined,
      }),
    });

    const d = await res.json();
    if (!res.ok) {
      setMsg(`エラー: ${d.error}`);
    } else {
      setMsg('決済リンクを作成しました');
      setAmount('');
      setDescription('');
      setButtonText('');
      // Reload
      const r2 = await fetch(`/api/stripe/payment-link?siteId=${selectedSiteId}`);
      const d2 = await r2.json();
      setPaymentLinks(d2.paymentLinks || []);
    }
    setCreating(false);
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm('この決済リンクを無効化しますか？')) return;
    await fetch(`/api/stripe/payment-link?siteId=${selectedSiteId}&linkId=${linkId}`, { method: 'DELETE' });
    setPaymentLinks(prev => prev.filter(l => l.id !== linkId));
  };

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 transition-colors';

  if (loading) return <div className="min-h-screen bg-sky-50 flex items-center justify-center"><div className="text-gray-500 text-sm">読み込み中...</div></div>;

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <header className="border-b border-sky-100 bg-white/90 backdrop-blur-xl shadow-sm px-6 py-4 flex items-center gap-4">
        <Link href="/laruHP/dashboard" className="text-gray-500 hover:text-gray-700 text-sm transition-colors">← ダッシュボード</Link>
        <h1 className="text-sm font-bold text-gray-900 mx-auto">決済リンク管理</h1>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Site picker */}
        {sites.length > 1 && (
          <select
            value={selectedSiteId}
            onChange={e => setSelectedSiteId(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-500"
          >
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        {/* Create form */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-sm text-gray-900 mb-1">新しい決済リンクを作成</h2>
          <p className="text-xs text-gray-500 mb-5">Stripe Payment Linkを生成してサイトに埋め込めます</p>

          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">商品・サービス名</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="例: カット料金、相談料、講座受講料"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">金額（円）</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="例: 3000"
                min="50"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ボタンテキスト（任意）</label>
              <input
                type="text"
                value={buttonText}
                onChange={e => setButtonText(e.target.value)}
                placeholder="例: 今すぐ購入する・料金を支払う"
                className={inputCls}
              />
            </div>

            {msg && (
              <p className={`text-xs font-semibold ${msg.startsWith('エラー') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>
            )}

            <button
              type="submit"
              disabled={creating || !amount || !description}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              {creating ? '作成中...' : '決済リンクを作成'}
            </button>
          </form>
        </section>

        {/* List */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-sm text-gray-900 mb-4">作成済み決済リンク ({paymentLinks.length}件)</h2>

          {paymentLinks.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-3">💳</div>
              <p className="text-sm text-gray-500">まだ決済リンクがありません</p>
              <p className="text-xs text-gray-400 mt-1">上のフォームから最初のリンクを作成してください</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentLinks.map(link => (
                <div key={link.id} className="border border-gray-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0 text-sky-700 text-sm font-bold">
                    ¥
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900">{link.description}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {link.amount.toLocaleString()}円 · {new Date(link.createdAt).toLocaleDateString('ja-JP')}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        readOnly
                        value={link.url}
                        className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[10px] text-gray-600 font-mono focus:outline-none select-all"
                        onClick={e => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        onClick={() => navigator.clipboard.writeText(link.url)}
                        className="flex-shrink-0 text-[10px] bg-sky-50 border border-sky-200 text-sky-700 px-2 py-1 rounded-lg hover:bg-sky-100 transition-all font-bold"
                      >
                        コピー
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1.5">ボタン: {link.buttonText}</div>
                  </div>
                  <button
                    onClick={() => handleDelete(link.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    title="無効化"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Usage guide */}
        <section className="bg-sky-50 border border-sky-200 rounded-2xl p-5">
          <h3 className="font-bold text-sm text-sky-900 mb-2">使い方</h3>
          <ol className="space-y-1.5 text-xs text-sky-800">
            <li>1. 上で決済リンクを作成する</li>
            <li>2. URLをコピーしてビルダーの「ボタン」ブロックに貼り付ける</li>
            <li>3. お客様がクリックするとStripe決済ページが開く</li>
            <li>4. 入金はStripeダッシュボードで確認できます</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
