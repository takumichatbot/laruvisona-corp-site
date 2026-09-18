import { INDUSTRIES } from './laruhp-facts';

/**
 * LARUSEO の自動運転を「始めてください」と伝える。
 *
 * ⚠️ **ここに記事を作る処理は無い。** 生成も定期実行も LARUbot 側にだけあり
 * （`seo_autopilot_hourly` 毎時07分 → `_seo_auto_pilot_bg`）、こちらは
 * 入口を叩くだけ。二重生成になるので、こちらに作らないこと。
 *
 * 仕様: `docs/larubot-hp-api-jissou-2026-09-18.md`（LARUbot 側 `3efcbc0`）
 *
 *   POST /api/hp/seo/autopilot
 *   ヘッダー x-laru-secret
 *   { public_id, active, weekday, hour, keywords[], generate_first }
 *
 * 決まりごと（ずれると静かに1日ずれる）:
 *   ・曜日は **0=日曜 … 6=土曜**、**7=毎日**（JavaScript の getDay と同じ並び）
 *   ・時刻は JST の「時」だけ。**分は指定できない**（毎時07分に走るため）
 *   ・`generate_first` はテナントにつき1度だけ効く。2回目以降は
 *     `already_done` が返り、**枠を消費しない**（あちらで止めている）
 */

const SEO_PLANS = new Set(['hp-bot-seo', 'agency']);

/** そのプランに LARUSEO が付くか。lib/plan-limits.ts の PLAN_FEATURES と揃えること。 */
export function isSeoPlan(plan: string | null | undefined): boolean {
  return !!plan && SEO_PLANS.has(plan);
}

export type AutopilotOutcome =
  | { ok: true; generatedFirst: boolean; generateReason: string | null; keywordsUnused: number | null; nextRunAt: string | null }
  | { ok: false; reason: string; status?: number };

/** 送る前に形を確かめる。あちらに弾かせない。 */
function cleanWeekday(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return Number.isInteger(value) && value >= 0 && value <= 7 ? value : undefined;
}
function cleanHour(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return Number.isInteger(value) && value >= 0 && value <= 23 ? value : undefined;
}

/**
 * サイトの中身から、はじめのキーワードを組む。
 *
 * 整え直し・重複排除・カニバリ防止・255字の切り詰め・上限100は
 * **あちらの `store_keywords` が持っている。** こちらで作り込まない。
 * ここは「材料を渡す」だけ。
 */
