import type { Block } from '@/types/laruHP';
import { isPlaceholderText } from './placeholder-text';

/**
 * 検索結果に出る説明文を、本文から作る。
 *
 * 「SEOの自動設定（メタタグ）」と売っているのに、説明文だけは自動で入らず、
 * 自分で書かない限り <meta name="description" content=""> の空タグのまま
 * 公開できていた。公開前の確認でも「できれば書いたほうがよい」扱いなので、
 * 空のまま出ていく経路がある。
 *
 * 自分で書いたものがあれば、必ずそちらを使う。これは最後の砦。
 *
 * ただし、ひな形のままの文字は拾わない。
 * 拾うと、検索結果とLINEに貼ったときのプレビューに
 * 「紹介文を入力してください」と出る。**空っぽより悪い。**
 * 空なら検索側が本文から拾うが、これは違う文が確定で出る。
 * 実際、本番で公開中のページの og:description がそうなっていた。
 */

const TEXT_KEYS = ['subheading', 'subtext', 'text', 'description', 'lead', 'body', 'heading', 'title'];

function plain(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 文の途中で切らない。句点で切れないときだけ、字数で切って「…」を付ける。 */
function trim(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('！'), cut.lastIndexOf('？'));
  if (stop >= Math.floor(max * 0.5)) return cut.slice(0, stop + 1);
  return cut.slice(0, max - 1) + '…';
}

export function autoDescription(blocks: Block[], siteName = '', max = 110): string {
  const pieces: string[] = [];
  for (const block of blocks || []) {
    const data = (block?.data || {}) as Record<string, unknown>;
    for (const key of TEXT_KEYS) {
      const value = plain(data[key]);
      // 見出しだけの短い断片は、説明文としては読めない
      if (value.length < 8) continue;
      // ひな形のままの文は、載せるより無いほうがよい
      if (isPlaceholderText(value)) continue;
      if (value === siteName) continue;
      if (pieces.includes(value)) continue;
      pieces.push(value);
      break;
    }
    if (pieces.join(' ').length >= max) break;
  }
  const joined = pieces.join(' ').trim();
  if (!joined) return siteName ? `${siteName}のホームページです。` : '';
  return trim(joined, max);
}
