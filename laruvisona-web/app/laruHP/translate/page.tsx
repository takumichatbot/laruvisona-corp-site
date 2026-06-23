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

interface TranslationInfo {
  map: Record<string, string>;
  translatedAt: string;
  textCount: number;
}

const LOCALES = [
  { code: 'en', label: '英語', flag: '🇬🇧', desc: 'English — インバウンド・海外向け' },
  { code: 'zh', label: '中国語', flag: '🇨🇳', desc: '中文（简体）— 中国語圏のお客様向け' },
  { code: 'ko', label: '韓国語', flag: '🇰🇷', desc: '한국어 — 韓国語圏のお客様向け' },
];

export default function TranslatePage() {
  const supabase = createClient();
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { sample: Array<{ src: string; dst: string }>; textCount: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/laruHP/auth/login'); return; }
        const res = await fetch('/api/sites');
        if (!res.ok) throw new Error('sites fetch failed');
        const d = await res.json();
        const s: Site[] = d.sites || [];
        setSites(s);
        if (s.length > 0) setSelectedSite(s[0]);
      } catch {
        setError('データの読み込みに失敗しました。ページを再読み込みしてください。');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getTranslationInfo = (locale: string): TranslationInfo | null => {
    const t = selectedSite?.settings_json?.translations as Record<string, TranslationInfo> | undefined;
    return t?.[locale] ?? null;
  };

  const handleTranslate = async (locale: string) => {
    if (!selectedSite) return;
    setTranslating(locale);
    setMsg('');
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: selectedSite.id, targetLocale: locale }),
      });
      const d = await res.json() as { textCount?: number; sample?: Array<{ src: string; dst: string }>; error?: string };
      if (res.ok && d.sample) {
        setResults(prev => ({
          ...prev,
          [locale]: { sample: d.sample!, textCount: d.textCount! },
        }));
        setSelectedSite(prev => {
          if (!prev) return prev;
          const settings = prev.settings_json || {};
          const existingTranslations = (settings.translations as Record<string, unknown>) || {};
          return {
            ...prev,
            settings_json: {
              ...settings,
              translations: {
                ...existingTranslations,
                [locale]: {
                  map: {},
                  translatedAt: new Date().toISOString(),
                  textCount: d.textCount,
                },
              },
            },
          };
        });
        setMsgType('success');
        setMsg(`${LOCALES.find(l => l.code === locale)?.label}への翻訳が完了しました（${d.textCount}件）`);
        setTimeout(() => setMsg(''), 4000);
      } else {
        setMsgType('error');
        setMsg(d.error || '翻訳に失敗しました');
      }
    } catch {
      setMsgType('error');
      setMsg('翻訳中にエラーが発生しました。もう一度お試しください。');
    }
    setTranslating(null);
  };

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
        <h1 className="text-sm font-bold text-gray-900 mx-auto">多言語AI翻訳</h1>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Site picker */}
        {sites.length > 1 && (
          <select
            value={selectedSite?.id || ''}
            onChange={e => {
              const s = sites.find(x => x.id === e.target.value) ?? null;
              setSelectedSite(s);
            }}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-500"
          >
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        {/* Header info */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-sm text-gray-900 mb-1">AIがサイト全文を自動翻訳します</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Claude AIがビジネス文体を維持しながら、サイトのテキストコンテンツを指定言語に翻訳します。
            翻訳されたコンテンツは公開URLの言語パラメータで提供されます。
          </p>
        </div>

        {msg && (
          <div className={`text-xs font-semibold px-4 py-3 rounded-xl ${msgType === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg}
          </div>
        )}

        {/* Language cards */}
        <div className="space-y-3">
          {LOCALES.map(locale => {
            const info = getTranslationInfo(locale.code);
            const resultData = results[locale.code];
            const isTranslating = translating === locale.code;

            return (
              <div key={locale.code} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 flex items-start gap-4">
                  <span className="text-3xl flex-shrink-0">{locale.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-sm text-gray-900">{locale.label}</h3>
                      {info && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                          翻訳済み {info.textCount}件
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{locale.desc}</p>
                    {info && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        最終翻訳: {new Date(info.translatedAt).toLocaleDateString('ja-JP')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleTranslate(locale.code)}
                    disabled={isTranslating || !!translating}
                    className={`flex-shrink-0 text-sm font-bold px-4 py-2 rounded-xl transition-colors disabled:opacity-50 ${
                      info
                        ? 'border border-sky-200 text-sky-700 hover:bg-sky-50'
                        : 'bg-sky-600 hover:bg-sky-500 text-white'
                    }`}
                  >
                    {isTranslating ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        翻訳中...
                      </span>
                    ) : info ? '再翻訳' : 'AI翻訳を実行'}
                  </button>
                </div>

                {/* Sample translations */}
                {resultData?.sample?.length > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wider">翻訳サンプル</p>
                    <div className="space-y-2">
                      {resultData.sample.slice(0, 3).map((pair, i) => (
                        <div key={i} className="text-xs">
                          <span className="text-gray-400">{pair.src.slice(0, 50)}</span>
                          <span className="text-gray-300 mx-1.5">→</span>
                          <span className="text-gray-700 font-medium">{pair.dst.slice(0, 60)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Usage info */}
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h3 className="font-bold text-sm text-amber-900 mb-2">多言語ページの公開方法</h3>
          {selectedSite?.slug && (
            <div className="space-y-2 text-xs text-amber-800">
              {LOCALES.map(locale => {
                const info = getTranslationInfo(locale.code);
                return info ? (
                  <div key={locale.code} className="flex items-center gap-2">
                    <span>{locale.flag}</span>
                    <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">
                      /hp/{selectedSite.slug}?lang={locale.code}
                    </code>
                    <span className="text-amber-600">← SNSや名刺に掲載</span>
                  </div>
                ) : null;
              })}
            </div>
          )}
          {!LOCALES.some(l => getTranslationInfo(l.code)) && (
            <p className="text-xs text-amber-700">翻訳完了後、言語別URLが生成されます</p>
          )}
        </section>

      </div>
    </div>
  );
}
