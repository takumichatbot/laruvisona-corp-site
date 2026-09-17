'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Package } from 'lucide-react';
import { nextOrderStatuses, type OrderStatus } from '@/lib/order-contract';
import AppShell from '@/components/laruhp/AppShell';

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
  status: OrderStatus;
  note: string | null;
  created_at: string;
}
interface Site { id: string; name: string }

const STATUS: Record<Order['status'], { label: string; cls: string }> = {
  paid: { label: '入金済', cls: 'bg-blue-100 text-blue-700' },
  review: { label: '在庫を要確認', cls: 'bg-red-100 text-red-700' },
  shipped: { label: '発送済', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: '完了', cls: 'bg-green-100 text-green-700' },
  canceled: { label: 'キャンセル', cls: 'bg-gray-100 text-gray-500' },
  refund_pending: { label: '返金確認中', cls: 'bg-amber-100 text-amber-800' },
  refunded: { label: '返金済', cls: 'bg-gray-100 text-gray-600' },
  refund_review: { label: '返金を要確認', cls: 'bg-red-100 text-red-700' },
};
const REFUNDABLE = new Set<OrderStatus>(['paid','review','shipped','completed','refund_pending','refund_review']);

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [refundConfirmId, setRefundConfirmId] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/sites', { cache: 'no-store' });
      if (response.status === 401) { router.push('/laruHP/auth/login?redirectTo=/laruHP/orders'); return; }
      const body = await response.json().catch(() => ({})) as { sites?: Site[]; error?: string };
      if (!response.ok) throw new Error(body.error || 'サイトを読み込めませんでした');
      const nextSites = body.sites ?? [];
      setSites(nextSites);
      if (nextSites.length > 0) {
        const requested = searchParams.get('siteId');
        const selected = requested && nextSites.some(site => site.id === requested)
          ? requested
          : nextSites[0].id;
        setSiteId(prev => prev || selected);
      }
    } catch (e) {
      setErr((e as Error)?.message || '読み込みに失敗しました');
    } finally {
      setLoaded(true);
    }
  }, [router, searchParams]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!siteId) return;
    const controller = new AbortController();
    setOrdersLoading(true);
    setErr('');
    fetch(`/api/orders?siteId=${encodeURIComponent(siteId)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as { orders?: Order[]; error?: string };
        if (!response.ok) throw new Error(body.error || '注文を読み込めませんでした');
        setOrders(body.orders ?? []);
      })
      .catch(error => { if (error.name !== 'AbortError') setErr(error.message || '注文を読み込めませんでした'); })
      .finally(() => { if (!controller.signal.aborted) setOrdersLoading(false); });
    return () => controller.abort();
  }, [siteId]);

  const updateStatus = async (id: string, status: OrderStatus) => {
    setSavingId(id);
    setErr('');
    try {
      const response = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const body = await response.json().catch(() => ({})) as { order?: { id: string; status: OrderStatus }; error?: string };
      if (!response.ok || !body.order) throw new Error(body.error || '注文状態を変更できませんでした');
      setOrders(prev => prev.map(order => order.id === body.order?.id ? { ...order, status: body.order.status } : order));
    } catch (error) {
      setErr((error as Error).message || '注文状態を変更できませんでした');
    } finally {
      setSavingId('');
    }
  };

  const refundOrder = async () => {
    const id=refundConfirmId;
    if(!id)return;
    setSavingId(id);setRefundConfirmId('');setErr('');
    try{
      const response=await fetch('/api/orders/refund',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id})});
      const body=await response.json().catch(()=>({})) as {order?:{id:string;status:OrderStatus};error?:string};
      if(!response.ok||!body.order)throw Error(body.error||'返金を開始できませんでした');
      setOrders(prev=>prev.map(order=>order.id===body.order?.id?{...order,status:body.order.status}:order));
    }catch(error){setErr((error as Error).message||'返金を開始できませんでした');}
    finally{setSavingId('');}
  };

  const addr = (s: Shipping) => [s.postal_code && `〒${s.postal_code}`, s.state, s.city, s.line1, s.line2].filter(Boolean).join(' ');

  if (!loaded) return <div className="min-h-screen bg-sky-50 flex items-center justify-center"><div className="text-gray-500 text-sm">読み込み中...</div></div>;

  return (
    <AppShell title="注文管理" actions={<>{sites.length > 1 && (
            <select value={siteId} onChange={e => setSiteId(e.target.value)} className="ml-auto bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}</>}>
      {refundConfirmId&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="refund-title">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="refund-title" className="font-bold text-gray-900">全額返金しますか？</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">Stripeへ全額返金を依頼します。発送済み商品の在庫は自動では戻りません。</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={()=>setRefundConfirmId('')} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600">戻る</button>
              <button type="button" onClick={refundOrder} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white">全額返金する</button>
            </div>
          </div>
        </div>
      )}
      
      <main className="max-w-screen-lg mx-auto px-4 py-6">
        {err && <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{err}</p>}
        {ordersLoading ? (
          <div className="text-center py-20 text-sm text-gray-500">注文を読み込んでいます</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <Package aria-hidden="true" className="mx-auto mb-3 h-12 w-12 text-sky-700" />
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
                      <p className="text-xs text-gray-600 mt-1 flex items-start gap-1.5"><MapPin aria-hidden="true" className="h-4 w-4 shrink-0" /> <span>{o.shipping.name} {addr(o.shipping)}</span></p>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
                  <span className="text-xs text-gray-400">ステータス変更:</span>
                  <select value={o.status} disabled={savingId === o.id || nextOrderStatuses(o.status).length === 0}
                    onChange={e => updateStatus(o.id, e.target.value as OrderStatus)}
                    aria-label={`${o.customer_name || '注文'}の状態`}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm disabled:opacity-60">
                    <option value={o.status}>{STATUS[o.status].label}</option>
                    {nextOrderStatuses(o.status).map(status => <option key={status} value={status}>{STATUS[status].label}</option>)}
                  </select>
                  {savingId === o.id && <span role="status" className="text-xs text-gray-500">保存しています</span>}
                  {REFUNDABLE.has(o.status)&&savingId!==o.id&&(
                    <button type="button" onClick={()=>setRefundConfirmId(o.id)} className="ml-auto rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50">
                      {o.status==='refund_pending'||o.status==='refund_review'?'返金状態を確認':'全額返金'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    
    </AppShell>
  );
}
