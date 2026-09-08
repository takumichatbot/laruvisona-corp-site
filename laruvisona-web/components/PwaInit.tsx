'use client';

import { useEffect } from 'react';

/**
 * Service Worker の登録だけを行う。
 *
 * 以前はここで Notification.requestPermission() を無条件に呼んでいた。
 * このコンポーネントは /laruHP のレイアウトに置かれているため、
 * 広告や検索から来た人がランディングページを開いた瞬間、まだ何も理解しないうちに
 * 「通知を許可しますか？」が出ていた。ユーザー操作を伴わない通知許可の要求は
 * ブラウザ側でも抑制の対象で、LPでは離脱要因にしかならない。
 *
 * 通知が必要なのはログイン後の管理画面なので、許可を求めるのは
 * 利用者が明示的に「通知を受け取る」を押したときだけにする。
 * そのための関数を requestPushPermission() として公開しておく。
 */
export default function PwaInit() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => { /* 失敗しても何もしない */ });
  }, []);

  return null;
}

/**
 * 通知の購読。必ず利用者の操作（ボタン押下）から呼ぶこと。
 * 勝手に呼ばない。
 */
export async function requestPushPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
    return 'unsupported';
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });
    await fetch('/api/pwa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub }),
    });
    return 'granted';
  } catch {
    return 'denied';
  }
}
