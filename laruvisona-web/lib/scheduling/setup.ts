import { siteLink, type PublicSite } from '../public-site-url';
import type { Block } from '@/types/laruHP';

export function bookingPublicUrl(site: PublicSite): string {
  return new URL(siteLink(site, 'reserve')).href;
}

/** Explicit editor action only. Preserve the existing section and make undo possible. */
export function installScheduleBlock(blocks: Block[], newId: string): Block[] {
  const existing = blocks.find(b => b.type === 'booking');
  if (existing) return blocks.map(b => b.id === existing.id
    ? { ...b, data: { ...b.data, mode: 'schedule' } } : b);
  return [...blocks, { id: newId, type: 'booking', data: {
    mode: 'schedule', heading: 'ご予約', bgColor: '#f3f6f5', buttonColor: '#176b60',
    stickyCta: false,
  } }];
}
