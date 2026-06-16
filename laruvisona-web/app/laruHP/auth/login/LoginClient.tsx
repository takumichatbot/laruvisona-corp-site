'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません');
      setLoading(false);
    } else {
      router.push('/laruHP/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/laruHP" className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-black text-lg">L</div>
          <span className="text-white font-black text-2xl">LARU<span className="text-blue-400 font-light">HP</span></span>
        </Link>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
          <h1 className="text-2xl font-black text-white mb-2">ログイン</h1>
          <p className="text-slate-400 text-sm mb-8">アカウントにアクセスしてサイトを管理します</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
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
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">パスワード</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black py-4 rounded-xl font-black text-base hover:bg-blue-50 transition-all disabled:opacity-50"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          アカウントをお持ちでない方は{' '}
          <Link href="/laruHP/auth/signup" className="text-blue-400 hover:text-blue-300">新規登録</Link>
        </p>
        <p className="text-center mt-3">
          <Link href="/laruHP/auth/reset-password" className="text-slate-500 hover:text-slate-300 text-sm">
            パスワードを忘れた方
          </Link>
        </p>
        <p className="text-center mt-2">
          <Link href="/laruHP" className="text-slate-600 text-xs hover:text-slate-400">← LARU HPトップへ</Link>
        </p>
      </div>
    </div>
  );
}
