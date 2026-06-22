'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Site {
  id: string;
  name: string;
  slug: string | null;
  settings_json: Record<string, unknown> | null;
}

interface BusinessInfo {
  type: string;
  name: string;
  description: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  priceRange: string;
  openingHours: string[];
  latitude: string;
  longitude: string;
  sameAs: string[];
}

const SCHEMA_TYPES = [
  { value: 'LocalBusiness', label: '一般（ローカルビジネス）' },
  { value: 'Restaurant', label: '飲食店・カフェ' },
  { value: 'HealthAndBeautyBusiness', label: '美容室・エステ・サロン' },
  { value: 'MedicalBusiness', label: 'クリニック・医院' },
  { value: 'Dentist', label: '歯科・デンタルクリニック' },
  { value: 'LegalService', label: '士業・法律・会計' },
  { value: 'RealEstateAgent', label: '不動産' },
  { value: 'EducationalOrganization', label: 'スクール・教育' },
  { value: 'FitnessCenter', label: 'フィットネス・ジム' },
  { value: 'HairSalon', label: '美容室（ヘアサロン）' },
  { value: 'SpaOrBeautyBusiness', label: 'スパ・マッサージ' },
  { value: 'AutoRepair', label: '車・整備・修理' },
  { value: 'Hotel', label: 'ホテル・旅館' },
  { value: 'LodgingBusiness', label: '宿泊施設' },
  { value: 'PetStore', label: 'ペットサロン・ショップ' },
  { value: 'Store', label: '小売店・ショップ' },
  { value: 'ClothingStore', label: 'アパレル・衣料品' },
  { value: 'HomeAndConstructionBusiness', label: '建設・工務店・リフォーム' },
  { value: 'WeddingVenue', label: 'ウェディング' },
  { value: 'PhotographyBusiness', label: 'フォトスタジオ' },
];

const PRICE_RANGES = ['¥', '¥¥', '¥¥¥', '¥¥¥¥'];

const DEFAULT_HOURS = [
  'Mo-Fr 09:00-18:00',
  'Sa 10:00-17:00',
];

const DEFAULT_FORM: BusinessInfo = {
  type: 'LocalBusiness',
  name: '',
  description: '',
  address: '',
  city: '',
  postalCode: '',
  phone: '',
  priceRange: '¥¥',
  openingHours: [...DEFAULT_HOURS],
  latitude: '',
  longitude: '',
  sameAs: ['', '', ''],
};

