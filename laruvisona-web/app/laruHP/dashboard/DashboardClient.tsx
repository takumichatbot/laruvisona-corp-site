'use client';
import { useState, useEffect, useCallback, useId } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

interface SiteSettings {
  larubot?: boolean;
  laruseo?: boolean;
  larubotPublicId?: string;
  laruseoPublicId?: string;
  abStats?: { a?: number; b?: number };
}

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
  settings_json: SiteSettings | null;
}

interface Profile {
  business_name: string | null;
  subscription_status: string;
  plan: string | null;
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
function IcBell() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
}

// ── Mini area chart ─────────────────────────────────────────────────────────
type DayView = { date: string; views: number };

function MiniChart({ data }: { data: DayView[] }) {
  const uid = useId();
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  const allZero = data.every(d => d.views === 0);
  if (allZero) {
    return (
      <div className="h-14 flex items-center justify-center text-slate-600 text-[10px]">
        まだデータがありません
      </div>
    );
  }
  const total = data.reduce((s, d) => s + d.views, 0);
  const max = Math.max(...data.map(d => d.views), 1);
  const W = 300; const H = 56;
  const padX = 2; const padY = 5;

  const pts = data.map((d, i) => ({
    x: padX + (data.length > 1 ? i / (data.length - 1) : 0.5) * (W - 2 * padX),
    y: padY + (1 - d.views / max) * (H - 2 * padY),
    views: d.views,
    date: d.date,
  }));

  const smoothLine = pts.length < 2 ? '' : pts.map((p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const prev = pts[i - 1];
    const cx1 = prev.x + (p.x - prev.x) / 3;
    const cx2 = p.x - (p.x - prev.x) / 3;
    return `C${cx1},${prev.y} ${cx2},${p.y} ${p.x},${p.y}`;
  }).join(' ');
  const areaPath = smoothLine
    ? `${smoothLine} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z`
    : '';
  const last = pts[pts.length - 1];
  const gradId = `cg${uid.replace(/:/g, '')}`;

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-white text-sm font-bold">{total.toLocaleString()}<span className="text-slate-500 text-[10px] font-normal ml-1">PV</span></span>
        <span className="text-slate-600 text-[9px]">期間合計</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="56" className="block overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={padX} x2={W - padX}
            y1={padY + f * (H - 2 * padY)} y2={padY + f * (H - 2 * padY)}
            stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
        ))}
        {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
        {smoothLine && <path d={smoothLine} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />}
        {last && (
          <>
            <circle cx={last.x} cy={last.y} r="5" fill="#3b82f6" fillOpacity="0.2" />
            <circle cx={last.x} cy={last.y} r="2.5" fill="#60a5fa" />
          </>
        )}
      </svg>
      {data.length <= 7 ? (
        <div className="flex mt-0.5">
          {data.map((d, i) => (
            <div key={i} className="flex-1 text-center">
              <span className="text-[8px] text-slate-600 leading-none">
                {DOW[new Date(d.date + 'T12:00:00').getDay()]}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex justify-between mt-0.5">
          <span className="text-[8px] text-slate-600">{data[0]?.date.slice(5)}</span>
          <span className="text-[8px] text-slate-600">{data[data.length - 1]?.date.slice(5)}</span>
        </div>
      )}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');
  const [paymentBanner, setPaymentBanner] = useState<'success' | 'canceled' | null>(null);
  const [domainInputs, setDomainInputs] = useState<Record<string, string>>({});
  const [savingDomain, setSavingDomain] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [pendingSiteId, setPendingSiteId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Partial<Record<'7'|'30'|'all', Record<string, DayView[]>>>>({ '7': {} });
  const [contacts, setContacts] = useState<{ id: string; site_id: string; read: boolean }[]>([]);
  const [analyticsPeriods, setAnalyticsPeriods] = useState<Record<string, '7' | '30' | 'all'>>({});
  const [deleteToast, setDeleteToast] = useState<{ site: Site; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [domainErrors, setDomainErrors] = useState<Record<string, string>>({});
  const [newSiteError, setNewSiteError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [slugInput, setSlugInput] = useState('');
  const [slugError, setSlugError] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);
  const [dnsStatus, setDnsStatus] = useState<Record<string, { verified: boolean; cname: string | null; expectedTarget: string; checking: boolean }>>({});
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

      const [sitesRes, profileRes, analyticsRes, contactsRes] = await Promise.all([
        fetch('/api/sites'),
        supabase.from('profiles').select('business_name, subscription_status, plan, contract_ends_at, stripe_customer_id').eq('id', user.id).single(),
        fetch('/api/sites/analytics?days=7'),
        fetch('/api/contacts'),
      ]);

      const sitesData = await sitesRes.json();
      const loadedSites: Site[] = sitesData.sites || [];
      setSites(loadedSites);
      const initDomains: Record<string, string> = {};
      for (const s of loadedSites) initDomains[s.id] = s.custom_domain || '';
      setDomainInputs(initDomains);
      setProfile(profileRes.data);
      const analyticsData = await analyticsRes.json();
      setAnalytics(prev => ({ ...prev, '7': analyticsData.data || {} }));
      const contactsData = await contactsRes.json();
      setContacts((contactsData.contacts || []).map((c: { id: string; site_id: string; read: boolean }) => ({ id: c.id, site_id: c.site_id, read: c.read })));
      setLoading(false);
    })();
  }, []);

  const fetchAnalytics = useCallback(async (period: '7' | '30' | 'all') => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/sites/analytics?days=${period}`);
      const data = await res.json();
      setAnalytics(prev => ({ ...prev, [period]: data.data || {} }));
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const handlePublish = async (siteId: string) => {
    setPublishing(siteId);
    const res = await fetch(`/api/sites/${siteId}/publish`, { method: 'POST' });
    const data = await res.json();
    if (data.error === 'subscription_required') {
      setPublishing(null);
      setPendingSiteId(siteId);
      setShowPlanModal(true);
      return;
    }
    if (data.success) {
      setSites(prev => prev.map(s => s.id === siteId ? { ...s, published: true, slug: data.slug || s.slug } : s));
    }
    setPublishing(null);
  };

  const handleSaveDomain = async (siteId: string) => {
    setSavingDomain(siteId);
    setDomainErrors(e => ({ ...e, [siteId]: '' }));
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
      setDomainErrors(e => ({ ...e, [siteId]: data.error || 'ドメインの保存に失敗しました' }));
      setSites(prev => {
        const site = prev.find(s => s.id === siteId);
        if (site) setDomainInputs(d => ({ ...d, [siteId]: site.custom_domain || '' }));
        return prev;
      });
    }
    setSavingDomain(null);
  };

  const handleCheckDns = async (siteId: string) => {
    setDnsStatus(prev => ({ ...prev, [siteId]: { ...prev[siteId], checking: true, verified: false, cname: null, expectedTarget: '' } }));
    const res = await fetch(`/api/sites/${siteId}/domain`);
    const data = await res.json();
    setDnsStatus(prev => ({ ...prev, [siteId]: { verified: !!data.verified, cname: data.cname || null, expectedTarget: data.expectedTarget || '', checking: false } }));
  };

  const handleUnpublish = async (siteId: string) => {
    setPublishing(siteId);
    await fetch(`/api/sites/${siteId}/publish`, { method: 'DELETE' });
    setSites(prev => prev.map(s => s.id === siteId ? { ...s, published: false } : s));
    setPublishing(null);
  };

  const handleDelete = (siteId: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    // Remove from UI immediately
    setSites(prev => prev.filter(s => s.id !== siteId));
    // Schedule actual delete after 5s, allow undo
    if (deleteToast) {
      clearTimeout(deleteToast.timer);
      fetch(`/api/sites/${deleteToast.site.id}`, { method: 'DELETE' });
    }
    const timer = setTimeout(async () => {
      await fetch(`/api/sites/${siteId}`, { method: 'DELETE' });
      setDeleteToast(null);
    }, 5000);
    setDeleteToast({ site, timer });
  };

  const handleUndoDelete = () => {
    if (!deleteToast) return;
    clearTimeout(deleteToast.timer);
    setSites(prev => [...prev, deleteToast.site].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setDeleteToast(null);
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

  const startEditSlug = (site: Site) => {
    setEditingSlug(site.id);
    setSlugInput(site.slug || '');
    setSlugError('');
  };

  const handleSaveSlug = async (siteId: string) => {
    if (!/^[a-z0-9-]{3,60}$/.test(slugInput)) {
      setSlugError('3〜60文字の半角英数字・ハイフンのみ');
      return;
    }
    setSavingSlug(true);
    setSlugError('');
    const res = await fetch(`/api/sites/${siteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: slugInput }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSlugError(data.error || 'エラー');
      setSavingSlug(false);
      return;
    }
    setSites(prev => prev.map(s => s.id === siteId ? { ...s, slug: data.site.slug } : s));
    setEditingSlug(null);
    setSavingSlug(false);
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

  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState('');
  const handleUpgrade = async (plan: string) => {
    setUpgradeLoading(plan);
    setUpgradeError('');
    const res = await fetch('/api/stripe/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (data.ok) {
      setProfile(p => p ? { ...p, plan: data.plan } : p);
    } else {
      // Fallback to checkout flow for new subscribers
      const checkoutRes = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const checkoutData = await checkoutRes.json();
      if (checkoutData.url) window.location.href = checkoutData.url;
      else setUpgradeError('エラーが発生しました');
    }
    setUpgradeLoading(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/laruHP');
  };

  const handleNewSite = async () => {
    setNewSiteError('');
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '新しいサイト', seo_json: { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '' } }),
      });
      const data = await res.json();
      if (data.site) router.push(`/laruHP/builder?siteId=${data.site.id}`);
      else setNewSiteError(data.error || 'サイトの作成に失敗しました');
    } catch {
      setNewSiteError('サイトの作成に失敗しました。もう一度お試しください。');
    }
  };

  const isAdmin = !!process.env.NEXT_PUBLIC_ADMIN_EMAIL && userEmail === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const effectiveStatus: string = isAdmin ? 'active' : (profile?.subscription_status || 'inactive');
  const effectivePlan = isAdmin ? 'hp-bot-seo' : (profile?.plan || null);
  const status = STATUS_MAP[effectiveStatus];

  return (
    <div className="min-h-screen bg-[#030712] text-white">

      {/* ── Delete undo toast ── */}
      {deleteToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#1e293b] border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
          <span className="text-sm text-slate-300">「{deleteToast.site.name}」を削除しました</span>
          <button
            onClick={handleUndoDelete}
            className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
          >
            取り消す
          </button>
        </div>
      )}

      {/* ── Header ── */}
      {/* ── Notification Center ── */}
      {(() => {
        const unread = contacts.filter(c => !c.read).length;
        const isPastDue = profile?.subscription_status === 'past_due';
        const isCanceled = profile?.subscription_status === 'canceled';
        const contractEnd = profile?.contract_ends_at ? new Date(profile.contract_ends_at) : null;
        const daysLeft = contractEnd ? Math.ceil((contractEnd.getTime() - Date.now()) / 86400000) : null;
        const nearExpiry = daysLeft !== null && daysLeft > 0 && daysLeft <= 14;
        const notifs: { id: string; type: 'info' | 'warn' | 'error'; title: string; body: string; href?: string }[] = [];
        if (unread > 0) notifs.push({ id: 'unread', type: 'info', title: `未読の問い合わせが${unread}件あります`, body: '早めに確認・返信しましょう', href: '/laruHP/contacts' });
        if (isPastDue) notifs.push({ id: 'pastdue', type: 'error', title: '支払いが遅延しています', body: '決済情報を更新してサービスを継続してください', href: '/laruHP/settings' });
        if (isCanceled) notifs.push({ id: 'canceled', type: 'warn', title: 'サブスクリプションが解約済みです', body: '再契約すると公開サイトを復旧できます', href: '/laruHP/settings' });
        if (nearExpiry) notifs.push({ id: 'expiry', type: 'warn', title: `契約終了まであと${daysLeft}日です`, body: '自動更新されない場合はご確認ください', href: '/laruHP/settings' });
        if (notifs.length === 0) notifs.push({ id: 'ok', type: 'info', title: '特に通知はありません', body: 'サイトとプランは正常です' });
        const badgeCount = notifs.filter(n => n.id !== 'ok').length;

        return (
          <>
            {showNotifications && (
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}>
                <div className="absolute top-14 right-4 sm:right-6 w-80 bg-[#0f1729] border border-white/10 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <span className="font-bold text-sm">通知</span>
                    {badgeCount > 0 && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">{badgeCount}件</span>}
                  </div>
                  <div className="divide-y divide-white/[0.05] max-h-80 overflow-y-auto">
                    {notifs.map(n => (
                      <div key={n.id} className="px-4 py-3 hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-start gap-2.5">
                          <span className={`flex-shrink-0 mt-0.5 text-base ${n.type === 'error' ? 'text-red-400' : n.type === 'warn' ? 'text-yellow-400' : n.id === 'ok' ? 'text-slate-500' : 'text-blue-400'}`}>
                            {n.type === 'error' ? '!' : n.type === 'warn' ? '⚠' : n.id === 'ok' ? '✓' : '●'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs font-semibold ${n.id === 'ok' ? 'text-slate-500' : 'text-white'}`}>{n.title}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{n.body}</div>
                            {n.href && <Link href={n.href} onClick={() => setShowNotifications(false)} className="text-[10px] text-blue-400 hover:text-blue-300 mt-1 inline-block transition-colors">確認する →</Link>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <header className="border-b border-white/[0.07] bg-[#0a0f1e]/90 backdrop-blur-xl sticky top-0 z-30">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
                <Link href="/laruHP" className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-white text-black rounded-md flex items-center justify-center font-black text-xs">L</div>
                  <span className="font-bold text-base tracking-tight">LARU<span className="text-blue-400 font-light">HP</span></span>
                </Link>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 text-xs hidden sm:block truncate max-w-[220px]">{userEmail}</span>
                  <button
                    onClick={() => setShowNotifications(v => !v)}
                    className="relative text-slate-400 hover:text-white transition-colors p-1.5"
                    aria-label="通知"
                  >
                    <IcBell />
                    {badgeCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                        {badgeCount}
                      </span>
                    )}
                  </button>
                  <Link href="/laruHP/settings" className="text-slate-400 hover:text-white text-xs border border-white/[0.07] hover:border-white/20 px-3 py-1.5 rounded-md transition-all">
                    設定
                  </Link>
                  <button onClick={handleLogout} className="text-slate-400 hover:text-white text-xs border border-white/[0.07] hover:border-white/20 px-3 py-1.5 rounded-md transition-all">
                    ログアウト
                  </button>
                </div>
              </div>
            </header>
          </>
        );
      })()}

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
        {effectiveStatus === 'past_due' && (
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
              {effectiveStatus === 'active' && profile?.contract_ends_at && (
                <p className="text-slate-500 text-xs">
                  最低契約期間: 〜{new Date(profile.contract_ends_at).toLocaleDateString('ja-JP')}
                </p>
              )}
              {portalError && <p className="text-red-400 text-xs mt-1.5">{portalError}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {(effectiveStatus === 'active' || effectiveStatus === 'past_due') ? (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className={`flex items-center gap-1.5 text-xs border px-3.5 py-2 rounded-lg transition-all disabled:opacity-50 ${
                    effectiveStatus === 'past_due'
                      ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                      : 'border-white/10 hover:border-white/25 text-slate-300'
                  }`}
                >
                  <IcCard />
                  {portalLoading ? '処理中...' : effectiveStatus === 'past_due' ? '支払い情報を更新する' : 'サブスクリプション管理'}
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

        {/* ── Plan upgrade nudge ── */}
        {upgradeError && <p className="text-red-400 text-xs mb-3">{upgradeError}</p>}
        {effectiveStatus === 'active' && effectivePlan === 'hp' && (
          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            <div className="bg-indigo-500/[0.06] border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-[11px] font-bold text-indigo-300 flex-shrink-0">LB</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-white mb-0.5">LARUbot AI チャットボット</div>
                <p className="text-slate-500 text-xs leading-relaxed mb-2">24時間対応のAIチャットが問い合わせ数を平均2.3倍に増加。</p>
                <button onClick={() => handleUpgrade('hp-bot')} disabled={upgradeLoading === 'hp-bot'}
                  className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold transition-colors disabled:opacity-50">
                  {upgradeLoading === 'hp-bot' ? '処理中...' : 'HP + Bot プランへアップグレード →'}
                </button>
              </div>
            </div>
            <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-[11px] font-bold text-emerald-300 flex-shrink-0">SEO</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-white mb-0.5">LARU SEO AIブログ自動生成</div>
                <p className="text-slate-500 text-xs leading-relaxed mb-2">毎週AIがSEO記事を自動公開。検索流入を継続的に獲得。</p>
                <button onClick={() => handleUpgrade('hp-bot-seo')} disabled={upgradeLoading === 'hp-bot-seo'}
                  className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-colors disabled:opacity-50">
                  {upgradeLoading === 'hp-bot-seo' ? '処理中...' : 'HP + Bot + SEO プランへアップグレード →'}
                </button>
              </div>
            </div>
          </div>
        )}
        {effectiveStatus === 'active' && effectivePlan === 'hp-bot' && (
          <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-[11px] font-bold text-emerald-300 flex-shrink-0">SEO</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-white mb-0.5">LARU SEO — AIブログで検索流入を自動化</div>
              <p className="text-slate-500 text-xs leading-relaxed mb-2">毎週AIがSEO最適化記事を自動公開。放置するだけで検索順位が上がります。</p>
              <button onClick={() => handleUpgrade('hp-bot-seo')} disabled={upgradeLoading === 'hp-bot-seo'}
                className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-colors disabled:opacity-50">
                {upgradeLoading === 'hp-bot-seo' ? '処理中...' : 'HP + Bot + SEO プランへアップグレード →'}
              </button>
            </div>
          </div>
        )}

        {/* ── New site error ── */}
        {newSiteError && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 text-sm text-red-400">
            <IcAlert />
            {newSiteError}
            <button onClick={() => setNewSiteError('')} className="ml-auto text-red-400/60 hover:text-red-400 text-lg leading-none">×</button>
          </div>
        )}

        {/* ── Sites Header ── */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2.5">
            <div>
              <h1 className="text-xl font-bold">マイサイト</h1>
              {!loading && sites.length > 0 && (
                <p className="text-slate-500 text-xs mt-0.5">
                  {sites.length}件 · 公開中 {sites.filter(s => s.published).length}件
                </p>
              )}
            </div>
            <button
              onClick={handleNewSite}
              className="flex items-center gap-1.5 bg-white text-black font-bold text-xs px-4 py-2 rounded-lg hover:bg-blue-50 transition-all flex-shrink-0"
            >
              <IcPlus />
              <span className="hidden sm:inline">新しいサイト</span>
              <span className="sm:hidden">作成</span>
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            <Link
              href="/laruHP/contacts"
              className="relative flex items-center gap-1.5 text-xs border border-white/[0.07] hover:border-white/20 px-3 py-1.5 rounded-lg transition-all text-slate-300 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              問い合わせ
              {contacts.filter(c => !c.read).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {contacts.filter(c => !c.read).length}
                </span>
              )}
            </Link>
            <Link
              href="/laruHP/crm"
              className="flex items-center gap-1.5 text-xs border border-white/[0.07] hover:border-white/20 px-3 py-1.5 rounded-lg transition-all text-slate-300 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              CRM
            </Link>
            <Link
              href="/laruHP/booking"
              className="flex items-center gap-1.5 text-xs border border-white/[0.07] hover:border-white/20 px-3 py-1.5 rounded-lg transition-all text-slate-300 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              予約管理
            </Link>
            <Link
              href="/laruHP/newsletter"
              className="flex items-center gap-1.5 text-xs border border-white/[0.07] hover:border-white/20 px-3 py-1.5 rounded-lg transition-all text-slate-300 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              メール
            </Link>
            <Link
              href="/laruHP/blog"
              className="flex items-center gap-1.5 text-xs border border-white/[0.07] hover:border-white/20 px-3 py-1.5 rounded-lg transition-all text-slate-300 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              ブログ
            </Link>
            <Link
              href="/laruHP/agency"
              className="flex items-center gap-1.5 text-xs border border-white/[0.07] hover:border-purple-500/40 hover:text-purple-400 px-3 py-1.5 rounded-lg transition-all text-slate-300 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              エージェンシー
            </Link>
            <Link
              href="/laruHP/onboarding"
              className="flex items-center gap-1.5 text-xs border border-white/[0.07] hover:border-blue-500/40 hover:text-blue-400 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex-shrink-0"
            >
              <IcSparkle />
              AIウィザード
            </Link>
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
            <h3 className="text-lg font-bold mb-2">最初のサイトを作りましょう</h3>
            <p className="text-slate-400 text-sm mb-1.5 max-w-xs">業種を選んで情報を入力するだけ。AIが5分で本格サイトを自動生成します。</p>
            <p className="text-slate-600 text-xs mb-8">クレジットカード不要・今すぐ無料で試せます</p>
            <Link
              href="/laruHP/onboarding"
              className="inline-flex items-center gap-2 bg-white text-black font-bold text-sm px-6 py-3.5 rounded-xl hover:bg-blue-50 hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)]"
            >
              <IcSparkle />
              AIでサイトを作る（無料）
            </Link>
            <p className="text-slate-600 text-[11px] mt-4">✓ 初月1円 &nbsp;✓ いつでも解約 &nbsp;✓ 公開まで最短5分</p>
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
                        {editingSlug === site.id ? (
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <span className="text-slate-600 text-[10px] font-mono flex-shrink-0">/hp/</span>
                            <input
                              type="text"
                              value={slugInput}
                              onChange={e => { setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugError(''); }}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveSlug(site.id); if (e.key === 'Escape') setEditingSlug(null); }}
                              className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-[10px] font-mono text-white focus:outline-none focus:border-blue-500"
                              autoFocus
                              placeholder="my-site"
                            />
                            <button onClick={() => handleSaveSlug(site.id)} disabled={savingSlug} className="text-[9px] bg-blue-600 hover:bg-blue-500 px-1.5 py-0.5 rounded text-white font-bold disabled:opacity-50 flex-shrink-0">{savingSlug ? '…' : '保存'}</button>
                            <button onClick={() => setEditingSlug(null)} className="text-[9px] text-slate-500 hover:text-slate-300 flex-shrink-0">✕</button>
                            {slugError && <span className="text-[9px] text-red-400 flex-shrink-0">{slugError}</span>}
                          </div>
                        ) : site.slug ? (
                          <button onClick={() => startEditSlug(site)} className="flex items-center gap-1 group/slug">
                            <span className="text-slate-500 text-[10px] font-mono truncate">/hp/{site.slug}</span>
                            <span className="text-slate-600 text-[9px] opacity-0 group-hover/slug:opacity-100 transition-opacity">✎</span>
                          </button>
                        ) : (
                          <button onClick={() => startEditSlug(site)} className="text-slate-600 text-[10px] hover:text-slate-400 transition-colors">URLを設定 →</button>
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

                    {/* アクセス解析グラフ */}
                    {(() => {
                      const sp = (analyticsPeriods[site.id] ?? '7') as '7' | '30' | 'all';
                      const siteData = analytics[sp]?.[site.id];
                      if (!site.published || !siteData) return null;
                      return (
                        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 pt-2 pb-1.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1">
                              {(['7', '30', 'all'] as const).map(p => (
                                <button
                                  key={p}
                                  onClick={() => {
                                    setAnalyticsPeriods(prev => ({ ...prev, [site.id]: p }));
                                    if (!analytics[p]) fetchAnalytics(p);
                                  }}
                                  className={`text-[9px] px-1.5 py-0.5 rounded transition-all ${sp === p ? 'bg-blue-500/20 text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}
                                >
                                  {p === '7' ? '7日' : p === '30' ? '30日' : '全期間'}
                                </button>
                              ))}
                              {analyticsLoading && (
                                <svg className="animate-spin text-slate-600 ml-0.5" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-600">
                              {siteData.reduce((s: number, d: DayView) => s + d.views, 0).toLocaleString()} PV
                            </span>
                          </div>
                          <MiniChart data={siteData} />
                        </div>
                      );
                    })()}

                    {/* 問い合わせ件数 */}
                    {(() => {
                      const siteContacts = contacts.filter(c => c.site_id === site.id);
                      const total = siteContacts.length;
                      const unread = siteContacts.filter(c => !c.read).length;
                      if (total === 0) return null;
                      return (
                        <Link href={`/laruHP/contacts?siteId=${site.id}`}
                          className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 hover:border-white/[0.12] transition-all">
                          <div className="flex items-center gap-2">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500 flex-shrink-0"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            <span className="text-[10px] text-slate-400">問い合わせ</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-300 font-semibold">{total}件</span>
                            {unread > 0 && (
                              <span className="bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unread}未読</span>
                            )}
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-600"><polyline points="9 18 15 12 9 6"/></svg>
                          </div>
                        </Link>
                      );
                    })()}

                    {/* A/B test results */}
                    {(() => {
                      const abStats = site.settings_json?.abStats as { a?: number; b?: number } | undefined;
                      if (!abStats || (!abStats.a && !abStats.b)) return null;
                      const total = (abStats.a || 0) + (abStats.b || 0);
                      const pctA = total > 0 ? Math.round((abStats.a || 0) / total * 100) : 50;
                      const pctB = 100 - pctA;
                      return (
                        <div className="bg-white/[0.03] border border-white/[0.07] rounded-lg p-2.5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-semibold text-slate-400">A/Bテスト結果</span>
                            <span className="text-[9px] text-slate-600">{total}人のサンプル</span>
                          </div>
                          <div className="flex gap-1.5 mb-1.5">
                            <div className="flex-1 bg-blue-500/20 rounded h-5 relative overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-blue-500/50 rounded" style={{ width: `${pctA}%` }} />
                              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-blue-300">A: {pctA}%</span>
                            </div>
                            <div className="flex-1 bg-purple-500/20 rounded h-5 relative overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-purple-500/50 rounded" style={{ width: `${pctB}%` }} />
                              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-purple-300">B: {pctB}%</span>
                            </div>
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-600">
                            <span>{abStats.a || 0}PV</span>
                            <span>{abStats.b || 0}PV</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* LARUbot未連携バナー */}
                    {site.settings_json?.larubot && !site.settings_json?.larubotPublicId && (
                      <Link
                        href={`/laruHP/builder?siteId=${site.id}`}
                        className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-2 hover:bg-indigo-500/20 transition-all"
                      >
                        <div className="w-5 h-5 rounded bg-indigo-500/30 flex items-center justify-center text-indigo-300 text-[9px] font-bold flex-shrink-0">LB</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-indigo-300 text-[10px] font-semibold">LARUbot未連携</div>
                          <div className="text-indigo-400/70 text-[9px]">Public IDを設定してください</div>
                        </div>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-400 flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
                      </Link>
                    )}
                    {site.settings_json?.laruseo && !site.settings_json?.laruseoPublicId && (
                      <Link
                        href={`/laruHP/builder?siteId=${site.id}`}
                        className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 hover:bg-emerald-500/20 transition-all"
                      >
                        <div className="w-5 h-5 rounded bg-emerald-500/30 flex items-center justify-center text-emerald-300 text-[9px] font-bold flex-shrink-0">SEO</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-emerald-300 text-[10px] font-semibold">LARUSEO未連携</div>
                          <div className="text-emerald-400/70 text-[9px]">エディタで連携IDを設定してください</div>
                        </div>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400 flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
                      </Link>
                    )}

                    {/* Custom domain */}
                    {domainErrors[site.id] && (
                      <p className="text-red-400 text-[10px] -mb-1">{domainErrors[site.id]}</p>
                    )}
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

                    {/* DNS verification */}
                    {site.custom_domain && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCheckDns(site.id)}
                            disabled={dnsStatus[site.id]?.checking}
                            className="text-[10px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] px-2.5 py-1.5 rounded-md transition-all disabled:opacity-50 text-slate-400 flex-shrink-0"
                          >
                            {dnsStatus[site.id]?.checking ? '確認中...' : 'DNS確認'}
                          </button>
                          {dnsStatus[site.id] && !dnsStatus[site.id].checking && (
                            <span className={`text-[10px] font-semibold ${dnsStatus[site.id].verified ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {dnsStatus[site.id].verified ? '✓ 接続済み' : '⚠ 未設定'}
                            </span>
                          )}
                        </div>
                        {dnsStatus[site.id] && !dnsStatus[site.id].verified && !dnsStatus[site.id].checking && (
                          <div className="bg-white/[0.03] border border-white/[0.07] rounded-md p-2 space-y-1">
                            <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide">CNAMEレコードを設定してください</p>
                            <div className="font-mono text-[9px] text-slate-400 space-y-0.5">
                              <div><span className="text-slate-600">名前:</span> {site.custom_domain}</div>
                              <div><span className="text-slate-600">値:</span> {dnsStatus[site.id].expectedTarget || 'cname.vercel-dns.com'}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

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
                          aria-label="サイトを複製"
                          className="flex items-center justify-center text-[11px] text-slate-500 hover:text-slate-300 border border-white/[0.07] hover:border-white/20 py-2 px-3 rounded-lg transition-all disabled:opacity-50"
                        >
                          {duplicating === site.id ? '...' : <IcDuplicate />}
                        </button>
                        <button
                          onClick={() => handleDelete(site.id)}
                          title="削除"
                          aria-label="サイトを削除"
                          className="flex items-center justify-center text-[11px] text-slate-600 hover:text-red-400 border border-transparent hover:border-red-500/20 py-2 px-3 rounded-lg transition-all"
                        >
                          <IcTrash />
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

      {/* Plan picker modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h2 className="text-white font-bold text-lg mb-1">プランを選択して公開</h2>
            <p className="text-slate-400 text-sm mb-5">初月1円でお試しいただけます</p>
            <div className="space-y-3">
              {([
                { id: 'hp', label: 'LARU HP', price: '¥999', sub: '/月', badge: null, desc: 'ホームページ作成・公開' },
                { id: 'hp-bot', label: 'HP + LARUbot', price: '¥4,980', sub: '/月', badge: 'おすすめ', desc: 'HP作成 + AIチャットボット搭載' },
                { id: 'hp-bot-seo', label: 'HP + Bot + SEO', price: '¥9,800', sub: '/月', badge: '半年間限定', desc: 'HP + チャットボット + AIブログSEO' },
              ] as const).map(plan => (
                <button
                  key={plan.id}
                  onClick={async () => {
                    setShowPlanModal(false);
                    setCheckoutError('');
                    const res = await fetch('/api/stripe/checkout', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ siteId: pendingSiteId, plan: plan.id }),
                    });
                    const d = await res.json();
                    if (d.url) window.location.href = d.url;
                    else setCheckoutError('決済ページの取得に失敗しました。もう一度お試しください。');
                  }}
                  className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 rounded-xl px-4 py-3 transition-all text-left"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{plan.label}</span>
                      {plan.badge && <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">{plan.badge}</span>}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5">{plan.desc}</div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className="text-white font-bold text-base">{plan.price}<span className="text-slate-400 text-[11px] font-normal">{plan.sub}</span></div>
                    <div className="text-blue-400 text-[10px]">初月1円</div>
                  </div>
                </button>
              ))}
            </div>
            {checkoutError && (
              <p className="mt-3 text-red-400 text-xs text-center">{checkoutError}</p>
            )}
            <button
              onClick={() => { setShowPlanModal(false); setCheckoutError(''); }}
              className="mt-4 w-full text-slate-500 text-sm hover:text-slate-300 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
