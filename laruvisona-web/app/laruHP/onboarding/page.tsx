'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const INDUSTRIES = [
  { id: 'restaurant',   icon: '🍽️', name: '飲食店・カフェ',     desc: 'レストラン、居酒屋、カフェ、ラーメン店など',         color: 'orange', popular: true },
  { id: 'beauty',       icon: '✂️', name: '美容室・サロン',     desc: '美容室、ネイルサロン、エステ、スパなど',            color: 'pink',   popular: true },
  { id: 'clinic',       icon: '🏥', name: '整体・クリニック',   desc: '整体院、接骨院、歯科、医療クリニックなど',          color: 'teal',   popular: true },
  { id: 'legal',        icon: '⚖️', name: '士業・コンサル',     desc: '弁護士、税理士、行政書士、コンサルタントなど',      color: 'indigo' },
  { id: 'construction', icon: '🏗️', name: '建設・工務店',       desc: 'リフォーム、建設、内装工事、外構など',              color: 'yellow' },
  { id: 'realestate',   icon: '🏠', name: '不動産',             desc: '賃貸仲介、売買、管理、不動産投資など',              color: 'blue' },
  { id: 'retail',       icon: '🛍️', name: '小売・EC',           desc: '実店舗、オンラインショップ、専門店など',            color: 'purple' },
  { id: 'fitness',      icon: '💪', name: 'フィットネス・ジム', desc: 'パーソナルジム、ヨガスタジオ、スポーツクラブなど', color: 'green' },
  { id: 'hotel',        icon: '🏨', name: 'ホテル・旅館',       desc: 'ホテル、旅館、民泊、グランピングなど',              color: 'amber' },
  { id: 'education',    icon: '📚', name: '教育・スクール',     desc: '塾、教室、スクール、研修機関など',                  color: 'cyan' },
  { id: 'wedding',      icon: '💒', name: '結婚式場・イベント', desc: 'ウェディング、イベントホール、パーティーなど',      color: 'rose' },
  { id: 'pet',          icon: '🐾', name: 'ペットサロン',       desc: 'トリミング、ペットホテル、動物病院など',            color: 'lime' },
  { id: 'dental',       icon: '🦷', name: '歯科クリニック',     desc: '歯科医院、矯正歯科、審美歯科など',                  color: 'sky' },
  { id: 'photo',        icon: '📷', name: 'フォトスタジオ',     desc: 'フォトスタジオ、カメラマン、写真館など',            color: 'stone' },
  { id: 'accounting',   icon: '📊', name: '税理士・会計士',     desc: '税理士、会計士、行政書士、社労士など',              color: 'blue' },
  { id: 'other',        icon: '✨', name: 'その他',             desc: '上記に当てはまらない業種',                          color: 'slate' },
];

const INDUSTRY_COLOR_MAP: Record<string, string> = {
  restaurant: 'warm-earth',
  beauty: 'modern-pink',
  clinic: 'fresh-green',
  legal: 'elegant-dark',
  construction: 'bold-orange',
  realestate: 'professional-blue',
  retail: 'bold-orange',
  fitness: 'bold-orange',
  hotel: 'elegant-dark',
  education: 'professional-blue',
  wedding: 'elegant-dark',
  pet: 'fresh-green',
  dental: 'professional-blue',
  photo: 'elegant-dark',
  accounting: 'professional-blue',
  other: 'professional-blue',
};

// TEMPLATE_PRESETS removed — replaced with free color picker (primaryColor)


const INDUSTRY_DESIGN_MAP: Record<string, { designStyle: string; fontFamily: string; primaryColor: string; accentColor: string }> = {
  restaurant:   { designStyle: 'rounded',  fontFamily: 'rounded', primaryColor: '#c05621', accentColor: '#f59e0b' },
  beauty:       { designStyle: 'elegant',  fontFamily: 'mincho',  primaryColor: '#831843', accentColor: '#f9a8d4' },
  clinic:       { designStyle: 'modern',   fontFamily: 'noto',    primaryColor: '#065f46', accentColor: '#34d399' },
  legal:        { designStyle: 'minimal',  fontFamily: 'biz',     primaryColor: '#1e293b', accentColor: '#3b82f6' },
  construction: { designStyle: 'bold',     fontFamily: 'zen',     primaryColor: '#92400e', accentColor: '#fbbf24' },
  realestate:   { designStyle: 'sharp',    fontFamily: 'zen',     primaryColor: '#1e3a8a', accentColor: '#60a5fa' },
  retail:       { designStyle: 'rounded',  fontFamily: 'noto',    primaryColor: '#7c3aed', accentColor: '#f472b6' },
  fitness:      { designStyle: 'bold',     fontFamily: 'zen',     primaryColor: '#dc2626', accentColor: '#fbbf24' },
  hotel:        { designStyle: 'elegant',  fontFamily: 'mincho',  primaryColor: '#78350f', accentColor: '#fcd34d' },
  education:    { designStyle: 'rounded',  fontFamily: 'noto',    primaryColor: '#1d4ed8', accentColor: '#34d399' },
  wedding:      { designStyle: 'elegant',  fontFamily: 'mincho',  primaryColor: '#9d174d', accentColor: '#fda4af' },
  pet:          { designStyle: 'rounded',  fontFamily: 'rounded', primaryColor: '#166534', accentColor: '#86efac' },
  dental:       { designStyle: 'modern',   fontFamily: 'noto',    primaryColor: '#0369a1', accentColor: '#7dd3fc' },
  photo:        { designStyle: 'minimal',  fontFamily: 'kaisei',  primaryColor: '#374151', accentColor: '#f59e0b' },
  accounting:   { designStyle: 'minimal',  fontFamily: 'biz',     primaryColor: '#1e3a5f', accentColor: '#60a5fa' },
  other:        { designStyle: 'modern',   fontFamily: 'noto',    primaryColor: '#1e3a8a', accentColor: '#f59e0b' },
};

const DAYS = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];

interface FormData {
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
  designStyle: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  heroLayout: 'center' | 'left' | 'split';
  headerStyle: 'transparent' | 'solid' | 'colored';
  animLevel: 'none' | 'subtle' | 'full';
  larubot: boolean;
  laruseo: boolean;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
}

const defaultHours = DAYS.map(day => ({
  day, open: '09:00', close: '18:00', closed: day === '日曜日',
}));

const defaultForm: FormData = {
  industry: '', businessName: '', address: '', phone: '', email: '',
  website: '', description: '', catchphrase: '',
  services: [
    { name: '', description: '', price: '' },
  ],
  hours: defaultHours,
  colorScheme: 'professional-blue',
  style: 'modern',
  designStyle: 'modern',
  primaryColor: '#1e3a8a',
  accentColor: '#f59e0b',
  fontFamily: 'noto',
  heroLayout: 'center',
  headerStyle: 'transparent',
  animLevel: 'full',
  larubot: true,
  laruseo: true,
  clientName: '',
  clientEmail: '',
  clientPhone: '',
};

const STEPS = ['業種選択', 'ビジネス情報', 'デザイン', 'コンテンツ', '確認・生成'];
const STEP_TIMES = ['約30秒', '約1分', '約1分', '約2分', '約30秒'];

const GENERATE_STEPS = [
  'ビジネス情報を解析',
  'キャッチコピー・ヒーロー見出しを生成',
  '3つの強み・紹介文を作成',
  'FAQ・お客様の声を生成',
  'SEO設定を最適化',
  'テンプレートにデータを適用',
];

const HOURS_PRESETS = [
  { label: '平日 9〜18時', fn: (h: typeof defaultForm.hours) => h.map((d, i) => ({ ...d, open: '09:00', close: '18:00', closed: i >= 5 })) },
  { label: '毎日 10〜19時', fn: (h: typeof defaultForm.hours) => h.map(d => ({ ...d, open: '10:00', close: '19:00', closed: false })) },
  { label: '年中無休 11〜22時', fn: (h: typeof defaultForm.hours) => h.map(d => ({ ...d, open: '11:00', close: '22:00', closed: false })) },
  { label: '土日定休 9〜18時', fn: (h: typeof defaultForm.hours) => h.map((d, i) => ({ ...d, open: '09:00', close: '18:00', closed: i >= 5 })) },
];


const FONT_MAP: Record<string, string> = {
  noto:    '"Noto Sans JP", sans-serif',
  zen:     '"Zen Kaku Gothic New", sans-serif',
  mincho:  '"Noto Serif JP", serif',
  rounded: '"M PLUS Rounded 1c", sans-serif',
  biz:     '"BIZ UDPGothic", sans-serif',
  kaisei:  '"Kaisei Decol", serif',
};
const FONT_LABEL: Record<string, string> = {
  noto: 'Noto Sans JP', zen: 'Zen Gothic', mincho: '明朝体', rounded: '丸ゴシック', biz: 'BIZ Gothic', kaisei: 'Kaisei',
};
const FONT_IMPORT = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Noto+Serif+JP:wght@400;700&family=Zen+Kaku+Gothic+New:wght@400;700;900&family=M+PLUS+Rounded+1c:wght@400;700&family=BIZ+UDPGothic:wght@400;700&family=Kaisei+Decol:wght@400;700&display=swap';

