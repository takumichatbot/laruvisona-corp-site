'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface OrderItem { name: string; variant: string | null; quantity: number; unit: number }
interface Shipping { name?: string; phone?: string; postal_code?: string; state?: string; city?: string; line1?: string; line2?: string; country?: string }
interface Order {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  amount: number;
  items: OrderItem[];
  shipping: Shipping | null;
  status: 'paid' | 'shipped' | 'completed' | 'canceled';
  note: string | null;
  created_at: string;
}
interface Site { id: string; name: string }

const STATUS: Record<Order['status'], { label: string; cls: string }> = {
  paid: { label: '入金済', cls: 'bg-blue-100 text-blue-700' },
  shipped: { label: '発送済', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: '完了', cls: 'bg-green-100 text-green-700' },
  canceled: { label: 'キャンセル', cls: 'bg-gray-100 text-gray-500' },
};

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function OrdersPage() {
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/laruHP/auth/login?redirectTo=/laruHP/orders'; return; }
      const { data } = await supabase.from('sites').select('id, name').eq('user_id', user.id);
      setSites(data ?? []);
      if (data && data.length > 0) setSiteId(prev => prev || data[0].id);
    } catch (e) {
      setErr((e as Error)?.message || '読み込みに失敗しました');
    } finally {
      setLoaded(true);
    }
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!siteId) return;
    supabase.from('hp_orders').select('*').eq('site_id', siteId).order('created_at', { ascending: false })
      .then(({ data, error }) => { if (error) setErr(error.message); else setOrders((data as Order[]) ?? []); });
  }, [siteId, supabase]);

  const updateStatus = async (id: string, status: Order['status']) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    const { error } = await supabase.from('hp_orders').update({ status }).eq('id', id);
    if (error) setErr(error.message);
  };

  const addr = (s: Shipping) => [s.postal_code && `〒${s.postal_code}`, s.state, s.city, s.line1, s.line2].filter(Boolean).join(' ');

  if (!loaded) return <div className="min-h-screen bg-sky-50 flex items-center justify-center"><div className="text-gray-500 text-sm">読み込み中...</div></div>;

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-lg mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/laruHP/dashboard" className="text-gray-500 hover:text-gray-800 text-sm">← ダッシュボード</Link>
          <h1 className="font-bold">注文管理</h1>
          {sites.length > 1 && (
            <select value={siteId} onChange={e => setSiteId(e.target.value)} className="ml-auto bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
      </header>

      <main className="max-w-screen-lg mx-auto px-4 py-6">
        {err && <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{err}</p>}
        {orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">📦</div>
            <p className="text-gray-500 text-sm font-semibold">まだ注文はありません</p>
            <p className="text-gray-400 text-xs mt-1">ショップで購入が入るとここに表示されます</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => (
              <div key={o.id} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS[o.status].cls}`}>{STATUS[o.status].label}</span>
                  <span className="text-gray-400 text-xs">{fmt(o.created_at)}</span>
                  <span className="ml-auto text-lg font-extrabold text-sky-700">¥{o.amount.toLocaleString()}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase mb-1">商品</p>
                    <ul className="text-sm text-gray-700 space-y-0.5">
                      {(o.items || []).map((it, i) => (
                        <li key={i}>{it.name}{it.variant ? `（${it.variant}）` : ''} × {it.quantity} <span className="text-gray-400">¥{(it.unit * it.quantity).toLocaleString()}</span></li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase mb-1">購入者</p>
                    <p className="text-sm text-gray-700">{o.customer_name || '—'}</p>
                    {o.customer_email && <p className="text-xs text-gray-500">{o.customer_email}</p>}
                    {o.customer_phone && <p className="text-xs text-gray-500">{o.customer_phone}</p>}
                    {o.shipping && addr(o.shipping) && (
                      <p className="text-xs text-gray-600 mt-1">📦 {o.shipping.name} {addr(o.shipping)}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
                  <span className="text-xs text-gray-400">ステータス変更:</span>
                  <select value={o.status} onChange={e => updateStatus(o.id, e.target.value as Order['status'])}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                    {(Object.keys(STATUS) as Order['status'][]).map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
