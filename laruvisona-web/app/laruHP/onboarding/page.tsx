'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const INDUSTRIES = [
  { id: 'restaurant',   name: '飲食店・カフェ',     desc: 'レストラン、居酒屋、カフェ、ラーメン店など',         color: 'orange' },
  { id: 'beauty',       name: '美容室・サロン',     desc: '美容室、ネイルサロン、エステ、スパなど',            color: 'pink' },
  { id: 'clinic',       name: '整体・クリニック',   desc: '整体院、接骨院、歯科、医療クリニックなど',          color: 'teal' },
  { id: 'legal',        name: '士業・コンサル',     desc: '弁護士、税理士、行政書士、コンサルタントなど',      color: 'indigo' },
  { id: 'construction', name: '建設・工務店',       desc: 'リフォーム、建設、内装工事、外構など',              color: 'yellow' },
  { id: 'realestate',   name: '不動産',             desc: '賃貸仲介、売買、管理、不動産投資など',              color: 'blue' },
  { id: 'retail',       name: '小売・EC',           desc: '実店舗、オンラインショップ、専門店など',            color: 'purple' },
  { id: 'fitness',      name: 'フィットネス・ジム', desc: 'パーソナルジム、ヨガスタジオ、スポーツクラブなど', color: 'green' },
  { id: 'hotel',        name: 'ホテル・旅館',       desc: 'ホテル、旅館、民泊、グランピングなど',              color: 'amber' },
  { id: 'education',    name: '教育・スクール',     desc: '塾、教室、スクール、研修機関など',                  color: 'cyan' },
  { id: 'wedding',      name: '結婚式場・イベント', desc: 'ウェディング、イベントホール、パーティーなど',      color: 'rose' },
  { id: 'pet',          name: 'ペットサロン',       desc: 'トリミング、ペットホテル、動物病院など',            color: 'lime' },
  { id: 'other',        name: 'その他',             desc: '上記に当てはまらない業種',                          color: 'slate' },
];

const TEMPLATE_PRESETS = [
  {
    id: 'professional-blue',
    name: 'プロフェッショナル',
    desc: '信頼感・実績を前面に',
    colorScheme: 'professional-blue',
    style: 'elegant',
    hero: { bg: '#1e3a8a', accent: '#3b82f6' },
    card: { bg: '#eff6ff', stripe: '#bfdbfe' },
  },
  {
    id: 'warm-earth',
    name: 'ナチュラル・温かみ',
    desc: '親しみやすく地域密着',
    colorScheme: 'warm-earth',
    style: 'warm',
    hero: { bg: '#78350f', accent: '#d97706' },
    card: { bg: '#fef9f0', stripe: '#fed7aa' },
  },
  {
    id: 'elegant-dark',
    name: 'エレガント・高級感',
    desc: '上品で洗練された印象',
    colorScheme: 'elegant-dark',
    style: 'elegant',
    hero: { bg: '#111827', accent: '#9ca3af' },
    card: { bg: '#f9fafb', stripe: '#e5e7eb' },
  },
  {
    id: 'fresh-green',
    name: 'フレッシュ・健康的',
    desc: '活力・清潔感のある印象',
    colorScheme: 'fresh-green',
    style: 'modern',
    hero: { bg: '#064e3b', accent: '#10b981' },
    card: { bg: '#f0fdf4', stripe: '#a7f3d0' },
  },
  {
    id: 'modern-pink',
    name: 'キュート・フェミニン',
    desc: 'おしゃれで可愛らしい印象',
    colorScheme: 'modern-pink',
    style: 'warm',
    hero: { bg: '#831843', accent: '#ec4899' },
    card: { bg: '#fdf2f8', stripe: '#fbcfe8' },
  },
  {
    id: 'bold-orange',
    name: 'アクティブ・エネルギー',
    desc: '活発でエネルギッシュな印象',
    colorScheme: 'bold-orange',
    style: 'bold',
    hero: { bg: '#7c2d12', accent: '#f97316' },
    card: { bg: '#fff7ed', stripe: '#fed7aa' },
  },
];

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
    { name: '', description: '', price: '' },
    { name: '', description: '', price: '' },
  ],
  hours: defaultHours,
  colorScheme: 'professional-blue',
  style: 'modern',
  larubot: true,
  laruseo: true,
};

