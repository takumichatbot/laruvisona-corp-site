'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuthShell, { ICON_LOCK } from '@/components/laruhp/AuthShell';
import { AuthField, AuthSubmit, AuthNote } from '@/components/laruhp/auth-parts';

/**
 * パスワードの再設定を頼む画面。
 *
 * 直したこと。
 *   ・通信そのものが落ちると「送信中...」のまま戻らなかった
 *     （fetch が投げると、その下の setLoading(false) まで届かない）。
 *   ・「エラーが発生しました。メールアドレスをご確認ください。」と出していたが、
 *     受け口は登録の有無にかかわらず必ず ok を返す。出る余地の無い文言だった。
 *     しかも、もし出れば「そのアドレスは登録が無い」と教えることになる。
 *   ・送ったあとに「迷惑メールを見る」が小さく1行あるだけだった。
 *     届かない人のほとんどはそこに入っている。
 */

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('メールアドレスを入力してください'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      // 受け口は、登録の有無を外へ出さないため常に ok を返す。
      // こちらも「送りました」以外は出さない。出せば、それが答えになってしまう。
      if (!res.ok) { setError('送信できませんでした。しばらく経ってからお試しください。'); return; }
      setSent(true);
    } catch {
      setError('通信に失敗しました。電波の良い所でもう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        heading="メールを送りました"
        asideTitle="鍵は、すぐに掛け直せます。"
        asideLead="メールの中のボタンから、新しいパスワードを決めてください。"
      >
        <p className="auth-lead">
          <b>{email.trim()}</b> が登録されていれば、再設定用のリンクが届きます。<br />
          リンクは<b>1時間</b>で使えなくなります。
        </p>
        <div className="auth-fine">
          <b>届かないときは</b><br />
          ・迷惑メールフォルダに入っていることがあります<br />
          ・数分かかることがあります<br />
          ・Googleでログインしている場合、パスワードはありません。
          ログイン画面の「Googleでログイン」からお入りください
        </div>
        <div className="auth-foot">
          <p><Link href="/laruHP/auth/login">← ログインに戻る</Link></p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="パスワードを再設定"
      lead="登録しているメールアドレスを入れてください。再設定用のリンクをお送りします。"
      asideTitle="鍵は、すぐに掛け直せます。"
      asideLead="登録しているメールアドレスさえ分かれば、パスワードは何度でも決め直せます。"
      points={[{ title: 'リンクは1時間だけ有効', body: '古いリンクは使えなくなります。', icon: ICON_LOCK }]}
    >
      {error && <AuthNote kind="bad">{error}</AuthNote>}

      <form onSubmit={handleSubmit} noValidate>
        <AuthField
          id="reset-email"
          label="メールアドレス"
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={setEmail}
          placeholder="your@email.com"
          disabled={loading}
          required
          autoFocus
        />
        <AuthSubmit busy={loading} busyLabel="送信しています…">再設定メールを送る</AuthSubmit>
      </form>

      <div className="auth-foot">
        <p><Link href="/laruHP/auth/login">← ログインに戻る</Link></p>
      </div>
    </AuthShell>
  );
}
