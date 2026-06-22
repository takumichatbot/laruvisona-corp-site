'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

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
}

interface Site {
  id: string;
  name: string;
  slug: string | null;
}

const DEFAULT_FORM = {
  name: '',
  description: '',
  price: 0,
  stock: '' as string | number,
  category: 'その他',
};

const CATEGORIES = ['その他', 'サービス', '商品', 'デジタルコンテンツ', 'コース・講座', 'チケット'];

export default function ShopPage() {
  const supabase = createClient();
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

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsgType(type);
    setMsg(text);
    setTimeout(() => setMsg(''), 4000);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/laruHP/auth/login'); return; }

        const res = await fetch('/api/sites');
        if (!res.ok) throw new Error('sites fetch failed');
        const d = await res.json();
        const s: Site[] = (d.sites || []).map((x: Site) => ({ id: x.id, name: x.name, slug: x.slug }));
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
      const res = await fetch(`/api/products?siteId=${siteId}`);
      if (!res.ok) throw new Error('products fetch failed');
      const d = await res.json();
      setProducts(d.products || []);
    } catch {
      showMsg('商品の読み込みに失敗しました', 'error');
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

  const handleDelete = async (productId: string) => {
    if (!selectedSite || !confirm('この商品を削除しますか？')) return;
    try {
      const res = await fetch(`/api/products?productId=${productId}&siteId=${selectedSite.id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== productId));
      } else {
        showMsg('削除に失敗しました', 'error');
      }
    } catch {
      showMsg('ネットワークエラーが発生しました', 'error');
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

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <header className="border-b border-sky-100 bg-white/90 backdrop-blur-xl shadow-sm px-6 py-4 flex items-center gap-4">
        <Link href="/laruHP/dashboard" className="text-gray-500 hover:text-gray-700 text-sm transition-colors">← ダッシュボード</Link>
        <h1 className="text-sm font-bold text-gray-900 mx-auto">ショップ管理</h1>
      </header>

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
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-green-800 mb-0.5">お客様向けショップURL</p>
              <p className="text-xs text-green-700 font-mono break-all">{process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp'}/hp/{selectedSite.slug}/shop</p>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp'}/hp/${selectedSite!.slug}/shop`)}
              className="text-xs text-green-700 border border-green-300 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors flex-shrink-0"
            >
              コピー
            </button>
          </div>
        )}

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
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
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

            {msg && <p className={`text-xs font-semibold ${msgType === 'success' ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-600 font-bold py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.name || form.price <= 0}
                className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
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
              <div className="text-4xl mb-3">🛍️</div>
              <p className="text-sm text-gray-500">まだ商品がありません</p>
              <p className="text-xs text-gray-400 mt-1">「商品・サービスを追加」から登録してください</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map(product => (
                <div key={product.id} className={`border rounded-2xl p-4 transition-colors ${product.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-sky-50 border border-sky-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                      {product.category === 'サービス' ? '⚙️' : product.category === 'コース・講座' ? '📚' : product.category === 'チケット' ? '🎟️' : '📦'}
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
    </div>
  );
}
