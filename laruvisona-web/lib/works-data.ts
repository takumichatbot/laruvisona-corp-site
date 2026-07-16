// 開発実績（WORKS）の掲載データ。トップページのカードと /works/[slug] 詳細の両方で使用。
// 方針: 検証できない数値実績（導入企業数・売上等）は載せない。

export interface Work {
  slug: string;
  name: string;
  category: string;
  tagline: string;
  /** プロダクト概要（2-3文） */
  overview: string;
  /** 技術スタック（タグ表示） */
  tech: string[];
  highlights: string[];
  /** 外部/内部リンク。null なら非表示（準備中など） */
  link: { label: string; url: string; external: boolean } | null;
  /** スクリーンショット枠。画像は /public/images/works/<slug>-<n>.png|jpg に配置して差し替える */
  screenshots: {
    count: number;
    /** 推奨サイズ（px） */
    recommended: string;
    /** 縦長（iOSアプリ等）なら true */
    portrait: boolean;
  };
  /** コンテンツ未確定（クライアント提供待ち）の場合 true */
  placeholder: boolean;
  accent: 'indigo' | 'cyan' | 'purple';
}

export const WORKS: Work[] = [
  {
    slug: 'larubot',
    name: 'LARUbot',
    category: 'AI SaaSプラットフォーム',
    tagline: '24時間働く、AI営業アシスタント',
    overview:
      'AIチャットボット・CRM・MA・Stripe決済・SEO記事自動生成を統合した、中小企業向けオールインワンAI SaaS。全32機能を単一の管理画面で提供し、問い合わせ対応から顧客管理・集客までを一気通貫で自動化します。',
    tech: ['Python', 'FastAPI', 'PostgreSQL', 'Stripe API', 'LINE Messaging API', 'Gemini API', 'Render', 'Cloudflare'],
    highlights: [
      '10業種向けAIテンプレート',
      'チャット内決済（Stripe）',
      'PWAアプリ化',
      'リアルタイムAI音声通話',
      'WordPress連携のSEO記事自動生成エンジン',
    ],
    link: { label: 'larubot.tokyo を見る', url: 'https://larubot.tokyo', external: true },
    screenshots: { count: 2, recommended: '1600×1000px（16:10）', portrait: false },
    placeholder: false,
    accent: 'indigo',
  },
  {
    slug: 'laruhp',
    name: 'LARU HP',
    category: 'AIホームページビルダー',
    tagline: 'AIで最高のHPを最短で',
    overview:
      '業種情報を入力するだけで、AIが約5分でホームページを自動生成するSaaS。15業種テンプレートとビジュアルエディタを備え、JSON-LD・メタタグのSEO自動最適化、LARUbot連携、代理店向けマルチクライアント管理までをカバーします。',
    tech: ['Next.js', 'React', 'TypeScript', '生成AI連携', 'Stripe'],
    highlights: [
      'AIコンテンツ自動生成',
      'ノーコードのビジュアルエディタ',
      'SEO自動最適化（JSON-LD・メタタグ）',
      'エージェンシーモード（代理店向けマルチクライアント管理）',
    ],
    link: { label: 'LARU HP サービスサイトへ', url: '/laruHP', external: false },
    screenshots: { count: 2, recommended: '1600×1000px（16:10）', portrait: false },
    placeholder: false,
    accent: 'cyan',
  },
  {
    slug: 'flastal',
    name: 'FLASTAL',
    category: 'iOSアプリ',
    tagline: 'iOSネイティブアプリ（詳細準備中）',
    // TODO: クライアントから概要・ハイライト・App Storeリンク・スクリーンショットの提供待ち
    overview:
      'WebアプリをCapacitorでiOSネイティブ化し、App Store配信に対応したモバイルアプリ。詳細な紹介コンテンツは近日公開予定です。',
    tech: ['Capacitor', 'Xcode', 'iOS'],
    highlights: ['WebアプリのiOSネイティブ化（Capacitor）', '紹介コンテンツ準備中'],
    link: null, // TODO: App Store リンク提供待ち
    screenshots: { count: 3, recommended: '1290×2796px（iPhone縦・9:19.5）', portrait: true },
    placeholder: true,
    accent: 'purple',
  },
];

export function getWork(slug: string): Work | undefined {
  return WORKS.find(w => w.slug === slug);
}

export const ACCENT_STYLES: Record<Work['accent'], { chip: string; border: string; text: string }> = {
  indigo: { chip: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/20', border: 'hover:border-indigo-400/40', text: 'text-indigo-400' },
  cyan:   { chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/20',       border: 'hover:border-cyan-400/40',   text: 'text-cyan-400' },
  purple: { chip: 'bg-purple-500/15 text-purple-300 border-purple-400/20', border: 'hover:border-purple-400/40', text: 'text-purple-400' },
};
