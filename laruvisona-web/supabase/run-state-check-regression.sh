#!/usr/bin/env bash
#
# site_domains_state_check.sql が「異常を本当に見つけるか」を、
# 外部に一切つながらない一時PostgreSQLで確かめる。
#
#   ./supabase/run-state-check-regression.sh
#
# 正常・未適用・16通りの異常を作り、期待どおりに落ちる行が出るかを見る。
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
export PGHOST="$WORK" PGUSER="$(id -un)"

Q(){ psql -q -d "$1" -v ON_ERROR_STOP=1 -c "$2" >/dev/null; }
J(){ psql -d "$1" -tAF'|' -f "$DIR/site_domains_state_check.sql"; }

psql -q -d postgres -c 'create database base' >/dev/null
psql -q -d base -f "$DIR/test-bootstrap.sql" >/dev/null 2>&1 || true
psql -q -d base -v ON_ERROR_STOP=1 -f "$DIR/schema.sql" >/dev/null
psql -q -d base -v ON_ERROR_STOP=1 -f "$DIR/site_domains.sql" >/dev/null 2>&1

psql -q -d postgres -c 'create database notapplied' >/dev/null
psql -q -d notapplied -f "$DIR/test-bootstrap.sql" >/dev/null 2>&1 || true
psql -q -d notapplied -v ON_ERROR_STOP=1 -f "$DIR/schema.sql" >/dev/null

ok=0; ng=0
check(){ # 名前 期待行 db
  local name="$1" want="$2" db="$3"
  local out; out="$(J "$db" || true)"
  local n98; n98="$(echo "$out" | awk -F'|' '$1==98{print $6}')"
  local bad; bad="$(echo "$out" | awk -F'|' '$6=="f" && $1<98 {printf "%s ", $1}')"
  if [ "$want" = "-" ]; then
    if [ "$n98" = "t" ]; then echo "OK  $name … 98=t"; ok=$((ok+1));
    else echo "NG  $name … 98=$n98 落ちた行: $bad"; ng=$((ng+1)); fi
  else
    if [ "$n98" = "f" ] && echo " $bad" | grep -q " $want "; then echo "OK  $name … $want 行が落ちた"; ok=$((ok+1));
    else echo "NG  $name … 期待 $want / 実際 [$bad] 98=$n98"; ng=$((ng+1)); fi
  fi
}

check "正常（適用済み）" "-" base
out="$(J notapplied || true)"; if echo "$out" | awk -F'|' '$1==98{exit ($6=="f")?0:1}'; then
  echo "OK  未適用でもエラーにならず 98=f"; ok=$((ok+1)); else echo "NG  未適用の扱い"; ng=$((ng+1)); fi

t(){ # 名前 期待行 SQL...
  local name="$1" want="$2"; shift 2
  local db="t$RANDOM"
  psql -q -d postgres -c "create database $db template base" >/dev/null
  for s in "$@"; do psql -q -d "$db" -c "$s" >/dev/null 2>&1 || true; done
  check "$name" "$want" "$db"
  psql -q -d postgres -c "drop database $db" >/dev/null
}

t "ポリシーを USING(true) に"            16 'alter policy "Users read own site_domains" on public.site_domains using (true)'
t "ポリシーを削除"                       15 'drop policy "Users read own site_domains" on public.site_domains'
t "ガードを BEFORE UPDATE だけに"        10 'drop trigger guard_sites_custom_domain_trg on public.sites' 'create trigger guard_sites_custom_domain_trg before update on public.sites for each row execute function public.guard_sites_custom_domain()'
t "ガードトリガを無効化"                 10 'alter table public.sites disable trigger guard_sites_custom_domain_trg'
t "RLS を無効化"                         13 'alter table public.site_domains disable row level security'
t "表の権限を開放"                       17 'grant insert, update on public.site_domains to authenticated'
t "列単位 GRANT UPDATE(status)"          19 'grant update(status) on public.site_domains to authenticated'
t "service_role を別名に"                 5 'alter role service_role rename to service_role_x'
t "service_role の表権限を取消"          24 'revoke all on public.site_domains from service_role'
t "キューの列を削除"                      7 'alter table public.domain_release_queue drop column kind'
t "キューの kind を integer に"           7 'alter table public.domain_release_queue drop column kind, add column kind integer'
t "status 制約を CHECK(true) に"          8 'alter table public.site_domains drop constraint site_domains_status_check' 'alter table public.site_domains add constraint site_domains_status_check check (true)'
t "host の一意索引を部分索引に"           9 'drop index public.site_domains_host_key' "create unique index site_domains_host_key on public.site_domains (host) where status = 'connected'"
t "RPC を authenticated へ開放"          33 'grant execute on function public.laruhp_domain_set_primary(uuid,text,text,bigint) to authenticated'
t "関数を旧シグネチャへ置換"             29 'drop function public.laruhp_domain_set_primary(uuid,text,text,bigint)' 'create function public.laruhp_domain_set_primary(p_site_id uuid,p_host text,p_token text) returns jsonb language sql as $x$ select null::jsonb $x$'
t "security definer を外す"              31 'alter function public.laruhp_domain_pending_queue(text) security invoker'
t "search_path を public_shadow に"      32 'alter function public.laruhp_domain_pending_queue(text) set search_path = public_shadow'

echo ""
echo "通過 $ok / 失敗 $ng"
[ "$ng" -eq 0 ] || exit 1
echo "確認SQLが、正常・未適用・16通りの異常を区別できることを確認しました"
