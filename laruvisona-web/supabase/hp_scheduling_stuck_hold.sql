-- 支払い待ちの枠が、永久に埋まったままになる道を閉じる。
--
-- 起きていたこと:
--
--   1. お客様が事前決済の予約に進む。hp_payment_prepare が attempted_at を立て、
--      枠（hp_booking_allocations）を押さえる。押さえは60分。
--   2. そのあとの Stripe セッション作成が一度失敗する
--      （通信が切れた、タブを閉じた、など）。
--   3. 以後の照合は、毎回「もう過ぎた hold_until」を期限にしてセッションを
--      作ろうとする。Stripe は過去の期限を受け付けないので**毎回失敗する。**
--   4. 23時間経つと review に落ちて休眠する。
--
--   予約は pending_payment のまま、**枠の押さえだけが残り続ける。**
--   お客様は一円も払っていないのに、その時間が永久に埋まる。
--   店側の画面には「支払い待ち／Stripeで要確認」と出るだけで、
--   解放するボタンが無い。誰も解放できず、誰にも通知が飛ばない。
--
-- 変えたのは 'abandoned' の条件1行だけ。他はもとのまま写してある
-- （書き直すと、返金の action_name や last_checked_at、
--   hp_booking_events への記録など、細かい所を落としてしまう）。
--
-- 実行方法: Supabase の SQL Editor にこのファイルの中身を貼って実行する。

create or replace function public.hp_payment_settle(p_site uuid,p_id uuid,p_state text,p_session text,p_intent text,p_amount integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a hp_appointments; p hp_booking_payments; action_name text;
begin
 perform 1 from sites where id=p_site for update;
 select * into a from hp_appointments where id=p_id and site_id=p_site for update;
 select * into p from hp_booking_payments where appointment_id=p_id and site_id=p_site for update;
 if a.id is null or p.appointment_id is null then raise exception 'not_found'; end if;
 if p_state='abandoned' then
  -- 押さえが続いているうちは外さない（お客様がまだ払える時間）
  if a.hold_until>now() then raise exception 'payment_mismatch'; end if;
  -- セッションが作られていれば、支払われた可能性がある。勝手に捨てない。
  --
  -- ここを attempted_at で見ていたため、**立ち往生した予約だけが
  -- 永久に解放できなかった。** attempted_at は「決済に進もうとした」印で、
  -- 押さえを作った時点で必ず立つ。つまり解放したい状態では必ず立っている。
  --
  -- 守りたいのは「支払われたかもしれないものを捨てないこと」。
  -- それを決めるのは session_id。1つも作られていなければ請求は起こりえない。
  if p.session_id is not null then raise exception 'payment_mismatch'; end if;
 elsif p_state='review' then
  null;
 elsif p.session_id is null or p.session_id is distinct from p_session then raise exception 'payment_mismatch';
 end if;
 if p_state='paid' then
  if p_amount is distinct from a.price or p_intent is null then raise exception 'payment_mismatch'; end if;
  if p.intent_id is not null and p.intent_id<>p_intent then raise exception 'payment_mismatch'; end if;
  update hp_booking_payments set intent_id=p_intent where appointment_id=p_id;
  if a.status='pending_payment' then
   update hp_appointments set status='confirmed',payment_status='paid',revision=revision+1,updated_at=now() where id=p_id returning * into a;
   update hp_booking_payments set active=false where appointment_id=p_id;
   action_name:='created';
  elsif a.status in ('expired','canceled') and a.payment_status='pending' then
   update hp_appointments set payment_status='refund_pending',revision=revision+1,updated_at=now() where id=p_id returning * into a;
   update hp_booking_payments set active=true where appointment_id=p_id;
  end if;
 elsif p_state in ('expired','abandoned') then
  if a.status='pending_payment' then
   delete from hp_booking_allocations where appointment_id=p_id;
   update hp_appointments set status='expired',revision=revision+1,updated_at=now() where id=p_id returning * into a;
   update hp_booking_payments set active=false where appointment_id=p_id;
  end if;
 elsif p_state='refunded' then
  if p_amount is distinct from a.price or p.intent_id is distinct from p_intent then raise exception 'payment_mismatch'; end if;
  if a.payment_status<>'refunded' then
   delete from hp_booking_allocations where appointment_id=p_id;
   update hp_appointments set status='canceled',payment_status='refunded',revision=revision+1,updated_at=now() where id=p_id returning * into a;
   update hp_booking_payments set active=false where appointment_id=p_id;
   action_name:='refund';
  end if;
 elsif p_state='review' then
  update hp_appointments set payment_status='review',updated_at=now() where id=p_id returning * into a;
  update hp_booking_payments set active=false where appointment_id=p_id;
 else raise exception 'invalid_action';
 end if;
 update hp_booking_payments set last_checked_at=now() where appointment_id=p_id;
 if action_name is not null then
  insert into hp_booking_events(site_id,appointment_id,revision,action,snapshot) values(p_site,p_id,a.revision,action_name,to_jsonb(a)-'token_hash'-'request_hash'-'client_key');
 end if;
 return to_jsonb(a)-'token_hash'-'request_hash'-'client_key';
end $$;

revoke all on function public.hp_payment_settle(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.hp_payment_settle(uuid,uuid,text,text,text,integer) to service_role;
