'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface UserFeatures { builder: boolean; publish: boolean; ai: boolean; }

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  business_name: string | null;
  subscription_status: string;
  is_suspended: boolean;
  admin_notes: string | null;
  site_count: number;
  features: UserFeatures;
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  pastDueUsers: number;
  totalSites: number;
  publishedSites: number;
  mrr: number;
}

const SUB_BADGE: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border border-green-500/30',
  inactive: 'bg-white/5 text-slate-500 border border-white/10',
  trialing: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  past_due: 'bg-red-500/20 text-red-400 border border-red-500/30',
  canceled: 'bg-slate-700/50 text-slate-500 border border-white/5',
};
const SUB_LABEL: Record<string, string> = {
  active: '有効', inactive: '未契約', trialing: 'トライアル', past_due: '支払い遅延', canceled: '解約済み',
};

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-white/20'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function relTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '今日';
  if (days < 30) return `${days}日前`;
  return new Date(d).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSub, setFilterSub] = useState('all');
  const [saving, setSaving] = useState<string | null>(null);
  const [notesUser, setNotesUser] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/laruHP/auth/login'); return; }

      const [statsRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users'),
      ]);

      if (statsRes.status === 403 || usersRes.status === 403) {
        router.push('/laruHP/dashboard');
        return;
      }

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      setStats(statsData);
      setUsers(usersData.users || []);
      setLoading(false);
    })();
  }, []);

  const updateUser = async (userId: string, patch: Partial<Pick<AdminUser, 'features' | 'is_suspended' | 'admin_notes'>>) => {
    setSaving(userId);
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } : u));
    setSaving(null);
  };

  const toggleFeature = (user: AdminUser, key: keyof UserFeatures) => {
    const next = { ...user.features, [key]: !user.features[key] };
    updateUser(user.id, { features: next });
  };

  const toggleSuspend = (user: AdminUser) => {
    updateUser(user.id, { is_suspended: !user.is_suspended });
  };

  const saveNotes = (userId: string) => {
    updateUser(userId, { admin_notes: notesText });
    setNotesUser(null);
  };

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.business_name || '').toLowerCase().includes(search.toLowerCase());
    const matchSub = filterSub === 'all' || u.subscription_status === filterSub;
    return matchSearch && matchSub;
  });

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/laruHP/dashboard" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white text-black rounded-lg flex items-center justify-center font-black text-sm">L</div>
              <span className="font-bold text-lg">LARU<span className="text-blue-400 font-light">HP</span></span>
            </Link>
            <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full font-bold">ADMIN</span>
          </div>
          <Link href="/laruHP/dashboard" className="text-slate-400 hover:text-white text-sm border border-white/10 hover:border-white/30 px-4 py-2 rounded-xl transition-all">
            ダッシュボードへ戻る
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-black">管理者ダッシュボード</h1>
          <p className="text-slate-500 text-sm mt-1">ユーザー・サイト・収益の管理</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[
              { label: '総ユーザー', value: stats.totalUsers, color: 'text-white' },
              { label: 'アクティブ', value: stats.activeUsers, color: 'text-green-400' },
              { label: '支払い遅延', value: stats.pastDueUsers, color: 'text-red-400' },
              { label: '総サイト数', value: stats.totalSites, color: 'text-blue-400' },
              { label: '公開中', value: stats.publishedSites, color: 'text-cyan-400' },
              { label: 'MRR', value: `¥${stats.mrr.toLocaleString()}`, color: 'text-emerald-400' },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-slate-500 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            type="text"
            placeholder="メール・店舗名で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
          />
          <select
            value={filterSub}
            onChange={e => setFilterSub(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none"
          >
            <option value="all">全ステータス</option>
            <option value="active">有効</option>
            <option value="past_due">支払い遅延</option>
            <option value="inactive">未契約</option>
            <option value="canceled">解約済み</option>
          </select>
          <div className="text-slate-500 text-sm self-center whitespace-nowrap">{filtered.length}件</div>
        </div>

        {/* User table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl h-20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(user => (
              <div key={user.id} className={`bg-white/5 border rounded-2xl p-4 transition-all ${user.is_suspended ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 hover:border-white/20'}`}>
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">

                  {/* ユーザー情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white truncate">{user.business_name || user.email}</span>
                      {user.business_name && <span className="text-slate-500 text-xs truncate">{user.email}</span>}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${SUB_BADGE[user.subscription_status] || SUB_BADGE.inactive}`}>
                        {SUB_LABEL[user.subscription_status] || user.subscription_status}
                      </span>
                      {user.is_suspended && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/30 text-red-300 border border-red-500/40">停止中</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-500">
                      <span>サイト {user.site_count}件</span>
                      <span>登録 {relTime(user.created_at)}</span>
                      {user.last_sign_in_at && <span>最終ログイン {relTime(user.last_sign_in_at)}</span>}
                    </div>
                    {user.admin_notes && (
                      <p className="text-xs text-amber-400/80 mt-1 bg-amber-500/5 border border-amber-500/20 rounded-lg px-2.5 py-1.5">{user.admin_notes}</p>
                    )}
                  </div>

                  {/* 機能トグル */}
                  <div className="flex items-center gap-5">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-medium">ビルダー</span>
                      <Toggle
                        checked={user.features?.builder ?? true}
                        onChange={() => toggleFeature(user, 'builder')}
                        disabled={saving === user.id}
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-medium">公開</span>
                      <Toggle
                        checked={user.features?.publish ?? true}
                        onChange={() => toggleFeature(user, 'publish')}
                        disabled={saving === user.id}
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-medium">AI生成</span>
                      <Toggle
                        checked={user.features?.ai ?? true}
                        onChange={() => toggleFeature(user, 'ai')}
                        disabled={saving === user.id}
                      />
                    </div>
                  </div>

                  {/* アクション */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setNotesUser(user.id); setNotesText(user.admin_notes || ''); }}
                      className="text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/30 px-3 py-2 rounded-xl transition-all"
                    >
                      📝 メモ
                    </button>
                    <button
                      onClick={() => toggleSuspend(user)}
                      disabled={saving === user.id}
                      className={`text-xs px-3 py-2 rounded-xl border transition-all disabled:opacity-50 ${user.is_suspended ? 'border-green-500/30 text-green-400 hover:bg-green-500/10' : 'border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40'}`}
                    >
                      {saving === user.id ? '...' : user.is_suspended ? '✓ 停止解除' : '停止'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-16 text-slate-500">該当するユーザーがいません</div>
            )}
          </div>
        )}
      </main>

      {/* Notes modal */}
      {notesUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold mb-4">管理者メモ</h3>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="このユーザーに関するメモ..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setNotesUser(null)} className="flex-1 border border-white/10 text-slate-400 py-2.5 rounded-xl text-sm">キャンセル</button>
              <button onClick={() => saveNotes(notesUser)} className="flex-1 bg-white text-black font-bold py-2.5 rounded-xl text-sm">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
