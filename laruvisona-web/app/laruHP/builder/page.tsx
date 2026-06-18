'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getTemplateForIndustry, applyTemplateData } from '@/lib/templates';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
type BlockType =
  | 'hero' | 'heading' | 'paragraph' | 'image'
  | 'two-col' | 'three-col' | 'divider' | 'cta'
  | 'services' | 'testimonials' | 'faq' | 'contact'
  | 'hours' | 'gallery' | 'larubot'
  | 'video' | 'map' | 'countdown' | 'price-table' | 'booking' | 'news'
  | 'popup' | 'newsletter'
  | 'share' | 'stripe-buy'
  | 'google-reviews';

interface Block {
  id: string;
  type: BlockType;
  data: Record<string, unknown>;
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

interface SiteData {
  siteName: string;
  pages: Page[];
  colorScheme: string;
  larubot: boolean;
  laruseo: boolean;
  notifyEmail: string;
  gaTrackingId: string;
  larubotPublicId: string;
  laruseoPublicId: string;
  customCss: string;
  fontFamily: string;
}

const emptySeo: SEOSettings = { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '' };

// ─── Default Block Data ────────────────────────────────────────────────────────
const defaultBlock = (type: BlockType): Block => {
  const id = `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const defaults: Record<BlockType, Record<string, unknown>> = {
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
  };
  return { id, type, data: defaults[type] };
};

// ─── Color Schemes ────────────────────────────────────────────────────────────
const COLOR_SCHEMES = [
  { id: 'professional-blue', name: 'プロ', colors: ['#1e3a8a', '#3b82f6'] },
  { id: 'warm-earth',        name: 'ナチュラル', colors: ['#78350f', '#d97706'] },
  { id: 'elegant-dark',      name: 'エレガント', colors: ['#111827', '#6b7280'] },
  { id: 'fresh-green',       name: 'フレッシュ', colors: ['#064e3b', '#10b981'] },
  { id: 'modern-pink',       name: 'フェミニン', colors: ['#831843', '#ec4899'] },
  { id: 'bold-orange',       name: 'アクティブ', colors: ['#7c2d12', '#f97316'] },
];

// ─── Block Palette Config ─────────────────────────────────────────────────────
const BLOCK_PALETTE = [
  { group: 'レイアウト', items: [
    { type: 'hero' as BlockType, label: 'ヒーロー', icon: '🦸' },
    { type: 'two-col' as BlockType, label: '2カラム', icon: '▣' },
    { type: 'three-col' as BlockType, label: '3カラム', icon: '⊞' },
    { type: 'divider' as BlockType, label: '区切り線', icon: '➖' },
  ]},
  { group: 'コンテンツ', items: [
    { type: 'heading' as BlockType, label: '見出し', icon: 'H' },
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
    { type: 'popup' as BlockType, label: 'ポップアップ', icon: '💬' },
    { type: 'newsletter' as BlockType, label: 'メルマガ登録', icon: '📧' },
    { type: 'share' as BlockType, label: 'SNSシェア', icon: '🔗' },
    { type: 'stripe-buy' as BlockType, label: '購入ボタン', icon: '🛒' },
    { type: 'google-reviews' as BlockType, label: 'Google口コミ', icon: '⭐' },
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
function BlockCanvas({ block, selected, onSelect, onDataChange }: {
  block: Block;
  selected: boolean;
  onSelect: () => void;
  onDataChange: (data: Record<string, unknown>) => void;
}) {
  const d = block.data;

  const editable = (key: string, tag: 'h1'|'h2'|'h3'|'h4'|'p'|'div'|'span' = 'span', className: string = '') => {
    const props = {
      contentEditable: true as const,
      suppressContentEditableWarning: true,
      className: `outline-none focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:bg-blue-400/5 rounded transition-all cursor-text ${className}`,
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
      case 'hero':
        return (
          <div className="min-h-[360px] flex flex-col items-center justify-center text-center px-8 py-16 relative overflow-hidden" style={{ backgroundColor: d.bgColor as string, color: d.textColor as string }}>
            {(d.bgImage as string) ? <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${d.bgImage as string})` }} /> : null}
            {d.abVariant === 'b' && (
              <div className="absolute top-2 left-2 z-20 bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">B バリアント</div>
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

      case 'heading':
        return (
          <div className="px-8 py-12" style={{ textAlign: d.align as React.CSSProperties['textAlign'] }}>
            {(d.image as string) && <img src={d.image as string} alt="" className="w-full rounded-xl mb-6 object-cover" style={{ height: '200px' }} />}
            {editable('text', 'h2', 'text-3xl font-black text-gray-800 block mb-2')}
            {editable('subtext', 'p', 'text-gray-500 block')}
          </div>
        );

      case 'paragraph': {
        const imgPos = d.imagePosition as string;
        if ((d.image as string) && imgPos && imgPos !== 'none') {
          return (
            <div className={`px-8 py-6 flex gap-8 items-start max-w-5xl mx-auto ${imgPos === 'right' ? 'flex-row-reverse' : ''}`}>
              <img src={d.image as string} alt="" className="w-48 rounded-xl object-cover flex-shrink-0" style={{ height: '160px' }} />
              <div className="flex-1">{editable('text', 'p', 'text-gray-700 leading-relaxed block w-full')}</div>
            </div>
          );
        }
        return (
          <div className="px-8 py-6 max-w-3xl mx-auto">
            {editable('text', 'p', `text-gray-700 leading-relaxed block text-${d.fontSize || 16}px w-full`)}
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
                    <p className="text-gray-500 text-sm mb-3">{item.description}</p>
                    {item.price && <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">{item.price}</span>}
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
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">{item.text}</p>
                  <div className="text-gray-800 font-bold text-sm">{item.name}<span className="text-gray-400 font-normal ml-1">({item.age})</span></div>
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
                  <div className="p-5 flex gap-3">
                    <span className="text-blue-500 font-black text-lg flex-shrink-0">Q.</span>
                    <p className="font-bold text-gray-800">{item.q}</p>
                  </div>
                  <div className="px-5 pb-5 pt-0 flex gap-3 bg-gray-50">
                    <span className="text-gray-400 font-black text-lg flex-shrink-0">A.</span>
                    <p className="text-gray-600 text-sm">{item.a}</p>
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
                <input type="text" placeholder="お名前" className="border border-gray-200 rounded-xl px-4 py-3 w-full bg-white" readOnly />
                <input type="email" placeholder="メールアドレス" className="border border-gray-200 rounded-xl px-4 py-3 w-full bg-white" readOnly />
              </div>
              <input type="tel" placeholder="電話番号" className="border border-gray-200 rounded-xl px-4 py-3 w-full bg-white" readOnly />
              <textarea placeholder="お問い合わせ内容" rows={4} className="border border-gray-200 rounded-xl px-4 py-3 w-full bg-white resize-none" readOnly />
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

      default:
        return <div className="p-8 text-gray-400 text-center">Unknown block type: {block.type}</div>;
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`relative group cursor-pointer transition-all ${selected ? 'ring-2 ring-blue-500 ring-offset-0' : 'hover:ring-1 hover:ring-blue-300'}`}
    >
      {selected && (
        <div className="absolute -top-7 left-0 z-20 flex items-center gap-1 bg-blue-500 text-white text-xs rounded-t-lg px-2 py-1 pointer-events-none">
          <span>選択中: {block.type}</span>
        </div>
      )}
      {inner()}
    </div>
  );
}

// ─── AI Image Button ───────────────────────────────────────────────────────────
function AiImageButton({ onGenerated, defaultPrompt }: { onGenerated: (url: string) => void; defaultPrompt?: string }) {
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompt || '');
  const [open, setOpen] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.url) onGenerated(data.url);
      else alert(data.error || '画像生成に失敗しました');
    } catch {
      alert('画像生成に失敗しました');
    }
    setGenerating(false);
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-1 w-full flex items-center gap-1.5 text-[10px] text-purple-300 hover:text-purple-200 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded px-2 py-1.5 transition-all">
        ✨ AI画像生成
      </button>
    );
  }

  return (
    <div className="mt-1 bg-purple-500/10 border border-purple-500/20 rounded p-2">
      <textarea
        rows={2}
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="例: 美容サロンの明るくおしゃれな内装"
        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px] resize-none mb-1.5"
      />
      <div className="flex gap-1">
        <button onClick={generate} disabled={generating || !prompt.trim()}
          className="flex-1 text-[10px] bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded px-2 py-1.5 font-bold transition-all">
          {generating ? '生成中...' : '生成'}
        </button>
        <button onClick={() => setOpen(false)} className="text-[10px] text-slate-500 hover:text-slate-300 px-2">✕</button>
      </div>
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
        className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 text-xs py-2 rounded-lg transition-all disabled:opacity-40">
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

