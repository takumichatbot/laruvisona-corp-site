'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

interface Site {
  id: string;
  name: string;
  slug: string | null;
  industry: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
  view_count: number;
  custom_domain: string | null;
}

interface Profile {
  business_name: string | null;
  subscription_status: string;
  contract_ends_at: string | null;
  stripe_customer_id: string | null;
}

const INDUSTRY_LABEL: Record<string, string> = {
  restaurant: '飲食', beauty: '美容', clinic: '医療', legal: '法律',
  construction: '建設', realestate: '不動産', retail: '小売',
  fitness: 'フィットネス', hotel: 'ホテル', education: '教育',
};

const INDUSTRY_GRADIENT: Record<string, string> = {
  restaurant: 'from-orange-900/60 to-red-900/60',
  beauty: 'from-pink-900/60 to-purple-900/60',
  clinic: 'from-blue-900/60 to-teal-900/60',
  legal: 'from-slate-800/80 to-slate-900',
  construction: 'from-amber-900/60 to-yellow-900/60',
  realestate: 'from-emerald-900/60 to-green-900/60',
  retail: 'from-violet-900/60 to-purple-900/60',
  fitness: 'from-red-900/60 to-orange-900/60',
  hotel: 'from-sky-900/60 to-blue-900/60',
  education: 'from-indigo-900/60 to-blue-900/60',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:   { label: '有効',       color: 'text-green-400 bg-green-400/10 border border-green-400/20' },
  inactive: { label: '未契約',     color: 'text-slate-400 bg-white/5 border border-white/10' },
  trialing: { label: 'トライアル', color: 'text-blue-400 bg-blue-400/10 border border-blue-400/20' },
  past_due: { label: '支払い遅延', color: 'text-red-400 bg-red-400/10 border border-red-400/20' },
  canceled: { label: '解約済み',   color: 'text-slate-500 bg-white/5 border border-white/10' },
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

// ── Icons ──────────────────────────────────────────────────────────────────
function IcEdit() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IcEye() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function IcCopy() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
}
function IcCheck() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function IcTrash() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
}
function IcDuplicate() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>;
}
function IcPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function IcSparkle() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/></svg>;
}
function IcAlert() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}
function IcInfo() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
}
function IcCard() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
}
function IcGlobe() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
}

