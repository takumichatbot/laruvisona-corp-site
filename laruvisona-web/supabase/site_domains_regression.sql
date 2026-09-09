-- 実PostgreSQL上での回帰テスト。
--
-- 監督レビュー(ecea9d0)で実DBに再現された競合の順序を、そのまま並べて実行する。
-- 期待どおりでなければ raise exception で落ちるので、psql の終了コードで判定できる。
--
-- 実行:
--   ./supabase/run-sql-regression.sh
--   （一時クラスタを作り、test-bootstrap.sql → schema.sql → site_domains.sql を
--     適用してからこのファイルを流す。終了時に自分が作ったものだけ片付ける）
--
-- 前提: 上記3つを適用済みの空DB。

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

  v_r := public.laruhp_domain_mark_register_started(v_site,'f.example.com','t-f',v_e);
  perform pg_temp.expect((v_r->>'ok')::boolean, 'F: 登録開始の印が立つ');
  perform pg_temp.expect(
    (select render_register_started_at from public.site_domains where host='f.example.com') is not null,
    'F: 記録が残る');

  perform public.laruhp_domain_begin_release(v_site,'f.example.com');
  v_r := public.laruhp_domain_mark_register_started(v_site,'f.example.com','t-f',v_e);
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



-- ════════════════════════════════════════════════════════════
-- 追加I: 同じホストの解除は1つに集約する（重複解除を並行させない）
-- ════════════════════════════════════════════════════════════
do $$
declare
  v_site uuid := '10000000-0000-0000-0000-000000000003';
  v_a jsonb; v_b jsonb;
begin
  insert into public.sites(id,user_id,name) values (v_site,'00000000-0000-0000-0000-000000000001','i');
  insert into public.site_domains(site_id,host,verification_token,status,render_domain_id)
  values (v_site,'i.example','t-i','connected','provider-old');

  v_a := public.laruhp_domain_begin_release(v_site,'i.example');
  perform pg_temp.expect((v_a->>'ok')::boolean, 'I: 1本目の解除は開始できる');

  v_b := public.laruhp_domain_begin_release(v_site,'i.example');
  perform pg_temp.expect((v_b->>'ok')::boolean is false, 'I: 2本目は開始しない');
  perform pg_temp.expect(v_b->>'reason' = 'in_progress', 'I: 進行中として返す');
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 追加J: 古い解除は、新しい世代の登録を削除対象にできない
--        （レビューで再現された順序：A遅延 → B完了 → 再登録 → A再開）
-- ════════════════════════════════════════════════════════════
do $$
declare
  v_site uuid := '10000000-0000-0000-0000-000000000003';
  v_a jsonb; v_row jsonb; v_epoch_a bigint; v_op_a uuid;
  v_claim jsonb; v_pin jsonb;
begin
  insert into public.site_domains(site_id,host,verification_token,status,render_domain_id)
  values (v_site,'j.example','t-j1','connected','provider-old');

  -- 解除A開始（外部照会が遅れる想定）。この時点の世代と処理IDを持つ。
  v_a := public.laruhp_domain_begin_release(v_site,'j.example');
  v_row := v_a->'row';
  v_epoch_a := (v_row->>'operation_epoch')::bigint;
  v_op_a := (v_row->>'release_operation_id')::uuid;

  -- 解除Bが完了して行が消える
  perform public.laruhp_domain_finish_release(v_site,'j.example','t-j1',v_epoch_a);
  perform pg_temp.expect(not exists(select 1 from public.site_domains where host='j.example'),
    'J: 先行の解除で行が消える');

  -- 同じホストが新しい token / 新しい外部IDで再登録され、主URLになる
  insert into public.site_domains(site_id,host,verification_token,status,render_domain_id)
  values (v_site,'j.example','t-j2','connected','provider-new');
  update public.sites set custom_domain = null where id = v_site;

  -- 遅れていた解除Aが、削除の直前に占有を確かめる
  v_claim := public.laruhp_domain_claim_release(v_site,'j.example',v_epoch_a,v_op_a);
  perform pg_temp.expect((v_claim->>'ok')::boolean is false, 'J: 古い解除は占有を取れない');
  perform pg_temp.expect(v_claim->>'reason' = 'stale', 'J: 理由が stale');

  -- 新しい行のIDが、古い解除の対象として固定されることもない
  v_pin := public.laruhp_domain_pin_release_target(v_site,'j.example',v_epoch_a,v_op_a,'provider-new');
  perform pg_temp.expect((v_pin->>'ok')::boolean is false, 'J: 古い解除が新しいIDを固定できない');
  perform pg_temp.expect(
    (select render_domain_id from public.site_domains where host='j.example') = 'provider-new',
    'J: 再登録した行はそのまま');
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 追加K: 登録開始の記録は、行の同一性・世代・状態を見る
-- ════════════════════════════════════════════════════════════
do $$
declare
  v_site uuid := '10000000-0000-0000-0000-000000000003';
  v_e bigint; v_r jsonb;
