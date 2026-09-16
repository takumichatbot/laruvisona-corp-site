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
  /**
   * 実際の画面。枠だけ置いて「準備中」と出すのはやめた。
   * 実績を見に来た人に空の枠を見せるのは、何も無いのと同じか、それ以下である。
   */
  shots: { src: string; alt: string; w: number; h: number; caption: string }[];
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
    shots: [
      { src: '/company/products/larubot.jpg', alt: 'LARUbotのサービス画面', w: 1200, h: 750, caption: 'larubot.tokyo（実際の画面）' },
      { src: '/company/products/larubot-sp.jpg', alt: 'LARUbotのスマートフォン表示', w: 390, h: 844, caption: 'スマートフォンでの表示' },
    ],
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
    shots: [
      { src: '/lp/studio-edit.jpg', alt: 'LARU HPの制作画面', w: 1200, h: 750, caption: '実際の制作画面' },
      { src: '/company/products/laruhp-sp.jpg', alt: 'LARU HPで作ったサイトのスマートフォン表示', w: 390, h: 844, caption: '作ったサイトのスマートフォン表示' },
    ],
    placeholder: false,
    accent: 'cyan',
  },
  {
    slug: 'flastal',
    name: 'FLASTAL',
    category: 'Webサービス',
    tagline: '応援する気持ちを、ひとつの花に',
    // iOSアプリはまだ出していない。出すまでは、実際に動いているWebサービスとして書く。
    // 出していないものを実績に書かない。
    // TODO: クライアントの許可を得たうえで、詳細とスクリーンショットを足す
    overview:
      '推しへフラワースタンドを贈るためのクラウドファンディングサービス。ファン同士が費用を出し合い、匿名のまま会場へ届けられます。画面の実装から決済、公開後の運用までを担当しています。',
    tech: ['Next.js', 'Stripe決済', 'PostgreSQL', 'Prisma'],
    highlights: ['ファン同士で費用を出し合う企画の仕組み', 'Stripeによる集金と返金の処理', '匿名配送と会場への手配'],
    link: { label: 'flastal.com を見る', url: 'https://www.flastal.com', external: true },
    shots: [
      { src: '/company/products/flastal.jpg', alt: 'FLASTALのトップページ', w: 1200, h: 595, caption: 'flastal.com（実際の画面）' },
      { src: '/company/products/flastal-sp.jpg', alt: 'FLASTALのスマートフォン表示', w: 390, h: 844, caption: 'スマートフォンでの表示' },
    ],
    placeholder: false,
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
