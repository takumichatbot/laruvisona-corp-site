# 本番の読み取り確認（C-1〜C-5）— 記録シート

日付: 2026-09-11 23:02〜23:11 JST　実施: Codex（齋藤さんの認証済み管理画面で読み取り）

**この紙で行うのは読み取りだけ。1行も書かない。**
デプロイの承認・本番の性能確認とは分けている。C-6 はデプロイの後なのでここには無い。

出す対象: `rebuild-2026-09` / コードの最終コミット `ef8b84d`
（先端SHAは push 直前に `git rev-parse HEAD` で控える）

---

## 確認結果（Codex、2026-09-11 23:02〜23:11 JST）

4762c7aで記録されたClaude環境の「未確認」を保持した履歴に対し、Codexが別環境から確認した結果を追記・記入したもの。**確認完了は出荷承認ではない。独自ドメインの準備は未完了。**

| | 状態 | 確認した事実 |
|---|---|---|
| C-1 (a) GitHub main の先端 | 確認済み | `0d00dfe82b3688dfafb03058cca0e1e560ce4165` |
| C-1 (b) Render が動かしているSHA | 確認済み | 対象サービスのLiveは `0d00dfe`（表示された短縮SHA） |
| C-2 保存済みHTMLの版の分布 | 確認済み | 公開中1件、v3が1件、v11に揃っていない件数1 |
| C-3 `site_domains` の適用状態 | 確認済み・未適用 | 98=false / 99=false。2表なし、必要な11関数なし |
| C-4 設定の有無 | 確認済み・不足あり | `DOMAIN_PROBE_SECRET`、`RENDER_APEX_IP` は無。その他下記4キーは有 |
| C-5 `REPUBLISH_ON_BOOT` が無いこと | 確認済み | キーなし |

証拠: [結果CSVと取得方法](review-evidence/prod-readonly-2026-09-11/README.md)。本番DBへの実行は読み取り専用トランザクションだけ。設定値は記録していない。

参考（ローカルで読めた値。**本番の状態ではない**）:

| | 値 |
|---|---|
| `rebuild-2026-09` の先端 | `79a6d4d`（`ef8b84d` 以降は確認SQLと記録だけ） |
| ローカル `main` | `f9a49ee`（最後に取得した `origin/main` `0d00dfe` から28コミット先、未push） |
| 最後に取得した `origin/main` | `0d00dfe`（**取得した時点の値**。いまの GitHub の先端とは限らない） |

---

## やってはいけないこと

- **本番の `/api/admin/republish-all` を叩かない。** `dryRun` を付けても叩かない。
  `origin/main`（`0d00dfe`）のコードは **`dryRun` を読まずに公開サイトを全件作り直す**。
  本番がそのSHAで動いているかは C-1 で確かめるまで分からないが、
  **分からないうちは叩かない**。新版の `dryRun` が使えるのは、
  Render で新版が Live になったことを確認した後（C-6）。
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
| (a) GitHub main の先端 | `0d00dfe82b3688dfafb03058cca0e1e560ce4165` |
| (b) Render が動かしているSHA | `0d00dfe`（Live表示。サービス `srv-d8oq30ho3t8c73dvj3gg`） |

**(a) と (b) が違う場合、本番で動いているのは (b)。** 以降の判断は (b) を基準にする。

**今回の観測では、GitHubの先端とRenderのLiveは短縮SHA `0d00dfe` で一致。** デプロイ実行時には再確認する。

→ (b) が `0d00dfe` でなかった場合は、**ここで止めて報告**。
　 そのSHAのコードが `dryRun` を読むかどうかから調べ直す必要がある。

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
| 3 | 1 |

```sql
-- いまの版（11）に揃っていない行の件数
select count(*)
from public.sites
where published is true
  and (published_html is null or published_html not like '%<!--lhpv:11-->%');
```

作り直しの対象になる件数: **1件**（公開済みのみ、v11以外）。再生成は未実施。

> 「コードの版が3だから全部 v3」ではない。`published_html` は
> **その行を最後に公開したときのコード**で書かれている。混ざっていて正常。

---

## C-3. `site_domains` の適用状態（独自ドメインを出すなら必須）

