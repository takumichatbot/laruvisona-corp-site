import type { Block } from '@/types/laruHP';

export const DIRECTIONS = [
  {
    id: 'editorial',
    name: '言葉で伝える',
    note: '写真と余白を並べ、想いからサービスへ。',
    layout: 'split',
    order: [
      'nav',
      'hero',
      'paragraph',
      'heading',
      'gallery',
      'services',
      'three-col',
      'price-table',
      'tabs',
      'team',
      'faq',
      'hours',
      'map',
      'two-col',
      'booking',
      'contact',
      'cta',
    ],
  },
  {
    id: 'immersive',
    name: '写真で惹きつける',
    note: '大きな一枚から、写真をたどる構成。',
    layout: 'center',
    order: [
      'nav',
      'hero',
      'gallery',
      'paragraph',
      'heading',
      'services',
      'three-col',
      'price-table',
      'tabs',
      'team',
      'faq',
      'hours',
      'map',
      'two-col',
      'booking',
      'contact',
      'cta',
    ],
  },
  {
    id: 'catalog',
    name: '内容で選んでもらう',
    note: '提供内容を先に。比較から相談へ。',
    layout: 'left',
    order: [
      'nav',
      'hero',
      'services',
      'three-col',
      'price-table',
      'three-col',
      'gallery',
      'tabs',
      'paragraph',
      'heading',
      'team',
      'faq',
      'hours',
      'map',
      'two-col',
      'booking',
      'contact',
      'cta',
    ],
  },
] as const;
export type DirectionId = (typeof DIRECTIONS)[number]['id'];
export const isDirection = (v: unknown): v is DirectionId =>
  DIRECTIONS.some((d) => d.id === v);

/** 選んだページの配置だけを変える。入力・ID・リンク・画像・他ページは捨てない。 */
export function arrangeDirection(
  blocks: Block[],
  id: DirectionId,
  ink = '#263248',
): Block[] {
  const spec = DIRECTIONS.find((d) => d.id === id)!;
  const ranked = blocks.map((b, index) => ({
    block: {
      ...b,
      data: {
        ...b.data,
        compositionStyle: id,
        ...(b.type === 'hero'
          ? {
              heroLayout: spec.layout,
              textColor: spec.layout === 'split' ? ink : '#ffffff',
              adaptiveLayout: true,
            }
          : {}),
        ...(b.type === 'gallery'
          ? {
              galleryLayout: id === 'immersive' ? 'stack' : 'grid',
              columns: id === 'catalog' ? '3' : '2',
            }
          : {}),
      },
    },
    index,
  }));
  // 位置に依存する自由HTMLや見出しと本文を分離しないため、移すのは独立した節だけ。
  // 各セクションの先頭の見出し・区切りも一緒に移す。
  const groups: (typeof ranked)[] = [];
  let pending: typeof ranked = [];
  for (const entry of ranked) {
    if (['heading', 'divider'].includes(entry.block.type)) {
      pending.push(entry);
      continue;
    }
    groups.push([...pending, entry]);
    pending = [];
  }
  if (pending.length) groups.push(pending);
  // 知らない種類（free/html 等）を含むページは、並べ替えず見せ方だけ適用。
  if (
    blocks.some(
      (b) =>
        !spec.order.includes(b.type as never) &&
        !['divider', 'image'].includes(b.type),
    )
  )
    return ranked.map((r) => r.block);
  const rank = (group: typeof ranked) => {
    const type = group.at(-1)!.block.type;
    const n = spec.order.indexOf(type as never);
    return n < 0 ? 5 : n;
  };
  return groups
    .sort((a, b) => rank(a) - rank(b) || a[0].index - b[0].index)
    .flatMap((g) => g.map((r) => r.block));
}

export function directionSequence(blocks: Block[]) {
  const names: Record<string, string> = {
    hero: '最初の画面',
    gallery: '写真',
    paragraph: '紹介',
    services: 'サービス',
    'price-table': '料金',
    tabs: '流れ',
    booking: '予約',
    contact: '相談',
    faq: 'よくある質問',
    hours: '営業時間',
    map: '場所',
    'two-col': 'ご案内',
    team: '担当者',
  };
  return blocks
    .filter((b) => names[b.type])
    .map((b) => ({ id: b.id, label: names[b.type] }));
}

/** 数値の点数ではなく、いまの内容に対して整える箇所を説明する。 */
export function compositionAdvice(block: Block): string[] {
  if (block.type !== 'hero') return [];
  const heading = String(block.data.heading || '');
  const notes = ['スマホでは文章の量に合わせて高さを確保します。'];
  if (Array.from(heading.replace(/\s/g, '')).length > 28)
    notes.push('長い見出しは文字を一段小さくし、全文を折り返します。');
  if (block.data.mobilePhotoFit === 'contain')
    notes.push(
      'スマホは写真の全体を残します。背景写真の配置では文字と写真を分けます。',
    );
  else
    notes.push(
      '写真は選んだ焦点を基準に切り抜きます。顔や商品が残るか完成像で確認できます。',
    );
  return notes;
}
