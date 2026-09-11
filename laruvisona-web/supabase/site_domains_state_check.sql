-- ── site_domains の適用状態を、読み取りだけで確かめる ────────────────
--
--   psql -f supabase/site_domains_state_check.sql
--   （Supabase の SQL Editor にそのまま貼ってもよい）
--
-- update / insert / delete / grant / revoke は1つも無い。
--
-- 見るのは「宣言が書いてあるか」でも「存在するか」でもなく、
-- **いま実際にその内容になっているか**。
--   ・ポリシーは対象・条件まで現行定義と一致するか（USING(true) を弾く）
--   ・トリガは発火条件（tgtype）と呼出先の関数まで一致するか
--   ・権限は列単位・TRUNCATE まで含めて見る（表単位だけでは足りない）
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
        and regexp_replace(pg_get_expr(p.polqual, p.polrelid), '\s+', ' ', 'g') = norm.policy_qual)             as ok
),
colpriv as (
  select
    (select count(*) from pg_attribute a, obj
      where a.attrelid = obj.sd and a.attnum > 0 and not a.attisdropped and obj.r_auth is not null
        and (has_column_privilege(obj.r_auth, obj.sd, a.attnum, 'INSERT')
          or has_column_privilege(obj.r_auth, obj.sd, a.attnum, 'UPDATE')))                                     as auth_sd,
    (select count(*) from pg_attribute a, obj
      where a.attrelid = obj.sd and a.attnum > 0 and not a.attisdropped and obj.r_anon is not null
        and (has_column_privilege(obj.r_anon, obj.sd, a.attnum, 'INSERT')
          or has_column_privilege(obj.r_anon, obj.sd, a.attnum, 'UPDATE')))                                     as anon_sd,
    (select count(*) from pg_attribute a, obj
      where a.attrelid = obj.q and a.attnum > 0 and not a.attisdropped
        and (obj.r_auth is not null and (has_column_privilege(obj.r_auth, obj.q, a.attnum, 'SELECT')
          or has_column_privilege(obj.r_auth, obj.q, a.attnum, 'INSERT')
          or has_column_privilege(obj.r_auth, obj.q, a.attnum, 'UPDATE'))))                                    as auth_q,
    (select count(*) from pg_attribute a, obj
      where a.attrelid = obj.q and a.attnum > 0 and not a.attisdropped
        and (obj.r_anon is not null and (has_column_privilege(obj.r_anon, obj.q, a.attnum, 'SELECT')
          or has_column_privilege(obj.r_anon, obj.q, a.attnum, 'INSERT')
          or has_column_privilege(obj.r_anon, obj.q, a.attnum, 'UPDATE'))))                                    as anon_q
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
  union all select 16, 'RLS', 'そのポリシーが現行定義と一致（USING の中身まで）', '1',
         (select ok::text from polchk), (select ok = 1 from polchk)

  union all select 17, '実効権限', 'authenticated は site_domains を書けない（表）', 'false',
         (select (has_table_privilege(r_auth, sd, 'INSERT') or has_table_privilege(r_auth, sd, 'UPDATE') or has_table_privilege(r_auth, sd, 'DELETE'))::text from obj),
         (select not (has_table_privilege(r_auth, sd, 'INSERT') or has_table_privilege(r_auth, sd, 'UPDATE') or has_table_privilege(r_auth, sd, 'DELETE')) from obj)
  union all select 18, '実効権限', 'anon は site_domains を書けない（表）', 'false',
         (select (has_table_privilege(r_anon, sd, 'INSERT') or has_table_privilege(r_anon, sd, 'UPDATE') or has_table_privilege(r_anon, sd, 'DELETE'))::text from obj),
         (select not (has_table_privilege(r_anon, sd, 'INSERT') or has_table_privilege(r_anon, sd, 'UPDATE') or has_table_privilege(r_anon, sd, 'DELETE')) from obj)
  union all select 19, '実効権限', 'authenticated に site_domains の列単位の書き込み権限が無い', '0',
         (select auth_sd::text from colpriv), (select auth_sd = 0 from colpriv)
  union all select 20, '実効権限', 'anon に site_domains の列単位の書き込み権限が無い', '0',
         (select anon_sd::text from colpriv), (select anon_sd = 0 from colpriv)
  union all select 21, '実効権限', 'authenticated は site_domains を読める', 'true',
         (select has_table_privilege(r_auth, sd, 'SELECT')::text from obj),
         (select has_table_privilege(r_auth, sd, 'SELECT') from obj)
  union all select 22, '実効権限', 'authenticated は解除キューに触れない（表・列）', '0',
         (select ((case when has_table_privilege(r_auth, q, 'SELECT') or has_table_privilege(r_auth, q, 'INSERT') or has_table_privilege(r_auth, q, 'UPDATE') or has_table_privilege(r_auth, q, 'DELETE') then 1 else 0 end) + (select auth_q from colpriv))::text from obj),
         (select not (has_table_privilege(r_auth, q, 'SELECT') or has_table_privilege(r_auth, q, 'INSERT') or has_table_privilege(r_auth, q, 'UPDATE') or has_table_privilege(r_auth, q, 'DELETE')) and (select auth_q = 0 from colpriv) from obj)
  union all select 23, '実効権限', 'anon は解除キューに触れない（表・列）', '0',
         (select ((case when has_table_privilege(r_anon, q, 'SELECT') or has_table_privilege(r_anon, q, 'INSERT') or has_table_privilege(r_anon, q, 'UPDATE') or has_table_privilege(r_anon, q, 'DELETE') then 1 else 0 end) + (select anon_q from colpriv))::text from obj),
         (select not (has_table_privilege(r_anon, q, 'SELECT') or has_table_privilege(r_anon, q, 'INSERT') or has_table_privilege(r_anon, q, 'UPDATE') or has_table_privilege(r_anon, q, 'DELETE')) and (select anon_q = 0 from colpriv) from obj)
  union all select 24, '実効権限', 'service_role は site_domains を読み書きできる', 'true',
         (select (has_table_privilege(r_svc, sd, 'SELECT') and has_table_privilege(r_svc, sd, 'INSERT') and has_table_privilege(r_svc, sd, 'UPDATE') and has_table_privilege(r_svc, sd, 'DELETE'))::text from obj),
         (select has_table_privilege(r_svc, sd, 'SELECT') and has_table_privilege(r_svc, sd, 'INSERT') and has_table_privilege(r_svc, sd, 'UPDATE') and has_table_privilege(r_svc, sd, 'DELETE') from obj)
  union all select 25, '実効権限', 'service_role は解除キューを読み書きできる', 'true',
         (select (has_table_privilege(r_svc, q, 'SELECT') and has_table_privilege(r_svc, q, 'INSERT') and has_table_privilege(r_svc, q, 'UPDATE') and has_table_privilege(r_svc, q, 'DELETE'))::text from obj),
         (select has_table_privilege(r_svc, q, 'SELECT') and has_table_privilege(r_svc, q, 'INSERT') and has_table_privilege(r_svc, q, 'UPDATE') and has_table_privilege(r_svc, q, 'DELETE') from obj)
  union all select 26, '実効権限', 'service_role が schema public を使える', 'true',
         (select has_schema_privilege(r_svc, 'public', 'USAGE')::text from obj),
         (select has_schema_privilege(r_svc, 'public', 'USAGE') from obj)

  union all select 27, '積み残し', 'authenticated に TRUNCATE/REFERENCES/TRIGGER が残っていない', 'false',
         (select (has_table_privilege(r_auth, sd, 'TRUNCATE') or has_table_privilege(r_auth, sd, 'REFERENCES') or has_table_privilege(r_auth, sd, 'TRIGGER'))::text from obj),
         (select not (has_table_privilege(r_auth, sd, 'TRUNCATE') or has_table_privilege(r_auth, sd, 'REFERENCES') or has_table_privilege(r_auth, sd, 'TRIGGER')) from obj)
  union all select 28, '積み残し', 'anon に TRUNCATE/REFERENCES/TRIGGER が残っていない', 'false',
         (select (has_table_privilege(r_anon, sd, 'TRUNCATE') or has_table_privilege(r_anon, sd, 'REFERENCES') or has_table_privilege(r_anon, sd, 'TRIGGER'))::text from obj),
         (select not (has_table_privilege(r_anon, sd, 'TRUNCATE') or has_table_privilege(r_anon, sd, 'REFERENCES') or has_table_privilege(r_anon, sd, 'TRIGGER')) from obj)

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
select 99, '判定', '望ましい状態（積み残しを含む）', 'true',
       (select (count(*) filter (where not ok) = 0)::text from res),
       (select count(*) filter (where not ok) = 0 from res)
order by n;
