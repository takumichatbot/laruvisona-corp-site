'use client';

import { useEffect } from 'react';

export default function PwaInit() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then(async (reg) => {
        // Request push permission after SW registers (non-blocking)
        if ('Notification' in window && Notification.permission === 'default') {
          const perm = await Notification.requestPermission();
          if (perm === 'granted' && 'PushManager' in window) {
            try {
              const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
              });
              await fetch('/api/pwa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: sub }),
              });
            } catch { /* vapid not configured or user blocked */ }
          }
        }
      })
      .catch(() => { /* silently ignore */ });
  }, []);

  return null;
}