**表があること＝移行が終わったこと、ではない。**
見るのは「宣言が書いてあるか」でも「存在するか」でもなく、
**いま実際にその内容になっているか**（ポリシーの**対象ロール**と USING の中身、
トリガの発火条件と呼出先、**2つの表それぞれ**について列単位・`TRUNCATE`/`REFERENCES`/`TRIGGER`
まで含めた実効権限、列の型、制約の定義文、索引が部分索引でないか、
`search_path` の正確な一致）。

下をそのまま1本流す。`update`/`insert`/`delete`/`grant`/`revoke` は無い。
リポジトリの `supabase/site_domains_state_check.sql` と同じもの。

```sql
-- ── site_domains の適用状態を、読み取りだけで確かめる ────────────────
--
--   psql -f supabase/site_domains_state_check.sql
--   （Supabase の SQL Editor にそのまま貼ってもよい）
--
-- update / insert / delete / grant / revoke は1つも無い。
--
-- 見るのは「宣言が書いてあるか」でも「存在するか」でもなく、
-- **いま実際にその内容になっているか**。
--   ・ポリシーは対象ロール・条件まで現行定義と一致するか
--     （USING(true) も TO service_role も弾く）
--   ・トリガは発火条件（tgtype）と呼出先の関数まで一致するか
--   ・権限は2つの表それぞれについて、列単位・TRUNCATE/REFERENCES/TRIGGER
--     まで含めて見る（表単位の4権限だけでは足りない）
--   ・必要な3ロールが存在するか（欠けていると権限の検査が素通りする）
--   ・列は名前だけでなく型まで、制約は定義文、索引は部分索引でないかまで
--   ・search_path は = で正確に照合（like だと public_shadow が通る）
--
-- 表やロールが無くてもエラーにならない（::regclass ではなく to_regclass）。
-- 未適用なら「対象なし」と出て、判定は false になる。
--
-- 判定は2行ある。
--   98 適用の判定      … site_domains.sql が正しく当たっているか
--   99 望ましい状態    … 98 に「移行SQLの積み残し」を足したもの
-- 区分が「積み残し」の行は、**現行の site_domains.sql を当てただけでは false**。
-- 検査の誤りではなく、移行SQL側にまだ revoke が無いという意味。
--
-- **98=true は「独自ドメインを公開してよい」という意味ではない。**
-- 98 は「移行SQLの内容どおりか」だけを見る。公開の可否は 99 で判断する。
-- 99=false のあいだは、権限の是正を入れるか、例外として残す判断を
-- 明示的に記録するまで、独自ドメインの有効化を始めない。
-- なお解除キュー（domain_release_queue）は site_domains.sql が
-- revoke all しているので、TRUNCATE 等が残っていたら積み残しではなく
-- 「適用の判定」側（22/23行）の不合格になる。
--
with obj as (
  select to_regclass('public.site_domains')         as sd,
         to_regclass('public.domain_release_queue') as q,
         to_regclass('public.sites')                as sites,
         to_regrole('anon')                         as r_anon,
         to_regrole('authenticated')                as r_auth,
         to_regrole('service_role')                 as r_svc
),
need_fn(sig) as (values
  ('laruhp_domain_apply_check(uuid,text,text,bigint,text,text,text,boolean,text)'),
  ('laruhp_domain_begin_release(uuid,text,integer)'),
  ('laruhp_domain_claim_release(uuid,text,bigint,uuid,integer)'),
  ('laruhp_domain_enqueue_orphan_registration(uuid,text,text,text,bigint,text)'),
  ('laruhp_domain_finish_release(uuid,text,text,bigint,boolean)'),
  ('laruhp_domain_mark_register_started(uuid,text,text,bigint)'),
  ('laruhp_domain_mark_release_failed(uuid,text,bigint,text)'),
  ('laruhp_domain_pending_queue(text)'),
  ('laruhp_domain_pin_release_target(uuid,text,bigint,uuid,text)'),
  ('laruhp_domain_resolve_queue_entry(uuid,text)'),
  ('laruhp_domain_set_primary(uuid,text,text,bigint)')
),
need_col(tbl, col, typ) as (values
  ('site_domains','operation_epoch','bigint'),
  ('site_domains','render_register_started_at','timestamp with time zone'),
  ('site_domains','external_registration_owned','boolean'),
  ('site_domains','release_operation_id','uuid'),
  ('site_domains','release_lease_until','timestamp with time zone'),
  ('site_domains','redirects_to','text'),
  ('domain_release_queue','verification_token','text'),
  ('domain_release_queue','operation_epoch','bigint'),
  ('domain_release_queue','release_operation_id','uuid'),
  ('domain_release_queue','external_registration_owned','boolean'),
  ('domain_release_queue','kind','text')
),
need_trg(tgname, tbl, tgtype, fn) as (values
  ('guard_sites_custom_domain_trg',    'sites',        23, 'guard_sites_custom_domain()'),
  ('site_domains_touch',               'site_domains', 19, 'site_domains_touch_updated_at()'),
  ('site_domains_enqueue_release_trg', 'site_domains', 11, 'site_domains_enqueue_release()')
),
norm as (
  select $q$(site_id IN ( SELECT sites.id FROM sites WHERE (sites.user_id = auth.uid())))$q$ as policy_qual,
         $q$CHECK ((status = ANY (ARRAY['pending_ownership'::text, 'pending_dns'::text, 'ssl_pending'::text, 'connected'::text, 'failed'::text, 'legacy'::text, 'release_pending'::text, 'alias'::text])))$q$ as status_def
),
have_fn as (
  select p.oid,
         p.proname || '(' || replace(pg_catalog.oidvectortypes(p.proargtypes), ' ', '') || ')' as sig,
         p.prosecdef,
         p.proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'laruhp\_domain\_%'
),
fn as (
  select
    (select count(*) from need_fn x where not exists (select 1 from have_fn y where y.sig = x.sig))            as missing,
    (select count(*) from have_fn y where not exists (select 1 from need_fn x where x.sig = y.sig))            as extra,
    (select count(*) from have_fn y join need_fn x on x.sig = y.sig where not y.prosecdef)                     as not_definer,
    (select count(*) from have_fn y join need_fn x on x.sig = y.sig
       where coalesce(y.proconfig, array[]::text[]) <> array['search_path=public'])                            as bad_path,
    (select count(*) from have_fn y join need_fn x on x.sig = y.sig, obj
       where obj.r_auth is not null and has_function_privilege(obj.r_auth, y.oid, 'EXECUTE'))                  as auth_can,
    (select count(*) from have_fn y join need_fn x on x.sig = y.sig, obj
       where obj.r_anon is not null and has_function_privilege(obj.r_anon, y.oid, 'EXECUTE'))                  as anon_can,
    (select count(*) from have_fn y join need_fn x on x.sig = y.sig, obj
       where obj.r_svc is not null and not has_function_privilege(obj.r_svc, y.oid, 'EXECUTE'))                as svc_cannot
),
colchk as (
  select
    (select count(*) from need_col n
       join information_schema.columns c
         on c.table_schema = 'public' and c.table_name = n.tbl
        and c.column_name = n.col and c.data_type = n.typ
      where n.tbl = 'site_domains')                                                                            as sd_ok,
    (select count(*) from need_col n
       join information_schema.columns c
         on c.table_schema = 'public' and c.table_name = n.tbl
        and c.column_name = n.col and c.data_type = n.typ
      where n.tbl = 'domain_release_queue')                                                                    as q_ok
),
trgchk as (
  select n.tgname,
         (select count(*) from pg_trigger t, obj
           where t.tgrelid = case n.tbl when 'sites' then obj.sites else obj.sd end
             and not t.tgisinternal
             and t.tgname = n.tgname
             and t.tgtype = n.tgtype
             and t.tgfoid::regprocedure::text = n.fn
             and t.tgqual is null
             and t.tgenabled in ('O','A')) as ok
  from need_trg n
),
polchk as (
  select
    (select count(*) from pg_policy p, obj where p.polrelid = obj.sd)                                          as n_pol,
    (select count(*) from pg_policy p, obj, norm
      where p.polrelid = obj.sd
        and p.polname = 'Users read own site_domains'
        and p.polcmd = 'r'
        and p.polpermissive
        and p.polwithcheck is null
        -- TO を省いた定義＝PUBLIC。TO service_role などに変えられたら弾く。
        and p.polroles = '{0}'::oid[]
        and regexp_replace(pg_get_expr(p.polqual, p.polrelid), '\s+', ' ', 'g') = norm.policy_qual)             as ok
),
-- ── 権限は「2つの表 × 2つの利用者ロール」を同じ物差しで見る ──
tgt(rname, roid, tname, toid) as (
  select 'anon',          obj.r_anon, 'site_domains',         obj.sd from obj
  union all select 'anon',          obj.r_anon, 'domain_release_queue', obj.q  from obj
  union all select 'authenticated', obj.r_auth, 'site_domains',         obj.sd from obj
  union all select 'authenticated', obj.r_auth, 'domain_release_queue', obj.q  from obj
),
tacl as (
  select rname, tname,
         has_table_privilege(roid, toid, 'SELECT')     as p_sel,
         has_table_privilege(roid, toid, 'INSERT')     as p_ins,
         has_table_privilege(roid, toid, 'UPDATE')     as p_upd,
         has_table_privilege(roid, toid, 'DELETE')     as p_del,
         has_table_privilege(roid, toid, 'TRUNCATE')   as p_trunc,
         has_table_privilege(roid, toid, 'REFERENCES') as p_ref,
         has_table_privilege(roid, toid, 'TRIGGER')    as p_trig
  from tgt where roid is not null and toid is not null
),
cacl as (
  select t.rname, t.tname,
         count(*) filter (where has_column_privilege(t.roid, t.toid, a.attnum, 'SELECT'))     as c_sel,
         count(*) filter (where has_column_privilege(t.roid, t.toid, a.attnum, 'INSERT'))     as c_ins,
         count(*) filter (where has_column_privilege(t.roid, t.toid, a.attnum, 'UPDATE'))     as c_upd,
         count(*) filter (where has_column_privilege(t.roid, t.toid, a.attnum, 'REFERENCES')) as c_ref
  from tgt t
  join pg_attribute a on a.attrelid = t.toid and a.attnum > 0 and not a.attisdropped
  where t.roid is not null and t.toid is not null
  group by 1, 2
),
rows0 as (
select * from (
  select 1 as n, '存在' as 区分, 'site_domains がある' as 項目, 'true' as 期待,
         coalesce((select (sd is not null)::text from obj), 'false') as 実際,
         (select sd is not null from obj) as ok
  union all select 2, '存在', 'domain_release_queue がある', 'true',
         coalesce((select (q is not null)::text from obj), 'false'), (select q is not null from obj)
  union all select 3, 'ロール', 'anon がある', 'true', (select (r_anon is not null)::text from obj), (select r_anon is not null from obj)
  union all select 4, 'ロール', 'authenticated がある', 'true', (select (r_auth is not null)::text from obj), (select r_auth is not null from obj)
  union all select 5, 'ロール', 'service_role がある', 'true', (select (r_svc is not null)::text from obj), (select r_svc is not null from obj)

  union all select 6, '列と型', 'site_domains の追加列（名前＋型）', '6', (select sd_ok::text from colchk), (select sd_ok = 6 from colchk)
  union all select 7, '列と型', 'domain_release_queue の追加列（名前＋型）', '5', (select q_ok::text from colchk), (select q_ok = 5 from colchk)

  union all select 8, '制約', 'status の check が現行定義と一致', 'true',
         coalesce((select (regexp_replace(pg_get_constraintdef(c.oid), '\s+', ' ', 'g') = norm.status_def)::text
                     from pg_constraint c, obj, norm
                    where c.conrelid = obj.sd and c.conname = 'site_domains_status_check'), 'false'),
         coalesce((select regexp_replace(pg_get_constraintdef(c.oid), '\s+', ' ', 'g') = norm.status_def
                     from pg_constraint c, obj, norm
                    where c.conrelid = obj.sd and c.conname = 'site_domains_status_check'), false)
  union all select 9, '索引', 'host の一意索引（部分・式でなく有効）', 'true',
         coalesce((select (count(*) > 0)::text from pg_index i, obj
                    where i.indrelid = obj.sd and i.indisunique and i.indisvalid
                      and i.indpred is null and i.indexprs is null
                      and (select array_agg(attname order by attnum) from pg_attribute
                            where attrelid = obj.sd and attnum = any(i.indkey)) = array['host']::name[]), 'false'),
         coalesce((select count(*) > 0 from pg_index i, obj
                    where i.indrelid = obj.sd and i.indisunique and i.indisvalid
                      and i.indpred is null and i.indexprs is null
                      and (select array_agg(attname order by attnum) from pg_attribute
                            where attrelid = obj.sd and attnum = any(i.indkey)) = array['host']::name[]), false)

  union all select 10, 'トリガ', 'guard_sites_custom_domain_trg（発火条件・呼出先まで）', '1',
         (select ok::text from trgchk where tgname = 'guard_sites_custom_domain_trg'),
         (select ok = 1 from trgchk where tgname = 'guard_sites_custom_domain_trg')
  union all select 11, 'トリガ', 'site_domains_touch（同上）', '1',
         (select ok::text from trgchk where tgname = 'site_domains_touch'),
         (select ok = 1 from trgchk where tgname = 'site_domains_touch')
  union all select 12, 'トリガ', 'site_domains_enqueue_release_trg（同上）', '1',
         (select ok::text from trgchk where tgname = 'site_domains_enqueue_release_trg'),
         (select ok = 1 from trgchk where tgname = 'site_domains_enqueue_release_trg')

  union all select 13, 'RLS', 'site_domains の RLS が有効', 'true',
         coalesce((select relrowsecurity::text from pg_class c, obj where c.oid = obj.sd), '（対象なし）'),
         (select relrowsecurity from pg_class c, obj where c.oid = obj.sd)
  union all select 14, 'RLS', 'domain_release_queue の RLS が有効', 'true',
         coalesce((select relrowsecurity::text from pg_class c, obj where c.oid = obj.q), '（対象なし）'),
         (select relrowsecurity from pg_class c, obj where c.oid = obj.q)
  union all select 15, 'RLS', 'ポリシーは1本だけ', '1', (select n_pol::text from polchk), (select n_pol = 1 from polchk)
  union all select 16, 'RLS', 'そのポリシーが現行定義と一致（対象ロール・USING の中身まで）', '1',
         (select ok::text from polchk), (select ok = 1 from polchk)

  union all select 17, '実効権限', 'authenticated は site_domains を書けない（表）', 'false',
         (select (p_ins or p_upd or p_del)::text from tacl where rname = 'authenticated' and tname = 'site_domains'),
         exists (select 1 from tacl where rname = 'authenticated' and tname = 'site_domains' and not (p_ins or p_upd or p_del))
  union all select 18, '実効権限', 'anon は site_domains を書けない（表）', 'false',
         (select (p_ins or p_upd or p_del)::text from tacl where rname = 'anon' and tname = 'site_domains'),
         exists (select 1 from tacl where rname = 'anon' and tname = 'site_domains' and not (p_ins or p_upd or p_del))
  union all select 19, '実効権限', 'authenticated に site_domains の列単位の書き込み権限が無い', '0',
         (select (c_ins + c_upd)::text from cacl where rname = 'authenticated' and tname = 'site_domains'),
         exists (select 1 from cacl where rname = 'authenticated' and tname = 'site_domains' and c_ins + c_upd = 0)
  union all select 20, '実効権限', 'anon に site_domains の列単位の書き込み権限が無い', '0',
         (select (c_ins + c_upd)::text from cacl where rname = 'anon' and tname = 'site_domains'),
         exists (select 1 from cacl where rname = 'anon' and tname = 'site_domains' and c_ins + c_upd = 0)
  union all select 21, '実効権限', 'authenticated は site_domains を読める', 'true',
         (select p_sel::text from tacl where rname = 'authenticated' and tname = 'site_domains'),
         exists (select 1 from tacl where rname = 'authenticated' and tname = 'site_domains' and p_sel)
  union all select 22, '実効権限', 'authenticated は解除キューに一切触れない（表・列／TRUNCATE等も）', '0',
         (select (t.p_sel::int + t.p_ins::int + t.p_upd::int + t.p_del::int
                  + t.p_trunc::int + t.p_ref::int + t.p_trig::int
                  + c.c_sel + c.c_ins + c.c_upd + c.c_ref)::text
            from tacl t join cacl c using (rname, tname)
           where t.rname = 'authenticated' and t.tname = 'domain_release_queue'),
         exists (select 1 from tacl t join cacl c using (rname, tname)
                  where t.rname = 'authenticated' and t.tname = 'domain_release_queue'
                    and not (t.p_sel or t.p_ins or t.p_upd or t.p_del or t.p_trunc or t.p_ref or t.p_trig)
                    and c.c_sel + c.c_ins + c.c_upd + c.c_ref = 0)
  union all select 23, '実効権限', 'anon は解除キューに一切触れない（表・列／TRUNCATE等も）', '0',
         (select (t.p_sel::int + t.p_ins::int + t.p_upd::int + t.p_del::int
                  + t.p_trunc::int + t.p_ref::int + t.p_trig::int
                  + c.c_sel + c.c_ins + c.c_upd + c.c_ref)::text
            from tacl t join cacl c using (rname, tname)
           where t.rname = 'anon' and t.tname = 'domain_release_queue'),
         exists (select 1 from tacl t join cacl c using (rname, tname)
                  where t.rname = 'anon' and t.tname = 'domain_release_queue'
                    and not (t.p_sel or t.p_ins or t.p_upd or t.p_del or t.p_trunc or t.p_ref or t.p_trig)
                    and c.c_sel + c.c_ins + c.c_upd + c.c_ref = 0)
  union all select 24, '実効権限', 'service_role は site_domains を読み書きできる', 'true',
         (select (has_table_privilege(r_svc, sd, 'SELECT') and has_table_privilege(r_svc, sd, 'INSERT') and has_table_privilege(r_svc, sd, 'UPDATE') and has_table_privilege(r_svc, sd, 'DELETE'))::text from obj),
         (select has_table_privilege(r_svc, sd, 'SELECT') and has_table_privilege(r_svc, sd, 'INSERT') and has_table_privilege(r_svc, sd, 'UPDATE') and has_table_privilege(r_svc, sd, 'DELETE') from obj)
  union all select 25, '実効権限', 'service_role は解除キューを読み書きできる', 'true',
         (select (has_table_privilege(r_svc, q, 'SELECT') and has_table_privilege(r_svc, q, 'INSERT') and has_table_privilege(r_svc, q, 'UPDATE') and has_table_privilege(r_svc, q, 'DELETE'))::text from obj),
         (select has_table_privilege(r_svc, q, 'SELECT') and has_table_privilege(r_svc, q, 'INSERT') and has_table_privilege(r_svc, q, 'UPDATE') and has_table_privilege(r_svc, q, 'DELETE') from obj)
  union all select 26, '実効権限', 'service_role が schema public を使える', 'true',
         (select has_schema_privilege(r_svc, 'public', 'USAGE')::text from obj),
         (select has_schema_privilege(r_svc, 'public', 'USAGE') from obj)

  union all select 27, '積み残し', 'authenticated に site_domains の TRUNCATE/REFERENCES/TRIGGER が残っていない', 'false',
         (select (t.p_trunc or t.p_ref or t.p_trig or c.c_ref > 0)::text
            from tacl t join cacl c using (rname, tname)
           where t.rname = 'authenticated' and t.tname = 'site_domains'),
         exists (select 1 from tacl t join cacl c using (rname, tname)
                  where t.rname = 'authenticated' and t.tname = 'site_domains'
                    and not (t.p_trunc or t.p_ref or t.p_trig) and c.c_ref = 0)
  union all select 28, '積み残し', 'anon に site_domains の TRUNCATE/REFERENCES/TRIGGER が残っていない', 'false',
         (select (t.p_trunc or t.p_ref or t.p_trig or c.c_ref > 0)::text
            from tacl t join cacl c using (rname, tname)
           where t.rname = 'anon' and t.tname = 'site_domains'),
         exists (select 1 from tacl t join cacl c using (rname, tname)
                  where t.rname = 'anon' and t.tname = 'site_domains'
                    and not (t.p_trunc or t.p_ref or t.p_trig) and c.c_ref = 0)

  union all select 29, '関数', '必要な11件が名前＋引数型でそろう', '0', (select missing::text from fn), (select missing = 0 from fn)
  union all select 30, '関数', '一覧に無い laruhp_domain_* が無い', '0', (select extra::text from fn), (select extra = 0 from fn)
  union all select 31, '関数', '11件とも security definer', '0', (select not_definer::text from fn), (select not_definer = 0 from fn)
  union all select 32, '関数', '11件とも search_path が正確に public', '0', (select bad_path::text from fn), (select bad_path = 0 from fn)
  union all select 33, '関数', 'authenticated から実行できない', '0', (select auth_can::text from fn), (select auth_can = 0 from fn)
  union all select 34, '関数', 'anon から実行できない', '0', (select anon_can::text from fn), (select anon_can = 0 from fn)
  union all select 35, '関数', 'service_role から実行できる', '0', (select svc_cannot::text from fn), (select svc_cannot = 0 from fn)
) t0
),
res as (
  select n, 区分, 項目, 期待, coalesce(実際, '（対象なし）') as 実際, coalesce(ok, false) as ok from rows0
)
select * from res
union all
select 98, '判定', '適用の判定（積み残しを除く）', 'true',
       (select (count(*) filter (where not ok and 区分 <> '積み残し') = 0)::text from res),
       (select count(*) filter (where not ok and 区分 <> '積み残し') = 0 from res)
union all
select 99, '判定', '望ましい状態（積み残しを含む）／公開可否はこちらで判断', 'true',
       (select (count(*) filter (where not ok) = 0)::text from res),
       (select count(*) filter (where not ok) = 0 from res)
order by n;
```

