#!/usr/bin/env bash
#
# 出荷係の見張り。launchd から呼ばれる。
#
#   ・_ship/ に .bundle が置かれた瞬間（WatchPaths）
#   ・5分おきの巡回（StartInterval 300）
#   ・ログインしたとき（RunAtLoad）
#
# 版: 2026-09-18
#
# ── なぜ作り直したか ────────────────────────────────────────────
#
# 前の版は「待っているものが無ければ、何も書かずに黙って終わる」作りだった。
# ログを汚さないためだったが、そのせいで
#
#   **止まっているのか、静かなだけなのかが、誰にも分からなかった。**
#
# 実際に一度、.git にロックが残ったまま静かに詰まり、
# 「すでに同じ内容が上がっています」とだけ言い続けていた。
# 出荷できていないのに、画面上は正常に見えていた。
#
# そこで、走るたびに必ず _ship/state/heartbeat を書き直す。
# そこの日時が古ければ、見張りは死んでいる。それだけで分かる。
#
# ついでに、静かに詰まる道を3つ塞いだ。
#   1. 落ちた出荷が残した .lock（これがあると以後ずっと何もしない）
#   2. .git に残ったロック（これで一度、実際に詰まった）
#   3. GitHubへ届かなくなったこと（鍵の期限切れなど）に、
#      bundleを置くまで気づけなかったこと
#
# ── 置き場所の注意 ─────────────────────────────────────────────
#
# heartbeat は _ship/ の**直下に置いてはいけない。**
# launchd が _ship/ を見張っているので、直下に書くと自分で自分を起こし続ける。
# だから _ship/state/ の中に、上書きで書く（新規作成や mv はしない）。
#
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DROP="$REPO/_ship"
STATE="$DROP/state"
LOG="$DROP/ship.log"
LOCK="$DROP/.lock"
BEAT="$STATE/heartbeat"
REMOTE_STAMP="$STATE/.remote-checked"
FAILED_STAMP="$STATE/.failed-notified"

LOCK_STALE_SEC=1800      # 30分。これを過ぎた .lock は落ちた跡とみなす
GIT_LOCK_STALE_SEC=900   # 15分。これを過ぎた .git のロックも同じ
REMOTE_EVERY_SEC=1800    # GitHubへ届くかの確認は30分に1回
DEPLOY_WARN_SEC=900      # push から15分経っても本番が入れ替わらなければ知らせる

HEALTH_URL="https://laruvisona.jp/api/health"
EXPECT="$STATE/expect-sha"          # 出荷したコミット。本番に出るまで持っておく
DEPLOY_STAMP="$STATE/.deploy-warned"

shopt -s nullglob   # 数える所より先に立てる。下の count_bundles がこれに頼っている
mkdir -p "$DROP" "$STATE"

now()  { date '+%Y-%m-%d %H:%M:%S'; }
secs() { date '+%s'; }

# ファイルの経過秒。無ければ大きい数を返す。
#
# stat は BSD(mac) と GNU(Linux) で書式が違い、取り違えると
# **数でないものを数として扱って落ちる。** date -r はどちらでも同じに動く。
#
# 読めなかったときは 0（＝できたて）を返す。
# 大きい数を返すと、生きている .lock を「古い」と見て壊しに行ってしまう。
# 分からないときは、壊さない側に倒す。脈が古いままになるので、人には見える。
age() {
  [ -e "$1" ] || { echo 999999999; return; }
  local m
  m="$(date -r "$1" '+%s' 2>/dev/null || true)"
  case "$m" in ''|*[!0-9]*) echo 0; return ;; esac
  echo $(( $(secs) - m ))
}

log() {
  {
    printf '──────── %s\n' "$(now)"
    printf '%s\n' "$*"
  } >> "$LOG"
}

notify() {
  command -v osascript >/dev/null 2>&1 || return 0
  local title="$1" body="$2"
  osascript -e "display notification \"${body//\"/\\\"}\" with title \"出荷係\" subtitle \"${title//\"/\\\"}\"" >/dev/null 2>&1 || true
}

# 鍵や合言葉が混ざった行を、そのまま記録しない
scrub() { sed -E 's#(https://)[^@/[:space:]]*@#\1#g'; }

