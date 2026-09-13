#!/usr/bin/env bash
#
# 独自ドメインのSQLを、外部に一切つながらない一時PostgreSQLで検証する。
#
#   ./supabase/run-sql-regression.sh
#
# このスクリプトは自分で一時クラスタを作り、終わったら自分が作ったものだけを片付ける。
# 既存のPostgreSQLや既存のデータベースには触れない。
#
# 必要なもの: initdb / pg_ctl / psql（PATH、または PG_BIN で場所を指定）
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PG_BIN="${PG_BIN:-}"
if [ -z "$PG_BIN" ]; then
  if command -v initdb >/dev/null 2>&1; then
    PG_BIN="$(dirname "$(command -v initdb)")"
  else
    for c in /usr/lib/postgresql/*/bin /opt/homebrew/opt/postgresql*/bin /usr/local/opt/postgresql*/bin; do
      [ -x "$c/initdb" ] && PG_BIN="$c" && break
    done
  fi
fi
if [ -z "$PG_BIN" ] || [ ! -x "$PG_BIN/initdb" ]; then
  echo "initdb が見つかりません。PG_BIN=/path/to/postgres/bin を指定してください。" >&2
  exit 2
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/laruhp-sqltest.XXXXXX")"
DB="laruhp_regression_$$"
OWNER="$(id -un)"

cleanup() {
  if [ -d "$WORK/data" ]; then
    "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "一時クラスタ: $WORK"
if ! "$PG_BIN/initdb" -D "$WORK/data" -U "$OWNER" --auth=trust >"$WORK/initdb.log" 2>&1; then
  echo "initdb に失敗しました:" >&2; cat "$WORK/initdb.log" >&2; exit 1
fi
# TCPでは待ち受けない（Unix socketのみ）
if ! "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-k $WORK -h ''" -l "$WORK/pg.log" -w start >/dev/null; then
  echo "PostgreSQL を起動できませんでした:" >&2; cat "$WORK/pg.log" >&2; exit 1
fi

export PGHOST="$WORK" PGUSER="$OWNER"

psql -q -d postgres -c "create database \"$DB\";"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/test-bootstrap.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/schema.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_push_subscriptions.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/contacts_crm.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_orders.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_loyalty.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_newsletter.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_sequences.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_members.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/site_members.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/site_domains.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_scheduling.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_scheduling_notifications.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_scheduling_reminders.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_scheduled_emails.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_analytics.sql"

STATE="$WORK/release-state.txt"
psql -X -A -t -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/release_state_check_20260914.sql" >"$STATE"
if ! grep -qx 'zz|ALL_REQUIRED_STATE|t' "$STATE"; then
  echo "出荷状態の確認に失敗しました:" >&2
  cat "$STATE" >&2
  exit 1
fi

echo "--- 回帰シナリオ ---"
psql -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/contacts_crm_regression.sql"
psql -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_orders_regression.sql"
psql -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_loyalty_regression.sql"
psql -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_newsletter_regression.sql"
psql -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_sequences_regression.sql"
psql -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/hp_members_regression.sql"
psql -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/site_members_regression.sql"
psql -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/site_domains_regression.sql"
