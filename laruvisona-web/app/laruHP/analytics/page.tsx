'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface DailyView {
  date: string;
  views: number;
}

interface Site {
  id: string;
  name: string;
  slug: string | null;
  view_count: number;
  published: boolean;
}

interface Contact {
  id: string;
  created_at: string;
  type: string | null;
}

function StatCard({ label, value, sub, color = 'sky' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    sky: 'text-sky-600',
    green: 'text-green-600',
    amber: 'text-amber-600',
    purple: 'text-purple-600',
    indigo: 'text-indigo-600',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
      <p className={`text-2xl font-black ${colors[color] || 'text-sky-600'}`}>{value}</p>
      <p className="text-xs font-semibold text-gray-600 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniChart({ data, max }: { data: DailyView[]; max: number }) {
  if (!data.length) return null;
  const effectiveMax = max || 1;
  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map((d, i) => (
        <div
          key={i}
          title={`${d.date}: ${d.views}件`}
          className="flex-1 bg-sky-200 hover:bg-sky-400 rounded-sm transition-colors cursor-default"
          style={{ height: `${Math.max(2, (d.views / effectiveMax) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [viewData, setViewData] = useState<DailyView[]>([]);
  const [viewData30, setViewData30] = useState<DailyView[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'7' | '30'>('7');

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/laruHP/auth/login'); return; }

        const results = await Promise.allSettled([
          fetch('/api/sites').then(r => r.json()),
          fetch('/api/sites/analytics?days=7').then(r => r.json()),
          fetch('/api/sites/analytics?days=30').then(r => r.json()),
          fetch('/api/contacts').then(r => r.json()),
        ]);

        const sitesData = results[0].status === 'fulfilled' ? results[0].value : { sites: [] };
        const analyticsData7 = results[1].status === 'fulfilled' ? results[1].value : { data: {} };
        const analyticsData30 = results[2].status === 'fulfilled' ? results[2].value : { data: {} };
        const contactsData = results[3].status === 'fulfilled' ? results[3].value : { contacts: [] };

        const s: Site[] = sitesData.sites || [];
        setSites(s);
        setContacts(contactsData.contacts || []);

        if (s.length > 0) {
          setSelectedSite(s[0]);
          const siteData7 = (analyticsData7.data as Record<string, DailyView[]>)?.[s[0].id] || [];
          const siteData30 = (analyticsData30.data as Record<string, DailyView[]>)?.[s[0].id] || [];
          setViewData(siteData7);
          setViewData30(siteData30);
        }
      } catch {
        setError('データの読み込みに失敗しました。ページを再読み込みしてください。');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayData = period === '7' ? viewData : viewData30;
  const totalViews = displayData.reduce((s, d) => s + d.views, 0);
  const maxViews = Math.max(...displayData.map(d => d.views), 1);

  // Week over week
  const halfLen = Math.floor(displayData.length / 2);
  const firstHalf = displayData.slice(0, halfLen).reduce((s, d) => s + d.views, 0);
  const secondHalf = displayData.slice(halfLen).reduce((s, d) => s + d.views, 0);
  const weekChange = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0;

  // Contact funnel
  const totalContacts = contacts.length;
  const bookings = contacts.filter(c => c.type === 'booking').length;
  const thisWeek = contacts.filter(c => {
    const d = new Date(c.created_at);
    return Date.now() - d.getTime() < 7 * 86_400_000;
  }).length;

  // Estimate CVR
  const cvr = totalViews > 0 ? ((totalContacts / totalViews) * 100).toFixed(1) : '0.0';

  // Top days
  const sortedDays = [...displayData].sort((a, b) => b.views - a.views).slice(0, 3);

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
        <h1 className="text-sm font-bold text-gray-900 mx-auto">BIアナリティクス</h1>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Controls */}
        <div className="flex items-center justify-between flex-wrap gap-3">
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
          <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
            {(['7', '30'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-xs font-bold px-4 py-2 transition-colors ${period === p ? 'bg-sky-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                {p}日間
              </button>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label={`訪問数（${period}日）`}
            value={totalViews.toLocaleString()}
            sub={weekChange !== 0 ? `前半比 ${weekChange > 0 ? '+' : ''}${weekChange}%` : undefined}
            color={weekChange >= 0 ? 'sky' : 'amber'}
          />
          <StatCard label="累計問い合わせ" value={totalContacts.toLocaleString()} sub={`今週: ${thisWeek}件`} color="green" />
          <StatCard label="転換率（CVR）" value={`${cvr}%`} sub={`${totalViews}訪問 → ${totalContacts}件`} color="purple" />
          <StatCard label="予約件数" value={bookings.toLocaleString()} sub={`問い合わせの${totalContacts > 0 ? Math.round((bookings / totalContacts) * 100) : 0}%`} color="indigo" />
        </div>

        {/* Views chart */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm text-gray-900">訪問数推移</h2>
            <span className="text-xs text-gray-400">{period}日間合計: {totalViews.toLocaleString()}件</span>
          </div>

          {displayData.length > 0 ? (
            <>
              <MiniChart data={displayData} max={maxViews} />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-400">{displayData[0]?.date}</span>
                <span className="text-[10px] text-gray-400">{displayData[displayData.length - 1]?.date}</span>
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-gray-400 text-sm">データがありません</div>
          )}
        </section>

        {/* 2-col section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Funnel */}
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <h2 className="font-bold text-sm text-gray-900 mb-4">集客ファネル</h2>
            <div className="space-y-2">
              {[
                { label: 'サイト訪問', value: totalViews, color: 'bg-sky-500', pct: 100 },
                { label: '問い合わせ', value: totalContacts, color: 'bg-green-500', pct: totalViews > 0 ? (totalContacts / totalViews) * 100 : 0 },
                { label: '予約転換', value: bookings, color: 'bg-purple-500', pct: totalContacts > 0 ? (bookings / totalContacts) * 100 : 0 },
              ].map(step => (
                <div key={step.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{step.label}</span>
                    <span className="font-bold text-gray-900">{step.value.toLocaleString()}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className={`${step.color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(step.pct, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Top days */}
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <h2 className="font-bold text-sm text-gray-900 mb-4">アクセスの多い日 TOP3</h2>
            {sortedDays.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">データがありません</p>
            ) : (
              <div className="space-y-3">
                {sortedDays.map((d, i) => (
                  <div key={d.date} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-900">{new Date(d.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}</div>
                      <div className="bg-gray-100 rounded-full h-1.5 mt-1">
                        <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${(d.views / maxViews) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-sky-600 flex-shrink-0">{d.views}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        {/* Contacts timeline */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-sm text-gray-900 mb-4">問い合わせタイプ内訳</h2>
          {contacts.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">まだ問い合わせがありません</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(
                contacts.reduce<Record<string, number>>((acc, c) => {
                  const t = c.type || 'contact';
                  acc[t] = (acc[t] || 0) + 1;
                  return acc;
                }, {})
              ).sort(([, a], [, b]) => b - a).map(([type, count]) => {
                const pct = Math.round((count / contacts.length) * 100);
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20 flex-shrink-0 truncate">{type}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-700 flex-shrink-0 w-12 text-right">{count}件 ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Published sites summary */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-sm text-gray-900 mb-4">サイト別累計訪問数</h2>
          <div className="space-y-2">
            {sites.filter(s => s.published).map(s => (
              <div key={s.id} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-xs text-gray-700 flex-1 truncate">{s.name}</span>
                <span className="text-xs font-bold text-gray-900">{(s.view_count || 0).toLocaleString()}件</span>
              </div>
            ))}
            {sites.filter(s => !s.published).map(s => (
              <div key={s.id} className="flex items-center gap-3 opacity-40">
                <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                <span className="text-xs text-gray-500 flex-1 truncate">{s.name} <span className="text-gray-400">（未公開）</span></span>
              </div>
            ))}
          </div>
        </section>

        {/* Link to more */}
        <div className="flex gap-3 flex-wrap">
          <Link href="/laruHP/contacts" className="text-xs text-sky-700 border border-sky-200 bg-sky-50 px-4 py-2 rounded-xl hover:bg-sky-100 transition-colors font-semibold">
            問い合わせ一覧 →
          </Link>
          <Link href="/laruHP/settings?section=gsc" className="text-xs text-indigo-700 border border-indigo-200 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors font-semibold">
            Search Console →
          </Link>
          <Link href="/laruHP/larubot-logs" className="text-xs text-purple-700 border border-purple-200 bg-purple-50 px-4 py-2 rounded-xl hover:bg-purple-100 transition-colors font-semibold">
            LARUbot分析 →
          </Link>
        </div>
      </div>
    </div>
  );
}
