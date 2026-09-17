'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/laruhp/AppShell';

interface UserFeatures { builder: boolean; publish: boolean; ai: boolean; }

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  business_name: string | null;
  subscription_status: string;
  plan: string | null;
  stripe_subscription_id: string | null;
  is_suspended: boolean;
  admin_notes: string | null;
  site_count: number;
  features: UserFeatures;
}

interface ChurnRiskUser {
  id: string;
  plan: string | null;
  score: number;
  hasPublished: boolean;
  hasRecentContact: boolean;
  daysSinceActive: number;
  siteCount: number;
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  pastDueUsers: number;
  totalSites: number;
  publishedSites: number;
  mrr: number;
  planBreakdown: { hp: number; lite: number; 'hp-bot': number; 'hp-bot-seo': number; agency: number };
  churnRisk: ChurnRiskUser[];
}

const SUB_BADGE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  inactive: 'bg-gray-50 text-gray-500 border border-gray-200',
  trialing: 'bg-sky-50 text-sky-600 border border-sky-200',
  past_due: 'bg-red-500/20 text-red-600 border border-red-500/30',
  canceled: 'bg-gray-100 text-gray-500 border border-gray-100',
};
const SUB_LABEL: Record<string, string> = {
  active: '有効', inactive: '未契約', trialing: 'トライアル', past_due: '支払い遅延', canceled: '解約済み',
};

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-sky-500' : 'bg-gray-200'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
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
  const [planChanging, setPlanChanging] = useState<string | null>(null);
  const [planSelects, setPlanSelects] = useState<Record<string, string>>({});
  const [canceling, setCanceling] = useState<string | null>(null);
  const [notesUser, setNotesUser] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const router = useRouter();

  const loadData = async () => {
    const [statsRes, usersRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/users'),
    ]);
    if (statsRes.status === 403) { setPinVerified(false); setLoading(false); return; }
    const statsData = await statsRes.json();
    const usersData = await usersRes.json();
    setStats(statsData);
    setUsers(usersData.users || []);
    setLoading(false);
    setPinVerified(true);
  };

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void loadData(); });
    return () => { active = false; };
  }, []);

  const handlePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinLoading(true);
    setPinError('');
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pinInput }),
    });
    if (res.ok) {
      await loadData();
    } else {
      setPinError('PINが正しくありません');
      setPinLoading(false);
    }
  };

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

  const changePlan = async (userId: string) => {
    const plan = planSelects[userId];
    if (!plan) return;
    setPlanChanging(userId);
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan } : u));
    setPlanChanging(null);
  };

  const forceCancel = async (userId: string, email: string) => {
    if (!confirm(`${email} のサブスクリプションを強制解約しますか？\nこの操作は取り消せません。`)) return;
    setCanceling(userId);
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force_cancel: true }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscription_status: 'canceled', plan: null, stripe_subscription_id: null } : u));
    setCanceling(null);
  };

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.business_name || '').toLowerCase().includes(search.toLowerCase());
    const matchSub = filterSub === 'all' || u.subscription_status === filterSub;
    return matchSearch && matchSub;
  });

  // PIN 未認証（loading 中でも表示）
  if (!pinVerified) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="text-gray-900 font-bold text-2xl mb-2 text-center">管理者ページ</h1>
          <p className="text-gray-500 text-sm text-center mb-8">ADMIN PIN を入力してください</p>
          <form onSubmit={handlePin} className="space-y-4">
            <input
              type="password"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              placeholder="PIN"
              autoFocus
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 text-center text-2xl tracking-widest"
            />
            {pinError && <p className="text-red-600 text-sm text-center">{pinError}</p>}
            <button
              type="submit"
              disabled={pinLoading || !pinInput}
              className="w-full bg-sky-600 text-white py-3 rounded-xl font-bold hover:bg-sky-500 transition disabled:opacity-50"
            >
              {pinLoading ? '確認中...' : 'ログイン'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AppShell title="運営ダッシュボード" lead="契約と稼働の全体像。自社用の画面です。" actions={<span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-full font-bold">ADMIN</span>}>
      {/* Header */}
      

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Stats */}
        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
              {[
                { label: '総ユーザー', value: stats.totalUsers, color: 'text-gray-900' },
                { label: 'アクティブ', value: stats.activeUsers, color: 'text-emerald-600' },
                { label: '支払い遅延', value: stats.pastDueUsers, color: 'text-red-600' },
                { label: '総サイト数', value: stats.totalSites, color: 'text-sky-600' },
                { label: '公開中', value: stats.publishedSites, color: 'text-cyan-600' },
                { label: 'MRR', value: `¥${stats.mrr.toLocaleString()}`, color: 'text-emerald-600' },
              ].map((s, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                  <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-gray-500 text-xs mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            {stats.planBreakdown && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                {[
                  { label: 'HP (¥999)', value: stats.planBreakdown.hp || 0, color: 'text-gray-600' },
                  { label: 'Lite (¥2,980)', value: stats.planBreakdown['lite'] || 0, color: 'text-purple-300' },
                  { label: 'HP+Bot (¥4,980)', value: stats.planBreakdown['hp-bot'] || 0, color: 'text-indigo-300' },
                  { label: 'HP+Bot+SEO (¥9,800)', value: stats.planBreakdown['hp-bot-seo'] || 0, color: 'text-emerald-300' },
                  { label: 'Agency (¥19,800)', value: stats.planBreakdown['agency'] || 0, color: 'text-amber-300' },
                ].map((p, i) => (
                  <div key={i} className="bg-white/[0.03] border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-gray-500 text-xs">{p.label}</span>
                    <span className={`text-lg font-bold ${p.color}`}>{p.value}人</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Churn Risk */}
        {stats?.churnRisk && stats.churnRisk.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-red-600 font-bold text-sm">解約リスクユーザー</span>
              <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">{stats.churnRisk.length}件</span>
            </div>
            <div className="space-y-2">
              {stats.churnRisk.map(r => {
                const u = users.find(u => u.id === r.id);
                return (
                  <div key={r.id} className="bg-white/[0.03] border border-gray-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{u?.email || r.id}</div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {!r.hasPublished && <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">未公開</span>}
                        {r.daysSinceActive > 14 && <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">{r.daysSinceActive}日間未操作</span>}
                        {!r.hasRecentContact && <span className="text-[10px] bg-gray-100 text-gray-500 border border-gray-300 px-2 py-0.5 rounded-full">30日間問い合わせなし</span>}
                        {r.siteCount === 0 && <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">サイト未作成</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-gray-500">リスクスコア</div>
                        <div className={`text-lg font-black ${r.score >= 80 ? 'text-red-600' : r.score >= 60 ? 'text-amber-600' : 'text-yellow-400'}`}>{r.score}</div>
                      </div>
                      {u && (
                        <button
                          onClick={() => { setNotesUser(u.id); setNotesText(u.admin_notes || ''); }}
                          className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-400 px-2.5 py-1.5 rounded-lg transition-all"
                        >
                          メモ
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            type="text"
            placeholder="メール・店舗名で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500"
          />
          <select
            value={filterSub}
            onChange={e => setFilterSub(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-600 focus:outline-none"
          >
            <option value="all">全ステータス</option>
            <option value="active">有効</option>
            <option value="past_due">支払い遅延</option>
            <option value="inactive">未契約</option>
            <option value="canceled">解約済み</option>
          </select>
          <div className="text-gray-500 text-sm self-center whitespace-nowrap">{filtered.length}件</div>
        </div>

        {/* User table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-gray-50 border border-gray-200 rounded-2xl h-20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(user => (
              <div key={user.id} className={`bg-gray-50 border rounded-2xl p-4 transition-all ${user.is_suspended ? 'border-red-200 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">

                  {/* ユーザー情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900 truncate">{user.business_name || user.email}</span>
                      {user.business_name && <span className="text-gray-500 text-xs truncate">{user.email}</span>}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${SUB_BADGE[user.subscription_status] || SUB_BADGE.inactive}`}>
                        {SUB_LABEL[user.subscription_status] || user.subscription_status}
                      </span>
                      {user.is_suspended && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/30 text-red-600 border border-red-200">停止中</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-[11px] text-gray-500">
                      <span>サイト {user.site_count}件</span>
                      <span>登録 {relTime(user.created_at)}</span>
                      {user.last_sign_in_at && <span>最終ログイン {relTime(user.last_sign_in_at)}</span>}
                    </div>
                    {user.admin_notes && (
                      <p className="text-xs text-amber-400/80 mt-1 bg-amber-500/5 border border-amber-200 rounded-lg px-2.5 py-1.5">{user.admin_notes}</p>
                    )}
                  </div>

                  {/* 機能トグル */}
                  <div className="flex items-center gap-5">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-gray-500 font-medium">ビルダー</span>
                      <Toggle
                        checked={user.features?.builder ?? true}
                        onChange={() => toggleFeature(user, 'builder')}
                        disabled={saving === user.id}
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-gray-500 font-medium">公開</span>
                      <Toggle
                        checked={user.features?.publish ?? true}
                        onChange={() => toggleFeature(user, 'publish')}
                        disabled={saving === user.id}
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-gray-500 font-medium">AI生成</span>
                      <Toggle
                        checked={user.features?.ai ?? true}
                        onChange={() => toggleFeature(user, 'ai')}
                        disabled={saving === user.id}
                      />
                    </div>
                  </div>

                  {/* アクション */}
                  <div className="flex flex-col gap-2">
                    {/* プラン変更 */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={planSelects[user.id] ?? user.plan ?? 'hp'}
                        onChange={e => setPlanSelects(p => ({ ...p, [user.id]: e.target.value }))}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-sky-500"
                      >
                        <option value="hp">HP (¥999)</option>
                        <option value="lite">Lite (¥2,980)</option>
                        <option value="hp-bot">HP+Bot (¥4,980)</option>
                        <option value="hp-bot-seo">HP+Bot+SEO (¥9,800)</option>
                        <option value="agency">Agency (¥19,800)</option>
                      </select>
                      <button
                        onClick={() => changePlan(user.id)}
                        disabled={planChanging === user.id || !planSelects[user.id] || planSelects[user.id] === user.plan}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-sky-200 text-sky-600 hover:bg-sky-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {planChanging === user.id ? '...' : '変更'}
                      </button>
                    </div>
                    {/* メモ・停止・解約 */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { setNotesUser(user.id); setNotesText(user.admin_notes || ''); }}
                        className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-400 px-2.5 py-1.5 rounded-lg transition-all"
                      >
                        メモ
                      </button>
                      <button
                        onClick={() => toggleSuspend(user)}
                        disabled={saving === user.id}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${user.is_suspended ? 'border-emerald-200 text-emerald-600 hover:bg-green-500/10' : 'border-amber-200 text-amber-400/70 hover:text-amber-400 hover:border-amber-500/40'}`}
                      >
                        {saving === user.id ? '...' : user.is_suspended ? '停止解除' : '停止'}
                      </button>
                      {user.stripe_subscription_id && (
                        <button
                          onClick={() => forceCancel(user.id, user.email)}
                          disabled={canceling === user.id}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-400/70 hover:text-red-600 hover:border-red-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {canceling === user.id ? '...' : '強制解約'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-16 text-gray-500">該当するユーザーがいません</div>
            )}
          </div>
        )}
      </main>

      {/* Notes modal */}
      {notesUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold mb-4">管理者メモ</h3>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="このユーザーに関するメモ..."
              rows={4}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setNotesUser(null)} className="flex-1 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm">キャンセル</button>
              <button onClick={() => saveNotes(notesUser)} className="flex-1 bg-sky-600 text-white font-bold py-2.5 rounded-xl text-sm">保存</button>
            </div>
          </div>
        </div>
      )}
    
    </AppShell>
  );
}