function RightPanel({ block, onDataChange, seo, onSeoChange, larubot, onLarubotChange, laruseo, onLaruseoChange, notifyEmail, onNotifyEmailChange, colorScheme, onColorSchemeChange, gaTrackingId, onGaTrackingIdChange, larubotPublicId, onLarubotPublicIdChange, laruseoPublicId, onLaruseoPublicIdChange, siteName, customCss, onCustomCssChange, fontFamily, onFontFamilyChange, userPlan, subscriptionStatus }: {
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
}) {
  const [tab, setTab] = useState<'block' | 'seo' | 'integrations'>('block');
  const [uploadingImg, setUploadingImg] = useState<string | null>(null);
  const [aiCopyLoading, setAiCopyLoading] = useState(false);
  const [aiCopyResult, setAiCopyResult] = useState<Record<string, string> | null>(null);
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

  const seoScore = [
    seo.title.length > 10,
    seo.description.length > 30,
    seo.keywords.length > 0,
    larubot,
    laruseo,
  ].filter(Boolean).length;

  return (
    <div className="w-64 bg-[#0f172a] border-l border-white/10 flex flex-col flex-shrink-0 min-h-0">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {(['block', 'seo', 'integrations'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-bold transition-colors ${tab === t ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>
            {t === 'block' ? 'ブロック' : t === 'seo' ? 'SEO' : '連携'}
          </button>
        ))}
      </div>

      <div data-lenis-prevent-wheel className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {tab === 'block' && (
          <>
            {!block && (
              <div className="text-slate-500 text-center py-8">
                ブロックを選択してください
              </div>
            )}
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
                  <select value={d.trigger as string} onChange={e => onDataChange(block.id, { ...d, trigger: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                    <option value="delay">時間経過後</option>
                    <option value="scroll">スクロール50%</option>
                    <option value="exit">離脱時</option>
                  </select>
                </label>
                {(d.trigger as string) === 'delay' && (
                  <label className="block">
                    <span className="text-slate-400 block mb-1">表示までの秒数</span>
                    <input type="number" min="1" max="30" value={d.delay as string}
                      onChange={e => onDataChange(block.id, { ...d, delay: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                  </label>
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
            {block && !['hero','cta','divider','services','image','gallery','larubot','video','map','countdown','price-table','booking','contact','popup','newsletter','share','stripe-buy','google-reviews'].includes(block.type) && (
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
                  className="w-full text-xs bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-bold py-2.5 rounded-lg transition-all disabled:opacity-50"
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
            {/* 全ブロック共通：モバイル/PC表示切り替え */}
            {block && (
              <div className="border-t border-white/10 pt-3 mt-2">
                <span className="text-slate-400 block mb-2 text-[11px] font-semibold uppercase tracking-wide">表示設定</span>
                <div className="space-y-2">
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
          </>
        )}

        {tab === 'seo' && (
          <>
            <div className="bg-white/5 rounded-xl p-3 mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">SEOスコア</span>
                <span className={`font-bold ${seoScore >= 4 ? 'text-green-400' : seoScore >= 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {seoScore * 20}/100
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div className={`h-full rounded-full transition-all ${seoScore >= 4 ? 'bg-green-400' : seoScore >= 2 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${seoScore * 20}%` }} />
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
                          className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 mt-1 ${larubot ? 'bg-indigo-500' : 'bg-white/15'}`}
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
                          className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-white text-[10px] font-mono focus:outline-none focus:border-indigo-400/50"
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
                          className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 mt-1 ${laruseo ? 'bg-emerald-500' : 'bg-white/15'}`}
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
                          className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-white text-[10px] font-mono focus:outline-none focus:border-emerald-400/50"
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

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔤</span>
                <span className="font-bold text-sm">フォント</span>
              </div>
              <select
                value={fontFamily}
                onChange={e => onFontFamilyChange(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/20"
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
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Builder ──────────────────────────────────────────────────────────────
function BuilderContent() {
  const searchParams = useSearchParams();
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
    larubot: true,
    laruseo: true,
    notifyEmail: '',
    gaTrackingId: '',
    larubotPublicId: '',
    laruseoPublicId: '',
    customCss: '',
    fontFamily: 'noto',
  };

  const [site, setSite] = useState<SiteData>(defaultSiteData);
  const [currentPageId, setCurrentPageId] = useState<string>('page-main');
  const [dbSiteId, setDbSiteId] = useState<string | null>(siteId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const [onboardingData, setOnboardingData] = useState<Record<string, unknown> | null>(null);
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive');
  const [isAdmin, setIsAdmin] = useState(false);
  const undoStack = useRef<SiteData[]>([]);
  const redoStack = useRef<SiteData[]>([]);
  const siteRef = useRef<SiteData>(defaultSiteData);
  const canvasRef = useRef<HTMLDivElement>(null);

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
      if (!user) return;
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      if (adminEmail && user.email === adminEmail) {
        setIsAdmin(true);
        setUserPlan('hp-bot-seo');
        setSubscriptionStatus('active');
        return;
      }
      supabase.from('profiles').select('plan, subscription_status').eq('id', user.id).single().then(({ data }: { data: { plan: string | null; subscription_status: string } | null }) => {
        if (data) {
          setUserPlan(data.plan);
          setSubscriptionStatus(data.subscription_status || 'inactive');
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
          settings_json: { colorScheme: s.colorScheme, larubot: s.larubot, laruseo: s.laruseo, notifyEmail: s.notifyEmail, gaTrackingId: s.gaTrackingId, larubotPublicId: s.larubotPublicId, laruseoPublicId: s.laruseoPublicId, customCss: s.customCss, fontFamily: s.fontFamily },
        }),
      });
      localStorage.setItem('laruHP_builder', JSON.stringify(s));
      setIsDirty(false);
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
    undoStack.current = [...undoStack.current, JSON.parse(JSON.stringify(snapshot))].slice(-50);
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (!undoStack.current.length) return;
    const past = undoStack.current.pop()!;
    redoStack.current.push(JSON.parse(JSON.stringify(siteRef.current)));
    setSite(past);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    if (!redoStack.current.length) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(JSON.parse(JSON.stringify(siteRef.current)));
    setSite(next);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

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
              larubot: s.settings_json?.larubot ?? true,
              laruseo: s.settings_json?.laruseo ?? true,
              notifyEmail: s.settings_json?.notifyEmail || '',
              gaTrackingId: s.settings_json?.gaTrackingId || '',
              larubotPublicId: s.settings_json?.larubotPublicId || '',
              laruseoPublicId: s.settings_json?.laruseoPublicId || '',
              customCss: s.settings_json?.customCss || '',
              fontFamily: s.settings_json?.fontFamily || 'noto',
            });
            setCurrentPageId(pages[0].id);
            setPublished(s.published);
            setPublishedSlug(s.slug);
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
      } else {
        const heroBlock = defaultBlock('hero');
        heroBlock.data = {
          ...heroBlock.data,
          heading: ai.heroHeading || d.businessName || 'ここに見出しを入力',
          subheading: ai.heroSubheading || d.catchphrase || 'キャッチフレーズを入力してください',
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
        larubot: d.larubot ?? true,
        laruseo: d.laruseo ?? true,
        notifyEmail: d.email || '',
        gaTrackingId: '',
        larubotPublicId: '',
        laruseoPublicId: '',
        customCss: '',
        fontFamily: 'noto',
      });
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
            larubot: parsed.larubot ?? true,
            laruseo: parsed.laruseo ?? true,
            notifyEmail: parsed.notifyEmail || '',
            gaTrackingId: parsed.gaTrackingId || '',
            larubotPublicId: parsed.larubotPublicId || '',
            laruseoPublicId: parsed.laruseoPublicId || '',
            customCss: parsed.customCss || '',
            fontFamily: parsed.fontFamily || 'noto',
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
    pushHistory(siteRef.current);
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map(p =>
        p.id === currentPageId ? { ...p, blocks: p.blocks.filter(b => b.id !== id) } : p
      ),
    }));
    setSelectedId(null);
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
    { id: 'business', name: 'ビジネス', desc: 'プロフェッショナルな印象', colorScheme: 'professional-blue', colors: ['#1e3a8a','#3b82f6'], blocks: ['hero','heading','paragraph','two-col','services','cta','contact'] },
    { id: 'warm', name: 'ウォームカフェ', desc: '温かみのある飲食向け', colorScheme: 'warm-earth', colors: ['#92400e','#d97706'], blocks: ['hero','services','testimonials','hours','gallery','cta','contact'] },
    { id: 'elegant', name: 'エレガント', desc: '上品でラグジュアリー', colorScheme: 'elegant-dark', colors: ['#1e1b4b','#7c3aed'], blocks: ['hero','heading','paragraph','three-col','testimonials','faq','cta'] },
    { id: 'fresh', name: 'フレッシュ', desc: 'クリーンな医療・健康系', colorScheme: 'fresh-green', colors: ['#064e3b','#10b981'], blocks: ['hero','three-col','services','faq','hours','map','contact'] },
    { id: 'pink', name: 'モダンピンク', desc: '美容・サロン向け', colorScheme: 'modern-pink', colors: ['#831843','#ec4899'], blocks: ['hero','heading','paragraph','services','gallery','testimonials','booking','cta'] },
    { id: 'orange', name: 'ボールド', desc: 'エネルギッシュで力強い', colorScheme: 'bold-orange', colors: ['#7c2d12','#f97316'], blocks: ['hero','three-col','services','testimonials','cta','contact'] },
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
      pages: prev.pages.map((p, i) => i === 0 ? { ...p, blocks: newBlocks } : p),
    }));
    setShowTemplateModal(false);
    setSelectedId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name: site.siteName,
      blocks_json: { v: 2, pages: site.pages },
      seo_json: site.pages[0]?.seo || emptySeo,
      settings_json: { colorScheme: site.colorScheme, larubot: site.larubot, laruseo: site.laruseo, notifyEmail: site.notifyEmail, gaTrackingId: site.gaTrackingId, larubotPublicId: site.larubotPublicId, laruseoPublicId: site.laruseoPublicId, customCss: site.customCss, fontFamily: site.fontFamily },
    };
    if (dbSiteId) {
      await fetch(`/api/sites/${dbSiteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, industry: onboardingData?.industry }),
      });
      const { site: s } = await res.json();
      if (s?.id) setDbSiteId(s.id);
    }
    localStorage.setItem('laruHP_builder', JSON.stringify(site));
    setIsDirty(false);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
          settings_json: { colorScheme: site.colorScheme, larubot: site.larubot, laruseo: site.laruseo, notifyEmail: site.notifyEmail, gaTrackingId: site.gaTrackingId, larubotPublicId: site.larubotPublicId, laruseoPublicId: site.laruseoPublicId, customCss: site.customCss, fontFamily: site.fontFamily },
          industry: onboardingData?.industry,
        }),
      });
      const { site: s } = await res.json();
      id = s?.id;
      if (id) setDbSiteId(id);
    }
    if (!id) { setPublishing(false); return; }

    const res = await fetch(`/api/sites/${id}/publish`, { method: 'POST' });
    const data = await res.json();
    if (data.error === 'subscription_required') {
      setPublishing(false);
      setPendingSiteId(id);
      setShowPlanModal(true);
      return;
    }
    if (data.success) {
      setPublished(true);
      setPublishedSlug(data.slug);
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

  const handleRestoreVersion = async (versionId: string) => {
    if (!dbSiteId) return;
    if (!confirm('このバージョンに戻しますか？現在の内容は上書きされます。')) return;
    setRestoringVersion(versionId);
    const res = await fetch(`/api/sites/${dbSiteId}/versions/${versionId}`, { method: 'POST' });
    if (res.ok) {
      // Reload site data from DB
      window.location.reload();
    }
    setRestoringVersion(null);
    setShowHistoryPanel(false);
  };

  const handleAiLayout = async () => {
    const d = onboardingData || JSON.parse(localStorage.getItem('laruHP_data') || '{}');
    if (!d.businessName) {
      alert('オンボーディングでビジネス情報を入力してからAIレイアウトを使用してください');
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
      const ok = confirm(`AIが提案するレイアウト:\n${layout.join(' → ')}\n\n理由: ${reasoning}\n\n現在のブロックを置き換えますか？`);
      if (!ok) return;
      pushHistory(siteRef.current);
      const newBlocks = (layout as BlockType[]).map(t => defaultBlock(t));
      setSite(prev => ({
        ...prev,
        pages: prev.pages.map(p =>
          p.id === currentPageId ? { ...p, blocks: newBlocks } : p
        ),
      }));
      setSelectedId(null);
    } finally {
      setAiLayouting(false);
    }
  };

  const handleAiGenerate = async () => {
    const d = onboardingData || JSON.parse(localStorage.getItem('laruHP_data') || '{}');
    if (!d.businessName) {
      alert('オンボーディングでビジネス情報を入力してからAI生成を使用してください');
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

  // Subscription paywall — block builder access for canceled/inactive plans
  const isLocked = !isAdmin && (subscriptionStatus === 'canceled' || subscriptionStatus === 'inactive' || subscriptionStatus === 'past_due');

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
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f172a] border-b border-white/10 flex-shrink-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/laruHP/dashboard" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors flex-shrink-0">
            <div className="w-7 h-7 bg-white text-black rounded-lg flex items-center justify-center font-black text-xs">L</div>
            <span className="hidden sm:block font-bold">LARU<span className="text-blue-400 font-light">HP</span></span>
          </Link>
          <span className="text-slate-700">/</span>
          <input
            type="text"
            value={site.siteName}
            onChange={e => setSite(prev => ({ ...prev, siteName: e.target.value }))}
            className="bg-transparent border-b border-transparent hover:border-white/30 focus:border-blue-500 text-sm font-bold outline-none transition-colors px-1 py-0.5 w-28 flex-shrink-0"
          />

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
                {site.pages.length > 1 && (
                  <button
                    onClick={() => deletePage(page.id)}
                    className="opacity-0 group-hover/tab:opacity-100 text-slate-600 hover:text-red-400 w-4 h-4 text-[11px] flex items-center justify-center transition-all ml-0.5"
                  >
                    ×
                  </button>
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
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 text-sm"
            >↩</button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="やり直す (Cmd+Shift+Z)"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 text-sm"
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
            onClick={handleAiLayout}
            disabled={aiLayouting}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 disabled:opacity-50"
          >
            {aiLayouting ? '提案中...' : 'AIレイアウト'}
          </button>
          <button
            onClick={handleAiGenerate}
            disabled={aiGenerating}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 disabled:opacity-50"
          >
            {aiGenerating ? '生成中...' : 'AI生成'}
          </button>
          {preview && (
            <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 border border-white/10">
              <button onClick={() => setPreviewDevice('desktop')} title="デスクトップ"
                className={`px-2 py-1.5 rounded transition-all ${previewDevice === 'desktop' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                </svg>
              </button>
              <button onClick={() => setPreviewDevice('tablet')} title="タブレット"
                className={`px-2 py-1.5 rounded transition-all ${previewDevice === 'tablet' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
              </button>
              <button onClick={() => setPreviewDevice('mobile')} title="スマートフォン"
                className={`px-2 py-1.5 rounded transition-all ${previewDevice === 'mobile' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>
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
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${saved ? 'bg-green-500 text-white' : isDirty ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
          >
            {isDirty && !saving && !saved && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
            {saving ? '保存中...' : saved ? '保存済み ✓' : isDirty ? '未保存' : '保存'}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold transition-all text-white disabled:opacity-50"
          >
            {publishing ? '公開中...' : published ? '再公開' : '公開する'}
          </button>
        </div>
      </div>

      <div className="flex overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left Panel - Block Palette */}
        {!preview && (
          <div data-lenis-prevent-wheel className="w-44 bg-[#0f172a] border-r border-white/10 overflow-y-auto flex-shrink-0 min-h-0">
            <div className="p-3">
              {BLOCK_PALETTE.map(group => (
                <div key={group.group} className="mb-4">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">{group.group}</div>
                  <div className="space-y-1">
                    {group.items.map(item => (
                      <button
                        key={item.type}
                        onClick={() => addBlock(item.type, selectedId || undefined)}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all text-left"
                      >
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          ref={canvasRef}
          data-lenis-prevent-wheel
          className="builder-canvas bg-[#e8eaed]"
          style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain', scrollBehavior: 'smooth', scrollbarWidth: 'thin', scrollbarColor: '#94a3b8 transparent' }}
        >
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
            <div className={`bg-white mx-auto transition-all duration-300 ${preview
              ? previewDevice === 'mobile'
                ? 'w-[390px] overflow-hidden border-x-[4px] border-gray-700'
                : previewDevice === 'tablet'
                ? 'w-[768px] overflow-hidden border border-t-0 border-gray-300 shadow-2xl'
                : 'w-full max-w-5xl overflow-hidden border border-t-0 border-gray-300 rounded-b-xl shadow-2xl'
              : 'max-w-3xl rounded-2xl overflow-hidden shadow-[0_4px_40px_rgba(0,0,0,0.12)]'}`}>
              {currentPage.blocks.length === 0 && (
                <div className="h-64 flex items-center justify-center text-gray-400 text-center">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                    <div className="font-medium">左のパレットからブロックを追加してください</div>
                  </div>
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
                  style={!preview && draggedId === block.id ? { opacity: 0.45, cursor: 'grabbing' } : !preview ? { cursor: 'grab' } : undefined}
                >
                  <BlockCanvas
                    block={block}
                    selected={selectedId === block.id && !preview}
                    onSelect={() => !preview && setSelectedId(block.id)}
                    onDataChange={(data) => updateBlockData(block.id, data)}
                  />
                  {!preview && (
                    <div className={`absolute right-2 flex flex-col gap-1 z-20 transition-opacity ${selectedId === block.id ? 'opacity-100 top-2' : 'opacity-0 group-hover:opacity-100 top-2'}`}>
                      <button onClick={() => moveBlock(block.id, -1)} disabled={index === 0}
                        className="w-6 h-6 bg-blue-500 text-white rounded text-xs flex items-center justify-center disabled:opacity-30 hover:bg-blue-600">↑</button>
                      <button onClick={() => moveBlock(block.id, 1)} disabled={index === currentPage.blocks.length - 1}
                        className="w-6 h-6 bg-blue-500 text-white rounded text-xs flex items-center justify-center disabled:opacity-30 hover:bg-blue-600">↓</button>
                      <button onClick={() => duplicateBlock(block.id)}
                        className="w-6 h-6 bg-slate-600 text-white rounded text-xs flex items-center justify-center hover:bg-slate-500">⧉</button>
                      <button onClick={() => deleteBlock(block.id)}
                        className="w-6 h-6 bg-red-500 text-white rounded text-xs flex items-center justify-center hover:bg-red-600">✕</button>
                    </div>
                  )}
                </div>
              ))}

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
            block={selectedBlock}
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
            userPlan={userPlan}
            subscriptionStatus={subscriptionStatus}
          />
        )}
      </div>

      {!preview && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#1e293b] border border-white/10 rounded-2xl px-5 py-2.5 text-xs text-slate-400 flex items-center gap-3 shadow-2xl z-20">
          <span>ブロックをクリックして選択 · テキストをクリックして直接編集 · 左パネルからブロックを追加 · ドラッグで並び替え · ↩↪ または Cmd+Z で元に戻す</span>
        </div>
      )}

      {/* Template picker modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-bold text-lg">デザインテンプレート</h2>
              <button onClick={() => setShowTemplateModal(false)} className="text-slate-500 hover:text-white text-xl leading-none">✕</button>
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
                    <div className="text-white text-xs font-bold">{tpl.name}</div>
                    <div className="text-slate-500 text-[10px] mt-0.5">{tpl.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Version history panel */}
      {showHistoryPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">バージョン履歴</h2>
              <button onClick={() => setShowHistoryPanel(false)} className="text-slate-500 hover:text-white text-xl leading-none">✕</button>
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
                      className="text-xs bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 text-slate-300"
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
            <p className="text-slate-400 text-sm mb-5">初月1円でお試しいただけます</p>
            <div className="space-y-3">
              {([
                { id: 'hp', label: 'LARU HP', price: '¥999', sub: '/月', badge: null, desc: 'ホームページ作成・公開' },
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
                    else alert('決済ページの取得に失敗しました。もう一度お試しください。');
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
                    <div className="text-blue-400 text-[10px]">初月1円</div>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPlanModal(false)}
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
