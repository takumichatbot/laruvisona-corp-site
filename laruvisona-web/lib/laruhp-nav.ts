/**
 * ログイン後の画面の、道しるべ。
 *
 * これまで23本のリンクは DashboardClient の中に直接書かれていて、
 * ダッシュボードにしか無かった。どの画面に入っても「いまどこにいるか」
 * 「ほかに何があるか」が分からず、戻るにはブラウザの戻るしかなかった。
 *
 * 骨組み（components/laruhp/AppShell）から参照するので、ここが正本。
 * 画面側に道しるべを書き足さないこと。
 */

export type NavIconName =
  | 'blog'
  | 'seo'
  | 'translate'
  | 'popups'
  | 'ab-test'
  | 'contacts'
  | 'larubot-logs'
  | 'booking-schedule'
  | 'calendar'
  | 'shop'
  | 'orders'
  | 'payments'
  | 'loyalty'
  | 'crm'
  | 'newsletter'
  | 'sequences'
  | 'members'
  | 'analytics'
  | 'heatmap'
  | 'agency'
  | 'studio'
  | 'dashboard'
  | 'sites'
  | 'settings'
  | 'report'
  | 'logout'
  | 'menu'
  | 'close';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  /** 未読の件数を出す項目。いまは問い合わせだけ。 */
  badge?: 'contacts';
}

export interface NavGroup {
  title: string;
  caption: string;
  items: NavItem[];
}

/** 上段。毎日使うものだけを、束ねずに置く。 */
export const NAV_PRIMARY: NavItem[] = [
  { href: '/laruHP/dashboard', label: 'ホーム', icon: 'dashboard' },
  { href: '/laruHP/studio', label: '制作スタジオ', icon: 'studio' },
  { href: '/laruHP/contacts', label: '問い合わせ', icon: 'contacts', badge: 'contacts' },
];

/** 仕事の流れ（集客→応対→販売→顧客→分析）で束ねる。 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: '集客', caption: '見つけてもらう',
    items: [
      { href: '/laruHP/blog', label: 'ブログ', icon: 'blog' },
      { href: '/laruHP/seo', label: 'SEO設定', icon: 'seo' },
      { href: '/laruHP/translate', label: '多言語翻訳', icon: 'translate' },
      { href: '/laruHP/popups', label: 'ポップアップ', icon: 'popups' },
      { href: '/laruHP/ab-test', label: 'A/Bテスト', icon: 'ab-test' },
    ],
  },
  {
    title: '応対', caption: '来た人に応える',
    items: [
      // 問い合わせは上段にも置いてある。両方に出すと、道しるべに
      // 同じ行き先が2つ並び、開いたときに2つとも光る。上段だけにする。
      { href: '/laruHP/larubot-logs', label: '会話ログ', icon: 'larubot-logs' },
      { href: '/laruHP/booking/schedule', label: '予約管理', icon: 'booking-schedule' },
      { href: '/laruHP/calendar', label: 'カレンダー', icon: 'calendar' },
    ],
  },
  {
    title: '販売', caption: '売る・受け取る',
    items: [
      { href: '/laruHP/shop', label: 'ショップ', icon: 'shop' },
      { href: '/laruHP/orders', label: '注文管理', icon: 'orders' },
      { href: '/laruHP/payments', label: '旧決済リンク', icon: 'payments' },
      { href: '/laruHP/loyalty', label: 'ポイントカード', icon: 'loyalty' },
    ],
  },
  {
    title: '顧客', caption: '関係を続ける',
    items: [
      { href: '/laruHP/crm', label: 'CRM', icon: 'crm' },
      { href: '/laruHP/newsletter', label: 'メール', icon: 'newsletter' },
      { href: '/laruHP/sequences', label: 'シーケンス', icon: 'sequences' },
      { href: '/laruHP/members', label: '会員管理', icon: 'members' },
    ],
  },
  {
    title: '分析・運営', caption: '見て、まわす',
    items: [
      { href: '/laruHP/analytics', label: 'BI分析', icon: 'analytics' },
      { href: '/laruHP/heatmap', label: 'ヒートマップ', icon: 'heatmap' },
      { href: '/laruHP/agency', label: 'エージェンシー', icon: 'agency' },
      // 制作スタジオも上段にある。同じ行き先を2度出さない。
      // （運営ダッシュボード /laruHP/admin は自社用。ここには載せない。）
    ],
  },
];

/** 下段。設定まわり。 */
export const NAV_FOOTER: NavItem[] = [
  { href: '/laruHP/settings', label: '設定', icon: 'settings' },
];

