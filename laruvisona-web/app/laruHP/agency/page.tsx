'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type LarubotPlan = 'lite' | 'starter' | 'pro' | 'laru-cloud';

const LARUBOT_PLANS: { id: LarubotPlan; label: string; desc: string; color: string }[] = [
  { id: 'lite',       label: 'Lite',       desc: '基本チャット・シンプルなFAQ対応',       color: 'text-slate-300 bg-slate-700 border-slate-600' },
  { id: 'starter',    label: 'Starter',    desc: 'カスタム対応・基本分析・週次レポート',   color: 'text-blue-300 bg-blue-900/40 border-blue-700' },
  { id: 'pro',        label: 'Pro',        desc: '高度な分析・優先サポート・多言語対応',   color: 'text-purple-300 bg-purple-900/40 border-purple-700' },
  { id: 'laru-cloud', label: 'LARU Cloud', desc: '完全カスタム・専任担当・SLA保証',        color: 'text-amber-300 bg-amber-900/40 border-amber-700' },
];

interface Site {
  id: string;
  name: string;
  slug: string | null;
  published: boolean;
  view_count: number;
  updated_at: string;
  created_at: string;
  data: {
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    clientNote?: string;
  } | null;
  settings_json: {
    larubot?: boolean;
    larubotPublicId?: string;
    larubotPlan?: LarubotPlan;
  } | null;
}

interface Contact { id: string; site_id: string; read: boolean; created_at: string }

type SortKey = 'updated' | 'name' | 'views' | 'contacts';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
}

