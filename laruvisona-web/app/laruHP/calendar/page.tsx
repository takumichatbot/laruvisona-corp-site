'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Post {
  id: string;
  site_id: string;
  title: string;
  category: string;
  published: boolean;
  published_at: string | null;
  scheduled_at?: string | null;
}

interface Site {
  id: string;
  name: string;
}

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const CATEGORY_COLOR: Record<string, string> = {
  'お知らせ': 'bg-sky-100 text-sky-700',
  'ブログ': 'bg-indigo-100 text-indigo-700',
  'イベント': 'bg-emerald-100 text-emerald-700',
  'キャンペーン': 'bg-rose-100 text-rose-700',
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const supabase = createClient();
  const router = useRouter();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/laruHP/auth/login'); return; }

      const res = await fetch('/api/sites');
      const d = await res.json();
      const s: Site[] = (d.sites || []).map((x: Site) => ({ id: x.id, name: x.name }));
      setSites(s);
      if (s.length > 0) setSelectedSiteId(s[0].id);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSiteId) return;
    (async () => {
      const res = await fetch(`/api/posts?siteId=${selectedSiteId}`);
      const d = await res.json();
      setPosts(d.posts || []);
    })();
  }, [selectedSiteId]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const handleSchedule = async (postId: string, dateStr: string) => {
    setScheduling(postId);
    await fetch('/api/posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: postId, scheduled_at: dateStr || null }),
    });
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, scheduled_at: dateStr || null } : p));
    setScheduling(null);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);

  // Build calendar grid
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const getPostsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return posts.filter(p => {
      const at = p.scheduled_at || p.published_at || '';
      return at.startsWith(dateStr);
    });
  };

  const unscheduledDrafts = posts.filter(p => !p.published && !p.scheduled_at);

  if (loading) return <div className="min-h-screen bg-sky-50 flex items-center justify-center"><div className="text-gray-500 text-sm">読み込み中...</div></div>;

  const thisMonthCount = posts.filter(p => {
    const at = p.scheduled_at || p.published_at || '';
    return at.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);
  }).length;

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <header className="border-b border-sky-100 bg-white/90 backdrop-blur-xl shadow-sm px-6 py-4 flex items-center gap-4">
        <Link href="/laruHP/dashboard" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          ダッシュボード
        </Link>
        <h1 className="text-sm font-bold text-gray-900 mx-auto">コンテンツカレンダー</h1>
        <Link href="/laruHP/blog" className="text-xs text-sky-600 hover:text-sky-500 border border-sky-200 px-3 py-1.5 rounded-lg transition-colors">ブログ管理</Link>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Site picker */}
        {sites.length > 1 && (
          <div className="mb-6">
            <select
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-500"
            >
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr,280px] gap-6">

          {/* Calendar */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <button onClick={prevMonth} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-gray-900">{year}年 {month + 1}月</h2>
                {thisMonthCount > 0 && <span className="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-bold">{thisMonthCount}件</span>}
                {(year !== today.getFullYear() || month !== today.getMonth()) && (
                  <button
                    onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
                    className="text-[10px] text-sky-600 hover:text-sky-500 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2 py-0.5 rounded-lg transition-all font-bold"
                  >
                    今日
                  </button>
                )}
              </div>
              <button onClick={nextMonth} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            <div className="grid grid-cols-7 text-center border-b border-gray-100">
              {DOW.map((d, i) => (
                <div key={d} className={`text-[10px] font-semibold py-2 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                const isToday = day !== null && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
                const dayPosts = day !== null ? getPostsForDay(day) : [];
                return (
                  <div
                    key={i}
                    className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 transition-colors group/cell ${!day ? 'bg-gray-50' : dragOverDate === `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` ? 'bg-sky-100 ring-inset ring-1 ring-sky-400' : 'hover:bg-sky-50/70'} ${i % 7 === 0 ? 'last:border-r-0' : ''}`}
                    onDragOver={day ? (e) => { e.preventDefault(); setDragOverDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`); } : undefined}
                    onDragLeave={() => setDragOverDate(null)}
                    onDrop={day ? (e) => {
                      e.preventDefault();
                      setDragOverDate(null);
                      const postId = e.dataTransfer.getData('postId');
                      if (postId) handleSchedule(postId, `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
                    } : undefined}
                  >
                    {day && (
                      <>
                        <div className={`text-[11px] font-semibold mb-1 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-sky-600 text-white' : i % 7 === 0 ? 'text-red-500' : i % 7 === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                          {day}
                        </div>
                        {dayPosts.length === 0 && (
                          <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity text-[9px] text-gray-400 text-center mt-1">+</div>
                        )}
                        <div className="space-y-0.5">
                          {dayPosts.slice(0, 2).map(p => (
                            <div
                              key={p.id}
                              className={`text-[9px] rounded px-1 py-0.5 truncate ${p.published ? 'bg-green-100 text-green-700' : CATEGORY_COLOR[p.category] || 'bg-gray-100 text-gray-600'}`}
                            >
                              {p.title}
                            </div>
                          ))}
                          {dayPosts.length > 2 && (
                            <div className="text-[9px] text-gray-400 pl-1">+{dayPosts.length - 2}件</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar - Unscheduled Drafts */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-sm text-gray-900 mb-1">未予約の下書き</h3>
              <p className="text-xs text-gray-500 mb-4">日付を設定してカレンダーに配置できます</p>

              {unscheduledDrafts.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-xs text-gray-400">下書きがありません</div>
                  <Link href="/laruHP/blog" className="text-xs text-sky-600 hover:text-sky-500 mt-2 inline-block">ブログを作成 →</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {unscheduledDrafts.map(post => (
                    <div
                      key={post.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.setData('postId', post.id); e.dataTransfer.effectAllowed = 'move'; }}
                      className="border border-gray-200 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-sky-300 transition-colors"
                    >
                      <div className="flex items-start gap-1.5 mb-1">
                        <svg width="10" height="10" viewBox="0 0 10 16" fill="currentColor" className="text-gray-300 mt-0.5 flex-shrink-0">
                          <circle cx="3" cy="3" r="1.5"/><circle cx="7" cy="3" r="1.5"/>
                          <circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/>
                          <circle cx="3" cy="13" r="1.5"/><circle cx="7" cy="13" r="1.5"/>
                        </svg>
                        <div className={`text-[10px] font-semibold px-1.5 py-0.5 rounded inline-block ${CATEGORY_COLOR[post.category] || 'bg-gray-100 text-gray-500'}`}>
                          {post.category}
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-gray-900 mb-2 line-clamp-2">{post.title}</div>
                      <input
                        type="date"
                        disabled={scheduling === post.id}
                        onChange={e => handleSchedule(post.id, e.target.value)}
                        className="w-full bg-sky-50 border border-sky-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-sky-500 disabled:opacity-50"
                        placeholder="公開日を設定"
                      />
                      {scheduling === post.id && (
                        <div className="text-[10px] text-gray-400 mt-1">保存中...</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
              <h4 className="text-xs font-bold text-gray-700 mb-3">凡例</h4>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
                  <span className="text-[10px] text-gray-600">公開済み</span>
                </div>
                {Object.entries(CATEGORY_COLOR).map(([cat, cls]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded text-[6px] ${cls}`} />
                    <span className="text-[10px] text-gray-600">{cat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