export const NAV_ICON_PATHS: Record<NavIconName, string> = {
  "blog": "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><polyline points=\"14 2 14 8 20 8\"/><line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/><line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/><polyline points=\"10 9 9 9 8 9\"/>",
  "seo": "<circle cx=\"11\" cy=\"11\" r=\"8\"/><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"/>",
  "translate": "<path d=\"M5 8l6 6\"/><path d=\"M4 14l6-6 2-3\"/><path d=\"M2 5h12\"/><path d=\"M7 2h1\"/><path d=\"M22 22l-5-10-5 10\"/><path d=\"M14 18h6\"/>",
  "popups": "<rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"2\"/><rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"1\" fill=\"currentColor\" fillOpacity=\"0.15\"/>",
  "ab-test": "<path d=\"M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18\"/>",
  "contacts": "<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/>",
  "larubot-logs": "<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/><line x1=\"9\" y1=\"10\" x2=\"15\" y2=\"10\"/>",
  "booking-schedule": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/><line x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/><line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/><line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/>",
  "calendar": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/><line x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/><line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/><line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/>",
  "shop": "<path d=\"M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z\"/><line x1=\"3\" y1=\"6\" x2=\"21\" y2=\"6\"/><path d=\"M16 10a4 4 0 0 1-8 0\"/>",
  "orders": "<path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><rect x=\"8\" y=\"2\" width=\"8\" height=\"4\" rx=\"1\"/><path d=\"M9 14l2 2 4-4\"/>",
  "payments": "<rect x=\"1\" y=\"4\" width=\"22\" height=\"16\" rx=\"2\" ry=\"2\"/><line x1=\"1\" y1=\"10\" x2=\"23\" y2=\"10\"/>",
  "loyalty": "<polygon points=\"12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2\"/>",
  "crm": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M3 9h18M9 21V9\"/>",
  "newsletter": "<path d=\"M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z\"/><polyline points=\"22,6 12,13 2,6\"/>",
  "sequences": "<polyline points=\"22 12 18 12 15 21 9 3 6 12 2 12\"/>",
  "members": "<path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>",
  "analytics": "<line x1=\"18\" y1=\"20\" x2=\"18\" y2=\"10\"/><line x1=\"12\" y1=\"20\" x2=\"12\" y2=\"4\"/><line x1=\"6\" y1=\"20\" x2=\"6\" y2=\"14\"/>",
  "heatmap": "<path d=\"M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z\"/><path d=\"M12 6v6l4 2\"/>",
  "agency": "<path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>",
  "studio": "<path d=\"M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z\"/>",
  "dashboard": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"9\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"5\" rx=\"1\"/><rect x=\"14\" y=\"12\" width=\"7\" height=\"9\" rx=\"1\"/><rect x=\"3\" y=\"16\" width=\"7\" height=\"5\" rx=\"1\"/>",
  "sites": "<rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\"/><line x1=\"8\" y1=\"21\" x2=\"16\" y2=\"21\"/><line x1=\"12\" y1=\"17\" x2=\"12\" y2=\"21\"/>",
  "settings": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10.6 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z\"/>",
  "report": "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><polyline points=\"14 2 14 8 20 8\"/><line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/><line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/>",
  "logout": "<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"/><polyline points=\"16 17 21 12 16 7\"/><line x1=\"21\" y1=\"12\" x2=\"9\" y2=\"12\"/>",
  "menu": "<line x1=\"3\" y1=\"12\" x2=\"21\" y2=\"12\"/><line x1=\"3\" y1=\"6\" x2=\"21\" y2=\"6\"/><line x1=\"3\" y1=\"18\" x2=\"21\" y2=\"18\"/>",
  "close": "<line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>"
};

/** いまの経路が、その項目のものか。より深い経路も含める。 */
export function isCurrent(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(href + '/');
}

/** 経路から、いまいる場所の名前を出す。見出しに使う。 */
export function currentLabel(pathname: string): string | null {
  const all = [...NAV_PRIMARY, ...NAV_GROUPS.flatMap(g => g.items), ...NAV_FOOTER];
  // 長い経路から先に見る（/laruHP/booking/schedule が /laruHP に負けないように）
  const hit = all.slice().sort((a, b) => b.href.length - a.href.length)
    .find(item => isCurrent(pathname, item.href));
  return hit ? hit.label : null;
}
