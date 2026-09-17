'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { safeLaruHpRedirect } from '@/lib/auth-redirect';
import { MONTHLY, TERMS } from '@/lib/laruhp-facts';
import { LARUHP_ORIGIN } from '@/lib/laruhp-host';
import AuthShell, { ICON_EYE, ICON_BOLT, ICON_LOCK } from '@/components/laruhp/AuthShell';
import { AuthField, AuthSubmit, AuthNote, AuthOr, GoogleButton } from '@/components/laruhp/auth-parts';

/**
 * 新規登録。
 *
 * 直したこと。
 *   ・autoComplete が無く、パスワード管理ソフトが新しい鍵を作ってくれなかった。
 *   ・料金の説明が「999円・6ヶ月」と直に書いてあった。値段を変えたとき、
 *     ここだけ古いまま残る。lib/laruhp-facts.ts から引く。
 *   ・Googleで登録を押しても待ちが出なかった。
 *   ・確認メールを送ったあとの画面に、次にすることが書いていなかった
 *     （迷惑メールを見る、という当たり前がいちばん多い詰まり所）。
 */

const POINTS = [
  { title: '作りながら、出来上がりが見える', body: '打ち込んだそばからページが組み上がります。', icon: ICON_EYE },
  { title: '初月は無料', body: `${TERMS.firstMonthFree}。合わなければ、そこでやめられます。`, icon: ICON_BOLT },
  { title: 'アカウント作成だけなら無料', body: '作って、触って、気に入ってから決済に進めます。', icon: ICON_LOCK },
];

function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [google, setGoogle] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ businessName?: string; email?: string; password?: string }>({});

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeLaruHpRedirect(searchParams.get('redirectTo'), '/laruHP/studio');
  const supabase = createClient();

  const handleGoogleSignup = async () => {
    setError('');
    setGoogle(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectTo)}` },
      });
      if (error) { setError('Googleログインに失敗しました'); setGoogle(false); }
    } catch {
      setError('Googleログインに失敗しました');
      setGoogle(false);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errs: { businessName?: string; email?: string; password?: string } = {};
    if (!businessName.trim()) errs.businessName = '店舗名または会社名を入力してください';
    if (!email.trim()) errs.email = 'メールアドレスを入力してください';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = '有効なメールアドレスを入力してください';
    if (!password) errs.password = 'パスワードを入力してください（8文字以上）';
    else if (password.length < 8) errs.password = 'パスワードは8文字以上で設定してください';

    setFieldErrors(errs);
    const firstError = (['businessName', 'email', 'password'] as const).find(k => errs[k]);
    if (firstError) {
      document.getElementById(`signup-${firstError}`)?.focus();
      return;
    }

    setLoading(true);
    setError('');

    let referredBy = '';
    try { referredBy = sessionStorage.getItem('laruHP_ref') || ''; } catch {}

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { business_name: businessName.trim(), ...(referredBy ? { referred_by: referredBy } : {}) },
          emailRedirectTo: `${location.origin}/api/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (error) {
        setError(error.message === 'User already registered'
          ? 'このメールアドレスは既に登録されています。ログインからお進みください。'
          : 'エラーが発生しました。もう一度お試しください。');
        setLoading(false);
        return;
      }

      if (data.session) {
        router.push(redirectTo);   // 確認不要の設定のとき
        return;                    // 画面が変わるので待ちは解かない
      }
      setSent(true);
      setLoading(false);
    } catch {
      setError('通信に失敗しました。電波の良い所でもう一度お試しください。');
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        heading="確認メールを送りました"
        asideTitle="あと1つだけ。"
        asideLead="メールの中のボタンを押すと、すぐに作り始められます。"
      >
        <p className="auth-lead">
          <b>{email.trim()}</b> 宛に送りました。<br />
          メールの中のリンクを押すと、アカウントが使えるようになります。
        </p>
        <div className="auth-fine">
          <b>届かないときは</b><br />
          ・迷惑メールフォルダに入っていることがあります<br />
          ・数分かかることがあります<br />
          ・アドレスを打ち間違えていたら、もう一度<Link href="/laruHP/auth/signup">登録</Link>し直してください
        </div>
        <div className="auth-foot">
          <p><Link href="/laruHP/auth/login">ログイン画面へ</Link></p>
          <p><a href={`${LARUHP_ORIGIN}/`}>← LARU HP トップへ</a></p>
        </div>
      </AuthShell>
    );
  }

  const busy = loading || google;

  return (
    <AuthShell
      pill="初月無料キャンペーン中"
      heading="無料で始める"
      lead="アカウントを作ったあと、お店の情報を入れるとAIがページを組み立てます。"
      asideTitle="まず作ってみて、気に入ってから決めてください。"
      asideLead="アカウントを作るところまでは無料です。決済は、公開するときで構いません。"
      points={POINTS}
    >
      {error && <AuthNote kind="bad">{error}</AuthNote>}

      <GoogleButton busy={google} disabled={loading} onClick={handleGoogleSignup} label="Googleで登録" />

      <AuthOr>または メールアドレスで</AuthOr>

      <form onSubmit={handleSignup} noValidate>
        <AuthField
          id="signup-businessName"
          label="店舗・会社名"
          autoComplete="organization"
          value={businessName}
          onChange={v => { setBusinessName(v); setFieldErrors(f => ({ ...f, businessName: undefined })); }}
          placeholder="例: 鈴木整体院"
          error={fieldErrors.businessName}
          disabled={busy}
        />
        <AuthField
          id="signup-email"
          label="メールアドレス"
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={v => { setEmail(v); setFieldErrors(f => ({ ...f, email: undefined })); }}
          placeholder="your@email.com"
          error={fieldErrors.email}
          disabled={busy}
        />
        <AuthField
          id="signup-password"
          label="パスワード"
          hint="8文字以上"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={v => { setPassword(v); setFieldErrors(f => ({ ...f, password: undefined })); }}
          placeholder="••••••••"
          error={fieldErrors.password}
          disabled={busy}
        />

        <AuthSubmit busy={loading} busyLabel="作成しています…" disabled={google}>アカウントを作成する</AuthSubmit>
      </form>

      <div className="auth-fine">
        <b>料金について</b><br />
        アカウント作成は無料です。サイトを公開するときに決済の設定が必要になります
        （{TERMS.firstMonthFree}、以降は月額{MONTHLY.hp.toLocaleString('ja-JP')}円〜）。
        最低利用期間は{TERMS.minimumMonths}ヶ月。{TERMS.taxNote}。
        くわしくは<a href={`${LARUHP_ORIGIN}/plans`} target="_blank" rel="noopener noreferrer">料金ページ</a>をご覧ください。
      </div>

      <div className="auth-foot">
        <p>
          登録すると
          <a href={`${LARUHP_ORIGIN}/terms`} target="_blank" rel="noopener noreferrer">利用規約</a>・
          <a href={`${LARUHP_ORIGIN}/privacy`} target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>
          に同意したものとみなします。
        </p>
        <p>
          既にアカウントをお持ちの方は{' '}
          <Link href={`/laruHP/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`}>ログイン</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function SignupClient() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
