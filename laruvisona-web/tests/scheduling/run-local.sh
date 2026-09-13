#!/usr/bin/env bash
# One complete local run. No production credentials, emails or databases.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${OUTPUT_DIR:-/tmp/hp-scheduling-check}"
mkdir -p "$OUT"
for port in 3331 55019; do
 if curl -s --max-time 1 "http://127.0.0.1:$port/" >/dev/null; then
  echo "Port $port is already in use. Stop the previous test process first." >&2; exit 2
 fi
done
DB_PID=''; APP_PID=''
cleanup(){
 if [ -n "$APP_PID" ]; then kill "$APP_PID" 2>/dev/null || true; wait "$APP_PID" 2>/dev/null || true; fi
 if [ -n "$DB_PID" ]; then kill "$DB_PID" 2>/dev/null || true; wait "$DB_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT
PYTHONDONTWRITEBYTECODE=1 python3 tests/scheduling/run.py --serve >"$OUT/database.log" 2>&1 &
DB_PID=$!
ready=0
for _ in $(seq 1 120); do
 if curl -fsS http://127.0.0.1:55019/health >/dev/null 2>&1; then ready=1; break; fi
 kill -0 "$DB_PID" 2>/dev/null || { cat "$OUT/database.log"; exit 1; }
 sleep .5
done
[ "$ready" = 1 ] || { echo "Database fixture did not start"; exit 1; }
export NEXT_PUBLIC_APP_URL=https://laruvisona.jp
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55019
export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon SUPABASE_SERVICE_ROLE_KEY=stub-service
export RESEND_API_KEY=''
# Force tag configuration so the private booking route's exclusion is actually exercised.
export NEXT_PUBLIC_GA_MEASUREMENT_ID=G-SCHEDULING-TEST NEXT_PUBLIC_LARUBOT_PUBLIC_ID=scheduling-test
npm run build >"$OUT/build.log" 2>&1
node node_modules/next/dist/bin/next start -p 3331 >"$OUT/server.log" 2>&1 &
APP_PID=$!
ready=0
for _ in $(seq 1 60); do
 if curl -s --max-time 1 http://127.0.0.1:3331/laruHP/booking/schedule >/dev/null; then ready=1; break; fi
 kill -0 "$APP_PID" 2>/dev/null || { cat "$OUT/server.log"; exit 1; }
 sleep .5
done
[ "$ready" = 1 ] || { echo "App did not start"; exit 1; }
OUTPUT_DIR="$OUT" node tests/scheduling/browser.mjs >"$OUT/browser.log" 2>&1
cat "$OUT/browser.log"
