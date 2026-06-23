'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

type CrmStatus = 'new' | 'in_progress' | 'done' | 'lost';

interface Contact {
  id: string;
  site_id: string;
  type: 'contact' | 'booking';
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  read: boolean;
  created_at: string;
  crm_status?: CrmStatus | null;
  crm_tags?: string[] | null;
  crm_note?: string | null;
  crm_followup_at?: string | null;
  extra_fields?: Record<string, string> | null;
}

interface Site { id: string; name: string; }

const STATUS_CONFIG: Record<CrmStatus, { label: string; color: string; bg: string }> = {
  new:         { label: '新規',   color: 'text-blue-300',   bg: 'bg-blue-500/20 border-blue-500/30' },
  in_progress: { label: '対応中', color: 'text-amber-300',  bg: 'bg-amber-500/20 border-amber-500/30' },
  done:        { label: '完了',   color: 'text-green-300',  bg: 'bg-green-500/20 border-green-500/30' },
  lost:        { label: '失注',   color: 'text-slate-500',  bg: 'bg-slate-500/10 border-slate-500/20' },
};

const PRESET_TAGS = ['見込み客', '既存顧客', 'VIP', '要フォロー', 'クレーム', '提携候補'];

const DEFAULT_REPLY_TEMPLATES = [
  { id: '1', label: '初回返信', body: 'お問い合わせいただきありがとうございます。内容を確認しご連絡いたします。' },
  { id: '2', label: '予約確定', body: 'ご予約いただきありがとうございます。日時を確定しました。ご不明な点はお気軽にご連絡ください。' },
  { id: '3', label: 'フォロー', body: '先日はお問い合わせいただきありがとうございました。その後いかがでしょうか？' },
];
const REPLY_TEMPLATES_KEY = 'laruHP_contacts_reply_templates';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
}

