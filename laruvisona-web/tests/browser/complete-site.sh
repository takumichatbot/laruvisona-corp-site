#!/usr/bin/env bash
#
# 「自分の会社の情報で、迷わずサイトを完成させる」確認の入口（業種・検索掲載・公開の準備→編集欄・AI文案・工務店の一本通し）。
# 前提は style-direction.sh と同じ（起動したばかりの偽DB と、fixture 向けビルドの next start -p 3319）。
# AI文案の確認は、AIの代わりに偽DBの保存済み応答を使う：AIMOCK=1 相当（ANTHROPIC_API_KEY=任意の手元値・
# ANTHROPIC_BASE_URL=http://127.0.0.1:54999/anthropic）で起動したときだけ流す。実モデルは呼ばない。
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
status=0
run() { echo; echo "== $1"; shift; "$@" || status=1; }
run 'Studio：本人が選んだ業種を保存・読み直しで保つ' node tests/browser/studio-industry-check.mjs
run 'Studio：完成像と「公開の準備」に、保存済みの検索掲載の設定' node tests/browser/studio-noindex-check.mjs
run 'Studio：公開の準備 → その欄（PC・390・320）' node tests/browser/studio-ready-jump-check.mjs
if curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:54999/anthropic/v1/messages -d '{}' | grep -q 200 && [ "${AIMOCK:-0}" = 1 ]; then
  run 'Studio：本人の情報 → AI文案（保存済み応答）→ 見比べ → 採用 → 取り消し・契約前' node tests/browser/studio-ai-facts-check.mjs
else
  echo; echo '== AI文案の確認は省略（AIMOCK=1 で、偽DBの保存済み応答に向けたサーバーのときだけ流す）'
fi
exit $status
