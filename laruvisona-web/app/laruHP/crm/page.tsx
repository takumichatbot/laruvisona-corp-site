'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type CRMStatus = '未対応' | '対応中' | '成約' | 'NG';
type ViewMode = 'kanban' | 'list';

interface Contact {
  id: string;
  site_id: string;
  type: 'contact' | 'booking';
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  extra_fields: Record<string, string> | null;
  created_at: string;
}

interface Site { id: string; name: string }

const STATUS_ICONS: Record<CRMStatus, React.ReactNode> = {
  '未対応': <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>,
  '対応中': <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-9.82"/></svg>,
  '成約': <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  'NG': <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

const COLUMNS: { id: CRMStatus; label: string; color: string; bg: string }[] = [
  { id: '未対応', label: '未対応', color: 'text-gray-700 bg-gray-50 border border-gray-200', bg: 'bg-gray-50' },
  { id: '対応中', label: '対応中', color: 'text-amber-700 bg-amber-50 border border-amber-200', bg: 'bg-amber-50/40' },
  { id: '成約', label: '成約', color: 'text-green-700 bg-green-50 border border-green-200', bg: 'bg-green-50/40' },
  { id: 'NG', label: 'NG', color: 'text-red-700 bg-red-50 border border-red-200', bg: 'bg-red-50/30' },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isPast(dateStr: string) {
  return new Date(dateStr) < new Date();
}

function getStatus(c: Contact): CRMStatus {
  return (c.extra_fields?.crm_status as CRMStatus) || '未対応';
}

function statusBadge(status: CRMStatus) {
  const col = COLUMNS.find(c => c.id === status)!;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${col.color}`}>
      {STATUS_ICONS[status]}{col.label}
    </span>
  );
}

export default function CRMPage() {
  const supabase = createClient();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteFilter, setSiteFilter] = useState('');
  const [selected, setSelected] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

  // Bulk selection
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<CRMStatus>('対応中');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<CRMStatus | null>(null);

  // Detail panel state
  const [noteInput, setNoteInput] = useState('');
  const [followupInput, setFollowupInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyMsg, setReplyMsg] = useState('');

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const siteIds = (await supabase.from('sites').select('id').eq('user_id', user.id)).data?.map(s => s.id) ?? [];
    const [{ data: sData }, { data: cData }] = await Promise.all([
      supabase.from('sites').select('id, name').eq('user_id', user.id),
      supabase.from('contacts').select('*').in('site_id', siteIds).order('created_at', { ascending: false }),
    ]);
    setSites(sData ?? []);
    setContacts(cData ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // Default to list view on narrow screens
  useEffect(() => {
    if (window.innerWidth < 768) setViewMode('list');
  }, []);

  const openDetail = (c: Contact) => {
    setSelected(c);
    setNoteInput(c.extra_fields?.crm_note || '');
    setFollowupInput(c.extra_fields?.followup_at || '');
    setReplyText('');
    setReplyMsg('');
  };

  const updateExtra = async (contactId: string, patch: Record<string, string | null>) => {
    const c = contacts.find(x => x.id === contactId);
    if (!c) return;
    const newExtra = { ...(c.extra_fields || {}), ...patch };
    await supabase.from('contacts').update({ extra_fields: newExtra }).eq('id', contactId);
    setContacts(prev => prev.map(x => x.id === contactId ? { ...x, extra_fields: newExtra as Record<string, string> } : x));
    if (selected?.id === contactId) setSelected(s => s ? { ...s, extra_fields: newExtra as Record<string, string> } : s);
  };

  const [contractEmail, setContractEmail] = useState<Contact | null>(null);
  const [sendingContractEmail, setSendingContractEmail] = useState(false);
  const [contractEmailMsg, setContractEmailMsg] = useState('');

  // 成約確認モーダル
  const [pendingContractId, setPendingContractId] = useState<{ id: string; prevStatus: CRMStatus } | null>(null);

  // Kanbanドラッグ undo toast
  const [undoInfo, setUndoInfo] = useState<{ contactId: string; prevStatus: CRMStatus; name: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyStatusChange = async (contactId: string, status: CRMStatus) => {
    await updateExtra(contactId, { crm_status: status });
    if (status === '成約') {
      const c = contacts.find(x => x.id === contactId);
      if (c) setContractEmail(c);
    }
  };

  const updateStatus = (contactId: string, status: CRMStatus, prevStatus?: CRMStatus) => {
    if (status === '成約') {
      const prev = prevStatus ?? (getStatus(contacts.find(x => x.id === contactId)!) as CRMStatus);
      setPendingContractId({ id: contactId, prevStatus: prev });
      return;
    }
    void applyStatusChange(contactId, status);
  };

  const handleDragDrop = (contactId: string, newStatus: CRMStatus) => {
    const c = contacts.find(x => x.id === contactId);
    if (!c) return;
    const prev = getStatus(c) as CRMStatus;
    if (prev === newStatus) return;
    if (newStatus === '成約') {
      setPendingContractId({ id: contactId, prevStatus: prev });
      return;
    }
    void applyStatusChange(contactId, newStatus);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoInfo({ contactId, prevStatus: prev, name: c.name });
    undoTimer.current = setTimeout(() => setUndoInfo(null), 6000);
  };

  const applyBulkStatus = async () => {
    if (!checkedIds.size) return;
    setBulkLoading(true);
    await Promise.all([...checkedIds].map(id => updateStatus(id, bulkStatus)));
    setCheckedIds(new Set());
    setBulkLoading(false);
  };

  const toggleCheck = (id: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCheckAll = () => {
    if (checkedIds.size === filtered.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const saveNote = async () => {
    if (!selected) return;
    setSavingNote(true);
    await updateExtra(selected.id, { crm_note: noteInput, followup_at: followupInput });
    setSavingNote(false);
  };

  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSendingReply(true);
    setReplyMsg('');
    const res = await fetch('/api/crm/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: selected.id, message: replyText }),
    });
    const data = await res.json();
    if (res.ok) {
      setReplyMsg('送信しました');
      setReplyText('');
      await updateExtra(selected.id, { last_replied_at: new Date().toISOString() });
    } else {
      setReplyMsg(data.error || '送信に失敗しました');
    }
    setSendingReply(false);
  };

  const filtered = siteFilter ? contacts.filter(c => c.site_id === siteFilter) : contacts;
  const grouped = COLUMNS.reduce<Record<CRMStatus, Contact[]>>((acc, col) => {
    acc[col.id] = filtered.filter(c => getStatus(c) === col.id);
    return acc;
  }, { '未対応': [], '対応中': [], '成約': [], 'NG': [] });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisMonth = filtered.filter(c => c.created_at >= monthStart);
  const closedThisMonth = thisMonth.filter(c => getStatus(c) === '成約');
  const convRate = thisMonth.length > 0 ? Math.round((closedThisMonth.length / thisMonth.length) * 100) : 0;
  const todayFollowups = filtered.filter(c => c.extra_fields?.followup_at && isToday(c.extra_fields.followup_at));
  const overdueFollowups = filtered.filter(c => c.extra_fields?.followup_at && isPast(c.extra_fields.followup_at) && !isToday(c.extra_fields.followup_at) && getStatus(c) !== '成約' && getStatus(c) !== 'NG');

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      {/* 成約確認モーダル */}
      {pendingContractId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-2xl mb-2">🤝</div>
            <h2 className="font-bold text-gray-900 mb-2">成約にしますか？</h2>
            <p className="text-sm text-gray-500 mb-5">ステータスを「成約」に変更します。後からでも変更できます。</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const { id } = pendingContractId;
                  setPendingContractId(null);
                  void applyStatusChange(id, '成約');
                }}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm font-bold py-2.5 rounded-xl transition-all"
              >
                成約にする
              </button>
              <button onClick={() => setPendingContractId(null)} className="flex-1 border border-gray-200 text-gray-600 hover:text-gray-900 text-sm py-2.5 rounded-xl transition-all">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 成約時お礼メール送信モーダル */}
      {contractEmail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-2xl mb-2">🎉</div>
            <h2 className="font-bold text-gray-900 mb-1">成約おめでとうございます！</h2>
            <p className="text-xs text-gray-400 mb-1">ステータスを「成約」に変更しました</p>
            <p className="text-xs text-gray-500 mb-4">{contractEmail.name}さんへお礼メールを自動送信しますか？</p>
            {contractEmailMsg && (
              <p className={`text-xs font-semibold mb-3 ${contractEmailMsg.startsWith('エラー') ? 'text-red-600' : 'text-green-600'}`}>{contractEmailMsg}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setSendingContractEmail(true);
                  setContractEmailMsg('');
                  const res = await fetch('/api/crm/reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contactId: contractEmail.id,
                      message: `${contractEmail.name} 様\n\nこのたびはご成約いただき、誠にありがとうございます。\n今後ともよろしくお願いいたします。`,
                    }),
                  });
                  setSendingContractEmail(false);
                  if (res.ok) { setContractEmailMsg('送信しました'); setTimeout(() => setContractEmail(null), 1500); }
                  else setContractEmailMsg('エラー: 送信に失敗しました');
                }}
                disabled={sendingContractEmail}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm font-bold py-2.5 rounded-xl transition-all disabled:opacity-50"
              >
                {sendingContractEmail ? '送信中...' : 'お礼メールを送る'}
              </button>
              <button onClick={() => setContractEmail(null)} className="flex-1 border border-gray-200 text-gray-600 hover:text-gray-900 text-sm py-2.5 rounded-xl transition-all">
                スキップ
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="border-b border-gray-200 bg-white backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <Link href="/laruHP/dashboard" className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            ダッシュボード
          </Link>
          <h1 className="font-bold text-gray-900">CRM パイプライン</h1>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'kanban' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ボード
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                リスト
              </button>
            </div>
            <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-sky-500">
              <option value="">すべてのサイト</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <span className="text-gray-500 text-sm">{filtered.length} 件</span>
          </div>
        </div>
      </div>

      {/* Undo toast */}
      {undoInfo && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-xl">
          <span>{undoInfo.name} のステータスを変更しました</span>
          <button
            onClick={() => {
              if (undoTimer.current) clearTimeout(undoTimer.current);
              void applyStatusChange(undoInfo.contactId, undoInfo.prevStatus);
              setUndoInfo(null);
            }}
            className="font-bold text-sky-400 hover:text-sky-300 underline underline-offset-2"
          >
            元に戻す
          </button>
          <button onClick={() => { if (undoTimer.current) clearTimeout(undoTimer.current); setUndoInfo(null); }} className="text-gray-400 hover:text-white ml-1">✕</button>
        </div>
      )}
      {/* Stats strip */}
      <div className="max-w-screen-xl mx-auto px-4 pt-4 pb-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="text-xs text-gray-500 mb-1">今月の問い合わせ</div>
            <div className="text-2xl font-bold text-gray-900">{thisMonth.length}<span className="text-xs font-normal text-gray-400 ml-1">件</span></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="text-xs text-gray-500 mb-1">今月の成約</div>
            <div className="text-2xl font-bold text-green-600">{closedThisMonth.length}<span className="text-xs font-normal text-gray-400 ml-1">件</span></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="text-xs text-gray-500 mb-1">成約率</div>
            <div className="text-2xl font-bold text-gray-900">{convRate}<span className="text-xs font-normal text-gray-400 ml-1">%</span></div>
          </div>
          <div className={`border rounded-xl px-4 py-3 ${overdueFollowups.length > 0 ? 'bg-red-50 border-red-200' : todayFollowups.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
            <div className="text-xs text-gray-500 mb-1">フォローアップ</div>
            <div className={`text-2xl font-bold ${overdueFollowups.length > 0 ? 'text-red-600' : todayFollowups.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {todayFollowups.length + overdueFollowups.length}
              <span className="text-xs font-normal text-gray-400 ml-1">件</span>
            </div>
            {overdueFollowups.length > 0 && <div className="text-[10px] text-red-500 mt-0.5">期限超過 {overdueFollowups.length}件</div>}
            {overdueFollowups.length === 0 && todayFollowups.length > 0 && <div className="text-[10px] text-amber-600 mt-0.5">本日期限 {todayFollowups.length}件</div>}
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {checkedIds.size > 0 && (
        <div className="max-w-screen-xl mx-auto px-4 pb-2">
          <div className="bg-sky-900 text-white rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold">{checkedIds.size} 件選択中</span>
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value as CRMStatus)}
              className="bg-sky-800 border border-sky-700 text-white rounded-lg px-3 py-1.5 text-sm outline-none"
            >
              {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
            </select>
            <button
              onClick={applyBulkStatus}
              disabled={bulkLoading}
              className="bg-white text-sky-900 font-bold text-sm px-4 py-1.5 rounded-lg hover:bg-sky-50 disabled:opacity-50 transition-all"
            >
              {bulkLoading ? '適用中...' : '一括変更'}
            </button>
            <button
              onClick={() => setCheckedIds(new Set())}
              className="ml-auto text-sky-300 hover:text-white text-sm"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-500">読み込み中...</div>
      ) : viewMode === 'kanban' ? (
        /* Kanban view */
        <div className="max-w-screen-xl mx-auto px-4 py-4 overflow-x-auto">
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map(col => (
              <div
                key={col.id}
                className={`w-full md:w-72 rounded-xl ${col.bg} flex flex-col transition-all ${dragOverCol === col.id ? 'ring-2 ring-sky-400 border-sky-400 bg-sky-50/60 scale-[1.01]' : 'border border-gray-200'}`}
                onDragOver={e => { e.preventDefault(); setDragOverCol(col.id); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOverCol(null);
                  const contactId = e.dataTransfer.getData('contactId');
                  if (contactId) handleDragDrop(contactId, col.id);
                }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white rounded-t-xl">
                  <span className={`font-bold text-sm px-2 py-0.5 rounded-full ${col.color}`}>{col.label}</span>
                  <span className="text-gray-500 text-xs bg-gray-100 px-2 py-0.5 rounded-full">{grouped[col.id].length}</span>
                </div>
                <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-260px)]">
                  {grouped[col.id].length === 0 && (
                    <div className="text-gray-400 text-xs text-center py-8">なし</div>
                  )}
                  {grouped[col.id].map(c => {
                    const followup = c.extra_fields?.followup_at;
                    const hasNote = !!c.extra_fields?.crm_note;
                    const followupOverdue = followup && isPast(followup) && !isToday(followup);
                    const followupToday = followup && isToday(followup);
                    const isRecent24h = Date.now() - new Date(c.created_at).getTime() < 86400000;
                    return (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData('contactId', c.id); e.dataTransfer.effectAllowed = 'move'; }}
                        onClick={() => openDetail(c)}
                        className={`bg-white hover:bg-sky-50 border border-gray-200 rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all shadow-sm ${isRecent24h ? 'border-l-4 border-l-amber-400' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-semibold text-sm text-gray-900 truncate">{c.name}</span>
                          <span className="text-[10px] text-gray-500 whitespace-nowrap">{timeAgo(c.created_at)}</span>
                        </div>
                        <div className="text-xs text-gray-600 truncate">{c.email}</div>
                        {c.message && <div className="text-[11px] text-gray-500 mt-1.5 line-clamp-2">{c.message}</div>}
                        <div className="mt-2 flex gap-1 flex-wrap items-center">
                          {followup && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${followupOverdue ? 'bg-red-50 border border-red-200 text-red-600' : followupToday ? 'bg-amber-50 border border-amber-200 text-amber-600' : 'bg-sky-50 border border-sky-200 text-sky-600'}`}>
                              {followupOverdue ? '⚠ 期限超過' : followupToday ? '● 本日'  : '📅'} {new Date(followup).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                            </span>
                          )}
                          {hasNote && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">📝</span>}
                        </div>
                        <div className="mt-2 flex gap-1 flex-wrap">
                          {COLUMNS.filter(s => s.id !== col.id).map(s => (
                            <button
                              key={s.id}
                              onClick={e => { e.stopPropagation(); updateStatus(c.id, s.id); }}
                              className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 hover:bg-sky-50 text-gray-600 transition-all"
                            >
                              → {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* List view */
        <div className="max-w-screen-xl mx-auto px-4 py-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50 text-xs text-gray-500 font-medium">
              <input
                type="checkbox"
                checked={checkedIds.size === filtered.length && filtered.length > 0}
                onChange={toggleCheckAll}
                className="w-4 h-4 rounded text-sky-600 accent-sky-600"
              />
              <span>名前・連絡先</span>
              <span className="hidden sm:block">内容</span>
              <span>ステータス</span>
              <span>日時</span>
            </div>
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">問い合わせがありません</div>
            ) : (
              filtered.map((c, idx) => {
                const status = getStatus(c);
                const followup = c.extra_fields?.followup_at;
                const followupOverdue = followup && isPast(followup) && !isToday(followup) && status !== '成約' && status !== 'NG';
                const isRecent24h = Date.now() - new Date(c.created_at).getTime() < 86400000;
                return (
                  <div
                    key={c.id}
                    className={`grid grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-sky-50 transition-all cursor-pointer ${checkedIds.has(c.id) ? 'bg-sky-50' : idx % 2 === 1 ? 'bg-gray-50/60' : ''} ${isRecent24h ? 'border-l-4 border-l-amber-400' : ''}`}
                    onClick={() => openDetail(c)}
                  >
                    <input
                      type="checkbox"
                      checked={checkedIds.has(c.id)}
                      onChange={e => toggleCheck(c.id, e)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 rounded text-sky-600 accent-sky-600"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-gray-900 truncate">{c.name}</div>
                      <div className="text-xs text-gray-500 truncate">{c.email}</div>
                      {c.phone && <div className="text-xs text-gray-400 truncate">{c.phone}</div>}
                      {followupOverdue && <span className="text-[10px] text-red-500">⚠ フォロー期限超過</span>}
                    </div>
                    <div className="hidden sm:block text-xs text-gray-500 line-clamp-2 min-w-0">{c.message || '—'}</div>
                    <div onClick={e => e.stopPropagation()}>
                      <select
                        value={status}
                        onChange={e => updateStatus(c.id, e.target.value as CRMStatus)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:border-sky-500 text-gray-700"
                      >
                        {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
                      </select>
                    </div>
                    <div className="text-[11px] text-gray-400 whitespace-nowrap text-right">{timeAgo(c.created_at)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-gray-900">{selected.name}</h2>
                {statusBadge(getStatus(selected))}
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-900 text-xl">×</button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">メール</span><a href={`mailto:${selected.email}`} className="text-sky-600 hover:underline break-all">{selected.email}</a></div>
                {selected.phone && <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">電話</span><span>{selected.phone}</span></div>}
                {selected.message && <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">内容</span><span className="text-gray-700 flex-1">{selected.message}</span></div>}
                <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">日時</span><span className="text-gray-500 text-xs">{new Date(selected.created_at).toLocaleString('ja-JP')}</span></div>
                {selected.extra_fields?.last_replied_at && (
                  <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">最終返信</span><span className="text-gray-500 text-xs">{new Date(selected.extra_fields.last_replied_at).toLocaleString('ja-JP')}</span></div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="text-gray-500 text-xs mb-2">ステータス</div>
                <div className="flex gap-2 flex-wrap">
                  {COLUMNS.map(col => (
                    <button
                      key={col.id}
                      onClick={() => updateStatus(selected.id, col.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${getStatus(selected) === col.id ? `${col.color}` : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-sky-50'}`}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="text-gray-500 text-xs mb-1">メモ・フォローアップ</div>
                <textarea
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="社内メモ（顧客には表示されません）"
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-sky-500 resize-none"
                />
                <div className="flex gap-2 items-center">
                  <label className="text-xs text-gray-500 shrink-0">フォローアップ日</label>
                  <input
                    type="date"
                    value={followupInput}
                    onChange={e => setFollowupInput(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-sky-500"
                  />
                  {followupInput && (
                    <button onClick={() => setFollowupInput('')} className="text-gray-400 hover:text-gray-600 text-sm">×</button>
                  )}
                </div>
                <button
                  onClick={saveNote}
                  disabled={savingNote}
                  className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-sm transition-all"
                >
                  {savingNote ? '保存中...' : 'メモを保存'}
                </button>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="text-gray-500 text-xs mb-1">メール返信</div>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={`${selected.name} 様へのご返信内容を入力...`}
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-sky-500 resize-none"
                />
                {replyMsg && (
                  <p className={`text-xs ${replyMsg === '送信しました' ? 'text-emerald-600' : 'text-red-600'}`}>{replyMsg}</p>
                )}
                <button
                  onClick={sendReply}
                  disabled={sendingReply || !replyText.trim()}
                  className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-sm transition-all"
                >
                  {sendingReply ? '送信中...' : `${selected.email} へ送信する →`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
