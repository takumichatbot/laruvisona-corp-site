'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getTemplateForIndustry, applyTemplateData } from '@/lib/templates';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
type BlockType =
  | 'hero' | 'heading' | 'paragraph' | 'image'
  | 'two-col' | 'three-col' | 'divider' | 'cta'
  | 'services' | 'testimonials' | 'faq' | 'contact'
  | 'hours' | 'gallery' | 'larubot'
  | 'video' | 'map' | 'countdown' | 'price-table' | 'booking' | 'news';

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
}

const emptySeo: SEOSettings = { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '' };

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
      col1Title: 'カラム1', col1Icon: '⭐', col1Text: 'コンテンツを入力',
      col2Title: 'カラム2', col2Icon: '🚀', col2Text: 'コンテンツを入力',
      col3Title: 'カラム3', col3Icon: '💡', col3Text: 'コンテンツを入力',
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
        { icon: '⭐', title: 'サービス1', description: '説明を入力してください', price: '' },
        { icon: '🚀', title: 'サービス2', description: '説明を入力してください', price: '' },
        { icon: '💡', title: 'サービス3', description: '説明を入力してください', price: '' },
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
  };
  return { id, type, data: defaults[type] };
};

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
            {editable('text', 'h2', 'text-3xl font-black text-gray-800 block mb-2')}
            {editable('subtext', 'p', 'text-gray-500 block')}
          </div>
        );

      case 'paragraph':
        return (
          <div className="px-8 py-6 max-w-3xl mx-auto">
            {editable('text', 'p', `text-gray-700 leading-relaxed block text-${d.fontSize || 16}px w-full`)}
          </div>
        );

      case 'image':
        return (
          <div className="px-8 py-6">
            {d.src ? (
              <img src={d.src as string} alt={d.alt as string} className="w-full rounded-xl object-cover" style={{ height: `${d.height || 300}px` }} />
            ) : (
              <label className="block w-full rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-50 transition-colors" style={{ height: `${d.height || 300}px` }}>
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <div className="text-4xl mb-2">🖼</div>
                  <div className="font-medium">クリックして画像をアップロード</div>
                  <div className="text-sm mt-1">PNG, JPG, WebP 対応</div>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
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
            <div className="bg-gray-50 rounded-xl p-6">
              {editable('col1Title', 'h3', 'text-xl font-bold text-gray-800 block mb-3')}
              {editable('col1Text', 'p', 'text-gray-600 leading-relaxed block')}
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              {editable('col2Title', 'h3', 'text-xl font-bold text-gray-800 block mb-3')}
              {editable('col2Text', 'p', 'text-gray-600 leading-relaxed block')}
            </div>
          </div>
        );

      case 'three-col':
        return (
          <div className="px-8 py-8 grid grid-cols-3 gap-6">
            {[1,2,3].map(n => (
              <div key={n} className="bg-gray-50 rounded-xl p-6 text-center">
                {editable(`col${n}Icon`, 'div', 'text-3xl mb-3 block')}
                {editable(`col${n}Title`, 'h3', 'text-lg font-bold text-gray-800 block mb-2')}
                {editable(`col${n}Text`, 'p', 'text-gray-600 text-sm leading-relaxed block')}
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
        const items = (d.items as Array<{icon:string; title:string; description:string; price:string}>) || [];
        const cols = d.columns === '2' ? 'grid-cols-2' : 'grid-cols-3';
        return (
          <div className="px-8 py-12">
            {editable('heading', 'h2', 'text-3xl font-black text-center text-gray-800 block mb-2')}
            {editable('subtext', 'p', 'text-center text-gray-500 block mb-10')}
            <div className={`grid ${cols} gap-6`}>
              {items.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-2xl p-6 text-center hover:shadow-md transition-shadow">
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
                      <div className="text-center"><div className="text-2xl">📸</div><div className="text-xs mt-1">画像を追加</div></div>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = ev => {
                        const newImages = [...images];
                        newImages[i] = ev.target?.result as string;
                        onDataChange({ ...d, images: newImages });
                      };
                      reader.readAsDataURL(file);
                    }
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
              <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-2xl flex-shrink-0">🤖</div>
              <div>
                <div className="font-bold text-indigo-900">LARUbot チャットウィジェット</div>
                <div className="text-indigo-600 text-sm">AIチャットボットが右下に表示されます。訪問者の質問に24時間自動回答。</div>
              </div>
              <div className="ml-auto">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${d.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {d.enabled ? '✅ 有効' : '⭕ 無効'}
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
                  <div className="text-4xl mb-2">📍</div>
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
          <span>✏️ 選択中: {block.type}</span>
        </div>
      )}
      {inner()}
    </div>
  );
}

// ─── Right Panel ───────────────────────────────────────────────────────────────
function RightPanel({ block, onDataChange, seo, onSeoChange, larubot, onLarubotChange, laruseo, onLaruseoChange }: {
  block: Block | null;
  onDataChange: (id: string, data: Record<string, unknown>) => void;
  seo: SEOSettings;
  onSeoChange: (seo: SEOSettings) => void;
  larubot: boolean;
  onLarubotChange: (v: boolean) => void;
  laruseo: boolean;
  onLaruseoChange: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<'block' | 'seo' | 'integrations'>('block');
  const d = block?.data || {};

  const seoScore = [
    seo.title.length > 10,
    seo.description.length > 30,
    seo.keywords.length > 0,
    larubot,
    laruseo,
  ].filter(Boolean).length;

  return (
    <div className="w-64 bg-[#0f172a] border-l border-white/10 flex flex-col flex-shrink-0">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {(['block', 'seo', 'integrations'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-bold transition-colors ${tab === t ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>
            {t === 'block' ? '⚙ ブロック' : t === 'seo' ? '📈 SEO' : '🔗 連携'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {tab === 'block' && (
          <>
            {!block && (
              <div className="text-slate-500 text-center py-8">
                <div className="text-3xl mb-3">👆</div>
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
                  <span className="text-slate-400 block mb-1">背景画像URL（任意）</span>
                  <input type="text" value={d.bgImage as string || ''} placeholder="https://..."
                    onChange={e => onDataChange(block.id, { ...d, bgImage: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                </label>
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
              <label className="block">
                <span className="text-slate-400 block mb-1">カラム数</span>
                <select value={d.columns as string} onChange={e => onDataChange(block.id, { ...d, columns: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white">
                  <option value="2">2カラム</option>
                  <option value="3">3カラム</option>
                </select>
              </label>
            )}
            {block?.type === 'image' && (
              <>
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
            {block && !['hero','cta','divider','services','image','larubot','video','map','countdown','price-table','booking'].includes(block.type) && (
              <div className="text-slate-500 py-4 text-center">
                キャンバス上でクリックしてテキストを直接編集できます
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

            <div className="border-t border-white/10 pt-3">
              <div className="text-slate-400 mb-2">OG（SNSシェア設定）</div>
              <label className="block mb-2">
                <span className="text-slate-500 block mb-1">OGタイトル</span>
                <input type="text" value={seo.ogTitle} placeholder="SNSでシェアされた時のタイトル"
                  onChange={e => onSeoChange({ ...seo, ogTitle: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
              </label>
              <label className="block">
                <span className="text-slate-500 block mb-1">OG説明文</span>
                <textarea value={seo.ogDescription} rows={2} placeholder="SNSでシェアされた時の説明文"
                  onChange={e => onSeoChange({ ...seo, ogDescription: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white resize-none" />
              </label>
            </div>
          </>
        )}

        {tab === 'integrations' && (
          <>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <div>
                  <div className="font-bold text-white text-[11px]">LARUbot AI</div>
                  <div className="text-slate-500 text-[10px]">チャットボット</div>
                </div>
              </div>
              <button
                onClick={() => onLarubotChange(!larubot)}
                className={`w-10 h-5 rounded-full transition-colors relative ${larubot ? 'bg-blue-500' : 'bg-white/20'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${larubot ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">📈</span>
                <div>
                  <div className="font-bold text-white text-[11px]">LARU SEO</div>
                  <div className="text-slate-500 text-[10px]">AI SEO最適化</div>
                </div>
              </div>
              <button
                onClick={() => onLaruseoChange(!laruseo)}
                className={`w-10 h-5 rounded-full transition-colors relative ${laruseo ? 'bg-blue-500' : 'bg-white/20'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${laruseo ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📊</span>
                <span className="font-bold text-sm">Google Analytics</span>
              </div>
              <input type="text" placeholder="G-XXXXXXXXXX"
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
              <div className="text-slate-500 text-[10px] mt-1">トラッキングIDを入力</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🗺</span>
                <span className="font-bold text-sm">Google Maps</span>
              </div>
              <input type="text" placeholder="Maps Embed URL"
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-[10px]" />
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
  };

  const [site, setSite] = useState<SiteData>(defaultSiteData);
  const [currentPageId, setCurrentPageId] = useState<string>('page-main');
  const [dbSiteId, setDbSiteId] = useState<string | null>(siteId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [onboardingData, setOnboardingData] = useState<Record<string, unknown> | null>(null);
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

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
              pages = [{ id: 'page-main', name: 'トップページ', path: '/', blocks: rawBlocks, seo: s.seo_json || emptySeo }];
            } else if (rawBlocks?.v === 2 && rawBlocks.pages) {
              pages = rawBlocks.pages;
            } else {
              pages = [{ id: 'page-main', name: 'トップページ', path: '/', blocks: [], seo: s.seo_json || emptySeo }];
            }
            setSite({
              siteName: s.name,
              pages,
              colorScheme: s.settings_json?.colorScheme || 'professional-blue',
              larubot: s.settings_json?.larubot ?? true,
              laruseo: s.settings_json?.laruseo ?? true,
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

      const template = getTemplateForIndustry(d.industry);
      let blocks: Block[];
      if (template) {
        blocks = applyTemplateData(template, {
          name: d.businessName,
          address: d.address,
          description: d.description,
          catchphrase: d.catchphrase,
          phone: d.phone,
          services: d.services || [],
          hours: d.hours || [],
        });
      } else {
        const heroBlock = defaultBlock('hero');
        heroBlock.data = { ...heroBlock.data, heading: d.businessName || 'ここに見出しを入力', subheading: d.catchphrase || 'キャッチフレーズを入力してください' };
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
            title: `${d.businessName || ''} | ${(d.address || '').split('都')[0]}`,
            description: (d.description || '').slice(0, 160),
            keywords: '',
            ogTitle: d.businessName || '',
            ogDescription: d.catchphrase || '',
          },
        }],
        colorScheme: d.colorScheme || 'professional-blue',
        larubot: d.larubot ?? true,
        laruseo: d.laruseo ?? true,
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
    setSite(prev => ({
      ...prev,
      pages: prev.pages.map(p =>
        p.id === currentPageId ? { ...p, blocks: p.blocks.filter(b => b.id !== id) } : p
      ),
    }));
    setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
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

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name: site.siteName,
      blocks_json: { v: 2, pages: site.pages },
      seo_json: site.pages[0]?.seo || emptySeo,
      settings_json: { colorScheme: site.colorScheme, larubot: site.larubot, laruseo: site.laruseo },
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
          settings_json: { colorScheme: site.colorScheme, larubot: site.larubot, laruseo: site.laruseo },
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
    if (data.success) {
      setPublished(true);
      setPublishedSlug(data.slug);
    }
    setPublishing(false);
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

  return (
    <div className="h-screen bg-[#030712] text-white flex flex-col overflow-hidden">
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
          <button
            onClick={handleAiGenerate}
            disabled={aiGenerating}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 disabled:opacity-50"
          >
            {aiGenerating ? '🤖 生成中...' : '🤖 AI生成'}
          </button>
          <button
            onClick={() => setPreview(!preview)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${preview ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
          >
            {preview ? '✏️ 編集' : '👁 プレビュー'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${saved ? 'bg-green-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'} disabled:opacity-50`}
          >
            {saving ? '保存中...' : saved ? '✅ 保存済み' : '💾 保存'}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold transition-all text-white disabled:opacity-50"
          >
            {publishing ? '公開中...' : published ? '🔄 再公開' : '🚀 公開する'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Block Palette */}
        {!preview && (
          <div className="w-44 bg-[#0f172a] border-r border-white/10 overflow-y-auto flex-shrink-0">
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
                        <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
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
        <div className="flex-1 overflow-y-auto bg-gray-200">
          <div className={`${preview ? 'min-h-full' : 'min-h-full py-6 px-4'}`}>
            <div className={`bg-white shadow-2xl mx-auto transition-all ${preview ? 'max-w-none rounded-none' : 'max-w-3xl rounded-xl overflow-hidden'}`}>
              {currentPage.blocks.length === 0 && (
                <div className="h-64 flex items-center justify-center text-gray-400 text-center">
                  <div>
                    <div className="text-4xl mb-3">📄</div>
                    <div className="font-medium">左のパレットからブロックを追加してください</div>
                  </div>
                </div>
              )}
              {currentPage.blocks.map((block, index) => (
                <div key={block.id} className="relative group">
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
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl text-white cursor-pointer shadow-lg hover:scale-110 transition-transform" style={{ backgroundColor: '#4f46e5' }}>
                    🤖
                  </div>
                </div>
              )}
            </div>
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
          />
        )}
      </div>

      {!preview && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#1e293b] border border-white/10 rounded-2xl px-5 py-2.5 text-xs text-slate-400 flex items-center gap-3 shadow-2xl z-20">
          <span>💡</span>
          <span>ブロックをクリックして選択 · テキストをクリックして直接編集 · 左パネルからブロックを追加 · タブ名をダブルクリックで変更</span>
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
