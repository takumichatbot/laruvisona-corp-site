'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import AppShell from '@/components/laruhp/AppShell';

interface Variant {
  id: string;
  name: string;
  priceDelta: number;
  stock: number | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  stock: number | null;
  active: boolean;
  category: string;
  createdAt: string;
  variantLabel?: string;
  variants?: Variant[];
}

interface VariantForm {
  id: string;
  name: string;
  priceDelta: string | number;
  stock: string | number;
}

interface Site {
  id: string;
  name: string;
  slug: string | null;
  published?: boolean;
}
interface PaymentStatus { available: boolean; connected: boolean; ready: boolean }

const DEFAULT_FORM = {
  name: '',
  description: '',
  price: 0,
  stock: '' as string | number,
  category: 'その他',
  variantLabel: '',
  variants: [] as VariantForm[],
};

const CATEGORIES = ['その他', 'サービス', '商品', 'デジタルコンテンツ', 'コース・講座', 'チケット'];

export default function ShopPage() {
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [collectShipping, setCollectShipping] = useState(false);
  const [payments, setPayments] = useState<PaymentStatus | null>(null);
  const [connecting, setConnecting] = useState(false);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsgType(type);
    setMsg(text);
    setTimeout(() => setMsg(''), 4000);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/sites');
        if (res.status === 401) { router.replace('/laruHP/auth/login'); return; }
        if (!res.ok) throw new Error('sites fetch failed');
        const d = await res.json();
        const s: Site[] = (d.sites || []).map((x: Site) => ({ id: x.id, name: x.name, slug: x.slug, published: x.published }));
        setSites(s);
        if (s.length > 0) {
          setSelectedSite(s[0]);
          await loadProducts(s[0].id);
        }
      } catch {
        setError('データの読み込みに失敗しました。ページを再読み込みしてください。');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProducts = async (siteId: string) => {
    try {
      const [res, paymentRes] = await Promise.all([
        fetch(`/api/products?siteId=${siteId}`),
        fetch(`/api/sites/${siteId}/shop/payments`, { cache: 'no-store' }),
      ]);
      if (!res.ok) throw new Error('products fetch failed');
      const d = await res.json();
      setProducts(d.products || []);
      setCollectShipping(d.collectShipping === true);
      setPayments(paymentRes.ok ? await paymentRes.json() : { available: false, connected: false, ready: false });
    } catch {
      showMsg('商品の読み込みに失敗しました', 'error');
    }
  };

  const connectStripe = async () => {
    if (!selectedSite) return;
    setConnecting(true);
    try {
      const response = await fetch(`/api/sites/${selectedSite.id}/shop/payments`, { method: 'POST' });
      const body = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error || 'Stripeを開けませんでした');
      window.location.assign(body.url);
    } catch (error) {
      showMsg((error as Error).message || 'Stripeを開けませんでした', 'error');
      setConnecting(false);
    }
  };

  const toggleCollectShipping = async (val: boolean) => {
    if (!selectedSite) return;
    setCollectShipping(val);
    try {
      const response = await fetch(`/api/sites/${selectedSite.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ settings_patch: { shopCollectShipping: val } }),
      });
      if (!response.ok) throw new Error('save failed');
      showMsg('設定を保存しました');
    } catch {
      showMsg('設定の保存に失敗しました', 'error');
      setCollectShipping(!val);
    }
  };

  const handleCreate = async () => {
    if (!selectedSite || !form.name || form.price <= 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: selectedSite.id,
          name: form.name,
          description: form.description,
          price: form.price,
          stock: form.stock === '' ? null : Number(form.stock),
          category: form.category,
          variantLabel: form.variantLabel,
          variants: form.variants.map(v => ({ id: v.id, name: v.name, priceDelta: Number(v.priceDelta) || 0, stock: v.stock === '' ? null : Number(v.stock) })),
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setProducts(prev => [d.product, ...prev]);
        setForm(DEFAULT_FORM);
        setShowForm(false);
        showMsg('商品を追加しました');
      } else {
        const d = await res.json().catch(() => ({}));
        showMsg((d as { error?: string }).error || '商品の追加に失敗しました', 'error');
      }
    } catch {
      showMsg('ネットワークエラーが発生しました', 'error');
    }
    setSaving(false);
  };

  const handleToggle = async (product: Product) => {
    if (!selectedSite) return;
    try {
      const res = await fetch(`/api/products?productId=${product.id}&siteId=${selectedSite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !product.active }),
      });
      if (res.ok) {
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, active: !p.active } : p));
      } else {
        showMsg('更新に失敗しました', 'error');
      }
    } catch {
      showMsg('ネットワークエラーが発生しました', 'error');
    }
  };

  const handleDelete = (productId: string) => {
    setDeleteConfirmId(productId);
  };

  const confirmDelete = async () => {
    if (!selectedSite || !deleteConfirmId) return;
    try {
      const res = await fetch(`/api/products?productId=${deleteConfirmId}&siteId=${selectedSite.id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== deleteConfirmId));
        setDeleteConfirmId(null);
      } else {
        showMsg('削除に失敗しました', 'error');
        setDeleteConfirmId(null);
      }
    } catch {
      showMsg('ネットワークエラーが発生しました', 'error');
      setDeleteConfirmId(null);
    }
  };

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 transition-colors';

  if (loading) return <div className="min-h-screen bg-sky-50 flex items-center justify-center"><div className="text-gray-500 text-sm">読み込み中...</div></div>;
  if (error) return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center p-6">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 max-w-sm w-full text-center">
        <p className="text-red-700 font-semibold text-sm mb-3">{error}</p>
        <button onClick={() => window.location.reload()} className="text-xs bg-red-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-500 transition-colors">再読み込み</button>
      </div>
    </div>
  );

  const deleteTarget = products.find(p => p.id === deleteConfirmId);

  return (
    <AppShell title="ショップ管理">
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4"><Trash2 aria-hidden="true" className="h-6 w-6 text-red-600" /></div>
            <h3 className="font-bold text-gray-900 mb-1">商品を削除しますか？</h3>
            <p className="text-sm text-gray-500 mb-5">「{deleteTarget?.name}」を削除します。この操作は取り消せません。</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 text-sm text-gray-500 border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">キャンセル</button>
              <button onClick={confirmDelete} className="flex-1 text-sm bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition-all">削除する</button>
            </div>
          </div>
        </div>
      )}

      
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Site picker */}
        {sites.length > 1 && (
          <select
            value={selectedSite?.id || ''}
            onChange={async e => {
              const s = sites.find(x => x.id === e.target.value) ?? null;
              setSelectedSite(s);
              if (s) await loadProducts(s.id);
            }}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-500"
          >
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        {/* Shop URL */}
        {selectedSite?.slug && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-green-800">お客様向けショップURL</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={`${process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp'}/hp/${selectedSite.slug}/shop`}
                className="flex-1 min-w-0 bg-white border border-green-200 rounded-lg px-2 py-1.5 text-xs text-green-700 font-mono focus:outline-none select-all"
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={() => navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp'}/hp/${selectedSite!.slug}/shop`)}
                className="text-xs text-green-700 border border-green-300 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors flex-shrink-0 font-semibold"
              >
                コピー
              </button>
            </div>
            {!selectedSite.published && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 flex items-start gap-1.5">
                <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>このサイトはまだ未公開のため、上記URLは404になります。ダッシュボードから「公開する」を実行するとアクセスできるようになります。</span>
              </p>
            )}
          </div>
        )}

        {selectedSite && (
          <section className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <h2 className="font-bold text-sm text-gray-900">売上の入金先</h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {payments?.ready
                    ? 'Stripeへの入金先を確認済みです。売上は店舗のStripe口座へ直接入ります。'
                    : payments?.connected
                      ? 'Stripe側の本人確認または入金設定を完了してください。'
                      : '販売を始める前に、売上を受け取るStripe口座を接続してください。'}
                </p>
              </div>
              {!payments?.ready && (
                <button type="button" onClick={connectStripe} disabled={connecting || !payments?.available}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {connecting ? 'Stripeを開いています' : payments?.connected ? 'Stripeの設定を続ける' : 'Stripeを接続する'}
                </button>
              )}
            </div>
            {!payments?.available && <p className="mt-2 text-xs text-amber-700">オンライン決済の有効化前です。商品は準備できますが、まだ購入受付は始まりません。</p>}
          </section>
        )}

        {/* ショップ設定 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-start gap-3">
          <input id="collectShipping" type="checkbox" checked={collectShipping} onChange={e => toggleCollectShipping(e.target.checked)} className="w-4 h-4 mt-0.5 rounded accent-sky-600" />
          <label htmlFor="collectShipping" className="text-sm text-gray-700">
            <span className="font-semibold">配送先住所を集める</span>
            <span className="block text-xs text-gray-400 mt-0.5">物理商品を発送する場合はオン。決済時にお客様の住所・電話を収集し、注文管理に表示します（サービス・デジタル商品はオフのままでOK）。クーポン入力欄は常に有効です。</span>
          </label>
        </div>

        {/* Global feedback banner */}
        {msg && (
          <div className={`text-xs font-semibold px-4 py-3 rounded-xl ${msgType === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>
        )}

        {/* Add product button / form */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-2xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            商品・サービスを追加
          </button>
        ) : (
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-sm text-gray-900">新しい商品を追加</h2>
              <button onClick={() => setShowForm(false)} aria-label="フォームを閉じる" className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">商品名 <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="例：カットカラーセット" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">説明</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls + ' h-20 resize-none'} placeholder="商品・サービスの説明を入力..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">価格（円）<span className="text-red-500">*</span></label>
                <input type="number" value={form.price || ''} onChange={e => setForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))} className={inputCls} min="0" placeholder="5000" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">在庫数（空=無制限）</label>
                <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className={inputCls} min="0" placeholder="∞" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">カテゴリ</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* バリエーション（サイズ/色など。任意） */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">バリエーション名（任意・例：サイズ／カラー）</label>
              <input type="text" value={form.variantLabel} onChange={e => setForm(f => ({ ...f, variantLabel: e.target.value }))} className={inputCls} placeholder="例：サイズ" />
              {form.variantLabel.trim() && (
                <div className="mt-3 space-y-2">
                  {form.variants.map((v, i) => (
                    <div key={v.id} className="flex gap-2 items-center">
                      <input type="text" value={v.name} onChange={e => setForm(f => ({ ...f, variants: f.variants.map((x, j) => j === i ? { ...x, name: e.target.value } : x) }))} className={inputCls + ' flex-1'} placeholder="選択肢名（例：M）" />
                      <input type="number" value={v.priceDelta} onChange={e => setForm(f => ({ ...f, variants: f.variants.map((x, j) => j === i ? { ...x, priceDelta: e.target.value } : x) }))} className={inputCls + ' w-24'} placeholder="±円" title="基本価格との差額（円）" />
                      <input type="number" value={v.stock} onChange={e => setForm(f => ({ ...f, variants: f.variants.map((x, j) => j === i ? { ...x, stock: e.target.value } : x) }))} className={inputCls + ' w-20'} placeholder="在庫" min="0" title="在庫（空=無制限）" />
                      <button onClick={() => setForm(f => ({ ...f, variants: f.variants.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600 px-1 flex-shrink-0" aria-label="削除"><X aria-hidden="true" className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setForm(f => ({ ...f, variants: [...f.variants, { id: crypto.randomUUID(), name: '', priceDelta: '', stock: '' }] }))} className="text-xs text-sky-600 font-semibold hover:text-sky-700 inline-flex items-center gap-1"><Plus aria-hidden="true" className="h-3.5 w-3.5" />選択肢を追加</button>
                  <p className="text-[11px] text-gray-400 leading-relaxed">±円＝基本価格との差額（例：+500）。在庫は選択肢ごとに管理（空=無制限）。バリエーションありの商品は購入時に選択が必須になります。</p>
                </div>
              )}
            </div>

            {msg && <p className={`text-xs font-semibold ${msgType === 'success' ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-600 font-bold py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.name || form.price <= 0}
                className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
              >
                {saving ? '保存中...' : '商品を追加'}
              </button>
            </div>
          </section>
        )}

        {/* Product list */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-sm text-gray-900 mb-4">商品リスト（{products.length}件）</h2>

          {products.length === 0 ? (
            <div className="text-center py-10">
              <ShoppingBag aria-hidden="true" className="mx-auto mb-4 h-12 w-12 text-sky-700" />
              <p className="text-sm text-gray-500">まだ商品がありません</p>
              <p className="text-xs text-gray-400 mt-1">「商品・サービスを追加」から登録してください</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map(product => (
                <div key={product.id} className={`border rounded-2xl p-4 transition-colors ${product.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-sky-50 border border-sky-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      {product.category === 'サービス' ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      ) : product.category === 'コース・講座' ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                      ) : product.category === 'チケット' ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/></svg>
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-sm text-gray-900">{product.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${product.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {product.active ? '販売中' : '停止中'}
                        </span>
                      </div>
                      {product.description && <p className="text-xs text-gray-500 mb-1.5 line-clamp-1">{product.description}</p>}
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-sky-700">¥{product.price.toLocaleString()}</span>
                        <span className="text-xs text-gray-400">
                          {product.stock === null ? '在庫: 無制限' : `在庫: ${product.stock}件`}
                        </span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{product.category}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleToggle(product)}
                        className={`text-[10px] px-2.5 py-1.5 rounded-lg border font-bold transition-all ${product.active ? 'border-gray-200 text-gray-500 hover:border-amber-200 hover:text-amber-700' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
                      >
                        {product.active ? '停止' : '販売再開'}
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        aria-label={`${product.name}を削除`}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1.5"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Info card */}
        <section className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
          <h3 className="font-bold text-sm text-indigo-900 mb-2">ショップの使い方</h3>
          <ul className="space-y-1.5 text-xs text-indigo-700">
            <li>• 商品を登録すると、お客様向けショップページが自動生成されます</li>
            <li>• お客様はStripe決済で安全にオンライン購入できます</li>
            <li>• ショップURLをビルダーのボタンに設定するか、SNSでシェアしましょう</li>
            <li>• 在庫数を設定すると売り切れになった商品は自動で非表示になります</li>
          </ul>
        </section>

      </div>
    
    </AppShell>
  );
}
