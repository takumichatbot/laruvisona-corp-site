'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/laruHP/auth/update-password`,
    });
    if (error) {
      setError('エラーが発生しました。メールアドレスをご確認ください。');
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/laruHP" className="flex items-center justify-center gap-3 mb-10">
          <Image src="/laruhp_logo.png" alt="LARU HP" height={40} width={160} className="h-10 w-auto" style={{ width: 'auto' }} />
        </Link>

        <div className="bg-white border border-gray-200 shadow-sm rounded-3xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">パスワードをリセット</h1>
          <p className="text-gray-600 text-sm mb-8">
            登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
          </p>

          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-700"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <p className="text-emerald-700 font-bold mb-2">メールを送信しました</p>
              <p className="text-gray-600 text-sm">
                受信トレイをご確認ください。<br />
                メールが届かない場合はスパムフォルダもご確認ください。
              </p>
              <Link href="/laruHP/auth/login" className="text-sky-600 hover:text-sky-500 text-sm mt-8 block">
                ← ログインに戻る
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
                  <label className="block text-sm font-bold text-gray-900 mb-2">メールアドレス</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-sky-600 text-white py-4 rounded-xl font-bold text-base hover:bg-sky-500 transition-all disabled:opacity-50"
                >
                  {loading ? '送信中...' : 'リセットメールを送信'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          <Link href="/laruHP/auth/login" className="text-sky-600 hover:text-sky-500">← ログインに戻る</Link>
        </p>
      </div>
    </div>
  );
}
