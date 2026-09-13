#!/usr/bin/env bash
# Run after run-local.sh (same build-time fixture URL). No real credentials or external sends.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${OUTPUT_DIR:-/tmp/hp-setup-install}"
mkdir -p "$OUT"
for port in 3331 55019; do
 if curl -s --max-time 1 "http://127.0.0.1:$port/" >/dev/null; then
  echo "Port $port is already in use" >&2; exit 2
 fi
done
export NEXT_PUBLIC_APP_URL=https://laruvisona.jp NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55019
export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon SUPABASE_SERVICE_ROLE_KEY=stub-service RESEND_API_KEY=''
FIXTURE_PORT=55019 node tests/http/fixture.cjs >"$OUT/fixture.log" 2>&1 &
f=$!
node node_modules/next/dist/bin/next start -p 3331 >"$OUT/server.log" 2>&1 &
a=$!
trap 'kill "$f" "$a" 2>/dev/null || true; wait "$f" "$a" 2>/dev/null || true' EXIT
for i in $(seq 1 40); do
 if curl -fsS http://127.0.0.1:3331/laruHP/studio >/dev/null 2>&1; then break; fi
 sleep 1
done
OUTPUT_DIR="$OUT" node tests/browser/booking-install-check.mjs >"$OUT/browser.log" 2>&1
cat "$OUT/browser.log"
