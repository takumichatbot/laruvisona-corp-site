'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

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
}

interface Site {
  id: string;
  name: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteFilter, setSiteFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selected, setSelected] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/laruHP/auth/login'); return; }

      const [contactsRes, sitesRes] = await Promise.all([
        fetch('/api/contacts'),
        fetch('/api/sites'),
      ]);
      const { contacts: c } = await contactsRes.json();
      const { sites: s } = await sitesRes.json();
      setContacts(c || []);
      setSites(s || []);
      setLoading(false);
    })();
  }, []);

  const exportCsv = () => {
    const rows = [
      ['日時', '種別', 'サイト', '名前', 'メール', '電話', '内容'],
      ...filtered.map(c => [
        new Date(c.created_at).toLocaleString('ja-JP'),
        c.type === 'booking' ? '予約' : '問い合わせ',
        siteName(c.site_id),
        c.name,
        c.email,
        c.phone || '',
        (c.message || '').replace(/\n/g, ' '),
      ]),
    ];
    const bom = '﻿';
    const csv = bom + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const markRead = async (contact: Contact) => {
    if (contact.read) return;
    await fetch('/api/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contact.id, read: true }),
    });
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, read: true } : c));
  };

  const handleSelect = (c: Contact) => {
    setSelected(c);
    markRead(c);
  };

  const filtered = contacts.filter(c =>
    (!siteFilter || c.site_id === siteFilter) &&
    (!typeFilter || c.type === typeFilter)
  );
  const unreadCount = contacts.filter(c => !c.read).length;
  const siteName = (id: string) => sites.find(s => s.id === id)?.name || '—';

  return (
    <div className="min-h-screen bg-[#080f1e] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.07] px-6 py-4 flex items-center gap-4">
        <Link href="/laruHP/dashboard" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← ダッシュボード</Link>
        <div className="flex-1" />
        <h1 className="text-sm font-bold text-white">問い合わせ管理</h1>
        {unreadCount > 0 && (
          <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount}件 未読</span>
        )}
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.1] text-slate-300 hover:bg-white/[0.1] transition-colors disabled:opacity-30"
        >
          CSV出力
        </button>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Sidebar: list */}
        <div className="w-80 border-r border-white/[0.07] flex flex-col flex-shrink-0">
          {/* Filters */}
          <div className="p-3 border-b border-white/[0.07] flex gap-2">
            <select
              value={siteFilter}
              onChange={e => setSiteFilter(e.target.value)}
              className="flex-1 bg-white/[0.05] border border-white/[0.07] rounded px-2 py-1.5 text-[11px] text-slate-300 outline-none"
            >
              <option value="">全サイト</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="flex-1 bg-white/[0.05] border border-white/[0.07] rounded px-2 py-1.5 text-[11px] text-slate-300 outline-none"
            >
              <option value="">全種類</option>
              <option value="contact">問い合わせ</option>
              <option value="booking">予約</option>
            </select>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-slate-600 text-sm">読み込み中...</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2">📭</div>
                <div className="text-slate-500 text-sm">まだ問い合わせがありません</div>
              </div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className={`w-full text-left px-4 py-3 border-b border-white/[0.05] transition-colors ${
                    selected?.id === c.id ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!c.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />}
                    {c.read && <span className="w-1.5 h-1.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.type === 'booking' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                          {c.type === 'booking' ? '予約' : '問い合わせ'}
                        </span>
                        <span className="text-[10px] text-slate-600">{timeAgo(c.created_at)}</span>
                      </div>
                      <div className={`text-sm truncate ${c.read ? 'text-slate-400' : 'text-white font-semibold'}`}>{c.name}</div>
                      <div className="text-[11px] text-slate-600 truncate">{siteName(c.site_id)}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <div className="p-8 max-w-xl">
              <div className="flex items-center gap-3 mb-6">
                <span className={`text-xs font-bold px-2 py-1 rounded ${selected.type === 'booking' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                  {selected.type === 'booking' ? '予約リクエスト' : 'お問い合わせ'}
                </span>
                <span className="text-slate-500 text-sm">{new Date(selected.created_at).toLocaleString('ja-JP')}</span>
              </div>

              <table className="w-full text-sm mb-6">
                <tbody>
                  {[
                    ['サイト', siteName(selected.site_id)],
                    ['お名前', selected.name],
                    ['メール', selected.email],
                    ['電話番号', selected.phone || '—'],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-b border-white/[0.06]">
                      <td className="py-3 pr-4 text-slate-500 w-28 font-medium">{label}</td>
                      <td className="py-3 text-white">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selected.message && (
                <div>
                  <div className="text-slate-500 text-sm font-medium mb-2">内容</div>
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selected.message}
                  </div>
                </div>
              )}

              <a
                href={`mailto:${selected.email}?subject=Re: ${selected.type === 'booking' ? '予約について' : 'お問い合わせについて'}`}
                className="mt-6 inline-flex items-center gap-2 bg-white text-black text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                返信する →
              </a>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-600 text-sm">
              左のリストから選択してください
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
