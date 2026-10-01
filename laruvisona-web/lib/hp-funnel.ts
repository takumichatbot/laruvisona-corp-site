/*
  LARU HP の「作成 → 編集 → 公開」の集計（2026-10-01・5.0 の計画 #3 のための読み取り専用の集計）。

  ⚠️ 数だけを返す。名前・メール・サイトの中身は返さない。
  ⚠️ 社内（管理者のメール）の人のサイトは除いて数え、除いた数も返す。
  ⚠️ 公開率は「同じ作成月のサイトのうち、いま公開されている割合」（作成月ごとの母集団）。
     その月の公開数÷その月の作成数ではない。
  ⚠️ 「編集した」は updated_at が created_at より 1 時間以上あと（作ってそのまま、と区別するための近似）。
*/
export type SiteRow = {
  user_id: string;
  published: boolean | null;
  created_at: string;
  updated_at: string | null;
  slug: string | null;
  custom_domain: string | null;
};

const EDIT_GAP_MS = 60 * 60 * 1000;

function monthJst(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'unknown';
  return new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 7);
}

export function hpFunnel(sites: SiteRow[], internalUserIds: Set<string>) {
  const rows = sites.filter(s => !internalUserIds.has(s.user_id));
  const byMonth: Record<string, { created: number; edited: number; slug: number; domain: number; published: number }> = {};
  const usersWith = new Set<string>();
  const usersPublished = new Set<string>();
  for (const s of rows) {
    const m = monthJst(s.created_at);
    const b = (byMonth[m] ||= { created: 0, edited: 0, slug: 0, domain: 0, published: 0 });
    b.created += 1;
    const c = Date.parse(s.created_at);
    const u = s.updated_at ? Date.parse(s.updated_at) : NaN;
    if (Number.isFinite(c) && Number.isFinite(u) && u - c >= EDIT_GAP_MS) b.edited += 1;
    if (s.slug) b.slug += 1;
    if (s.custom_domain) b.domain += 1;
    if (s.published) { b.published += 1; usersPublished.add(s.user_id); }
    usersWith.add(s.user_id);
  }
  const total = { created: 0, edited: 0, slug: 0, domain: 0, published: 0 };
  for (const b of Object.values(byMonth)) {
    for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += b[k];
  }
  return {
    definitions: {
      created: 'サイトの件数（作成月は日本時間）',
      edited: '作成から 1 時間以上あとに更新されたサイト（近似）',
      slug: '公開用の URL（slug）があるサイト',
      domain: '独自ドメインを設定したサイト',
      published: 'いま公開されているサイト',
      rate: '同じ作成月のサイトのうち、いま公開されている割合',
    },
    timezone: 'Asia/Tokyo',
    excluded_internal_sites: sites.length - rows.length,
    total,
    by_month: byMonth,
    users_with_site: usersWith.size,
    users_with_published_site: usersPublished.size,
  };
}
