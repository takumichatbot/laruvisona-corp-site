-- Read-only post-migration state check for the 2026-09-14 LARU HP release.
-- The final row must be true. This checks presence/signatures, not business behavior.
with checks(section,item,ok) as (
  values
  ('crm','contacts.extra_fields',exists(select 1 from information_schema.columns where table_schema='public' and table_name='contacts' and column_name='extra_fields' and data_type='jsonb')),
  ('crm','contacts.crm_status',exists(select 1 from information_schema.columns where table_schema='public' and table_name='contacts' and column_name='crm_status')),
  ('shop','hp_orders',to_regclass('public.hp_orders') is not null),
  ('shop','hp_orders.notified_at',exists(select 1 from information_schema.columns where table_schema='public' and table_name='hp_orders' and column_name='notified_at')),
  ('shop','commit RPC',to_regprocedure('public.laruhp_shop_commit_order(uuid,text,text,text,text,integer,jsonb,jsonb,jsonb)') is not null),
  ('shop','notification claim RPC',to_regprocedure('public.laruhp_shop_claim_notifications(integer)') is not null),
  ('shop','notification finish RPC',to_regprocedure('public.laruhp_shop_finish_notification(uuid,uuid,boolean,text)') is not null),
  ('loyalty','loyalty_cards',to_regclass('public.loyalty_cards') is not null),
  ('loyalty','stamp RPC',to_regprocedure('public.laruhp_loyalty_add_stamp(uuid,uuid)') is not null),
  ('newsletter','newsletter_campaigns',to_regclass('public.newsletter_campaigns') is not null),
  ('newsletter','newsletter_email_events',to_regclass('public.newsletter_email_events') is not null),
  ('sequences','hp_sequences',to_regclass('public.hp_sequences') is not null),
  ('sequences','claim RPC',to_regprocedure('public.laruhp_sequence_claim(integer)') is not null),
  ('members','hp_members',to_regclass('public.hp_members') is not null),
  ('members','site_members',to_regclass('public.site_members') is not null),
  ('analytics','heatmap_events.session_id',exists(select 1 from information_schema.columns where table_schema='public' and table_name='heatmap_events' and column_name='session_id' and data_type='uuid')),
  ('booking','hp_booking_calendars',to_regclass('public.hp_booking_calendars') is not null),
  ('booking','legacy reminder lease',exists(select 1 from information_schema.columns where table_schema='public' and table_name='hp_reservations' and column_name='reminder_claim_token')),
  ('booking','legacy reminder claim RPC',to_regprocedure('public.hp_legacy_claim_reminders(integer)') is not null),
  ('booking','legacy reminder finish RPC',to_regprocedure('public.hp_legacy_finish_reminder(uuid,uuid,boolean,text)') is not null),
  ('booking','legacy reminder state guard',exists(select 1 from pg_trigger where tgrelid=to_regclass('public.hp_reservations') and tgname='hp_legacy_protect_reminder_state_trg' and tgenabled in ('O','A'))),
  ('booking','configure RPC',to_regprocedure('public.hp_schedule_configure(uuid,uuid,jsonb,bigint)') is not null),
  ('booking','book RPC',to_regprocedure('public.hp_schedule_book(uuid,jsonb,text,text)') is not null),
  ('booking','hp_booking_events notification lease',exists(select 1 from information_schema.columns where table_schema='public' and table_name='hp_booking_events' and column_name='notification_claim_token')),
  ('booking','notification claim RPC',to_regprocedure('public.hp_schedule_claim_notifications(integer)') is not null),
  ('booking','hp_booking_reminders',to_regclass('public.hp_booking_reminders') is not null),
  ('booking','reminder claim RPC',to_regprocedure('public.hp_schedule_claim_reminders(integer)') is not null),
  ('email','hp_scheduled_email_deliveries',to_regclass('public.hp_scheduled_email_deliveries') is not null),
  ('email','scheduled claim RPC',to_regprocedure('public.hp_claim_scheduled_email(uuid,text,text)') is not null),
  ('push','hp_push_subscriptions',to_regclass('public.hp_push_subscriptions') is not null),
  ('ai','hp_ai_usage',to_regclass('public.hp_ai_usage') is not null),
  ('ai','usage claim RPC',to_regprocedure('public.laruhp_ai_claim_usage(text,integer)') is not null),
  ('forms','hp_public_rate_limits',to_regclass('public.hp_public_rate_limits') is not null),
  ('forms','public rate claim RPC',to_regprocedure('public.laruhp_public_claim_rate(text,text,integer)') is not null)
), rows as (
  select section,item,ok from checks
  union all select 'zz','ALL_REQUIRED_STATE',bool_and(ok) from checks
)
select * from rows order by section,item;
