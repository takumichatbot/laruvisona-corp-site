'use client';
import { useState } from 'react';
import Link from 'next/link';
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
    <div className="min-h-screen bg-[#030712] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/laruHP" className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-black text-lg">L</div>
          <span className="text-white font-black text-2xl">LARU<span className="text-blue-400 font-light">HP</span></span>
        </Link>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
          <h1 className="text-2xl font-black text-white mb-2">パスワードをリセット</h1>
          <p className="text-slate-400 text-sm mb-8">
            登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
          </p>

          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <p className="text-green-400 font-bold mb-2">メールを送信しました</p>
              <p className="text-slate-400 text-sm">
                受信トレイをご確認ください。<br />
                メールが届かない場合はスパムフォルダもご確認ください。
              </p>
              <Link href="/laruHP/auth/login" className="text-blue-400 hover:text-blue-300 text-sm mt-8 block">
                ← ログインに戻る
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">メールアドレス</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-black py-4 rounded-xl font-black text-base hover:bg-blue-50 transition-all disabled:opacity-50"
                >
                  {loading ? '送信中...' : 'リセットメールを送信'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          <Link href="/laruHP/auth/login" className="text-blue-400 hover:text-blue-300">← ログインに戻る</Link>
        </p>
      </div>
    </div>
  );
}
