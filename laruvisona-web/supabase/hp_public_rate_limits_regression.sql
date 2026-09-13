\echo '--- 公開利用枠 ---'
do $$
declare
  k text := repeat('a',64);
  n integer := 0;
  invalid_rejected boolean := false;
begin
  if not public.laruhp_public_claim_rate(k,'booking-reserve',2,3600) then raise exception 'first claim rejected'; end if; n:=n+1;
  if not public.laruhp_public_claim_rate(k,'booking-reserve',2,3600) then raise exception 'second claim rejected'; end if; n:=n+1;
  if public.laruhp_public_claim_rate(k,'booking-reserve',2,3600) then raise exception 'limit was not enforced'; end if; n:=n+1;
  if not public.laruhp_public_claim_rate(k,'shop-checkout',1,3600) then raise exception 'scope was not isolated'; end if; n:=n+1;
  if (select used from public.hp_public_rate_limits where key_hash=k and scope='booking-reserve')<>2 then raise exception 'counter is not durable'; end if; n:=n+1;
  begin
    perform public.laruhp_public_claim_rate('raw-address','booking-reserve',2,3600);
  exception when others then
    invalid_rejected:=sqlerrm='invalid_rate_limit';
  end;
  if not invalid_rejected then raise exception 'raw identifier was accepted'; end if; n:=n+1;
  if n<>6 then raise exception 'assertion count mismatch: %',n; end if;
  raise notice '公開利用枠: %項目 OK',n;
end $$;
