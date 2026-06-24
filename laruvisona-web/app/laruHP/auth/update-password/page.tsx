'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';

function UpdatePasswordContent() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null); // null = checking
  const [token, setToken] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const t = searchParams.get('token');
    if (!t) {
      setTokenValid(false);
      setError('リンクが無効です。パスワードリセットをやり直してください。');
      return;
    }
    setToken(t);
    // トークンは submit 時にサーバーで検証するだけでよい
    setTokenValid(true);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('パスワードが一致しません'); return; }
    if (password.length < 8) { setError('パスワードは8文字以上で入力してください'); return; }
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/do-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'パスワードの更新に失敗しました');
      setLoading(false);
    } else {
      setDone(true);
      setTimeout(() => router.push('/laruHP/auth/login'), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/laruHP" className="flex items-center justify-center gap-3 mb-10">
          <Image src="/laruhp_logo.png" alt="LARU HP" height={40} width={160} className="h-10 w-auto" />
        </Link>

        <div className="bg-white border border-gray-200 shadow-sm rounded-3xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">新しいパスワードを設定</h1>
          <p className="text-gray-600 text-sm mb-8">8文字以上のパスワードを設定してください</p>

          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="text-emerald-700 font-bold">パスワードを更新しました</p>
              <p className="text-gray-600 text-sm mt-2">ログイン画面に移動します...</p>
            </div>
          ) : tokenValid === null ? (
            <div className="text-center py-8 text-gray-500 text-sm">確認中...</div>
          ) : tokenValid === false ? (
            <div className="text-center py-4">
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <Link href="/laruHP/auth/reset-password" className="text-sky-600 hover:text-sky-500 text-sm">
                パスワードリセットをやり直す →
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-6">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">新しいパスワード</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="8文字以上"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">パスワード（確認）</label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="もう一度入力"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-sky-600 text-white py-4 rounded-xl font-bold text-base hover:bg-sky-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '更新中...' : 'パスワードを更新'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-sky-50 flex items-center justify-center">
        <div className="text-gray-600 text-sm">読み込み中...</div>
      </div>
    }>
      <UpdatePasswordContent />
    </Suspense>
  );
}
