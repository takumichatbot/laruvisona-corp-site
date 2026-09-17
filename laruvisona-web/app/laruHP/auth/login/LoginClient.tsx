'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { safeLaruHpRedirect } from '@/lib/auth-redirect';
import AuthShell, { ICON_EYE, ICON_BOLT, ICON_CHAT } from '@/components/laruhp/AuthShell';
import { AuthField, AuthSubmit, AuthNote, AuthOr, GoogleButton } from '@/components/laruhp/auth-parts';

/**
 * ログイン。
 *
 * 直したこと。
 *   ・autoComplete が無く、パスワード管理ソフトが欄を見つけられなかった。
 *     保存した鍵が自動で入らないので、ここで諦める人がいた。
 *   ・「パスワードをリセット」が同じ画面に2つあった（欄の横と下）。1つにする。
 *   ・Googleで入るボタンを押しても何も起きないように見えた（画面が変わるまで
 *     数秒かかるのに、待ちの表示が無い）。二度押しもできてしまっていた。
 *   ・伏せ字を外せなかった。打ち間違いに気づけないまま「違います」と言われる。
 *   ・画面の右半分が空だった。
 */

const POINTS = [
  { title: '完成像を見ながら作る', body: '入力するそばから、実際のページが組み上がっていきます。', icon: ICON_EYE },
  { title: '公開はボタン1つ', body: '住所も電話も、直したその場で公開できます。', icon: ICON_BOLT },
  { title: '問い合わせを取りこぼさない', body: '届いた連絡は管理画面に残り、未読の数が出ます。', icon: ICON_CHAT },
];

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [google, setGoogle] = useState(false);
  const [error, setError] = useState('');
  const [existingEmail, setExistingEmail] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  // redirect は旧招待リンクとの互換用。どちらも管理画面内だけに限定する。
  const redirectTo = safeLaruHpRedirect(searchParams.get('redirectTo') ?? searchParams.get('redirect'));
  const supabase = createClient();

  /*
    メールのリンクから戻された人に、何が起きたかを伝える。

    これまで ?error= を**一度も読んでいなかった。**
    登録の確認メールを押した人が、何の断りも無い素のログイン画面に立たされ、
    自分が登録できたのかどうかも分からないまま去っていた。
    本番に、まさにその形の跡が2人分ある（確認済みなのに一度もログインしていない）。
  */
  const notice = (() => {
    switch (searchParams.get('error')) {
      case 'confirmed_no_session':
        return 'メールの確認が終わりました。このままログインしてください。'
          + '（登録したときと違う端末でリンクを開くと、ここに戻ります）';
      case 'auth':
        return 'リンクの期限が切れているか、すでに使われています。'
          + 'もう一度ログインするか、パスワードの再設定からお進みください。';
      default:
        return '';
    }
  })();

  useEffect(() => {
    // パスワード再設定のあと、メールを入れ直させない。
    const prefill = searchParams.get('prefill');
    if (prefill) queueMicrotask(() => setEmail(prefill));

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setExistingEmail(user.email);
    });
  }, [supabase, searchParams]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) { setError('メールアドレスを入力してください'); return; }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        // どちらが違うかは言わない。存在するメールアドレスを当てられてしまう。
        setError('メールアドレスまたはパスワードが正しくありません');
        setLoading(false);
        return;
      }
      // フルリロードにして、Cookie を確実にサーバーへ渡す。
      // ここで setLoading(false) はしない。画面が変わるまで押させないため。
      window.location.href = redirectTo;
    } catch {
      setError('通信に失敗しました。電波の良い所でもう一度お試しください。');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogle(true);
    try {
      await supabase.auth.signOut();
      const queryParams: Record<string, string> = { prompt: 'select_account' };
      // 打ってあれば、Google 側でそのアカウントを目立たせる。
      if (email.trim()) queryParams.login_hint = email.trim();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          queryParams,
        },
      });
      if (error) { setError('Googleログインに失敗しました'); setGoogle(false); }
    } catch {
      setError('Googleログインに失敗しました');
      setGoogle(false);
    }
  };

  const signupHref = redirectTo !== '/laruHP/dashboard'
    ? `/laruHP/auth/signup?redirectTo=${encodeURIComponent(redirectTo)}`
    : '/laruHP/auth/signup';

  const busy = loading || google;

  return (
    <AuthShell
      heading="ログイン"
      lead="サイトの編集と、問い合わせの確認ができます。"
      asideTitle="お店のホームページを、自分の手で。"
      asideLead="作るのも、直すのも、公開するのも、この画面の中だけで終わります。"
      points={POINTS}
    >
      {existingEmail && (
        <AuthNote kind="info" action={{ label: 'そのまま続ける', onClick: () => router.push(redirectTo) }}>
          <b>{existingEmail}</b> でログイン中です。
        </AuthNote>
      )}

      {notice && !error && <AuthNote kind="info">{notice}</AuthNote>}
      {error && <AuthNote kind="bad">{error}</AuthNote>}

      <GoogleButton busy={google} disabled={loading} onClick={handleGoogleLogin} label="Googleでログイン" />

      <AuthOr>または メールアドレスで</AuthOr>

      <form onSubmit={handleLogin} noValidate>
        <AuthField
          id="login-email"
          label="メールアドレス"
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={setEmail}
          placeholder="your@email.com"
          disabled={busy}
          required
        />
        <AuthField
          id="login-password"
          label="パスワード"
          hint={<Link href="/laruHP/auth/reset-password">お忘れですか？</Link>}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          disabled={busy}
          required
        />
        <AuthSubmit busy={loading} busyLabel="ログインしています…" disabled={google}>ログイン</AuthSubmit>
      </form>

      <div className="auth-foot">
        <p>
          アカウントをお持ちでない方は <Link href={signupHref}>新規登録（初月無料）</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function LoginClient() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
