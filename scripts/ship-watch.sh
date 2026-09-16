#!/usr/bin/env bash
#
# 出荷係の見張り。launchd から呼ばれる。
#
#   _ship/ に .bundle が置かれた瞬間（WatchPaths）と、5分おきの巡回で起きる。
#   待っているものが無ければ、何も書かずに黙って終わる。ログを汚さないため。
#
#   人が見ていない時間に走るので、確認は出さない（-y）。
#   代わりに ship.sh 側の歯止めがそのまま効く:
#     ・main / master / release / production へは出荷しない
#     ・早送りにならない push はしない
#   結果は _ship/ship.log に残し、通知センターにも出す。
#
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DROP="$REPO/_ship"
LOG="$DROP/ship.log"
LOCK="$DROP/.lock"

shopt -s nullglob
bundles=("$DROP"/*.bundle)
[ ${#bundles[@]} -eq 0 ] && exit 0

# 先客がいるなら引き下がる。二重に push しないため。
mkdir "$LOCK" 2>/dev/null || exit 0
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

notify() {
  command -v osascript >/dev/null 2>&1 || return 0
  local title="$1" body="$2"
  osascript -e "display notification \"${body//\"/\\\"}\" with title \"出荷係\" subtitle \"${title//\"/\\\"}\"" >/dev/null 2>&1 || true
}

out="$("$REPO/scripts/ship.sh" -y 2>&1)"
rc=$?

{
  printf '──────── %s\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  printf '%s\n' "$out"
  printf '  終了コード: %s\n' "$rc"
} >> "$LOG"

# ログが太りすぎないよう、直近2000行だけ残す
if [ "$(wc -l < "$LOG")" -gt 2000 ]; then
  tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

if [ "$rc" -eq 0 ]; then
  line="$(printf '%s' "$out" | grep '出荷しました' | head -1 | sed 's/^ *//')"
  [ -n "$line" ] && notify "完了" "$line"
else
  line="$(printf '%s' "$out" | grep -E '出荷しません|合いません|読めません|ありません' | head -1 | sed 's/^ *//')"
  notify "止まりました" "${line:-ship.log を見てください}"
fi
exit 0
