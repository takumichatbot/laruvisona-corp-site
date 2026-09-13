const HTTPS_URL = /^https:\/\/[^\s]+$/i;

function externalUrl(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();
  return candidate && HTTPS_URL.test(candidate) ? candidate : fallback;
}

function registrar(
  id: string,
  name: string,
  configuredUrl: string | undefined,
  standardUrl: string,
) {
  const url = externalUrl(configuredUrl, standardUrl);
  return { id, name, url, sponsored: url !== standardUrl };
}

/**
 * 明日の提携申請までは各社の通常URLを使う。
 * 提携後は環境変数だけを差し替えれば、画面や手順を変えずに紹介URLへ移行できる。
 */
export const DOMAIN_REGISTRARS = [
  registrar('muumuu', 'ムームードメイン', process.env.NEXT_PUBLIC_MUUMUU_DOMAIN_URL, 'https://muumuu-domain.com/'),
  registrar('onamae', 'お名前.com', process.env.NEXT_PUBLIC_ONAMAE_DOMAIN_URL, 'https://www.onamae.com/'),
] as const;

export const HAS_SPONSORED_DOMAIN_LINK = DOMAIN_REGISTRARS.some(item => item.sponsored);

export const DOMAIN_BILLING_NOTE =
  'ドメインの取得・更新費はLARU HPの月額料金に含まれません。登録事業者へ別途支払います。';

export const DOMAIN_OWNERSHIP_NOTE =
  'ドメインはお客様自身、またはお客様の事業者名義のアカウントで取得してください。更新通知を受け取れるメールアドレスを登録します。';