export default function ContactsPage() {
  const searchParams = useSearchParams();
  const listRef = useRef<HTMLDivElement>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteFilter, setSiteFilter] = useState(() => searchParams.get('site') ?? '');
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get('type') ?? '');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '');
  const [searchQ, setSearchQ] = useState(() => searchParams.get('q') ?? '');
  const [showOverdueOnly, setShowOverdueOnly] = useState(() => searchParams.get('overdue') === '1');
  const [showSiteBreakdown, setShowSiteBreakdown] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editStatus, setEditStatus] = useState<CrmStatus>('new');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editNote, setEditNote] = useState('');
  const [editFollowup, setEditFollowup] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [newContactToast, setNewContactToast] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummarizing, setAiSummarizing] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [newNoteEntry, setNewNoteEntry] = useState('');
  const [replyTemplates, setReplyTemplates] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_REPLY_TEMPLATES;
    try { return JSON.parse(localStorage.getItem(REPLY_TEMPLATES_KEY) || 'null') || DEFAULT_REPLY_TEMPLATES; } catch { return DEFAULT_REPLY_TEMPLATES; }
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const params = new URLSearchParams();
    if (siteFilter) params.set('site', siteFilter);
    if (typeFilter) params.set('type', typeFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (searchQ) params.set('q', searchQ);
    if (showOverdueOnly) params.set('overdue', '1');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [siteFilter, typeFilter, statusFilter, searchQ, showOverdueOnly, router]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/laruHP/auth/login'); return; }
      const [cRes, sRes] = await Promise.all([fetch('/api/contacts'), fetch('/api/sites')]);
      const { contacts: c } = await cRes.json();
      const { sites: s } = await sRes.json();
      setContacts(c || []);
      setSites(s || []);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Supabase Realtime: 新着問い合わせをリアルタイム反映
  useEffect(() => {
    if (sites.length === 0) return;
    const siteIds = new Set(sites.map(s => s.id));
    const channel = supabase
      .channel('contacts-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contacts' }, (payload) => {
        const c = payload.new as Contact;
        if (!siteIds.has(c.site_id)) return;
        setContacts(prev => [c, ...prev]);
        setNewContactToast(`${c.name}さんから${c.type === 'booking' ? '予約' : '問い合わせ'}が届きました`);
        setTimeout(() => setNewContactToast(null), 5000);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const idx = parseInt(e.key) - 1;
      if (idx < 0 || idx >= Math.min(3, replyTemplates.length)) return;
      e.preventDefault();
      const t = replyTemplates[idx];
      if (t) setNewNoteEntry(n => n ? n + '\n' + t.body : t.body);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [replyTemplates, setNewNoteEntry]);

  const openDetail = useCallback(async (c: Contact) => {
    setSelected(c);
    setAiSummary(null);
    setEditStatus((c.crm_status as CrmStatus) || 'new');
    setEditTags(c.crm_tags || []);
    setEditNote(c.crm_note || '');
    setEditFollowup(c.crm_followup_at ? c.crm_followup_at.slice(0, 10) : '');
    setSaveMsg('');
    if (!c.read) {
      await fetch('/api/contacts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, read: true }) });
      setContacts(prev => prev.map(x => x.id === c.id ? { ...x, read: true } : x));
    }
  }, []);

  const saveCrm = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveMsg('');
    await fetch('/api/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        crm_status: editStatus,
        crm_tags: editTags,
        crm_note: editNote,
        crm_followup_at: editFollowup || null,
      }),
    });
    const updated = { ...selected, crm_status: editStatus, crm_tags: editTags, crm_note: editNote, crm_followup_at: editFollowup || null };
    setContacts(prev => prev.map(c => c.id === selected.id ? updated : c));
    setSelected(updated);
    setSaveMsg('保存しました');
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const deleteContact = async (id: string) => {
    if (!confirm('この問い合わせを削除しますか？')) return;
    await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
    setContacts(prev => prev.filter(c => c.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const toggleTag = (tag: string) => {
    setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleAiSummarize = async (message: string) => {
    setAiSummarizing(true);
    setAiSummary(null);
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
      if (res.ok) {
        const d = await res.json() as { summary?: string };
        setAiSummary(d.summary || null);
      }
    } catch { /* ignore */ }
    setAiSummarizing(false);
  };

  const handleBulkStatus = async (newStatus: CrmStatus) => {
    const ids = [...checkedIds];
    await Promise.all(ids.map(id => fetch(`/api/contacts?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crm_status: newStatus }),
    })));
    setContacts(prev => prev.map(c => checkedIds.has(c.id) ? { ...c, crm_status: newStatus } : c));
    setCheckedIds(new Set());
  };

  const [showBulkTagPicker, setShowBulkTagPicker] = useState(false);
  const handleBulkAddTag = async (tag: string) => {
    const ids = [...checkedIds];
    await Promise.all(ids.map(id => {
      const contact = contacts.find(c => c.id === id);
      const currentTags = contact?.crm_tags || [];
      if (currentTags.includes(tag)) return Promise.resolve();
      return fetch(`/api/contacts?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crm_tags: [...currentTags, tag] }),
      });
    }));
    setContacts(prev => prev.map(c => checkedIds.has(c.id) ? { ...c, crm_tags: [...(c.crm_tags || []).filter(t => t !== tag), tag] } : c));
    setShowBulkTagPicker(false);
    setCheckedIds(new Set());
  };

  const [lastExportedAt] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('laruHP_contacts_last_export') : null
  );
  const [exportDone, setExportDone] = useState(false);

  const exportCsv = () => {
    const rows = [
      ['日時', '種別', 'サイト', '名前', 'メール', '電話', '内容', 'ステータス', 'タグ', 'メモ'],
      ...filtered.map(c => [
        new Date(c.created_at).toLocaleString('ja-JP'),
        c.type === 'booking' ? '予約' : '問い合わせ',
        siteName(c.site_id),
        c.name, c.email, c.phone || '',
        (c.message || '').replace(/\n/g, ' '),
        c.crm_status ? STATUS_CONFIG[c.crm_status as CrmStatus]?.label ?? c.crm_status : '新規',
        (c.crm_tags || []).join('|'),
        (c.crm_note || '').replace(/\n/g, ' '),
      ]),
    ];
    const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `contacts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    const now = new Date().toISOString();
    localStorage.setItem('laruHP_contacts_last_export', now);
    setExportDone(true);
    setTimeout(() => setExportDone(false), 2000);
  };

  const exportOverdue = lastExportedAt
    ? (Date.now() - new Date(lastExportedAt).getTime()) > 30 * 86400000
    : contacts.length > 0;

  const siteName = (id: string) => sites.find(s => s.id === id)?.name || '—';

  const [tagFilter, setTagFilter] = useState('');

  const filtered = contacts.filter(c =>
    (!siteFilter || c.site_id === siteFilter) &&
    (!typeFilter || c.type === typeFilter) &&
    (!statusFilter || (c.crm_status || 'new') === statusFilter) &&
    (!showOverdueOnly || (!!c.crm_followup_at && new Date(c.crm_followup_at) < new Date())) &&
    (!tagFilter || (c.crm_tags || []).includes(tagFilter)) &&
    (!searchQ || [c.name, c.email, c.message, c.phone].some(v => v?.toLowerCase().includes(searchQ.toLowerCase())))
  );

  const unreadCount = contacts.filter(c => !c.read).length;
  const byStatus = (s: CrmStatus) => contacts.filter(c => (c.crm_status || 'new') === s).length;

  const inputCls = 'w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500/60 transition-colors';

  return (
    <div className="min-h-screen bg-[#080f1e] text-white flex flex-col">
      {/* Realtime new contact toast */}
      {newContactToast && (
        <div className="fixed top-4 right-4 z-[100] flex items-center gap-3 bg-[#1e293b] border border-blue-500/40 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-2xl shadow-blue-900/30 animate-slideIn ring-1 ring-blue-500/20">
          <span className="relative flex-shrink-0">
            <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-40" />
            <span className="relative w-7 h-7 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-base">📬</span>
          </span>
          <div>
            <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide mb-0.5">新着問い合わせ</p>
            <p className="text-sm text-white">{newContactToast}</p>
          </div>
          <button onClick={() => setNewContactToast(null)} className="ml-2 text-slate-400 hover:text-white text-base leading-none flex-shrink-0">×</button>
        </div>
      )}
      {/* Header */}
      <header className="border-b border-white/[0.07] px-4 sm:px-6 py-3.5 flex items-center gap-3 flex-shrink-0">
        <Link href="/laruHP/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm transition-colors flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          ダッシュボード
        </Link>
        <h1 className="text-sm font-bold text-white">問い合わせ管理</h1>
        {unreadCount > 0 && (
          <button
            onClick={() => {
              const el = listRef.current?.querySelector('[data-unread="true"]') as HTMLElement | null;
              if (!el) return;
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              const id = el.getAttribute('data-contact-id');
              if (id) { setFlashId(id); setTimeout(() => setFlashId(null), 1200); }
            }}
            className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 hover:bg-blue-400 transition-colors"
          >{unreadCount}未読</button>
        )}
        <div className="flex-1" />
        <div className="relative flex-shrink-0">
          <button onClick={exportCsv} disabled={filtered.length === 0}
            className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-30 flex items-center gap-1 ${exportDone ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-white/[0.05] border-white/[0.1] text-slate-300 hover:bg-white/[0.1]'}`}>
            {exportDone ? '✓ DL完了' : filtered.length < contacts.length ? `絞込み結果CSV (${filtered.length}件)` : 'CSV出力'}
          </button>
          {exportOverdue && !exportDone && (
            <>
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />
              <p className="text-[9px] text-amber-400 mt-1 text-right whitespace-nowrap">30日以上未出力</p>
            </>
          )}
        </div>
      </header>

      {/* KPI row */}
      <div className="flex gap-3 px-4 sm:px-6 py-3 border-b border-white/[0.07] overflow-x-auto flex-shrink-0">
        {(Object.entries(STATUS_CONFIG) as [CrmStatus, typeof STATUS_CONFIG[CrmStatus]][]).map(([key, cfg]) => (
          <button key={key} onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
            aria-pressed={statusFilter === key}
            aria-label={`${cfg.label}でフィルター: ${byStatus(key)}件`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold flex-shrink-0 transition-all ${statusFilter === key ? cfg.bg + ' ' + cfg.color : 'bg-white/[0.03] border-white/[0.07] text-slate-400 hover:bg-white/[0.07]'}`}>
            <span>{cfg.label}</span>
            <span className={`font-bold ${cfg.color}`}>{byStatus(key)}</span>
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-slate-600 text-xs self-center flex-shrink-0">計{contacts.length}件</span>
      </div>

      {/* Insights bar */}
      {contacts.length > 0 && (() => {
        const closed = byStatus('done') + byStatus('lost');
        const closeRate = closed > 0 ? Math.round((byStatus('done') / closed) * 100) : null;
        const thisWeek = contacts.filter(c => Date.now() - new Date(c.created_at).getTime() < 7 * 86400000).length;
        const overdue = contacts.filter(c => c.crm_followup_at && new Date(c.crm_followup_at) < new Date()).length;
        return (
          <>
            <div className="flex gap-4 px-4 sm:px-6 py-2 border-b border-white/[0.07] overflow-x-auto flex-shrink-0">
              {closeRate !== null && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-slate-500">成約率</span>
                  <span className={`text-xs font-bold ${closeRate >= 50 ? 'text-green-400' : closeRate >= 30 ? 'text-amber-400' : 'text-slate-400'}`}>{closeRate}%</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[10px] text-slate-500">今週</span>
                <span className="text-xs font-bold text-sky-400">+{thisWeek}</span>
              </div>
              {overdue > 0 && (
                <button
                  onClick={() => setShowOverdueOnly(v => !v)}
                  className={`flex items-center gap-1.5 flex-shrink-0 px-2 py-0.5 rounded border transition-all ${showOverdueOnly ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'border-transparent text-red-400 hover:bg-red-500/10'}`}
                >
                  <span className="text-[10px] font-semibold">⏰ フォロー期限超過 {overdue}件</span>
                </button>
              )}
              {sites.length > 1 && (
                <button
                  onClick={() => setShowSiteBreakdown(v => !v)}
                  className={`ml-auto flex items-center gap-1 flex-shrink-0 text-[10px] px-2 py-0.5 rounded border transition-all ${showSiteBreakdown ? 'bg-sky-500/20 border-sky-500/40 text-sky-300' : 'border-white/10 text-slate-500 hover:text-slate-400'}`}
                >
                  サイト別を見る {showSiteBreakdown ? '▲' : '▼'}
                </button>
              )}
            </div>
            {showSiteBreakdown && sites.length > 1 && (
              <div className="flex gap-3 px-4 sm:px-6 py-2 border-b border-white/[0.07] overflow-x-auto flex-shrink-0 bg-white/[0.02]">
                {sites.map(site => {
                  const siteContacts = contacts.filter(c => c.site_id === site.id);
                  const siteNew = siteContacts.filter(c => (c.crm_status || 'new') === 'new').length;
                  return (
                    <button
                      key={site.id}
                      onClick={() => setSiteFilter(siteFilter === site.id ? '' : site.id)}
                      className={`flex items-center gap-2 flex-shrink-0 px-2.5 py-1 rounded-lg border text-[10px] transition-all ${siteFilter === site.id ? 'bg-sky-500/20 border-sky-500/30 text-sky-300' : 'bg-white/[0.03] border-white/[0.07] text-slate-400 hover:bg-white/[0.06]'}`}
                    >
                      <span className="font-semibold truncate max-w-[80px]">{site.name}</span>
                      <span className="text-slate-500">{siteContacts.length}件</span>
                      {siteNew > 0 && <span className="text-sky-400 font-bold">新{siteNew}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className={`${selected ? 'hidden sm:flex' : 'flex'} flex-col sm:w-80 w-full border-r border-white/[0.07] flex-shrink-0`}>
          {/* Search + filters */}
          <div className="p-3 border-b border-white/[0.07] space-y-2">
            <input
              type="text"
              placeholder="名前・メール・内容で検索..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') listRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="w-full bg-white/[0.05] border border-white/[0.07] rounded px-2.5 py-1.5 text-[11px] text-slate-300 placeholder-slate-400 outline-none focus:border-blue-500/50"
            />
            <div className="flex gap-2">
              <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}
                className="flex-1 bg-white/[0.05] border border-white/[0.07] rounded px-2 py-1.5 text-[11px] text-slate-300 outline-none">
                <option value="">全サイト</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="flex-1 bg-white/[0.05] border border-white/[0.07] rounded px-2 py-1.5 text-[11px] text-slate-300 outline-none">
                <option value="">全種類</option>
                <option value="contact">問い合わせ</option>
                <option value="booking">予約</option>
              </select>
            </div>
          </div>

          {/* Tag summary chips */}
          {(() => {
            const tagCounts = PRESET_TAGS.map(tag => ({
              tag,
              count: contacts.filter(c => (c.crm_tags || []).includes(tag)).length,
            })).filter(({ count }) => count > 0);
            if (tagCounts.length === 0) return null;
            return (
              <div className="border-b border-white/[0.07] px-3 py-2 flex flex-wrap gap-1">
                {tagCounts.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${tagFilter === tag ? 'bg-purple-500/30 border-purple-500/40 text-purple-300' : 'bg-white/[0.04] border-white/[0.07] text-slate-500 hover:border-purple-500/30 hover:text-purple-400'}`}
                  >
                    {tag} <span className="opacity-60">{count}</span>
                  </button>
                ))}
              </div>
            );
          })()}

          {/* Bulk action toolbar */}
          {checkedIds.size > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-sky-800/80 border-b border-sky-600/50 flex-shrink-0 flex-wrap relative">
              <span className="text-xs text-sky-300 font-semibold">{checkedIds.size}件選択中</span>
              <button onClick={() => handleBulkStatus('done')} className="text-[10px] bg-green-500/20 border border-green-500/30 text-green-300 px-2 py-1 rounded font-bold hover:bg-green-500/30 transition-all">✓ 対応済みに</button>
              <button onClick={() => handleBulkStatus('in_progress')} className="text-[10px] bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-1 rounded font-bold hover:bg-amber-500/30 transition-all">対応中に</button>
              <div className="relative">
                <button onClick={() => setShowBulkTagPicker(v => !v)} className="text-[10px] bg-purple-500/20 border border-purple-500/30 text-purple-300 px-2 py-1 rounded font-bold hover:bg-purple-500/30 transition-all">+ タグ付与</button>
                {showBulkTagPicker && (
                  <div className="absolute top-full left-0 mt-1 z-10 bg-[#1e293b] border border-white/10 rounded-xl p-2 shadow-xl flex flex-wrap gap-1 w-48">
                    {PRESET_TAGS.map(tag => (
                      <button key={tag} onClick={() => handleBulkAddTag(tag)} className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full hover:bg-purple-500/30 transition-all">{tag}</button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  const emails = [...checkedIds].map(id => contacts.find(c => c.id === id)?.email).filter(Boolean);
                  if (emails.length === 0) return;
                  const subject = encodeURIComponent('【ご連絡】');
                  window.location.href = `mailto:?bcc=${emails.join(',')}&subject=${subject}`;
                }}
                className="text-[10px] bg-sky-500/20 border border-sky-500/30 text-sky-300 px-2 py-1 rounded font-bold hover:bg-sky-500/30 transition-all"
                title="メールアプリが開き、選択中のアドレスがBCCに入ります"
              >✉ 一括メール</button>
              <button onClick={() => setCheckedIds(new Set())} className="text-[10px] text-slate-500 hover:text-slate-300 ml-auto transition-colors">✕ 解除</button>
            </div>
          )}

          {/* Select-all header */}
          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
              <label htmlFor="contacts-select-all" className="flex items-center gap-2 px-2 cursor-pointer min-h-[44px]">
                <input
                  id="contacts-select-all"
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every(c => checkedIds.has(c.id))}
                  ref={el => { if (el) el.indeterminate = checkedIds.size > 0 && !filtered.every(c => checkedIds.has(c.id)); }}
                  onChange={e => setCheckedIds(e.target.checked ? new Set(filtered.map(c => c.id)) : new Set())}
                  className="w-4 h-4 rounded accent-sky-500 cursor-pointer flex-shrink-0"
                  aria-label="全件選択"
                />
                <span className="text-[10px] text-slate-400">全選択</span>
              </label>
              {(searchQ || siteFilter || typeFilter || statusFilter || showOverdueOnly) && (
                <span className="text-[10px] text-slate-500 ml-auto">
                  <span className="text-slate-300 font-semibold">{filtered.length}</span>件 / {contacts.length}件中
                </span>
              )}
            </div>
          )}

          {/* List */}
          <div ref={listRef} className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-slate-600 text-sm">読み込み中...</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2">📭</div>
                <div className="text-slate-500 text-sm">{searchQ || statusFilter ? '該当なし' : 'まだ問い合わせがありません'}</div>
                {!searchQ && !statusFilter && !siteFilter && !typeFilter && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-slate-600">HPにお問い合わせフォームを設置しましょう</p>
                    <a href="/laruHP/builder" className="text-xs text-sky-500 hover:text-sky-400 underline underline-offset-2">
                      ビルダーでフォームを追加 →
                    </a>
                  </div>
                )}
              </div>
            ) : (
              filtered.map(c => {
                const status = (c.crm_status as CrmStatus) || 'new';
                const cfg = STATUS_CONFIG[status];
                return (
                  <div key={c.id} data-unread={!c.read ? 'true' : undefined} data-contact-id={c.id} className={`flex items-stretch border-b border-white/[0.05] transition-colors duration-300 ${flashId === c.id ? 'bg-yellow-400/10' : selected?.id === c.id ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}>
                    <div className="flex items-center px-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={checkedIds.has(c.id)}
                        onChange={e => setCheckedIds(prev => { const s = new Set(prev); e.target.checked ? s.add(c.id) : s.delete(c.id); return s; })}
                        className="w-3.5 h-3.5 rounded accent-sky-500 cursor-pointer" />
                    </div>
                    <button onClick={() => openDetail(c)} className="flex-1 text-left px-3 py-3 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${!c.read ? 'bg-blue-400 ring-2 ring-blue-400/30' : 'bg-transparent'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.type === 'booking' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                            {c.type === 'booking' ? '予約' : '問い合わせ'}
                          </span>
                          <span className="text-[10px] text-slate-600">{timeAgo(c.created_at)}</span>
                        </div>
                        <div className={`text-sm truncate ${c.read ? 'text-slate-400' : 'text-white font-semibold'}`}>{c.name}</div>
                        <div className="text-[11px] text-slate-600 truncate">{siteName(c.site_id)}</div>
                        {(c.crm_tags || []).length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {(c.crm_tags || []).slice(0, 2).map(t => (
                              <span key={t} className="text-[9px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">{t}</span>
                            ))}
                          </div>
                        )}
                        {c.crm_followup_at && (
                          <div className={`text-[9px] mt-1 ${new Date(c.crm_followup_at) < new Date() ? 'text-red-400' : 'text-amber-400'}`}>
                            📅 フォロー: {new Date(c.crm_followup_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                          </div>
                        )}
                      </div>
                    </div>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className={`${!selected ? 'hidden sm:flex' : 'flex'} flex-1 overflow-y-auto`}>
          {selected ? (
            <div className="p-4 sm:p-6 max-w-2xl w-full space-y-6">
              <button onClick={() => setSelected(null)} className="sm:hidden flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] transition-all px-3 py-1.5 rounded-lg">
                ← 一覧に戻る
              </button>

              {/* Contact info */}
              <div>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-1 rounded border ${STATUS_CONFIG[(selected.crm_status as CrmStatus) || 'new'].bg} ${STATUS_CONFIG[(selected.crm_status as CrmStatus) || 'new'].color}`}>
                    {STATUS_CONFIG[(selected.crm_status as CrmStatus) || 'new'].label}
                  </span>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${selected.type === 'booking' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                    {selected.type === 'booking' ? '予約リクエスト' : 'お問い合わせ'}
                  </span>
                  <span className="text-slate-500 text-xs">{new Date(selected.created_at).toLocaleString('ja-JP')}</span>
                </div>

                <table className="w-full text-sm mb-4">
                  <tbody>
                    {[
                      ['サイト', siteName(selected.site_id)],
                      ['お名前', selected.name],
                      ['メール', selected.email],
                      ['電話番号', selected.phone || '—'],
                    ].map(([label, value]) => (
                      <tr key={label} className="border-b border-white/[0.06]">
                        <td className="py-2.5 pr-4 text-slate-500 w-24 font-medium text-xs">{label}</td>
                        <td className="py-2.5 text-white text-sm">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {selected.message && (
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selected.message}
                    {selected.message.length > 100 && (
                      <div className="mt-3 pt-3 border-t border-white/[0.07]">
                        {aiSummary ? (
                          <div>
                            <p className="text-[10px] text-sky-400 font-semibold mb-1">✨ AI要約</p>
                            <p className="text-xs text-slate-300">{aiSummary}</p>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAiSummarize(selected.message!)}
                            disabled={aiSummarizing}
                            className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            {aiSummarizing ? (
                              <><svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>要約中...</>
                            ) : '✨ AIで要約'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Extra fields (from booking etc.) */}
                {selected.extra_fields && Object.keys(selected.extra_fields).filter(k => !k.startsWith('webhook')).length > 0 && (
                  <div className="mt-3 bg-white/[0.03] rounded-lg p-3 text-xs space-y-1.5">
                    {Object.entries(selected.extra_fields).filter(([k]) => !k.startsWith('webhook')).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-slate-500 w-24 flex-shrink-0">{k}</span>
                        <span className="text-slate-300">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CRM section */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">CRM管理</h3>

                {/* Status */}
                <div>
                  <label className="text-xs text-slate-500 mb-2 block">ステータス</label>
                  <div className="flex gap-2 flex-wrap">
                    {(Object.entries(STATUS_CONFIG) as [CrmStatus, typeof STATUS_CONFIG[CrmStatus]][]).map(([key, cfg]) => (
                      <button key={key} onClick={() => setEditStatus(key)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${editStatus === key ? cfg.bg + ' ' + cfg.color : 'bg-transparent border-white/[0.1] text-slate-500 hover:border-white/[0.2]'}`}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="text-xs text-slate-500 mb-2 block">タグ</label>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_TAGS.map(tag => (
                      <button key={tag} onClick={() => toggleTag(tag)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${editTags.includes(tag) ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-transparent border-white/[0.1] text-slate-500 hover:border-white/[0.2] hover:text-slate-400'}`}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Follow-up date */}
                <div>
                  <label className="text-xs text-slate-500 mb-2 block">フォローアップ日</label>
                  <input type="date" value={editFollowup} onChange={e => setEditFollowup(e.target.value)}
                    className={inputCls + ' text-xs'} />
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-1">
                      <span className="text-[9px] text-slate-600 font-semibold px-1">クイック</span>
                      {[3, 7, 14].map(d => {
                        const date = new Date(); date.setDate(date.getDate() + d);
                        const val = date.toISOString().split('T')[0];
                        return (
                          <button key={d} onClick={() => setEditFollowup(val)}
                            className="text-[10px] font-bold text-sky-400 bg-sky-500/10 hover:bg-sky-500/25 px-2 py-0.5 rounded-md transition-all">
                            +{d}日
                          </button>
                        );
                      })}
                    </div>
                    {editFollowup && (
                      <button onClick={() => setEditFollowup('')}
                        className="text-[10px] font-semibold text-slate-500 border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-2 py-0.5 rounded transition-all">
                        クリア
                      </button>
                    )}
                  </div>
                </div>

                {/* Note timeline */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-slate-500">対応履歴</label>
                    <div className="relative">
                      <button
                        onClick={() => setShowTemplateDropdown(v => !v)}
                        className="text-[10px] text-sky-400 border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 px-2 py-1 rounded-lg transition-all font-semibold"
                      >
                        テンプレートから挿入
                      </button>
                      {showTemplateDropdown && (
                        <div className="absolute right-0 top-7 z-30 w-64 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                          {replyTemplates.map((t: { id: string; label: string; body: string }, idx: number) => (
                            <button
                              key={t.id}
                              onClick={() => { setNewNoteEntry(n => n ? n + '\n' + t.body : t.body); setShowTemplateDropdown(false); }}
                              className="w-full text-left px-3 py-2.5 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-0 flex items-start justify-between gap-2"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-white">{t.label}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{t.body}</div>
                              </div>
                              {idx < 3 && (
                                <kbd className="text-[9px] text-slate-600 bg-white/[0.06] border border-white/10 px-1 py-0.5 rounded font-mono flex-shrink-0 mt-0.5">
                                  ⌘{idx + 1}
                                </kbd>
                              )}
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              const label = prompt('テンプレート名');
                              const body = prompt('テンプレート本文');
                              if (!label || !body) return;
                              const updated = [...replyTemplates, { id: Date.now().toString(), label, body }];
                              setReplyTemplates(updated);
                              localStorage.setItem(REPLY_TEMPLATES_KEY, JSON.stringify(updated));
                              setShowTemplateDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-[10px] text-sky-400 hover:bg-sky-500/10 transition-colors font-semibold"
                          >
                            ＋ テンプレートを追加
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Timeline bubbles */}
                  {editNote && (
                    <div className="mb-3 space-y-2 max-h-40 overflow-y-auto">
                      {editNote.split('\n---\n').filter(Boolean).reverse().map((entry, i) => {
                        const tsMatch = entry.match(/^\[([^\]]+)\]\s*/);
                        const ts = tsMatch ? tsMatch[1] : null;
                        const text = tsMatch ? entry.slice(tsMatch[0].length) : entry;
                        return (
                          <div key={i} className={`border rounded-xl px-3 py-2 ${i === 0 ? 'bg-sky-500/5 border-sky-500/20' : 'bg-white/[0.04] border-white/[0.07]'}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              {i === 0 && <span className="text-[8px] font-bold text-sky-400 bg-sky-500/15 px-1.5 py-0.5 rounded-full">最新</span>}
                              {ts && <p className="text-[9px] text-slate-600">{ts}</p>}
                            </div>
                            <p className="text-xs text-slate-300 whitespace-pre-wrap">{text}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* New entry */}
                  <div className="flex gap-2">
                    <textarea
                      value={newNoteEntry}
                      onChange={e => setNewNoteEntry(e.target.value)}
                      rows={2}
                      placeholder="新しい対応内容を追加..."
                      className={inputCls + ' resize-none flex-1'}
                    />
                    <button
                      onClick={() => {
                        if (!newNoteEntry.trim()) return;
                        const ts = new Date().toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        const entry = `[${ts}] ${newNoteEntry.trim()}`;
                        setEditNote(prev => prev ? entry + '\n---\n' + prev : entry);
                        setNewNoteEntry('');
                      }}
                      className="flex-shrink-0 text-xs bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 rounded-xl transition-colors"
                    >
                      追加
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={saveCrm} disabled={saving}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                    {saving ? '保存中...' : '保存'}
                  </button>
                  {saveMsg && <span className="text-green-400 text-xs">{saveMsg}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <a
                  href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.name}様の${selected.type === 'booking' ? 'ご予約' : 'お問い合わせ'}について`)}&body=${encodeURIComponent(`${selected.name} 様\n\n${replyTemplates[0]?.body || 'お問い合わせいただきありがとうございます。'}\n\n---\n元のメッセージ:\n${selected.message || ''}`)}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-white text-black text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-blue-50 transition-colors"
                  title="メールクライアントで返信">
                  ✉️ 返信する
                </a>
                <button
                  onClick={() => navigator.clipboard.writeText(selected.email)}
                  className="px-3 py-2.5 text-slate-400 hover:text-white border border-white/[0.07] hover:border-white/20 rounded-lg transition-colors text-xs"
                  title="メールアドレスをコピー"
                >
                  アドレスをコピー
                </button>
                <button onClick={() => deleteContact(selected.id)}
                  className="px-3 py-2.5 text-slate-500 hover:text-red-400 border border-white/[0.07] hover:border-red-500/30 rounded-lg transition-colors text-sm">
                  削除
                </button>
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex items-center justify-center h-full text-slate-600 text-sm">
              左のリストから問い合わせを選択してください
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
