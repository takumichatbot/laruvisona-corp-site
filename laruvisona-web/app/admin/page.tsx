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
}

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  business_name: string | null;
  subscription_status: string;
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

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '今日';
  if (days < 30) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString('ja-JP');
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [savingNote, setSavingNote] = useState<string | null>(null);
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
      setUsers(usersData.users || []);
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

  const filtered = users.filter(u =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.business_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="min-h-screen bg-[#080f1e] text-white flex items-center justify-center text-slate-500">読み込み中...</div>;
  if (error) return <div className="min-h-screen bg-[#080f1e] text-white flex items-center justify-center text-red-400">{error}</div>;

  return (
    <div className="min-h-screen bg-[#080f1e] text-white">
      <header className="border-b border-white/[0.07] px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← 戻る</button>
        <h1 className="text-sm font-bold">管理者ダッシュボード</h1>
        <span className="ml-auto text-[10px] text-slate-600 font-mono">{new Date().toLocaleDateString('ja-JP')}</span>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {[
              { label: '総ユーザー', value: stats.totalUsers, color: 'text-white' },
              { label: '有効', value: stats.activeUsers, color: 'text-green-400' },
              { label: '支払遅延', value: stats.pastDueUsers, color: 'text-red-400' },
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
        )}

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="メール・事業者名で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-80 bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-white/20"
          />
        </div>

        {/* Users table */}
        <div className="border border-white/[0.07] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                {['メール / 事業者名', 'ステータス', 'サイト数', '最終ログイン', '登録日', '操作'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] text-slate-500 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <>
                  <tr key={u.id} className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${u.is_suspended ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="text-white text-xs font-medium truncate max-w-[180px]">{u.email}</div>
                      {u.business_name && <div className="text-slate-500 text-[10px]">{u.business_name}</div>}
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
                      <td colSpan={6} className="px-4 py-3">
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

        <p className="text-slate-600 text-xs mt-4 text-right">{filtered.length} / {users.length} ユーザー</p>
      </main>
    </div>
  );
}
