'use client';
import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getTemplateForIndustry, applyTemplateData } from '@/lib/templates';
import { exportToHTML } from '@/lib/html-export';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';

// ─── Types ────────────────────────────────────────────────────────────────────
type BlockType =
  | 'nav' | 'hero' | 'heading' | 'paragraph' | 'image'
  | 'two-col' | 'three-col' | 'divider' | 'cta'
  | 'services' | 'testimonials' | 'faq' | 'contact'
  | 'hours' | 'gallery' | 'larubot'
  | 'video' | 'map' | 'countdown' | 'price-table' | 'booking' | 'news'
  | 'popup' | 'newsletter'
  | 'share' | 'stripe-buy'
  | 'google-reviews'
  | 'announcement-bar' | 'instagram';

interface Block {
  id: string;
  type: BlockType;
  data: Record<string, unknown>;
  memo?: string;
}

interface SEOSettings {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
}

interface Page {
  id: string;
  name: string;
  path: string;
  blocks: Block[];
  seo: SEOSettings;
}

interface GlobalFooter {
  enabled: boolean;
  logo: string;
  tagline: string;
  links: Array<{ label: string; href: string }>;
  sns: Array<{ platform: string; url: string }>;
  copyright: string;
  bgColor: string;
  textColor: string;
}

interface SiteData {
  siteName: string;
  pages: Page[];
  colorScheme: string;
  designStyle: string;
  larubot: boolean;
  laruseo: boolean;
  notifyEmail: string;
  gaTrackingId: string;
  larubotPublicId: string;
  laruseoPublicId: string;
  customCss: string;
  fontFamily: string;
  accentColor: string;
  heroLayout: 'center' | 'left' | 'split';
  headerStyle: 'transparent' | 'solid' | 'colored';
  animLevel: 'none' | 'subtle' | 'full';
  globalFooter: GlobalFooter;
  customPalette: string[];
  lineNotifyToken: string;
  clarityId: string;
  webhookUrl: string;
  sitePassword: string;
}

const DEFAULT_PALETTE = ['#1e3a8a', '#3b82f6', '#111827', '#ffffff', '#6b7280', '#f59e0b'];
const PALETTE_LABELS = ['プライマリ', 'アクセント', 'テキスト', '背景', 'サブ', 'ポイント'];

const emptySeo: SEOSettings = { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '' };