**判定は最後の2行。**

| | 結果 |
|---|---|
| `98 適用の判定`（積み残しを除く） | **false** |
| `99 望ましい状態`（積み残しを含む） | **false** |
| false だった行の番号と項目 | 1, 2, 6〜25, 27〜29。項目名と実値は下記CSV |

[全37行の実測結果](review-evidence/prod-readonly-2026-09-11/site-domains-state-production.csv)。2表がないため権限の多くは「対象なし」。27/28のfalseを「禁止権限の残存を実測した」と解釈しない。関数31〜35がtrueでも必要関数がないため29はfalse。

> **この記録より後の変更（2026-09-11 追記）。** 上の実測値は当時のまま。
> この結果を受けて `supabase/site_domains.sql` に
> `revoke truncate, references, trigger on public.site_domains from authenticated, anon;` を足し、
> 確認SQLの 27・28行を「積み残し」から通常の権限検査へ移した。
> **適用後の再確認では、98 も 99 も true が期待値**になる（例外承認は前提にしない）。
> 上に貼ってある確認SQLはこの記録を取った時点のもの。再確認にはリポジトリの
> `supabase/site_domains_state_check.sql` の最新版を使う。実行案は
> `docs/release-plan-2026-09-11.md`。

### この2行の使い分け（独自ドメインを出してよいかの判断）

