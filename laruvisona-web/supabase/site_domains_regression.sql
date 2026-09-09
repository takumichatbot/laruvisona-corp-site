-- 実PostgreSQL上での回帰テスト。
--
-- 監督レビュー(ecea9d0)で実DBに再現された競合の順序を、そのまま並べて実行する。
-- 期待どおりでなければ raise exception で落ちるので、psql の終了コードで判定できる。
--
-- 実行:
--   supabase/site_domains_regression.sh を使う（一時DBを作って適用してから流す）
--
-- 前提: schema.sql と site_domains.sql を適用済みの空DB。

\set ON_ERROR_STOP on
select set_config('request.jwt.claims', '{"role":"service_role"}', false);

create or replace function pg_temp.expect(p_cond boolean, p_label text) returns void
language plpgsql as $$
begin
  if not p_cond then raise exception 'FAIL: %', p_label; end if;
  raise notice 'PASS: %', p_label;
end;
$$;

insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001');
insert into public.sites(id,user_id,name) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','regression');

-- ════════════════════════════════════════════════════════════
-- 順序A: 検証中に解除が確定した場合、古い検証結果を適用しない
-- ════════════════════════════════════════════════════════════
do $$
declare
  v_site uuid := '10000000-0000-0000-0000-000000000001';
  v_epoch bigint;
  v_apply jsonb;
  v_finish jsonb;
  v_dangling boolean;
begin
  insert into public.site_domains(site_id,host,verification_token,status)
  values (v_site,'a.example.com','token-a','pending_ownership');

  -- 1. verifyが行を読む（この時点の世代を持って外部確認へ出かける）
  select operation_epoch into v_epoch from public.site_domains where host='a.example.com';

  -- 2. その間に解除が確定する
  perform public.laruhp_domain_begin_release(v_site,'a.example.com');

  -- 3. 遅れて戻ってきた古いverifyが結果を書こうとする
  v_apply := public.laruhp_domain_apply_check(v_site,'a.example.com','token-a',v_epoch,'connected','rd-x',null,true);
  perform pg_temp.expect((v_apply->>'ok')::boolean is false, 'A: 解除開始後の古い検証は適用されない');
  perform pg_temp.expect(v_apply->>'reason' in ('gone','releasing'), 'A: 理由が返る');

  perform pg_temp.expect(
    (select status from public.site_domains where host='a.example.com') = 'release_pending',
    'A: 行は解除待ちのまま');
  perform pg_temp.expect(
    (select custom_domain from public.sites where id=v_site) is null,
    'A: 主URLが復活していない');

  -- 4. 解除の後始末（新しい世代で行う）
  select operation_epoch into v_epoch from public.site_domains where host='a.example.com';
  v_finish := public.laruhp_domain_finish_release(v_site,'a.example.com','token-a',v_epoch);
  perform pg_temp.expect((v_finish->>'ok')::boolean, 'A: 解除の後始末は成功する');

  -- 5. 対応する行が無い custom_domain が残らないこと（レビューで再現された状態）
  select exists(
    select 1 from public.sites s
     where s.id=v_site and s.custom_domain is not null
       and not exists (select 1 from public.site_domains d where d.site_id=s.id and d.host=s.custom_domain)
  ) into v_dangling;
  perform pg_temp.expect(not v_dangling, 'A: 実体の無い主URLが残らない');
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 順序B: 検証中に利用者が主URLを明示的に選んだら、自動採用で上書きしない
-- ════════════════════════════════════════════════════════════
do $$
declare
  v_site uuid := '10000000-0000-0000-0000-000000000001';
  v_epoch_new bigint; v_epoch_chosen bigint;
  v_apply jsonb;
