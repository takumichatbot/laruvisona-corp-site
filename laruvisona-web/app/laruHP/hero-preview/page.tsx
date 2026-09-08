'use client';

// 管理者専用。LPファーストビュー用の映像候補を「実際の見出しの裏に敷いた状態」で
// 見比べて、1案を採用するためのページ。
//
// なぜ必要か: 動画を単体で開いても、見出しの可読性・ページの明るさとの馴染み・
// 動きの強さは判断できない。前回はそこを確かめずに1本に決めてしまい、
// 「LARU HPと関係ない映像」を本番に載せてしまった。同じ間違いを防ぐための場所。
//
// 認証はサーバー側の管理APIに任せる。403が返ればここは何も出さない。

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Variant = { variant: string; exists: boolean; url: string; prompt: string };
type ListRes = { variants: Variant[]; current: { exists: boolean; url: string } };

const LABEL: Record<string, string> = {
  paper: '紙が整列する',
  blueprint: '光の線が矩形を組む',
  glass: 'すりガラスが重なる',
};

const api = (body: unknown) =>
  fetch('/api/admin/generate-video-library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export default function HeroPreviewPage() {
  const [data, setData] = useState<ListRes | null>(null);
  const [denied, setDenied] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(30);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    api({ action: 'list-hero-variants' })
      .then(async r => {
        if (r.status === 403) { setDenied(true); return; }
        const j = (await r.json()) as ListRes;
        setData(j);
        setSel(j.variants.find(v => v.exists)?.variant ?? null);
      })
      .catch(() => setDenied(true));
  }, []);

  // 選び直したら確実に再生し直す（src差し替えだけだと止まったままのブラウザがある）
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.load();
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, [sel]);

  const current = data?.variants.find(v => v.variant === sel) || null;

  const promote = async () => {
    if (!sel) return;
    setBusy(true); setMsg('');
    const r = await api({ action: 'promote-hero', variant: sel });
    const j = await r.json();
    setBusy(false);
    setMsg(r.ok ? `「${LABEL[sel] ?? sel}」を決定版にしました。不透明度は ${opacity}% を採用値として伝えてください。` : `失敗: ${j.error ?? r.status}`);
  };

  if (denied) {
    return (
      <main className="min-h-screen grid place-items-center bg-sky-50 text-gray-900 px-6">
        <p className="text-center leading-relaxed">
          管理者としてログインしてください。<br />
          <Link href="/laruHP/auth/login" className="text-sky-700 underline">ログインへ</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sky-50 text-gray-900">
      {/* 操作パネル */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-sky-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3">
          <span className="font-bold text-sm">ヒーロー映像の見比べ</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSel(null)}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium border transition ${sel === null ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-sky-300 hover:bg-sky-50'}`}
            >映像なし</button>
            {(data?.variants ?? []).map(v => (
              <button
                key={v.variant}
                disabled={!v.exists}
                onClick={() => setSel(v.variant)}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium border transition disabled:opacity-40 ${sel === v.variant ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-sky-300 hover:bg-sky-50'}`}
              >{LABEL[v.variant] ?? v.variant}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm ml-auto">
            濃さ
            <input
              type="range" min={0} max={60} value={opacity}
              onChange={e => setOpacity(Number(e.target.value))}
              className="w-32"
            />
            <span className="tabular-nums w-10">{opacity}%</span>
          </label>
          <button
            onClick={promote}
            disabled={!sel || busy}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold disabled:opacity-40"
          >{busy ? '反映中…' : 'この案を採用'}</button>
        </div>
        {msg && <p className="max-w-5xl mx-auto mt-2 text-sm text-sky-800">{msg}</p>}
      </div>

      {/* 本番のファーストビューと同じ構成の再現 */}
      <section className="pt-28 md:pt-36 pb-16 md:pb-28 px-6 text-center relative overflow-hidden">
        {current && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <video
              ref={videoRef}
              src={current.url}
              autoPlay muted loop playsInline preload="auto"
              className="w-full h-full object-cover"
              style={{ opacity: opacity / 100 }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-sky-50/70 via-sky-50/40 to-sky-50/85" />
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.12),transparent_65%)]" />
          <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full bg-sky-400/8 blur-3xl" />
          <div className="absolute top-32 right-1/4 w-56 h-56 rounded-full bg-sky-300/8 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(#0284c7 1px,transparent 1px),linear-gradient(90deg,#0284c7 1px,transparent 1px)', backgroundSize: '80px 80px' }} />
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2.5 bg-sky-100/90 backdrop-blur-sm border border-sky-300 px-5 py-2.5 rounded-full text-sky-700 text-xs font-medium tracking-widest mb-10">
            新登場 — AI搭載 HPビルダー 2026
          </div>
          <h1 className="text-[2.8rem] sm:text-6xl md:text-[6.5rem] font-bold tracking-tighter mb-6 leading-[1.05] md:leading-[1.02]">
            <span className="block">最高のHPを、</span>
            <span className="block text-sky-600">最短5分で。</span>
          </h1>
          <p className="text-slate-700 text-base md:text-xl mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed">
            業種情報を入力するだけ。AIが<b>5分以内</b>にプロ品質のホームページを自動生成。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <span className="bg-sky-600 text-white px-9 py-4 rounded-2xl font-bold text-base">無料で始める（初月無料）</span>
            <span className="text-sky-700 px-9 py-4 rounded-2xl font-bold text-base border-2 border-sky-600 bg-white">デモを体験</span>
          </div>
        </div>
      </section>

      {/* 判断材料 */}
      <div className="max-w-3xl mx-auto px-6 pb-24 text-sm leading-relaxed text-slate-700">
        <h2 className="font-bold text-gray-900 mb-2">見るべき点</h2>
        <ul className="list-disc pl-5 space-y-1 mb-6">
          <li>見出しが読みにくくなっていないか（濃さを上げて限界を探る）</li>
          <li>暗い部分が出ていないか。ページ全体が明るい配色なので浮く</li>
          <li>動きが強すぎて視線を持っていかれないか</li>
          <li>「組み上がっている」と読めるか。ただ浮いているだけなら没</li>
          <li>文字やUIらしきものが写り込んでいないか（Veoは文字を書けない）</li>
        </ul>
        {current && (
          <>
            <h2 className="font-bold text-gray-900 mb-2">この案のプロンプト</h2>
            <p className="bg-white border border-sky-200 rounded-xl p-4 text-xs text-slate-600 break-words">{current.prompt}</p>
            <p className="mt-3 text-xs">
              単体で見る: <a className="text-sky-700 underline break-all" href={current.url} target="_blank" rel="noreferrer">{current.url}</a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
