-- ── site_domains の適用状態を、読み取りだけで確かめる ────────────────
--
--   psql -f supabase/site_domains_state_check.sql
--   （Supabase の SQL Editor にそのまま貼ってもよい）
--
-- update / insert / delete は1つも無い。
--
-- 見るのは「宣言が書いてあるか」ではなく **いま実際にそうなっているか**。
--   ・RLS が有効か（無効化されていないか）
--   ・トリガが有効か（disable されていないか）
--   ・authenticated / anon が実際に書けてしまわないか（has_table_privilege）
--   ・RPC を authenticated / anon が実際に実行できてしまわないか
--   ・関数は**名前＋引数型**でそろっているか（旧シグネチャに置き換わっていないか）
--   ・解除キューの追加列まで入っているか
--
-- 表が無くてもエラーにならない（::regclass ではなく to_regclass を使う）。
-- 未適用なら「対象なし」と出て、総合は false になる。
--
-- 一時PostgreSQLで、次の壊し方をすべて検出することを確認済み:
--   RPCを authenticated へ開放 / RLS を無効化 / ガードトリガを無効化 /
--   関数を旧シグネチャへ置き換え / 解除キューの列を削除 /
--   表の権限を開放 / ポリシーを削除 / security definer を外す
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
have_fn as (
  select p.oid,
         p.proname || '(' || replace(pg_catalog.oidvectortypes(p.proargtypes), ' ', '') || ')' as sig,
         p.prosecdef,
         coalesce(array_to_string(p.proconfig, ','), '') as cfg
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'laruhp\_domain\_%'
),
fn as (
  select
    (select count(*) from need_fn x where not exists (select 1 from have_fn y where y.sig = x.sig)) as missing,
    (select count(*) from have_fn y where not exists (select 1 from need_fn x where x.sig = y.sig))  as extra,
    (select count(*) from have_fn y join need_fn x on x.sig = y.sig
       where not (y.prosecdef and y.cfg like '%search_path=public%'))                                as not_definer,
    (select count(*) from have_fn y join need_fn x on x.sig = y.sig, obj
       where obj.r_auth is not null and has_function_privilege(obj.r_auth, y.oid, 'EXECUTE'))        as auth_can,
    (select count(*) from have_fn y join need_fn x on x.sig = y.sig, obj
       where obj.r_anon is not null and has_function_privilege(obj.r_anon, y.oid, 'EXECUTE'))        as anon_can,
    (select count(*) from have_fn y join need_fn x on x.sig = y.sig, obj
       where obj.r_svc is not null and not has_function_privilege(obj.r_svc, y.oid, 'EXECUTE'))      as svc_cannot
),
col as (
  select
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='site_domains'
        and column_name in ('operation_epoch','render_register_started_at','external_registration_owned',
                            'release_operation_id','release_lease_until','redirects_to'))            as sd_cols,
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='domain_release_queue'
        and column_name in ('verification_token','operation_epoch','release_operation_id',
                            'external_registration_owned','kind'))                                   as q_cols
),
trg as (
  select
    (select count(*) from pg_trigger t, obj
      where t.tgrelid = obj.sites and not t.tgisinternal
        and t.tgname = 'guard_sites_custom_domain_trg' and t.tgenabled in ('O','A'))                 as guard_on,
    (select count(*) from pg_trigger t, obj
      where t.tgrelid = obj.sd and not t.tgisinternal
        and t.tgname = 'site_domains_touch' and t.tgenabled in ('O','A'))                            as touch_on,
    (select count(*) from pg_trigger t, obj
      where t.tgrelid = obj.sd and not t.tgisinternal
        and t.tgname = 'site_domains_enqueue_release_trg' and t.tgenabled in ('O','A'))              as enq_on
),
rows0 as (
  select * from (
  select 1 as n, '表' as 区分, 'site_domains がある' as 項目, 'true' as 期待,
         coalesce((select (sd is not null)::text from obj), 'false') as 実際,
         (select sd is not null from obj) as ok
  union all select 2, '表', 'domain_release_queue がある', 'true',
         coalesce((select (q is not null)::text from obj), 'false'), (select q is not null from obj)
  union all select 3, '列', 'site_domains の追加列', '6', (select sd_cols::text from col), (select sd_cols = 6 from col)
  union all select 4, '列', 'domain_release_queue の追加列', '5', (select q_cols::text from col), (select q_cols = 5 from col)
  union all select 5, '制約', 'status の check 制約', 'true',
         (select (count(*) > 0)::text from pg_constraint c, obj where c.conrelid = obj.sd and c.conname = 'site_domains_status_check'),
         (select count(*) > 0 from pg_constraint c, obj where c.conrelid = obj.sd and c.conname = 'site_domains_status_check')
  union all select 6, '制約', 'host が一意', 'true',
         (select (count(*) > 0)::text from pg_index i, obj where i.indrelid = obj.sd and i.indisunique
            and (select array_agg(attname order by attnum) from pg_attribute where attrelid = obj.sd and attnum = any(i.indkey)) = array['host']::name[]),
         (select count(*) > 0 from pg_index i, obj where i.indrelid = obj.sd and i.indisunique
            and (select array_agg(attname order by attnum) from pg_attribute where attrelid = obj.sd and attnum = any(i.indkey)) = array['host']::name[])
  union all select 7, 'トリガ', 'guard_sites_custom_domain_trg が有効', '1', (select guard_on::text from trg), (select guard_on = 1 from trg)
  union all select 8, 'トリガ', 'site_domains_touch が有効', '1', (select touch_on::text from trg), (select touch_on = 1 from trg)
  union all select 9, 'トリガ', 'site_domains_enqueue_release_trg が有効', '1', (select enq_on::text from trg), (select enq_on = 1 from trg)
  union all select 10, 'RLS', 'site_domains の RLS が有効', 'true',
         coalesce((select relrowsecurity::text from pg_class c, obj where c.oid = obj.sd), '（表なし）'),
         (select relrowsecurity from pg_class c, obj where c.oid = obj.sd)
  union all select 11, 'RLS', 'site_domains にポリシーがある', 'true',
         (select (count(*) > 0)::text from pg_policies where schemaname='public' and tablename='site_domains'),
         (select count(*) > 0 from pg_policies where schemaname='public' and tablename='site_domains')
  union all select 12, 'RLS', 'domain_release_queue の RLS が有効', 'true',
         coalesce((select relrowsecurity::text from pg_class c, obj where c.oid = obj.q), '（表なし）'),
         (select relrowsecurity from pg_class c, obj where c.oid = obj.q)
  union all select 13, '実効権限', 'authenticated は site_domains を書けない', 'false',
         (select (has_table_privilege(r_auth, sd, 'INSERT') or has_table_privilege(r_auth, sd, 'UPDATE') or has_table_privilege(r_auth, sd, 'DELETE'))::text from obj),
         (select not (has_table_privilege(r_auth, sd, 'INSERT') or has_table_privilege(r_auth, sd, 'UPDATE') or has_table_privilege(r_auth, sd, 'DELETE')) from obj)
  union all select 14, '実効権限', 'anon は site_domains を書けない', 'false',
         (select (has_table_privilege(r_anon, sd, 'INSERT') or has_table_privilege(r_anon, sd, 'UPDATE') or has_table_privilege(r_anon, sd, 'DELETE'))::text from obj),
         (select not (has_table_privilege(r_anon, sd, 'INSERT') or has_table_privilege(r_anon, sd, 'UPDATE') or has_table_privilege(r_anon, sd, 'DELETE')) from obj)
  union all select 15, '実効権限', 'authenticated は site_domains を読める', 'true',
         (select has_table_privilege(r_auth, sd, 'SELECT')::text from obj),
         (select has_table_privilege(r_auth, sd, 'SELECT') from obj)
  union all select 16, '実効権限', 'authenticated は解除キューに触れない', 'false',
         (select (has_table_privilege(r_auth, q, 'SELECT') or has_table_privilege(r_auth, q, 'INSERT') or has_table_privilege(r_auth, q, 'UPDATE') or has_table_privilege(r_auth, q, 'DELETE'))::text from obj),
         (select not (has_table_privilege(r_auth, q, 'SELECT') or has_table_privilege(r_auth, q, 'INSERT') or has_table_privilege(r_auth, q, 'UPDATE') or has_table_privilege(r_auth, q, 'DELETE')) from obj)
  union all select 17, '実効権限', 'anon は解除キューに触れない', 'false',
         (select (has_table_privilege(r_anon, q, 'SELECT') or has_table_privilege(r_anon, q, 'INSERT') or has_table_privilege(r_anon, q, 'UPDATE') or has_table_privilege(r_anon, q, 'DELETE'))::text from obj),
         (select not (has_table_privilege(r_anon, q, 'SELECT') or has_table_privilege(r_anon, q, 'INSERT') or has_table_privilege(r_anon, q, 'UPDATE') or has_table_privilege(r_anon, q, 'DELETE')) from obj)
  union all select 18, '関数', '必要な11件が名前＋引数型でそろう', '0', (select missing::text from fn), (select missing = 0 from fn)
  union all select 19, '関数', '一覧に無い laruhp_domain_* が無い', '0', (select extra::text from fn), (select extra = 0 from fn)
  union all select 20, '関数', '11件とも security definer / search_path=public', '0', (select not_definer::text from fn), (select not_definer = 0 from fn)
  union all select 21, '関数', 'authenticated から実行できない', '0', (select auth_can::text from fn), (select auth_can = 0 from fn)
  union all select 22, '関数', 'anon から実行できない', '0', (select anon_can::text from fn), (select anon_can = 0 from fn)
  union all select 23, '関数', 'service_role から実行できる', '0', (select svc_cannot::text from fn), (select svc_cannot = 0 from fn)
) t0
),
res as (
  select n, 区分, 項目, 期待, coalesce(実際, '（対象なし）') as 実際, coalesce(ok, false) as ok from rows0
)
select * from res
union all
select 99, '総合', 'すべて通ったか', 'true',
       (select (count(*) filter (where not ok) = 0)::text from res),
       (select count(*) filter (where not ok) = 0 from res)
order by n;
