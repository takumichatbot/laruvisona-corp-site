\echo '--- ニュースレター ---'
do $$
declare owner_id uuid := '10000000-0000-4000-8000-000000000009';
declare site_id uuid := '20000000-0000-4000-8000-000000000009';
declare subscriber_id uuid;
declare campaign_id uuid;
begin
  insert into auth.users(id) values(owner_id);
  insert into public.sites(id,user_id,name,slug,published) values(site_id,owner_id,'便り店','newsletter-shop',true);
  insert into public.newsletter_subscribers(site_id,email,name) values(site_id,'reader@example.test','読者') returning id into subscriber_id;
  insert into public.newsletter_campaigns(site_id,user_id,request_id,variant,subject)
    values(site_id,owner_id,'30000000-0000-4000-8000-000000000009','A','お知らせ') returning id into campaign_id;
  insert into public.newsletter_email_events(campaign_id,resend_email_id,recipient_email,event_type)
    values(campaign_id,'email_1','reader@example.test','sent');
  if has_table_privilege('anon','public.newsletter_subscribers','INSERT')
     or has_table_privilege('anon','public.newsletter_campaigns','SELECT') then raise exception 'newsletter table exposed to anon'; end if;
  if not has_table_privilege('service_role','public.newsletter_subscribers','INSERT') then raise exception 'service cannot subscribe'; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000009"}',false);
do $$ declare n integer; begin
  select count(*) into n from public.newsletter_campaigns;
  if n <> 1 then raise exception 'owner cannot see campaign'; end if;
  update public.newsletter_subscribers set unsubscribed_at=now() where email='reader@example.test';
  if not found then raise exception 'owner cannot unsubscribe'; end if;
end $$;
reset role;
\echo 'ニュースレター: 6項目 OK'
