/*
  契約が終わった人のサイトを非公開にする（2026-09-27）。

  FAQ（解約したあと、作ったページはどうなるか）と解約完了メールでは
  「ご契約期間終了後、公開中のサイトは非公開となります」と案内している。
  ところが、契約の終わり（Stripe の customer.subscription.deleted と、
  定期同期で契約が見つからなかったとき）に profiles を canceled にするだけで、
  サイトは公開されたままだった。公開ページは契約状態を見ないので、
  **契約が無いのに公開が続く**（案内とも食い違う）。

  非公開の仕方は、利用者が自分で「非公開」を押したとき
  （DELETE /api/sites/[id]/publish）と同じにする。
  - 作った中身（blocks_json 等）は消さない。HTML書き出しは中身から作るので、
    解約後も書き出せる（FAQ の約束どおり）。再契約すれば「公開する」で戻せる。
  - 何度呼んでも同じ結果になる（公開中のものだけを対象にする）。
*/

type SitesUpdater = {
  from(table: 'sites'): {
    update(values: { published: false; published_html: null }): {
      eq(col: 'user_id', v: string): {
        eq(col: 'published', v: true): {
          select(cols: 'id'): PromiseLike<{ data: { id: string }[] | null; error: unknown }>;
        };
      };
    };
  };
};

export async function unpublishSitesOfUser(db: unknown, userId: string): Promise<{ ok: boolean; count: number }> {
  const res = await (db as SitesUpdater)
    .from('sites')
    .update({ published: false, published_html: null })
    .eq('user_id', userId)
    .eq('published', true)
    .select('id');
  if (res.error) return { ok: false, count: 0 };
  return { ok: true, count: res.data?.length ?? 0 };
}