begin
  insert into public.site_domains(site_id,host,verification_token,status)
  values (v_site,'chosen.example.com','token-chosen','connected'),
         (v_site,'b-new.example.com','token-bnew','pending_ownership');

  -- 1. 主URLが未設定の時点で、新候補の検証が始まる
  perform pg_temp.expect((select custom_domain from public.sites where id=v_site) is null, 'B: 開始時は主URL未設定');
  select operation_epoch into v_epoch_new from public.site_domains where host='b-new.example.com';

  -- 2. その間に利用者が別のドメインを明示的に選ぶ
  select operation_epoch into v_epoch_chosen from public.site_domains where host='chosen.example.com';
  perform public.laruhp_domain_set_primary(v_site,'chosen.example.com','token-chosen',v_epoch_chosen);
  perform pg_temp.expect((select custom_domain from public.sites where id=v_site)='chosen.example.com', 'B: 明示選択が反映される');

  -- 3. 遅れて完了した新候補の検証が自動採用しようとする
  v_apply := public.laruhp_domain_apply_check(v_site,'b-new.example.com','token-bnew',v_epoch_new,'connected','rd-b',null,true);
  perform pg_temp.expect((v_apply->>'ok')::boolean, 'B: 検証結果自体は保存される');
  perform pg_temp.expect((v_apply->>'switched')::boolean is false, 'B: 自動採用は行われない');
  perform pg_temp.expect((select custom_domain from public.sites where id=v_site)='chosen.example.com',
    'B: 明示的に選んだ主URLが上書きされない');
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 順序C: 遅れて届いた古い解除失敗が、作り直された新しい申請を壊さない
-- ════════════════════════════════════════════════════════════
do $$
declare
  v_site uuid := '10000000-0000-0000-0000-000000000001';
  v_epoch_old bigint; v_epoch_new bigint;
  v_mark jsonb;
begin
  insert into public.site_domains(site_id,host,verification_token,status)
  values (v_site,'c.example.com','token-c1','connected');

  -- 1. 解除を開始して完了させる
  perform public.laruhp_domain_begin_release(v_site,'c.example.com');
  select operation_epoch into v_epoch_old from public.site_domains where host='c.example.com';
  perform public.laruhp_domain_finish_release(v_site,'c.example.com','token-c1',v_epoch_old);
  perform pg_temp.expect(not exists(select 1 from public.site_domains where host='c.example.com'), 'C: 解除で行が消える');

  -- 2. 同じホストを新しいトークンで登録し直し、主URLにする
  insert into public.site_domains(site_id,host,verification_token,status)
  values (v_site,'c.example.com','token-c2','connected');
  select operation_epoch into v_epoch_new from public.site_domains where host='c.example.com';
  perform public.laruhp_domain_set_primary(v_site,'c.example.com','token-c2',v_epoch_new);

  -- 3. 古い解除の失敗通知が遅れて届く
  v_mark := public.laruhp_domain_mark_release_failed(v_site,'c.example.com',v_epoch_old,'Renderに接続できませんでした');
  perform pg_temp.expect((v_mark->>'ok')::boolean is false, 'C: 古い世代の解除失敗は適用されない');
  perform pg_temp.expect(
    (select status from public.site_domains where host='c.example.com')='connected',
    'C: 作り直した行が解除待ちにされない');
  perform pg_temp.expect(
    (select custom_domain from public.sites where id=v_site)='c.example.com',
    'C: 主URLが維持される');
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 追加D: 同じサイトの2候補を同時に初回検証しても、主URLは片方だけ
-- ════════════════════════════════════════════════════════════
do $$
declare
  v_site uuid := '10000000-0000-0000-0000-000000000002';
  v_e1 bigint; v_e2 bigint; v_a1 jsonb; v_a2 jsonb;
begin
  insert into public.sites(id,user_id,name) values (v_site,'00000000-0000-0000-0000-000000000001','d');
  insert into public.site_domains(site_id,host,verification_token,status) values
   (v_site,'d1.example.com','t-d1','pending_ownership'),
   (v_site,'d2.example.com','t-d2','pending_ownership');
  select operation_epoch into v_e1 from public.site_domains where host='d1.example.com';
  select operation_epoch into v_e2 from public.site_domains where host='d2.example.com';

  v_a1 := public.laruhp_domain_apply_check(v_site,'d1.example.com','t-d1',v_e1,'connected','rd1',null,true);
  v_a2 := public.laruhp_domain_apply_check(v_site,'d2.example.com','t-d2',v_e2,'connected','rd2',null,true);

  perform pg_temp.expect((v_a1->>'switched')::boolean, 'D: 先に確定したほうが主URLになる');
  perform pg_temp.expect((v_a2->>'switched')::boolean is false, 'D: 2件目は自動採用されない');
  perform pg_temp.expect((select custom_domain from public.sites where id=v_site)='d1.example.com', 'D: 主URLは1つ');
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 追加E: 解除待ちでない行を finish_release で消せない
-- ════════════════════════════════════════════════════════════
do $$
declare
  v_site uuid := '10000000-0000-0000-0000-000000000002';
  v_e bigint; v_r jsonb;
