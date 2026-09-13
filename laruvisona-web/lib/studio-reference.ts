import type { Block } from '@/types/laruHP';
import type { DirectionId } from '@/lib/studio-direction';
export const INDUSTRY_REFERENCES: Record<
  string,
  {
    concept: string;
    detail: string;
    direction: DirectionId;
    services: [string, string][];
    photos: string[];
  }
> = {
  beauty: {
    concept: '静かな時間を、余白で伝える。',
    detail: 'スタイル写真、施術内容、ご相談の順に。',
    direction: 'editorial',
    services: [
      [
        'カット',
        '髪の悩みや普段のお手入れについて、ご相談いただくメニューの例です。',
      ],
      [
        'カラー',
        '色の希望を伺うメニューの例です。実際の取り扱いに合わせて編集してください。',
      ],
      ['ヘアケア', 'ご自身のサロンで提供しているケアをご紹介ください。'],
    ],
    photos: [
      '/salon/style-1.jpg',
      '/salon/style-2.jpg',
      '/salon/style-3.jpg',
      '/salon/style-4.jpg',
    ],
  },
  restaurant: {
    concept: '過ごす時間まで、想像できる。',
    detail: 'お店の空気、メニュー、来店の案内をひと続きに。',
    direction: 'immersive',
    services: [
      [
        'お飲み物',
        '香りや味わいなど、実際にお出しする一杯の特徴をご紹介ください。',
      ],
      [
        'お食事',
        '料理の内容と提供時間を、ご自身のお店に合わせて編集してください。',
      ],
      ['甘いもの', 'お店で扱っているお菓子やデザートの紹介欄です。'],
    ],
    photos: ['/studio/references/cafe-v1.webp'],
  },
  construction: {
    concept: '仕事の考え方が、相談の入口になる。',
    detail: '建築の写真、対応内容、相談の流れを明快に。',
    direction: 'editorial',
    services: [
      [
        '住まいの相談',
        '家づくりで大切にしたいことを伝える、ご相談メニューの例です。',
      ],
      [
        'リノベーション',
        '工事の対象範囲や対応内容を、実際のサービスに合わせて編集してください。',
      ],
      ['設計について', '設計や相談の進め方を、ご自身の言葉でご紹介ください。'],
    ],
    photos: ['/company/concepts/architecture.webp'],
  },
  retail: {
    concept: '一つひとつの魅力から、選ぶ楽しさへ。',
    detail: '商品写真と取り扱い内容を先に見せる、読みやすい構成。',
    direction: 'catalog',
    services: [
      [
        '食卓の道具',
        '形や質感、使い方など、実際に扱う商品の特徴を紹介する欄です。',
      ],
      ['暮らしの道具', '取り扱い商品の内容に合わせて編集してください。'],
      ['贈りもの', '包装や贈答の対応を行う場合に、その内容をご案内ください。'],
    ],
    photos: ['/studio/references/tableware-v1.webp'],
  },
  clinic: {
    concept: '知りたいことに、順番に答える。',
    detail: '対応内容、相談の流れ、院内の様子から予約へ。',
    direction: 'catalog',
    services: [
      [
        'はじめてのご相談',
        '相談時に伺う内容や、実際の対応の流れをご紹介ください。',
      ],
      [
        '対応内容',
        'ご自身の院で提供する施術の内容を、効果を断定せず説明する欄です。',
      ],
      [
        'ご来院の案内',
        '服装や持ち物など、事前に必要な案内があればご記入ください。',
      ],
    ],
    photos: ['/studio/references/clinic-v1.webp'],
  },
};
/** 案内ページの架空例だけに使う。実績・体験談・架空価格は作らない。 */
export function referenceBlocks(blocks: Block[], industry: string): Block[] {
  const ref = INDUSTRY_REFERENCES[industry];
  if (!ref) return blocks;
  return blocks.map((b) => {
    if (b.type === 'services')
      return {
        ...b,
        data: {
          ...b.data,
          items: ref.services.map(([title, description]) => ({
            icon: '',
            title: `【例】${title}`,
            description,
            price: '',
          })),
        },
      };
    if (b.type === 'gallery')
      return {
        ...b,
        data: {
          ...b.data,
          heading: `【例】${String(b.data.heading || '写真')}`,
          images: [...ref.photos],
        },
      };
    return b;
  });
}
