'use client';
import { useState, useEffect, useCallback } from 'react';
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
  type?: string | null;
}

const TYPE_EMOJI: Record<string, string> = {
  LocalBusiness: '🏪', Restaurant: '🍽', MedicalBusiness: '🏥', BeautySalon: '💇',
  Dentist: '🦷', LegalService: '⚖️', AccountingService: '📊', RealEstateAgent: '🏠',
  Store: '🛍', Florist: '🌸', TravelAgency: '✈️', FitnessCenter: '💪',
};

interface Contact {
  id: string;
  created_at: string;
  type: string | null;
}

function StatCard({ label, value, sub, color = 'sky', trend }: { label: string; value: string | number; sub?: string; color?: string; trend?: number | null }) {
  const colors: Record<string, string> = {
    sky: 'text-sky-600',
    green: 'text-green-600',
    amber: 'text-amber-600',
    purple: 'text-purple-600',
    indigo: 'text-indigo-600',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-1">
        <p className={`text-2xl font-black ${colors[color] || 'text-sky-600'}`}>{value}</p>
        {trend !== null && trend !== undefined && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-1 ${trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-gray-600 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function CvrMiniChart({ viewData, contacts }: { viewData: DailyView[]; contacts: Contact[] }) {
  if (viewData.length < 2) return null;
  const contactsByDate: Record<string, number> = {};
  contacts.forEach(c => {
    const d = c.created_at.split('T')[0];
    contactsByDate[d] = (contactsByDate[d] || 0) + 1;
  });
  const cvrValues = viewData.map(d => d.views > 0 ? Math.min(100, (contactsByDate[d.date] || 0) / d.views * 100) : 0);
  const maxCvr = Math.max(...cvrValues, 0.1);
  const W = 200, H = 40;
  const points = cvrValues.map((v, i) => `${(i / (cvrValues.length - 1)) * W},${H - (v / maxCvr) * H}`).join(' ');
  const avgCvr = (cvrValues.reduce((a, b) => a + b, 0) / cvrValues.length).toFixed(1);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-purple-600">CVR日次推移</span>
        <span className="text-[10px] text-purple-400">平均 {avgCvr}%</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8" preserveAspectRatio="none">
        <polyline fill="none" stroke="#a855f7" strokeWidth="2" points={points} />
      </svg>
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

function ChangeChart({ current, previous }: { current: DailyView[]; previous: DailyView[] }) {
  if (current.length < 2 || previous.length < current.length) return null;
  const changes = current.map((d, i) => {
    const prev = previous[previous.length - current.length + i]?.views ?? 0;
    return prev > 0 ? ((d.views - prev) / prev) * 100 : 0;
  });
  const maxAbs = Math.max(...changes.map(Math.abs), 1);
  return (
    <div className="mt-4">
      <p className="text-[10px] font-semibold text-gray-500 mb-1">前期間比（日次）</p>
      <div className="flex items-center gap-0.5 h-10">
        {changes.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-center h-full" title={`${current[i]?.date}: ${v > 0 ? '+' : ''}${v.toFixed(1)}%`}>
            {v >= 0 ? (
              <div className="w-full bg-green-400 rounded-t-sm self-end" style={{ height: `${Math.max(2, (v / maxAbs) * 50)}%` }} />
            ) : (
              <div className="w-full bg-red-400 rounded-b-sm self-start" style={{ height: `${Math.max(2, (-v / maxAbs) * 50)}%` }} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-gray-400">{current[0]?.date}</span>
        <span className="text-[9px] text-gray-400">{current[current.length - 1]?.date}</span>
      </div>
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'7' | '30' | '90'>('7');
  const [viewData90, setViewData90] = useState<DailyView[]>([]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/laruHP/auth/login'); return; }

      const results = await Promise.allSettled([
        fetch('/api/sites').then(r => r.json()),
        fetch('/api/sites/analytics?days=7').then(r => r.json()),
        fetch('/api/sites/analytics?days=30').then(r => r.json()),
        fetch('/api/sites/analytics?days=90').then(r => r.json()),
        fetch('/api/contacts').then(r => r.json()),
      ]);

      const sitesData = results[0].status === 'fulfilled' ? results[0].value : { sites: [] };
      const analyticsData7 = results[1].status === 'fulfilled' ? results[1].value : { data: {} };
      const analyticsData30 = results[2].status === 'fulfilled' ? results[2].value : { data: {} };
      const analyticsData90 = results[3].status === 'fulfilled' ? results[3].value : { data: {} };
      const contactsData = results[4].status === 'fulfilled' ? results[4].value : { contacts: [] };

      const s: Site[] = sitesData.sites || [];
      setSites(s);
      setContacts(contactsData.contacts || []);

      if (s.length > 0) {
        setSelectedSite(prev => {
          const keep = prev ? (s.find(x => x.id === prev.id) ?? s[0]) : s[0];
          const siteData7 = (analyticsData7.data as Record<string, DailyView[]>)?.[keep.id] || [];
          const siteData30 = (analyticsData30.data as Record<string, DailyView[]>)?.[keep.id] || [];
          const siteData90 = (analyticsData90.data as Record<string, DailyView[]>)?.[keep.id] || [];
          setViewData(siteData7);
          setViewData30(siteData30);
          setViewData90(siteData90);
          return keep;
        });
      }
    } catch {
      setError('データの読み込みに失敗しました。ページを再読み込みしてください。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const displayData = period === '7' ? viewData : period === '30' ? viewData30 : viewData90;
  const totalViews = displayData.reduce((s, d) => s + d.views, 0);
  const maxViews = Math.max(...displayData.map(d => d.views), 1);

  // Period-over-period comparison using 30-day data
  const last7 = viewData30.slice(-7);
  const prev7 = viewData30.slice(-14, -7);
  const last7Total = last7.reduce((s, d) => s + d.views, 0);
  const prev7Total = prev7.reduce((s, d) => s + d.views, 0);
  const weekOverWeek = prev7Total > 0 ? Math.round(((last7Total - prev7Total) / prev7Total) * 100) : null;
  const last15 = viewData30.slice(-15);
  const prev15 = viewData30.slice(0, 15);
  const last15Total = last15.reduce((s, d) => s + d.views, 0);
  const prev15Total = prev15.reduce((s, d) => s + d.views, 0);
  const monthOverMonth = prev15Total > 0 ? Math.round(((last15Total - prev15Total) / prev15Total) * 100) : null;
  const last45 = viewData90.slice(-45);
  const prev45 = viewData90.slice(0, 45);
  const last45Total = last45.reduce((s, d) => s + d.views, 0);
  const prev45Total = prev45.reduce((s, d) => s + d.views, 0);
  const quarterOverQuarter = prev45Total > 0 ? Math.round(((last45Total - prev45Total) / prev45Total) * 100) : null;
  const periodChange = period === '7' ? weekOverWeek : period === '30' ? monthOverMonth : quarterOverQuarter;

  // Contact funnel
  const totalContacts = contacts.length;
  const bookings = contacts.filter(c => c.type === 'booking').length;
  const thisWeek = contacts.filter(c => {
    const d = new Date(c.created_at);
    return Date.now() - d.getTime() < 7 * 86_400_000;
  }).length;

  // Period-over-period for contacts and bookings
  const nowMs = Date.now();
  const periodMs = parseInt(period) * 86_400_000;
  const contactsCurrent = contacts.filter(c => nowMs - new Date(c.created_at).getTime() < periodMs);
  const contactsPrev = contacts.filter(c => {
    const age = nowMs - new Date(c.created_at).getTime();
    return age >= periodMs && age < 2 * periodMs;
  });
  const contactPeriodChange = contactsPrev.length > 0
    ? Math.round(((contactsCurrent.length - contactsPrev.length) / contactsPrev.length) * 100)
    : null;
  const bookingsCurrent = contactsCurrent.filter(c => c.type === 'booking').length;
  const bookingsPrev = contactsPrev.filter(c => c.type === 'booking').length;
  const bookingPeriodChange = bookingsPrev > 0
    ? Math.round(((bookingsCurrent - bookingsPrev) / bookingsPrev) * 100)
    : null;

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
        <Link href="/laruHP/dashboard" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          ダッシュボード
        </Link>
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
              {sites.map(s => <option key={s.id} value={s.id}>{(s.type && TYPE_EMOJI[s.type] ? TYPE_EMOJI[s.type] + ' ' : '')}{s.name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
              {(['7', '30', '90'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`text-xs font-bold px-4 py-2 transition-colors ${period === p ? 'bg-sky-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  {p}日間
                </button>
              ))}
            </div>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-xl px-3 py-2 transition-colors disabled:opacity-50"
              title="データを再取得"
            >
              <svg className={refreshing ? 'animate-spin' : ''} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              {refreshing ? '更新中...' : '更新'}
            </button>
          </div>
        </div>

        {/* Unpublished site notice */}
        {selectedSite && !selectedSite.published && (
          <div className="bg-amber-100 border border-amber-300 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-amber-900 font-medium">⚠ このサイトはまだ未公開です。公開するとアクセス解析データが蓄積されます。</p>
            <Link href="/laruHP/dashboard" className="text-xs font-bold text-amber-700 whitespace-nowrap hover:underline">ダッシュボードへ →</Link>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label={`訪問数（${period}日）`}
            value={totalViews.toLocaleString()}
            sub={periodChange !== null ? `前${period === '7' ? '週' : period === '30' ? '月' : '四半期'}比 ${periodChange > 0 ? '+' : ''}${periodChange}%` : undefined}
            color={periodChange !== null && periodChange >= 0 ? 'sky' : 'amber'}
          />
          <StatCard label="累計問い合わせ" value={totalContacts.toLocaleString()} sub={`今週: ${thisWeek}件`} color="green" trend={contactPeriodChange} />
          <StatCard label="転換率（CVR）" value={`${cvr}%`} sub={`${totalViews}訪問 → ${totalContacts}件`} color="purple" />
          <StatCard label="予約件数" value={bookings.toLocaleString()} sub={`問い合わせの${totalContacts > 0 ? Math.round((bookings / totalContacts) * 100) : 0}%`} color="indigo" trend={bookingPeriodChange} />
        </div>

        {/* Views chart */}
        <section className={`bg-white border border-gray-200 rounded-2xl shadow-sm p-6 transition-opacity duration-200 ${refreshing ? 'opacity-50' : 'opacity-100'}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm text-gray-900">訪問数推移</h2>
            <span className="text-xs text-gray-400">{period}日間合計: {totalViews.toLocaleString()}件</span>
          </div>

          {displayData.length > 0 ? (
            <>
              <MiniChart data={displayData} max={maxViews} />
              <div className="flex justify-between mt-1 mb-4">
                <span className="text-[10px] text-gray-400">{displayData[0]?.date}</span>
                <span className="text-[10px] text-gray-400">{displayData[displayData.length - 1]?.date}</span>
              </div>
              {period === '7' && viewData30.length >= 14 && (
                <ChangeChart current={viewData30.slice(-7)} previous={viewData30.slice(-14, -7)} />
              )}
              {contacts.length > 0 && (
                <CvrMiniChart viewData={displayData} contacts={contacts} />
              )}
            </>
          ) : (
            <div className="text-center py-10">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                {selectedSite?.published ? 'まだ訪問データがありません' : 'サイトが未公開です'}
              </p>
              <p className="text-xs text-gray-400 mb-4">
                {selectedSite?.published
                  ? 'Googleへのインデックス登録には数日かかる場合があります。しばらくお待ちください。'
                  : 'サイトを公開するとアクセス解析データが記録されます。'}
              </p>
              {selectedSite?.published && (
                <a
                  href="https://search.google.com/search-console/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 border border-sky-200 bg-sky-50 px-3 py-1.5 rounded-lg hover:bg-sky-100 transition-colors"
                >
                  🔍 Google Search Console に登録してインデックスを促進 →
                </a>
              )}
            </div>
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
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-semibold">{step.pct.toFixed(1)}%</span>
                      <span className="font-bold text-gray-900">{step.value.toLocaleString()}</span>
                    </div>
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
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-400 text-white' : 'bg-amber-700 text-white'}`}>
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