// ── Component ──────────────────────────────────────────────────────────────
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
  const [paymentBanner, setPaymentBanner] = useState<'success' | 'canceled' | null>(null);
  const [domainInputs, setDomainInputs] = useState<Record<string, string>>({});
  const [savingDomain, setSavingDomain] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const p = searchParams.get('payment');
    if (p === 'success' || p === 'canceled') {
      setPaymentBanner(p);
      router.replace('/laruHP/dashboard');
    }
  }, [searchParams, router]);

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
      const loadedSites: Site[] = sitesData.sites || [];
      setSites(loadedSites);
      const initDomains: Record<string, string> = {};
      for (const s of loadedSites) initDomains[s.id] = s.custom_domain || '';
      setDomainInputs(initDomains);
      setProfile(profileRes.data);
      setLoading(false);
    })();
  }, []);

  const handlePublish = async (siteId: string) => {
    setPublishing(siteId);
    const res = await fetch(`/api/sites/${siteId}/publish`, { method: 'POST' });
    const data = await res.json();
    if (data.error === 'subscription_required') {
      setPublishing(null);
      if (confirm('サイトを公開するにはサブスクリプションが必要です。今すぐ申し込みますか？')) {
        handleCheckout();
      }
      return;
    }
    if (data.success) {
      setSites(prev => prev.map(s => s.id === siteId ? { ...s, published: true, slug: data.slug || s.slug } : s));
    }
    setPublishing(null);
  };

  const handleSaveDomain = async (siteId: string) => {
    setSavingDomain(siteId);
    const domain = domainInputs[siteId]?.trim() || '';
    const res = await fetch(`/api/sites/${siteId}/domain`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customDomain: domain || null }),
    });
    const data = await res.json();
    if (data.ok) {
      setSites(prev => prev.map(s => s.id === siteId ? { ...s, custom_domain: data.customDomain } : s));
    } else {
      alert(data.error || 'エラーが発生しました');
      setSites(prev => {
        const site = prev.find(s => s.id === siteId);
        if (site) setDomainInputs(d => ({ ...d, [siteId]: site.custom_domain || '' }));
        return prev;
      });
    }
    setSavingDomain(null);
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
    if (data.site) router.push(`/laruHP/builder?siteId=${data.site.id}`);
  };

  const status = STATUS_MAP[profile?.subscription_status || 'inactive'];

  return (
    <div className="min-h-screen bg-[#030712] text-white">

      {/* ── Header ── */}
      <header className="border-b border-white/[0.07] bg-[#0a0f1e]/90 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <Link href="/laruHP" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-white text-black rounded-md flex items-center justify-center font-black text-xs">L</div>
            <span className="font-bold text-base tracking-tight">LARU<span className="text-blue-400 font-light">HP</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-xs hidden sm:block truncate max-w-[220px]">{userEmail}</span>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-white text-xs border border-white/[0.07] hover:border-white/20 px-3 py-1.5 rounded-md transition-all"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Banners ── */}
        {paymentBanner === 'success' && (
          <div className="flex items-start gap-3 bg-green-500/[0.06] border border-green-500/20 rounded-xl px-4 py-3.5 mb-6">
            <div className="w-7 h-7 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0 text-green-400 mt-0.5">
              <IcCheck />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-green-400 text-sm">お支払いが完了しました</p>
              <p className="text-slate-400 text-xs mt-0.5">LARU HP へようこそ。サイトを作成してすぐに公開できます。</p>
            </div>
            <button onClick={() => setPaymentBanner(null)} className="text-slate-600 hover:text-white flex-shrink-0 text-lg leading-none">×</button>
          </div>
        )}
        {paymentBanner === 'canceled' && (
          <div className="flex items-start gap-3 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl px-4 py-3.5 mb-6">
            <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0 text-amber-400 mt-0.5">
              <IcInfo />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-400 text-sm">お支払いをキャンセルしました</p>
              <p className="text-slate-400 text-xs mt-0.5">いつでも「初月1円で始める」からサブスクを開始できます。</p>
            </div>
            <button onClick={() => setPaymentBanner(null)} className="text-slate-600 hover:text-white flex-shrink-0 text-lg leading-none">×</button>
          </div>
        )}
        {profile?.subscription_status === 'past_due' && (
          <div className="flex items-start gap-3 bg-red-500/[0.06] border border-red-500/20 rounded-xl px-4 py-3.5 mb-6">
            <div className="w-7 h-7 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0 text-red-400 mt-0.5">
              <IcAlert />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-red-400 text-sm">お支払いに問題が発生しています</p>
              <p className="text-slate-400 text-xs mt-0.5">決済に失敗しました。「支払い情報を更新する」から支払い方法を更新してください。</p>
            </div>
          </div>
        )}

        {/* ── Subscription Card ── */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <h2 className="text-sm font-semibold text-white">{profile?.business_name || userEmail}</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.color}`}>
                  {status.label}
                </span>
              </div>
              {profile?.subscription_status === 'active' && profile.contract_ends_at && (
                <p className="text-slate-500 text-xs">
                  最低契約期間: 〜{new Date(profile.contract_ends_at).toLocaleDateString('ja-JP')}
                </p>
              )}
              {portalError && <p className="text-red-400 text-xs mt-1.5">{portalError}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {(profile?.subscription_status === 'active' || profile?.subscription_status === 'past_due') ? (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className={`flex items-center gap-1.5 text-xs border px-3.5 py-2 rounded-lg transition-all disabled:opacity-50 ${
                    profile?.subscription_status === 'past_due'
                      ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                      : 'border-white/10 hover:border-white/25 text-slate-300'
                  }`}
                >
                  <IcCard />
                  {portalLoading ? '処理中...' : profile?.subscription_status === 'past_due' ? '支払い情報を更新する' : 'サブスクリプション管理'}
                </button>
              ) : (
                <button
                  onClick={handleCheckout}
                  className="bg-white text-black font-bold text-xs px-4 py-2 rounded-lg hover:bg-blue-50 transition-all"
                >
                  初月1円で始める
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Sites Header ── */}
        <div className="flex justify-between items-center mb-5">
          <div>
            <h1 className="text-xl font-bold">マイサイト</h1>
            {!loading && sites.length > 0 && (
              <p className="text-slate-500 text-xs mt-0.5">
                {sites.length}件 · 公開中 {sites.filter(s => s.published).length}件
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href="/laruHP/onboarding"
              className="flex items-center gap-1.5 text-xs border border-white/[0.07] hover:border-blue-500/40 hover:text-blue-400 px-3 py-2 rounded-lg transition-all"
            >
              <IcSparkle />
              <span className="hidden sm:inline">AIウィザード</span>
              <span className="sm:hidden">AI作成</span>
            </Link>
            <button
              onClick={handleNewSite}
              className="flex items-center gap-1.5 bg-white text-black font-bold text-xs px-4 py-2 rounded-lg hover:bg-blue-50 transition-all"
            >
              <IcPlus />
              <span className="hidden sm:inline">新しいサイト</span>
              <span className="sm:hidden">作成</span>
            </button>
          </div>
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden animate-pulse">
                <div className="h-32 bg-white/[0.04]" />
                <div className="p-4 space-y-3">
                  <div className="h-3.5 bg-white/[0.06] rounded w-2/3" />
                  <div className="h-3 bg-white/[0.04] rounded w-1/3" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-8 bg-white/[0.06] rounded-lg flex-1" />
                    <div className="h-8 bg-white/[0.06] rounded-lg w-14" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 border border-white/[0.07] border-dashed rounded-2xl text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2">まだサイトがありません</h3>
            <p className="text-slate-500 text-sm mb-8 max-w-xs">AIウィザードで業種情報を入力するだけで、5分でサイトが完成します</p>
            <Link
              href="/laruHP/onboarding"
              className="inline-flex items-center gap-2 bg-white text-black font-bold text-sm px-6 py-3 rounded-xl hover:bg-blue-50 transition-all"
            >
              <IcSparkle />
              AIでサイトを作る
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map(site => {
              const gradient = INDUSTRY_GRADIENT[site.industry || ''] || 'from-slate-800/80 to-slate-900';
              const initial = site.name.charAt(0).toUpperCase();
              return (
                <div key={site.id} className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden hover:border-white/[0.14] transition-all flex flex-col">

                  {/* Thumbnail */}
                  <div className={`bg-gradient-to-br ${gradient} h-32 flex items-center justify-center relative overflow-hidden`}>
                    <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/[0.04]" />
                    <div className="absolute -left-4 -bottom-6 w-20 h-20 rounded-full bg-white/[0.04]" />
                    <span className="text-[84px] font-black text-white/[0.07] select-none leading-none relative z-10 -mb-2">
                      {initial}
                    </span>
                    {site.industry && INDUSTRY_LABEL[site.industry] && (
                      <span className="absolute bottom-2.5 left-3 text-[9px] font-semibold text-white/40 tracking-widest uppercase">
                        {INDUSTRY_LABEL[site.industry]}
                      </span>
                    )}
                    <div className={`absolute top-3 right-3 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      site.published ? 'bg-green-500/20 text-green-400' : 'bg-black/30 text-slate-400'
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${site.published ? 'bg-green-400' : 'bg-slate-500'}`} />
                      {site.published ? '公開中' : '非公開'}
                    </div>
                    {site.published && site.slug && (
                      <button
                        onClick={() => handleCopyUrl(site.slug!, site.id)}
                        className="absolute bottom-2.5 right-2.5 flex items-center gap-1 text-[9px] bg-black/50 hover:bg-black/70 border border-white/[0.07] px-2 py-1 rounded-md transition-all text-slate-300"
                      >
                        {copied === site.id ? <IcCheck /> : <IcCopy />}
                        {copied === site.id ? 'コピー済み' : 'URLコピー'}
                      </button>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1 gap-3">
                    <div>
                      <h3 className="font-semibold text-white text-sm truncate">{site.name}</h3>
                      <div className="flex items-center gap-2.5 mt-1">
                        {site.slug ? (
                          <span className="text-slate-500 text-[10px] font-mono truncate">/hp/{site.slug}</span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">未公開</span>
                        )}
                        {site.published && site.view_count > 0 && (
                          <span className="flex items-center gap-1 text-slate-500 text-[10px] flex-shrink-0">
                            <IcEye />
                            {site.view_count.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 text-[10px] mt-0.5">更新 {relativeTime(site.updated_at)}</p>
                    </div>

                    {/* Custom domain */}
                    <div className="flex gap-1.5">
                      <div className="flex-1 relative min-w-0">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none">
                          <IcGlobe />
                        </span>
                        <input
                          type="text"
                          placeholder="example.com"
                          value={domainInputs[site.id] ?? ''}
                          onChange={e => setDomainInputs(d => ({ ...d, [site.id]: e.target.value }))}
                          className="w-full bg-white/[0.04] border border-white/[0.07] rounded-md pl-6 pr-2 py-1.5 text-[10px] text-white placeholder-slate-600 focus:outline-none focus:border-white/20 font-mono"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveDomain(site.id)}
                        disabled={savingDomain === site.id}
                        className="text-[10px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] hover:border-white/15 px-3 py-1.5 rounded-md transition-all disabled:opacity-50 flex-shrink-0 text-slate-300"
                      >
                        {savingDomain === site.id ? '...' : '保存'}
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 mt-auto">
                      <Link
                        href={`/laruHP/builder?siteId=${site.id}`}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-white text-black py-2.5 rounded-lg hover:bg-blue-50 transition-all"
                      >
                        <IcEdit />
                        編集する
                      </Link>
                      <div className="flex gap-1.5">
                        {site.published ? (
                          <>
                            <a
                              href={`/hp/${site.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-1 text-[11px] border border-white/[0.07] hover:border-white/20 py-2 rounded-lg transition-all text-slate-300"
                            >
                              <IcEye />
                              表示
                            </a>
                            <button
                              onClick={() => handleUnpublish(site.id)}
                              disabled={publishing === site.id}
                              className="flex-1 flex items-center justify-center text-[11px] border border-white/[0.07] hover:border-red-500/25 hover:text-red-400 py-2 rounded-lg transition-all disabled:opacity-50 text-slate-400"
                            >
                              {publishing === site.id ? '...' : '非公開'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handlePublish(site.id)}
                            disabled={publishing === site.id}
                            className="flex-1 flex items-center justify-center gap-1 text-[11px] bg-green-500/[0.12] text-green-400 hover:bg-green-500/20 border border-green-500/20 py-2 rounded-lg transition-all disabled:opacity-50"
                          >
                            {publishing === site.id ? '処理中...' : '公開する'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDuplicate(site.id)}
                          disabled={duplicating === site.id}
                          title="複製"
                          className="flex items-center justify-center text-[11px] text-slate-500 hover:text-slate-300 border border-white/[0.07] hover:border-white/20 py-2 px-3 rounded-lg transition-all disabled:opacity-50"
                        >
                          {duplicating === site.id ? '...' : <IcDuplicate />}
                        </button>
                        <button
                          onClick={() => handleDelete(site.id)}
                          disabled={deleting === site.id}
                          title="削除"
                          className="flex items-center justify-center text-[11px] text-slate-600 hover:text-red-400 border border-transparent hover:border-red-500/20 py-2 px-3 rounded-lg transition-all disabled:opacity-50"
                        >
                          {deleting === site.id ? '...' : <IcTrash />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New site card */}
            <button
              onClick={handleNewSite}
              className="border border-white/[0.07] border-dashed rounded-xl min-h-[260px] flex flex-col items-center justify-center hover:border-white/15 hover:bg-white/[0.02] transition-all group gap-2.5"
            >
              <div className="w-9 h-9 rounded-lg border border-white/[0.07] group-hover:border-white/15 flex items-center justify-center transition-all text-slate-500 group-hover:text-slate-300">
                <IcPlus />
              </div>
              <span className="text-slate-500 group-hover:text-slate-400 text-xs font-medium transition-colors">新しいサイトを作成</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
