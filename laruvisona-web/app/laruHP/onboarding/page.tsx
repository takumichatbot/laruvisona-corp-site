'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const INDUSTRIES = [
  { id: 'restaurant', emoji: '🍜', name: '飲食店・カフェ', desc: 'レストラン、居酒屋、カフェ、ラーメン店など', color: 'orange' },
  { id: 'beauty', emoji: '💇', name: '美容室・サロン', desc: '美容室、ネイルサロン、エステ、スパなど', color: 'pink' },
  { id: 'clinic', emoji: '💊', name: '整体・クリニック', desc: '整体院、接骨院、歯科、医療クリニックなど', color: 'teal' },
  { id: 'legal', emoji: '⚖️', name: '士業・コンサル', desc: '弁護士、税理士、行政書士、コンサルタントなど', color: 'indigo' },
  { id: 'construction', emoji: '🏗️', name: '建設・工務店', desc: 'リフォーム、建設、内装工事、外構など', color: 'yellow' },
  { id: 'realestate', emoji: '🏠', name: '不動産', desc: '賃貸仲介、売買、管理、不動産投資など', color: 'blue' },
  { id: 'retail', emoji: '🛍️', name: '小売・EC', desc: '実店舗、オンラインショップ、専門店など', color: 'purple' },
  { id: 'fitness', emoji: '💪', name: 'フィットネス・ジム', desc: 'パーソナルジム、ヨガスタジオ、スポーツクラブなど', color: 'green' },
  { id: 'hotel', emoji: '🏨', name: 'ホテル・旅館', desc: 'ホテル、旅館、民泊、グランピングなど', color: 'amber' },
  { id: 'education', emoji: '📚', name: '教育・スクール', desc: '塾、教室、スクール、研修機関など', color: 'cyan' },
  { id: 'wedding', emoji: '💒', name: '結婚式場・イベント', desc: 'ウェディング、イベントホール、パーティーなど', color: 'rose' },
  { id: 'pet', emoji: '🐾', name: 'ペットサロン', desc: 'トリミング、ペットホテル、動物病院、ペットショップなど', color: 'lime' },
  { id: 'other', emoji: '✨', name: 'その他', desc: '上記に当てはまらない業種', color: 'slate' },
];

const COLOR_SCHEMES = [
  { id: 'professional-blue', name: 'プロフェッショナル', colors: ['#1e3a8a', '#3b82f6', '#f8fafc'], preview: 'from-blue-900 to-blue-500' },
  { id: 'warm-earth', name: 'ナチュラル・温かみ', colors: ['#78350f', '#d97706', '#fef9f0'], preview: 'from-amber-900 to-amber-500' },
  { id: 'elegant-dark', name: 'エレガント・高級感', colors: ['#111827', '#6b7280', '#ffffff'], preview: 'from-gray-900 to-gray-600' },
  { id: 'fresh-green', name: 'フレッシュ・健康的', colors: ['#064e3b', '#10b981', '#f0fdf4'], preview: 'from-emerald-900 to-emerald-500' },
  { id: 'modern-pink', name: 'キュート・フェミニン', colors: ['#831843', '#ec4899', '#fdf2f8'], preview: 'from-pink-900 to-pink-500' },
  { id: 'bold-orange', name: 'アクティブ・エネルギー', colors: ['#7c2d12', '#f97316', '#fff7ed'], preview: 'from-orange-900 to-orange-500' },
];

const STYLE_OPTIONS = [
  { id: 'modern', name: 'モダン・ミニマル', icon: '◻', desc: 'シンプルで洗練されたデザイン' },
  { id: 'warm', name: '温かみ・親しみやすい', icon: '🌿', desc: '自然で柔らかい印象' },
  { id: 'bold', name: 'ダイナミック・インパクト', icon: '⚡', desc: '大胆で存在感のあるデザイン' },
  { id: 'elegant', name: 'エレガント・高級感', icon: '♦', desc: '上品で信頼感のある印象' },
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
  day,
  open: '09:00',
  close: '18:00',
  closed: day === '日曜日',
}));

