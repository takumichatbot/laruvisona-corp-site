\echo '--- 問い合わせ管理 ---'
do $$
declare owner_id uuid := '10000000-0000-4000-8000-000000000001';
declare other_id uuid := '10000000-0000-4000-8000-000000000002';
declare owner_site uuid := '20000000-0000-4000-8000-000000000001';
declare other_site uuid := '20000000-0000-4000-8000-000000000002';
begin
  insert into auth.users(id) values(owner_id),(other_id);
  insert into public.sites(id,user_id,name,slug) values
    (owner_site,owner_id,'所有サイト','owner-site'),
    (other_site,other_id,'他人サイト','other-site');
  insert into public.contacts(site_id,name,email) values
    (owner_site,'所有者の問い合わせ','a@example.test'),
    (other_site,'他人の問い合わせ','b@example.test');
end $$;

set role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',false);

do $$
declare n integer;
begin
  select count(*) into n from public.contacts;
  if n <> 1 then raise exception 'RLS select: expected 1, got %', n; end if;
  update public.contacts set crm_status='in_progress',crm_tags=array['要フォロー'],crm_note='電話する';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RLS update: expected 1, got %', n; end if;
  delete from public.contacts;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RLS delete: expected 1, got %', n; end if;
end $$;

reset role;
do $$
declare n integer;
begin
  select count(*) into n from public.contacts;
  if n <> 1 then raise exception 'other tenant was changed'; end if;
  if has_table_privilege('anon','public.contacts','INSERT') then raise exception 'anon can insert'; end if;
  if has_table_privilege('authenticated','public.contacts','INSERT') then raise exception 'authenticated can insert'; end if;
end $$;
\echo '問い合わせ管理: 8項目 OK'
