'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface PaymentLink {
  id: string;
  url: string;
  amount: number;
  description: string;
  buttonText: string;
  currency: string;
  createdAt: string;
  completedOrders?: number;
  expiresAt?: string;
}

const EXPIRY_KEY = (id: string) => `laruHP_payment_link_expiry_${id}`;

interface Site {
  id: string;
  name: string;
}

export default function PaymentsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [qrLink, setQrLink] = useState<PaymentLink | null>(null);
  const [qrReady, setQrReady] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  // qrCanvasRef is set by callback ref on the canvas element in the modal
  const [expiresAt, setExpiresAt] = useState('');
  const [duplicateToast, setDuplicateToast] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/laruHP/auth/login'); return; }

      const res = await fetch('/api/sites');
      const d = await res.json();
      const s: Site[] = (d.sites || []);
      setSites(s);
      if (s.length > 0) setSelectedSiteId(s[0].id);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSiteId) return;
    (async () => {
      const res = await fetch(`/api/stripe/payment-link?siteId=${selectedSiteId}`);
      const d = await res.json();
      const links: PaymentLink[] = (d.paymentLinks || []).map((l: PaymentLink) => ({
        ...l,
        expiresAt: localStorage.getItem(EXPIRY_KEY(l.id)) || undefined,
      }));
      setPaymentLinks(links);
    })();
  }, [selectedSiteId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !selectedSiteId) return;
    setCreating(true);
    setMsg('');

    const res = await fetch('/api/stripe/payment-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: selectedSiteId,
        amount: parseInt(amount),
        description,
        buttonText: buttonText || undefined,
      }),
    });

    const d = await res.json();
    if (!res.ok) {
      setMsg(`エラー: ${d.error}`);
    } else {
      setMsg('決済リンクを作成しました');
      if (expiresAt && d.paymentLink?.id) {
        localStorage.setItem(EXPIRY_KEY(d.paymentLink.id), expiresAt);
      }
      setAmount('');
      setDescription('');
      setButtonText('');
      setExpiresAt('');
      // Reload
      const r2 = await fetch(`/api/stripe/payment-link?siteId=${selectedSiteId}`);
      const d2 = await r2.json();
      const links: PaymentLink[] = (d2.paymentLinks || []).map((l: PaymentLink) => ({
        ...l,
        expiresAt: localStorage.getItem(EXPIRY_KEY(l.id)) || undefined,
      }));
      setPaymentLinks(links);
    }
    setCreating(false);
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm('この決済リンクを無効化しますか？')) return;
    await fetch(`/api/stripe/payment-link?siteId=${selectedSiteId}&linkId=${linkId}`, { method: 'DELETE' });
    setPaymentLinks(prev => prev.filter(l => l.id !== linkId));
  };

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 transition-colors';

  if (loading) return <div className="min-h-screen bg-sky-50 flex items-center justify-center"><div className="text-gray-500 text-sm">読み込み中...</div></div>;

  return (
    <>
    {duplicateToast && (
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-gray-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl animate-fadeIn">
        📋 フォームに複製しました — 内容を確認して作成してください
      </div>
    )}
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <header className="border-b border-sky-100 bg-white/90 backdrop-blur-xl shadow-sm px-6 py-4 flex items-center gap-4">
        <Link href="/laruHP/dashboard" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          ダッシュボード
        </Link>
        <h1 className="text-sm font-bold text-gray-900 mx-auto">決済リンク管理</h1>
        {paymentLinks.length > 0 && (
          <button
            onClick={() => {
              const rows = [
                ['説明', '金額', '通貨', '成約数', '合計売上', 'URL', '作成日'],
                ...paymentLinks.map(l => [
                  l.description, l.amount, l.currency.toUpperCase(),
                  l.completedOrders ?? 0, ((l.completedOrders ?? 0) * l.amount),
                  l.url, new Date(l.createdAt).toLocaleDateString('ja-JP'),
                ]),
              ];
              const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
              const a = document.createElement('a');
              a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
              a.download = `payment_links_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
            }}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
          >
            📊 CSV出力
          </button>
        )}
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Site picker */}
        {sites.length > 1 && (
          <select
            value={selectedSiteId}
            onChange={e => setSelectedSiteId(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-500"
          >
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        {/* Monthly revenue card */}
        {paymentLinks.length > 0 && (() => {
          const monthlyRevenue = paymentLinks.reduce((sum, l) => sum + (l.completedOrders ?? 0) * l.amount, 0);
          const totalOrders = paymentLinks.reduce((sum, l) => sum + (l.completedOrders ?? 0), 0);
          const dayOfMonth = new Date().getDate();
          const dailyAvg = dayOfMonth > 0 && monthlyRevenue > 0 ? Math.round(monthlyRevenue / dayOfMonth) : 0;
          const projectedMonthly = dailyAvg * 30;
          return (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-green-700 mb-1">今月の合計売上</p>
                <p className="text-2xl font-bold text-green-900">¥{monthlyRevenue.toLocaleString()}</p>
                <p className="text-xs text-green-600 mt-0.5">{totalOrders}件成立 · {paymentLinks.length}リンク</p>
                {dailyAvg > 0 && (
                  <p className="text-[10px] text-green-500 mt-1">日平均 ¥{dailyAvg.toLocaleString()} · 月間予測 ¥{projectedMonthly.toLocaleString()}</p>
                )}
              </div>
              <div className="text-4xl">💰</div>
            </div>
          );
        })()}

        {/* Create form */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-sm text-gray-900 mb-1">新しい決済リンクを作成</h2>
          <p className="text-xs text-gray-500 mb-5">Stripe Payment Linkを生成してサイトに埋め込めます</p>

          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">商品・サービス名</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="例: カット料金、相談料、講座受講料"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">金額（円）</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="例: 3000"
                min="50"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ボタンテキスト（任意）</label>
              <input
                type="text"
                value={buttonText}
                onChange={e => setButtonText(e.target.value)}
                placeholder="例: 今すぐ購入する・料金を支払う"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">有効期限（任意）</label>
              <input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={inputCls}
              />
            </div>

            {msg && (
              <p className={`text-xs font-semibold ${msg.startsWith('エラー') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>
            )}

            <button
              type="submit"
              disabled={creating || !amount || !description}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              {creating ? '作成中...' : '決済リンクを作成'}
            </button>
          </form>
        </section>

        {/* List */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm text-gray-900">作成済み決済リンク ({paymentLinks.length}件)</h2>
            {paymentLinks.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const text = paymentLinks.map(l => `[${l.description} ¥${l.amount.toLocaleString()}](${l.url})`).join('\n');
                    navigator.clipboard.writeText(text);
                  }}
                  className="text-xs text-purple-600 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg font-semibold transition-all"
                  title="Markdown形式: [説明](URL)"
                >
                  MD コピー
                </button>
                <button
                  onClick={() => {
                    const text = paymentLinks.map(l => `【${l.description}】¥${l.amount.toLocaleString()}\n${l.buttonText || l.description}はこちら → ${l.url}`).join('\n\n');
                    navigator.clipboard.writeText(text);
                  }}
                  className="text-xs text-sky-600 border border-sky-200 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg font-semibold transition-all"
                >
                  全リンクをコピー
                </button>
              </div>
            )}
          </div>

          {paymentLinks.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-3">💳</div>
              <p className="text-sm text-gray-500 font-semibold">まだ決済リンクがありません</p>
              <p className="text-xs text-gray-400 mt-1 mb-3">商品・サービス・予約金・寄付など、URLを共有するだけで即座に決済を受け付けられます。</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['商品販売', 'サービス料', '予約金・前払い', '寄付・支援'].map(uc => (
                  <span key={uc} className="text-[10px] bg-sky-50 border border-sky-100 text-sky-600 px-2 py-0.5 rounded-full">{uc}</span>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-3">↑ 上のフォームからリンクを作成してください</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentLinks.map(link => (
                <div key={link.id} className="border border-gray-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0 text-sky-700 text-sm font-bold">
                    ¥
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900">{link.description}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">{link.amount.toLocaleString()}円</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-500">{new Date(link.createdAt).toLocaleDateString('ja-JP')}</span>
                      {link.expiresAt && (() => {
                        const daysLeft = Math.ceil((new Date(link.expiresAt).getTime() - Date.now()) / 86400000);
                        const isExpired = daysLeft < 0;
                        const isSoon = daysLeft >= 0 && daysLeft <= 7;
                        const badgeCls = isExpired
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : isSoon
                          ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                          : 'bg-green-100 text-green-700 border border-green-200';
                        const badgeIcon = isExpired ? '✕' : isSoon ? '⚠' : '✓';
                        return (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeCls}`}>
                              {badgeIcon} {isExpired ? '期限切れ' : `あと${daysLeft}日`}
                            </span>
                          </>
                        );
                      })()}
                      {link.completedOrders !== undefined && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className={`text-xs font-semibold ${link.completedOrders > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {link.completedOrders > 0 ? `${link.completedOrders}件成立` : '未成立'}
                          </span>
                          {link.completedOrders > 0 && (
                            <span className="text-xs text-gray-400">
                              合計 ¥{(link.amount * link.completedOrders).toLocaleString()}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        readOnly
                        value={link.url}
                        className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600 font-mono focus:outline-none select-all"
                        onClick={e => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        onClick={() => { navigator.clipboard.writeText(link.url); setCopiedId(link.id); setTimeout(() => setCopiedId(null), 1500); }}
                        aria-label={copiedId === link.id ? 'コピー済み' : `${link.description}のURLをコピー`}
                        className={`flex-shrink-0 text-xs px-3 min-h-[44px] rounded-lg transition-all font-bold ${copiedId === link.id ? 'bg-green-100 border border-green-300 text-green-700' : 'bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100'}`}
                      >
                        {copiedId === link.id ? '✓ コピー済み' : 'コピー'}
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1.5">ボタン: {link.buttonText}</div>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      <button
                        onClick={() => navigator.clipboard.writeText(`【${link.description}】¥${link.amount.toLocaleString()}\n${link.buttonText || link.description}はこちら → ${link.url}`)}
                        className="text-[10px] bg-purple-50 border border-purple-200 text-purple-700 px-2 py-1 rounded-lg hover:bg-purple-100 transition-all font-bold"
                        title="メール・LINEに貼り付ける形式でコピー"
                      >
                        📋 メール用コピー
                      </button>
                      <button
                        onClick={() => setQrLink(link)}
                        className="text-[10px] bg-gray-50 border border-gray-200 text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-all font-bold"
                        title="QRコードを生成"
                      >
                        QR
                      </button>
                      {typeof navigator !== 'undefined' && 'share' in navigator && (
                        <button
                          onClick={() => navigator.share({ title: link.description, text: `¥${link.amount.toLocaleString()} — ${link.description}`, url: link.url })}
                          className="text-[10px] bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded-lg hover:bg-green-100 transition-all font-bold"
                          title="SNS・LINEで共有"
                        >
                          共有
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => {
                        setDescription(link.description);
                        setAmount(String(link.amount));
                        setButtonText(link.buttonText || '');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setDuplicateToast(true);
                        setTimeout(() => setDuplicateToast(false), 2000);
                      }}
                      className="text-[10px] bg-gray-50 border border-gray-200 text-gray-600 hover:border-sky-300 hover:text-sky-700 px-2 py-1 rounded-lg transition-all font-bold"
                      title="このリンクを複製"
                    >
                      複製
                    </button>
                    <button
                      onClick={() => handleDelete(link.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="この決済リンクを削除"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Usage guide */}
        <section className="bg-sky-50 border border-sky-200 rounded-2xl p-5">
          <h3 className="font-bold text-sm text-sky-900 mb-2">使い方</h3>
          <ol className="space-y-1.5 text-xs text-sky-800">
            <li>1. 上で決済リンクを作成する</li>
            <li>2. URLをコピーしてビルダーの「ボタン」ブロックに貼り付ける</li>
            <li>3. お客様がクリックするとStripe決済ページが開く</li>
            <li>4. 入金はStripeダッシュボードで確認できます</li>
          </ol>
        </section>
      </div>
    </div>

    {/* QR Code modal */}
    {qrLink && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setQrLink(null)}>
        <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-xs sm:max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-gray-900 mb-1">{qrLink.description}</h3>
          <p className="text-sm text-gray-500 mb-4">¥{qrLink.amount.toLocaleString()}</p>
          {!qrReady && (
            <div className="mx-auto w-[240px] h-[240px] rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center">
              <svg className="animate-spin w-8 h-8 text-sky-400" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
            </div>
          )}
          <canvas
            role="img"
            aria-label={`${qrLink.description} ¥${qrLink.amount.toLocaleString()} の支払いQRコード — URL: ${qrLink.url}`}
            ref={el => {
              (qrCanvasRef as { current: HTMLCanvasElement | null }).current = el;
              if (el && qrLink) {
                setQrReady(false);
                import('qrcode').then(({ default: QRCode }) => {
                  QRCode.toCanvas(el, qrLink.url, { width: Math.min(240, window.innerWidth - 80), margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
                    .then(() => setQrReady(true));
                });
              }
            }}
            className={`mx-auto rounded-xl border border-gray-100 ${qrReady ? '' : 'hidden'}`}
          />
          {qrReady && (
            <p className="text-xs text-gray-400 mt-2">印刷してレジ横やメニューに貼るとスムーズです</p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                const canvas = qrCanvasRef.current;
                if (!canvas) return;
                const a = document.createElement('a');
                a.href = canvas.toDataURL('image/png');
                a.download = `qr_${qrLink.description}.png`;
                a.click();
              }}
              className="flex-1 text-sm bg-sky-600 text-white font-bold py-2.5 rounded-xl hover:bg-sky-500 transition-all"
            >
              PNG保存
            </button>
            <button onClick={() => setQrLink(null)} className="flex-1 text-sm text-gray-600 border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50 transition-all">
              閉じる
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
