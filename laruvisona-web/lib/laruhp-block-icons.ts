/**
 * ビルダーの部品一覧に出す絵。
 *
 * 2026-09-17まで、絵の代わりに**短い日本語**が入っていた。
 * 右に本当の名前が並ぶので、一覧はこう見えていた。
 *
 *   見出 見出し      ← 同じ言葉が2回
 *   動画 動画        ← 同じ言葉が2回
 *   文  テキスト     ← 別の言葉が2つ
 *   写真 画像        ← 別の言葉が2つ
 *   時間 営業時間
 *
 * 上の帯も同じで、「速度 速度」「URL URLインポート」と出ていた。
 * 初めて開いた人には、**壊れている画面**に見える。
 * ここは作りはじめの人がいちばん最初に見る所で、
 * 7件中6件が下書きのまま止まっている画面でもある。
 *
 * 絵は、道しるべ（lib/laruhp-nav.ts）と同じ描き方に揃える。
 *   24×24 / 線だけ / 太さ1.75 / 角と端は丸
 * 画面ごとに描き方が変わると、同じ製品に見えなくなる。
 */

export const BLOCK_ICON_PATHS: Record<string, string> = {
  // ── レイアウト ──
  nav: '<rect x="3" y="5" width="18" height="5" rx="1.5"/><path d="M6.5 7.5h3M12 7.5h2M16 7.5h1.5"/><path d="M3 14h18M3 18h12"/>',
  hero: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 10h10M7 13h6"/><rect x="7" y="15.5" width="6" height="2.5" rx="1.2"/>',
  'two-col': '<rect x="3" y="4" width="8" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="16" rx="1.5"/>',
  'three-col': '<rect x="2.5" y="5" width="5.5" height="14" rx="1.5"/><rect x="9.25" y="5" width="5.5" height="14" rx="1.5"/><rect x="16" y="5" width="5.5" height="14" rx="1.5"/>',
  divider: '<path d="M3 12h4M10 12h4M17 12h4"/>',

  // ── コンテンツ ──
  heading: '<path d="M5 6v12M13 6v12M5 12h8"/><path d="M16.5 10.5h3v7.5"/>',
  paragraph: '<path d="M4 6h16M4 11h16M4 16h11"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/>',
  gallery: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  cta: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M10 12h5M13 10l2 2-2 2"/>',

  // ── ビジネス ──
  services: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h2M7 13h2M7 17h2M12 9h5M12 13h5M12 17h3"/>',
  testimonials: '<path d="M9 7H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1c0 2-.8 3.2-2 4"/><path d="M19 7h-3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1c0 2-.8 3.2-2 4"/>',
  faq: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.3"/><path d="M12 17v.1"/>',
  'before-after': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><path d="M8.5 15l2.5-4"/>',
  tabs: '<path d="M3 9h6V6a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 21 6v3"/><rect x="3" y="9" width="18" height="10.5" rx="1.5"/>',
  team: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.6"/><path d="M17.5 14.4A5.5 5.5 0 0 1 20.5 19"/>',
  free: '<path d="M4.5 3.5h3M11 3.5h2M16.5 3.5h3a1 1 0 0 1 1 1v2.5M20.5 11v2M20.5 16.5v3h-3M13 20.5h-2M7.5 20.5h-3v-3M3.5 13v-2M3.5 7.5v-3"/>',
  'shop-grid': '<path d="M4 8h16l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H6.7a1.5 1.5 0 0 1-1.5-1.3Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M8.5 12h7"/>',
  'shop-item': '<path d="M4 8h16l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H6.7a1.5 1.5 0 0 1-1.5-1.3Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  'member-gate': '<rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><path d="M12 14.5v2"/>',
  hours: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
  contact: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',

  // ── メディア ──
  video: '<rect x="2.5" y="5" width="14" height="14" rx="2"/><path d="M16.5 10.5 21.5 8v8l-5-2.5Z"/><path d="M7.5 9.5 11 12l-3.5 2.5Z"/>',
  map: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  countdown: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4h3"/><path d="M9.5 2.5h5"/><path d="M12 2.5V6"/>',

  // ── 予約・料金 ──
  'price-table': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M9.5 12.5 12 15m2.5-2.5L12 15m0 0v3m-2 -1.5h4"/>',
  booking: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M9.5 15l2 2 3.5-3.5"/>',
  news: '<path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M15.5 4v3.5H19"/><path d="M7.5 12h8M7.5 16h5"/>',

  // ── 連携 ──
  larubot: '<path d="M20.5 11.5a8 8 0 0 1-8.5 8 8.6 8.6 0 0 1-3.7-.85L3.5 20.5l1.4-4.2a8 8 0 0 1-1.4-4.8 8 8 0 0 1 8-8 8 8 0 0 1 9 8Z"/><path d="M12 8.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>',

  // ── 集客 ──
  'announcement-bar': '<path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H8l6 4V6.5l-6 4H5.5A1.5 1.5 0 0 0 4 12Z"/><path d="M17.5 9.5a4 4 0 0 1 0 5"/>',
  popup: '<rect x="3" y="4" width="14" height="11" rx="1.5"/><rect x="9" y="10" width="12" height="10" rx="1.5"/>',
  newsletter: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7 12 13.5 20.5 7"/><path d="M18.5 17.5v4M16.5 19.5h4"/>',
  share: '<circle cx="17.5" cy="6" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="M8.7 10.8 15.3 7.2M8.7 13.2l6.6 3.6"/>',
  'stripe-buy': '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19"/><path d="M6 14.5h4"/>',
  'google-reviews': '<path d="m12 3.5 2.6 5.3 5.9.85-4.25 4.15 1 5.8L12 16.85 6.75 19.6l1-5.8L3.5 9.65l5.9-.85Z"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17" cy="7" r="1"/>',
};

/** 一覧に無い部品でも、穴を開けない。 */
export const BLOCK_ICON_FALLBACK = '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 10h8M8 14h5"/>';

export function blockIconPath(type: string): string {
  return BLOCK_ICON_PATHS[type] || BLOCK_ICON_FALLBACK;
}