- `98` が見ているのは「`site_domains.sql` の内容どおりに当たっているか」だけ。
  **`98=true` は「独自ドメインを公開してよい」という意味ではない。**
- **公開の可否は `99` で判断する。** `99=false` のあいだは、次のどちらかが済むまで
  **独自ドメインの有効化を始めない**。
  1. 残っている権限を取り消す移行SQLを当てて `99=true` にする
  2. 残したまま進める理由と、判断した人・日付をこのシートに書いて、**例外として明示する**
- `98=false` なら移行そのものが未了。是正するまで先へ進めない。

| | 記入 |
|---|---|
| `99` が false のときの扱い | **停止。移行・是正の本番適用は未承認。98=falseなので例外で有効化しない** |
| 例外にした場合の理由 | 例外判断なし |
| 判断した人・日付 | 出荷・例外の判断は未実施。読み取り実施: Codex、2026-09-11 |

**`98 適用の判定` が true のとき、保証しているのはここまで:**

- 表・列（**名前と型**）・`status` の check 定義・`host` の一意索引の形
  （部分索引でも式索引でもなく有効）
- トリガ3本が、**発火条件（BEFORE/INSERT/UPDATE/DELETE・行単位）と呼出先の関数**まで
  現行定義と同じで、`WHEN` が付いておらず、有効
