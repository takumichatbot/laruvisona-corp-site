'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ResetInner() {
  const sp = useSearchParams();
  const token = sp.get('token') || '';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) { setError('パスワードは6文字以上にしてください'); return; }
    if (pw !== pw2) { setError('パスワードが一致しません'); return; }
    setStatus('sending'); setError('');
    try {
      const res = await fetch('/api/hp/members/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw }),
      });
      const d = await res.json();
      if (res.ok && d.token) setStatus('done');
      else { setError(d.error || '再設定に失敗しました'); setStatus('error'); }
    } catch { setError('通信エラーが発生しました'); setStatus('error'); }
  };

  const card: React.CSSProperties = { maxWidth: 400, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28 };
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 10, marginBottom: 10, boxSizing: 'border-box' };

  if (!token) return <div style={card}><p style={{ color: '#dc2626', fontSize: 14 }}>リンクが正しくありません。</p></div>;
  if (status === 'done') return <div style={card}><div style={{ fontSize: 32, textAlign: 'center' }}>✅</div><p style={{ textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>パスワードを再設定しました</p><p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, marginTop: 8 }}>元のページに戻ってログインしてください。</p></div>;

  return (
    <form onSubmit={submit} style={card}>
      <h1 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 0 }}>新しいパスワードを設定</h1>
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="新しいパスワード（6文字以上）" style={input} />
      <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="新しいパスワード（確認）" style={input} />
      {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0' }}>{error}</p>}
      <button type="submit" disabled={status === 'sending'} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#0369a1', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
        {status === 'sending' ? '送信中...' : '再設定する'}
      </button>
    </form>
  );
}

export default function MemberResetPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <Suspense fallback={<div style={{ color: '#94a3b8' }}>読み込み中...</div>}>
        <ResetInner />
      </Suspense>
    </main>
  );
}
