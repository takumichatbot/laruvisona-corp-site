'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Member {
  id: string;
  email: string;
  name: string | null;
  plan: 'free' | 'paid';
  status: 'active' | 'inactive';
  created_at: string;
}
interface Site { id: string; name: string }

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

export default function MembersPage() {
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [delId, setDelId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/laruHP/auth/login?redirectTo=/laruHP/members'; return; }
      const { data } = await supabase.from('sites').select('id, name').eq('user_id', user.id);
      setSites(data ?? []);
      if (data && data.length > 0) setSiteId(prev => prev || data[0].id);
    } catch (e) { setErr((e as Error)?.message || '読み込み失敗'); }
    finally { setLoaded(true); }
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const loadMembers = useCallback(() => {
    if (!siteId) return;
    supabase.from('hp_members').select('id,email,name,plan,status,created_at').eq('site_id', siteId).order('created_at', { ascending: false })
      .then(({ data, error }) => { if (error) setErr(error.message); else setMembers((data as Member[]) ?? []); });
  }, [siteId, supabase]);
  useEffect(() => { loadMembers(); }, [loadMembers]);

  const remove = async (id: string) => {
    setDelId(null);
    setMembers(prev => prev.filter(m => m.id !== id));
    await fetch(`/api/hp/members/manage?memberId=${id}&siteId=${siteId}`, { method: 'DELETE' });
  };

  const exportCsv = () => {
    const rows = [['メール', '名前', 'プラン', '状態', '登録日'], ...members.map(m => [m.email, m.name || '', m.plan, m.status, fmt(m.created_at)])];
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `members_${siteId}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const paidCount = members.filter(m => m.plan === 'paid').length;

  if (!loaded) return <div className="min-h-screen bg-sky-50 flex items-center justify-center"><div className="text-gray-500 text-sm">読み込み中...</div></div>;

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-lg mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/laruHP/dashboard" className="text-gray-500 hover:text-gray-800 text-sm">← ダッシュボード</Link>
          <h1 className="font-bold">会員管理</h1>
          <div className="ml-auto flex items-center gap-2">
            {sites.length > 1 && (
              <select value={siteId} onChange={e => setSiteId(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {members.length > 0 && <button onClick={exportCsv} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 font-semibold">CSV出力</button>}
          </div>
        </div>
      </header>

      <main className="max-w-screen-lg mx-auto px-4 py-6">
        {err && <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{err}</p>}
        <div className="flex gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm"><span className="text-gray-400">会員数</span> <span className="font-bold ml-2">{members.length}</span></div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm"><span className="text-gray-400">有料会員</span> <span className="font-bold ml-2 text-amber-600">{paidCount}</span></div>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">👥</div>
            <p className="text-gray-500 text-sm font-semibold">まだ会員がいません</p>
            <p className="text-gray-400 text-xs mt-1">「会員限定」ブロックを公開すると、登録した会員がここに表示されます</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr><th className="text-left px-4 py-2.5">メール</th><th className="text-left px-4 py-2.5">名前</th><th className="text-left px-4 py-2.5">プラン</th><th className="text-left px-4 py-2.5">登録日</th><th className="px-4 py-2.5"></th></tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5">{m.email}</td>
                    <td className="px-4 py-2.5">{m.name || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.plan === 'paid' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{m.plan === 'paid' ? '有料' : '無料'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{fmt(m.created_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {delId === m.id ? (
                        <span className="text-xs">
                          <button onClick={() => remove(m.id)} className="text-red-600 font-bold mr-2">削除する</button>
                          <button onClick={() => setDelId(null)} className="text-gray-400">取消</button>
                        </span>
                      ) : (
                        <button onClick={() => setDelId(m.id)} className="text-gray-300 hover:text-red-500 text-sm">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
