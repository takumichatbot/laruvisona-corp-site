'use client';

// スマホ用の編集画面。
//
// ビルダーはドラッグ&ドロップ前提で、スマホでは MobileOverlay が出て使えない。
// これは判断として妥当だが、「店番の合間に営業時間と写真の説明だけ直したい」
// という一番多い用途まで塞いでしまっていた。
//
// そこでスマホでは「作れないが、直せる」を成立させる。
// できること: 文章の書き換え、ブロックの並べ替え、保存、公開。
// できないこと: ブロックの追加・削除、レイアウト変更、画像の差し替え。
// 迷ったら「壊せないこと」を優先している。

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

type Block = { id: string; type: string; data: Record<string, unknown> };
type Page = { id: string; name: string; blocks: Block[] };
type SiteRow = {
  id: string; name: string; published: boolean;
  blocks_json: Block[] | { v: number; pages: Page[] };
  seo_json: unknown; settings_json: unknown;
};

const TYPE_LABEL: Record<string, string> = {
  nav: 'ナビ', hero: 'ヒーロー（先頭の大見出し）', heading: '見出し', paragraph: '本文',
  image: '画像', 'two-col': '2カラム', 'three-col': '3カラム', divider: '区切り線',
  cta: '行動喚起', services: 'サービス一覧', testimonials: 'お客様の声', faq: 'よくある質問',
  contact: 'お問い合わせ', hours: '営業時間', gallery: 'ギャラリー', larubot: 'AIチャット',
  video: '動画', map: '地図', countdown: 'カウントダウン', 'price-table': '料金表',
  booking: '予約', news: 'お知らせ', popup: 'ポップアップ', newsletter: 'メール登録',
  share: 'シェア', 'stripe-buy': '購入ボタン', 'google-reviews': 'Googleクチコミ',
  'announcement-bar': 'お知らせバー', instagram: 'Instagram', 'before-after': 'ビフォーアフター',
  tabs: 'タブ', team: 'スタッフ紹介', free: 'フリーレイアウト', 'shop-grid': '商品一覧',
  'shop-item': '商品', 'member-gate': '会員限定',
};

const KEY_LABEL: Record<string, string> = {
  heading: '見出し', subheading: 'サブ見出し', subtext: '補足', teaser: '導入文',
  text: '本文', content: '本文', body: '本文', title: 'タイトル', description: '説明',
  name: '名前', role: '肩書き', bio: '紹介文', price: '価格', period: '単位',
  label: 'ラベル', caption: 'キャプション', buttonText: 'ボタンの文言', ctaText: 'ボタンの文言',
  q: '質問', a: '回答', address: '住所', phone: '電話番号', email: 'メール',
  col1Title: '左の見出し', col1Text: '左の本文', col2Title: '右の見出し', col2Text: '右の本文',
  beforeLabel: 'ビフォーの見出し', afterLabel: 'アフターの見出し', variantLabel: '選択肢の名前',
};

// 文章として編集してよい値だけを拾う。色・画像・URL・ID・レイアウト指定は触らせない。
const SKIP_KEY = /color|image|src|url|link|href|icon|font|align|layout|variant$|size|width|height|radius|opacity|columns|priceId|publicId|^id$|Id$|enabled|abVariant|slot|json|trigger|css|token|secret/i;

function isText(k: string, v: unknown): v is string {
  return typeof v === 'string'
    && v.length <= 2000
    && !SKIP_KEY.test(k)
    && !/^#[0-9a-fA-F]{3,8}$/.test(v)
    && !/^https?:\/\//i.test(v)
    && !/^data:/i.test(v);
}

function keyLabel(k: string) { return KEY_LABEL[k] || k; }

