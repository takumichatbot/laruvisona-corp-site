import { revalidatePath } from 'next/cache';

/*
  契約が変わったら、その人の公開ページの作り置き（ISR 1時間）を捨てる。

  公開ページは持ち主の契約を見て LARUbot / LARU SEO を出すかを決める
  （lib/laru-entitlement.ts）。作り置きが残っていると、下げたあとも最大1時間は
  前の契約のまま出てしまう。解約で非公開にしたページも同じ。

  失敗しても契約の処理は止めない（1時間後には作り直される）。
*/

type SitesReader = {
  from(table: 'sites'): {
    select(cols: 'slug'): {
      eq(col: 'user_id', v: string): PromiseLike<{ data: { slug: string | null }[] | null; error: unknown }>;
    };
  };
};

export async function revalidateOwnerSites(db: unknown, userIds: Array<string | null | undefined>): Promise<number> {
  let count = 0;
  for (const userId of new Set(userIds.filter((v): v is string => typeof v === 'string' && v.length > 0))) {
    try {
      const { data, error } = await (db as SitesReader).from('sites').select('slug').eq('user_id', userId);
      if (error) { console.error('[revalidate] 公開ページを作り直せませんでした:', userId); continue; }
      for (const site of data ?? []) {
        if (!site.slug) continue;
        revalidatePath(`/hp/${site.slug}`);
        count++;
      }
    } catch (e) {
      console.error('[revalidate] 公開ページを作り直せませんでした:', userId, (e as Error)?.message);
    }
  }
  return count;
}
