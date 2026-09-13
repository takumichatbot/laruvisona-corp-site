-- LARU HP 予約事前決済のDB状態を、書き込みなしで確認する。
-- hp_scheduling_payments.sql 適用後に Supabase SQL Editor または psql で実行する。
-- 最終行 99 が true のときだけ、SQLの適用状態がこの版の期待と一致する。
-- これは実カード・Webhook・返金の疎通確認を代替しない。
with obj as (
  select to_regclass('public.hp_appointments')       as appointments,
         to_regclass('public.hp_payment_accounts')   as accounts,
         to_regclass('public.hp_booking_payments')   as payments,
         to_regrole('anon')                          as anon_role,
         to_regrole('authenticated')                 as auth_role,
         to_regrole('service_role')                  as service_role
),
need_fn(sig) as (values
  ('hp_schedule_configure(uuid,uuid,jsonb,bigint)'),
  ('hp_schedule_book(uuid,jsonb,text,text)'),
  ('hp_schedule_change(uuid,uuid,text,uuid,text,timestamp with time zone,text,integer)'),
  ('hp_payment_prepare(uuid,uuid,text,text)'),
  ('hp_payment_attach(uuid,uuid,text)'),
  ('hp_payment_settle(uuid,uuid,text,text,text,integer)')
),
have_fn as (
  select p.oid,
         p.proname || '(' || replace(pg_catalog.oidvectortypes(p.proargtypes), ' ', '') || ')' as compact_sig,
         p.proname || '(' || pg_catalog.oidvectortypes(p.proargtypes) || ')' as display_sig,
         p.prosecdef,
         p.proconfig
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in
    ('hp_schedule_configure','hp_schedule_book','hp_schedule_change',
     'hp_payment_prepare','hp_payment_attach','hp_payment_settle')
),
fnchk as (
  select
    count(*) filter (where h.oid is null) as missing,
    count(*) filter (where h.oid is not null and not h.prosecdef) as not_definer,
    count(*) filter (where h.oid is not null and coalesce(h.proconfig,array[]::text[])<>array['search_path=public']) as bad_path,
    count(*) filter (where h.oid is not null and o.anon_role is not null and has_function_privilege(o.anon_role,h.oid,'EXECUTE')) as anon_can,
    count(*) filter (where h.oid is not null and o.auth_role is not null and has_function_privilege(o.auth_role,h.oid,'EXECUTE')) as auth_can,
    count(*) filter (where h.oid is not null and (o.service_role is null or not has_function_privilege(o.service_role,h.oid,'EXECUTE'))) as service_cannot
  from need_fn n cross join obj o
  left join have_fn h on replace(n.sig,' ','')=h.compact_sig
),
fnextra as (
  select count(*) as extra
  from have_fn h
  where not exists (select 1 from need_fn n where replace(n.sig,' ','')=h.compact_sig)
),
colchk as (
  select
    count(*) filter (where table_name='hp_appointments' and column_name='payment_status' and data_type='text' and is_nullable='NO' and column_default='''onsite''::text') as appointment_payment,
    count(*) filter (where table_name='hp_appointments' and column_name='hold_until' and data_type='timestamp with time zone' and is_nullable='YES') as appointment_hold,
    count(*) filter (where table_name='hp_payment_accounts' and (column_name,data_type,is_nullable) in
      (('user_id','uuid','NO'),('account_id','text','YES'),('livemode','boolean','YES'),('state_hash','text','YES'),
       ('state_expires','timestamp with time zone','YES'),('state_site','uuid','YES'),('updated_at','timestamp with time zone','NO'))) as account_columns,
    count(*) filter (where table_name='hp_booking_payments' and (column_name,data_type,is_nullable) in
      (('appointment_id','uuid','NO'),('site_id','uuid','NO'),('account_id','text','NO'),('livemode','boolean','NO'),
       ('session_id','text','YES'),('intent_id','text','YES'),('return_url','text','YES'),('attempted_at','timestamp with time zone','YES'),
       ('refund_started_at','timestamp with time zone','YES'),('refund_id','text','YES'),('active','boolean','NO'),
       ('last_checked_at','timestamp with time zone','YES'),('created_at','timestamp with time zone','NO'))) as payment_columns
  from information_schema.columns
  where table_schema='public' and table_name in ('hp_appointments','hp_payment_accounts','hp_booking_payments')
),
constraints as (
  select
    count(*) filter (where c.conrelid=o.appointments and c.contype='c' and pg_get_constraintdef(c.oid) like '%pending_payment%' and pg_get_constraintdef(c.oid) like '%expired%') as appointment_status,
    count(*) filter (where c.conrelid=o.appointments and c.contype='c' and pg_get_constraintdef(c.oid) like '%refund_pending%' and pg_get_constraintdef(c.oid) like '%refunded%' and pg_get_constraintdef(c.oid) like '%review%') as payment_status,
    count(*) filter (where c.conrelid=o.accounts and c.contype='p' and pg_get_constraintdef(c.oid)='PRIMARY KEY (user_id)') as account_pk,
    count(*) filter (where c.conrelid=o.accounts and c.contype='u' and pg_get_constraintdef(c.oid)='UNIQUE (account_id)') as account_unique,
    count(*) filter (where c.conrelid=o.payments and c.contype='p' and pg_get_constraintdef(c.oid)='PRIMARY KEY (appointment_id)') as payment_pk,
    count(*) filter (where c.conrelid=o.payments and c.contype='u' and pg_get_constraintdef(c.oid) in ('UNIQUE (session_id)','UNIQUE (intent_id)')) as payment_unique,
    count(*) filter (where c.conrelid=o.payments and c.contype='f' and c.confrelid=o.appointments and c.confdeltype='c' and pg_get_constraintdef(c.oid) like 'FOREIGN KEY (site_id, appointment_id)%') as tenant_fk
  from pg_constraint c cross join obj o
),
idx as (
  select count(*) as ok
  from pg_index i cross join obj o
  where i.indrelid=o.payments and i.indisvalid and not i.indisunique
    and pg_get_expr(i.indpred,i.indrelid)='active'
    and (select array_agg(a.attname order by k.ord)
         from unnest(i.indkey) with ordinality k(attnum,ord)
         join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum)
        =array['last_checked_at']::name[]
),
table_acl as (
  select
    count(*) filter (where r.kind='user' and has_table_privilege(r.oid,t.oid,p.priv)) as user_grants,
    count(*) filter (where r.kind='service' and not has_table_privilege(r.oid,t.oid,p.priv)) as service_missing
  from (select 'user' kind,anon_role oid from obj union all select 'user',auth_role from obj union all select 'service',service_role from obj) r
  cross join (select accounts oid from obj union all select payments from obj) t
  cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(priv)
  where r.oid is not null and t.oid is not null
),
column_acl as (
  select count(*) as user_grants
  from obj o
  cross join lateral (values(o.anon_role),(o.auth_role)) r(oid)
  cross join lateral (values(o.accounts),(o.payments)) t(oid)
  join pg_attribute a on a.attrelid=t.oid and a.attnum>0 and not a.attisdropped
  cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(priv)
  where r.oid is not null and has_column_privilege(r.oid,t.oid,a.attnum,p.priv)
),
checks as (
  select * from (values
    (1,'存在','hp_appointments がある','true',(select (appointments is not null)::text from obj),(select appointments is not null from obj)),
    (2,'存在','hp_payment_accounts がある','true',(select (accounts is not null)::text from obj),(select accounts is not null from obj)),
    (3,'存在','hp_booking_payments がある','true',(select (payments is not null)::text from obj),(select payments is not null from obj)),
    (4,'ロール','anon/authenticated/service_role がある','true',(select (anon_role is not null and auth_role is not null and service_role is not null)::text from obj),(select anon_role is not null and auth_role is not null and service_role is not null from obj)),
    (5,'列','hp_appointments の決済列と既定値','2',(select (appointment_payment+appointment_hold)::text from colchk),(select appointment_payment=1 and appointment_hold=1 from colchk)),
    (6,'列','hp_payment_accounts の列と型','7',(select account_columns::text from colchk),(select account_columns=7 from colchk)),
    (7,'列','hp_booking_payments の列と型','13',(select payment_columns::text from colchk),(select payment_columns=13 from colchk)),
    (8,'制約','予約状態と決済状態のCHECK','2',(select (appointment_status+payment_status)::text from constraints),(select appointment_status=1 and payment_status=1 from constraints)),
    (9,'制約','口座の主キーとaccount_id一意','2',(select (account_pk+account_unique)::text from constraints),(select account_pk=1 and account_unique=1 from constraints)),
    (10,'制約','決済の主キー・session/intent一意','3',(select (payment_pk+payment_unique)::text from constraints),(select payment_pk=1 and payment_unique=2 from constraints)),
    (11,'境界','決済はsite_id+appointment_idで予約に従属','1',(select tenant_fk::text from constraints),(select tenant_fk=1 from constraints)),
    (12,'索引','active行をlast_checked_at順に拾う部分索引','1',(select ok::text from idx),(select ok=1 from idx)),
    (13,'RLS','非公開2表のRLSが有効','true',coalesce((select (a.relrowsecurity and p.relrowsecurity)::text from obj o join pg_class a on a.oid=o.accounts join pg_class p on p.oid=o.payments),'false'),coalesce((select a.relrowsecurity and p.relrowsecurity from obj o join pg_class a on a.oid=o.accounts join pg_class p on p.oid=o.payments),false)),
    (14,'RLS','非公開2表に利用者向けポリシーが無い','0',(select count(*)::text from pg_policy x,obj o where x.polrelid in (o.accounts,o.payments)),(select count(*)=0 from pg_policy x,obj o where x.polrelid in (o.accounts,o.payments))),
    (15,'権限','anon/authenticatedに表・列権限が無い','0',(select (t.user_grants+c.user_grants)::text from table_acl t,column_acl c),(select t.user_grants=0 and c.user_grants=0 from table_acl t,column_acl c)),
    (16,'権限','service_roleに非公開2表の全表権限がある','0',(select service_missing::text from table_acl),(select service_missing=0 from table_acl)),
    (17,'関数','必要な6シグネチャが存在','0',(select missing::text from fnchk),(select missing=0 from fnchk)),
    (18,'関数','同名の古いオーバーロードが残っていない','0',(select extra::text from fnextra),(select extra=0 from fnextra)),
    (19,'関数','必要な6関数がSECURITY DEFINER','0',(select not_definer::text from fnchk),(select not_definer=0 from fnchk)),
    (20,'関数','必要な6関数のsearch_pathがpublic固定','0',(select bad_path::text from fnchk),(select bad_path=0 from fnchk)),
    (21,'権限','anon/authenticatedは必要RPCを実行不可','0',(select (anon_can+auth_can)::text from fnchk),(select anon_can=0 and auth_can=0 from fnchk)),
    (22,'権限','service_roleは必要RPCを実行可能','0',(select service_cannot::text from fnchk),(select service_cannot=0 from fnchk))
  ) v(n,category,item,expected,actual,ok)
), all_rows as (
  select * from checks
  union all
  select 99,'総合','事前決済SQLがこの版の期待と一致','true',bool_and(ok)::text,bool_and(ok) from checks
)
select n,category,item,expected,actual,coalesce(ok,false) as ok from all_rows order by n;
