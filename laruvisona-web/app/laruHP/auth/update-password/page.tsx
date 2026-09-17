'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AuthShell, { ICON_LOCK } from '@/components/laruhp/AuthShell';
import { AuthField, AuthSubmit, AuthNote } from '@/components/laruhp/auth-parts';

/**
 * 新しいパスワードを決める画面（メールのリンクから来る）。
 *
 * 直したこと。
 *   ・伏せ字を外せず、2つの欄に同じ文字を打てたか確かめられなかった。
 *     「一致しません」と言われても、どちらが違うのか分からない。
 *   ・8文字未満かどうかを、押してから教えていた。打っている最中に出す。
 *   ・更新後 1.2秒待ってから移動していた。何も押せない時間になっていたので、
 *     その場で「移動します」と出したうえで待つ。
 */

function UpdatePasswordContent() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setTokenValid(Boolean(data.session)));
  }, [supabase.auth]);

  // 打っている最中に出す。押してから言われるより早く直せる。
  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('パスワードは8文字以上で入力してください'); return; }
    if (password !== confirm) { setError('2つのパスワードが一致しません'); return; }
    setLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError('パスワードの更新に失敗しました。メールのリンクを開き直してお試しください。');
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.replace('/laruHP/dashboard'), 1200);
    } catch {
      setError('通信に失敗しました。もう一度お試しください。');
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthShell heading="パスワードを更新しました" asideTitle="完了です。" asideLead="新しいパスワードで入り直せます。">
        <AuthNote kind="info">更新しました。ホーム画面へ移動します…</AuthNote>
        <div className="auth-foot">
          <p><Link href="/laruHP/dashboard">移動しないときはこちら</Link></p>
        </div>
      </AuthShell>
    );
  }

  if (tokenValid === null) {
    return (
      <AuthShell heading="確認しています" asideTitle="もう少しです。">
        <p className="auth-lead">リンクを確かめています…</p>
      </AuthShell>
    );
  }

  if (tokenValid === false) {
    return (
      <AuthShell
        heading="リンクが使えません"
        asideTitle="もう一度、送り直せます。"
        asideLead="再設定のリンクは1時間で使えなくなります。"
      >
        <AuthNote kind="bad">リンクの期限が切れているか、すでに使われています。</AuthNote>
        <div className="auth-foot">
          <p><Link href="/laruHP/auth/reset-password">再設定メールを送り直す</Link></p>
          <p><Link href="/laruHP/auth/login">← ログインに戻る</Link></p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="新しいパスワードを決める"
      lead="8文字以上で設定してください。"
      asideTitle="鍵を掛け直します。"
      asideLead="決めたパスワードで、次からログインできます。"
      points={[{ title: '忘れないものを', body: 'ブラウザやパスワード管理ソフトに保存しておくと確実です。', icon: ICON_LOCK }]}
    >
      {error && <AuthNote kind="bad">{error}</AuthNote>}

      <form onSubmit={handleSubmit} noValidate>
        <AuthField
          id="new-password"
          label="新しいパスワード"
          hint="8文字以上"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          error={tooShort ? 'あと少しです（8文字以上）' : undefined}
          disabled={loading}
          required
          autoFocus
        />
        <AuthField
          id="new-password-confirm"
          label="もう一度"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          placeholder="••••••••"
          error={mismatch ? '上と違います' : undefined}
          disabled={loading}
          required
        />
        <AuthSubmit busy={loading} busyLabel="更新しています…" disabled={tooShort || mismatch}>
          パスワードを更新
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={
      <AuthShell heading="確認しています" asideTitle="もう少しです。">
        <p className="auth-lead">読み込んでいます…</p>
      </AuthShell>
    }>
      <UpdatePasswordContent />
    </Suspense>
  );
}