const defaultForm: FormData = {
  industry: '',
  businessName: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  description: '',
  catchphrase: '',
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

const STEPS = ['業種選択', 'ビジネス情報', 'デザイン設定', 'コンテンツ', '確認・完了'];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({ ...defaultForm });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const ind = searchParams.get('industry');
    if (ind) setForm(f => ({ ...f, industry: ind }));
  }, [searchParams]);

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

  const handleGenerate = async () => {
    setGenerating(true);
    localStorage.setItem('laruHP_data', JSON.stringify(form));
    await new Promise(r => setTimeout(r, 2500));
    setGenerating(false);
    router.push('/laruHP/builder?from=onboarding');
  };

  const canNext = () => {
    if (step === 1) return !!form.industry;
    if (step === 2) return !!form.businessName && !!form.address && !!form.phone && !!form.email;
    if (step === 3) return !!form.colorScheme && !!form.style;
    return true;
  };

  const selectedIndustry = INDUSTRIES.find(i => i.id === form.industry);
  const selectedScheme = COLOR_SCHEMES.find(c => c.id === form.colorScheme);

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

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
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
                  {i + 1 < step ? '✓' : i + 1}
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
        </div>

        {/* Step 1: Industry */}
        {step === 1 && (
          <div>
            <h2 className="text-3xl font-black mb-2">業種を選んでください</h2>
            <p className="text-slate-400 mb-8">業種に最適化されたテンプレートとSEO設定が自動で適用されます。</p>
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
                  <div className="text-3xl mb-2">{ind.emoji}</div>
                  <div className="font-bold text-sm mb-0.5">{ind.name}</div>
                  <div className="text-slate-500 text-xs leading-tight">{ind.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Business Info */}
        {step === 2 && (
          <div>
            <h2 className="text-3xl font-black mb-2">ビジネス情報を入力</h2>
            <p className="text-slate-400 mb-8">AIがこの情報をもとにコンテンツを自動生成します。</p>
            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold mb-2">店舗・会社名 <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={form.businessName}
                    onChange={e => updateForm('businessName', e.target.value)}
                    placeholder="例: 鈴木整体院"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">電話番号 <span className="text-red-400">*</span></label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => updateForm('phone', e.target.value)}
                    placeholder="例: 03-1234-5678"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">住所 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => updateForm('address', e.target.value)}
                  placeholder="例: 東京都渋谷区渋谷1-1-1 〇〇ビル2F"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold mb-2">メールアドレス <span className="text-red-400">*</span></label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => updateForm('email', e.target.value)}
                    placeholder="例: info@your-shop.com"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">既存サイトURL（任意）</label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={e => updateForm('website', e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">キャッチフレーズ（任意）</label>
                <input
                  type="text"
                  value={form.catchphrase}
                  onChange={e => updateForm('catchphrase', e.target.value)}
                  placeholder="例: 地域No.1の施術技術で、あなたの痛みを根本から解決"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">お店・会社の紹介文（任意）</label>
                <textarea
                  value={form.description}
                  onChange={e => updateForm('description', e.target.value)}
                  rows={4}
                  placeholder="例: 2010年に創業した整体院です。延べ10,000人以上の施術実績があり、首・肩・腰の痛みを中心に幅広い症状に対応しています..."
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
                <p className="text-slate-600 text-xs mt-1">空欄の場合はAIが自動生成します</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Design */}
        {step === 3 && (
          <div>
            <h2 className="text-3xl font-black mb-2">デザインを選んでください</h2>
            <p className="text-slate-400 mb-8">後でエディタからいつでも変更できます。</p>

            <div className="mb-8">
              <h3 className="font-bold text-sm mb-4 text-slate-300">カラースキーム</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COLOR_SCHEMES.map(scheme => (
                  <button
                    key={scheme.id}
                    onClick={() => updateForm('colorScheme', scheme.id)}
                    className={`rounded-2xl overflow-hidden border-2 transition-all ${
                      form.colorScheme === scheme.id
                        ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className={`h-16 bg-gradient-to-r ${scheme.preview}`} />
                    <div className="p-3 bg-white/5 text-left">
                      <div className="text-xs font-bold">{scheme.name}</div>
                      <div className="flex gap-1 mt-1">
                        {scheme.colors.map((c, i) => (
                          <div key={i} className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-sm mb-4 text-slate-300">デザインスタイル</h3>
              <div className="grid grid-cols-2 gap-3">
                {STYLE_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => updateForm('style', opt.id)}
                    className={`p-5 rounded-2xl border text-left transition-all ${
                      form.style === opt.id
                        ? 'bg-blue-500/20 border-blue-500/60'
                        : 'bg-white/5 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="text-2xl mb-2">{opt.icon}</div>
                    <div className="font-bold text-sm mb-1">{opt.name}</div>
                    <div className="text-slate-500 text-xs">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <h3 className="font-bold text-sm text-slate-300">連携設定</h3>
              <div className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${form.larubot ? 'bg-indigo-500/20 border-indigo-500/40' : 'bg-white/5 border-white/10'}`}
                onClick={() => updateForm('larubot', !form.larubot)}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🤖</span>
                  <div>
                    <div className="font-bold text-sm">LARUbot AIチャットボット</div>
                    <div className="text-slate-500 text-xs">問い合わせ対応を24時間自動化</div>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-all ${form.larubot ? 'bg-indigo-500' : 'bg-white/20'} relative`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${form.larubot ? 'left-5' : 'left-1'}`} />
                </div>
              </div>
              <div className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${form.laruseo ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-white/5 border-white/10'}`}
                onClick={() => updateForm('laruseo', !form.laruseo)}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📊</span>
                  <div>
                    <div className="font-bold text-sm">LARUSEO SEO分析</div>
                    <div className="text-slate-500 text-xs">リアルタイムSEOスコア・改善提案</div>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-all ${form.laruseo ? 'bg-emerald-500' : 'bg-white/20'} relative`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${form.laruseo ? 'left-5' : 'left-1'}`} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Content */}
        {step === 4 && (
          <div>
            <h2 className="text-3xl font-black mb-2">コンテンツを入力</h2>
            <p className="text-slate-400 mb-8">空欄の場合はAIが自動生成します。後でエディタから編集もできます。</p>

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
                      <input
                        type="text"
                        placeholder="サービス名"
                        value={svc.name}
                        onChange={e => updateService(i, 'name', e.target.value)}
                        className="bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <input
                        type="text"
                        placeholder="説明（任意）"
                        value={svc.description}
                        onChange={e => updateService(i, 'description', e.target.value)}
                        className="bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <input
                        type="text"
                        placeholder="料金（例: 3,000円）"
                        value={svc.price}
                        onChange={e => updateService(i, 'price', e.target.value)}
                        className="bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
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
                  <div key={i} className={`flex items-center gap-4 px-4 py-3 ${i < form.hours.length - 1 ? 'border-b border-white/5' : ''} ${hour.closed ? 'opacity-50' : ''}`}>
                    <span className="w-16 text-sm text-slate-400 flex-shrink-0">{hour.day}</span>
                    <input
                      type="time"
                      value={hour.open}
                      onChange={e => updateHour(i, 'open', e.target.value)}
                      disabled={hour.closed}
                      className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-30 w-24"
                    />
                    <span className="text-slate-500 text-sm">〜</span>
                    <input
                      type="time"
                      value={hour.close}
                      onChange={e => updateHour(i, 'close', e.target.value)}
                      disabled={hour.closed}
                      className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-30 w-24"
                    />
                    <label className="flex items-center gap-2 ml-auto cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hour.closed}
                        onChange={e => updateHour(i, 'closed', e.target.checked)}
                        className="w-4 h-4 accent-red-500"
                      />
                      <span className="text-sm text-slate-400">定休日</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Confirm */}
        {step === 5 && (
          <div>
            <h2 className="text-3xl font-black mb-2">確認・生成</h2>
            <p className="text-slate-400 mb-8">入力内容を確認してAI生成を開始してください。</p>

            <div className="space-y-4 mb-10">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-sm">基本情報</h3>
                  <button onClick={() => setStep(2)} className="text-blue-400 text-xs hover:text-blue-300">編集</button>
                </div>
                <div className="space-y-2 text-sm text-slate-300">
                  <div><span className="text-slate-500">業種: </span>{selectedIndustry?.emoji} {selectedIndustry?.name}</div>
                  <div><span className="text-slate-500">店舗名: </span>{form.businessName || '未入力'}</div>
                  <div><span className="text-slate-500">住所: </span>{form.address || '未入力'}</div>
                  <div><span className="text-slate-500">電話: </span>{form.phone || '未入力'}</div>
                  <div><span className="text-slate-500">メール: </span>{form.email || '未入力'}</div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-sm">デザイン設定</h3>
                  <button onClick={() => setStep(3)} className="text-blue-400 text-xs hover:text-blue-300">編集</button>
                </div>
                <div className="space-y-2 text-sm text-slate-300">
                  <div><span className="text-slate-500">カラー: </span>{selectedScheme?.name}</div>
                  <div><span className="text-slate-500">スタイル: </span>{STYLE_OPTIONS.find(s => s.id === form.style)?.name}</div>
                  <div className="flex gap-2 mt-1">
                    {form.larubot && <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full">🤖 LARUbot</span>}
                    {form.laruseo && <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full">📊 LARUSEO</span>}
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-sm">サービス内容</h3>
                  <button onClick={() => setStep(4)} className="text-blue-400 text-xs hover:text-blue-300">編集</button>
                </div>
                <div className="space-y-1">
                  {form.services.filter(s => s.name).map((s, i) => (
                    <div key={i} className="text-sm text-slate-300 flex items-center gap-2">
                      <span className="text-emerald-400">✓</span>{s.name}{s.price && ` — ${s.price}`}
                    </div>
                  ))}
                  {form.services.filter(s => s.name).length === 0 && (
                    <div className="text-slate-500 text-sm">AIが自動生成します</div>
                  )}
                </div>
              </div>
            </div>

            {/* Generate button */}
            {generating ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-4 animate-bounce">🤖</div>
                <div className="text-lg font-bold mb-2">AIがサイトを生成中...</div>
                <div className="text-slate-400 text-sm mb-6">業種別テンプレートにデータを組み込んでいます</div>
                <div className="w-full bg-white/10 rounded-full h-2 max-w-xs mx-auto overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full animate-[progress_2.5s_ease-in-out_forwards]" />
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                className="w-full bg-white text-black py-5 rounded-2xl font-black text-lg hover:scale-[1.02] transition-transform shadow-[0_0_40px_rgba(255,255,255,0.1)]"
              >
                🚀 AIでサイトを生成する
              </button>
            )}

            <p className="text-center text-slate-600 text-xs mt-4">
              生成後はビジュアルエディタで自由に編集できます
            </p>
          </div>
        )}

        {/* Navigation */}
        {step < 5 && (
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
      </div>

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
          <div className="text-4xl mb-4 animate-spin">⚙️</div>
          <div>読み込み中...</div>
        </div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