const STEPS = ['業種選択', 'ビジネス情報', 'デザイン', 'コンテンツ', '確認・生成'];
const STEP_TIMES = ['約30秒', '約1分', '約1分', '約2分', '約30秒'];

const GENERATE_MESSAGES = [
  'AIがビジネス情報を解析中...',
  'キャッチコピーを生成中...',
  '紹介文・よくある質問を作成中...',
  'SEO設定を最適化中...',
  'テンプレートにデータを適用中...',
  'もう少しで完成です...',
];

// Visual CSS mockup for each template
function TemplateMockup({ preset, selected, onClick }: {
  preset: typeof TEMPLATE_PRESETS[0];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl overflow-hidden border-2 transition-all text-left hover:-translate-y-1 hover:shadow-2xl ${
        selected
          ? 'border-blue-500 shadow-[0_0_24px_rgba(59,130,246,0.4)]'
          : 'border-white/10 hover:border-white/30'
      }`}
    >
      {/* Hero mockup */}
      <div style={{ background: preset.hero.bg }} className="px-3 pt-3 pb-5">
        {/* Nav bar */}
        <div className="flex items-center gap-1 mb-4">
          <div className="w-3 h-2 rounded-sm bg-white/50" />
          <div className="ml-auto flex gap-1.5">
            {[1,2,3,4].map(i => <div key={i} className="w-5 h-1 rounded bg-white/25" />)}
          </div>
        </div>
        {/* Hero content */}
        <div className="text-center pb-1">
          <div className="w-24 h-2 mx-auto mb-2 rounded-full bg-white/60" />
          <div className="w-32 h-1.5 mx-auto mb-1 rounded-full bg-white/35" />
          <div className="w-28 h-1 mx-auto mb-4 rounded-full bg-white/25" />
          <div className="w-14 h-5 mx-auto rounded-lg flex items-center justify-center" style={{ background: preset.hero.accent }}>
            <div className="w-10 h-1 rounded bg-white/80" />
          </div>
        </div>
      </div>
      {/* Content blocks */}
      <div style={{ background: preset.card.bg }} className="px-3 py-3 space-y-2.5">
        <div className="w-20 h-1.5 mx-auto rounded-full" style={{ background: preset.card.stripe }} />
        <div className="grid grid-cols-3 gap-1.5">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-lg p-1.5" style={{ background: preset.card.stripe, opacity: 0.6 }}>
              <div className="w-full h-5 rounded mb-1 bg-white/50" />
              <div className="w-3/4 h-1 rounded bg-white/40" />
            </div>
          ))}
        </div>
        <div className="space-y-1 pt-0.5">
          <div className="h-1 rounded-full" style={{ background: preset.card.stripe, opacity: 0.5 }} />
          <div className="h-1 w-5/6 rounded-full" style={{ background: preset.card.stripe, opacity: 0.4 }} />
          <div className="h-1 w-4/5 rounded-full" style={{ background: preset.card.stripe, opacity: 0.3 }} />
        </div>
        <div className="w-12 h-4 mx-auto rounded-lg" style={{ background: preset.hero.accent, opacity: 0.7 }} />
      </div>
      {/* Label */}
      <div className="bg-[#0f172a] px-3 py-2.5 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-white">{preset.name}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{preset.desc}</div>
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        )}
      </div>
    </button>
  );
}

function LivePreview({ form }: { form: FormData }) {
  const preset = TEMPLATE_PRESETS.find(t => t.colorScheme === form.colorScheme) || TEMPLATE_PRESETS[0];
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
      <div className="flex items-center justify-between px-3 py-2" style={{ background: preset.hero.bg }}>
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
      <div className="px-4 py-6 text-center" style={{ background: preset.hero.bg }}>
        {industry && (
          <div className="inline-block text-[8px] font-bold px-2 py-0.5 rounded-full mb-2 border"
            style={{ background: preset.hero.accent + '25', color: preset.hero.accent, borderColor: preset.hero.accent + '50' }}>
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
          <div className="px-3 py-1 rounded-full text-[9px] font-bold text-white" style={{ background: preset.hero.accent }}>
            お問い合わせ
          </div>
          <div className="px-3 py-1 rounded-full text-[9px] border border-white/20 text-white/60">
            詳しく見る
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="px-3 py-3" style={{ background: preset.card.bg }}>
        <div className="text-[9px] font-bold text-center mb-2" style={{ color: preset.hero.bg }}>
          {filledServices.length > 0 ? 'サービス・メニュー' : 'サービス（AI生成）'}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(filledServices.length > 0 ? filledServices : [{ name: 'サービス1', price: '' }, { name: 'サービス2', price: '' }, { name: 'サービス3', price: '' }]).slice(0, 3).map((s, i) => (
            <div key={i} className="rounded-lg p-1.5 text-center" style={{ background: preset.card.stripe, opacity: filledServices.length > 0 ? 1 : 0.5 }}>
              <div className="text-[8px] font-bold truncate" style={{ color: preset.hero.bg }}>{s.name}</div>
              {s.price && <div className="text-[7px] mt-0.5" style={{ color: preset.hero.accent }}>{s.price}</div>}
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
        <span className="text-[8px] bg-white/10 text-slate-400 px-1.5 py-0.5 rounded">{preset.name}</span>
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
  const [form, setForm] = useState<FormData>({ ...defaultForm });
  const [generating, setGenerating] = useState(false);
  const [generateMsgIdx, setGenerateMsgIdx] = useState(0);

  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // Auto-save form to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('laruHP_onboarding_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm(f => ({ ...f, ...parsed }));
        if (parsed.industry) setStep(2); // resume from step 2 if industry already chosen
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('laruHP_onboarding_draft', JSON.stringify(form)); } catch {}
  }, [form]);

  // URL scan state
  const [scanUrl, setScanUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    const ind = searchParams.get('industry');
    if (ind) setForm(f => ({ ...f, industry: ind }));
  }, [searchParams]);

  // Cycle through generate messages
  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(() => {
      setGenerateMsgIdx(i => (i + 1) % GENERATE_MESSAGES.length);
    }, 1400);
    return () => clearInterval(interval);
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
    const url = scanUrl.trim();
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
    setGenerating(true);
    setGenerateMsgIdx(0);

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
    if (step === 3) return !!form.colorScheme;
    return true;
  };

  const selectTemplate = (preset: typeof TEMPLATE_PRESETS[0]) => {
    updateForm('colorScheme', preset.colorScheme);
    updateForm('style', preset.style);
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
          <div className="text-slate-500 text-sm">サイト作成ウィザード</div>
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
          <div className="sm:hidden text-center text-sm text-white font-bold mt-2">
            STEP {step} / {STEPS.length}: {STEPS[step - 1]}
          </div>
          <div className="text-center text-[11px] text-slate-500 mt-2">
            このステップの目安: <span className="text-slate-400 font-semibold">{STEP_TIMES[step - 1]}</span>
            {step > 1 && <span className="ml-3">合計残り約{['4分30秒', '4分', '3分', '2分', '30秒'][step - 1]}</span>}
          </div>
        </div>

        {/* ─── Step 1: Industry ─────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-black mb-2">業種を選んでください</h2>
              <p className="text-slate-400">業種に最適化されたテンプレートとSEO設定が自動で適用されます。</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {INDUSTRIES.map(ind => (
                <button
                  key={ind.id}
                  onClick={() => updateForm('industry', ind.id)}
                  className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 ${
                    form.industry === ind.id
                      ? 'bg-blue-500/20 border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                      : 'bg-white/5 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="font-bold text-sm mb-0.5">{ind.name}</div>
                  <div className="text-slate-500 text-xs leading-tight">{ind.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Step 2: Business Info + URL Scan ────────────────── */}
        {step === 2 && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-black mb-2">ビジネス情報を入力</h2>
              <p className="text-slate-400">AIがこの情報をもとにコンテンツを自動生成します。</p>
            </div>

            {/* URL Scan Card */}
            <div className="mb-8 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </div>
                <div>
                  <div className="font-bold text-sm text-white mb-0.5">既存サイトをAIスキャン</div>
                  <div className="text-slate-400 text-xs">既存のホームページがある場合、URLを入力するとAIが情報を自動抽出してフォームに入力します。</div>
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
                    value={scanUrl}
                    onChange={e => setScanUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleScanUrl()}
                    placeholder="https://your-shop.com"
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    onClick={handleScanUrl}
                    disabled={scanning || !scanUrl.trim()}
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
                  <label className="block text-sm font-bold mb-2">電話番号 <span className="text-red-400">*</span></label>
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

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold mb-2">メールアドレス</label>
                  <input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)}
                    placeholder="例: info@your-shop.com"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">既存サイトURL（スキャン用）</label>
                  <input type="url" value={form.website} onChange={e => updateForm('website', e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
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
              <h2 className="text-3xl font-black mb-2">デザインテンプレートを選択</h2>
              <p className="text-slate-400">サイト全体の雰囲気が決まります。後でエディタからいつでも変更できます。</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {TEMPLATE_PRESETS.map(preset => (
                <TemplateMockup
                  key={preset.id}
                  preset={preset}
                  selected={form.colorScheme === preset.colorScheme}
                  onClick={() => selectTemplate(preset)}
                />
              ))}
            </div>

            <div className="mt-10">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-base text-white">集客を加速するオプション</h3>
              </div>
              <p className="text-slate-500 text-xs mb-4">HP作成後にプランを選ぶ際に追加できます。まずは内容を確認してください。</p>
              <div className="space-y-3">

                {/* LARUbot */}
                <div className="rounded-2xl border border-indigo-500/25 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(10,10,20,0.95) 100%)' }}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center flex-shrink-0 text-xl">🤖</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-white text-sm">LARUbot</span>
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full font-bold">HP+Botプラン ¥4,980/月</span>
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">AIチャットボット — 問い合わせを24時間自動対応</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {[
                        { icon: '💬', text: '「営業時間は？」「予約したい」にAIが即答' },
                        { icon: '📊', text: '月の問い合わせをゼロにできる — 対応工数90%削減' },
                        { icon: '🌙', text: '深夜・休日も無人対応。機会損失をなくす' },
                      ].map((b, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                          <span className="text-sm">{b.icon}</span>
                          <span>{b.text}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <a
                        href="https://laruvisona.jp/larubot"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
                      >
                        LARUbotの詳細を見る →
                      </a>
                      <span className="text-slate-600 text-[10px]">laruvisona.jp</span>
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
                          <span className="font-black text-white text-sm">LARUSEO</span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">Bot+SEOプラン ¥9,800/月</span>
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">AIブログ自動生成 — Googleで上位表示を狙う</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {[
                        { icon: '✍️', text: 'SEO最適化ブログをAIが毎週自動投稿。更新不要' },
                        { icon: '🔍', text: '「地域名 + 業種」でGoogle上位を目指す' },
                        { icon: '📣', text: '広告費ゼロで集客できる仕組みを自動構築' },
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
            </div>
          </div>
        )}

        {/* ─── Step 4: Content ─────────────────────────────────── */}
        {step === 4 && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-black mb-2">コンテンツを入力</h2>
              <p className="text-slate-400">空欄の場合はAIが自動生成します。後でエディタから編集もできます。</p>
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
              <h3 className="font-bold mb-4">営業時間</h3>
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
              <div className="text-center py-20">
                {/* Animated spinner */}
                <div className="relative w-24 h-24 mx-auto mb-8">
                  <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
                  <div className="absolute inset-3 rounded-full border-2 border-transparent border-t-purple-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <h2 className="text-2xl font-black mb-3">AIがサイトを生成中</h2>
                <p className="text-blue-400 font-medium mb-2 transition-all">{GENERATE_MESSAGES[generateMsgIdx]}</p>
                <p className="text-slate-500 text-sm">{selectedIndustry?.name}に最適化されたサイトを構築しています</p>

                {/* Progress bar */}
                <div className="mt-8 w-full max-w-xs mx-auto">
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400 rounded-full animate-[progress_4s_ease-in-out_forwards]" />
                  </div>
                </div>

                {/* Feature chips */}
                <div className="flex flex-wrap justify-center gap-2 mt-8">
                  {['コピーライティング', 'SEO最適化', 'FAQ生成', 'お客様の声', 'レイアウト設計'].map((f, i) => (
                    <span key={f} className="text-xs px-3 py-1 rounded-full border border-white/10 text-slate-400" style={{ animationDelay: `${i * 0.3}s` }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-8">
                  <h2 className="text-3xl font-black mb-2">確認・生成</h2>
                  <p className="text-slate-400">入力内容を確認してAI生成を開始してください。</p>
                </div>

                <div className="space-y-4 mb-10">
                  {/* Summary cards */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-sm">基本情報</h3>
                      <button onClick={() => setStep(2)} className="text-blue-400 text-xs hover:text-blue-300">編集</button>
                    </div>
                    <div className="space-y-1.5 text-sm text-slate-300">
                      <div><span className="text-slate-500">業種: </span>{selectedIndustry?.name}</div>
                      <div><span className="text-slate-500">店舗名: </span>{form.businessName || '未入力'}</div>
                      <div><span className="text-slate-500">電話: </span>{form.phone || '未入力'}</div>
                      {form.address && <div><span className="text-slate-500">住所: </span>{form.address}</div>}
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-sm">デザインテンプレート</h3>
                      <button onClick={() => setStep(3)} className="text-blue-400 text-xs hover:text-blue-300">編集</button>
                    </div>
                    <div className="flex items-center gap-3">
                      {(() => {
                        const p = TEMPLATE_PRESETS.find(t => t.colorScheme === form.colorScheme);
                        return p ? (
                          <>
                            <div className="w-12 h-8 rounded-lg overflow-hidden flex-shrink-0" style={{ background: p.hero.bg }}>
                              <div className="h-full flex items-end p-1">
                                <div className="w-full h-2 rounded" style={{ background: p.hero.accent, opacity: 0.6 }} />
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white">{p.name}</div>
                              <div className="text-slate-500 text-xs">{p.desc}</div>
                            </div>
                          </>
                        ) : null;
                      })()}
                      <div className="ml-auto flex gap-1.5">
                        {form.larubot && <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full">LARUbot</span>}
                        {form.laruseo && <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full">LARUSEO</span>}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-sm">サービス内容</h3>
                      <button onClick={() => setStep(4)} className="text-blue-400 text-xs hover:text-blue-300">編集</button>
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
                          <div>・会社・店舗紹介文（150〜200文字）</div>
                          <div>・よくある質問（FAQ）3項目</div>
                          <div>・お客様の声 3件（業種別リアル感想）</div>
                          <div>・SEOタイトル・メタディスクリプション</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-5 rounded-2xl font-black text-lg transition-all shadow-[0_0_40px_rgba(59,130,246,0.3)] hover:shadow-[0_0_60px_rgba(59,130,246,0.4)] hover:scale-[1.02]"
                >
                  AIでサイトを生成する →
                </button>
                <p className="text-center text-slate-600 text-xs mt-4">
                  生成後はビジュアルエディタで自由に編集できます
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        {step < 5 && !generating && (
          <div className="flex justify-between mt-10">
            <button
              onClick={() => setStep(s => Math.max(1, s - 1))}
              className={`px-6 py-3 rounded-xl border border-white/10 text-slate-300 hover:border-white/30 transition-all ${step === 1 ? 'invisible' : ''}`}
            >
              ← 戻る
            </button>
            <button
              onClick={() => setStep(s => Math.min(5, s + 1))}
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
