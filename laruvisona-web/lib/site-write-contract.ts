import { readContactBody } from './contact-contract';

const CREATE_KEYS = new Set(['name', 'industry', 'blocks_json', 'seo_json', 'settings_json']);
const UPDATE_KEYS = new Set(['name', 'blocks_json', 'seo_json', 'settings_json', 'settings_json_patch']);
const PATCH_KEYS = new Set(['slug', 'settings_patch']);
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const blocksDocument = (value: unknown) => Array.isArray(value)
  || (object(value) && value.v === 2 && Array.isArray(value.pages));

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

export async function readSiteUpdate(req: Request) {
  const body = await readContactBody(req, 2_000_000);
  if (Object.keys(body).some(key => !UPDATE_KEYS.has(key))) throw Error('更新できない項目が含まれています');
  if ('settings_json' in body && 'settings_json_patch' in body) throw Error('settings_json と settings_json_patch は同時に送れません');
  const update: Record<string, unknown> = {};
  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 120) throw Error('サイト名を確認してください');
    update.name = name;
  }
  if ('blocks_json' in body) {
    if (!blocksDocument(body.blocks_json)) throw Error('サイトの内容を確認してください');
    update.blocks_json = body.blocks_json;
  }
  if ('seo_json' in body) {
    if (!object(body.seo_json)) throw Error('検索設定を確認してください');
    update.seo_json = body.seo_json;
  }
  if ('settings_json' in body) {
    if (!object(body.settings_json)) throw Error('サイト設定を確認してください');
    update.settings_json = body.settings_json;
  }
  if ('settings_json_patch' in body) {
    if (!object(body.settings_json_patch)) throw Error('settings_json_patch はオブジェクトで送ってください');
    update.settings_json_patch = body.settings_json_patch;
  }
  if (!Object.keys(update).length) throw Error('更新する内容がありません');
  return update;
}

export async function readSitePatch(req: Request) {
  const body = await readContactBody(req, 2_000_000);
  if (Object.keys(body).some(key => !PATCH_KEYS.has(key)) || Object.keys(body).length !== 1) {
    throw Error('更新項目を一つ指定してください');
  }
  if ('settings_patch' in body && !object(body.settings_patch)) throw Error('settings_patch はオブジェクトで送ってください');
  return body;
}
