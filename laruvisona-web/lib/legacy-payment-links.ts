export type LegacyPaymentLink = {
  id: string;
  url: string;
  amount: number;
  description: string;
  buttonText: string;
  currency: string;
  createdAt: string;
};

const LINK_ID = /^plink_[A-Za-z0-9]+$/;
const CURRENCY = /^[a-z]{3}$/;

function validStripeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'buy.stripe.com'
      && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function parseLegacyPaymentLinks(settings: unknown): LegacyPaymentLink[] {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return [];
  const rows = (settings as Record<string, unknown>).payment_links;
  if (!Array.isArray(rows)) return [];
  const links: LegacyPaymentLink[] = [];
  for (const row of rows.slice(0, 100)) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const value = row as Record<string, unknown>;
    if (typeof value.id !== 'string' || !LINK_ID.test(value.id) || !validStripeUrl(value.url)) continue;
    if (!Number.isSafeInteger(value.amount) || (value.amount as number) < 0 || (value.amount as number) > 99_999_999) continue;
    if (typeof value.description !== 'string' || !value.description.trim() || value.description.length > 500) continue;
    if (typeof value.currency !== 'string' || !CURRENCY.test(value.currency)) continue;
    if (typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) continue;
    links.push({
      id: value.id,
      url: value.url,
      amount: value.amount as number,
      description: value.description.trim(),
      buttonText: typeof value.buttonText === 'string' ? value.buttonText.slice(0, 100) : '',
      currency: value.currency,
      createdAt: value.createdAt,
    });
  }
  return links;
}

export function removeLegacyPaymentLink(settings: unknown, id: string) {
  const base = settings && typeof settings === 'object' && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {};
  return { ...base, payment_links: parseLegacyPaymentLinks(base).filter(link => link.id !== id) };
}
