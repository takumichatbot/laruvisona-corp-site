/**
 * 一括再生成（/api/admin/republish-all）で、何から公開HTMLを作り直すか。
 *
 * sites.blocks_json / seo_json / settings_json は「いまの下書き」で、保存のたびに変わる。
 * 公開HTML（published_html）は「公開ボタンを押した時点」の写し。
 * 以前は一括再生成が下書きから作り直していたため、公開していない文章・設定
 * （例：下書きだけで試した見た目の案）が、利用者の操作なしに公開側へ出た。
 *
 * 公開時点の中身は、公開のたびに site_versions へ残っている
 * （app/api/sites/[id]/publish/route.ts）。ただし版の保存が失敗した公開もありうるので、
 * 「いちばん新しい版＝いまの公開HTMLの元」とは言い切れない。
 *
 * そこで、確実に言えるときだけ作り直す：
 *   いまの下書きが、いちばん新しい版（＝最後の公開時点の中身）と同じ
 *   → 未公開の変更が無い。公開時点の中身で作り直してよい
 * それ以外は書かずに理由を返す（公開HTMLは今のまま。次に利用者が公開したときに新しくなる）。
 */
import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';

export type SiteSourceRow = {
  blocks_json: unknown;
  seo_json: unknown;
  settings_json: unknown;
  published_html?: string | null;
};
export type VersionRow = { blocks_json: unknown; seo_json: unknown; settings_json: unknown } | null | undefined;

export type RepublishSource =
  | { ok: true; blocks: Block[] | { v: number; pages: Page[] }; seo: SEOSettings; settings: SiteSettings }
  | { ok: false; reason: 'no_snapshot' | 'unpublished_changes' | 'snapshot_mismatch' };

/** キーの順番に左右されない比較用の文字列（jsonb は順番を保たない） */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as Record<string, unknown>).sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** 版に入っている部品のID（全ページ） */
function blockIds(blocks: unknown): Set<string> {
  const pages = Array.isArray(blocks)
    ? [{ blocks }]
    : (blocks as { pages?: { blocks?: unknown[] }[] } | null)?.pages ?? [];
  const ids = new Set<string>();
  for (const p of pages) for (const b of (p.blocks ?? []) as { id?: unknown }[]) if (typeof b?.id === 'string') ids.add(b.id);
  return ids;
}

export function republishSource(site: SiteSourceRow, latest: VersionRow): RepublishSource {
  if (!latest) return { ok: false, reason: 'no_snapshot' };
  const same = canonicalJson(site.blocks_json) === canonicalJson(latest.blocks_json)
    && canonicalJson(site.seo_json) === canonicalJson(latest.seo_json)
    && canonicalJson(site.settings_json) === canonicalJson(latest.settings_json);
  if (!same) return { ok: false, reason: 'unpublished_changes' };
  /* 念のため：いまの公開HTMLに出ている部品が、版に無いなら、版はこの公開HTMLの元ではない
     （版の保存に失敗した公開のあと、など）。作り直すと公開内容が戻ってしまうので書かない。 */
  const html = String(site.published_html ?? '');
  const ids = blockIds(latest.blocks_json);
  for (const m of html.matchAll(/data-lhp-block="([^"]+)"/g)) {
    const id = m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    if (!ids.has(id)) return { ok: false, reason: 'snapshot_mismatch' };
  }
  return {
    ok: true,
    blocks: latest.blocks_json as Block[] | { v: number; pages: Page[] },
    seo: latest.seo_json as SEOSettings,
    settings: latest.settings_json as SiteSettings,
  };
}