# 数えるのに ls を使ってはいけない。
# nullglob を立てているので、1件も無いと glob が**消える**。
# 残るのは引数なしの `ls` で、それは「いまいる場所」を並べる。
# 実際これで、待ち0件のときに「待ち 16 件」と出た。
count_bundles() { local -a a=("$1"/*.bundle); printf '%s' "${#a[@]}"; }
queue_count()  { count_bundles "$DROP"; }
failed_count() { count_bundles "$DROP/failed"; }

# push は成功したのに本番が入れ替わらない、という状態が**どこからも見えなかった。**
# 出荷係は push までしか知らない。Vercel の画面を人が開くまで誰も気づけない。
# 本番の /api/health が返すコミットと、出荷したコミットを突き合わせる。
PROD_STATE=""
check_deploy() {
  [ -s "$EXPECT" ] || { PROD_STATE="待ちなし"; return; }
  local want live waited
  want="$(cat "$EXPECT")"
  waited="$(age "$EXPECT")"
  local body code
  body="$(curl -sS --max-time 15 -w '\n%{http_code}' "$HEALTH_URL" 2>/dev/null)"
  code="$(printf '%s' "$body" | tail -1)"
  live="$(printf '%s' "$body" | sed -n 's/.*"commit":"\([0-9a-f]*\)".*/\1/p')"
  if [ -z "$live" ]; then
    # 「確認できません」だけだと、まだ配られていないのか、落ちているのかが
    # 分からない。何が返ってきたかまで書く。
    case "$code" in
      404) PROD_STATE="まだ入れ替わっていません（/api/health がありません）" ;;
      200) PROD_STATE="答えは返りますが、コミットが入っていません"
           # 何が返っているのかが分からないと直しようがない。1時間に1回だけ残す。
           if [ "$(age "$DEPLOY_STAMP")" -gt 3600 ]; then
             : > "$DEPLOY_STAMP"
             log "  本番は答えますが、コミットが入っていません。返ってきたもの:
$(printf '%s' "$body" | head -c 300 | scrub | sed 's/^/    /')"
           fi ;;
      ''|000) PROD_STATE="本番に届きません（通信できません）" ;;
      *)   PROD_STATE="本番が $code を返しました" ;;
    esac
    return
  fi
  # 返ってくる識別子は7桁のこともある。先頭で合わせる。
  if [ "${#live}" -ge 7 ] && [ "${want:0:${#live}}" = "$live" ]; then
    PROD_STATE="反映済み ${want:0:7}（$((waited/60))分）"
    : > "$EXPECT"
    return
  fi
  PROD_STATE="まだ ${live:0:7}（出荷は ${want:0:7}・$((waited/60))分経過）"
  if [ "$waited" -gt "$DEPLOY_WARN_SEC" ] && [ "$(age "$DEPLOY_STAMP")" -gt 3600 ]; then
    : > "$DEPLOY_STAMP"
    log "  push は済んでいるのに、本番がまだ入れ替わっていません。
    出荷: $want
    本番: $live
    $((waited/60))分経過。Vercel の様子を見てください。"
    notify "本番が古いままです" "出荷 ${want:0:7} / 本番 ${live:0:7}"
  fi
}

# heartbeat は上書きで書く（_ship/ の中身を増減させないため）
beat() {
  local state="$1"
  printf '%s' "\
最終確認 : $(now)
見張り   : $state
待ち     : $(queue_count) 件
不調     : $(failed_count) 件
GitHub   : ${REMOTE_STATE:-未確認}
本番     : ${PROD_STATE:-未確認}
直近出荷 : ${LAST_SHIP:-$(grep '出荷しました' "$LOG" 2>/dev/null | tail -1 | sed 's/^ *//')}
版       : 2026-09-18
" > "$BEAT"
}

