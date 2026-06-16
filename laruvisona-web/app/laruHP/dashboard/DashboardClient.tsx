'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Site {
  id: string;
  name: string;
  slug: string | null;
  industry: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

interface Profile {
  business_name: string | null;
  subscription_status: string;
  contract_ends_at: string | null;
  stripe_customer_id: string | null;
}

const INDUSTRY_EMOJI: Record<string, string> = {
  restaurant: '🍜', beauty: '💇', clinic: '💊', legal: '⚖️',
  construction: '🏗️', realestate: '🏠', retail: '🛍️',
  fitness: '💪', hotel: '🏨', education: '📚',
};

const INDUSTRY_GRADIENT: Record<string, string> = {
  restaurant: 'from-orange-900/50 to-red-900/50',
  beauty: 'from-pink-900/50 to-purple-900/50',
  clinic: 'from-blue-900/50 to-teal-900/50',
  legal: 'from-slate-800 to-gray-900/80',
  construction: 'from-amber-900/50 to-yellow-900/50',
  realestate: 'from-emerald-900/50 to-green-900/50',
  retail: 'from-violet-900/50 to-purple-900/50',
  fitness: 'from-red-900/50 to-orange-900/50',
  hotel: 'from-sky-900/50 to-blue-900/50',
  education: 'from-indigo-900/50 to-blue-900/50',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '有効', color: 'text-green-400 bg-green-400/10' },
  inactive: { label: '未契約', color: 'text-slate-400 bg-white/5' },
  trialing: { label: 'トライアル', color: 'text-blue-400 bg-blue-400/10' },
  past_due: { label: '支払い遅延', color: 'text-red-400 bg-red-400/10' },
  canceled: { label: '解約済み', color: 'text-slate-500 bg-white/5' },
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString('ja-JP');
}

