"use client";
import { useEffect, useRef, useState } from 'react';
import { parseCompositionTransfer } from '@/lib/composition-transfer';
import { storeComposition } from '@/lib/studio-composition';
export default function ContinueCreation() {
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => {
    if (started.current) return;
    started.current = true;
    const choice = parseCompositionTransfer(window.location.hash);
    history.replaceState(history.state, '', window.location.pathname);
    if (!choice) { setError('引き継ぐ内容を確認できませんでした。案内ページからもう一度お試しください。'); return; }
    const id = storeComposition(choice);
    if (!id) { setError('内容を引き継げませんでした。ブラウザの保存設定をご確認ください。'); return; }
    window.location.replace(`/laruHP/studio?creation=${encodeURIComponent(id)}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return <main style={{maxWidth: 560, margin: '100px auto', padding: 24}}>
    <h1>制作スタジオへ</h1>
    <p role="status">{error || '写真・文章・見せ方を引き継いでいます…'}</p>
    {error && <a href="https://laruhp.com/#experience">案内ページに戻る</a>}
  </main>;
}
