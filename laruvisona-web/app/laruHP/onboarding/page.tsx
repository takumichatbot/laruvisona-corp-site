'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const INDUSTRIES = [
  { id: 'restaurant',   icon: '🍽️', name: '飲食店・カフェ',     desc: 'レストラン、居酒屋、カフェ、ラーメン店など',         color: 'orange', popular: true },
  { id: 'beauty',       icon: '✂️', name: '美容室・サロン',     desc: '美容室、ネイルサロン、エステ、スパなど',            color: 'pink',   popular: true },
  { id: 'clinic',       icon: '🏥', name: '整体・クリニック',   desc: '整体院、接骨院、歯科、医療クリニックなど',          color: 'teal',   popular: true },
  { id: 'legal',        icon: '⚖️', name: '士業・コンサル',     desc: '弁護士、税理士、行政書士、コンサルタントなど',      color: 'indigo' },
  { id: 'construction', icon: '🏗️', name: '建設・工務店',       desc: 'リフォーム、建設、内装工事、外構など',              color: 'yellow' },
  { id: 'realestate',   icon: '🏠', name: '不動産',             desc: '賃貸仲介、売買、管理、不動産投資など',              color: 'blue' },
  { id: 'retail',       icon: '🛍️', name: '小売・EC',           desc: '実店舗、オンラインショップ、専門店など',            color: 'purple' },
  { id: 'fitness',      icon: '💪', name: 'フィットネス・ジム', desc: 'パーソナルジム、ヨガスタジオ、スポーツクラブなど', color: 'green' },
  { id: 'hotel',        icon: '🏨', name: 'ホテル・旅館',       desc: 'ホテル、旅館、民泊、グランピングなど',              color: 'amber' },
  { id: 'education',    icon: '📚', name: '教育・スクール',     desc: '塾、教室、スクール、研修機関など',                  color: 'cyan' },
  { id: 'wedding',      icon: '💒', name: '結婚式場・イベント', desc: 'ウェディング、イベントホール、パーティーなど',      color: 'rose' },
  { id: 'pet',          icon: '🐾', name: 'ペットサロン',       desc: 'トリミング、ペットホテル、動物病院など',            color: 'lime' },
  { id: 'dental',       icon: '🦷', name: '歯科クリニック',     desc: '歯科医院、矯正歯科、審美歯科など',                  color: 'sky' },
  { id: 'photo',        icon: '📷', name: 'フォトスタジオ',     desc: 'フォトスタジオ、カメラマン、写真館など',            color: 'stone' },
  { id: 'accounting',   icon: '📊', name: '税理士・会計士',     desc: '税理士、会計士、行政書士、社労士など',              color: 'blue' },
  { id: 'other',        icon: '✨', name: 'その他',             desc: '上記に当てはまらない業種',                          color: 'slate' },
];

const INDUSTRY_COLOR_MAP: Record<string, string> = {
  restaurant: 'warm-earth',
  beauty: 'modern-pink',
  clinic: 'fresh-green',
  legal: 'elegant-dark',
  construction: 'bold-orange',
  realestate: 'professional-blue',
  retail: 'bold-orange',
  fitness: 'bold-orange',
  hotel: 'elegant-dark',
  education: 'professional-blue',
  wedding: 'elegant-dark',
  pet: 'fresh-green',
  dental: 'professional-blue',
  photo: 'elegant-dark',
  accounting: 'professional-blue',
  other: 'professional-blue',
};

// TEMPLATE_PRESETS removed — replaced with free color picker (primaryColor)


const INDUSTRY_DESIGN_MAP: Record<string, { designStyle: string; fontFamily: string; primaryColor: string }> = {
  restaurant:   { designStyle: 'rounded',  fontFamily: 'rounded', primaryColor: '#c05621' },
  beauty:       { designStyle: 'elegant',  fontFamily: 'mincho',  primaryColor: '#831843' },
  clinic:       { designStyle: 'modern',   fontFamily: 'noto',    primaryColor: '#065f46' },
  legal:        { designStyle: 'minimal',  fontFamily: 'biz',     primaryColor: '#1e293b' },
  construction: { designStyle: 'bold',     fontFamily: 'zen',     primaryColor: '#92400e' },
  realestate:   { designStyle: 'sharp',    fontFamily: 'zen',     primaryColor: '#1e3a8a' },
  retail:       { designStyle: 'rounded',  fontFamily: 'noto',    primaryColor: '#7c3aed' },
  fitness:      { designStyle: 'bold',     fontFamily: 'zen',     primaryColor: '#dc2626' },
  hotel:        { designStyle: 'elegant',  fontFamily: 'mincho',  primaryColor: '#78350f' },
  education:    { designStyle: 'rounded',  fontFamily: 'noto',    primaryColor: '#1d4ed8' },
  wedding:      { designStyle: 'elegant',  fontFamily: 'mincho',  primaryColor: '#9d174d' },
  pet:          { designStyle: 'rounded',  fontFamily: 'rounded', primaryColor: '#166534' },
  dental:       { designStyle: 'modern',   fontFamily: 'noto',    primaryColor: '#0369a1' },
  photo:        { designStyle: 'minimal',  fontFamily: 'kaisei',  primaryColor: '#374151' },
  accounting:   { designStyle: 'minimal',  fontFamily: 'biz',     primaryColor: '#1e3a5f' },
  other:        { designStyle: 'modern',   fontFamily: 'noto',    primaryColor: '#1e3a8a' },
};

const DAYS = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];

interface FormData {
  industry: string;
  businessName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  catchphrase: string;
  services: Array<{ name: string; description: string; price: string }>;
  hours: Array<{ day: string; open: string; close: string; closed: boolean }>;
  colorScheme: string;
  style: string;
  designStyle: string;
  primaryColor: string;
  fontFamily: string;
  larubot: boolean;
  laruseo: boolean;
}

const defaultHours = DAYS.map(day => ({
  day, open: '09:00', close: '18:00', closed: day === '日曜日',
}));

