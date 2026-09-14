const DEFAULT_REDIRECT = '/laruHP/dashboard';

/** 認証後の移動先を、LARU HP 管理画面内の相対URLだけに限定する。 */
export function safeLaruHpRedirect(value: string | null | undefined, fallback = DEFAULT_REDIRECT) {
  if (!value || value.length > 2048 || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) {
    return fallback;
  }
  try {
    const url = new URL(value, 'https://laruvisona.invalid');
    const insideLaruHp = url.origin === 'https://laruvisona.invalid'
      && (url.pathname === '/laruHP' || url.pathname.startsWith('/laruHP/'));
    return insideLaruHp ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
