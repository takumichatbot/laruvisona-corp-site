'use client';

import { useId, useState } from 'react';

/**
 * ログイン・登録の画面で使う部品。
 *
 * 4画面で入力欄の作りが少しずつ違い、直すたびに1つ直し漏れていた。
 * ここに集める。**画面側で input を直接書かないこと。**
 *
 * 部品にした理由は見た目の統一だけではない。
 *   ・autoComplete。これが無いと、パスワード管理ソフトが欄を見つけられない。
 *     4画面とも入っていなかった。保存したパスワードが自動で入らないので、
 *     人はここで諦める。**いちばん多い離脱の原因はこれ。**
 *   ・伏せ字の切り替え。打ち間違いに気づけないまま「違います」と言われ続ける。
 *   ・16px。これを下回ると、iPhone が入力のたびに画面を拡大する。
 */

const EyeOn = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOff = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3l18 18" /><path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
    <path d="M9.4 5.3A9.6 9.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4" />
    <path d="M6.2 6.6A16.6 16.6 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4-.85" />
  </svg>
);

export function AuthField({
  label, hint, type = 'text', value, onChange, error, disabled,
  autoComplete, placeholder, inputMode, required, autoFocus, id: givenId,
}: {
  label: string;
  /** ラベルの右に出す小さな字（「8文字以上」など）。 */
  hint?: React.ReactNode;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  /** パスワード管理ソフトのための印。省略しないこと。 */
  autoComplete: string;
  placeholder?: string;
  inputMode?: 'text' | 'email';
  required?: boolean;
  autoFocus?: boolean;
  id?: string;
}) {
  const auto = useId();
  const id = givenId || auto;
  const errId = `${id}-err`;
  const [peek, setPeek] = useState(false);
  const isPassword = type === 'password';
  const shown = isPassword && peek ? 'text' : type;

  return (
    <div className="auth-field">
      <div className="auth-field-head">
        <label htmlFor={id}>{label}</label>
        {hint && <span className="auth-field-hint">{hint}</span>}
      </div>
      <div className="auth-input-wrap">
        <input
          id={id}
          type={shown}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          className={isPassword ? 'has-peek' : undefined}
        />
        {isPassword && (
          <button
            type="button"
            className="auth-peek"
            onClick={() => setPeek(p => !p)}
            aria-label={peek ? 'パスワードを隠す' : 'パスワードを表示'}
            aria-pressed={peek}
            tabIndex={-1}
          >
            {peek ? <EyeOff /> : <EyeOn />}
          </button>
        )}
      </div>
      {error && <p className="auth-err" id={errId}>{error}</p>}
    </div>
  );
}

/** 押したら必ず「効いた」と見える送信ボタン。 */
export function AuthSubmit({
  busy, children, busyLabel, disabled,
}: { busy: boolean; children: React.ReactNode; busyLabel: string; disabled?: boolean }) {
  return (
    <button type="submit" className="auth-btn auth-btn-primary" disabled={busy || disabled}>
      {busy && <span className="auth-spin" aria-hidden="true" />}
      {busy ? busyLabel : children}
    </button>
  );
}

/** Googleで入る。押してから画面が変わるまで数秒あるので、待ちを出す。 */
export function GoogleButton({
  busy, disabled, onClick, label,
}: { busy: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className="auth-btn auth-btn-plain" onClick={onClick} disabled={busy || disabled}>
      {busy ? <span className="auth-spin" aria-hidden="true" /> : (
        <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
        </svg>
      )}
      {busy ? 'Googleへ移動しています…' : label}
    </button>
  );
}

/**
 * 画面の上に出す知らせ。
 * `role="alert"` を付けるのは、読み上げにも届かせるため。
 * 目で見ている人には見えても、そうでない人には何も起きていないのと同じになる。
 */
export function AuthNote({
  kind, children, action,
}: {
  kind: 'bad' | 'info';
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={`auth-note auth-note-${kind}`} role={kind === 'bad' ? 'alert' : 'status'}>
      <svg className="auth-note-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        {kind === 'bad' ? <><path d="M12 8v5" /><path d="M12 16.2v.1" /></> : <><path d="M12 11v5" /><path d="M12 7.8v.1" /></>}
      </svg>
      <p>{children}</p>
      {action && <button type="button" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}

export function AuthOr({ children }: { children: React.ReactNode }) {
  return <div className="auth-or">{children}</div>;
}
