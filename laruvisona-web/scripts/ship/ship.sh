#!/usr/bin/env bash
#
# 出荷係。Claudeが作ったコミットを origin のブランチへ push する。
#
# なぜ要るか:
#   Claudeが動いているクラウド側からは、このリポジトリへ push できない
#   （プロキシの許可リストに入っていない）。Mac側の作業用VMからも
#   GitHubの資格情報が見えない。資格情報があるのはこのターミナルだけなので、
#   最後のひと押しだけを、ここで受け持つ。
#
# 使い方:
#   scripts/ship.sh                      _ship/ に置かれた .bundle を全部出荷する
#   scripts/ship.sh <ブランチ名>          手元にあるそのブランチを出荷する
#   scripts/ship.sh -y ...               確認を飛ばす
#   scripts/ship.sh --allow-main main    本番ブランチへ出荷する（既定では拒否）
#   scripts/ship.sh install              見張りを取り付ける（24時間動かす）
#   scripts/ship.sh uninstall            見張りを外す
#   scripts/ship.sh status               見張りと待ち行列の様子を見る
#
# しないこと:
#   main / master へは出荷しない。早送りにならない push もしない（GitHubが弾く）。
#   マージも本番操作もしない。ここは「上げる」だけ。
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DROP="$REPO/_ship"
DONE="$DROP/done"
FAILED="$DROP/failed"
YES=0

ALLOW_PROTECTED=0
while :; do
  case "${1:-}" in
    -y) YES=1; shift ;;
    --allow-main) ALLOW_PROTECTED=1; shift ;;
    *) break ;;
  esac
done
cd "$REPO"
mkdir -p "$DROP" "$DONE" "$FAILED"

# 画面に出すときだけ色を付ける。ログに制御文字を残さないため。
if [ -t 1 ]; then
  c_ok()   { printf '\033[32m%s\033[0m\n' "$*"; }
  c_warn() { printf '\033[33m%s\033[0m\n' "$*"; }
  c_err()  { printf '\033[31m%s\033[0m\n' "$*"; }
else
  c_ok()   { printf '%s\n' "$*"; }
  c_warn() { printf '%s\n' "$*"; }
  c_err()  { printf '%s\n' "$*"; }
fi

ask() {
  [ "$YES" = 1 ] && return 0
  printf '  出荷しますか？ [y/N] '
  read -r a </dev/tty || return 1
  [ "$a" = "y" ] || [ "$a" = "Y" ]
}

# 本番ブランチ。既定では出荷しない。
#
# 見張りは人が見ていない時間に走る。置かれたbundleを何も考えず本番へ流す作りに
# すると、取り違えが一度起きただけで本番が飛ぶ。
# そこで「この1本は本番へ出してよい」という印を、bundleごとに付ける形にした。
#   _ship/xxx.bundle          … いつもどおり。main を拒否する
#   _ship/xxx.bundle.allow-main … 隣にこれがあるbundleだけ、main を通す
# 手で出すときは scripts/ship.sh --allow-main main
protected() {
  case "$1" in
    main|master|release|production)
      [ "${ALLOW_PROTECTED:-0}" = 1 ] && return 1
      return 0 ;;
    *) return 1 ;;
  esac
}

# 一本のrefを出荷する。$1=送りたいコミット $2=ブランチ名
ship_ref() {
  local sha="$1" br="$2"

  if protected "$br"; then
    c_err "  $br は出荷しません（本番ブランチ）。"
    c_err "  出すなら、bundleの隣に .allow-main を置くか、--allow-main を付けてください。"
    return 1
  fi
  if [ "${ALLOW_PROTECTED:-0}" = 1 ] && case "$br" in main|master|release|production) true ;; *) false ;; esac; then
    c_warn "  ★ 本番ブランチ $br へ出荷します。"
  fi

  git fetch --quiet origin || true

  echo "  ブランチ : $br"
  echo "  コミット : $sha"
  local base
  base="$(git merge-base "$sha" origin/main 2>/dev/null || true)"
  if [ -n "$base" ]; then
    echo "  origin/main から:"
    git --no-pager log --oneline "origin/main..$sha" | sed 's/^/    /'
  fi

  local remote
  remote="$(git ls-remote origin "refs/heads/$br" | awk '{print $1}')"
  if [ -n "$remote" ]; then
    if [ "$remote" = "$sha" ]; then
      c_ok "  すでに同じ内容が上がっています。何もしません。"
      return 0
    fi
    if ! git merge-base --is-ancestor "$remote" "$sha"; then
      c_err "  リモートの $br が進んでいます。早送りにならないので出荷しません。"
      c_err "  リモート: $remote"
      return 1
    fi
    echo "  リモートを $remote から進めます。"
  fi

  ask || { c_warn "  やめました。"; return 1; }

  git push origin "$sha:refs/heads/$br"
  local after
  after="$(git ls-remote origin "refs/heads/$br" | awk '{print $1}')"
  if [ "$after" = "$sha" ]; then
    c_ok "  出荷しました: $br -> $after"
    return 0
  fi
  c_err "  push後のSHAが合いません: $after"
  return 1
}

LABEL="com.laruvisona.ship"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

