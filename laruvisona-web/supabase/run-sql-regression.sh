#!/bin/bash
# 一時DBを作り、schema.sql と site_domains.sql を適用して回帰テストを流す。
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
S="${PGSOCK:-/tmp/pgtest/sock}"
DB="${PGDB:-laruhp_test}"
psql -h "$S" -U laruhp -d postgres -q -c "drop database if exists $DB;" -c "create database $DB;" 2>&1 | grep -v NOTICE || true
psql -h "$S" -U laruhp -d "$DB" -q -v ON_ERROR_STOP=1 -f "$DIR/bootstrap.sql" >/dev/null
psql -h "$S" -U laruhp -d "$DB" -q -v ON_ERROR_STOP=1 -f "$DIR/schema.sql" >/dev/null 2>&1
psql -h "$S" -U laruhp -d "$DB" -q -v ON_ERROR_STOP=1 -f "$DIR/site_domains.sql" >/dev/null 2>&1
psql -h "$S" -U laruhp -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/site_domains_regression.sql"