- `site_domains` と `domain_release_queue` の RLS が有効で、
  ポリシーは**1本だけ**、その**対象ロール（`TO` を省いた定義＝PUBLIC）**と
  **USING の中身**まで現行定義と同じ
- 必要な3ロール（`anon` / `authenticated` / `service_role`）が存在する
- `anon` / `authenticated` が `site_domains` を**表でも列単位でも書けない**
  （`insert` / `update` / `delete`。`TRUNCATE` などは 27/28 で別に見る）
- `anon` / `authenticated` が `domain_release_queue` に**一切触れない**
  ―― 表・列単位の読み書きに加えて `TRUNCATE` / `REFERENCES` / `TRIGGER` まで含めて 0 件。
  解除キューは `site_domains.sql` が `revoke all` しているので、
  ここが残っていたら積み残しではなく**適用の不一致**として 22/23 行が落ちる
- `service_role` が両表を読み書きでき、`public` スキーマを使え、RPC 11本を実行できる
- RPC 11本が**名前＋引数型**でそろい、`security definer` で、
  `search_path` が**正確に** `public`（`public_shadow` などは弾く）

**保証していないこと（残る限界）:**

- **実際に接続して書き込みを試した結果ではない。** カタログ（`pg_*` / `information_schema`）と
  権限関数の照合であって、`authenticated` で接続して `insert` してみた結果ではない
