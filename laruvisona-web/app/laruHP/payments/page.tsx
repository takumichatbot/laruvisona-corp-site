'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ClipboardCopy, ExternalLink, Link2Off, ShoppingBag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface PaymentLink {
  id: string;
  url: string;
  amount: number;
  description: string;
  buttonText?: string;
  currency: string;
  createdAt: string;
}

interface Site { id: string; name: string }

export default function LegacyPaymentsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/laruHP/auth/login'); return; }
      const response = await fetch('/api/sites', { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage('サイトを読み込めませんでした'); setLoading(false); return; }
      const nextSites = Array.isArray(body.sites) ? body.sites as Site[] : [];
      setSites(nextSites);
      setSelectedSiteId(nextSites[0]?.id || '');
      setLoading(false);
    })();
  // The browser client is stable for this page lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLinks = useCallback(async (siteId: string) => {
    if (!siteId) { setLinks([]); return; }
    setMessage('');
    const response = await fetch(`/api/stripe/payment-link?siteId=${encodeURIComponent(siteId)}`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setLinks([]); setMessage(body.error || '旧決済リンクを読み込めませんでした'); return; }
    setLinks(Array.isArray(body.paymentLinks) ? body.paymentLinks : []);
  }, []);

  useEffect(() => { void loadLinks(selectedSiteId); }, [loadLinks, selectedSiteId]);

  async function stopLink(link: PaymentLink) {
    if (!selectedSiteId || !window.confirm(`「${link.description}」をStripe側でも停止しますか？`)) return;
    setBusyId(link.id);
    setMessage('');
    const response = await fetch(
      `/api/stripe/payment-link?siteId=${encodeURIComponent(selectedSiteId)}&linkId=${encodeURIComponent(link.id)}`,
      { method: 'DELETE' },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(body.error || 'リンクを停止できませんでした');
    else { setLinks(current => current.filter(item => item.id !== link.id)); setMessage('Stripe側のリンクを停止しました'); }
    setBusyId(null);
  }

  async function copy(link: PaymentLink) {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
      window.setTimeout(() => setCopiedId(current => current === link.id ? null : current), 1500);
    } catch { setMessage('URLをコピーできませんでした'); }
  }

  if (loading) return <div className="min-h-screen bg-sky-50 grid place-items-center text-sm text-gray-500">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <header className="border-b border-sky-100 bg-white/90 px-4 py-4 shadow-sm backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/laruHP/dashboard" className="text-sm text-gray-500 hover:text-gray-800">ダッシュボードへ</Link>
          <h1 className="text-sm font-bold">旧決済リンク</h1>
          <span className="w-24" aria-hidden="true" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <section className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
          <div className="grid gap-5 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="mb-2 text-xs font-bold tracking-[.14em] text-sky-700">販売機能を統合しました</p>
              <h2 className="text-xl font-bold tracking-tight">新しい販売はショップから設定できます</h2>
              <p className="mt-2 max-w-xl text-sm leading-7 text-gray-600">
                売上をご自身のStripe口座へ直接入金し、商品・在庫・注文通知・返金まで一緒に管理できます。この画面では、以前作成したリンクの確認と停止だけ行えます。
              </p>
            </div>
            <Link href="/laruHP/shop" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 text-sm font-bold text-white hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
              <ShoppingBag size={17} aria-hidden="true" />ショップを開く<ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        {sites.length > 1 && (
          <label className="block text-xs font-semibold text-gray-600">
            対象サイト
            <select value={selectedSiteId} onChange={event => setSelectedSiteId(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 focus:border-sky-500 focus:outline-none">
              {sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </label>
        )}

        {message && <p role="status" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">{message}</p>}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">以前作成したリンク</h2>
              <p className="mt-1 text-xs text-gray-500">{links.length}件</p>
            </div>
            <Link href="/laruHP/shop" className="text-xs font-semibold text-sky-700 hover:underline">注文管理はこちら</Link>
          </div>

          {links.length === 0 ? (
            <div className="grid place-items-center rounded-xl bg-gray-50 px-4 py-12 text-center">
              <Link2Off size={30} className="mb-3 text-gray-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-gray-600">以前の決済リンクはありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {links.map(link => (
                <article key={link.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900">{link.description}</h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {link.currency === 'jpy'
                          ? `${Number(link.amount || 0).toLocaleString()}円`
                          : `${link.currency.toUpperCase()} ${Number(link.amount || 0).toLocaleString()}`}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">{link.createdAt ? new Date(link.createdAt).toLocaleDateString('ja-JP') : '作成日不明'}</p>
                    </div>
                    <button type="button" onClick={() => void stopLink(link)} disabled={busyId === link.id} className="min-h-11 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                      {busyId === link.id ? '停止中...' : 'リンクを停止'}
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => void copy(link)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-bold text-sky-800 hover:bg-sky-100">
                      {copiedId === link.id ? <Check size={14} aria-hidden="true" /> : <ClipboardCopy size={14} aria-hidden="true" />}
                      {copiedId === link.id ? 'コピー済み' : 'URLをコピー'}
                    </button>
                    <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-700 hover:bg-gray-50">
                      確認する<ExternalLink size={13} aria-hidden="true" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
