'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('パスワードは8文字以上で設定してください');
      return;
    }
    setLoading(true);
    setError('');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { business_name: businessName },
        emailRedirectTo: `${location.origin}/api/auth/callback?next=/laruHP/onboarding`,
      },
    });

    if (error) {
      setError(error.message === 'User already registered'
        ? 'このメールアドレスは既に登録されています'
        : 'エラーが発生しました。もう一度お試しください。');
      setLoading(false);
      return;
    }

    if (data.session) {
      // Auto-confirmed (dev mode)
      router.push('/laruHP/onboarding');
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">📧</div>
          <h1 className="text-2xl font-black text-white mb-4">確認メールを送信しました</h1>
          <p className="text-slate-400 mb-6">
            <strong className="text-white">{email}</strong> に確認メールを送信しました。<br />
            メール内のリンクをクリックしてアカウントを有効化してください。
          </p>
          <Link href="/laruHP" className="text-blue-400 hover:text-blue-300 text-sm">← LARU HPトップへ</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/laruHP" className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-black text-lg">L</div>
          <span className="text-white font-black text-2xl">LARU<span className="text-blue-400 font-light">HP</span></span>
        </Link>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
          <div className="inline-block bg-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1 rounded-full mb-4">
            🎁 初月1円キャンペーン中
          </div>
          <h1 className="text-2xl font-black text-white mb-2">無料で始める</h1>
          <p className="text-slate-400 text-sm mb-8">アカウント作成後、サイト情報を入力してAI生成を開始します</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">店舗・会社名</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="例: 鈴木整体院"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
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
              <label className="block text-sm font-bold text-slate-300 mb-2">パスワード（8文字以上）</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <p className="text-slate-600 text-xs">
              登録することで<a href="#" className="text-blue-500">利用規約</a>・<a href="#" className="text-blue-500">プライバシーポリシー</a>に同意したものとみなします
            </p>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black py-4 rounded-xl font-black text-base hover:bg-blue-50 transition-all disabled:opacity-50"
            >
              {loading ? '処理中...' : 'アカウントを作成する →'}
            </button>
          </form>

          <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-xs text-slate-400">
            <p className="font-bold text-blue-400 mb-1">💳 料金について</p>
            <p>アカウント作成は無料です。サイト公開時にStripeで決済設定（初月1円→月額999円）が必要です。最低契約期間6ヶ月。</p>
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          既にアカウントをお持ちの方は{' '}
          <Link href="/laruHP/auth/login" className="text-blue-400 hover:text-blue-300">ログイン</Link>
        </p>
      </div>
    </div>
  );
}