# ── 0. 自分で自分を起こし続けないための歯止め ──────────────────────
# 何も待っていないのに1分以内にまた呼ばれたら、何もせず引き下がる。
bundles=("$DROP"/*.bundle)
if [ ${#bundles[@]} -eq 0 ] && [ "$(age "$BEAT")" -lt 60 ]; then
  exit 0
fi

# ── 1. 落ちた出荷が残した .lock を外す ─────────────────────────────
# これが残っていると、以後の巡回はすべて「先客あり」で黙って帰る。
# 見た目は正常のまま、二度と出荷されなくなる。
if [ -d "$LOCK" ] && [ "$(age "$LOCK")" -gt "$LOCK_STALE_SEC" ]; then
  log "  前の出荷の印（.lock）が $((LOCK_STALE_SEC/60))分以上 残っていました。
  落ちた跡とみなして外します。ここが残っていると、以後ずっと何も出荷されません。"
  rmdir "$LOCK" 2>/dev/null || rm -rf "$LOCK" 2>/dev/null || true
  notify "詰まりを外しました" "前の出荷の印が残っていました"
fi

# 先客がいるなら引き下がる。二重に push しないため。
if ! mkdir "$LOCK" 2>/dev/null; then
  beat "他の出荷が動いています"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

# ── 2. .git に残ったロックを外す ───────────────────────────────────
# 一度これで実際に詰まった（HEAD.lock と index.lock）。
# ここまで来ている時点で出荷は動いていないので、古いロックは残骸とみなす。
stale_git="$(find "$REPO/.git" -maxdepth 3 -name '*.lock' -type f 2>/dev/null | while read -r f; do
  [ "$(age "$f")" -gt "$GIT_LOCK_STALE_SEC" ] && printf '%s\n' "$f"
done)"
if [ -n "$stale_git" ]; then
  log "  .git に古いロックが残っていました。外します（これで一度、静かに詰まりました）:
$(printf '%s\n' "$stale_git" | sed 's/^/    /')"
  printf '%s\n' "$stale_git" | while read -r f; do rm -f "$f" 2>/dev/null || true; done
  notify "詰まりを外しました" "gitのロックが残っていました"
fi

# ── 3. GitHubへ届くか、定期的に確かめる ────────────────────────────
# 鍵の期限が切れても、bundleを置くまで気づけなかった。
# 置く前に分かるようにする。
REMOTE_STATE=""
if [ "$(age "$REMOTE_STAMP")" -gt "$REMOTE_EVERY_SEC" ]; then
  if out="$(cd "$REPO" && git ls-remote --heads origin main 2>&1)"; then
    : > "$REMOTE_STAMP"
    REMOTE_STATE="届きます ($(printf '%s' "$out" | awk 'NR==1{print substr($1,1,7)}'))"
  else
    REMOTE_STATE="届きません"
    log "  GitHub に届きません。いま bundle を置いても出荷できません。
$(printf '%s' "$out" | scrub | sed 's/^/    /')"
    notify "届きません" "GitHubに接続できません。鍵の期限が切れていませんか"
  fi
else
  REMOTE_STATE="届きます（$(( $(age "$REMOTE_STAMP") / 60 ))分前に確認）"
fi

# ── 4. 待っているものが無ければ、脈だけ残して終わる ────────────────
if [ ${#bundles[@]} -eq 0 ]; then
  # 不調の山を放置しない。1日に1回だけ知らせる。
  if [ "$(failed_count)" -gt 0 ] && [ "$(age "$FAILED_STAMP")" -gt 86400 ]; then
    : > "$FAILED_STAMP"
    log "  出荷できないままの bundle が $(failed_count) 件あります（_ship/failed/）。"
    notify "未処理あり" "出せていない bundle が $(failed_count) 件あります"
  fi
  check_deploy
  beat "動いています"
  exit 0
fi

# ── 5. 出荷する ────────────────────────────────────────────────────
out="$("$REPO/scripts/ship.sh" -y 2>&1)"
rc=$?

{
  printf '──────── %s\n' "$(now)"
  printf '%s\n' "$out" | scrub
  printf '  終了コード: %s\n' "$rc"
} >> "$LOG"

# ログが太りすぎないよう、直近2000行だけ残す
if [ "$(wc -l < "$LOG")" -gt 2000 ]; then
  tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

if [ "$rc" -eq 0 ]; then
  LAST_SHIP="$(printf '%s' "$out" | grep '出荷しました' | head -1 | sed 's/^ *//')"
  [ -n "$LAST_SHIP" ] && notify "完了" "$LAST_SHIP"
  # 本番に出るまで、出荷したコミットを控えておく
  shipped="$(printf '%s' "$out" | sed -n 's/.*出荷しました: main -> \([0-9a-f]\{40\}\).*/\1/p' | tail -1)"
  [ -n "$shipped" ] && printf '%s' "$shipped" > "$EXPECT"
  check_deploy
  beat "動いています"
else
  line="$(printf '%s' "$out" | grep -E '出荷しません|合いません|読めません|ありません|進んでいます' | head -1 | sed 's/^ *//')"
  notify "止まりました" "${line:-ship.log を見てください}"
  beat "出荷に失敗しました（ship.log を見てください）"
fi
exit 0
