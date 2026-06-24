'use client';
import { useState, useEffect, useCallback, useId, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchConsoleWidget from './SearchConsoleWidget';
import QRCodeModal from '@/components/QRCodeModal';
import CommandPalette from '@/components/CommandPalette';
import OnboardingTour from '@/components/OnboardingTour';
import { getSiteLimit } from '@/lib/plan-limits';

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
  restaurant: 'from-orange-100 to-red-100',
  beauty: 'from-pink-100 to-purple-100',
  clinic: 'from-blue-100 to-teal-100',
  legal: 'from-slate-100 to-slate-200',
  construction: 'from-amber-100 to-yellow-100',
  realestate: 'from-emerald-100 to-green-100',
  retail: 'from-violet-100 to-purple-100',
  fitness: 'from-red-100 to-orange-100',
  hotel: 'from-sky-100 to-blue-100',
  education: 'from-indigo-100 to-blue-100',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:   { label: '有効',       color: 'text-green-700 bg-green-50 border border-green-200' },
  inactive: { label: '未契約',     color: 'text-gray-500 bg-gray-100 border border-gray-200' },
  trialing: { label: 'トライアル', color: 'text-sky-700 bg-sky-50 border border-sky-200' },
  past_due: { label: '支払い遅延', color: 'text-red-700 bg-red-50 border border-red-200' },
  canceled: { label: '解約済み',   color: 'text-gray-400 bg-gray-50 border border-gray-200' },
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

function downloadCsv(siteName: string, data: DayView[]) {
  const rows = [['日付', 'PV数'], ...data.map(d => [d.date, String(d.views)])];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${siteName}_analytics.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function MiniChart({ data }: { data: DayView[] }) {
  const uid = useId();
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  const allZero = data.every(d => d.views === 0);
  if (allZero) {
    return (
      <div className="py-6 flex flex-col items-center justify-center gap-2 text-center">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" className="text-gray-300">
          <rect x="2" y="18" width="4" height="8" rx="1" fill="currentColor"/>
          <rect x="8" y="13" width="4" height="13" rx="1" fill="currentColor"/>
          <rect x="14" y="8" width="4" height="18" rx="1" fill="currentColor"/>
          <rect x="20" y="3" width="4" height="23" rx="1" fill="currentColor" opacity="0.35"/>
        </svg>
        <p className="text-[11px] text-gray-400 font-medium">まだ閲覧データがありません</p>
        <p className="text-[10px] text-gray-300">サイトを公開するとここにアクセス数が表示されます</p>
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
        <span className="text-gray-900 text-sm font-bold">{total.toLocaleString()}<span className="text-gray-500 text-[10px] font-normal ml-1">PV</span></span>
        <span className="text-gray-400 text-[9px]">期間合計</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="56" className="block overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={padX} x2={W - padX}
            y1={padY + f * (H - 2 * padY)} y2={padY + f * (H - 2 * padY)}
            stroke="#0ea5e9" strokeOpacity="0.1" strokeWidth="0.5" />
        ))}
        {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
        {smoothLine && <path d={smoothLine} fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" />}
        {last && (
          <>
            <circle cx={last.x} cy={last.y} r="5" fill="#0284c7" fillOpacity="0.2" />
            <circle cx={last.x} cy={last.y} r="2.5" fill="#0ea5e9" />
          </>
        )}
      </svg>
      {data.length <= 7 ? (
        <div className="flex mt-0.5">
          {data.map((d, i) => (
            <div key={i} className="flex-1 text-center">
              <span className="text-[8px] text-gray-400 leading-none">
                {DOW[new Date(d.date + 'T12:00:00').getDay()]}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex justify-between mt-0.5">
          <span className="text-[8px] text-gray-400">{data[0]?.date.slice(5)}</span>
          <span className="text-[8px] text-gray-400">{data[data.length - 1]?.date.slice(5)}</span>
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
  const [contacts, setContacts] = useState<{ id: string; site_id: string; read: boolean; crm_followup_at?: string | null; created_at?: string }[]>([]);
  const [analyticsPeriods, setAnalyticsPeriods] = useState<Record<string, '7' | '30' | 'all'>>({});
  const [deleteToast, setDeleteToast] = useState<{ site: Site; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(5);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [domainErrors, setDomainErrors] = useState<Record<string, string>>({});
  const [newSiteError, setNewSiteError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [showSiteLimitModal, setShowSiteLimitModal] = useState<{ limit: number; current: number } | null>(null);
  const [planModalAnnual, setPlanModalAnnual] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [slugInput, setSlugInput] = useState('');
  const [slugError, setSlugError] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);
  const [dnsStatus, setDnsStatus] = useState<Record<string, { verified: boolean; cname: string | null; expectedTarget: string; checking: boolean }>>({});
  const [tourResetKey, setTourResetKey] = useState(0);
  const [unpublishSiteId, setUnpublishSiteId] = useState<string | null>(null);
  const [weekSummary, setWeekSummary] = useState<{ pvThisWeek: number; pvLastWeek: number; contactsThisWeek: number; contactsLastWeek: number } | null>(null);
  const [weekSummaryDismissed, setWeekSummaryDismissed] = useState(false);
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
      setUserId(user.id);

      const results = await Promise.allSettled([
        fetch('/api/sites').then(r => r.json()),
        supabase.from('profiles').select('business_name, subscription_status, plan, contract_ends_at, stripe_customer_id').eq('id', user.id).single().then(r => r.data),
        fetch('/api/sites/analytics?days=7').then(r => r.json()),
        fetch('/api/contacts').then(r => r.json()),
      ]);

      const sitesData  = results[0].status === 'fulfilled' ? results[0].value : { sites: [] };
      const profileData = results[1].status === 'fulfilled' ? results[1].value : null;
      const analyticsData = results[2].status === 'fulfilled' ? results[2].value : { data: {} };
      const contactsData  = results[3].status === 'fulfilled' ? results[3].value : { contacts: [] };

      const failedCount = results.filter(r => r.status === 'rejected').length;
      if (failedCount > 0) setFetchError(`一部のデータ（${failedCount}件）の読み込みに失敗しました`);

      const loadedSites: Site[] = sitesData.sites || [];
      setSites(loadedSites);
      // Re-show onboarding tour after 7 days if user has unpublished sites
      if (loadedSites.some(s => !s.published)) {
        const tourVal = typeof window !== 'undefined' ? localStorage.getItem('laruhp_tour_done') : null;
        if (tourVal) {
          const storedTime = new Date(tourVal).getTime();
          if (!isNaN(storedTime) && Date.now() - storedTime > 7 * 86400000) {
            localStorage.removeItem('laruhp_tour_done');
            setTourResetKey(k => k + 1);
          }
        }
      }
      const initDomains: Record<string, string> = {};
      for (const s of loadedSites) initDomains[s.id] = s.custom_domain || '';
      setDomainInputs(initDomains);
      setProfile(profileData);
      setAnalytics(prev => ({ ...prev, '7': analyticsData.data || {} }));
      const loadedContacts = (contactsData.contacts || []).map((c: { id: string; site_id: string; read: boolean; crm_followup_at?: string | null; created_at?: string }) => ({ id: c.id, site_id: c.site_id, read: c.read, crm_followup_at: c.crm_followup_at, created_at: c.created_at }));
      setContacts(loadedContacts);

      // Weekly summary
      const now = Date.now();
      const lastSeenKey = 'laruHP_dashboard_week_summary_seen';
      const lastSeen = localStorage.getItem(lastSeenKey);
      if (!lastSeen || now - new Date(lastSeen).getTime() > 7 * 86400000) {
        const weekAgo = now - 7 * 86400000;
        const twoWeeksAgo = now - 14 * 86400000;
        const contactsThisWeek = loadedContacts.filter((c: { created_at?: string }) => c.created_at && new Date(c.created_at).getTime() > weekAgo).length;
        const contactsLastWeek = loadedContacts.filter((c: { created_at?: string }) => c.created_at && new Date(c.created_at).getTime() > twoWeeksAgo && new Date(c.created_at).getTime() <= weekAgo).length;
        const allDays: DayView[] = (Object.values(analyticsData.data || {}) as DayView[][]).flat();
        const pvThisWeek = allDays.filter(d => new Date(d.date).getTime() > weekAgo).reduce((s, d) => s + d.views, 0);
        const pvLastWeek = allDays.filter(d => { const t = new Date(d.date).getTime(); return t > twoWeeksAgo && t <= weekAgo; }).reduce((s, d) => s + d.views, 0);
        setWeekSummary({ pvThisWeek, pvLastWeek, contactsThisWeek, contactsLastWeek });
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-contacts-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contacts' }, (payload) => {
        const c = payload.new as { id: string; site_id: string; read: boolean };
        setContacts(prev => [{ id: c.id, site_id: c.site_id, read: false }, ...prev]);
        if (soundEnabledRef.current) {
          try {
            const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 880; osc.type = 'sine';
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start(); osc.stop(ctx.currentTime + 0.4);
          } catch { /* Audio not supported */ }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!deleteToast) { setDeleteCountdown(5); return; }
    setDeleteCountdown(5);
    const interval = setInterval(() => {
      setDeleteCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [deleteToast]);

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-sites-pv-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sites' }, (payload) => {
        const updated = payload.new as { id: string; view_count: number };
        if (updated?.id && typeof updated.view_count === 'number') {
          setSites(prev => prev.map(s => s.id === updated.id ? { ...s, view_count: updated.view_count } : s));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setSites(prev => {
        const updated = prev.map(s => s.id === siteId ? { ...s, published: true, slug: data.slug || s.slug } : s);
        const site = updated.find(s => s.id === siteId);
        const publishedSlug = data.slug || site?.slug;
        if (site?.settings_json?.larubot && !site.settings_json?.larubotPublicId) {
          setPublishToast({ message: 'LARUbot の Public ID が未設定です。ビルダーで設定してください。', type: 'warn' });
        } else if (site?.settings_json?.larubot && site.settings_json?.larubotPublicId) {
          setPublishToast({ message: 'サイトを公開しました。LARUbot も有効です！', type: 'success', slug: publishedSlug });
        } else {
          setPublishToast({ message: 'サイトを公開しました', type: 'success', slug: publishedSlug });
        }
        setTimeout(() => setPublishToast(null), 5000);
        return updated;
      });
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
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slugInput) || slugInput.length < 3 || slugInput.length > 60 || /--/.test(slugInput)) {
      setSlugError('3〜60文字・英数字とハイフン（先頭末尾・連続ハイフン不可）');
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
  const [deleteConfirmSiteId, setDeleteConfirmSiteId] = useState<string | null>(null);
  const [startGuideDismissed, setStartGuideDismissed] = useState(false);
  const [userId, setUserId] = useState('');
  const [refCopied, setRefCopied] = useState(false);
  const [memberPanels, setMemberPanels] = useState<Record<string, boolean>>({});
  const [memberInputs, setMemberInputs] = useState<Record<string, string>>({});
  const [memberLists, setMemberLists] = useState<Record<string, { id: string; invited_email: string; role: string; status: string }[]>>({});
  const [memberLoading, setMemberLoading] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<Record<string, string>>({});
  const [publishToast, setPublishToast] = useState<{ message: string; type: 'success' | 'warn'; slug?: string } | null>(null);
  const [abWinnerLoading, setAbWinnerLoading] = useState<string | null>(null);
  const [qrSite, setQrSite] = useState<{ url: string; name: string } | null>(null);
  // PageSpeed
  const [pagespeedData, setPagespeedData] = useState<Record<string, { performance: number; seo: number } | null>>({});
  const [pagespeedLoading, setPagespeedLoading] = useState<string | null>(null);
  // Snapshots
  const [snapshotPanels, setSnapshotPanels] = useState<Record<string, boolean>>({});
  const [snapshotLists, setSnapshotLists] = useState<Record<string, { id: string; label: string; created_at: string }[]>>({});
  const [snapshotRestoring, setSnapshotRestoring] = useState<string | null>(null);
  // AI Audit
  const [auditPanels, setAuditPanels] = useState<Record<string, boolean>>({});
  const [auditData, setAuditData] = useState<Record<string, { score: number; summary: string; items: Array<{ category: string; issue: string; suggestion: string; impact: string; score: number }> } | null>>({});
  const [auditLoading, setAuditLoading] = useState<string | null>(null);
  // Heatmap
  const [heatmapPanels, setHeatmapPanels] = useState<Record<string, boolean>>({});
  const [heatmapData, setHeatmapData] = useState<Record<string, { type: string; points?: { x: number; y: number }[]; total: number; histogram?: { depth: number; count: number; pct: number }[] } | null>>({});
  const [heatmapLoading, setHeatmapLoading] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('laruHP_notification_sound') === '1' : false
  );
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

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

  const handleAbWinner = async (siteId: string, winner: 'a' | 'b') => {
    setAbWinnerLoading(siteId);
    const res = await fetch(`/api/sites/${siteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings_patch: { abStats: null, abWinner: winner } }),
    });
    if (res.ok) {
      setSites(prev => prev.map(s => s.id === siteId
        ? { ...s, settings_json: { ...(s.settings_json || {}), abStats: undefined } }
        : s
      ));
      setPublishToast({ message: `バリアント ${winner.toUpperCase()} を勝者として確定しました。ビルダーで内容を確認してください。`, type: 'success' });
      setTimeout(() => setPublishToast(null), 6000);
    }
    setAbWinnerLoading(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/laruHP');
  };

  const handlePagespeed = async (siteId: string) => {
    if (pagespeedLoading) return;
    setPagespeedLoading(siteId);
    try {
      const res = await fetch(`/api/sites/${siteId}/pagespeed`);
      const d = await res.json();
      setPagespeedData(prev => ({ ...prev, [siteId]: d.mobile ?? null }));
    } catch {
      setPagespeedData(prev => ({ ...prev, [siteId]: null }));
    }
    setPagespeedLoading(null);
  };

  const handleSnapshotPanel = async (siteId: string) => {
    const open = !snapshotPanels[siteId];
    setSnapshotPanels(p => ({ ...p, [siteId]: open }));
    if (open && !snapshotLists[siteId]) {
      const res = await fetch(`/api/sites/${siteId}/versions`);
      const d = await res.json();
      setSnapshotLists(p => ({ ...p, [siteId]: d.versions || [] }));
    }
  };

  const handleSnapshotRestore = async (siteId: string, versionId: string, label: string) => {
    if (!confirm(`「${label}」の時点に復元しますか？現在のコンテンツは上書きされます。`)) return;
    setSnapshotRestoring(versionId);
    const res = await fetch(`/api/sites/${siteId}/versions/${versionId}`, { method: 'POST' });
    if (res.ok) {
      setPublishToast({ message: `「${label}」に復元しました。ビルダーで確認してください。`, type: 'success' });
      setTimeout(() => setPublishToast(null), 6000);
    }
    setSnapshotRestoring(null);
  };

  const handleAudit = async (siteId: string) => {
    const open = !auditPanels[siteId];
    setAuditPanels(p => ({ ...p, [siteId]: open }));
    if (open && !auditData[siteId] && auditLoading !== siteId) {
      // Check for cached audit in settings_json
      const site = sites.find(s => s.id === siteId);
      const cached = (site?.settings_json as Record<string, unknown> | null)?.last_audit;
      if (cached) { setAuditData(p => ({ ...p, [siteId]: cached as typeof auditData[string] })); return; }
      setAuditLoading(siteId);
      try {
        const res = await fetch('/api/ai/site-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId }),
        });
        const d = await res.json();
        setAuditData(p => ({ ...p, [siteId]: d.audit ?? null }));
      } catch { setAuditData(p => ({ ...p, [siteId]: null })); }
      setAuditLoading(null);
    }
  };

  const handleHeatmapPanel = async (siteId: string) => {
    const open = !heatmapPanels[siteId];
    setHeatmapPanels(p => ({ ...p, [siteId]: open }));
    if (open && !heatmapData[siteId]) {
      setHeatmapLoading(siteId);
      try {
        const res = await fetch(`/api/heatmap?siteId=${siteId}&type=click`);
        const d = await res.json();
        setHeatmapData(p => ({ ...p, [siteId]: d }));
      } catch { setHeatmapData(p => ({ ...p, [siteId]: null })); }
      setHeatmapLoading(null);
    }
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
      if (data.site) {
        router.push(`/laruHP/builder?siteId=${data.site.id}`);
      } else if (data.code === 'site_limit') {
        setShowSiteLimitModal({ limit: data.limit as number, current: data.current as number });
      } else {
        setNewSiteError(data.error || 'サイトの作成に失敗しました');
      }
    } catch {
      setNewSiteError('サイトの作成に失敗しました。もう一度お試しください。');
    }
  };

  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const isAdmin = adminEmails.length > 0 && adminEmails.includes(userEmail.toLowerCase());
  const effectiveStatus: string = isAdmin ? 'active' : (profile?.subscription_status || 'inactive');
  const rawPlan = profile?.plan || null;
  const effectivePlan = isAdmin ? 'hp-bot-seo' : (rawPlan === 'agency' ? 'hp-bot-seo' : rawPlan);
  const status = STATUS_MAP[effectiveStatus];
  const planSiteLimit = getSiteLimit(isAdmin ? 'agency' : rawPlan);

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">

      {/* ── Publish toast ── */}
      {publishToast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 border rounded-2xl px-4 py-3 shadow-2xl ${publishToast.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-white border-gray-200 text-gray-700'}`}>
          <div className="flex items-center gap-3">
            <span className="text-sm">{publishToast.type === 'warn' ? '⚠ ' : '✓ '}{publishToast.message}</span>
            <button onClick={() => setPublishToast(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
          {publishToast.slug && publishToast.type === 'success' && (() => {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
            const siteUrl = `${appUrl}/hp/${publishToast.slug}`;
            const siteName = sites.find(s => s.slug === publishToast.slug)?.name || 'マイサイト';
            const tweetText = encodeURIComponent(`「${siteName}」のホームページを公開しました！\n\n#LARUHP #ホームページ作成\n👉 ${siteUrl}`);
            return (
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100 w-full justify-center">
                <span className="text-xs text-gray-400">シェア：</span>
                <a href={`https://twitter.com/intent/tweet?text=${tweetText}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-black text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  X
                </a>
                <a href={`https://line.me/R/share?text=${encodeURIComponent(`「${siteName}」のHPを公開しました！ ${siteUrl}`)}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-[#06C755] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#05b34c] transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.630 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.630 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.070 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                  LINE
                </a>
                <button onClick={() => navigator.clipboard.writeText(siteUrl)}
                  className="flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  URL
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Fetch error banner ── */}
      {fetchError && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl px-4 py-3 shadow-lg text-sm max-w-sm w-full mx-4">
          <span className="flex-1">⚠ {fetchError}</span>
          <button onClick={() => window.location.reload()} className="text-xs font-bold text-amber-700 hover:text-amber-900 whitespace-nowrap">再読込</button>
          <button onClick={() => setFetchError('')} className="text-amber-400 hover:text-amber-700 text-lg leading-none">×</button>
        </div>
      )}

      {/* ── Delete undo toast ── */}
      {deleteToast && (
        <div className={`fixed ${publishToast ? 'bottom-24' : 'bottom-6'} left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-1.5 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-2xl min-w-[280px] transition-all`}>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 flex-1">「{deleteToast.site.name}」を削除しました</span>
            <span className="text-xs font-bold text-gray-400 tabular-nums w-4 text-right">{deleteCountdown}</span>
            <button
              onClick={handleUndoDelete}
              className="text-sm font-bold text-sky-600 hover:text-sky-500 transition-colors whitespace-nowrap"
            >
              取り消す
            </button>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-400 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${(deleteCountdown / 5) * 100}%` }}
            />
          </div>
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
        const overdueFollowups = contacts.filter(c => c.crm_followup_at && new Date(c.crm_followup_at) < new Date()).length;
        const notifs: { id: string; type: 'info' | 'warn' | 'error'; title: string; body: string; href?: string }[] = [];
        if (unread > 0) notifs.push({ id: 'unread', type: 'info', title: `未読の問い合わせが${unread}件あります`, body: '早めに確認・返信しましょう', href: '/laruHP/contacts' });
        if (overdueFollowups > 0) notifs.push({ id: 'followup', type: 'warn', title: `フォローアップ期限超過 ${overdueFollowups}件`, body: '期限を過ぎた問い合わせがあります', href: '/laruHP/contacts?overdue=1' });
        if (isPastDue) notifs.push({ id: 'pastdue', type: 'error', title: '支払いが遅延しています', body: '決済情報を更新してサービスを継続してください', href: '/laruHP/settings' });
        if (isCanceled) notifs.push({ id: 'canceled', type: 'warn', title: 'サブスクリプションが解約済みです', body: '再契約すると公開サイトを復旧できます', href: '/laruHP/settings' });
        if (nearExpiry) notifs.push({ id: 'expiry', type: 'warn', title: `契約終了まであと${daysLeft}日です`, body: '自動更新されない場合はご確認ください', href: '/laruHP/settings' });
        if (notifs.length === 0) notifs.push({ id: 'ok', type: 'info', title: '特に通知はありません', body: 'サイトとプランは正常です' });
        const badgeCount = notifs.filter(n => n.id !== 'ok').length;

        return (
          <>
            {showNotifications && (
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}>
                <div className="absolute top-14 right-4 sm:right-6 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <span className="font-bold text-sm text-gray-900">通知</span>
                    {badgeCount > 0 && <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-bold">{badgeCount}件</span>}
                  </div>
                  <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                    {notifs.map(n => (
                      <div key={n.id} className="px-4 py-3 hover:bg-sky-50 transition-colors">
                        <div className="flex items-start gap-2.5">
                          <span className={`flex-shrink-0 mt-0.5 text-base ${n.type === 'error' ? 'text-red-600' : n.type === 'warn' ? 'text-yellow-600' : n.id === 'ok' ? 'text-gray-400' : 'text-sky-600'}`}>
                            {n.type === 'error' ? '!' : n.type === 'warn' ? '⚠' : n.id === 'ok' ? '✓' : '●'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs font-semibold ${n.id === 'ok' ? 'text-gray-400' : 'text-gray-900'}`}>{n.title}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">{n.body}</div>
                            {n.href && <Link href={n.href} onClick={() => setShowNotifications(false)} className="text-[10px] text-sky-600 hover:text-sky-500 mt-1 inline-block transition-colors">確認する →</Link>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <header className="border-b border-sky-100 bg-white/90 backdrop-blur-xl shadow-sm sticky top-0 z-30">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
                <Link href="/laruHP" className="flex items-center gap-2.5">
                  <Image src="/laruhp_logo.png" alt="LARU HP" height={28} width={160} className="h-7 w-auto" />
                </Link>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs hidden sm:block truncate max-w-[220px]">{userEmail}</span>
                  <button
                    onClick={() => {
                      const next = !soundEnabled;
                      setSoundEnabled(next);
                      localStorage.setItem('laruHP_notification_sound', next ? '1' : '0');
                    }}
                    title={soundEnabled ? '通知音: ON（クリックでOFF）' : '通知音: OFF（クリックでON）'}
                    className={`text-sm p-2.5 rounded-lg border transition-all min-w-[40px] min-h-[40px] flex items-center justify-center ${soundEnabled ? 'border-sky-200 text-sky-600 bg-sky-50' : 'border-gray-200 text-gray-400 hover:text-gray-600'}`}
                  >
                    {soundEnabled ? '🔔' : '🔕'}
                  </button>
                  <button
                    onClick={() => setShowNotifications(v => !v)}
                    className="relative text-gray-500 hover:text-gray-900 transition-colors p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center"
                    aria-label="通知"
                  >
                    <IcBell />
                    {badgeCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {badgeCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => window.print()}
                    title="KPIサマリーをPDFに出力"
                    className="text-gray-500 hover:text-gray-700 text-xs border border-gray-200 hover:border-gray-300 px-2 py-1.5 rounded-md transition-all hidden sm:flex items-center gap-1"
                  >
                    <span>📄</span><span className="hidden md:inline">レポート</span>
                  </button>
                  <Link href="/laruHP/settings" className="text-gray-500 hover:text-gray-900 text-xs border border-gray-200 hover:border-gray-300 px-2 py-1.5 rounded-md transition-all flex items-center gap-1">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    <span className="hidden md:inline">設定</span>
                  </Link>
                  <button onClick={handleLogout} className="text-gray-500 hover:text-gray-900 text-xs border border-gray-200 hover:border-gray-300 px-2 py-1.5 rounded-md transition-all flex items-center gap-1">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    <span className="hidden md:inline">ログアウト</span>
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
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4 mb-6">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-700 mt-0.5">
                <IcCheck />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-emerald-700 text-sm">お支払いが完了しました！</p>
                <p className="text-gray-600 text-xs mt-0.5">
                  {effectivePlan === 'lite' && 'HP + Bot プランが有効になりました。LARUbotをビルダーで有効にして公開してください。'}
                  {effectivePlan === 'hp-bot-seo' && 'HP + Bot + SEO プランが有効になりました。AI ブログ・構造化データ・SEO分析が使えます。'}
                  {effectivePlan === 'agency' && 'エージェンシープランが有効になりました。無制限のサイト・全機能をご利用ください。'}
                  {!['lite','hp-bot-seo','agency'].includes(effectivePlan || '') && 'LARU HP へようこそ。サイトを作成してすぐに公開できます。'}
                </p>
              </div>
              <button onClick={() => setPaymentBanner(null)} className="text-gray-400 hover:text-gray-900 flex-shrink-0 text-lg leading-none">×</button>
            </div>
            {effectivePlan && effectivePlan !== 'hp' && (
              <div className="flex flex-wrap gap-2">
                {['lite','hp-bot-seo','agency'].includes(effectivePlan) && (
                  <Link href="/laruHP/builder" className="text-[11px] bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-500 transition-colors">
                    ビルダーを開く →
                  </Link>
                )}
                {['hp-bot-seo','agency'].includes(effectivePlan) && (
                  <Link href="/laruHP/blog" className="text-[11px] bg-white border border-emerald-300 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
                    AI ブログ生成
                  </Link>
                )}
                {['hp-bot-seo','agency'].includes(effectivePlan) && (
                  <Link href="/laruHP/seo" className="text-[11px] bg-white border border-emerald-300 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
                    SEO設定
                  </Link>
                )}
                {effectivePlan === 'agency' && (
                  <Link href="/laruHP/newsletter" className="text-[11px] bg-white border border-emerald-300 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
                    ニュースレター
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
        {paymentBanner === 'canceled' && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 mb-6">
            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600 mt-0.5">
              <IcInfo />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-600 text-sm">お支払いをキャンセルしました</p>
              <p className="text-gray-600 text-xs mt-0.5">いつでも「初月無料で始める」からサブスクを開始できます。</p>
            </div>
            <button onClick={() => setPaymentBanner(null)} className="text-gray-400 hover:text-gray-900 flex-shrink-0 text-lg leading-none">×</button>
          </div>
        )}
        {effectiveStatus === 'past_due' && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5 mb-6">
            <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600 mt-0.5">
              <IcAlert />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-red-600 text-sm">お支払いに問題が発生しています</p>
              <p className="text-gray-600 text-xs mt-0.5">決済に失敗しました。「支払い情報を更新する」から支払い方法を更新してください。</p>
            </div>
          </div>
        )}

        {/* ── Weekly summary banner ── */}
        {weekSummary && !weekSummaryDismissed && (weekSummary.pvThisWeek > 0 || weekSummary.contactsThisWeek > 0) && (
          <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-xl px-4 py-3.5 mb-6 flex items-start gap-4">
            <div className="text-2xl flex-shrink-0">📊</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sky-900 text-sm mb-1">先週のサマリー</p>
              <div className="flex gap-4 flex-wrap">
                <span className="text-xs text-sky-700">PV <span className="font-bold text-sky-900">{weekSummary.pvThisWeek.toLocaleString()}</span></span>
                <span className="text-xs text-sky-700">問い合わせ <span className="font-bold text-sky-900">{weekSummary.contactsThisWeek}</span>件</span>
                {weekSummary.contactsLastWeek > 0 && (() => {
                  const diff = weekSummary.contactsThisWeek - weekSummary.contactsLastWeek;
                  const pct = Math.round(Math.abs(diff) / weekSummary.contactsLastWeek * 100);
                  const up = diff >= 0;
                  return (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {up ? '▲' : '▼'} {pct}%
                    </span>
                  );
                })()}
              </div>
            </div>
            <button
              onClick={() => {
                setWeekSummaryDismissed(true);
                localStorage.setItem('laruHP_dashboard_week_summary_seen', new Date().toISOString());
              }}
              className="text-sky-400 hover:text-sky-700 text-lg flex-shrink-0"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Subscription Card ── */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <h2 className="text-sm font-semibold text-gray-900">{profile?.business_name || userEmail}</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.color}`}>
                  {status.label}
                </span>
              </div>
              {effectiveStatus === 'active' && profile?.contract_ends_at && (
                <p className="text-gray-500 text-xs">
                  最低契約期間: 〜{new Date(profile.contract_ends_at).toLocaleDateString('ja-JP')}
                </p>
              )}
              {portalError && <p className="text-red-600 text-xs mt-1.5">{portalError}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {(effectiveStatus === 'active' || effectiveStatus === 'past_due') ? (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className={`flex items-center gap-1.5 text-xs border px-3.5 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    effectiveStatus === 'past_due'
                      ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <IcCard />
                  {portalLoading ? '処理中...' : effectiveStatus === 'past_due' ? '支払い情報を更新する' : 'サブスクリプション管理'}
                </button>
              ) : (
                <button
                  onClick={handleCheckout}
                  className="bg-sky-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-sky-500 transition-all"
                >
                  初月無料で始める
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Search Console Widget ── */}
        <div data-tour="search-console">
          <SearchConsoleWidget />
        </div>

        {/* ── Insight Cards ── */}
        {loading && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {[
              { icon: '📊', label: '訪問数（7日間）' },
              { icon: '📬', label: '問い合わせ' },
            ].map((item, i) => (
              <div key={i} className="flex-shrink-0 w-64 bg-white border border-gray-200 rounded-2xl p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg opacity-30">{item.icon}</span>
                  <span className="text-xs font-semibold text-gray-300">{item.label}</span>
                </div>
                <div className="h-3.5 bg-gray-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-full mb-1" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}
        {!loading && (() => {
          const publishedSites = sites.filter(s => s.published);
          const unpublishedSites = sites.filter(s => !s.published);
          const totalContacts = contacts.length;
          const unreadContacts = contacts.filter(c => !c.read).length;
          const totalViews = Object.values(analytics['7'] || {}).reduce((sum: number, v) => {
            const arr = v as { views: number }[];
            return sum + (Array.isArray(arr) ? arr.reduce((s, d) => s + (d.views || 0), 0) : 0);
          }, 0);

          const tips: { icon: string; title: string; body: string; href?: string; cta?: string }[] = [];

          if (unpublishedSites.length > 0) {
            tips.push({
              icon: '🚀',
              title: 'サイトを公開しましょう',
              body: `「${unpublishedSites[0].name}」がまだ非公開です。公開するとGoogleに認識されSEO効果が始まります。`,
              href: `/laruHP/builder?siteId=${unpublishedSites[0].id}`,
              cta: 'ビルダーを開く',
            });
          }

          if (publishedSites.length > 0 && totalViews === 0) {
            tips.push({
              icon: '🔍',
              title: 'Google Search Consoleを連携しよう',
              body: '検索順位・クリック数をダッシュボードで確認できます。連携は設定画面から2分で完了。',
              href: '/laruHP/settings?section=gsc',
              cta: '設定する',
            });
          }

          if (unreadContacts > 0) {
            tips.push({
              icon: '💬',
              title: `未読のお問い合わせが${unreadContacts}件あります`,
              body: '早めの返信で顧客満足度が上がります。24時間以内の返信を心がけましょう。',
              href: '/laruHP/contacts',
              cta: '確認する',
            });
          }

          if (publishedSites.length > 0 && totalContacts === 0) {
            tips.push({
              icon: '📣',
              title: 'CTAボタンのテキストを見直す',
              body: '「お気軽にご相談ください」より「無料で相談する」の方が問い合わせが2〜3倍になる傾向があります。',
              href: `/laruHP/builder?siteId=${publishedSites[0].id}`,
              cta: 'ビルダーを開く',
            });
          }

          if (tips.length === 0) return null;
          return (
            <div className="mb-6">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">今週のアドバイス</div>
              <div className="space-y-3">
                {tips.slice(0, 2).map((tip, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex items-start gap-3 shadow-sm hover:border-sky-200 transition-colors">
                    <span className="text-xl flex-shrink-0 mt-0.5">{tip.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-900 mb-0.5">{tip.title}</div>
                      <p className="text-xs text-gray-500 leading-relaxed">{tip.body}</p>
                    </div>
                    {tip.href && tip.cta && (
                      <a href={tip.href} className="flex-shrink-0 text-xs font-bold text-sky-600 hover:text-sky-500 border border-sky-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                        {tip.cta}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Referral ── */}
        {effectiveStatus === 'active' && userId && (() => {
          const refCode = userId.slice(0, 8);
          const refUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://laruvisona.jp'}/laruHP/r/${refCode}`;
          return (
            <div className="bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-200 rounded-xl px-5 py-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900 mb-0.5">友達に紹介する</div>
                <p className="text-xs text-gray-500">紹介リンクを共有するだけ。紹介した方が契約したらお知らせします。</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                <input
                  readOnly
                  value={refUrl}
                  className="flex-1 sm:w-60 bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 outline-none select-all"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(refUrl);
                    setRefCopied(true);
                    setTimeout(() => setRefCopied(false), 2000);
                  }}
                  className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
                >
                  {refCopied ? <IcCheck /> : <IcCopy />}
                  {refCopied ? 'コピー済み' : 'コピー'}
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Getting Started ── */}
        {!loading && !startGuideDismissed && (() => {
          const steps = [
            { label: 'サイトを作成', done: sites.length > 0, href: sites.length === 0 ? undefined : `/laruHP/builder?siteId=${sites[0]?.id}` },
            { label: 'サイトを公開', done: sites.some(s => s.published), href: '/laruHP/dashboard' },
            { label: 'プランを契約', done: effectiveStatus === 'active', href: '/laruHP/plans' },
            { label: '独自ドメインを設定', done: sites.some(s => s.custom_domain), href: '/laruHP/dashboard' },
            { label: '問い合わせを受け取る', done: contacts.length > 0, href: '/laruHP/contacts' },
          ];
          const doneCount = steps.filter(s => s.done).length;
          if (doneCount === steps.length) return null;
          const pct = Math.round((doneCount / steps.length) * 100);
          return (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">はじめてガイド</h3>
                  <p className="text-gray-400 text-xs mt-0.5">{doneCount}/{steps.length} 完了</p>
                </div>
                <button onClick={() => setStartGuideDismissed(true)} className="text-gray-300 hover:text-gray-500 text-lg leading-none transition-colors">×</button>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="grid sm:grid-cols-5 gap-2">
                {steps.map((step, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border transition-colors ${step.done ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${step.done ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      {step.done ? '✓' : i + 1}
                    </span>
                    {!step.done && step.href ? (
                      <Link href={step.href} className="hover:text-sky-600 transition-colors">{step.label}</Link>
                    ) : (
                      <span>{step.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Churn alert: 7-day unpublished ── */}
        {!loading && (() => {
          const stale = sites.filter(s => !s.published && (Date.now() - new Date(s.created_at).getTime()) > 7 * 86400000);
          if (stale.length === 0) return null;
          const daysSince = Math.floor((Date.now() - new Date(stale[0].created_at).getTime()) / 86400000);
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 mb-6 flex items-start gap-3">
              <span className="text-lg flex-shrink-0 mt-0.5">⏳</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-amber-800 mb-0.5">「{stale[0].name}」を作成してから{daysSince}日が経ちました</div>
                <p className="text-xs text-amber-700 leading-relaxed">サイトがまだ非公開です。公開するとGoogleに認識されSEO効果が始まります。不明な点があればサポートへご連絡ください。</p>
              </div>
              <a href={`/laruHP/builder?siteId=${stale[0].id}`}
                className="flex-shrink-0 text-xs font-bold text-amber-700 hover:text-amber-600 border border-amber-300 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                公開する →
              </a>
            </div>
          );
        })()}

        {/* ── Plan upgrade nudge ── */}
        {upgradeError && <p className="text-red-600 text-xs mb-3">{upgradeError}</p>}
        {effectiveStatus === 'active' && effectivePlan === 'hp' && (
          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-[11px] font-bold text-indigo-700 flex-shrink-0">LB</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 mb-0.5">LARUbot AI チャットボット</div>
                <p className="text-gray-500 text-xs leading-relaxed mb-2">24時間対応のAIチャットが問い合わせ数を平均2.3倍に増加。</p>
                <button onClick={() => handleUpgrade('hp-bot')} disabled={upgradeLoading === 'hp-bot'}
                  className="text-indigo-600 hover:text-indigo-500 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {upgradeLoading === 'hp-bot' ? '処理中...' : 'HP + Bot プランへアップグレード →'}
                </button>
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-[11px] font-bold text-emerald-700 flex-shrink-0">SEO</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 mb-0.5">LARU SEO AIブログ自動生成</div>
                <p className="text-gray-500 text-xs leading-relaxed mb-2">毎週AIがSEO記事を自動公開。検索流入を継続的に獲得。</p>
                <button onClick={() => handleUpgrade('hp-bot-seo')} disabled={upgradeLoading === 'hp-bot-seo'}
                  className="text-emerald-600 hover:text-emerald-500 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {upgradeLoading === 'hp-bot-seo' ? '処理中...' : 'HP + Bot + SEO プランへアップグレード →'}
                </button>
              </div>
            </div>
          </div>
        )}
        {effectiveStatus === 'active' && effectivePlan === 'hp-bot' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-[11px] font-bold text-emerald-700 flex-shrink-0">SEO</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-900 mb-0.5">LARU SEO — AIブログで検索流入を自動化</div>
              <p className="text-gray-500 text-xs leading-relaxed mb-2">毎週AIがSEO最適化記事を自動公開。放置するだけで検索順位が上がります。</p>
              <button onClick={() => handleUpgrade('hp-bot-seo')} disabled={upgradeLoading === 'hp-bot-seo'}
                className="text-emerald-600 hover:text-emerald-500 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {upgradeLoading === 'hp-bot-seo' ? '処理中...' : 'HP + Bot + SEO プランへアップグレード →'}
              </button>
            </div>
          </div>
        )}
        {effectiveStatus === 'active' && effectivePlan === 'lite' && (
          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-[11px] font-bold text-indigo-700 flex-shrink-0">SEO</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 mb-0.5">LARU SEO AIブログ自動生成</div>
                <p className="text-gray-500 text-xs leading-relaxed mb-2">毎週AIがSEO記事を自動公開。検索流入を継続的に獲得。</p>
                <button onClick={() => handleUpgrade('hp-bot-seo')} disabled={upgradeLoading === 'hp-bot-seo'}
                  className="text-indigo-600 hover:text-indigo-500 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {upgradeLoading === 'hp-bot-seo' ? '処理中...' : 'HP + Bot + SEO プランへアップグレード →'}
                </button>
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-[11px] font-bold text-purple-700 flex-shrink-0">代理</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 mb-0.5">エージェンシープラン</div>
                <p className="text-gray-500 text-xs leading-relaxed mb-2">複数クライアントのサイトを一元管理。サブアカウント・ホワイトラベル対応。</p>
                <button onClick={() => handleUpgrade('agency')} disabled={upgradeLoading === 'agency'}
                  className="text-purple-600 hover:text-purple-500 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {upgradeLoading === 'agency' ? '処理中...' : 'エージェンシープランへアップグレード →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Quick Access Cards ── */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              {
                title: 'ビルダー',
                desc: 'AIでサイトを作成・編集',
                cta: 'ビルダーはこちら',
                href: sites.length > 0 ? `/laruHP/builder?siteId=${sites[0]?.id}` : '/laruHP/onboarding',
                iconColor: 'bg-sky-50 text-sky-600',
                borderHover: 'hover:border-sky-300',
                ctaColor: 'text-sky-600',
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                ),
              },
              {
                title: '問い合わせ',
                desc: '顧客からの連絡を一括管理',
                cta: '問い合わせはこちら',
                href: '/laruHP/contacts',
                iconColor: 'bg-emerald-50 text-emerald-600',
                borderHover: 'hover:border-emerald-300',
                ctaColor: 'text-emerald-600',
                badge: contacts.filter(c => !c.read).length,
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                ),
              },
              {
                title: 'AIブログ',
                desc: 'SEO記事を自動生成・公開',
                cta: 'ブログはこちら',
                href: '/laruHP/blog',
                iconColor: 'bg-indigo-50 text-indigo-600',
                borderHover: 'hover:border-indigo-300',
                ctaColor: 'text-indigo-600',
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                ),
              },
              {
                title: 'SEO設定',
                desc: '検索エンジン最適化を管理',
                cta: 'SEO設定はこちら',
                href: '/laruHP/seo',
                iconColor: 'bg-violet-50 text-violet-600',
                borderHover: 'hover:border-violet-300',
                ctaColor: 'text-violet-600',
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                ),
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group bg-white border border-gray-200 ${item.borderHover} hover:shadow-sm rounded-xl p-4 flex flex-col transition-all relative`}
              >
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute top-3 right-3 w-5 h-5 bg-sky-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
                <div className={`w-9 h-9 rounded-lg ${item.iconColor} flex items-center justify-center mb-3 transition-colors`}>
                  {item.icon}
                </div>
                <div className="text-xs font-bold text-gray-900 mb-0.5">{item.title}</div>
                <div className="text-[10px] text-gray-400 leading-relaxed mb-3 flex-1">{item.desc}</div>
                <div className={`text-[11px] font-semibold ${item.ctaColor} group-hover:opacity-80 transition-opacity`}>
                  {item.cta} →
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── New site error ── */}
        {newSiteError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-600">
            <IcAlert />
            {newSiteError}
            <button onClick={() => setNewSiteError('')} className="ml-auto text-red-400 hover:text-red-600 text-lg leading-none">×</button>
          </div>
        )}

        {/* ── Sites Header ── */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2.5" data-tour="sites">
            <div>
              <h1 className="text-xl font-bold text-gray-900">マイサイト</h1>
              {!loading && sites.length > 0 && (() => {
                const limit = planSiteLimit;
                return (
                  <p className="text-gray-500 text-xs mt-0.5">
                    {sites.length}{limit < 999 ? `/${limit}` : ''}件 · 公開中 {sites.filter(s => s.published).length}件
                  </p>
                );
              })()}
            </div>
            <button
              data-tour="new-site"
              onClick={handleNewSite}
              className="flex items-center gap-1.5 bg-sky-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-sky-500 transition-all flex-shrink-0"
            >
              <IcPlus />
              <span className="hidden sm:inline">新しいサイト</span>
              <span className="sm:hidden">作成</span>
              {!loading && planSiteLimit < 999 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-0.5 ${sites.length >= planSiteLimit ? 'bg-red-400/30 text-red-200' : 'bg-white/20 text-white'}`}>
                  {sites.length}/{planSiteLimit}
                </span>
              )}
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            <Link
              href="/laruHP/contacts"
              data-tour="contacts"
              className="relative flex items-center gap-1.5 text-xs border border-gray-200 hover:border-sky-300 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              問い合わせ
              {contacts.filter(c => !c.read).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-sky-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {contacts.filter(c => !c.read).length}
                </span>
              )}
            </Link>
            <Link
              href="/laruHP/crm"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-sky-300 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              CRM
            </Link>
            <Link
              href="/laruHP/booking"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-sky-300 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              予約管理
            </Link>
            <Link
              href="/laruHP/newsletter"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-sky-300 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              メール
            </Link>
            <Link
              href="/laruHP/blog"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-sky-300 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              ブログ
            </Link>
            <Link
              href="/laruHP/larubot-logs"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/></svg>
              会話ログ
            </Link>
            <Link
              href="/laruHP/agency"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-purple-300 hover:text-purple-600 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              エージェンシー
            </Link>
            <Link
              href="/laruHP/calendar"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-sky-300 hover:text-sky-600 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              カレンダー
            </Link>
            <Link
              href="/laruHP/payments"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-sky-300 hover:text-sky-600 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              決済リンク
            </Link>
            <Link
              href="/laruHP/popups"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-sky-300 hover:text-sky-600 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" fillOpacity="0.15"/></svg>
              ポップアップ
            </Link>
            <Link
              href="/laruHP/loyalty"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-sky-300 hover:text-sky-600 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              ポイントカード
            </Link>
            <Link
              href="/laruHP/onboarding"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-sky-300 hover:text-sky-600 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <IcSparkle />
              AIウィザード
            </Link>
            <Link
              href="/laruHP/shop"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-green-300 hover:text-green-600 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              ショップ
            </Link>
            <Link
              href="/laruHP/translate"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>
              多言語翻訳
            </Link>
            <Link
              href="/laruHP/analytics"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-purple-300 hover:text-purple-600 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              BI分析
            </Link>
            <Link
              href="/laruHP/sequences"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-amber-300 hover:text-amber-600 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              シーケンス
            </Link>
            <Link
              href="/laruHP/seo"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-emerald-300 hover:text-emerald-600 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              SEO設定
            </Link>
            <Link
              href="/laruHP/ab-test"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-orange-300 hover:text-orange-600 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>
              A/Bテスト
            </Link>
            <Link
              href="/laruHP/heatmap"
              className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-rose-300 hover:text-rose-600 px-3 py-1.5 rounded-lg transition-all text-gray-600 whitespace-nowrap flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M12 6v6l4 2"/></svg>
              ヒートマップ
            </Link>
          </div>
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'サイト名を読み込み中...', sub: '公開状態を確認中' },
              { label: 'サイト名を読み込み中...', sub: 'アクセス数を確認中' },
              { label: 'サイト名を読み込み中...', sub: '問い合わせを確認中' },
            ].map((item, i) => (
              <div key={i} className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden animate-pulse">
                <div className="h-32 bg-gray-100 flex items-end px-4 pb-3">
                  <span className="text-[10px] text-gray-300 font-semibold">プレビュー読み込み中...</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="h-3.5 bg-gray-100 rounded w-2/3">
                    <span className="sr-only">{item.label}</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-8 bg-gray-100 rounded-lg flex-1" />
                    <div className="h-8 bg-gray-100 rounded-lg w-14" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 border border-gray-200 border-dashed rounded-2xl text-center px-6 bg-white">
            <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2 text-gray-900">最初のサイトを作りましょう</h3>
            <p className="text-gray-600 text-sm mb-1.5 max-w-xs">業種を選んで情報を入力するだけ。AIが5分で本格サイトを自動生成します。</p>
            <p className="text-gray-400 text-xs mb-6">クレジットカード不要・今すぐ無料で試せます</p>
            <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
              {[
                { step: '1', label: 'サイト作成', icon: '✨' },
                { step: '2', label: 'コンテンツ編集', icon: '✏️' },
                { step: '3', label: '公開', icon: '🚀' },
                { step: '4', label: 'SEO・拡散', icon: '📣' },
              ].map((s, i, arr) => (
                <div key={s.step} className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-sky-100 border-2 border-sky-300 flex items-center justify-center text-sm">{s.icon}</div>
                    <span className="text-[10px] text-gray-500 font-medium">{s.label}</span>
                  </div>
                  {i < arr.length - 1 && <div className="w-6 h-px bg-gray-300 mb-4" />}
                </div>
              ))}
            </div>
            <Link
              href="/laruHP/onboarding"
              className="inline-flex items-center gap-2 bg-sky-600 text-white font-bold text-sm px-6 py-3.5 rounded-xl hover:bg-sky-500 hover:scale-105 transition-all shadow-sm"
            >
              <IcSparkle />
              AIでサイトを作る（無料）
            </Link>
            <p className="text-gray-400 text-[11px] mt-4">✓ 初月無料 &nbsp;✓ 最低6ヶ月契約 &nbsp;✓ 公開まで最短5分</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map(site => {
              const gradient = INDUSTRY_GRADIENT[site.industry || ''] || 'from-slate-100 to-slate-200';
              const initial = site.name.charAt(0).toUpperCase();
              return (
                <div key={site.id} className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden hover:border-sky-200 transition-all flex flex-col">

                  {/* Thumbnail */}
                  <div className={`bg-gradient-to-br ${gradient} h-32 flex items-center justify-center relative overflow-hidden`}>
                    <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/30" />
                    <div className="absolute -left-4 -bottom-6 w-20 h-20 rounded-full bg-white/30" />
                    <span className="text-[84px] font-bold text-gray-500/[0.15] select-none leading-none relative z-10 -mb-2">
                      {initial}
                    </span>
                    {site.industry && INDUSTRY_LABEL[site.industry] && (
                      <span className="absolute bottom-2.5 left-3 text-[9px] font-semibold text-gray-500 tracking-widest uppercase">
                        {INDUSTRY_LABEL[site.industry]}
                      </span>
                    )}
                    <div className={`absolute top-3 right-3 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      site.published ? 'bg-green-100 text-green-700' : 'bg-white/60 text-gray-500'
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${site.published ? 'bg-green-600' : 'bg-gray-400'}`} />
                      {site.published ? '公開中' : '非公開'}
                    </div>
                    {site.published && site.slug && (
                      <button
                        onClick={() => handleCopyUrl(site.slug!, site.id)}
                        className="absolute bottom-2.5 right-2.5 flex items-center gap-1 text-[9px] bg-white/70 hover:bg-white/90 border border-gray-200 px-2 py-1 rounded-md transition-all text-gray-600"
                      >
                        {copied === site.id ? <IcCheck /> : <IcCopy />}
                        {copied === site.id ? 'コピー済み' : 'URLコピー'}
                      </button>
                    )}
                    {!site.published && (
                      <button
                        onClick={() => handlePublish(site.id)}
                        disabled={publishing === site.id}
                        className="absolute bottom-2.5 right-2.5 flex items-center gap-1 text-[9px] bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1.5 rounded-md transition-all text-white font-bold shadow-sm"
                      >
                        🚀 {publishing === site.id ? '公開中...' : '公開する'}
                      </button>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1 gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{site.name}</h3>
                      <div className="flex items-center gap-2.5 mt-1">
                        {editingSlug === site.id ? (
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <span className="text-gray-400 text-[10px] font-mono flex-shrink-0">/hp/</span>
                            <input
                              type="text"
                              value={slugInput}
                              onChange={e => { setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugError(''); }}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveSlug(site.id); if (e.key === 'Escape') setEditingSlug(null); }}
                              className="flex-1 min-w-0 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[10px] font-mono text-gray-900 focus:outline-none focus:border-sky-500"
                              autoFocus
                              placeholder="my-site"
                            />
                            <button onClick={() => handleSaveSlug(site.id)} disabled={savingSlug} className="text-[9px] bg-sky-600 hover:bg-sky-500 px-1.5 py-0.5 rounded text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">{savingSlug ? '…' : '保存'}</button>
                            <button onClick={() => setEditingSlug(null)} className="text-[9px] text-gray-400 hover:text-gray-600 flex-shrink-0">✕</button>
                            {slugError && <span className="text-[9px] text-red-600 flex-shrink-0">{slugError}</span>}
                          </div>
                        ) : site.slug ? (
                          <button onClick={() => startEditSlug(site)} className="flex items-center gap-1 group/slug">
                            <span className="text-gray-500 text-[10px] font-mono truncate">/hp/{site.slug}</span>
                            <span className="text-gray-400 text-[9px] opacity-0 group-hover/slug:opacity-100 transition-opacity">✎</span>
                          </button>
                        ) : (
                          <button onClick={() => startEditSlug(site)} className="text-gray-400 text-[10px] hover:text-gray-600 transition-colors">URLを設定 →</button>
                        )}
                        {site.published && site.view_count > 0 && (() => {
                          const d7 = analytics['7']?.[site.id];
                          let trend: string | null = null;
                          if (d7 && d7.length >= 4) {
                            const half = Math.floor(d7.length / 2);
                            const first = d7.slice(0, half).reduce((s, v) => s + v.views, 0);
                            const second = d7.slice(half).reduce((s, v) => s + v.views, 0);
                            if (second > first * 1.1) trend = '↗';
                            else if (second < first * 0.9) trend = '↘';
                            else trend = '→';
                          }
                          return (
                            <span className="flex items-center gap-1 text-gray-500 text-[10px] flex-shrink-0">
                              <IcEye />
                              {site.view_count.toLocaleString()}
                              {trend && (
                                <span className={trend === '↗' ? 'text-green-500' : trend === '↘' ? 'text-red-400' : 'text-gray-400'} title="7日間トレンド">
                                  {trend}
                                </span>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                      {(() => {
                        const staleDays = (Date.now() - new Date(site.updated_at).getTime()) / 86400000;
                        const isStale = staleDays > 30;
                        return (
                          <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${isStale ? 'text-amber-500' : 'text-gray-400'}`}>
                            {isStale ? '⚠' : '✎'} 更新 {relativeTime(site.updated_at)}
                            {isStale && <span className="text-[9px] bg-amber-50 border border-amber-200 text-amber-600 px-1 py-0 rounded">更新推奨</span>}
                          </p>
                        );
                      })()}
                    </div>

                    {/* アクセス解析グラフ */}
                    {(() => {
                      const sp = (analyticsPeriods[site.id] ?? '7') as '7' | '30' | 'all';
                      const siteData = analytics[sp]?.[site.id];
                      if (!site.published || !siteData) return null;
                      return (
                        <div className="bg-sky-50 border border-sky-100 rounded-lg px-3 pt-2 pb-1.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1">
                              {(['7', '30', 'all'] as const).map(p => (
                                <button
                                  key={p}
                                  onClick={() => {
                                    setAnalyticsPeriods(prev => ({ ...prev, [site.id]: p }));
                                    if (!analytics[p]) fetchAnalytics(p);
                                  }}
                                  className={`text-[9px] px-1.5 py-0.5 rounded transition-all ${sp === p ? 'bg-sky-100 text-sky-700' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                  {p === '7' ? '7日' : p === '30' ? '30日' : '全期間'}
                                </button>
                              ))}
                              {analyticsLoading && (
                                <svg className="animate-spin text-gray-400 ml-0.5" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-gray-400">
                                {siteData.reduce((s: number, d: DayView) => s + d.views, 0).toLocaleString()} PV
                              </span>
                              <button
                                onClick={() => downloadCsv(site.name, siteData)}
                                title="CSVでダウンロード"
                                className="text-[9px] text-sky-500 hover:text-sky-700 border border-sky-200 hover:border-sky-400 px-1.5 py-0.5 rounded transition-all"
                              >
                                CSV
                              </button>
                            </div>
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
                          className="flex items-center justify-between bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 hover:border-sky-200 transition-all">
                          <div className="flex items-center gap-2">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            <span className="text-[10px] text-gray-500">問い合わせ</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-600 font-semibold">{total}件</span>
                            {unread > 0 && (
                              <span className="bg-sky-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unread}未読</span>
                            )}
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400"><polyline points="9 18 15 12 9 6"/></svg>
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
                      const winnerHint = pctA > pctB ? 'A' : pctB > pctA ? 'B' : null;
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg p-2.5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-semibold text-gray-500">A/Bテスト結果</span>
                            <span className="text-[9px] text-gray-400">{total}件のサンプル</span>
                          </div>
                          <div className="flex gap-1.5 mb-1.5">
                            <div className="flex-1 bg-sky-100 rounded h-5 relative overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-sky-300 rounded" style={{ width: `${pctA}%` }} />
                              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-sky-700">A: {pctA}%{winnerHint === 'A' && ' 👑'}</span>
                            </div>
                            <div className="flex-1 bg-purple-100 rounded h-5 relative overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-purple-300 rounded" style={{ width: `${pctB}%` }} />
                              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-purple-700">B: {pctB}%{winnerHint === 'B' && ' 👑'}</span>
                            </div>
                          </div>
                          <div className="flex justify-between text-[9px] text-gray-400 mb-2">
                            <span>{abStats.a || 0}PV</span>
                            <span>{abStats.b || 0}PV</span>
                          </div>
                          <div className="border-t border-gray-100 pt-2 flex items-center gap-1.5">
                            <span className="text-[9px] text-gray-400 flex-1">勝者を確定する</span>
                            <button
                              onClick={() => handleAbWinner(site.id, 'a')}
                              disabled={abWinnerLoading === site.id}
                              className="text-[9px] px-2 py-0.5 rounded bg-sky-100 text-sky-700 hover:bg-sky-200 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                              A を選ぶ
                            </button>
                            <button
                              onClick={() => handleAbWinner(site.id, 'b')}
                              disabled={abWinnerLoading === site.id}
                              className="text-[9px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                              B を選ぶ
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* LARUbot未連携バナー */}
                    {site.settings_json?.larubot && !site.settings_json?.larubotPublicId && (
                      <Link
                        href={`/laruHP/builder?siteId=${site.id}`}
                        className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 hover:bg-indigo-100 transition-all"
                      >
                        <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center text-indigo-700 text-[9px] font-bold flex-shrink-0">LB</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-indigo-700 text-[10px] font-semibold">LARUbot未連携</div>
                          <div className="text-indigo-500 text-[9px]">Public IDを設定してください</div>
                        </div>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-500 flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
                      </Link>
                    )}
                    {site.settings_json?.laruseo && !site.settings_json?.laruseoPublicId && (
                      <Link
                        href={`/laruHP/builder?siteId=${site.id}`}
                        className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 hover:bg-emerald-100 transition-all"
                      >
                        <div className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center text-emerald-700 text-[9px] font-bold flex-shrink-0">SEO</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-emerald-700 text-[10px] font-semibold">LARUSEO未連携</div>
                          <div className="text-emerald-600 text-[9px]">エディタで連携IDを設定してください</div>
                        </div>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500 flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
                      </Link>
                    )}

                    {/* Custom domain */}
                    {domainErrors[site.id] && (
                      <p className="text-red-600 text-[10px] -mb-1">{domainErrors[site.id]}</p>
                    )}
                    <div className="flex gap-1.5">
                      <div className="flex-1 relative min-w-0">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                          <IcGlobe />
                        </span>
                        <input
                          type="text"
                          placeholder="example.com"
                          value={domainInputs[site.id] ?? ''}
                          onChange={e => setDomainInputs(d => ({ ...d, [site.id]: e.target.value }))}
                          className="w-full bg-white border border-gray-200 rounded-md pl-6 pr-2 py-1.5 text-[10px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 font-mono"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveDomain(site.id)}
                        disabled={savingDomain === site.id}
                        className="text-[10px] bg-sky-50 hover:bg-sky-100 border border-gray-200 hover:border-sky-200 px-3 py-1.5 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 text-gray-600"
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
                            className="text-[10px] bg-sky-50 hover:bg-sky-100 border border-gray-200 px-2.5 py-1.5 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-gray-500 flex-shrink-0"
                          >
                            {dnsStatus[site.id]?.checking ? '確認中...' : 'DNS確認'}
                          </button>
                          {dnsStatus[site.id] && !dnsStatus[site.id].checking && (
                            <span className={`text-[10px] font-semibold ${dnsStatus[site.id].verified ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {dnsStatus[site.id].verified ? '✓ 接続済み' : '⚠ 未設定'}
                            </span>
                          )}
                        </div>
                        {dnsStatus[site.id] && !dnsStatus[site.id].verified && !dnsStatus[site.id].checking && (
                          <div className="bg-sky-50 border border-sky-100 rounded-md p-2 space-y-1.5">
                            <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide">CNAMEレコードを設定してください</p>
                            <div className="font-mono text-[9px] text-gray-600 space-y-1">
                              <div><span className="text-gray-400">名前（ホスト）:</span> @ または {site.custom_domain}</div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-gray-400">値（CNAME先）:</span>
                                <span>{dnsStatus[site.id].expectedTarget || 'cname.vercel-dns.com'}</span>
                                <button
                                  onClick={() => navigator.clipboard.writeText(dnsStatus[site.id].expectedTarget || 'cname.vercel-dns.com')}
                                  className="text-sky-500 hover:text-sky-700 border border-sky-200 px-1 rounded text-[8px] font-bold transition-colors"
                                >
                                  コピー
                                </button>
                              </div>
                            </div>
                            <p className="text-[9px] text-gray-400">※ DNS反映には24〜48時間かかる場合があります。設定後に再度「DNS確認」を押してください。</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Member management */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={async () => {
                          const open = !memberPanels[site.id];
                          setMemberPanels(p => ({ ...p, [site.id]: open }));
                          if (open && !memberLists[site.id]) {
                            const res = await fetch(`/api/sites/${site.id}/members`);
                            const d = await res.json();
                            setMemberLists(p => ({ ...p, [site.id]: d.members || [] }));
                          }
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                          メンバー管理
                        </div>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-400 transition-transform ${memberPanels[site.id] ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      {memberPanels[site.id] && (
                        <div className="px-3 py-2.5 border-t border-gray-100 space-y-2">
                          {/* Member list */}
                          {(memberLists[site.id] || []).map(m => (
                            <div key={m.id} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center text-[9px] font-bold text-sky-600 flex-shrink-0">
                                  {m.invited_email.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-[10px] text-gray-700 truncate">{m.invited_email}</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${m.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                                  {m.status === 'active' ? '参加済み' : '招待中'}
                                </span>
                                <button
                                  onClick={async () => {
                                    await fetch(`/api/sites/${site.id}/members`, {
                                      method: 'DELETE',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ email: m.invited_email }),
                                    });
                                    setMemberLists(p => ({ ...p, [site.id]: (p[site.id] || []).filter(x => x.id !== m.id) }));
                                  }}
                                  className="text-[9px] text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  削除
                                </button>
                              </div>
                            </div>
                          ))}
                          {/* Invite input */}
                          <div className="flex gap-1.5 pt-1">
                            <input
                              type="email"
                              placeholder="メールアドレスで招待"
                              value={memberInputs[site.id] || ''}
                              onChange={e => setMemberInputs(p => ({ ...p, [site.id]: e.target.value }))}
                              className="flex-1 min-w-0 bg-white border border-gray-200 rounded-md px-2 py-1.5 text-[10px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500"
                            />
                            <button
                              onClick={async () => {
                                const email = memberInputs[site.id]?.trim();
                                if (!email) return;
                                setMemberLoading(site.id);
                                setInviteSuccess(p => ({ ...p, [site.id]: '' }));
                                const res = await fetch(`/api/sites/${site.id}/members`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ email }),
                                });
                                if (res.ok) {
                                  setMemberInputs(p => ({ ...p, [site.id]: '' }));
                                  setInviteSuccess(p => ({ ...p, [site.id]: '招待メールを送信しました' }));
                                  const r2 = await fetch(`/api/sites/${site.id}/members`);
                                  const d = await r2.json();
                                  setMemberLists(p => ({ ...p, [site.id]: d.members || [] }));
                                }
                                setMemberLoading(null);
                              }}
                              disabled={memberLoading === site.id}
                              className="text-[10px] bg-sky-600 hover:bg-sky-500 text-white font-bold px-2.5 py-1.5 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                            >
                              {memberLoading === site.id ? '...' : '招待'}
                            </button>
                          </div>
                          {inviteSuccess[site.id] && (
                            <p className="text-[10px] text-green-600">{inviteSuccess[site.id]}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* PageSpeed */}
                    {site.published && site.slug && (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => handlePagespeed(site.id)}
                          disabled={pagespeedLoading === site.id}
                          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            PageSpeed スコア
                          </div>
                          {pagespeedLoading === site.id ? (
                            <svg className="animate-spin text-gray-400" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          ) : pagespeedData[site.id] ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold ${pagespeedData[site.id]!.performance >= 90 ? 'text-green-600' : pagespeedData[site.id]!.performance >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                {pagespeedData[site.id]!.performance}
                              </span>
                              <span className="text-[10px] text-sky-600 font-bold">SEO {pagespeedData[site.id]!.seo}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400">計測する</span>
                          )}
                        </button>
                        {pagespeedData[site.id] && (
                          <div className="px-3 py-2 border-t border-gray-100 flex gap-3">
                            {[
                              { label: 'パフォーマンス', val: pagespeedData[site.id]!.performance },
                              { label: 'SEO', val: pagespeedData[site.id]!.seo },
                            ].map(({ label, val }) => (
                              <div key={label} className="flex-1 text-center">
                                <div className={`text-lg font-black ${val >= 90 ? 'text-green-600' : val >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{val}</div>
                                <div className="text-[9px] text-gray-400">{label}</div>
                                <div className="h-1 rounded-full bg-gray-100 mt-1 overflow-hidden">
                                  <div className={`h-full rounded-full ${val >= 90 ? 'bg-green-500' : val >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${val}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Site Audit */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => handleAudit(site.id)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/></svg>
                          AI診断
                        </div>
                        <div className="flex items-center gap-1.5">
                          {auditLoading === site.id && (
                            <svg className="animate-spin text-gray-400" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          )}
                          {auditData[site.id] && (
                            <span className={`text-[10px] font-bold ${auditData[site.id]!.score >= 70 ? 'text-green-600' : auditData[site.id]!.score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                              {auditData[site.id]!.score}点
                            </span>
                          )}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-400 transition-transform ${auditPanels[site.id] ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                      </button>
                      {auditPanels[site.id] && (
                        <div className="px-3 py-2.5 border-t border-gray-100">
                          {auditLoading === site.id ? (
                            <div className="text-[10px] text-gray-400 text-center py-3">AIが診断中...</div>
                          ) : auditData[site.id] ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`text-2xl font-black ${auditData[site.id]!.score >= 70 ? 'text-green-600' : auditData[site.id]!.score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {auditData[site.id]!.score}
                                </div>
                                <div className="flex-1">
                                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div className={`h-full rounded-full ${auditData[site.id]!.score >= 70 ? 'bg-green-500' : auditData[site.id]!.score >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${auditData[site.id]!.score}%` }} />
                                  </div>
                                  <div className="text-[9px] text-gray-400 mt-0.5">{auditData[site.id]!.summary}</div>
                                </div>
                              </div>
                              {auditData[site.id]!.items.slice(0, 3).map((item, i) => (
                                <div key={i} className={`rounded-md px-2.5 py-2 border text-[10px] ${item.impact === 'high' ? 'border-red-200 bg-red-50' : item.impact === 'medium' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                                  <div className={`font-semibold mb-0.5 ${item.impact === 'high' ? 'text-red-700' : item.impact === 'medium' ? 'text-amber-700' : 'text-gray-700'}`}>
                                    [{item.impact === 'high' ? '高' : item.impact === 'medium' ? '中' : '低'}] {item.category}
                                  </div>
                                  <div className="text-gray-600">{item.suggestion}</div>
                                </div>
                              ))}
                              <button
                                onClick={() => { setAuditData(p => ({ ...p, [site.id]: null })); handleAudit(site.id); }}
                                className="text-[9px] text-gray-400 hover:text-sky-600 transition-colors mt-1"
                              >
                                再診断する
                              </button>
                            </div>
                          ) : (
                            <div className="text-center py-2">
                              <div className="text-[10px] text-gray-400 mb-2">AIがサイトを分析して改善点をスコアリングします</div>
                              <button
                                onClick={() => handleAudit(site.id)}
                                className="text-[10px] bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 px-3 py-1.5 rounded-md transition-all font-bold"
                              >
                                診断を開始
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Heatmap */}
                    {site.published && (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => handleHeatmapPanel(site.id)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
                            ヒートマップ
                          </div>
                          <div className="flex items-center gap-1.5">
                            {heatmapLoading === site.id && (
                              <svg className="animate-spin text-gray-400" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                            )}
                            {heatmapData[site.id] && (
                              <span className="text-[10px] text-gray-400">{heatmapData[site.id]!.total}件</span>
                            )}
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-400 transition-transform ${heatmapPanels[site.id] ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                          </div>
                        </button>
                        {heatmapPanels[site.id] && (
                          <div className="px-3 py-2.5 border-t border-gray-100">
                            {heatmapLoading === site.id ? (
                              <div className="text-[10px] text-gray-400 text-center py-3">データ取得中...</div>
                            ) : heatmapData[site.id] && heatmapData[site.id]!.total > 0 ? (
                              <div>
                                <div className="text-[9px] text-gray-400 mb-2">過去30日間のクリック分布（{heatmapData[site.id]!.total}件）</div>
                                <div className="relative bg-slate-50 border border-gray-100 rounded h-28 overflow-hidden">
                                  {(heatmapData[site.id]!.points || []).slice(0, 200).map((pt, i) => (
                                    <div
                                      key={i}
                                      className="absolute w-3 h-3 rounded-full bg-red-500/40 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                      style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                                    />
                                  ))}
                                </div>
                                <p className="text-[9px] text-gray-400 mt-1.5">各点 = クリック位置（ビューポート比率）</p>
                              </div>
                            ) : (
                              <div className="text-center py-3">
                                <div className="text-[10px] text-gray-400">まだクリックデータがありません</div>
                                <div className="text-[9px] text-gray-300 mt-0.5">公開サイトにトラッキングスクリプトを追加してください</div>
                                <a
                                  href={`/laruHP/builder?siteId=${site.id}&tab=settings`}
                                  className="text-[10px] text-sky-600 hover:text-sky-500 mt-1.5 inline-block transition-colors"
                                >
                                  スクリプト設定 →
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Snapshots */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => handleSnapshotPanel(site.id)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                          バックアップ履歴
                        </div>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-400 transition-transform ${snapshotPanels[site.id] ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      {snapshotPanels[site.id] && (
                        <div className="px-3 py-2.5 border-t border-gray-100">
                          {!snapshotLists[site.id] ? (
                            <div className="text-[10px] text-gray-400 text-center py-2">読み込み中...</div>
                          ) : snapshotLists[site.id].length === 0 ? (
                            <div className="text-[10px] text-gray-400 text-center py-2">まだ保存履歴がありません</div>
                          ) : (
                            <div className="space-y-1.5">
                              {snapshotLists[site.id].slice(0, 5).map(v => (
                                <div key={v.id} className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-[10px] text-gray-700 font-medium truncate">{v.label}</div>
                                    <div className="text-[9px] text-gray-400">{new Date(v.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                  </div>
                                  <button
                                    onClick={() => handleSnapshotRestore(site.id, v.id, v.label)}
                                    disabled={snapshotRestoring === v.id}
                                    className="text-[9px] bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 px-2 py-0.5 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 font-bold"
                                  >
                                    {snapshotRestoring === v.id ? '...' : '復元'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 mt-auto">
                      <Link
                        href={`/laruHP/builder?siteId=${site.id}`}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-sky-600 text-white py-2.5 rounded-lg hover:bg-sky-500 transition-all"
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
                              className="flex-1 flex items-center justify-center gap-1 text-[11px] border border-gray-200 hover:border-sky-200 py-2 rounded-lg transition-all text-gray-600"
                            >
                              <IcEye />
                              表示
                            </a>
                            <button
                              onClick={() => setQrSite({ url: `${window.location.origin}/hp/${site.slug}`, name: site.name })}
                              title="QRコード"
                              aria-label="QRコードを表示"
                              className="flex items-center justify-center text-[11px] text-gray-400 hover:text-sky-600 border border-gray-200 hover:border-sky-200 py-2 px-3 rounded-lg transition-all"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>
                            </button>
                            <button
                              onClick={() => setUnpublishSiteId(site.id)}
                              disabled={publishing === site.id}
                              className="flex-1 flex items-center justify-center text-[11px] border border-gray-200 hover:border-red-200 hover:text-red-600 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-gray-500"
                            >
                              {publishing === site.id ? '...' : '非公開'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handlePublish(site.id)}
                            disabled={publishing === site.id}
                            className="flex-1 flex items-center justify-center gap-1 text-[11px] bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {publishing === site.id ? '処理中...' : '公開する'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDuplicate(site.id)}
                          disabled={duplicating === site.id}
                          title="複製"
                          aria-label="サイトを複製"
                          className="flex items-center justify-center text-[11px] text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300 py-2 px-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {duplicating === site.id ? '...' : <IcDuplicate />}
                        </button>
                        {deleteConfirmSiteId === site.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { handleDelete(site.id); setDeleteConfirmSiteId(null); }}
                              className="text-[10px] font-bold text-red-600 border border-red-300 bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded-lg transition-all"
                            >削除</button>
                            <button
                              onClick={() => setDeleteConfirmSiteId(null)}
                              className="text-[10px] text-gray-500 border border-gray-200 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-all"
                            >取消</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmSiteId(site.id)}
                            title="削除"
                            aria-label="サイトを削除"
                            className="flex items-center justify-center text-[11px] text-gray-400 hover:text-red-600 border border-transparent hover:border-red-200 py-2 px-3 rounded-lg transition-all"
                          >
                            <IcTrash />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New site card */}
            <button
              onClick={handleNewSite}
              className="border border-gray-200 border-dashed rounded-xl min-h-[260px] flex flex-col items-center justify-center hover:border-sky-300 hover:bg-sky-50 transition-all group gap-2.5"
            >
              <div className="w-9 h-9 rounded-lg border border-gray-200 group-hover:border-sky-200 flex items-center justify-center transition-all text-gray-400 group-hover:text-sky-600">
                <IcPlus />
              </div>
              <span className="text-gray-400 group-hover:text-sky-600 text-xs font-medium transition-colors">新しいサイトを作成</span>
            </button>
          </div>
        )}
      </main>

      {/* Command Palette */}
      <CommandPalette siteId={sites[0]?.id} />

      {/* Unpublish confirmation modal */}
      {unpublishSiteId && (() => {
        const targetSite = sites.find(s => s.id === unpublishSiteId);
        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4 text-xl">⚠️</div>
              <h3 className="font-bold text-gray-900 text-center mb-2">本当に非公開にしますか？</h3>
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                {targetSite && (targetSite.view_count || 0) > 0
                  ? `このサイトはこれまでに ${(targetSite.view_count || 0).toLocaleString()} 回アクセスされています。非公開にすると Google の評価が失われる可能性があります。`
                  : '非公開にすると Google に認識されなくなります。'}
              </p>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setUnpublishSiteId(null)}
                  className="flex-1 text-sm text-gray-600 border border-gray-200 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => { handleUnpublish(unpublishSiteId); setUnpublishSiteId(null); }}
                  className="flex-1 text-sm bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-lg transition-colors"
                >
                  非公開にする
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Onboarding Tour */}
      <OnboardingTour key={tourResetKey} />

      {/* QR Code modal */}
      {qrSite && (
        <QRCodeModal
          url={qrSite.url}
          siteName={qrSite.name}
          onClose={() => setQrSite(null)}
        />
      )}

      {/* Plan picker modal */}
      {/* ── Site limit upgrade modal ── */}
      {showSiteLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">🚧</div>
            <h2 className="text-gray-900 font-bold text-lg text-center mb-1">サイト数の上限に達しました</h2>
            <p className="text-gray-500 text-sm text-center mb-5">
              現在のプランでは <strong className="text-gray-900">{showSiteLimitModal.current}/{showSiteLimitModal.limit}件</strong> が上限です。<br/>
              プランをアップグレードするとサイト数を増やせます。
            </p>
            <div className="space-y-2 mb-5">
              {[
                { id: 'hp-bot', label: 'HP + LARUbot', price: '¥4,980/月', sites: '2サイト', badge: 'おすすめ' },
                { id: 'hp-bot-seo', label: 'HP + Bot + SEO', price: '¥9,800/月', sites: '3サイト', badge: null },
                { id: 'agency', label: 'エージェンシー', price: '¥19,800/月', sites: '無制限', badge: '代理店向け' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={async () => {
                    setShowSiteLimitModal(null);
                    const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: p.id }) });
                    const d = await res.json();
                    if (d.url) window.location.href = d.url;
                  }}
                  className="w-full flex items-center justify-between bg-sky-50 hover:bg-sky-100 border border-gray-200 hover:border-sky-300 rounded-xl px-4 py-3 transition-all text-left"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 font-bold text-sm">{p.label}</span>
                      {p.badge && <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold">{p.badge}</span>}
                    </div>
                    <div className="text-gray-500 text-[11px]">サイト {p.sites}</div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <div className="text-gray-900 font-bold text-sm">{p.price}</div>
                    <div className="text-sky-600 text-[10px]">初月無料</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowSiteLimitModal(null)} className="w-full text-gray-400 text-sm hover:text-gray-600 transition-colors">キャンセル</button>
          </div>
        </div>
      )}

      {showPlanModal && (() => {
        const MODAL_PLANS = [
          { id: 'hp',         label: 'LARU HP',          monthlyPrice: 999,   annualPrice: 833,   badge: null,           desc: 'ホームページ作成・公開' },
          { id: 'lite',       label: 'HP + LARUbot Lite', monthlyPrice: 4980,  annualPrice: 4150,  badge: null,           desc: 'HP + AIチャットボット（機能制限あり）' },
          { id: 'hp-bot',     label: 'HP + LARUbot',      monthlyPrice: 4980,  annualPrice: 4150,  badge: 'おすすめ',     desc: 'HP作成 + AIチャットボット搭載' },
          { id: 'hp-bot-seo', label: 'HP + Bot + SEO',    monthlyPrice: 9800,  annualPrice: 8166,  badge: '半年間限定',   desc: 'HP + チャットボット + AIブログSEO' },
          { id: 'agency',     label: 'エージェンシー',    monthlyPrice: 19800, annualPrice: 16500, badge: '代理店向け',   desc: 'クライアント数無制限・全機能込み' },
        ] as const;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
            <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <h2 className="text-gray-900 font-bold text-lg mb-1">プランを選択して公開</h2>
              <p className="text-gray-600 text-sm mb-4">お試し期間後は選択したプランで課金されます</p>

              {/* Billing toggle */}
              <div className="flex items-center gap-3 mb-5 bg-gray-50 border border-gray-200 rounded-xl p-1 self-start w-fit">
                <button
                  onClick={() => setPlanModalAnnual(false)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${!planModalAnnual ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                >
                  月払い
                </button>
                <button
                  onClick={() => setPlanModalAnnual(true)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${planModalAnnual ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                >
                  年払い <span className="text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">20%オフ</span>
                </button>
              </div>

              <div className="space-y-2">
                {MODAL_PLANS.map(plan => {
                  const price = planModalAnnual ? plan.annualPrice : plan.monthlyPrice;
                  return (
                    <button
                      key={plan.id}
                      onClick={async () => {
                        setShowPlanModal(false);
                        setCheckoutError('');
                        const res = await fetch('/api/stripe/checkout', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ siteId: pendingSiteId, plan: plan.id, billing: planModalAnnual ? 'annual' : 'monthly' }),
                        });
                        const d = await res.json();
                        if (d.url) window.location.href = d.url;
                        else setCheckoutError('決済ページの取得に失敗しました。もう一度お試しください。');
                      }}
                      className="w-full flex items-center justify-between bg-sky-50 hover:bg-sky-100 border border-gray-200 hover:border-sky-300 rounded-xl px-4 py-3 transition-all text-left"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 font-bold text-sm">{plan.label}</span>
                          {plan.badge && <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold">{plan.badge}</span>}
                        </div>
                        <div className="text-gray-500 text-[11px] mt-0.5">{plan.desc}</div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className="text-gray-900 font-bold text-sm">¥{price.toLocaleString()}<span className="text-gray-400 text-[10px] font-normal">/月</span></div>
                        <div className="text-sky-600 text-[10px]">{planModalAnnual ? '年払い一括' : '初月無料'}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {checkoutError && (
                <p className="mt-3 text-red-600 text-xs text-center">{checkoutError}</p>
              )}
              <button
                onClick={() => { setShowPlanModal(false); setCheckoutError(''); }}
                className="mt-4 w-full text-gray-400 text-sm hover:text-gray-600 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
