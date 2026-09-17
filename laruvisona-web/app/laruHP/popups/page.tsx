'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { popupButtonUrl } from '@/lib/popup-contract';
import AppShell from '@/components/laruhp/AppShell';

interface PopupConfig {
  id: string;
  title: string;
  body: string;
  buttonText: string;
  buttonUrl: string;
  trigger: 'exit' | 'scroll' | 'timer';
  triggerValue: number; // scroll% or seconds
  bgColor: string;
  textColor: string;
  enabled: boolean;
  createdAt: string;
  maxShows?: number;    // 0 = unlimited
  hideForDays?: number; // 0 = no cooldown
}

interface Site {
  id: string;
  name: string;
  slug: string | null;
  settings_json: Record<string, unknown> | null;
}

const TRIGGER_LABELS: Record<string, string> = {
  exit: '離脱意図（マウスが画面外）',
  scroll: 'スクロール到達',
  timer: '表示後の秒数',
};

const DEFAULT_POPUP: Omit<PopupConfig, 'id' | 'createdAt' | 'enabled'> = {
  title: '今なら無料相談実施中！',
  body: 'お気軽にご連絡ください。専門スタッフが丁寧にご対応します。',
  buttonText: '無料で相談する',
  buttonUrl: '#contact',
  trigger: 'timer',
  triggerValue: 10,
  bgColor: '#0c1a3a',
  textColor: '#ffffff',
  maxShows: 0,
  hideForDays: 7,
};

