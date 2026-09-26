'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { carryParams, readTouch, rememberTouch, signupMetadata } from '@/lib/acquisition';
import { trackOnce } from '@/lib/funnel';
import { isLaruHpHost } from '@/lib/laruhp-host';

/*
  流入の記録と、登録（sign_up）の計測（2026-09-26）。画面には何も出さない。

  sign_up を登録画面の送信時に送らない理由:
    メール確認が要る設定では、送信した時点ではまだアカウントとして使えない。
    Google ログインでは登録画面を通らない。どちらも「初めてログインできた画面」で
    1回だけ数えるのが正しい。二重にしないため、送ったことを user_metadata に残す
    （別の端末・別のタブでも送らない）。
    登録から48時間を過ぎた人は対象にしない。既存の利用者を今さら「登録」として
    数えたり、その人の流入を後から埋めたりしないため。
*/
const SIGNUP_WINDOW_MS = 48 * 60 * 60 * 1000;

async function recordSignupOnce() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return;
  if (user.user_metadata?.lv_signup_tracked) return;
  const created = Date.parse(user.created_at);
  if (!created || Date.now() - created > SIGNUP_WINDOW_MS) return;
  const provider = typeof user.app_metadata?.provider === 'string' ? user.app_metadata.provider : undefined;
  if (!trackOnce('sign_up', user.id, { method: provider }, true)) return;
  await supabase.auth.updateUser({ data: { lv_signup_tracked: true, ...signupMetadata(readTouch()) } });
}

export default function FunnelTracking() {
  const path = usePathname();

  useEffect(() => {
    rememberTouch();
    const onLaruHp = isLaruHpHost(window.location.hostname);
    if (!onLaruHp && path?.startsWith('/laruHP') && !path.startsWith('/laruHP/auth')) {
      recordSignupOnce().catch(() => { /* 計測の失敗で画面を止めない */ });
    }
  }, [path]);

  // laruhp.com ⇄ laruvisona.jp のリンクに、覚えている流入を付けて運ぶ
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      let url: URL;
      try { url = new URL(a.href); } catch { return; }
      const here = window.location.hostname;
      if (url.hostname === here) return;
      const crossesOwnDomains = isLaruHpHost(here) !== isLaruHpHost(url.hostname)
        && /(^|\.)(laruhp\.com|laruvisona\.jp)$/.test(url.hostname);
      if (!crossesOwnDomains) return;
      if (url.searchParams.has('utm_source') || url.searchParams.has('lv_src')) return;
      const carry = carryParams(readTouch());
      if (!Object.keys(carry).length) return;
      for (const [k, v] of Object.entries(carry)) url.searchParams.set(k, v);
      a.href = url.toString();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