begin
  insert into public.site_domains(site_id,host,verification_token,status)
  values (v_site,'k.example','t-k1','pending_ownership');
  select operation_epoch into v_e from public.site_domains where host='k.example';

  -- 別のトークン（＝作り直された行）では記録しない。
  -- epoch は作り直すと 1 に戻りうるので、世代だけでは足りない。
  v_r := public.laruhp_domain_mark_register_started(v_site,'k.example','t-OLD',v_e);
  perform pg_temp.expect((v_r->>'ok')::boolean is false, 'K: 別トークンでは記録しない');

  -- 解除中の行にも記録しない
  perform public.laruhp_domain_begin_release(v_site,'k.example');
  select operation_epoch into v_e from public.site_domains where host='k.example';
  v_r := public.laruhp_domain_mark_register_started(v_site,'k.example','t-k1',v_e);
  perform pg_temp.expect((v_r->>'ok')::boolean is false, 'K: 解除中は記録しない');
  perform pg_temp.expect(v_r->>'reason' = 'releasing', 'K: 理由が releasing');
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 追加L: 登録途中のままサイトごと削除されても、記録が残る
-- ════════════════════════════════════════════════════════════
do $$
declare
  v_site uuid := '10000000-0000-0000-0000-000000000004';
  v_e bigint;
begin
  insert into public.sites(id,user_id,name) values (v_site,'00000000-0000-0000-0000-000000000001','l');
  insert into public.site_domains(site_id,host,verification_token,status)
  values (v_site,'l.example','t-l','pending_ownership');
  select operation_epoch into v_e from public.site_domains where host='l.example';

  -- 外部登録を呼ぶ直前の印だけがある状態（IDはまだ保存されていない）
  perform public.laruhp_domain_mark_register_started(v_site,'l.example','t-l',v_e);

  delete from public.sites where id = v_site;

  perform pg_temp.expect(not exists(select 1 from public.site_domains where host='l.example'),
    'L: CASCADEで候補行は消える');
  perform pg_temp.expect(
    exists(select 1 from public.domain_release_queue where host='l.example' and resolved_at is null),
    'L: 後始末のキューに残る（登録途中の記録が失われない）');
  perform pg_temp.expect(
    (select verification_token from public.domain_release_queue where host='l.example') = 't-l',
    'L: 行の同一性がキューに残る');
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 追加M: 記録できなかった外部登録を、帰属付きで積める
-- ════════════════════════════════════════════════════════════
do $$
declare
  v_site uuid := '10000000-0000-0000-0000-000000000003';
begin
  perform public.laruhp_domain_enqueue_orphan_registration(
    v_site,'m.example','provider-orphan','t-m',1,'apply_check が gone を返した');
  perform pg_temp.expect(
    (select kind from public.domain_release_queue where host='m.example') = 'orphan_registration',
    'M: 登録の積み残しとして区別できる');
  perform pg_temp.expect(
    (select render_domain_id from public.domain_release_queue where host='m.example') = 'provider-orphan',
    'M: 外部IDが残る');
end;
$$;

select 'ALL SQL REGRESSION SCENARIOS PASSED (A-M)' as result;