# --- 見張りの取り付け・取り外し・様子見 ---------------------------------
case "${1:-}" in
  install)
    mkdir -p "$HOME/Library/LaunchAgents"
    cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$REPO/scripts/ship-watch.sh</string>
  </array>
  <key>WatchPaths</key>
  <array><string>$DROP</string></array>
  <key>StartInterval</key><integer>300</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$DROP/launchd.out.log</string>
  <key>StandardErrorPath</key><string>$DROP/launchd.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
PLISTEOF
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load -w "$PLIST"
    c_ok "見張りを取り付けました。"
    echo "  $DROP に .bundle が置かれたら、確認を待たずに出荷します。"
    echo "  巡回もします（5分おき、ログイン時にも一度）。"
    echo "  記録: $DROP/ship.log"
    exit 0
    ;;
  uninstall)
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload -w "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    c_ok "見張りを外しました。手で出荷するぶんには今までどおり使えます。"
    exit 0
    ;;
  status)
    if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
      c_ok "見張りは動いています。"
      launchctl print "gui/$(id -u)/$LABEL" | grep -E "state =|last exit code|runs =" | sed 's/^[[:space:]]*/  /'
    else
      c_warn "見張りは入っていません（scripts/ship.sh install で取り付け）。"
    fi
    echo "  待ち  : $(ls "$DROP"/*.bundle 2>/dev/null | wc -l | tr -d ' ') 件"
    echo "  済み  : $(ls "$DONE"/*.bundle 2>/dev/null | wc -l | tr -d ' ') 件"
    echo "  不調  : $(ls "$FAILED"/*.bundle 2>/dev/null | wc -l | tr -d ' ') 件"
    if [ -f "$DROP/ship.log" ]; then
      echo "  直近の記録:"
      tail -n 12 "$DROP/ship.log" | sed 's/^/    /'
    fi
    exit 0
    ;;
esac

# --- 手元のブランチを出荷する -------------------------------------------
if [ $# -gt 0 ]; then
  br="$1"
  sha="$(git rev-parse --verify "refs/heads/$br" 2>/dev/null || true)"
  if [ -z "$sha" ]; then
    c_err "手元に $br というブランチがありません。"
    exit 1
  fi
  echo "=== $br"
  ship_ref "$sha" "$br"
  exit $?
fi

# --- _ship/ に置かれた bundle を出荷する --------------------------------
shopt -s nullglob
bundles=("$DROP"/*.bundle)
if [ ${#bundles[@]} -eq 0 ]; then
  echo "出荷するものがありません。"
  echo "  $DROP に .bundle を置くか、scripts/ship.sh <ブランチ名> を使ってください。"
  exit 0
fi

fail=0
for b in "${bundles[@]}"; do
  echo "=== $(basename "$b")"
  if ! git bundle verify "$b" >/dev/null 2>&1; then
    c_err "  中身を読めません。failed/ へ移します。"
    mv "$b" "$FAILED/"
    fail=1
    continue
  fi

  # この1本だけ本番を許す印
  if [ -f "$b.allow-main" ]; then
    ALLOW_PROTECTED=1
    c_warn "  .allow-main あり。このbundleは本番ブランチへの出荷を許します。"
  else
    ALLOW_PROTECTED=0
  fi

  bad=0
  while read -r sha ref; do
    br="${ref#refs/heads/}"
    tmp="refs/ship/$br"
    # 取り込みに失敗したまま先へ進むと、**前回の refs/ship/* をそのまま出荷対象に
    # してしまい、「すでに同じ内容が上がっています」とだけ出る。**
    # 実際にこれで一度、.git のロックが残ったまま静かに詰まった。
    # 出荷できていないのに、画面上は正常に見えていた。ここで止める。
    if ! git fetch --quiet --force "$b" "$ref:$tmp"; then
      c_err "  bundle から $ref を取り込めませんでした。"
      c_err "  .git にロックが残っていないか見てください（_ship/ship.log にも出ます）。"
      bad=1
      continue
    fi
    got="$(git rev-parse --verify "$tmp" 2>/dev/null || true)"
    if [ "$got" != "$sha" ]; then
      c_err "  取り込んだ中身が bundle と合いません: ${got:-なし} != $sha"
      bad=1
      continue
    fi
    if ship_ref "$sha" "$br"; then
      # 手元のブランチも、早送りになるときだけ合わせておく
      cur="$(git rev-parse --verify "refs/heads/$br" 2>/dev/null || true)"
      if [ -z "$cur" ] || git merge-base --is-ancestor "$cur" "$sha"; then
        git update-ref "refs/heads/$br" "$sha"
      else
        c_warn "  手元の $br は別の先端なので、そのままにしました。"
      fi
    else
      bad=1
    fi
    git update-ref -d "$tmp" 2>/dev/null || true
  done < <(git bundle list-heads "$b")

  # 上げ切れなかったものは failed/ へ。5分おきに同じ失敗を繰り返さないため。
  # コミット自体は手元のrefに取り込み済みなので、直したあと手で出荷できる。
  if [ "$bad" = 0 ]; then
    [ -f "$b.allow-main" ] && mv "$b.allow-main" "$DONE/"
    mv "$b" "$DONE/"
    echo "  $(basename "$b") を done/ へ移しました。"
  else
    [ -f "$b.allow-main" ] && mv "$b.allow-main" "$FAILED/"
    mv "$b" "$FAILED/"
    c_warn "  $(basename "$b") を failed/ へ移しました。直したら scripts/ship.sh <ブランチ名> で出せます。"
    fail=1
  fi
done
exit $fail