export function initialSeoKeywords(input: {
  name?: string | null;
  industry?: string | null;
  city?: string | null;
  description?: string | null;
}): string[] {
  const industryName = INDUSTRIES.find(i => i.id === input.industry)?.name || '';
  const name = (input.name || '').trim();
  const city = (input.city || '').trim();
  // 住所の頭（都道府県・市区）だけ使う。番地まで入れても検索語にならない。
  const area = city.replace(/\d.*$/, '').trim();

  /*
    2〜4語のロングテールにする（LARUbot 側の推奨・2026-09-18）。
    「美容室」のような1語は競合が強すぎて取れない。
    エリア名は入れても入れなくてもよいとのことなので、両方を混ぜる。
    初回は5〜10語で十分（週1本なら1〜2か月分）。
  */
  const words = [
    area && industryName ? `${area} ${industryName}` : '',
    area && industryName ? `${area} ${industryName} 予約` : '',
    area && industryName ? `${area} ${industryName} 料金` : '',
    industryName ? `${industryName} 初めて 選び方` : '',
    industryName ? `${industryName} 料金 相場` : '',
    area && name ? `${area} ${name}` : '',
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const value = w.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out.slice(0, 10);
}

function larubotBase(): string {
  return process.env.LARUBOT_API_URL || 'https://larubot.tokyo';
}

/** 自動運転を始めてもらう。例外は出さない。呼ぶ側は結果を記録する。 */
export async function startLarubotAutopilot(params: {
  publicId: string;
  keywords?: string[];
  generateFirst?: boolean;
  weekday?: number;
  hour?: number;
}): Promise<AutopilotOutcome> {
  const secret = process.env.LARU_HP_API_SECRET;
  if (!secret) return { ok: false, reason: 'secret_missing' };
  if (!params.publicId) return { ok: false, reason: 'public_id_required' };

  const weekday = cleanWeekday(params.weekday);
  const hour = cleanHour(params.hour);

  let res: Response;
  try {
    res = await fetch(`${larubotBase()}/api/hp/seo/autopilot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-laru-secret': secret },
      body: JSON.stringify({
        public_id: params.publicId,
        active: true,
        ...(weekday !== undefined ? { weekday } : {}),
        ...(hour !== undefined ? { hour } : {}),
        ...(params.keywords?.length ? { keywords: params.keywords } : {}),
        ...(params.generateFirst ? { generate_first: true } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }

  const body = await res.json().catch(() => null) as Record<string, unknown> | null;
  if (!res.ok) {
    // 409 seo_not_enabled は「契約側でSEOが有効になっていない」。権限はあちらが配らない。
    const reason = typeof body?.error === 'string' ? body.error : 'http_error';
    return { ok: false, reason, status: res.status };
  }
  return {
    ok: true,
    generatedFirst: body?.generated_first === true,
    generateReason: typeof body?.generate_reason === 'string' ? body.generate_reason : null,
    keywordsUnused: typeof body?.keywords_unused === 'number' ? body.keywords_unused : null,
    nextRunAt: typeof body?.next_run_at === 'string' ? body.next_run_at : null,
  };
}

/** 状態を引く。public_id で引く（email は後方互換であって、こちらは使わない）。 */
export async function fetchLarubotStatus(publicId: string): Promise<Record<string, unknown> | null> {
  const secret = process.env.LARU_HP_API_SECRET;
  if (!secret || !publicId) return null;
  try {
    const res = await fetch(`${larubotBase()}/api/hp/status?public_id=${encodeURIComponent(publicId)}`, {
      headers: { 'x-laru-secret': secret },
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

export type SeoDisplayState =
 | 'waiting' | 'no_keywords' | 'quota_reached' | 'stopped' | 'failed' | 'draft' | 'unknown';

/**
 * 画面に出す状態を1つに決める。
 *
 * 判定の材料はすべて LARUbot が返す値。**こちらで数えない・持たない。**
 * 対応表は先方の実装報告（5-B「画面の状態表」）と同じものを写している。
 */
export function seoDisplayState(seo: Record<string, unknown> | null | undefined): SeoDisplayState {
  if (!seo) return 'unknown';
  const num = (v: unknown) => (typeof v === 'number' ? v : null);
  const quota = (seo.quota ?? {}) as Record<string, unknown>;
  const articles = (seo.articles ?? {}) as Record<string, unknown>;
  const lastSkip = (seo.last_skip ?? {}) as Record<string, unknown>;
  const active = seo.autopilot_active === true;
  const lastResult = typeof seo.last_result === 'string' ? seo.last_result : '';
  const skipReason = typeof lastSkip.reason === 'string' ? lastSkip.reason : '';
  /*
    2026-09-18（LARUbot `7fe6a3b`）で名前が揃った。
      status 側 unused_keywords → **keywords_unused**
      status 側 total_keywords  → **keywords_total**
    autopilot の応答と同じ名前になった。古い名前も一応見る
    （向こうを戻されたときに、こちらが黙って0扱いしないため）。
  */
  const unused = num(seo.keywords_unused) ?? num(seo.unused_keywords);
  const used = num(quota.used);
  const limit = num(quota.limit);
  const published = num(articles.published);

  /*
    ⚠️ 「公開済み」は **現在の状態ではなく履歴** なので、ここでは返さない。

    2026-09-18まで、記事が1本でもあると「公開済み」が判定の先頭で勝っていた。
    翌月に枠が切れても、キーワードが尽きても、生成が失敗していても、
    画面は「公開済み」のまま。**いま何が起きているかを隠していた。**

    公開した本数は articles.published として、状態とは別枠で常に出す
    （app/laruHP/seo が「公開 N本」として表示する）。
  */
  if (lastResult === 'failed') return 'failed';
  if (lastResult === 'draft') return 'draft';
  if (!active) return 'stopped';
  /*
    飛ばした回の理由を先に見る（`skipped` は 7fe6a3b で入った）。
    「枠が残っているのにキーワードが無い」も、その逆も、理由がそのまま出る。
    理由が取れないときだけ、数から推し量る。
  */
  if (skipReason === 'quota_reached') return 'quota_reached';
  if (skipReason === 'no_unused_keywords') return 'no_keywords';
  if (used !== null && limit !== null && used >= limit) return 'quota_reached';
  if (unused === 0) return 'no_keywords';
  return 'waiting';
}

/** 画面に出す短い文。状態と1対1。 */
export const SEO_STATE_LABEL: Record<SeoDisplayState, string> = {
  waiting: '自動生成待ち',
  no_keywords: 'キーワード不足',
  quota_reached: '今月の枠切れ',
  stopped: '停止中',
  failed: '生成失敗',
  draft: '下書きで止まりました',
  unknown: '未連携',
};

/*
  ここから下は、顧客に見せる文言を作るところ（app/laruHP/seo のカード）。

  ⚠️ **LARUbot が返した文言を、そのまま顧客に見せない。**
  `last_error.message` は向こうの内部で作られた文字列で、
  例外の型・ファイル名・URL・鍵らしきものが混ざる可能性がある。
  何が入るかをこちらで保証できない以上、**出さない**のが正しい。
  顧客が取るべき行動は「こちらに連絡する」で変わらないので、決め打ちの一文にする。
*/

/** 状態ごとの「次にすること」。1行で、次の動作が決まる言い方にする。 */
export function seoNextAction(
  state: SeoDisplayState,
  seo: Record<string, unknown> | null | undefined,
): string {
  const s = (seo ?? {}) as Record<string, unknown>;
  const quota = (s.quota ?? {}) as Record<string, unknown>;
  switch (state) {
    case 'waiting': {
      const at = formatSeoDateTime(s.next_run_at);
      return at ? `${at} に次の記事が出ます。このままで大丈夫です。` : 'このままで大丈夫です。';
    }
    case 'no_keywords':
      return 'キーワードを追加すると、次回から記事が出ます。';
    case 'quota_reached': {
      const at = formatSeoDate(quota.resets_at);
      return at ? `${at} に今月の枠が戻ります。` : '来月になると枠が戻ります。';
    }
    case 'stopped':
      return '自動生成が止まっています。再開するとまた記事が出ます。';
    case 'failed':
      return '記事の生成に失敗しました。こちらで確認しますのでご連絡ください。';
    case 'draft':
      return '品質の確認で止まっています。内容をご確認ください。';
    default:
      return '';
  }
}

/** 「9月24日(木) 5:07」のような表示。読めない値は空で返す。 */
export function formatSeoDateTime(value: unknown): string {
  const d = toDate(value);
  if (!d) return '';
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日(${w}) ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 「10月1日」のような表示。読めない値は空で返す。 */
export function formatSeoDate(value: unknown): string {
  const d = toDate(value);
  if (!d) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** これまでに公開した本数。状態とは別に、履歴として常に出す。 */
export function seoPublishedCount(seo: Record<string, unknown> | null | undefined): number {
  const articles = ((seo ?? {}) as Record<string, unknown>).articles as Record<string, unknown> | undefined;
  const n = articles?.published;
  return typeof n === 'number' && n >= 0 ? n : 0;
}

/** 今月の枠。分からなければ null。 */
export function seoQuota(seo: Record<string, unknown> | null | undefined): { used: number; limit: number } | null {
  const quota = ((seo ?? {}) as Record<string, unknown>).quota as Record<string, unknown> | undefined;
  const used = quota?.used, limit = quota?.limit;
  if (typeof used !== 'number' || typeof limit !== 'number') return null;
  return { used, limit };
}