export default function SeoPage() {
  const supabase = createClient();
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [form, setForm] = useState<BusinessInfo>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [republishing, setRepublishing] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [preview, setPreview] = useState(false);

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
        if (!res.ok) throw new Error('fetch failed');
        const d = await res.json();
        const s: Site[] = d.sites || [];
        setSites(s);
        if (s.length > 0) {
          setSelectedSite(s[0]);
          loadFormFromSite(s[0]);
        }
      } catch {
        setError('データの読み込みに失敗しました。ページを再読み込みしてください。');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFormFromSite = (site: Site) => {
    const bi = (site.settings_json?.businessInfo as BusinessInfo | undefined);
    if (bi) {
      setForm({
        ...DEFAULT_FORM,
        ...bi,
        openingHours: bi.openingHours?.length ? bi.openingHours : [...DEFAULT_HOURS],
        sameAs: bi.sameAs?.length ? [...bi.sameAs, '', '', ''].slice(0, 3) : ['', '', ''],
      });
    } else {
      setForm({ ...DEFAULT_FORM, name: site.name });
    }
  };

  const handleSiteChange = (siteId: string) => {
    const s = sites.find(x => x.id === siteId) ?? null;
    setSelectedSite(s);
    if (s) loadFormFromSite(s);
  };

  const handleRepublish = async () => {
    if (!selectedSite) return;
    setRepublishing(true);
    try {
      const res = await fetch(`/api/sites/${selectedSite.id}/publish`, { method: 'POST' });
      const d = await res.json() as { error?: string; message?: string };
      if (res.ok) {
        showMsg('再公開しました。SEO設定が反映されました。');
      } else if (res.status === 403) {
        showMsg(d.message || 'サブスクリプションが必要です', 'error');
      } else {
        showMsg(d.error || '再公開に失敗しました', 'error');
      }
    } catch {
      showMsg('ネットワークエラーが発生しました', 'error');
    }
    setRepublishing(false);
  };

  const handleSave = async () => {
    if (!selectedSite) return;
    setSaving(true);
    try {
      const businessInfo: BusinessInfo = {
        ...form,
        sameAs: form.sameAs.filter(Boolean),
        openingHours: form.openingHours.filter(Boolean),
      };
      const res = await fetch(`/api/sites/${selectedSite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings_patch: { businessInfo } }),
      });
      if (res.ok) {
        setSites(prev => prev.map(s => s.id === selectedSite.id
          ? { ...s, settings_json: { ...(s.settings_json || {}), businessInfo } }
          : s
        ));
        setSelectedSite(prev => prev ? { ...prev, settings_json: { ...(prev.settings_json || {}), businessInfo } } : prev);
        showMsg('SEO情報を保存しました。次の公開時に反映されます。');
      } else {
        const d = await res.json().catch(() => ({}));
        showMsg((d as { error?: string }).error || '保存に失敗しました', 'error');
      }
    } catch {
      showMsg('ネットワークエラーが発生しました', 'error');
    }
    setSaving(false);
  };

  const setField = <K extends keyof BusinessInfo>(key: K, value: BusinessInfo[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const setHour = (i: number, val: string) => {
    setForm(f => {
      const h = [...f.openingHours];
      h[i] = val;
      return { ...f, openingHours: h };
    });
  };

  const setSameAs = (i: number, val: string) => {
    setForm(f => {
      const s = [...f.sameAs];
      s[i] = val;
      return { ...f, sameAs: s };
    });
  };

  const jsonLdPreview = () => {
    const obj: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': form.type || 'LocalBusiness',
      name: form.name || selectedSite?.name || '',
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp'}/hp/${selectedSite?.slug}`,
    };
    if (form.description) obj.description = form.description;
    if (form.phone) obj.telephone = form.phone;
    if (form.priceRange) obj.priceRange = form.priceRange;
    if (form.address || form.city || form.postalCode) {
      obj.address = {
        '@type': 'PostalAddress',
        ...(form.address ? { streetAddress: form.address } : {}),
        ...(form.city ? { addressLocality: form.city } : {}),
        ...(form.postalCode ? { postalCode: form.postalCode } : {}),
        addressCountry: 'JP',
      };
    }
    if (form.openingHours.filter(Boolean).length) obj.openingHours = form.openingHours.filter(Boolean);
    const sns = form.sameAs.filter(Boolean);
    if (sns.length) obj.sameAs = sns;
    return JSON.stringify(obj, null, 2);
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
        <h1 className="text-sm font-bold text-gray-900 mx-auto">SEO・構造化データ設定</h1>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Explanation */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-sm text-gray-900 mb-1">JSON-LD 構造化データとは</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Googleが認識する「ビジネス情報」をコードとして埋め込む技術です。店名・住所・電話番号・営業時間などを設定することで、
            Google検索の「ナレッジパネル」「マップ」「リッチリザルト」に情報が表示されやすくなります。
          </p>
        </div>

        {/* Site picker */}
        {sites.length > 1 && (
          <select
            value={selectedSite?.id || ''}
            onChange={e => handleSiteChange(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-500"
          >
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        {msg && (
          <div className={`text-xs font-semibold px-4 py-3 rounded-xl ${msgType === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>
        )}

        {/* Business Type */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-sm text-gray-900">ビジネス基本情報</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">業種・Schema.org タイプ</label>
              <select value={form.type} onChange={e => setField('type', e.target.value)} className={inputCls}>
                {SCHEMA_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">店舗・事業所名</label>
              <input type="text" value={form.name} onChange={e => setField('name', e.target.value)} className={inputCls} placeholder={selectedSite?.name || '店舗名'} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">説明文（検索結果に表示）</label>
            <textarea value={form.description} onChange={e => setField('description', e.target.value)} className={inputCls + ' h-20 resize-none'} placeholder="地域密着の○○サービスを提供しています..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">電話番号</label>
              <input type="tel" value={form.phone} onChange={e => setField('phone', e.target.value)} className={inputCls} placeholder="03-1234-5678" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">価格帯</label>
              <div className="flex gap-2">
                {PRICE_RANGES.map(p => (
                  <button
                    key={p}
                    onClick={() => setField('priceRange', p)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${form.priceRange === p ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Address */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-sm text-gray-900">住所・所在地</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">郵便番号</label>
              <input type="text" value={form.postalCode} onChange={e => setField('postalCode', e.target.value)} className={inputCls} placeholder="123-4567" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">市区町村</label>
              <input type="text" value={form.city} onChange={e => setField('city', e.target.value)} className={inputCls} placeholder="東京都渋谷区" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">番地・建物名</label>
            <input type="text" value={form.address} onChange={e => setField('address', e.target.value)} className={inputCls} placeholder="神南1-2-3 ○○ビル 4F" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">緯度（任意）</label>
              <input type="text" value={form.latitude} onChange={e => setField('latitude', e.target.value)} className={inputCls} placeholder="35.6581" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">経度（任意）</label>
              <input type="text" value={form.longitude} onChange={e => setField('longitude', e.target.value)} className={inputCls} placeholder="139.7016" />
            </div>
          </div>
          <p className="text-[10px] text-gray-400">緯度・経度は Google マップで店舗を右クリック→「この場所について」からコピーできます</p>
        </section>

        {/* Opening Hours */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-gray-900">営業時間</h2>
            <button
              onClick={() => setForm(f => ({ ...f, openingHours: [...f.openingHours, 'Mo 09:00-18:00'] }))}
              className="text-xs text-sky-600 border border-sky-200 px-2 py-1 rounded-lg hover:bg-sky-50 transition-colors"
            >
              + 追加
            </button>
          </div>
          <p className="text-[10px] text-gray-400 -mt-2">Schema.org 形式: Mo/Tu/We/Th/Fr/Sa/Su  HH:MM-HH:MM</p>
          <div className="space-y-2">
            {form.openingHours.map((h, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={h}
                  onChange={e => setHour(i, e.target.value)}
                  className={inputCls}
                  placeholder="Mo-Fr 09:00-18:00"
                />
                <button
                  onClick={() => setForm(f => ({ ...f, openingHours: f.openingHours.filter((_, j) => j !== i) }))}
                  className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0 px-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* SNS / sameAs */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-sm text-gray-900">SNS・外部リンク（sameAs）</h2>
          <p className="text-xs text-gray-500">Googleがビジネスを同定するために使います。Instagram、X、Facebook、食べログなどのURLを入力してください。</p>
          {form.sameAs.map((url, i) => (
            <div key={i}>
              <input
                type="url"
                value={url}
                onChange={e => setSameAs(i, e.target.value)}
                className={inputCls}
                placeholder={['https://www.instagram.com/yourshop', 'https://www.facebook.com/yourshop', 'https://tabelog.com/...'][i] || 'https://...'}
              />
            </div>
          ))}
          <button
            onClick={() => setForm(f => ({ ...f, sameAs: [...f.sameAs, ''] }))}
            className="text-xs text-gray-400 hover:text-sky-600 border border-dashed border-gray-200 hover:border-sky-300 px-3 py-2 rounded-xl w-full transition-colors"
          >
            + URLを追加
          </button>
        </section>

        {/* JSON-LD Preview */}
        <section className="bg-gray-900 rounded-2xl overflow-hidden">
          <button
            onClick={() => setPreview(p => !p)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">JSON-LD</span>
              <span className="text-xs font-semibold text-gray-200">生成されるコードをプレビュー</span>
            </div>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`text-gray-400 transition-transform ${preview ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {preview && (
            <pre className="px-5 pb-5 text-[11px] text-green-300 font-mono overflow-x-auto leading-relaxed">
              {jsonLdPreview()}
            </pre>
          )}
        </section>

        {/* Save + Republish */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || republishing}
            className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors"
          >
            {saving ? '保存中...' : 'SEO情報を保存'}
          </button>
          <button
            onClick={async () => { await handleSave(); if (!saving) await handleRepublish(); }}
            disabled={saving || republishing}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors"
          >
            {republishing ? '公開中...' : '保存して即座に公開'}
          </button>
        </div>

        <p className="text-[10px] text-gray-400 text-center">
          「保存して即座に公開」でビルダーに戻らずそのままGoogle に反映されます
        </p>

      </div>
    </div>
  );
}
