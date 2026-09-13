\echo '--- 公開サイト会員 ---'
do $$
declare owner_a uuid := '10000000-0000-4000-8000-000000000110';
declare owner_b uuid := '10000000-0000-4000-8000-000000000111';
declare site_a uuid := '20000000-0000-4000-8000-000000000110';
declare site_b uuid := '20000000-0000-4000-8000-000000000111';
begin
  insert into auth.users(id) values(owner_a),(owner_b);
  insert into public.sites(id,user_id,name,slug,published) values
    (site_a,owner_a,'会員店A','member-a',true),
    (site_b,owner_b,'会員店B','member-b',true);
  insert into public.hp_members(site_id,email,password_hash,name) values
    (site_a,'a@example.test','hash-a','会員A'),
    (site_b,'b@example.test','hash-b','会員B');

  if has_table_privilege('anon','public.hp_members','SELECT')
     or has_table_privilege('anon','public.hp_members','INSERT')
     or has_table_privilege('authenticated','public.hp_members','INSERT')
     or has_table_privilege('authenticated','public.hp_members','UPDATE')
     or has_table_privilege('authenticated','public.hp_members','DELETE') then
    raise exception 'public member table exposes write or anonymous read access';
  end if;
  if not has_table_privilege('authenticated','public.hp_members','SELECT')
     or not has_table_privilege('service_role','public.hp_members','DELETE') then
    raise exception 'required member privileges missing';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000110"}',false);
do $$ declare n integer; begin
  select count(*) into n from public.hp_members;
  if n <> 1 then raise exception 'owner can see another site members: %', n; end if;
end $$;
reset role;

set role service_role;
update public.hp_members set status='inactive' where email='a@example.test';
delete from public.hp_members where email='b@example.test';
reset role;

do $$ declare n integer; begin
  select count(*) into n from public.hp_members where email='a@example.test' and status='inactive';
  if n <> 1 then raise exception 'service cannot update member'; end if;
  select count(*) into n from public.hp_members where email='b@example.test';
  if n <> 0 then raise exception 'service cannot delete member'; end if;
end $$;
\echo '公開サイト会員: 10項目 OK'
