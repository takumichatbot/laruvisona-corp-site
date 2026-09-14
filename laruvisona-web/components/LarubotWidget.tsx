'use client';

import { useEffect } from 'react';
import { isLaruHpHost } from '@/lib/laruhp-host';

/**
 * LARUbot AIチャットボットのランチャーを全ページに読み込むコンポーネント。
 * - 会社用IDは NEXT_PUBLIC_LARUBOT_PUBLIC_ID、LARU HP専用IDは
 *   NEXT_PUBLIC_LARUHP_BOT_PUBLIC_ID から取得する。ブランドを混在させないため、
 *   LARU HPホストでは専用IDが無い限りランチャーを出さない。
 * - トップページのイントロ演出中はウィジェットを出さず、完了後に遅延ロードする。
 * - 別プロダクト領域（/laruHP・公開HP /hp）は各自のembedを持つため対象外。
 */
/**
 * embed.js は内部で requestIdleCallback を使ってランチャーを生成する。
 * トップページの3D描画（連続rAF）でメインスレッドがidleにならず、
 * この idle コールバックが発火せずランチャーが出ないことがある。
 * idle を尊重しつつ、最大800msで確実に発火するフォールバックを一度だけ適用する。
 */
function ensureIdleCallback() {
  const w = window as unknown as { __lvRICPatched?: boolean; requestIdleCallback?: (cb: (d: unknown) => void, opts?: { timeout?: number }) => number };
  if (w.__lvRICPatched) return;
  w.__lvRICPatched = true;
  const native = typeof w.requestIdleCallback === 'function' ? w.requestIdleCallback.bind(w) : null;
  w.requestIdleCallback = (cb, opts) => {
    let done = false;
    const run = (arg: unknown) => { if (done) return; done = true; try { cb(arg); } catch { /* noop */ } };
    if (native) native(run, opts);
    setTimeout(() => run({ didTimeout: true, timeRemaining: () => 0 }), (opts && opts.timeout) || 800);
    return 0;
  };
}

export default function LarubotWidget() {
  useEffect(() => {
    const laruHpHost = isLaruHpHost(window.location.hostname);
    const companyId = process.env.NEXT_PUBLIC_LARUBOT_PUBLIC_ID;
    const id = laruHpHost
      ? process.env.NEXT_PUBLIC_LARUHP_BOT_PUBLIC_ID
      : companyId;
    if (!id) return;

    // 会社ホスト上の管理画面と顧客公開サイトには出さない。
    // laruhp.com は外向けの販売・案内サイトなのでLARUbotを使う。
    const path = window.location.pathname;
    if (!laruHpHost && (path.startsWith('/laruHP') || path.startsWith('/hp') || path.endsWith('/reserve'))) return;

    // 二重ロード防止
    if (document.getElementById('larubot-embed-script')) return;

    let injected = false;
    let fallback: ReturnType<typeof setTimeout> | undefined;

    const inject = () => {
      if (injected) return;
      injected = true;
      if (fallback) clearTimeout(fallback);
      if (document.getElementById('larubot-embed-script')) return;
      ensureIdleCallback();
      const s = document.createElement('script');
      s.id = 'larubot-embed-script';
      s.src = 'https://larubot.tokyo/static/embed.js';
      s.setAttribute('data-public-id', id);
      s.defer = true;
      document.body.appendChild(s);
    };

    // トップページで、まだイントロ演出を見ていない場合は完了イベントを待つ
    let introPending = false;
    try {
      introPending = path === '/' && sessionStorage.getItem('lv_intro_seen') !== '1';
    } catch {
      introPending = path === '/';
    }

    if (introPending) {
      window.addEventListener('lv:intro-done', inject, { once: true });
      // 保険: 万一イベントを取りこぼしても必ず注入する
      fallback = setTimeout(inject, 6000);
      return () => {
        window.removeEventListener('lv:intro-done', inject);
        if (fallback) clearTimeout(fallback);
      };
    }

    // イントロの無いページ（下層ページ・再訪）は初期描画の直後に注入
    const t = setTimeout(inject, 600);
    return () => clearTimeout(t);
  }, []);

  return null;
}