export default function DashboardPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/laruHP/auth/login'); return; }
      setUserEmail(user.email || '');

      const [sitesRes, profileRes] = await Promise.all([
        fetch('/api/sites'),
        supabase.from('profiles').select('business_name, subscription_status, contract_ends_at, stripe_customer_id').eq('id', user.id).single(),
      ]);

      const sitesData = await sitesRes.json();
      setSites(sitesData.sites || []);
      setProfile(profileRes.data);
      setLoading(false);
    })();
  }, []);

  const handlePublish = async (siteId: string) => {
    setPublishing(siteId);
    const res = await fetch(`/api/sites/${siteId}/publish`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setSites(prev => prev.map(s => s.id === siteId ? { ...s, published: true, slug: data.slug || s.slug } : s));
    }
    setPublishing(null);
  };

  const handleUnpublish = async (siteId: string) => {
    setPublishing(siteId);
    await fetch(`/api/sites/${siteId}/publish`, { method: 'DELETE' });
    setSites(prev => prev.map(s => s.id === siteId ? { ...s, published: false } : s));
    setPublishing(null);
  };

  const handleDelete = async (siteId: string) => {
    if (!confirm('このサイトを削除しますか？この操作は取り消せません。')) return;
    setDeleting(siteId);
    await fetch(`/api/sites/${siteId}`, { method: 'DELETE' });
    setSites(prev => prev.filter(s => s.id !== siteId));
    setDeleting(null);
  };

  const handleDuplicate = async (siteId: string) => {
    setDuplicating(siteId);
    const res = await fetch(`/api/sites/${siteId}/duplicate`, { method: 'POST' });
    const data = await res.json();
    if (data.site) setSites(prev => [...prev, data.site]);
    setDuplicating(null);
  };

  const handleCopyUrl = async (slug: string, siteId: string) => {
    const url = `${window.location.origin}/hp/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(siteId);
    setTimeout(() => setCopied(null), 2000);
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    setPortalError('');
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else if (data.error === 'minimum_contract') {
      setPortalError(data.message);
    } else {
      setPortalError('エラーが発生しました');
    }
    setPortalLoading(false);
  };

  const handleCheckout = async () => {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/laruHP');
  };

  const handleNewSite = async () => {
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '新しいサイト' }),
    });
    const data = await res.json();
    if (data.site) {
      router.push(`/laruHP/builder?siteId=${data.site.id}`);
    }
  };

  const status = STATUS_MAP[profile?.subscription_status || 'inactive'];

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/laruHP" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white text-black rounded-lg flex items-center justify-center font-black text-sm">L</div>
            <span className="font-bold text-lg">LARU<span className="text-blue-400 font-light">HP</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm hidden sm:block">{userEmail}</span>
            <button onClick={handleLogout} className="text-slate-400 hover:text-white text-sm border border-white/10 hover:border-white/30 px-4 py-2 rounded-xl transition-all">
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Subscription Status */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-bold">{profile?.business_name || userEmail}</h2>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${status.color}`}>
                  {status.label}
                </span>
              </div>
              {profile?.subscription_status === 'active' && profile.contract_ends_at && (
                <p className="text-slate-500 text-sm">
                  最低契約期間: 〜{new Date(profile.contract_ends_at).toLocaleDateString('ja-JP')}
                </p>
              )}
              {portalError && <p className="text-red-400 text-sm mt-2">{portalError}</p>}
            </div>
            <div className="flex gap-3">
              {profile?.subscription_status === 'active' ? (
                <button onClick={handlePortal} disabled={portalLoading}
                  className="text-sm border border-white/10 hover:border-white/30 px-4 py-2 rounded-xl transition-all disabled:opacity-50">
                  {portalLoading ? '...' : '💳 サブスクリプション管理'}
                </button>
              ) : (
                <button onClick={handleCheckout}
                  className="bg-white text-black font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-all">
                  🎁 初月1円で始める
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sites Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black">マイサイト</h1>
            {!loading && sites.length > 0 && (
              <p className="text-slate-500 text-sm mt-0.5">{sites.length}件 · {sites.filter(s => s.published).length}件公開中</p>
            )}
          </div>
          <div className="flex gap-3">
            <Link href="/laruHP/onboarding" className="text-sm border border-white/10 hover:border-blue-500/50 px-4 py-2 rounded-xl transition-all flex items-center gap-2">
              🤖 AIウィザードで作る
            </Link>
            <button onClick={handleNewSite} className="bg-white text-black font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-all flex items-center gap-2">
              ＋ 新しいサイト
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-36 bg-white/5" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-white/10 rounded w-2/3" />
                  <div className="h-3 bg-white/5 rounded w-1/3" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-8 bg-white/10 rounded-xl flex-1" />
                    <div className="h-8 bg-white/10 rounded-xl w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-20 bg-white/5 border border-white/10 border-dashed rounded-3xl">
            <div className="text-5xl mb-4">📄</div>
            <h3 className="text-xl font-bold mb-2">まだサイトがありません</h3>
            <p className="text-slate-400 mb-8">AIウィザードで業種情報を入力するだけで、5分でサイトが完成します</p>
            <Link href="/laruHP/onboarding" className="bg-white text-black font-bold px-8 py-4 rounded-2xl hover:scale-105 transition-transform inline-block">
              🚀 AIでサイトを作る →
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sites.map(site => {
              const gradient = INDUSTRY_GRADIENT[site.industry || ''] || 'from-slate-800 to-slate-900';
              return (
                <div key={site.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all group flex flex-col">
                  {/* Thumbnail */}
                  <div className={`bg-gradient-to-br ${gradient} h-36 flex flex-col items-center justify-center relative`}>
                    <span className="text-5xl mb-1 group-hover:scale-110 transition-transform">
                      {INDUSTRY_EMOJI[site.industry || ''] || '🌐'}
                    </span>
                    <span className={`absolute top-3 right-3 text-[11px] font-bold px-2 py-0.5 rounded-full ${site.published ? 'bg-green-400/20 text-green-400 border border-green-400/30' : 'bg-white/10 text-slate-400 border border-white/10'}`}>
                      {site.published ? '● 公開中' : '○ 非公開'}
                    </span>
                    {site.published && site.slug && (
                      <button
                        onClick={() => handleCopyUrl(site.slug!, site.id)}
                        title="URLをコピー"
                        className="absolute bottom-3 right-3 text-[10px] bg-black/40 hover:bg-black/60 border border-white/10 px-2 py-0.5 rounded-lg transition-all text-slate-300"
                      >
                        {copied === site.id ? '✅ コピー済み' : '🔗 URLコピー'}
                      </button>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="mb-3">
                      <h3 className="font-bold text-white text-sm truncate mb-0.5">{site.name}</h3>
                      {site.slug ? (
                        <p className="text-slate-500 text-[11px] font-mono truncate">/hp/{site.slug}</p>
                      ) : (
                        <p className="text-slate-600 text-[11px]">未公開</p>
                      )}
                    </div>

                    <p className="text-slate-600 text-[11px] mb-4">更新 {relativeTime(site.updated_at)}</p>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap mt-auto">
                      <Link href={`/laruHP/builder?siteId=${site.id}`}
                        className="flex-1 text-center text-xs font-bold bg-white text-black py-2 px-3 rounded-xl hover:bg-blue-50 transition-all min-w-[72px]">
                        ✏️ 編集
                      </Link>
                      {site.published ? (
                        <>
                          <a href={`/hp/${site.slug}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs border border-white/10 hover:border-white/30 py-2 px-3 rounded-xl transition-all">
                            👁 表示
                          </a>
                          <button onClick={() => handleUnpublish(site.id)} disabled={publishing === site.id}
                            className="text-xs border border-white/10 hover:border-red-500/30 hover:text-red-400 py-2 px-3 rounded-xl transition-all disabled:opacity-50">
                            {publishing === site.id ? '...' : '非公開'}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handlePublish(site.id)} disabled={publishing === site.id}
                          className="text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 py-2 px-3 rounded-xl transition-all disabled:opacity-50">
                          {publishing === site.id ? '公開中...' : '🚀 公開'}
                        </button>
                      )}
                      <button onClick={() => handleDuplicate(site.id)} disabled={duplicating === site.id}
                        className="text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/30 py-2 px-3 rounded-xl transition-all disabled:opacity-50">
                        {duplicating === site.id ? '...' : '複製'}
                      </button>
                      <button onClick={() => handleDelete(site.id)} disabled={deleting === site.id}
                        className="text-xs text-red-400/40 hover:text-red-400 py-2 px-3 rounded-xl transition-all disabled:opacity-50">
                        {deleting === site.id ? '...' : '削除'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New site card */}
            <button onClick={handleNewSite}
              className="bg-white/3 border border-white/10 border-dashed rounded-2xl h-[260px] flex flex-col items-center justify-center hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">＋</div>
              <div className="text-slate-400 text-sm font-medium">新しいサイトを作成</div>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
