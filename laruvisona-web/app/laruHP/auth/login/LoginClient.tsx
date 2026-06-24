'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingEmail, setExistingEmail] = useState<string | null>(null);

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || searchParams.get('next') || '/laruHP/dashboard';
  const supabase = createClient();
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setExistingEmail(user.email);
    });
  }, [supabase]);

  // ── OTP: send code ──────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!email.trim()) { setError('メールアドレスを入力してください'); return; }
    setOtpLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    if (error) {
      setError('送信できませんでした。メールアドレスを確認してください。');
    } else {
      setOtpSent(true);
      setTimeout(() => codeRef.current?.focus(), 100);
    }
    setOtpLoading(false);
  };

  // ── OTP: verify code ────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setOtpLoading(true);
    setError('');
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otpCode.trim(),
      type: 'email',
    });
    if (error) {
      setError('コードが正しくないか期限切れです');
      setOtpLoading(false);
    } else {
      router.push(redirectTo);
    }
  };

  // ── Password login ──────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) { setError('メールアドレスを入力してください'); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません');
      setLoading(false);
    } else {
      router.push(redirectTo);
    }
  };

  const signupHref = redirectTo !== '/laruHP/dashboard'
    ? `/laruHP/auth/signup?redirectTo=${encodeURIComponent(redirectTo)}`
    : '/laruHP/auth/signup';

  return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/laruHP" className="flex items-center justify-center gap-3 mb-10">
          <Image src="/laruhp_logo.png" alt="LARU HP" height={40} width={160} className="h-10 w-auto" />
        </Link>

        <div className="bg-white border border-gray-200 shadow-sm rounded-3xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ログイン</h1>
          <p className="text-gray-600 text-sm mb-8">アカウントにアクセスしてサイトを管理します</p>

          {existingEmail && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl mb-6 flex items-center justify-between gap-3">
              <span><span className="font-bold">{existingEmail}</span> でログイン中</span>
              <button onClick={() => router.push(redirectTo)} className="text-xs font-bold text-amber-700 underline underline-offset-2 whitespace-nowrap">
                そのまま続ける →
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          {/* ── Email field (shared) ── */}
          <div className="mb-5">
            <label className="block text-sm font-bold text-gray-900 mb-2">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setOtpSent(false); setOtpCode(''); }}
              placeholder="your@email.com"
              disabled={otpSent}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* ── OTP flow ── */}
          {!otpSent ? (
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={otpLoading || !email.trim()}
              className="w-full bg-sky-600 text-white py-4 rounded-xl font-bold text-base hover:bg-sky-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {otpLoading ? '送信中...' : 'ログインコードをメールに送る'}
            </button>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mb-4">
              <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 mb-4 text-sm text-sky-800">
                <strong>{email}</strong> に 6 桁のコードを送りました
              </div>
              <label className="block text-sm font-bold text-gray-900 mb-2">確認コード（6桁）</label>
              <input
                ref={codeRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-center text-xl tracking-widest font-mono placeholder-gray-300 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors mb-3"
              />
              <button
                type="submit"
                disabled={otpLoading || otpCode.length < 6}
                className="w-full bg-sky-600 text-white py-4 rounded-xl font-bold text-base hover:bg-sky-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-2"
              >
                {otpLoading ? '確認中...' : 'ログイン'}
              </button>
              <button type="button" onClick={() => { setOtpSent(false); setOtpCode(''); setError(''); }} className="w-full text-sm text-gray-500 hover:text-gray-700 py-1">
                メールアドレスを変更 / 再送する
              </button>
            </form>
          )}

          {/* ── Password login (secondary) ── */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="text-gray-400 text-xs hover:text-gray-600 whitespace-nowrap">
              {showPassword ? '▲ パスワードを隠す' : 'パスワードでログイン'}
            </button>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {showPassword && (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">パスワード</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full bg-gray-800 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'ログイン中...' : 'パスワードでログイン'}
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 space-y-3 text-center">
          <p className="text-gray-500 text-sm">
            アカウントをお持ちでない方は{' '}
            <Link href={signupHref} className="text-sky-600 hover:text-sky-500">新規登録</Link>
          </p>
          <p>
            <Link href="/laruHP/auth/reset-password" className="text-sky-600 hover:text-sky-500 text-sm transition-colors">
              パスワードをお忘れですか？
            </Link>
          </p>
          <p>
            <Link href="/laruHP" className="text-gray-500 text-xs hover:text-gray-900">← LARU HPトップへ</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginClient() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
