import Image from 'next/image';
import Link from 'next/link';
import { LARUHP_ORIGIN } from '@/lib/laruhp-host';

/**
 * ログイン・登録・パスワード再設定の入れ物。
 *
 * これまで4画面それぞれが「水色の背景に白いカードを1枚置く」だけだった。
 * 画面の半分以上が空で、何のサービスにログインしようとしているのかが
 * ロゴ以外に何も無い。**買う前の最後の画面と、入った後の最初の画面**なのに、
 * ここだけ作りが薄かった。
 *
 * 大きい画面では左に説明を置く。空けておく理由が無い。
 * 小さい画面では左は出さない（畳んで縦に積むと、入力欄が下に押し出される）。
 *
 * 見た目の決めごとは app/laruHP/auth/auth.css。色や余白をここに書かないこと。
 */

export interface AuthPoint {
  title: string;
  body: string;
  /** auth.css の丸の中に出す絵。24x24 の path を渡す。 */
  icon: React.ReactNode;
}

export const ICON_EYE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
export const ICON_BOLT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
);
export const ICON_CHAT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 20.5l1.5-4.4A8.4 8.4 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 9 8.4Z" />
  </svg>
);
export const ICON_LOCK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export default function AuthShell({
  children, heading, lead, pill, points, asideTitle, asideLead,
}: {
  children: React.ReactNode;
  heading: string;
  lead?: string;
  /** 見出しの上に出す小さな札（「初月無料」など）。 */
  pill?: string;
  points?: AuthPoint[];
  asideTitle?: string;
  asideLead?: string;
}) {
  const logo = (
    <Image src="/laruhp_logo.png" alt="LARU HP" height={36} width={144} className="h-9 w-auto" priority />
  );

  return (
    <div className="auth">
      <aside className="auth-aside">
        <a href={`${LARUHP_ORIGIN}/`} className="auth-aside-brand">{logo}</a>

        <div>
          {asideTitle && <h2>{asideTitle}</h2>}
          {asideLead && <p className="auth-aside-lead">{asideLead}</p>}
          {points && points.length > 0 && (
            <ul className="auth-points">
              {points.map(p => (
                <li key={p.title}>
                  <span className="auth-point-mark" aria-hidden="true">{p.icon}</span>
                  <span className="auth-point">
                    <b>{p.title}</b>
                    <span>{p.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="auth-aside-foot">
          株式会社LaruVisona ・{' '}
          <a href={`${LARUHP_ORIGIN}/terms`}>利用規約</a> ・{' '}
          <a href={`${LARUHP_ORIGIN}/privacy`}>プライバシー</a> ・{' '}
          <a href={`${LARUHP_ORIGIN}/tokusho`}>特定商取引法</a>
        </p>
      </aside>

      <main className="auth-main">
        <div className="auth-box">
          <Link href={`${LARUHP_ORIGIN}/`} className="auth-brand">{logo}</Link>

          <div className="auth-card">
            {pill && <span className="auth-pill">{pill}</span>}
            <h1>{heading}</h1>
            {lead && <p className="auth-lead">{lead}</p>}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
