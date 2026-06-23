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
  const [sendConfirming, setSendConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'unsubscribed'>('active');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tab, setTab] = useState<'subscribers' | 'campaigns'>('subscribers');
  const [pausedSending, setPausedSending] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('laruHP_newsletter_paused') === '1'
  );
  const [lastExportAt, setLastExportAt] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('laruHP_newsletter_last_export') : null
  );
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportResult, setCsvImportResult] = useState<string | null>(null);
  const [abTestMode, setAbTestMode] = useState(false);
  const [subjectB, setSubjectB] = useState('');
  const [pauseConfirming, setPauseConfirming] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [sendSegment, setSendSegment] = useState<'all' | 'new' | 'mid' | 'veteran'>('all');
  const [unsubReasonEmail, setUnsubReasonEmail] = useState<string | null>(null);
  const [unsubReason, setUnsubReason] = useState('');
  const UNSUB_REASONS = ['配信頻度が多い', '内容が合わない', '必要なくなった', 'その他'];
  const unsubReasonCounts: Record<string, number> = (() => {
    try { return JSON.parse(localStorage.getItem('laruHP_unsub_reasons') || '{}'); } catch { return {}; }
  })();

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
    const now = new Date().toISOString();
    localStorage.setItem('laruHP_newsletter_last_export', now);
    setLastExportAt(now);
  };

  const handleCsvImport = async (file: File) => {
    if (!selectedSiteId) return;
    setCsvImporting(true);
    setCsvImportResult(null);
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const emailIdx = (() => {
        const header = lines[0].toLowerCase();
        const cols = header.split(',');
        const i = cols.findIndex(c => c.includes('email') || c.includes('mail') || c.includes('メール'));
        return i >= 0 ? i : 0;
      })();
      const nameIdx = (() => {
        const header = lines[0].toLowerCase();
        const cols = header.split(',');
        return cols.findIndex(c => c.includes('name') || c.includes('名前') || c.includes('氏名'));
      })();
      const dataLines = lines[0].toLowerCase().includes('email') || lines[0].toLowerCase().includes('メール') ? lines.slice(1) : lines;
      let success = 0;
      for (const line of dataLines) {
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        const email = cols[emailIdx];
        if (!email || !email.includes('@')) continue;
        const name = nameIdx >= 0 ? cols[nameIdx] || '' : '';
        const res = await fetch('/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId: selectedSiteId, email, name }),
        });
        if (res.ok) success++;
      }
      setCsvImportResult(`✓ ${success}件インポート完了`);
      const cRes = await fetch(`/api/newsletter/${selectedSiteId}/subscribers`);
      const d = await cRes.json();
      setSubscribers(d.subscribers || []);
    } catch {
      setCsvImportResult('❌ CSVの読み込みに失敗しました');
    }
    setCsvImporting(false);
    setTimeout(() => setCsvImportResult(null), 5000);
  };

  const handleSend = async () => {
    if (!selectedSiteId || !subject.trim() || !body.trim()) return;
    setSending(true);
    setSendResult(null);
    if (abTestMode && subjectB.trim()) {
      const [resA, resB] = await Promise.all([
        fetch('/api/newsletter/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId: selectedSiteId, subject: subject.trim(), html: body.replace(/\n/g, '<br>'), abGroup: 'A' }),
        }),
        fetch('/api/newsletter/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId: selectedSiteId, subject: subjectB.trim(), html: body.replace(/\n/g, '<br>'), abGroup: 'B' }),
        }),
      ]);
      const dA = await resA.json();
      const dB = await resB.json();
      if (dA.ok || dB.ok) {
        setSendResult(`A/Bテスト送信完了: A=${dA.sent || 0}件, B=${dB.sent || 0}件`);
        setSubject(''); setSubjectB(''); setBody(''); setAbTestMode(false);
        setShowSendModal(false); setSendConfirming(false);
        loadCampaigns(selectedSiteId);
      } else {
        setSendResult(`エラー: ${dA.error || dB.error}`);
      }
    } else {
      const res = await fetch('/api/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: selectedSiteId, subject, html: body.replace(/\n/g, '<br>') }),
      });
      const data = await res.json();
      if (data.ok) {
        setSendResult(`${data.sent}件に送信しました`);
        setSubject(''); setBody('');
        setShowSendModal(false); setSendConfirming(false);
        loadCampaigns(selectedSiteId);
      } else {
        setSendResult(`エラー: ${data.error}`);
      }
    }
    setSending(false);
  };

  const filtered = subscribers.filter(s => {
    if (filterActive === 'active' && s.unsubscribed_at) return false;
    if (filterActive === 'unsubscribed' && !s.unsubscribed_at) return false;
    if (dateFrom && new Date(s.subscribed_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(s.subscribed_at) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const activeCount = subscribers.filter(s => !s.unsubscribed_at).length;
  const segmentCount = (() => {
    if (sendSegment === 'all') return activeCount;
    return subscribers.filter(s => {
      if (s.unsubscribed_at) return false;
      const age = Date.now() - new Date(s.subscribed_at).getTime();
      if (sendSegment === 'new') return age <= 30 * 86400000;
      if (sendSegment === 'mid') return age > 30 * 86400000 && age <= 90 * 86400000;
      return age > 90 * 86400000;
    }).length;
  })();
  const segmentNewCount = subscribers.filter(s => !s.unsubscribed_at && Date.now() - new Date(s.subscribed_at).getTime() <= 30 * 86400000).length;
  const segmentMidCount = subscribers.filter(s => !s.unsubscribed_at && Date.now() - new Date(s.subscribed_at).getTime() > 30 * 86400000 && Date.now() - new Date(s.subscribed_at).getTime() <= 90 * 86400000).length;
  const segmentVetCount = subscribers.filter(s => !s.unsubscribed_at && Date.now() - new Date(s.subscribed_at).getTime() > 90 * 86400000).length;

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">

      {/* Unsubscribe reason modal */}
      {unsubReasonEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-1">配信解除の理由</h3>
            <p className="text-xs text-gray-500">{unsubReasonEmail} の解除理由を記録します（任意）</p>
            <p className="text-[10px] text-gray-400 mt-1 mb-4">教えていただけると今後のサービス改善に活用します</p>
            <div className="space-y-2 mb-4">
              {UNSUB_REASONS.map(r => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="unsub_reason" value={r} checked={unsubReason === r} onChange={() => setUnsubReason(r)} className="accent-red-500" />
                  <span className="text-sm text-gray-700">{r}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (unsubReason) {
                    const current: Record<string, number> = JSON.parse(localStorage.getItem('laruHP_unsub_reasons') || '{}');
                    current[unsubReason] = (current[unsubReason] || 0) + 1;
                    localStorage.setItem('laruHP_unsub_reasons', JSON.stringify(current));
                  }
                  handleUnsubscribe(unsubReasonEmail);
                  setUnsubReasonEmail(null);
                }}
                className="flex-1 bg-red-600 text-white text-sm font-bold py-2 rounded-xl hover:bg-red-500 transition-colors"
              >解除する</button>
              <button onClick={() => setUnsubReasonEmail(null)} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-xl">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-gray-200 bg-white backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/laruHP/dashboard" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-sm transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            ダッシュボード
          </Link>
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
                <span className="text-gray-500 text-sm">登録者 <span className="bg-sky-100 text-sky-900 font-bold px-2 py-0.5 rounded-full text-xs">{activeCount}</span> 件</span>
              </div>
              <div className="flex gap-2">
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <label className={`text-xs px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 text-gray-600 cursor-pointer transition-all ${csvImporting ? 'opacity-50 pointer-events-none' : ''}`}>
                      {csvImporting ? '取込中...' : 'CSVインポート'}
                      <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; handleCsvImport(f); } }} />
                    </label>
                    <button
                      onClick={handleExportCsv}
                      disabled={activeCount === 0}
                      className={`text-xs px-3 py-2 rounded-lg transition-all disabled:opacity-40 ${lastExportAt && (Date.now() - new Date(lastExportAt).getTime()) > 30 * 86400000 ? 'border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100' : 'border border-gray-200 hover:border-gray-300 text-gray-600'}`}
                    >
                      {lastExportAt && (Date.now() - new Date(lastExportAt).getTime()) > 30 * 86400000 ? '⚠ ' : ''}CSV エクスポート
                    </button>
                  </div>
                  {csvImportResult && <span className={`text-[10px] font-semibold ${csvImportResult.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{csvImportResult}</span>}
                  {lastExportAt && (
                    <span className="text-[10px] text-gray-400">最終エクスポート: {new Date(lastExportAt).toLocaleDateString('ja-JP')}</span>
                  )}
                  {!lastExportAt && activeCount > 0 && (
                    <span className="text-[10px] text-amber-500">まだエクスポートしていません</span>
                  )}
                </div>
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
                className={`text-xs px-3 py-2 border-b-2 transition-all ${tab === 'subscribers' ? 'border-sky-500 text-sky-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
              >
                購読者リスト {activeCount > 0 && <span className="ml-1 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{activeCount}</span>}
              </button>
              <button
                onClick={() => setTab('campaigns')}
                className={`text-xs px-3 py-2 border-b-2 transition-all ${tab === 'campaigns' ? 'border-sky-500 text-sky-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
              >
                送信履歴 {campaigns.length > 0 && <span className="ml-1 text-[10px] bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded-full">{campaigns.length}</span>}
              </button>
            </div>

            {tab === 'subscribers' && (
              <>
                {/* Filter tabs */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <div className="flex gap-1">
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
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-sky-400 text-gray-600"
                      title="登録日 開始"
                    />
                    <span className="text-gray-400 text-xs">〜</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-sky-400 text-gray-600"
                      title="登録日 終了"
                    />
                    {(dateFrom || dateTo) && (
                      <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-[10px] text-gray-400 hover:text-gray-700 px-1">✕</button>
                    )}
                  </div>
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
                                  onClick={() => { setUnsubReasonEmail(sub.email); setUnsubReason(''); }}
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

            {tab === 'campaigns' && (() => {
              // 直近3回のキャンペーン全てで解除率2%超えなら警告
              const recentDangerCount = campaigns.slice(0, 3).filter(c => {
                const unsubAfter = subscribers.filter(s => s.unsubscribed_at && s.unsubscribed_at > c.created_at).length;
                return c.sent_count > 0 && (unsubAfter / c.sent_count) * 100 >= 2.0;
              }).length;
              const showUnsubWarning = recentDangerCount >= 2 && campaigns.length >= 2;
              // 解除率スパークライン data (直近5件)
              const sparkData = campaigns.slice(0, 5).reverse().map(c => {
                const unsubAfter = subscribers.filter(s => s.unsubscribed_at && s.unsubscribed_at > c.created_at).length;
                return c.sent_count > 0 ? parseFloat(((unsubAfter / c.sent_count) * 100).toFixed(1)) : 0;
              });
              const sparkMax = Math.max(...sparkData, 5); // min scale 5%
              return (<>
              {showUnsubWarning && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
                  <span className="text-red-500 text-lg flex-shrink-0">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-red-800 mb-0.5">解除率が連続して高い状態です</div>
                    <p className="text-xs text-red-700 leading-relaxed">直近{recentDangerCount}回のキャンペーンで解除率2%超が検出されました。配信内容・頻度の見直し、またはリストのクリーニングをお勧めします。</p>
                    {!pausedSending && !pauseConfirming && (
                      <button
                        onClick={() => setPauseConfirming(true)}
                        className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors bg-red-100 text-red-700 hover:bg-red-200"
                      >⏸ 配信を一時停止する</button>
                    )}
                    {!pausedSending && pauseConfirming && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-red-700 font-semibold">本当に一時停止しますか？</span>
                        <button onClick={() => { setPausedSending(true); localStorage.setItem('laruHP_newsletter_paused', '1'); setPauseConfirming(false); }} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors">停止する</button>
                        <button onClick={() => setPauseConfirming(false)} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">キャンセル</button>
                      </div>
                    )}
                    {pausedSending && (
                      <button
                        onClick={() => { setPausedSending(false); localStorage.setItem('laruHP_newsletter_paused', '0'); }}
                        className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors bg-green-100 text-green-700 hover:bg-green-200"
                      >▶ 配信を再開する</button>
                    )}
                  </div>
                </div>
              )}
              {pausedSending && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2 text-xs text-amber-700 font-semibold">
                  <span>⏸</span> 配信が一時停止中です。再開するには上のボタンを押してください。
                </div>
              )}
              {campaigns.length >= 2 && (
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-gray-500 mb-1">解除率トレンド（直近{sparkData.length}回）</p>
                    <svg width="100%" height="32" viewBox={`0 0 ${sparkData.length * 20} 32`} preserveAspectRatio="none">
                      <polyline
                        points={sparkData.map((v, i) => `${i * 20 + 10},${32 - (v / sparkMax) * 28}`).join(' ')}
                        fill="none" stroke={showUnsubWarning ? '#ef4444' : '#f59e0b'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                      />
                      {sparkData.map((v, i) => (
                        <circle key={i} cx={i * 20 + 10} cy={32 - (v / sparkMax) * 28} r="2.5" fill={v >= 5 ? '#ef4444' : v >= 2 ? '#f59e0b' : '#10b981'} />
                      ))}
                    </svg>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-gray-800">{sparkData[sparkData.length - 1]}%</p>
                    <p className="text-[10px] text-gray-400">最新</p>
                  </div>
                </div>
              )}
              {Object.keys(unsubReasonCounts).length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3">
                  <p className="text-[10px] font-semibold text-gray-500 mb-2">配信解除理由（累計）</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(unsubReasonCounts).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                      <span key={reason} className="text-[10px] bg-red-50 border border-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                        {reason} <span className="opacity-70">{count}件</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {campLoading ? (
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
                    // 解除率: キャンペーン送信後に登録解除した購読者数
                    const unsubAfter = subscribers.filter(s => s.unsubscribed_at && s.unsubscribed_at > c.created_at).length;
                    const unsubRate = c.sent_count > 0 ? ((unsubAfter / c.sent_count) * 100).toFixed(1) : '0.0';
                    const unsubDanger = parseFloat(unsubRate) >= 2.0;
                    const unsubSpike = parseFloat(unsubRate) >= 5.0;
                    return (
                      <div key={c.id} className={`bg-white rounded-xl p-4 shadow-sm border ${unsubSpike ? 'border-red-300' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">件名</p>
                            <p className="text-sm font-semibold text-gray-900 truncate">{c.subject}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(c.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {unsubSpike ? (
                              <span className="text-[10px] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-bold" title="解除率が5%を超えています。配信内容の見直しをお勧めします。">
                                ⚠ 解除率急増
                              </span>
                            ) : unsubDanger ? (
                              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold" title="解除率が2%を超えています。配信頻度や内容をご確認ください。">
                                ⚠ 解除率注意
                              </span>
                            ) : null}
                            <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                              {c.sent_count}件送信
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setExpandedCampaignId(prev => prev === c.id ? null : c.id)}
                          className="mt-2 text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            className={`transition-transform duration-200 ${expandedCampaignId === c.id ? 'rotate-180' : ''}`}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                          {expandedCampaignId === c.id ? '詳細を隠す' : '詳細を表示'}
                        </button>
                        {expandedCampaignId === c.id && (
                        <div className="mt-3 grid grid-cols-4 gap-2">
                          <div className="bg-sky-50 border border-sky-100 rounded-lg px-2 py-2 text-center">
                            <p className="text-base font-bold text-sky-600">{pct(c.open_count, c.sent_count)}</p>
                            <div className="w-full bg-sky-100 rounded-full h-1 mt-1 mb-0.5">
                              <div className="bg-sky-400 h-1 rounded-full transition-all" style={{ width: `${Math.min(openRate, 100)}%` }} />
                            </div>
                            <p className="text-[10px] text-gray-500">開封率</p>
                            <p className="text-[10px] text-gray-400">{c.open_count}件</p>
                          </div>
                          <div className="bg-violet-50 border border-violet-100 rounded-lg px-2 py-2 text-center">
                            <p className="text-base font-bold text-violet-600">{pct(c.click_count, c.sent_count)}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">クリック率</p>
                            <p className="text-[10px] text-gray-400">{c.click_count}件</p>
                          </div>
                          <div className="bg-green-50 border border-green-100 rounded-lg px-2 py-2 text-center">
                            <div className="relative h-5 flex items-center justify-center">
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(openRate, 100)}%` }} />
                              </div>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1">到達率</p>
                            <p className="text-[10px] text-gray-400">{c.sent_count}件</p>
                          </div>
                          <div className={`rounded-lg px-2 py-2 text-center border ${unsubSpike ? 'bg-red-50 border-red-200' : unsubDanger ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
                            <p className={`text-base font-bold ${unsubSpike ? 'text-red-600' : unsubDanger ? 'text-amber-700' : 'text-gray-500'}`}>{unsubRate}%</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">解除率</p>
                            <p className={`text-[10px] ${unsubSpike ? 'text-red-400' : unsubDanger ? 'text-amber-500' : 'text-gray-400'}`}>{unsubAfter}件{unsubDanger ? ' ⚠' : ''}</p>
                          </div>
                        </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </>);
            })()}
          </>
        )}
      </main>

      {/* Send modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-900 font-bold">ニュースレター送信</h2>
              <span className="text-gray-500 text-xs"><span className="text-sky-600 font-bold">{segmentCount}</span> 件に送信</span>
            </div>
            <div className="space-y-3">
              {/* Segment selector */}
              <div>
                <label className="text-xs text-gray-600 mb-1.5 block">送信セグメント</label>
                <div className="flex gap-1 flex-wrap">
                  {([
                    { key: 'all', label: `全員 (${activeCount})` },
                    { key: 'new', label: `新規30日以内 (${segmentNewCount})` },
                    { key: 'mid', label: `30〜90日 (${segmentMidCount})` },
                    { key: 'veteran', label: `90日以上 (${segmentVetCount})` },
                  ] as const).map(s => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSendSegment(s.key)}
                      className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border transition-all ${sendSegment === s.key ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300'}`}
                    >{s.label}</button>
                  ))}
                </div>
                {sendSegment !== 'all' && (
                  <p className="text-[10px] text-sky-600 mt-1">登録期間でフィルタリングされた {segmentCount} 件に送信します</p>
                )}
              </div>
              {/* A/B test toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <div className={`w-8 h-4 rounded-full transition-colors ${abTestMode ? 'bg-sky-500' : 'bg-gray-200'}`}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mt-0.5 ${abTestMode ? 'translate-x-4 ml-0' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs text-gray-600" onClick={() => setAbTestMode(v => !v)}>A/Bテスト版（件名を2パターン送信）</span>
              </label>
              <div className={abTestMode ? 'grid grid-cols-2 gap-2' : ''}>
                <div>
                  <label className="text-xs text-gray-600 mb-1.5 block">{abTestMode ? '件名 A' : '件名'}</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="メールの件名を入力..."
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-sky-500"
                  />
                </div>
                {abTestMode && (
                  <div>
                    <label className="text-xs text-gray-600 mb-1.5 block">件名 B</label>
                    <input
                      type="text"
                      value={subjectB}
                      onChange={e => setSubjectB(e.target.value)}
                      placeholder="Bパターンの件名..."
                      className="w-full bg-white border border-sky-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-sky-500"
                    />
                  </div>
                )}
              </div>
              {abTestMode && (
                <p className="text-[10px] text-sky-600">各購読者の約50%ずつにA/Bを振り分けて送信します</p>
              )}
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
            {sending && (
              <div className="mt-3 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <svg className="animate-spin w-3 h-3 text-sky-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  <span className="text-xs font-semibold text-sky-700">{segmentCount}件に送信中...</span>
                </div>
                <div className="w-full bg-sky-100 rounded-full h-1.5">
                  <div className="bg-sky-500 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
                <p className="text-[10px] text-sky-600 mt-1">完了までしばらくお待ちください（目安: 約{Math.ceil(segmentCount / 50) * 3}秒）</p>
              </div>
            )}
            {sendResult && !sending && (
              <p className={`text-xs mt-3 font-semibold ${sendResult.startsWith('エラー') ? 'text-red-500' : 'text-green-600'}`}>{sendResult}</p>
            )}
            <div className="mt-4">
              {sendConfirming ? (
                <div className="flex flex-col gap-2">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
                    <p className="font-bold text-amber-800 mb-2">送信内容の確認</p>
                    <div className="space-y-1 text-amber-700 text-xs">
                      <p><span className="font-semibold">宛先:</span> {segmentCount}件の購読者{sendSegment !== 'all' ? ` (${sendSegment === 'new' ? '新規30日以内' : sendSegment === 'mid' ? '30〜90日' : '90日以上'})` : ''}{abTestMode ? `（A: 約${Math.ceil(segmentCount/2)}件, B: 約${Math.floor(segmentCount/2)}件）` : ''}</p>
                      <p><span className="font-semibold">件名{abTestMode ? ' A' : ''}:</span> {subject}</p>
                      {abTestMode && <p><span className="font-semibold">件名 B:</span> {subjectB}</p>}
                      <p><span className="font-semibold">目安時間:</span> 約{Math.ceil(segmentCount / 50) * 3}秒</p>
                    </div>
                    <p className="mt-2 text-[10px] text-amber-600">送信後は取り消しできません。内容をご確認ください。</p>
                  </div>
                  <div className="border-t border-gray-200 my-1" />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSendConfirming(false)}
                      disabled={sending}
                      className="flex-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 py-2.5 rounded-lg transition-colors disabled:opacity-40"
                    >
                      戻る
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={sending}
                      className="flex-1 text-sm bg-red-600 text-white font-bold py-2.5 rounded-lg hover:bg-red-500 transition-all disabled:opacity-50"
                    >
                      {sending ? `送信中 (${segmentCount}件)` : '送信を確定する'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowSendModal(false); setSendConfirming(false); }}
                    disabled={sending}
                    className="flex-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 py-2.5 rounded-lg transition-colors disabled:opacity-40"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => setSendConfirming(true)}
                    disabled={sending || !subject.trim() || !body.trim()}
                    className="flex-1 text-sm bg-sky-600 text-white font-bold py-2.5 rounded-lg hover:bg-sky-500 transition-all disabled:opacity-50"
                  >
                    送信する →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
