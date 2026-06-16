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
  | 'hours' | 'gallery' | 'larubot';

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

interface SiteData {
  siteName: string;
  blocks: Block[];
  seo: SEOSettings;
  colorScheme: string;
  larubot: boolean;
  laruseo: boolean;
}

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
  { group: '連携', items: [
    { type: 'larubot' as BlockType, label: 'LARUbot', icon: '🤖' },
  ]},
];

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
          <div className="min-h-[360px] flex flex-col items-center justify-center text-center px-8 py-16" style={{ backgroundColor: d.bgColor as string, color: d.textColor as string }}>
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
            {block && !['hero','cta','divider','services','image','larubot'].includes(block.type) && (
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
              <textarea value={seo.description} rows={3} placeholder="例: 渋谷区の整体院。腰痛・肩こりを根本から改善。初回1,000円オフ。ご予約はこちら。"
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

            <div className="border-t border-white/10 pt-3">
              <div className="text-slate-400 mb-2">自動設定済み ✅</div>
              <div className="space-y-1 text-[10px] text-slate-500">
                <div>✅ 構造化データ（JSON-LD）</div>
                <div>✅ robots.txt</div>
                <div>✅ sitemap.xml</div>
                <div>✅ canonical URL</div>
                <div>✅ Core Web Vitals最適化</div>
                <div>✅ モバイル対応</div>
              </div>
            </div>
          </>
        )}

        {tab === 'integrations' && (
          <>
            <div className={`rounded-xl border p-3 cursor-pointer transition-all ${larubot ? 'bg-indigo-500/20 border-indigo-500/40' : 'bg-white/5 border-white/10'}`}
              onClick={() => onLarubotChange(!larubot)}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🤖</span>
                  <div>
                    <div className="font-bold text-sm">LARUbot</div>
                    <div className="text-slate-500 text-[10px]">AIチャットボット</div>
                  </div>
                </div>
                <div className={`w-8 h-5 rounded-full relative transition-all ${larubot ? 'bg-indigo-500' : 'bg-white/20'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${larubot ? 'left-4' : 'left-1'}`} />
                </div>
              </div>
            </div>

            <div className={`rounded-xl border p-3 cursor-pointer transition-all ${laruseo ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-white/5 border-white/10'}`}
              onClick={() => onLaruseoChange(!laruseo)}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  <div>
                    <div className="font-bold text-sm">LARUSEO</div>
                    <div className="text-slate-500 text-[10px]">SEO分析ツール</div>
                  </div>
                </div>
                <div className={`w-8 h-5 rounded-full relative transition-all ${laruseo ? 'bg-emerald-500' : 'bg-white/20'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${laruseo ? 'left-4' : 'left-1'}`} />
                </div>
              </div>
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
    blocks: [
      defaultBlock('hero'),
      defaultBlock('heading'),
      defaultBlock('services'),
      defaultBlock('divider'),
      defaultBlock('contact'),
    ],
    seo: { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '' },
    colorScheme: 'professional-blue',
    larubot: true,
    laruseo: true,
  };

  const [site, setSite] = useState<SiteData>(defaultSiteData);
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

  // Load site from API or onboarding
  useEffect(() => {
    if (siteId) {
      // Load existing site from Supabase
      fetch(`/api/sites/${siteId}`)
        .then(r => r.json())
        .then(({ site: s }) => {
          if (s) {
            setSite({
              siteName: s.name,
              blocks: s.blocks_json,
              seo: s.seo_json,
              colorScheme: s.settings_json?.colorScheme || 'professional-blue',
              larubot: s.settings_json?.larubot ?? true,
              laruseo: s.settings_json?.laruseo ?? true,
            });
            setPublished(s.published);
            setPublishedSlug(s.slug);
          }
        })
        .catch(() => {});
    } else if (fromOnboarding && typeof window !== 'undefined') {
      // Load from onboarding wizard data
      const raw = localStorage.getItem('laruHP_data');
      if (!raw) return;
      const d = JSON.parse(raw);
      setOnboardingData(d);

      // Use industry template if available
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
        // Fallback: manual block construction
        const heroBlock = defaultBlock('hero');
        heroBlock.data = {
          ...heroBlock.data,
          heading: d.businessName || 'ここに見出しを入力',
          subheading: d.catchphrase || 'キャッチフレーズを入力してください',
        };
        blocks = [heroBlock, defaultBlock('services'), defaultBlock('contact')];
        if (d.larubot) blocks.push(defaultBlock('larubot'));
      }

      setSite({
        siteName: d.businessName || 'マイサイト',
        blocks,
        seo: {
          title: `${d.businessName || ''} | ${(d.address || '').split('都')[0]}`,
          description: (d.description || '').slice(0, 160),
          keywords: '',
          ogTitle: d.businessName || '',
          ogDescription: d.catchphrase || '',
        },
        colorScheme: d.colorScheme || 'professional-blue',
        larubot: d.larubot ?? true,
        laruseo: d.laruseo ?? true,
      });
    } else {
      // Load from localStorage as fallback
      const saved = typeof window !== 'undefined' ? localStorage.getItem('laruHP_builder') : null;
      if (saved) setSite(JSON.parse(saved));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LocalStorage auto-save
  useEffect(() => {
    if (!siteId) localStorage.setItem('laruHP_builder', JSON.stringify(site));
  }, [site, siteId]);

  const selectedBlock = site.blocks.find(b => b.id === selectedId) || null;

  const updateBlockData = useCallback((id: string, data: Record<string, unknown>) => {
    setSite(prev => ({ ...prev, blocks: prev.blocks.map(b => b.id === id ? { ...b, data } : b) }));
  }, []);

  const moveBlock = (id: string, dir: -1 | 1) => {
    setSite(prev => {
      const blocks = [...prev.blocks];
      const i = blocks.findIndex(b => b.id === id);
      const ni = i + dir;
      if (ni < 0 || ni >= blocks.length) return prev;
      [blocks[i], blocks[ni]] = [blocks[ni], blocks[i]];
      return { ...prev, blocks };
    });
  };

  const deleteBlock = (id: string) => {
    setSite(prev => ({ ...prev, blocks: prev.blocks.filter(b => b.id !== id) }));
    setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
    setSite(prev => {
      const blocks = [...prev.blocks];
      const i = blocks.findIndex(b => b.id === id);
      const newBlock = { ...blocks[i], id: `block-${Date.now()}`, data: { ...blocks[i].data } };
      blocks.splice(i + 1, 0, newBlock);
      return { ...prev, blocks };
    });
  };

  const addBlock = (type: BlockType, afterId?: string) => {
    const block = defaultBlock(type);
    setSite(prev => {
      const blocks = [...prev.blocks];
      if (afterId) {
        const i = blocks.findIndex(b => b.id === afterId);
        blocks.splice(i + 1, 0, block);
      } else {
        blocks.push(block);
      }
      return { ...prev, blocks };
    });
    setSelectedId(block.id);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name: site.siteName,
      blocks_json: site.blocks,
      seo_json: site.seo,
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
      // Save first
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: site.siteName,
          blocks_json: site.blocks,
          seo_json: site.seo,
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
        seo: {
          ...prev.seo,
          title: generated.seoTitle || prev.seo.title,
          description: generated.seoDescription || prev.seo.description,
          keywords: generated.keywords || prev.seo.keywords,
        },
        blocks: prev.blocks.map(b => {
          if (b.type === 'hero') return { ...b, data: { ...b.data, heading: generated.heroHeading || b.data.heading, subheading: generated.heroSubheading || b.data.subheading } };
          if (b.type === 'heading') return { ...b, data: { ...b.data, text: generated.aboutHeading || b.data.text } };
          if (b.type === 'paragraph') return { ...b, data: { ...b.data, text: generated.aboutText || b.data.text } };
          if (b.type === 'cta') return { ...b, data: { ...b.data, buttonText: generated.ctaText || b.data.buttonText } };
          return b;
        }),
      }));
    }
    setAiGenerating(false);
  };

  return (
    <div className="h-screen bg-[#030712] text-white flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f172a] border-b border-white/10 flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          <Link href="/laruHP/dashboard" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <div className="w-7 h-7 bg-white text-black rounded-lg flex items-center justify-center font-black text-xs">L</div>
            <span className="hidden sm:block font-bold">LARU<span className="text-blue-400 font-light">HP</span></span>
          </Link>
          <span className="text-slate-700">/</span>
          <input
            type="text"
            value={site.siteName}
            onChange={e => setSite(prev => ({ ...prev, siteName: e.target.value }))}
            className="bg-transparent border-b border-transparent hover:border-white/30 focus:border-blue-500 text-sm font-bold outline-none transition-colors px-1 py-0.5 w-32"
          />
          {published && publishedSlug && (
            <a href={`/hp/${publishedSlug}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 border border-green-500/30 px-2 py-1 rounded-lg">
              🟢 公開中
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
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
              {site.blocks.length === 0 && (
                <div className="h-64 flex items-center justify-center text-gray-400 text-center">
                  <div>
                    <div className="text-4xl mb-3">📄</div>
                    <div className="font-medium">左のパレットからブロックを追加してください</div>
                  </div>
                </div>
              )}
              {site.blocks.map((block, index) => (
                <div key={block.id} className="relative group">
                  <BlockCanvas
                    block={block}
                    selected={selectedId === block.id && !preview}
                    onSelect={() => !preview && setSelectedId(block.id)}
                    onDataChange={(data) => updateBlockData(block.id, data)}
                  />
                  {/* Block controls (visible on hover when not in preview) */}
                  {!preview && (
                    <div className={`absolute right-2 flex flex-col gap-1 z-20 transition-opacity ${selectedId === block.id ? 'opacity-100 top-2' : 'opacity-0 group-hover:opacity-100 top-2'}`}>
                      <button onClick={() => moveBlock(block.id, -1)} disabled={index === 0}
                        className="w-6 h-6 bg-blue-500 text-white rounded text-xs flex items-center justify-center disabled:opacity-30 hover:bg-blue-600">↑</button>
                      <button onClick={() => moveBlock(block.id, 1)} disabled={index === site.blocks.length - 1}
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
            seo={site.seo}
            onSeoChange={seo => setSite(prev => ({ ...prev, seo }))}
            larubot={site.larubot}
            onLarubotChange={v => setSite(prev => ({ ...prev, larubot: v }))}
            laruseo={site.laruseo}
            onLaruseoChange={v => setSite(prev => ({ ...prev, laruseo: v }))}
          />
        )}
      </div>

      {/* Publish overlay hint */}
      {!preview && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#1e293b] border border-white/10 rounded-2xl px-5 py-2.5 text-xs text-slate-400 flex items-center gap-3 shadow-2xl z-20">
          <span>💡</span>
          <span>ブロックをクリックして選択 · テキストをクリックして直接編集 · 左パネルからブロックを追加</span>
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
