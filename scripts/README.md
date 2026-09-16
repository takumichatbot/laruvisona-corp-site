# 出荷係（ship.sh）

## 何をするもの

Claudeが作ったコミットを、origin のブランチへ push する。それだけ。

## なぜ要るか

Claudeが動いているクラウド側からは、このリポジトリへ push できない
（git proxy の許可リストに入っていない）。Mac側の作業用VMからも
GitHubの資格情報が見えない。資格情報があるのは本人のターミナルだけなので、
最後のひと押しだけを、そこで受け持つ。

Claudeは `_ship/` に git bundle を置く。あとは出荷係が運ぶ。

## 使い方

```
scripts/ship.sh                      _ship/ に置かれた .bundle を全部出荷する
scripts/ship.sh <ブランチ名>          手元にあるそのブランチを出荷する
scripts/ship.sh -y ...               確認を飛ばす
scripts/ship.sh --allow-main main    本番ブランチへ出荷する（既定では拒否）
scripts/ship.sh install              見張りを取り付ける（24時間動かす）
scripts/ship.sh uninstall            見張りを外す
scripts/ship.sh status               見張りと待ち行列の様子を見る
```

`install` すると launchd のユーザーエージェント `com.laruvisona.ship` が入る。
`_ship/` に変化があった瞬間に起きるほか、5分おきの巡回とログイン時の一回がある。
待っているものが無ければ何も書かずに終わる。

## 歯止め

人が見ていない時間に走るので、次は必ず守る。

- `main` / `master` / `release` / `production` へは既定で出荷しない。
  出すには「この1本は本番へ出してよい」という印を、bundleごとに付ける。
  見張りは人が見ていない時間に走るので、置かれたbundleを何も考えず本番へ流す
  作りにはしない。取り違えが一度起きただけで本番が飛ぶため。

  ```
  _ship/xxx.bundle              いつもどおり。main を拒否する
  _ship/xxx.bundle.allow-main   隣にこれがあるbundleだけ、main を通す
  ```

  手で出すときは `scripts/ship.sh --allow-main main`。
- 早送りにならない push はしない（リモートが進んでいたら止め、そのSHAを記録する）
- 二重起動しない（`_ship/.lock`）
- マージも本番操作もしない

## 置き場

```
_ship/                出荷待ち。ここに .bundle を置く
_ship/done/           出荷できたもの
_ship/failed/         上げ切れなかったもの。5分おきに同じ失敗を繰り返さないため隔離する
_ship/ship.log        記録。直近2000行で頭打ち
```

`_ship/` は `.git/info/exclude` に入れてあるので、`git status` には出ない。

失敗したbundleの中身は、その時点で手元のブランチに取り込み済み。
原因を直したあと `scripts/ship.sh <ブランチ名>` で出せる。

## 確認したこと（2026-09-16）

使い捨てのリポジトリを立てて、次を通した。

- 出荷成功 → `done/` へ移動、push後のSHAを照合、ログに記録
- `main` の bundle → 拒否して `failed/` へ
- リモートが進んでいる場合 → 停止し、リモートは動かないまま
- 同じ内容 → 「すでに上がっています」で何もしない
- 待ちが無いとき → 無言で終了し、ログも増えない
