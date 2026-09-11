#!/usr/bin/env bash
#
# site_domains_state_check.sql が「異常を本当に見つけるか」を、
# 外部に一切つながらない一時PostgreSQLで確かめる。
#
#   ./supabase/run-state-check-regression.sh
#
# 2段階で確かめる。
#   検出フェーズ … 正常・未適用・22通りの異常を作り、期待どおりの行が落ちるか
#   空振りフェーズ … 同じケースから「異常を作るSQL」だけを抜き、
#                    どのケースも検出されないこと（＝検査が空振りでないこと）
#
# ロールはデータベースではなくクラスタで共有されるので、
#   ・作成はクラスタで1回だけ
#   ・ロールを変えるケースは必ず元へ戻す
#   ・ケースごとに開始時の基準状態（98=t / 99=f / 落ちる行は27,28だけ）を確認
# とし、SQLのエラーは握りつぶさない（すべて ON_ERROR_STOP）。
#
# 既存のPostgreSQLや既存のデータベースには触れない。
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PG_BIN="${PG_BIN:-}"
if [ -z "$PG_BIN" ]; then
  if command -v initdb >/dev/null 2>&1; then PG_BIN="$(dirname "$(command -v initdb)")"
  else for c in /usr/lib/postgresql/*/bin /opt/homebrew/opt/postgresql*/bin /usr/local/opt/postgresql*/bin; do
         [ -x "$c/initdb" ] && PG_BIN="$c" && break; done; fi
