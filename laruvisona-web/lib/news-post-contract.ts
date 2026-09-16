import { readContactBody } from './contact-contract';
import { safeUrl } from './safe-markup';

const ALLOWED = new Set(['title', 'content', 'category', 'image_url', 'published', 'published_at', 'scheduled_at']);

export type NewsPostInput = {
  title?: string;
  content?: string | null;
  category?: string | null;
  image_url?: string | null;
  published?: boolean;
  published_at?: string;
  /** 予約投稿の公開予定時刻。null で予約の取り消し。 */
  scheduled_at?: string | null;
};

export const validNewsId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function text(value: unknown, name: string, max: number, required = false): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null && !required) return null;
  if (typeof value !== 'string') throw Error(`${name}を確認してください`);
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > max) throw Error(`${name}を確認してください`);
  return normalized || null;
}

export function parseNewsPost(value: Record<string, unknown>, requireTitle: boolean): NewsPostInput {
  if (Object.keys(value).some(key => !ALLOWED.has(key))) throw Error('更新できない項目が含まれています');
  const output: NewsPostInput = {};
  const title = text(value.title, 'タイトル', 160, requireTitle);
  if (title !== undefined) output.title = title as string;
  const content = text(value.content, '本文', 100_000);
  if (content !== undefined) output.content = content;
  const category = text(value.category, 'カテゴリ', 80);
  if (category !== undefined) output.category = category;
  const image = text(value.image_url, '画像URL', 2048);
  if (image !== undefined) {
    const checked = image ? safeUrl(image, '') : '';
    if (image && !checked) throw Error('画像URLを確認してください');
    output.image_url = checked || null;
  }
  if (value.published !== undefined) {
    if (typeof value.published !== 'boolean') throw Error('公開状態を確認してください');
    output.published = value.published;
  }
  if (value.published_at !== undefined) {
    if (typeof value.published_at !== 'string' || value.published_at.length > 40 || !Number.isFinite(Date.parse(value.published_at))) {
      throw Error('公開日時を確認してください');
    }
    output.published_at = new Date(value.published_at).toISOString();
  }
  if (value.scheduled_at !== undefined) {
    if (value.scheduled_at === null || value.scheduled_at === '') {
      output.scheduled_at = null;
    } else if (typeof value.scheduled_at !== 'string' || value.scheduled_at.length > 40 || !Number.isFinite(Date.parse(value.scheduled_at))) {
      throw Error('予約日時を確認してください');
    } else {
      output.scheduled_at = new Date(value.scheduled_at).toISOString();
    }
  }
  if (requireTitle && !output.title) throw Error('タイトルが必要です');
  if (!Object.keys(output).length) throw Error('更新する内容がありません');
  return output;
}

export async function readNewsPost(req: Request, requireTitle: boolean) {
  return parseNewsPost(await readContactBody(req, 128_000), requireTitle);
}
