#!/usr/bin/env bash
#
# vNext 1〜5（言葉で直す・参考画像から・公開前の見直し・会社の情報・表現の整理）の確認の入口。
# 前提は style-direction.sh と同じ（起動したばかりの偽DB と、fixture 向けビルドの next start -p 3319）。
# AI の部分（読めない言い回し・AIの見立て）は AIMOCK=1（偽DBの保存済み応答）のときだけ流す。実モデルは呼ばない。
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
status=0
run() { echo; echo "== $1"; shift; "$@" || status=1; }
run '計画を当てた公開HTML：意図×写真の状態×幅・動きを減らす設定・最初の画面の読みやすさ' node --import ./tests/_resolve-ts.mjs tests/browser/design-plan-render.ts
run 'Studio：言葉で直す・選んだ節・参考画像・公開前の見直し・会社の情報（PC・390・320、保存・読み直し）' node tests/browser/studio-design-assist-check.mjs
exit $status
