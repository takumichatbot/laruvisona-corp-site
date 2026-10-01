#!/usr/bin/env bash
#
# 見た目の3案（Style Direction）の確認の入口。ここから全部を1回ずつ順に流す。
# 旧 tests/browser/studio-direction-check.mjs もここから呼ぶ（自分の写真を実際にアップロードした経路・
# トップの試作・公開。見本写真で比べる style-direction-v1-check.mjs とは入れる写真が違う）。
#
# 前提（ほかの確認と同じ）:
#   FIXTURE_PORT=54999 node tests/http/fixture.cjs          … 起動したばかりの偽DB
#   fixture 向けにビルドしたものを ADMIN_SECRET=<手元だけの値> で next start -p 3319
# 環境変数:
#   CHROMIUM_PATH, PLAYWRIGHT_CORE_FROM（playwright-core の場所）, ADMIN_SECRET, OUTPUT_DIR（既定 /tmp/laruhp-style-direction）
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
OUT="${OUTPUT_DIR:-/tmp/laruhp-style-direction}"
export OUTPUT_DIR="$OUT" PLAYWRIGHT_FROM="${PLAYWRIGHT_FROM:-${PLAYWRIGHT_CORE_FROM:-}}"
TS="node --import ./tests/_resolve-ts.mjs"
status=0
run() { echo; echo "== $1"; shift; "$@" || status=1; }

run '公開HTML：3案×画像の状態×幅・数字・動き・互換' bash -c "$TS tests/browser/style-direction-v1-render.ts '$OUT/render' && node tests/browser/style-direction-v1-static.mjs"
run 'Studio（パソコン）：比較・やめる・採用・取り消し・選び直し・保存・書き出し' node tests/browser/style-direction-v1-check.mjs
run 'Studio（スマホ）：比較ダイアログの操作' node tests/browser/style-direction-v1-dialog-sp.mjs
run 'Studio：自分の写真（実アップロード）での比較・採用・保存・公開' env OUTPUT_DIR="$OUT/own-photo" node tests/browser/studio-direction-check.mjs
run '背景動画・2ページ目' $TS tests/browser/style-direction-v1-pages-video.ts
run '保存API：保存→読み直し→描画→公開' $TS tests/http/style-direction-save-check.ts
run '公開済みサイト：一括再生成で未公開の下書きを出さない' node tests/http/republish-draft-check.mjs
exit $status