begin
  insert into public.site_domains(site_id,host,verification_token,status)
  values (v_site,'e.example.com','t-e','connected');
  select operation_epoch into v_e from public.site_domains where host='e.example.com';
  v_r := public.laruhp_domain_finish_release(v_site,'e.example.com','t-e',v_e);
  perform pg_temp.expect((v_r->>'ok')::boolean is false, 'E: 解除中でない行は消せない');
  perform pg_temp.expect(v_r->>'reason'='not_releasing', 'E: 理由が返る');
  perform pg_temp.expect(exists(select 1 from public.site_domains where host='e.example.com'), 'E: 行が残る');
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 追加F: 外部登録の開始印は、世代が一致するときだけ立つ
-- ════════════════════════════════════════════════════════════
do $$
declare
  v_site uuid := '10000000-0000-0000-0000-000000000002';
  v_e bigint; v_r jsonb;
begin
  insert into public.site_domains(site_id,host,verification_token,status)
  values (v_site,'f.example.com','t-f','pending_ownership');
  select operation_epoch into v_e from public.site_domains where host='f.example.com';

  v_r := public.laruhp_domain_mark_register_started(v_site,'f.example.com',v_e);
  perform pg_temp.expect((v_r->>'ok')::boolean, 'F: 登録開始の印が立つ');
  perform pg_temp.expect(
    (select render_register_started_at from public.site_domains where host='f.example.com') is not null,
    'F: 記録が残る');

  perform public.laruhp_domain_begin_release(v_site,'f.example.com');
  v_r := public.laruhp_domain_mark_register_started(v_site,'f.example.com',v_e);
  perform pg_temp.expect((v_r->>'ok')::boolean is false, 'F: 世代が進んだあとの印は立たない');
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 追加G: 解除待ちの行に検証結果を書き戻せない
-- ════════════════════════════════════════════════════════════
do $$
declare
  v_site uuid := '10000000-0000-0000-0000-000000000002';
  v_e bigint; v_r jsonb;
begin
  insert into public.site_domains(site_id,host,verification_token,status)
  values (v_site,'g.example.com','t-g','connected');
  perform public.laruhp_domain_begin_release(v_site,'g.example.com');
  select operation_epoch into v_e from public.site_domains where host='g.example.com';
  -- 新しい世代でも、解除待ちなら検証は通さない
  v_r := public.laruhp_domain_apply_check(v_site,'g.example.com','t-g',v_e,'connected','rd-g',null,true);
  perform pg_temp.expect((v_r->>'ok')::boolean is false, 'G: 解除待ちの行に検証結果を書けない');
  perform pg_temp.expect(v_r->>'reason'='releasing', 'G: 理由が releasing');
end;
$$;


-- ════════════════════════════════════════════════════════════
-- 追加H: 解除開始時に「外部登録の帰属」を固定する
-- ════════════════════════════════════════════════════════════
do $$
declare v_site uuid := '10000000-0000-0000-0000-000000000002';
begin
  -- legacy（移行で取り込んだ＝実際に配信していた割当）
  insert into public.site_domains(site_id,host,verification_token,status)
  values (v_site,'h-legacy.example','t-h1','legacy');
  perform public.laruhp_domain_begin_release(v_site,'h-legacy.example');
  perform pg_temp.expect(
    (select external_registration_owned from public.site_domains where host='h-legacy.example'),
    'H: legacy は外部登録の帰属ありとして固定される');

  -- 所有確認も外部登録も通っていない候補
  insert into public.site_domains(site_id,host,verification_token,status)
  values (v_site,'h-new.example','t-h2','pending_ownership');
  perform public.laruhp_domain_begin_release(v_site,'h-new.example');
  perform pg_temp.expect(
    (select external_registration_owned from public.site_domains where host='h-new.example') is false,
    'H: 未所有・未登録の候補は帰属なし');

  -- 登録を呼んだ記録がある候補
  insert into public.site_domains(site_id,host,verification_token,status,render_register_started_at)
  values (v_site,'h-started.example','t-h3','pending_dns',now());
  perform public.laruhp_domain_begin_release(v_site,'h-started.example');
  perform pg_temp.expect(
    (select external_registration_owned from public.site_domains where host='h-started.example'),
    'H: 登録を呼んだ記録があれば帰属あり（DB保存前に落ちた分の回収）');
end;
$$;

select 'ALL SQL REGRESSION SCENARIOS PASSED (incl. H)' as result;
