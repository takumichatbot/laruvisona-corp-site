#!/usr/bin/env bash
#
# 申し込み〜決済〜解約を、人の手を使わずに最後まで通す。
#
#   npm run build && bash tests/billing/run.sh
#
# Stripe・Supabase・メール・LARUbot を替え玉に差し替え、こちらのコードだけ
# 本物のまま動かす。外部へは一切出ない。実際の請求は立たない。
#
# 替え玉の向け先は、すべて環境変数で切り替えている。
#   NEXT_PUBLIC_SUPABASE_URL … ビルド時に埋め込まれるので、番号は 54999 から動かせない
#   STRIPE_API_BASE          … lib/stripe.ts がループバック宛のときだけ受け付ける
#   RESEND_BASE_URL          … resend パッケージが読む
#   LARUBOT_API_URL          … lib/larubot-provision.ts が読む
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
PORT="${PORT:-3100}"
SUPABASE_PORT=54999
SERVICES_PORT=54998
WEBHOOK_SECRET='whsec_billing_scenario_only_20260917'

FIXTURE_PID=''; SERVER_PID=''
cleanup() {
  [ -n "$FIXTURE_PID" ] && kill "$FIXTURE_PID" 2>/dev/null
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  return 0
}
trap cleanup EXIT

up() { curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$1/" 2>/dev/null; [ $? -ne 7 ]; }

if [ ! -d "$ROOT/.next" ]; then
  echo "先に本番用ビルドを作ってください: npm run build" >&2; exit 2
fi

# tests/http の偽Supabaseと同じ番号を使うので、同時には走らせられない。
if up "$SUPABASE_PORT"; then
  if curl -s --max-time 2 "http://127.0.0.1:$SERVICES_PORT/__ids" | grep -q userId; then
    echo "  （すでに立っている替え玉を使います）"
  else
    echo "ポート $SUPABASE_PORT を別のものが使っています（tests/http の偽Supabaseなど）。" >&2
    echo "それを止めてから、もう一度実行してください。" >&2
    exit 2
  fi
else
  node "$DIR/fixture.cjs" >"$DIR/fixture.log" 2>&1 &
  FIXTURE_PID=$!
  for _ in $(seq 1 30); do
    curl -s --max-time 1 "http://127.0.0.1:$SERVICES_PORT/__ids" | grep -q userId && break
    sleep 0.3
  done
fi

if ! curl -s --max-time 2 "http://127.0.0.1:$SERVICES_PORT/__ids" | grep -q userId; then
  echo "替え玉が立ち上がりませんでした。$DIR/fixture.log を見てください。" >&2; exit 2
fi

# 動いているサーバーが、いまのビルドとは限らない。
# 古いビルドに当てると、直したはずの挙動がそのまま通る。
if up "$PORT" && [ -f "$ROOT/.next/BUILD_ID" ]; then
  want="$(cat "$ROOT/.next/BUILD_ID")"
  got="$(curl -s --max-time 5 "http://127.0.0.1:$PORT/laruHP" | grep -o '"buildId":"[^"]*"' | head -1 | cut -d'"' -f4)"
  if [ -n "$got" ] && [ "$got" != "$want" ]; then
    echo "ポート $PORT のサーバーが、いまのビルドではありません（$got / $want）。" >&2
    echo "そのサーバーを止めてから、もう一度実行してください。" >&2
    exit 2
  fi
fi

if ! up "$PORT"; then
  (cd "$ROOT" && \
    NODE_ENV=production \
    NEXT_PUBLIC_APP_URL="https://laruvisona.jp" \
    NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$SUPABASE_PORT" \
    NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-stub" \
    SUPABASE_SERVICE_ROLE_KEY="service-stub" \
    STRIPE_SECRET_KEY="sk_test_billing_scenario" \
    STRIPE_API_BASE="http://127.0.0.1:$SERVICES_PORT" \
    STRIPE_WEBHOOK_SECRET="$WEBHOOK_SECRET" \
    STRIPE_FIRST_MONTH_COUPON_ID="coupon_first_month" \
    STRIPE_PRICE_ID="price_hp" \
    RESEND_API_KEY="re_billing_scenario" \
    RESEND_BASE_URL="http://127.0.0.1:$SERVICES_PORT" \
    LARUBOT_API_URL="http://127.0.0.1:$SERVICES_PORT/larubot" \
    LARU_HP_API_SECRET="billing-scenario-only" \
    ADMIN_EMAIL="owner@example.test" \
    npx next start -p "$PORT" >"$DIR/server.log" 2>&1) &
  SERVER_PID=$!
  for _ in $(seq 1 60); do up "$PORT" && break; sleep 0.5; done
fi

if ! up "$PORT"; then
  echo "アプリが立ち上がりませんでした。$DIR/server.log を見てください。" >&2; exit 2
fi

APP_URL="http://127.0.0.1:$PORT" \
SERVICES_URL="http://127.0.0.1:$SERVICES_PORT" \
STRIPE_WEBHOOK_SECRET="$WEBHOOK_SECRET" \
node "$DIR/scenario.mjs"