- **「書けない」は上に列挙した権限の範囲に限る。** `site_domains` の
  `TRUNCATE` / `REFERENCES` / `TRIGGER` は 98 ではなく 27/28（＝99）側で見る。
  「何もできない」という無条件の意味ではない
- **ポリシーが「意図した行だけ」を返すかは見ていない。** 対象ロールと定義文が一致することは見るが、
  `auth.uid()` を伴う実行結果までは確かめていない
- **関数とトリガ関数の本文は見ていない。** 名前・引数型・`security definer`・`search_path` まで
- `postgres` / `dashboard_user` など**他のロール**、`auth` など**他のスキーマ**からの経路は見ていない
- **将来の default privileges** は見ていない（いま付いている権限だけ）
- 行レベルの実データ（取り込み済みの `legacy` 行の中身など）は見ていない

**`27` `28` は「積み残し」。** 現行の `site_domains.sql` は `site_domains` については
`insert, update, delete` しか revoke していないため、Supabase の既定付与で
`anon` / `authenticated` に `TRUNCATE` / `REFERENCES` / `TRIGGER` が残る。
**当てただけでは false になる。** 検査の誤りではない。
（`domain_release_queue` は `revoke all` があるので残らない。残っていたら 22/23 行が落ちる。）
塞ぐなら移行SQL側に次を足す（**今回は入れていない。本番の権限も変更していない**）:

