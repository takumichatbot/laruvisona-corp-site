#!/usr/bin/env bash
#
# 顧客公開サイトのルーティングを、実際の本番ビルドに実HTTPで当てて検証する。
#
#   npm run build && bash tests/http/run.sh
#
# fixture と next start は、動いていなければこのスクリプトが自分で起動し、
# 自分が起動したものだけを終了時に止める。
# tests/http/fixture.cjs が Supabase(PostgREST) の応答を模す。外部へは出ない。
# 期待値は tests/http/cases.tsv（タブ区切り）に置く。
#
# 検査するもの:
#   HTTP    … 状態コード
#   転送先  … Location（308のとき。パスとクエリが保たれること）
#   本文    … そのホストに出てよい印だけが出ていること（越境の検出）
#   正規URL … rel="canonical"（入口が違っても同じURLになること）
#
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
PORT="${PORT:-3100}"
FIXTURE_PORT="${FIXTURE_PORT:-54999}"

# サイトごとに1つだけ出てよい印。ほかが出たら越境
MARKERS="A_ONLY_SITE_BODY B_ONLY_SITE_BODY A_ONLY_ARTICLE B_ONLY_ARTICLE A_PRODUCT B_ONLY_PRODUCT"

BODY="$(mktemp)"
FIXTURE_PID=''; SERVER_PID=''
cleanup() {
  rm -f "$BODY"
  [ -n "$FIXTURE_PID" ] && kill "$FIXTURE_PID" 2>/dev/null
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  return 0
}
trap cleanup EXIT

up() { curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$1/" 2>/dev/null; [ $? -ne 7 ]; }

if ! up "$FIXTURE_PORT"; then
  node "$DIR/fixture.cjs" >"$DIR/fixture.log" 2>&1 &
  FIXTURE_PID=$!
fi

if ! up "$PORT"; then
  if [ ! -d "$ROOT/.next" ]; then
    echo "先に本番用ビルドを作ってください: npm run build" >&2; exit 2
  fi
  # 参照先を fixture に向ける。実際のSupabaseへは出ない
  (cd "$ROOT" && \
    NEXT_PUBLIC_APP_URL="https://laruvisona.jp" \
    NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$FIXTURE_PORT" \
    NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-stub" \
    SUPABASE_SERVICE_ROLE_KEY="service-stub" \
    npx next start -p "$PORT" >"$DIR/server.log" 2>&1) &
  SERVER_PID=$!
  for _ in $(seq 1 40); do up "$PORT" && break; sleep 0.5; done
fi

if ! up "$PORT"; then
  echo "サーバを起動できませんでした。$DIR/server.log を見てください。" >&2; exit 1
fi

fail=0; pass=0
printf "%-22s %-40s %-5s %s\n" HOST PATH HTTP RESULT

while IFS=$'\t' read -r host path want_code want_loc want_content want_canon; do
  case "$host" in ''|'#'*) continue;; esac

  out=$(curl -s -o "$BODY" -w "%{http_code}|%{redirect_url}" -H "Host: $host" "http://127.0.0.1:$PORT$path")
  code="${out%%|*}"; loc="${out#*|}"; [ -z "$loc" ] && loc='-'

  found=''
  for m in $MARKERS; do grep -q "$m" "$BODY" 2>/dev/null && found="$found $m"; done
  found="$(echo $found)"; [ -z "$found" ] && found='-'

  canon=$(grep -o 'rel="canonical" href="[^"]*"' "$BODY" 2>/dev/null | head -1 | sed 's/.*href="//;s/"//')
  [ -z "$canon" ] && canon='-'

  why=''
  [ "$code"    != "$want_code" ]    && why="$why HTTP=$code(期待 $want_code)"
  [ "$loc"     != "$want_loc" ]     && why="$why 転送先=$loc(期待 $want_loc)"
  [ "$found"   != "$want_content" ] && why="$why 本文=$found(期待 $want_content)"
  [ "$want_canon" != '-' ] && [ "$canon" != "$want_canon" ] && why="$why 正規URL=$canon(期待 $want_canon)"

  if [ -z "$why" ]; then
    pass=$((pass+1)); printf "%-22s %-40s %-5s OK\n" "$host" "$path" "$code"
  else
    fail=$((fail+1)); printf "%-22s %-40s %-5s NG:%s\n" "$host" "$path" "$code" "$why"
  fi
done < "$DIR/cases.tsv"

echo "---"
echo "通過 $pass / 失敗 $fail"
[ "$fail" -eq 0 ] || exit 1
echo "ALL HTTP ROUTING CASES PASSED"
