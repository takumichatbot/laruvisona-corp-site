# 本番の読み取り確認（C-1〜C-5）— 記録シート

日付: ____________　実施: 齋藤さん

**この紙で行うのは読み取りだけ。1行も書かない。**
デプロイの承認・本番の性能確認とは分けている。C-6 はデプロイの後なのでここには無い。

出す対象: `rebuild-2026-09` / コードの最終コミット `ef8b84d`
（先端SHAは push 直前に `git rev-parse HEAD` で控える）

---

## やってはいけないこと

- **本番の `/api/admin/republish-all` を叩かない。** `dryRun` を付けても叩かない。
  いま本番で動いているのは旧版（`0d00dfe`）で、**`dryRun` を読まずに公開サイトを
  全件作り直す**。新版の `dryRun` が使えるのは、Render で新版が Live になった後（C-6）。
- **鍵の値をどこにも写さない。** 画面・シェルの履歴・この紙・チャットのいずれにも。
  見るのは「設定されているか」だけ。
- SQL は下のものをそのまま使う。`update` / `insert` / `delete` は1つも無い。

---

## C-1. 2つのSHAを、分けて書き留める

```bash
git ls-remote origin refs/heads/main
```

Render の管理画面 → 対象サービス → Deploys → 「Live」のコミットを見る。

| | 値 |
|---|---|
| (a) GitHub main の先端 | ______________________ |
| (b) Render が動かしているSHA | ______________________ |

**(a) と (b) が違う場合、本番で動いているのは (b)。** 以降の判断は (b) を基準にする。

→ (b) が `0d00dfe` でない場合は、**ここで止めて報告**（想定と違う版が動いている）。

---

## C-2. 保存済みHTMLの版を数える

Supabase の SQL Editor。**読むだけ。**

```sql
select
  coalesce(substring(published_html from '<!--lhpv:([0-9]+)-->'), '（版の印なし）') as version,
  count(*) as sites
from public.sites
where published is true
group by 1
order by 1;
```

| version | sites |
|---|---|
| | |
| | |
| | |

```sql
-- いまの版（11）に揃っていない行の件数
select count(*)
from public.sites
where published is true
  and (published_html is null or published_html not like '%<!--lhpv:11-->%');
```

作り直しの対象になる件数: __________ 件

> 「コードの版が3だから全部 v3」ではない。`published_html` は
> **その行を最後に公開したときのコード**で書かれている。混ざっていて正常。

---

## C-3. `site_domains` の適用状態（独自ドメインを出すなら必須）

**表があること＝移行が終わったこと、ではない。** (1)〜(5) がそろって初めて「当たっている」。

```sql
-- (1) 表があるか。※これは「移行が全部終わった」ことの確認ではない
select to_regclass('public.site_domains') is not null as table_exists,
       to_regclass('public.domain_release_queue') is not null as queue_exists;

-- (2) あとから足した列がそろっているか
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'site_domains'
  and column_name in ('operation_epoch','render_register_started_at','external_registration_owned',
                      'release_operation_id','release_lease_until','redirects_to')
order by 1;   -- 6件そろっていれば、列の追加は済んでいる

-- (3) トリガがあるか（sites 側のガードを含む）
select tgname from pg_trigger
where tgrelid in ('public.sites'::regclass, 'public.site_domains'::regclass)
  and not tgisinternal
order by 1;   -- guard_sites_custom_domain_trg / site_domains_touch /
              -- site_domains_enqueue_release_trg

-- (4) 状態遷移の関数がそろっているか（件数ではなく、名前の一致で見る）
--     現行の supabase/site_domains.sql が作る関数は11件。
--     下は「必要な名前の一覧」と実際の pg_proc を突き合わせ、
--     足りないものを missing = true で並べる。全行 missing = false なら足りている。
with expected(proname) as (
  values ('laruhp_domain_apply_check'),
         ('laruhp_domain_begin_release'),
         ('laruhp_domain_claim_release'),
         ('laruhp_domain_enqueue_orphan_registration'),
         ('laruhp_domain_finish_release'),
         ('laruhp_domain_mark_register_started'),
         ('laruhp_domain_mark_release_failed'),
         ('laruhp_domain_pending_queue'),
         ('laruhp_domain_pin_release_target'),
         ('laruhp_domain_resolve_queue_entry'),
         ('laruhp_domain_set_primary')
)
select e.proname,
       (p.oid is null) as missing
from expected e
left join pg_namespace n on n.nspname = 'public'
left join pg_proc p on p.pronamespace = n.oid and p.proname = e.proname
order by missing desc, e.proname;
-- 期待: 11行すべて missing = false

-- (4-b) 一覧に無い laruhp_domain_* が残っていないか（旧版の取り残し確認）
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'laruhp_domain_%'
  and p.proname not in (
    'laruhp_domain_apply_check','laruhp_domain_begin_release','laruhp_domain_claim_release',
    'laruhp_domain_enqueue_orphan_registration','laruhp_domain_finish_release',
    'laruhp_domain_mark_register_started','laruhp_domain_mark_release_failed',
    'laruhp_domain_pending_queue','laruhp_domain_pin_release_target',
    'laruhp_domain_resolve_queue_entry','laruhp_domain_set_primary')
order by 1;   -- 期待: 0行

-- (5) 権限（authenticated から直接書けないこと）
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'site_domains'
order by 1, 2;
```

| 見るところ | 期待 | 結果 |
|---|---|---|
| (1) 表 | `table_exists` / `queue_exists` とも true | |
| (2) 列 | 6件 | ____ 件 |
| (3) トリガ | 3つ（guard_sites_custom_domain_trg / site_domains_touch / site_domains_enqueue_release_trg） | |
| (4) 関数 | **11行すべて `missing = false`** | missing=true が ____ 件 |
| (4-b) 取り残し | **0行** | ____ 行 |
| (5) 権限 | `authenticated` が直接書けないこと | |

→ 足りないものがあっても**その場では流さない**。何が足りなかったかだけ控えて報告。
　（`site_domains.sql` は `if not exists` / `create or replace` なので、
　 あとで流せば足りない分だけ入る。適用は出す順の7番）

---

## C-4. 設定の有無（値は見ない）

Render の Environment 画面で、**キーがあるかどうかだけ**を目で見る。

| キー | 期待 | 有無 |
|---|---|---|
| `DOMAIN_PROBE_SECRET` | 独自ドメインを出すなら必須（**新規**） | 有 / 無 |
| `RENDER_API_KEY` | 既存のはず | 有 / 無 |
| `RENDER_SERVICE_ID` | 既存のはず | 有 / 無 |
| `RENDER_SERVICE_SLUG` | 既存のはず | 有 / 無 |
| `RENDER_APEX_IP` | 既存のはず | 有 / 無 |
| `ADMIN_SECRET` | 既存 | 有 / 無 |

値はコピーしない。`DOMAIN_PROBE_SECRET` は到達確認の署名鍵で、漏れると確認を偽装できる。

---

## C-5. `REPUBLISH_ON_BOOT` が**無い**こと

同じ Environment 画面で確認する。

`REPUBLISH_ON_BOOT`: **無い** / ある（あると、起動しただけで全件作り直す）

→ **ある場合は、ここで止めて報告。** デプロイの前に外す。

---

## 終わったら

この紙の空欄を埋めた状態で戻してください。次は出す順の 1（取り込み）からで、
そこからは**本番に書く操作**が入ります。デプロイの承認はそのときに別途。

判断の材料が足りない・想定と違う結果が出た場合は、進めずにその結果だけ共有してください。
