import { readContactBody } from './contact-contract';

const CREATE_KEYS = new Set(['name', 'industry', 'blocks_json', 'seo_json', 'settings_json']);
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export async function readSiteCreate(req: Request) {
  const body = await readContactBody(req, 2_000_000);
  if (Object.keys(body).some(key => !CREATE_KEYS.has(key))) throw Error('作成できない項目が含まれています');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) throw Error('サイト名を確認してください');
  const industry = body.industry == null ? null : typeof body.industry === 'string' ? body.industry.trim() : null;
  if (industry !== null && industry.length > 80) throw Error('業種を確認してください');
  const blocks = body.blocks_json ?? [];
  const seo = body.seo_json ?? { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '' };
  const settings = body.settings_json ?? {};
  if (!Array.isArray(blocks) || !object(seo) || !object(settings)) throw Error('サイトの内容を確認してください');
  return { name, industry, blocks, seo, settings };
}
