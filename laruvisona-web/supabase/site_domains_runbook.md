# site_domains の適用手順と戻し方

対象: `supabase/site_domains.sql`（未適用）

## 実PostgreSQLでの回帰テスト

外部に一切つながらない一時DBで、実際のSQL関数を競合の順序どおりに呼ぶ。

```
# 一時サーバを立てて（例）
initdb -D /tmp/pgtest/data -U laruhp --auth=trust
pg_ctl -D /tmp/pgtest/data -o "-k /tmp/pgtest/sock -h ''" -l /tmp/pgtest/pg.log start

# 適用してシナリオを流す
./supabase/run-sql-regression.sh
```

`site_domains_regression.sql` が固定しているのは次の順序:

| 記号 | 内容 |
|---|---|
| A | 検証中に解除が確定 → 古い検証を適用しない。実体の無い主URLが残らない |
| B | 検証中に利用者が主URLを選択 → 自動採用で上書きしない |
| C | 遅れて届いた古い解除失敗 → 作り直された新しい申請を壊さない |
| D | 同一サイトの2候補を同時に初回検証 → 主URLは1つだけ |
| E | 解除待ちでない行を finish_release で消せない |
| F | 登録開始の印は世代が一致するときだけ立つ |
| G | 解除待ちの行に検証結果を書き戻せない |
| H | 解除開始時に外部登録の帰属を固定する（legacy / 未登録 / 登録途中） |

`site_domains_permission_check.sql` は権限を確認する。
どちらも「期待どおり失敗すること」が合格条件で、
1件でも成功したら適用しない。

## 先に隔離環境で確認する

本番での接続試験を最初の結合試験にしない。順番は次のとおり。

1. テスト用のSupabaseプロジェクト（またはローカルの `supabase start`）に
   `schema.sql` → `site_domains.sql` の順で適用する。
2. `site_domains_permission_check.sql` を実行し、**すべて期待どおり失敗すること**を確認する。
   1件でも成功したら権限設計に穴があるので、適用しない。
3. テスト用のRenderサービスとテスト用ホスト名で、追加 → 確認 → 主URL切替 → 解除を通す。
   Renderを落とした状態・DNSを設定しない状態でも確認する。
4. ここまで通ってから本番の適用を齋藤に依頼する。

## 適用の順番

SQL適用 → デプロイ の順を推奨する。逆順でも設定画面は壊れないようにしてあるが
（表が無い場合は既存の `custom_domain` を legacy として表示する）、
追加・確認の操作はSQL適用まで失敗する。

適用後に確認するクエリ:

```sql
select status, count(*) from public.site_domains group by status;
select count(*) from public.sites where custom_domain is not null;
-- legacy の件数と custom_domain の件数が一致すること
```

## 戻し方（標準）

**`drop table site_domains` は標準手順にしない。**
接続の途中・解除待ちのホスト、外部の管理ID、検証の履歴が失われ、
Render側に登録が残ったまま追跡できなくなる。

標準は「コードだけ戻し、テーブルは残す」。

1. `git revert` で対象コミットを戻す（`sites.custom_domain` は触らないので、
   配信中の独自ドメインはそのまま動き続ける）。
2. `site_domains` と `domain_release_queue` はそのまま残す。
   旧コードはこれらを読まないので、あっても害はない。
3. 戻したあとに必ず照合する:
   - `select host, status, render_domain_id from public.site_domains where status in ('release_pending','ssl_pending','connected');`
   - Renderの custom domains 一覧と突き合わせ、DBに無いのにRenderに残っている
     ホストが無いか確認する。
   - `select host from public.domain_release_queue where resolved_at is null;`
     ここに残っているものは、手作業でRenderから解除する。
4. **旧コードに戻すと、所有確認を飛ばす経路が復活する**ことを認識しておく。
   - `PATCH /api/sites/[id]` の `custom_domain` 経路
   - 保存しただけで配信先・決済戻り先の許可リストに載る挙動
   ただし、この差分で入れたDBトリガ `guard_sites_custom_domain_trg` は
   テーブル側に残るため、**旧コードのままだと custom_domain の更新が
   拒否されて保存に失敗する**。旧コードへ完全に戻す場合は、
   トリガも合わせて外す必要がある:
   `drop trigger if exists guard_sites_custom_domain_trg on public.sites;`
   外した瞬間に上の迂回経路も有効に戻るので、戻す判断とセットで行う。

## スキーマごと戻す必要がある場合

先にデータを退避してから落とす。

```sql
create table public.site_domains_backup_20260910 as select * from public.site_domains;
create table public.domain_release_queue_backup_20260910 as select * from public.domain_release_queue;
-- 退避を確認してから
drop trigger if exists guard_sites_custom_domain_trg on public.sites;
drop table public.site_domains;
drop table public.domain_release_queue;
```

退避したテーブルは、Render側の後始末が終わるまで消さない。


## 解除待ちキュー（domain_release_queue）の運用

自動で消化する処理は入れていない。**キューに積まれた＝外部の解除が済んだ、ではない。**

| 項目 | 決め |
|---|---|
| 担当 | 齋藤（外部サービスの管理権限が要るため） |
| 頻度 | 週1回。加えて、画面で「解除待ち」が出たと連絡があったとき |
| 手順 | 1. `select site_id, host, render_domain_id, attempts, last_error from public.domain_release_queue where resolved_at is null order by requested_at;`<br>2. 各ホストについて Render の custom domains 一覧を確認する<br>3. 一覧に**そのホスト名で**存在し、当社サービスの登録であることを確認してから解除する<br>4. `update public.domain_release_queue set resolved_at = now() where id = ...;` |
| 完了記録 | `resolved_at` を入れる。入っていないものは未完了として次回も出る |
| 再確認 | 解除後に `dig` などでそのホストが当社へ向いていないことを確認する |

注意: キューに古い世代のホストが残っている状態で、同じホストが別のサイトに
登録し直されることがある。**必ず `site_domains` に同じホストの行が
存在しないことを確認してから解除する。**

```sql
-- 解除してよいか（0件であること）
select count(*) from public.site_domains where host = '<対象ホスト>';
```

行が存在する場合は、それが新しい申請なので解除してはいけない。
その場合はキューの行に `last_error = '再登録済みのため対象外'` を書いて
`resolved_at` を入れる。

## 外部APIの設定が失われた場合

`RENDER_API_KEY` / `RENDER_SERVICE_ID` が未設定のときに解除が実行されると、
「解除不要」とは扱わず `release_pending` のまま残り、キューに積まれる。
設定を戻してから画面の「解除を再試行」を押すか、上の手順で手当てする。