```
revoke truncate, references, trigger on public.site_domains from anon, authenticated;
```

**表が無くてもエラーにならない。** 未適用なら「対象なし」と出て 98 も false。
その場合は「未適用」と記録すればよい。

→ 足りないものがあっても**その場では流さない**。何が false だったかだけ控えて報告。

> 流し直すときの注意（出す順の7番）：`site_domains.sql` は
> 「足りない分だけが入る」わけではない。**関数11本は `create or replace` で置き換え**、
> **旧シグネチャは `drop function`**、**権限・ポリシー・トリガは作り直し**、
> 末尾で `sites.custom_domain` の行を `site_domains` へ
> **`insert ... on conflict do nothing` で取り込む**（データが増える）。
> 表・列・索引だけが `if not exists` で足されるだけ。

## C-4. 設定の有無（値は見ない）

Render の Environment 画面で、**キーがあるかどうかだけ**を目で見る。

| キー | 期待 | 有無 |
|---|---|---|
| `DOMAIN_PROBE_SECRET` | 独自ドメインを出すなら必須（**新規**） | **無** |
| `RENDER_API_KEY` | 既存のはず | **有** |
| `RENDER_SERVICE_ID` | 既存のはず | **有** |
| `RENDER_SERVICE_SLUG` | 既存のはず | **有** |
| `RENDER_APEX_IP` | 既存のはず | **無** |
| `ADMIN_SECRET` | 既存 | **有** |

`RENDER_APEX_IP` は未設定だが、候補コードの domain/route.ts:19 に既定値 `216.24.57.1` がある。設定キーの不存在と接続不能は別の事実で、実DNS接続は今回未検証。

値はコピーしない。`DOMAIN_PROBE_SECRET` は到達確認の署名鍵で、漏れると確認を偽装できる。

---

## C-5. `REPUBLISH_ON_BOOT` が**無い**こと

同じ Environment 画面で確認する。

`REPUBLISH_ON_BOOT`: **無い（確認済み）**。Environment画面のキー一覧で確認。

→ **ある場合は、ここで止めて報告。** デプロイの前に外す。

---

## 終わったら

この紙の空欄を埋めた状態で戻してください。次は出す順の 1（取り込み）からで、
そこからは**本番に書く操作**が入ります。デプロイの承認はそのときに別途。

C-3 の `99` が false のままなら、**独自ドメインの有効化には進みません**。
権限を是正して `99=true` にするか、残す理由と判断した人・日付をこの紙に書いて
例外として明示するまで止めます（`98=true` はその判断の代わりにはなりません）。

判断の材料が足りない・想定と違う結果が出た場合は、進めずにその結果だけ共有してください。
