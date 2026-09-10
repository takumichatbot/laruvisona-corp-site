#!/usr/bin/env bash
#
# フォント配布の比較を、案ごとに最後まで完結させて計測する。
#
#   bash docs/font-measurement/run.sh now b
#
# 1つの案につき「変種を作る → ビルド → 起動 → 案が反映されているか確認 →
# 計測 → 終了」を順に行い、次の案へ進む。
# 最後に作った変種を両方の案として測ってしまう事故を防ぐため、
# 計測の直前に「配信されているHTMLが、いま作った案と一致しているか」を確かめる。
#
# 環境変数で場所を変えられる（既定はリポジトリ直下で動かす想定）:
#   APP_ROOT       アプリのルート            既定 = このスクリプトの2つ上
#   OUT_DIR        出力先                    既定 = $APP_ROOT/tmp/measure
#   BRAND_FONTS    ブランド書体のwoff2置き場  既定 = $APP_ROOT/public/fonts
#   CUSTOMER_CSS   顧客書体のCSS             既定 = $APP_ROOT/tmp/customer-font.css
#   PORT           next start のポート        既定 = 3200
#   FIXTURE_PORT   fixture のポート           既定 = 54999
#   RUNS           1条件あたりの測定回数      既定 = 3
#   PLAYWRIGHT_FROM  playwright の解決基点（グローバル導入時のみ）
#
# 必要な資産の作り方は docs/font-comparison-2026-09-10.md の「必要な資産」を参照。
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${APP_ROOT:-$(cd "$DIR/../.." && pwd)}"
OUT_DIR="${OUT_DIR:-$APP_ROOT/tmp/measure}"
BRAND_FONTS="${BRAND_FONTS:-$APP_ROOT/public/fonts}"
CUSTOMER_CSS="${CUSTOMER_CSS:-$APP_ROOT/tmp/customer-font.css}"
PORT="${PORT:-3200}"
FIXTURE_PORT="${FIXTURE_PORT:-54999}"
RUNS="${RUNS:-3}"
PLAYWRIGHT_FROM="${PLAYWRIGHT_FROM:-}"

VARIANTS=("$@")
[ ${#VARIANTS[@]} -eq 0 ] && VARIANTS=(now b)

for p in "$BRAND_FONTS" "$CUSTOMER_CSS"; do
  if [ ! -e "$p" ]; then
    echo "必要な資産がありません: $p" >&2
    echo "docs/font-comparison-2026-09-10.md の「必要な資産」を参照してください。" >&2
    exit 2
  fi
done

FIX_PID=''; SRV_PID=''
stop_all() {
  [ -n "$SRV_PID" ] && kill "$SRV_PID" 2>/dev/null || true
  [ -n "$FIX_PID" ] && kill "$FIX_PID" 2>/dev/null || true
  SRV_PID=''; FIX_PID=''
  sleep 1
  return 0
}
trap stop_all EXIT

up() { curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$1/" >/dev/null 2>&1; [ $? -ne 7 ]; }

for V in "${VARIANTS[@]}"; do
  echo "════════ 案 $V ════════"

  echo "[1/5] 変種を作る"
  python3 "$DIR/make-variant.py" "$V" --app-root "$APP_ROOT"

  echo "[2/5] ビルド（キャッシュを消してから）"
  ( cd "$APP_ROOT" && rm -rf .next/cache && npx next build > "$OUT_DIR-build-$V.log" 2>&1 ) \
    || { echo "ビルドに失敗しました。$OUT_DIR-build-$V.log を見てください。" >&2; exit 1; }

  echo "[3/5] 起動"
  stop_all
  ( cd "$APP_ROOT" && setsid node tests/http/fixture.cjs > "$OUT_DIR-fixture-$V.log" 2>&1 < /dev/null & echo $! > /tmp/.font-fix.pid )
  FIX_PID="$(cat /tmp/.font-fix.pid)"
  sleep 1
  ( cd "$APP_ROOT" && \
    NEXT_PUBLIC_APP_URL="https://laruvisona.jp" \
    NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$FIXTURE_PORT" \
    NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-stub" \
    SUPABASE_SERVICE_ROLE_KEY="service-stub" \
    setsid npx next start -p "$PORT" > "$OUT_DIR-server-$V.log" 2>&1 < /dev/null & echo $! > /tmp/.font-srv.pid )
  SRV_PID="$(cat /tmp/.font-srv.pid)"
  for _ in $(seq 1 60); do up "$PORT" && break; sleep 0.5; done
  up "$PORT" || { echo "サーバを起動できませんでした。$OUT_DIR-server-$V.log を見てください。" >&2; exit 1; }

  echo "[4/5] 配信中のHTMLが案 $V と一致するか確認"
  HP_HAS_FONT=$(curl -s "http://127.0.0.1:$PORT/hp/site-a" | grep -c '/fonts/noto.css' || true)
  TOP_HAS_FONT=$(curl -s "http://127.0.0.1:$PORT/" | grep -c '/fonts/noto.css' || true)
  case "$V" in
    now) WANT_HP=1; WANT_TOP=1 ;;   # 共通レイアウトが全ページに配る
    b)   WANT_HP=0; WANT_TOP=1 ;;   # 会社サイトだけ
    *)   WANT_HP=-1; WANT_TOP=-1 ;;
  esac
  if [ "$WANT_HP" -ge 0 ]; then
    [ "$HP_HAS_FONT" -gt 0 ] && GOT_HP=1 || GOT_HP=0
    [ "$TOP_HAS_FONT" -gt 0 ] && GOT_TOP=1 || GOT_TOP=0
    if [ "$GOT_HP" != "$WANT_HP" ] || [ "$GOT_TOP" != "$WANT_TOP" ]; then
      echo "配信中のビルドが案 $V と一致しません（顧客サイト=$GOT_HP 期待=$WANT_HP / 会社トップ=$GOT_TOP 期待=$WANT_TOP）。" >&2
      echo "古いサーバが残っていないか確認してください。" >&2
      exit 1
    fi
    echo "  一致（顧客サイト=$GOT_HP 会社トップ=$GOT_TOP）"
  fi

  echo "[5/5] 計測（各条件 $RUNS 回）"
  ( cd "$APP_ROOT" && node "$DIR/measure.mjs" \
      --variant "$V" --port "$PORT" --runs "$RUNS" \
      --brand-fonts "$BRAND_FONTS" --customer-css "$CUSTOMER_CSS" \
      --out "$OUT_DIR" \
      ${PLAYWRIGHT_FROM:+--playwright-from "$PLAYWRIGHT_FROM"} )

  stop_all
  echo
done

echo "すべての案の計測が終わりました: $OUT_DIR"