export default function AgencyPage() {
  const supabase = createClient();
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [filterPublished, setFilterPublished] = useState<'all' | 'published' | 'draft'>('all');
  const [selected, setSelected] = useState<Site | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ clientName: '', clientEmail: '', clientPhone: '', clientNote: '' });
  const [saving, setSaving] = useState(false);
  const [larubotTarget, setLarubotTarget] = useState<Site | null>(null);
  const [larubotPlan, setLarubotPlan] = useState<LarubotPlan>('lite');
  const [larubotClientEmail, setLarubotClientEmail] = useState('');
  const [larubotLoading, setLarubotLoading] = useState(false);
  const [larubotError, setLarubotError] = useState('');
  const [copiedEmbedId, setCopiedEmbedId] = useState<string | null>(null);

  // Affiliate/referral state
  const [refStats, setRefStats] = useState<{
    referralUrl: string;
    total: number;
    active: number;
    totalCommissionMonthly: number;
    referrals: { id: string; plan: string; status: string; joinedAt: string; commission: number }[];
  } | null>(null);
  const [refCopied, setRefCopied] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/laruHP/auth/login?redirectTo=/laruHP/agency'); return; }

    const isAdmin = !!process.env.NEXT_PUBLIC_ADMIN_EMAIL && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (!isAdmin) {
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
      if (profile?.plan !== 'agency') {
        router.replace('/laruHP/plans#agency');
        return;
      }
    }

    const [{ data: sData }, { data: cData }] = await Promise.all([
      supabase.from('sites').select('id, name, slug, published, view_count, updated_at, created_at, data, settings_json').eq('user_id', user.id),
      supabase.from('contacts').select('id, site_id, read, created_at').in('site_id',
        (await supabase.from('sites').select('id').eq('user_id', user.id)).data?.map(s => s.id) ?? []
      ),
    ]);
    setSites(sData ?? []);
    setContacts(cData ?? []);
    setLoading(false);

    // Load referral stats
    fetch('/api/referral/stats').then(r => r.json()).then(d => {
      if (!d.error) setRefStats(d);
    }).catch(() => {});
  }, [supabase, router]);

  useEffect(() => { load(); }, [load]);

  const saveClientInfo = async () => {
    if (!selected) return;
    setSaving(true);
    const newData = { ...(selected.data ?? {}), ...editForm };
    await supabase.from('sites').update({ data: newData }).eq('id', selected.id);
    setSites(prev => prev.map(s => s.id === selected.id ? { ...s, data: newData } : s));
    setSelected(s => s ? { ...s, data: newData } : s);
    setSaving(false);
    setEditMode(false);
  };

  const setupLarubot = async () => {
    if (!larubotTarget) return;
    setLarubotLoading(true);
    setLarubotError('');
    try {
      const res = await fetch('/api/larubot/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: larubotTarget.id, plan: larubotPlan, client_email: larubotClientEmail.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setLarubotError(data.error || 'エラーが発生しました'); return; }
      // Optimistically update local state
      setSites(prev => prev.map(s => s.id === larubotTarget.id
        ? { ...s, settings_json: { ...(s.settings_json ?? {}), larubotPlan, larubot: true } }
        : s
      ));
      setLarubotTarget(null);
    } catch {
      setLarubotError('接続エラーが発生しました');
    } finally {
      setLarubotLoading(false);
    }
  };

  const contactsForSite = (siteId: string) => contacts.filter(c => c.site_id === siteId);
  const unreadForSite = (siteId: string) => contacts.filter(c => c.site_id === siteId && !c.read).length;

  const sorted = [...sites]
    .filter(s => filterPublished === 'all' ? true : filterPublished === 'published' ? s.published : !s.published)
    .sort((a, b) => {
      if (sortKey === 'updated') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (sortKey === 'name') return (a.data?.clientName || a.name).localeCompare(b.data?.clientName || b.name, 'ja');
      if (sortKey === 'views') return b.view_count - a.view_count;
      if (sortKey === 'contacts') return contactsForSite(b.id).length - contactsForSite(a.id).length;
      return 0;
    });

  const totalViews = sites.reduce((acc, s) => acc + (s.view_count || 0), 0);
  const totalContacts = contacts.length;
  const publishedCount = sites.filter(s => s.published).length;

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <div className="border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/laruHP/dashboard" className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            ダッシュボード
          </Link>
          <h1 className="font-bold text-white">エージェンシー管理</h1>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/laruHP/builder/new"
              className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-all">
              + 新規クライアントサイト
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'クライアント数', value: sites.length, icon: '👥' },
            { label: '公開中', value: publishedCount, icon: '🌐' },
            { label: '総PV', value: totalViews.toLocaleString(), icon: '👁️' },
            { label: '総問い合わせ', value: totalContacts, icon: '✉️' },
          ].map(stat => (
            <div key={stat.label} className="bg-[#1e293b] border border-white/10 rounded-xl p-4">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-slate-500 text-xs">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
            {(['all', 'published', 'draft'] as const).map(f => (
              <button key={f} onClick={() => setFilterPublished(f)}
                className={`text-xs px-3 py-1 rounded-md transition-all ${filterPublished === f ? 'bg-white/20 text-white' : 'text-slate-500 hover:text-white'}`}>
                {f === 'all' ? 'すべて' : f === 'published' ? '公開中' : '下書き'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs">並び替え:</span>
            <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
              className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-xs text-white outline-none">
              <option value="updated">最終更新</option>
              <option value="name">クライアント名</option>
              <option value="views">PV数</option>
              <option value="contacts">問い合わせ数</option>
            </select>
          </div>
          <span className="text-slate-600 text-xs ml-auto">{sorted.length} サイト</span>
        </div>

        {loading ? (
          <div className="text-center text-slate-500 py-24">読み込み中...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map(site => {
              const siteContacts = contactsForSite(site.id);
              const unread = unreadForSite(site.id);
              const clientName = site.data?.clientName;
              return (
                <div key={site.id} className="bg-[#1e293b] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all group">
                  {/* Card header */}
                  <div className="px-5 pt-5 pb-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        {clientName && (
                          <div className="text-slate-400 text-xs mb-0.5">{clientName}</div>
                        )}
                        <div className="font-bold text-white">{site.name}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${site.published ? 'bg-green-900/40 text-green-400 border border-green-500/30' : 'bg-white/5 text-slate-500 border border-white/10'}`}>
                        {site.published ? '公開中' : '下書き'}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>👁️ {(site.view_count || 0).toLocaleString()} PV</span>
                      <span className={unread > 0 ? 'text-blue-400 font-semibold' : ''}>
                        ✉️ {siteContacts.length}{unread > 0 ? ` (未読${unread})` : ''}
                      </span>
                      {site.settings_json?.larubot && (
                        <span className="text-indigo-400 font-medium">
                          🤖 LARUbot {site.settings_json.larubotPlan ? `(${LARUBOT_PLANS.find(p => p.id === site.settings_json?.larubotPlan)?.label ?? site.settings_json.larubotPlan})` : ''}
                        </span>
                      )}
                      {site.settings_json?.larubotPublicId && (
                        <button
                          onClick={() => {
                            const code = `<script src="https://larubot.tokyo/static/embed.js" data-public-id="${site.settings_json!.larubotPublicId}" defer><\/script>`;
                            navigator.clipboard.writeText(code);
                            setCopiedEmbedId(site.id);
                            setTimeout(() => setCopiedEmbedId(null), 2000);
                          }}
                          className="text-emerald-400 hover:text-emerald-300 text-[10px] underline underline-offset-2 transition-colors"
                        >
                          {copiedEmbedId === site.id ? '✓ コピー済み' : '埋め込みコードをコピー'}
                        </button>
                      )}
                    </div>

                    <div className="text-slate-600 text-[11px] mt-1.5">更新 {timeAgo(site.updated_at)}</div>
                  </div>

                  {/* Actions */}
                  <div className="border-t border-white/5 px-5 py-3 flex items-center gap-2 flex-wrap">
                    <Link href={`/laruHP/builder?siteId=${site.id}`}
                      className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      編集
                    </Link>
                    {site.published && site.slug && (
                      <a href={`/hp/${site.slug}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        閲覧
                      </a>
                    )}
                    <Link href={`/laruHP/contacts?siteId=${site.id}`}
                      className="relative text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-1">
                      ✉️ 問い合わせ
                      {unread > 0 && (
                        <span className="bg-blue-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{unread}</span>
                      )}
                    </Link>
                    <button
                      onClick={() => { setLarubotTarget(site); setLarubotPlan(site.settings_json?.larubotPlan ?? 'lite'); setLarubotClientEmail(site.data?.clientEmail ?? ''); setLarubotError(''); }}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${site.settings_json?.larubot ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-700 hover:bg-indigo-900/60' : 'bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white'}`}>
                      🤖 {site.settings_json?.larubot ? 'LARUbot変更' : 'LARUbot設定'}
                    </button>
                    <button onClick={() => { setSelected(site); setEditForm({ clientName: site.data?.clientName ?? '', clientEmail: site.data?.clientEmail ?? '', clientPhone: site.data?.clientPhone ?? '', clientNote: site.data?.clientNote ?? '' }); setEditMode(false); }}
                      className="text-xs px-3 py-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all ml-auto">
                      詳細 →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LARUbot plan modal */}
      {larubotTarget && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setLarubotTarget(null)}>
          <div className="bg-[#1e293b] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-white">LARUbot プラン設定</h2>
              <button onClick={() => setLarubotTarget(null)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <p className="text-slate-400 text-xs mb-5">
              {larubotTarget.data?.clientName || larubotTarget.name} に適用するLARUbotのプランを選択してください。
            </p>
            <div className="space-y-2 mb-5">
              {LARUBOT_PLANS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setLarubotPlan(p.id)}
                  className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3 transition-all text-left ${larubotPlan === p.id ? p.color + ' border-opacity-100' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${larubotPlan === p.id ? 'border-current' : 'border-slate-600'}`}>
                    {larubotPlan === p.id && <div className="w-2 h-2 rounded-full bg-current" />}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-white">{p.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{p.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mb-4">
              <label className="text-slate-400 text-xs block mb-1.5">クライアントのメールアドレス <span className="text-slate-500">（ログイン招待メールを送信）</span></label>
              <input
                type="email"
                value={larubotClientEmail}
                onChange={e => setLarubotClientEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition-colors placeholder-slate-600"
              />
              <p className="text-slate-500 text-[11px] mt-1">入力するとクライアントにパスワード設定メールが届きます</p>
            </div>
            {larubotError && <p className="text-red-400 text-xs mb-3">{larubotError}</p>}
            <div className="flex gap-2">
              <button
                onClick={setupLarubot}
                disabled={larubotLoading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50"
              >
                {larubotLoading ? '設定中...' : '設定する'}
              </button>
              <button onClick={() => setLarubotTarget(null)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl text-sm transition-all">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail / edit modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-[#1e293b] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                {selected.data?.clientName && <div className="text-slate-400 text-xs">{selected.data.clientName}</div>}
                <h2 className="font-bold text-white text-lg">{selected.name}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>

            {editMode ? (
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-slate-400 text-xs block mb-1">クライアント名</label>
                  <input type="text" value={editForm.clientName} onChange={e => setEditForm(f => ({ ...f, clientName: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none"
                    placeholder="例：山田商店" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">クライアントメール</label>
                  <input type="email" value={editForm.clientEmail} onChange={e => setEditForm(f => ({ ...f, clientEmail: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none"
                    placeholder="client@example.com" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">電話番号</label>
                  <input type="tel" value={editForm.clientPhone} onChange={e => setEditForm(f => ({ ...f, clientPhone: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none"
                    placeholder="090-0000-0000" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">メモ</label>
                  <textarea value={editForm.clientNote} onChange={e => setEditForm(f => ({ ...f, clientNote: e.target.value }))}
                    rows={3}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none"
                    placeholder="契約内容、特記事項など" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveClientInfo} disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50">
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl text-sm transition-all">
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm mb-4">
                {[
                  { label: 'クライアント名', value: selected.data?.clientName || '未設定' },
                  { label: 'メール', value: selected.data?.clientEmail || '未設定', link: selected.data?.clientEmail ? `mailto:${selected.data.clientEmail}` : undefined },
                  { label: '電話', value: selected.data?.clientPhone || '未設定' },
                  { label: 'ステータス', value: selected.published ? '公開中' : '下書き' },
                  { label: 'PV数', value: (selected.view_count || 0).toLocaleString() },
                  { label: '作成日', value: new Date(selected.created_at).toLocaleDateString('ja-JP') },
                ].map(row => (
                  <div key={row.label} className="flex gap-2">
                    <span className="text-slate-500 w-28 flex-shrink-0">{row.label}</span>
                    {row.link ? (
                      <a href={row.link} className="text-blue-400 hover:underline">{row.value}</a>
                    ) : (
                      <span className="text-slate-300">{row.value}</span>
                    )}
                  </div>
                ))}
                {selected.data?.clientNote && (
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-28 flex-shrink-0">メモ</span>
                    <span className="text-slate-300 flex-1 whitespace-pre-wrap text-xs">{selected.data.clientNote}</span>
                  </div>
                )}
                <button onClick={() => setEditMode(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-1">クライアント情報を編集 →</button>
              </div>
            )}

            {!editMode && (
              <div className="border-t border-white/10 pt-4 flex gap-2 flex-wrap">
                <Link href={`/laruHP/builder?siteId=${selected.id}`}
                  className="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all">
                  サイトを編集
                </Link>
                <Link href={`/laruHP/contacts?siteId=${selected.id}`}
                  className="flex-1 text-center bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl text-sm transition-all">
                  問い合わせ確認
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Affiliate / Referral Section ── */}
      {refStats && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 border-t border-white/[0.07]">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">📣 紹介プログラム</h2>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 text-center">
              <div className="text-2xl font-black text-white">{refStats.total}</div>
              <div className="text-xs text-slate-500 mt-0.5">紹介した人数</div>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 text-center">
              <div className="text-2xl font-black text-green-400">{refStats.active}</div>
              <div className="text-xs text-slate-500 mt-0.5">現在の有効契約</div>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 text-center">
              <div className="text-2xl font-black text-sky-400">¥{refStats.totalCommissionMonthly.toLocaleString()}</div>
              <div className="text-xs text-slate-500 mt-0.5">月間コミッション（20%）</div>
            </div>
          </div>

          {/* Referral link */}
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 mb-6">
            <div className="text-xs font-bold text-slate-400 mb-2">あなたの紹介リンク</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-2 font-mono text-xs text-slate-300 truncate">
                {refStats.referralUrl}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(refStats.referralUrl);
                  setRefCopied(true);
                  setTimeout(() => setRefCopied(false), 2000);
                }}
                className="flex-shrink-0 text-xs font-bold px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
              >
                {refCopied ? '✓ コピー' : 'コピー'}
              </button>
            </div>
            <p className="text-[10px] text-slate-600 mt-2">
              このリンクから登録した方が契約すると、月額の20%をクレジットとして毎月還元します。
            </p>
          </div>

          {/* Referral list */}
          {refStats.referrals.length > 0 && (
            <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl overflow-hidden">
              <div className="grid grid-cols-4 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.07] text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span>ID</span>
                <span>プラン</span>
                <span>ステータス</span>
                <span className="text-right">コミッション/月</span>
              </div>
              {refStats.referrals.map(r => (
                <div key={r.id} className="grid grid-cols-4 px-4 py-3 border-b border-white/[0.05] last:border-0">
                  <span className="font-mono text-xs text-slate-400">{r.id}…</span>
                  <span className="text-xs text-slate-300">{r.plan || 'hp'}</span>
                  <span className={`text-xs font-semibold ${r.status === 'active' ? 'text-green-400' : 'text-slate-500'}`}>
                    {r.status === 'active' ? '契約中' : '未契約'}
                  </span>
                  <span className={`text-xs font-bold text-right ${r.status === 'active' ? 'text-sky-400' : 'text-slate-600'}`}>
                    {r.status === 'active' ? `¥${r.commission.toLocaleString()}` : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {refStats.referrals.length === 0 && (
            <div className="text-center py-8 text-slate-600 text-sm">
              まだ紹介実績がありません。リンクをSNSや名刺に掲載しましょう。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
