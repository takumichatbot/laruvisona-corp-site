'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ja">
      <body style={{ margin: 0, background: '#030712', color: '#fff', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>エラーが発生しました</h1>
          <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '14px' }}>問題が自動報告されました。</p>
          <button
            onClick={reset}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
          >
            再試行する
          </button>
        </div>
      </body>
    </html>
  );
}
