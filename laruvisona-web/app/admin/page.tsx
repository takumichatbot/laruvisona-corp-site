'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Stats {
  totalUsers: number;
  activeUsers: number;
  pastDueUsers: number;
  totalSites: number;
  publishedSites: number;
  mrr: number;
  planBreakdown: Record<string, number>;
  churnRisk: ChurnUser[];
}

interface ChurnUser {
  id: string;
  plan: string | null;
  score: number;
  hasPublished: boolean;
  hasRecentContact: boolean;
  daysSinceActive: number;
  siteCount: number;
}

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  business_name: string | null;
  subscription_status: string;
  plan: string | null;
  is_suspended: boolean;
  site_count: number;
  admin_notes: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  active: 'text-green-400 bg-green-400/10',
  inactive: 'text-slate-400 bg-white/5',
  past_due: 'text-red-400 bg-red-400/10',
  canceled: 'text-slate-500 bg-white/5',
  trialing: 'text-blue-400 bg-blue-400/10',
};

const PLAN_PRICE: Record<string, number> = {
  hp: 999, lite: 4980, 'hp-bot': 4980, 'hp-bot-seo': 9800, agency: 19800,
};

const PLAN_COLOR: Record<string, string> = {
  hp: 'bg-sky-500',
  lite: 'bg-indigo-400',
  'hp-bot': 'bg-indigo-600',
  'hp-bot-seo': 'bg-purple-600',
  agency: 'bg-violet-600',
};

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '今日';
  if (days < 30) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString('ja-JP');
}

function riskLabel(score: number) {
  if (score >= 80) return { text: '高リスク', cls: 'text-red-400 bg-red-400/10' };
  if (score >= 50) return { text: '中リスク', cls: 'text-amber-400 bg-amber-400/10' };
  return { text: '低リスク', cls: 'text-yellow-300 bg-yellow-300/10' };
}