fi
[ -x "${PG_BIN:-}/initdb" ] || { echo "initdb が見つかりません。PG_BIN=/path/to/bin を指定してください。" >&2; exit 2; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/laruhp-state.XXXXXX")"
cleanup(){ [ -d "$WORK/data" ] && "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"$PG_BIN/initdb" -D "$WORK/data" -U "$(id -un)" --auth=trust >"$WORK/initdb.log" 2>&1
"$PG_BIN/pg_ctl" -D "$WORK/data" -o "-k $WORK -h ''" -l "$WORK/pg.log" -w start >/dev/null
export PGHOST="$WORK" PGUSER="$(id -un)" PGOPTIONS='-c client_min_messages=warning'

P(){ local db="$1"; shift; psql -q -d "$db" -v ON_ERROR_STOP=1 "$@"; }
J(){ psql -d "$1" -tAF'|' -v ON_ERROR_STOP=1 -f "$DIR/site_domains_state_check.sql"; }

row(){ echo "$1" | awk -F'|' -v n="$2" '$1==n{print $6}'; }
rowcount(){ echo "$1" | awk -F'|' -v n="$2" '$1==n' | wc -l | tr -d ' '; }
badrows(){ echo "$1" | awk -F'|' '$6=="f" && $1<98 {printf "%s ", $1}'; }

# ── ロールはクラスタ共有。作成は1回だけ、残りはデータベースごと ──
grep -E '^create role ' "$DIR/test-bootstrap.sql"  > "$WORK/roles.sql"
grep -vE '^create role ' "$DIR/test-bootstrap.sql" > "$WORK/boot.sql"
[ "$(wc -l < "$WORK/roles.sql")" -ge 3 ] || { echo "test-bootstrap.sql からロール定義を取り出せません" >&2; exit 2; }
P postgres -f "$WORK/roles.sql" >/dev/null

role_snap(){ psql -d postgres -tA -v ON_ERROR_STOP=1 \
  -c "select string_agg(rolname||':'||rolcanlogin||':'||rolbypassrls||':'||rolsuper, ',' order by rolname)
        from pg_roles where rolname not like 'pg\_%' and rolname <> current_user"; }
ROLES0="$(role_snap)"

mkdb(){ # データベース名  applied|plain
  P postgres -c "create database \"$1\"" >/dev/null
  P "$1" -f "$WORK/boot.sql"   >/dev/null
  P "$1" -f "$DIR/schema.sql"  >/dev/null
  if [ "${2:-plain}" = applied ]; then P "$1" -f "$DIR/site_domains.sql" >/dev/null; fi
}
dropdb_(){ P postgres -c "drop database \"$1\"" >/dev/null; }

ok=0; ng=0; SEQ=0; MODE=detect
pass(){ echo "OK  $1"; ok=$((ok+1)); }
fail(){ echo "NG  $1"; ng=$((ng+1)); }

# ── 基準状態：移行SQLを当てた直後は 98=t / 99=f、落ちるのは積み残しの27,28だけ ──
BASE_BAD="27 28 "
baseline_ok(){ # 出力
  [ "$(row "$1" 98)" = t ] && [ "$(row "$1" 99)" = f ] && [ "$(badrows "$1")" = "$BASE_BAD" ]
}

t(){ # 名前 期待行(-なら指定なし) 期待98 期待99 異常SQL...
  local name="$1" want="$2" e98="$3" e99="$4"; shift 4
  if [ "$MODE" = noop ] && [ "$#" -eq 0 ]; then unset RESTORE 2>/dev/null || true; return 0; fi
  SEQ=$((SEQ+1)); local db; db="$(printf 'c%04d' "$SEQ")"
  mkdb "$db" applied
  local out
  if ! out="$(J "$db")"; then fail "$name … 基準状態の確認SQLがエラー"; dropdb_ "$db"; unset RESTORE 2>/dev/null || true; return 0; fi
  if ! baseline_ok "$out"; then
    fail "$name … 基準状態が違う（98=$(row "$out" 98) 99=$(row "$out" 99) 落ちた行: $(badrows "$out")）"
    dropdb_ "$db"; unset RESTORE 2>/dev/null || true; return 0
  fi
  if [ "$MODE" = detect ]; then for s in "$@"; do P "$db" -c "$s" >/dev/null; done; fi
  if ! out="$(J "$db")"; then fail "$name … 確認SQLがエラー"; dropdb_ "$db"; unset RESTORE 2>/dev/null || true; return 0; fi
  dropdb_ "$db"
  if [ "$MODE" = detect ] && [ -n "${RESTORE:-}" ]; then P postgres -c "$RESTORE" >/dev/null; fi
  unset RESTORE 2>/dev/null || true

  local a b bad; a="$(row "$out" 98)"; b="$(row "$out" 99)"; bad="$(badrows "$out")"
  if [ "$MODE" = detect ]; then
    local hit=1
    [ "$want" = "-" ] || echo " $bad" | grep -q " $want " || hit=0
    if [ "$a" = "$e98" ] && [ "$b" = "$e99" ] && [ "$hit" = 1 ]; then
      pass "$name … 98=$a 99=$b 落ちた行: ${bad:-なし}"
    else
      fail "$name … 期待 行$want/98=$e98/99=$e99 実際 98=$a 99=$b 落ちた行: ${bad:-なし}"
    fi
  else
    # 空振りフェーズ：異常SQLを抜いたら、そのケースは検出されないはず
    if [ "$a" = t ] && [ "$b" = f ] && [ "$bad" = "$BASE_BAD" ] && [ "$e98$e99$want" != "tf-" ]; then
      pass "$name … 異常を抜くと検出されない（想定どおり）"
    else
      fail "$name … 異常を抜いても検出されてしまう（98=$a 99=$b 落ちた行: ${bad:-なし}）＝このケースは空振り"
    fi
  fi
  # ロール状態が持ち越されていないこと
  if [ "$(role_snap)" != "$ROLES0" ]; then
    fail "$name のあとでロール状態が戻っていません（以降のケースは信用できません）"; exit 1
  fi
}

cases(){
  RESTORE=''
  t "残存権限を是正した隔離環境"          -  t t 'revoke truncate, references, trigger on public.site_domains from anon, authenticated'
  t "解除キューに TRUNCATE を付与"        22 f f 'grant truncate on public.domain_release_queue to authenticated'
  t "Codex再現: sd是正＋キューTRUNCATE"   22 f f 'revoke truncate, references, trigger on public.site_domains from anon, authenticated' 'grant truncate on public.domain_release_queue to authenticated'
  t "解除キューに列単位 REFERENCES"       23 f f 'grant references(host) on public.domain_release_queue to anon'
  t "解除キューに TRIGGER を付与"         23 f f 'grant trigger on public.domain_release_queue to anon'
  t "ポリシーの対象を service_role に"    16 f f 'alter policy "Users read own site_domains" on public.site_domains to service_role'
  t "ポリシーを USING(true) に"           16 f f 'alter policy "Users read own site_domains" on public.site_domains using (true)'
  t "ポリシーを削除"                      15 f f 'drop policy "Users read own site_domains" on public.site_domains'
  t "ガードを BEFORE UPDATE だけに"       10 f f 'drop trigger guard_sites_custom_domain_trg on public.sites' 'create trigger guard_sites_custom_domain_trg before update on public.sites for each row execute function public.guard_sites_custom_domain()'
  t "ガードトリガを無効化"                10 f f 'alter table public.sites disable trigger guard_sites_custom_domain_trg'
  t "RLS を無効化"                        13 f f 'alter table public.site_domains disable row level security'
  t "site_domains の表権限を開放"         17 f f 'grant insert, update on public.site_domains to authenticated'
  t "列単位 GRANT UPDATE(status)"         19 f f 'grant update(status) on public.site_domains to authenticated'
  RESTORE='alter role service_role_x rename to service_role'
  t "service_role を別名に"                5 f f 'alter role service_role rename to service_role_x'
  t "service_role の表権限を取消"         24 f f 'revoke all on public.site_domains from service_role'
  t "キューの列を削除"                     7 f f 'alter table public.domain_release_queue drop column kind'
  t "キューの kind を integer に"          7 f f 'alter table public.domain_release_queue drop column kind, add column kind integer'
  t "status 制約を CHECK(true) に"         8 f f 'alter table public.site_domains drop constraint site_domains_status_check' 'alter table public.site_domains add constraint site_domains_status_check check (true)'
  t "host の一意索引を部分索引に"          9 f f 'drop index public.site_domains_host_key' "create unique index site_domains_host_key on public.site_domains (host) where status = 'connected'"
  t "RPC を authenticated へ開放"         33 f f 'grant execute on function public.laruhp_domain_set_primary(uuid,text,text,bigint) to authenticated'
  t "関数を旧シグネチャへ置換"            29 f f 'drop function public.laruhp_domain_set_primary(uuid,text,text,bigint)' 'create function public.laruhp_domain_set_primary(p_site_id uuid,p_host text,p_token text) returns jsonb language sql as $x$ select null::jsonb $x$'
  t "security definer を外す"             31 f f 'alter function public.laruhp_domain_pending_queue(text) security invoker'
  t "search_path を public_shadow に"     32 f f 'alter function public.laruhp_domain_pending_queue(text) set search_path = public_shadow'
}

echo "── 検出フェーズ ──"
mkdb base applied
if out="$(J base)"; then
  if baseline_ok "$out"; then pass "正常（適用済み） … 98=t 99=f 落ちた行: $(badrows "$out")（積み残しのみ）"
  else fail "正常（適用済み） … 98=$(row "$out" 98) 99=$(row "$out" 99) 落ちた行: $(badrows "$out")"; fi
else fail "正常（適用済み） … 確認SQLがエラー"; fi
dropdb_ base

mkdb notapplied plain
if out="$(J notapplied)"; then
  if [ "$(rowcount "$out" 98)" = 1 ] && [ "$(rowcount "$out" 99)" = 1 ] \
     && [ "$(row "$out" 98)" = f ] && [ "$(row "$out" 99)" = f ]; then
    pass "未適用でもエラーにならず、98行・99行が1行ずつ出て どちらも f"
  else
    fail "未適用の扱い（98行数=$(rowcount "$out" 98) 98=$(row "$out" 98) 99=$(row "$out" 99)）"
  fi
else fail "未適用で確認SQLがエラー"; fi
dropdb_ notapplied

MODE=detect; cases
DETECT_OK=$ok; DETECT_NG=$ng

echo ""
echo "── 空振りフェーズ（異常SQLを抜くと検出されないこと） ──"
MODE=noop; cases

echo ""
echo "検出フェーズ 通過 $DETECT_OK / 失敗 $DETECT_NG"
echo "合計         通過 $ok / 失敗 $ng"
[ "$ng" -eq 0 ] || exit 1
echo "確認SQLが、正常・未適用・22通りの異常を区別し、かつ空振りでないことを確認しました"