const defaultForm: FormData = {
  industry: '', businessName: '', address: '', phone: '', email: '',
  website: '', description: '', catchphrase: '',
  services: [
    { name: '', description: '', price: '' },
  ],
  hours: defaultHours,
  colorScheme: 'professional-blue',
  style: 'modern',
  designStyle: 'modern',
  primaryColor: '#1e3a8a',
  fontFamily: 'noto',
  larubot: true,
  laruseo: true,
};

const STEPS = ['業種選択', 'ビジネス情報', 'デザイン', 'コンテンツ', '確認・生成'];
const STEP_TIMES = ['約30秒', '約1分', '約1分', '約2分', '約30秒'];

const GENERATE_STEPS = [
  'ビジネス情報を解析',
  'キャッチコピー・ヒーロー見出しを生成',
  '3つの強み・紹介文を作成',
  'FAQ・お客様の声を生成',
  'SEO設定を最適化',
  'テンプレートにデータを適用',
];

const HOURS_PRESETS = [
  { label: '平日 9〜18時', fn: (h: typeof defaultForm.hours) => h.map((d, i) => ({ ...d, open: '09:00', close: '18:00', closed: i >= 5 })) },
  { label: '毎日 10〜19時', fn: (h: typeof defaultForm.hours) => h.map(d => ({ ...d, open: '10:00', close: '19:00', closed: false })) },
  { label: '年中無休 11〜22時', fn: (h: typeof defaultForm.hours) => h.map(d => ({ ...d, open: '11:00', close: '22:00', closed: false })) },
  { label: '土日定休 9〜18時', fn: (h: typeof defaultForm.hours) => h.map((d, i) => ({ ...d, open: '09:00', close: '18:00', closed: i >= 5 })) },
];