type Tab = 'overview' | 'users' | 'churn';

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [churnEmails, setChurnEmails] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const [statsRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users'),
      ]);
      if (statsRes.status === 403) { setError('管理者権限がありません'); setLoading(false); return; }
      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      setStats(statsData);
      const userList = (usersData.users || []) as User[];
      setUsers(userList);
      // Build churn user → email map
      const emailMap: Record<string, string> = {};
      for (const u of userList) emailMap[u.id] = u.email || '';
      setChurnEmails(emailMap);
      setLoading(false);
    })();
  }, []);

  const handleToggleSuspend = async (userId: string, suspended: boolean) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_suspended: !suspended }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: !suspended } : u));
  };

  const handleSaveNote = async (userId: string) => {
    setSavingNote(userId);
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_notes: noteValue }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, admin_notes: noteValue } : u));
    setEditingNote(null);
    setSavingNote(null);
  };

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.business_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || u.subscription_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: '概要' },
    { id: 'users', label: `ユーザー (${users.length})` },
    { id: 'churn', label: `チャーンリスク (${stats?.churnRisk?.length ?? 0})` },
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#080f1e] text-white flex items-center justify-center">
      <div className="text-slate-500 text-sm animate-pulse">読み込み中...</div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen bg-[#080f1e] text-white flex items-center justify-center">
      <div className="text-red-400">{error}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080f1e] text-white">
      <header className="border-b border-white/[0.07] px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← 戻る</button>
        <h1 className="text-sm font-bold text-white">管理者ダッシュボード</h1>
        <span className="ml-auto text-[10px] text-slate-600 font-mono">{new Date().toLocaleDateString('ja-JP')}</span>
      </header>

      {/* Tabs */}
      <div className="border-b border-white/[0.07] px-6 flex gap-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === tab.id ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Overview tab ── */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-8">

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: '総ユーザー', value: stats.totalUsers, color: 'text-white' },
                { label: 'アクティブ', value: stats.activeUsers, color: 'text-green-400' },
                { label: '支払遅延', value: stats.pastDueUsers, color: stats.pastDueUsers > 0 ? 'text-red-400' : 'text-slate-500' },
                { label: '総サイト', value: stats.totalSites, color: 'text-white' },
                { label: '公開中', value: stats.publishedSites, color: 'text-blue-400' },
                { label: 'MRR', value: `¥${stats.mrr.toLocaleString()}`, color: 'text-yellow-400' },
              ].map(s => (
                <div key={s.label} className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 text-center">
                  <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-slate-500 text-[10px] mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Plan breakdown */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5">プラン分布</h2>
              <div className="space-y-3">
                {Object.entries(stats.planBreakdown)
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([plan, count]) => {
                    const pct = stats.activeUsers > 0 ? Math.round((count / stats.activeUsers) * 100) : 0;
                    const revenue = count * (PLAN_PRICE[plan] || 0);
                    return (
                      <div key={plan}>
                        <div className="flex items-center justify-between mb-1.5 text-xs">
                          <span className="text-slate-300 font-semibold">{plan}</span>
                          <div className="flex items-center gap-4 text-slate-500">
                            <span>{count}名 ({pct}%)</span>
                            <span className="text-yellow-400/80 font-mono">¥{revenue.toLocaleString()}/月</span>
                          </div>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${PLAN_COLOR[plan] || 'bg-slate-500'} transition-all duration-700`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div className="mt-5 pt-4 border-t border-white/[0.07] flex items-center justify-between">
                <span className="text-xs text-slate-500">推計年間収益 (ARR)</span>
                <span className="text-lg font-black text-yellow-400">¥{(stats.mrr * 12).toLocaleString()}</span>
              </div>
            </div>

            {/* Recent signups from user list */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">最近の登録（30日以内）</h2>
              {(() => {
                const thirtyDaysAgo = Date.now() - 30 * 86400000;
                const recent = users
                  .filter(u => new Date(u.created_at).getTime() > thirtyDaysAgo)
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 10);
                if (recent.length === 0) return <p className="text-slate-600 text-sm">新規登録なし</p>;
                return (
                  <div className="space-y-2">
                    {recent.map(u => (
                      <div key={u.id} className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                        <div>
                          <div className="text-xs text-white font-medium">{u.email}</div>
                          {u.business_name && <div className="text-[10px] text-slate-500">{u.business_name}</div>}
                        </div>
                        <div className="flex items-center gap-3">
                          {u.plan && (
                            <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">{u.plan}</span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_COLOR[u.subscription_status] || 'text-slate-500'}`}>
                            {u.subscription_status}
                          </span>
                          <span className="text-[10px] text-slate-600">{timeAgo(u.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── Users tab ── */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                placeholder="メール・事業者名で検索..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full sm:w-72 bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-white/20"
              />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none"
              >
                <option value="all">すべて</option>
                <option value="active">active</option>
                <option value="past_due">past_due</option>
                <option value="canceled">canceled</option>
                <option value="inactive">inactive</option>
              </select>
              <span className="text-slate-600 text-xs ml-auto">{filtered.length} / {users.length}</span>
            </div>

            <div className="border border-white/[0.07] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                    {['メール / 事業者名', 'プラン', 'ステータス', 'サイト', '最終ログイン', '登録日', '操作'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] text-slate-500 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <>
                      <tr key={u.id} className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${u.is_suspended ? 'opacity-40' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="text-white text-xs font-medium truncate max-w-[180px]">{u.email}</div>
                          {u.business_name && <div className="text-slate-500 text-[10px]">{u.business_name}</div>}
                        </td>
                        <td className="px-4 py-3">
                          {u.plan
                            ? <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded-full">{u.plan}</span>
                            : <span className="text-slate-600 text-[10px]">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[u.subscription_status] || 'text-slate-400'}`}>
                            {u.subscription_status}
                          </span>
                          {u.is_suspended && <span className="ml-1 text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">停止中</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{u.site_count}</td>
                        <td className="px-4 py-3 text-slate-500 text-[10px]">{timeAgo(u.last_sign_in_at)}</td>
                        <td className="px-4 py-3 text-slate-500 text-[10px]">{timeAgo(u.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleSuspend(u.id, u.is_suspended)}
                              className={`text-[10px] px-2 py-1 rounded border transition-all ${u.is_suspended ? 'border-green-500/30 text-green-400 hover:bg-green-500/10' : 'border-red-500/30 text-red-400 hover:bg-red-500/10'}`}
                            >
                              {u.is_suspended ? '解除' : '停止'}
                            </button>
                            <button
                              onClick={() => { setEditingNote(editingNote === u.id ? null : u.id); setNoteValue(u.admin_notes || ''); }}
                              className="text-[10px] px-2 py-1 rounded border border-white/10 text-slate-400 hover:text-slate-200 transition-all"
                            >
                              メモ
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editingNote === u.id && (
                        <tr key={`${u.id}-note`} className="border-b border-white/[0.04] bg-white/[0.02]">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={noteValue}
                                onChange={e => setNoteValue(e.target.value)}
                                placeholder="管理者メモ..."
                                className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none"
                              />
                              <button
                                onClick={() => handleSaveNote(u.id)}
                                disabled={savingNote === u.id}
                                className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded border border-white/10 transition-all disabled:opacity-50"
                              >
                                保存
                              </button>
                            </div>
                            {u.admin_notes && <div className="text-slate-500 text-[10px] mt-1">現在: {u.admin_notes}</div>}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-12 text-center text-slate-600 text-sm">ユーザーが見つかりません</div>
              )}
            </div>
          </div>
        )}

        {/* ── Churn risk tab ── */}
        {activeTab === 'churn' && (
          <div className="space-y-4">
            <p className="text-slate-500 text-xs">サイト未公開・長期未活動・問い合わせゼロのアクティブユーザーです。フォローアップを検討してください。</p>

            {(!stats?.churnRisk || stats.churnRisk.length === 0) ? (
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-12 text-center">
                <div className="text-3xl mb-3">✅</div>
                <p className="text-slate-400 font-semibold">チャーンリスクのあるユーザーはいません</p>
              </div>
            ) : (
              <div className="border border-white/[0.07] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                      {['ユーザー', 'プラン', 'リスク', '未活動日数', 'サイト公開', '問い合わせ', 'アクション'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] text-slate-500 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.churnRisk.map(u => {
                      const risk = riskLabel(u.score);
                      const email = churnEmails[u.id] || u.id.slice(0, 8) + '...';
                      return (
                        <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-xs text-white font-medium truncate max-w-[180px]">{email}</div>
                            <div className="text-[10px] text-slate-600 font-mono">{u.id.slice(0, 8)}…</div>
                          </td>
                          <td className="px-4 py-3">
                            {u.plan
                              ? <span className="text-[10px] text-slate-300 bg-white/5 px-2 py-0.5 rounded-full">{u.plan}</span>
                              : <span className="text-slate-600 text-[10px]">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${risk.cls}`}>{risk.text}</span>
                              <span className="text-[10px] text-slate-600">{u.score}点</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{u.daysSinceActive}日</td>
                          <td className="px-4 py-3">
                            {u.hasPublished
                              ? <span className="text-green-400 text-xs">✓</span>
                              : <span className="text-red-400 text-xs">✗ 未公開</span>}
                          </td>
                          <td className="px-4 py-3">
                            {u.hasRecentContact
                              ? <span className="text-green-400 text-xs">✓</span>
                              : <span className="text-slate-500 text-xs">なし</span>}
                          </td>
                          <td className="px-4 py-3">
                            <a
                              href={`mailto:${email}?subject=LARU HP サポートのご案内&body=こんにちは。LARU HP サポートです。ご利用状況はいかがでしょうか？`}
                              className="text-[10px] px-2.5 py-1 rounded border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 transition-all"
                            >
                              メール送信
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
