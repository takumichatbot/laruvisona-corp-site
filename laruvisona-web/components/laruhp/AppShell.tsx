'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  NAV_PRIMARY, NAV_GROUPS, NAV_FOOTER, NAV_ICON_PATHS,
  isCurrent, currentLabel,
  type NavItem, type NavIconName,
} from '@/lib/laruhp-nav';

/**
 * ログイン後の画面の骨組み。
 *
 * これまで無かったもの:
 *   ・常に見えている道しるべ。23本のリンクはダッシュボードの本文の中、
 *     しかもサイト一覧の見出しと中身のあいだに挟まっていた。
 *     ほかの画面へ入ると、道しるべは消える。
 *   ・「いまどこにいるか」の表示。全画面で同じ題だった。
 *   ・戻る道。ブラウザの戻るしかなかった。
 *
 * 見た目の決めごとは app/laruHP/app-shell.css に置く。
 * 画面ごとに色や余白を作らず、そこの変数を使うこと。
 */

function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      className="shell-icon" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: NAV_ICON_PATHS[name] }}
    />
  );
}

function NavLink({
  item, current, unread, onNavigate,
}: { item: NavItem; current: boolean; unread: number; onNavigate?: () => void }) {
  const showBadge = item.badge === 'contacts' && unread > 0;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={current ? 'page' : undefined}
      className={`shell-nav-link${current ? ' is-current' : ''}`}
    >
      <NavIcon name={item.icon} />
      <span className="shell-nav-label">{item.label}</span>
      {showBadge && (
        <span className="shell-nav-badge" aria-label={`未読 ${unread}件`}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}

function NavBody({ unread, onNavigate }: { unread: number; onNavigate?: () => void }) {
  const pathname = usePathname() || '';
  return (
    <>
      <div className="shell-nav-section">
        {NAV_PRIMARY.map(item => (
          <NavLink key={item.href} item={item} unread={unread}
            current={isCurrent(pathname, item.href)} onNavigate={onNavigate} />
        ))}
      </div>

      {NAV_GROUPS.map(group => (
        <div key={group.title} className="shell-nav-section">
          <p className="shell-nav-heading">
            <span>{group.title}</span>
            <small>{group.caption}</small>
          </p>
          {group.items.map(item => (
            <NavLink key={item.href} item={item} unread={unread}
              current={isCurrent(pathname, item.href)} onNavigate={onNavigate} />
          ))}
        </div>
      ))}

      <div className="shell-nav-section shell-nav-section-last">
        {NAV_FOOTER.map(item => (
          <NavLink key={item.href} item={item} unread={unread}
            current={isCurrent(pathname, item.href)} onNavigate={onNavigate} />
        ))}
      </div>
    </>
  );
}

export interface AppShellProps {
  children: React.ReactNode;
  /** 右上に出す、その画面固有のもの（通知の切り替えなど） */
  actions?: React.ReactNode;
  /** 見出し。渡さなければ経路から決める。 */
  title?: string;
  /** 見出しの下に1行。その画面が何をする所かを書く。 */
  lead?: string;
  /** 問い合わせの未読数。道しるべの印に使う。 */
  unreadContacts?: number;
  email?: string | null;
  /**
   * 画面いっぱいに詰めて出す。
   *
   * 問い合わせ画面のように、左に一覧・右に本文を並べて
   * **それぞれが別々に縦スクロールする**作りのとき。
   * 余白を外し、本体の高さを画面に固定する（ページ全体はスクロールしない）。
   * 中身に flex-1 と min-h-0 を持たせること。
   */
  fill?: boolean;
}

export default function AppShell({
  children, actions, title, lead, unreadContacts = 0, email, fill = false,
}: AppShellProps) {
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);
  const heading = title || currentLabel(pathname) || 'LARU HP';

  return (
    <div className={`shell laru-touch${fill ? ' is-fill' : ''}`}>
      {/* 引き出し（小さい画面）。開いているあいだだけ背景を覆う。 */}
      {open && (
        <button
          type="button" aria-label="メニューを閉じる"
          className="shell-scrim" onClick={() => setOpen(false)}
        />
      )}

      <aside className={`shell-side${open ? ' is-open' : ''}`}>
        <div className="shell-side-head">
          <Link href="/laruHP/dashboard" className="shell-brand" onClick={() => setOpen(false)}>
            <span className="shell-brand-mark" aria-hidden="true">L</span>
            <span className="shell-brand-name">LARU<b>HP</b></span>
          </Link>
          <button
            type="button" className="shell-side-close" aria-label="メニューを閉じる"
            onClick={() => setOpen(false)}
          >
            <NavIcon name="close" />
          </button>
        </div>

        <nav className="shell-nav" aria-label="管理画面">
          <NavBody unread={unreadContacts} onNavigate={() => setOpen(false)} />
        </nav>

        <div className="shell-side-foot">
          {email && <p className="shell-side-email" title={email}>{email}</p>}
          {/* ログアウトは上段の操作に置いてある。
              ここに form を置くと /laruHP/auth/logout へ飛ぶが、その経路は存在しない。 */}
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-top">
          <button
            type="button" className="shell-menu" aria-label="メニューを開く"
            aria-expanded={open} onClick={() => setOpen(true)}
          >
            <NavIcon name="menu" />
          </button>
          <div className="shell-top-title">
            <h1>{heading}</h1>
            {lead && <p>{lead}</p>}
          </div>
          <div className="shell-top-actions">{actions}</div>
        </header>

        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
