'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type CRMStatus = '未対応' | '対応中' | '成約' | 'NG';

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

const COLUMNS: { id: CRMStatus; label: string; color: string; bg: string }[] = [
  { id: '未対応', label: '未対応', color: 'text-gray-700 bg-gray-50 border border-gray-200', bg: 'bg-gray-50' },
  { id: '対応中', label: '対応中', color: 'text-amber-700 bg-amber-50 border border-amber-200', bg: 'bg-amber-50/40' },
  { id: '成約', label: '成約 🎉', color: 'text-green-700 bg-green-50 border border-green-200', bg: 'bg-green-50/40' },
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

function getStatus(c: Contact): CRMStatus {
  return (c.extra_fields?.crm_status as CRMStatus) || '未対応';
}

export default function CRMPage() {
  const supabase = createClient();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteFilter, setSiteFilter] = useState('');
  const [selected, setSelected] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: sData }, { data: cData }] = await Promise.all([
      supabase.from('sites').select('id, name').eq('user_id', user.id),
      supabase.from('contacts').select('*').in('site_id', (await supabase.from('sites').select('id').eq('user_id', user.id)).data?.map(s => s.id) ?? []).order('created_at', { ascending: false }),
    ]);
    setSites(sData ?? []);
    setContacts(cData ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (contactId: string, status: CRMStatus) => {
    const c = contacts.find(x => x.id === contactId);
    if (!c) return;
    const newExtra = { ...(c.extra_fields || {}), crm_status: status };
    await supabase.from('contacts').update({ extra_fields: newExtra }).eq('id', contactId);
    setContacts(prev => prev.map(x => x.id === contactId ? { ...x, extra_fields: newExtra } : x));
    if (selected?.id === contactId) setSelected(s => s ? { ...s, extra_fields: newExtra } : s);
  };

  const filtered = siteFilter ? contacts.filter(c => c.site_id === siteFilter) : contacts;
  const grouped = COLUMNS.reduce<Record<CRMStatus, Contact[]>>((acc, col) => {
    acc[col.id] = filtered.filter(c => getStatus(c) === col.id);
    return acc;
  }, { '未対応': [], '対応中': [], '成約': [], 'NG': [] });

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <div className="border-b border-gray-200 bg-white backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/laruHP/dashboard" className="text-gray-600 hover:text-gray-900 text-sm">← ダッシュボード</Link>
          <h1 className="font-bold text-gray-900">CRM パイプライン</h1>
          <div className="ml-auto flex items-center gap-3">
            <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-sky-500">
              <option value="">すべてのサイト</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <span className="text-gray-500 text-sm">{filtered.length} 件</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-500">読み込み中...</div>
      ) : (
        <div className="max-w-screen-xl mx-auto px-4 py-6 overflow-x-auto">
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map(col => (
              <div key={col.id} className={`w-72 rounded-xl ${col.bg} border border-gray-200 flex flex-col`}>
                <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white rounded-t-xl`}>
                  <span className={`font-bold text-sm px-2 py-0.5 rounded-full ${col.color}`}>{col.label}</span>
                  <span className="text-gray-500 text-xs bg-gray-100 px-2 py-0.5 rounded-full">{grouped[col.id].length}</span>
                </div>
                <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-180px)]">
                  {grouped[col.id].length === 0 && (
                    <div className="text-gray-400 text-xs text-center py-8">なし</div>
                  )}
                  {grouped[col.id].map(c => (
                    <div
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="bg-white hover:bg-sky-50 border border-gray-200 rounded-xl p-3 cursor-pointer transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-semibold text-sm text-gray-900 truncate">{c.name}</span>
                        <span className="text-[10px] text-gray-500 whitespace-nowrap">{timeAgo(c.created_at)}</span>
                      </div>
                      <div className="text-xs text-gray-600 truncate">{c.email}</div>
                      {c.message && <div className="text-[11px] text-gray-500 mt-1.5 line-clamp-2">{c.message}</div>}
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {COLUMNS.filter(s => s.id !== col.id).map(s => (
                          <button
                            key={s.id}
                            onClick={e => { e.stopPropagation(); updateStatus(c.id, s.id); }}
                            className={`text-[10px] px-2 py-0.5 rounded-full border border-gray-200 hover:bg-sky-50 text-gray-600 transition-all`}
                          >
                            → {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-900 text-xl">×</button>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex gap-2"><span className="text-gray-500 w-20">メール</span><a href={`mailto:${selected.email}`} className="text-sky-600 hover:text-sky-500 hover:underline">{selected.email}</a></div>
              {selected.phone && <div className="flex gap-2"><span className="text-gray-500 w-20">電話</span><span className="text-gray-900">{selected.phone}</span></div>}
              {selected.message && <div className="flex gap-2"><span className="text-gray-500 w-20">内容</span><span className="text-gray-600 flex-1">{selected.message}</span></div>}
              <div className="flex gap-2"><span className="text-gray-500 w-20">日時</span><span className="text-gray-500 text-xs">{new Date(selected.created_at).toLocaleString('ja-JP')}</span></div>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <div className="text-gray-500 text-xs mb-2">ステータス変更</div>
              <div className="flex gap-2 flex-wrap">
                {COLUMNS.map(col => (
                  <button
                    key={col.id}
                    onClick={() => updateStatus(selected.id, col.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${getStatus(selected) === col.id ? `${col.color} border-gray-300` : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-sky-50'}`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <a href={`mailto:${selected.email}?subject=お問い合わせへのご返信`}
                className="w-full block text-center bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all">
                メールで返信する →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
