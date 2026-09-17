'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { Award, BadgeCheck, Star } from 'lucide-react';
import AppShell from '@/components/laruhp/AppShell';

interface LoyaltyCard {
  id: string;
  customer_name: string;
  customer_phone?: string;
  stamps: number;
  max_stamps: number;
  reward: string;
  created_at: string;
  last_stamped_at?: string;
}

interface LoyaltyConfig {
  maxStamps: number;
  reward: string;
  cardName: string;
}

interface Site {
  id: string;
  name: string;
}

const DEFAULT_CONFIG: LoyaltyConfig = { maxStamps: 10, reward: '次回10%オフ', cardName: 'スタンプカード' };

async function responseBody(res: Response): Promise<{ error?: string; [key: string]: unknown }> {
  try { return await res.json(); } catch { return {}; }
}

export default function LoyaltyPage() {
  const supabase = createClient();
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [config, setConfig] = useState<LoyaltyConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Issue form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issueMsg, setIssueMsg] = useState('');
  const [newCardUrl, setNewCardUrl] = useState('');
  const qrRef = useRef<HTMLCanvasElement>(null);

  // Config form
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState('');

  // Stamp
  const [stamping, setStamping] = useState<string | null>(null);
  const [celebrationCard, setCelebrationCard] = useState<{ stamps: number; reward: string } | null>(null);
  const [cardSearch, setCardSearch] = useState('');
  const [stampError, setStampError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/laruHP/auth/login'); return; }

      const res = await fetch('/api/sites');
      const d = await responseBody(res);
      if (!res.ok) { setLoadError('サイトを読み込めませんでした。再読み込みしてください'); setLoading(false); return; }
      const s = Array.isArray(d.sites) ? d.sites as Site[] : [];
      setSites(s);
      if (s.length > 0) setSelectedSiteId(s[0].id);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSiteId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/loyalty?siteId=${selectedSiteId}`, { signal: controller.signal });
        const d = await responseBody(res);
        if (!res.ok) throw Error();
        setCards(Array.isArray(d.cards) ? d.cards as LoyaltyCard[] : []);
        setConfig(d.config && typeof d.config === 'object' ? d.config as LoyaltyConfig : DEFAULT_CONFIG);
        setLoadError('');
      } catch {
        if (!controller.signal.aborted) setLoadError('ポイントカードを読み込めませんでした。再読み込みしてください');
      }
    })();
    return () => controller.abort();
  }, [selectedSiteId]);

  useEffect(() => {
    if (newCardUrl && qrRef.current) {
      QRCode.toCanvas(qrRef.current, newCardUrl, { width: 160, color: { dark: '#0c1a3a', light: '#ffffff' } });
    }
  }, [newCardUrl]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setConfigMsg('');
    try {
      const res = await fetch('/api/loyalty', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'configure', siteId: selectedSiteId, ...config }),
      });
      const d = await responseBody(res);
      setConfigMsg(res.ok ? '設定を保存しました' : d.error || '設定を保存できませんでした');
    } catch { setConfigMsg('通信できませんでした。入力内容は残っています'); }
    finally { setSavingConfig(false); }
    setTimeout(() => setConfigMsg(''), 3000);
  };

  const handleIssue = async () => {
    if (!customerName.trim()) return;
    setIssuing(true);
    setIssueMsg('');
    setNewCardUrl('');
    try {
      const res = await fetch('/api/loyalty', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'issue', siteId: selectedSiteId, customerName: customerName.trim(), customerPhone: customerPhone.trim() }),
      });
      const d = await responseBody(res);
      if (!res.ok || typeof d.cardUrl !== 'string') { setIssueMsg(d.error || 'カードを発行できませんでした'); return; }
      setIssueMsg('カードを発行しました');
      setNewCardUrl(d.cardUrl);
      setCustomerName(''); setCustomerPhone('');
      const r2 = await fetch(`/api/loyalty?siteId=${selectedSiteId}`);
      const d2 = await responseBody(r2);
      if (r2.ok && Array.isArray(d2.cards)) setCards(d2.cards as LoyaltyCard[]);
      else setIssueMsg('カードは発行されました。一覧を再読み込みしてください');
    } catch { setIssueMsg('通信できませんでした。入力内容は残っています'); }
    finally { setIssuing(false); }
  };

  const handleStamp = async (cardId: string) => {
    setStamping(cardId);
    setStampError('');
    try {
      const res = await fetch(`/api/loyalty?cardId=${cardId}`, { method: 'PATCH' });
      const d = await responseBody(res);
      if (!res.ok || typeof d.stamps !== 'number') { setStampError(d.error || 'ポイントを追加できませんでした'); return; }
      setCards(prev => prev.map(c =>
        c.id === cardId ? { ...c, stamps: d.stamps as number, last_stamped_at: new Date().toISOString() } : c
      ));
      if (d.completed) {
        setCelebrationCard({ stamps: d.stamps, reward: String(d.reward || '') });
      }
    } catch { setStampError('通信できませんでした。もう一度お試しください'); }
    finally { setStamping(null); }
  };

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 transition-colors';

  if (loading) return <div className="min-h-screen bg-sky-50 flex items-center justify-center"><div className="text-gray-500 text-sm">読み込み中...</div></div>;

  const filteredCards = cards.filter(c =>
    !cardSearch || c.customer_name.includes(cardSearch) || (c.customer_phone || '').includes(cardSearch)
  );

  return (
    <AppShell title="デジタルポイントカード">
      {/* Celebration modal */}
      {celebrationCard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <Award className="mx-auto mb-4 h-14 w-14 text-amber-600" aria-hidden="true" />
            <h3 className="font-bold text-xl text-gray-900 mb-2">{celebrationCard.stamps}スタンプ達成！</h3>
            <p className="text-sm text-gray-600 mb-1">特典が付与されました</p>
            <p className="text-base font-bold text-sky-700 mb-6">{celebrationCard.reward}</p>
            <button
              onClick={() => setCelebrationCard(null)}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {loadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>}

        {/* Site picker */}
        {sites.length > 1 && (
          <select
            value={selectedSiteId}
            onChange={e => setSelectedSiteId(e.target.value)}
            aria-label="スタンプカードを表示するサイトを選択"
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-500"
          >
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        <div className="grid lg:grid-cols-2 gap-6">

          {/* Config */}
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
            <h2 className="font-bold text-sm text-gray-900 mb-1">カード設定</h2>
            <p className="text-xs text-gray-500 mb-4">スタンプカードの基本設定を行います</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">カード名</label>
                <input type="text" value={config.cardName} onChange={e => setConfig(c => ({ ...c, cardName: e.target.value }))} className={inputCls} placeholder="スタンプカード" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">必要スタンプ数</label>
                <input type="number" value={config.maxStamps} onChange={e => setConfig(c => ({ ...c, maxStamps: parseInt(e.target.value) || 10 }))} min="1" max="50" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">達成時の特典</label>
                <input type="text" value={config.reward} onChange={e => setConfig(c => ({ ...c, reward: e.target.value }))} className={inputCls} placeholder="次回10%オフ・無料サービスなど" />
              </div>
              {configMsg && <p role="status" className={`text-xs font-semibold ${configMsg === '設定を保存しました' ? 'text-green-600' : 'text-red-600'}`}>{configMsg}</p>}
              <button onClick={handleSaveConfig} disabled={savingConfig} className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
                {savingConfig ? '保存中...' : '設定を保存'}
              </button>
            </div>
          </section>

          {/* Issue new card */}
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
            <h2 className="font-bold text-sm text-gray-900 mb-1">カードを発行</h2>
            <p className="text-xs text-gray-500 mb-4">お客様にデジタルカードを発行します。QRコードを印刷してお渡しください。</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">お名前</label>
                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className={inputCls} placeholder="山田 太郎" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">電話番号（任意）</label>
                <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className={inputCls} placeholder="090-0000-0000" />
              </div>
              {issueMsg && <p role="status" className={`text-xs font-semibold ${issueMsg === 'カードを発行しました' ? 'text-green-600' : 'text-red-600'}`}>{issueMsg}</p>}
              <button onClick={handleIssue} disabled={issuing || !customerName.trim()} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
                {issuing ? '発行中...' : 'カードを発行する'}
              </button>

              {newCardUrl && (
                <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 text-center">
                  <canvas ref={qrRef} className="mx-auto mb-2 rounded-lg" />
                  <div className="text-[10px] font-mono text-gray-500 truncate mb-2 max-w-[200px] mx-auto">{newCardUrl}</div>
                  <button
                    onClick={() => navigator.clipboard.writeText(newCardUrl)}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg transition-all font-bold"
                  >
                    URLをコピー
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Cards list */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-bold text-sm text-gray-900">発行済みカード ({cards.length}件)</h2>
            <input
              type="text"
              value={cardSearch}
              onChange={e => setCardSearch(e.target.value)}
              placeholder="名前・電話で検索"
              className="ml-auto text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-sky-400 text-gray-700 placeholder-gray-400 w-40"
            />
          </div>

          {stampError && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{stampError}</p>}

          {cards.length === 0 ? (
            <div className="text-center py-8">
              <Star className="mx-auto mb-4 h-12 w-12 text-sky-500" aria-hidden="true" />
              <p className="text-sm text-gray-500">まだカードが発行されていません</p>
              <p className="text-xs text-gray-400 mt-1">「カードを発行」フォームから登録してください</p>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400">「{cardSearch}」に一致するカードがありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCards.map(card => {
                const pct = Math.round((card.stamps / card.max_stamps) * 100);
                const isComplete = card.stamps >= card.max_stamps;
                return (
                  <div key={card.id} className={`border rounded-xl p-4 flex items-center gap-4 transition-all ${isComplete ? 'ring-2 ring-yellow-400 shadow-md shadow-yellow-100 bg-yellow-50 border-yellow-200' : 'border-gray-200'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-semibold text-sm text-gray-900">{card.customer_name}</span>
                        {card.customer_phone && <span className="text-xs text-gray-400">{card.customer_phone}</span>}
                        {isComplete && <span className="inline-flex items-center gap-1 text-[10px] bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded-full font-bold"><BadgeCheck className="h-3 w-3" aria-hidden="true" />達成</span>}
                      </div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="flex gap-0.5 flex-wrap max-w-[200px]">
                          {Array.from({ length: card.max_stamps }).map((_, i) => (
                            <div
                              key={i}
                              className={`rounded-full border-2 flex-shrink-0 ${card.max_stamps > 10 ? 'w-3.5 h-3.5' : 'w-5 h-5'} ${i < card.stamps ? 'bg-sky-500 border-sky-500' : 'bg-white border-gray-300'}`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={card.stamps} aria-valuemin={0} aria-valuemax={card.max_stamps} aria-label={`${card.customer_name}のスタンプ: ${card.stamps}/${card.max_stamps}枚`}>
                          <div className="h-full bg-sky-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-500 flex-shrink-0">{card.stamps}/{card.max_stamps}</span>
                      </div>
                      {card.last_stamped_at && (
                        <div className="text-[9px] text-gray-400 mt-1">
                          最終スタンプ: {new Date(card.last_stamped_at).toLocaleDateString('ja-JP')}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleStamp(card.id)}
                      disabled={stamping === card.id || isComplete}
                      className="flex-shrink-0 text-xs bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-3 py-2 rounded-xl transition-all"
                    >
                      {stamping === card.id ? '...' : isComplete ? '完了' : 'スタンプ'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    
    </AppShell>
  );
}
