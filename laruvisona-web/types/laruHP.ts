export type BlockType =
  | 'nav' | 'hero' | 'heading' | 'paragraph' | 'image'
  | 'two-col' | 'three-col' | 'divider' | 'cta'
  | 'services' | 'testimonials' | 'faq' | 'contact'
  | 'hours' | 'gallery' | 'larubot'
  | 'video' | 'map' | 'countdown' | 'price-table' | 'booking' | 'news'
  | 'popup' | 'newsletter'
  | 'share' | 'stripe-buy'
  | 'google-reviews'
  | 'announcement-bar' | 'instagram'
  | 'before-after' | 'tabs' | 'team' | 'free'
  | 'shop-grid' | 'shop-item' | 'member-gate';

export interface Block {
  id: string;
  type: BlockType;
  data: Record<string, unknown>;
}

export interface SEOSettings {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
}

export interface Page {
  id: string;
  name: string;
  path: string;
  blocks: Block[];
  seo: SEOSettings;
  password?: string;
}

export interface GlobalFooter {
  enabled: boolean;
  logo: string;
  tagline: string;
  links: Array<{ label: string; href: string }>;
  sns: Array<{ platform: string; url: string }>;
  copyright: string;
  bgColor: string;
  textColor: string;
}

export interface SiteSettings {
  colorScheme: string;
  style: string;
  designStyle?: string;
  larubot: boolean;
  laruseo: boolean;
  gaTrackingId?: string;
  larubotPublicId?: string;
  laruseoPublicId?: string;
  notifyEmail?: string;
  customCss?: string;
  fontFamily?: string;
  globalFooter?: GlobalFooter;
  abStats?: { a?: number; b?: number };
  customPalette?: string[];
  previewToken?: string;
  lineNotifyToken?: string;
  clarityId?: string;
  webhookUrl?: string;
  sitePassword?: string;
  accentColor?: string;
  heroLayout?: 'center' | 'left' | 'split';
  headerStyle?: 'transparent' | 'solid' | 'colored';
  animLevel?: 'none' | 'subtle' | 'full';
}

export interface Site {
  id: string;
  user_id: string;
  name: string;
  slug: string | null;
  industry: string | null;
  blocks_json: Block[] | { v: number; pages: Page[] };
  seo_json: SEOSettings;
  settings_json: SiteSettings;
  published: boolean;
  published_html: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  business_name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled';
  contract_starts_at: string | null;
  contract_ends_at: string | null;
  created_at: string;
}

export interface OnboardingData {
  industry: string;
  businessName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  catchphrase: string;
  services: Array<{ name: string; description: string; price: string }>;
  hours: Array<{ day: string; open: string; close: string; closed: boolean }>;
  colorScheme: string;
  style: string;
  larubot: boolean;
  laruseo: boolean;
}
