'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteFilter, setSiteFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [selected, setSelected] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editStatus, setEditStatus] = useState<CrmStatus>('new');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editNote, setEditNote] = useState('');
  const [editFollowup, setEditFollowup] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const router = useRouter();
  const supabase = createClient();

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

  const openDetail = useCallback(async (c: Contact) => {
    setSelected(c);
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
  };

  const siteName = (id: string) => sites.find(s => s.id === id)?.name || '—';

  const filtered = contacts.filter(c =>
    (!siteFilter || c.site_id === siteFilter) &&
    (!typeFilter || c.type === typeFilter) &&
    (!statusFilter || (c.crm_status || 'new') === statusFilter) &&
    (!searchQ || [c.name, c.email, c.message, c.phone].some(v => v?.toLowerCase().includes(searchQ.toLowerCase())))
  );

  const unreadCount = contacts.filter(c => !c.read).length;
  const byStatus = (s: CrmStatus) => contacts.filter(c => (c.crm_status || 'new') === s).length;

  const inputCls = 'w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500/60 transition-colors';

  return (
    <div className="min-h-screen bg-[#080f1e] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.07] px-4 sm:px-6 py-3.5 flex items-center gap-3 flex-shrink-0">
        <Link href="/laruHP/dashboard" className="text-slate-500 hover:text-slate-300 text-sm transition-colors flex-shrink-0">← ダッシュボード</Link>
        <h1 className="text-sm font-bold text-white">問い合わせ管理</h1>
        {unreadCount > 0 && (
          <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">{unreadCount}未読</span>
        )}
        <div className="flex-1" />
        <button onClick={exportCsv} disabled={filtered.length === 0}
          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.1] text-slate-300 hover:bg-white/[0.1] transition-colors disabled:opacity-30 flex-shrink-0">
          CSV
        </button>
      </header>

      {/* KPI row */}
      <div className="flex gap-3 px-4 sm:px-6 py-3 border-b border-white/[0.07] overflow-x-auto flex-shrink-0">
        {(Object.entries(STATUS_CONFIG) as [CrmStatus, typeof STATUS_CONFIG[CrmStatus]][]).map(([key, cfg]) => (
          <button key={key} onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold flex-shrink-0 transition-all ${statusFilter === key ? cfg.bg + ' ' + cfg.color : 'bg-white/[0.03] border-white/[0.07] text-slate-400 hover:bg-white/[0.07]'}`}>
            <span>{cfg.label}</span>
            <span className={`font-bold ${cfg.color}`}>{byStatus(key)}</span>
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-slate-600 text-xs self-center flex-shrink-0">計{contacts.length}件</span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className={`${selected ? 'hidden sm:flex' : 'flex'} flex-col sm:w-80 w-full border-r border-white/[0.07] flex-shrink-0`}>
          {/* Search + filters */}
          <div className="p-3 border-b border-white/[0.07] space-y-2">
            <input type="text" placeholder="名前・メール・内容で検索..." value={searchQ} onChange={e => setSearchQ(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.07] rounded px-2.5 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500/50" />
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

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-slate-600 text-sm">読み込み中...</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2">📭</div>
                <div className="text-slate-500 text-sm">{searchQ || statusFilter ? '該当なし' : 'まだ問い合わせがありません'}</div>
              </div>
            ) : (
              filtered.map(c => {
                const status = (c.crm_status as CrmStatus) || 'new';
                const cfg = STATUS_CONFIG[status];
                return (
                  <button key={c.id} onClick={() => openDetail(c)}
                    className={`w-full text-left px-4 py-3 border-b border-white/[0.05] transition-colors ${selected?.id === c.id ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}>
                    <div className="flex items-start gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${!c.read ? 'bg-blue-400' : 'bg-transparent'}`} />
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
                );
              })
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className={`${!selected ? 'hidden sm:flex' : 'flex'} flex-1 overflow-y-auto`}>
          {selected ? (
            <div className="p-4 sm:p-6 max-w-2xl w-full space-y-6">
              <button onClick={() => setSelected(null)} className="sm:hidden flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors">
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
                </div>

                {/* Note */}
                <div>
                  <label className="text-xs text-slate-500 mb-2 block">メモ（内部用）</label>
                  <textarea value={editNote} onChange={e => setEditNote(e.target.value)} rows={3}
                    placeholder="対応内容・備考など..." className={inputCls + ' resize-none'} />
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
                <a href={`mailto:${selected.email}?subject=Re: ${selected.type === 'booking' ? '予約について' : 'お問い合わせについて'}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-white text-black text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-blue-50 transition-colors">
                  ✉️ 返信する
                </a>
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
