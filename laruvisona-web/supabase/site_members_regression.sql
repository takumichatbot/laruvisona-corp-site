\echo '--- LARUbot履歴の共同閲覧 ---'
do $$
declare owner_id uuid := '10000000-0000-4000-8000-000000000012';
declare viewer_id uuid := '10000000-0000-4000-8000-000000000013';
declare site_id uuid := '20000000-0000-4000-8000-000000000012';
begin
  insert into auth.users(id) values(owner_id),(viewer_id);
  insert into public.sites(id,user_id,name,slug,published) values(site_id,owner_id,'共同閲覧店','shared-view',true);
  insert into public.site_members(site_id,user_id,invited_email,role,status)
    values(site_id,viewer_id,'VIEWER@example.test','conversation_viewer','active');
  if has_table_privilege('anon','public.site_members','SELECT')
     or has_table_privilege('authenticated','public.site_members','SELECT')
     or has_table_privilege('authenticated','public.site_members','UPDATE') then
    raise exception 'site member table exposed';
  end if;
  if not has_table_privilege('service_role','public.site_members','DELETE') then
    raise exception 'service privilege missing';
  end if;
  begin
    insert into public.site_members(site_id,invited_email,role,status)
      values(site_id,'bad-role@example.test','editor','pending');
    raise exception 'unknown role accepted';
  exception when check_violation then null; end;
  begin
    insert into public.site_members(site_id,invited_email,role,status)
      values(site_id,'bad-status@example.test','conversation_viewer','disabled');
    raise exception 'unknown status accepted';
  exception when check_violation then null; end;
end $$;
\echo 'LARUbot履歴の共同閲覧: 8項目 OK'
