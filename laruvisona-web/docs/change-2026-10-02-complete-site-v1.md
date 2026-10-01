# 自分の会社の情報で、迷わずサイトを完成させる（complete-site v1）

基準：origin/main = 本番 = f14caed。ブランチ dev/complete-site-v1（f14caed から）。main への push・デプロイはしていない。

## 状態の区別

| 項目 | 実装済み | ローカル確認済み | 本番確認済み |
|---|---|---|---|
| 1-A お知らせ記事・ショップの題名を、親サイトを公開した時点の名前に（c1d0dd6） | ○ | ○ | 未 |
| 1-B 業種を保存・読み直しで保つ（9f060aa） | ○ | ○ | 未 |
| 1-C 完成像に保存済みの noindex、「公開の準備」に掲載設定（816fb2e）／以前のサイトの検索設定を空にしない（e9a894b） | ○ | ○ | 未 |
| 2 公開の準備 → 節・項目・問題・操作 → その欄（8b3d864） | ○ | ○（PC・390・320 幅） | 未 |
| 2-D 書き方の案内（共通＋工事・施工／美容／飲食） | ○ | ○ | 未 |
| 3 本人の情報から、その欄の AI 文案（fc18166・cb2163c） | ○ | ○（保存済み応答のみ） | 未 |
| 3 実モデル（claude-haiku-4-5）での文案の質 | ― | 未（承認待ち） | 未 |
| 4 工務店の一本通し・変更前との比較（007778a） | ― | ○ | 未 |
| Safari・iPhone 実機 | ― | 未 | 未 |

## 確認の入口

- `tests/browser/complete-site.sh`（業種・noindex・公開の準備→欄・工務店の一本通し。AIMOCK=1 のときだけ AI 文案）
- `tests/browser/style-direction.sh`（既存の完成済み部分の退行確認）
- `MODE=before BASE=<f14caed のサーバー> node tests/browser/complete-site-flow-check.mjs`（変更前の数え方）

## 既知の残り（今回は直していない）

- studio-craft-check の「320 real save API」、studio-craft-media-check、studio-history-check は f14caed でも同じ箇所で止まる（今回の変更と無関係・未調査）
- 本人の情報に無い数字・地名・語の確かめは機械的なもの。漢数字や言い換えは拾えない。採用前の本人確認が前提
- PC では「公開の準備に戻る」は編集欄の先頭にあり、欄まで進むと画面の外になる（上の「公開の準備」タブはいつでも押せる）
