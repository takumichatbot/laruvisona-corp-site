'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

interface Campaign {
  id: string;
  subject: string;
  sent_count: number;
  open_count: number;
  click_count: number;
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
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString('ja-JP');
}

function pct(n: number, total: number) {
  if (!total) return '—';
  return `${Math.round((n / total) * 100)}%`;
}

export default function NewsletterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [campLoading, setCampLoading] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'unsubscribed'>('active');
  const [tab, setTab] = useState<'subscribers' | 'campaigns'>('subscribers');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/laruHP/auth/login'); return; }
      const res = await fetch('/api/sites');
      const data = await res.json();
      const s: Site[] = (data.sites || []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name }));
      setSites(s);
      if (s.length > 0) setSelectedSiteId(s[0].id);
      setLoading(false);
    })();
  }, []);

  const loadSubscribers = useCallback(async (siteId: string) => {
    setSubLoading(true);
    const res = await fetch(`/api/newsletter/${siteId}/subscribers`);
    const data = await res.json();
    setSubscribers(data.subscribers || []);
    setSubLoading(false);
  }, []);

  const loadCampaigns = useCallback(async (siteId: string) => {
    setCampLoading(true);
    const res = await fetch(`/api/newsletter/campaigns?siteId=${siteId}`);
    const data = await res.json();
    setCampaigns(data.campaigns || []);
    setCampLoading(false);
  }, []);

  useEffect(() => {
    if (selectedSiteId) {
      loadSubscribers(selectedSiteId);
      loadCampaigns(selectedSiteId);
    }
  }, [selectedSiteId, loadSubscribers, loadCampaigns]);

  const handleUnsubscribe = async (email: string) => {
    if (!selectedSiteId) return;
    await fetch(`/api/newsletter/${selectedSiteId}/subscribers`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setSubscribers(prev => prev.map(s => s.email === email ? { ...s, unsubscribed_at: new Date().toISOString() } : s));
  };

  const handleExportCsv = () => {
    const active = subscribers.filter(s => !s.unsubscribed_at);
    const csv = ['メール,お名前,登録日', ...active.map(s =>
      `${s.email},${s.name || ''},${new Date(s.subscribed_at).toLocaleDateString('ja-JP')}`
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'subscribers.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleSend = async () => {
    if (!selectedSiteId || !subject.trim() || !body.trim()) return;
    setSending(true);
    setSendResult(null);
    const res = await fetch('/api/newsletter/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: selectedSiteId, subject, html: body.replace(/\n/g, '<br>') }),
    });
    const data = await res.json();
    if (data.ok) {
      setSendResult(`${data.sent}件に送信しました`);
      setSubject('');
      setBody('');
      setShowSendModal(false);
      loadCampaigns(selectedSiteId);
    } else {
      setSendResult(`エラー: ${data.error}`);
    }
    setSending(false);
  };

  const filtered = subscribers.filter(s => {
    if (filterActive === 'active') return !s.unsubscribed_at;
    if (filterActive === 'unsubscribed') return !!s.unsubscribed_at;
    return true;
  });

  const activeCount = subscribers.filter(s => !s.unsubscribed_at).length;

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/laruHP/dashboard" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">← ダッシュボード</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-sm font-bold text-gray-900">メールニュースレター</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="text-gray-500 text-sm">読み込み中...</div>
        ) : sites.length === 0 ? (
          <div className="text-gray-500 text-sm">サイトがありません</div>
        ) : (
          <>
            {/* Site selector + actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <select
                  value={selectedSiteId || ''}
                  onChange={e => setSelectedSiteId(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-sky-500"
                >
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <span className="text-gray-500 text-sm">登録者 <span className="text-gray-900 font-bold">{activeCount}</span> 件</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportCsv}
                  disabled={activeCount === 0}
                  className="text-xs border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-lg transition-all text-gray-600 disabled:opacity-40"
                >
                  CSV エクスポート
                </button>
                <button
                  onClick={() => { setShowSendModal(true); setSendResult(null); }}
                  disabled={activeCount === 0}
                  className="text-xs bg-sky-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-sky-500 transition-all disabled:opacity-40"
                >
                  メール送信
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-gray-200">
              <button
                onClick={() => setTab('subscribers')}
                className={`text-xs px-3 py-2 border-b-2 transition-all ${tab === 'subscribers' ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
              >
                購読者リスト
              </button>
              <button
                onClick={() => setTab('campaigns')}
                className={`text-xs px-3 py-2 border-b-2 transition-all ${tab === 'campaigns' ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
              >
                送信履歴 {campaigns.length > 0 && <span className="ml-1 text-[10px] bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded-full">{campaigns.length}</span>}
              </button>
            </div>

            {tab === 'subscribers' && (
              <>
                {/* Filter tabs */}
                <div className="flex gap-1 mb-4">
                  {([
                    { key: 'active', label: `有効 (${subscribers.filter(s => !s.unsubscribed_at).length})` },
                    { key: 'unsubscribed', label: `解除済み (${subscribers.filter(s => !!s.unsubscribed_at).length})` },
                    { key: 'all', label: `全て (${subscribers.length})` },
                  ] as const).map(t => (
                    <button
                      key={t.key}
                      onClick={() => setFilterActive(t.key)}
                      className={`text-xs px-3 py-1.5 rounded-full transition-all ${filterActive === t.key ? 'bg-sky-100 text-sky-600 font-semibold' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Subscribers table */}
                {subLoading ? (
                  <div className="text-gray-500 text-sm py-8 text-center">読み込み中...</div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center border border-gray-200 border-dashed rounded-xl bg-white">
                    <p className="text-gray-500 text-sm">登録者がいません</p>
                    <p className="text-gray-400 text-xs mt-1">ニュースレター登録ブロックをサイトに追加して公開してください</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          {['メールアドレス', 'お名前', '登録日', 'ステータス', '操作'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-[11px] text-gray-400 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(sub => (
                          <tr key={sub.id} className="border-b border-gray-100 hover:bg-sky-50 transition-colors">
                            <td className="px-4 py-3 text-xs text-gray-900 font-mono">{sub.email}</td>
                            <td className="px-4 py-3 text-xs text-gray-600">{sub.name || '—'}</td>
                            <td className="px-4 py-3 text-[11px] text-gray-500">{timeAgo(sub.subscribed_at)}</td>
                            <td className="px-4 py-3">
                              {sub.unsubscribed_at ? (
                                <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">解除済み</span>
                              ) : (
                                <span className="text-[10px] text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">有効</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {!sub.unsubscribed_at && (
                                <button
                                  onClick={() => handleUnsubscribe(sub.email)}
                                  className="text-[10px] text-red-400 hover:text-red-600 transition-colors"
                                >
                                  解除
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {tab === 'campaigns' && (
              campLoading ? (
                <div className="text-gray-500 text-sm py-8 text-center">読み込み中...</div>
              ) : campaigns.length === 0 ? (
                <div className="py-16 text-center border border-gray-200 border-dashed rounded-xl bg-white">
                  <p className="text-gray-500 text-sm">まだメールを送信していません</p>
                  <p className="text-gray-400 text-xs mt-1">送信後に開封率・クリック率がここに表示されます</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.map(c => {
                    const openRate = c.sent_count > 0 ? Math.round((c.open_count / c.sent_count) * 100) : 0;
                    const clickRate = c.sent_count > 0 ? Math.round((c.click_count / c.sent_count) * 100) : 0;
                    return (
                      <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{c.subject}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(c.created_at)}</p>
                          </div>
                          <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                            {c.sent_count}件送信
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-3">
                          <div className="bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 text-center">
                            <p className="text-lg font-bold text-sky-600">{pct(c.open_count, c.sent_count)}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">開封率</p>
                            <p className="text-[10px] text-gray-400">{c.open_count} 件</p>
                          </div>
                          <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-center">
                            <p className="text-lg font-bold text-violet-600">{pct(c.click_count, c.sent_count)}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">クリック率</p>
                            <p className="text-[10px] text-gray-400">{c.click_count} 件</p>
                          </div>
                          <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-center">
                            <div className="relative h-5 flex items-center justify-center">
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className="bg-green-500 h-1.5 rounded-full transition-all"
                                  style={{ width: `${Math.min(openRate, 100)}%` }}
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1">到達率</p>
                            <p className="text-[10px] text-gray-400">{c.sent_count} 件</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </>
        )}
      </main>

      {/* Send modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-900 font-bold">ニュースレター送信</h2>
              <span className="text-gray-500 text-xs">{activeCount} 件に送信</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1.5 block">件名</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="メールの件名を入力..."
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1.5 block">本文</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="メールの本文を入力... (改行はそのままHTMLに変換されます)"
                  rows={8}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-sky-500 resize-none"
                />
              </div>
            </div>
            {sendResult && (
              <p className={`text-xs mt-3 ${sendResult.startsWith('エラー') ? 'text-red-500' : 'text-green-600'}`}>{sendResult}</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowSendModal(false)}
                className="flex-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 py-2.5 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !subject.trim() || !body.trim()}
                className="flex-1 text-sm bg-sky-600 text-white font-bold py-2.5 rounded-lg hover:bg-sky-500 transition-all disabled:opacity-50"
              >
                {sending ? '送信中...' : '送信する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