function LivePreview({ form }: { form: FormData }) {
  const heroBg = form.primaryColor || '#1e3a8a';
  const industry = INDUSTRIES.find(i => i.id === form.industry);
  const filledServices = form.services.filter(s => s.name);

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl text-left select-none">
      {/* Browser chrome */}
      <div className="bg-[#1a2744] px-3 py-2 flex items-center gap-2 border-b border-white/10">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <div className="w-2 h-2 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 bg-white/10 rounded text-[9px] text-slate-400 px-2 py-0.5 font-mono truncate">
          {form.businessName ? `${form.businessName.slice(0, 12).replace(/\s/g, '-').toLowerCase()}.laruvisona.com` : 'your-shop.laruvisona.com'}
        </div>
        <div className="w-2 h-2 rounded-full bg-green-400/60 flex-shrink-0" />
      </div>

      {/* Navbar */}
      <div className="flex items-center justify-between px-3 py-2" style={{ background: heroBg }}>
        <span className="text-white/90 text-[10px] font-black truncate max-w-[100px]">
          {form.businessName || 'SHOP NAME'}
        </span>
        <div className="flex gap-2">
          {['TOP', 'サービス', 'アクセス'].map(l => (
            <span key={l} className="text-white/40 text-[8px]">{l}</span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <div className="px-4 py-6 text-center" style={{ background: heroBg }}>
        {industry && (
          <div className="inline-block text-[8px] font-bold px-2 py-0.5 rounded-full mb-2 border border-white/30 text-white/80 bg-white/10">
            {industry.name}
          </div>
        )}
        <div className="text-white font-black text-xs leading-snug mb-1.5 px-1">
          {form.catchphrase || (form.businessName ? `${form.businessName}へようこそ` : 'キャッチコピーがここに入ります')}
        </div>
        {(form.description || form.address) && (
          <div className="text-white/50 text-[9px] mb-3 leading-relaxed px-2">
            {(form.description || form.address || '').slice(0, 45)}{(form.description || '').length > 45 ? '...' : ''}
          </div>
        )}
        <div className="flex justify-center gap-2 mt-3">
          <div className="px-3 py-1 rounded-full text-[9px] font-bold text-white bg-white/25">
            お問い合わせ
          </div>
          <div className="px-3 py-1 rounded-full text-[9px] border border-white/20 text-white/60">
            詳しく見る
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="px-3 py-3 bg-white">
        <div className="text-[9px] font-bold text-center mb-2 text-slate-700">
          {filledServices.length > 0 ? 'サービス・メニュー' : 'サービス（AI生成）'}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(filledServices.length > 0 ? filledServices : [{ name: 'サービス1', price: '' }, { name: 'サービス2', price: '' }, { name: 'サービス3', price: '' }]).slice(0, 3).map((s, i) => (
            <div key={i} className="rounded-lg p-1.5 text-center bg-slate-100" style={{ opacity: filledServices.length > 0 ? 1 : 0.5 }}>
              <div className="text-[8px] font-bold truncate text-slate-700">{s.name}</div>
              {s.price && <div className="text-[7px] mt-0.5" style={{ color: heroBg }}>{s.price}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-gray-100 flex items-center justify-between">
        <div className="text-[8px] text-gray-400 truncate flex-1">
          {form.phone || form.address ? `${form.phone || ''}${form.address ? '  ' + form.address.slice(0, 15) + '...' : ''}` : '電話・住所がここに表示されます'}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {form.larubot && <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-black text-white" style={{ background: '#4f46e5' }}>LB</div>}
        </div>
      </div>

      {/* Tags */}
      <div className="bg-[#0f172a] px-3 py-2 flex gap-1 flex-wrap">
        {form.industry && <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">{industry?.name}</span>}
        <span className="text-[8px] bg-white/10 text-slate-400 px-1.5 py-0.5 rounded font-mono">{heroBg.toUpperCase()}</span>
        {form.larubot && <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">LARUbot</span>}
        {form.laruseo && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">LARUSEO</span>}
      </div>
    </div>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [stepKey, setStepKey] = useState(0);
  const [slideDir, setSlideDir] = useState<'forward' | 'back'>('forward');
  const [form, setForm] = useState<FormData>({ ...defaultForm });
  const [generating, setGenerating] = useState(false);
  const [completedStepCount, setCompletedStepCount] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const goStep = (n: number) => {
    setSlideDir(n > step ? 'forward' : 'back');
    setStep(n);
    setStepKey(k => k + 1);
  };

  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // Auto-save form to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('laruHP_onboarding_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm(f => ({ ...f, ...parsed }));
        if (parsed.industry) setStep(2); // resume from step 2 (no animation on restore)
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('laruHP_onboarding_draft', JSON.stringify(form)); } catch {}
  }, [form]);

  // URL scan state
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    const ind = searchParams.get('industry');
    if (ind) {
      setForm(f => ({
        ...f,
        industry: ind,
        colorScheme: INDUSTRY_COLOR_MAP[ind] || f.colorScheme,
      }));
      goStep(2); // skip step 1 when coming from showcase/landing with ?industry=
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleIndustrySelect = (indId: string) => {
    const dm = INDUSTRY_DESIGN_MAP[indId];
    setForm(f => ({
      ...f,
      industry: indId,
      colorScheme: INDUSTRY_COLOR_MAP[indId] || f.colorScheme,
      ...(dm ? { primaryColor: dm.primaryColor, designStyle: dm.designStyle, fontFamily: dm.fontFamily } : {}),
    }));
    setTimeout(() => goStep(2), 350);
  };

  // Advance with Enter key (skip textarea focus)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (step < 5 && !generating && canNext()) goStep(Math.min(5, step + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, generating, form]);

  // Animate step-by-step progress during generation
  useEffect(() => {
    if (!generating) { setCompletedStepCount(0); return; }
    const delays = [700, 1600, 2800, 4200, 5600, 7000];
    const timers = delays.map((d, i) => setTimeout(() => setCompletedStepCount(i + 1), d));
    return () => timers.forEach(clearTimeout);
  }, [generating]);

  const updateForm = (key: keyof FormData, value: unknown) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const updateService = (i: number, key: string, value: string) => {
    const services = [...form.services];
    services[i] = { ...services[i], [key]: value };
    setForm(f => ({ ...f, services }));
  };

  const updateHour = (i: number, key: string, value: string | boolean) => {
    const hours = [...form.hours];
    hours[i] = { ...hours[i], [key]: value };
    setForm(f => ({ ...f, hours }));
  };

  const addService = () => {
    setForm(f => ({ ...f, services: [...f.services, { name: '', description: '', price: '' }] }));
  };

  const removeService = (i: number) => {
    setForm(f => ({ ...f, services: f.services.filter((_, idx) => idx !== i) }));
  };

  const handleScanUrl = async () => {
    const url = form.website.trim();
    if (!url) return;
    setScanning(true);
    setScanError('');
    setScanDone(false);
    try {
      const res = await fetch('/api/ai/scan-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setScanError(
          data.error === 'fetch_failed' ? 'サイトにアクセスできませんでした（サイト側がアクセスを制限している可能性があります）' :
          data.error === 'no_content' ? 'テキストコンテンツを取得できませんでした（JavaScriptで表示されるサイトは非対応）' :
          data.error === 'api_key_missing' ? 'AI機能が設定されていません（管理者にお問い合わせください）' :
          'スキャンに失敗しました。手動で入力してください。'
        );
        return;
      }
      const { extracted } = data;
      if (extracted) {
        if (extracted.businessName) updateForm('businessName', extracted.businessName);
        if (extracted.phone) updateForm('phone', extracted.phone);
        if (extracted.address) updateForm('address', extracted.address);
        if (extracted.email) updateForm('email', extracted.email);
        if (extracted.description) updateForm('description', extracted.description);
        if (extracted.catchphrase) updateForm('catchphrase', extracted.catchphrase);
        if (extracted.industry && !form.industry) updateForm('industry', extracted.industry);
        if (Array.isArray(extracted.services) && extracted.services.some((s: { name: string }) => s.name)) {
          updateForm('services', extracted.services.slice(0, 5).map((s: { name?: string; description?: string; price?: string }) => ({
            name: s.name || '',
            description: s.description || '',
            price: s.price || '',
          })));
        }
        setScanDone(true);
      }
    } catch {
      setScanError('スキャンに失敗しました。手動で入力してください。');
    } finally {
      setScanning(false);
    }
  };

  const handleGenerate = async () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 1200);
    setGenerating(true);
    setCompletedStepCount(0);

    let aiGenerated = null;
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        aiGenerated = data.generated;
      }
    } catch {}

    // Ensure at least 3 seconds of animation
    await new Promise(r => setTimeout(r, 3000));

    localStorage.setItem('laruHP_data', JSON.stringify({ ...form, aiGenerated }));
    localStorage.removeItem('laruHP_onboarding_draft');
    router.push('/laruHP/builder?from=onboarding');
  };

  const canNext = () => {
    if (step === 1) return !!form.industry;
    if (step === 2) return !!form.businessName;
    if (step === 3) return true;
    return true;
  };

const selectedIndustry = INDUSTRIES.find(i => i.id === form.industry);

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#030712]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/laruHP" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white text-black rounded-lg flex items-center justify-center font-black text-sm">L</div>
            <span className="font-bold tracking-tight">LARU<span className="text-blue-400 font-light">HP</span></span>
          </Link>
          <div className="flex flex-col items-end">
            <div className="text-slate-500 text-sm">サイト作成ウィザード</div>
            <div className="text-slate-600 text-[11px]">初月1円 · 最低6ヶ月契約</div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 pt-28 pb-20">
        {/* Mobile preview button */}
        <div className="lg:hidden flex justify-end mb-4">
          <button
            onClick={() => setShowMobilePreview(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-300 hover:bg-white/10 transition-all"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            プレビュー
          </button>
        </div>

        {/* Mobile preview modal */}
        {showMobilePreview && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end p-4">
            <div className="w-full max-w-sm mx-auto bg-[#0f172a] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  リアルタイムプレビュー
                </div>
                <button onClick={() => setShowMobilePreview(false)} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
              </div>
              <div className="p-4">
                <LivePreview form={form} />
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_320px] gap-10 items-start">
        <div>
        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((_s, i) => (
              <div key={i} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                  i + 1 < step ? 'bg-blue-500 text-white' :
                  i + 1 === step ? 'bg-white text-black' :
                  'bg-white/10 text-slate-500'
                }`}>
                  {i + 1 < step ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`hidden sm:block h-[1px] w-12 lg:w-20 mx-1 transition-all ${i + 1 < step ? 'bg-blue-500' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="hidden sm:flex justify-between text-[10px] text-slate-500 mt-1">
            {STEPS.map((s, i) => (
              <span key={i} className={i + 1 === step ? 'text-white font-bold' : ''}>{s}</span>
            ))}
          </div>
          <div className="sm:hidden mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400">STEP {step} / {STEPS.length}</span>
              <span className="text-xs text-white font-bold">{STEPS[step - 1]}</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-center text-[11px] text-slate-500 mt-2">
            このステップの目安: <span className="text-slate-400 font-semibold">{STEP_TIMES[step - 1]}</span>
            {step > 1 && <span className="ml-3">合計残り約{['4分30秒', '4分', '3分', '2分', '30秒'][step - 1]}</span>}
          </div>
        </div>

        {/* Animated step content wrapper */}
        <div
          key={stepKey}
          style={{ animation: `${slideDir === 'forward' ? 'stepSlideInRight' : 'stepSlideInLeft'} 0.22s ease-out` }}
        >

        {/* ─── Step 1: Industry ─────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">業種を選んでください</h2>
              <p className="text-slate-400">業種に最適化されたテンプレートとSEO設定が自動で適用されます。</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {INDUSTRIES.map(ind => (
                <button
                  key={ind.id}
                  onClick={() => handleIndustrySelect(ind.id)}
                  className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 relative ${
                    form.industry === ind.id
                      ? 'bg-blue-500/20 border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                      : 'bg-white/5 border-white/10 hover:border-white/30'
                  }`}
                >
                  {ind.popular && (
                    <span className="absolute top-2 right-2 text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full">人気</span>
                  )}
                  <div className="text-2xl mb-2">{ind.icon}</div>
                  <div className="font-bold text-sm mb-0.5">{ind.name}</div>
                  <div className="text-slate-500 text-xs leading-tight">{ind.desc}</div>
                </button>
              ))}
            </div>
            <p className="text-center text-slate-600 text-xs mt-6">選択すると自動で次のステップへ進みます</p>
          </div>
        )}

        {/* ─── Step 2: Business Info + URL Scan ────────────────── */}
        {step === 2 && (
          <div>
            {/* Industry breadcrumb */}
            {selectedIndustry && (
              <div className="flex items-center gap-2 mb-6 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5">
                <span className="text-xl">{selectedIndustry.icon}</span>
                <span className="text-sm text-white font-medium">{selectedIndustry.name}</span>
                <span className="text-slate-500 text-sm">でサイトを作成中</span>
                <button
                  onClick={() => goStep(1)}
                  className="ml-auto text-blue-400 hover:text-blue-300 text-xs transition-colors"
                >
                  変更
                </button>
              </div>
            )}
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">ビジネス情報を入力</h2>
              <p className="text-slate-400">AIがこの情報をもとにコンテンツを自動生成します。</p>
            </div>

            {/* URL Scan Card */}
            <div className="mb-8 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </div>
                <div>
                  <div className="font-bold text-sm text-white mb-0.5">既存サイトをAIスキャン（任意）</div>
                  <div className="text-slate-400 text-xs">既存のホームページがある場合、URLを入力してスキャンすると店舗名・電話番号・住所などを自動入力します。</div>
                </div>
              </div>

              {scanDone ? (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 flex-shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span className="text-green-400 text-sm font-bold">スキャン完了。フォームに自動入力しました。</span>
                  <button onClick={() => setScanDone(false)} className="ml-auto text-slate-500 hover:text-slate-300 text-xs">再スキャン</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.website}
                    onChange={e => updateForm('website', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleScanUrl()}
                    placeholder="https://your-shop.com"
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    onClick={handleScanUrl}
                    disabled={scanning || !form.website.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-bold transition-all whitespace-nowrap"
                  >
                    {scanning ? (
                      <>
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        解析中...
                      </>
                    ) : 'AIスキャン'}
                  </button>
                </div>
              )}
              {scanError && (
                <p className="text-red-400 text-xs mt-2">{scanError}</p>
              )}
            </div>

            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold mb-2">店舗・会社名 <span className="text-red-400">*</span></label>
                  <input type="text" value={form.businessName} onChange={e => updateForm('businessName', e.target.value)}
                    placeholder="例: 鈴木整体院"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">電話番号</label>
                  <input type="tel" value={form.phone} onChange={e => updateForm('phone', e.target.value)}
                    placeholder="例: 03-1234-5678"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">住所</label>
                <input type="text" value={form.address} onChange={e => updateForm('address', e.target.value)}
                  placeholder="例: 東京都渋谷区渋谷1-1-1 〇〇ビル2F"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">メールアドレス</label>
                <input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)}
                  placeholder="例: info@your-shop.com"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">キャッチフレーズ（任意）</label>
                <input type="text" value={form.catchphrase} onChange={e => updateForm('catchphrase', e.target.value)}
                  placeholder="例: 地域No.1の施術技術で、あなたの痛みを根本から解決"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">お店・会社の紹介文（任意）</label>
                <textarea value={form.description} onChange={e => updateForm('description', e.target.value)}
                  rows={3}
                  placeholder="例: 2010年に創業した整体院です。延べ10,000人以上の施術実績があり..."
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none" />
                <p className="text-slate-600 text-xs mt-1">空欄の場合はAIが自動生成します</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 3: Visual Template ─────────────────────────── */}
        {step === 3 && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">デザインを設定</h2>
              <p className="text-slate-400">ブランドカラー・スタイル・フォントを選んでください。後でエディタからいつでも変更できます。</p>
            </div>

            {/* Color picker */}
            <div className="mb-8 bg-white/[0.03] border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold mb-1">ブランドカラー</h3>
              <p className="text-slate-500 text-sm mb-5">サイトのメインカラーを自由に選べます。</p>
              <div className="flex items-center gap-6 mb-5">
                <div className="relative flex-shrink-0">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={e => updateForm('primaryColor', e.target.value)}
                    className="w-20 h-20 rounded-2xl border-2 border-white/20 cursor-pointer p-1 bg-transparent"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <div className="text-xl font-bold text-white font-mono tracking-wider">{form.primaryColor.toUpperCase()}</div>
                  <div className="text-slate-400 text-sm mt-0.5">メインカラー</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-5 h-5 rounded-md border border-white/20" style={{ background: form.primaryColor }} />
                    <span className="text-xs text-slate-500">ヒーロー・ボタン・アクセントに適用</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Font picker */}
            <div className="mb-8">
              <h3 className="font-bold mb-1">フォント</h3>
              <p className="text-slate-500 text-sm mb-4">業種選択時に自動設定済みです。変更も可能です。</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
                  { id: 'noto',    label: '標準ゴシック',  sub: '読みやすい万能フォント' },
                  { id: 'zen',     label: '太ゴシック',    sub: '力強く存在感がある' },
                  { id: 'mincho',  label: '明朝体',        sub: '上品・高級感・老舗感' },
                  { id: 'rounded', label: '丸ゴシック',    sub: 'やわらかく親しみやすい' },
                  { id: 'biz',     label: 'ビジネス',      sub: 'フォーマル・士業・金融' },
                  { id: 'kaisei',  label: 'カイセイ',      sub: '文芸的・アート系' },
                ] as const).map(f => (
                  <button
                    key={f.id}
                    onClick={() => updateForm('fontFamily', f.id)}
                    className={`rounded-2xl p-3 text-left transition-all border ${form.fontFamily === f.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}
                  >
                    {form.fontFamily === f.id && (
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center mb-2">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    )}
                    <div className="font-bold text-sm text-white">{f.label}</div>
                    <div className="text-slate-500 text-[11px] mt-0.5">{f.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Design style picker */}
            <div className="mb-2">
              <h3 className="font-bold mb-1">デザインスタイル</h3>
              <p className="text-slate-500 text-sm mb-4">セクション形状・アニメーション・エフェクトが変わります</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* modern */}
                {([
                  {
                    id: 'modern', label: 'モダン', sub: 'グラデ・ホバーリフト',
                    preview: (
                      <svg viewBox="0 0 120 64" className="w-full h-16" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#3b82f6"/>
                            <stop offset="100%" stopColor="#8b5cf6"/>
                          </linearGradient>
                        </defs>
                        <rect width="120" height="36" fill="url(#mg)" rx="8"/>
                        <text x="8" y="14" fontSize="7" fill="white" fontWeight="bold" opacity="0.6">COMPANY NAME</text>
                        <text x="8" y="26" fontSize="9" fill="white" fontWeight="bold">見出しテキスト</text>
                        <rect x="8" y="31" width="28" height="8" rx="9" fill="white" opacity="0.9"/>
                        <text x="22" y="37" fontSize="5" fill="#3b82f6" fontWeight="bold" textAnchor="middle">ボタン</text>
                        <rect x="4" y="42" width="52" height="18" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
                        <rect x="8" y="46" width="20" height="3" rx="1.5" fill="#475569"/>
                        <rect x="8" y="51" width="14" height="2" rx="1" fill="#334155"/>
                        <rect x="58" y="42" width="58" height="18" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="0.5" style={{filter:'drop-shadow(0 -2px 4px rgba(59,130,246,0.3))' }}/>
                        <rect x="62" y="46" width="20" height="3" rx="1.5" fill="#475569"/>
                        <rect x="62" y="51" width="14" height="2" rx="1" fill="#334155"/>
                      </svg>
                    ),
                  },
                  {
                    id: 'minimal', label: 'ミニマル', sub: 'フラット・左ボーダー',
                    preview: (
                      <svg viewBox="0 0 120 64" className="w-full h-16" xmlns="http://www.w3.org/2000/svg">
                        <rect width="120" height="28" fill="#f8fafc"/>
                        <line x1="0" y1="28" x2="120" y2="28" stroke="#e2e8f0" strokeWidth="0.5"/>
                        <text x="8" y="11" fontSize="6" fill="#94a3b8" letterSpacing="2">MINIMAL STUDIO</text>
                        <text x="8" y="22" fontSize="9" fill="#1e293b" fontWeight="bold">シンプルな美</text>
                        <rect x="100" y="8" width="14" height="5" rx="2" fill="none" stroke="#1e293b" strokeWidth="0.8"/>
                        <text x="107" y="12.5" fontSize="4" fill="#1e293b" textAnchor="middle">CTA</text>
                        <rect x="4" y="32" width="3" height="14" rx="0" fill="#3b82f6"/>
                        <rect x="12" y="34" width="32" height="3" rx="1" fill="#334155"/>
                        <rect x="12" y="39" width="20" height="2" rx="1" fill="#94a3b8"/>
                        <rect x="12" y="43" width="24" height="2" rx="1" fill="#94a3b8"/>
                        <rect x="62" y="32" width="3" height="14" rx="0" fill="#3b82f6"/>
                        <rect x="70" y="34" width="32" height="3" rx="1" fill="#334155"/>
                        <rect x="70" y="39" width="20" height="2" rx="1" fill="#94a3b8"/>
                        <rect x="70" y="43" width="24" height="2" rx="1" fill="#94a3b8"/>
                      </svg>
                    ),
                  },
                  {
                    id: 'bold', label: 'ボールド', sub: '斜めセクション・3D',
                    preview: (
                      <svg viewBox="0 0 120 64" className="w-full h-16" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="0,0 120,0 120,32 0,42" fill="#1e293b"/>
                        <polygon points="0,42 120,32 120,64 0,64" fill="#0f172a"/>
                        <text x="6" y="14" fontSize="10" fill="white" fontWeight="900">BOLD</text>
                        <text x="6" y="24" fontSize="5" fill="#94a3b8">力強いデザイン</text>
                        <rect x="6" y="27" width="26" height="9" rx="2" fill="#3b82f6"/>
                        <text x="19" y="33.5" fontSize="5" fill="white" fontWeight="bold" textAnchor="middle">ボタン</text>
                        <rect x="70" y="8" width="44" height="22" rx="3" fill="#1e3a5f" style={{filter:'drop-shadow(2px 4px 0 #0a0a0a)'}}>
                          <animateTransform attributeName="transform" type="rotate" from="0 92 19" to="0 92 19" dur="0s"/>
                        </rect>
                        <rect x="70" y="8" width="44" height="22" rx="3" fill="#1e3a5f" transform="skewY(-2)"/>
                        <rect x="74" y="13" width="20" height="3" rx="1" fill="#3b82f6" opacity="0.7"/>
                        <rect x="74" y="18" width="30" height="2" rx="1" fill="#475569"/>
                        <rect x="74" y="22" width="18" height="2" rx="1" fill="#475569"/>
                      </svg>
                    ),
                  },
                  {
                    id: 'elegant', label: 'エレガント', sub: 'ガラス・上品な余白',
                    preview: (
                      <svg viewBox="0 0 120 64" className="w-full h-16" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#831843"/>
                            <stop offset="100%" stopColor="#4c0519"/>
                          </linearGradient>
                        </defs>
                        <rect width="120" height="64" fill="url(#eg)"/>
                        <line x1="50" y1="4" x2="50" y2="60" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
                        <text x="60" y="16" fontSize="5" fill="rgba(255,255,255,0.5)" textAnchor="middle" letterSpacing="3">ELEGANT</text>
                        <text x="60" y="28" fontSize="9" fill="white" textAnchor="middle" fontStyle="italic">上質な美しさ</text>
                        <line x1="40" y1="32" x2="80" y2="32" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
                        <rect x="10" y="38" width="100" height="20" rx="4" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
                        <rect x="14" y="42" width="40" height="3" rx="1.5" fill="rgba(255,255,255,0.4)"/>
                        <rect x="14" y="47" width="25" height="2" rx="1" fill="rgba(255,255,255,0.2)"/>
                        <rect x="74" y="41" width="28" height="8" rx="2" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.7"/>
                        <text x="88" y="46.5" fontSize="5" fill="white" textAnchor="middle" opacity="0.8">予約する</text>
                      </svg>
                    ),
                  },
                  {
                    id: 'rounded', label: 'ラウンド', sub: '波形・ふんわり',
                    preview: (
                      <svg viewBox="0 0 120 64" className="w-full h-16" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#7c3aed"/>
                            <stop offset="100%" stopColor="#ec4899"/>
                          </linearGradient>
                        </defs>
                        <rect width="120" height="42" fill="url(#rg)"/>
                        <ellipse cx="60" cy="42" rx="80" ry="12" fill="#0f172a"/>
                        <circle cx="95" cy="15" r="14" fill="rgba(255,255,255,0.08)"/>
                        <circle cx="105" cy="8" r="8" fill="rgba(255,255,255,0.05)"/>
                        <text x="10" y="18" fontSize="9" fill="white" fontWeight="bold">やさしい</text>
                        <text x="10" y="27" fontSize="6" fill="rgba(255,255,255,0.7)">ふんわりデザイン</text>
                        <rect x="10" y="30" width="30" height="9" rx="9" fill="white" opacity="0.95"/>
                        <text x="25" y="36" fontSize="5" fill="#7c3aed" fontWeight="bold" textAnchor="middle">ボタン</text>
                        <rect x="10" y="48" width="30" height="12" rx="8" fill="#1e1b4b" opacity="0.8"/>
                        <rect x="50" y="48" width="30" height="12" rx="8" fill="#1e1b4b" opacity="0.8"/>
                        <rect x="90" y="48" width="26" height="12" rx="8" fill="#1e1b4b" opacity="0.8"/>
                      </svg>
                    ),
                  },
                  {
                    id: 'sharp', label: 'シャープ', sub: '角型・グリッチ',
                    preview: (
                      <svg viewBox="0 0 120 64" className="w-full h-16" xmlns="http://www.w3.org/2000/svg">
                        <rect width="120" height="64" fill="#030712"/>
                        <polygon points="0,0 90,0 75,36 0,36" fill="#111827"/>
                        <rect x="0" y="0" width="2" height="36" fill="#3b82f6"/>
                        <rect x="0" y="36" width="75" height="1" fill="#3b82f6" opacity="0.6"/>
                        <text x="8" y="14" fontSize="6" fill="#3b82f6" fontWeight="900" letterSpacing="1">// SHARP</text>
                        <text x="8" y="25" fontSize="8" fill="white" fontWeight="900">鋭利なUI</text>
                        <rect x="8" y="28" width="28" height="7" rx="0" fill="#3b82f6"/>
                        <text x="22" y="33.5" fontSize="5" fill="white" fontWeight="bold" textAnchor="middle">ボタン</text>
                        <rect x="80" y="4" width="36" height="28" rx="0" fill="#111827" stroke="#1f2937" strokeWidth="0.5"/>
                        <rect x="80" y="4" width="36" height="2" fill="#3b82f6" opacity="0.5"/>
                        <rect x="84" y="10" width="20" height="3" rx="0" fill="#374151"/>
                        <rect x="84" y="15" width="26" height="2" rx="0" fill="#1f2937"/>
                        <rect x="84" y="19" width="16" height="2" rx="0" fill="#1f2937"/>
                        <rect x="84" y="24" width="20" height="5" rx="0" fill="#3b82f6" opacity="0.8"/>
                        <text x="94" y="28" fontSize="4" fill="white" textAnchor="middle">CTA</text>
                        <rect x="0" y="42" width="120" height="1" fill="#1f2937"/>
                        <rect x="0" y="43" width="38" height="0.5" fill="#3b82f6" opacity="0.4"/>
                        <rect x="4" y="46" width="50" height="3" rx="0" fill="#1f2937"/>
                        <rect x="4" y="51" width="35" height="2" rx="0" fill="#111827"/>
                        <rect x="4" y="55" width="42" height="2" rx="0" fill="#111827"/>
                        <rect x="62" y="46" width="50" height="3" rx="0" fill="#1f2937"/>
                        <rect x="62" y="51" width="35" height="2" rx="0" fill="#111827"/>
                      </svg>
                    ),
                  },
                ] as const).map(s => (
                  <button
                    key={s.id}
                    onClick={() => updateForm('designStyle', s.id)}
                    className={`rounded-2xl overflow-hidden text-left transition-all border-2 ${form.designStyle === s.id ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-white/10 hover:border-white/25'}`}
                  >
                    <div className="bg-[#0a0f1e] p-2">{s.preview}</div>
                    <div className={`px-3 py-2 ${form.designStyle === s.id ? 'bg-blue-500/15' : 'bg-white/[0.03]'}`}>
                      <div className="font-bold text-sm text-white">{s.label}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">{s.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ─── Step 4: Content ─────────────────────────────────── */}
        {step === 4 && (
          <div>
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold mb-2">コンテンツを入力</h2>
                <p className="text-slate-400">空欄の場合はAIが自動生成します。後でエディタから編集もできます。</p>
              </div>
              <button
                onClick={() => goStep(5)}
                className="flex-shrink-0 mt-1 text-xs text-slate-500 hover:text-slate-300 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-all"
              >
                スキップ → AIに任せる
              </button>
            </div>

            {/* Services */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">サービス・料金メニュー</h3>
                <button onClick={addService} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">+ 追加</button>
              </div>
              <div className="space-y-3">
                {form.services.map((svc, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-bold text-slate-400">サービス {i + 1}</span>
                      {form.services.length > 1 && (
                        <button onClick={() => removeService(i)} className="text-slate-500 hover:text-red-400 text-xs transition-colors">削除</button>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <input type="text" placeholder="サービス名" value={svc.name}
                        onChange={e => updateService(i, 'name', e.target.value)}
                        className="bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                      <input type="text" placeholder="説明（任意）" value={svc.description}
                        onChange={e => updateService(i, 'description', e.target.value)}
                        className="bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                      <input type="text" placeholder="料金（例: 3,000円）" value={svc.price}
                        onChange={e => updateService(i, 'price', e.target.value)}
                        className="bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Business Hours */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">営業時間</h3>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {HOURS_PRESETS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => setForm(f => ({ ...f, hours: p.fn(f.hours) }))}
                      className="text-[11px] px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-slate-400 hover:text-white transition-all"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                {form.hours.map((hour, i) => (
                  <div key={i} className={`flex items-center gap-3 sm:gap-4 px-4 py-3 ${i < form.hours.length - 1 ? 'border-b border-white/5' : ''} ${hour.closed ? 'opacity-50' : ''}`}>
                    <span className="w-14 text-sm text-slate-400 flex-shrink-0">{hour.day}</span>
                    <input type="time" value={hour.open} onChange={e => updateHour(i, 'open', e.target.value)} disabled={hour.closed}
                      className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-30 w-24" />
                    <span className="text-slate-500 text-sm">〜</span>
                    <input type="time" value={hour.close} onChange={e => updateHour(i, 'close', e.target.value)} disabled={hour.closed}
                      className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-30 w-24" />
                    <label className="flex items-center gap-2 ml-auto cursor-pointer">
                      <input type="checkbox" checked={hour.closed} onChange={e => updateHour(i, 'closed', e.target.checked)} className="w-4 h-4 accent-red-500" />
                      <span className="text-sm text-slate-400 whitespace-nowrap">定休日</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 5: Confirm & Generate ──────────────────────── */}
        {step === 5 && (
          <div>
            {generating ? (
              <div className="py-16 max-w-sm mx-auto">
                <div className="text-center mb-10">
                  <div className="relative w-16 h-16 mx-auto mb-5">
                    <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
                    <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-purple-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                    <div className="absolute inset-0 flex items-center justify-center text-xl">
                      {selectedIndustry?.icon}
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold mb-1">AIがサイトを生成中</h2>
                  <p className="text-slate-500 text-sm">{selectedIndustry?.name}に最適化したコンテンツを作っています</p>
                </div>

                {/* Step-by-step checklist */}
                <div className="space-y-3">
                  {GENERATE_STEPS.map((label, i) => {
                    const done = i < completedStepCount;
                    const active = i === completedStepCount;
                    return (
                      <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 ${
                        done ? 'bg-green-500/10 border border-green-500/20' :
                        active ? 'bg-blue-500/10 border border-blue-500/30' :
                        'bg-white/[0.03] border border-white/5 opacity-40'
                      }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          done ? 'bg-green-500' : active ? 'bg-blue-500/30' : 'bg-white/10'
                        }`}>
                          {done ? (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          ) : active ? (
                            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-white/20" />
                          )}
                        </div>
                        <span className={`text-sm font-medium ${done ? 'text-green-400' : active ? 'text-white' : 'text-slate-600'}`}>
                          {label}
                        </span>
                        {done && <span className="ml-auto text-green-500 text-xs">完了</span>}
                        {active && <span className="ml-auto text-blue-400 text-xs animate-pulse">処理中...</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold mb-2">確認・生成</h2>
                  <p className="text-slate-400">入力内容を確認してAI生成を開始してください。</p>
                </div>

                <div className="space-y-4 mb-10">
                  {/* Summary cards */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-sm">基本情報</h3>
                      <button onClick={() => goStep(2)} className="text-blue-400 text-xs hover:text-blue-300">編集</button>
                    </div>
                    <div className="space-y-1.5 text-sm text-slate-300">
                      <div><span className="text-slate-500">業種: </span>{selectedIndustry?.name}</div>
                      <div>
                        <span className="text-slate-500">店舗名: </span>
                        {form.businessName || <span className="text-amber-400 text-xs">未入力（必須）</span>}
                      </div>
                      <div>
                        <span className="text-slate-500">電話: </span>
                        {form.phone || <span className="text-slate-600 text-xs">AIが補完</span>}
                      </div>
                      {form.address && <div><span className="text-slate-500">住所: </span>{form.address}</div>}
                      {form.email && <div><span className="text-slate-500">メール: </span>{form.email}</div>}
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-sm">デザインテンプレート</h3>
                      <button onClick={() => goStep(3)} className="text-blue-400 text-xs hover:text-blue-300">編集</button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-8 rounded-lg flex-shrink-0 border border-white/10" style={{ background: form.primaryColor }} />
                      <div>
                        <div className="text-sm font-bold text-white font-mono">{form.primaryColor.toUpperCase()}</div>
                        <div className="text-slate-500 text-xs">{form.designStyle} / {form.fontFamily}</div>
                      </div>
                      <div className="ml-auto flex gap-1.5">
                        {form.larubot && <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full">LARUbot</span>}
                        {form.laruseo && <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full">LARUSEO</span>}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-sm">サービス内容</h3>
                      <button onClick={() => goStep(4)} className="text-blue-400 text-xs hover:text-blue-300">編集</button>
                    </div>
                    {form.services.filter(s => s.name).length > 0 ? (
                      <div className="space-y-1">
                        {form.services.filter(s => s.name).map((s, i) => (
                          <div key={i} className="text-sm text-slate-300 flex items-center gap-2">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-emerald-400 flex-shrink-0"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            {s.name}{s.price && ` — ${s.price}`}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">AIが業種に合わせて自動生成します</p>
                    )}
                  </div>

                  {/* AI features notice */}
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                      </div>
                      <div>
                        <div className="font-bold text-sm text-purple-300 mb-1">AIが自動で生成するもの</div>
                        <div className="text-xs text-slate-400 space-y-0.5">
                          <div>・キャッチコピー・ヒーロー見出し（業種×地域最適化）</div>
                          <div>・会社・店舗紹介文（180〜220文字）</div>
                          <div>・3つの強み（アイコン付き）</div>
                          <div>・よくある質問（FAQ）4項目</div>
                          <div>・お客様の声 3件（業種別リアル感想）</div>
                          <div>・SEOタイトル・メタディスクリプション</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upsell options */}
                <div className="mb-6 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-sm text-white">集客を加速するオプション（任意）</h3>
                    <span className="text-[10px] text-slate-500">サイト完成後にいつでも追加できます</span>
                  </div>

                  {/* LARUbot */}
                  <div className="rounded-2xl border border-indigo-500/25 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(10,10,20,0.95) 100%)' }}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center flex-shrink-0 text-xl">🤖</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">LARUbot</span>
                            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full font-bold">HP+Botプラン ¥4,980/月</span>
                          </div>
                          <p className="text-slate-400 text-xs mt-0.5">AIチャットボット — 問い合わせを24時間自動対応</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        {[
                          { icon: '💬', text: '「営業時間は？」「予約したい」にAIが即答' },
                          { icon: '🌙', text: '深夜・休日も無人対応。機会損失をなくす' },
                        ].map((b, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                            <span className="text-sm">{b.icon}</span>
                            <span>{b.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-indigo-500/20 px-4 py-2.5 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">HP単体プランからでもあとで追加可能</span>
                      <span className="text-[11px] text-indigo-400 font-bold">初月1円で試せる</span>
                    </div>
                  </div>

                  {/* LARUSEO */}
                  <div className="rounded-2xl border border-emerald-500/25 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(10,10,20,0.95) 100%)' }}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0 text-xl">📈</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">LARUSEO</span>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">Bot+SEOプラン ¥9,800/月</span>
                          </div>
                          <p className="text-slate-400 text-xs mt-0.5">AIブログ自動生成 — Googleで上位表示を狙う</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        {[
                          { icon: '✍️', text: 'SEO最適化ブログをAIが毎週自動投稿。更新不要' },
                          { icon: '🔍', text: '「地域名 + 業種」でGoogle上位を目指す' },
                        ].map((b, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                            <span className="text-sm">{b.icon}</span>
                            <span>{b.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-emerald-500/20 px-4 py-2.5 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">LARUbotもセットで含まれます</span>
                      <span className="text-[11px] text-emerald-400 font-bold">初月1円で試せる</span>
                    </div>
                  </div>
                </div>

                {/* Generate button with confetti */}
                <div className="relative">
                  {showConfetti && (
                    <div className="absolute inset-0 pointer-events-none overflow-visible z-10">
                      {Array.from({ length: 18 }, (_, i) => (
                        <div
                          key={i}
                          className="absolute w-2 h-2 rounded-sm"
                          style={{
                            left: `${(i % 9) * 11 + 5}%`,
                            top: '50%',
                            background: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'][i % 6],
                            '--a': `${i * 20 - 10}deg`,
                            '--d': `${-60 - (i % 4) * 25}px`,
                            animation: 'confettiBurst 0.9s ease-out forwards',
                            animationDelay: `${(i % 5) * 0.04}s`,
                          } as React.CSSProperties}
                        />
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleGenerate}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-5 rounded-2xl font-bold text-lg transition-all shadow-[0_0_40px_rgba(59,130,246,0.3)] hover:shadow-[0_0_60px_rgba(59,130,246,0.4)] hover:scale-[1.02]"
                  >
                    AIでサイトを生成する →
                  </button>
                </div>
                <p className="text-center text-slate-600 text-xs mt-4">
                  生成後はビジュアルエディタで自由に編集できます
                </p>
              </div>
            )}
          </div>
        )}

        </div>{/* /animated step wrapper */}

        {/* Navigation */}
        {step < 5 && !generating && (
          <div className="flex justify-between mt-10">
            {step === 1 ? (
              <Link href="/laruHP" className="px-6 py-3 rounded-xl border border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/30 transition-all text-sm">
                ← トップへ戻る
              </Link>
            ) : (
              <button
                onClick={() => goStep(step - 1)}
                className="px-6 py-3 rounded-xl border border-white/10 text-slate-300 hover:border-white/30 transition-all"
              >
                ← 戻る
              </button>
            )}
            <button
              onClick={() => goStep(Math.min(5, step + 1))}
              disabled={!canNext()}
              className="px-8 py-3 bg-white text-black rounded-xl font-bold hover:scale-105 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              次へ →
            </button>
          </div>
        )}
        </div>{/* /left column */}

        {/* Right: Live Preview (desktop) */}
        <div className="hidden lg:block sticky top-28">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 font-bold uppercase tracking-wider">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            リアルタイムプレビュー
          </div>
          <LivePreview form={form} />
          <p className="text-center text-[10px] text-slate-600 mt-3">入力内容がリアルタイムに反映されます</p>
        </div>
      </div>{/* /grid */}
      </div>{/* /max-w-6xl */}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes progress { 0% { width: 0% } 100% { width: 100% } }
      `}} />
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <div className="text-slate-400">読み込み中...</div>
        </div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
