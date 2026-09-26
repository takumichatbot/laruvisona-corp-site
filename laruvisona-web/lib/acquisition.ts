/*
  登録者が「どこから来たか」を、登録の時点で1回だけ残す（2026-09-26）。

  - 残すのは source / medium / campaign と、最初に入ったページのパスだけ。
    個人を特定できる値は扱わない。
  - 残す先は auth の user_metadata（登録時に business_name・referred_by を
    入れているのと同じ場所）。新しいテーブル・列は作らない。
  - 「登録直前の外部流入」を残す。直接の訪問（参照元なし）では上書きしない。
    GA4 の「最後の非直接クリック」と同じ考え方で、GA4 と照らし合わせやすい。
  - 自分のドメイン・Google のログイン画面・Gmail・Stripe から戻ってきた分は
    流入として数えない（GA4 で Referral が汚れていたのと同じ理由）。
  - laruhp.com と laruvisona.jp は保存場所（localStorage）が別なので、
    laruhp.com で覚えた流入は、laruvisona.jp へのリンクを押したときに
    lv_src / lv_med / lv_cmp / lv_lp（最初のページ）として運ぶ。GA4 の _gl と同じやり方。
  - 分からないものは空のまま。推測で埋めない。
*/

export type Touch = { source: string; medium: string; campaign?: string; landing?: string };

const STORE_KEY = 'lv_acq';
const MAX = 100;

const SELF_OR_NOISE = [
  /(^|\.)laruhp\.com$/, /(^|\.)laruvisona\.jp$/,
  /^accounts\.google\./, /^mail\.google\.com$/,
  /(^|\.)stripe\.com$/, /^localhost$/,
];

const SEARCH_ENGINES: [RegExp, string][] = [
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)search\.yahoo\.co\.jp$|(^|\.)yahoo\.co\.jp$|(^|\.)yahoo\.com$/, 'yahoo'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
];

function cut(v: string | null | undefined): string {
  return (v || '').trim().slice(0, MAX);
}

/** URLの検索部分と document.referrer から、この訪問の流入を決める。流入でなければ null。 */
export function touchFrom(search: string, referrer: string, path: string): Touch | null {
  const q = new URLSearchParams(search);
  const landing = cut(q.get('lv_lp') || path) || undefined;
  const utmSource = cut(q.get('utm_source') || q.get('lv_src'));
  if (utmSource) {
    return {
      source: utmSource,
      medium: cut(q.get('utm_medium') || q.get('lv_med')) || '(not set)',
      ...(cut(q.get('utm_campaign') || q.get('lv_cmp')) ? { campaign: cut(q.get('utm_campaign') || q.get('lv_cmp')) } : {}),
      landing,
    };
  }
  if (q.get('gclid')) return { source: 'google', medium: 'cpc', landing };
  let host = '';
  try { host = referrer ? new URL(referrer).hostname.toLowerCase() : ''; } catch { host = ''; }
  if (!host || SELF_OR_NOISE.some(re => re.test(host))) return null;
  const engine = SEARCH_ENGINES.find(([re]) => re.test(host));
  if (engine) return { source: engine[1], medium: 'organic', landing };
  return { source: host, medium: 'referral', landing };
}

export function readTouch(): Touch | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as Touch;
    return t && typeof t.source === 'string' && typeof t.medium === 'string' ? t : null;
  } catch { return null; }
}

/** この訪問が流入なら覚える（直接の訪問では上書きしない）。 */
export function rememberTouch(): void {
  if (typeof window === 'undefined') return;
  const t = touchFrom(window.location.search, document.referrer, window.location.pathname);
  if (!t) return;
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(t)); } catch { /* 残せなければ残さない */ }
}

/** 別ドメインの自社ページへ運ぶクエリ。覚えている流入が無ければ空。 */
export function carryParams(t: Touch | null): Record<string, string> {
  if (!t) return {};
  return {
    lv_src: t.source,
    lv_med: t.medium,
    ...(t.campaign ? { lv_cmp: t.campaign } : {}),
    ...(t.landing ? { lv_lp: t.landing } : {}),
  };
}

/** user_metadata に入れる形。流入を覚えていなければ「直接」と書かず、何も入れない。 */
export function signupMetadata(t: Touch | null): Record<string, string> {
  if (!t) return {};
  return {
    acq_source: t.source,
    acq_medium: t.medium,
    ...(t.campaign ? { acq_campaign: t.campaign } : {}),
    ...(t.landing ? { acq_landing: t.landing } : {}),
  };
}
