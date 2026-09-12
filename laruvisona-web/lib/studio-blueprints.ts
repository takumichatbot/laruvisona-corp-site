import type { Block } from '@/types/laruHP';
export const INDUSTRY_BLUEPRINTS: Record<
  string,
  {
    label: string;
    reason: string;
    gallery: string;
    services: string;
    flow: string[];
    order: string[];
  }
> = {
  beauty: {
    label: 'スタイルから、予約の相談へ',
    reason: '仕上がりを知り、メニューを選び、予約を相談する順番です。',
    gallery: 'スタイル・店内',
    services: '施術メニュー',
    flow: ['ご相談', 'メニューのご案内', 'ご来店'],
    order: [
      'hero',
      'gallery',
      'price-table',
      'services',
      'paragraph',
      'tabs',
      'team',
      'faq',
      'hours',
      'map',
      'booking',
      'contact',
      'cta',
    ],
  },
  restaurant: {
    label: 'メニューから、来店へ',
    reason: '食事や空間を知り、営業時間と場所を確かめて来店する順番です。',
    gallery: '料理とお店の様子',
    services: 'お食事・お飲み物',
    flow: ['メニューを知る', '営業日を確認', 'ご来店'],
    order: [
      'hero',
      'services',
      'price-table',
      'gallery',
      'paragraph',
      'hours',
      'map',
      'two-col',
      'faq',
      'booking',
      'contact',
      'cta',
    ],
  },
  construction: {
    label: '仕事を知って、相談へ',
    reason: '施工写真と仕事の進め方を見て、安心して相談するための構成です。',
    gallery: '施工写真',
    services: '住まいのご相談',
    flow: ['お問い合わせ', 'ご要望を伺う', '進め方をご案内'],
    order: [
      'hero',
      'gallery',
      'paragraph',
      'services',
      'three-col',
      'tabs',
      'faq',
      'contact',
      'hours',
      'map',
      'cta',
    ],
  },
  retail: {
    label: '商品から、お店への接点へ',
    reason: '商品の魅力と取り扱い内容、場所・購入の案内をまとめます。',
    gallery: '商品ギャラリー',
    services: '取り扱い商品',
    flow: ['商品を知る', '取り扱いを確認', 'お店へ相談'],
    order: [
      'hero',
      'services',
      'gallery',
      'paragraph',
      'tabs',
      'two-col',
      'hours',
      'map',
      'faq',
      'contact',
      'cta',
    ],
  },
  clinic: {
    label: '施術を知って、相談へ',
    reason:
      '対応内容と相談の流れを知ってから予約へ進みます。効果を断定する例文は入れません。',
    gallery: '院内の様子',
    services: '対応内容',
    flow: ['ご相談', 'お困りごとを伺う', 'ご案内'],
    order: [
      'hero',
      'paragraph',
      'services',
      'tabs',
      'gallery',
      'faq',
      'hours',
      'map',
      'booking',
      'contact',
      'cta',
    ],
  },
};
/** 新規作成だけ。既存サイトの並びは自動で変更しない。 */
export function composeIndustry(blocks: Block[], industry: string): Block[] {
  const spec = INDUSTRY_BLUEPRINTS[industry];
  if (!spec) return blocks;
  const next = blocks.map((b) => ({ ...b, data: { ...b.data } }));
  if (!next.some((b) => b.type === 'gallery'))
    next.push({
      id: 'start-gallery',
      type: 'gallery',
      data: {
        heading: spec.gallery,
        images: [],
        columns: '2',
        photoRatio: '4:3',
      },
    });
  for (const b of next) {
    if (b.type === 'gallery') b.data.heading = spec.gallery;
    if (b.type === 'services' && b.data.heading !== '商品について')
      b.data.heading = spec.services;
  }
  if (
    ['construction', 'clinic', 'beauty'].includes(industry) &&
    !next.some((b) => b.type === 'tabs')
  )
    next.push({
      id: 'start-flow',
      type: 'tabs',
      data: {
        heading: 'ご相談からの流れ',
        items: spec.flow.map((title, i) => ({
          label: `${i + 1}. ${title}`,
          body: '実際の流れを入力してください',
        })),
      },
    });
  return next.sort((a, b) => {
    const rank = (t: string) => {
      const i = spec.order.indexOf(t);
      return i < 0 ? 5 : i;
    };
    return rank(a.type) - rank(b.type);
  });
}
