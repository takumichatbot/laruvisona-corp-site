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
  ogImage?: string;
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
const HOURS_PLACEHOLDER = 'Mo-Fr 09:00-18:00（月〜金 9時〜18時）';

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
  ogImage: '',
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
  const [needsRepublish, setNeedsRepublish] = useState(false);

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

  const REPUBLISH_KEY = (siteId: string) => `laruHP_seo_needs_republish_${siteId}`;

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
    setNeedsRepublish(typeof window !== 'undefined' && !!localStorage.getItem(REPUBLISH_KEY(site.id)));
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
        setNeedsRepublish(false);
        localStorage.removeItem(REPUBLISH_KEY(selectedSite.id));
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
        setNeedsRepublish(true);
        localStorage.setItem(REPUBLISH_KEY(selectedSite.id), '1');
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
  const requiredInputCls = (val: string) => inputCls + (!val.trim() ? ' border-red-300 bg-red-50/30' : '');

  const schemaHints = [
    { ok: !!form.name.trim(), label: '店舗名', tip: 'Googleビジネスプロフィールと完全一致させると評価が上がります' },
    { ok: form.description.length >= 50, label: '説明文（50文字以上）', tip: '短すぎる説明文はリッチリザルトに表示されにくいです' },
    { ok: !!form.phone.trim(), label: '電話番号', tip: '電話番号があると地域検索での表示率が向上します' },
    { ok: !!form.address.trim(), label: '住所', tip: 'ローカルSEOの最重要項目です' },
    { ok: form.openingHours.some(Boolean), label: '営業時間', tip: 'Googleマップでの表示に影響します' },
    { ok: form.sameAs.some(Boolean), label: 'SNSリンク', tip: 'Googleがビジネスを認識する際の補足情報になります' },
  ];

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
        <Link href="/laruHP/dashboard" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          ダッシュボード
        </Link>
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

        {/* JSON-LD validation badge */}
        {(() => {
          const checks = [
            { label: '店舗名', ok: !!(form.name || selectedSite?.name) },
            { label: '説明文', ok: form.description.length >= 50 },
            { label: '電話番号', ok: !!form.phone },
            { label: '住所', ok: !!(form.address || form.city) },
            { label: '営業時間', ok: form.openingHours.filter(Boolean).length > 0 },
          ];
          const filled = checks.filter(c => c.ok).length;
          const missing = checks.filter(c => !c.ok).map(c => c.label);
          const isComplete = filled === checks.length;
          return (
            <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${isComplete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-bold ${isComplete ? 'text-green-700' : 'text-amber-700'}`}>
                  {isComplete ? `✓ ${filled}項目すべて設定済み` : `${filled} / ${checks.length} 項目設定済み`}
                </span>
                {missing.length > 0 && (
                  <span className="text-[10px] text-amber-600">未設定: {missing.join(' · ')}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {checks.map(c => {
                  const hint = schemaHints.find(h => h.label.startsWith(c.label.split('（')[0]));
                  return (
                    <span
                      key={c.label}
                      title={!c.ok && hint ? hint.tip : undefined}
                      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border cursor-default ${c.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200 underline decoration-dotted'}`}
                    >
                      {c.ok ? '✓' : '⚠'} {c.label}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })()}

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

        {needsRepublish && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0">🔄</span>
              <span className="text-xs font-semibold text-amber-800">SEO設定を変更しました。Googleへの反映には再公開が必要です。</span>
            </div>
            <button
              onClick={async () => { await handleSave(); await handleRepublish(); }}
              disabled={saving || republishing}
              className="flex-shrink-0 text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="SEO設定を保存してサイトを再公開します（Googleへの反映に必要）"
            >
              {republishing ? '公開中...' : '保存して再公開'}
            </button>
          </div>
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
              <select
                value={form.type}
                onChange={e => {
                  const next = e.target.value;
                  if (next === form.type) return;
                  const hasData = form.name || form.description || form.address || form.phone;
                  if (hasData && !window.confirm(`業種を「${SCHEMA_TYPES.find(t => t.value === next)?.label || next}」に変更します。\n入力済みのフィールドはそのまま残ります。よろしいですか？`)) return;
                  setField('type', next);
                }}
                className={inputCls}
              >
                <optgroup label="一般">
                  <option value="LocalBusiness">一般（ローカルビジネス）</option>
                </optgroup>
                <optgroup label="飲食・宿泊">
                  <option value="Restaurant">飲食店・カフェ</option>
                  <option value="Hotel">ホテル・旅館</option>
                  <option value="LodgingBusiness">宿泊施設</option>
                </optgroup>
                <optgroup label="美容・健康">
                  <option value="HealthAndBeautyBusiness">美容室・エステ・サロン</option>
                  <option value="HairSalon">美容室（ヘアサロン）</option>
                  <option value="SpaOrBeautyBusiness">スパ・マッサージ</option>
                  <option value="FitnessCenter">フィットネス・ジム</option>
                </optgroup>
                <optgroup label="医療・法律">
                  <option value="MedicalBusiness">クリニック・医院</option>
                  <option value="Dentist">歯科・デンタルクリニック</option>
                  <option value="LegalService">士業・法律・会計</option>
                </optgroup>
                <optgroup label="小売・サービス">
                  <option value="Store">小売店・ショップ</option>
                  <option value="ClothingStore">アパレル・衣料品</option>
                  <option value="PetStore">ペットサロン・ショップ</option>
                </optgroup>
                <optgroup label="不動産・建設">
                  <option value="RealEstateAgent">不動産</option>
                  <option value="HomeAndConstructionBusiness">建設・工務店・リフォーム</option>
                </optgroup>
                <optgroup label="教育・その他">
                  <option value="EducationalOrganization">スクール・教育</option>
                  <option value="AutoRepair">車・整備・修理</option>
                  <option value="WeddingVenue">ウェディング</option>
                  <option value="PhotographyBusiness">フォトスタジオ</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">店舗・事業所名 <span className="text-red-400">*</span></label>
              <input type="text" value={form.name} onChange={e => setField('name', e.target.value)} className={requiredInputCls(form.name)} placeholder={selectedSite?.name || '例：鈴木カフェ'} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-600">説明文（検索結果に表示）<span className="text-red-400 ml-0.5">*</span></label>
              <span className={`text-[10px] font-semibold ${
                form.description.length === 0
                  ? 'text-gray-400'
                  : form.description.length >= 150 && form.description.length <= 160
                  ? 'text-green-600'
                  : form.description.length > 160
                  ? 'text-red-500'
                  : 'text-amber-500'
              }`}>
                {form.description.length} / 160文字
                {form.description.length > 0 && form.description.length < 50 && ' （短すぎます）'}
                {form.description.length > 160 && ' （長すぎます）'}
                {form.description.length >= 150 && form.description.length <= 160 && ' ✓ 最適'}
              </span>
            </div>
            {form.description.length > 0 && (
              <div className="mb-1.5">
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      form.description.length >= 150 && form.description.length <= 160
                        ? 'bg-green-500'
                        : form.description.length > 160
                        ? 'bg-red-500'
                        : form.description.length >= 80
                        ? 'bg-amber-400'
                        : 'bg-gray-300'
                    }`}
                    style={{ width: `${Math.min(100, (form.description.length / 160) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] mt-0.5 px-0.5">
                  <span className="text-gray-400">0</span>
                  <span className="text-amber-500">80 推奨開始</span>
                  <span className="text-green-600">150 最適</span>
                  <span className="text-red-500">160 上限</span>
                </div>
              </div>
            )}
            <textarea value={form.description} onChange={e => setField('description', e.target.value)} className={requiredInputCls(form.description) + ' h-20 resize-none'} placeholder="地域密着の○○サービスを提供しています..." />
            {(form.name || form.description) && (
              <div className="mt-2 space-y-3">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">Google 検索結果プレビュー</p>
                  <div className="text-[13px] text-[#1a0dab] font-medium leading-snug truncate">
                    {form.name || selectedSite?.name || 'サイト名'}
                  </div>
                  <div className="text-[11px] text-[#006621] truncate mt-0.5">
                    {selectedSite?.slug ? `https://laruvisona.jp/hp/${selectedSite.slug}` : 'https://laruvisona.jp/hp/...'}
                  </div>
                  <div className="text-[12px] text-[#545454] mt-1 leading-snug line-clamp-2">
                    {form.description
                      ? form.description.slice(0, 160)
                      : <span className="text-gray-300">説明文を入力すると、ここに表示されます...</span>}
                  </div>
                </div>

                {/* OGP Image input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-600">OGP画像URL（SNSシェア時のサムネイル）</label>
                    <span className="text-[10px] text-gray-400">推奨: 1200×630px</span>
                  </div>
                  <input type="url" value={form.ogImage || ''} onChange={e => setField('ogImage', e.target.value)} className={inputCls} placeholder="https://..." />
                </div>

                {/* Twitter / LINE / OGP preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Twitter card */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <p className="text-[10px] font-semibold text-gray-400 px-3 pt-3 mb-2 uppercase tracking-wider">X (Twitter) カードプレビュー</p>
                    {form.ogImage && <img src={form.ogImage} alt="OGP" className="w-full h-28 object-cover" />}
                    {!form.ogImage && <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-xs text-gray-400">画像URL未設定</div>}
                    <div className="px-3 py-2.5">
                      <div className="text-[11px] font-bold text-gray-900 truncate">{form.name || selectedSite?.name || 'サイト名'}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{form.description.slice(0, 100) || '説明文...'}</div>
                      <div className="text-[10px] text-gray-400 mt-1 truncate">laruvisona.jp</div>
                    </div>
                  </div>
                  {/* LINE share card */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <p className="text-[10px] font-semibold text-gray-400 px-3 pt-3 mb-2 uppercase tracking-wider">LINE シェアプレビュー</p>
                    <div className="flex gap-2 px-3 pb-3">
                      {form.ogImage
                        ? <img src={form.ogImage} alt="OGP" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                        : <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-xs text-gray-400">No img</div>}
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-gray-900 line-clamp-2">{form.name || selectedSite?.name || 'サイト名'}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{form.description.slice(0, 80) || '説明文...'}</div>
                        <div className="text-[9px] text-green-600 font-bold mt-1">laruvisona.jp</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                  placeholder={HOURS_PLACEHOLDER}
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
            disabled={saving || republishing || (!form.name.trim() && !selectedSite?.name) || !form.description.trim()}
            className="flex-1 bg-white border border-gray-200 hover:border-sky-400 hover:bg-sky-50 text-gray-700 font-bold py-3.5 rounded-2xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={(!form.name.trim() && !selectedSite?.name) ? '店舗名を入力してください' : !form.description.trim() ? '説明文を入力してください' : ''}
          >
            {saving ? '保存中...' : 'SEO情報を保存'}
          </button>
          <button
            onClick={async () => { await handleSave(); if (!saving) await handleRepublish(); }}
            disabled={saving || republishing || (!form.name.trim() && !selectedSite?.name) || !form.description.trim()}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl text-sm transition-colors"
            title={(!form.name.trim() && !selectedSite?.name) ? '店舗名を入力してください' : !form.description.trim() ? '説明文を入力してください' : '保存後すぐにサイトを再公開します'}
          >
            {republishing ? '公開中...' : '保存して公開'}
          </button>
        </div>

        <p className="text-[10px] text-gray-400 text-center">
          「保存して公開」でビルダーに戻らずそのままGoogleに反映されます
        </p>
        {selectedSite?.slug && (
          <a
            href={`https://www.google.com/search?q=site:laruvisona.jp/hp/${selectedSite.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500 hover:text-sky-600 transition-colors"
          >
            🔍 Google でインデックス状況を確認 →
          </a>
        )}

      </div>
    </div>
  );
}