export default function PopupsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [popups, setPopups] = useState<PopupConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Form state
  const [form, setForm] = useState<Omit<PopupConfig, 'id' | 'createdAt' | 'enabled'>>(DEFAULT_POPUP);
  const [triggerInlineError, setTriggerInlineError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  /*
    読み込みに失敗しても、必ず読み込み中を解く。

    以前は成功したときだけ setLoading(false) していた。通信が落ちると
    **画面は「読み込み中…」のまま永久に止まり、理由も再試行の導線も出ない。**
    店主にできるのは、閉じることだけ。
  */
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/laruHP/auth/login'); return; }

        const res = await fetch('/api/sites');
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json();
        const s: Site[] = d.sites || [];
        setSites(s);
        if (s.length > 0) {
          setSelectedSite(s[0]);
          const existing = (s[0].settings_json?.popups as PopupConfig[]) || [];
          setPopups(existing);
        }
      } catch {
        setLoadError('読み込めませんでした。通信を確かめて、もう一度お試しください');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePopups = async (newPopups: PopupConfig[]) => {
    if (!selectedSite) return false;
    setSaving(true);
    setMsg('');
    const settings = selectedSite.settings_json || {};
    let res: Response;
    try {
      res = await fetch(`/api/sites/${selectedSite.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings_patch: { popups: newPopups } }),
      });
    } catch {
      setMsg('接続できませんでした。入力内容を保ったまま、もう一度お試しください。');
      setSaving(false);
      return false;
    }
    if (res.ok) {
      setMsg('保存しました');
      setPopups(newPopups);
      setSelectedSite(prev => prev ? { ...prev, settings_json: { ...settings, popups: newPopups } } : prev);
      setSites(prev => prev.map(site => site.id === selectedSite.id
        ? { ...site, settings_json: { ...(site.settings_json || {}), popups: newPopups } }
        : site));
      setTimeout(() => setMsg(''), 3000);
      setSaving(false);
      return true;
    } else {
      setMsg('エラーが発生しました');
    }
    setSaving(false);
    return false;
  };

  const handleAdd = async () => {
    if (!form.title.trim()) { setMsg('タイトルを入力してください'); return; }
    if (form.trigger === 'scroll' && (form.triggerValue < 1 || form.triggerValue > 100)) {
      setMsg('スクロール値は1〜100%の範囲で入力してください');
      return;
    }
    if (form.trigger === 'timer' && (form.triggerValue < 1 || form.triggerValue > 120)) {
      setMsg('タイマー値は1〜120秒の範囲で入力してください');
      return;
    }
    if ((form.maxShows ?? 0) < 0 || (form.maxShows ?? 0) > 1000) { setMsg('最大表示回数は0〜1000回で入力してください'); return; }
    if ((form.hideForDays ?? 0) < 0 || (form.hideForDays ?? 0) > 365) { setMsg('非表示期間は0〜365日で入力してください'); return; }
    if (form.buttonUrl && popupButtonUrl(form.buttonUrl) === '#' && form.buttonUrl !== '#') {
      setMsg('リンク先はページ内リンク、同じサイトのパス、HTTPS、メール、電話を指定してください'); return;
    }
    const newPopup: PopupConfig = {
      ...form,
      id: Date.now().toString(),
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    const next = [...popups, newPopup];
    if (await savePopups(next)) setForm(DEFAULT_POPUP);
  };

  const handleToggle = async (id: string) => {
    const next = popups.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p);
    await savePopups(next);
  };

  const handleDelete = async (id: string) => {
    const next = popups.filter(p => p.id !== id);
    await savePopups(next);
  };

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 transition-colors';

  if (loading) return <div className="min-h-screen bg-sky-50 flex items-center justify-center"><div className="text-gray-500 text-sm">読み込み中...</div></div>;

  return (
    <AppShell title="ポップアップ/バナービルダー">
      {loadError && (
        <div role="alert" className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-3">
          <span className="flex-1">{loadError}</span>
          <button onClick={() => location.reload()} className="shrink-0 rounded-lg border border-red-300 px-3 py-1 text-xs font-bold hover:bg-red-100">
            再読み込み
          </button>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Site picker */}
        {sites.length > 1 && (
          <select
            value={selectedSite?.id || ''}
            onChange={e => {
              const s = sites.find(x => x.id === e.target.value) ?? null;
              setSelectedSite(s);
              setPopups((s?.settings_json?.popups as PopupConfig[]) || []);
            }}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-500"
          >
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        {/* Create form */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-sm text-gray-900">新しいポップアップを作成</h2>
              <p className="text-xs text-gray-500 mt-0.5">Exit Intent / スクロール / タイマーで表示</p>
            </div>
            {popups.length > 0 && (
              <button
                onClick={() => {
                  const last = popups[popups.length - 1];
                  setForm({
                    title: last.title, body: last.body, buttonText: last.buttonText, buttonUrl: last.buttonUrl,
                    trigger: last.trigger, triggerValue: last.triggerValue, bgColor: last.bgColor,
                    textColor: last.textColor, maxShows: last.maxShows, hideForDays: last.hideForDays,
                  });
                }}
                className="text-xs text-sky-600 hover:text-sky-500 border border-sky-200 bg-sky-50 px-3 py-1.5 rounded-lg font-semibold transition-all"
                title="最後に作成したポップアップの設定を引き継ぐ"
              >
                前回から複製
              </button>
            )}
            <button
              onClick={() => setShowPreview(v => !v)}
              className="text-xs text-sky-600 hover:text-sky-500 border border-sky-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              {showPreview ? 'フォームに戻る' : 'プレビュー'}
            </button>
          </div>

          {showPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ background: 'linear-gradient(to bottom, #e2e8f0, #d1d8e0)', minHeight: '200px' }}>
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div
                  className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
                  style={{ backgroundColor: form.bgColor, color: form.textColor }}
                >
                  <div className="font-bold text-lg mb-2">{form.title || 'タイトル'}</div>
                  <div className="text-sm opacity-80 mb-4">{form.body || '本文テキスト'}</div>
                  <button
                    className="w-full py-2.5 rounded-xl font-bold text-sm"
                    style={{ backgroundColor: form.textColor, color: form.bgColor }}
                  >
                    {form.buttonText || 'ボタン'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <label className="text-xs font-semibold text-gray-600">トリガー</label>
                    <span
                      className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[9px] font-bold flex items-center justify-center cursor-help flex-shrink-0"
                      title={form.trigger === 'exit' ? '離脱検知: マウスがウィンドウ上部に移動したとき表示します' : form.trigger === 'scroll' ? 'スクロール到達: 設定した割合ページをスクロールしたとき表示します' : 'タイマー: ページを開いてから指定秒数後に表示します'}
                    >?</span>
                  </div>
                  <select
                    value={form.trigger}
                    onChange={e => setForm(f => ({ ...f, trigger: e.target.value as PopupConfig['trigger'] }))}
                    className={inputCls}
                  >
                    {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="popup-triggerValue" className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    {form.trigger === 'timer' ? '表示まで' : form.trigger === 'scroll' ? 'スクロール率' : '設定なし'}
                    {form.trigger === 'exit' && <span className="ml-1 text-[10px] text-sky-600 font-normal">※ PC専用。モバイルは非対応</span>}
                  </label>
                  <div className="relative">
                    <input
                      id="popup-triggerValue"
                      type="number"
                      value={form.triggerValue}
                      onChange={e => {
                        const v = parseInt(e.target.value) || 0;
                        setForm(f => ({ ...f, triggerValue: v }));
                        if (form.trigger === 'scroll') {
                          setTriggerInlineError(v < 1 || v > 100 ? 'スクロール率は1〜100%で入力してください' : '');
                        } else if (form.trigger === 'timer') {
                          setTriggerInlineError(v < 1 || v > 120 ? 'タイマーは1〜120秒で入力してください' : '');
                        } else {
                          setTriggerInlineError('');
                        }
                      }}
                      min={form.trigger === 'exit' ? 0 : 1}
                      max={form.trigger === 'scroll' ? 100 : form.trigger === 'timer' ? 120 : undefined}
                      disabled={form.trigger === 'exit'}
                      className={inputCls + ' pr-10 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-100' + (triggerInlineError ? ' border-red-400' : '')}
                    />
                    {form.trigger !== 'exit' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold pointer-events-none">
                        {form.trigger === 'scroll' ? '%' : form.trigger === 'timer' ? '秒' : ''}
                      </span>
                    )}
                  </div>
                  {triggerInlineError && (
                    <p className="text-[10px] text-red-500 mt-1">{triggerInlineError}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">タイトル</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="今なら無料相談実施中！" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">本文</label>
                <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} className={inputCls + ' h-20 resize-none'} placeholder="最大500文字。改行やHTMLタグは使用できません。" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ボタンテキスト</label>
                  <input type="text" value={form.buttonText} onChange={e => setForm(f => ({ ...f, buttonText: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">リンク先</label>
                  <input type="text" value={form.buttonUrl} onChange={e => setForm(f => ({ ...f, buttonUrl: e.target.value }))} className={inputCls} placeholder="#contact" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">最大表示回数（0=無制限）</label>
                  <input
                    type="number"
                    value={form.maxShows ?? 0}
                    onChange={e => setForm(f => ({ ...f, maxShows: parseInt(e.target.value) || 0 }))}
                    min="0"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">非表示期間（日）</label>
                  <input
                    type="number"
                    value={form.hideForDays ?? 7}
                    onChange={e => setForm(f => ({ ...f, hideForDays: parseInt(e.target.value) || 0 }))}
                    min="0"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="popup-bgColor" className="text-xs font-semibold text-gray-600 mb-1.5 block">背景色</label>
                  <div className="flex gap-2 items-center">
                    <input id="popup-bgColor" type="color" value={form.bgColor} onChange={e => setForm(f => ({ ...f, bgColor: e.target.value }))} className="h-10 w-16 rounded-lg border border-gray-200 cursor-pointer" aria-label="背景色を選択" />
                    <span className="text-xs text-gray-500 font-mono">{form.bgColor}</span>
                  </div>
                </div>
                <div>
                  <label htmlFor="popup-textColor" className="text-xs font-semibold text-gray-600 mb-1.5 block">テキスト色</label>
                  <div className="flex gap-2 items-center">
                    <input id="popup-textColor" type="color" value={form.textColor} onChange={e => setForm(f => ({ ...f, textColor: e.target.value }))} className="h-10 w-16 rounded-lg border border-gray-200 cursor-pointer" aria-label="テキスト色を選択" />
                    <span className="text-xs text-gray-500 font-mono">{form.textColor}</span>
                  </div>
                </div>
              </div>

              {msg && <p className={`text-xs font-semibold ${msg.startsWith('エラー') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}

              <button
                onClick={handleAdd}
                disabled={saving || !form.title}
                className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
              >
                {saving ? '保存中...' : 'ポップアップを追加'}
              </button>
            </div>
          )}
        </section>

        {/* List */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-sm text-gray-900 mb-4">設定済みポップアップ ({popups.length}件)</h2>

          {/* Trigger breakdown */}
          {popups.length >= 2 && (() => {
            const total = popups.length;
            const breakdown = (['exit', 'scroll', 'timer'] as const).map(t => ({
              label: TRIGGER_LABELS[t],
              count: popups.filter(p => p.trigger === t).length,
              enabled: popups.filter(p => p.trigger === t && p.enabled).length,
            })).filter(b => b.count > 0);
            return (
              <div className="flex gap-2 mb-4 flex-wrap">
                {breakdown.map(b => (
                  <div key={b.label} className="flex-1 min-w-[80px] bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-center">
                    <p className="text-lg font-bold text-gray-800">{b.count}</p>
                    <p className="text-[10px] text-gray-500">{b.label}</p>
                    <div className="w-full bg-gray-200 rounded-full h-1 mt-1 overflow-hidden">
                      <div className="bg-sky-500 h-1 rounded-full" style={{ width: `${(b.count / total) * 100}%` }} />
                    </div>
                    <p className="text-[9px] text-gray-400 mt-0.5">有効 {b.enabled}/{b.count}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {popups.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto mb-3 text-gray-300" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3v-3A2.5 2.5 0 0 1 4 12.5z"/></svg>
              <p className="text-sm text-gray-500">まだポップアップがありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {popups.map(popup => (
                <div key={popup.id} className={`border rounded-xl p-4 flex items-start gap-3 transition-colors ${popup.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-gray-900 truncate">{popup.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${popup.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {popup.enabled ? '有効' : '無効'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mb-1.5 truncate">{popup.body}</div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      <span>{TRIGGER_LABELS[popup.trigger]}{popup.trigger !== 'exit' ? ` (${popup.triggerValue}${popup.trigger === 'timer' ? '秒' : '%'})` : ''}</span>
                      <span>→ {popup.buttonText}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(popup.id)}
                      className={`text-[10px] px-2 py-1 rounded-lg border font-bold transition-all ${popup.enabled ? 'border-gray-200 text-gray-500 hover:border-amber-200 hover:text-amber-700' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
                    >
                      {popup.enabled ? '無効化' : '有効化'}
                    </button>
                    <button
                      onClick={() => handleDelete(popup.id)}
                      aria-label={`「${popup.title}」を削除`}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Published behavior */}
        {selectedSite?.slug && (
          <section className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
            <h3 className="font-bold text-sm text-indigo-900 mb-2">公開サイトへの反映</h3>
            <p className="text-xs text-indigo-700 leading-relaxed">
              有効にしたポップアップは、次にサイトを公開した時点から自動で表示されます。埋め込みコードの操作は必要ありません。
            </p>
          </section>
        )}

      </div>
    
    </AppShell>
  );
}