// ─── Default Block Data ────────────────────────────────────────────────────────
const defaultBlock = (type: BlockType): Block => {
  const id = `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const defaults: Record<BlockType, Record<string, unknown>> = {
    nav: {
      logo: 'サイト名',
      links: [
        { label: 'トップ', href: '#' },
        { label: 'サービス', href: '#services' },
        { label: 'よくある質問', href: '#faq' },
        { label: 'お問い合わせ', href: '#contact' },
      ],
      ctaText: '無料相談',
      ctaLink: '#contact',
      bgColor: '#ffffff',
      textColor: '#111827',
      sticky: true,
      showCta: true,
    },
    hero: {
      heading: 'ここに見出しを入力',
      subheading: 'サブタイトル・キャッチコピーを入力してください',
      ctaText: 'お問い合わせはこちら',
      ctaLink: '#contact',
      bgColor: '#1e3a8a',
      textColor: '#ffffff',
      bgImage: '',
      align: 'center',
    },
    heading: {
      text: 'セクション見出し',
      subtext: 'サブテキスト（任意）',
      align: 'center',
      level: 'h2',
      color: '#111827',
    },
    paragraph: {
      text: 'ここに本文テキストを入力してください。サービスの説明や会社の紹介など、伝えたいことを自由に記述できます。',
      align: 'left',
      fontSize: '16',
    },
    image: { src: '', alt: '画像', caption: '', objectFit: 'cover', height: '300' },
    'two-col': {
      col1Title: '左カラム',
      col1Text: '左側のコンテンツを入力してください。',
      col2Title: '右カラム',
      col2Text: '右側のコンテンツを入力してください。',
      gap: '2rem',
    },
    'three-col': {
      col1Title: 'カラム1', col1Icon: '01', col1Text: 'コンテンツを入力',
      col2Title: 'カラム2', col2Icon: '02', col2Text: 'コンテンツを入力',
      col3Title: 'カラム3', col3Icon: '03', col3Text: 'コンテンツを入力',
    },
    divider: { style: 'solid', color: '#e5e7eb', thickness: '1', margin: '2', label: '' },
    cta: {
      heading: 'お気軽にご相談ください',
      subtext: 'まずは無料相談から。お気軽にお問い合わせください。',
      buttonText: 'お問い合わせ',
      buttonLink: '#contact',
      bgColor: '#1e3a8a',
      textColor: '#ffffff',
    },
    services: {
      heading: 'サービス・料金',
      subtext: '',
      columns: '3',
      items: [
        { icon: '01', title: 'サービス1', description: '説明を入力してください', price: '' },
        { icon: '02', title: 'サービス2', description: '説明を入力してください', price: '' },
        { icon: '03', title: 'サービス3', description: '説明を入力してください', price: '' },
      ],
    },
    testimonials: {
      heading: 'お客様の声',
      items: [
        { name: '山田様', age: '40代', rating: 5, text: 'とても良かったです！おすすめします。' },
        { name: '鈴木様', age: '30代', rating: 5, text: 'スタッフの対応が丁寧で満足しています。' },
        { name: '田中様', age: '50代', rating: 5, text: '友人にも紹介したいと思います。' },
      ],
    },
    faq: {
      heading: 'よくある質問',
      items: [
        { q: 'ご質問1', a: '回答を入力してください。' },
        { q: 'ご質問2', a: '回答を入力してください。' },
        { q: 'ご質問3', a: '回答を入力してください。' },
      ],
    },
    contact: {
      heading: 'お問い合わせ',
      subtext: 'お気軽にご相談ください。通常2営業日以内にご返信いたします。',
      fields: ['name', 'email', 'phone', 'message'],
      extraFields: [] as string[],
      multiStep: false,
      buttonText: '送信する',
      buttonColor: '#1e3a8a',
      bgColor: '#f8fafc',
    },
    hours: {
      heading: '営業時間',
      schedule: [
        { day: '月', hours: '9:00〜18:00', closed: false },
        { day: '火', hours: '9:00〜18:00', closed: false },
        { day: '水', hours: '9:00〜18:00', closed: false },
        { day: '木', hours: '9:00〜18:00', closed: false },
        { day: '金', hours: '9:00〜18:00', closed: false },
        { day: '土', hours: '10:00〜17:00', closed: false },
        { day: '日', hours: '', closed: true },
      ],
      note: 'お電話は営業時間内にお願いします',
    },
    gallery: {
      heading: 'ギャラリー',
      images: ['', '', '', ''],
      columns: '2',
    },
    larubot: {
      position: 'bottom-right',
      primaryColor: '#4f46e5',
      welcomeMessage: 'こんにちは！何かお手伝いできますか？',
      enabled: true,
    },
    video: {
      heading: '動画',
      url: '',
      aspectRatio: '16/9',
    },
    map: {
      heading: 'アクセス',
      embedUrl: '',
      height: '400',
    },
    countdown: {
      heading: 'カウントダウン',
      subtext: '開催まであと',
      targetDate: '',
      bgColor: '#1e3a8a',
      textColor: '#ffffff',
    },
    'price-table': {
      heading: '料金プラン',
      subtext: '最適なプランをお選びください',
      plans: [
        { name: 'ライト', price: '¥3,000', period: '/月', description: '個人向け', features: ['機能A', '機能B', '機能C'], highlighted: false, buttonText: '申し込む', buttonLink: '#contact' },
        { name: 'スタンダード', price: '¥5,000', period: '/月', description: 'チーム・小規模ビジネス向け', features: ['機能A', '機能B', '機能C', '機能D', '優先サポート'], highlighted: true, buttonText: 'おすすめ', buttonLink: '#contact' },
        { name: 'プロ', price: '¥10,000', period: '/月', description: '法人・大規模向け', features: ['全機能利用', '優先サポート', 'カスタム対応'], highlighted: false, buttonText: '相談する', buttonLink: '#contact' },
      ],
    },
    booking: {
      heading: '予約・お問い合わせ',
      subtext: 'ご希望の日時をお選びください',
      bgColor: '#f8fafc',
      buttonColor: '#1e3a8a',
      buttonText: '予約を確定する',
      serviceTypes: ['初回相談', 'フォローアップ', 'その他'],
      timeSlots: ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00'],
    },
    news: {
      heading: 'お知らせ',
      items: [
        { date: '2026-06-01', tag: '重要', title: 'お知らせ1のタイトルを入力' },
        { date: '2026-05-20', tag: 'イベント', title: 'お知らせ2のタイトルを入力' },
        { date: '2026-05-10', tag: '更新', title: 'お知らせ3のタイトルを入力' },
      ],
    },
    popup: {
      heading: '期間限定キャンペーン',
      text: '今だけ初回限定20%OFFでご利用いただけます。',
      buttonText: '詳細を見る',
      buttonLink: '#contact',
      trigger: 'delay',
      delay: '3',
      bgColor: '#1e3a8a',
      textColor: '#ffffff',
      buttonColor: '#ffffff',
      buttonTextColor: '#1e3a8a',
      overlayColor: 'rgba(0,0,0,0.6)',
    },
    newsletter: {
      heading: 'メールマガジン登録',
      subtext: '最新情報をお届けします',
      placeholder: 'メールアドレスを入力',
      buttonText: '登録する',
      buttonColor: '#1e3a8a',
      bgColor: '#f9fafb',
    },
    share: {
      heading: 'シェアしてください',
      showLine: true,
      showTwitter: true,
      showFacebook: true,
      bgColor: '#ffffff',
    },
    'stripe-buy': {
      label: '商品名',
      description: '商品の説明を入力してください',
      priceId: '',
      buttonText: '今すぐ購入',
      buttonColor: '#1e3a8a',
    },
    'google-reviews': {
      heading: 'お客様の声',
      placeId: '',
      maxReviews: 3,
      rating: 0,
      totalRatings: 0,
      reviews: [],
      lastFetched: '',
    },
    'announcement-bar': {
      text: '🎉 期間限定キャンペーン開催中！今すぐチェック',
      link: '#contact',
      bgColor: '#1e40af',
      textColor: '#ffffff',
      closeable: 'true',
    },
    instagram: {
      heading: 'Instagram',
      username: '',
      photos: [] as string[],
      columns: '3',
    },
  };
  return { id, type, data: defaults[type] };
};

// ─── Color Schemes ────────────────────────────────────────────────────────────
const COLOR_SCHEMES = [
  { id: 'professional-blue', name: 'プロブルー',    colors: ['#1e3a8a', '#3b82f6'] },
  { id: 'warm-earth',        name: 'ナチュラル',    colors: ['#78350f', '#d97706'] },
  { id: 'elegant-dark',      name: 'エレガント',    colors: ['#111827', '#6b7280'] },
  { id: 'fresh-green',       name: 'フレッシュ',    colors: ['#064e3b', '#10b981'] },
  { id: 'modern-pink',       name: 'フェミニン',    colors: ['#831843', '#ec4899'] },
  { id: 'bold-orange',       name: 'アクティブ',    colors: ['#7c2d12', '#f97316'] },
  { id: 'midnight-gold',     name: 'ミッドナイト', colors: ['#0d1b2a', '#d4a017'] },
  { id: 'ocean-teal',        name: 'オーシャン',    colors: ['#0d4e5c', '#14b8a6'] },
  { id: 'lavender-night',    name: 'ラベンダー',    colors: ['#1e1b4b', '#8b5cf6'] },
  { id: 'terracotta',        name: 'テラコッタ',    colors: ['#8b3a2a', '#d4856a'] },
  { id: 'cyber-neon',        name: 'サイバー',      colors: ['#050505', '#00e676'] },
  { id: 'rose-gold',         name: 'ローズゴールド', colors: ['#6b2f41', '#d4846a'] },
  { id: 'monochrome',        name: 'モノクロ',      colors: ['#111111', '#e0e0e0'] },
  { id: 'sky-clear',         name: 'スカイ',        colors: ['#1565c0', '#90caf9'] },
  { id: 'sunset-dusk',       name: 'サンセット',    colors: ['#2d1b54', '#f97316'] },
  { id: 'deep-crimson',      name: 'クリムゾン',    colors: ['#7f1d1d', '#ef4444'] },
  { id: 'sage-forest',       name: 'セージ',        colors: ['#1a3528', '#6db97c'] },
  { id: 'navy-gold',         name: 'ネイビーゴールド', colors: ['#0f172a', '#eab308'] },
];

// ─── Block Palette Config ─────────────────────────────────────────────────────
const BLOCK_PALETTE = [
  { group: 'レイアウト', items: [
    { type: 'nav' as BlockType, label: 'ナビバー', icon: '🧭' },
    { type: 'hero' as BlockType, label: 'ヒーロー', icon: '🦸' },
    { type: 'two-col' as BlockType, label: '2カラム', icon: '⬛' },
    { type: 'three-col' as BlockType, label: '3カラム', icon: '🔲' },
    { type: 'divider' as BlockType, label: '区切り線', icon: '〰️' },
  ]},
  { group: 'コンテンツ', items: [
    { type: 'heading' as BlockType, label: '見出し', icon: '🔤' },
    { type: 'paragraph' as BlockType, label: 'テキスト', icon: '📝' },
    { type: 'image' as BlockType, label: '画像', icon: '🖼' },
    { type: 'gallery' as BlockType, label: 'ギャラリー', icon: '📸' },
    { type: 'cta' as BlockType, label: 'CTAボタン', icon: '⚡' },
  ]},
  { group: 'ビジネス', items: [
    { type: 'services' as BlockType, label: 'サービス', icon: '📋' },
    { type: 'testimonials' as BlockType, label: 'お客様の声', icon: '⭐' },
    { type: 'faq' as BlockType, label: 'FAQ', icon: '❓' },
    { type: 'hours' as BlockType, label: '営業時間', icon: '🕐' },
    { type: 'contact' as BlockType, label: 'お問合せ', icon: '📞' },
  ]},
  { group: 'メディア', items: [
    { type: 'video' as BlockType, label: '動画', icon: '▶️' },
    { type: 'map' as BlockType, label: 'マップ', icon: '📍' },
    { type: 'countdown' as BlockType, label: 'カウント', icon: '⏱' },
  ]},
  { group: '予約・料金', items: [
    { type: 'price-table' as BlockType, label: '料金プラン', icon: '💰' },
    { type: 'booking' as BlockType, label: '予約フォーム', icon: '📅' },
    { type: 'news' as BlockType, label: 'お知らせ', icon: '📰' },
  ]},
  { group: '連携', items: [
    { type: 'larubot' as BlockType, label: 'LARUbot', icon: '🤖' },
  ]},
  { group: '集客', items: [
    { type: 'announcement-bar' as BlockType, label: 'お知らせバー', icon: '📢' },
    { type: 'popup' as BlockType, label: 'ポップアップ', icon: '💬' },
    { type: 'newsletter' as BlockType, label: 'メルマガ登録', icon: '📧' },
    { type: 'share' as BlockType, label: 'SNSシェア', icon: '🔗' },
    { type: 'stripe-buy' as BlockType, label: '購入ボタン', icon: '🛒' },
    { type: 'google-reviews' as BlockType, label: 'Google口コミ', icon: '⭐' },
    { type: 'instagram' as BlockType, label: 'Instagram', icon: '📷' },
  ]},
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getVideoEmbedUrl(url: string): string {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}

function CountdownTimer({ targetDate, textColor }: { targetDate: string; textColor: string }) {
  const [t, setT] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setT({ d: 0, h: 0, m: 0, s: 0 }); return; }
      setT({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  const units: Array<[keyof typeof t, string]> = [['d', '日'], ['h', '時間'], ['m', '分'], ['s', '秒']];
  return (
    <div className="flex gap-6 justify-center" style={{ color: textColor }}>
      {units.map(([key, label]) => (
        <div key={key} className="text-center">
          <div className="text-5xl font-black tabular-nums">{String(t[key]).padStart(2, '0')}</div>
          <div className="text-sm opacity-70 mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Block Renderer (Canvas) ──────────────────────────────────────────────────
function BlockCanvas({ block, selected, multiSelected, onSelect, onDataChange }: {
  block: Block;
  selected: boolean;
  multiSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDataChange: (data: Record<string, unknown>) => void;
}) {
  const d = block.data;

  const editable = (key: string, tag: 'h1'|'h2'|'h3'|'h4'|'p'|'div'|'span' = 'span', className: string = '') => {
    const props = {
      contentEditable: true as const,
      suppressContentEditableWarning: true,
      className: `outline-none focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:bg-blue-50/80 rounded transition-all cursor-text ${className}`,
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        onDataChange({ ...d, [key]: e.currentTarget.textContent || '' });
      },
      dangerouslySetInnerHTML: { __html: (d[key] as string) || '' },
    };
    if (tag === 'h1') return <h1 {...props} />;
    if (tag === 'h2') return <h2 {...props} />;
    if (tag === 'h3') return <h3 {...props} />;
    if (tag === 'h4') return <h4 {...props} />;
    if (tag === 'p') return <p {...props} />;
    if (tag === 'div') return <div {...props} />;
    return <span {...props} />;
  };

  const inner = () => {
    switch (block.type) {
      case 'nav': {
        const links = (d.links as { label: string; href: string }[]) || [];
        return (
          <div className="flex items-center justify-between px-6 py-4 shadow-sm" style={{ backgroundColor: d.bgColor as string, color: d.textColor as string }}>
            <span
              contentEditable suppressContentEditableWarning
              className="font-black text-lg outline-none cursor-text hover:bg-black/5 rounded px-1"
              onBlur={(e: React.FocusEvent<HTMLElement>) => onDataChange({ ...d, logo: e.currentTarget.textContent || '' })}
              dangerouslySetInnerHTML={{ __html: (d.logo as string) || 'サイト名' }}
            />
            <div className="flex items-center gap-5 text-sm">
              {links.map((l, i) => (
                <span key={i} className="opacity-80 hover:opacity-100 cursor-pointer">{l.label}</span>
              ))}
              {!!d.showCta && (
                <span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold">
                  {d.ctaText as string}
                </span>
              )}
            </div>
          </div>
        );
      }

      case 'hero':
        return (
          <div className="min-h-[360px] flex flex-col items-center justify-center text-center px-8 py-16 relative overflow-hidden" style={{ backgroundColor: d.bgColor as string, color: d.textColor as string }}>
            {(d.bgImage as string) ? <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${d.bgImage as string})` }} /> : null}
            {d.abVariant === 'b' && (
              <div className="absolute bottom-2 right-2 z-20 bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">B バリアント</div>
            )}
            <div className="relative z-10 max-w-2xl">
              {editable('heading', 'h1', 'text-4xl font-black mb-4 block w-full')}
              {editable('subheading', 'p', 'text-lg mb-8 block opacity-90 w-full')}
              <span
                contentEditable
                suppressContentEditableWarning
                className="inline-block bg-white text-gray-900 px-8 py-3 rounded-full font-bold cursor-text outline-none hover:opacity-90"
                onBlur={(e: React.FocusEvent<HTMLElement>) => onDataChange({ ...d, ctaText: e.currentTarget.textContent || '' })}
                dangerouslySetInnerHTML={{ __html: (d.ctaText as string) || '' }}
              />
            </div>
          </div>
        );

      case 'heading': {
        const hFsMap: Record<string, string> = { sm: 'text-sm', base: 'text-base', xl: 'text-xl', '2xl': 'text-2xl', '3xl': 'text-3xl', '4xl': 'text-4xl' };
        const hFwMap: Record<string, string> = { normal: 'font-normal', semibold: 'font-semibold', bold: 'font-bold', extrabold: 'font-extrabold', black: 'font-black' };
        return (
          <div className="px-8 py-12" style={{ textAlign: d.align as React.CSSProperties['textAlign'], color: (d.color as string) || '#111827' }}>
            {(d.image as string) && <img src={d.image as string} alt="" className="w-full rounded-xl mb-6 object-cover" style={{ height: '200px' }} />}
            {editable('text', 'h2', `${hFsMap[d.fontSize as string] || 'text-3xl'} ${hFwMap[d.fontWeight as string] || 'font-black'} block mb-2`)}
            {editable('subtext', 'p', 'text-gray-500 block')}
          </div>
        );
      }

      case 'paragraph': {
        const pFsMap: Record<string, string> = { sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl' };
        const pMwMap: Record<string, string> = { full: 'max-w-full', prose: 'max-w-prose', lg: 'max-w-2xl', md: 'max-w-xl', sm: 'max-w-lg' };
        const pFontClass = `${pFsMap[d.fontSize as string] || 'text-base'} leading-relaxed block w-full`;
        const pColor = (d.color as string) || '#374151';
        const pAlign = d.align as React.CSSProperties['textAlign'];
        const imgPos = d.imagePosition as string;
        if ((d.image as string) && imgPos && imgPos !== 'none') {
          return (
            <div className={`px-8 py-6 flex gap-8 items-start max-w-5xl mx-auto ${imgPos === 'right' ? 'flex-row-reverse' : ''}`} style={{ textAlign: pAlign, color: pColor }}>
              <img src={d.image as string} alt="" className="w-48 rounded-xl object-cover flex-shrink-0" style={{ height: '160px' }} />
              <div className="flex-1">{editable('text', 'p', pFontClass)}</div>
            </div>
          );
        }
        return (
          <div className={`px-8 py-6 mx-auto ${pMwMap[d.maxWidth as string] || 'max-w-3xl'}`} style={{ textAlign: pAlign, color: pColor }}>
            {editable('text', 'p', pFontClass)}
          </div>
        );
      }

      case 'image':
        return (
          <div className="px-8 py-6">
            {d.src ? (
              <img src={d.src as string} alt={d.alt as string} className="w-full rounded-xl object-cover" style={{ height: `${d.height || 300}px` }} />
            ) : (
              <label className="block w-full rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-50 transition-colors" style={{ height: `${d.height || 300}px` }}>
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-gray-300"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <div className="font-medium">クリックして画像をアップロード</div>
                  <div className="text-sm mt-1">PNG, JPG, WebP 対応 (最大5MB)</div>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const form = new FormData();
                  form.append('file', file);
                  const res = await fetch('/api/images/upload', { method: 'POST', body: form });
                  const data = await res.json();
                  if (data.url) onDataChange({ ...d, src: data.url });
                  else {
                    const reader = new FileReader();
                    reader.onload = ev => onDataChange({ ...d, src: ev.target?.result as string });
                    reader.readAsDataURL(file);
                  }
                }} />
              </label>
            )}
            {editable('caption', 'p', 'text-center text-sm text-gray-400 mt-2 block')}
          </div>
        );

      case 'two-col':
        return (
          <div className="px-8 py-8 grid grid-cols-2 gap-8">
            <div className="bg-gray-50 rounded-xl overflow-hidden">
              {(d.col1Image as string) && <img src={d.col1Image as string} alt="" className="w-full object-cover" style={{ height: '160px' }} />}
              <div className="p-6">
                {editable('col1Title', 'h3', 'text-xl font-bold text-gray-800 block mb-3')}
                {editable('col1Text', 'p', 'text-gray-600 leading-relaxed block')}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl overflow-hidden">
              {(d.col2Image as string) && <img src={d.col2Image as string} alt="" className="w-full object-cover" style={{ height: '160px' }} />}
              <div className="p-6">
                {editable('col2Title', 'h3', 'text-xl font-bold text-gray-800 block mb-3')}
                {editable('col2Text', 'p', 'text-gray-600 leading-relaxed block')}
              </div>
            </div>
          </div>
        );

      case 'three-col':
        return (
          <div className="px-8 py-8 grid grid-cols-3 gap-6">
            {[1,2,3].map(n => (
              <div key={n} className="bg-gray-50 rounded-xl overflow-hidden text-center">
                {(d[`col${n}Image`] as string) && <img src={d[`col${n}Image`] as string} alt="" className="w-full object-cover" style={{ height: '130px' }} />}
                <div className="p-6">
                  {editable(`col${n}Icon`, 'div', 'text-3xl mb-3 block')}
                  {editable(`col${n}Title`, 'h3', 'text-lg font-bold text-gray-800 block mb-2')}
                  {editable(`col${n}Text`, 'p', 'text-gray-600 text-sm leading-relaxed block')}
                </div>
              </div>
            ))}
          </div>
        );

      case 'divider':
        return (
          <div className="px-8" style={{ paddingTop: `${d.margin}rem`, paddingBottom: `${d.margin}rem` }}>
            {d.label ? (
              <div className="flex items-center gap-4">
                <hr className="flex-1" style={{ borderColor: d.color as string, borderTopWidth: `${d.thickness}px`, borderStyle: d.style as string }} />
                <span className="text-gray-400 text-sm font-medium px-3">{d.label as string}</span>
                <hr className="flex-1" style={{ borderColor: d.color as string, borderTopWidth: `${d.thickness}px`, borderStyle: d.style as string }} />
              </div>
            ) : (
              <hr style={{ borderColor: d.color as string, borderTopWidth: `${d.thickness}px`, borderStyle: d.style as string }} />
            )}
          </div>
        );

      case 'cta':
        return (
          <div className="px-8 py-16 text-center" style={{ backgroundColor: d.bgColor as string, color: d.textColor as string }}>
            {editable('heading', 'h2', 'text-3xl font-black block mb-4 w-full')}
            {editable('subtext', 'p', 'block mb-8 opacity-90 w-full')}
            <span
              contentEditable
              suppressContentEditableWarning
              className="inline-block bg-white text-gray-900 px-10 py-3 rounded-full font-bold cursor-text outline-none"
              onBlur={(e: React.FocusEvent<HTMLElement>) => onDataChange({ ...d, buttonText: e.currentTarget.textContent || '' })}
              dangerouslySetInnerHTML={{ __html: (d.buttonText as string) || '' }}
            />
          </div>
        );

      case 'services': {
        const items = (d.items as Array<{icon:string; title:string; description:string; price:string; image?:string}>) || [];
        const cols = d.columns === '2' ? 'grid-cols-2' : 'grid-cols-3';
        return (
          <div className="px-8 py-12">
            {editable('heading', 'h2', 'text-3xl font-black text-center text-gray-800 block mb-2')}
            {editable('subtext', 'p', 'text-center text-gray-500 block mb-10')}
            <div className={`grid ${cols} gap-6`}>
              {items.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                  {item.image && <img src={item.image} alt="" className="w-full object-cover" style={{ height: '150px' }} />}
                  <div className="p-6 text-center">
                    <div
                      contentEditable suppressContentEditableWarning
                      className="text-3xl mb-3 block outline-none cursor-text"
                      onBlur={e => {
                        const newItems = [...items];
                        newItems[i] = { ...newItems[i], icon: e.currentTarget.textContent || '' };
                        onDataChange({ ...d, items: newItems });
                      }}
                      dangerouslySetInnerHTML={{ __html: item.icon }}
                    />
                    <div
                      contentEditable suppressContentEditableWarning
                      className="font-bold text-gray-800 text-lg mb-2 block outline-none cursor-text"
                      onBlur={e => {
                        const newItems = [...items];
                        newItems[i] = { ...newItems[i], title: e.currentTarget.textContent || '' };
                        onDataChange({ ...d, items: newItems });
                      }}
                      dangerouslySetInnerHTML={{ __html: item.title }}
                    />
                    <p contentEditable suppressContentEditableWarning
                      className="text-gray-500 text-sm mb-3 outline-none cursor-text focus:ring-1 focus:ring-blue-400/40 rounded"
                      onBlur={e => { const ni=[...items]; ni[i]={...ni[i],description:e.currentTarget.textContent||''}; onDataChange({...d,items:ni}); }}
                      dangerouslySetInnerHTML={{ __html: item.description }} />
                    {item.price && <span contentEditable suppressContentEditableWarning
                      className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-bold outline-none cursor-text inline-block"
                      onBlur={e => { const ni=[...items]; ni[i]={...ni[i],price:e.currentTarget.textContent||''}; onDataChange({...d,items:ni}); }}
                      dangerouslySetInnerHTML={{ __html: item.price }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'testimonials': {
        const items = (d.items as Array<{name:string; age:string; rating:number; text:string}>) || [];
        return (
          <div className="px-8 py-12 bg-gray-50">
            {editable('heading', 'h2', 'text-3xl font-black text-center text-gray-800 block mb-10')}
            <div className="grid grid-cols-3 gap-6">
              {items.map((item, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex gap-1 mb-3">
                    {[...Array(item.rating)].map((_, j) => <span key={j} className="text-yellow-400">★</span>)}
                  </div>
                  <p contentEditable suppressContentEditableWarning
                    className="text-gray-600 text-sm leading-relaxed mb-4 outline-none cursor-text focus:ring-1 focus:ring-blue-400/40 rounded"
                    onBlur={e => { const ni=[...items]; ni[i]={...ni[i],text:e.currentTarget.textContent||''}; onDataChange({...d,items:ni}); }}
                    dangerouslySetInnerHTML={{ __html: item.text }} />
                  <div className="text-gray-800 font-bold text-sm">
                    <span contentEditable suppressContentEditableWarning className="outline-none cursor-text focus:ring-1 focus:ring-blue-400/40 rounded"
                      onBlur={e => { const ni=[...items]; ni[i]={...ni[i],name:e.currentTarget.textContent||''}; onDataChange({...d,items:ni}); }}
                      dangerouslySetInnerHTML={{ __html: item.name }} />
                    <span className="text-gray-400 font-normal ml-1">(
                      <span contentEditable suppressContentEditableWarning className="outline-none cursor-text focus:ring-1 focus:ring-blue-400/40 rounded"
                        onBlur={e => { const ni=[...items]; ni[i]={...ni[i],age:e.currentTarget.textContent||''}; onDataChange({...d,items:ni}); }}
                        dangerouslySetInnerHTML={{ __html: item.age }} />
                    )</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'faq': {
        const items = (d.items as Array<{q:string; a:string}>) || [];
        return (
          <div className="px-8 py-12">
            {editable('heading', 'h2', 'text-3xl font-black text-gray-800 block mb-8')}
            <div className="space-y-3 max-w-2xl mx-auto">
              {items.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-5 flex gap-3 items-start bg-white">
                    <span className="text-blue-500 font-black text-lg flex-shrink-0 leading-tight">Q</span>
                    <p contentEditable suppressContentEditableWarning
                      className="font-bold text-gray-800 outline-none cursor-text focus:ring-2 focus:ring-blue-500/60 focus:bg-blue-50/80 rounded flex-1"
                      onBlur={e => { const ni=[...items]; ni[i]={...ni[i],q:e.currentTarget.textContent||''}; onDataChange({...d,items:ni}); }}
                      dangerouslySetInnerHTML={{ __html: item.q }} />
                    <span className="text-gray-300 text-xs flex-shrink-0 leading-tight mt-1">▼</span>
                  </div>
                  <div className="px-5 pb-5 pt-3 flex gap-3 bg-gray-50 border-t border-gray-100">
                    <span className="text-green-500 font-black text-lg flex-shrink-0 leading-tight">A</span>
                    <p contentEditable suppressContentEditableWarning
                      className="text-gray-600 text-sm outline-none cursor-text focus:ring-2 focus:ring-blue-500/60 focus:bg-blue-50/80 rounded flex-1"
                      onBlur={e => { const ni=[...items]; ni[i]={...ni[i],a:e.currentTarget.textContent||''}; onDataChange({...d,items:ni}); }}
                      dangerouslySetInnerHTML={{ __html: item.a }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'contact':
        return (
          <div className="px-8 py-12" style={{ backgroundColor: d.bgColor as string }}>
            {editable('heading', 'h2', 'text-3xl font-black text-gray-800 text-center block mb-2')}
            {editable('subtext', 'p', 'text-gray-500 text-center block mb-10')}
            <div className="max-w-lg mx-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="お名前" className="border border-gray-200 rounded-xl px-4 py-3 w-full bg-gray-50 text-gray-400 cursor-not-allowed" readOnly />
                <input type="email" placeholder="メールアドレス" className="border border-gray-200 rounded-xl px-4 py-3 w-full bg-gray-50 text-gray-400 cursor-not-allowed" readOnly />
              </div>
              <input type="tel" placeholder="電話番号" className="border border-gray-200 rounded-xl px-4 py-3 w-full bg-gray-50 text-gray-400 cursor-not-allowed" readOnly />
              <textarea placeholder="お問い合わせ内容" rows={4} className="border border-gray-200 rounded-xl px-4 py-3 w-full bg-gray-50 text-gray-400 cursor-not-allowed resize-none" readOnly />
              <button className="w-full py-3 rounded-xl font-bold text-white" style={{ backgroundColor: d.buttonColor as string }}>
                {d.buttonText as string}
              </button>
            </div>
          </div>
        );

      case 'hours': {
        const schedule = (d.schedule as Array<{day:string; hours:string; closed:boolean}>) || [];
        return (
          <div className="px-8 py-12">
            {editable('heading', 'h2', 'text-3xl font-black text-gray-800 block mb-8')}
            <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {schedule.map((row, i) => (
                <div key={i} className={`flex items-center px-6 py-3 ${i < schedule.length - 1 ? 'border-b border-gray-100' : ''} ${row.closed ? 'bg-gray-50' : ''}`}>
                  <span className="w-8 font-bold text-gray-700 text-sm">{row.day}</span>
                  {row.closed ? (
                    <span className="text-red-400 text-sm font-medium ml-4">定休日</span>
                  ) : (
                    <span className="text-gray-700 text-sm ml-4">{row.hours}</span>
                  )}
                </div>
              ))}
            </div>
            {(d.note as string) && <p className="text-center text-gray-400 text-sm mt-4">{d.note as string}</p>}
          </div>
        );
      }

      case 'gallery': {
        const images = (d.images as string[]) || ['', '', '', ''];
        const cols = d.columns === '3' ? 'grid-cols-3' : 'grid-cols-2';
        return (
          <div className="px-8 py-8">
            {editable('heading', 'h2', 'text-3xl font-black text-gray-800 block mb-6 text-center')}
            <div className={`grid ${cols} gap-3`}>
              {images.map((src, i) => (
                <label key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-50 transition-colors">
                  {src ? (
                    <img src={src} alt={`gallery-${i}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                      <div className="text-center text-gray-400 text-xs">画像を追加</div>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const form = new FormData();
                    form.append('file', file);
                    const res = await fetch('/api/images/upload', { method: 'POST', body: form });
                    const data = await res.json();
                    const newImages = [...images];
                    if (data.url) {
                      newImages[i] = data.url;
                    } else {
                      const reader = new FileReader();
                      await new Promise<void>(resolve => {
                        reader.onload = ev => { newImages[i] = ev.target?.result as string; resolve(); };
                        reader.readAsDataURL(file);
                      });
                    }
                    onDataChange({ ...d, images: newImages });
                  }} />
                </label>
              ))}
            </div>
          </div>
        );
      }

      case 'larubot':
        return (
          <div className="px-8 py-6 bg-indigo-50 border-l-4 border-indigo-500">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0 text-white font-black text-sm">LB</div>
              <div>
                <div className="font-bold text-indigo-900">LARUbot チャットウィジェット</div>
                <div className="text-indigo-600 text-sm">AIチャットボットが右下に表示されます。訪問者の質問に24時間自動回答。</div>
              </div>
              <div className="ml-auto">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${d.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {d.enabled ? '有効' : '無効'}
                </span>
              </div>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="px-8 py-8">
            {editable('heading', 'h2', 'text-2xl font-black text-gray-800 block mb-4')}
            {d.url ? (
              <div className="w-full rounded-xl overflow-hidden" style={{ aspectRatio: (d.aspectRatio as string) || '16/9' }}>
                <iframe
                  src={getVideoEmbedUrl(d.url as string)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="w-full bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center" style={{ aspectRatio: '16/9', minHeight: '200px' }}>
                <div className="text-center text-gray-400 p-8">
                  <div className="text-4xl mb-2">▶️</div>
                  <div className="text-sm font-medium">右パネルでYouTube/VimeoのURLを入力</div>
                </div>
              </div>
            )}
          </div>
        );

      case 'map':
        return (
          <div className="px-8 py-8">
            {editable('heading', 'h2', 'text-2xl font-black text-gray-800 block mb-4')}
            {d.embedUrl ? (
              <iframe
                src={d.embedUrl as string}
                className="w-full rounded-xl"
                style={{ height: `${d.height || 400}px`, border: 'none' }}
                loading="lazy"
              />
            ) : (
              <div className="w-full bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center" style={{ height: '300px' }}>
                <div className="text-center text-gray-400 p-8">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 mx-auto text-gray-300"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <div className="text-sm font-medium">右パネルでGoogle MapsのEmbedURLを入力</div>
                </div>
              </div>
            )}
          </div>
        );

      case 'countdown':
        return (
          <div className="px-8 py-16 text-center" style={{ backgroundColor: d.bgColor as string, color: d.textColor as string }}>
            {editable('heading', 'h2', 'text-3xl font-black block mb-2 w-full')}
            {editable('subtext', 'p', 'block mb-10 opacity-80 w-full')}
            {d.targetDate ? (
              <CountdownTimer targetDate={d.targetDate as string} textColor={d.textColor as string || '#ffffff'} />
            ) : (
              <div className="text-lg opacity-60">右パネルで日時を設定してください</div>
            )}
          </div>
        );

      case 'price-table': {
        type PricePlan = { name: string; price: string; period: string; description: string; features: string[]; highlighted: boolean; buttonText: string; buttonLink: string };
        const plans = (d.plans as PricePlan[]) || [];
        return (
          <div className="px-8 py-12">
            {editable('heading', 'h2', 'text-3xl font-black text-center text-gray-800 block mb-2')}
            {editable('subtext', 'p', 'text-center text-gray-500 block mb-10')}
            <div className="grid grid-cols-3 gap-5 max-w-3xl mx-auto">
              {plans.map((plan, i) => (
                <div key={i} className={`rounded-2xl p-6 flex flex-col transition-all ${plan.highlighted ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-white border border-gray-200'}`}>
                  {plan.highlighted && <div className="text-[10px] font-black tracking-widest uppercase text-blue-200 mb-2">おすすめ</div>}
                  <div className={`text-sm font-bold mb-1 ${plan.highlighted ? 'text-blue-200' : 'text-gray-500'}`}>{plan.name}</div>
                  <div className="flex items-end gap-1 mb-1">
                    <span className={`text-3xl font-black ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>{plan.price}</span>
                    <span className={`text-sm pb-1 ${plan.highlighted ? 'text-blue-200' : 'text-gray-400'}`}>{plan.period}</span>
                  </div>
                  <div className={`text-xs mb-5 ${plan.highlighted ? 'text-blue-200' : 'text-gray-400'}`}>{plan.description}</div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-xs">
                        <span className={plan.highlighted ? 'text-blue-300' : 'text-green-500'}>✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a href={plan.buttonLink} className={`block text-center py-2.5 rounded-xl font-bold text-sm ${plan.highlighted ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
                    {plan.buttonText}
                  </a>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'booking': {
        const serviceTypes = (d.serviceTypes as string[]) || [];
        const timeSlots = (d.timeSlots as string[]) || [];
        return (
          <div className="px-8 py-12" style={{ backgroundColor: d.bgColor as string }}>
            {editable('heading', 'h2', 'text-3xl font-black text-gray-800 text-center block mb-2')}
            {editable('subtext', 'p', 'text-gray-500 text-center block mb-8')}
            <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">
              <div>
                <div className="text-sm font-bold text-gray-700 mb-2">サービスを選択</div>
                <div className="flex flex-wrap gap-2">
                  {serviceTypes.map((s, i) => (
                    <span key={i} className="px-3 py-1.5 border border-blue-200 rounded-xl text-sm text-blue-600 bg-blue-50">{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm font-bold text-gray-700 mb-2">ご希望の日程</div>
                <input type="date" className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-500 text-sm" readOnly />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-700 mb-2">ご希望の時間</div>
                <div className="grid grid-cols-3 gap-2">
                  {timeSlots.map((t, i) => (
                    <span key={i} className="border border-blue-200 rounded-xl py-2 text-center text-sm text-blue-600 bg-blue-50">{t}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="お名前" className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-400 text-sm" readOnly />
                <input type="tel" placeholder="電話番号" className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-400 text-sm" readOnly />
              </div>
              <button className="w-full py-3 rounded-xl font-bold text-white text-sm" style={{ backgroundColor: d.buttonColor as string }}>
                {d.buttonText as string}
              </button>
            </div>
          </div>
        );
      }

      case 'news': {
        type NewsItem = { date: string; tag: string; title: string };
        const items = (d.items as NewsItem[]) || [];
        return (
          <div className="px-8 py-12">
            {editable('heading', 'h2', 'text-3xl font-black text-gray-800 block mb-8')}
            <div className="max-w-2xl mx-auto divide-y divide-gray-100">
              {items.map((item, i) => (
                <div key={i} className="flex items-start gap-4 py-4 px-3 hover:bg-gray-50 rounded-xl transition-colors">
                  <span className="text-gray-400 text-sm whitespace-nowrap mt-0.5 font-mono">{item.date}</span>
                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 text-[11px] font-bold rounded-full whitespace-nowrap">{item.tag}</span>
                  <span className="text-gray-800 text-sm font-medium">{item.title}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'popup':
        return (
          <div className="px-8 py-5 border-l-4 border-yellow-400 bg-yellow-50 flex items-start gap-4">
            <div className="text-2xl">💬</div>
            <div className="flex-1">
              <div className="font-bold text-yellow-900 mb-1">ポップアップ：{d.heading as string}</div>
              <div className="text-yellow-700 text-sm mb-2">{d.text as string}</div>
              <div className="flex items-center gap-3 text-xs text-yellow-600">
                <span>トリガー: {d.trigger === 'delay' ? `${d.delay}秒後` : d.trigger === 'scroll' ? 'スクロール50%' : '離脱時'}</span>
                <span className="bg-yellow-900 text-yellow-100 px-2 py-0.5 rounded-full font-bold">{d.buttonText as string}</span>
              </div>
            </div>
          </div>
        );

      case 'newsletter':
        return (
          <div className="px-8 py-10 text-center" style={{ background: d.bgColor as string }}>
            {editable('heading', 'h2', 'text-2xl font-black text-gray-800 block mb-2')}
            {editable('subtext', 'p', 'text-gray-500 block mb-6')}
            <div className="flex max-w-md mx-auto gap-2">
              <div className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-400 text-sm">{d.placeholder as string}</div>
              <button
                className="px-5 py-3 rounded-xl text-white font-bold text-sm flex-shrink-0"
                style={{ background: d.buttonColor as string }}
              >
                {d.buttonText as string}
              </button>
            </div>
          </div>
        );

      case 'share':
        return (
          <div className="px-8 py-10 text-center" style={{ background: d.bgColor as string }}>
            {!!(d.heading as string) && <h2 className="text-xl font-bold text-gray-800 mb-6">{d.heading as string}</h2>}
            <div className="flex justify-center gap-3 flex-wrap">
              {d.showLine !== false && <span className="bg-[#06c755] text-white px-5 py-2.5 rounded-full text-sm font-bold">LINE</span>}
              {d.showTwitter !== false && <span className="bg-black text-white px-5 py-2.5 rounded-full text-sm font-bold">X (Twitter)</span>}
              {d.showFacebook !== false && <span className="bg-[#1877f2] text-white px-5 py-2.5 rounded-full text-sm font-bold">Facebook</span>}
            </div>
          </div>
        );

      case 'google-reviews': {
        type Review = { author_name: string; rating: number; text: string; relative_time_description: string };
        const reviews = (d.reviews as Review[]) || [];
        return (
          <div className="px-8 py-10 bg-gray-50">
            {!!(d.heading as string) && <h2 className="text-2xl font-black text-gray-800 text-center mb-2">{d.heading as string}</h2>}
            {!!(d.placeId as string) ? (
              reviews.length > 0 ? (
                <div className="space-y-3 max-w-2xl mx-auto mt-4">
                  {reviews.slice(0, (d.maxReviews as number) || 3).map((r, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-gray-800">{r.author_name}</span>
                        <span className="text-yellow-400 text-sm">{'★'.repeat(r.rating)}</span>
                        <span className="text-gray-400 text-xs ml-auto">{r.relative_time_description}</span>
                      </div>
                      <p className="text-gray-600 text-xs leading-relaxed line-clamp-3">{r.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-xl max-w-sm mx-auto mt-4">
                  右パネルの「口コミを取得」で読み込んでください
                </div>
              )
            ) : (
              <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-gray-300 rounded-xl max-w-sm mx-auto mt-4">
                Google Place ID を右パネルで設定してください
              </div>
            )}
          </div>
        );
      }

      case 'stripe-buy':
        return (
          <div className="px-8 py-10 text-center">
            <div className="max-w-sm mx-auto border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
              <div className="text-2xl mb-2">🛒</div>
              <div className="font-black text-xl text-gray-800 mb-2">{d.label as string}</div>
              {!!(d.description as string) && <div className="text-gray-500 text-sm mb-4">{d.description as string}</div>}
              {d.priceId
                ? <div className="bg-gray-100 text-gray-500 text-[10px] font-mono px-2 py-1 rounded mb-4 truncate">{d.priceId as string}</div>
                : <div className="text-amber-600 text-xs bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mb-4">Stripe Price ID を設定してください</div>
              }
              <button className="w-full py-3 rounded-xl text-white font-bold" style={{ background: d.buttonColor as string }}>
                {d.buttonText as string}
              </button>
            </div>
          </div>
        );

      case 'announcement-bar':
        return (
          <div className="flex items-center justify-between px-4 py-3 text-sm font-medium" style={{ background: d.bgColor as string, color: d.textColor as string }}>
            <div className="flex-1 text-center">{d.text as string}</div>
            {d.closeable !== 'false' && <span className="ml-3 opacity-60 text-base">✕</span>}
          </div>
        );

      case 'instagram': {
        const photos = (d.photos as string[])?.filter(Boolean) ?? [];
        return (
          <div className="px-8 py-10 text-center">
            {!!(d.heading as string) && <h2 className="text-2xl font-black text-gray-800 mb-6">{d.heading as string}</h2>}
            {photos.length > 0 ? (
              <div className="grid gap-2 mb-6" style={{ gridTemplateColumns: `repeat(${d.columns || 3},1fr)` }}>
                {photos.slice(0, 9).map((src, i) => (
                  <div key={i} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 mb-6 max-w-xs mx-auto">
                {[...Array(6)].map((_, i) => <div key={i} className="aspect-square bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg" />)}
              </div>
            )}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-5 py-2.5 rounded-full font-bold text-sm">
              📷 {d.username ? `@${d.username}` : 'Instagram'} をフォロー
            </div>
          </div>
        );
      }

      default:
        return <div className="p-8 text-gray-400 text-center">Unknown block type: {block.type}</div>;
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`relative group cursor-pointer transition-all ${
        selected ? 'ring-2 ring-blue-500 ring-offset-0' :
        multiSelected ? 'ring-2 ring-orange-400 ring-offset-0' :
        'hover:ring-1 hover:ring-blue-300'
      }`}
    >
      {(selected || multiSelected) && (
        <div className={`absolute -top-7 left-0 z-20 flex items-center gap-1 ${selected ? 'bg-blue-500' : 'bg-orange-400'} text-white text-xs rounded-t-lg px-2 py-1 pointer-events-none`}>
          <span>選択中: {block.type}</span>
        </div>
      )}
      {inner()}
    </div>
  );
}

// ─── AI Image Button ───────────────────────────────────────────────────────────
const AI_PROMPT_KEY = 'laruHP_builder_recent_ai_prompts';
function AiImageButton({ onGenerated, defaultPrompt }: { onGenerated: (url: string) => void; defaultPrompt?: string }) {
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompt || '');
  const [open, setOpen] = useState(false);
  const [genError, setGenError] = useState('');
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(AI_PROMPT_KEY) || '[]') as string[];
      setRecentPrompts(saved.slice(0, 5));
    } catch { /* ignore */ }
  }, [open]);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setGenError('');
    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.url) {
        const updated = [prompt.trim(), ...recentPrompts.filter(p => p !== prompt.trim())].slice(0, 5);
        localStorage.setItem(AI_PROMPT_KEY, JSON.stringify(updated));
        onGenerated(data.url);
        setOpen(false);
      } else {
        setGenError(data.error || '画像生成に失敗しました');
      }
    } catch {
      setGenError('画像生成に失敗しました');
    }
    setGenerating(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-1 w-full flex items-center gap-1.5 text-[10px] text-purple-300 hover:text-purple-200 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded px-2 py-1.5 transition-all focus:outline-none focus:ring-1 focus:ring-purple-400/60">
        ✨ AI画像生成
      </button>
    );
  }

  return (
    <div className="mt-1 bg-purple-500/10 border border-purple-500/20 rounded p-2">
      {recentPrompts.length > 0 && (
        <div className="mb-1.5 space-y-0.5">
          <p className="text-[9px] text-purple-400 font-semibold mb-1">最近使ったプロンプト</p>
          {recentPrompts.map((p, i) => (
            <button key={i} onClick={() => setPrompt(p)}
              className="w-full text-left text-[9px] text-purple-300 hover:text-white bg-white/5 hover:bg-purple-500/20 px-2 py-1 rounded truncate transition-all block">
              {p}
            </button>
          ))}
        </div>
      )}
      <textarea
        rows={2}
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="例: 美容サロンの明るくおしゃれな内装"
        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px] resize-none mb-1.5 focus:outline-none focus:border-purple-400/60 focus:ring-1 focus:ring-purple-400/40"
      />
      <div className="flex gap-1">
        <button onClick={generate} disabled={generating || !prompt.trim()}
          className="flex-1 text-[10px] bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded px-2 py-1.5 font-bold transition-all">
          {generating ? '生成中...' : '生成'}
        </button>
        <button onClick={() => { setOpen(false); setGenError(''); }} aria-label="閉じる" className="text-[10px] text-slate-500 hover:text-slate-300 px-2">✕</button>
      </div>
      {genError && <p className="text-red-400 text-[10px] mt-1">{genError}</p>}
    </div>
  );
}

// ─── Right Panel ───────────────────────────────────────────────────────────────
function GoogleReviewsPanel({ d, blockId, onDataChange }: { d: Record<string, unknown>; blockId: string; onDataChange: (id: string, data: Record<string, unknown>) => void }) {
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');

  const fetchReviews = async () => {
    if (!(d.placeId as string)?.trim()) return;
    setFetching(true);
    setError('');
    try {
      const res = await fetch(`/api/google/reviews?placeId=${encodeURIComponent(d.placeId as string)}`);
      const data = await res.json() as { rating?: number; totalRatings?: number; reviews?: unknown[]; error?: string };
      if (data.error) { setError(data.error); return; }
      onDataChange(blockId, { ...d, rating: data.rating || 0, totalRatings: data.totalRatings || 0, reviews: data.reviews || [], lastFetched: new Date().toISOString() });
    } catch { setError('取得に失敗しました'); }
    finally { setFetching(false); }
  };

  return (
    <>
      <label className="block">
        <span className="text-slate-400 block mb-1">見出し</span>
        <input type="text" value={d.heading as string}
          onChange={e => onDataChange(blockId, { ...d, heading: e.target.value })}
          className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
      </label>
      <label className="block">
        <span className="text-slate-400 block mb-1">Google Place ID</span>
        <input type="text" value={d.placeId as string} placeholder="ChIJ..."
          onChange={e => onDataChange(blockId, { ...d, placeId: e.target.value })}
          className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white font-mono text-xs" />
        <span className="text-slate-600 text-[10px] mt-1 block">Google Maps で店舗を検索 → URL の place_id= の値</span>
      </label>
      <label className="block">
        <span className="text-slate-400 block mb-1">表示件数</span>
        <select value={d.maxReviews as number}
          onChange={e => onDataChange(blockId, { ...d, maxReviews: Number(e.target.value) })}
          className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
          {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}件</option>)}
        </select>
      </label>
      <button onClick={fetchReviews} disabled={fetching || !(d.placeId as string)?.trim()}
        className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 text-xs py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed">
        {fetching ? '取得中...' : '⭐ 口コミを取得'}
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {!!(d.lastFetched as string) && (
        <p className="text-slate-600 text-[10px]">最終取得: {new Date(d.lastFetched as string).toLocaleString('ja-JP')}</p>
      )}
      {(d.rating as number) > 0 && (
        <p className="text-slate-400 text-xs">評価 {d.rating as number} ⭐ ({(d.totalRatings as number).toLocaleString()} 件)</p>
      )}
    </>
  );
}

function UrlImportModal({ onImport, onClose }: {
  onImport: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const handleScan = async () => {
    if (!url.trim()) return;
    setScanning(true);
    setError('');
    setResult(null);
    const res = await fetch('/api/ai/scan-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
    });
    const data = await res.json();
    setScanning(false);
    if (data.extracted) {
      setResult(data.extracted);
    } else {
      setError(data.error === 'fetch_failed' ? 'サイトへのアクセスに失敗しました。URLを確認してください。'
        : data.error === 'no_content' ? 'コンテンツを取得できませんでした。'
        : 'スキャンに失敗しました。');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="font-bold text-white">🔗 既存サイトからインポート</h2>
            <p className="text-slate-500 text-[11px] mt-0.5">URLを入力すると、AIが情報を自動抽出してサイトに反映します</p>
          </div>
          <button onClick={onClose} aria-label="URLインポートを閉じる" className="text-slate-500 hover:text-white text-xl focus:outline-none focus:ring-1 focus:ring-white/30 rounded">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <input type="url" value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScan()}
              placeholder="https://example.com"
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 font-mono"
            />
            <button onClick={handleScan} disabled={scanning || !url.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-all whitespace-nowrap">
              {scanning ? 'スキャン中...' : 'スキャン'}
            </button>
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-300 text-sm">{error}</div>}
          {result && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
              <p className="text-emerald-400 text-sm font-semibold mb-3">✓ 情報を取得しました</p>
              {([
                ['店舗・会社名', result.businessName],
                ['電話番号', result.phone],
                ['住所', result.address],
                ['メール', result.email],
                ['キャッチフレーズ', result.catchphrase],
                ['説明文', result.description],
              ] as [string, unknown][]).map(([label, value]) => value ? (
                <div key={label} className="flex gap-2">
                  <span className="text-slate-500 text-[10px] w-24 flex-shrink-0 pt-0.5">{label}</span>
                  <span className="text-slate-200 text-[10px] flex-1 leading-relaxed">{String(value).slice(0, 120)}</span>
                </div>
              ) : null)}
              {Array.isArray(result.services) && result.services.length > 0 && (
                <div className="flex gap-2">
                  <span className="text-slate-500 text-[10px] w-24 flex-shrink-0 pt-0.5">サービス</span>
                  <span className="text-slate-200 text-[10px]">{(result.services as Array<{ name: string }>).map(s => s.name).join(' / ')}</span>
                </div>
              )}
              <button onClick={() => { onImport(result); onClose(); }}
                className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-2.5 rounded-lg transition-all">
                この内容でサイトに適用する
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MobileOverlay() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="md:hidden fixed inset-0 z-[999] bg-[#030712] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-3xl mb-6">💻</div>
      <h1 className="text-2xl font-bold text-white mb-3">PCからご利用ください</h1>
      <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-xs">
        ビルダーはデスクトップ・タブレット（横向き）での操作に最適化されています。スマホからはダッシュボードで確認・管理ができます。
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <a href="/laruHP/dashboard" className="block bg-white text-black font-bold py-3 px-6 rounded-xl text-sm">
          ダッシュボードへ →
        </a>
        <button onClick={() => setDismissed(true)} className="text-slate-500 hover:text-slate-300 text-sm transition-colors py-2">
          このまま続ける（表示が崩れます）
        </button>
      </div>
    </div>
  );
}

function ImageLibraryModal({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [photos, setPhotos] = useState<{ id: string; url: string; thumb: string; alt: string; credit: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const search = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/images/unsplash?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setPhotos(data.photos || []);
    setLoading(false);
  };

  useEffect(() => { search('business interior'); }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch('/api/images/upload', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);
    if (data.url) onSelect(data.url);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className="font-bold text-white">画像ライブラリ</h2>
          <button onClick={onClose} aria-label="画像ライブラリを閉じる" className="text-slate-500 hover:text-white text-xl leading-none focus:outline-none focus:ring-1 focus:ring-white/30 rounded">✕</button>
        </div>
        <div className="px-4 py-3 border-b border-white/10 flex gap-2 flex-shrink-0">
          <input
            type="text" value={query} placeholder="Unsplashで検索（例: cafe interior, office, nature）"
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search(query)}
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40"
          />
          <button onClick={() => search(query)} disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? '...' : '検索'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-slate-300 text-sm font-bold px-3 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {uploading ? '...' : '↑ アップロード'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {photos.length === 0 && !loading && (
            <div className="text-center text-slate-500 text-sm py-8">キーワードを入力して検索してください</div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {photos.map(p => (
              <button key={p.id} onClick={() => { onSelect(p.url); onClose(); }}
                className="group relative rounded-xl overflow-hidden aspect-video bg-white/5 hover:ring-2 hover:ring-blue-500 transition-all">
                <img src={p.thumb} alt={p.alt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-end p-1.5">
                  <span className="text-[9px] text-white/70 group-hover:text-white/90 truncate">{p.credit}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="px-4 py-2.5 border-t border-white/10 flex-shrink-0">
          <p className="text-[10px] text-slate-600">写真提供: Unsplash（無料・商用利用可）</p>
        </div>
      </div>
    </div>
  );
}

type ChatMessage = { role: 'user' | 'assistant'; text: string };
type AiAction = { type: 'update_block'; blockId: string; data: Record<string, unknown> };

function AiChatSidebar({ open, onClose, blocks, selectedBlockId, onApplyActions, siteName, industry }: {
  open: boolean;
  onClose: () => void;
  blocks: Block[];
  selectedBlockId: string | null;
  onApplyActions: (actions: AiAction[]) => void;
  siteName: string;
  industry: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'こんにちは！サイトの編集をお手伝いします。\n例: 「ヒーローの見出しをもっとキャッチーにして」「CTAボタンのテキストを変えて」' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const newMessages: ChatMessage[] = [...messages, { role: 'user', text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, blocks, selectedBlockId, siteName, industry }),
      });
      const data = await res.json();
      if (data.actions?.length > 0) onApplyActions(data.actions);
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply || 'エラーが発生しました' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'エラーが発生しました。再試行してください。' }]);
    }
    setLoading(false);
  };

  if (!open) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      e.preventDefault();
    }
  };

  return (
    <div className="fixed right-[300px] bottom-4 z-40 w-80 bg-[#0f1729] border border-white/15 rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: '70vh' }} onTouchStart={handleTouchStart} data-lenis-prevent-wheel>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <span className="font-bold text-white text-sm">AIアシスタント</span>
        </div>
        <button onClick={onClose} aria-label="AIアシスタントを閉じる" className="text-slate-500 hover:text-white text-lg leading-none focus:outline-none focus:ring-1 focus:ring-white/30 rounded">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2" data-lenis-prevent-wheel>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-200'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-xl px-3 py-2 text-xs text-slate-400">考え中...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 p-3 border-t border-white/10 flex-shrink-0">
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="指示を入力..."
          rows={1}
          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 resize-none max-h-24 overflow-y-auto"
        />
        <button onClick={send} disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-2 rounded-xl transition-all flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-sky-400">
          送信
        </button>
      </div>
    </div>
  );
}

function PaletteSwatches({ palette, onPick }: { palette: string[]; onPick: (c: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div className="flex gap-1.5 flex-wrap">
      {palette.map((c, i) => (
        <button key={i} type="button"
          onClick={() => { onPick(c); setCopied(c); setTimeout(() => setCopied(null), 1200); }}
          title={`${PALETTE_LABELS[i]}: ${c}`}
          style={{ background: c, outline: copied === c ? '2px solid #60a5fa' : undefined }}
          className="w-6 h-6 rounded-full border border-white/30 flex-shrink-0 hover:scale-110 transition-transform" />
      ))}
    </div>
  );
}

function RightPanel({ block, onDataChange, seo, onSeoChange, larubot, onLarubotChange, laruseo, onLaruseoChange, notifyEmail, onNotifyEmailChange, colorScheme, onColorSchemeChange, designStyle, onDesignStyleChange, gaTrackingId, onGaTrackingIdChange, larubotPublicId, onLarubotPublicIdChange, laruseoPublicId, onLaruseoPublicIdChange, siteName, customCss, onCustomCssChange, fontFamily, onFontFamilyChange, userPlan, subscriptionStatus, onOpenImageLib, globalFooter, onGlobalFooterChange, customPalette, onCustomPaletteChange, lineNotifyToken, onLineNotifyTokenChange, clarityId, onClarityIdChange, webhookUrl, onWebhookUrlChange, sitePassword, onSitePasswordChange, siteId, onMemoChange }: {
  block: Block | null;
  onDataChange: (id: string, data: Record<string, unknown>) => void;
  seo: SEOSettings;
  onSeoChange: (seo: SEOSettings) => void;
  larubot: boolean;
  onLarubotChange: (v: boolean) => void;
  laruseo: boolean;
  onLaruseoChange: (v: boolean) => void;
  notifyEmail: string;
  onNotifyEmailChange: (v: string) => void;
  colorScheme: string;
  onColorSchemeChange: (v: string) => void;
  designStyle: string;
  onDesignStyleChange: (v: string) => void;
  gaTrackingId: string;
  onGaTrackingIdChange: (v: string) => void;
  larubotPublicId: string;
  onLarubotPublicIdChange: (v: string) => void;
  laruseoPublicId: string;
  onLaruseoPublicIdChange: (v: string) => void;
  siteName: string;
  customCss: string;
  onCustomCssChange: (v: string) => void;
  fontFamily: string;
  onFontFamilyChange: (v: string) => void;
  userPlan: string | null;
  subscriptionStatus: string;
  onOpenImageLib: (cb: (url: string) => void) => void;
  globalFooter: GlobalFooter;
  onGlobalFooterChange: (f: GlobalFooter) => void;
  customPalette: string[];
  onCustomPaletteChange: (p: string[]) => void;
  lineNotifyToken: string;
  onLineNotifyTokenChange: (v: string) => void;
  clarityId: string;
  onClarityIdChange: (v: string) => void;
  webhookUrl: string;
  onWebhookUrlChange: (v: string) => void;
  sitePassword: string;
  onSitePasswordChange: (v: string) => void;
  siteId: string | null;
  onMemoChange: (id: string, memo: string) => void;
}) {
  const [tab, setTab] = useState<'block' | 'seo' | 'integrations'>('block');
  const [uploadingImg, setUploadingImg] = useState<string | null>(null);
  const [aiCopyLoading, setAiCopyLoading] = useState(false);
  const [aiCopyResult, setAiCopyResult] = useState<Record<string, string> | null>(null);
  const [webhookLogs, setWebhookLogs] = useState<{ id: string; name: string; email: string; type: string; webhook_status: string; webhook_at: string; webhook_code: string }[] | null>(null);
  const [webhookLogsLoading, setWebhookLogsLoading] = useState(false);
  const d = block?.data || {};

  const AI_COPY_BLOCKS = ['hero', 'heading', 'paragraph', 'cta', 'services'];

  const handleAiCopy = async () => {
    if (!block) return;
    setAiCopyLoading(true);
    setAiCopyResult(null);
    try {
      const currentText = [d.heading, d.text, d.subheading, d.subtext].filter(Boolean).join(' / ');
      const res = await fetch('/api/ai/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockType: block.type, businessName: siteName, industry: '', currentText }),
      });
      const json = await res.json();
      if (json.result) setAiCopyResult(json.result);
    } finally {
      setAiCopyLoading(false);
    }
  };

  const applyAiCopy = () => {
    if (!block || !aiCopyResult) return;
    const updates: Record<string, unknown> = {};
    if (aiCopyResult.heading !== undefined) updates.heading = aiCopyResult.heading;
    if (aiCopyResult.subheading !== undefined) updates.subheading = aiCopyResult.subheading;
    if (aiCopyResult.text !== undefined) updates.text = aiCopyResult.text;
    if (aiCopyResult.subtext !== undefined) updates.subtext = aiCopyResult.subtext;
    if (aiCopyResult.ctaText !== undefined) updates.ctaText = aiCopyResult.ctaText;
    if (aiCopyResult.buttonText !== undefined) updates.buttonText = aiCopyResult.buttonText;
    if (aiCopyResult.items !== undefined) {
      const items = aiCopyResult.items as unknown as Array<{ icon: string; title: string; description: string }>;
      if (Array.isArray(items)) updates.items = items.map(item => ({ icon: item.icon, title: item.title, description: item.description }));
    }
    onDataChange(block.id, { ...d, ...updates });
    setAiCopyResult(null);
  };

  const uploadImage = async (file: File, key: string, idx?: number) => {
    const slotKey = key + (idx !== undefined ? `-${idx}` : '');
    setUploadingImg(slotKey);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/images/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.url && block) {
        if (idx !== undefined) {
          const images = [...((d.images as string[]) || [])];
          while (images.length <= idx) images.push('');
          images[idx] = json.url;
          onDataChange(block.id, { ...d, images });
        } else {
          onDataChange(block.id, { ...d, [key]: json.url });
        }
      }
    } finally {
      setUploadingImg(null);
    }
  };

  const seoChecks = [
    { id: 'title-exists',  label: 'ページタイトルを設定',       tip: '未設定は検索結果でURLがそのまま表示される',    pass: seo.title.length > 0 },
    { id: 'title-len',     label: 'タイトルが15〜60文字',         tip: `現在${seo.title.length}文字。短すぎると評価されにくい`,  pass: seo.title.length >= 15 && seo.title.length <= 60 },
    { id: 'desc-exists',   label: 'メタ説明文を設定',            tip: '未設定はGoogleが自動抽出するため不正確になりやすい', pass: seo.description.length > 0 },
    { id: 'desc-len',      label: '説明文が50〜160文字',          tip: `現在${seo.description.length}文字。長すぎると切れる`,  pass: seo.description.length >= 50 && seo.description.length <= 160 },
    { id: 'keywords',      label: 'キーワードを設定',             tip: '検索キーワードを3〜5個カンマ区切りで入力',       pass: seo.keywords.length > 0 },
    { id: 'og-title',      label: 'OGタイトルを設定',            tip: 'SNSシェア時のカード表示に使われる',             pass: seo.ogTitle.length > 0 },
    { id: 'og-image',      label: 'OG画像URLを設定',             tip: '1200×630px推奨。未設定はSNSシェア時に画像なし',  pass: (seo.ogImage ?? '').length > 0 },
    { id: 'laruseo',       label: 'LARUSEO連携を有効化',          tip: 'AI自動SEO最適化でクロール評価を継続改善',       pass: laruseo },
  ] as const;
  const seoScore = seoChecks.filter(c => c.pass).length;

  return (
    <div className="w-64 bg-[#0f172a] border-l border-white/10 flex flex-col flex-shrink-0 min-h-0">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {(['block', 'seo', 'integrations'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-bold transition-colors focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500/50 ${tab === t ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>
            {t === 'block' ? 'ブロック' : t === 'seo' ? 'SEO' : '連携'}
          </button>
        ))}
      </div>

      <div data-lenis-prevent-wheel className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {tab === 'block' && (
          <>
            {!block && (
              <div className="text-slate-500 text-center py-8 space-y-2">
                <div>ブロックを選択してください</div>
                <div className="text-[10px] text-slate-600">Shift+クリックで複数選択</div>
              </div>
            )}
            {block && customPalette.some(c => c !== '#ffffff') && (
              <div className="border border-white/10 rounded-lg p-2 mb-3 bg-white/[0.03]">
                <span className="text-[10px] text-slate-500 block mb-1.5">マイカラー（クリックでコピー）</span>
                <PaletteSwatches palette={customPalette} onPick={c => navigator.clipboard?.writeText(c)} />
              </div>
            )}
            {block?.type === 'nav' && (() => {
              const links = (d.links as { label: string; href: string }[]) || [];
              return (
                <>
                  <label className="block">
                    <span className="text-slate-400 block mb-1">ロゴ・サイト名</span>
                    <input type="text" value={d.logo as string || ''} onChange={e => onDataChange(block.id, { ...d, logo: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </label>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-400">メニューリンク</span>
                      <button onClick={() => onDataChange(block.id, { ...d, links: [...links, { label: '新しいリンク', href: '#' }] })}
                        className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors">+ 追加</button>
                    </div>
                    <div className="space-y-2">
                      {links.map((l, i) => (
                        <div key={i} className="flex gap-1.5 items-center">
                          <input type="text" value={l.label} placeholder="ラベル"
                            onChange={e => { const nl = [...links]; nl[i] = { ...l, label: e.target.value }; onDataChange(block.id, { ...d, links: nl }); }}
                            className="w-24 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[11px]" />
                          <input type="text" value={l.href} placeholder="#section"
                            onChange={e => { const nl = [...links]; nl[i] = { ...l, href: e.target.value }; onDataChange(block.id, { ...d, links: nl }); }}
                            className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[11px]" />
                          <button onClick={() => onDataChange(block.id, { ...d, links: links.filter((_, j) => j !== i) })}
                            aria-label="リンクを削除"
                            className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">CTAボタンを表示</span>
                    <input type="checkbox" checked={!!d.showCta}
                      onChange={e => onDataChange(block.id, { ...d, showCta: e.target.checked })}
                      className="w-4 h-4 accent-blue-500" />
                  </div>
                  {d.showCta && (
                    <>
                      <label className="block">
                        <span className="text-slate-400 block mb-1">CTAテキスト</span>
                        <input type="text" value={d.ctaText as string || ''} onChange={e => onDataChange(block.id, { ...d, ctaText: e.target.value })}
                          className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                      </label>
                      <label className="block">
                        <span className="text-slate-400 block mb-1">CTAリンク先</span>
                        <input type="text" value={d.ctaLink as string || ''} onChange={e => onDataChange(block.id, { ...d, ctaLink: e.target.value })}
                          className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                      </label>
                    </>
                  )}
                  <label className="block">
                    <span className="text-slate-400 block mb-1">背景色</span>
                    <input type="color" value={d.bgColor as string || '#ffffff'} onChange={e => onDataChange(block.id, { ...d, bgColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                  </label>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">スクロール時に固定</span>
                    <input type="checkbox" checked={!!d.sticky}
                      onChange={e => onDataChange(block.id, { ...d, sticky: e.target.checked })}
                      className="w-4 h-4 accent-blue-500" />
                  </div>
                </>
              );
            })()}
            {block?.type === 'hero' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">背景色</span>
                  <div className="flex gap-2">
                    <input type="color" value={d.bgColor as string || '#1e3a8a'}
                      onChange={e => onDataChange(block.id, { ...d, bgColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <input type="text" value={d.bgColor as string || ''} placeholder="#1e3a8a"
                      onChange={e => onDataChange(block.id, { ...d, bgColor: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </div>
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">文字色</span>
                  <div className="flex gap-2">
                    <input type="color" value={d.textColor as string || '#ffffff'}
                      onChange={e => onDataChange(block.id, { ...d, textColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <input type="text" value={d.textColor as string || ''}
                      onChange={e => onDataChange(block.id, { ...d, textColor: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </div>
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">背景画像</span>
                  <div className="flex gap-1 mb-1">
                    <input type="text" value={d.bgImage as string || ''} placeholder="https://..."
                      onChange={e => onDataChange(block.id, { ...d, bgImage: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
                    <label className="cursor-pointer flex-shrink-0">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={async e => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; await uploadImage(f, 'bgImage'); }}} />
                      <span className={`flex items-center px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded text-blue-300 text-[10px] transition-all ${uploadingImg === 'bgImage' ? 'opacity-50' : ''}`}>
                        {uploadingImg === 'bgImage' ? '...' : '↑'}
                      </span>
                    </label>
                    <button type="button" onClick={() => onOpenImageLib(url => onDataChange(block.id, { ...d, bgImage: url }))}
                      className="flex items-center px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-purple-300 text-[10px] transition-all flex-shrink-0">🖼</button>
                  </div>
                  {!!(d.bgImage as string) && <img src={d.bgImage as string} alt="" className="w-full h-12 object-cover rounded opacity-60" />}
                  <AiImageButton
                    onGenerated={(url: string) => onDataChange(block.id, { ...d, bgImage: url })}
                    defaultPrompt={`${siteName || ''} business hero background`}
                  />
                </label>
                <div className="border-t border-white/10 pt-3">
                  <span className="text-slate-400 block mb-2 text-[11px] font-semibold uppercase tracking-wide">A/B テスト</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={d.abVariant === 'b'}
                      onChange={e => onDataChange(block.id, { ...d, abVariant: e.target.checked ? 'b' : undefined })}
                      className="w-4 h-4 rounded accent-orange-500"
                    />
                    <span className="text-slate-300 text-xs">このブロックをBバリアントに設定</span>
                  </label>
                  <p className="text-slate-600 text-[10px] mt-1.5">同じページにヒーローが2つある場合、公開時に50/50でランダム表示されます</p>
                </div>
              </>
            )}
            {block?.type === 'heading' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">画像（任意）</span>
                  <div className="flex gap-1 mb-1">
                    <input type="text" value={d.image as string || ''} placeholder="https://..."
                      onChange={e => onDataChange(block.id, { ...d, image: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
                    <label className="cursor-pointer flex-shrink-0">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={async e => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; await uploadImage(f, 'image'); }}} />
                      <span className={`flex items-center px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded text-blue-300 text-[10px] transition-all ${uploadingImg === 'image' ? 'opacity-50' : ''}`}>
                        {uploadingImg === 'image' ? '...' : '↑'}
                      </span>
                    </label>
                    <button type="button" onClick={() => onOpenImageLib(url => onDataChange(block.id, { ...d, image: url }))}
                      className="flex items-center px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-purple-300 text-[10px] transition-all flex-shrink-0">🖼</button>
                  </div>
                  {(d.image as string) && <img src={d.image as string} alt="" className="w-full h-12 object-cover rounded mb-1" />}
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">テキスト揃え</span>
                  <select value={d.align as string || 'left'} onChange={e => onDataChange(block.id, { ...d, align: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="left">左揃え</option>
                    <option value="center">中央</option>
                    <option value="right">右揃え</option>
                  </select>
                </label>
              </>
            )}
            {block?.type === 'paragraph' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">画像（任意）</span>
                  <div className="flex gap-1 mb-1">
                    <input type="text" value={d.image as string || ''} placeholder="https://..."
                      onChange={e => onDataChange(block.id, { ...d, image: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
                    <label className="cursor-pointer flex-shrink-0">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={async e => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; await uploadImage(f, 'image'); }}} />
                      <span className={`flex items-center px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded text-blue-300 text-[10px] transition-all ${uploadingImg === 'image' ? 'opacity-50' : ''}`}>
                        {uploadingImg === 'image' ? '...' : '↑'}
                      </span>
                    </label>
                    <button type="button" onClick={() => onOpenImageLib(url => onDataChange(block.id, { ...d, image: url }))}
                      className="flex items-center px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-purple-300 text-[10px] transition-all flex-shrink-0">🖼</button>
                  </div>
                  {(d.image as string) && <img src={d.image as string} alt="" className="w-full h-12 object-cover rounded mb-1" />}
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">画像位置</span>
                  <select value={d.imagePosition as string || 'none'} onChange={e => onDataChange(block.id, { ...d, imagePosition: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="none">画像なし</option>
                    <option value="left">テキスト右・画像左</option>
                    <option value="right">テキスト左・画像右</option>
                  </select>
                </label>
              </>
            )}
            {block?.type === 'two-col' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">左カラム画像</span>
                  <div className="flex gap-1 mb-1">
                    <input type="text" value={d.col1Image as string || ''} placeholder="https://..."
                      onChange={e => onDataChange(block.id, { ...d, col1Image: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
                    <label className="cursor-pointer flex-shrink-0">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={async e => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; await uploadImage(f, 'col1Image'); }}} />
                      <span className={`flex items-center px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded text-blue-300 text-[10px] transition-all ${uploadingImg === 'col1Image' ? 'opacity-50' : ''}`}>
                        {uploadingImg === 'col1Image' ? '...' : '↑'}
                      </span>
                    </label>
                    <button type="button" onClick={() => onOpenImageLib(url => onDataChange(block.id, { ...d, col1Image: url }))}
                      className="flex items-center px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-purple-300 text-[10px] transition-all flex-shrink-0">🖼</button>
                  </div>
                  {(d.col1Image as string) && <img src={d.col1Image as string} alt="" className="w-full h-10 object-cover rounded mb-1" />}
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">右カラム画像</span>
                  <div className="flex gap-1 mb-1">
                    <input type="text" value={d.col2Image as string || ''} placeholder="https://..."
                      onChange={e => onDataChange(block.id, { ...d, col2Image: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
                    <label className="cursor-pointer flex-shrink-0">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={async e => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; await uploadImage(f, 'col2Image'); }}} />
                      <span className={`flex items-center px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded text-blue-300 text-[10px] transition-all ${uploadingImg === 'col2Image' ? 'opacity-50' : ''}`}>
                        {uploadingImg === 'col2Image' ? '...' : '↑'}
                      </span>
                    </label>
                    <button type="button" onClick={() => onOpenImageLib(url => onDataChange(block.id, { ...d, col2Image: url }))}
                      className="flex items-center px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-purple-300 text-[10px] transition-all flex-shrink-0">🖼</button>
                  </div>
                  {(d.col2Image as string) && <img src={d.col2Image as string} alt="" className="w-full h-10 object-cover rounded mb-1" />}
                </label>
              </>
            )}
            {block?.type === 'three-col' && (
              <>
                {([['col1Image','カラム1'], ['col2Image','カラム2'], ['col3Image','カラム3']] as const).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="text-slate-400 block mb-1">{label}画像</span>
                    <div className="flex gap-1 mb-1">
                      <input type="text" value={d[key] as string || ''} placeholder="https://..."
                        onChange={e => onDataChange(block.id, { ...d, [key]: e.target.value })}
                        className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
                      <label className="cursor-pointer flex-shrink-0">
                        <input type="file" accept="image/*" className="hidden"
                          onChange={async e => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; await uploadImage(f, key); }}} />
                        <span className={`flex items-center px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded text-blue-300 text-[10px] transition-all ${uploadingImg === key ? 'opacity-50' : ''}`}>
                          {uploadingImg === key ? '...' : '↑'}
                        </span>
                      </label>
                      <button type="button" onClick={() => onOpenImageLib(url => onDataChange(block.id, { ...d, [key]: url }))}
                        className="flex items-center px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-purple-300 text-[10px] transition-all flex-shrink-0">🖼</button>
                    </div>
                    {(d[key] as string) && <img src={d[key] as string} alt="" className="w-full h-10 object-cover rounded mb-1" />}
                  </label>
                ))}
              </>
            )}
            {block?.type === 'cta' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">背景色</span>
                  <input type="color" value={d.bgColor as string || '#1e3a8a'}
                    onChange={e => onDataChange(block.id, { ...d, bgColor: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer bg-transparent border border-white/20" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">文字色</span>
                  <input type="color" value={d.textColor as string || '#ffffff'}
                    onChange={e => onDataChange(block.id, { ...d, textColor: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer bg-transparent border border-white/20" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">リンク先</span>
                  <input type="text" value={d.buttonLink as string || ''} placeholder="#contact"
                    onChange={e => onDataChange(block.id, { ...d, buttonLink: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
              </>
            )}
            {block?.type === 'divider' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">線のスタイル</span>
                  <select value={d.style as string} onChange={e => onDataChange(block.id, { ...d, style: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="solid">実線</option>
                    <option value="dashed">破線</option>
                    <option value="dotted">点線</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">色</span>
                  <input type="color" value={d.color as string || '#e5e7eb'}
                    onChange={e => onDataChange(block.id, { ...d, color: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer bg-transparent border border-white/20" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">太さ (px)</span>
                  <input type="range" min="1" max="8" value={d.thickness as number || 1}
                    onChange={e => onDataChange(block.id, { ...d, thickness: e.target.value })}
                    className="w-full accent-blue-500" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">ラベル（任意）</span>
                  <input type="text" value={d.label as string || ''} placeholder="ラベルテキスト"
                    onChange={e => onDataChange(block.id, { ...d, label: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
              </>
            )}
            {block?.type === 'services' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">カラム数</span>
                  <select value={d.columns as string} onChange={e => onDataChange(block.id, { ...d, columns: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="2">2カラム</option>
                    <option value="3">3カラム</option>
                  </select>
                </label>
                <div className="border-t border-white/10 pt-3">
                  <div className="text-slate-400 text-[11px] mb-2">各サービスの画像</div>
                  <div className="space-y-3">
                    {((d.items as Array<{icon:string;title:string;description:string;price:string;image?:string}>) || []).map((item, i) => {
                      const slotKey = `svc-img-${i}`;
                      return (
                        <div key={i}>
                          <div className="text-slate-500 text-[10px] mb-1 truncate">{item.title || `サービス ${i + 1}`}</div>
                          <div className="flex gap-1">
                            <input type="text" value={item.image || ''} placeholder="URL"
                              onChange={e => {
                                const items = [...((d.items as Array<Record<string,unknown>>) || [])];
                                items[i] = { ...items[i], image: e.target.value };
                                onDataChange(block.id, { ...d, items });
                              }}
                              className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[9px]" />
                            <label className="cursor-pointer flex-shrink-0">
                              <input type="file" accept="image/*" className="hidden"
                                onChange={async e => {
                                  const f = e.target.files?.[0]; if (!f) return;
                                  setUploadingImg(slotKey);
                                  try {
                                    const fd = new FormData(); fd.append('file', f);
                                    const res = await fetch('/api/images/upload', { method: 'POST', body: fd });
                                    const json = await res.json();
                                    if (json.url) {
                                      const items = [...((d.items as Array<Record<string,unknown>>) || [])];
                                      items[i] = { ...items[i], image: json.url };
                                      onDataChange(block.id, { ...d, items });
                                    }
                                  } finally { setUploadingImg(null); }
                                }} />
                              <span className={`flex items-center px-1.5 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded text-blue-300 text-[10px] transition-all ${uploadingImg === slotKey ? 'opacity-50' : ''}`}>
                                {uploadingImg === slotKey ? '...' : '↑'}
                              </span>
                            </label>
                            {item.image && (
                              <button onClick={() => {
                                const items = [...((d.items as Array<Record<string,unknown>>) || [])];
                                items[i] = { ...items[i], image: '' };
                                onDataChange(block.id, { ...d, items });
                              }} className="text-red-400/60 hover:text-red-400 text-[10px] px-1">✕</button>
                            )}
                          </div>
                          {item.image && <img src={item.image} alt="" className="w-full h-8 object-cover rounded mt-1" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
            {block?.type === 'image' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">画像</span>
                  <div className="flex gap-1 mb-1">
                    <input type="text" value={d.src as string || ''} placeholder="https://..."
                      onChange={e => onDataChange(block.id, { ...d, src: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
                    <label className="cursor-pointer flex-shrink-0">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={async e => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; await uploadImage(f, 'src'); }}} />
                      <span className={`flex items-center px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded text-blue-300 text-[10px] transition-all ${uploadingImg === 'src' ? 'opacity-50' : ''}`}>
                        {uploadingImg === 'src' ? '...' : 'アップロード'}
                      </span>
                    </label>
                    <button type="button" onClick={() => onOpenImageLib(url => onDataChange(block.id, { ...d, src: url }))}
                      className="flex items-center px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-purple-300 text-[10px] transition-all flex-shrink-0">🖼 ライブラリ</button>
                  </div>
                  {!!(d.src as string) && <img src={d.src as string} alt="" className="w-full h-16 object-cover rounded mb-1" />}
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">高さ (px)</span>
                  <input type="number" value={d.height as number || 300} min="100" max="800"
                    onChange={e => onDataChange(block.id, { ...d, height: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">表示方法</span>
                  <select value={d.objectFit as string} onChange={e => onDataChange(block.id, { ...d, objectFit: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="cover">カバー（切り取り）</option>
                    <option value="contain">収める</option>
                    <option value="fill">伸ばす</option>
                  </select>
                </label>
              </>
            )}
            {block?.type === 'larubot' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">ウィジェット位置</span>
                  <select value={d.position as string} onChange={e => onDataChange(block.id, { ...d, position: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="bottom-right">右下</option>
                    <option value="bottom-left">左下</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">アクセントカラー</span>
                  <input type="color" value={d.primaryColor as string || '#4f46e5'}
                    onChange={e => onDataChange(block.id, { ...d, primaryColor: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer bg-transparent border border-white/20" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">最初のメッセージ</span>
                  <textarea value={d.welcomeMessage as string || ''} rows={3}
                    onChange={e => onDataChange(block.id, { ...d, welcomeMessage: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white resize-none" />
                </label>
              </>
            )}
            {block?.type === 'video' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">動画URL（YouTube / Vimeo）</span>
                  <input type="text" value={d.url as string || ''} placeholder="https://youtu.be/..."
                    onChange={e => onDataChange(block.id, { ...d, url: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">アスペクト比</span>
                  <select value={d.aspectRatio as string || '16/9'} onChange={e => onDataChange(block.id, { ...d, aspectRatio: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="16/9">16:9（横長）</option>
                    <option value="4/3">4:3</option>
                    <option value="1/1">1:1（正方形）</option>
                  </select>
                </label>
              </>
            )}
            {block?.type === 'map' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">Google Maps Embed URL</span>
                  <textarea rows={3} value={d.embedUrl as string || ''} placeholder="https://www.google.com/maps/embed?..."
                    onChange={e => onDataChange(block.id, { ...d, embedUrl: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white resize-none" />
                  <span className="text-blue-400 text-[10px] block mt-1">Googleマップ→共有→地図を埋め込む</span>
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">高さ (px)</span>
                  <input type="number" value={d.height as number || 400} min="200" max="700"
                    onChange={e => onDataChange(block.id, { ...d, height: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
              </>
            )}
            {block?.type === 'countdown' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">カウント先の日時</span>
                  <input type="datetime-local" value={d.targetDate as string || ''}
                    onChange={e => onDataChange(block.id, { ...d, targetDate: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">背景色</span>
                  <input type="color" value={d.bgColor as string || '#1e3a8a'}
                    onChange={e => onDataChange(block.id, { ...d, bgColor: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer bg-transparent border border-white/20" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">文字色</span>
                  <input type="color" value={d.textColor as string || '#ffffff'}
                    onChange={e => onDataChange(block.id, { ...d, textColor: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer bg-transparent border border-white/20" />
                </label>
              </>
            )}
            {block?.type === 'contact' && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!d.multiStep}
                    onChange={e => onDataChange(block.id, { ...d, multiStep: e.target.checked })}
                    className="w-4 h-4 rounded" />
                  <span className="text-slate-300 text-sm">マルチステップフォーム（3ステップ）</span>
                </label>
                <div>
                  <span className="text-slate-400 block mb-2 text-xs">追加フィールド</span>
                  <div className="space-y-1.5">
                    {([['company', '会社名'], ['date', 'ご希望日時'], ['budget', 'ご予算'], ['prefer_contact', '連絡方法（メール/電話）']] as [string, string][]).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox"
                          checked={((d.extraFields as string[]) || []).includes(key)}
                          onChange={e => {
                            const cur = (d.extraFields as string[]) || [];
                            onDataChange(block.id, { ...d, extraFields: e.target.checked ? [...cur, key] : cur.filter(f => f !== key) });
                          }}
                          className="w-4 h-4 rounded" />
                        <span className="text-slate-300 text-xs">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="text-slate-400 block mb-1">ボタン色</span>
                  <div className="flex gap-2">
                    <input type="color" value={d.buttonColor as string || '#1e3a8a'}
                      onChange={e => onDataChange(block.id, { ...d, buttonColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <input type="text" value={d.buttonColor as string || ''}
                      onChange={e => onDataChange(block.id, { ...d, buttonColor: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </div>
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">背景色</span>
                  <div className="flex gap-2">
                    <input type="color" value={d.bgColor as string || '#f8fafc'}
                      onChange={e => onDataChange(block.id, { ...d, bgColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <input type="text" value={d.bgColor as string || ''}
                      onChange={e => onDataChange(block.id, { ...d, bgColor: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </div>
                </label>
                <div className="border-t border-white/10 pt-3">
                  <span className="text-slate-400 block mb-1 text-[11px] font-semibold uppercase tracking-wide">条件分岐</span>
                  <div className="text-slate-500 text-[10px] mb-2">「お問い合わせ種別」選択肢を設定すると、種別によって追加フィールドが表示されます</div>
                  {(() => {
                    const opts: string[] = (d.typeOptions as string[]) || [];
                    const cond: Record<string, string[]> = (d.conditionalFields as Record<string, string[]>) || {};
                    return (
                      <>
                        <div className="space-y-1 mb-2">
                          {opts.map((opt, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <input type="text" value={opt}
                                onChange={e => { const n = [...opts]; n[i] = e.target.value; onDataChange(block.id, { ...d, typeOptions: n }); }}
                                className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]"
                                placeholder={`選択肢 ${i + 1}`} />
                              <button onClick={() => {
                                const n = opts.filter((_, j) => j !== i);
                                const nc = { ...cond }; delete nc[opt];
                                onDataChange(block.id, { ...d, typeOptions: n, conditionalFields: nc });
                              }} className="text-red-400/60 hover:text-red-400 text-xs px-1">✕</button>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => onDataChange(block.id, { ...d, typeOptions: [...opts, ''] })}
                          className="w-full text-xs bg-white/10 hover:bg-white/20 text-white py-1.5 rounded-lg mb-2">+ 選択肢を追加</button>
                        {opts.filter(Boolean).map(opt => (
                          <div key={opt} className="mb-2">
                            <div className="text-slate-500 text-[10px] mb-1">「{opt}」選択時の追加フィールド</div>
                            {(['date', 'budget', 'company'] as string[]).map(f => {
                              const labels: Record<string, string> = { date: '希望日時', budget: '予算', company: '会社名' };
                              const cur = cond[opt] || [];
                              return (
                                <label key={f} className="flex items-center gap-1.5 cursor-pointer mb-0.5">
                                  <input type="checkbox" checked={cur.includes(f)}
                                    onChange={e => {
                                      const nc = { ...cond, [opt]: e.target.checked ? [...cur, f] : cur.filter(x => x !== f) };
                                      onDataChange(block.id, { ...d, conditionalFields: nc });
                                    }}
                                    className="w-3 h-3 rounded accent-blue-500" />
                                  <span className="text-slate-400 text-[10px]">{labels[f]}</span>
                                </label>
                              );
                            })}
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
                <div className="border-t border-white/10 pt-3">
                  <span className="text-slate-400 block mb-1 text-[11px] font-semibold uppercase tracking-wide">送信後の動作</span>
                  <label className="block mb-2">
                    <span className="text-slate-400 block mb-1">サンクスメッセージ</span>
                    <input type="text" value={(d.thankYouMessage as string) || ''}
                      placeholder="お問い合わせありがとうございます！"
                      onChange={e => onDataChange(block.id, { ...d, thankYouMessage: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
                  </label>
                  <label className="block">
                    <span className="text-slate-400 block mb-1">リダイレクト先URL（任意）</span>
                    <input type="text" value={(d.redirectUrl as string) || ''}
                      placeholder="https://example.com/thanks"
                      onChange={e => onDataChange(block.id, { ...d, redirectUrl: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px] font-mono" />
                    <div className="text-slate-600 text-[10px] mt-1">設定するとサンクスページへリダイレクト</div>
                  </label>
                </div>
              </>
            )}
            {block?.type === 'booking' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">ボタン色</span>
                  <input type="color" value={d.buttonColor as string || '#1e3a8a'}
                    onChange={e => onDataChange(block.id, { ...d, buttonColor: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer bg-transparent border border-white/20" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">時間帯（カンマ区切り）</span>
                  <input type="text" value={((d.timeSlots as string[]) || []).join(', ')} placeholder="10:00, 11:00, 13:00"
                    onChange={e => onDataChange(block.id, { ...d, timeSlots: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">サービス種別（カンマ区切り）</span>
                  <input type="text" value={((d.serviceTypes as string[]) || []).join(', ')} placeholder="初回相談, フォロー"
                    onChange={e => onDataChange(block.id, { ...d, serviceTypes: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">背景色</span>
                  <input type="color" value={d.bgColor as string || '#f8fafc'}
                    onChange={e => onDataChange(block.id, { ...d, bgColor: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer bg-transparent border border-white/20" />
                </label>
              </>
            )}
            {block?.type === 'gallery' && (
              <>
                <div className="text-slate-400 text-[11px] mb-2">画像スロット（最大8枚）</div>
                <div className="space-y-1.5">
                  {Array.from({ length: Math.max(((d.images as string[]) || []).length + 1, 4) }).slice(0, 8).map((_, idx) => {
                    const images = (d.images as string[]) || [];
                    const src = images[idx] || '';
                    const slotKey = `gallery-${idx}`;
                    return (
                      <div key={idx} className="flex gap-1.5 items-center">
                        <div className="w-10 h-10 rounded overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                          {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">{idx + 1}</div>}
                        </div>
                        <input type="text" value={src} placeholder="URL or upload →"
                          onChange={e => { const imgs = [...images]; imgs[idx] = e.target.value; onDataChange(block.id, { ...d, images: imgs }); }}
                          className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[9px]" />
                        <label className="cursor-pointer flex-shrink-0">
                          <input type="file" accept="image/*" className="hidden"
                            onChange={async e => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; await uploadImage(f, 'images', idx); }}} />
                          <span className={`flex items-center px-1.5 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded text-blue-300 text-[10px] transition-all ${uploadingImg === slotKey ? 'opacity-50' : ''}`}>
                            {uploadingImg === slotKey ? '...' : '↑'}
                          </span>
                        </label>
                        <button type="button" onClick={() => onOpenImageLib(url => { const imgs = [...images]; imgs[idx] = url; onDataChange(block.id, { ...d, images: imgs }); })}
                          className="flex items-center px-1.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-purple-300 text-[10px] transition-all flex-shrink-0">🖼</button>
                        {src && (
                          <button onClick={() => { const imgs = [...images]; imgs[idx] = ''; onDataChange(block.id, { ...d, images: imgs.filter((_, i) => i < imgs.length) }); }}
                            className="text-red-400/50 hover:text-red-400 text-xs px-1">✕</button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <label className="block mt-3">
                  <span className="text-slate-400 block mb-1">カラム数</span>
                  <select value={d.columns as string || '2'} onChange={e => onDataChange(block.id, { ...d, columns: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="2">2カラム</option>
                    <option value="3">3カラム</option>
                  </select>
                </label>
              </>
            )}
            {block?.type === 'popup' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">表示トリガー</span>
                  <select value={(d.trigger as string) || 'delay'} onChange={e => onDataChange(block.id, { ...d, trigger: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="delay">⏱ 時間経過後</option>
                    <option value="scroll">📜 スクロール量</option>
                    <option value="exit">🚪 離脱インテント</option>
                    <option value="click">👆 ボタンクリック</option>
                  </select>
                </label>
                {(d.trigger as string) === 'delay' && (
                  <label className="block">
                    <span className="text-slate-400 block mb-1">表示までの秒数</span>
                    <input type="number" min="1" max="60" value={(d.delay as string) || '3'}
                      onChange={e => onDataChange(block.id, { ...d, delay: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </label>
                )}
                {(d.trigger as string) === 'scroll' && (
                  <label className="block">
                    <span className="text-slate-400 block mb-1">スクロール量 ({(d.scrollPercent as string) || '50'}%)</span>
                    <input type="range" min="10" max="90" step="10" value={(d.scrollPercent as string) || '50'}
                      onChange={e => onDataChange(block.id, { ...d, scrollPercent: e.target.value })}
                      className="w-full accent-blue-500" />
                    <div className="flex justify-between text-slate-600 text-[10px] mt-0.5"><span>10%</span><span>90%</span></div>
                  </label>
                )}
                {(d.trigger as string) === 'exit' && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-300 text-[10px]">マウスがウィンドウ上端を越えたときに表示されます</div>
                )}
                <label className="block">
                  <span className="text-slate-400 block mb-1">見出し</span>
                  <input type="text" value={d.heading as string}
                    onChange={e => onDataChange(block.id, { ...d, heading: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">本文</span>
                  <textarea rows={3} value={d.text as string}
                    onChange={e => onDataChange(block.id, { ...d, text: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white resize-none" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">ボタンテキスト</span>
                  <input type="text" value={d.buttonText as string}
                    onChange={e => onDataChange(block.id, { ...d, buttonText: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">ボタンリンク先</span>
                  <input type="text" value={d.buttonLink as string}
                    onChange={e => onDataChange(block.id, { ...d, buttonLink: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">背景色</span>
                  <div className="flex gap-2">
                    <input type="color" value={d.bgColor as string || '#1e3a8a'}
                      onChange={e => onDataChange(block.id, { ...d, bgColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <input type="text" value={d.bgColor as string}
                      onChange={e => onDataChange(block.id, { ...d, bgColor: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </div>
                </label>
              </>
            )}
            {block?.type === 'newsletter' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">見出し</span>
                  <input type="text" value={d.heading as string}
                    onChange={e => onDataChange(block.id, { ...d, heading: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">サブテキスト</span>
                  <input type="text" value={d.subtext as string}
                    onChange={e => onDataChange(block.id, { ...d, subtext: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">ボタンテキスト</span>
                  <input type="text" value={d.buttonText as string}
                    onChange={e => onDataChange(block.id, { ...d, buttonText: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">ボタン色</span>
                  <div className="flex gap-2">
                    <input type="color" value={d.buttonColor as string || '#1e3a8a'}
                      onChange={e => onDataChange(block.id, { ...d, buttonColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <input type="text" value={d.buttonColor as string}
                      onChange={e => onDataChange(block.id, { ...d, buttonColor: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </div>
                </label>
              </>
            )}
            {block?.type === 'share' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">見出し</span>
                  <input type="text" value={d.heading as string}
                    onChange={e => onDataChange(block.id, { ...d, heading: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <div className="space-y-2">
                  <span className="text-slate-400 block mb-1">表示するSNS</span>
                  {(['showLine', 'showTwitter', 'showFacebook'] as const).map((key) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={d[key] !== false}
                        onChange={e => onDataChange(block.id, { ...d, [key]: e.target.checked })}
                        className="w-4 h-4 rounded" />
                      <span className="text-slate-300 text-xs">{key === 'showLine' ? 'LINE' : key === 'showTwitter' ? 'X (Twitter)' : 'Facebook'}</span>
                    </label>
                  ))}
                </div>
                <label className="block">
                  <span className="text-slate-400 block mb-1">背景色</span>
                  <div className="flex gap-2">
                    <input type="color" value={d.bgColor as string || '#ffffff'}
                      onChange={e => onDataChange(block.id, { ...d, bgColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <input type="text" value={d.bgColor as string}
                      onChange={e => onDataChange(block.id, { ...d, bgColor: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </div>
                </label>
              </>
            )}
            {block?.type === 'stripe-buy' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">商品名</span>
                  <input type="text" value={d.label as string}
                    onChange={e => onDataChange(block.id, { ...d, label: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">説明文</span>
                  <input type="text" value={d.description as string}
                    onChange={e => onDataChange(block.id, { ...d, description: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">Stripe Price ID</span>
                  <input type="text" value={d.priceId as string} placeholder="price_xxxxxxxx"
                    onChange={e => onDataChange(block.id, { ...d, priceId: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white font-mono text-xs" />
                  <span className="text-slate-600 text-[10px] mt-1 block">Stripeダッシュボード → 商品 → 価格のIDを入力</span>
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">ボタンテキスト</span>
                  <input type="text" value={d.buttonText as string}
                    onChange={e => onDataChange(block.id, { ...d, buttonText: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">ボタン色</span>
                  <div className="flex gap-2">
                    <input type="color" value={d.buttonColor as string || '#1e3a8a'}
                      onChange={e => onDataChange(block.id, { ...d, buttonColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <input type="text" value={d.buttonColor as string}
                      onChange={e => onDataChange(block.id, { ...d, buttonColor: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </div>
                </label>
              </>
            )}
            {block?.type === 'google-reviews' && (
              <GoogleReviewsPanel
                d={d}
                blockId={block.id}
                onDataChange={onDataChange}
              />
            )}
            {block?.type === 'announcement-bar' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">テキスト</span>
                  <input type="text" value={d.text as string}
                    onChange={e => onDataChange(block.id, { ...d, text: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">リンク先（省略可）</span>
                  <input type="text" value={(d.link as string) || ''}
                    onChange={e => onDataChange(block.id, { ...d, link: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                    placeholder="#contact" />
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">背景色</span>
                  <div className="flex gap-2">
                    <input type="color" value={(d.bgColor as string) || '#1e40af'}
                      onChange={e => onDataChange(block.id, { ...d, bgColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <input type="text" value={(d.bgColor as string) || '#1e40af'}
                      onChange={e => onDataChange(block.id, { ...d, bgColor: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </div>
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">文字色</span>
                  <div className="flex gap-2">
                    <input type="color" value={(d.textColor as string) || '#ffffff'}
                      onChange={e => onDataChange(block.id, { ...d, textColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <input type="text" value={(d.textColor as string) || '#ffffff'}
                      onChange={e => onDataChange(block.id, { ...d, textColor: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={(d.closeable as string) !== 'false'}
                    onChange={e => onDataChange(block.id, { ...d, closeable: e.target.checked ? 'true' : 'false' })}
                    className="w-4 h-4 rounded accent-blue-500" />
                  <span className="text-slate-300 text-sm">閉じるボタンを表示</span>
                </label>
              </>
            )}
            {block?.type === 'instagram' && (() => {
              const photos = (d.photos as string[]) || [];
              return (
                <>
                  <label className="block">
                    <span className="text-slate-400 block mb-1">見出し</span>
                    <input type="text" value={(d.heading as string) || ''}
                      onChange={e => onDataChange(block.id, { ...d, heading: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </label>
                  <label className="block">
                    <span className="text-slate-400 block mb-1">Instagram ユーザー名</span>
                    <input type="text" value={(d.username as string) || ''}
                      onChange={e => onDataChange(block.id, { ...d, username: e.target.value.replace('@', '') })}
                      placeholder="@なし で入力"
                      className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </label>
                  <label className="block">
                    <span className="text-slate-400 block mb-1">カラム数</span>
                    <select value={(d.columns as string) || '3'}
                      onChange={e => onDataChange(block.id, { ...d, columns: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                      <option value="3">3列</option>
                      <option value="4">4列</option>
                    </select>
                  </label>
                  <span className="text-slate-400 block mt-2 mb-1 text-[11px]">投稿写真URL（最大9枚）</span>
                  <div className="space-y-1.5">
                    {[...Array(9)].map((_, i) => (
                      <input key={i} type="url" value={photos[i] || ''}
                        placeholder={`写真 ${i + 1} の URL`}
                        onChange={e => { const np = [...photos]; np[i] = e.target.value; onDataChange(block.id, { ...d, photos: np.filter((_, j) => j <= i || np[j]) }); }}
                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[11px]" />
                    ))}
                  </div>
                  <div className="text-slate-500 text-[10px] mt-2">Instagram の投稿を右クリック→「リンクをコピー」で画像URLを取得できます</div>
                </>
              );
            })()}
            {block?.type === 'testimonials' && (() => {
              type TestItem = {name:string;age:string;rating:number;text:string};
              const items = (d.items as TestItem[]) || [];
              return (
                <>
                  <span className="text-slate-400 block mb-2 text-[11px] font-semibold uppercase tracking-wide">お客様の声</span>
                  <div className="space-y-3">
                    {items.map((item, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-[10px]">#{i + 1}</span>
                          <button onClick={() => onDataChange(block.id, { ...d, items: items.filter((_,j) => j !== i) })}
                            className="text-red-400/60 hover:text-red-400 text-xs">✕</button>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block mb-0.5">評価</span>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(star => (
                              <button key={star} onClick={() => { const ni=[...items]; ni[i]={...ni[i],rating:star}; onDataChange(block.id,{...d,items:ni}); }}
                                className={`text-base ${star <= item.rating ? 'text-yellow-400' : 'text-white/20'}`}>★</button>
                            ))}
                          </div>
                        </div>
                        <label className="block">
                          <span className="text-slate-500 text-[10px] block mb-0.5">名前</span>
                          <input type="text" value={item.name}
                            onChange={e => { const ni=[...items]; ni[i]={...ni[i],name:e.target.value}; onDataChange(block.id,{...d,items:ni}); }}
                            className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs" />
                        </label>
                        <label className="block">
                          <span className="text-slate-500 text-[10px] block mb-0.5">属性（年齢・職業など）</span>
                          <input type="text" value={item.age}
                            onChange={e => { const ni=[...items]; ni[i]={...ni[i],age:e.target.value}; onDataChange(block.id,{...d,items:ni}); }}
                            className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs" />
                        </label>
                        <label className="block">
                          <span className="text-slate-500 text-[10px] block mb-0.5">コメント</span>
                          <textarea rows={3} value={item.text}
                            onChange={e => { const ni=[...items]; ni[i]={...ni[i],text:e.target.value}; onDataChange(block.id,{...d,items:ni}); }}
                            className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs resize-none" />
                        </label>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => onDataChange(block.id, { ...d, items: [...items, { name: '氏名', age: '30代', rating: 5, text: 'コメントを入力してください。' }] })}
                    className="w-full mt-2 text-xs bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg transition-colors">+ 追加</button>
                </>
              );
            })()}
            {block?.type === 'faq' && (() => {
              type FaqItem = {q:string;a:string};
              const items = (d.items as FaqItem[]) || [];
              return (
                <>
                  <span className="text-slate-400 block mb-2 text-[11px] font-semibold uppercase tracking-wide">よくある質問</span>
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-[10px]">Q{i + 1}</span>
                          <button onClick={() => onDataChange(block.id, { ...d, items: items.filter((_,j) => j !== i) })}
                            className="text-red-400/60 hover:text-red-400 text-xs">✕</button>
                        </div>
                        <label className="block">
                          <span className="text-slate-500 text-[10px] block mb-0.5">質問</span>
                          <input type="text" value={item.q}
                            onChange={e => { const ni=[...items]; ni[i]={...ni[i],q:e.target.value}; onDataChange(block.id,{...d,items:ni}); }}
                            className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs" />
                        </label>
                        <label className="block">
                          <span className="text-slate-500 text-[10px] block mb-0.5">回答</span>
                          <textarea rows={2} value={item.a}
                            onChange={e => { const ni=[...items]; ni[i]={...ni[i],a:e.target.value}; onDataChange(block.id,{...d,items:ni}); }}
                            className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs resize-none" />
                        </label>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => onDataChange(block.id, { ...d, items: [...items, { q: '質問を入力', a: '回答を入力' }] })}
                    className="w-full mt-2 text-xs bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg transition-colors">+ 追加</button>
                </>
              );
            })()}
            {block?.type === 'hours' && (() => {
              type SchRow = {day:string;hours:string;closed:boolean};
              const schedule = (d.schedule as SchRow[]) || [];
              return (
                <>
                  <span className="text-slate-400 block mb-2 text-[11px] font-semibold uppercase tracking-wide">営業時間</span>
                  <div className="space-y-1.5">
                    {schedule.map((row, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="w-6 text-slate-400 text-xs flex-shrink-0 text-center">{row.day}</span>
                        <label className="flex items-center gap-1 flex-shrink-0 cursor-pointer">
                          <input type="checkbox" checked={row.closed}
                            onChange={e => { const ns=[...schedule]; ns[i]={...ns[i],closed:e.target.checked}; onDataChange(block.id,{...d,schedule:ns}); }}
                            className="w-3 h-3 rounded accent-red-500" />
                          <span className="text-[10px] text-slate-500">休</span>
                        </label>
                        {!row.closed ? (
                          <input type="text" value={row.hours} placeholder="9:00〜18:00"
                            onChange={e => { const ns=[...schedule]; ns[i]={...ns[i],hours:e.target.value}; onDataChange(block.id,{...d,schedule:ns}); }}
                            className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-white text-[10px]" />
                        ) : (
                          <span className="flex-1 text-red-400/60 text-[10px]">定休日</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <label className="block mt-3">
                    <span className="text-slate-400 block mb-1 text-[10px]">備考（例：祝日は休診）</span>
                    <input type="text" value={(d.note as string) || ''}
                      onChange={e => onDataChange(block.id, { ...d, note: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs" />
                  </label>
                </>
              );
            })()}
            {block?.type === 'price-table' && (() => {
              type PPlan = {name:string;price:string;period:string;description:string;features:string[];highlighted:boolean;buttonText:string;buttonLink:string};
              const plans = (d.plans as PPlan[]) || [];
              return (
                <>
                  <span className="text-slate-400 block mb-2 text-[11px] font-semibold uppercase tracking-wide">料金プラン</span>
                  <div className="space-y-3">
                    {plans.map((plan, i) => (
                      <div key={i} className={`bg-white/5 border rounded-lg p-3 space-y-2 ${plan.highlighted ? 'border-blue-500/40' : 'border-white/10'}`}>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300 text-xs font-semibold truncate mr-2">{plan.name || `プラン ${i+1}`}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={plan.highlighted}
                                onChange={e => { const np=[...plans]; np[i]={...np[i],highlighted:e.target.checked}; onDataChange(block.id,{...d,plans:np}); }}
                                className="w-3 h-3 rounded accent-blue-500" />
                              <span className="text-[10px] text-blue-400">推奨</span>
                            </label>
                            <button onClick={() => onDataChange(block.id, { ...d, plans: plans.filter((_,j) => j !== i) })}
                              className="text-red-400/60 hover:text-red-400 text-xs">✕</button>
                          </div>
                        </div>
                        <label className="block">
                          <span className="text-slate-500 text-[10px] block mb-0.5">プラン名</span>
                          <input type="text" value={plan.name}
                            onChange={e => { const np=[...plans]; np[i]={...np[i],name:e.target.value}; onDataChange(block.id,{...d,plans:np}); }}
                            className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs" />
                        </label>
                        <div className="flex gap-1.5">
                          <label className="flex-1 block">
                            <span className="text-slate-500 text-[10px] block mb-0.5">価格</span>
                            <input type="text" value={plan.price} placeholder="¥9,800"
                              onChange={e => { const np=[...plans]; np[i]={...np[i],price:e.target.value}; onDataChange(block.id,{...d,plans:np}); }}
                              className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs" />
                          </label>
                          <label className="w-14 block">
                            <span className="text-slate-500 text-[10px] block mb-0.5">単位</span>
                            <input type="text" value={plan.period} placeholder="/月"
                              onChange={e => { const np=[...plans]; np[i]={...np[i],period:e.target.value}; onDataChange(block.id,{...d,plans:np}); }}
                              className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs" />
                          </label>
                        </div>
                        <label className="block">
                          <span className="text-slate-500 text-[10px] block mb-0.5">機能リスト（1行1項目）</span>
                          <textarea rows={3} value={(plan.features||[]).join('\n')}
                            onChange={e => { const np=[...plans]; np[i]={...np[i],features:e.target.value.split('\n')}; onDataChange(block.id,{...d,plans:np}); }}
                            className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px] resize-none font-mono" />
                        </label>
                        <div className="flex gap-1.5">
                          <label className="flex-1 block">
                            <span className="text-slate-500 text-[10px] block mb-0.5">ボタン文字</span>
                            <input type="text" value={plan.buttonText}
                              onChange={e => { const np=[...plans]; np[i]={...np[i],buttonText:e.target.value}; onDataChange(block.id,{...d,plans:np}); }}
                              className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs" />
                          </label>
                          <label className="flex-1 block">
                            <span className="text-slate-500 text-[10px] block mb-0.5">リンク</span>
                            <input type="text" value={plan.buttonLink} placeholder="#contact"
                              onChange={e => { const np=[...plans]; np[i]={...np[i],buttonLink:e.target.value}; onDataChange(block.id,{...d,plans:np}); }}
                              className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs" />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => onDataChange(block.id, { ...d, plans: [...plans, { name: '新しいプラン', price: '¥0', period: '/月', description: '', features: ['機能1','機能2'], highlighted: false, buttonText: '申し込む', buttonLink: '#contact' }] })}
                    className="w-full mt-2 text-xs bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg transition-colors">+ プラン追加</button>
                </>
              );
            })()}
            {block?.type === 'heading' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">テキスト配置</span>
                  <select value={(d.align as string) || 'left'} onChange={e => onDataChange(block.id, { ...d, align: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="left">左寄せ</option>
                    <option value="center">中央</option>
                    <option value="right">右寄せ</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">フォントサイズ</span>
                  <select value={(d.fontSize as string) || '3xl'} onChange={e => onDataChange(block.id, { ...d, fontSize: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="sm">小 (sm)</option>
                    <option value="base">標準 (base)</option>
                    <option value="xl">中 (xl)</option>
                    <option value="2xl">大 (2xl)</option>
                    <option value="3xl">特大 (3xl)</option>
                    <option value="4xl">超特大 (4xl)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">フォントウェイト</span>
                  <select value={(d.fontWeight as string) || 'black'} onChange={e => onDataChange(block.id, { ...d, fontWeight: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="normal">通常</option>
                    <option value="semibold">セミボールド</option>
                    <option value="bold">ボールド</option>
                    <option value="extrabold">エクストラボールド</option>
                    <option value="black">ブラック</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">文字色</span>
                  <div className="flex gap-2">
                    <input type="color" value={(d.color as string) || '#111827'}
                      onChange={e => onDataChange(block.id, { ...d, color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <input type="text" value={(d.color as string) || '#111827'}
                      onChange={e => onDataChange(block.id, { ...d, color: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </div>
                </label>
              </>
            )}
            {block?.type === 'paragraph' && (
              <>
                <label className="block">
                  <span className="text-slate-400 block mb-1">テキスト配置</span>
                  <select value={(d.align as string) || 'left'} onChange={e => onDataChange(block.id, { ...d, align: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="left">左寄せ</option>
                    <option value="center">中央</option>
                    <option value="right">右寄せ</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">フォントサイズ</span>
                  <select value={(d.fontSize as string) || 'base'} onChange={e => onDataChange(block.id, { ...d, fontSize: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="sm">小 (sm)</option>
                    <option value="base">標準 (base)</option>
                    <option value="lg">大 (lg)</option>
                    <option value="xl">特大 (xl)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">文字色</span>
                  <div className="flex gap-2">
                    <input type="color" value={(d.color as string) || '#374151'}
                      onChange={e => onDataChange(block.id, { ...d, color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <input type="text" value={(d.color as string) || '#374151'}
                      onChange={e => onDataChange(block.id, { ...d, color: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </div>
                </label>
                <label className="block">
                  <span className="text-slate-400 block mb-1">テキスト幅</span>
                  <select value={(d.maxWidth as string) || 'full'} onChange={e => onDataChange(block.id, { ...d, maxWidth: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="full">全幅</option>
                    <option value="prose">読みやすい幅</option>
                    <option value="lg">広め</option>
                    <option value="md">中</option>
                    <option value="sm">狭め</option>
                  </select>
                </label>
              </>
            )}
            {block && !['hero','cta','divider','services','image','gallery','larubot','video','map','countdown','price-table','booking','contact','popup','newsletter','share','stripe-buy','google-reviews','testimonials','faq','hours','heading','paragraph','announcement-bar','instagram'].includes(block.type) && (
              <div className="text-slate-500 py-4 text-center">
                キャンバス上でクリックしてテキストを直接編集できます
              </div>
            )}
            {/* AI コピーライティング */}
            {block && AI_COPY_BLOCKS.includes(block.type) && (
              <div className="border-t border-white/10 pt-3 mt-2">
                <span className="text-slate-400 block mb-2 text-[11px] font-semibold uppercase tracking-wide">✨ AI コピーライティング</span>
                <button
                  onClick={handleAiCopy}
                  disabled={aiCopyLoading}
                  className="w-full text-xs bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-bold py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiCopyLoading ? '生成中...' : 'AIで文章を自動生成'}
                </button>
                {aiCopyResult && (
                  <div className="mt-3 bg-white/[0.04] border border-white/10 rounded-lg p-3 space-y-2">
                    <span className="text-[10px] text-slate-400 font-semibold block">生成結果プレビュー</span>
                    {Object.entries(aiCopyResult).filter(([k]) => typeof aiCopyResult[k] === 'string').map(([k, v]) => (
                      <div key={k} className="text-xs text-slate-300">
                        <span className="text-slate-500">{k}:</span> {String(v)}
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <button onClick={applyAiCopy} className="flex-1 text-xs bg-white text-black font-bold py-1.5 rounded transition-all hover:bg-blue-50">
                        適用する
                      </button>
                      <button onClick={() => setAiCopyResult(null)} className="text-xs text-slate-500 hover:text-slate-300 px-2">
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* 全ブロック共通：余白・アニメーション・表示設定 */}
            {block && (
              <div className="border-t border-white/10 pt-3 mt-2 space-y-3">
                <span className="text-slate-400 block text-[11px] font-semibold uppercase tracking-wide">余白・アニメーション</span>
                <div className="flex gap-2">
                  <label className="flex-1 block">
                    <span className="text-slate-500 text-[10px] block mb-0.5">上余白</span>
                    <select value={(d.paddingTop as string) || 'md'} onChange={e => onDataChange(block.id, { ...d, paddingTop: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded px-1.5 py-1 text-white text-[10px]">
                      <option value="none">なし</option>
                      <option value="sm">小</option>
                      <option value="md">中</option>
                      <option value="lg">大</option>
                      <option value="xl">特大</option>
                    </select>
                  </label>
                  <label className="flex-1 block">
                    <span className="text-slate-500 text-[10px] block mb-0.5">下余白</span>
                    <select value={(d.paddingBottom as string) || 'md'} onChange={e => onDataChange(block.id, { ...d, paddingBottom: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded px-1.5 py-1 text-white text-[10px]">
                      <option value="none">なし</option>
                      <option value="sm">小</option>
                      <option value="md">中</option>
                      <option value="lg">大</option>
                      <option value="xl">特大</option>
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="text-slate-500 text-[10px] block mb-0.5">入場アニメーション</span>
                  <select value={(d.animation as string) || 'fade'} onChange={e => onDataChange(block.id, { ...d, animation: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]">
                    <option value="fade">フェード（標準）</option>
                    <option value="slide-up">スライドアップ</option>
                    <option value="slide-left">左からスライド</option>
                    <option value="slide-right">右からスライド</option>
                    <option value="zoom">ズームイン</option>
                    <option value="none">なし</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-500 text-[10px] block mb-0.5">アニメーション速度</span>
                  <select value={(d.animationDuration as string) || '600'} onChange={e => onDataChange(block.id, { ...d, animationDuration: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]">
                    <option value="300">速い (0.3s)</option>
                    <option value="600">標準 (0.6s)</option>
                    <option value="900">ゆっくり (0.9s)</option>
                    <option value="1200">とてもゆっくり (1.2s)</option>
                  </select>
                </label>
                <div className="space-y-2 pt-1 border-t border-white/5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!(d.hideOnMobile)}
                      onChange={e => onDataChange(block.id, { ...d, hideOnMobile: e.target.checked })}
                      className="w-4 h-4 rounded" />
                    <span className="text-slate-300 text-xs">スマホで非表示</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!(d.hideOnDesktop)}
                      onChange={e => onDataChange(block.id, { ...d, hideOnDesktop: e.target.checked })}
                      className="w-4 h-4 rounded" />
                    <span className="text-slate-300 text-xs">PCで非表示</span>
                  </label>
                </div>
              </div>
            )}

            {/* Block memo */}
            {block && (
              <div className="mt-4 border-t border-white/[0.07] pt-4">
                <label className="text-[10px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1 block">
                  {block.memo ? <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> : <span className="w-2 h-2 rounded-full bg-white/10 inline-block" />}
                  メモ（自分だけ見えます）
                </label>
                <textarea
                  rows={2}
                  value={block.memo || ''}
                  onChange={e => onMemoChange(block.id, e.target.value)}
                  placeholder="このブロックへのメモ..."
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-2.5 py-2 text-xs text-slate-300 placeholder-slate-600 resize-none outline-none focus:border-yellow-400/40 focus:ring-1 focus:ring-yellow-400/20"
                />
              </div>
            )}
          </>
        )}

        {tab === 'seo' && (
          <>
            {/* SEO Score Card */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm">SEOスコア</span>
                <span className={`text-xl font-black ${seoScore >= 7 ? 'text-green-400' : seoScore >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {Math.round(seoScore / seoChecks.length * 100)}
                  <span className="text-xs font-normal text-slate-500">/100</span>
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 mb-3">
                <div className={`h-full rounded-full transition-all duration-500 ${seoScore >= 7 ? 'bg-green-400' : seoScore >= 4 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.round(seoScore / seoChecks.length * 100)}%` }} />
              </div>
              <div className="space-y-1.5">
                {seoChecks.map(c => (
                  <div key={c.id} className="flex items-start gap-2">
                    <span className={`flex-shrink-0 mt-0.5 ${c.pass ? 'text-green-400' : 'text-slate-600'}`}>
                      {c.pass ? '✓' : '○'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className={`text-[11px] ${c.pass ? 'text-slate-300' : 'text-slate-500'}`}>{c.label}</span>
                      {!c.pass && <div className="text-[10px] text-slate-600 leading-tight">{c.tip}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-slate-400 block mb-1">ページタイトル <span className="text-slate-600">({seo.title.length}/60)</span></span>
              <input type="text" value={seo.title} placeholder="例: 〇〇整体院 | 渋谷区の整体・腰痛専門"
                onChange={e => onSeoChange({ ...seo, title: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
              {seo.title.length > 60 && <span className="text-red-400 text-[10px]">60文字以内推奨</span>}
            </label>

            <label className="block">
              <span className="text-slate-400 block mb-1">メタディスクリプション <span className="text-slate-600">({seo.description.length}/160)</span></span>
              <textarea value={seo.description} rows={3} placeholder="例: 渋谷区の整体院。腰痛・肩こりを根本から改善。"
                onChange={e => onSeoChange({ ...seo, description: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white resize-none" />
              {seo.description.length > 160 && <span className="text-red-400 text-[10px]">160文字以内推奨</span>}
            </label>

            <label className="block">
              <span className="text-slate-400 block mb-1">キーワード</span>
              <input type="text" value={seo.keywords} placeholder="整体, 腰痛, 渋谷"
                onChange={e => onSeoChange({ ...seo, keywords: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
            </label>

            {/* Google search preview */}
            <div className="border-t border-white/10 pt-3 mb-3">
              <div className="text-slate-400 text-[11px] mb-2 font-semibold">検索結果プレビュー</div>
              <div className="bg-white rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-4 h-4 rounded-full bg-slate-200 flex-shrink-0" />
                  <span className="text-[10px] text-slate-500 truncate">あなたのサイト.laruvisona.com</span>
                </div>
                <div className="text-[13px] text-[#1a0dab] font-medium leading-snug truncate">
                  {seo.title || '（タイトル未設定）'}
                </div>
                <div className="text-[11px] text-[#4d5156] mt-0.5 leading-relaxed line-clamp-2">
                  {seo.description || '（説明文を入力するとここに表示されます）'}
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-3">
              <div className="text-slate-400 mb-2">OG（SNSシェア設定）</div>
              <label className="block mb-2">
                <span className="text-slate-500 block mb-1">OGタイトル</span>
                <input type="text" value={seo.ogTitle} placeholder="SNSでシェアされた時のタイトル"
                  onChange={e => onSeoChange({ ...seo, ogTitle: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
              </label>
              <label className="block mb-2">
                <span className="text-slate-500 block mb-1">OG説明文</span>
                <textarea value={seo.ogDescription} rows={2} placeholder="SNSでシェアされた時の説明文"
                  onChange={e => onSeoChange({ ...seo, ogDescription: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white resize-none" />
              </label>
              <label className="block">
                <span className="text-slate-500 block mb-1">OG画像URL</span>
                <input type="url" value={seo.ogImage ?? ''} placeholder="https://example.com/ogp.jpg"
                  onChange={e => onSeoChange({ ...seo, ogImage: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
                <span className="text-slate-600 text-[10px]">1200×630px 推奨。SNSシェア時のサムネイル画像</span>
              </label>
            </div>
          </>
        )}

        {tab === 'integrations' && (
          <>
            {/* Color Scheme Picker */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🎨</span>
                <span className="font-bold text-sm">カラーテーマ</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {COLOR_SCHEMES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => onColorSchemeChange(s.id)}
                    title={s.name}
                    className={`rounded-lg p-1.5 flex flex-col items-center gap-1 transition-all border ${colorScheme === s.id ? 'border-white/60 bg-white/10' : 'border-transparent hover:border-white/20'}`}
                  >
                    <div className="flex gap-0.5">
                      <div className="w-4 h-4 rounded-full" style={{ background: s.colors[0] }} />
                      <div className="w-4 h-4 rounded-full" style={{ background: s.colors[1] }} />
                    </div>
                    <span className="text-[9px] text-slate-400 leading-tight text-center">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Palette */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🖌️</span>
                <span className="font-bold text-sm">マイカラー（6色）</span>
              </div>
              <p className="text-slate-500 text-[10px] mb-3">色を定義するとブロック編集時のカラー選択に表示されます</p>
              <div className="grid grid-cols-3 gap-2">
                {PALETTE_LABELS.map((label, i) => (
                  <label key={i} className="block">
                    <span className="text-[10px] text-slate-500 block mb-0.5">{label}</span>
                    <input type="color"
                      value={customPalette[i] || DEFAULT_PALETTE[i]}
                      onChange={e => {
                        const next = [...customPalette];
                        next[i] = e.target.value;
                        onCustomPaletteChange(next);
                      }}
                      className="w-full h-7 rounded cursor-pointer bg-transparent border border-white/20" />
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => onCustomPaletteChange([...DEFAULT_PALETTE])}
                className="mt-2 text-[10px] text-slate-500 hover:text-slate-300 underline">
                リセット
              </button>
            </div>

            {/* LARUbot */}
            {(() => {
              const canUse = userPlan === 'hp-bot' || userPlan === 'hp-bot-seo';
              return (
                <div className="rounded-xl mb-3 overflow-hidden border border-indigo-500/20" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(17,24,39,0.8) 100%)' }}>
                  {/* Header */}
                  <div className="p-3 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/25 border border-indigo-400/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-base">🤖</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-white text-[13px]">LARUbot</span>
                            {canUse && larubot && <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full font-bold">連携中</span>}
                            {!canUse && <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded-full font-bold">HP+Bot プラン</span>}
                          </div>
                          <div className="text-slate-400 text-[10px] mt-0.5">AIチャットボット — 問い合わせを24時間自動対応</div>
                        </div>
                      </div>
                      {canUse && (
                        <button
                          onClick={() => onLarubotChange(!larubot)}
                          aria-label={larubot ? 'LARUbotを無効にする' : 'LARUbotを有効にする'}
                          aria-pressed={larubot}
                          className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 focus:ring-offset-transparent ${larubot ? 'bg-indigo-500' : 'bg-white/15'}`}
                        >
                          <div className={`w-4.5 h-4.5 bg-white rounded-full absolute top-[3px] transition-all shadow ${larubot ? 'left-[23px]' : 'left-[3px]'}`} />
                        </button>
                      )}
                    </div>
                    {/* Benefits */}
                    <div className="mt-2.5 grid grid-cols-1 gap-1">
                      {[
                        { icon: '💬', text: '訪問者の質問にAIがリアルタイム回答' },
                        { icon: '📅', text: '予約・営業時間・料金を自動案内' },
                        { icon: '📊', text: '会話ログをダッシュボードで分析' },
                      ].map((b, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span className="text-[11px]">{b.icon}</span>
                          <span>{b.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Action area */}
                  {canUse ? (
                    larubot ? (
                      <div className="px-3 pb-3 border-t border-indigo-500/20 pt-2.5">
                        <label className="text-slate-400 text-[10px] mb-1.5 block font-medium">Public ID <span className="text-slate-600">（LARUbotダッシュボード → 設定 で確認）</span></label>
                        <input
                          type="text"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={larubotPublicId}
                          onChange={e => onLarubotPublicIdChange(e.target.value)}
                          className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-white text-[10px] font-mono focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/30"
                        />
                      </div>
                    ) : (
                      <div className="px-3 pb-3 pt-1">
                        <p className="text-[10px] text-slate-500">右のスイッチをオンにして Public ID を入力すると、サイトにチャットボタンが表示されます。</p>
                      </div>
                    )
                  ) : (
                    <div className="px-3 pb-3 border-t border-indigo-500/20 pt-2.5">
                      <a
                        href="/laruHP/plans"
                        className="block w-full text-center bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-300 text-[11px] font-bold py-2 rounded-lg transition-all"
                      >
                        HP + Bot プランにアップグレード →
                      </a>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* LARUSEO */}
            {(() => {
              const canUse = userPlan === 'hp-bot-seo';
              return (
                <div className="rounded-xl mb-3 overflow-hidden border border-emerald-500/20" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(17,24,39,0.8) 100%)' }}>
                  {/* Header */}
                  <div className="p-3 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-base">📈</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-white text-[13px]">LARUSEO</span>
                            {canUse && laruseo && <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full font-bold">連携中</span>}
                            {!canUse && <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">Bot+SEO プラン</span>}
                          </div>
                          <div className="text-slate-400 text-[10px] mt-0.5">AIブログ自動生成 — Googleで上位表示を狙う</div>
                        </div>
                      </div>
                      {canUse && (
                        <button
                          onClick={() => onLaruseoChange(!laruseo)}
                          aria-label={laruseo ? 'LARUSEOを無効にする' : 'LARUSEOを有効にする'}
                          aria-pressed={laruseo}
                          className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-transparent ${laruseo ? 'bg-emerald-500' : 'bg-white/15'}`}
                        >
                          <div className={`w-4.5 h-4.5 bg-white rounded-full absolute top-[3px] transition-all shadow ${laruseo ? 'left-[23px]' : 'left-[3px]'}`} />
                        </button>
                      )}
                    </div>
                    {/* Benefits */}
                    <div className="mt-2.5 grid grid-cols-1 gap-1">
                      {[
                        { icon: '✍️', text: 'SEO最適化ブログをAIが毎週自動投稿' },
                        { icon: '🔍', text: '検索キーワードの順位をリアルタイム追跡' },
                        { icon: '🎯', text: '改善提案でオーガニック集客を強化' },
                      ].map((b, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span className="text-[11px]">{b.icon}</span>
                          <span>{b.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Action area */}
                  {canUse ? (
                    laruseo ? (
                      <div className="px-3 pb-3 border-t border-emerald-500/20 pt-2.5">
                        <label className="text-slate-400 text-[10px] mb-1.5 block font-medium">サイト ID <span className="text-slate-600">（LARUSEOダッシュボード → 設定 で確認）</span></label>
                        <input
                          type="text"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={laruseoPublicId}
                          onChange={e => onLaruseoPublicIdChange(e.target.value)}
                          className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-white text-[10px] font-mono focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/30"
                        />
                      </div>
                    ) : (
                      <div className="px-3 pb-3 pt-1">
                        <p className="text-[10px] text-slate-500">右のスイッチをオンにしてサイト ID を入力すると、AIブログとSEOウィジェットが有効になります。</p>
                      </div>
                    )
                  ) : (
                    <div className="px-3 pb-3 border-t border-emerald-500/20 pt-2.5">
                      <a
                        href="/laruHP/plans"
                        className="block w-full text-center bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold py-2 rounded-lg transition-all"
                      >
                        HP + Bot + SEO プランにアップグレード →
                      </a>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-orange-500/30 flex items-center justify-center text-orange-300 text-[10px] font-black flex-shrink-0">GA</div>
                <span className="font-bold text-sm">Google Analytics</span>
              </div>
              <input type="text" placeholder="G-XXXXXXXXXX"
                value={gaTrackingId}
                onChange={e => onGaTrackingIdChange(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
              <div className="text-slate-500 text-[10px] mt-1">トラッキングIDを入力して保存すると公開サイトに適用されます</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🗺</span>
                <span className="font-bold text-sm">Google Maps</span>
              </div>
              <input type="text" placeholder="Maps Embed URL"
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📧</span>
                <span className="font-bold text-sm">フォーム通知メール</span>
              </div>
              <input
                type="email"
                value={notifyEmail}
                placeholder="notify@example.com"
                onChange={e => onNotifyEmailChange(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]"
              />
              <div className="text-slate-500 text-[10px] mt-1">お問い合わせ・予約フォーム送信時に通知</div>
            </div>

            {/* LINE Notify */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg" style={{ color: '#06c755' }}>💬</span>
                <span className="font-bold text-sm">LINE 通知</span>
              </div>
              <input
                type="password"
                value={lineNotifyToken}
                placeholder="LINE Notify トークン"
                onChange={e => onLineNotifyTokenChange(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px] mb-1"
              />
              <div className="text-slate-500 text-[10px]">フォーム送信時に LINE へ即時通知。<a href="https://notify-bot.line.me/ja/" target="_blank" rel="noreferrer" className="underline hover:text-slate-400">LINE Notify</a> でトークンを取得して貼り付けてください。</div>
            </div>

            {/* Webhook */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔗</span>
                <span className="font-bold text-sm">Webhook（Zapier / Make）</span>
              </div>
              <input
                type="url"
                value={webhookUrl}
                placeholder="https://hooks.zapier.com/..."
                onChange={e => onWebhookUrlChange(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px] mb-1"
              />
              <div className="text-slate-500 text-[10px]">フォーム送信時に任意の URL へ JSON でデータを POST します。Zapier・Make などに対応。</div>
              {webhookUrl && siteId && (
                <div className="mt-2">
                  <button
                    onClick={async () => {
                      if (webhookLogsLoading) return;
                      setWebhookLogsLoading(true);
                      const res = await fetch(`/api/sites/${siteId}/webhook-logs`);
                      const data = await res.json();
                      setWebhookLogs(data.logs || []);
                      setWebhookLogsLoading(false);
                    }}
                    className="text-[10px] text-sky-400 hover:text-sky-300 underline"
                  >
                    {webhookLogsLoading ? '読み込み中...' : '受信ログを確認 →'}
                  </button>
                  {webhookLogs !== null && (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {webhookLogs.length === 0 ? (
                        <div className="text-[10px] text-slate-500">まだ受信ログがありません</div>
                      ) : webhookLogs.map(log => (
                        <div key={log.id} className="flex items-center gap-2 text-[10px] bg-white/5 rounded px-2 py-1">
                          <span className={`font-bold ${log.webhook_status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                            {log.webhook_status === 'success' ? '✓' : '✗'} {log.webhook_code}
                          </span>
                          <span className="text-slate-300 truncate flex-1">{log.name} / {log.email}</span>
                          <span className="text-slate-500 shrink-0">{new Date(log.webhook_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Microsoft Clarity */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">👁</span>
                <span className="font-bold text-sm">Microsoft Clarity</span>
              </div>
              <input
                type="text"
                value={clarityId}
                placeholder="Clarity プロジェクト ID（例: abc123xyz）"
                onChange={e => onClarityIdChange(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px] mb-1"
              />
              <div className="text-slate-500 text-[10px]">ヒートマップ・セッション録画。<a href="https://clarity.microsoft.com/" target="_blank" rel="noreferrer" className="underline hover:text-slate-400">clarity.microsoft.com</a> でプロジェクト ID を取得してください。</div>
            </div>

            {/* サイトパスワード保護 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔒</span>
                <span className="font-bold text-sm">パスワード保護</span>
              </div>
              <input
                type="text"
                value={sitePassword}
                placeholder="パスワードを設定（空欄で無効）"
                onChange={e => onSitePasswordChange(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px] mb-1"
              />
              <div className="text-slate-500 text-[10px]">設定すると公開サイトにアクセス時にパスワードの入力が必要になります。</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">👥</span>
                <span className="font-bold text-sm">エージェンシー管理</span>
              </div>
              <div className="text-slate-500 text-[10px] mb-2">クライアント情報（名前・メール・メモ）はエージェンシー管理画面から設定できます。</div>
              <a href="/laruHP/agency" target="_blank" className="block text-center w-full bg-white/10 hover:bg-white/20 text-white text-[10px] py-1.5 rounded-lg transition-all">エージェンシー管理画面を開く →</a>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔤</span>
                <span className="font-bold text-sm">フォント</span>
              </div>
              <select
                value={fontFamily}
                onChange={e => onFontFamilyChange(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20"
              >
                <option value="noto">Noto Sans JP（標準）</option>
                <option value="zen">Zen Kaku Gothic New（モダン）</option>
                <option value="mincho">Shippori Mincho（明朝体）</option>
                <option value="rounded">M PLUS Rounded 1c（丸ゴシック）</option>
                <option value="biz">BIZ UDPゴシック（ビジネス）</option>
                <option value="kaisei">Kaisei Opti（上品な明朝）</option>
              </select>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">✦</span>
                <span className="font-bold text-sm">デザインスタイル</span>
              </div>
              <div className="text-slate-500 text-[10px] mb-2">ボタン・カード・余白・見出しの形を一括変更（公開サイトに適用）</div>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { id: 'modern',  label: 'モダン',    sub: 'ピル型・標準' },
                  { id: 'minimal', label: 'ミニマル',  sub: 'フラット・軽量' },
                  { id: 'bold',    label: 'ボールド',  sub: '大きく・力強い' },
                  { id: 'elegant', label: 'エレガント',sub: '細身・余白大' },
                  { id: 'rounded', label: 'ラウンド',  sub: '丸み・柔らか' },
                  { id: 'sharp',   label: 'シャープ',  sub: '角型・編集的' },
                ] as const).map(s => (
                  <button
                    key={s.id}
                    onClick={() => onDesignStyleChange(s.id)}
                    className={`rounded-lg p-2 flex flex-col items-start gap-0.5 transition-all border text-left ${designStyle === s.id ? 'border-blue-500/70 bg-blue-500/10' : 'border-transparent hover:border-white/20 bg-white/[0.03]'}`}
                  >
                    <span className="text-white text-[11px] font-bold leading-none">{s.label}</span>
                    <span className="text-slate-500 text-[9px] leading-none">{s.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🎨</span>
                <span className="font-bold text-sm">カスタムCSS</span>
              </div>
              <textarea
                value={customCss}
                onChange={e => onCustomCssChange(e.target.value)}
                placeholder={`.my-section { padding: 80px; }\n.lhp-hero h1 { letter-spacing: .05em; }`}
                rows={6}
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px] font-mono resize-none"
              />
              <div className="text-slate-500 text-[10px] mt-1">公開サイトに適用されます。既存のスタイルを上書き可能</div>
            </div>

            {/* Global Footer */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🦶</span>
                  <span className="font-bold text-sm">グローバルフッター</span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={globalFooter.enabled}
                    onChange={e => onGlobalFooterChange({ ...globalFooter, enabled: e.target.checked })}
                    className="w-4 h-4 rounded accent-blue-500" />
                  <span className="text-xs text-slate-400">有効</span>
                </label>
              </div>
              {globalFooter.enabled && (
                <div className="space-y-2">
                  <input type="text" placeholder="サイト名" value={globalFooter.logo}
                    onChange={e => onGlobalFooterChange({ ...globalFooter, logo: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
                  <input type="text" placeholder="タグライン（任意）" value={globalFooter.tagline}
                    onChange={e => onGlobalFooterChange({ ...globalFooter, tagline: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
                  <input type="text" placeholder="コピーライト" value={globalFooter.copyright}
                    onChange={e => onGlobalFooterChange({ ...globalFooter, copyright: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="text-slate-500 text-[10px] mb-1">背景色</div>
                      <input type="color" value={globalFooter.bgColor}
                        onChange={e => onGlobalFooterChange({ ...globalFooter, bgColor: e.target.value })}
                        className="w-full h-7 rounded cursor-pointer bg-transparent border border-white/20" />
                    </div>
                    <div className="flex-1">
                      <div className="text-slate-500 text-[10px] mb-1">文字色</div>
                      <input type="color" value={globalFooter.textColor}
                        onChange={e => onGlobalFooterChange({ ...globalFooter, textColor: e.target.value })}
                        className="w-full h-7 rounded cursor-pointer bg-transparent border border-white/20" />
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px] mb-1">リンク</div>
                    {globalFooter.links.map((l, i) => (
                      <div key={i} className="flex gap-1 mb-1">
                        <input type="text" placeholder="ラベル" value={l.label}
                          onChange={e => { const ls=[...globalFooter.links]; ls[i]={...ls[i],label:e.target.value}; onGlobalFooterChange({...globalFooter,links:ls}); }}
                          className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
                        <input type="text" placeholder="URL" value={l.href}
                          onChange={e => { const ls=[...globalFooter.links]; ls[i]={...ls[i],href:e.target.value}; onGlobalFooterChange({...globalFooter,links:ls}); }}
                          className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
                        <button onClick={() => onGlobalFooterChange({...globalFooter,links:globalFooter.links.filter((_,j)=>j!==i)})} className="text-red-400/50 hover:text-red-400 text-xs px-1">✕</button>
                      </div>
                    ))}
                    <button onClick={() => onGlobalFooterChange({...globalFooter,links:[...globalFooter.links,{label:'',href:'#'}]})}
                      className="text-blue-400 hover:text-blue-300 text-[10px] font-semibold">+ リンク追加</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Builder ──────────────────────────────────────────────────────────────
function BuilderContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const fromOnboarding = searchParams.get('from') === 'onboarding';
  const siteId = searchParams.get('siteId');

  const defaultSiteData: SiteData = {
    siteName: 'マイサイト',
    pages: [{
      id: 'page-main',
      name: 'トップページ',
      path: '/',
      blocks: [
        defaultBlock('hero'),
        defaultBlock('heading'),
        defaultBlock('services'),
        defaultBlock('divider'),
        defaultBlock('contact'),
      ],
      seo: emptySeo,
    }],
    colorScheme: 'professional-blue',
    designStyle: 'modern',
    larubot: true,
    laruseo: true,
    notifyEmail: '',
    gaTrackingId: '',
    larubotPublicId: '',
    laruseoPublicId: '',
    customCss: '',
    fontFamily: 'noto',
    accentColor: '#f59e0b',
    heroLayout: 'center',
    headerStyle: 'transparent',
    animLevel: 'full',
    customPalette: [...DEFAULT_PALETTE],
    lineNotifyToken: '',
    clarityId: '',
    webhookUrl: '',
    sitePassword: '',
    globalFooter: {
      enabled: false,
      logo: 'サイト名',
      tagline: '',
      links: [{ label: 'トップ', href: '#' }, { label: 'お問い合わせ', href: '#contact' }],
      sns: [],
      copyright: `© ${new Date().getFullYear()} All Rights Reserved.`,
      bgColor: '#111827',
      textColor: '#9ca3af',
    },
  };

  const [site, setSite] = useState<SiteData>(defaultSiteData);
  const [currentPageId, setCurrentPageId] = useState<string>('page-main');
  const [dbSiteId, setDbSiteId] = useState<string | null>(siteId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState(false);

  // Generate real exported HTML for iframe-based preview
  const previewHtml = useMemo(() => {
    if (!preview) return '';
    try {
      return exportToHTML(
        site.pages,
        site.pages[0]?.seo || emptySeo,
        { colorScheme: site.colorScheme, style: '', designStyle: site.designStyle, larubot: site.larubot, laruseo: site.laruseo, gaTrackingId: site.gaTrackingId, fontFamily: site.fontFamily, customCss: site.customCss, accentColor: site.accentColor, heroLayout: site.heroLayout, headerStyle: site.headerStyle, animLevel: site.animLevel },
        site.siteName,
      );
    } catch {
      return '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#999">プレビュー生成エラー</body></html>';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, site]);

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | false>(false);
  const [deletePageConfirmId, setDeletePageConfirmId] = useState<string | null>(null);
  const [deletedBlockUndo, setDeletedBlockUndo] = useState<{ block: Block; pageId: string; index: number } | null>(null);
  const deletedBlockUndoTimer = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [pendingSiteId, setPendingSiteId] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [versions, setVersions] = useState<{ id: string; label: string; created_at: string }[]>([]);
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiLayouting, setAiLayouting] = useState(false);
  const [builderToast, setBuilderToast] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [restoreConfirmVersionId, setRestoreConfirmVersionId] = useState<string | null>(null);
  const [aiLayoutProposal, setAiLayoutProposal] = useState<{ layout: string[]; reasoning: string } | null>(null);
  const [onboardingData, setOnboardingData] = useState<Record<string, unknown> | null>(null);
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showPublishSuccess, setShowPublishSuccess] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [recentBlocks, setRecentBlocks] = useState<BlockType[]>(() => {
    try { return JSON.parse(localStorage.getItem('laruHP_builder_recent_blocks') || '[]'); } catch { return []; }
  });
  const [paletteSearch, setPaletteSearch] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive');
  const [isAdmin, setIsAdmin] = useState(false);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [showMobileBlocks, setShowMobileBlocks] = useState(false);
  const [showImageLib, setShowImageLib] = useState(false);
  const [imageLibCallback, setImageLibCallback] = useState<((url: string) => void) | null>(null);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [showPreviewLink, setShowPreviewLink] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [previewTokenLoading, setPreviewTokenLoading] = useState(false);
  const [copiedBlock, setCopiedBlock] = useState<Block | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; blockId: string } | null>(null);
  const [showPageSpeed, setShowPageSpeed] = useState(false);
  const [snippets, setSnippets] = useState<Array<{ id: string; name: string; blocks: Block[] }>>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('laruHP_snippets') || '[]'); } catch { return []; }
  });
  const [pageSpeedLoading, setPageSpeedLoading] = useState(false);
  const [pageSpeedData, setPageSpeedData] = useState<{
    url: string;
    mobile: { performance: number; accessibility: number; seo: number; bestPractices: number } | null;
    desktop: { performance: number; accessibility: number; seo: number; bestPractices: number } | null;
  } | null>(null);
  const undoStack = useRef<SiteData[]>([]);
  const redoStack = useRef<SiteData[]>([]);
  const siteRef = useRef<SiteData>(defaultSiteData);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [showBuilderTour, setShowBuilderTour] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('laruHP_builder_tour_done');
  });

  // Lenis (global smooth scroll) intercepts wheel events at window level.
  // Stop propagation on the canvas so native overflow-y scroll takes over.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener('wheel', stop, { passive: false });
    return () => el.removeEventListener('wheel', stop);
  }, []);

  // Auto-scroll canvas to newly selected/added block
  useEffect(() => {
    if (!selectedId || !canvasRef.current) return;
    const el = canvasRef.current.querySelector(`[data-block-id="${selectedId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId]);


  // Fetch user plan for feature gating
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setIsLoggedIn(false); return; }
      setIsLoggedIn(true);
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      if (adminEmail && user.email === adminEmail) {
        setIsAdmin(true);
        setUserPlan('hp-bot-seo');
        setSubscriptionStatus('active');
        return;
      }
      supabase.from('profiles').select('plan, subscription_status, brand_logo_url').eq('id', user.id).single().then(({ data }: { data: { plan: string | null; subscription_status: string; brand_logo_url?: string | null } | null }) => {
        if (data) {
          setUserPlan(data.plan);
          setSubscriptionStatus(data.subscription_status || 'inactive');
          if (data.brand_logo_url) setBrandLogoUrl(data.brand_logo_url);
        }
      });
    });
  }, []);

  // Keep siteRef in sync for undo/redo to read current state without stale closure
  useEffect(() => { siteRef.current = site; }, [site]);

  // Mark dirty when site changes (skip initial mount)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setIsDirty(true);
  }, [site]);

  // Auto-save to server every 30s when dirty and siteId exists
  useEffect(() => {
    if (!isDirty || !dbSiteId) return;
    const timer = setTimeout(async () => {
      const s = siteRef.current;
      await fetch(`/api/sites/${dbSiteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: s.siteName,
          blocks_json: { v: 2, pages: s.pages },
          seo_json: s.pages[0]?.seo || emptySeo,
          settings_json: { colorScheme: s.colorScheme, designStyle: s.designStyle, larubot: s.larubot, laruseo: s.laruseo, notifyEmail: s.notifyEmail, gaTrackingId: s.gaTrackingId, larubotPublicId: s.larubotPublicId, laruseoPublicId: s.laruseoPublicId, customCss: s.customCss, fontFamily: s.fontFamily, accentColor: s.accentColor, heroLayout: s.heroLayout, headerStyle: s.headerStyle, animLevel: s.animLevel, customPalette: s.customPalette, lineNotifyToken: s.lineNotifyToken, clarityId: s.clarityId, webhookUrl: s.webhookUrl, sitePassword: s.sitePassword },
        }),
      });
      localStorage.setItem('laruHP_builder', JSON.stringify(s));
      setIsDirty(false);
      setLastSavedAt(new Date());
    }, 30000);
    return () => clearTimeout(timer);
  }, [isDirty, dbSiteId]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const pushHistory = useCallback((snapshot: SiteData) => {
    undoStack.current = [...undoStack.current, structuredClone(snapshot)].slice(-50);
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (!undoStack.current.length) return;
    const past = undoStack.current.pop()!;
    redoStack.current.push(structuredClone(siteRef.current));
    setSite(past);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    if (!redoStack.current.length) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(structuredClone(siteRef.current));
    setSite(next);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const handleUrlImport = useCallback((extracted: Record<string, unknown>) => {
    setSite(prev => {
      const updated = structuredClone(prev);
      if (extracted.businessName) updated.siteName = extracted.businessName as string;
      const firstPage = updated.pages[0];
      if (firstPage) {
        firstPage.blocks = firstPage.blocks.map((b) => {
          if (b.type === 'hero') {
            return {
              ...b, data: {
                ...b.data,
                ...(extracted.catchphrase ? { title: extracted.catchphrase } : {}),
                ...(extracted.description ? { subtitle: extracted.description } : {}),
              }
            };
          }
          if (b.type === 'contact') {
            return {
              ...b, data: {
                ...b.data,
                ...(extracted.phone ? { phone: extracted.phone } : {}),
                ...(extracted.address ? { address: extracted.address } : {}),
                ...(extracted.email ? { email: extracted.email } : {}),
              }
            };
          }
          if (b.type === 'hours' && Array.isArray(extracted.hours) && (extracted.hours as unknown[]).length > 0) {
            return { ...b, data: { ...b.data, hours: extracted.hours } };
          }
          return b;
        });
      }
      return updated;
    });
  }, []);

  const deleteSelectedBlocks = useCallback(() => {
    if (selectedIds.size === 0) return;
    pushHistory(siteRef.current);
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map(p =>
        p.id === currentPageId ? { ...p, blocks: p.blocks.filter(b => !selectedIds.has(b.id)) } : p
      ),
    }));
    setSelectedIds(new Set());
    setSelectedId(null);
  }, [selectedIds, currentPageId]);

  const moveSelectedBlocksUp = useCallback(() => {
    pushHistory(siteRef.current);
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map(p => {
        if (p.id !== currentPageId) return p;
        const blocks = [...p.blocks];
        const indices = blocks.reduce<number[]>((acc, b, i) => selectedIds.has(b.id) ? [...acc, i] : acc, []);
        if (!indices.length || indices[0] === 0) return p;
        for (const idx of indices) {
          [blocks[idx - 1], blocks[idx]] = [blocks[idx], blocks[idx - 1]];
        }
        return { ...p, blocks };
      }),
    }));
  }, [selectedIds, currentPageId]);

  const moveSelectedBlocksDown = useCallback(() => {
    pushHistory(siteRef.current);
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map(p => {
        if (p.id !== currentPageId) return p;
        const blocks = [...p.blocks];
        const indices = blocks.reduce<number[]>((acc, b, i) => selectedIds.has(b.id) ? [...acc, i] : acc, []);
        if (!indices.length || indices[indices.length - 1] === blocks.length - 1) return p;
        for (const idx of [...indices].reverse()) {
          [blocks[idx], blocks[idx + 1]] = [blocks[idx + 1], blocks[idx]];
        }
        return { ...p, blocks };
      }),
    }));
  }, [selectedIds, currentPageId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Save (Cmd/Ctrl+S)
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }
      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      // Copy selected block
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedId) {
        const tag2 = (e.target as HTMLElement).tagName;
        const editable2 = (e.target as HTMLElement).isContentEditable;
        if (tag2 !== 'INPUT' && tag2 !== 'TEXTAREA' && !editable2) {
          const block = currentPage?.blocks.find(b => b.id === selectedId);
          if (block) {
            setCopiedBlock(structuredClone(block));
            setCopyToast(true);
            setTimeout(() => setCopyToast(false), 1500);
          }
          return;
        }
      }
      // Paste copied block after selected (or at end)
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && copiedBlock) {
        const tag3 = (e.target as HTMLElement).tagName;
        const editable3 = (e.target as HTMLElement).isContentEditable;
        if (tag3 !== 'INPUT' && tag3 !== 'TEXTAREA' && !editable3) {
          e.preventDefault();
          pushHistory(siteRef.current);
          const newBlock: Block = { ...structuredClone(copiedBlock), id: crypto.randomUUID() };
          setSite(prev => ({
            ...prev,
            pages: prev.pages.map(p => {
              if (p.id !== currentPageId) return p;
              const blocks = [...p.blocks];
              const idx = selectedId ? blocks.findIndex(b => b.id === selectedId) : blocks.length - 1;
              blocks.splice(idx + 1, 0, newBlock);
              return { ...p, blocks };
            }),
          }));
          setSelectedId(newBlock.id);
          return;
        }
      }
      // Skip when focus is inside an input / editable element
      const tag = (e.target as HTMLElement).tagName;
      const editable = (e.target as HTMLElement).isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) return;
      // Delete / Backspace → delete selected block(s)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          deleteSelectedBlocks();
          return;
        }
        if (selectedId) {
          e.preventDefault();
          deleteBlock(selectedId);
          return;
        }
      }
      // Escape → deselect
      if (e.key === 'Escape' && (selectedId || selectedIds.size > 0)) {
        e.preventDefault();
        setSelectedId(null);
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, selectedId, selectedIds, copiedBlock, currentPageId, deleteSelectedBlocks]);

  // Current page derived from site + currentPageId
  const currentPage = site.pages.find(p => p.id === currentPageId) || site.pages[0];

  // Load site from API or onboarding
  useEffect(() => {
    if (siteId) {
      fetch(`/api/sites/${siteId}`)
        .then(r => r.json())
        .then(({ site: s }) => {
          if (s) {
            const rawBlocks = s.blocks_json;
            let pages: Page[];
            if (Array.isArray(rawBlocks)) {
              pages = [{ id: 'page-main', name: 'トップページ', path: '/', blocks: rawBlocks, seo: { ...emptySeo, ...(s.seo_json || {}) } }];
            } else if (rawBlocks?.v === 2 && rawBlocks.pages) {
              pages = rawBlocks.pages;
            } else {
              pages = [{ id: 'page-main', name: 'トップページ', path: '/', blocks: [], seo: { ...emptySeo, ...(s.seo_json || {}) } }];
            }
            setSite({
              siteName: s.name,
              pages,
              colorScheme: s.settings_json?.colorScheme || 'professional-blue',
              designStyle: s.settings_json?.designStyle || 'modern',
              larubot: s.settings_json?.larubot ?? true,
              laruseo: s.settings_json?.laruseo ?? true,
              notifyEmail: s.settings_json?.notifyEmail || '',
              gaTrackingId: s.settings_json?.gaTrackingId || '',
              larubotPublicId: s.settings_json?.larubotPublicId || '',
              laruseoPublicId: s.settings_json?.laruseoPublicId || '',
              customCss: s.settings_json?.customCss || '',
              fontFamily: s.settings_json?.fontFamily || 'noto',
              accentColor: s.settings_json?.accentColor || '#f59e0b',
              heroLayout: s.settings_json?.heroLayout || 'center',
              headerStyle: s.settings_json?.headerStyle || 'transparent',
              animLevel: s.settings_json?.animLevel || 'full',
              globalFooter: s.settings_json?.globalFooter || defaultSiteData.globalFooter,
              customPalette: s.settings_json?.customPalette || [...DEFAULT_PALETTE],
              lineNotifyToken: s.settings_json?.lineNotifyToken || '',
              clarityId: s.settings_json?.clarityId || '',
              webhookUrl: s.settings_json?.webhookUrl || '',
              sitePassword: s.settings_json?.sitePassword || '',
            });
            setCurrentPageId(pages[0].id);
            setPublished(s.published);
            setPublishedSlug(s.slug);
            if (s.settings_json?.previewToken) setPreviewToken(s.settings_json.previewToken);
          }
        })
        .catch(() => {});
    } else if (fromOnboarding && typeof window !== 'undefined') {
      const raw = localStorage.getItem('laruHP_data');
      if (!raw) return;
      const d = JSON.parse(raw);
      setOnboardingData(d);

      const ai = d.aiGenerated || {};

      const template = getTemplateForIndustry(d.industry);
      let blocks: Block[];
      if (template) {
        blocks = applyTemplateData(template, {
          name: d.businessName,
          address: d.address,
          description: ai.aboutText || d.description,
          catchphrase: ai.heroSubheading || d.catchphrase,
          phone: d.phone,
          services: d.services || [],
          hours: d.hours || [],
        });

        // Override hero with AI-generated copy
        if (ai.heroHeading || ai.heroSubheading || ai.ctaText) {
          blocks = blocks.map(block => {
            if (block.type === 'hero') {
              return {
                ...block,
                data: {
                  ...block.data,
                  ...(ai.heroHeading && { heading: ai.heroHeading }),
                  ...(ai.heroSubheading && { subheading: ai.heroSubheading }),
                  ...(ai.ctaText && { ctaText: ai.ctaText }),
                },
              };
            }
            return block;
          });
        }

        // Apply primaryColor to hero / cta / booking / nav blocks
        if (d.primaryColor) {
          blocks = blocks.map(block => {
            if (block.type === 'hero') return { ...block, data: { ...block.data, bgColor: d.primaryColor } };
            if (block.type === 'cta')  return { ...block, data: { ...block.data, bgColor: d.primaryColor } };
            if (block.type === 'booking') return { ...block, data: { ...block.data, buttonColor: d.primaryColor } };
            if (block.type === 'nav')  return { ...block, data: { ...block.data, ctaColor: d.primaryColor } };
            return block;
          });
        }

        // Inject AI-generated FAQs into any faq block
        if (ai.faqs?.length) {
          blocks = blocks.map(block => {
            if (block.type === 'faq') {
              return { ...block, data: { ...block.data, items: ai.faqs } };
            }
            return block;
          });
        }

        // Inject AI-generated testimonials
        if (ai.testimonials?.length) {
          blocks = blocks.map(block => {
            if (block.type === 'testimonials') {
              return { ...block, data: { ...block.data, items: ai.testimonials } };
            }
            return block;
          });
        }

        // Inject AI-generated three-col strengths
        if (ai.threeColItems?.length) {
          blocks = blocks.map(block => {
            if (block.type === 'three-col') {
              const [c1, c2, c3] = ai.threeColItems;
              return {
                ...block, data: {
                  ...block.data,
                  ...(ai.threeColHeading && { heading: ai.threeColHeading }),
                  ...(c1 && { col1Icon: c1.icon, col1Title: c1.title, col1Text: c1.text }),
                  ...(c2 && { col2Icon: c2.icon, col2Title: c2.title, col2Text: c2.text }),
                  ...(c3 && { col3Icon: c3.icon, col3Title: c3.title, col3Text: c3.text }),
                },
              };
            }
            return block;
          });
        }
      } else {
        const heroBlock = defaultBlock('hero');
        heroBlock.data = {
          ...heroBlock.data,
          heading: ai.heroHeading || d.businessName || 'ここに見出しを入力',
          subheading: ai.heroSubheading || d.catchphrase || 'キャッチフレーズを入力してください',
          ...(d.primaryColor && { bgColor: d.primaryColor }),
        };
        blocks = [heroBlock, defaultBlock('services'), defaultBlock('contact')];
        if (d.larubot) blocks.push(defaultBlock('larubot'));
      }

      setSite({
        siteName: d.businessName || 'マイサイト',
        pages: [{
          id: 'page-main',
          name: 'トップページ',
          path: '/',
          blocks,
          seo: {
            title: ai.seoTitle || `${d.businessName || ''} | ${(d.address || '').split('都')[0]}`,
            description: ai.seoDescription || (ai.aboutText || d.description || '').slice(0, 160),
            keywords: ai.keywords || '',
            ogTitle: ai.heroHeading || d.businessName || '',
            ogDescription: ai.heroSubheading || d.catchphrase || '',
            ogImage: '',
          },
        }],
        colorScheme: d.colorScheme || 'professional-blue',
        designStyle: d.designStyle || 'modern',
        larubot: d.larubot ?? true,
        laruseo: d.laruseo ?? true,
        notifyEmail: d.email || '',
        gaTrackingId: '',
        larubotPublicId: '',
        laruseoPublicId: '',
        customCss: '',
        fontFamily: d.fontFamily || 'noto',
        accentColor: d.accentColor || '#f59e0b',
        heroLayout: d.heroLayout || 'center',
        headerStyle: d.headerStyle || 'transparent',
        animLevel: d.animLevel || 'full',
        globalFooter: defaultSiteData.globalFooter,
        customPalette: [...DEFAULT_PALETTE],
        lineNotifyToken: '',
        clarityId: '',
        webhookUrl: '',
        sitePassword: '',
      });
      // Auto-select hero image from Unsplash based on industry
      if (d.industry) {
        const industryQueryMap: Record<string, string> = {
          restaurant: 'restaurant interior japan', beauty: 'beauty salon interior',
          clinic: 'medical clinic professional', legal: 'law office professional',
          construction: 'construction building modern', realestate: 'real estate modern house',
          retail: 'retail store interior', fitness: 'gym fitness studio',
          hotel: 'hotel lobby luxury', education: 'classroom school modern',
          wedding: 'wedding ceremony elegant', pet: 'pet grooming salon',
          dental: 'dental clinic modern', photo: 'photography studio',
          accounting: 'office professional business', other: 'professional office',
        };
        const query = industryQueryMap[d.industry as string] || 'business professional';
        fetch(`/api/images/unsplash?q=${encodeURIComponent(query)}`)
          .then(r => r.json())
          .then(({ photos }) => {
            if (photos?.length) {
              const img = photos[Math.floor(Math.random() * Math.min(5, photos.length))];
              setSite(prev => ({
                ...prev,
                pages: prev.pages.map((page, pi) => pi === 0 ? {
                  ...page,
                  blocks: page.blocks.map(block =>
                    block.type === 'hero' && !(block.data.bgImage as string)
                      ? { ...block, data: { ...block.data, bgImage: img.url } }
                      : block
                  ),
                } : page),
              }));
            }
          })
          .catch(() => {});
      }
    } else {
      const savedStr = typeof window !== 'undefined' ? localStorage.getItem('laruHP_builder') : null;
      if (savedStr) {
        const parsed = JSON.parse(savedStr);
        if (parsed.pages) {
          setSite(parsed as SiteData);
          setCurrentPageId(parsed.pages[0]?.id || 'page-main');
        } else if (parsed.blocks) {
          setSite({
            siteName: parsed.siteName || 'マイサイト',
            pages: [{ id: 'page-main', name: 'トップページ', path: '/', blocks: parsed.blocks, seo: parsed.seo || emptySeo }],
            colorScheme: parsed.colorScheme || 'professional-blue',
            designStyle: parsed.designStyle || 'modern',
            larubot: parsed.larubot ?? true,
            laruseo: parsed.laruseo ?? true,
            notifyEmail: parsed.notifyEmail || '',
            gaTrackingId: parsed.gaTrackingId || '',
            larubotPublicId: parsed.larubotPublicId || '',
            laruseoPublicId: parsed.laruseoPublicId || '',
            customCss: parsed.customCss || '',
            fontFamily: parsed.fontFamily || 'noto',
            accentColor: parsed.accentColor || '#f59e0b',
            heroLayout: parsed.heroLayout || 'center',
            headerStyle: parsed.headerStyle || 'transparent',
            animLevel: parsed.animLevel || 'full',
            globalFooter: parsed.globalFooter || defaultSiteData.globalFooter,
            customPalette: parsed.customPalette || [...DEFAULT_PALETTE],
            lineNotifyToken: parsed.lineNotifyToken || '',
            clarityId: parsed.clarityId || '',
            webhookUrl: parsed.webhookUrl || '',
            sitePassword: parsed.sitePassword || '',
          });
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LocalStorage auto-save
  useEffect(() => {
    if (!siteId) localStorage.setItem('laruHP_builder', JSON.stringify(site));
  }, [site, siteId]);

  const selectedBlock = currentPage.blocks.find(b => b.id === selectedId) || null;

  // Block mutations always targeting current page
  const updateBlockData = useCallback((id: string, data: Record<string, unknown>) => {
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map(p => ({
        ...p,
        blocks: p.blocks.map(b => b.id === id ? { ...b, data } : b),
      })),
    }));
  }, []);

  const updateBlockMemo = useCallback((id: string, memo: string) => {
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map(p => ({
        ...p,
        blocks: p.blocks.map(b => b.id === id ? { ...b, memo } : b),
      })),
    }));
  }, []);

  const moveBlock = (id: string, dir: -1 | 1) => {
    pushHistory(siteRef.current);
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map(p => {
        if (p.id !== currentPageId) return p;
        const blocks = [...p.blocks];
        const i = blocks.findIndex(b => b.id === id);
        const ni = i + dir;
        if (ni < 0 || ni >= blocks.length) return p;
        [blocks[i], blocks[ni]] = [blocks[ni], blocks[i]];
        return { ...p, blocks };
      }),
    }));
  };

  const deleteBlock = (id: string) => {
    const currentPage = siteRef.current.pages.find(p => p.id === currentPageId);
    const blockIndex = currentPage?.blocks.findIndex(b => b.id === id) ?? -1;
    const blockToDelete = blockIndex >= 0 ? currentPage?.blocks[blockIndex] : undefined;
    pushHistory(siteRef.current);
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map(p =>
        p.id === currentPageId ? { ...p, blocks: p.blocks.filter(b => b.id !== id) } : p
      ),
    }));
    setSelectedId(null);
    if (blockToDelete && blockIndex >= 0) {
      if (deletedBlockUndoTimer[0]) clearTimeout(deletedBlockUndoTimer[0]);
      setDeletedBlockUndo({ block: blockToDelete, pageId: currentPageId, index: blockIndex });
      deletedBlockUndoTimer[0] = setTimeout(() => setDeletedBlockUndo(null), 4000);
    }
  };

  const undoBlockDelete = () => {
    if (!deletedBlockUndo) return;
    if (deletedBlockUndoTimer[0]) clearTimeout(deletedBlockUndoTimer[0]);
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map(p => {
        if (p.id !== deletedBlockUndo.pageId) return p;
        const blocks = [...p.blocks];
        blocks.splice(deletedBlockUndo.index, 0, deletedBlockUndo.block);
        return { ...p, blocks };
      }),
    }));
    setDeletedBlockUndo(null);
  };

  const duplicateBlock = (id: string) => {
    pushHistory(siteRef.current);
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map(p => {
        if (p.id !== currentPageId) return p;
        const blocks = [...p.blocks];
        const i = blocks.findIndex(b => b.id === id);
        const newBlock = { ...blocks[i], id: `block-${Date.now()}`, data: { ...blocks[i].data } };
        blocks.splice(i + 1, 0, newBlock);
        return { ...p, blocks };
      }),
    }));
  };

  const addBlock = (type: BlockType, afterId?: string) => {
    pushHistory(siteRef.current);
    setRecentBlocks(prev => {
      const next = [type, ...prev.filter(t => t !== type)].slice(0, 3);
      localStorage.setItem('laruHP_builder_recent_blocks', JSON.stringify(next));
      return next;
    });
    const block = defaultBlock(type);
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map(p => {
        if (p.id !== currentPageId) return p;
        const blocks = [...p.blocks];
        if (afterId) {
          const i = blocks.findIndex(b => b.id === afterId);
          blocks.splice(i + 1, 0, block);
        } else {
          blocks.push(block);
        }
        return { ...p, blocks };
      }),
    }));
    setSelectedId(block.id);
  };

  // Page management
  const addPage = () => {
    const newPage: Page = {
      id: `page-${Date.now()}`,
      name: `ページ${site.pages.length + 1}`,
      path: `/page-${site.pages.length + 1}`,
      blocks: [defaultBlock('hero'), defaultBlock('contact')],
      seo: emptySeo,
    };
    setSite(prev => ({ ...prev, pages: [...prev.pages, newPage] }));
    setCurrentPageId(newPage.id);
    setSelectedId(null);
  };

  const deletePage = (pageId: string) => {
    if (site.pages.length <= 1) return;
    const remaining = site.pages.filter(p => p.id !== pageId);
    setSite(prev => ({ ...prev, pages: remaining }));
    if (currentPageId === pageId) setCurrentPageId(remaining[0].id);
    setSelectedId(null);
  };

  const duplicatePage = (pageId: string) => {
    const original = site.pages.find(p => p.id === pageId);
    if (!original) return;
    const ts = Date.now();
    const newPage: Page = {
      id: `page-${ts}`,
      name: `${original.name} (コピー)`,
      path: `${original.path}-copy`,
      blocks: original.blocks.map(b => ({ ...b, id: `${b.id}-${ts}` })),
      seo: { ...original.seo },
    };
    setSite(prev => {
      const idx = prev.pages.findIndex(p => p.id === pageId);
      const pages = [...prev.pages];
      pages.splice(idx + 1, 0, newPage);
      return { ...prev, pages };
    });
    setCurrentPageId(newPage.id);
    setSelectedId(null);
  };

  const reorderBlocks = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    pushHistory(siteRef.current);
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map(p => {
        if (p.id !== currentPageId) return p;
        const blocks = [...p.blocks];
        const fromIdx = blocks.findIndex(b => b.id === fromId);
        const toIdx = blocks.findIndex(b => b.id === toId);
        if (fromIdx === -1 || toIdx === -1) return p;
        const [moved] = blocks.splice(fromIdx, 1);
        blocks.splice(toIdx, 0, moved);
        return { ...p, blocks };
      }),
    }));
  };

  const DESIGN_TEMPLATES = [
    // ── 既存 ──────────────────────────────────────────────────
    { id: 'business',   name: 'ビジネス',       desc: 'プロフェッショナルな印象',         colorScheme: 'professional-blue', designStyle: 'modern',   colors: ['#1e3a8a','#3b82f6'], blocks: ['hero','heading','paragraph','two-col','services','cta','contact'] },
    { id: 'warm',       name: 'ウォームカフェ', desc: '温かみのある飲食向け',             colorScheme: 'warm-earth',        designStyle: 'rounded',  colors: ['#92400e','#d97706'], blocks: ['hero','services','testimonials','hours','gallery','cta','contact'] },
    { id: 'elegant',    name: 'エレガント',     desc: '上品でラグジュアリー',             colorScheme: 'elegant-dark',      designStyle: 'elegant',  colors: ['#1e1b4b','#7c3aed'], blocks: ['hero','heading','paragraph','three-col','testimonials','faq','cta'] },
    { id: 'fresh',      name: 'フレッシュ',     desc: 'クリーンな医療・健康系',           colorScheme: 'fresh-green',       designStyle: 'minimal',  colors: ['#064e3b','#10b981'], blocks: ['hero','three-col','services','faq','hours','map','contact'] },
    { id: 'pink',       name: 'モダンピンク',   desc: '美容・サロン向け',                 colorScheme: 'modern-pink',       designStyle: 'rounded',  colors: ['#831843','#ec4899'], blocks: ['hero','heading','paragraph','services','gallery','testimonials','booking','cta'] },
    { id: 'orange',     name: 'ボールド',       desc: 'エネルギッシュで力強い',           colorScheme: 'bold-orange',       designStyle: 'bold',     colors: ['#7c2d12','#f97316'], blocks: ['hero','three-col','services','testimonials','cta','contact'] },
    // ── 新規 ──────────────────────────────────────────────────
    { id: 'midnight',   name: 'ミッドナイト',   desc: '高級感あふれるダーク系',           colorScheme: 'midnight-gold',     designStyle: 'sharp',    colors: ['#0d1b2a','#d4a017'], blocks: ['hero','heading','paragraph','three-col','testimonials','price-table','cta','contact'] },
    { id: 'ocean',      name: 'オーシャン',     desc: '爽やかで信頼感のある水色',         colorScheme: 'ocean-teal',        designStyle: 'modern',   colors: ['#0d4e5c','#14b8a6'], blocks: ['hero','three-col','services','gallery','testimonials','cta','contact'] },
    { id: 'lavender',   name: 'ラベンダー',     desc: 'やさしい紫。癒し・美容に',         colorScheme: 'lavender-night',    designStyle: 'elegant',  colors: ['#1e1b4b','#8b5cf6'], blocks: ['hero','heading','services','gallery','testimonials','booking','contact'] },
    { id: 'terracotta', name: 'テラコッタ',     desc: '土感のある温かみ。飲食・雑貨に',   colorScheme: 'terracotta',        designStyle: 'elegant',  colors: ['#8b3a2a','#d4856a'], blocks: ['hero','heading','paragraph','services','gallery','hours','contact'] },
    { id: 'cyber',      name: 'サイバー',       desc: 'ダーク×ネオン。IT・ゲームに',      colorScheme: 'cyber-neon',        designStyle: 'bold',     colors: ['#050505','#00e676'], blocks: ['hero','three-col','services','price-table','faq','cta','contact'] },
    { id: 'rosegold',   name: 'ローズゴールド', desc: '洗練されたブライダル・美容向け',   colorScheme: 'rose-gold',         designStyle: 'elegant',  colors: ['#6b2f41','#d4846a'], blocks: ['hero','heading','paragraph','gallery','services','testimonials','booking','contact'] },
    { id: 'mono',       name: 'モノクロ',       desc: 'シンプル＆ミニマル。全業種対応',   colorScheme: 'monochrome',        designStyle: 'minimal',  colors: ['#111111','#e0e0e0'], blocks: ['hero','heading','paragraph','services','cta','contact'] },
    { id: 'sky',        name: 'スカイブルー',   desc: '明るくクリーン。医療・教育に',     colorScheme: 'sky-clear',         designStyle: 'minimal',  colors: ['#1565c0','#90caf9'], blocks: ['hero','three-col','services','hours','faq','map','contact'] },
    { id: 'sunset',     name: 'サンセット',     desc: 'クリエイティブ向け紫×オレンジ',   colorScheme: 'sunset-dusk',       designStyle: 'bold',     colors: ['#2d1b54','#f97316'], blocks: ['hero','heading','paragraph','gallery','services','testimonials','cta'] },
    { id: 'crimson',    name: 'クリムゾン',     desc: '情熱的な赤。飲食・スポーツに',     colorScheme: 'deep-crimson',      designStyle: 'bold',     colors: ['#7f1d1d','#ef4444'], blocks: ['hero','three-col','services','testimonials','cta','hours','contact'] },
    { id: 'sage',       name: 'セージグリーン', desc: 'ナチュラル×モダン。ヘルス系に',   colorScheme: 'sage-forest',       designStyle: 'rounded',  colors: ['#1a3528','#6db97c'], blocks: ['hero','heading','paragraph','three-col','services','faq','contact'] },
    { id: 'navygold',   name: 'ネイビーゴールド', desc: '高品格。士業・コンサル向け',    colorScheme: 'navy-gold',         designStyle: 'sharp',    colors: ['#0f172a','#eab308'], blocks: ['hero','heading','services','cta','faq','hours','contact'] },
    { id: 'minimal',    name: 'ミニマル LP',    desc: 'シンプルな集客LP。離脱率↓',       colorScheme: 'elegant-dark',      designStyle: 'minimal',  colors: ['#111827','#6b7280'], blocks: ['hero','three-col','testimonials','faq','cta'] },
    { id: 'portfolio',  name: 'ポートフォリオ', desc: '作品・実績を前面に出す',           colorScheme: 'midnight-gold',     designStyle: 'minimal',  colors: ['#0d1b2a','#d4a017'], blocks: ['hero','gallery','services','two-col','contact'] },
    { id: 'fullmenu',   name: 'フルセット',     desc: '全ブロック入りの完全構成',         colorScheme: 'professional-blue', designStyle: 'modern',   colors: ['#1e3a8a','#3b82f6'], blocks: ['hero','heading','three-col','services','gallery','testimonials','price-table','faq','hours','map','booking','cta','contact'] },
  ] as const;

  const applyTemplate = (templateId: string) => {
    const tpl = DESIGN_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    pushHistory(siteRef.current);
    const cs = COLOR_SCHEMES.find(c => c.id === tpl.colorScheme);
    const newBlocks = (tpl.blocks as unknown as BlockType[]).map(type => {
      const b = defaultBlock(type);
      if (cs && type === 'hero') return { ...b, data: { ...b.data, bgColor: cs.colors[0] } };
      if (cs && type === 'cta') return { ...b, data: { ...b.data, bgColor: cs.colors[0] } };
      return b;
    });
    setSite(prev => ({
      ...prev,
      colorScheme: tpl.colorScheme,
      designStyle: tpl.designStyle,
      pages: prev.pages.map((p, i) => i === 0 ? { ...p, blocks: newBlocks } : p),
    }));
    setShowTemplateModal(false);
    setSelectedId(null);
  };

  const saveSnippet = (blocks: Block[], name: string) => {
    const snippet = { id: crypto.randomUUID(), name, blocks };
    const next = [...snippets, snippet];
    setSnippets(next);
    localStorage.setItem('laruHP_snippets', JSON.stringify(next));
  };
  const deleteSnippet = (id: string) => {
    const next = snippets.filter(s => s.id !== id);
    setSnippets(next);
    localStorage.setItem('laruHP_snippets', JSON.stringify(next));
  };
  const insertSnippet = (snippet: { id: string; name: string; blocks: Block[] }) => {
    const newBlocks = snippet.blocks.map(b => ({ ...b, id: crypto.randomUUID() }));
    setSite(prev => {
      const pages = prev.pages.map(p => {
        if (p.id !== currentPageId) return p;
        const idx = selectedId ? p.blocks.findIndex(b => b.id === selectedId) + 1 : p.blocks.length;
        const next = [...p.blocks];
        next.splice(idx, 0, ...newBlocks);
        return { ...p, blocks: next };
      });
      return { ...prev, pages };
    });
  };

  const handlePageSpeed = async () => {
    if (!dbSiteId) return;
    setPageSpeedLoading(true);
    setPageSpeedData(null);
    setShowPageSpeed(true);
    const res = await fetch(`/api/sites/${dbSiteId}/pagespeed`);
    const data = await res.json();
    setPageSpeedData(res.ok ? data : null);
    setPageSpeedLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false as string | false);
    const payload = {
      name: site.siteName,
      blocks_json: { v: 2, pages: site.pages },
      seo_json: site.pages[0]?.seo || emptySeo,
      settings_json: { colorScheme: site.colorScheme, designStyle: site.designStyle, larubot: site.larubot, laruseo: site.laruseo, notifyEmail: site.notifyEmail, gaTrackingId: site.gaTrackingId, larubotPublicId: site.larubotPublicId, laruseoPublicId: site.laruseoPublicId, customCss: site.customCss, fontFamily: site.fontFamily, accentColor: site.accentColor, heroLayout: site.heroLayout, headerStyle: site.headerStyle, animLevel: site.animLevel, globalFooter: site.globalFooter, customPalette: site.customPalette, lineNotifyToken: site.lineNotifyToken, clarityId: site.clarityId, webhookUrl: site.webhookUrl },
    };
    try {
      if (dbSiteId) {
        const res = await fetch(`/api/sites/${dbSiteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `保存エラー (${res.status})`); }
      } else {
        const res = await fetch('/api/sites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, industry: onboardingData?.industry }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `保存エラー (${res.status})`); }
        const { site: s } = await res.json();
        if (s?.id) setDbSiteId(s.id);
      }
      localStorage.setItem('laruHP_builder', JSON.stringify(site));
      setIsDirty(false);
      setSaved(true);
      setLastSavedAt(new Date());
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '保存に失敗しました');
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    let id = dbSiteId;
    if (!id) {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: site.siteName,
          blocks_json: { v: 2, pages: site.pages },
          seo_json: site.pages[0]?.seo || emptySeo,
          settings_json: { colorScheme: site.colorScheme, designStyle: site.designStyle, larubot: site.larubot, laruseo: site.laruseo, notifyEmail: site.notifyEmail, gaTrackingId: site.gaTrackingId, larubotPublicId: site.larubotPublicId, laruseoPublicId: site.laruseoPublicId, customCss: site.customCss, fontFamily: site.fontFamily, accentColor: site.accentColor, heroLayout: site.heroLayout, headerStyle: site.headerStyle, animLevel: site.animLevel, globalFooter: site.globalFooter, customPalette: site.customPalette, lineNotifyToken: site.lineNotifyToken, clarityId: site.clarityId, webhookUrl: site.webhookUrl, sitePassword: site.sitePassword },
          industry: onboardingData?.industry,
        }),
      });
      // 未ログイン: 作業をローカル保存して登録へ誘導（サイレント失敗を防ぐ）
      if (res.status === 401) {
        try { localStorage.setItem('laruHP_builder', JSON.stringify(site)); } catch {}
        setPublishing(false);
        router.push('/laruHP/auth/signup?redirectTo=/laruHP/builder');
        return;
      }
      const { site: s } = await res.json().catch(() => ({ site: null }));
      id = s?.id;
      if (id) setDbSiteId(id);
    }
    if (!id) { setPublishing(false); setSaveError('公開の準備に失敗しました。通信環境を確認してもう一度お試しください。'); return; }

    const res = await fetch(`/api/sites/${id}/publish`, { method: 'POST' });
    if (res.status === 401) {
      try { localStorage.setItem('laruHP_builder', JSON.stringify(site)); } catch {}
      setPublishing(false);
      router.push('/laruHP/auth/signup?redirectTo=/laruHP/builder');
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.error === 'subscription_required') {
      setPublishing(false);
      setPendingSiteId(id);
      setShowPlanModal(true);
      return;
    }
    if (data.success) {
      setPublished(true);
      setPublishedSlug(data.slug);
      if (fromOnboarding) setShowPublishSuccess(true);
    } else {
      setSaveError(data.message || data.error || '公開に失敗しました。もう一度お試しください。');
    }
    setPublishing(false);
  };

  const handleOpenHistory = async () => {
    if (!dbSiteId) return;
    const res = await fetch(`/api/sites/${dbSiteId}/versions`);
    const data = await res.json();
    setVersions(data.versions || []);
    setShowHistoryPanel(true);
  };

  const handleRestoreVersion = (versionId: string) => {
    setRestoreConfirmVersionId(versionId);
  };

  const confirmRestoreVersion = async () => {
    if (!dbSiteId || !restoreConfirmVersionId) return;
    setRestoringVersion(restoreConfirmVersionId);
    const res = await fetch(`/api/sites/${dbSiteId}/versions/${restoreConfirmVersionId}`, { method: 'POST' });
    if (res.ok) window.location.reload();
    setRestoringVersion(null);
    setShowHistoryPanel(false);
    setRestoreConfirmVersionId(null);
  };

  const handleAiLayout = async () => {
    const d = onboardingData || JSON.parse(localStorage.getItem('laruHP_data') || '{}');
    if (!d.businessName) {
      setBuilderToast('オンボーディングでビジネス情報を入力してからAIレイアウトを使用してください');
      setTimeout(() => setBuilderToast(''), 4000);
      return;
    }
    setAiLayouting(true);
    try {
      const res = await fetch('/api/ai/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: d.industry,
          businessName: d.businessName,
          description: d.description,
          services: d.services,
          hasBooking: d.hasBooking,
          hasVideo: d.hasVideo,
          hasGallery: d.hasGallery,
        }),
      });
      const { layout, reasoning } = await res.json();
      if (!layout?.length) return;
      setAiLayoutProposal({ layout, reasoning });
    } finally {
      setAiLayouting(false);
    }
  };

  const handleApplyAiLayout = () => {
    if (!aiLayoutProposal) return;
    pushHistory(siteRef.current);
    const newBlocks = (aiLayoutProposal.layout as BlockType[]).map(t => defaultBlock(t));
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map(p =>
        p.id === currentPageId ? { ...p, blocks: newBlocks } : p
      ),
    }));
    setSelectedId(null);
    setAiLayoutProposal(null);
  };

  const handleAiGenerate = async () => {
    const d = onboardingData || JSON.parse(localStorage.getItem('laruHP_data') || '{}');
    if (!d.businessName) {
      setBuilderToast('オンボーディングでビジネス情報を入力してからAI生成を使用してください');
      setTimeout(() => setBuilderToast(''), 4000);
      return;
    }
    setAiGenerating(true);
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d),
    });
    const { generated } = await res.json();
    if (generated) {
      pushHistory(siteRef.current);
      setSite(prev => ({
        ...prev,
        colorScheme: generated.colorScheme || prev.colorScheme,
        pages: prev.pages.map(p => {
          if (p.id !== currentPageId) return p;
          return {
            ...p,
            seo: {
              ...p.seo,
              title: generated.seoTitle || p.seo.title,
              description: generated.seoDescription || p.seo.description,
              keywords: generated.keywords || p.seo.keywords,
            },
            blocks: p.blocks.map(b => {
              if (b.type === 'hero') return { ...b, data: { ...b.data, heading: generated.heroHeading || b.data.heading, subheading: generated.heroSubheading || b.data.subheading } };
              if (b.type === 'heading') return { ...b, data: { ...b.data, text: generated.aboutHeading || b.data.text } };
              if (b.type === 'paragraph') return { ...b, data: { ...b.data, text: generated.aboutText || b.data.text } };
              if (b.type === 'cta') return { ...b, data: { ...b.data, buttonText: generated.ctaText || b.data.buttonText } };
              return b;
            }),
          };
        }),
      }));
    }
    setAiGenerating(false);
  };

  const handleAiFullSite = async () => {
    const d = onboardingData || JSON.parse(localStorage.getItem('laruHP_data') || '{}');
    if (!d.businessName && !site.siteName) {
      setBuilderToast('ビジネス情報が不足しています。まずサイト名を設定してください');
      setTimeout(() => setBuilderToast(''), 3000);
      return;
    }
    if (!confirm('現在のブロックをすべて削除して AI で一括生成しますか？')) return;
    setAiGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: d.businessName || site.siteName,
          industry: d.industry || 'general',
          description: d.description || '',
          phone: d.phone || '',
          address: d.address || '',
          services: d.services || [],
          colorScheme: site.colorScheme,
        }),
      });
      const { data: gen } = await res.json();
      if (!gen) { setAiGenerating(false); return; }
      pushHistory(siteRef.current);
      const newBlocks: Block[] = [
        defaultBlock('nav'),
        { ...defaultBlock('hero'), data: { ...defaultBlock('hero').data, heading: gen.hero?.heading, subheading: gen.hero?.subheading, buttonText: gen.hero?.buttonText } },
        { ...defaultBlock('heading'), data: { ...defaultBlock('heading').data, text: gen.about?.heading } },
        { ...defaultBlock('paragraph'), data: { ...defaultBlock('paragraph').data, text: gen.about?.text } },
        gen.services?.length ? { ...defaultBlock('services'), data: { ...defaultBlock('services').data, heading: 'サービス一覧', items: gen.services } } : null,
        gen.faq?.length ? { ...defaultBlock('faq'), data: { ...defaultBlock('faq').data, heading: 'よくある質問', items: gen.faq } } : null,
        { ...defaultBlock('cta'), data: { ...defaultBlock('cta').data, heading: gen.cta?.heading, text: gen.cta?.text, buttonText: gen.cta?.buttonText } },
        defaultBlock('contact'),
      ].filter(Boolean) as Block[];
      setSite(prev => ({
        ...prev,
        pages: prev.pages.map(p => p.id === currentPageId ? { ...p, blocks: newBlocks } : p),
      }));
    } finally {
      setAiGenerating(false);
    }
  };

  // Subscription paywall — only lock logged-in users with inactive/canceled plans (not demo visitors)
  const isLocked = isLoggedIn === true && !isAdmin && (subscriptionStatus === 'canceled' || subscriptionStatus === 'inactive' || subscriptionStatus === 'past_due');

  if (isLocked) {
    return (
      <div className="h-screen bg-[#030712] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl mx-auto mb-6">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-3">
            {subscriptionStatus === 'past_due' ? 'お支払いの確認が必要です' : 'サブスクリプションが無効です'}
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            {subscriptionStatus === 'past_due'
              ? 'お支払い情報を更新してください。確認後すぐにアクセスが回復されます。'
              : 'LARU HP のプランに加入するとビルダーを利用できます。サイトのデータは保持されています。'}
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="/laruHP/plans"
              className="block bg-blue-500 hover:bg-blue-400 text-white font-bold py-3 px-8 rounded-xl transition-colors"
            >
              プランを確認する →
            </a>
            <a
              href="/laruHP/dashboard"
              className="block text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              ダッシュボードに戻る
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#030712] text-white overflow-hidden" style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh' }}>
      {/* Mobile not supported overlay */}
      <MobileOverlay />
      {/* First-time builder tour */}
      {showBuilderTour && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#0f172a] border border-white/10 rounded-3xl p-7 max-w-sm w-full shadow-2xl">
            <div className="text-2xl mb-3">✨</div>
            <h2 className="text-lg font-bold text-white mb-1">ビルダーへようこそ</h2>
            <p className="text-slate-400 text-sm mb-5">3つのコツを押さえるだけで、プロ品質のHPが作れます。</p>
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3">
                <span className="text-sky-400 font-bold text-sm flex-shrink-0 mt-0.5">1</span>
                <div>
                  <div className="text-white text-sm font-semibold mb-0.5">左パネルからブロックを追加</div>
                  <p className="text-slate-500 text-xs">ヒーロー・サービス・お問い合わせなど目的別のブロックをドラッグして並べます。</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3">
                <span className="text-sky-400 font-bold text-sm flex-shrink-0 mt-0.5">2</span>
                <div>
                  <div className="text-white text-sm font-semibold mb-0.5">キャンバスをクリックして編集</div>
                  <p className="text-slate-500 text-xs">テキストや画像はキャンバス上で直接クリックして編集できます。</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3">
                <span className="text-sky-400 font-bold text-sm flex-shrink-0 mt-0.5">3</span>
                <div>
                  <div className="text-white text-sm font-semibold mb-0.5">右上の「公開」で即時反映</div>
                  <p className="text-slate-500 text-xs">保存は自動。完成したら「公開」ボタンを押すと世界中からアクセスできます。</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.setItem('laruHP_builder_tour_done', '1');
                setShowBuilderTour(false);
              }}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm py-3 rounded-xl transition-all"
            >
              はじめる
            </button>
          </div>
        </div>
      )}

      {/* Builder toast notification */}
      {builderToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 bg-[#1e293b] border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-sm text-slate-200">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 flex-shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          {builderToast}
        </div>
      )}

      {/* Block delete undo toast */}
      {deletedBlockUndo && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[61] flex items-center gap-3 bg-gray-900 border border-gray-700 px-4 py-3 rounded-xl shadow-2xl">
          <span className="text-gray-300 text-sm">ブロックを削除しました</span>
          <button
            onClick={undoBlockDelete}
            className="text-sky-400 text-sm font-bold hover:text-sky-300 transition-colors"
          >
            元に戻す
          </button>
        </div>
      )}

      {/* First publish success modal (onboarding flow) */}
      {copyToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#1e293b] border border-white/15 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl pointer-events-none animate-fadeIn">
          📋 ブロックをコピーしました — {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'}+V で貼り付け
        </div>
      )}

      {contextMenu && !preview && (() => {
        const block = currentPage?.blocks.find(b => b.id === contextMenu.blockId);
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
            <div
              className="fixed z-50 bg-[#1e293b] border border-white/15 rounded-xl shadow-2xl py-1 min-w-[160px] text-sm"
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
              <button className="w-full text-left px-4 py-2 text-slate-300 hover:bg-white/[0.07] flex items-center gap-2" onClick={() => {
                if (block) { setCopiedBlock(structuredClone(block)); setCopyToast(true); setTimeout(() => setCopyToast(false), 1500); }
                setContextMenu(null);
              }}>📋 コピー</button>
              <button className="w-full text-left px-4 py-2 text-slate-300 hover:bg-white/[0.07] flex items-center gap-2" onClick={() => {
                duplicateBlock(contextMenu.blockId); setContextMenu(null);
              }}>⧉ 複製</button>
              <button className="w-full text-left px-4 py-2 text-slate-300 hover:bg-white/[0.07] flex items-center gap-2" onClick={() => {
                setSelectedId(contextMenu.blockId); setContextMenu(null);
              }}>⚙ 設定</button>
              <div className="border-t border-white/[0.07] my-1" />
              <button className="w-full text-left px-4 py-2 text-red-400 hover:bg-red-500/10 flex items-center gap-2" onClick={() => {
                deleteBlock(contextMenu.blockId); setContextMenu(null);
              }}>🗑 削除</button>
            </div>
          </>
        );
      })()}

      {showPublishSuccess && publishedSlug && (() => {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
        const siteUrl = `${appUrl}/hp/${publishedSlug}`;
        const siteName = site.siteName || 'マイサイト';
        const tweetText = encodeURIComponent(`「${siteName}」のホームページを公開しました！\n\nAI搭載HPビルダー「LARU HP」で5分で作れます 🚀\n\n👉 ${siteUrl}\n\n#LARUHP #ホームページ作成`);
        const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
        const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(`「${siteName}」のホームページを公開しました！ ${siteUrl}`)}`;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="bg-[#0f172a] border border-white/10 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
              <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl">
                🎉
              </div>
              <h2 className="text-2xl font-bold mb-2">サイトが公開されました！</h2>
              <p className="text-slate-400 text-sm mb-5">
                AIが生成したサイトを確認して、続きはダッシュボードで管理できます。
              </p>
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:text-white transition-all mb-5"
              >
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                {publishedSlug}.laruvisona.jp で公開中
              </a>

              {/* SNS Share */}
              <div className="mb-5">
                <p className="text-slate-500 text-xs mb-3">公開を報告しよう 🎊</p>
                <div className="flex gap-2 justify-center">
                  <a
                    href={tweetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-black border border-white/10 hover:border-white/30 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    X でシェア
                  </a>
                  <a
                    href={lineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.070 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                    LINE でシェア
                  </a>
                  <button
                    onClick={() => { navigator.clipboard.writeText(siteUrl); }}
                    className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    URLコピー
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <a
                  href="/laruHP/dashboard"
                  className="block bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm"
                >
                  ダッシュボードへ →
                </a>
                <button
                  onClick={() => setShowPublishSuccess(false)}
                  className="text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors"
                >
                  このまま編集を続ける
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Leave confirmation modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-xl">⚠️</div>
            <h2 className="text-white font-bold mb-2">保存されていない変更があります</h2>
            <p className="text-slate-400 text-sm mb-5">このまま移動すると変更が失われます。保存してから移動しますか？</p>
            <div className="flex gap-2">
              <button onClick={() => setShowLeaveConfirm(false)} className="flex-1 text-sm text-slate-400 hover:text-slate-200 border border-white/10 py-2.5 rounded-lg transition-colors">
                キャンセル
              </button>
              <button onClick={() => { setShowLeaveConfirm(false); router.push('/laruHP/dashboard'); }} className="flex-1 text-sm text-red-400 hover:text-red-300 border border-red-500/20 py-2.5 rounded-lg transition-colors">
                保存せず移動
              </button>
              <button onClick={async () => { await handleSave(); setShowLeaveConfirm(false); router.push('/laruHP/dashboard'); }} className="flex-1 text-sm bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg transition-all">
                保存して移動
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f172a] border-b border-white/10 flex-shrink-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => isDirty ? setShowLeaveConfirm(true) : router.push('/laruHP/dashboard')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors flex-shrink-0 group focus:outline-none focus:ring-1 focus:ring-sky-400/60 rounded"
            title="ダッシュボードへ戻る"
            aria-label="ダッシュボードへ戻る"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-0.5 transition-transform"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            {brandLogoUrl ? (
              <img src={brandLogoUrl} alt="logo" className="h-7 w-auto max-w-[120px] object-contain rounded" />
            ) : (
              <>
                <Image src="/laruhp_logo.png" alt="LARU HP" height={28} width={160} className="h-7 w-auto brightness-0 invert" />
              </>
            )}
          </button>
          <span className="text-slate-700">/</span>
          <div className="flex items-center gap-1 group/sitename">
            <input
              type="text"
              value={site.siteName}
              onChange={e => setSite(prev => ({ ...prev, siteName: e.target.value }))}
              className="bg-transparent border-b border-transparent hover:border-white/30 focus:border-blue-500 text-sm font-bold outline-none transition-colors px-1 py-0.5 w-28 flex-shrink-0"
              title="クリックでサイト名を編集"
            />
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700 group-hover/sitename:text-slate-400 transition-colors flex-shrink-0 pointer-events-none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>

          {/* Page Tabs */}
          <div className="hidden sm:flex items-center gap-0.5 ml-1 overflow-x-auto max-w-[240px]" style={{ scrollbarWidth: 'none' }}>
            {site.pages.map(page => (
              <div key={page.id} className="flex items-center flex-shrink-0 group/tab">
                {renamingPageId === page.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => {
                      if (renameValue.trim()) {
                        setSite(prev => ({ ...prev, pages: prev.pages.map(p => p.id === page.id ? { ...p, name: renameValue.trim() } : p) }));
                      }
                      setRenamingPageId(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') { setRenamingPageId(null); }
                    }}
                    className="w-20 px-2 py-0.5 text-[11px] bg-[#0f172a] border border-blue-500 rounded-lg text-white outline-none"
                  />
                ) : (
                  <button
                    onClick={() => { setCurrentPageId(page.id); setSelectedId(null); }}
                    onDoubleClick={() => { setRenamingPageId(page.id); setRenameValue(page.name); }}
                    title="ダブルクリックで名前変更"
                    className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all whitespace-nowrap ${currentPageId === page.id ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                  >
                    {page.name}
                  </button>
                )}
                <button
                  onClick={() => duplicatePage(page.id)}
                  title="このページを複製"
                  className="opacity-0 group-hover/tab:opacity-100 text-slate-600 hover:text-sky-400 w-4 h-4 text-[10px] flex items-center justify-center transition-all ml-0.5"
                >
                  ⧉
                </button>
                {site.pages.length > 1 && (
                  deletePageConfirmId === page.id ? (
                    <div className="flex items-center gap-0.5 ml-0.5">
                      <button
                        onClick={() => { deletePage(page.id); setDeletePageConfirmId(null); }}
                        className="text-red-400 hover:text-red-300 text-[10px] font-bold px-1 leading-none"
                        title="削除を確定"
                      >削除</button>
                      <button
                        onClick={() => setDeletePageConfirmId(null)}
                        className="text-slate-500 hover:text-slate-300 text-[10px] px-1 leading-none"
                        title="キャンセル"
                      >取消</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletePageConfirmId(page.id)}
                      className="opacity-0 group-hover/tab:opacity-100 text-slate-600 hover:text-red-400 w-4 h-4 text-[11px] flex items-center justify-center transition-all ml-0.5"
                      aria-label={`${page.name}ページを削除`}
                    >
                      ×
                    </button>
                  )
                )}
              </div>
            ))}
            <button
              onClick={addPage}
              className="flex-shrink-0 px-2 py-1 text-[11px] rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
            >
              +
            </button>
          </div>

          {published && publishedSlug && (
            <a href={`/hp/${publishedSlug}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 border border-green-500/30 px-2 py-1 rounded-lg flex-shrink-0">
              🟢 公開中
            </a>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="元に戻す (Cmd+Z)"
              aria-label="元に戻す"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm focus:outline-none focus:ring-1 focus:ring-sky-400/60"
            >↩</button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="やり直す (Cmd+Shift+Z)"
              aria-label="やり直す"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm focus:outline-none focus:ring-1 focus:ring-sky-400/60"
            >↪</button>
          </div>
          {dbSiteId && (
            <button
              onClick={handleOpenHistory}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10"
            >
              履歴
            </button>
          )}
          <button
            onClick={() => setShowTemplateModal(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white/10 text-slate-300 hover:bg-white/20 border border-white/10"
          >
            テンプレート
          </button>
          <button
            onClick={() => setShowAiChat(v => !v)}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${showAiChat ? 'bg-blue-500/30 text-blue-200 border-blue-500/40' : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border-blue-500/30'}`}
            title="AIアシスタントでテキストやレイアウトを自然言語で編集"
          >
            ✨ AIチャット
          </button>
          <button
            onClick={() => setShowUrlImport(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30"
            title="既存サイトURLを入力して情報を自動取り込み"
          >
            🔗 URLインポート
          </button>
          <button
            onClick={handleAiLayout}
            disabled={aiLayouting}
            title={aiLayouting ? 'AIがレイアウトを提案中です…' : 'AIが最適なブロック構成を提案します'}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 disabled:opacity-50 disabled:cursor-wait"
          >
            {aiLayouting ? '提案中...' : 'AIレイアウト'}
          </button>
          <button
            onClick={handleAiGenerate}
            disabled={aiGenerating}
            title={aiGenerating ? 'AIがコンテンツを生成中です…' : 'AIが各ブロックのテキストを自動生成します'}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 disabled:opacity-50 disabled:cursor-wait"
          >
            {aiGenerating ? '生成中...' : 'AI生成'}
          </button>
          <button
            onClick={handleAiFullSite}
            disabled={aiGenerating}
            title="全ブロックを AI で一括生成（既存ブロックは削除されます）"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 disabled:opacity-50 disabled:cursor-wait"
          >
            {aiGenerating ? '生成中...' : '✨ AI一括'}
          </button>
          {preview && (
            <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 border border-white/10">
              <button onClick={() => setPreviewDevice('desktop')} title="デスクトップ" aria-label="デスクトップ表示"
                className={`px-2 py-1.5 rounded transition-all focus:outline-none focus:ring-1 focus:ring-sky-400/60 ${previewDevice === 'desktop' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                </svg>
              </button>
              <button onClick={() => setPreviewDevice('tablet')} title="タブレット" aria-label="タブレット表示"
                className={`px-2 py-1.5 rounded transition-all focus:outline-none focus:ring-1 focus:ring-sky-400/60 ${previewDevice === 'tablet' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
              </button>
              <button onClick={() => setPreviewDevice('mobile')} title="スマートフォン" aria-label="スマートフォン表示"
                className={`px-2 py-1.5 rounded transition-all focus:outline-none focus:ring-1 focus:ring-sky-400/60 ${previewDevice === 'mobile' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
              </button>
            </div>
          )}
          <button
            onClick={() => setPreview(!preview)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${preview ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
          >
            {preview ? '編集' : 'プレビュー'}
          </button>
          {dbSiteId && (
            <button
              onClick={() => setShowPreviewLink(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white/10 text-slate-300 hover:bg-white/20 focus:outline-none focus:ring-1 focus:ring-sky-400/60"
              title="閲覧専用プレビューリンクを発行"
              aria-label="閲覧専用プレビューリンクを発行"
            >
              🔗
            </button>
          )}
          {saveError && (
            <span className="text-red-400 text-[10px] font-bold flex-shrink-0" title={typeof saveError === 'string' ? saveError : undefined}>⚠ {typeof saveError === 'string' ? saveError : '保存失敗'}</span>
          )}
          {lastSavedAt && !isDirty && !saved && !saveError && (
            <span className="hidden sm:flex items-center gap-1 text-slate-600 text-[10px] whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_#4ade80] animate-pulse" />
              {lastSavedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} に保存
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-sky-400/60 ${saved ? 'bg-green-500 text-white' : isDirty ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
          >
            {isDirty && !saving && !saved && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
            {saving ? '保存中...' : saved ? '保存済み ✓' : isDirty ? '未保存' : '保存'}
          </button>
          {published && dbSiteId && (
            <button
              onClick={handlePageSpeed}
              title="サイト速度チェック"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-all text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400/60"
            >
              ⚡ 速度
            </button>
          )}
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            {publishing ? '公開中...' : published ? '再公開' : '公開する'}
          </button>
        </div>
      </div>

      <div className="flex overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left Panel - Block Palette (desktop) */}
        {!preview && (
          <div data-lenis-prevent-wheel className="hidden sm:block w-44 bg-[#0f172a] border-r border-white/10 overflow-y-auto flex-shrink-0 min-h-0">
            <div className="p-3">
              {/* Palette search */}
              <div className="mb-3">
                <input
                  type="text"
                  value={paletteSearch}
                  onChange={e => setPaletteSearch(e.target.value)}
                  placeholder="ブロック検索..."
                  className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30"
                />
              </div>
              {/* Saved snippets */}
              {snippets.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">保存済みセクション</div>
                  <div className="space-y-1">
                    {snippets.map(s => (
                      <div key={s.id} className="flex items-center gap-1">
                        <button
                          onClick={() => insertSnippet(s)}
                          className="flex-1 text-left px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all truncate"
                          title={s.name}
                        >
                          📌 {s.name}
                        </button>
                        <button onClick={() => deleteSnippet(s.id)} className="text-slate-600 hover:text-red-400 text-xs px-1">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Save selected block as snippet */}
              {selectedId && (
                <div className="mb-3">
                  <button
                    onClick={() => {
                      const block = currentPage.blocks.find(b => b.id === selectedId);
                      if (!block) return;
                      const name = prompt('スニペット名を入力してください', block.type) || block.type;
                      saveSnippet([block], name);
                    }}
                    className="w-full text-[10px] text-slate-500 hover:text-slate-300 border border-dashed border-white/10 hover:border-white/20 rounded-lg py-1.5 px-2 transition-all text-left"
                  >
                    📎 このブロックをスニペット保存
                  </button>
                </div>
              )}
              {recentBlocks.length > 0 && (() => {
                const allItems = BLOCK_PALETTE.flatMap(g => g.items);
                return (
                  <div className="mb-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">最近追加</div>
                    <div className="space-y-1">
                      {recentBlocks.map(type => {
                        const item = allItems.find(i => i.type === type);
                        if (!item) return null;
                        return (
                          <button
                            key={type}
                            onClick={() => addBlock(type, selectedId || undefined)}
                            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all text-left"
                          >
                            <span className="text-base leading-none">{item.icon}</span>
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {BLOCK_PALETTE.map(group => {
                const filteredItems = paletteSearch
                  ? group.items.filter(item => item.label.toLowerCase().includes(paletteSearch.toLowerCase()) || item.type.toLowerCase().includes(paletteSearch.toLowerCase()))
                  : group.items;
                if (filteredItems.length === 0) return null;
                return (
                <div key={group.group} className="mb-4">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">{group.group}</div>
                  <div className="space-y-1">
                    {filteredItems.map(item => (
                      <button
                        key={item.type}
                        onClick={() => addBlock(item.type, selectedId || undefined)}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all text-left"
                      >
                        <span className="text-base leading-none">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Mobile block palette sheet */}
        {!preview && showMobileBlocks && (
          <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileBlocks(false)}>
            <div className="bg-[#0f172a] border-t border-white/10 rounded-t-2xl max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <span className="text-xs font-bold text-white">ブロックを追加</span>
                <button onClick={() => setShowMobileBlocks(false)} aria-label="ブロックパレットを閉じる" className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
              </div>
              <div className="px-3 pb-6">
                {BLOCK_PALETTE.map(group => (
                  <div key={group.group} className="mb-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">{group.group}</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {group.items.map(item => (
                        <button
                          key={item.type}
                          onClick={() => { addBlock(item.type, selectedId || undefined); setShowMobileBlocks(false); }}
                          className="flex items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] text-slate-300 hover:text-white transition-all border border-white/5 hover:border-white/20"
                        >
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          ref={canvasRef}
          data-lenis-prevent-wheel
          className="builder-canvas bg-[#e8eaed]"
          style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain', scrollBehavior: 'smooth', scrollbarWidth: 'thin', scrollbarColor: '#94a3b8 transparent', position: 'relative' }}
        >
          {/* Inject design style CSS vars into canvas scope */}
          <style>{`.lhp-canvas-scope{${({
            modern:  '--lhp-r:16px;--lhp-btn-r:9999px;--lhp-img-r:12px',
            minimal: '--lhp-r:8px;--lhp-btn-r:8px;--lhp-img-r:4px',
            bold:    '--lhp-r:8px;--lhp-btn-r:8px;--lhp-img-r:8px',
            elegant: '--lhp-r:4px;--lhp-btn-r:4px;--lhp-img-r:0px',
            rounded: '--lhp-r:24px;--lhp-btn-r:9999px;--lhp-img-r:20px',
            sharp:   '--lhp-r:0px;--lhp-btn-r:0px;--lhp-img-r:0px',
          } as Record<string, string>)[site.designStyle] ?? '--lhp-r:16px;--lhp-btn-r:9999px;--lhp-img-r:12px'}}`}</style>
          {/* Design style indicator badge */}
          {!preview && (
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded-full pointer-events-none">
              <span className={`w-1.5 h-1.5 rounded-full ${
                site.designStyle === 'modern' ? 'bg-blue-400' :
                site.designStyle === 'minimal' ? 'bg-slate-400' :
                site.designStyle === 'bold' ? 'bg-orange-400' :
                site.designStyle === 'elegant' ? 'bg-purple-400' :
                site.designStyle === 'rounded' ? 'bg-green-400' :
                site.designStyle === 'sharp' ? 'bg-red-400' : 'bg-blue-400'
              }`} />
              <span className="text-[9px] text-slate-300 font-medium">
                {site.designStyle === 'modern' ? 'モダン' : site.designStyle === 'minimal' ? 'ミニマル' : site.designStyle === 'bold' ? 'ボールド' : site.designStyle === 'elegant' ? 'エレガント' : site.designStyle === 'rounded' ? 'ラウンド' : site.designStyle === 'sharp' ? 'シャープ' : site.designStyle}
              </span>
            </div>
          )}
          <div className={`${preview ? 'flex flex-col items-center py-8 px-6' : 'py-8 px-6'}`}>
            {/* Desktop browser chrome */}
            {preview && previewDevice === 'desktop' && (
              <div className="w-full max-w-5xl bg-[#e2e2e2] border border-b-0 border-gray-300 rounded-t-xl px-3 py-2 flex items-center gap-3">
                <div className="flex gap-1.5 shrink-0">
                  <div className="w-3 h-3 bg-red-400 rounded-full" />
                  <div className="w-3 h-3 bg-yellow-400 rounded-full" />
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                </div>
                <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 text-center max-w-xs mx-auto truncate">
                  {site.siteName || 'yoursite.laruHP.com'}
                </div>
              </div>
            )}
            {/* Tablet browser chrome */}
            {preview && previewDevice === 'tablet' && (
              <div className="w-[768px] bg-[#e2e2e2] border border-b-0 border-gray-300 rounded-t-xl px-3 py-2 flex items-center gap-3">
                <div className="flex gap-1.5 shrink-0">
                  <div className="w-2.5 h-2.5 bg-red-400 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                </div>
                <div className="flex-1 bg-white rounded-md px-3 py-0.5 text-xs text-gray-400 text-center truncate">
                  {site.siteName || 'yoursite.laruHP.com'}
                </div>
              </div>
            )}
            {/* Mobile phone top (notch) */}
            {preview && previewDevice === 'mobile' && (
              <div className="w-[390px] bg-gray-900 rounded-t-[2.5rem] border-x-[4px] border-t-[4px] border-gray-700 px-6 pt-3 pb-2 flex items-center">
                <span className="text-white/60 text-[10px] font-semibold flex-1">9:41</span>
                <div className="w-20 h-5 bg-black rounded-full" />
                <div className="flex-1 flex justify-end items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white" opacity="0.6"><path d="M1.5 8.5C5.5 4.5 18.5 4.5 22.5 8.5M5 12c2.5-2.5 12-2.5 14 0M8.5 15.5c1.5-1.5 7.5-1.5 7 0M12 19h.01"/></svg>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" opacity="0.6"><rect x="2" y="7" width="16" height="11" rx="2"/><path d="M22 11v4"/><path d="M6 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </div>
              </div>
            )}
            {/* ── Iframe-based preview (shows real exported HTML with all CSS effects) ── */}
            {preview && previewHtml && (
              <div className={`mx-auto overflow-hidden ${
                previewDevice === 'mobile' ? 'w-[390px] border-x-[4px] border-gray-700' :
                previewDevice === 'tablet' ? 'w-[768px] border border-t-0 border-gray-300 shadow-2xl' :
                'w-full max-w-5xl border border-t-0 border-gray-300 rounded-b-xl shadow-2xl'
              }`} style={{ height: previewDevice === 'mobile' ? '812px' : '80vh' }}>
                <iframe
                  srcDoc={previewHtml}
                  title="サイトプレビュー"
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full h-full border-0"
                  style={{ display: 'block' }}
                />
              </div>
            )}
            <div className={`bg-white mx-auto transition-all duration-300 ${preview
              ? 'hidden'
              : 'max-w-3xl rounded-2xl overflow-hidden shadow-[0_4px_40px_rgba(0,0,0,0.12)]'}`}>
              {currentPage.blocks.length === 0 && (
                <div className="h-64 flex items-center justify-center text-gray-400 text-center">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                    <div className="font-medium mb-4">左のパレットからブロックを追加してください</div>
                    <div className="flex flex-col gap-1 text-[11px] text-gray-400 items-start mx-auto w-fit">
                      <span><kbd className="bg-gray-100 border border-gray-200 rounded px-1 font-mono">Ctrl+Z</kbd> 元に戻す</span>
                      <span><kbd className="bg-gray-100 border border-gray-200 rounded px-1 font-mono">Ctrl+S</kbd> 保存</span>
                      <span><kbd className="bg-gray-100 border border-gray-200 rounded px-1 font-mono">Ctrl+C</kbd> ブロックをコピー</span>
                      <span><kbd className="bg-gray-100 border border-gray-200 rounded px-1 font-mono">Ctrl+V</kbd> 貼り付け</span>
                    </div>
                  </div>
                </div>
              )}
              {selectedIds.size > 1 && !preview && (
                <div className="sticky top-0 z-30 bg-orange-500 text-white text-xs px-4 py-2 flex items-center gap-3 shadow-lg">
                  <span className="font-bold">{selectedIds.size}個のブロックを選択中</span>
                  <button onClick={deleteSelectedBlocks} className="bg-red-600/50 hover:bg-red-600/70 px-2 py-0.5 rounded font-semibold">削除</button>
                  <button onClick={moveSelectedBlocksUp} className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded">↑ 上へ</button>
                  <button onClick={moveSelectedBlocksDown} className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded">↓ 下へ</button>
                  <button onClick={() => { setSelectedIds(new Set()); setSelectedId(null); }} className="ml-auto hover:bg-white/20 px-2 py-0.5 rounded">✕ 解除</button>
                </div>
              )}
              {currentPage.blocks.map((block, index) => (
                <div
                  key={block.id}
                  data-block-id={block.id}
                  className={`relative group transition-all duration-150 ${
                    !preview && dragOverId === block.id && draggedId !== block.id
                      ? 'border-t-[3px] border-blue-500 shadow-[0_-3px_0_0_#3b82f6]'
                      : ''
                  } ${!preview && draggedId === block.id ? 'scale-[0.98] shadow-xl' : ''}`}
                  draggable={!preview}
                  onDragStart={!preview ? (e) => {
                    setDraggedId(block.id);
                    e.dataTransfer.effectAllowed = 'move';
                  } : undefined}
                  onDragOver={!preview ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(block.id); } : undefined}
                  onDragLeave={!preview ? () => setDragOverId(null) : undefined}
                  onDrop={!preview ? (e) => {
                    e.preventDefault();
                    if (draggedId) reorderBlocks(draggedId, block.id);
                    setDraggedId(null);
                    setDragOverId(null);
                  } : undefined}
                  onDragEnd={!preview ? () => { setDraggedId(null); setDragOverId(null); } : undefined}
                  onContextMenu={!preview ? (e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, blockId: block.id }); setSelectedId(block.id); } : undefined}
                  style={!preview && draggedId === block.id ? { opacity: 0.45, cursor: 'grabbing' } : !preview ? { cursor: 'grab' } : undefined}
                >
                  <BlockCanvas
                    block={block}
                    selected={selectedId === block.id && !preview && selectedIds.size === 0}
                    multiSelected={!preview && selectedIds.has(block.id)}
                    onSelect={(e) => {
                      if (preview) return;
                      if (e.shiftKey) {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(block.id)) {
                            next.delete(block.id);
                          } else {
                            next.add(block.id);
                            if (selectedId) next.add(selectedId);
                          }
                          return next;
                        });
                        if (!selectedId) setSelectedId(block.id);
                      } else {
                        setSelectedId(block.id);
                        setSelectedIds(new Set());
                      }
                    }}
                    onDataChange={(data) => updateBlockData(block.id, data)}
                  />
                  {!preview && block.memo && (
                    <div className="absolute left-2 top-2 z-20 w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-sm shadow-yellow-400/50" title={`メモ: ${block.memo}`} />
                  )}
                  {!preview && (
                    <div className={`absolute right-2 flex flex-col gap-1 z-20 transition-opacity ${selectedId === block.id ? 'opacity-100 top-2' : 'opacity-0 group-hover:opacity-100 top-2'}`}>
                      <button onClick={() => moveBlock(block.id, -1)} disabled={index === 0} aria-label="ブロックを上へ移動"
                        className="w-6 h-6 bg-blue-500 text-white rounded text-xs flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-600">↑</button>
                      <button onClick={() => moveBlock(block.id, 1)} disabled={index === currentPage.blocks.length - 1} aria-label="ブロックを下へ移動"
                        className="w-6 h-6 bg-blue-500 text-white rounded text-xs flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-600">↓</button>
                      <button onClick={() => duplicateBlock(block.id)} aria-label="ブロックを複製"
                        className="w-6 h-6 bg-slate-600 text-white rounded text-xs flex items-center justify-center hover:bg-slate-500" title="複製">⧉</button>
                      <button onClick={() => { setCopiedBlock(structuredClone(block)); setCopyToast(true); setTimeout(() => setCopyToast(false), 1500); }} aria-label="ブロックをコピー"
                        className="w-6 h-6 bg-slate-700 text-white rounded text-xs flex items-center justify-center hover:bg-slate-600" title="コピー (Ctrl+C)">📋</button>
                      <button onClick={() => deleteBlock(block.id)} aria-label="ブロックを削除"
                        className="w-6 h-6 bg-red-500 text-white rounded text-xs flex items-center justify-center hover:bg-red-600">✕</button>
                    </div>
                  )}
                </div>
              ))}

              {/* Global footer preview */}
              {site.globalFooter?.enabled && (
                <div className="mt-0" style={{ backgroundColor: site.globalFooter.bgColor, color: site.globalFooter.textColor }}>
                  <div className="max-w-5xl mx-auto px-8 py-10">
                    <div className="flex flex-wrap gap-8 mb-6">
                      <div className="flex-1 min-w-[180px]">
                        <div className="font-black text-lg mb-1" style={{ color: '#ffffff' }}>{site.globalFooter.logo}</div>
                        {site.globalFooter.tagline && <div className="text-sm opacity-60">{site.globalFooter.tagline}</div>}
                      </div>
                      {site.globalFooter.links.length > 0 && (
                        <div className="flex flex-wrap gap-x-6 gap-y-2 items-start">
                          {site.globalFooter.links.map((l, i) => (
                            <span key={i} className="text-sm opacity-70 hover:opacity-100 cursor-pointer">{l.label}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="border-t border-white/10 pt-4 text-xs opacity-50">{site.globalFooter.copyright}</div>
                  </div>
                </div>
              )}

              {/* LARUbot preview */}
              {site.larubot && (
                <div className="fixed bottom-6 right-6 z-40">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-sm font-black cursor-pointer shadow-lg hover:scale-110 transition-transform" style={{ backgroundColor: '#4f46e5' }}>
                    LB
                  </div>
                </div>
              )}
            </div>
            {/* Mobile phone bottom (home indicator) */}
            {preview && previewDevice === 'mobile' && (
              <div className="w-[390px] bg-gray-900 rounded-b-[2.5rem] border-x-[4px] border-b-[4px] border-gray-700 py-3 flex justify-center">
                <div className="w-28 h-[3px] bg-gray-500 rounded-full" />
              </div>
            )}
            {/* Device size label */}
            {preview && (
              <p className="text-slate-500 text-[11px] mt-4 text-center">
                {previewDevice === 'mobile' ? '390px — スマートフォン' : previewDevice === 'tablet' ? '768px — タブレット' : '1280px — デスクトップ'}
              </p>
            )}
          </div>
        </div>

        {/* Right Panel */}
        {!preview && (
          <RightPanel
            block={selectedIds.size > 1 ? null : selectedBlock}
            onDataChange={updateBlockData}
            seo={currentPage.seo}
            onSeoChange={seo => setSite(prev => ({
              ...prev,
              pages: prev.pages.map(p => p.id === currentPageId ? { ...p, seo } : p),
            }))}
            larubot={site.larubot}
            onLarubotChange={v => setSite(prev => ({ ...prev, larubot: v }))}
            laruseo={site.laruseo}
            onLaruseoChange={v => setSite(prev => ({ ...prev, laruseo: v }))}
            notifyEmail={site.notifyEmail}
            onNotifyEmailChange={v => setSite(prev => ({ ...prev, notifyEmail: v }))}
            colorScheme={site.colorScheme}
            onColorSchemeChange={scheme => {
              const s = COLOR_SCHEMES.find(c => c.id === scheme);
              if (!s) return;
              pushHistory(siteRef.current);
              setSite(prev => ({
                ...prev,
                colorScheme: scheme,
                pages: prev.pages.map(p => ({
                  ...p,
                  blocks: p.blocks.map(b => {
                    if (b.type === 'hero') return { ...b, data: { ...b.data, bgColor: s.colors[0] } };
                    if (b.type === 'cta') return { ...b, data: { ...b.data, bgColor: s.colors[0] } };
                    if (b.type === 'countdown') return { ...b, data: { ...b.data, bgColor: s.colors[0] } };
                    return b;
                  }),
                })),
              }));
            }}
            gaTrackingId={site.gaTrackingId}
            onGaTrackingIdChange={v => setSite(prev => ({ ...prev, gaTrackingId: v }))}
            larubotPublicId={site.larubotPublicId}
            onLarubotPublicIdChange={v => setSite(prev => ({ ...prev, larubotPublicId: v }))}
            laruseoPublicId={site.laruseoPublicId}
            onLaruseoPublicIdChange={v => setSite(prev => ({ ...prev, laruseoPublicId: v }))}
            siteName={site.siteName}
            customCss={site.customCss}
            onCustomCssChange={v => setSite(prev => ({ ...prev, customCss: v }))}
            fontFamily={site.fontFamily}
            onFontFamilyChange={v => setSite(prev => ({ ...prev, fontFamily: v }))}
            designStyle={site.designStyle}
            onDesignStyleChange={v => setSite(prev => ({ ...prev, designStyle: v }))}
            userPlan={userPlan}
            subscriptionStatus={subscriptionStatus}
            onOpenImageLib={cb => { setImageLibCallback(() => cb); setShowImageLib(true); }}
            globalFooter={site.globalFooter}
            onGlobalFooterChange={f => setSite(prev => ({ ...prev, globalFooter: f }))}
            customPalette={site.customPalette}
            onCustomPaletteChange={p => setSite(prev => ({ ...prev, customPalette: p }))}
            lineNotifyToken={site.lineNotifyToken}
            onLineNotifyTokenChange={v => setSite(prev => ({ ...prev, lineNotifyToken: v }))}
            clarityId={site.clarityId}
            onClarityIdChange={v => setSite(prev => ({ ...prev, clarityId: v }))}
            webhookUrl={site.webhookUrl}
            onWebhookUrlChange={v => setSite(prev => ({ ...prev, webhookUrl: v }))}
            sitePassword={site.sitePassword}
            onSitePasswordChange={v => setSite(prev => ({ ...prev, sitePassword: v }))}
            siteId={siteId}
            onMemoChange={updateBlockMemo}
          />
        )}
      </div>

      {!preview && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#1e293b] border border-white/10 rounded-2xl px-5 py-2.5 text-xs text-slate-400 flex items-center gap-3 shadow-2xl z-20">
          <span>ブロックをクリックして選択 · テキストをクリックして直接編集 · 左パネルからブロックを追加 · ドラッグで並び替え · ↩↪ または Cmd+Z で元に戻す</span>
        </div>
      )}

      {/* Mobile floating action button — block palette */}
      {!preview && (
        <button
          onClick={() => setShowMobileBlocks(true)}
          className="sm:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-sm font-bold px-5 py-3 rounded-full shadow-xl shadow-blue-900/40 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ブロック追加
        </button>
      )}

      {/* AI Chat Sidebar */}
      <AiChatSidebar
        open={showAiChat}
        onClose={() => setShowAiChat(false)}
        blocks={currentPage.blocks}
        selectedBlockId={selectedId}
        siteName={site.siteName}
        industry={String(onboardingData?.industry ?? '')}
        onApplyActions={actions => {
          pushHistory(siteRef.current);
          actions.forEach(a => {
            if (a.type === 'update_block') {
              updateBlockData(a.blockId, a.data);
            }
          });
        }}
      />

      {/* URL import modal */}
      {showUrlImport && (
        <UrlImportModal
          onImport={handleUrlImport}
          onClose={() => setShowUrlImport(false)}
        />
      )}

      {/* Preview link modal */}
      {showPreviewLink && dbSiteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">閲覧専用プレビューリンク</h2>
              <button onClick={() => setShowPreviewLink(false)} aria-label="プレビューリンクを閉じる" className="text-slate-500 hover:text-white text-xl focus:outline-none focus:ring-1 focus:ring-white/30 rounded">✕</button>
            </div>
            <p className="text-slate-400 text-xs mb-4">公開前に関係者へ共有できるリンクです。URLを知っている人だけが閲覧できます。</p>
            {previewToken ? (
              <>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-3 flex items-center gap-2">
                  <span className="text-slate-300 text-xs flex-1 break-all">
                    {`${typeof window !== 'undefined' ? window.location.origin : ''}/hp/preview/${previewToken}`}
                  </span>
                  <button
                    onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/hp/preview/${previewToken}`)}
                    className="text-[10px] bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 px-2 py-1 rounded flex-shrink-0">
                    コピー
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setPreviewTokenLoading(true);
                      const res = await fetch(`/api/sites/${dbSiteId}/preview-token`, { method: 'POST' });
                      const data = await res.json();
                      if (data.token) setPreviewToken(data.token);
                      setPreviewTokenLoading(false);
                    }}
                    disabled={previewTokenLoading}
                    className="flex-1 text-xs bg-white/10 hover:bg-white/20 text-slate-300 px-3 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                    {previewTokenLoading ? '...' : '再発行（URLを変更）'}
                  </button>
                  <button
                    onClick={async () => {
                      await fetch(`/api/sites/${dbSiteId}/preview-token`, { method: 'DELETE' });
                      setPreviewToken(null);
                    }}
                    className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-2 rounded-lg">
                    無効化
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={async () => {
                  setPreviewTokenLoading(true);
                  const res = await fetch(`/api/sites/${dbSiteId}/preview-token`, { method: 'POST' });
                  const data = await res.json();
                  if (data.token) setPreviewToken(data.token);
                  setPreviewTokenLoading(false);
                }}
                disabled={previewTokenLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed">
                {previewTokenLoading ? '発行中...' : 'プレビューリンクを発行'}
              </button>
            )}
            <p className="text-slate-600 text-[10px] mt-3">※ 公開サイトとは別のリンクです。公開したい場合は「公開する」ボタンを使ってください。</p>
          </div>
        </div>
      )}

      {/* PageSpeed modal */}
      {showPageSpeed && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPageSpeed(false)}>
          <div className="bg-[#1e293b] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-white text-base flex items-center gap-2">⚡ サイト速度チェック</div>
              <button onClick={() => setShowPageSpeed(false)} aria-label="速度チェックを閉じる" className="text-slate-400 hover:text-white text-xl leading-none focus:outline-none focus:ring-1 focus:ring-white/30 rounded">×</button>
            </div>
            {pageSpeedLoading ? (
              <div className="text-center py-10">
                <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                <div className="text-slate-400 text-sm">PageSpeed Insights で計測中... (30秒ほどかかります)</div>
              </div>
            ) : pageSpeedData ? (
              <>
                <div className="text-slate-500 text-[11px] mb-4 truncate">{pageSpeedData.url}</div>
                {(['mobile', 'desktop'] as const).map(device => {
                  const d = pageSpeedData[device];
                  if (!d) return null;
                  const scoreColor = (s: number) => s >= 90 ? 'text-green-400' : s >= 50 ? 'text-amber-400' : 'text-red-400';
                  const scoreBg = (s: number) => s >= 90 ? 'bg-green-500/20' : s >= 50 ? 'bg-amber-500/20' : 'bg-red-500/20';
                  return (
                    <div key={device} className="mb-4">
                      <div className="text-xs font-bold text-slate-400 mb-2">{device === 'mobile' ? '📱 モバイル' : '🖥 デスクトップ'}</div>
                      <div className="grid grid-cols-4 gap-2">
                        {([['performance', 'パフォーマンス'], ['accessibility', 'アクセシビリティ'], ['seo', 'SEO'], ['bestPractices', 'ベスプラ']] as [keyof typeof d, string][]).map(([key, label]) => (
                          <div key={key} className={`${scoreBg(d[key])} rounded-xl p-2 text-center`}>
                            <div className={`text-2xl font-black ${scoreColor(d[key])}`}>{d[key]}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5">{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <button onClick={handlePageSpeed} className="w-full bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold py-2 rounded-lg mt-1">再計測</button>
              </>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">計測に失敗しました。再度お試しください。</div>
            )}
          </div>
        </div>
      )}

      {/* Image library modal */}
      {showImageLib && imageLibCallback && (
        <ImageLibraryModal
          onSelect={url => { imageLibCallback(url); setShowImageLib(false); setImageLibCallback(null); }}
          onClose={() => { setShowImageLib(false); setImageLibCallback(null); }}
        />
      )}

      {/* Template picker modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-bold text-lg">デザインテンプレート</h2>
              <button onClick={() => setShowTemplateModal(false)} aria-label="テンプレートを閉じる" className="text-slate-500 hover:text-white text-xl leading-none focus:outline-none focus:ring-1 focus:ring-white/30 rounded">✕</button>
            </div>
            <p className="text-slate-500 text-xs mb-5">選択するとブロック構成とカラーが変わります（現在の内容は置き換えられます）</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {DESIGN_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl.id)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-xl overflow-hidden transition-all text-left group"
                >
                  {/* Mini preview */}
                  <div className="h-20 relative overflow-hidden" style={{ background: tpl.colors[0] }}>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-3">
                      <div className="w-3/4 h-2 rounded-full bg-white/40" />
                      <div className="w-1/2 h-1.5 rounded-full bg-white/25" />
                      <div className="flex gap-1 mt-1">
                        {[1,2,3].map(n => <div key={n} className="w-8 h-5 rounded bg-white/10 border border-white/20" />)}
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 w-3 h-3 rounded-full" style={{ background: tpl.colors[1] }} />
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-1">
                      <div className="text-white text-xs font-bold">{tpl.name}</div>
                      <span className={`flex-shrink-0 text-[8px] px-1.5 py-0.5 rounded font-bold ${
                        tpl.designStyle === 'modern'  ? 'bg-blue-500/20 text-blue-400' :
                        tpl.designStyle === 'minimal' ? 'bg-slate-500/20 text-slate-400' :
                        tpl.designStyle === 'bold'    ? 'bg-orange-500/20 text-orange-400' :
                        tpl.designStyle === 'elegant' ? 'bg-purple-500/20 text-purple-400' :
                        tpl.designStyle === 'rounded' ? 'bg-green-500/20 text-green-400' :
                        tpl.designStyle === 'sharp'   ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {({ modern: 'モダン', minimal: 'ミニマル', bold: 'ボールド', elegant: 'エレガント', rounded: 'ラウンド', sharp: 'シャープ' } as Record<string, string>)[tpl.designStyle]}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[10px] mt-0.5">{tpl.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Version history panel */}
      {/* Version restore confirmation */}
      {restoreConfirmVersionId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-xl">⏪</div>
            <h2 className="text-white font-bold mb-2">このバージョンに戻しますか？</h2>
            <p className="text-slate-400 text-sm mb-5">現在の編集内容は上書きされます。この操作は取り消せません。</p>
            <div className="flex gap-2">
              <button onClick={() => setRestoreConfirmVersionId(null)} className="flex-1 text-sm text-slate-400 hover:text-slate-200 border border-white/10 py-2.5 rounded-lg transition-colors">
                キャンセル
              </button>
              <button onClick={confirmRestoreVersion} disabled={!!restoringVersion} className="flex-1 text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-2.5 rounded-lg transition-all">
                {restoringVersion ? '復元中...' : '復元する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI layout proposal modal */}
      {aiLayoutProposal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-lg flex-shrink-0">✨</div>
              <div>
                <h2 className="text-white font-bold">AIレイアウト提案</h2>
                <p className="text-slate-500 text-xs mt-0.5">現在のブロックを以下の構成に置き換えます</p>
              </div>
            </div>
            <div className="space-y-1.5 mb-4">
              {aiLayoutProposal.layout.map((block, i) => (
                <div key={i} className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-white text-sm font-medium">{block}</span>
                </div>
              ))}
            </div>
            {aiLayoutProposal.reasoning && (
              <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3 mb-4">
                <p className="text-slate-400 text-xs leading-relaxed">
                  <span className="text-blue-400 font-semibold">AI の理由: </span>
                  {aiLayoutProposal.reasoning}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setAiLayoutProposal(null)} className="flex-1 text-sm text-slate-400 hover:text-slate-200 border border-white/10 py-2.5 rounded-lg transition-colors">
                キャンセル
              </button>
              <button onClick={handleApplyAiLayout} className="flex-1 text-sm bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-2.5 rounded-lg transition-all">
                適用する
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">バージョン履歴</h2>
              <button onClick={() => setShowHistoryPanel(false)} aria-label="バージョン履歴を閉じる" className="text-slate-500 hover:text-white text-xl leading-none focus:outline-none focus:ring-1 focus:ring-white/30 rounded">✕</button>
            </div>
            {versions.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">履歴がありません。公開すると自動保存されます。</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <div>
                      <div className="text-white text-sm font-medium">{v.label}</div>
                      <div className="text-slate-500 text-xs">{new Date(v.created_at).toLocaleString('ja-JP')}</div>
                    </div>
                    <button
                      onClick={() => handleRestoreVersion(v.id)}
                      disabled={restoringVersion === v.id}
                      className="text-xs bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-slate-300"
                    >
                      {restoringVersion === v.id ? '復元中...' : '復元'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-slate-600 text-xs mt-4">公開するたびに最大20件まで自動保存されます</p>
          </div>
        </div>
      )}

      {/* Plan picker modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h2 className="text-white font-bold text-lg mb-1">プランを選択して公開</h2>
            <p className="text-slate-400 text-sm mb-5">初月無料でお試しいただけます</p>
            <div className="space-y-3">
              {([
                { id: 'hp', label: 'LARU HP', price: '¥999', sub: '/月', badge: null, desc: 'ホームページ作成・公開' },
                { id: 'lite', label: 'HP + LARUbot Lite', price: '¥4,980', sub: '/月', badge: null, desc: 'HP + AIチャットボット（機能制限あり）' },
                { id: 'hp-bot', label: 'HP + LARUbot', price: '¥4,980', sub: '/月', badge: 'おすすめ', desc: 'HP作成 + AIチャットボット搭載' },
                { id: 'hp-bot-seo', label: 'HP + Bot + SEO', price: '¥9,800', sub: '/月', badge: '半年間限定', desc: 'HP + チャットボット + AIブログSEO' },
              ] as const).map(plan => (
                <button
                  key={plan.id}
                  onClick={async () => {
                    setShowPlanModal(false);
                    const res = await fetch('/api/stripe/checkout', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ siteId: pendingSiteId, plan: plan.id }),
                    });
                    const d = await res.json();
                    if (d.url) window.location.href = d.url;
                    else setCheckoutError('決済ページの取得に失敗しました。もう一度お試しください。');
                  }}
                  className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 rounded-xl px-4 py-3 transition-all text-left"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{plan.label}</span>
                      {plan.badge && <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">{plan.badge}</span>}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5">{plan.desc}</div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className="text-white font-black text-base">{plan.price}<span className="text-slate-400 text-[11px] font-normal">{plan.sub}</span></div>
                    <div className="text-blue-400 text-[10px]">初月無料</div>
                  </div>
                </button>
              ))}
            </div>
            {checkoutError && (
              <p className="mt-3 text-red-400 text-xs text-center">{checkoutError}</p>
            )}
            <button
              onClick={() => { setShowPlanModal(false); setCheckoutError(''); }}
              className="mt-4 w-full text-slate-500 text-sm hover:text-slate-300 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#030712] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-4xl mb-4 animate-spin">⚙️</div>
          <div>エディタを読み込み中...</div>
        </div>
      </div>
    }>
      <BuilderContent />
    </Suspense>
  );
}