export default function MobileEditPage() {
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [site, setSite] = useState<SiteRow | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  // 一覧 → 先頭（または ?site=）を読み込む
  useEffect(() => {
    (async () => {
      try {
        const list = await fetch('/api/sites').then(r => r.json());
        const arr: { id: string; name: string }[] = list.sites || [];
        setSites(arr);
        const wanted = new URLSearchParams(location.search).get('site') || arr[0]?.id;
        if (!wanted) { setLoading(false); return; }
        await load(wanted);
      } catch {
        setNote('読み込みに失敗しました');
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (id: string) => {
    const res = await fetch(`/api/sites/${id}`);
    if (!res.ok) { setNote('このサイトを開けませんでした'); return; }
    const { site: s } = await res.json() as { site: SiteRow };
    setSite(s);
    // blocks_json は v1(配列) と v2({pages}) の両方がある
    const bj = s.blocks_json;
    const ps: Page[] = Array.isArray(bj)
      ? [{ id: 'home', name: 'トップ', blocks: bj }]
      : (bj?.pages || []);
    setPages(ps);
    setPageIdx(0);
    setDirty(false);
  }, []);

  // 離脱ガード
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const setField = (blockId: string, path: (string | number)[], value: string) => {
    setPages(prev => prev.map((p, i) => i !== pageIdx ? p : {
      ...p,
      blocks: p.blocks.map(b => {
        if (b.id !== blockId) return b;
        const data = structuredClone(b.data) as Record<string, unknown>;
        let node: Record<string, unknown> | unknown[] = data;
        for (let k = 0; k < path.length - 1; k++) {
          node = (node as Record<string, unknown>)[path[k] as string] as Record<string, unknown>;
        }
        (node as Record<string, unknown>)[path[path.length - 1] as string] = value;
        return { ...b, data };
      }),
    }));
    setDirty(true);
  };

  const move = (blockId: string, dir: -1 | 1) => {
    setPages(prev => prev.map((p, i) => {
      if (i !== pageIdx) return p;
      const blocks = [...p.blocks];
      const at = blocks.findIndex(b => b.id === blockId);
      const to = at + dir;
      if (at < 0 || to < 0 || to >= blocks.length) return p;
      [blocks[at], blocks[to]] = [blocks[to], blocks[at]];
      return { ...p, blocks };
    }));
    setDirty(true);
  };

  const save = async () => {
    if (!site) return;
    setSaving(true); setNote('');
    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: site.name,
          blocks_json: { v: 2, pages },
          seo_json: site.seo_json,
          settings_json: site.settings_json,
        }),
      });
      if (!res.ok) throw new Error(`保存エラー (${res.status})`);
      setDirty(false);
      setNote('保存しました');
    } catch (e) {
      setNote(e instanceof Error ? e.message : '保存に失敗しました');
    }
    setSaving(false);
  };

  const publish = async () => {
    if (!site) return;
    setSaving(true); setNote('');
    try {
      if (dirty) {
        const r = await fetch(`/api/sites/${site.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: site.name, blocks_json: { v: 2, pages }, seo_json: site.seo_json, settings_json: site.settings_json }),
        });
        if (!r.ok) throw new Error(`保存エラー (${r.status})`);
        setDirty(false);
      }
      const res = await fetch(`/api/sites/${site.id}/publish`, { method: 'POST' });
      if (!res.ok) throw new Error(`公開エラー (${res.status})`);
      setNote('公開しました');
    } catch (e) {
      setNote(e instanceof Error ? e.message : '公開に失敗しました');
    }
    setSaving(false);
  };

  const page = pages[pageIdx];

  return (
    <div className="laru-touch min-h-screen bg-sky-50 text-gray-900 pb-28">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-sky-100 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/laruHP/dashboard" className="text-sm text-gray-500">← 戻る</Link>
          <span className="text-sm font-bold truncate">{site?.name || 'スマホ編集'}</span>
        </div>
        {sites.length > 1 && (
          <select
            value={site?.id || ''}
            onChange={e => { setLoading(true); load(e.target.value).finally(() => setLoading(false)); }}
            className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 bg-white"
          >
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </header>

      <main className="px-4 py-4">
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          スマホでは<strong>文章の書き換えと並べ替え</strong>ができます。
          ブロックの追加・削除やデザインの変更はパソコンのビルダーから行ってください。
        </p>

        {loading && <p className="text-sm text-gray-400">読み込み中…</p>}
        {!loading && !site && <p className="text-sm text-gray-500">編集できるサイトがありません。</p>}

        {pages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto mb-4">
            {pages.map((p, i) => (
              <button key={p.id} onClick={() => setPageIdx(i)}
                className={`px-3 py-2 rounded-lg text-xs whitespace-nowrap border ${i === pageIdx ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {page?.blocks.map((b, i) => {
            const entries = Object.entries(b.data || {});
            const texts = entries.filter(([k, v]) => isText(k, v)) as [string, string][];
            const lists = entries.filter(([, v]) =>
              Array.isArray(v) && v.length > 0 && v.every(o => o && typeof o === 'object' && !Array.isArray(o))
            ) as [string, Record<string, unknown>[]][];
            if (texts.length === 0 && lists.length === 0) return null;
            return (
              <section key={b.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold text-gray-900">{TYPE_LABEL[b.type] || b.type}</h2>
                  <div className="flex gap-1">
                    <button onClick={() => move(b.id, -1)} disabled={i === 0}
                      aria-label="ひとつ上へ"
                      className="w-11 h-11 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30">↑</button>
                    <button onClick={() => move(b.id, 1)} disabled={i === (page?.blocks.length ?? 0) - 1}
                      aria-label="ひとつ下へ"
                      className="w-11 h-11 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30">↓</button>
                  </div>
                </div>

                {texts.map(([k, v]) => (
                  <label key={k} className="block mb-3">
                    <span className="block text-[11px] text-gray-500 mb-1">{keyLabel(k)}</span>
                    {v.length > 60 || v.includes('\n') ? (
                      <textarea rows={4} value={v} onChange={e => setField(b.id, [k], e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white" />
                    ) : (
                      <input type="text" value={v} onChange={e => setField(b.id, [k], e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white" />
                    )}
                  </label>
                ))}

                {lists.map(([listKey, items]) => (
                  <div key={listKey} className="mt-2">
                    <div className="text-[11px] font-bold text-gray-600 mb-2">{keyLabel(listKey)}（{items.length}件）</div>
                    {items.map((item, idx) => {
                      const fields = Object.entries(item).filter(([k, v]) => isText(k, v)) as [string, string][];
                      if (!fields.length) return null;
                      return (
                        <div key={idx} className="border-l-2 border-sky-100 pl-3 mb-3">
                          {fields.map(([k, v]) => (
                            <label key={k} className="block mb-2">
                              <span className="block text-[11px] text-gray-500 mb-1">{keyLabel(k)}</span>
                              {v.length > 60 || v.includes('\n') ? (
                                <textarea rows={3} value={v} onChange={e => setField(b.id, [listKey, idx, k], e.target.value)}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white" />
                              ) : (
                                <input type="text" value={v} onChange={e => setField(b.id, [listKey, idx, k], e.target.value)}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white" />
                              )}
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </main>

      {site && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3">
          {note && <p className="text-[11px] text-gray-600 mb-2">{note}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !dirty}
              className="flex-1 border border-sky-600 text-sky-700 font-bold rounded-xl py-3 disabled:opacity-40">
              {saving ? '処理中…' : dirty ? '保存' : '保存済み'}
            </button>
            <button onClick={publish} disabled={saving}
              className="flex-1 bg-sky-600 text-white font-bold rounded-xl py-3 disabled:opacity-40">
              保存して公開
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