function LivePreview({ form }: { form: FormData }) {
  const color      = form.primaryColor || '#1e3a8a';
  const accent     = form.accentColor  || '#f59e0b';
  const ds         = form.designStyle  || 'modern';
  const ff         = form.fontFamily   || 'noto';
  const heroLayout = form.heroLayout   || 'center';
  const headerStyle = form.headerStyle || 'transparent';
  const animLevel  = form.animLevel    || 'full';
  const industry    = INDUSTRIES.find(i => i.id === form.industry);
  const filledSvcs  = form.services.filter(s => s.name);
  const displaySvcs = filledSvcs.length > 0
    ? filledSvcs.slice(0, 3)
    : [{ name: 'サービスA', price: '¥5,000' }, { name: 'サービスB', price: '¥8,000' }, { name: 'サービスC', price: '¥12,000' }];

  const fontFamily  = FONT_MAP[ff]    ?? FONT_MAP.noto;
  const fontLabel   = FONT_LABEL[ff]  ?? 'Noto Sans JP';

  // ── per-style tokens ──────────────────────────────────────────────
  type Cfg = {
    dark: boolean;           // true = hero is dark bg → white text
    heroBg: string;
    heroExtra?: React.CSSProperties;
    heroBottom?: React.ReactNode;  // wave/diagonal clip overlay
    btnR: string;            // border-radius for primary button
    btnStyle: React.CSSProperties;
    btn2Style: React.CSSProperties;
    cardR: string;
    cardStyle: React.CSSProperties;
    featureBg: string;
    featureCardStyle: React.CSSProperties;
    ctaBg: string;
    ctaDark: boolean;
    ctaBtnStyle: React.CSSProperties;
    footerBg: string;
    headingPrefix?: string;
    accentLine?: boolean;
  };

  const cfgMap: Record<string, Cfg> = {
    modern: {
      dark: true,
      heroBg: `linear-gradient(135deg, ${color} 0%, ${color}bb 100%)`,
      btnR: '9999px',
      btnStyle:  { borderRadius: '9999px', background: 'rgba(255,255,255,0.9)', color, fontWeight: 700 },
      btn2Style: { borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.8)' },
      cardR: '10px',
      cardStyle: { borderRadius: '10px', background: '#f8fafc', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' },
      featureBg: '#f1f5f9',
      featureCardStyle: { borderRadius: '10px', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
      ctaBg: color,
      ctaDark: true,
      ctaBtnStyle: { borderRadius: '9999px', background: 'white', color, fontWeight: 700 },
      footerBg: '#1e293b',
    },
    minimal: {
      dark: false,
      heroBg: '#f8fafc',
      heroExtra: { borderLeft: `3px solid ${color}`, paddingLeft: '12px' },
      btnR: '4px',
      btnStyle:  { borderRadius: '4px', border: `1px solid ${color}`, color, background: 'transparent', fontWeight: 600 },
      btn2Style: { borderRadius: '4px', border: '1px solid #cbd5e1', color: '#64748b' },
      cardR: '4px',
      cardStyle: { borderRadius: '4px', background: '#f8fafc', borderLeft: `2px solid ${color}`, paddingLeft: '6px' },
      featureBg: 'white',
      featureCardStyle: { borderRadius: '2px', background: 'white', borderBottom: '1px solid #e2e8f0' },
      ctaBg: '#f1f5f9',
      ctaDark: false,
      ctaBtnStyle: { borderRadius: '4px', border: `1px solid ${color}`, color, background: 'transparent', fontWeight: 600 },
      footerBg: '#f8fafc',
      accentLine: true,
    },
    bold: {
      dark: true,
      heroBg: color,
      heroBottom: (
        <div style={{ height: '16px', background: '#0f172a', clipPath: 'polygon(0 100%, 100% 0, 100% 100%)', marginTop: '-1px' }} />
      ),
      btnR: '3px',
      btnStyle:  { borderRadius: '3px', background: 'white', color, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
      btn2Style: { borderRadius: '3px', border: '2px solid rgba(255,255,255,0.5)', color: 'white' },
      cardR: '3px',
      cardStyle: { borderRadius: '3px', background: '#1e293b', transform: 'skewX(-0.5deg)', border: '1px solid #334155' },
      featureBg: '#0f172a',
      featureCardStyle: { borderRadius: '3px', background: '#1e293b', borderTop: `2px solid ${color}` },
      ctaBg: '#0f172a',
      ctaDark: true,
      ctaBtnStyle: { borderRadius: '3px', background: color, color: 'white', fontWeight: 900, textTransform: 'uppercase' as const },
      footerBg: '#020617',
      headingPrefix: '// ',
    },
    elegant: {
      dark: true,
      heroBg: `linear-gradient(180deg, ${color} 0%, ${color}cc 100%)`,
      heroExtra: { textAlign: 'center' as const },
      btnR: '2px',
      btnStyle:  { borderRadius: '2px', border: '1px solid rgba(255,255,255,0.7)', color: 'white', background: 'transparent', letterSpacing: '0.1em' },
      btn2Style: { borderRadius: '2px', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.6)' },
      cardR: '4px',
      cardStyle: { borderRadius: '4px', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)' },
      featureBg: `${color}22`,
      featureCardStyle: { borderRadius: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' as const },
      ctaBg: `${color}dd`,
      ctaDark: true,
      ctaBtnStyle: { borderRadius: '2px', border: '1px solid rgba(255,255,255,0.7)', color: 'white', background: 'transparent', letterSpacing: '0.1em' },
      footerBg: `${color}22`,
    },
    rounded: {
      dark: true,
      heroBg: `linear-gradient(135deg, ${color} 0%, ${color}99 100%)`,
      heroBottom: (
        <div style={{ height: '20px', background: '#f0fdf4', borderRadius: '50% 50% 0 0 / 100% 100% 0 0', marginTop: '-10px', position: 'relative', zIndex: 1 }} />
      ),
      btnR: '9999px',
      btnStyle:  { borderRadius: '9999px', background: 'white', color, fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
      btn2Style: { borderRadius: '9999px', border: '2px solid rgba(255,255,255,0.5)', color: 'white' },
      cardR: '20px',
      cardStyle: { borderRadius: '20px', background: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
      featureBg: '#f0fdf4',
      featureCardStyle: { borderRadius: '16px', background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
      ctaBg: `linear-gradient(135deg, ${color}cc 0%, ${color} 100%)`,
      ctaDark: true,
      ctaBtnStyle: { borderRadius: '9999px', background: 'white', color, fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
      footerBg: '#f0fdf4',
    },
    sharp: {
      dark: true,
      heroBg: '#030712',
      heroExtra: { borderLeft: `3px solid ${color}` },
      heroBottom: (
        <div style={{ height: '12px', background: '#111827', clipPath: 'polygon(0 0, 85% 0, 100% 100%, 0 100%)', marginTop: '-1px' }} />
      ),
      btnR: '0px',
      btnStyle:  { borderRadius: '0', background: color, color: 'white', fontWeight: 900, letterSpacing: '0.08em', borderLeft: `3px solid white` },
      btn2Style: { borderRadius: '0', border: `1px solid ${color}`, color },
      cardR: '0px',
      cardStyle: { borderRadius: '0', background: '#111827', borderTop: `2px solid ${color}`, border: '1px solid #1f2937' },
      featureBg: '#030712',
      featureCardStyle: { borderRadius: '0', background: '#111827', border: '1px solid #1f2937', borderLeft: `3px solid ${color}` },
      ctaBg: '#111827',
      ctaDark: true,
      ctaBtnStyle: { borderRadius: '0', background: color, color: 'white', fontWeight: 900, borderLeft: `2px solid white` },
      footerBg: '#020617',
      headingPrefix: '// ',
    },
  };

  const cfg = cfgMap[ds] ?? cfgMap.modern;
  const textColor   = cfg.dark ? 'white' : '#1e293b';
  const subColor    = cfg.dark ? 'rgba(255,255,255,0.55)' : '#64748b';
  const catchphrase = form.catchphrase || (form.businessName ? `${form.businessName}へようこそ` : 'キャッチコピーがここに');

  // headerStyle → navbar background
  const navBg = headerStyle === 'solid'
    ? (cfg.dark ? '#1e293b' : '#f1f5f9')
    : headerStyle === 'colored'
      ? color
      : cfg.heroBg;
  const navTextColor = headerStyle === 'solid' && !cfg.dark ? '#1e293b' : 'white';

  // heroLayout → content alignment + split image
  const heroAlign = heroLayout === 'center' ? 'center' : 'left';
  const heroJustify = heroLayout === 'center' ? 'center' : 'flex-start';

  const SectionHeading = ({ children }: { children: string }) => (
    <div style={{ fontSize: '9px', fontWeight: 700, color: cfg.dark && cfg.featureBg.startsWith('#0') ? 'white' : '#1e293b', marginBottom: '8px', ...(cfg.accentLine ? { borderBottom: `1px solid ${color}`, paddingBottom: '3px', display: 'inline-block' } : {}) }}>
      {cfg.headingPrefix && <span style={{ color }}>{cfg.headingPrefix}</span>}{children}
    </div>
  );

  const animDot = animLevel === 'none'
    ? { width: 6, height: 6, borderRadius: '50%', background: '#475569' }
    : animLevel === 'subtle'
      ? { width: 6, height: 6, borderRadius: '50%', background: accent, opacity: 0.6 }
      : { width: 6, height: 6, borderRadius: '50%', background: accent };

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl text-left select-none" style={{ fontFamily }}>
      {/* load Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style>{`@import url('${FONT_IMPORT}');`}</style>

      {/* Browser chrome */}
      <div className="bg-[#1a2744] px-3 py-2 flex items-center gap-2 border-b border-white/10">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <div className="w-2 h-2 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 bg-white/10 rounded text-[9px] text-slate-400 px-2 py-0.5 font-mono truncate">
          {form.businessName ? `${form.businessName.slice(0, 12).replace(/\s/g, '-').toLowerCase()}.laruvisona.com` : 'your-shop.laruvisona.com'}
        </div>
        <div style={animDot} />
      </div>

      {/* Navbar — driven by headerStyle */}
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: navBg }}>
        <span style={{ color: navTextColor, fontSize: '10px', fontWeight: 700 }} className="truncate max-w-[90px]">
          {form.businessName || 'SHOP NAME'}
        </span>
        <div className="flex gap-2 items-center">
          {['TOP', 'サービス', 'アクセス'].map(l => (
            <span key={l} style={{ color: `${navTextColor}66`, fontSize: '7px' }}>{l}</span>
          ))}
          <div style={{ ...cfg.btnStyle, fontSize: '7px', padding: '2px 7px' }}>予約</div>
        </div>
      </div>

      {/* Hero — driven by heroLayout */}
      <div
        className="px-4 py-5 relative"
        style={{ background: cfg.heroBg, ...cfg.heroExtra, textAlign: heroAlign }}
      >
        {heroLayout === 'split' ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              {industry && (
                <div style={{ display: 'inline-block', fontSize: '7px', padding: '1px 6px', borderRadius: cfg.btnR, border: `1px solid ${cfg.dark ? 'rgba(255,255,255,0.3)' : color}`, color: cfg.dark ? 'rgba(255,255,255,0.8)' : color, marginBottom: '4px' }}>
                  {industry.name}
                </div>
              )}
              <div style={{ color: textColor, fontWeight: 700, fontSize: '10px', lineHeight: 1.4, marginBottom: '4px' }}>
                {cfg.headingPrefix && <span style={{ color }}>{cfg.headingPrefix}</span>}
                {catchphrase.slice(0, 14)}
              </div>
              <div style={{ color: subColor, fontSize: '7px', marginBottom: '8px' }}>サービスのご案内…</div>
              <div style={{ ...cfg.btnStyle, display: 'inline-block', fontSize: '7px', padding: '3px 8px' }}>お問い合わせ</div>
            </div>
            <div style={{ width: 56, height: 52, borderRadius: cfg.cardR, background: cfg.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
              🖼️
            </div>
          </div>
        ) : (
          <>
            {industry && (
              <div style={{ display: 'inline-block', fontSize: '7px', padding: '1px 6px', borderRadius: cfg.btnR, border: `1px solid ${cfg.dark ? 'rgba(255,255,255,0.3)' : color}`, color: cfg.dark ? 'rgba(255,255,255,0.8)' : color, marginBottom: '5px' }}>
                {industry.name}
              </div>
            )}
            <div style={{ color: textColor, fontWeight: 700, fontSize: '11px', lineHeight: 1.4, marginBottom: '4px' }}>
              {cfg.headingPrefix && <span style={{ color }}>{cfg.headingPrefix}</span>}
              {catchphrase.slice(0, 20)}
            </div>
            <div style={{ color: subColor, fontSize: '8px', lineHeight: 1.5, marginBottom: '10px' }}>
              {(form.description || '最高品質のサービスをご提供します').slice(0, 35)}…
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: heroJustify }}>
              <div style={{ ...cfg.btnStyle, fontSize: '8px', padding: '4px 10px' }}>お問い合わせ</div>
              <div style={{ ...cfg.btn2Style, fontSize: '8px', padding: '4px 10px' }}>詳しく見る</div>
            </div>
          </>
        )}
        {ds === 'rounded' && (
          <div style={{ position: 'absolute', top: 4, right: 8, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
        )}
        {ds === 'elegant' && (
          <div style={{ position: 'absolute', left: 8, top: 10, bottom: 10, width: '1px', background: 'rgba(255,255,255,0.2)' }} />
        )}
      </div>
      {cfg.heroBottom}

      {/* Features — accent color on icon bg */}
      <div className="px-3 py-3" style={{ background: cfg.featureBg }}>
        <SectionHeading>3つの強み</SectionHeading>
        <div className="grid grid-cols-3 gap-1.5">
          {(['実績', '安心', '品質'] as const).map((feat, i) => (
            <div key={i} style={{ ...cfg.featureCardStyle, padding: '6px 4px', fontSize: '8px', fontWeight: 600, color: cfg.dark && (cfg.featureBg.startsWith('#0') || cfg.featureBg.startsWith('#1') || cfg.featureBg.startsWith('linear')) ? 'white' : '#374151', textAlign: 'center' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', margin: '0 auto 3px' }}>
                {['⭐', '🛡️', '💎'][i]}
              </div>
              {feat}
            </div>
          ))}
        </div>
      </div>

      {/* Services */}
      <div className="px-3 py-3" style={{ background: ds === 'bold' || ds === 'sharp' ? '#0f172a' : ds === 'elegant' ? `${color}11` : 'white' }}>
        <SectionHeading>{filledSvcs.length > 0 ? 'サービス・料金' : 'サービス（AI生成）'}</SectionHeading>
        <div className="grid grid-cols-3 gap-1.5">
          {displaySvcs.map((s, i) => (
            <div key={i} style={{ ...cfg.cardStyle, padding: '6px 5px', opacity: filledSvcs.length > 0 ? 1 : 0.6 }}>
              <div style={{ fontSize: '8px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: ds === 'bold' || ds === 'sharp' ? '#e2e8f0' : '#374151' }}>{s.name}</div>
              {s.price && <div style={{ fontSize: '7px', marginTop: '2px', color: accent, fontWeight: 600 }}>{s.price}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* CTA section */}
      <div className="px-3 py-4 text-center" style={{ background: cfg.ctaBg }}>
        <div style={{ fontSize: '9px', fontWeight: 700, color: cfg.ctaDark ? 'white' : '#1e293b', marginBottom: '2px' }}>
          {form.businessName || '店舗名'}へのご予約・お問い合わせ
        </div>
        <div style={{ fontSize: '7px', color: cfg.ctaDark ? 'rgba(255,255,255,0.6)' : '#64748b', marginBottom: '7px' }}>
          {form.phone || '無料相談受付中'}
        </div>
        <div style={{ ...cfg.ctaBtnStyle, display: 'inline-block', fontSize: '8px', padding: '5px 14px' }}>
          今すぐ予約する →
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 flex items-center justify-between" style={{ background: cfg.footerBg }}>
        <div style={{ fontSize: '8px', color: ds === 'minimal' ? '#94a3b8' : 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          © {form.businessName || 'SHOP NAME'} {new Date().getFullYear()}
        </div>
        <div className="flex gap-1.5 flex-shrink-0 items-center">
          <span style={{ fontSize: '7px', color: accent, fontFamily: 'monospace' }}>{fontLabel}</span>
          {form.larubot && <div style={{ width: 16, height: 16, borderRadius: cfg.btnR, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', fontWeight: 900, color: 'white' }}>LB</div>}
        </div>
      </div>

      {/* Tags */}
      <div className="bg-[#0f172a] px-3 py-2 flex gap-1 flex-wrap">
        {form.industry && <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">{industry?.name}</span>}
        <span className="text-[8px] bg-white/10 text-slate-400 px-1.5 py-0.5 rounded font-mono">{color.toUpperCase()}</span>
        <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">{ds}</span>
        <span className="text-[8px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">{heroLayout}</span>
        <span className="text-[8px] bg-teal-500/20 text-teal-400 px-1.5 py-0.5 rounded">{animLevel}</span>
        {form.larubot && <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">LARUbot</span>}
        {form.laruseo && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">LARUSEO</span>}
      </div>
    </div>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [stepKey, setStepKey] = useState(0);
  const [slideDir, setSlideDir] = useState<'forward' | 'back'>('forward');
  const [form, setForm] = useState<FormData>({ ...defaultForm });
  const [generating, setGenerating] = useState(false);
  const [completedStepCount, setCompletedStepCount] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isAgency, setIsAgency] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const isAdmin = !!process.env.NEXT_PUBLIC_ADMIN_EMAIL && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      if (isAdmin) { setIsAgency(true); return; }
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
      if (profile?.plan === 'agency') setIsAgency(true);
    })();
  }, []);

  const goStep = (n: number) => {
    setSlideDir(n > step ? 'forward' : 'back');
    setStep(n);
    setStepKey(k => k + 1);
  };

  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // Auto-save form to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('laruHP_onboarding_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm(f => ({ ...f, ...parsed }));
        if (parsed.industry) setStep(2); // resume from step 2 (no animation on restore)
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('laruHP_onboarding_draft', JSON.stringify(form)); } catch {}
  }, [form]);

  // URL scan state
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    const ind = searchParams.get('industry');
    if (ind) {
      setForm(f => ({
        ...f,
        industry: ind,
        colorScheme: INDUSTRY_COLOR_MAP[ind] || f.colorScheme,
      }));
      goStep(2); // skip step 1 when coming from showcase/landing with ?industry=
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleIndustrySelect = (indId: string) => {
    const dm = INDUSTRY_DESIGN_MAP[indId];
    setForm(f => ({
      ...f,
      industry: indId,
      colorScheme: INDUSTRY_COLOR_MAP[indId] || f.colorScheme,
      ...(dm ? { primaryColor: dm.primaryColor, accentColor: dm.accentColor, designStyle: dm.designStyle, fontFamily: dm.fontFamily } : {}),
    }));
    setTimeout(() => goStep(2), 350);
  };

  // Advance with Enter key (skip textarea focus)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (step < 5 && !generating && canNext()) goStep(Math.min(5, step + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, generating, form]);

  // Animate step-by-step progress during generation
  useEffect(() => {
    if (!generating) { setCompletedStepCount(0); return; }
    const delays = [700, 1600, 2800, 4200, 5600, 7000];
    const timers = delays.map((d, i) => setTimeout(() => setCompletedStepCount(i + 1), d));
    return () => timers.forEach(clearTimeout);
  }, [generating]);

  const updateForm = (key: keyof FormData, value: unknown) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const updateService = (i: number, key: string, value: string) => {
    const services = [...form.services];
    services[i] = { ...services[i], [key]: value };
    setForm(f => ({ ...f, services }));
  };

  const updateHour = (i: number, key: string, value: string | boolean) => {
    const hours = [...form.hours];
    hours[i] = { ...hours[i], [key]: value };
    setForm(f => ({ ...f, hours }));
  };

  const addService = () => {
    setForm(f => ({ ...f, services: [...f.services, { name: '', description: '', price: '' }] }));
  };

  const removeService = (i: number) => {
    setForm(f => ({ ...f, services: f.services.filter((_, idx) => idx !== i) }));
  };

  const handleScanUrl = async () => {
    const url = form.website.trim();
    if (!url) return;
    setScanning(true);
    setScanError('');
    setScanDone(false);
    try {
      const res = await fetch('/api/ai/scan-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setScanError(
          data.error === 'fetch_failed' ? 'サイトにアクセスできませんでした（サイト側がアクセスを制限している可能性があります）' :
          data.error === 'no_content' ? 'テキストコンテンツを取得できませんでした（JavaScriptで表示されるサイトは非対応）' :
          data.error === 'api_key_missing' ? 'AI機能が設定されていません（管理者にお問い合わせください）' :
          'スキャンに失敗しました。手動で入力してください。'
        );
        return;
      }
      const { extracted } = data;
      if (extracted) {
        if (extracted.businessName) updateForm('businessName', extracted.businessName);
        if (extracted.phone) updateForm('phone', extracted.phone);
        if (extracted.address) updateForm('address', extracted.address);
        if (extracted.email) updateForm('email', extracted.email);
        if (extracted.description) updateForm('description', extracted.description);
        if (extracted.catchphrase) updateForm('catchphrase', extracted.catchphrase);
        if (extracted.industry && !form.industry) updateForm('industry', extracted.industry);
        if (Array.isArray(extracted.services) && extracted.services.some((s: { name: string }) => s.name)) {
          updateForm('services', extracted.services.slice(0, 5).map((s: { name?: string; description?: string; price?: string }) => ({
            name: s.name || '',
            description: s.description || '',
            price: s.price || '',
          })));
        }
        setScanDone(true);
      }
    } catch {
      setScanError('スキャンに失敗しました。手動で入力してください。');
    } finally {
      setScanning(false);
    }
  };

  const handleGenerate = async () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 1200);
    setGenerating(true);
    setCompletedStepCount(0);

    let aiGenerated = null;
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        aiGenerated = data.generated;
      }
    } catch {}

    // Ensure at least 3 seconds of animation
    await new Promise(r => setTimeout(r, 3000));

    localStorage.setItem('laruHP_data', JSON.stringify({ ...form, aiGenerated }));
    localStorage.removeItem('laruHP_onboarding_draft');
    router.push('/laruHP/builder?from=onboarding');
  };

  const canNext = () => {
    if (step === 1) return !!form.industry;
    if (step === 2) return !!form.businessName;
    if (step === 3) return true;
    return true;
  };

const selectedIndustry = INDUSTRIES.find(i => i.id === form.industry);

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white border-b border-sky-100 shadow-sm backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/laruHP" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sky-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">L</div>
            <span className="font-bold tracking-tight text-gray-900">LARU<span className="text-sky-500 font-light">HP</span></span>
          </Link>
          <div className="flex flex-col items-end">
            <div className="text-gray-500 text-sm">サイト作成ウィザード</div>
            <div className="text-gray-500 text-[11px]">初月1円 · 最低6ヶ月契約</div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 pt-28 pb-20">
        {/* Mobile preview button */}
        <div className="lg:hidden flex justify-end mb-4">
          <button
            onClick={() => setShowMobilePreview(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-600 hover:border-sky-300 transition-all"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            プレビュー
          </button>
        </div>

        {/* Mobile preview modal */}
        {showMobilePreview && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end p-4">
            <div className="w-full max-w-sm mx-auto bg-white rounded-2xl overflow-hidden shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  リアルタイムプレビュー
                </div>
                <button onClick={() => setShowMobilePreview(false)} className="text-gray-400 hover:text-gray-900 text-xl leading-none">✕</button>
              </div>
              <div className="p-4">
                <LivePreview form={form} />
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_320px] gap-10 items-start">
        <div>
        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((_s, i) => (
              <div key={i} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                  i + 1 < step ? 'bg-sky-500 text-white' :
                  i + 1 === step ? 'bg-sky-600 text-white' :
                  'bg-gray-200 text-gray-400'
                }`}>
                  {i + 1 < step ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`hidden sm:block h-[1px] w-12 lg:w-20 mx-1 transition-all ${i + 1 < step ? 'bg-sky-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="hidden sm:flex justify-between text-[10px] text-gray-500 mt-1">
            {STEPS.map((s, i) => (
              <span key={i} className={i + 1 === step ? 'text-gray-900 font-bold' : ''}>{s}</span>
            ))}
          </div>
          <div className="sm:hidden mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500">STEP {step} / {STEPS.length}</span>
              <span className="text-xs text-gray-900 font-bold">{STEPS[step - 1]}</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full transition-all duration-500"
                style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-center text-[11px] text-gray-500 mt-2">
            このステップの目安: <span className="text-gray-600 font-semibold">{STEP_TIMES[step - 1]}</span>
            {step > 1 && <span className="ml-3">合計残り約{['4分30秒', '4分', '3分', '2分', '30秒'][step - 1]}</span>}
          </div>
        </div>

        {/* Animated step content wrapper */}
        <div
          key={stepKey}
          style={{ animation: `${slideDir === 'forward' ? 'stepSlideInRight' : 'stepSlideInLeft'} 0.22s ease-out` }}
        >

        {/* ─── Step 1: Industry ─────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">業種を選んでください</h2>
              <p className="text-gray-600">業種に最適化されたテンプレートとSEO設定が自動で適用されます。</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {INDUSTRIES.map(ind => (
                <button
                  key={ind.id}
                  onClick={() => handleIndustrySelect(ind.id)}
                  className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 relative ${
                    form.industry === ind.id
                      ? 'bg-sky-50 border-2 border-sky-500 shadow-sm'
                      : 'bg-white border border-gray-200 hover:border-sky-300'
                  }`}
                >
                  {ind.popular && (
                    <span className="absolute top-2 right-2 text-[9px] bg-sky-50 text-sky-600 border border-sky-200 px-1.5 py-0.5 rounded-full">人気</span>
                  )}
                  <div className="text-2xl mb-2">{ind.icon}</div>
                  <div className="font-bold text-sm mb-0.5 text-gray-900">{ind.name}</div>
                  <div className="text-gray-500 text-xs leading-tight">{ind.desc}</div>
                </button>
              ))}
            </div>
            <p className="text-center text-gray-500 text-xs mt-6">選択すると自動で次のステップへ進みます</p>
          </div>
        )}

        {/* ─── Step 2: Business Info + URL Scan ────────────────── */}
        {step === 2 && (
          <div>
            {/* Industry breadcrumb */}
            {selectedIndustry && (
              <div className="flex items-center gap-2 mb-6 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
                <span className="text-xl">{selectedIndustry.icon}</span>
                <span className="text-sm text-gray-900 font-medium">{selectedIndustry.name}</span>
                <span className="text-gray-500 text-sm">でサイトを作成中</span>
                <button
                  onClick={() => goStep(1)}
                  className="ml-auto text-sky-600 hover:text-sky-500 text-xs transition-colors"
                >
                  変更
                </button>
              </div>
            )}
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">ビジネス情報を入力</h2>
              <p className="text-gray-600">AIがこの情報をもとにコンテンツを自動生成します。</p>
            </div>

            {/* URL Scan Card */}
            <div className="mb-8 bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-600"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900 mb-0.5">既存サイトをAIスキャン（任意）</div>
                  <div className="text-gray-600 text-xs">既存のホームページがある場合、URLを入力してスキャンすると店舗名・電話番号・住所などを自動入力します。</div>
                </div>
              </div>

              {scanDone ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 flex-shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span className="text-emerald-700 text-sm font-bold">スキャン完了。フォームに自動入力しました。</span>
                  <button onClick={() => setScanDone(false)} className="ml-auto text-gray-500 hover:text-gray-700 text-xs">再スキャン</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.website}
                    onChange={e => updateForm('website', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleScanUrl()}
                    placeholder="https://your-shop.com"
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                  />
                  <button
                    onClick={handleScanUrl}
                    disabled={scanning || !form.website.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-bold transition-all whitespace-nowrap"
                  >
                    {scanning ? (
                      <>
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        解析中...
                      </>
                    ) : 'AIスキャン'}
                  </button>
                </div>
              )}
              {scanError && (
                <p className="text-red-600 text-xs mt-2">{scanError}</p>
              )}
            </div>

            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-900">店舗・会社名 <span className="text-red-500">*</span></label>
                  <input type="text" value={form.businessName} onChange={e => updateForm('businessName', e.target.value)}
                    placeholder="例: 鈴木整体院"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-900">電話番号</label>
                  <input type="tel" value={form.phone} onChange={e => updateForm('phone', e.target.value)}
                    placeholder="例: 03-1234-5678"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-900">住所</label>
                <input type="text" value={form.address} onChange={e => updateForm('address', e.target.value)}
                  placeholder="例: 東京都渋谷区渋谷1-1-1 〇〇ビル2F"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-900">メールアドレス</label>
                <input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)}
                  placeholder="例: info@your-shop.com"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-900">キャッチフレーズ（任意）</label>
                <input type="text" value={form.catchphrase} onChange={e => updateForm('catchphrase', e.target.value)}
                  placeholder="例: 地域No.1の施術技術で、あなたの痛みを根本から解決"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-900">お店・会社の紹介文（任意）</label>
                <textarea value={form.description} onChange={e => updateForm('description', e.target.value)}
                  rows={3}
                  placeholder="例: 2010年に創業した整体院です。延べ10,000人以上の施術実績があり..."
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors resize-none" />
                <p className="text-gray-500 text-xs mt-1">空欄の場合はAIが自動生成します</p>
              </div>

              {isAgency && (
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🏢</span>
                    <div>
                      <div className="text-sm font-bold text-violet-900">クライアント情報（エージェンシー）</div>
                      <div className="text-xs text-violet-600">このサイトを所有するクライアントの情報を入力してください</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold mb-1.5 text-violet-800">クライアント名</label>
                      <input type="text" value={form.clientName} onChange={e => updateForm('clientName', e.target.value)}
                        placeholder="例: 株式会社〇〇 / 田中太郎様"
                        className="w-full bg-white border border-violet-200 rounded-xl px-4 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-400 transition-colors" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold mb-1.5 text-violet-800">クライアントメール</label>
                        <input type="email" value={form.clientEmail} onChange={e => updateForm('clientEmail', e.target.value)}
                          placeholder="client@example.com"
                          className="w-full bg-white border border-violet-200 rounded-xl px-4 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-400 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1.5 text-violet-800">クライアント電話</label>
                        <input type="tel" value={form.clientPhone} onChange={e => updateForm('clientPhone', e.target.value)}
                          placeholder="090-1234-5678"
                          className="w-full bg-white border border-violet-200 rounded-xl px-4 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-400 transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Step 3: Visual Template ─────────────────────────── */}
        {step === 3 && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">デザインを設定</h2>
              <p className="text-gray-600">ブランドカラー・スタイル・フォントを選んでください。後でエディタからいつでも変更できます。</p>
            </div>

            {/* Color pickers */}
            <div className="mb-8 bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
              <h3 className="font-bold mb-1 text-gray-900">ブランドカラー</h3>
              <p className="text-gray-500 text-sm mb-5">メインカラーとアクセントカラーの2色でサイトの雰囲気が決まります。</p>
              <div className="grid grid-cols-2 gap-5">
                {/* Primary */}
                <div>
                  <div className="text-xs text-gray-500 mb-2 font-medium">メインカラー</div>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={e => updateForm('primaryColor', e.target.value)}
                      className="w-14 h-14 rounded-xl border-2 border-gray-200 cursor-pointer p-0.5 bg-transparent flex-shrink-0"
                    />
                    <div>
                      <div className="text-sm font-bold text-gray-900 font-mono">{form.primaryColor.toUpperCase()}</div>
                      <div className="text-gray-500 text-xs mt-0.5">ヒーロー・ヘッダー</div>
                    </div>
                  </div>
                </div>
                {/* Accent */}
                <div>
                  <div className="text-xs text-gray-500 mb-2 font-medium">アクセントカラー</div>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.accentColor}
                      onChange={e => updateForm('accentColor', e.target.value)}
                      className="w-14 h-14 rounded-xl border-2 border-gray-200 cursor-pointer p-0.5 bg-transparent flex-shrink-0"
                    />
                    <div>
                      <div className="text-sm font-bold text-gray-900 font-mono">{form.accentColor.toUpperCase()}</div>
                      <div className="text-gray-500 text-xs mt-0.5">ボタン・強調</div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Color combo preview */}
              <div className="mt-4 h-8 rounded-xl overflow-hidden flex">
                <div className="flex-1" style={{ background: form.primaryColor }} />
                <div className="w-[30%]" style={{ background: form.accentColor }} />
                <div className="w-[15%] bg-gray-100" />
              </div>
            </div>

            {/* Font picker */}
            <div className="mb-8">
              <h3 className="font-bold mb-1 text-gray-900">フォント</h3>
              <p className="text-gray-500 text-sm mb-4">業種選択時に自動設定済みです。変更も可能です。</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
                  { id: 'noto',    label: '標準ゴシック',  sub: '読みやすい万能フォント' },
                  { id: 'zen',     label: '太ゴシック',    sub: '力強く存在感がある' },
                  { id: 'mincho',  label: '明朝体',        sub: '上品・高級感・老舗感' },
                  { id: 'rounded', label: '丸ゴシック',    sub: 'やわらかく親しみやすい' },
                  { id: 'biz',     label: 'ビジネス',      sub: 'フォーマル・士業・金融' },
                  { id: 'kaisei',  label: 'カイセイ',      sub: '文芸的・アート系' },
                ] as const).map(f => (
                  <button
                    key={f.id}
                    onClick={() => updateForm('fontFamily', f.id)}
                    className={`rounded-2xl p-3 text-left transition-all border ${form.fontFamily === f.id ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white hover:border-sky-300'}`}
                  >
                    {form.fontFamily === f.id && (
                      <div className="w-4 h-4 rounded-full bg-sky-600 flex items-center justify-center mb-2">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    )}
                    <div className="font-bold text-sm text-gray-900">{f.label}</div>
                    <div className="text-gray-500 text-[11px] mt-0.5">{f.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Design style picker */}
            <div className="mb-2">
              <h3 className="font-bold mb-1 text-gray-900">デザインスタイル</h3>
              <p className="text-gray-500 text-sm mb-4">セクション形状・アニメーション・エフェクトが変わります</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* modern */}
                {([
                  {
                    id: 'modern', label: 'モダン', sub: 'グラデ・ホバーリフト',
                    preview: (
                      <svg viewBox="0 0 120 64" className="w-full h-16" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#3b82f6"/>
                            <stop offset="100%" stopColor="#8b5cf6"/>
                          </linearGradient>
                        </defs>
                        <rect width="120" height="36" fill="url(#mg)" rx="8"/>
                        <text x="8" y="14" fontSize="7" fill="white" fontWeight="bold" opacity="0.6">COMPANY NAME</text>
                        <text x="8" y="26" fontSize="9" fill="white" fontWeight="bold">見出しテキスト</text>
                        <rect x="8" y="31" width="28" height="8" rx="9" fill="white" opacity="0.9"/>
                        <text x="22" y="37" fontSize="5" fill="#3b82f6" fontWeight="bold" textAnchor="middle">ボタン</text>
                        <rect x="4" y="42" width="52" height="18" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
                        <rect x="8" y="46" width="20" height="3" rx="1.5" fill="#475569"/>
                        <rect x="8" y="51" width="14" height="2" rx="1" fill="#334155"/>
                        <rect x="58" y="42" width="58" height="18" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="0.5" style={{filter:'drop-shadow(0 -2px 4px rgba(59,130,246,0.3))' }}/>
                        <rect x="62" y="46" width="20" height="3" rx="1.5" fill="#475569"/>
                        <rect x="62" y="51" width="14" height="2" rx="1" fill="#334155"/>
                      </svg>
                    ),
                  },
                  {
                    id: 'minimal', label: 'ミニマル', sub: 'フラット・左ボーダー',
                    preview: (
                      <svg viewBox="0 0 120 64" className="w-full h-16" xmlns="http://www.w3.org/2000/svg">
                        <rect width="120" height="28" fill="#f8fafc"/>
                        <line x1="0" y1="28" x2="120" y2="28" stroke="#e2e8f0" strokeWidth="0.5"/>
                        <text x="8" y="11" fontSize="6" fill="#94a3b8" letterSpacing="2">MINIMAL STUDIO</text>
                        <text x="8" y="22" fontSize="9" fill="#1e293b" fontWeight="bold">シンプルな美</text>
                        <rect x="100" y="8" width="14" height="5" rx="2" fill="none" stroke="#1e293b" strokeWidth="0.8"/>
                        <text x="107" y="12.5" fontSize="4" fill="#1e293b" textAnchor="middle">CTA</text>
                        <rect x="4" y="32" width="3" height="14" rx="0" fill="#3b82f6"/>
                        <rect x="12" y="34" width="32" height="3" rx="1" fill="#334155"/>
                        <rect x="12" y="39" width="20" height="2" rx="1" fill="#94a3b8"/>
                        <rect x="12" y="43" width="24" height="2" rx="1" fill="#94a3b8"/>
                        <rect x="62" y="32" width="3" height="14" rx="0" fill="#3b82f6"/>
                        <rect x="70" y="34" width="32" height="3" rx="1" fill="#334155"/>
                        <rect x="70" y="39" width="20" height="2" rx="1" fill="#94a3b8"/>
                        <rect x="70" y="43" width="24" height="2" rx="1" fill="#94a3b8"/>
                      </svg>
                    ),
                  },
                  {
                    id: 'bold', label: 'ボールド', sub: '斜めセクション・3D',
                    preview: (
                      <svg viewBox="0 0 120 64" className="w-full h-16" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="0,0 120,0 120,32 0,42" fill="#1e293b"/>
                        <polygon points="0,42 120,32 120,64 0,64" fill="#0f172a"/>
                        <text x="6" y="14" fontSize="10" fill="white" fontWeight="900">BOLD</text>
                        <text x="6" y="24" fontSize="5" fill="#94a3b8">力強いデザイン</text>
                        <rect x="6" y="27" width="26" height="9" rx="2" fill="#3b82f6"/>
                        <text x="19" y="33.5" fontSize="5" fill="white" fontWeight="bold" textAnchor="middle">ボタン</text>
                        <rect x="70" y="8" width="44" height="22" rx="3" fill="#1e3a5f" style={{filter:'drop-shadow(2px 4px 0 #0a0a0a)'}}>
                          <animateTransform attributeName="transform" type="rotate" from="0 92 19" to="0 92 19" dur="0s"/>
                        </rect>
                        <rect x="70" y="8" width="44" height="22" rx="3" fill="#1e3a5f" transform="skewY(-2)"/>
                        <rect x="74" y="13" width="20" height="3" rx="1" fill="#3b82f6" opacity="0.7"/>
                        <rect x="74" y="18" width="30" height="2" rx="1" fill="#475569"/>
                        <rect x="74" y="22" width="18" height="2" rx="1" fill="#475569"/>
                      </svg>
                    ),
                  },
                  {
                    id: 'elegant', label: 'エレガント', sub: 'ガラス・上品な余白',
                    preview: (
                      <svg viewBox="0 0 120 64" className="w-full h-16" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#831843"/>
                            <stop offset="100%" stopColor="#4c0519"/>
                          </linearGradient>
                        </defs>
                        <rect width="120" height="64" fill="url(#eg)"/>
                        <line x1="50" y1="4" x2="50" y2="60" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
                        <text x="60" y="16" fontSize="5" fill="rgba(255,255,255,0.5)" textAnchor="middle" letterSpacing="3">ELEGANT</text>
                        <text x="60" y="28" fontSize="9" fill="white" textAnchor="middle" fontStyle="italic">上質な美しさ</text>
                        <line x1="40" y1="32" x2="80" y2="32" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
                        <rect x="10" y="38" width="100" height="20" rx="4" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
                        <rect x="14" y="42" width="40" height="3" rx="1.5" fill="rgba(255,255,255,0.4)"/>
                        <rect x="14" y="47" width="25" height="2" rx="1" fill="rgba(255,255,255,0.2)"/>
                        <rect x="74" y="41" width="28" height="8" rx="2" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.7"/>
                        <text x="88" y="46.5" fontSize="5" fill="white" textAnchor="middle" opacity="0.8">予約する</text>
                      </svg>
                    ),
                  },
                  {
                    id: 'rounded', label: 'ラウンド', sub: '波形・ふんわり',
                    preview: (
                      <svg viewBox="0 0 120 64" className="w-full h-16" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#7c3aed"/>
                            <stop offset="100%" stopColor="#ec4899"/>
                          </linearGradient>
                        </defs>
                        <rect width="120" height="42" fill="url(#rg)"/>
                        <ellipse cx="60" cy="42" rx="80" ry="12" fill="#0f172a"/>
                        <circle cx="95" cy="15" r="14" fill="rgba(255,255,255,0.08)"/>
                        <circle cx="105" cy="8" r="8" fill="rgba(255,255,255,0.05)"/>
                        <text x="10" y="18" fontSize="9" fill="white" fontWeight="bold">やさしい</text>
                        <text x="10" y="27" fontSize="6" fill="rgba(255,255,255,0.7)">ふんわりデザイン</text>
                        <rect x="10" y="30" width="30" height="9" rx="9" fill="white" opacity="0.95"/>
                        <text x="25" y="36" fontSize="5" fill="#7c3aed" fontWeight="bold" textAnchor="middle">ボタン</text>
                        <rect x="10" y="48" width="30" height="12" rx="8" fill="#1e1b4b" opacity="0.8"/>
                        <rect x="50" y="48" width="30" height="12" rx="8" fill="#1e1b4b" opacity="0.8"/>
                        <rect x="90" y="48" width="26" height="12" rx="8" fill="#1e1b4b" opacity="0.8"/>
                      </svg>
                    ),
                  },
                  {
                    id: 'sharp', label: 'シャープ', sub: '角型・グリッチ',
                    preview: (
                      <svg viewBox="0 0 120 64" className="w-full h-16" xmlns="http://www.w3.org/2000/svg">
                        <rect width="120" height="64" fill="#030712"/>
                        <polygon points="0,0 90,0 75,36 0,36" fill="#111827"/>
                        <rect x="0" y="0" width="2" height="36" fill="#3b82f6"/>
                        <rect x="0" y="36" width="75" height="1" fill="#3b82f6" opacity="0.6"/>
                        <text x="8" y="14" fontSize="6" fill="#3b82f6" fontWeight="900" letterSpacing="1">// SHARP</text>
                        <text x="8" y="25" fontSize="8" fill="white" fontWeight="900">鋭利なUI</text>
                        <rect x="8" y="28" width="28" height="7" rx="0" fill="#3b82f6"/>
                        <text x="22" y="33.5" fontSize="5" fill="white" fontWeight="bold" textAnchor="middle">ボタン</text>
                        <rect x="80" y="4" width="36" height="28" rx="0" fill="#111827" stroke="#1f2937" strokeWidth="0.5"/>
                        <rect x="80" y="4" width="36" height="2" fill="#3b82f6" opacity="0.5"/>
                        <rect x="84" y="10" width="20" height="3" rx="0" fill="#374151"/>
                        <rect x="84" y="15" width="26" height="2" rx="0" fill="#1f2937"/>
                        <rect x="84" y="19" width="16" height="2" rx="0" fill="#1f2937"/>
                        <rect x="84" y="24" width="20" height="5" rx="0" fill="#3b82f6" opacity="0.8"/>
                        <text x="94" y="28" fontSize="4" fill="white" textAnchor="middle">CTA</text>
                        <rect x="0" y="42" width="120" height="1" fill="#1f2937"/>
                        <rect x="0" y="43" width="38" height="0.5" fill="#3b82f6" opacity="0.4"/>
                        <rect x="4" y="46" width="50" height="3" rx="0" fill="#1f2937"/>
                        <rect x="4" y="51" width="35" height="2" rx="0" fill="#111827"/>
                        <rect x="4" y="55" width="42" height="2" rx="0" fill="#111827"/>
                        <rect x="62" y="46" width="50" height="3" rx="0" fill="#1f2937"/>
                        <rect x="62" y="51" width="35" height="2" rx="0" fill="#111827"/>
                      </svg>
                    ),
                  },
                ] as const).map(s => (
                  <button
                    key={s.id}
                    onClick={() => updateForm('designStyle', s.id)}
                    className={`rounded-2xl overflow-hidden text-left transition-all border-2 ${form.designStyle === s.id ? 'border-sky-500 ring-2 ring-sky-500/30' : 'border-gray-200 hover:border-sky-300'}`}
                  >
                    <div className="bg-[#0a0f1e] p-2">{s.preview}</div>
                    <div className={`px-3 py-2 ${form.designStyle === s.id ? 'bg-sky-50' : 'bg-white'}`}>
                      <div className="font-bold text-sm text-gray-900">{s.label}</div>
                      <div className="text-gray-500 text-[11px] mt-0.5">{s.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Hero layout picker */}
            <div className="mb-8">
              <h3 className="font-bold mb-1 text-gray-900">ヒーローレイアウト</h3>
              <p className="text-gray-500 text-sm mb-4">ファーストビューのコンテンツ配置を選択</p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  {
                    id: 'center' as const, label: '中央揃え', sub: '見出しをど真ん中に',
                    preview: (
                      <svg viewBox="0 0 96 52" className="w-full h-12" xmlns="http://www.w3.org/2000/svg">
                        <rect width="96" height="36" fill="#1e3a8a" rx="6"/>
                        <rect x="22" y="8" width="52" height="5" rx="2.5" fill="white" opacity="0.9"/>
                        <rect x="30" y="15" width="36" height="3" rx="1.5" fill="white" opacity="0.4"/>
                        <rect x="28" y="22" width="18" height="6" rx="9" fill="white" opacity="0.85"/>
                        <rect x="50" y="22" width="18" height="6" rx="9" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8"/>
                        <rect x="4" y="40" width="40" height="9" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
                        <rect x="52" y="40" width="40" height="9" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
                      </svg>
                    ),
                  },
                  {
                    id: 'left' as const, label: '左揃え', sub: '見出しを左寄せに',
                    preview: (
                      <svg viewBox="0 0 96 52" className="w-full h-12" xmlns="http://www.w3.org/2000/svg">
                        <rect width="96" height="36" fill="#1e3a8a" rx="6"/>
                        <rect x="8" y="8" width="46" height="5" rx="2" fill="white" opacity="0.9"/>
                        <rect x="8" y="15" width="32" height="3" rx="1.5" fill="white" opacity="0.4"/>
                        <rect x="8" y="22" width="16" height="6" rx="9" fill="white" opacity="0.85"/>
                        <rect x="28" y="22" width="16" height="6" rx="9" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8"/>
                        <rect x="4" y="40" width="40" height="9" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
                        <rect x="52" y="40" width="40" height="9" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
                      </svg>
                    ),
                  },
                  {
                    id: 'split' as const, label: '左右分割', sub: 'テキスト＋画像',
                    preview: (
                      <svg viewBox="0 0 96 52" className="w-full h-12" xmlns="http://www.w3.org/2000/svg">
                        <rect width="96" height="36" fill="#1e3a8a" rx="6"/>
                        <rect x="6" y="7" width="38" height="5" rx="2" fill="white" opacity="0.9"/>
                        <rect x="6" y="14" width="26" height="3" rx="1.5" fill="white" opacity="0.4"/>
                        <rect x="6" y="22" width="20" height="6" rx="9" fill="white" opacity="0.85"/>
                        <rect x="52" y="5" width="38" height="26" rx="4" fill="rgba(255,255,255,0.15)"/>
                        <text x="71" y="22" fontSize="14" textAnchor="middle" fill="rgba(255,255,255,0.5)">🖼️</text>
                        <rect x="4" y="40" width="40" height="9" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
                        <rect x="52" y="40" width="40" height="9" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>
                      </svg>
                    ),
                  },
                ] as const).map(l => (
                  <button
                    key={l.id}
                    onClick={() => updateForm('heroLayout', l.id)}
                    className={`rounded-2xl overflow-hidden text-left transition-all border-2 ${form.heroLayout === l.id ? 'border-sky-500 ring-2 ring-sky-500/30' : 'border-gray-200 hover:border-sky-300'}`}
                  >
                    <div className="bg-[#0a0f1e] p-2">{l.preview}</div>
                    <div className={`px-3 py-2 ${form.heroLayout === l.id ? 'bg-sky-50' : 'bg-white'}`}>
                      <div className="font-bold text-sm text-gray-900">{l.label}</div>
                      <div className="text-gray-500 text-[11px] mt-0.5">{l.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Header style picker */}
            <div className="mb-8">
              <h3 className="font-bold mb-1 text-gray-900">ヘッダースタイル</h3>
              <p className="text-gray-500 text-sm mb-4">ナビゲーションバーの表示スタイル</p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  {
                    id: 'transparent' as const, label: '透過', sub: 'ヒーローと一体化',
                    preview: (
                      <svg viewBox="0 0 96 40" className="w-full h-10" xmlns="http://www.w3.org/2000/svg">
                        <defs><linearGradient id="hg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1e3a8a"/><stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.7"/></linearGradient></defs>
                        <rect width="96" height="40" fill="url(#hg1)" rx="6"/>
                        <rect x="0" y="0" width="96" height="12" fill="rgba(255,255,255,0.05)" rx="6"/>
                        <rect x="5" y="4" width="18" height="4" rx="2" fill="white" opacity="0.8"/>
                        <rect x="55" y="4" width="8" height="4" rx="2" fill="white" opacity="0.3"/>
                        <rect x="66" y="4" width="8" height="4" rx="2" fill="white" opacity="0.3"/>
                        <rect x="77" y="3" width="14" height="5" rx="9" fill="white" opacity="0.7"/>
                        <rect x="10" y="20" width="40" height="5" rx="2" fill="white" opacity="0.7"/>
                        <rect x="10" y="28" width="24" height="3" rx="1.5" fill="white" opacity="0.3"/>
                      </svg>
                    ),
                  },
                  {
                    id: 'solid' as const, label: 'ソリッド', sub: 'ダーク固定ナビ',
                    preview: (
                      <svg viewBox="0 0 96 40" className="w-full h-10" xmlns="http://www.w3.org/2000/svg">
                        <rect width="96" height="40" fill="#1e3a8a" rx="6"/>
                        <rect x="0" y="0" width="96" height="12" fill="#0f172a" rx="6"/>
                        <rect x="0" y="6" width="96" height="6" fill="#0f172a"/>
                        <rect x="5" y="4" width="18" height="4" rx="2" fill="white" opacity="0.9"/>
                        <rect x="55" y="4" width="8" height="4" rx="2" fill="white" opacity="0.4"/>
                        <rect x="66" y="4" width="8" height="4" rx="2" fill="white" opacity="0.4"/>
                        <rect x="77" y="3" width="14" height="5" rx="9" fill="white" opacity="0.8"/>
                        <rect x="10" y="20" width="40" height="5" rx="2" fill="white" opacity="0.7"/>
                        <rect x="10" y="28" width="24" height="3" rx="1.5" fill="white" opacity="0.3"/>
                      </svg>
                    ),
                  },
                  {
                    id: 'colored' as const, label: 'カラー', sub: 'メインカラーのナビ',
                    preview: (
                      <svg viewBox="0 0 96 40" className="w-full h-10" xmlns="http://www.w3.org/2000/svg">
                        <rect width="96" height="40" fill="#f8fafc" rx="6"/>
                        <rect x="0" y="0" width="96" height="12" fill="#1e3a8a" rx="6"/>
                        <rect x="0" y="6" width="96" height="6" fill="#1e3a8a"/>
                        <rect x="5" y="4" width="18" height="4" rx="2" fill="white" opacity="0.9"/>
                        <rect x="55" y="4" width="8" height="4" rx="2" fill="white" opacity="0.5"/>
                        <rect x="66" y="4" width="8" height="4" rx="2" fill="white" opacity="0.5"/>
                        <rect x="77" y="3" width="14" height="5" rx="9" fill="white" opacity="0.9"/>
                        <rect x="10" y="18" width="40" height="5" rx="2" fill="#1e293b" opacity="0.7"/>
                        <rect x="10" y="26" width="24" height="3" rx="1.5" fill="#94a3b8"/>
                      </svg>
                    ),
                  },
                ] as const).map(h => (
                  <button
                    key={h.id}
                    onClick={() => updateForm('headerStyle', h.id)}
                    className={`rounded-2xl overflow-hidden text-left transition-all border-2 ${form.headerStyle === h.id ? 'border-sky-500 ring-2 ring-sky-500/30' : 'border-gray-200 hover:border-sky-300'}`}
                  >
                    <div className="bg-[#0a0f1e] p-2">{h.preview}</div>
                    <div className={`px-3 py-2 ${form.headerStyle === h.id ? 'bg-sky-50' : 'bg-white'}`}>
                      <div className="font-bold text-sm text-gray-900">{h.label}</div>
                      <div className="text-gray-500 text-[11px] mt-0.5">{h.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Animation level */}
            <div className="mb-8">
              <h3 className="font-bold mb-1 text-gray-900">アニメーション強度</h3>
              <p className="text-gray-500 text-sm mb-4">スクロール時の動き・エフェクトの強さ</p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { id: 'none'   as const, label: 'なし',   sub: 'シンプル・高速表示',   icon: '⬜', desc: '動きなし・即時表示' },
                  { id: 'subtle' as const, label: 'ソフト', sub: 'ゆったりフェードイン',  icon: '🌫️', desc: 'フェードのみ' },
                  { id: 'full'   as const, label: 'フル',   sub: 'スライド・3D・パルス', icon: '✨', desc: '全エフェクト有効' },
                ] as const).map(a => (
                  <button
                    key={a.id}
                    onClick={() => updateForm('animLevel', a.id)}
                    className={`rounded-2xl p-4 text-left transition-all border-2 ${form.animLevel === a.id ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white hover:border-sky-300'}`}
                  >
                    <div className="text-2xl mb-2">{a.icon}</div>
                    <div className="font-bold text-sm text-gray-900">{a.label}</div>
                    <div className="text-gray-500 text-[11px] mt-0.5">{a.sub}</div>
                    <div className="text-[10px] text-gray-400 mt-1 font-mono">{a.desc}</div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ─── Step 4: Content ─────────────────────────────────── */}
        {step === 4 && (
          <div>
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold mb-2 text-gray-900">コンテンツを入力</h2>
                <p className="text-gray-600">空欄の場合はAIが自動生成します。後でエディタから編集もできます。</p>
              </div>
              <button
                onClick={() => goStep(5)}
                className="flex-shrink-0 mt-1 text-xs text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-sky-300 px-3 py-1.5 rounded-lg transition-all bg-white"
              >
                スキップ → AIに任せる
              </button>
            </div>

            {/* Services */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900">サービス・料金メニュー</h3>
                <button onClick={addService} className="text-xs bg-white hover:bg-sky-50 border border-gray-200 hover:border-sky-300 px-3 py-1.5 rounded-lg transition-colors text-gray-600">+ 追加</button>
              </div>
              <div className="space-y-3">
                {form.services.map((svc, i) => (
                  <div key={i} className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-bold text-gray-500">サービス {i + 1}</span>
                      {form.services.length > 1 && (
                        <button onClick={() => removeService(i)} className="text-gray-400 hover:text-red-500 text-xs transition-colors">削除</button>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <input type="text" placeholder="サービス名" value={svc.name}
                        onChange={e => updateService(i, 'name', e.target.value)}
                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors" />
                      <input type="text" placeholder="説明（任意）" value={svc.description}
                        onChange={e => updateService(i, 'description', e.target.value)}
                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors" />
                      <input type="text" placeholder="料金（例: 3,000円）" value={svc.price}
                        onChange={e => updateService(i, 'price', e.target.value)}
                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Business Hours */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">営業時間</h3>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {HOURS_PRESETS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => setForm(f => ({ ...f, hours: p.fn(f.hours) }))}
                      className="text-[11px] px-2.5 py-1 bg-white hover:bg-sky-50 border border-gray-200 hover:border-sky-300 rounded-lg text-gray-500 hover:text-gray-900 transition-all"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                {form.hours.map((hour, i) => (
                  <div key={i} className={`flex items-center gap-3 sm:gap-4 px-4 py-3 ${i < form.hours.length - 1 ? 'border-b border-gray-100' : ''} ${hour.closed ? 'opacity-50' : ''}`}>
                    <span className="w-14 text-sm text-gray-500 flex-shrink-0">{hour.day}</span>
                    <input type="time" value={hour.open} onChange={e => updateHour(i, 'open', e.target.value)} disabled={hour.closed}
                      className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-900 text-sm focus:outline-none focus:border-sky-500 disabled:opacity-30 w-24" />
                    <span className="text-gray-400 text-sm">〜</span>
                    <input type="time" value={hour.close} onChange={e => updateHour(i, 'close', e.target.value)} disabled={hour.closed}
                      className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-900 text-sm focus:outline-none focus:border-sky-500 disabled:opacity-30 w-24" />
                    <label className="flex items-center gap-2 ml-auto cursor-pointer">
                      <input type="checkbox" checked={hour.closed} onChange={e => updateHour(i, 'closed', e.target.checked)} className="w-4 h-4 accent-red-500" />
                      <span className="text-sm text-gray-500 whitespace-nowrap">定休日</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 5: Confirm & Generate ──────────────────────── */}
        {step === 5 && (
          <div>
            {generating ? (
              <div className="py-16 max-w-sm mx-auto">
                <div className="text-center mb-10">
                  <div className="relative w-16 h-16 mx-auto mb-5">
                    <div className="absolute inset-0 rounded-full border-2 border-sky-200" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-sky-600 animate-spin" />
                    <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-sky-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                    <div className="absolute inset-0 flex items-center justify-center text-xl">
                      {selectedIndustry?.icon}
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold mb-1 text-gray-900">AIがサイトを生成中</h2>
                  <p className="text-gray-500 text-sm">{selectedIndustry?.name}に最適化したコンテンツを作っています</p>
                </div>

                {/* Step-by-step checklist */}
                <div className="space-y-3">
                  {GENERATE_STEPS.map((label, i) => {
                    const done = i < completedStepCount;
                    const active = i === completedStepCount;
                    return (
                      <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 ${
                        done ? 'bg-emerald-50 border border-emerald-200' :
                        active ? 'bg-sky-50 border border-sky-200' :
                        'bg-white border border-gray-200 opacity-40'
                      }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          done ? 'bg-emerald-500' : active ? 'bg-sky-200' : 'bg-gray-200'
                        }`}>
                          {done ? (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          ) : active ? (
                            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-gray-300" />
                          )}
                        </div>
                        <span className={`text-sm font-medium ${done ? 'text-emerald-700' : active ? 'text-gray-900' : 'text-gray-400'}`}>
                          {label}
                        </span>
                        {done && <span className="ml-auto text-emerald-600 text-xs">完了</span>}
                        {active && <span className="ml-auto text-sky-600 text-xs animate-pulse">処理中...</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold mb-2 text-gray-900">確認・生成</h2>
                  <p className="text-gray-600">入力内容を確認してAI生成を開始してください。</p>
                </div>

                <div className="space-y-4 mb-10">
                  {/* Summary cards */}
                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-sm text-gray-900">基本情報</h3>
                      <button onClick={() => goStep(2)} className="text-sky-600 text-xs hover:text-sky-500">編集</button>
                    </div>
                    <div className="space-y-1.5 text-sm text-gray-700">
                      <div><span className="text-gray-500">業種: </span>{selectedIndustry?.name}</div>
                      <div>
                        <span className="text-gray-500">店舗名: </span>
                        {form.businessName || <span className="text-amber-500 text-xs">未入力（必須）</span>}
                      </div>
                      <div>
                        <span className="text-gray-500">電話: </span>
                        {form.phone || <span className="text-gray-400 text-xs">AIが補完</span>}
                      </div>
                      {form.address && <div><span className="text-gray-500">住所: </span>{form.address}</div>}
                      {form.email && <div><span className="text-gray-500">メール: </span>{form.email}</div>}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-sm text-gray-900">デザインテンプレート</h3>
                      <button onClick={() => goStep(3)} className="text-sky-600 text-xs hover:text-sky-500">編集</button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1 flex-shrink-0">
                        <div className="w-8 h-8 rounded-lg border border-gray-200" style={{ background: form.primaryColor }} />
                        <div className="w-4 h-8 rounded border border-gray-200" style={{ background: form.accentColor }} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 font-mono">{form.primaryColor.toUpperCase()} <span className="text-gray-400">+</span> {form.accentColor.toUpperCase()}</div>
                        <div className="text-gray-500 text-xs">{form.designStyle} / {form.fontFamily} / {form.heroLayout} / {form.animLevel}</div>
                      </div>
                      <div className="ml-auto flex gap-1.5">
                        {form.larubot && <span className="bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full border border-indigo-200">LARUbot</span>}
                        {form.laruseo && <span className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full border border-emerald-200">LARUSEO</span>}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-sm text-gray-900">サービス内容</h3>
                      <button onClick={() => goStep(4)} className="text-sky-600 text-xs hover:text-sky-500">編集</button>
                    </div>
                    {form.services.filter(s => s.name).length > 0 ? (
                      <div className="space-y-1">
                        {form.services.filter(s => s.name).map((s, i) => (
                          <div key={i} className="text-sm text-gray-700 flex items-center gap-2">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-emerald-500 flex-shrink-0"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            {s.name}{s.price && ` — ${s.price}`}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">AIが業種に合わせて自動生成します</p>
                    )}
                  </div>

                  {/* AI features notice */}
                  <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-600"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                      </div>
                      <div>
                        <div className="font-bold text-sm text-sky-700 mb-1">AIが自動で生成するもの</div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <div>・キャッチコピー・ヒーロー見出し（業種×地域最適化）</div>
                          <div>・会社・店舗紹介文（180〜220文字）</div>
                          <div>・3つの強み（アイコン付き）</div>
                          <div>・よくある質問（FAQ）4項目</div>
                          <div>・お客様の声 3件（業種別リアル感想）</div>
                          <div>・SEOタイトル・メタディスクリプション</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upsell options */}
                <div className="mb-6 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-sm text-gray-900">集客を加速するオプション（任意）</h3>
                    <span className="text-[10px] text-gray-500">サイト完成後にいつでも追加できます</span>
                  </div>

                  {/* LARUbot */}
                  <div className="rounded-2xl border border-indigo-200 overflow-hidden bg-white shadow-sm">
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center flex-shrink-0 text-xl">🤖</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900 text-sm">LARUbot</span>
                            <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">HP+Botプラン ¥4,980/月</span>
                          </div>
                          <p className="text-gray-600 text-xs mt-0.5">AIチャットボット — 問い合わせを24時間自動対応</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        {[
                          { icon: '💬', text: '「営業時間は？」「予約したい」にAIが即答' },
                          { icon: '🌙', text: '深夜・休日も無人対応。機会損失をなくす' },
                        ].map((b, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                            <span className="text-sm">{b.icon}</span>
                            <span>{b.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between bg-gray-50">
                      <span className="text-[11px] text-gray-500">HP単体プランからでもあとで追加可能</span>
                      <span className="text-[11px] text-indigo-600 font-bold">初月1円で試せる</span>
                    </div>
                  </div>

                  {/* LARUSEO */}
                  <div className="rounded-2xl border border-emerald-200 overflow-hidden bg-white shadow-sm">
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0 text-xl">📈</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900 text-sm">LARUSEO</span>
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">Bot+SEOプラン ¥9,800/月</span>
                          </div>
                          <p className="text-gray-600 text-xs mt-0.5">AIブログ自動生成 — Googleで上位表示を狙う</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        {[
                          { icon: '✍️', text: 'SEO最適化ブログをAIが毎週自動投稿。更新不要' },
                          { icon: '🔍', text: '「地域名 + 業種」でGoogle上位を目指す' },
                        ].map((b, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                            <span className="text-sm">{b.icon}</span>
                            <span>{b.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between bg-gray-50">
                      <span className="text-[11px] text-gray-500">LARUbotもセットで含まれます</span>
                      <span className="text-[11px] text-emerald-600 font-bold">初月1円で試せる</span>
                    </div>
                  </div>
                </div>

                {/* Generate button with confetti */}
                <div className="relative">
                  {showConfetti && (
                    <div className="absolute inset-0 pointer-events-none overflow-visible z-10">
                      {Array.from({ length: 18 }, (_, i) => (
                        <div
                          key={i}
                          className="absolute w-2 h-2 rounded-sm"
                          style={{
                            left: `${(i % 9) * 11 + 5}%`,
                            top: '50%',
                            background: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'][i % 6],
                            '--a': `${i * 20 - 10}deg`,
                            '--d': `${-60 - (i % 4) * 25}px`,
                            animation: 'confettiBurst 0.9s ease-out forwards',
                            animationDelay: `${(i % 5) * 0.04}s`,
                          } as React.CSSProperties}
                        />
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleGenerate}
                    className="w-full bg-sky-600 hover:bg-sky-500 text-white py-5 rounded-2xl font-bold text-lg transition-all shadow-sm hover:shadow-md hover:scale-[1.02]"
                  >
                    AIでサイトを生成する →
                  </button>
                </div>
                <p className="text-center text-gray-500 text-xs mt-4">
                  生成後はビジュアルエディタで自由に編集できます
                </p>
              </div>
            )}
          </div>
        )}

        </div>{/* /animated step wrapper */}

        {/* Navigation */}
        {step < 5 && !generating && (
          <div className="flex justify-between mt-10">
            {step === 1 ? (
              <Link href="/laruHP" className="px-6 py-3 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-sky-300 bg-white transition-all text-sm">
                ← トップへ戻る
              </Link>
            ) : (
              <button
                onClick={() => goStep(step - 1)}
                className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:border-sky-300 bg-white transition-all"
              >
                ← 戻る
              </button>
            )}
            <button
              onClick={() => goStep(Math.min(5, step + 1))}
              disabled={!canNext()}
              className="px-8 py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-500 hover:scale-105 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              次へ →
            </button>
          </div>
        )}
        </div>{/* /left column */}

        {/* Right: Live Preview (desktop) */}
        <div className="hidden lg:block sticky top-28">
          <div className="flex items-center gap-2 text-xs text-sky-600 mb-3 font-semibold uppercase tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            リアルタイムプレビュー
          </div>
          <LivePreview form={form} />
          <p className="text-center text-[10px] text-gray-500 mt-3">入力内容がリアルタイムに反映されます</p>
        </div>
      </div>{/* /grid */}
      </div>{/* /max-w-6xl */}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes progress { 0% { width: 0% } 100% { width: 100% } }
      `}} />
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-sky-50 flex items-center justify-center">
        <div className="text-gray-900 text-center">
          <div className="w-10 h-10 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin mx-auto mb-4" />
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
